// #626 (majkinetor, Discussion #620): the Tracklist left artists unresolved that another
// edition of the same release credits at the very same position — spelling variants
// ("The Revolution of St.Vincent", "Juan Formel", "Cedric Im Brooks") even with the release
// group linked, and common names ("Duke", "Sambo") without it — while the Recordings pass
// linked every one of those tracks by position (#440). Artists now use the same evidence.
//
// test.musicbrainz.org, nothing submitted. The fixture is the sandbox's "Going Places: The
// August Darnell Years" release group; a new release is seeded with its tracks' titles and
// lengths and the artists spelled differently.
//   A — release group linked: the variants resolve by position (the seeded credited name is
//       kept), exact names still resolve from the release group, and the three that must NOT
//       match don't (a different name, a length far off, a different song at that position).
//       One release-group request serves both sources; the picker leads with the position
//       section; the badge says what it rests on.
//   B — no release group: the duplicates carry it, common names included; the Duplicates
//       view links the seeded artists that matched and marks the ones that didn't.
// The outcome is read from the table, the reason from Apollo's log, where every position match
// is recorded ("… via the same position"). Writing the matches can make Apollo rebuild its table
// once the pass ends (#575); the badges must survive it (#638).
// APOLLO_EDITOR_SRC=<old build> to watch it fail.
import { test, check, mbJson } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm(null, { xhr: 'node' }), viewport: { width: 1700, height: 1100 } });   // its GM requests answered (the matching makes some)

const EDITION = 'fd8ba202-e570-40b5-9885-ccb74f9ef72d';   // Going Places (CD, 15 tracks) on the sandbox
const RG = '814951d8-f791-33e4-adb5-6ed3897719c4';

// what gets seeded, and what each track must end up as
const CASES = [
  { n: 1, artist: "Dr.Buzzard's Original Savannah Band", want: 'pos', why: 'curly vs straight apostrophe, a missing space' },
  { n: 2, artist: "Don Armando's 2nd Avenue Rhumba Band", want: 'pos', why: 'the artist\'s own name with a straight apostrophe; the edition credits "Second Avenue"' },
  { n: 3, artist: 'Kid Creol & the Coconuts', want: 'pos', why: 'a typo (Creol)' },
  { n: 4, artist: 'Cristina', want: 'rg', why: 'an exact name — the rg source still has it first' },
  { n: 5, artist: 'Gichy Dans Beachwood No 9', want: 'pos', why: 'punctuation dropped' },
  { n: 7, artist: 'Somebody Else Entirely', want: 'not-pos', why: 'the edition credits someone else here' },
  { n: 8, artist: 'Aural Exciter', want: 'not-pos', why: 'a close name, but the length is 3 minutes off', length: 100000 },
  { n: 9, artist: 'Coati-Mundi', want: 'not-pos', why: 'the right artist, but a different song at that position', title: 'Totally Different Song' },
];
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const viaPos = (log, name) => new RegExp('Match: ' + esc(name) + ' → .* via the same position').test(log);

