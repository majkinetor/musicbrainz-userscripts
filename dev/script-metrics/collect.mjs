// MusicBrainz script-usage metrics collector.
//
//   npm run collect                 incremental: snapshot date -> now, appended
//   npm run collect -- --full       ignore cursors, re-scan from the cutoff
//   npm run collect -- --since 2026-01-01   override the first-run cutoff
//   npm run collect -- --script apollo_editor   limit to one script
//   npm run collect -- --dump       also save the raw HTML of each page-1 (debug)
//
// HOW IT FINDS EDITS
//   Every script in this repo stamps its MB edit notes with a header like
//     "Apollo Editor v2026.6.22 by majkinetor - https://github.com/.../userscripts/apollo_editor/README.md"
//   so we search MB's edit notes for the substring `userscripts/<slug>`, which is
//   unique per script. (MB field `edit_note_content`, operator `includes`.)
//
// HOW IT STAYS CHEAP
//   The snapshot (script-usage.json) stores every edit we've ever seen, keyed by
//   id, plus the newest open-time per script. A normal run only asks MB for
//   edits in [newest-we-have - overlap, now]; that range is tiny, so it's a
//   couple of page fetches. We then merge (overwrite by id, which also refreshes
//   the status/votes of recently-open edits) and rewrite the snapshot + dashboard.
//
//   MB caps any one edit-search query at 500 results, so when a range is bigger
//   than that (the first backfill, or a very long gap) we recursively split the
//   date window until each chunk is under the cap, then page each chunk. Steady
//   state never hits this.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { SCRIPTS, discriminator } from './scripts.config.mjs';
import { buildDashboard } from './dashboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '.pw-profile');     // shared repo MB session
const DATA = resolve(HERE, 'script-usage.json');
const HTML = resolve(HERE, 'script-usage.html');

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const FULL = flag('full');
const DUMP = flag('dump');
const ONLY = opt('script', null);
// First-run floor. Keyset paging stops on its own at each script's earliest edit
// (a sub-500 batch ends the walk), so this is just a safety floor — the scripts
// only have a couple of months of data anyway. Override with --since / METRICS_CUTOFF.
const monthsAgo = (n) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); };
const CUTOFF = opt('since', process.env.METRICS_CUTOFF || monthsAgo(2));
const OVERLAP_DAYS = Number(opt('overlap', 3));               // re-scan window to refresh recent statuses

// ---- constants ------------------------------------------------------------
const PAGE_SIZE = 50;
const CAP = 500;                                             // MB hard cap per query
const MAX_PAGES_PER_STEP = 4;                               // keep paging offset shallow — deep date-bounded pages time out
const THROTTLE_MS = 1100;                                    // be polite to MB
const NAV_TIMEOUT = 90_000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, '0');
// MB open_time arg format, in UTC (matches how MB displays/stores edit times).
const fmtArg = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

// Keyset query: newest matches with open_time < `before`, ordered desc. MB
// early-terminates after 500 matches scanning back from `before`, so this stays
// fast at any depth — unlike a two-sided BETWEEN, which scans the whole span and
// times out. We page these (≤10 pages = 500), then move `before` to the oldest
// edit we got and repeat.
function searchURL({ arg, before, page = 1, order = 'desc' }) {
  const p = new URLSearchParams();
  p.set('auto_edit_filter', '');
  p.set('order', order);
  p.set('negation', '0');
  p.set('combinator', 'and');
  p.set('conditions.0.field', 'edit_note_content');
  p.set('conditions.0.operator', 'includes');
  p.set('conditions.0.args.0', arg);
  if (before) {
    p.set('conditions.1.field', 'open_time');
    p.set('conditions.1.operator', '<');
    p.set('conditions.1.args.0', fmtArg(before));
  }
  if (page > 1) p.set('page', String(page));
  return 'https://musicbrainz.org/search/edits?' + p.toString();
}

