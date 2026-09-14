// #590 (chaban-mb): "Harmony release actions page is often missing recording,
// artist, label links when an error occurs. However Falcon ignores this in
// 'Auto send' mode leading to incomplete entries."
//
// Everything here runs against FIXTURES served by Playwright at Harmony's own
// origin — no request ever leaves for harmony.pulsewidth.org.uk or MusicBrainz.
// That is not laziness: an errored page cannot be summoned on demand (it needs
// MusicBrainz to be busy at that moment), so the only way to test all three
// failure shapes is to build them from Harmony's own markup.
//
// Which makes the FIRST check the one that matters — the fixtures are read off
// Harmony's source at test time, so if Harmony ever changes the markup this
// detector reads, this file fails rather than the detector silently going blind.
// (Same trick the #585 fixture uses against MusicBrainz's cleanup report.)
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.FALCON_SRC || resolve(HERE, '..', 'falcon.user.js'), 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

/* ── 1. the markup contract, against Harmony's live source ──────────────────
   If any of these stops holding, the fixtures below are fiction. */
const SRC = 'https://raw.githubusercontent.com/kellnerd/harmony/main/server/';
let srcOk = true;
try {
  const [msgBox, link, actions] = await Promise.all(
    ['components/MessageBox.tsx', 'components/LinkWithMusicBrainz.tsx', 'routes/release/actions.tsx']
      .map(p => fetch(SRC + p).then(r => r.text())));
  ck(/class=\{\['message', message\.type\]\.join\(' '\)\}/.test(msgBox),
    "Harmony still renders every message as class=\"message <type>\" — the whole trigger rests on this");
  ck(/class='provider'/.test(msgBox) && /error instanceof ProviderError \? error\.providerName : undefined/.test(msgBox),
    'a <span class="provider"> is still rendered for, and only for, a ProviderError (shape C)');
  ck(/Already existing \$\{entityType\} links on MusicBrainz could not be checked/.test(link),
    "Harmony still marks a missing entity cache with the exact string the classifier matches (shape B)");
  ck(/const existingLinksNotChecked = !entityCache\?\.length/.test(link),
    '…and still derives it from an empty cache, which is why the label case is a false positive');
  ck(/class='release-title'/.test(actions), 'the merged release is still announced by <h2 class="release-title"> (the A/not-A test)');
  ck(/\{!release && \(/.test(actions) && /errors\.map\(\(error, index\) => <ErrorMessageBox/.test(actions),
    'a failed lookup still falls through to the bare MBID form with the error boxes above it');
  // and the shape-B false positive is still real, i.e. worth the comment in the source
  ck(/Labels often have no external links which could be linked, save pointless API call/.test(actions),
    'Harmony still SKIPS the label browse deliberately, so a label "could not be checked" warning means nothing');
} catch (e) {
  srcOk = false;
  console.log('could not reach Harmony\'s source (' + e.message + ') — the contract checks are skipped, the rest still runs');
}

/* ── the fixtures ──────────────────────────────────────────────────────────── */
const MBID = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';
const REC = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
const seed = (type, mbid, url) => `https://musicbrainz.org/${type}/${mbid}/edit`
  + `?edit-${type}.url.0.text=${encodeURIComponent(url)}&edit-${type}.url.0.link_type_id=268`
  + `&edit-${type}.edit_note=${encodeURIComponent('Matched with Harmony')}`;
const action = (type, mbid, url, name) => `
  <div class="action"><svg></svg><div><p>
    <a href="${seed(type, mbid, url)}">Link external IDs</a> of
    <a href="https://musicbrainz.org/${type}/${mbid}">${name}</a> to MusicBrainz
  </p></div></div>`;
// MessageBox.tsx, verbatim shape
const msg = (type, text, provider) => `
  <div class="message ${type}"><svg class="icon icon-alert-triangle"></svg>${provider ? `<span class="provider">${provider}:</span>` : ''}<div class="markdown"><p>${text}</p></div></div>`;
const RECORDING_ACTIONS = action('recording', REC[0], 'https://open.spotify.com/track/a', 'Dusk')
  + action('recording', REC[1], 'https://open.spotify.com/track/b', 'Dawn');
const page_ = (inner) => `<!doctype html><html><head><meta charset="utf-8"><title>Harmony</title></head><body><main>${inner}</main></body></html>`;

const FIXTURES = {
  // no error: title, actions, nothing else
  clean: page_(`<h2 class="release-title">Test Release</h2><h2>Release Actions</h2>
    <div class="action"><p><a href="https://musicbrainz.org/release/${MBID}">Open in MusicBrainz</a></p></div>
    ${RECORDING_ACTIONS}`),
  // A — the merge threw: no release title, no actions, the bare form instead
  A: page_(`<h2>Release Actions</h2>
    <form><div class="row"><input name="release_mbid" value="${MBID}"><input type="submit" value="Go!"></div></form>
    ${msg('error', 'The MusicBrainz web server is currently busy. Please try again later.')}
    <div class="action"><p><a href="https://musicbrainz.org/release/${MBID}">Open in MusicBrainz</a></p></div>`),
  // B — a browse threw: the release merged, the sections render unfiltered, and
  // Harmony says so itself inside the action-group
  B: page_(`<h2 class="release-title">Test Release</h2><h2>Release Actions</h2>
    ${msg('error', 'Internal Server Error')}
    <div class="action"><p><a href="https://musicbrainz.org/release/${MBID}">Open in MusicBrainz</a></p></div>
    <div class="action-group">
      ${msg('warning', 'Already existing recording links on MusicBrainz could not be checked. There may be no new external IDs to add.')}
      ${RECORDING_ACTIONS}
    </div>`),
  // C — a provider dropped out of the merge: looks complete, isn't
  C: page_(`<h2 class="release-title">Test Release</h2><h2>Release Actions</h2>
    ${msg('error', 'QuotaException (4): Quota limit exceeded: https://api.deezer.com/album/123', 'Deezer')}
    <div class="action"><p><a href="https://musicbrainz.org/release/${MBID}">Open in MusicBrainz</a></p></div>
    ${RECORDING_ACTIONS}`),
  // the shape-B FALSE POSITIVE: Harmony skipped the label browse on purpose, so
  // the warning is there with nothing at all wrong
  labelSkip: page_(`<h2 class="release-title">Test Release</h2><h2>Release Actions</h2>
    <div class="action-group">
      ${msg('warning', 'Already existing label links on MusicBrainz could not be checked. There may be no new external IDs to add.')}
      ${RECORDING_ACTIONS}
    </div>`),
  permanent: page_(`<h2>Release Actions</h2>
    ${msg('error', '"not-an-mbid" is not a valid MBID')}`),
  // an error from chaban's harmony-beatport-recovery, which mimics this markup
  beatport: page_(`<h2 class="release-title">Test Release</h2><h2>Release Actions</h2>
    <div id="hbr-beatport-message" class="message error"><span class="provider">Beatport Recovery:</span><div><p>MusicBrainz rate limited the request.</p></div></div>
    ${RECORDING_ACTIONS}`),
};

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1200, height: 900 } });
// ⚠ Routed on a REGEX, not a glob. `'**/release/actions*'` is the shape that has
// silently stopped matching once a URL gained a query string before now, and a
// fixture test that quietly falls through to the real site is worse than none.
const FIX = { current: 'clean' };
await ctx.route(/harmony\.pulsewidth\.org\.uk/, r =>
  r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURES[FIX.current] }));