test('track artists matched by their position on other editions', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(10 * 60000);
  // ground truth from the sandbox itself: position → { title, length, artist gids }
  const ed = await mbJson(`https://test.musicbrainz.org/ws/2/release/${EDITION}?inc=recordings+artist-credits&fmt=json`);
  const T = n => { const t = ed.media[0].tracks.find(x => x.position === n); return { title: t.title, length: t.length, gids: t['artist-credit'].map(a => a.artist.id), names: t['artist-credit'].map(a => a.artist.name) }; };
  const reqs = [];
  page.on('request', q => { const u = q.url(); if (/\/ws\/2\/release\b/.test(u)) reqs.push(u.replace('https://test.musicbrainz.org', '')); });
  const logText = () => page.evaluate(() => window.__apolloEditor.logMarkdown ? window.__apolloEditor.logMarkdown() : '');

  async function seedAndMatch(withRg) {
    reqs.length = 0;
    const seed = { name: 'Going Places: The August Darnell Years 1976-1983', 'artist_credit.names.0.name': 'Kid Creole', 'artist_credit.names.0.mbid': ed['artist-credit'][0].artist.id, 'mediums.0.format': 'Digital Media' };
    if (withRg) seed.release_group = RG;
    // all 15 positions, so the tracklist lines up with the edition's; only CASES are asserted
    for (let n = 1; n <= 15; n++) {
      const c = CASES.find(x => x.n === n), t = T(n);
      seed[`mediums.0.track.${n - 1}.name`] = (c && c.title) || t.title;
      seed[`mediums.0.track.${n - 1}.length`] = String((c && c.length) || t.length);
      seed[`mediums.0.track.${n - 1}.artist_credit.names.0.name`] = c ? c.artist : t.names.join(' & ');
    }
    const submitted = await openApollo(page, inject, { seed });
    if (!withRg) {   // the Add flow's Duplicates tab first, as an editor would (Apollo scores it)
      await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^\s*Duplicates\s*$/.test(x.textContent)); if (a) a.click(); });
      // every listed duplicate scored = its tracklist fetched (they are fetched one at a time)
      await page.waitForFunction(() => { const c = [...document.querySelectorAll('#duplicates-tab .tc-dup-sim')]; return c.length > 0 && c.every(td => /%|\?|—/.test(td.textContent)); }, null, { timeout: 90000 }).catch(() => console.log('the Duplicates tab did not finish scoring'));
    }
    await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^\s*Tracklist\s*$/.test(x.textContent)); if (a) a.click(); });
    const btn = '#tc-bar [data-act="match"], #tc-hdr [data-act="match"]';
    await page.waitForSelector(btn, { timeout: 30000 });
    // the pass's own end: its summary line in Apollo's log
    const count = t => (t.match(/tracklist match: \d+ track/g) || []).length;
    const before = count(await logText());
    await page.click(btn);
    const finished = await page.waitForFunction(n => ((window.__apolloEditor.logMarkdown ? window.__apolloEditor.logMarkdown() : '').match(/tracklist match: \d+ track/g) || []).length > n, before, { timeout: 180000 }).then(() => true, () => false);
    await page.waitForTimeout(1500);   // the commits and any rebuild after the pass
    const all = await logText(), log = all.slice(all.lastIndexOf('Release: Going Places'));   // this scenario's part
    if (!finished) console.log('apollo log:\n' + log.split('\n').slice(-60).join('\n'));
    const rows = await page.evaluate(() => window.__apolloEditor.model.tracks.map(t => ({ n: t.ti + 1, slots: t.slots.map(s => ({ status: s.status, gid: s.gid, creditedAs: s.creditedAs, committed: !!s.committed })) })));
    return { rows, submitted, finished, log, rebuilt: /running the deferred tracklist resync/.test(log) };
  }
  function judge(label, { rows, log }) {
    for (const c of CASES) {
      const s = (rows.find(x => x.n === c.n) || { slots: [] }).slots[0], truth = T(c.n);
      if (c.want === 'not-pos') { check(!viaPos(log, c.artist), `${label} #${c.n} "${c.artist}" is NOT matched by position — ${c.why} (${s && s.status})`); continue; }
      const linked = !!s && s.gid === truth.gids[0] && s.committed && [c.want, 'set'].includes(s.status);
      check(linked && (c.want !== 'pos' || viaPos(log, c.artist)), `${label} #${c.n} "${c.artist}" → ${truth.names[0]}${c.want === 'pos' ? ', by position' : ''} — ${c.why} (${s && s.status}, ${s && s.gid && s.gid.slice(0, 8)})`);
      if (c.want === 'pos' && s) check(s.creditedAs === c.artist, `${label} #${c.n} keeps the seeded credited name "${c.artist}" (${JSON.stringify(s.creditedAs)})`);
    }
  }

  // ── A. release group linked ──
  const A = await seedAndMatch(true);
  console.log('A:', A.rebuilt ? '(rebuilt)' : '', JSON.stringify(A.rows.filter(r => CASES.some(c => c.n === r.n)).map(r => [r.n, r.slots[0].status, (r.slots[0].gid || '').slice(0, 8)])));
  check(A.finished, 'A: the match pass finishes');
  judge('A', A);
  // Apollo's; MusicBrainz's own editor also lists the seeded group's releases (inc=…labels+media)
  const rgReqs = reqs.filter(u => /release-group=/.test(u) && /inc=recordings\+artist-credits/.test(u));
  check(rgReqs.length === 1, `one release-group request serves the rg source and the position source (${rgReqs.length})`);
  check(/via the same position on \d+ of \d+ other edition/.test(A.log), 'a position match says how many editions it rests on');
  // #638: a rebuild after the pass keeps each artist's match badge; one that loses it is logged
  check(!/#638 a table rebuild lost/.test(A.log), 'A: no match badge is lost in a table rebuild (#638)');
  {
    const tip = await page.evaluate(() => (document.querySelector('.tc-badge.pos') || {}).title || '');
    check(/matched by position: .* on \d+ of \d+ other edition/.test(tip), `a pos badge says what it rests on: "${tip}"`);
    const sec = await page.evaluate(async () => {
      const inp = [...document.querySelectorAll('.tc-search input.nm')].find(i => /Buzzard/i.test(i.value));
      if (!inp) return null;
      inp.focus();
      for (let i = 0; i < 100 && !document.querySelector('.tc-acpop .tc-acsec'); i++) await new Promise(z => setTimeout(z, 100));   // the search is paced (#633)
      const pop = document.querySelector('.tc-acpop');
      const out = pop ? { head: (pop.querySelector('.tc-acsec') || {}).textContent || '', votes: (pop.querySelector('.tc-acvotes') || {}).textContent || '', first: (pop.querySelector('.tc-acrow .nm') || {}).textContent || '' } : null;
      inp.blur(); return out;
    });
    check(sec && sec.head === 'On other editions at this position' && /^\d+ of \d+ editions?$/.test(sec.votes) && /Buzzard/.test(sec.first), `the picker leads with "On other editions at this position", with the edition count (${JSON.stringify(sec)})`);
  }

  // ── B. no release group: the duplicates carry it ──
  const B = await seedAndMatch(false);
  console.log('B:', B.rebuilt ? '(rebuilt)' : '', JSON.stringify(B.rows.filter(r => CASES.some(c => c.n === r.n)).map(r => [r.n, r.slots[0].status, (r.slots[0].gid || '').slice(0, 8)])));
  check(B.finished, 'B: the match pass finishes');
  check(!/#638 a table rebuild lost/.test(B.log), 'B: no match badge is lost in a table rebuild (#638)');
  for (const n of [1, 3, 5]) {
    const s = B.rows.find(x => x.n === n).slots[0], c = CASES.find(x => x.n === n);
    check(s.gid === T(n).gids[0] && viaPos(B.log, c.artist), `B #${n} resolves from the duplicates by position, with no release group linked (${s.status})`);
  }
  // "Machine" is an exact name more than one sandbox artist may share: with no release group,
  // only the position can say which one this is
  const m6 = B.rows.find(x => x.n === 6).slots[0];
  check(m6.gid === T(6).gids[0] && m6.committed, `B #6 "Machine" is linked to the edition's Machine (${m6.status}, ${(m6.gid || '').slice(0, 8)})`);
  const dupSearches = reqs.filter(u => /release\?query=/.test(u)).length;
  check(dupSearches === 0, `no duplicate search: the tracklists the Duplicates tab fetched were reused (${dupSearches} search request(s))`);
  await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^\s*Duplicates\s*$/.test(x.textContent)); if (a) a.click(); });
  const dd = await page.evaluate(async (edition) => {
    const row = [...document.querySelectorAll('#duplicates-tab tr')].find(tr => (tr.querySelector('input[name="base-release"]') || {}).value === edition);
    const cell = row && row.querySelector('.tc-dup-sim'); if (!cell) return null;
    cell.click();
    for (let i = 0; i < 40 && !document.querySelector('#duplicates-tab .tc-dd-tbl'); i++) await new Promise(z => setTimeout(z, 250));
    const rows = [...document.querySelectorAll('#duplicates-tab .tc-dd-tbl tr.tc-dd-row')];
    const seeded = i => rows[i] && rows[i].children[5];
    return { t1Link: seeded(0) ? (seeded(0).querySelector('a[href*="/artist/"]') || {}).getAttribute?.('href') || '' : '', t7Unres: seeded(6) ? !!seeded(6).querySelector('.tc-dd-unres') : false };
  }, EDITION);
  check(dd && dd.t1Link.endsWith('/artist/' + T(1).gids[0]), `the Duplicates view links a matched seeded artist (${dd && dd.t1Link})`);
  check(dd && dd.t7Unres, '…and marks an unmatched one');
  check(A.submitted.length === 0 && B.submitted.length === 0, 'nothing submitted');
});
