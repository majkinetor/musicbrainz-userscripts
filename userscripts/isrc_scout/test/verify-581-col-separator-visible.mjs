// majkinetor: "IS column separators are not visible on light theme (one visible
// is the one I hover over)" — the resize handles between header cells.
//
// The intent was already in the code: "a persistent line so the handle is
// discoverable, not just a hover surprise". The token was wrong. It drew the
// line in --mbu-bg-sunken, a SURFACE token — 94% of the background mixed with a
// little ink, so ~#f0f0f0 on a white header. --mbu-border is the token for a
// line meant to be seen.
//
// Asserted as CONTRAST against the header it sits on, in BOTH themes, because
// "is it visible" is a measurement and because the light theme is where it went
// wrong while the dark one looked fine.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.II_SRC || resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');
const log = (...a) => console.log('[verify-581]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// A separator is a hairline, not text: it does not need 4.5:1, but it does need
// to be distinguishable from the surface it is drawn on. 1.4:1 is roughly where
// a 1px line stops reading as "nothing there".
const MIN = 1.4;
// Chromium reports some computed backgrounds as `color(srgb 0.97 0.96 0.99)`,
// whose components are 0-1. Reading those as 0-255 makes a near-white surface
// look black and turns an invisible line into a fake 12.8:1 pass — which is
// exactly what this test got the first time it ran.
const rgb = (s) => {
  const n = (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  return /^color\(/i.test(String(s).trim()) ? n.map(v => v * 255) : n;
};
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const l1 = lum(rgb(a)), l2 = lum(rgb(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

const REL = '1bbbe273-7dd9-44e8-940f-75a92aa3a2b0';
const rawStyle = await (await fetch('https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css')).text();
const darkCss = rawStyle.replace(/^[\s\S]*?@-moz-document[^{]*\{/, '').replace(/\}\s*$/, '');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1700, height: 1000 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_info = { script: { name: 'ISRC Scout', version: 't' } };
  window.GM_xmlhttpRequest = (o) => {
    const done = r => { try { (o.onload || (() => {}))(r); } catch (e) {} };
    fetch(o.url, { method: o.method || 'GET', headers: o.headers || {}, body: o.data })
      .then(async r => done({ status: r.status, statusText: r.statusText, responseText: await r.text(), finalUrl: r.url, responseHeaders: '' }))
      .catch(e => { try { (o.onerror || (() => {}))(e); } catch (_) {} });
    return { abort() {} };
  };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route(() => true, r => { if (r.request().method() === 'POST') { posted.push(r.request().url()); return r.abort(); } return r.fallback(); });

async function measure(theme) {
  await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  if (theme === 'dark') await page.addStyleTag({ content: darkCss });
  await page.addScriptTag({ content: code });
  await page.waitForSelector('#ii-btn', { timeout: 25000, state: 'attached' });
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('.ii-col-resize', { timeout: 25000, state: 'attached' });
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const h = document.querySelector('.ii-col-resize');
    const th = h.closest('th');
    const line = getComputedStyle(h, '::after');
    // walk up for the first non-transparent background the line is drawn over
    let el = th, surface = 'rgba(0, 0, 0, 0)';
    while (el && (surface === 'rgba(0, 0, 0, 0)' || surface === 'transparent')) { surface = getComputedStyle(el).backgroundColor; el = el.parentElement; }
    return {
      theme: document.documentElement.getAttribute('data-mbu-theme'),
      lineBg: line.backgroundColor, lineW: line.width, surface,
      count: document.querySelectorAll('.ii-col-resize').length,
    };
  });
}

for (const theme of ['light', 'dark']) {
  const m = await measure(theme);
  const c = contrast(m.lineBg, m.surface);
  log(`${theme}: ${JSON.stringify(m)} → contrast ${c.toFixed(2)}:1`);
  ck(m.count >= 2, `${theme}: there are separators to look at (${m.count})`);
  ck(m.theme === (theme === 'dark' ? 'dark' : 'light'), `${theme}: the script agrees which theme this is (got ${m.theme})`);
  ck(parseFloat(m.lineW) >= 1, `${theme}: the line has width (${m.lineW})`);
  ck(c >= MIN, `${theme}: the separator is distinguishable from the header behind it (${c.toFixed(2)}:1, need ${MIN})`);
}

const writes = posted.filter(u => { try { return /(^|\.)musicbrainz\.org$/.test(new URL(u).hostname); } catch (e) { return true; } });
ck(writes.length === 0, `nothing was submitted to MusicBrainz (${writes.length})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? String.fromCharCode(10) + fail + ' FAIL' : String.fromCharCode(10) + 'ALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