const open = async (which, opts) => {
  FIX.current = which;
  const page = await ctx.newPage();
  page.on('pageerror', e => { console.log('PAGEERROR ' + e.message); fail++; });
  await page.addInitScript((o) => {
    const store = new Map(Object.entries(o));
    window.GM_getValue = (k, d) => (store.has(k) ? store.get(k) : d);
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    // nothing may be opened, by either route
    window.__opened = [];
    window.GM_openInTab = (u) => { window.__opened.push(u); return { close() {}, closed: false }; };
    window.open = (u) => { window.__opened.push(u); return { closed: false }; };
    window.__confirms = [];
    window.confirm = (m) => { window.__confirms.push(m); return false; };   // always decline
    window.__log = [];
    const ci = console.info.bind(console);
    console.info = (...a) => { window.__log.push(a.join(' ')); ci(...a); };
  }, opts || {});
  await page.goto(`https://harmony.pulsewidth.org.uk/release/actions?release_mbid=${MBID}`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, null, { timeout: 10000 });
  return page;
};
/* ⚠ A build without the fix has no detector at all, and reaching straight for it
   made the pre-fix run die on a TypeError — which is indistinguishable from a
   broken test, and proves nothing. Everything needing the detector degrades to
   this sentinel instead, so those checks FAIL and say why, while the behavioural
   checks further down (which use only sendToFalcon, present on both builds) still
   run and show what actually changed. */
const NONE = { shape: '(no detector on this build)', bad: null, permanent: null, hasRelease: null,
  unchecked: [], providers: [], slowDown: null, from: [], n: 0, summary: '' };
