// #591 (majkinetor): "Picard is used to add disk id - there is no web option…
// We should show each media as drop target above current disk ids if they
// exist - you click on it to select a file or drop a file to it and you are
// done." — and: "Check out the Picard code on how it formats query params and
// what kind of logs it processes."
//
// The check that decides whether any of this is worth anything is the first
// one: majkinetor's OWN log file from the issue must produce the exact disc ID
// and TOC that Picard produced from it —
//
//   id   UHvvp8Oyi0D5QEK.qYfeX7GrcLw-
//   toc  1+13+279873+150+19836+…+265363
//
// Anything less is a plausible-looking string that would attach a wrong disc ID
// to somebody's release, which is an edit another editor has to undo.
//
// Everything is served from fixtures: the release page, the /ws/2 media lookup
// and the attach page. Nothing is fetched from MusicBrainz and nothing is
// submitted — the attach route only records the URL Falcon would have opened.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// majkinetor's own attachment, committed next to the test so this does not
// depend on GitHub being reachable on a later run.
// ⚠ test/fixtures/, NOT test/logs/ — the latter is gitignored, so a fixture put
// there works on this machine and silently turns into a network fetch for
// everybody else, in a test whose whole claim is that it touches no network.
const LOG_DIR = resolve(HERE, 'fixtures');
const REAL_LOG = resolve(LOG_DIR, 'The.Deadbeats.-.Made.In.The.Shade.log');
const EXPECT_ID = 'UHvvp8Oyi0D5QEK.qYfeX7GrcLw-';
const EXPECT_TOC = '1+13+279873+150+19836+37901+60766+81178+104637+132997+161041+177507+196805+218380+240602+265363';
let realBytes;
try {
  realBytes = await readFile(REAL_LOG);
} catch (e) {
  console.log('fetching the log from the issue (first run)…');
  const r = await fetch('https://github.com/user-attachments/files/32192726/The.Deadbeats.-.Made.In.The.Shade.log');
  realBytes = Buffer.from(await r.arrayBuffer());
  await mkdir(LOG_DIR, { recursive: true });
  await writeFile(REAL_LOG, realBytes);
}
// it is a UTF-16LE file, and that is half of what this test is about
ck(realBytes[0] === 0xFF && realBytes[1] === 0xFE,
  'fixture: the real EAC log is UTF-16LE with a BOM (read as UTF-8 it parses as nothing at all)');

const MBID = '9b3fe0b2-d286-437c-b13c-2943f90780b4';
const DISCIDS = `https://musicbrainz.org/release/${MBID}/discids`;
/* The release page, cut down to what the UI reads: #content, the "Disc IDs"
   heading it inserts itself above, and — in the two-medium fixture — the
   Remove/Move links that are the only place a medium's internal row id appears. */
const pageWith = (extra = '') => `<!doctype html><html><head><meta charset="utf-8"><title>Disc IDs</title></head><body>
  <div id="content"><h1>Made in the Shade</h1><h2>Disc IDs</h2>${extra}</div></body></html>`;
const WITH_IDS = pageWith(`<table><tr><th colspan="4">CD 1</th></tr>
  <tr><td>UHvvp8Oyi0D5QEK.qYfeX7GrcLw-</td><td>13</td><td>1:02:12</td>
  <td><a href="/cdtoc/UHvvp8Oyi0D5QEK.qYfeX7GrcLw-/set-durations?medium=3374577">Set track lengths</a>
      <a href="/cdtoc/remove?medium_id=3374577&amp;cdtoc_id=1228659">Remove</a></td></tr></table>`);

