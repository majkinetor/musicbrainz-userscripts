// #713: a release item can carry a barcode, which Falcon types into the release editor. A REAL
// run on test.musicbrainz: the release is first saved as "This release does not have a barcode"
// (the case that broke: the box disables the field, and the editor ticks it again over an early
// write), then Falcon adds the barcode, the edit is accepted, and the release is read back. A
// second item with another barcode is left alone, with no edit: the release has one by then.
// The release is pristine, made for the run (#795).
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise, pristine } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const HOST = 'https://test.musicbrainz.org';
const BARCODE = '826194657451';

test('#713: Falcon adds a barcode to a release saved without one', { tag: ['@sandbox', '@login', '@flaky'] }, async ({ context, page }) => {
  test.setTimeout(600_000);
  if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) throw new Error('sandbox only');
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const { mbid: RELEASE } = await pristine(page, 'release');
  const goto = async (p, url) => { for (let a = 1; ; a++) { try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; } catch (e) { if (a >= 3) throw e; await p.waitForTimeout(5000); } } };
  // the release's barcode; a throttled reply (no release in it) is read again
  const barcode = () => page.evaluate(async r => {
    for (let a = 0; ; a++) {
      const j = await fetch(`/ws/2/release/${r}?fmt=json`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({}));
      if (j.id === r) return j.barcode;
      if (a >= 10) throw new Error('the web service gave no release: ' + JSON.stringify(j).slice(0, 200));
      await new Promise(res => setTimeout(res, 2000));
    }
  }, RELEASE);
  // the sandbox queues a barcode edit for a vote; accept it so the release changes at once
  // (an edit just made can take a few seconds to show among the open edits: wait for one when expected)
  const acceptOpen = async (expect = false) => {
    let hrefs = [];
    for (let a = 0; a < (expect ? 12 : 1); a++) {
      if (a) await page.waitForTimeout(5000);
      await goto(page, `${HOST}/release/${RELEASE}/open_edits`);
      hrefs = await page.locator('a[href*="/accept-edit/"]').evaluateAll(as => [...new Set(as.map(a => a.href))]);
      if (hrefs.length) break;
    }
    for (const h of hrefs) await goto(page, h);
    return hrefs.length;
  };

  // ── 1. save the release as "This release does not have a barcode" ─────────
  await goto(page, `${HOST}/release/${RELEASE}`);
  await requireLogin(page);
  await acceptOpen();
  await goto(page, `${HOST}/release/${RELEASE}/edit`);
  await page.waitForSelector('#external-links-editor', { timeout: 60000 });
  await page.waitForTimeout(1500);
  if (!(await page.locator('#no-barcode').isChecked())) await page.locator('#no-barcode').click();
  await page.locator('a[href="#edit-note"]').first().click();
  await page.locator('#edit-note-text, textarea.edit-note').first().fill('Falcon #713 proof: set up a release without a barcode');
  await page.locator('#enter-edit').click();
  await page.waitForURL(u => !/\/edit$/.test(u.pathname), { timeout: 60000 });
  await acceptOpen(true);
  const start = await barcode();
  console.log('barcode before Falcon: ' + JSON.stringify(start));
  check(start === '', `the release starts as "no barcode" (${JSON.stringify(start)})`);

  // ── 2. Falcon adds the barcode ────────────────────────────────────────────
  const run = async items => {
    const p = await context.newPage();
    await p.addInitScript(() => {
      const s = new Map();
      window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
      window.GM_setValue = (k, v) => s.set(k, v);
      window.GM_deleteValue = k => s.delete(k);
      window.GM_info = { script: { name: 'Falcon', version: 't' } };
    });
    const errs = []; p.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
    await goto(p, `${HOST}/release/${RELEASE}`);
    await idle(p);
    await p.addScriptTag({ content: code });
    await idle(p);
    await p.click('#falcon-launcher');
    await p.waitForSelector('#falcon-panel', { timeout: 15000 });
    await frames(p);
    await p.evaluate(items => window.__falconTest.setQueue(items.map((x, i) => ({
      id: 'b' + i, entityType: 'release', mbid: x.mbid, urls: [], note: x.note, disambiguation: '', rename: '', barcode: x.barcode,
      isrcs: [], cover: [], coverExistingCount: null, name: null, urlResults: null, status: 'queued', error: '' }))), items);
    await p.evaluate(() => window.__falconTest.start());
    await p.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
    const out = await p.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, e: i.error })));
    const log = (await p.evaluate(() => window.__falconTest.getLog().map(String))).filter(l => /barcode|submit|commit|NOT/i.test(l));
    await p.close();
    return { out, log, errs };
  };
  const first = await run([{ mbid: RELEASE, barcode: BARCODE, note: 'Falcon #713 proof: barcode on a release item' }]);
  console.log(JSON.stringify(first.out)); first.log.slice(-8).forEach(l => console.log('  ' + l));
  check(first.out[0].s === 'done', `Falcon reports the item done (${JSON.stringify(first.out[0])})`);
  const accepted = await acceptOpen(true);
  const after = await barcode();
  console.log(`accepted ${accepted} edit(s); barcode after Falcon: ${JSON.stringify(after)}`);
  check(after === BARCODE, `the barcode reached MusicBrainz as a real edit (${JSON.stringify(after)})`);
  check(first.errs.length === 0, 'no page errors (' + first.errs.join(' | ') + ')');

  // ── 3. another barcode on a release that has one is left alone ────────────
  const second = await run([{ mbid: RELEASE, barcode: '012345678905', note: 'Falcon #713 proof: must not submit' }]);
  console.log(JSON.stringify(second.out)); second.log.slice(-4).forEach(l => console.log('  ' + l));
  check(second.out[0].s !== 'done' && /has barcode 826194657451/.test(second.out[0].e + second.log.join(' ')), 'a release with another barcode is left alone, and Falcon says so');
  await page.waitForTimeout(10000);   // as long as an edit can take to show
  await goto(page, `${HOST}/release/${RELEASE}/open_edits`);
  check(!(await page.locator('a[href*="/accept-edit/"]').count()), 'and no edit was made');
  const kept = await barcode();
  check(kept === BARCODE, `the release keeps its barcode (${JSON.stringify(kept)})`);
});