const state = async p => (await p.evaluate(() => {
  if (typeof window.__falconTest.harmonyErrorState !== 'function') return null;
  const st = window.__falconTest.harmonyErrorState();
  return { shape: st.shape, bad: st.bad, permanent: st.permanent, hasRelease: st.hasRelease,
    unchecked: st.uncheckedTypes, providers: st.providers, slowDown: st.slowDown,
    from: st.boxes.map(b => b.from), n: st.boxes.length,
    summary: window.__falconTest.harmonyErrorSummary(st) };
})) || NONE;

/* ── 2. every shape is told apart ──────────────────────────────────────────── */
// Reload deliberately OFF for this file, so nothing here can navigate; the
// bounding and the actual reload are verify-590-reload-bounded's job.
const OFF = { 'falcon:harmonyReloadOnError': false, 'falcon:autoSendFromHarmony': true };

const pClean = await open('clean', OFF);
const hasDetector = await pClean.evaluate(() => typeof window.__falconTest.harmonyErrorState === 'function');
ck(hasDetector, 'this build exposes the Harmony error detector at all');
const sClean = await state(pClean);
console.log('\nclean:', JSON.stringify(sClean));
ck(sClean.bad === false && sClean.shape === 'clean', 'a clean page reports no error');
ck(await pClean.evaluate(() => window.__falconTest.scrapeHarmonyActions().length) === 2,
  'fixture: the clean page really does carry two scrapeable actions (otherwise nothing below means anything)');

const pA = await open('A', OFF);
const sA = await state(pA);
console.log('A:', JSON.stringify(sA));
ck(sA.bad && sA.shape === 'A', `a failed merge is shape A (${sA.shape})`);
ck(sA.hasRelease === false, 'shape A is recognised by the release never having rendered');
ck(sA.slowDown === true, '"currently busy" is a 503 overload rather than a rate limit, but it asks for the same longer backoff');
ck(/no actions on this page/.test(sA.summary), `and says so in one line: "${sA.summary}"`);
// the bug in the issue, precisely: today this page makes the auto-send claim success
ck(await pA.evaluate(() => window.__falconTest.scrapeHarmonyActions().length) === 0,
  'fixture: shape A really has zero actions to scrape');

const pB = await open('B', OFF);
const sB = await state(pB);
console.log('B:', JSON.stringify(sB));
ck(sB.bad && sB.shape === 'B', `a missing entity cache is shape B (${sB.shape})`);
ck(JSON.stringify(sB.unchecked) === '["recording"]', `and names the type that could not be checked (${JSON.stringify(sB.unchecked)})`);
ck(/unfiltered/.test(sB.summary), `summary explains the consequence: "${sB.summary}"`);

const pC = await open('C', OFF);
const sC = await state(pC);
console.log('C:', JSON.stringify(sC));
ck(sC.bad && sC.shape === 'C', `a provider that dropped out is shape C (${sC.shape})`);
ck(JSON.stringify(sC.providers) === '["Deezer"]', `and the provider is named (${JSON.stringify(sC.providers)})`);
ck(sC.unchecked.length === 0, 'shape C has no "could not be checked" warning — that is what makes it invisible');
ck(await pC.evaluate(() => window.__falconTest.scrapeHarmonyActions().length) === 2,
  'fixture: shape C still LOOKS complete — the actions are all there, they are just short of Deezer');

/* ── 3. the false positive stays a false positive ──────────────────────────── */
const pL = await open('labelSkip', OFF);
const sL = await state(pL);
console.log('label-skip:', JSON.stringify(sL));
ck(sL.bad === false && sL.shape === 'clean',
  'a label "could not be checked" warning alone is NOT an error — Harmony skips that browse on purpose');