// ---- the per-page DOM parser (runs in the browser) ------------------------
// Returns { loggedOut, found, count, capped, edits: [...] } for one results page.
function parsePage(slug) {
  const txt = document.body.innerText;
  const loggedOut = !document.querySelector('a[href^="/user/"]') && !!document.querySelector('a[href="/login"]');
  const fm = txt.match(/Found (about |at least )?([\d,]+) edits?/i);
  const capped = !!(fm && (fm[1] || '').trim() === 'at least');
  const count = fm ? Number(fm[2].replace(/,/g, '')) : 0;

  const STATUS = ['open', 'applied', 'failedvote', 'faileddep', 'failedprereq', 'error', 'deleted', 'cancelled', 'tobedeleted', 'evalnochange'];
  const toISO = (s) => {
    // "2026-06-22 19:39 UTC" -> ISO
    const m = (s || '').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*UTC/);
    if (!m) return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}.000Z`;
  };

  const edits = [];
  for (const el of document.querySelectorAll('div.edit-list')) {
    const a = el.querySelector('h2 a[href^="/edit/"]');
    if (!a) continue;
    const id = (a.getAttribute('href').match(/\/edit\/(\d+)/) || [])[1];
    if (!id) continue;
    const head = a.textContent.trim();                       // "Edit #123 - Add release annotation"
    const type = (head.split(' - ').slice(1).join(' - ') || '').trim() || 'Unknown';

    const header = el.querySelector('.edit-header');
    const cls = header ? ' ' + header.className + ' ' : '';
    const status = STATUS.find(s => cls.includes(' ' + s + ' ') || new RegExp('\\b' + s + '\\b').test(cls)) || 'unknown';

    const sub = el.querySelector('p.subheader a[href^="/user/"]');
    const editor = sub ? decodeURIComponent((sub.getAttribute('href').match(/\/user\/(.+)$/) || [])[1] || '') : null;

    // date + script version: prefer the note that carries this script's URL
    let dateISO = null, version = null;
    for (const n of el.querySelectorAll('.edit-notes .edit-note')) {
      const nt = (n.querySelector('.edit-note-text') || {}).textContent || '';
      // MB truncates the URL *text* ("…musicbrainz-usersc…"), so match on the
      // link href (full URL) as well as the visible text.
      const ours = nt.includes('userscripts/' + slug) || !!n.querySelector('a[href*="userscripts/' + slug + '"]');
      if (ours) {
        const d = n.querySelector('.owner a.date');
        if (d && !dateISO) dateISO = toISO(d.textContent);
        const vm = nt.match(/v(\d{4}\.\d+(?:\.\d+)*)/);       // version stamp e.g. v2026.6.22
        if (vm && !version) version = vm[1];
      }
    }
    if (!dateISO) {
      const exp = (el.querySelector('.edit-expiration') || {}).textContent || '';
      dateISO = toISO(exp);
    }
    if (!dateISO) {
      const anyDate = el.querySelector('.edit-notes a.date, a.date');
      if (anyDate) dateISO = toISO(anyDate.textContent);
    }

    // votes ("ups/downs") when present; auto-applied edits have none
    const voteTxt = (el.querySelector('.vote-count') || {}).textContent || '';
    const yes = (voteTxt.match(/yes[^\d]*(\d+)/i) || [])[1];
    const no = (voteTxt.match(/\bno[^\d]*(\d+)/i) || [])[1];

    edits.push({ id, type, status, editor, date: dateISO, version: version || null, yes: yes != null ? Number(yes) : null, no: no != null ? Number(no) : null });
  }
  return { loggedOut, found: fm ? fm[0] : null, count, capped, edits };
}

// ---- collection engine ----------------------------------------------------
let page, dumpSeq = 0;

async function fetchPageData(arg, slug, { before, page: pg = 1 }) {
  const url = searchURL({ arg, before, page: pg });
  // MB occasionally resets the connection on long scrapes — retry with backoff.
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      await page.waitForTimeout(900);
      if (DUMP && pg === 1) await writeFile(resolve(HERE, `_dump-${slug}-${++dumpSeq}.html`), await page.content());
      const data = await page.evaluate(parsePage, slug);
      await sleep(THROTTLE_MS);
      return data;
    } catch (e) {
      lastErr = e;
      const wait = 2000 * attempt;
      console.warn(`  …retry ${attempt}/5 after ${e.message.split('\n')[0]} (waiting ${wait}ms)`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

// One keyset step: the newest edits with open_time < `before`, a few shallow
// pages only. Returns { edits, oldest:Date|null, full } where full=true means
// there may be more further back (cursor should advance). If a deep page fails
// (MB kills heavy offsets), we stop at the last good page and report full=true —
// the cursor advances and that page is re-fetched as page 1 (offset 0) next step.
async function fetchBatch(arg, slug, before, stats) {
  const edits = [];
  let full = false;
  for (let pg = 1; pg <= MAX_PAGES_PER_STEP; pg++) {
    let d;
    try {
      d = await fetchPageData(arg, slug, { before, page: pg });
    } catch (e) {
      if (pg === 1) throw e;                       // page 1 (offset 0) failing is a real problem
      full = true;                                 // deep page died — advance cursor, retry it as page 1
      break;
    }
    if (d.loggedOut) throw new Error('NOT_LOGGED_IN');
    stats.queries++;
    if (!d.edits.length) break;
    edits.push(...d.edits);
    if (d.edits.length < PAGE_SIZE) break;         // last page overall
    if (pg === MAX_PAGES_PER_STEP) full = true;    // hit our shallow cap — more may exist
  }
  let oldest = null;
  for (const e of edits) if (e.date) { const t = new Date(e.date); if (!oldest || t < oldest) oldest = t; }
  return { edits, oldest, full };
}

// Walk backwards from `upper` to `lowerBound` via keyset paging.
async function keysetCollect(arg, slug, upper, lowerBound, sink, stats, checkpoint) {
  let before = upper;
  let prevOldest = null, steps = 0;
  while (true) {
    const { edits, oldest, full } = await fetchBatch(arg, slug, before, stats);
    for (const e of edits) sink(e);
    if (checkpoint && ++steps % 15 === 0) await checkpoint();
    if (!edits.length || !oldest) break;
    if (oldest <= lowerBound) break;              // reached snapshot/cutoff boundary
    if (!full) break;                             // short step → reached the earliest matches
    const key = fmtArg(oldest);
    if (prevOldest === key) {
      // >500 edits share the same second — keyset can't page within it; step past
      before = oldest;                            // strict (<), drops that second's remainder
      stats.truncated.push(oldest.toISOString());
      prevOldest = null;
    } else {
      // +1s overlap so we never miss the boundary second; dedup by id handles repeats
      before = new Date(oldest.getTime() + 1000);
      prevOldest = key;
    }
  }
}

// ---- snapshot I/O ---------------------------------------------------------
async function loadSnapshot() {
  try {
    const j = JSON.parse(await readFile(DATA, 'utf8'));
    if (j && j.edits) return j;
  } catch { /* fresh */ }
  return { schemaVersion: 1, generatedAt: null, cutoff: CUTOFF, scripts: {}, edits: {} };
}

// ---- main -----------------------------------------------------------------
async function main() {
  const snap = await loadSnapshot();
  const now = new Date();
  const scripts = SCRIPTS.filter(s => !ONLY || s.slug === ONLY);

  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1400, height: 1000 } });
  page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT);

  try {
    for (const sc of scripts) {
      const arg = discriminator(sc.slug);
      const prev = snap.scripts[sc.slug] || {};
      const lowerBound = (FULL || !prev.lastDate)
        ? new Date(CUTOFF + 'T00:00:00Z')
        : new Date(new Date(prev.lastDate).getTime() - OVERLAP_DAYS * 86400e3); // overlap refreshes recent statuses
      const upper = new Date(now.getTime() + 36 * 3600e3);   // pad future for tz/clock skew

      const stats = { queries: 0, truncated: [] };
      let n = 0;
      const sink = (e) => {
        if (!e.id) return;
        snap.edits[`${sc.slug}#${e.id}`] = { script: sc.slug, ...e };
        n++;
      };

      process.stdout.write(`• ${sc.name.padEnd(16)} ${FULL || !prev.lastDate ? 'backfill from ' + CUTOFF : 'since ' + prev.lastDate.slice(0, 10)} … `);
      const checkpoint = async () => { snap.generatedAt = new Date().toISOString(); await writeFile(DATA, JSON.stringify(snap, null, 2)); };
      await keysetCollect(arg, sc.slug, upper, lowerBound, sink, stats, checkpoint);

      // recompute the true newest from the merged store (robust to overlap)
      let latest = null, count = 0;
      for (const k in snap.edits) if (snap.edits[k].script === sc.slug) { count++; const d = snap.edits[k].date; if (d && (!latest || d > latest)) latest = d; }
      snap.scripts[sc.slug] = { name: sc.name, slug: sc.slug, note: sc.note || null, total: count, lastDate: latest, lastRun: now.toISOString(), truncated: stats.truncated };
      console.log(`+${n} seen, ${count} total (${stats.queries} queries)${stats.truncated.length ? '  ⚠ ' + stats.truncated.length + ' truncated window(s)' : ''}`);
      // checkpoint after each script so a long first backfill can't lose finished work
      snap.generatedAt = now.toISOString();
      await writeFile(DATA, JSON.stringify(snap, null, 2));
    }
  } catch (e) {
    if (e.message === 'NOT_LOGGED_IN') {
      console.error('\n✖ Not logged in to MusicBrainz. Run:  npm run login\n');
      await ctx.close();
      process.exit(2);
    }
    throw e;
  }

  snap.generatedAt = now.toISOString();
  snap.cutoff = CUTOFF;
  await mkdir(HERE, { recursive: true });
  await writeFile(DATA, JSON.stringify(snap, null, 2));
  const html = buildDashboard(snap);
  await writeFile(HTML, html);
  await ctx.close();

  const total = Object.keys(snap.edits).length;
  console.log(`\n✔ ${total} edits in snapshot → ${DATA.replace(HERE, '.')}`);
  console.log(`✔ dashboard → ${HTML.replace(HERE, '.')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
