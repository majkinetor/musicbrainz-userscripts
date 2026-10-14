// #659: archive the imported album on the Internet Archive. The release editor's tab sends the
// save requests (anonymous Save Page Now, or Save Page Now 2 with the user's archive.org keys).
// The edit note doesn't mention them (#739).
//
// Fixture: Daft Punk, "Random Access Memories" (Deezer album 6575789), as in 650-deezer-seed.
// web.archive.org is answered by answerGm, so a run saves nothing on archive.org.
import { test, check, until, requireLogin, settled, answerGm, loadFunctions } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://www.deezer.com/en/album/6575789';
const PAGE = 'https://www.deezer.com/album/6575789';
const API = 'https://api.deezer.com/album/6575789';

// #739 (majkinetor): the edit note carries no archive lines; Apollo's archive menu by each link finds the snapshots
test('the edit note has no archive lines', { tag: ['@unit', '@critical'] }, async () => {
  const { editNoteFor } = await loadFunctions('first_contact', ['NAME', 'VERSION', 'HOMEPAGE', 'editNoteFor']);
  const note = editNoteFor({ url: PAGE }, { name: 'Deezer' });
  check(note.startsWith(`Imported from Deezer: ${PAGE}\n\nFirst Contact v`) && !/archive\.org|Archived/.test(note), `no archive lines\n${note}`);
});

// #736 (majkinetor, a Discogs import): discogs.com refuses archive.org, so only its API data is saved
test('Discogs: the API data is saved, not the page', { tag: ['@unit', '@critical'] }, async () => {
  const { mbaSavable, mbaCleanUrl } = await loadFunctions('first_contact', ['mbaSavable', 'mbaCleanUrl']);
  const api = mbaSavable('https://www.discogs.com/release/34839779');
  check(api === 'https://api.discogs.com/releases/34839779', `the release's API address (${api})`);
  const page = mbaCleanUrl('https://www.discogs.com/release/34839779-Saimaa-Ja-Yona-Solovey-Lauluja-Ukrainasta?redirected=true');
  check(page === 'https://www.discogs.com/release/34839779-Saimaa-Ja-Yona-Solovey-Lauluja-Ukrainasta', `?redirected=true is dropped (${page})`);
});

test('the archived page is the one the user has, without the fragment and share parameters', { tag: ['@unit', '@critical'] }, async () => {
  const { mbaCleanUrl: archivePageUrl } = await loadFunctions('first_contact', ['mbaCleanUrl']);
  const cases = [
    ['https://www.deezer.com/en/album/6575789#tracks', 'https://www.deezer.com/en/album/6575789'],
    ['https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc&nd=1', 'https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa'],
    ['https://music.youtube.com/playlist?list=OLAK5uy_x&feature=share', 'https://music.youtube.com/playlist?list=OLAK5uy_x'],
    ['https://music.apple.com/us/album/x/123?l=en&utm_source=y', 'https://music.apple.com/us/album/x/123?l=en'],
  ];
  for (const [input, want] of cases) check(archivePageUrl(input) === want, `${input} → ${archivePageUrl(input)}, wanted ${want}`);
  // majkinetor (a toast on Spotify): "u.searchParams.keys() is not iterable": open.spotify.com
  // patches URLSearchParams, and the import stopped. As there:
  const proto = URLSearchParams.prototype, realKeys = proto.keys;
  proto.keys = function () { return {}; };
  try {
    let got = null, err = null;
    try { got = archivePageUrl('https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc&nd=1'); } catch (e) { err = e; }
    check(!err && got === 'https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa', `a page's own URLSearchParams doesn't matter (${err ? err.message : got})`);
  } finally { proto.keys = realKeys; }
});