/* ── 4. permanent errors are not worth reloading ───────────────────────────── */
const pP = await open('permanent', OFF);
const sP = await state(pP);
console.log('permanent:', JSON.stringify(sP));
ck(sP.bad && sP.permanent, 'a bad MBID is marked permanent');
const perm = await pP.evaluate(() => {
  const T = window.__falconTest;
  if (!T.HARMONY_PERMANENT_RE) return { yes: 0, yesN: 7, no: 0, noN: 7, slow: 0, slowNot: 0 };
  const yes = ['"x" is not a valid MBID', 'Release not found', 'Not Found', 'No provider supports https://x/y',
    'No release lookups have been queued', 'Provider Deezer can only be used once per lookup, ignoring...',
    'Could not determine the MusicBrainz release MBID.'];
  const no = ['The MusicBrainz web server is currently busy. Please try again later.', 'Internal Server Error',
    'Your requests are exceeding the allowable rate limit. Please see https://wiki.musicbrainz.org/MusicBrainz_API/Rate_Limiting',
    'Too many requests queued, please wait and try again', 'Failed to fetch resource at https://api.deezer.com/album/1',
    'Failed to fetch', 'No provider returned a release'];
  return { yes: yes.filter(t => T.HARMONY_PERMANENT_RE.test(t)).length, yesN: yes.length,
    no: no.filter(t => T.HARMONY_PERMANENT_RE.test(t)).length, noN: no.length,
    slow: ['rate limit', 'Too many requests queued', 'currently busy', 'HTTP 429'].filter(t => T.HARMONY_SLOW_DOWN_RE.test(t)).length,
    slowNot: ['Internal Server Error', 'Failed to fetch'].filter(t => T.HARMONY_SLOW_DOWN_RE.test(t)).length };
});
console.log('permanent matcher:', JSON.stringify(perm));
ck(perm.yes === perm.yesN, `every hopeless error is recognised (${perm.yes}/${perm.yesN})`);
ck(perm.no === 0, `and no transient one is (${perm.no} of ${perm.noN} wrongly called permanent)`);
ck(perm.slow === 4, `every "slow down" error earns the longer backoff (${perm.slow}/4)`);
ck(perm.slowNot === 0, `and an ordinary failure does not (${perm.slowNot})`);

/* ── 5. chaban's own script's errors count too ─────────────────────────────── */
const pBp = await open('beatport', OFF);
const sBp = await state(pBp);
console.log('beatport-recovery:', JSON.stringify(sBp));
ck(sBp.bad && sBp.from[0] === 'beatport-recovery',
  'an error injected by harmony-beatport-recovery is detected AND attributed to it');
ck(sBp.slowDown, 'and its rate-limit wording earns the longer backoff');

/* ── 6. what it actually changes: the send ─────────────────────────────────── */
for (const [name, p] of [['A', pA], ['B', pB], ['C', pC], ['beatport', pBp]]) {
  const r = await p.evaluate(async () => {
    window.__falconTest.maybeAutoSend();
    await new Promise(r => setTimeout(r, 200));
    const auto = await window.__falconTest.sendToFalcon(true);
    const manual = await window.__falconTest.sendToFalcon(false);   // confirm() declines
    return { auto, manual, opened: window.__opened.length, confirms: window.__confirms, log: window.__log };
  });
  ck(r.auto === false && r.opened === 0, `${name}: an automatic send stands down and opens nothing`);
  ck(r.manual === false && r.confirms.length === 1, `${name}: a manual send asks first, and honours "no"`);
  ck(/Send anyway\?/.test(r.confirms[0] || '') && /Harmony reported/.test(r.confirms[0] || ''),
    `${name}: the confirm names the damage — "${(r.confirms[0] || '').split('\n')[0]}"`);
  ck(r.log.some(l => /standing down/.test(l)), `${name}: and the reason is in the console, not just swallowed`);
}
// the clean page must be entirely unaffected by all of this
const rc = await pClean.evaluate(async () => {
  const ok = await window.__falconTest.sendToFalcon(false);
  return { ok, opened: window.__opened.length, confirms: window.__confirms.length };
});
ck(rc.ok === true && rc.opened === 1 && rc.confirms === 0,
  `a clean page still sends straight through, no questions asked (opened ${rc.opened}, confirms ${rc.confirms})`);

/* ── 7. the button says which ──────────────────────────────────────────────── */
const label = p => p.evaluate(() => { window.__falconTest; const l = document.getElementById('falcon-harmony-lbl'); return l ? l.textContent : null; });
const labels = { clean: await label(pClean), A: await label(pA), B: await label(pB), permanent: await label(pP) };
console.log('\nbutton labels:', JSON.stringify(labels, null, 1));
ck(/^Send \d+ to Falcon$/.test(labels.clean || ''), `clean page keeps today's label (${labels.clean})`);
ck(/Harmony errored/.test(labels.A || ''), `shape A says so (${labels.A})`);
ck(/Harmony errored — send anyway \(2\)/.test(labels.B || ''), `shape B offers the send with its count (${labels.B})`);
ck(/can't load this release/.test(labels.permanent || ''), `a permanent error offers nothing (${labels.permanent})`);

await ctx.close();
if (!srcOk) console.log('\n(note: Harmony\'s source was unreachable, so the markup-contract checks did not run)');
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
