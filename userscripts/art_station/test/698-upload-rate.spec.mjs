// #698 (majkinetor): "Show real time upload rate in Enter Edit screen."
//
// The commit window's overall bar shows the bytes the uploads have sent and their
// rate: live while uploading ("↑ 256.0 KB / 1.61 MB · 213.4 KB/s"), then the
// average once they're done ("↑ 1.61 MB at 254.0 KB/s").
//
// A rate is only real on a real upload, so a generated 1.6 MB PNG goes to the
// Internet Archive as the sandbox signs it, with the browser's upload throttled so
// the live phase lasts a few seconds. The register and reorder POSTs are aborted:
// no edit is created. Runs on test.musicbrainz.org.
import { test, check, until, requireLogin, SANDBOX, idle, attachShot } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Art Station' } });

test('the commit window shows the live upload rate, then the average', { tag: ['@sandbox', '@login', '@web'] }, async ({ page, context, inject }, testInfo) => {
  const RELEASE = '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
  const KBPS = 300;
  await page.route(/\/(add|reorder)-cover-art(\?|$)/, r => r.request().method() === 'POST' ? r.abort() : r.fallback());
  await page.goto(`${SANDBOX}/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await idle(page);
  await inject('art_station');
  await page.waitForSelector('#as-root', { timeout: 20000 });
  await idle(page);

  // a random-noise PNG doesn't compress: ~1.6 MB, a few seconds at the throttled rate
  const size = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 700;
    const x = c.getContext('2d'), d = x.createImageData(700, 700);
    for (let i = 0; i < d.data.length; i++) d.data[i] = i % 4 === 3 ? 255 : Math.random() * 256;
    x.putImageData(d, 0, 0);
    const file = new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'rate-698.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(file);
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    return file.size;
  });
  check(await until(() => page.evaluate(() => !document.querySelector('.as-commit')?.disabled), Boolean), `fixture: a ${size} B file staged`);

  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 20, downloadThroughput: -1, uploadThroughput: KBPS * 1024 });
  await page.evaluate(() => document.querySelector('.as-commit').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));   // right-click: run at once

  const bar = () => page.evaluate(() => document.querySelector('#as-commit .as-cm-prog-txt')?.textContent || '');
  const live = await until(bar, s => /↑ [\d.]+ (KB|MB) \/ [\d.]+ MB · [\d.]+ (KB|MB)\/s$/.test(s));
  console.log('live: ' + live);
  check(/^0 \/ \d+ · 0% · ↑ [\d.]+ (KB|MB) \/ 1\.\d\d MB · [\d.]+ (KB|MB)\/s$/.test(live), `while uploading: sent / total and the rate — "${live}"`);
  await attachShot(testInfo, page.locator('#as-commit .as-cm-box'), 'uploading');
  const kb = s => { const m = s.match(/([\d.]+) (KB|MB)\/s/); return m ? +m[1] * (m[2] === 'MB' ? 1024 : 1) : NaN; };
  const later = await until(bar, s => kb(s) > KBPS / 3 && /\/s$/.test(s));
  check(kb(later) > KBPS / 3 && kb(later) < KBPS * 1.5, `the live rate is about the throttled ${KBPS} KB/s — "${later}"`);

  const avg = await until(bar, s => / at [\d.]+ (KB|MB)\/s$/.test(s), { timeout: 60000 });
  console.log('after: ' + avg);
  check(/↑ 1\.\d\d MB at [\d.]+ (KB|MB)\/s$/.test(avg), `once uploaded: all of it, at the average rate — "${avg}"`);
  check(kb(avg) > 0 && kb(avg) < KBPS * 1.5, `the average is no faster than the throttle (${kb(avg)} KB/s)`);
  await until(() => page.evaluate(() => /Repeat/.test(document.querySelector('#as-commit .as-cm-go')?.textContent || '')), Boolean);
  check(/ at [\d.]+ (KB|MB)\/s$/.test(await bar()), 'the average stays when the run ends (here: the register was refused)');
});
