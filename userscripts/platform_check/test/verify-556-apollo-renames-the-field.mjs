// #556 — the regression guard for the actual cause.
//
// Apollo Editor rewrites MusicBrainz's "Add another link" placeholder to
// "Paste one or more links" (its multi-link paste hint), re-applying it from a
// MutationObserver so it survives every re-render. Platform Check used to find
// that field by placeholder TEXT, so from then on it found nothing, waited out
// its 25s and added no link at all — #556, in full.
//
// This loads the sandbox release editor, puts Apollo on it exactly as String
// Theory does, waits for the rename to actually happen, and then asks the
// SHIPPED findAddLinkInput whether it can still see the field.
//
//   node userscripts/platform_check/test/verify-556-apollo-renames-the-field.mjs
//
// It is a real regression test, not a demonstration: it fails on the build that
// had the bug, because the rename is asserted before the lookup is judged. Read
// only — nothing is seeded and nothing is submitted. Sandbox only.
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

const pcSrc = await readFile(resolve(HERE, '..', 'platform_check.user.js'), 'utf8');
const apollo = await readFile(resolve(HERE, '..', '..', 'apollo_editor', 'apollo_editor.user.js'), 'utf8');

// Use the SHIPPED function, not a copy of it — a second implementation here
// would drift and start passing while the script stayed broken.
const finderSrc = (() => {
    const s = pcSrc.slice(pcSrc.indexOf('function findAddLinkInput'));
    const m = s.match(/\r?\n\}\r?\n/);
    if (!m) throw new Error('could not extract findAddLinkInput from the userscript');
    return s.slice(0, m.index + m[0].length);
})();

const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', {
    headless: false, viewport: { width: 1400, height: 900 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'Apollo Editor', version: 'verify' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
    window.GM_addValueChangeListener = () => 0;
    window.GM_removeValueChangeListener = () => {};
    window.GM_setClipboard = () => {};
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head?.appendChild(s); return s; };
    window.GM_xmlhttpRequest = (o) => { try { o && o.onerror && o.onerror({ error: 'verify: network disabled' }); } catch (e) {} return { abort() {} }; };
    window.GM = { xmlHttpRequest: window.GM_xmlhttpRequest, getValue: async (k, d) => window.GM_getValue(k, d), setValue: async (k, v) => window.GM_setValue(k, v), info: window.GM_info };
});

const front = ctx.pages()[0] || await ctx.newPage();
await front.goto(B, { waitUntil: 'domcontentloaded' });
if (!(await front.evaluate(() => !!document.querySelector('a[href*="/logout"]')))) {
    console.log('NOT LOGGED IN to the sandbox — cannot open an editor'); await ctx.close(); process.exit(3);
}
const mbid = await front.evaluate(async () => {
    const j = await (await fetch('/ws/2/release?query=*&limit=5&fmt=json', { headers: { Accept: 'application/json' } })).json();
    return (j.releases || [])[0]?.id;
});

const tab = await ctx.newPage();
await tab.goto(`${B}/release/${mbid}/edit`, { waitUntil: 'domcontentloaded' });

// 1. the field is there before Apollo touches it — otherwise this proves nothing
// page.evaluate takes ONE expression, so the extracted declaration has to be
// wrapped — a bare `function f(){} ; f()` is a syntax error there.
const probeSrc = (body) => `(() => { ${finderSrc}\n return (${body}); })()`;
// waited for, not sampled: the editor mounts the External links section a beat
// after domcontentloaded, and reading too early fails for the wrong reason.
const before = await tab.waitForFunction(probeSrc('!!findAddLinkInput()'), null, { timeout: 20000, polling: 500 })
    .then(() => true).catch(() => false);
ck(before, `the "Add another link" field is present on a bare editor (${B}/release/${mbid}/edit)`);

await tab.addScriptTag({ content: apollo });

// 2. wait for the rename. THIS is the fixture: if Apollo never renames anything
// the lookup below succeeds for the wrong reason and the guard is worthless.
const renamed = await tab.waitForFunction(() => [...document.querySelectorAll('#external-links-editor input[type=url]')]
    .some(i => /paste one or more links/i.test(i.placeholder || '')), null, { timeout: 30000, polling: 500 })
    .then(() => true).catch(() => false);
ck(renamed, 'Apollo renames the placeholder to "Paste one or more links" (the fixture reproduces)');

// 3. and now the thing under test
const found = await tab.evaluate(probeSrc(`(() => {
    const el = findAddLinkInput();
    return el ? { ok: true, tag: el.tagName, type: el.type, placeholder: el.placeholder, value: el.value } : { ok: false };
})()`));
ck(found.ok, `findAddLinkInput still finds the field once Apollo has renamed it — ${JSON.stringify(found)}`);
ck(found.ok && found.type === 'url' && !found.value, 'and what it found is the empty url input, i.e. the add row');

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
