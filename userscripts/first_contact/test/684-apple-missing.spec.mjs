// #684: an Apple album with tracks the storefront doesn't offer asks before the editor opens.
// Eddie Harris, "Artist's Choice" (gb/852547): 24 tracks, 20 offered. Cancel stops the import, no tab
// opens; Import anyway opens the editor with the 20 and an empty track at each missing position,
// and the edit note names them.
// music.apple.com's Content Security Policy refuses the harness's inline script: bypassed here.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({
  gm: { name: 'First Contact', persist: 'tabs', values: { 'fc.settings': { server: 'test.musicbrainz.org', archive: false } } },
  bypassCSP: true,
  pageErrors: 'ignore',   // music.apple.com's own scripts
});

test('tracks Apple does not offer: asked before the import', { tag: ['@web'] }, async ({ page, context, inject }) => {
  await page.goto('https://music.apple.com/gb/album/852547', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const go = page.locator('#fc-root .fc-go');
  await go.waitFor({ state: 'visible' });

  let tabs = 0;
  context.on('page', () => tabs++);
  await go.click();
  const warn = page.locator('#fc-warn');
  await warn.waitFor({ timeout: 30_000 });
  const text = await warn.textContent();
  console.log(text);
  check(/Apple Music lists 24 tracks but offers 20: 4 are missing \(1\.9, 2\.1, 2\.4, 2\.6\), left as empty tracks/.test(text), 'the warning names the missing tracks');
  await page.screenshot({ path: 'test-results/fc-684-warn.png' });
  await warn.locator('.fc-warn-no').click();
  await page.waitForTimeout(1500);
  check(!(await warn.count()) && tabs === 0 && !(await page.evaluate(() => window.__fcLastSeed)), 'Cancel: no editor, no seed');
  check(/Import to MusicBrainz/.test(await go.textContent()), 'and the button is back');

  await go.click();
  await warn.waitFor({ timeout: 30_000 });
  // the seed, not the editor's tab: the harness doesn't see the tab GM_openInTab opens (650-deezer-seed waits on it)
  await warn.locator('.fc-warn-go').click();
  await page.waitForFunction(() => !!window.__fcLastSeed, null, { timeout: 30_000 });
  const seed = await page.evaluate(() => window.__fcLastSeed);
  const note = (seed.params.find(p => p[0] === 'edit_note') || [])[1] || '';
  check(seed.rel.mediums.map(m => m.tracks.length).join() === '13,11', 'Import anyway: the 20 offered and 4 empty tracks');
  // the seed: no name for an empty track, its number, and the next one keeps its own
  const has = k => seed.params.some(p => p[0] === k);
  check(!has('mediums.0.track.8.name') && has('mediums.0.track.8.number') && seed.params.find(p => p[0] === 'mediums.0.track.9.name')[1] === 'Funkorama', 'track 1.9 is seeded empty; 1.10 is Funkorama');
  check(/4 are missing \(1\.9, 2\.1, 2\.4, 2\.6\), left as empty tracks/.test(note), 'with the edit note naming the missing');
});
