// #680: ⚙ holds only Auto probe, "reload after Execute" and (#702) Mission Control after a consolidation's save, with (#776) its Execute. With the reload on, an Execute
// without errors reloads the release page; a failed step leaves the page as it is.
// A stand-in PC answers the probe with one selected finding and pretends to apply it: nothing is written.
import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-in's

test('#680: reload the release page after an Execute without errors', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    window.__fail = true;
    window.__marker = 1;   // gone once the page reloads
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, findings: [{ key: 'deezer', name: 'Deezer', url: 'https://www.deezer.com/album/1', state: 'new' }] }), 50);
    });
    document.addEventListener('mc:apply', e => {
      const d = JSON.parse(e.detail);
      setTimeout(() => send('mc:applied', window.__fail ? { id: d.id, run: d.run, ok: false, note: 'stand-in failure' } : { id: d.id, run: d.run, ok: true, sent: 1, note: 'stand-in' }), 20);
    });
    send('mc:provider', { id: 'pc', name: 'pc', version: 1, capabilities: ['probe', 'apply'] });
    // #792: First Contact reads the link without a barcode (an album it can't compare), so it is selected
    document.addEventListener('mc:read', e => { const d = JSON.parse(e.detail); setTimeout(() => send('mc:read-result', { url: d.url, run: d.run, ok: true, provider: { id: 'deezer' }, rel: { title: 'x', mediums: [] }, ms: 1 }), 10); });
    send('mc:provider', { id: 'fc', name: 'fc', version: 1, capabilities: ['read'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');

  check((await page.evaluate(() => window.__mcTest.settings())).reloadAfter === true, 'the reload is on by default');
  await page.click('#mc-root [data-act="cfg"]');
  const keys = await page.locator('.mc-cfg [data-k]').evaluateAll(n => n.map(x => x.type + ':' + x.dataset.k));
  check(JSON.stringify(keys) === '["checkbox:autoProbe","checkbox:review","checkbox:reloadAfter","checkbox:consAfter","checkbox:consExec","number:consExecS","checkbox:ccDiffOpen"]', `⚙ holds only Auto probe, the review, the reload, after a consolidation with its Execute and countdown, and the track differences (${JSON.stringify(keys)})`);
  await page.locator('.mc-cfg input[data-k="reloadAfter"]').check();
  check((await page.evaluate(() => window.__mcTest.settings())).reloadAfter === true, 'ticking it stores it');
  await page.screenshot({ path: 'test-results/mc-680-settings.png' });
  await page.keyboard.press('Escape');
  await page.locator('.mc-cfg').waitFor({ state: 'detached' });

  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root [data-card="pc"] .mc-line');
  await page.evaluate(() => window.__mcTest.execute(false));
  await page.waitForTimeout(2000);   // past the reload's delay
  check(await page.evaluate(() => window.__marker) === 1, 'a failed step: no reload');

  await page.evaluate(() => { window.__fail = false; });
  await page.evaluate(() => window.__mcTest.execute(false));
  const gone = await until(() => page.evaluate(() => window.__marker).catch(() => 1), m => m === undefined, { timeout: 8000 });
  check(gone === undefined, 'without errors: the release page reloads');
  check(new URL(page.url()).pathname === `/release/${RELEASE}`, `onto the same release (${page.url()})`);
});
