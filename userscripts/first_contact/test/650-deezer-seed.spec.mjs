// #650: the whole round trip on a real Deezer album — the button on deezer.com, the seeded
// release editor on the sandbox, and the handoff of every artist's Deezer link for Apollo.
//
// Fixture: Daft Punk, "Random Access Memories" (Deezer album 6575789), 13 tracks; "Get Lucky"
// is credited on Deezer to three "Main" contributors and titled "(feat. Pharrell Williams and
// Nile Rodgers)", so it shows the feat. split.
import { test, check, until, requireLogin, settled } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://www.deezer.com/en/album/6575789';

test.use({
  gm: { name: 'First Contact', persist: 'tabs', values: { 'fc.settings': { server: 'test.musicbrainz.org' } } },
  pageErrors: 'ignore',
  ...(process.env.FC_SHOT ? { deviceScaleFactor: 2 } : {}),   // FC_SHOT=<file.png>: the README's screenshots   // deezer.com's own scripts throw in an automated browser; not ours
});

test('a Deezer album seeds the sandbox release editor and hands off the artist links', { tag: ['@web', '@sandbox', '@login', '@critical'] }, async ({ page, context, inject }) => {
  await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const go = page.locator('#fc-root .fc-go');
  await go.waitFor({ state: 'visible' });
  check(await go.isVisible(), 'the import button shows on a Deezer album page');

  if (process.env.FC_SHOT) {
    await page.locator('#fc-root .fc-more').click();
    await page.locator('#fc-panel').waitFor();
    const vp = page.viewportSize();
    await page.screenshot({ path: process.env.FC_SHOT.replace(/\.png$/, '-button.png'), clip: { x: vp.width - 420, y: vp.height - 260, width: 420, height: 260 } });
    await page.keyboard.press('Escape');
  }

  const [editor] = await Promise.all([context.waitForEvent('page'), go.click()]);
  await editor.waitForURL(/test\.musicbrainz\.org\/release\/add\?first_contact=/, { timeout: 90_000 });
  // MusicBrainz asks to confirm a POST that comes from another site (and sends it again,
  // same-site, with the session cookie): every seeding importer meets this page.
  const confirm = editor.getByRole('button', { name: 'Continue' });
  if (await confirm.isVisible().catch(() => false)) {
    check(/first_contact=/.test(editor.url()), 'the confirmation keeps the handoff token');
    await Promise.all([editor.waitForNavigation(), confirm.click()]);
  }
  await requireLogin(editor);
  await settled(editor);
  // A manager's GM storage is one store across sites; the harness's is one per origin, so
  // carry the handoff from the Deezer tab to the MusicBrainz tab as the manager would.
  const stored = await page.evaluate(() => GM_listValues().filter(k => k.startsWith('fc.handoff.')).map(k => [k, GM_getValue(k)]));
  check(stored.length === 1, `one handoff stored on the Deezer side (${stored.length})`);
  await editor.evaluate(kv => kv.forEach(([k, v]) => GM_setValue(k, v)), stored);
  await inject('first_contact', { target: editor, waitFor: '__fcHandoff' });

  const seed = await page.evaluate(() => window.__fcLastSeed && { token: window.__fcLastSeed.token, n: window.__fcLastSeed.params.length });
  console.log('seed', seed);
  check(seed && seed.n > 50, `the seed was built (${seed && seed.n} parameters)`);

  // the release editor took the seed
  const name = await until(() => editor.locator('#name').inputValue().catch(() => ''), v => v === 'Random Access Memories');
  check(name === 'Random Access Memories', `release title in the editor: "${name}"`);
  const seedErrors = await editor.evaluate(() => (document.body.innerText.match(/The data you[’']ve seeded contained the following errors[\s\S]{0,400}/) || [''])[0]);
  check(!seedErrors, `MusicBrainz reported no seed errors: ${seedErrors}`);

  if (process.env.FC_SHOT) {
    await editor.getByRole('link', { name: 'Tracklist' }).first().click();
    await settled(editor);
    await editor.screenshot({ path: process.env.FC_SHOT, clip: { x: 0, y: 135, width: 1600, height: 555 } });
  }

  // the handoff, as Apollo will read it
  const h = await editor.evaluate(() => JSON.parse(document.documentElement.dataset.firstContact || 'null'));
  check(h && h.source === 'deezer' && h.url === 'https://www.deezer.com/album/6575789', `handoff source: ${h && h.source} ${h && h.url}`);
  const tracks = h ? h.mediums.flatMap(m => m.tracks) : [];
  check(tracks.length === 13, `13 tracks handed off (got ${tracks.length})`);
  const lucky = tracks.find(t => t.title === 'Get Lucky');
  const credit = lucky ? lucky.credit.map(a => a.name + a.join).join('') : '';
  check(credit === 'Daft Punk feat. Pharrell Williams & Nile Rodgers', `Get Lucky credit: "${credit}"`);
  check(lucky && lucky.credit.every(a => /^https:\/\/www\.deezer\.com\/artist\/\d+$/.test(a.url)), 'each Get Lucky artist carries its Deezer link');
  check(h && h.credit[0] && h.credit[0].url === 'https://www.deezer.com/artist/27', 'the release artist carries its Deezer link');

  // the event, for a listener that comes later
  const fromEvent = await editor.evaluate(() => new Promise(res => {
    document.addEventListener('first-contact:seed', e => res(JSON.parse(e.detail).token), { once: true });
    document.dispatchEvent(new CustomEvent('first-contact:request'));
  }));
  check(fromEvent === seed.token, `first-contact:request re-publishes the handoff (${fromEvent})`);
});
