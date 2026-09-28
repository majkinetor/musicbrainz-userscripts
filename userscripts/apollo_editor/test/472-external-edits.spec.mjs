// Edits made to MusicBrainz's own track objects, from outside Apollo and from inside.
//
// #472 (majkinetor): bookmarklets such as derat's "Rename tracks" and "Edit join phrases"
//   call track.name(…) / track.artistCredit(…) directly, never touching the tracks array;
//   Apollo watched only the array, so its table went stale until a toggle. It watches
//   each track's name and credit now.
// #483 (regression from #472): Apollo's own title edits tripped that watcher, and the
//   rebuild it scheduled 400 ms later yanked the focus off the field the user had moved
//   to. Apollo's own writes are marked as its own.
//
// A small seeded release; nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

const seed = (title0, title1, feat) => ({
  name: 'Apollo external edits',
  'artist_credit.names.0.name': 'Apollo Test Artist',
  type: ['album'],
  'mediums.0.format': 'CD',
  'mediums.0.track.0.name': title0,
  'mediums.0.track.0.artist_credit.names.0.name': 'Apollo Test Artist',
  'mediums.0.track.1.name': title1,
  'mediums.0.track.1.artist_credit.names.0.name': 'Apollo Test Artist',
  ...(feat ? { 'mediums.0.track.1.artist_credit.names.0.join_phrase': ' feat. ', 'mediums.0.track.1.artist_credit.names.1.name': 'Second Artist' } : {}),
});
const rows = '.tc-medsec .tc-mirror tbody tr[data-tk]';
async function open(page, inject, s) {
  const submitted = await openApollo(page, inject, { seed: s, tab: 'tracklist' });
  await page.waitForSelector(rows, { timeout: 30000 });
  await page.waitForFunction(() => window.__apolloEditor.model?.tracks.length >= 2, null, { timeout: 30000 });
  await page.waitForTimeout(1500);   // in-flight name searches settle, so they can't race the edits
  return submitted;
}

test('#472: a bookmarklet\'s edits show without a toggle', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  await open(page, inject, seed('Original Track One', 'Original Track Two', true));
  const r = await page.evaluate(async () => {
    const [t0, t1] = MB.releaseEditor.rootField.release().mediums()[0].tracks();
    t0.name('Renamed By Bookmarklet');
    const ac = t1.artistCredit();
    const beforeJoin = ac.names[0].joinPhrase;
    t1.artistCredit({ ...ac, names: ac.names.map((n, i) => (i === 0 ? { ...n, joinPhrase: ' & ' } : n)) });
    await new Promise(r => setTimeout(r, 900));   // the 400 ms sync debounce, and a render
    const m = window.__apolloEditor.model;
    return { beforeJoin, title: m.tracks[0].title, shown: document.querySelector('.tc-medsec .tc-mirror tbody tr[data-tk] .t-title')?.value, join: (m.tracks[1].slots[0] || {}).joinPhrase };
  });
  check(r.beforeJoin === ' feat. ', 'the seed has a " feat. " join phrase');
  check(r.title === 'Renamed By Bookmarklet' && r.shown === 'Renamed By Bookmarklet', `the renamed title reached Apollo (${r.title} / ${r.shown})`);
  check(r.join === ' & ', `and the new join phrase (${JSON.stringify(r.join)})`);
});

test('#483: editing a title leaves the focus where the user moved it', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
  await open(page, inject, seed('original title one', 'original title two'));
  const f = await page.evaluate(async rows => {
    const t0 = document.querySelectorAll(rows)[0].querySelector('.t-title');
    t0.focus();
    t0.value = 'Original Title One';   // a casing-only change
    t0.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));   // the edit's own re-render
    const t1 = document.querySelectorAll(rows)[1].querySelector('.t-title');
    t1.focus();   // Tab, or a click, onto the next title
    const focused = document.activeElement === t1;
    await new Promise(r => setTimeout(r, 700));   // past the 400 ms debounce
    const now = document.querySelectorAll(rows);
    return { focused, stayed: document.activeElement === t1, sameNode: now[1]?.querySelector('.t-title') === t1, row0: now[0]?.querySelector('.t-title').value, ko: MB.releaseEditor.rootField.release().mediums()[0].tracks()[0].name() };
  }, rows);
  check(f.focused, 'the next title took the focus');
  check(f.stayed && f.sameNode, `and kept it: no rebuild came later (stayed ${f.stayed}, same node ${f.sameNode})`);
  check(f.row0 === 'Original Title One' && f.ko === 'Original Title One', `the edit landed, in Apollo and in MusicBrainz (${f.row0} / ${f.ko})`);
});