// Import the Deezer album into the sandbox's release editor; returns the editor page and the seed.
async function importToEditor({ page, context, inject }) {
  await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const go = page.locator('#fc-root .fc-go');
  await go.waitFor({ state: 'visible' });
  const [editor] = await Promise.all([context.waitForEvent('page'), go.click()]);
  await editor.waitForURL(/test\.musicbrainz\.org\/release\/add\?first_contact=/, { timeout: 90_000 });
  const confirm = editor.getByRole('button', { name: 'Continue' });
  if (await confirm.isVisible().catch(() => false)) await Promise.all([editor.waitForNavigation(), confirm.click()]);
  await requireLogin(editor);
  await settled(editor);
  // the harness's GM storage is per origin: carry the handoff over as one manager store would
  const stored = await page.evaluate(() => GM_listValues().filter(k => k.startsWith('fc.handoff.') || k === 'mbu.archive').map(k => [k, GM_getValue(k)]));
  await editor.evaluate(kv => kv.forEach(([k, v]) => GM_setValue(k, v)), stored);
  await inject('first_contact', { target: editor, waitFor: '__fcHandoff' });
  const seed = await page.evaluate(() => ({ token: window.__fcLastSeed.token, note: (window.__fcLastSeed.params.find(([k]) => k === 'edit_note') || [])[1] || '' }));
  return { editor, seed };
}

