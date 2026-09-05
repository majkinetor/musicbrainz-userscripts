// #564 (majkinetor): "dark falcon theme alias text in chip is black".
//
// kellnerd's dark userstyle carries `span[style*=background]{color:initial}` for
// MusicBrainz's own colour-coded cells, and `initial` resolves to canvastext —
// black in Firefox. Every element of OURS with an inline background matches it
// too, and nothing its children inherit can beat a rule aimed at the element
// itself. The shared default in ui-components.mjs ties on specificity (both
// 0,1,1), so which one wins comes down to injection order, which is why some of
// these looked right and the alias chip did not.
//
// So the alias chip states its colour inline, and this drives the real thing:
// seed the queue through Falcon's own test hook, expand the row, and read the
// rendered colour of the alias name.
//
//   node userscripts/falcon/test/verify-564-alias-chip.mjs [--headed]
//
// Read only — every POST is aborted. Sandbox.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { firefox } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));

const B = 'https://test.musicbrainz.org';
const STYLE_URL = 'https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css';
let fail = 0;
const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
// Chromium reports a color-mix() result as `color(srgb 0.2 0.2 0.22)`, not rgb().
// The token set derives most surfaces with color-mix, so a parser that only
// knows rgb() returns null for exactly the colours worth checking — and a null
// then reads as "too light" or "too dark" depending on which way the caller
// defaulted. Both notations, or nothing.
const lum = (c) => {
    const f = v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    let m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
    if (m) return 0.2126 * f(+m[1] / 255) + 0.7152 * f(+m[2] / 255) + 0.0722 * f(+m[3] / 255);
    m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c || '');
    if (m) return 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
    return null;
};

const src = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const styleCss = await (async () => {
    const raw = await (await fetch(STYLE_URL)).text();
    const i = raw.indexOf('@-moz-document');
    if (i < 0) throw new Error('kellnerd userstyle: no @-moz-document wrapper — format changed');
    return raw.slice(raw.indexOf('{', i) + 1, raw.lastIndexOf('}'));
})();

// FIREFOX, not Chromium, and that is the whole point: kellnerd's rule sets
// `color: initial`, which resolves to canvastext — and canvastext follows
// color-scheme, which our panels set to dark. Chromium paints that WHITE, so the
// bug is invisible there and this check passed on the broken build twice before
// I noticed. Firefox paints it BLACK, which is what majkinetor reported.
const ctx = await firefox.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile-ff', {
    headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 950 },
});
await ctx.addInitScript(() => {
    const store = new Map();
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_listValues = () => [...store.keys()];
    window.GM_info = { script: { name: 'Falcon', version: 'verify' } };
    window.unsafeWindow = window;
    window.GM_openInTab = () => ({ closed: false, close() {} });
    window.GM_registerMenuCommand = () => {};
    window.GM_addValueChangeListener = () => 0;
    window.GM_removeValueChangeListener = () => {};
    window.GM_setClipboard = () => {};
    window.GM_notification = () => {};
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; document.head?.appendChild(s); return s; };
    window.GM_xmlhttpRequest = (o) => { try { o && o.onerror && o.onerror({ error: 'verify: network disabled' }); } catch (e) {} return { abort() {} }; };
    window.GM = { xmlHttpRequest: window.GM_xmlhttpRequest, getValue: async (k, d) => window.GM_getValue(k, d), setValue: async (k, v) => window.GM_setValue(k, v), info: window.GM_info };
});

const page = await ctx.newPage();
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
await page.goto(`${B}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
// ⚠ ORDER MATTERS, and getting it wrong makes this check worthless. Our shared
// default and kellnerd's rule have the SAME specificity (0,1,1), so whichever
// stylesheet comes LAST wins — and in a real browser Stylus is last, because
// Falcon does not add its stylesheet until its panel first opens. Two earlier
// versions of this file passed on a build with the bug still in it for exactly
// that reason: the userstyle went in first and our rule won the tie.
//
// So: script, panel open (which is when Falcon's CSS lands), and only then the
// userstyle.
await page.addScriptTag({ content: src });
await page.waitForTimeout(2500);

// seed the queue through Falcon's own hook and open the row
const opened = await page.evaluate(() => {
    const t = window.__falconTest || (window.unsafeWindow && window.unsafeWindow.__falconTest);
    if (!t) return 'no test hook';
    document.getElementById('falcon-launcher')?.click();
    t.setQueue([{
        id: 'f1', entityType: 'artist', mbid: '00000000-0000-0000-0000-000000000001',
        urls: [], note: '', disambiguation: '', isrcs: [], video: false,
        aliases: [{ name: 'foobar' }], cover: [], coverExistingCount: null,
        name: 'Test Artist', urlResults: null, status: 'queued', error: '',
    }]);
    return 'ok';
});
ck(opened === 'ok', `the panel opened and the queue was seeded (${opened})`);
await page.waitForTimeout(800);
await page.evaluate(() => document.querySelector('.falcon-row-expand')?.click());
await page.waitForTimeout(800);

// NOW the userstyle, the way Stylus arrives: after everything of ours.
await page.addStyleTag({ content: styleCss });
await page.waitForTimeout(1200);

// the fixture: is the userstyle's color:initial rule actually winning anywhere?
// Without this the whole check passes on a page where nothing fought us.
const probe = await page.evaluate(() => {
    const s = document.createElement('span');
    s.id = 'verify-564-probe';
    s.setAttribute('style', 'background:#333333');
    s.textContent = 'x';
    document.body.appendChild(s);
    return getComputedStyle(s).color;
});
ck((lum(probe) ?? 1) < 0.2, `the userstyle IS forcing color:initial on inline-background spans (probe: ${probe})`);

const chip = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#falcon-panel span')]
        .find(s => (s.textContent || '').trim() === 'foobar');
    if (!el) return null;
    const cs = getComputedStyle(el);
    const box = el.closest('span[style*=background]');
    return {
        color: cs.color,
        chipBg: box ? getComputedStyle(box).backgroundColor : null,
        chipColor: box ? getComputedStyle(box).color : null,
    };
});
ck(!!chip, `the alias chip rendered — ${JSON.stringify(chip)}`);
if (chip) {
    ck((lum(chip.color) ?? 0) > 0.5, `the alias NAME is light on the dark chip (${chip.color})`);
    ck((lum(chip.chipColor) ?? 0) > 0.5, `and the chip itself sets a light colour rather than inheriting canvastext (${chip.chipColor})`);
    ck((lum(chip.chipBg) ?? 1) < 0.35, `on a dark ground (${chip.chipBg})`);
}

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
