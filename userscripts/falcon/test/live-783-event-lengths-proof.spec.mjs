// #783: a release item can carry a release event (event: { date, country }) and track lengths (lengths: [{ medium,
// position, ms }]), which Falcon enters in the release editor where the release has none. A REAL run on
// test.musicbrainz: a pristine release (#795) of four tracks, without an event and with no length on tracks 3 and 4,
// gets them from Falcon, the edits are accepted, and the release is read back. A second item, with the event the
// release has by then, is left alone, with no edit.
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise, pristine } from '../../../dev/test/harness.mjs';

test.use({ gm: false });

const HOST = 'https://test.musicbrainz.org';
const EVENT = { date: { year: 2014, month: 2, day: 20 }, country: 'XW' };
const LENGTHS = [{ medium: 1, position: 3, ms: 418952 }, { medium: 1, position: 4, ms: 428673 }];

test('#783: Falcon enters a release event and track lengths where the release has none', { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  test.setTimeout(600_000);
  if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) throw new Error('sandbox only');
  const code = await readFile(sourceOf('falcon'), 'utf8');
  // four tracks, the first two with a length, and no release event
  const { mbid: RELEASE } = await pristine(page, 'release', {
    'mediums.0.track.1.name': 'Track 2', 'mediums.0.track.1.length': '200000',
    'mediums.0.track.2.name': 'Track 3', 'mediums.0.track.3.name': 'Track 4',
  });
  const goto = async (p, url) => { for (let a = 1; ; a++) { try { await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); return; } catch (e) { if (a >= 3) throw e; await p.waitForTimeout(5000); } } };
  // the release as the web service has it: its events and its tracks' lengths
  const state = () => page.evaluate(async r => {
    for (let a = 0; ; a++) {
      const j = await fetch(`/ws/2/release/${r}?inc=recordings&fmt=json`, { cache: 'no-store' }).then(x => x.json()).catch(() => ({}));
      if (j.id === r) return { events: (j['release-events'] || []).map(e => e.date + ' ' + ((e.area || {})['iso-3166-1-codes'] || []).join()), lengths: j.media[0].tracks.map(t => t.length) };
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

  // ── 1. the release without its event, and two tracks without a length ─────
  await goto(page, `${HOST}/release/${RELEASE}`);
  await requireLogin(page);
  await acceptOpen();
  const start = await state();
  console.log('before Falcon: ' + JSON.stringify(start));
  check(!start.events.length && !start.lengths[2] && !start.lengths[3] && start.lengths[0], `the release starts without an event, tracks 3 and 4 without a length (${JSON.stringify(start)})`);

  // ── 2. Falcon puts them back ───────────────────────────────────────────────
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
    await p.evaluate(it => document.dispatchEvent(new CustomEvent('falcon:import', { detail: JSON.stringify({ name: 'Falcon #783 proof', note: it.note, items: [Object.assign({ entityType: 'release', mbid: it.mbid, urls: [] }, it.payload)] }) })), item);
    await p.waitForFunction(() => window.__falconTest.getQueue().length > 0, null, { timeout: 10000 });
    const queued = await p.evaluate(() => window.__falconTest.getQueue().map(i => ({ event: i.event, tracks: i.tracks })));
    await p.evaluate(() => window.__falconTest.start());
    await p.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
    const out = await p.evaluate(() => window.__falconTest.getQueue().map(i => ({ s: i.status, e: i.error })));
    const log = (await p.evaluate(() => window.__falconTest.getLog().map(String))).filter(l => /event|length|submit|commit|NOT/i.test(l));
    await p.close();
    return { queued, out, log, errs };
  };
  const first = await run({ mbid: RELEASE, payload: { event: EVENT, tracks: LENGTHS.map(l => ({ ...l, was: { ms: null } })) }, note: 'Falcon #783 proof: a release event and track lengths on a release item' });
  console.log(JSON.stringify(first.queued), JSON.stringify(first.out)); first.log.slice(-8).forEach(l => console.log('  ' + l));
  check(JSON.stringify(first.queued) === JSON.stringify([{ event: EVENT, tracks: LENGTHS.map(l => ({ ...l, was: { ms: null } })) }]), 'the handoff queues the item with its event and lengths');
  check(first.out[0].s === 'done', `Falcon reports the item done (${JSON.stringify(first.out[0])})`);
  await acceptOpen(true);
  const after = await state();
  console.log('after Falcon: ' + JSON.stringify(after));
  check(JSON.stringify(after.events) === JSON.stringify(['2014-02-20 XW']), `the release event reached MusicBrainz, with its country (${JSON.stringify(after.events)})`);
  check(Math.abs(after.lengths[2] - LENGTHS[0].ms) < 1000 && Math.abs(after.lengths[3] - LENGTHS[1].ms) < 1000, `and the lengths (${JSON.stringify(after.lengths)})`);
  check(first.errs.length === 0, 'no page errors (' + first.errs.join(' | ') + ')');

  // ── 3. an event for a release that has one by now is left alone ──────────────
  const second = await run({ mbid: RELEASE, payload: { event: { date: { year: 2015 }, country: 'XW' } }, note: 'Falcon #783 proof: must not submit' });
  console.log(JSON.stringify(second.out)); second.log.slice(-4).forEach(l => console.log('  ' + l));
  check(second.out[0].s !== 'done' && /release event\(s\) by now/.test(second.out[0].e + second.log.join(' ')), 'a release with an event is left alone, and Falcon says so');
  await page.waitForTimeout(10000);   // as long as an edit can take to show
  await goto(page, `${HOST}/release/${RELEASE}/open_edits`);
  check(!(await page.locator('a[href*="/accept-edit/"]').count()), 'and no edit was made');
  check(JSON.stringify((await state()).events) === JSON.stringify(['2014-02-20 XW']), 'the release keeps its event, and only it');
});
