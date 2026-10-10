// #714: bulk selection in the track matrix, as in Apollo and ISRC Scout: Ctrl takes the whole
// track, Alt the whole column (a found link: that platform on every track), Ctrl+Alt everything;
// a press dragged down the ISRC or merge column paints every cell it passes. Stand-in IS and
// Fusion answer the probe with an ISRC, a Spotify and a Deezer link, and a merge per track.
// Read only: nothing is applied.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = 'e91b84a9-6b98-4d64-b4fc-753a9c674c4c';   // any sandbox release: the findings are the stand-ins'

test('#714: Ctrl/Alt-click and drag pick in bulk', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.evaluate(() => {
    const send = (t, d) => document.dispatchEvent(new CustomEvent(t, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => {
      const d = JSON.parse(e.detail), recs = window.__mcTest.release().tracks.map(t => t.rec);
      setTimeout(() => {
        send('mc:findings', { id: 'is', run: d.run, findings: recs.flatMap((r, i) => [
          { key: r, track: r, name: 'ISRC', state: 'new', isrc: 'XX0000000' + String(i).padStart(3, '0') },
          { key: 'link:' + r + ':s', track: r, kind: 'link', name: 'Spotify', url: 'https://open.spotify.com/track/' + i, state: 'new' },
          { key: 'link:' + r + ':d', track: r, kind: 'link', name: 'Deezer', url: 'https://www.deezer.com/track/' + i, state: 'new' }]) });
        send('mc:findings', { id: 'fusion', run: d.run, findings: recs.map(r => ({ key: r, track: r, name: 'merge', state: 'new', matches: [{ gid: r, release: 'Other' }] })) });
      }, 50);
    });
    ['is', 'fusion'].forEach(id => send('mc:provider', { id, name: id, version: 1, capabilities: ['probe', 'apply'] }));
  });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root');
  await page.click('#mc-root .mc-seg[data-mode="fusion"] button[data-v="auto"]');
  await page.click('#mc-root [data-act="probe"]');
  await page.waitForSelector('#mc-root .mc-tbl .mc-pick[data-col="fusion"]');
  const n = await page.evaluate(() => window.__mcTest.release().tracks.length);
  check(n >= 3, `the release has tracks to pick (${n})`);
  const count = () => page.evaluate(() => {
    const p = window.__mcTest.picked(), is = p.is || [];
    return { isrc: is.filter(k => !k.startsWith('link:')).length, s: is.filter(k => k.endsWith(':s')).length, d: is.filter(k => k.endsWith(':d')).length, fx: (p.fusion || []).length };
  });
  const all = { isrc: n, s: n, d: n, fx: n };
  check(JSON.stringify(await count()) === JSON.stringify(all), `everything starts taken in (${JSON.stringify(await count())})`);
  const cell = (col, i) => page.locator(`#mc-root .mc-tbl tr[data-i="${i}"] .mc-pick[data-col="${col}"]`).first();
  const link = (ico, i) => page.locator(`#mc-root .mc-tbl tr[data-i="${i}"] a.mc-pick[data-ico="${ico}"]`);

  // Alt-click an ISRC: the whole ISRC column follows it out, and back in
  await cell('isrc', 0).click({ modifiers: ['Alt'] });
  check(JSON.stringify(await count()) === JSON.stringify({ ...all, isrc: 0 }), `Alt-click leaves out every ISRC (${JSON.stringify(await count())})`);
  await cell('isrc', 1).click({ modifiers: ['Alt'] });
  check(JSON.stringify(await count()) === JSON.stringify(all), 'and takes them all in again');

  // Alt+right-click a Spotify link: Spotify on every track, Deezer untouched
  await link('spotify', 0).click({ button: 'right', modifiers: ['Alt'] });
  check(JSON.stringify(await count()) === JSON.stringify({ ...all, s: 0 }), `Alt+right-click leaves out Spotify on every track only (${JSON.stringify(await count())})`);
  check(await page.evaluate(() => window.__mcTest.picked().is.length) === 2 * n, 'the page stayed (no link opened)');

  // Ctrl-click a merge: the whole track
  await cell('fusion', 1).click({ modifiers: ['Control'] });
  const row = await page.evaluate(() => { const r = window.__mcTest.release().tracks[1].rec, p = window.__mcTest.picked(); return { isrc: p.is.includes(r), d: p.is.includes('link:' + r + ':d'), fx: p.fusion.includes(r) }; });
  check(!row.isrc && !row.d && !row.fx, `Ctrl-click leaves out the whole track (${JSON.stringify(row)})`);
  check(JSON.stringify(await count()) === JSON.stringify({ isrc: n - 1, s: 0, d: n - 1, fx: n - 1 }), `and only that track (${JSON.stringify(await count())})`);

  // Ctrl+Alt: everything in the table
  await cell('isrc', 0).click({ modifiers: ['Control', 'Alt'] });
  check(JSON.stringify(await count()) === JSON.stringify({ isrc: 0, s: 0, d: 0, fx: 0 }), `Ctrl+Alt-click leaves out everything (${JSON.stringify(await count())})`);

  // drag down the merge column from track 0 to track 2: those three taken in, nothing else
  const box = async i => { const b = await cell('fusion', i).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const [x0, y0] = await box(0), [, y2] = await box(2);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(x0, y0 + (y2 - y0) * k / 6);
  await page.mouse.up();
  check(JSON.stringify(await count()) === JSON.stringify({ isrc: 0, s: 0, d: 0, fx: 3 }), `a drag over three merges takes in those three (${JSON.stringify(await count())})`);
  // a plain click still toggles one
  await cell('fusion', 0).click();
  check((await count()).fx === 2, 'a plain click still toggles one');
});
