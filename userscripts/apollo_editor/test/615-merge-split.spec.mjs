// #615 (majkinetor): "Merge all or subset of mediums (keep only one and move tracks to it
// and reset # on it)" / "Split 1 medium on track (add medium, move tracks to it and reset
// # on new one)".
//
// End to end on test.musicbrainz.org, through Apollo's own tools, SUBMITTED, and read
// back from the web service: nothing is taken on the editor's word. Each run makes its
// own release (3 media: 2 + 2 + 3, every track a new recording):
//   Merge (all ticked) → one medium, 7 tracks numbered 1–7, each on its original recording.
//   Split at track 5 → 4 + 3, the new medium numbered from 1, the same recordings.
// "Remove medium" waits for votes, as for anyone; the sandbox's own Accept applies it.
import { test, check, mbJson, SANDBOX, requireLogin, until, idle } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });
const ARTIST = 'c321a13a-1c52-43c0-b60a-3a454cb7f9a2';   // Mocky, on the sandbox
const MEDIA = [['Alpha', 'Bravo'], ['Charlie', 'Delta'], ['Echo', 'Foxtrot', 'Golf']];

async function makeRelease(page) {
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const f = { name: `Apollo 615 fixture ${stamp}`, 'artist_credit.names.0.mbid': ARTIST, 'artist_credit.names.0.name': 'Mocky', status: 'official', type: 'album', edit_note: 'Apollo Editor #615 merge/split test fixture (mb-userscripts test suite)' };
  MEDIA.forEach((tracks, mi) => { f[`mediums.${mi}.format`] = 'Digital Media'; tracks.forEach((t, ti) => { f[`mediums.${mi}.track.${ti}.name`] = `${t} ${stamp}`; f[`mediums.${mi}.track.${ti}.length`] = `${2 + ti}:0${mi}`; }); });
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.evaluate(f => {
    const form = document.createElement('form'); form.method = 'POST'; form.action = '/release/add';
    for (const [k, v] of Object.entries(f)) { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); }
    document.body.appendChild(form); form.submit();
  }, f);
  await page.waitForFunction(() => { try { const n = MB.releaseEditor.rootField.release().artistCredit().names; return n[0].artist && n[0].artist.id; } catch (e) { return false; } }, null, { timeout: 60000 });
  await idle(page);
  await page.evaluate(() => MB.releaseEditor.submitEdits());
  await page.waitForURL(/\/release\/[0-9a-f-]{36}(\?|$|#)/, { timeout: 120000 });
  return page.url().match(/\/release\/([0-9a-f-]{36})/)[1];
}
const read = async rel => (await mbJson(`${SANDBOX}/ws/2/release/${rel}?inc=recordings&fmt=json&_=${Date.now()}`)).media.map(m => ({ pos: m.position, tracks: m.tracks.map(t => ({ num: t.number, rec: t.recording.id })) }));
const inEditor = page => page.evaluate(() => MB.releaseEditor.rootField.release().mediums().map(m => ({ pos: m.position(), tracks: m.tracks().map(t => ({ num: String(t.number()), rec: t.recording() && !t.hasNewRecording() ? t.recording().gid : null })) })));
async function useTool(page, act, setup) {
  await page.evaluate(a => window.__apolloEditor.pickTool(a), act);
  await page.waitForSelector(`.tc-opt[data-tool="${act}"] .tc-opttrig`, { timeout: 15000 });
  if (setup) await setup();
  await page.click(`.tc-opt[data-tool="${act}"] .tc-opttrig`);
}
async function submitAndAccept(page, rel) {
  const ok = await page.evaluate(() => MB.releaseEditor.allowsSubmission());
  if (!ok) return false;
  await page.evaluate(() => MB.releaseEditor.submitEdits());
  await page.waitForURL(u => !/\/edit$/.test(u.pathname), { timeout: 120000 });
  await page.goto(`${SANDBOX}/release/${rel}/open_edits`, { waitUntil: 'load' });
  for (const href of await page.$$eval('a[href*="/test/accept-edit/"]', as => as.map(a => a.href))) await page.goto(href, { waitUntil: 'load' });
  return true;
}

test('merge all media, then split one, and MusicBrainz agrees', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(10 * 60_000);
  const rel = await makeRelease(page);
  const before = await read(rel), recs = before.flatMap(m => m.tracks.map(t => t.rec));
  check(before.map(m => m.tracks.length).join('+') === '2+2+3', `the new release: 2+2+3 (${rel})`);

  await openApollo(page, inject, { release: rel, tab: 'tracklist', submit: true });
  await useTool(page, 'mergemed');
  await page.waitForFunction(() => MB.releaseEditor.rootField.release().mediums().length === 1, null, { timeout: 60000 }).catch(() => {});
  let ed = await until(() => inEditor(page), e => e.length === 1 && e[0].tracks.length === 7 && e[0].tracks.every((t, i) => t.num === String(i + 1)));
  check(ed.length === 1 && ed[0].tracks.length === 7, `merged in the editor: one medium of 7 (${ed.map(m => m.tracks.length).join('+')})`);
  check(ed[0] && ed[0].tracks.every((t, i) => t.num === String(i + 1)), 'numbered 1–7');
  check(ed[0] && JSON.stringify(ed[0].tracks.map(t => t.rec)) === JSON.stringify(recs), 'each on its original recording, in order');
  check(await submitAndAccept(page, rel), 'MusicBrainz takes the merge');
  let mb = await read(rel);
  check(mb.length === 1 && mb[0].tracks.every((t, i) => t.num === String(i + 1)) && JSON.stringify(mb[0].tracks.map(t => t.rec)) === JSON.stringify(recs), `MusicBrainz: one medium, 1–7, the same recordings (${mb.map(m => m.tracks.length).join('+')})`);

  await openApollo(page, inject, { release: rel, tab: 'tracklist', submit: true });
  // by value (the track index): the label "4" is index 3
  await useTool(page, 'splitmed', () => page.selectOption('.tc-opt[data-tool="splitmed"] .tc-spat', { value: '4' }));
  await page.waitForFunction(() => MB.releaseEditor.rootField.release().mediums().length === 2, null, { timeout: 60000 }).catch(() => {});
  ed = await until(() => inEditor(page), e => e.length === 2 && e[1].tracks.length === 3 && e[1].pos === 2);
  check(ed.length === 2 && ed[0].tracks.length === 4 && ed[1].tracks.length === 3, `split in the editor: 4 + 3 (${ed.map(m => m.tracks.length).join('+')})`);
  check(ed[1] && ed[1].pos === 2 && ed[1].tracks.every((t, i) => t.num === String(i + 1)), 'the new medium is #2, numbered from 1');
  check(JSON.stringify(ed.flatMap(m => m.tracks.map(t => t.rec))) === JSON.stringify(recs), 'the same recordings, in order');
  check(await submitAndAccept(page, rel), 'MusicBrainz takes the split');
  mb = await read(rel);
  check(mb.map(m => m.tracks.length).join('+') === '4+3' && mb[1].tracks.every((t, i) => t.num === String(i + 1)), `MusicBrainz: 4 + 3, the second from 1 (${mb.map(m => m.tracks.length).join('+')})`);
  check(JSON.stringify(mb.flatMap(m => m.tracks.map(t => t.rec))) === JSON.stringify(recs), 'MusicBrainz: the same recordings, in order');
});
