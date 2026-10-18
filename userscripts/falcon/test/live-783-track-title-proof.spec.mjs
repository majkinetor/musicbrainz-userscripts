// #783: a release item's track changes (tracks: [{ medium, position, title, recording, ms, was }]) go into the release
// editor: a track's title, the recording's title with it (recording: true), and its length, each only while the track
// still holds what `was` says. A REAL run on test.musicbrainz: track 1.2 gets a new title, its recording too, and
// another length; the edits are accepted and the release read back. A change whose `was` the track no longer holds
// is left alone, with no edit. Then Falcon puts the title, the recording's title and the length back as they were.
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const HOST = 'https://test.musicbrainz.org';
const RELEASE = '45ddda7c-74c7-46cd-8d83-f5b644820b00';   // "Fjara / Runaway Train", 4 tracks
const MARK = ' (Falcon #783)';

test('#783: Falcon changes a track\'s title, its recording\'s and its length, only while the track holds what it had', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  test.setTimeout(900_000);
  if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) throw new Error('sandbox only');
  const code = await readFile(sourceOf('falcon'), 'utf8');
  const goto = async (p, url) => { for (let a = 1; ; a++) { try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; } catch (e) { if (a >= 3) throw e; await p.waitForTimeout(5000); } } };
  // track 1.2 as the web service has it: its title, its recording's title, its length
  const state = () => page.evaluate(async r => {
    for (let a = 0; ; a++) {
      const j = await fetch(`/ws/2/release/${r}?inc=recordings&fmt=json`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({}));
      if (j.id === r) { const t = j.media[0].tracks[1]; return { title: t.title, rec: t.recording.title, ms: t.length || null }; }
      if (a >= 10) throw new Error('the web service gave no release: ' + JSON.stringify(j).slice(0, 200));
      await new Promise(res => setTimeout(res, 2000));
    }
  }, RELEASE);
  // the sandbox may queue an edit for a vote; accept it so the release changes at once
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

  const run = async item => {
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
    // as Platform Check hands it over
    await p.evaluate(it => document.dispatchEvent(new CustomEvent('falcon:import', { detail: JSON.stringify({ name: 'Falcon #783 track proof', note: it.note, items: [Object.assign({ entityType: 'release', mbid: it.mbid, urls: [] }, it.payload)] }) })), item);
    await p.waitForFunction(() => window.__falconTest.getQueue().length > 0, null, { timeout: 10000 });
    const queued = await p.evaluate(() => window.__falconTest.getQueue().map(i => ({ tracks: i.tracks })));
    await p.evaluate(() => window.__falconTest.start());
    await p.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
    const out = await p.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, e: i.error })));
    const log = (await p.evaluate(() => window.__falconTest.getLog().map(String))).filter(l => /title|length|track|submit|commit|NOT/i.test(l));
    await p.close();
    return { queued, out, log, errs };
  };

  await goto(page, `${HOST}/release/${RELEASE}`);
  await requireLogin(page);
  await acceptOpen();
  let start = await state();
  // a run that stopped half way left the mark on: take it off first
  if (start.title.endsWith(MARK) || start.rec.endsWith(MARK)) {
    const base = start.title.replace(MARK, '');
    const fix = await run({ mbid: RELEASE, payload: { tracks: [{ medium: 1, position: 2, title: base, recording: true }] }, note: 'Falcon #783 proof: put back a title an earlier run left' });
    check(fix.out[0].s === 'done', `an earlier run's title is put back first (${JSON.stringify(fix.out)})`);
    await acceptOpen(true);
    start = await state();
  }
  console.log('before Falcon: ' + JSON.stringify(start));
  check(!!start.title && !start.title.endsWith(MARK) && start.rec === start.title, `track 1.2 has its own title, as its recording has (${JSON.stringify(start)})`);
  const newTitle = start.title + MARK, newMs = (start.ms ? Math.round(start.ms / 1000) * 1000 : 200000) + 3000;

  // ── 1. a new title, the recording's too, and a new length ──────────────────
  const first = await run({ mbid: RELEASE, payload: { tracks: [{ medium: 1, position: 2, title: newTitle, recording: true, ms: newMs, was: { title: start.title, ms: start.ms } }] }, note: 'Falcon #783 proof: a track title, its recording\'s and a length' });
  console.log(JSON.stringify(first.queued), JSON.stringify(first.out)); first.log.slice(-8).forEach(l => console.log('  ' + l));
  check(first.queued[0].tracks.length === 1 && first.queued[0].tracks[0].was.title === start.title, 'the handoff queues the change with what the track had');
  check(first.out[0].s === 'done', `Falcon reports the item done (${JSON.stringify(first.out[0])})`);
  check(first.errs.length === 0, 'no page errors (' + first.errs.join(' | ') + ')');
  await acceptOpen(true);
  let after = await state();
  for (let a = 0; a < 6 && after.rec !== newTitle; a++) { await acceptOpen(true); after = await state(); }
  console.log('after Falcon: ' + JSON.stringify(after));
  check(after.title === newTitle, `the track's title reached MusicBrainz (${after.title})`);
  check(after.rec === newTitle, `and the recording's (${after.rec})`);
  check(Math.abs(after.ms - newMs) < 1000, `and the length (${after.ms})`);

  // ── 2. a change made against what the track no longer holds is left alone ───
  const second = await run({ mbid: RELEASE, payload: { tracks: [{ medium: 1, position: 2, title: 'Falcon must not write this', was: { title: start.title } }] }, note: 'Falcon #783 proof: must not submit' });
  console.log(JSON.stringify(second.out)); second.log.slice(-4).forEach(l => console.log('  ' + l));
  check(second.out[0].s !== 'done' && /by now/.test(second.out[0].e + second.log.join(' ')), 'a track that changed since is left alone, and Falcon says so');
  await page.waitForTimeout(10000);   // as long as an edit can take to show
  await goto(page, `${HOST}/release/${RELEASE}/open_edits`);
  check(!(await page.locator('a[href*="/accept-edit/"]').count()), 'and no edit was made');

  // ── 3. back as it was ───────────────────────────────────────────────────────
  const third = await run({ mbid: RELEASE, payload: { tracks: [{ medium: 1, position: 2, title: start.title, recording: true, ...(start.ms ? { ms: start.ms } : {}), was: { title: newTitle, ms: newMs } }] }, note: 'Falcon #783 proof: the title, the recording\'s and the length put back' });
  check(third.out[0].s === 'done', `Falcon puts them back (${JSON.stringify(third.out[0])})`);
  await acceptOpen(true);
  let end = await state();
  for (let a = 0; a < 6 && end.rec !== start.title; a++) { await acceptOpen(true); end = await state(); }
  console.log('at the end: ' + JSON.stringify(end));
  check(end.title === start.title && end.rec === start.rec && (!start.ms || Math.abs(end.ms - start.ms) < 1000), `the release is as it started (${JSON.stringify(end)})`);
});
