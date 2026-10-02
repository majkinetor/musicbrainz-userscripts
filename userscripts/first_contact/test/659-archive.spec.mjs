// #659: archive the imported album on the Internet Archive. The release editor's tab sends the
// save requests (anonymous Save Page Now, or Save Page Now 2 with the user's archive.org keys);
// the edit note links the snapshots by the import's time.
//
// Fixture: Daft Punk, "Random Access Memories" (Deezer album 6575789), as in 650-deezer-seed.
// web.archive.org is answered by answerGm, so a run saves nothing on archive.org.
import { test, check, until, requireLogin, settled, answerGm, loadFunctions } from '../../../dev/test/harness.mjs';

const ALBUM = 'https://www.deezer.com/en/album/6575789';
const PAGE = 'https://www.deezer.com/album/6575789';
const API = 'https://api.deezer.com/album/6575789';

test('the edit note links the page, the API data and, with keys, the screenshot', { tag: ['@unit', '@critical'] }, async () => {
  const { editNoteFor } = await loadFunctions('first_contact', ['NAME', 'VERSION', 'HOMEPAGE', 'editNoteFor']);
  const rel = { url: PAGE };
  const provider = { name: 'Deezer' };
  const off = editNoteFor(rel, provider, null);
  check(off.startsWith(`Imported from Deezer: ${PAGE}\n\nFirst Contact v`) && !/archive\.org/.test(off), `archive off: no archive lines\n${off}`);
  const urls = [{ url: PAGE, what: 'page' }, { url: API, what: 'api' }];
  const anon = editNoteFor(rel, provider, { ts: '20261002120000', keys: false, urls });
  check(anon.includes(`\nArchived page: https://web.archive.org/web/20261002120000/${PAGE}\n`), `the page line\n${anon}`);
  check(anon.includes(`\nArchived API data: https://web.archive.org/web/20261002120000/${API}\n`), `the API line\n${anon}`);
  check(!/screenshot/i.test(anon), 'no screenshot line without keys');
  const keys = editNoteFor(rel, provider, { ts: '20261002120000', keys: true, urls });
  check(keys.includes(`\nArchived screenshot: https://web.archive.org/web/20261002120000/http://web.archive.org/screenshot/${PAGE}\n`), `the screenshot line with keys\n${keys}`);
});

test('the archived page is the one the user has, without the fragment and share parameters', { tag: ['@unit', '@critical'] }, async () => {
  const { archivePageUrl } = await loadFunctions('first_contact', ['archivePageUrl']);
  const cases = [
    ['https://www.deezer.com/en/album/6575789#tracks', 'https://www.deezer.com/en/album/6575789'],
    ['https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc&nd=1', 'https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa'],
    ['https://music.youtube.com/playlist?list=OLAK5uy_x&feature=share', 'https://music.youtube.com/playlist?list=OLAK5uy_x'],
    ['https://music.apple.com/us/album/x/123?l=en&utm_source=y', 'https://music.apple.com/us/album/x/123?l=en'],
  ];
  for (const [input, want] of cases) check(archivePageUrl(input) === want, `${input} → ${archivePageUrl(input)}, wanted ${want}`);
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
  const stored = await page.evaluate(() => GM_listValues().filter(k => k.startsWith('fc.handoff.')).map(k => [k, GM_getValue(k)]));
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
    check(new RegExp(`\\nArchived page: https://web\\.archive\\.org/web/\\d{14}/${ALBUM.replace(/[./]/g, '\\$&')}\\n`).test(seed.note), 'the edit note links the page snapshot');
    check(seed.note.includes(`/${API}\n`), 'the edit note links the API snapshot');
    check(!/screenshot/i.test(seed.note), 'no screenshot line without keys');
    const ts = (seed.note.match(/web\.archive\.org\/web\/(\d{14})\//) || [])[1];
    check(ts && Math.abs(Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8), +ts.slice(8, 10), +ts.slice(10, 12)) - Date.now()) < 15 * 60e3, `the link's time is the import's (${ts})`);
    const note = await editor.locator('#edit-note-text').inputValue().catch(() => '');
    check(note.includes('Archived page: https://web.archive.org/web/'), 'the release editor has the archive lines in its edit note');

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
    check(seed.note.includes(`Archived screenshot: https://web.archive.org/web/`) && seed.note.includes(`/http://web.archive.org/screenshot/${ALBUM}\n`), `the edit note links the screenshot\n${seed.note}`);

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
    await page.locator('#fc-panel .fc-ia-key').fill('K1');
    await page.locator('#fc-panel .fc-ia-secret').fill('S1');
    await page.locator('#fc-panel .fc-ia-secret').press('Tab');
    const s1 = await page.evaluate(() => GM_getValue('fc.settings'));
    check(s1.iaKey === 'K1' && s1.iaSecret === 'S1', `keys saved (${s1.iaKey}/${s1.iaSecret})`);
    check(await page.locator('#fc-panel .fc-ia-secret').getAttribute('type') === 'password', 'the secret is a password field');
    await box.uncheck();
    const s2 = await page.evaluate(() => GM_getValue('fc.settings'));
    check(s2.archive === false, 'unchecking turns archiving off');
    check(await page.locator('#fc-panel .fc-ia.fc-off').count() === 1, 'the keys dim while archiving is off');
  });
});
