// #727: a release item can carry catalog numbers (labels: [{ mbid, name, catno, add }]), each for a label the
// release has, which Falcon fills in the release editor's label row. A REAL run on test.musicbrainz: the
// release's label starts without a catalog number, Falcon adds one, the edit is accepted, and the release
// is read back. A second item with another catalog number is left alone, with no edit. A label the release
// hasn't is added (add: true), with its catalog number. The release and both labels are pristine, made for
// the run (#795).
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise, pristine } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const HOST = 'https://test.musicbrainz.org';
const CATNO = 'AOF 727';

test('#727: Falcon fills a release label\'s empty catalog number', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  test.setTimeout(600_000);
  if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) throw new Error('sandbox only');
  const code = await readFile(sourceOf('falcon'), 'utf8');
  // a release with one label, without a catalog number, and another label it hasn't
  const { mbid: LABEL, name: LABEL_NAME } = await pristine(page, 'label');
  const { mbid: OTHER, name: OTHER_NAME } = await pristine(page, 'label');
  const { mbid: RELEASE } = await pristine(page, 'release', { 'labels.0.mbid': LABEL });
  const goto = async (p, url) => { for (let a = 1; ; a++) { try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; } catch (e) { if (a >= 3) throw e; await p.waitForTimeout(5000); } } };
  // a label's catalog number on the release ('' none, null the release hasn't the label). A throttled
  // reply ({ error }) is read again: taken as "no such label", it sent the setup into setting an
  // already empty number, where the editor has nothing to submit and Enter edit stays disabled.
  const labelOf = l => page.evaluate(async ({ r, l }) => {
    for (let a = 0; ; a++) {
      const j = await fetch(`/ws/2/release/${r}?inc=labels&fmt=json`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({}));
      if (j.id === r) { const li = (j['label-info'] || []).find(x => x.label && x.label.id === l); return li ? li['catalog-number'] || '' : null; }
      if (a >= 10) throw new Error('the web service gave no release: ' + JSON.stringify(j).slice(0, 200));
      await new Promise(res => setTimeout(res, 2000));
    }
  }, { r: RELEASE, l });
  const catno = () => labelOf(LABEL);
  // the sandbox may queue a label edit for a vote; accept it so the release changes at once
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
  // ── 1. the label starts without a catalog number ─────────────────────────
  await goto(page, `${HOST}/release/${RELEASE}`);
  await requireLogin(page);
  const start = await catno();
  console.log('catalog number before Falcon: ' + JSON.stringify(start));
  check(start === '', `the label starts without a catalog number (${JSON.stringify(start)})`);

  // ── 2. Falcon fills it ─────────────────────────────────────────────────────
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
    // as Platform Check hands it over: a falcon:import, read as Import reads a file
    await p.evaluate(items => document.dispatchEvent(new CustomEvent('falcon:import', { detail: JSON.stringify({ name: 'Falcon #727 proof', note: items[0].note, items: items.map(x => ({ entityType: 'release', mbid: x.mbid, urls: [], labels: x.labels })) }) })), items);
    await p.waitForFunction(() => window.__falconTest.getQueue().length > 0, null, { timeout: 10000 });
    const queued = await p.evaluate(() => window.__falconTest.getQueue().map(i => i.labels));
    await p.evaluate(() => window.__falconTest.start());
    await p.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
    const out = await p.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, e: i.error })));
    const log = (await p.evaluate(() => window.__falconTest.getLog().map(String))).filter(l => /catalog|submit|commit|NOT/i.test(l));
    await p.close();
    return { queued, out, log, errs };
  };
  const first = await run([{ mbid: RELEASE, labels: [{ mbid: LABEL, name: LABEL_NAME, catno: CATNO }], note: 'Falcon #727 proof: a catalog number on a release item' }]);
  console.log(JSON.stringify(first.queued), JSON.stringify(first.out)); first.log.slice(-8).forEach(l => console.log('  ' + l));
  check(JSON.stringify(first.queued) === JSON.stringify([[{ mbid: LABEL, name: LABEL_NAME, catno: CATNO }]]), 'the handoff queues the item with its catalog number');
  check(first.out[0].s === 'done', `Falcon reports the item done (${JSON.stringify(first.out[0])})`);
  const accepted = await acceptOpen(true);
  const after = await catno();
  console.log(`accepted ${accepted} edit(s); catalog number after Falcon: ${JSON.stringify(after)}`);
  check(after === CATNO, `the catalog number reached MusicBrainz as a real edit (${JSON.stringify(after)})`);
  check(first.errs.length === 0, 'no page errors (' + first.errs.join(' | ') + ')');

  // ── 3. another catalog number on a label that has one is left alone ────────
  const second = await run([{ mbid: RELEASE, labels: [{ mbid: LABEL, name: LABEL_NAME, catno: 'AOF 999' }], note: 'Falcon #727 proof: must not submit' }]);
  console.log(JSON.stringify(second.out)); second.log.slice(-4).forEach(l => console.log('  ' + l));
  check(second.out[0].s !== 'done' && /has cat\. no\. AOF 727/.test(second.out[0].e + second.log.join(' ')), 'a label with another catalog number is left alone, and Falcon says so');
  await page.waitForTimeout(10000);   // as long as an edit can take to show
  await goto(page, `${HOST}/release/${RELEASE}/open_edits`);
  check(!(await page.locator('a[href*="/accept-edit/"]').count()), 'and no edit was made');
  check(await catno() === CATNO, 'the label keeps its catalog number');

  // ── 4. a label the release hasn't is added, with its catalog number ────────
  check(await labelOf(OTHER) === null, 'the release starts without the other label');
  const third = await run([{ mbid: RELEASE, labels: [{ mbid: OTHER, name: OTHER_NAME, catno: 'MET 727', add: true }], note: 'Falcon #727 proof: add a label' }]);
  console.log(JSON.stringify(third.queued), JSON.stringify(third.out)); third.log.slice(-6).forEach(l => console.log('  ' + l));
  check(third.out[0].s === 'done', `Falcon reports the label added (${JSON.stringify(third.out[0])})`);
  await acceptOpen(true);
  const added = await labelOf(OTHER);
  check(added === 'MET 727', `the label reached MusicBrainz with its catalog number (${JSON.stringify(added)})`);
  check(await catno() === CATNO, 'and the label the release had keeps its catalog number');
  check(third.errs.length === 0, 'no page errors (' + third.errs.join(' | ') + ')');
});
