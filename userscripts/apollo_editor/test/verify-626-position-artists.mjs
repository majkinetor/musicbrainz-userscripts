// #626 (majkinetor, Discussion #620): the Tracklist left artists unresolved that another
// edition of the same release credits at the very same position — spelling variants
// ("The Revolution of St.Vincent", "Juan Formel", "Cedric Im Brooks") even with the release
// group linked, and common names ("Duke", "Sambo") without it — while the Recordings pass
// linked every one of those tracks by position (#440). Artists now use the same evidence.
//
// test.musicbrainz.org, nothing submitted (every edit POST is aborted and counted). The
// fixture is the sandbox's "Going Places: The August Darnell Years" release group; a new
// release is seeded with its tracks' titles and lengths and the artists spelled differently.
//   A — release group linked: the variants resolve as `pos` (the seeded credited name is
//       kept), exact names still resolve as `rg`, and the three that must NOT match don't
//       (a different name, a length far off, a different song at that position). One
//       release-group request serves both sources; the picker leads with the position
//       section; the badge says what it rests on.
//   B — no release group: the duplicates carry it, common names included; the Duplicates
//       view links the seeded artists that matched and marks the ones that didn't.
// APOLLO_SRC=<old build> to watch it fail.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SRC = process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
const code = await readFile(SRC, 'utf8');
const log = (...a) => console.log('[verify-626]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const HOST = 'https://test.musicbrainz.org';
const EDITION = 'fd8ba202-e570-40b5-9885-ccb74f9ef72d';   // Going Places (CD, 15 tracks) on the sandbox
const RG = '814951d8-f791-33e4-adb5-6ed3897719c4';
const UA = { 'User-Agent': 'mb-userscripts-tests/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )', Accept: 'application/json' };

// ground truth from the sandbox itself: position → { title, length, artist gids }
let ed = null;
for (let i = 0; i < 6 && !ed; i++) {
  const r = await fetch(`${HOST}/ws/2/release/${EDITION}?inc=recordings+artist-credits&fmt=json`, { headers: UA });
  if (r.ok) ed = await r.json(); else await new Promise(z => setTimeout(z, 1500 * (i + 1)));
}
if (!ed) { console.log('could not read the fixture release'); process.exit(3); }
const T = n => { const t = ed.media[0].tracks.find(x => x.position === n); return { title: t.title, length: t.length, gids: t['artist-credit'].map(a => a.artist.id), names: t['artist-credit'].map(a => a.artist.name) }; };

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

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
let editPosts = 0; const reqs = [];
await page.route(u => /\/ws\/js\/edit\//.test(u.pathname), r => { editPosts++; return r.abort(); });
page.on('request', q => { const u = q.url(); if (/\/ws\/2\/release\b/.test(u)) reqs.push(u.replace(HOST, '')); });

await page.goto(HOST + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login') || !(await page.evaluate(() => !!document.querySelector('a[href*="/logout"]')))) { console.log('NOT LOGGED IN to the sandbox'); await ctx.close(); process.exit(3); }

async function seedAndMatch(withRg) {
  reqs.length = 0;
  await page.evaluate(([cases, tracks, rg, artistGid]) => {
    const f = document.createElement('form'); f.method = 'POST'; f.action = '/release/add';
    const add = (k, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; f.appendChild(i); };
    add('name', 'Going Places: The August Darnell Years 1976-1983');
    add('artist_credit.names.0.name', 'Kid Creole');
    add('artist_credit.names.0.mbid', artistGid);   // a sandbox artist, so MusicBrainz lists the edition as a similar release
    if (rg) add('release_group', rg);
    add('mediums.0.format', 'Digital Media');
    // all 15 positions, so the tracklist lines up with the edition's; only CASES are asserted
    for (let n = 1; n <= 15; n++) {
      const c = cases.find(x => x.n === n), t = tracks[n];
      add(`mediums.0.track.${n - 1}.name`, (c && c.title) || t.title);
      add(`mediums.0.track.${n - 1}.length`, String((c && c.length) || t.length));
      add(`mediums.0.track.${n - 1}.artist_credit.names.0.name`, c ? c.artist : t.names.join(' & '));
    }
    document.body.appendChild(f); f.submit();
  }, [CASES, Object.fromEntries(Array.from({ length: 15 }, (_, i) => [i + 1, T(i + 1)])), withRg ? RG : null, ed['artist-credit'][0].artist.id]);
  await page.waitForURL(/\/release\/add/, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 20000 });
  if (!withRg) {   // the Add flow's Duplicates tab first, as an editor would (Apollo scores it)
    await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^\s*Duplicates\s*$/.test(x.textContent)); if (a) a.click(); });
    // every listed duplicate scored = its tracklist fetched (they are fetched one at a time)
    await page.waitForFunction(() => { const c = [...document.querySelectorAll('#duplicates-tab .tc-dup-sim')]; return c.length > 0 && c.every(td => /%|\?|—/.test(td.textContent)); }, null, { timeout: 90000 }).catch(() => log('the Duplicates tab did not finish scoring'));
  }
  await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^\s*Tracklist\s*$/.test(x.textContent)); if (a) a.click(); });
  const btn = '#tc-bar [data-act="match"], #tc-hdr [data-act="match"]';
  await page.waitForSelector(btn, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click(btn);
  await page.waitForFunction(() => { const M = window.__apolloEditor.model; return M && M.tracks.length >= 15 && M.tracks.every(t => t.slots.every(s => !s._pending)); }, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => window.__apolloEditor.model.tracks.map(t => ({ n: t.ti + 1, title: t.title, slots: t.slots.map(s => ({ status: s.status, gid: s.gid, creditedAs: s.creditedAs, committed: !!s.committed, pos: s._pos ? { of: s._pos.of, n: s._pos.artists.length } : null })) })));
}