const MEDIA_ONE = { media: [{ position: 1, format: 'CD', 'track-count': 13 }] };
const MEDIA_TWO = { media: [{ position: 1, format: 'CD', 'track-count': 13 }, { position: 2, format: 'DVD-Video', 'track-count': 4 }] };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1300, height: 950 } });
const STATE = { page: pageWith(), media: MEDIA_ONE };
const attachHits = [];
// ⚠ Narrow routes only. A catch-all is what made production MusicBrainz load as
// a chrome-error page in an earlier session.
await ctx.route(/^https:\/\/musicbrainz\.org\/ws\/2\/release\//, r =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STATE.media) }));
await ctx.route(/^https:\/\/musicbrainz\.org\/cdtoc\/attach/, r => {
  attachHits.push(r.request().url());
  return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><body><div id="content">attach</div></body>' });
});
await ctx.route(/^https:\/\/musicbrainz\.org\/release\//, r =>
  r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: STATE.page }));

const open = async () => {
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('PAGEERROR ' + e.message); fail++; });
  await page.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    window.GM_xmlhttpRequest = () => {};
    window.__opened = [];
    window.GM_openInTab = u => { window.__opened.push(u); return { close() {}, closed: false }; };
    window.open = u => { window.__opened.push(u); return { closed: false }; };
  });
  page.on('load', () => { page.addScriptTag({ content: code }).catch(() => {}); });
  await page.goto(DISCIDS, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 15000 });
  return page;
};
// hand a real File to the page, byte for byte
const asFile = (page, bytes, name) => page.evaluate(([b, n]) => {
  window.__file = new File([new Uint8Array(b)], n, { type: 'text/plain' });
  return window.__file.size;
}, [Array.from(bytes), name]);

const page = await open();
const have = await page.evaluate(() => typeof window.__falconTest.discIdFromLog === 'function');
ck(have, 'this build can read a CD rip log');
if (!have) { console.log('no rip-log support on this build — nothing further is measurable'); await ctx.close(); console.log(`\n${fail + 1} FAILED`); process.exit(1); }

/* ── 1. THE check: majkinetor's log, against Picard's own answer ───────────── */
await asFile(page, realBytes, 'The.Deadbeats.-.Made.In.The.Shade.log');
const real = await page.evaluate(() => window.__falconTest.discIdFromLog(window.__file));
console.log('\nreal log →', JSON.stringify({ id: real.id, tracks: real.tracks, format: real.format, encoding: real.encoding }));
console.log('       toc', real.tocString);
ck(real.id === EXPECT_ID, `the disc ID matches the one Picard produced — ${real.id}`);
ck(real.tocString === EXPECT_TOC, `and so does every TOC offset — ${real.tocString === EXPECT_TOC ? 'exact' : real.tocString}`);
ck(real.tracks === 13, `13 tracks (${real.tracks})`);
ck(/UTF-16LE/.test(real.encoding), `the UTF-16 encoding was detected rather than mangled (${real.encoding})`);
ck(/EAC/.test(real.format), `recognised as an EAC-family log (${real.format})`);

/* ── 2. the same TOC from every other rip program ──────────────────────────
   Each of these is the same disc expressed the way that program writes it, so
   all four must land on the identical disc ID. That is a much stronger check
   than "it parsed": a parser that is off by one sector still parses. */
const TRACKS = [[0, 19685], [19686, 37750], [37751, 60615], [60616, 81027], [81028, 104486],
  [104487, 132846], [132847, 160890], [160891, 177356], [177357, 196654], [196655, 218229],
  [218230, 240451], [240452, 265212], [265213, 279722]];
const eac = ['     Track |   Start  |  Length  | Start sector | End sector ', '    ---------------------------------------------------------']
  .concat(TRACKS.map(([s, e], i) => `        ${i + 1}  |  0:00.00 |  4:22.60 |         ${s}    |    ${e}   `)).join('\r\n');
const dbpa = TRACKS.map(([s, e], i) => `Track ${i + 1}:  Ripped LBA ${s} to ${e + 1} (length 1234) in 3:21.`).join('\n');
const cyan = ['cyanrip 0.9.0 (git)', 'Disc title: x']
  .concat(TRACKS.flatMap(([s, e], i) => [`Track ${i + 1} ripped`, `    Start LSN: ${s}`, `    End LSN:   ${e}`])).join('\n');
