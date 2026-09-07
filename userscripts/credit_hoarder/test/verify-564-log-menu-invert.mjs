// #564 (majkinetor): "CH log menu text is not visible" — the Log ▾ dropdown's
// items rendered dark-on-dark under kellnerd's "Dark Side of MusicBrainz", while
// the hovered one was readable. He found it himself: "it shows when i disable
// filter -invert-value: invert(0.9) hue-rotate(180deg)".
//
// The userstyle runs EVERY button through that filter. The shared theme sheet
// switches it off with `--invert-value: none`, but only inside the containers it
// lists, and .discogs-log-menu is appended to <body> — outside .discogs-bar, and
// not named in that list. So the menu's own correct colours were being inverted
// back into the page's own dark.
//
// The fix is the documented opt-in hook, `mbu-ui`, rather than editing the list
// in the shared stylesheet, which would mean re-syncing every script for one
// script's popover.
//
// Measured under the REAL userstyle, fetched rather than vendored: a stale copy
// would test a stylesheet nobody runs. Read-only, every POST aborted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const src = await readFile(process.env.CH_SRC || resolve(HERE, '..', 'dist', 'credit_hoarder.user.js'), 'utf8');
const REL = '1bbbe273-7dd9-44e8-940f-75a92aa3a2b0';
const log = (...a) => console.log('[verify-564]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const rawStyle = await (await fetch('https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css')).text();
const css = rawStyle.replace(/^[\s\S]*?@-moz-document[^{]*\{/, '').replace(/\}\s*$/, '');
ck(/--invert-value/.test(css), 'the fetched userstyle still defines --invert-value — the fixture is real');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1600, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'Credit Hoarder', version: 't' } };
  window.GM_xmlhttpRequest = (o) => {
    const done = r => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data })
      .then(async r => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch(e => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
// MusicBrainz's own pages POST to Sentry unprompted; what must be zero is a POST
// to somewhere an edit could land. Asserting "no POSTs at all" fails on their
// telemetry and teaches you to ignore the assertion.
const posted = [];
await page.route(() => true, r => { if (r.request().method() === 'POST') { posted.push(r.request().url()); return r.abort(); } return r.fallback(); });
// CH only mounts on the relationships editor, not on a plain release page
await page.goto(`https://musicbrainz.org/release/${REL}/edit-relationships`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addStyleTag({ content: css });
await page.addScriptTag({ content: src });
await page.waitForSelector('.discogs-log-menu', { timeout: 25000, state: 'attached' });
await page.waitForTimeout(1500);

const seen = await page.evaluate(() => {
  const menu = document.querySelector('.discogs-log-menu');
  menu.classList.add('open');   // it is only laid out when open
  const btn = menu.querySelector('button');
  const cs = getComputedStyle(btn), ms = getComputedStyle(menu);
  return {
    theme: document.documentElement.getAttribute('data-mbu-theme'),
    invertVar: ms.getPropertyValue('--invert-value').trim(),
    btnFilter: cs.filter,
    btnColor: cs.color,
    menuBg: ms.backgroundColor,
    label: btn.textContent.trim(),
  };
});
log(JSON.stringify(seen));

ck(seen.theme === 'dark', `the userstyle is recognised as dark, or nothing below means anything (got ${seen.theme})`);
// the actual bug: the filter is what made correct colours unreadable
ck(seen.invertVar === 'none', `--invert-value is switched off inside the menu (got ${JSON.stringify(seen.invertVar)})`);
ck(seen.btnFilter === 'none', `so its items are not run through the userstyle's invert (got ${JSON.stringify(seen.btnFilter)})`);

// …and the result is actually readable. Contrast, not vibes — but note this
// check alone would NOT have caught the bug: getComputedStyle reports the
// DECLARED colours, which were always correct (#DDD on #333, 9.3:1). The
// filter is what made them unreadable, so the two assertions above are the
// ones with teeth and this one guards the colours behind them.
const rgb = s => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const L1 = lum(rgb(seen.btnColor)), L2 = lum(rgb(seen.menuBg));
const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
log(`contrast ${seen.btnColor} on ${seen.menuBg} = ${contrast.toFixed(2)}:1`);
ck(contrast >= 4.5, `the menu item is legible on its own background (${contrast.toFixed(2)}:1)`);

const writes = posted.filter(u => { try { return /(^|\.)musicbrainz\.org$/.test(new URL(u).hostname); } catch (e) { return true; } });
if (posted.length) log('POSTs intercepted (all aborted):', JSON.stringify([...new Set(posted.map(u => { try { return new URL(u).hostname; } catch (e) { return u; } }))]));
ck(writes.length === 0, `nothing was submitted to MusicBrainz (${writes.length})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
