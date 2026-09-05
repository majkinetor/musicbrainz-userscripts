// #569 — a guard's only possible failure is skipping a write that WAS needed.
//
// The guards themselves are no-ops by construction (they skip only when the
// value already equals the one being written), but "by construction" is how the
// last four regressions in this repo were argued for, so: drive the guarded
// features in both directions on a live page and assert the DOM follows.
//
//   Apollo   body.tc-ri-on and .tc-ri-helphidden on/off via the launcher,
//            plus the launcher's own label, which is a guarded textContent
//   Mammoth  html.mmthf-dialog / .mmthf-anydialog when a dialog opens and closes
//
//   node dev/ui/verify-569-guards-still-apply.mjs [--headed]
//
// Read only — every POST is aborted. Sandbox.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));

const B = 'https://test.musicbrainz.org';
let fail = 0;
const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const bundle = await readFile(resolve(HERE, '..', '..', 'userscripts', 'string_theory', 'string_theory.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
    headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 950 },
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
});
await ctx.addInitScript({ content: bundle });

const page = await ctx.newPage();
await page.route(() => true, r => (r.request().method() === 'POST' ? r.abort() : r.fallback()));
await page.goto(`${B}/release/add`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(6000);

const look = () => page.evaluate(() => ({
    riOn: document.body.classList.contains('tc-ri-on'),
    hidden: document.querySelectorAll('.tc-ri-helphidden').length,
    label: document.querySelector('#tc-launch .tc-launch-lbl')?.textContent || null,
    dialog: document.documentElement.classList.contains('mmthf-dialog'),
    anyDialog: document.documentElement.classList.contains('mmthf-anydialog'),
}));

// ── Apollo: the Release-Info view, on ───────────────────────────────────────
const on = await look();
console.log('  apollo on:  ' + JSON.stringify(on));
ck(on.riOn, 'body carries tc-ri-on with Apollo on');
ck(on.hidden > 0, `native help bubbles are flagged tc-ri-helphidden (${on.hidden})`);
ck(on.label === 'Original', `the launcher offers the way back (label: ${on.label})`);

// ── and off, which is the write a wrong guard would skip ────────────────────
await page.click('#tc-launch .tc-launch-lbl');
await page.waitForTimeout(2500);
const off = await look();
console.log('  apollo off: ' + JSON.stringify(off));
ck(!off.riOn, 'tc-ri-on is removed when Apollo is switched off');
ck(off.hidden === 0, `and every tc-ri-helphidden with it (${off.hidden} left)`);
ck(off.label === 'Apollo Editor', `the guarded textContent still updates (label: ${off.label})`);

// ── and back ────────────────────────────────────────────────────────────────
await page.click('#tc-launch .tc-launch-lbl');
await page.waitForTimeout(2500);
const again = await look();
console.log('  apollo on:  ' + JSON.stringify(again));
ck(again.riOn, 'tc-ri-on comes back');
ck(again.hidden > 0, `and the help bubbles are re-flagged (${again.hidden})`);
ck(again.label === 'Original', 'and the label with them');

// ── Mammoth: the dialog classes ─────────────────────────────────────────────
// A real relationship dialog needs a whole editing flow; the class is driven off
// the presence of `.dialog.popover`, so present one.
await page.evaluate(() => {
    const d = document.createElement('div');
    d.className = 'dialog popover';
    d.id = 'verify-569-dialog';
    document.body.appendChild(d);
});
await page.waitForTimeout(1200);
const dlg = await look();
console.log('  dialog:     ' + JSON.stringify(dlg));
ck(dlg.dialog, 'html.mmthf-dialog is set when a dialog opens');
ck(dlg.anyDialog, 'and html.mmthf-anydialog with it');

await page.evaluate(() => document.getElementById('verify-569-dialog')?.remove());
await page.waitForTimeout(1200);
const closed = await look();
console.log('  closed:     ' + JSON.stringify(closed));
ck(!closed.dialog, 'and both are cleared when it closes');
ck(!closed.anyDialog, 'mmthf-anydialog cleared');

await ctx.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
