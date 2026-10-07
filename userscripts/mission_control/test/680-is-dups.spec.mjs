// #680 Mission Control ↔ ISRC Scout: an ISRC the probe found that is also on another recording of
// the release (found there too, or already on it) is blocked, as the dialog's Submit blocks it: it
// shows in the matrix but can't be ticked, and apply leaves it out even when asked for it.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';   // sandbox copy of Mocky's "Music Will Explain": no ISRCs

test('#680: IS blocks an ISRC that would be on two recordings', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('isrc_scout', { waitFor: '__isTest680' });
  await page.waitForFunction(() => (window.__isTest680.release()?.tracks || []).length >= 3, null, { timeout: 30_000 });

  // three tracks' finds: the first two the same ISRC, the third its own
  const r = await page.evaluate(() => {
    const h = window.__isTest680, ts = h.release().tracks, f = h.found();
    f[ts[0].recId] = { isrc: 'USAT20107139', source: 'Test' };
    f[ts[1].recId] = { isrc: 'USAT20107139', source: 'Test' };
    f[ts[2].recId] = { isrc: 'USAT20107140', source: 'Test' };
    return { keys: ts.slice(0, 3).map(t => t.recId), fs: ts.slice(0, 3).map(t => h.mcFinding(t)) };
  });
  console.log(JSON.stringify(r.fs.map(x => [x.state, x.why])));
  check(r.fs[0].state === 'blocked' && r.fs[1].state === 'blocked', 'the ISRC found for two tracks is blocked on both');
  check(/tracks .*1.*, .*2/.test(r.fs[0].why || ''), `the reason names the tracks (${r.fs[0].why})`);
  check(r.fs[2].state === 'new', 'the other one is new');

  // apply asked for all three: only the new one would go
  const note = await page.evaluate(keys => new Promise(res => {
    document.addEventListener('mc:applied', e => res(JSON.parse(e.detail).note), { once: true });
    document.dispatchEvent(new CustomEvent('mc:apply', { detail: JSON.stringify({ id: 'is', run: 't', keys, dry: true }) }));
  }), r.keys);
  check(/dry run: 1 ISRC would be submitted/.test(note), `apply leaves the blocked ones out ("${note}")`);
});

test('#680: MC shows a blocked finding without a tick', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  // a stand-in IS answers the probe with one blocked and one new ISRC
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail), ts = window.__mcTest.release().tracks;
      setTimeout(() => send('mc:findings', { id: 'is', run: d.run, findings: [
        { key: ts[0].rec, track: ts[0].rec, name: 'a', state: 'blocked', isrc: 'USAT20107139', why: 'USAT20107139 would be on tracks 1, 2' },
        { key: ts[1].rec, track: ts[1].rec, name: 'b', state: 'new', isrc: 'USAT20107140' }] }), 50);
    });
    send('mc:provider', { id: 'is', name: 'ISRC Scout', version: 1, capabilities: ['probe', 'apply'] });
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root .mc-tbl td[data-col="isrc"] .mc-err');
  const cells = page.locator('#mc-root .mc-tbl td[data-col="isrc"]');
  check(/⊘ USAT20107139/.test(await cells.nth(0).textContent()), 'the blocked ISRC shows, marked');
  check(await cells.nth(0).locator('.mc-pick').count() === 0, 'and has no tick');
  check(await cells.nth(1).locator('.mc-pick.on').count() === 1, 'the new one is ticked');
  check(JSON.stringify((await page.evaluate(() => window.__mcTest.picked())).is) === JSON.stringify([await page.evaluate(() => window.__mcTest.release().tracks[1].rec)]), 'only the new one is picked');
});
