// A background add (right-click 🔗) opens the artist's edit form with the link seeded and submits
// it once the link is on the form. MusicBrainz cleans some links as it seeds them (Apple Music
// drops the artist's name from the URL), so the exact link never showed and the tab was left
// waiting for a human. The link is matched by its host and id in the links editor now.
//
// Writes to the sandbox: each run adds a made-up Apple Music link to a pristine artist (#795).
import { test, check, until, SANDBOX, requireLogin, pristine } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';
test.use({ gm: apolloGm() });
const URL1 = 'https://music.apple.com/us/artist/zzq-apollo-autocommit/1999999' + String(Date.now()).slice(-3);
test('a background add submits an Apple Music link, which MusicBrainz cleans as it seeds it', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(120000);
  const { mbid: GID } = await pristine(page, 'artist');
  const q = new URLSearchParams({ 'edit-artist.url.0.text': URL1, 'edit-artist.url.0.link_type_id': '978', 'edit-artist.edit_note': 'Apollo test: background add' });
  await page.goto(`${SANDBOX}/artist/${GID}/edit?${q}#tc-autocommit`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await inject('apollo_editor');
  const done = await until(() => page.url(), u => !/\/edit/.test(u), { timeout: 40000 });
  console.log('url', done, 'seeded', URL1);
  if (/\/edit/.test(done)) console.log('errors', await page.evaluate(() => [...document.querySelectorAll('.error, .errors, .warning')].map(e => e.textContent.trim()).filter(Boolean).join(' | ').slice(0, 600)));
  check(!/\/edit/.test(done), 'the form was submitted');
  const id = URL1.split('/').pop();
  const rels = await until(() => page.evaluate(g => fetch('/ws/2/artist/' + g + '?inc=url-rels&fmt=json').then(r => r.json()).then(j => (j.relations || []).map(r => r.url && r.url.resource).filter(Boolean)), GID), v => v.some(u => u.includes(id)), { timeout: 30000 });
  console.log('stored', JSON.stringify(rels.filter(u => /apple/.test(u))));
  check(rels.some(u => u.includes(id)), 'the link is on the artist');
});