function judge(label, rows) {
  for (const c of CASES) {
    const r = rows.find(x => x.n === c.n), s = r && r.slots[0], truth = T(c.n);
    if (c.want === 'not-pos') ck(s && s.status !== 'pos', `${label} #${c.n} "${c.artist}" is NOT matched by position — ${c.why} (${s && s.status})`);
    else ck(s && s.status === c.want && s.gid === truth.gids[0] && s.committed, `${label} #${c.n} "${c.artist}" → ${truth.names[0]} as ${c.want} — ${c.why} (${s && s.status}, ${s && s.gid && s.gid.slice(0, 8)})`);
    if (c.want === 'pos' && s) ck(s.creditedAs === c.artist, `${label} #${c.n} keeps the seeded credited name "${c.artist}" (${JSON.stringify(s.creditedAs)})`);
  }
}

// ── A. release group linked ─────────────────────────────────────────────────
const A = await seedAndMatch(true);
log('A:', JSON.stringify(A.filter(r => CASES.some(c => c.n === r.n)).map(r => [r.n, r.slots[0].status, (r.slots[0].gid || '').slice(0, 8)])));
judge('A', A);
// Apollo's; MusicBrainz's own editor also lists the seeded group's releases (inc=…labels+media)
const rgReqs = reqs.filter(u => /release-group=/.test(u) && /inc=recordings\+artist-credits/.test(u));
ck(rgReqs.length === 1, `one release-group request serves the rg source and the position source (${rgReqs.length}: ${rgReqs.join(' , ')})`);
const tip = await page.evaluate(() => (document.querySelector('.tc-badge.pos') || {}).title || '');
ck(/matched by position: .* on \d+ of \d+ other edition/.test(tip), `a pos badge says what it rests on: "${tip}"`);
// the picker leads with the position section
const sec = await page.evaluate(async () => {
  const inp = [...document.querySelectorAll('.tc-search input.nm')].find(i => /Buzzard/i.test(i.value));
  if (!inp) return null;
  inp.focus(); await new Promise(z => setTimeout(z, 900));
  const pop = document.querySelector('.tc-acpop');
  const out = pop ? { head: (pop.querySelector('.tc-acsec') || {}).textContent || '', votes: (pop.querySelector('.tc-acvotes') || {}).textContent || '', first: (pop.querySelector('.tc-acrow .nm') || {}).textContent || '' } : null;
  inp.blur(); return out;
});
log('picker:', JSON.stringify(sec));
ck(sec && sec.head === 'On other editions at this position' && /^\d+ of \d+ editions?$/.test(sec.votes) && /Buzzard/.test(sec.first), `the picker leads with "On other editions at this position", with the edition count (${sec && sec.votes})`);

// ── B. no release group: the duplicates carry it ─────────────────────────────
const B = await seedAndMatch(false);
log('B:', JSON.stringify(B.filter(r => CASES.some(c => c.n === r.n)).map(r => [r.n, r.slots[0].status, (r.slots[0].gid || '').slice(0, 8)])));
for (const n of [1, 3, 5]) { const s = B.find(x => x.n === n).slots[0]; ck(s.status === 'pos' && s.gid === T(n).gids[0], `B #${n} resolves from the duplicates, with no release group linked (${s.status})`); }
// "Machine" is an exact name that more than one sandbox artist may share: with no release
// group, only the position can say which one this is
const m6 = B.find(x => x.n === 6).slots[0];
ck(m6.gid === T(6).gids[0] && m6.committed, `B #6 "Machine" is linked to the edition's Machine (${m6.status}, ${(m6.gid || '').slice(0, 8)})`);
const dupSearches = reqs.filter(u => /release\?query=/.test(u)).length;
ck(dupSearches === 0, `no duplicate search: the tracklists the Duplicates tab fetched for its Similarity column were reused (${dupSearches} search request(s))`);
// the Duplicates view links the seeded artists that matched, and marks the rest
await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => /^\s*Duplicates\s*$/.test(x.textContent)); if (a) a.click(); });
await page.waitForTimeout(800);
const dd = await page.evaluate(async (edition) => {
  const row = [...document.querySelectorAll('#duplicates-tab tr')].find(tr => (tr.querySelector('input[name="base-release"]') || {}).value === edition);
  const cell = row && row.querySelector('.tc-dup-sim'); if (!cell) return null;
  cell.click();
  for (let i = 0; i < 40 && !document.querySelector('#duplicates-tab .tc-dd-tbl'); i++) await new Promise(z => setTimeout(z, 250));
  const rows = [...document.querySelectorAll('#duplicates-tab .tc-dd-tbl tr.tc-dd-row')];
  const seeded = i => rows[i] && rows[i].children[5];
  return {
    t1Link: seeded(0) ? (seeded(0).querySelector('a[href*="/artist/"]') || {}).getAttribute?.('href') || '' : '',
    t7Unres: seeded(6) ? !!seeded(6).querySelector('.tc-dd-unres') : false,
    t7Text: seeded(6) ? seeded(6).textContent : '',
  };
}, EDITION);
log('duplicates view:', JSON.stringify(dd));
ck(dd && dd.t1Link.endsWith('/artist/' + T(1).gids[0]), `the Duplicates view links a matched seeded artist (${dd && dd.t1Link})`);
ck(dd && dd.t7Unres, `…and marks an unmatched one ("${dd && dd.t7Text}")`);

ck(editPosts === 0, `nothing was submitted (${editPosts} edit POSTs aborted)`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
