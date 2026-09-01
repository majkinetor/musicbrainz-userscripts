// #556 (majkinetor) — "tab opened, nothing in tab, returning a bit later it was
// submitting […] there was no qobuz link".
//
// The background-add flow submitted UNCONDITIONALLY. MusicBrainz's release editor
// enables its submit for ANY pending change, so with Apollo's auto search-and-
// replace configured, Apollo's edit made the form dirty and Platform Check pressed
// Enter edit as if the links had gone in — producing edit 152603580 (an S&R edit,
// no link at all), then closing the tab and reloading the opener. The user got an
// edit they hadn't asked for, and every diagnostic died with the closed tab.
//
// Three invariants:
//   1. nothing landed  => the submit is NOT clicked, and the close marker is NOT set;
//   2. something landed => it still submits (the fix must not disable the feature);
//   3. a PARTIAL run keeps the URLs that failed queued, instead of dropping the lot.
//
// Sandbox only. The submit button is stubbed so a click is counted rather than
// performed, and every POST is aborted and asserted on top of that.
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
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// `withhold` reproduces "the editor never gave us an input", which is what a run
// that lands nothing looks like from the inside.
const run = async ({ pending, withhold }) => {
  const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1100 } });
  await ctx.addInitScript(([mbid, pend, hide]) => {
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
    // Count Enter-edit clicks instead of performing them — belt and braces over
    // the aborted POSTs, so a regression here can never reach MusicBrainz.
    window.__submits = 0;
    document.addEventListener('click', ev => {
      const b = ev.target && ev.target.closest && ev.target.closest('#enter-edit, button.submit.positive');
      if (b) { window.__submits++; ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
  }, [REL, pending, !!withhold]);
  const page = ctx.pages()[0] || await ctx.newPage();
  const postUrls = [];
  await page.route(() => true, r => { const q = r.request(); if (q.method() === 'POST') { postUrls.push(q.url()); return r.abort(); } return r.continue(); });
  // #pc-autocommit is what the right-click background add appends
  await page.goto(`https://test.musicbrainz.org/release/${REL}/edit#pc-autocommit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { await ctx.close(); return { notLoggedIn: true }; }
  await page.waitForTimeout(2500);
  // After the editor has mounted, not in an init script — `document.documentElement`
  // is still null at document-start, so observing it there throws and the withhold
  // never installs (which is exactly how this fixture first failed: the link went
  // in and the run "correctly" submitted, hiding the case under test).
  if (withhold) await page.evaluate(() => {
    const RE = /^(?:add (?:another )?link|add another url)$/i;
    const strip = () => document.querySelectorAll('input').forEach(i => {
      if (RE.test((i.placeholder || '').trim())) i.setAttribute('placeholder', 'withheld by the test');
    });
    new MutationObserver(strip).observe(document.documentElement, { childList: true, subtree: true });
    strip();
  });
  await page.addScriptTag({ content: code });
  await page.waitForTimeout(withhold ? 20000 : 26000);
  const out = await page.evaluate((mbid) => ({
    submits: window.__submits,
    closeMarker: (() => { try { return sessionStorage.getItem('pc:autocommit-close'); } catch (e) { return 'ERR'; } })(),
    queued: localStorage.getItem('pc:pending:' + mbid),
    hrefs: [...document.querySelectorAll('tr.external-link-item a[href]')].map(a => a.href),
    banner: (() => { const m = document.body.innerText.match(/Platform Check:[^\n]*/); return m ? m[0] : null; })(),
    con: window.__con.filter(l => /Platform Check/.test(l)),
  }), REL);
  await page.screenshot({ path: resolve(SHOTS, withhold ? 'i556c-nothing.png' : 'i556c-landed.png') }).catch(() => {});
  await ctx.close();
  return { ...out, postUrls };
};

// ── 1. a run that lands nothing must not submit ─────────────────────────────
const none = await run({ pending: { qobuz: 'https://www.qobuz.com/us-en/album/as-oneself-arkta-/uqj72odvp0ofm' }, withhold: true });
if (none.notLoggedIn) { console.log('NOT LOGGED IN — see reference_test_musicbrainz_instance'); process.exit(3); }
console.log('\n── nothing landed ──');
console.log('submits      : ' + none.submits);
console.log('close marker : ' + JSON.stringify(none.closeMarker));
console.log('still queued : ' + none.queued);
console.log('banner       : ' + JSON.stringify(none.banner));
ck(none.hrefs.length === 0, 'fixture: no link row was created (' + none.hrefs.length + ')');
ck(none.submits === 0, `#556: Enter edit was NOT pressed when nothing landed (${none.submits})`);
ck(!none.closeMarker, 'and the tab did not mark itself to auto-close, so the evidence survives — ' + JSON.stringify(none.closeMarker));
ck(!!none.queued, 'and the links are still queued for a retry');
ck(/not submitting/i.test(none.banner || ''), 'the tab says why it stopped — ' + JSON.stringify(none.banner));
ck(none.con.some(l => /NOT submitting/i.test(l)), 'and says it in the console too, for a background tab nobody is looking at');

// ── 2. the fix must not break the feature it guards ─────────────────────────
const some = await run({ pending: { deezer: 'https://www.deezer.com/album/978648191' } });
console.log('\n── one link landed ──');
console.log('rows         : ' + JSON.stringify(some.hrefs));
console.log('submits      : ' + some.submits);
console.log('close marker : ' + JSON.stringify(some.closeMarker));
ck(some.hrefs.some(h => /deezer\.com/.test(h)), 'fixture: the link really did land');
ck(some.submits === 1, `#556: a run that DID add something still auto-submits (${some.submits})`);
ck(some.closeMarker === REL, 'and still marks the tab to close afterwards — ' + JSON.stringify(some.closeMarker));
ck(!some.queued, 'and its payload is consumed, so it is not re-added on the next visit');

// ── 3. a partial run keeps the failures queued ──────────────────────────────
// One resolvable URL and one MusicBrainz refuses to make a row for.
const partial = await run({ pending: {
  deezer: 'https://www.deezer.com/album/978648191',
  broken: 'not-a-url-at-all',
} });
console.log('\n── partial run ──');
console.log('rows         : ' + JSON.stringify(partial.hrefs));
console.log('still queued : ' + partial.queued);
const left = partial.queued ? JSON.parse(partial.queued) : {};
ck(partial.hrefs.some(h => /deezer\.com/.test(h)), 'fixture: the good URL landed');
ck(!left.deezer, '#556: the URL that landed is consumed');
ck(!!left.broken, '#556: the URL that did NOT land stays queued instead of being dropped with it');

const allPosts = [...none.postUrls, ...some.postUrls, ...partial.postUrls];
ck(!allPosts.some(u => /ws\/js\/edit\/create/.test(u)), `no edit was submitted across all three runs (${allPosts.length} POST(s), all aborted)`);
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
