// #623 (sweep, A5 + A1): Apollo auto-links a seeded release's label and release artist
// when the name has exactly one exact MusicBrainz match. "Exactly one" was judged on the
// first 8 search results, which don't rank exact matches first, so a second holder of
// the name further down was invisible; and the label was wrapped through the sandbox's
// `window.MB`, absent in managers that isolate page globals. Both now use the track
// artists' rule (unique by name or alias among ALL matches, #613) and the page's MB.
//
// test.musicbrainz.org, nothing submitted. The seeded release has the labels "Strut"
// (one exact match on the sandbox) and "Mercury", and the artist credit "Portishead &
// Beck" (one Portishead). The sandbox has two labels named exactly Mercury and three
// artists named exactly Beck, but only one of each is in the first 8 results, so the
// old rule linked them. The unique ones must be linked, the ambiguous ones left unset.
import { test, check, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Apollo Editor' } });

test('a seeded release links its unique label and artist, and leaves ambiguous ones alone', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.evaluate(() => {
    const f = document.createElement('form'); f.method = 'POST'; f.action = '/release/add';
    const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); };
    add('name', 'Apollo #623 auto-link fixture');
    add('artist_credit.names.0.name', 'Portishead');
    add('artist_credit.names.0.join_phrase', ' & ');
    add('artist_credit.names.1.name', 'Beck');
    add('labels.0.name', 'Strut');
    add('labels.1.name', 'Mercury');
    add('mediums.0.format', 'Digital Media');
    add('mediums.0.track.0.name', 'Track');
    document.body.appendChild(f); f.submit();
  });
  await page.waitForURL(/\/release\/add/, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await inject('apollo_editor', { waitFor: '__apolloEditor' });

  const state = () => page.evaluate(() => {
    const ko = v => (typeof v === 'function' ? v() : v);
    const rel = window.MB.releaseEditor.rootField.release();
    const labels = rel.labels().map(l => { const e = l.label(); return { name: e && e.name, gid: e && e.gid }; });
    const names = ko(ko(rel.artistCredit).names) || [];
    const artists = names.map(n => { const a = ko(n.artist); return { name: ko(n.name), gid: a ? ko(a.gid) : undefined }; });
    return { labels, artists };
  });
  // the auto-match runs on load; wait for the unique ones, then a little longer for
  // the ambiguous ones to (not) be linked too
  await page.waitForFunction(() => {
    try {
      const rel = window.MB.releaseEditor.rootField.release(), l = rel.labels()[0].label(), a = rel.artistCredit().names[0].artist;
      return !!(l && l.gid && a && a.gid);
    } catch (e) { return false; }
  }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const s = await state();
  console.log(JSON.stringify(s));
  check(s.labels[0].gid === '9ba9a0fb-d617-4906-9c1d-7bfa78087ff9', `"Strut" is linked to the one Strut (${s.labels[0].gid})`);
  check(s.labels[1] && !s.labels[1].gid, `"Mercury" (two labels of that name) is left for a human (${s.labels[1] && (s.labels[1].gid || 'unset')})`);
  check(s.artists[0] && s.artists[0].gid === '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11', `"Portishead" is linked to the one Portishead (${s.artists[0] && s.artists[0].gid})`);
  check(s.artists[1] && !s.artists[1].gid, `"Beck" (three artists of that name) is left for a human (${s.artists[1] && (s.artists[1].gid || 'unset')})`);
});
