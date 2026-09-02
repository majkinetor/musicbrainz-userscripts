// #556 (majkinetor) — the console log the new diagnostics finally produced:
//
//   [Platform Check] inject: 0/1 link(s) landed on pc:pending:3a6f951e-…
//   [Platform Check] inject FAILED: https://www.beatport.com/release/… —
//       no "Add another link" input ever appeared
//   [Platform Check] background add: nothing landed — NOT submitting.
//
// The guards added earlier behaved correctly (no bogus submit, queue kept) and
// named the failing step. The cause is plain once you time it: the 10s budget for
// the "Add another link" input was simply too short. That fieldset is part of the
// release editor's own async boot, and his page had a lot to get through first —
// Apollo's log has the editor still loading tracks 6s in, a /ws/2 request timing
// out outright, and String Theory running seven scripts on one main thread next to
// two other userscripts.
//
// NOT the cause, though it looked like one: the "External links" tab lookup.
// Measured live — there is no such tab on the release editor at all. Its steps are
// Release information / Tracklist / Recordings / Edit note, and External links is a
// <legend> inside the first. That lookup has always matched nothing; the input was
// reachable only because its step is the default. Fixing it would have proved
// nothing, so the fixture below withholds the INPUT instead, past the old budget.
//
// Sandbox only; every POST aborted and asserted.
import { createRequire } from 'node:module';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const SHOTS = resolve(HERE, 'logs'); await mkdir(SHOTS, { recursive: true });

const REL = process.env.PC_RELEASE || '3a37a35f-1e06-457f-9b2a-46155c5c03ce';
const PENDING = { deezer: 'https://www.deezer.com/album/978648191' };
// Longer than the old 10s budget, shorter than the new 25s one — so the same
// fixture must fail on the shipped build and pass on this one.
const HIDE_MS = 14000;
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const run = async (source, hideMs) => {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1100 } });
  await ctx.addInitScript(([mbid, pend]) => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_info = { script: { name: 'Platform Check', version: 't' } };
    try { localStorage.setItem('pc:pending:' + mbid, JSON.stringify(pend)); } catch (e) {}
    window.__con = [];
    for (const m of ['info', 'warn', 'error']) {
      const real = console[m].bind(console);
      console[m] = (...a) => { try { window.__con.push(a.map(String).join(' ')); } catch (e) {} return real(...a); };
    }
    window.__submits = 0;
    document.addEventListener('click', ev => {
      const b = ev.target && ev.target.closest && ev.target.closest('#enter-edit, button.submit.positive');
      if (b) { window.__submits++; ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
  }, [REL, PENDING]);
  const page = ctx.pages()[0] || await ctx.newPage();
  const postUrls = [];
  await page.route(() => true, r => { const q = r.request(); if (q.method() === 'POST') { postUrls.push(q.url()); return r.abort(); } return r.continue(); });
  await page.goto(`https://test.musicbrainz.org/release/${REL}/edit#pc-autocommit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { await ctx.close(); return { notLoggedIn: true }; }
  await page.waitForTimeout(2000);

  // Simulate the slow boot: the add-link input is not discoverable for the first
  // `hideMs` (its placeholder is masked, which is exactly what findAddLinkInput
  // keys on), then it comes back as MusicBrainz rendered it.
  const hidden = await page.evaluate((ms) => {
    const RE = /^(?:add (?:another )?link|add another url)$/i;
    const stash = [];
    const hide = () => {
      for (const el of document.querySelectorAll('input')) {
        const t = (el.placeholder || '').trim();
        if (RE.test(t) && !el.__pcStashed) {
          el.__pcStashed = true;
          stash.push([el, t]);
          el.setAttribute('placeholder', 'still loading…');
        }
      }
    };
    const obs = new MutationObserver(hide);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    hide();
    setTimeout(() => {
      obs.disconnect();
      for (const [el, t] of stash) el.setAttribute('placeholder', t);
    }, ms);
    return stash.length;
  }, hideMs);

  await page.addScriptTag({ content: source });
  await page.waitForTimeout(hideMs + 22000);
  const out = await page.evaluate((mbid) => ({
    hrefs: [...document.querySelectorAll('tr.external-link-item a[href]')].map(a => a.href),
    submits: window.__submits,
    queued: localStorage.getItem('pc:pending:' + mbid),
    con: window.__con.filter(l => /Platform Check/.test(l)),
  }), REL);
  await ctx.close();
  return { ...out, hidden, postUrls };
};

console.log(`fixture: the "External links" tab is withheld for ${HIDE_MS}ms, then rendered\n`);
const now = await run(code, HIDE_MS);
if (now.notLoggedIn) { console.log('NOT LOGGED IN — see reference_test_musicbrainz_instance'); process.exit(3); }
console.log('inputs withheld : ' + now.hidden);
console.log('rows                : ' + JSON.stringify(now.hrefs));
console.log('console             : ' + JSON.stringify(now.con, null, 1));
ck(now.hidden > 0, 'fixture: the add-link input really was withheld (' + now.hidden + ' input(s))');
ck(now.hrefs.some(h => /deezer\.com/.test(h)), '#556: the link lands despite a slow editor boot');
ck(now.con.some(l => /inject: 1\/1 link\(s\) landed/.test(l)), 'and the run reports success — ' + JSON.stringify(now.con.find(l => /inject:/.test(l)) || null));
ck(!now.con.some(l => /ever appeared/.test(l)), 'and never reports the "input ever appeared" failure');
ck(!now.postUrls.some(u => /ws\/js\/edit\/create/.test(u)), `no edit was submitted (${now.postUrls.length} POST(s), all aborted)`);

// ── A/B against the shipped build ───────────────────────────────────────────
const PREV = process.env.PC_PREV;
if (PREV) {
  const prev = await readFile(PREV, 'utf8');
  const before = await run(prev, HIDE_MS);
  console.log('\n########## PREVIOUS BUILD ##########');
  console.log('rows    : ' + JSON.stringify(before.hrefs));
  console.log('console : ' + JSON.stringify(before.con, null, 1));
  ck(!before.hrefs.some(h => /deezer\.com/.test(h)), 'the fixture reproduces on the shipped build (nothing landed there)');
  ck(before.con.some(l => /input ever appeared/.test(l)), 'and fails for the reason claimed — ' + JSON.stringify(before.con.find(l => /FAILED/.test(l)) || null));
  ck(before.submits === 0 && !!before.queued, 'though it still refused to submit and kept the queue — the earlier guards holding');
} else {
  console.log('\n(set PC_PREV=<path to previous platform_check.user.js> for the A/B)');
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