const whipper = ['Logfile created by: whipper 0.10.0', 'TOC:']
  .concat(TRACKS.flatMap(([s, e], i) => [`  ${i + 1}:`, `    Start sector: ${s}`, `    End sector: ${e}`]))
  .concat(['Tracks:', '  1:', '    Filename: x.flac']).join('\n');

for (const [name, text] of [['EAC table', eac], ['dBpoweramp', dbpa], ['cyanrip', cyan], ['whipper', whipper]]) {
  await asFile(page, Buffer.from(text, 'utf8'), name.replace(/\W/g, '') + '.log');
  const r = await page.evaluate(() => window.__falconTest.discIdFromLog(window.__file).catch(e => ({ err: e.message })));
  console.log(`${name.padEnd(12)} → ${r.err ? 'ERROR ' + r.err : r.id + '  (' + r.format + ')'}`);
  ck(!r.err && r.id === EXPECT_ID, `${name}: the same disc gives the same disc ID`);
  ck(!r.err && r.tocString === EXPECT_TOC, `${name}: and the same TOC`);
}

/* ── 3. Picard's refusals, kept ────────────────────────────────────────────
   These are the cases where a disc ID would be WRONG rather than missing, and
   Picard raises on all of them. */
const bad = [
  ['a partial dBpoweramp rip', 'Track 1:  Ripped LBA 0 to 100\nTrack 3:  Ripped LBA 200 to 300\n', /partial rip/i],
  ['an unrecognised file', 'hello, this is not a rip log at all\njust some text\n', /not a CD rip log/i],
  ['an empty file', '', /not a CD rip log/i],
];
for (const [name, text, re] of bad) {
  await asFile(page, Buffer.from(text, 'utf8'), 'bad.log');
  const r = await page.evaluate(() => window.__falconTest.discIdFromLog(window.__file).then(v => ({ id: v.id }), e => ({ err: e.message })));
  ck(!!r.err && re.test(r.err), `${name} is refused — "${(r.err || 'NO ERROR, got ' + r.id).slice(0, 80)}"`);
}
// a trailing data track is dropped, exactly as Picard does (gap of 11401)
const withData = eac + '\r\n' + `        14  |  0:00.00 |  1:00.00 |         ${279723 + 11400}    |    ${279723 + 11400 + 5000}   `;
await asFile(page, Buffer.from(withData, 'utf8'), 'data.log');
const dt = await page.evaluate(() => window.__falconTest.discIdFromLog(window.__file));
console.log('\nwith a trailing data track →', dt.id, '· dropped:', dt.toc.dataTrackDropped);
ck(dt.toc.dataTrackDropped === true, 'a trailing data track is recognised by its 11401-sector gap');
ck(dt.id === EXPECT_ID, 'and dropped, so the disc ID is the audio disc\'s — the same one again');

/* ── 4. the drop zones ─────────────────────────────────────────────────────── */
const zones = await page.evaluate(() => [...document.querySelectorAll('#falcon-discid-zones .fd-zone')]
  .map(z => ({ pos: z.dataset.position, tracks: z.dataset.tracks, mediumId: z.dataset.mediumId || null, off: z.classList.contains('off'), text: z.textContent.replace(/\s+/g, ' ').trim() })));
console.log('\nzones:', JSON.stringify(zones, null, 1));
ck(zones.length === 1 && zones[0].pos === '1', `one medium, one zone (${zones.length})`);
ck(zones[0].tracks === '13', 'the zone knows how many tracks the medium has');
ck(zones[0].mediumId === null, 'and has no medium id, because this page shows no disc IDs to scrape one from');
ck(/drop a rip log/i.test(zones[0].text), `it says what to do — "${zones[0].text}"`);
ck(await page.evaluate(() => !!document.querySelector('#falcon-discid-box a[href="/doc/How_to_Add_Disc_IDs"]')),
  "and still points at MusicBrainz's own instructions, since Picard is still the answer for some discs");