test.describe('anonymous', () => {
  test.use({
    gm: { name: 'First Contact', persist: 'tabs', values: { 'fc.settings': { server: 'test.musicbrainz.org' } } },
    pageErrors: 'ignore',   // deezer.com's own scripts throw in an automated browser
  });

  test('archiving is on by default: the editor tab saves the page and the API data, once', { tag: ['@web', '@sandbox', '@login', '@critical'] }, async ({ page, context, inject }) => {
    const saves = [];
    answerGm(context, ({ url, method, headers }) => {
      if (!/^https:\/\/web\.archive\.org\//.test(url)) return null;
      saves.push({ url, method, headers });
      const target = url.replace('https://web.archive.org/save/', '');
      return { status: 200, url: `https://web.archive.org/web/20261002120917/${target}`, headers: 'content-type: text/html', body: '<html>snapshot</html>' };
    });
    const { editor, seed } = await importToEditor({ page, context, inject });
    console.log('edit note:\n' + seed.note);
    check(!/Archived|web\.archive\.org/.test(seed.note), 'no archive lines in the edit note (#739)');

    const got = await until(() => saves.length, n => n >= 2, { timeout: 20_000 });
    check(got === 2, `two saves sent (${got})`);
    check(saves.every(s => s.method === 'GET'), 'anonymous saves are GETs');
    check(saves[0].url === 'https://web.archive.org/save/' + ALBUM && saves[1].url === 'https://web.archive.org/save/' + API, `the page, then the API data: ${saves.map(s => s.url).join(', ')}`);
    check(saves.every(s => !Object.keys(s.headers || {}).some(k => /^authorization$/i.test(k))), 'no Authorization header without keys');

    // a reload of the editor tab hands off again but doesn't save again
    await editor.reload({ waitUntil: 'domcontentloaded' });
    const confirm2 = editor.getByRole('button', { name: 'Continue' });
    if (await confirm2.isVisible().catch(() => false)) await Promise.all([editor.waitForNavigation(), confirm2.click()]);
    await settled(editor);
    await editor.evaluate(() => { delete window.__fcHandoff; });
    await inject('first_contact', { target: editor, waitFor: '__fcHandoff' });
    await editor.waitForTimeout(1500);
    check(saves.length === 2, `no second save after a reload (${saves.length})`);
  });
});

// the keys as FC kept them before #736, in fc.settings: moved to the shared mbu.archive on start
test.describe('with archive.org keys', () => {
  test.use({
    gm: { name: 'First Contact', persist: 'tabs', values: { 'fc.settings': { server: 'test.musicbrainz.org', iaKey: 'AKEY', iaSecret: 'ASECRET' } } },
    pageErrors: 'ignore',
  });

  test('Save Page Now 2: a job with a screenshot, followed until it finishes', { tag: ['@web', '@sandbox', '@login'] }, async ({ page, context, inject }) => {
    const calls = [];
    let polls = 0;
    answerGm(context, ({ url, method, headers, data }) => {
      if (!/^https:\/\/web\.archive\.org\//.test(url)) return null;
      calls.push({ url, method, headers, data });
      if (method === 'POST') {
        const target = new URLSearchParams(data).get('url');
        return { status: 200, body: JSON.stringify({ url: target, job_id: 'spn2-' + calls.length }) };
      }
      polls++;
      const job = url.split('/').pop();
      return { status: 200, body: JSON.stringify(polls % 2 ? { status: 'pending', job_id: job } : { status: 'success', job_id: job, timestamp: '20261002120917', original_url: PAGE, screenshot: 'http://web.archive.org/screenshot/' + PAGE }) };
    });
    const { seed } = await importToEditor({ page, context, inject });
    const moved = await page.evaluate(() => ({ shared: GM_getValue('mbu.archive'), fc: GM_getValue('fc.settings') }));
    check(moved.shared && moved.shared.iaKey === 'AKEY' && moved.shared.iaSecret === 'ASECRET' && !('iaKey' in moved.fc) && !('iaSecret' in moved.fc), `the keys moved to mbu.archive (${JSON.stringify(moved)})`);
    check(!/Archived|web\.archive\.org/.test(seed.note), 'no archive lines in the edit note, with keys either (#739)');

    const posts = () => calls.filter(c => c.method === 'POST');
    await until(() => posts().length, n => n >= 2, { timeout: 60_000 });
    const [p1, p2] = posts();
    check(p1 && p1.url === 'https://web.archive.org/save', `POST to /save (${p1 && p1.url})`);
    const auth = p1 && Object.entries(p1.headers || {}).find(([k]) => /^authorization$/i.test(k));
    check(auth && auth[1] === 'LOW AKEY:ASECRET', `the keys go in the Authorization header (${auth && auth[1]})`);
    const body = new URLSearchParams(p1 ? p1.data : '');
    check(body.get('url') === ALBUM && body.get('capture_screenshot') === '1' && body.get('if_not_archived_within') === '30d', `the page, with a screenshot, not again within 30 days: ${p1 && p1.data}`);
    check(p2 && new URLSearchParams(p2.data).get('url') === API, 'then the API data');
    const statusCalls = calls.filter(c => c.method === 'GET');
    check(statusCalls.length >= 2 && statusCalls.every(c => /^https:\/\/web\.archive\.org\/save\/status\/spn2-\d+$/.test(c.url)), `each job followed through /save/status (${statusCalls.map(c => c.url).join(', ')})`);
  });
});

test.describe('settings', () => {
  test.use({
    gm: { name: 'First Contact', values: { 'fc.settings': { server: 'test.musicbrainz.org' } } },
    pageErrors: 'ignore',
  });

  test('the archive checkbox and the archive.org keys are saved', { tag: ['@web'] }, async ({ page, inject }) => {
    await page.goto(ALBUM, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
    await page.locator('#fc-root .fc-more').click();
    const box = page.locator('#fc-panel .fc-archive');
    check(await box.isChecked(), 'archiving is on by default');
    check(await page.locator('#fc-panel a[href="https://archive.org/account/s3.php"]').count() === 1, 'the panel links where to get the keys');
    await page.locator('#fc-panel .mbu-ia-key').fill('K1');
    await page.locator('#fc-panel .mbu-ia-secret').fill('S1');
    await page.locator('#fc-panel .mbu-ia-secret').press('Tab');
    const s1 = await page.evaluate(() => GM_getValue('mbu.archive'));
    check(s1 && s1.iaKey === 'K1' && s1.iaSecret === 'S1', `keys saved to the shared mbu.archive (${JSON.stringify(s1)})`);
    // masked, but not a password field: that draws a password manager's icon into it (majkinetor: "Make fields not have password manager icons")
    const secret = await page.locator('#fc-panel .mbu-ia-secret').evaluate(e => ({ type: e.type, mask: getComputedStyle(e).webkitTextSecurity, opt: e.hasAttribute('data-1p-ignore') && e.dataset.lpignore === 'true' }));
    check(secret.type === 'text' && secret.mask === 'disc' && secret.opt, `the secret is masked, not a password field, and opts out of password managers (${JSON.stringify(secret)})`);
    await box.uncheck();
    const s2 = await page.evaluate(() => GM_getValue('fc.settings'));
    check(s2.archive === false, 'unchecking turns archiving off');
    check(await page.locator('#fc-panel .mbu-ia.mbu-ia-off').count() === 1, 'the keys dim while archiving is off');
  });
});
