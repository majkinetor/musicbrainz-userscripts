// #556 (majkinetor): "how am I supposed to fetch this log if both original and
// new tab gets killed (first one killed, other one reloaded)".
//
// He is right: a console timeline written in a tab that closes itself, while
// the opener reloads underneath it, is a timeline nobody can read. So every
// mark now also goes to localStorage (which outlives both) and over the
// BroadcastChannel (so the opener's Log shows it live).
//
// This asserts BOTH delivery paths on a real background add, in a suspended
// tab, with the whole bundle loaded:
//
//   live      — the opener's Log window fills while the add is still running
//   survived  — reload the opener afterwards and the timeline is still there
//
//   node userscripts/platform_check/test/verify-556-background-log.mjs
//
// Sandbox only. It DOES submit — the timeline's last entries only exist on the
// far side of a real commit.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));

const B = 'https://test.musicbrainz.org';
if (!/^https:\/\/test\.musicbrainz\.org$/.test(B)) { console.error('sandbox only'); process.exit(2); }

let fail = 0;
const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
const say = (...a) => console.log(...a);
const bundle = await readFile(resolve(HERE, '..', '..', 'string_theory', 'string_theory.user.js'), 'utf8');

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', {
    headless: false, viewport: { width: 1400, height: 900 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'String Theory', version: 'verify' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
    window.GM_addValueChangeListener = () => 0;
    window.GM_removeValueChangeListener = () => {};
    window.GM_setClipboard = () => {};
    window.GM_notification = () => {};
    window.GM_download = () => {};
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head?.appendChild(s); return s; };
    window.GM_xmlhttpRequest = (o) => { try { o && o.onerror && o.onerror({ error: 'verify: network disabled' }); } catch (e) {} return { abort() {} }; };
    window.GM = { xmlHttpRequest: window.GM_xmlhttpRequest, getValue: async (k, d) => window.GM_getValue(k, d), setValue: async (k, v) => window.GM_setValue(k, v), info: window.GM_info };
    // the editor tab gets a hidden tab's real constraints; see e2e-556's note
    if (/\/edit(\?|#|$)/.test(location.href)) {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        window.requestAnimationFrame = () => 0;
        window.cancelAnimationFrame = () => {};
        const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
        window.setTimeout = (fn, d, ...a) => st(fn, Math.max(Number(d) || 0, 1000), ...a);
        window.setInterval = (fn, d, ...a) => si(fn, Math.max(Number(d) || 0, 1000), ...a);
    }
});
// installed the way a userscript manager does, so it also runs on the page
// MusicBrainz redirects to after the submit
await ctx.addInitScript({ content: bundle });

const home = ctx.pages()[0] || await ctx.newPage();
await home.goto(B, { waitUntil: 'domcontentloaded' });
if (!(await home.evaluate(() => !!document.querySelector('a[href*="/logout"]')))) {
    say('NOT LOGGED IN to the sandbox'); await ctx.close(); process.exit(3);
}
const mbid = await home.evaluate(async () => {
    const j = await (await fetch('/ws/2/release?query=*&limit=30&fmt=json', { headers: { Accept: 'application/json' } })).json();
    return (j.releases || [])[3]?.id;
});
const url = `https://www.deezer.com/album/${Date.now() % 100000000}`;
say(`release ${B}/release/${mbid}\nurl     ${url}\n`);

// the OPENER: the release page, where the dashboard and its Log live
const opener = await ctx.newPage();
await opener.goto(`${B}/release/${mbid}`, { waitUntil: 'domcontentloaded' });
await opener.waitForTimeout(4000);
const logText = () => opener.evaluate(() => document.getElementById('mb-finder-log-panel')?.textContent || '');
ck((await logText()).length > 0, 'the dashboard mounted on the opener and its Log is present');
await opener.evaluate(([id, u]) => {
    localStorage.removeItem('pc:bg-log');
    localStorage.setItem('pc:pending:' + id, JSON.stringify({ deezer: u }));
}, [mbid, url]);

// the background add
const tab = await ctx.newPage();
tab.on('console', m => { const t = m.text(); if (/Platform Check/.test(t)) say('  tab: ' + t.slice(0, 160)); });
tab.on('pageerror', e => say('  tab PAGEERROR: ' + (e && e.message || e)));
await tab.goto(`${B}/release/${mbid}/edit#pc-autocommit`, { waitUntil: 'domcontentloaded' });
await opener.bringToFront();
await tab.waitForTimeout(45000);

// 1. LIVE — the opener's Log filled while the add was running, without it ever
//    being reloaded
const stored = await opener.evaluate(() => localStorage.getItem('pc:bg-log'));
try {
    const arr = JSON.parse(stored || '[]');
    say(`stored pc:bg-log: ${arr.length} entr(ies)`);
    arr.forEach(e => say(`    ${e.id}  ${e.line}`));
} catch (e) { say(`stored pc:bg-log: ${stored}`); }
const live = await logText();
say('--- opener Log (live) ---');
live.split('\n').filter(l => /background add/.test(l)).forEach(l => say('  ' + l.trim()));
ck(/background add: /.test(live), 'the timeline reached the opener\'s Log live, over the channel');
ck(/Enter edit clicked/.test(live), 'including the submit, which happens in the other tab');
ck(/edit committed/.test(live), 'and the final entry, which is written as the tab closes itself');

// 2. SURVIVED — this is majkinetor's case: the add tab is gone and the opener
//    reloads. The timeline has to still be there afterwards.
await tab.close().catch(() => {});
await opener.reload({ waitUntil: 'domcontentloaded' });
await opener.waitForTimeout(4000);
const after = await logText();
say('--- opener Log (after reload) ---');
after.split('\n').filter(l => /background add/.test(l)).forEach(l => say('  ' + l.trim()));
ck(/background add: /.test(after), 'and it is still there after the opener reloads (drained from localStorage)');
ck(/edit committed/.test(after), 'the last entry included — the whole run, not a truncated one');
const dupes = (after.match(/Enter edit clicked/g) || []).length;
ck(dupes === 1, `each entry appears exactly once after the reload (found ${dupes} of "Enter edit clicked")`);

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
