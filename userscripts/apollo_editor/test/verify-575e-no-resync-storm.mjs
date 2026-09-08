// #575 (majkinetor, with a screenshot): "'auto-match off - click match' shows
// while match is running. It switches between 'matched N/M' and it periodicaly."
//
// Only one line in the script writes that message: loadAndRender's else-branch,
// taken when the tracklist auto-match setting is off. Seeing it DURING a manual
// pass means loadAndRender was being re-entered while that pass ran — over and
// over, alternating with the pass's own progress text.
//
// Why: every committed track writes the artist credit back to Knockout,
// MusicBrainz echoes a notification of its own once our guard has dropped (the
// #580 mechanism), and the change-watcher read each echo as an external edit.
// So a running pass scheduled a full reload per matched track — a rebuild storm
// on top of the work, and the flicker he could see was the only visible symptom.
//
// This runs his own import with auto-match OFF (which is the setting that makes
// the symptom legible), presses Match, and counts. Asserted: the status never
// reverts to the idle message while the pass runs, and the load path is not
// re-entered per track.
//
// /ws/2 reads are delayed so the pass lasts long enough to observe.
// Read-only: every POST is aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SRC = process.env.APOLLO_SRC || 'C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js';
const SEED = process.env.SEED_JSON || 'C:/Work/mb-userscripts/userscripts/apollo_editor/test/seed-575-discogs-import.json';
const code = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const fields = JSON.parse(await readFile(SEED, 'utf8')).fields;

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1100 } });
await ctx.addInitScript(() => {
  // autoMatch OFF: the idle message only exists on that branch, and a manual
  // Match is exactly what his screenshot was taken during.
  const store = new Map([['apolloEditor.settings.v1', JSON.stringify({
    apolloEnabled: true, autoMatch: false, autoMatchRec: false, autoMatchLabel: true, autoMatchArtist: true,
    replaceReleaseInfo: true, replaceTracklist: true, replaceRecordings: true, discogsUrlMatch: true,
  })]]);
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_info = { script: { name: 'apollo', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const logs = [];
page.on('console', m => { const t = m.text(); if (/tracklist:|resync/.test(t)) logs.push(t); });

await page.goto('https://musicbrainz.org/release/add', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(f => {
  const form = document.createElement('form');
  form.method = 'POST'; form.action = '/release/add';
  f.forEach(([k, v]) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = k; i.value = v; form.appendChild(i); });
  document.body.appendChild(form); form.submit();
}, fields);
await page.waitForLoadState('domcontentloaded');
await page.waitForSelector('#release-editor', { timeout: 60000 }).catch(() => {});
const posted = [];
await page.route(() => true, async r => {
  const q = r.request();
  if (q.method() === 'POST') { posted.push(q.url()); return r.abort(); }
  if (/musicbrainz\.org\/ws\/2\//.test(q.url())) await new Promise(res => setTimeout(res, 3000));
  return r.fallback();
});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 60000 });
await page.locator('a, button', { hasText: /^Tracklist$/ }).first().click().catch(() => {});
await page.waitForSelector('.tc-search input.nm', { state: 'visible', timeout: 60000 });

const TL = '#tc-bar [data-act="match"], #tc-hdr [data-act="match"]';
/* The idle message is gone entirely now — majkinetor: "lets remove the
   auto-match off - click Match". It wrote into the same spans that carry each
   medium's "N unresolved" badge, so every reload wiped the badge to repeat what
   the Match button already says. What is asserted instead: the badge survives,
   and the message never appears at any point. */
const badgeBefore = await page.evaluate(() => document.body.innerText);
ck(!/auto-match off/.test(badgeBefore), 'the idle "auto-match off — click Match" message is gone');
ck(/unresolved/.test(badgeBefore), 'and the "N unresolved" badge it used to overwrite is there');

/* Count re-entries of the load path by MODEL IDENTITY: loadAndRender starts with
   buildShell(), which returns a brand-new model object, so a changed identity is
   a reload and nothing else is. An earlier version of this counted Apollo log
   lines arriving on the console — Apollo's log does not go to the console, so it
   counted zero always and passed for the wrong reason. */
await page.evaluate(() => {
  window.__reloads = 0;
  window.__lastModel = window.__apolloEditor.model;
  window.__watch = setInterval(() => {
    const m = window.__apolloEditor.model;
    if (m !== window.__lastModel) { window.__reloads++; window.__lastModel = m; }
  }, 60);
});
const countLoads = () => page.evaluate(() => window.__reloads);
const loadsBefore = await countLoads();

await page.click(TL);
const seen = new Set(); let sawIdleDuring = false, loadsDuring = 0;
const t0 = Date.now();
while (Date.now() - t0 < 45000) {
  const st = await page.evaluate(() => {
    const b = document.querySelector('#tc-bar [data-act="match"], #tc-hdr [data-act="match"]');
    const bar = document.querySelector('#tc-bar') || document.body;
    return { running: !!b && /Stop/.test(b.textContent), text: (bar.innerText || '').replace(/\s+/g, ' ') };
  });
  if (!st.running) break;
  if (/auto-match off/.test(st.text) && !sawIdleDuring) {
    sawIdleDuring = true;
    // Say WHERE, so a failure names the element instead of just the page text.
    const where = await page.evaluate(() => {
      const out = [];
      const walk = el => { for (const c of el.children) {
        const own = [...c.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim();
        if (/auto-match off/.test(own)) out.push({ tag: c.tagName, cls: String(c.className).slice(0, 40), vis: c.offsetParent !== null });
        walk(c); } };
      walk(document.body); return out;
    });
    console.log('[verify-575e] idle message found in:', JSON.stringify(where));
  }
  const m = st.text.match(/matching \d+\/\d+/); if (m) seen.add(m[0]);
  loadsDuring = (await countLoads()) - loadsBefore;   // sampled WHILE running: a
  // reload once the pass has ended is legitimate, and counting it afterwards
  // would fail this for the one case it is supposed to allow.
  await page.waitForTimeout(100);   // tight: a fast pass must still be sampled
}

console.log(`[verify-575e] progress messages seen: ${[...seen].join(', ') || 'none'}`);
console.log(`[verify-575e] load-path re-entries during the pass: ${loadsDuring}`);
ck(seen.size > 0, 'fixture: the pass ran long enough to show progress');
ck(!sawIdleDuring, 'the idle "auto-match off — click Match" never comes back while the pass is running');
/* Reported, not asserted. Blocking every reload during a pass was tried and
   reverted: some of those calls exist to mount a pane the user has just switched
   to, and skipping them left the Recordings tab rendering nothing — worse than
   the flicker being fixed here. What matters for his report is that the STATUS
   holds, which is asserted above; a stray reload is logged so a regression that
   turns one into dozens is visible. */
console.log(`[verify-575e] (reloads during the pass: ${loadsDuring} — one is normal, dozens would be the storm)`);
ck(loadsDuring <= 2, `no reload storm during the pass (${loadsDuring} re-entries)`);

/* The deferral re-arms twice a second while a pass runs. Logging each tick
   buried a whole session under itself — "spamming now like crazy" — so it is
   logged once per episode. Read from Apollo's OWN log, not the console: nothing
   here reaches the console, which is how an earlier check in this file managed
   to count zero of everything and pass. */
const deferLines = await page.evaluate(() =>
  (window.__apolloEditor.logMarkdown() || '').split(String.fromCharCode(10)).filter(l => /resync deferred/.test(l)).length);
console.log(`[verify-575e] "resync deferred" log lines: ${deferLines}`);
ck(deferLines <= 4, `the deferral is logged once per episode, not once per tick (${deferLines} lines)`);

ck(!posted.some(u => /\/ws\/js\/edit\/create/.test(u)), `no edit was submitted (${posted.length} POST(s), all aborted)`);
ck(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await ctx.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