// a non-CD medium cannot have disc IDs and must say so rather than fail later
STATE.media = MEDIA_TWO;
const page2 = await open();
const zones2 = await page2.evaluate(() => [...document.querySelectorAll('#falcon-discid-zones .fd-zone')]
  .map(z => ({ pos: z.dataset.position, off: z.classList.contains('off'), text: z.textContent.replace(/\s+/g, ' ').trim() })));
console.log('two mediums:', JSON.stringify(zones2, null, 1));
ck(zones2.length === 2, `a zone per medium (${zones2.length})`);
ck(zones2[0].off === false && zones2[1].off === true, 'the CD is droppable, the DVD-Video is not');
ck(/cannot have disc IDs/i.test(zones2[1].text), `and says why — "${zones2[1].text}"`);
const fmtCheck = await page2.evaluate(() => {
  const f = window.__falconTest.mediumMayHaveDiscIds;
  return { yes: ['CD', 'CD-R', 'Enhanced CD', 'HDCD', '8cm CD', 'Copy Control CD', 'Data CD', ''].filter(f).length,
    no: ['DVD-Video', 'Vinyl', '12" Vinyl', 'Cassette', 'Digital Media', 'Blu-ray', 'SACD'].filter(f).length };
});
console.log('format gate:', JSON.stringify(fmtCheck));
ck(fmtCheck.yes === 8, `every CD-family format (and an unknown one) is allowed (${fmtCheck.yes}/8)`);
ck(fmtCheck.no === 0, `and no format that cannot carry a disc ID is (${fmtCheck.no} wrongly allowed)`);

/* ── 5. where a drop actually sends you ────────────────────────────────────── */
// (a) medium id unknown → MusicBrainz's own picker, filtered to this release
attachHits.length = 0;
await page2.evaluate(() => {
  const r = { id: 'ID', tocString: '1+2+3', tracks: 2 };
  window.__falconTest.goAttach(r, '9b3fe0b2-d286-437c-b13c-2943f90780b4', 1, undefined);
});
await page2.waitForTimeout(900);
console.log('\nattach url (no medium id):', attachHits[0]);
ck(attachHits.length === 1, 'the drop navigates to the attach page');
const u1 = new URL(attachHits[0] || 'https://x/');
ck(u1.searchParams.get('toc') === '1+2+3', `carrying the toc (${u1.searchParams.get('toc')})`);
ck(u1.searchParams.get('filter-release.query') === MBID, "filtered to this release, so no MBID has to be typed in");
ck(u1.searchParams.get('falcon-medium') === '1', 'and remembering which medium the drop was aimed at');

// (b) medium id known → straight to the confirmation, skipping the picker
STATE.page = WITH_IDS;
const page3 = await open();
const scraped = await page3.evaluate(() => window.__falconTest.scrapeMediumIds());
console.log('scraped medium ids:', JSON.stringify(scraped));
ck(scraped['1'] === 3374577, `the medium's internal id is read off the page's own Remove/Move links (${JSON.stringify(scraped)})`);
attachHits.length = 0;
await page3.evaluate(() => window.__falconTest.goAttach({ id: 'ID', tocString: '1+2+3', tracks: 2 }, '9b3fe0b2-d286-437c-b13c-2943f90780b4', 1, '3374577'));
await page3.waitForTimeout(900);
console.log('attach url (medium id known):', attachHits[0]);
const u2 = new URL(attachHits[0] || 'https://x/');
ck(u2.searchParams.get('medium') === '3374577', 'it goes straight to that medium — MusicBrainz renders the confirmation, not the picker');
ck(!u2.searchParams.has('filter-release.query'), 'and skips the release filter entirely');

/* ── 6. nothing was submitted ──────────────────────────────────────────────── */
for (const [n, p] of [['1', page], ['2', page2], ['3', page3]]) {
  ck(await p.evaluate(() => window.__opened.length) === 0, `page ${n}: no tab was opened and no edit submitted`);
}
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
