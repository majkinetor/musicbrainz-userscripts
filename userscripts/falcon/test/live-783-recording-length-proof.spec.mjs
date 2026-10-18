// #783: a recording item can carry a length (length, in ms), seeded into the recording's edit form. A REAL run on
// test.musicbrainz: a standalone recording (no tracks) gets a new length, the edit is accepted, and the recording is
// read back; each run sets the other of two lengths, so there is always a change. A recording whose length comes
// from its tracks is refused, Falcon says why, and no edit is made.
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const HOST = 'https://test.musicbrainz.org';
const STANDALONE = '61cba4ae-98e6-4c93-8f09-a37ec195b9e9';   // "Falcon 783 standalone", made for this proof: no tracks
const TRACKED = '061bde0b-18be-4358-a2e8-69d4d7614ecf';      // "Fjara", track 1 of "Fjara / Runaway Train"

test('#783: Falcon sets a standalone recording\'s length, and says why it can\'t for one with tracks', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  test.setTimeout(600_000);
  if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) throw new Error('sandbox only');
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const goto = async (p, url) => { for (let a = 1; ; a++) { try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; } catch (e) { if (a >= 3) throw e; await p.waitForTimeout(5000); } } };
  const lengthOf = id => page.evaluate(async id => {
    for (let a = 0; ; a++) {
      const j = await fetch(`/ws/2/recording/${id}?fmt=json`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({}));
      if (j.id === id) return j.length || null;
      if (a >= 10) throw new Error('the web service gave no recording: ' + JSON.stringify(j).slice(0, 200));
      await new Promise(res => setTimeout(res, 2000));
    }
  }, id);
  const acceptOpen = async (id, expect = false) => {
    let hrefs = [];
    for (let a = 0; a < (expect ? 12 : 1); a++) {
      if (a) await page.waitForTimeout(5000);
      await goto(page, `${HOST}/recording/${id}/open_edits`);
      hrefs = await page.locator('a[href*="/accept-edit/"]').evaluateAll(as => [...new Set(as.map(a => a.href))]);
      if (hrefs.length) break;
    }
    for (const h of hrefs) await goto(page, h);
    return hrefs.length;
  };
  const run = async (mbid, length) => {
    const p = await context.newPage();
    await p.addInitScript(() => {
      const s = new Map();
      window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
      window.GM_setValue = (k, v) => s.set(k, v);
      window.GM_deleteValue = k => s.delete(k);
      window.GM_info = { script: { name: 'Falcon', version: 't' } };
    });
    const errs = []; p.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
    await goto(p, `${HOST}/recording/${mbid}`);
    await idle(p);
    await p.addScriptTag({ content: code });
    await idle(p);
    await p.click('#falcon-launcher');
    await p.waitForSelector('#falcon-panel', { timeout: 15000 });
    await frames(p);
    await p.evaluate(([mbid, length]) => document.dispatchEvent(new CustomEvent('falcon:import', { detail: JSON.stringify({ name: 'Falcon #783 proof', note: 'Falcon #783 proof: a recording\'s length', items: [{ entityType: 'recording', mbid, urls: [], length }] }) })), [mbid, length]);
    await p.waitForFunction(() => window.__falconTest.getQueue().length > 0, null, { timeout: 10000 });
    await p.evaluate(() => window.__falconTest.start());
    await p.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
    const out = await p.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, e: i.error })));
    const log = (await p.evaluate(() => window.__falconTest.getLog().map(String))).filter(l => /length|submit|commit|NOT/i.test(l));
    await p.close();
    return { out, log, errs };
  };

  // ── 1. a standalone recording takes its length ─────────────────────────────
  await goto(page, `${HOST}/recording/${STANDALONE}`);
  await requireLogin(page);
  await acceptOpen(STANDALONE);
  const before = await lengthOf(STANDALONE);
  const want = before === 201000 ? 202000 : 201000;
  console.log(`before Falcon: ${before}, setting ${want}`);
  const first = await run(STANDALONE, want);
  console.log(JSON.stringify(first.out)); first.log.slice(-6).forEach(l => console.log('  ' + l));
  check(first.out[0].s === 'done', `Falcon reports the item done (${JSON.stringify(first.out[0])})`);
  await acceptOpen(STANDALONE, true);
  const after = await lengthOf(STANDALONE);
  check(after != null && Math.abs(after - want) < 1000, `the length reached MusicBrainz as a real edit (${before} → ${after})`);
  check(first.errs.length === 0, 'no page errors (' + first.errs.join(' | ') + ')');

  // ── 2. a recording with tracks is refused ───────────────────────────────────
  const had = await lengthOf(TRACKED);
  const second = await run(TRACKED, 123000);
  console.log(JSON.stringify(second.out)); second.log.slice(-4).forEach(l => console.log('  ' + l));
  check(second.out[0].s !== 'done' && /from its tracks/.test(second.out[0].e + second.log.join(' ')), 'a recording whose length comes from its tracks is refused, and Falcon says why');
  await page.waitForTimeout(10000);   // as long as an edit can take to show
  await goto(page, `${HOST}/recording/${TRACKED}/open_edits`);
  check(!(await page.locator('a[href*="/accept-edit/"]').count()), 'and no edit was made');
  check(await lengthOf(TRACKED) === had, 'its length is as it was');
});
