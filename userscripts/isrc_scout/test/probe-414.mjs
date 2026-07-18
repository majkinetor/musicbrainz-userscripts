// #414 — bottom half of the toolbar buttons unclickable: an absolutely-positioned
// ::after on #ii-sx-group blankets the row. Reproduce, identify the owning CSS rule,
// and hit-test the bottom of a button.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/isrc_scout/isrc_scout.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1000 }, bypassCSP: true });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {};
  window.GM_xmlhttpRequest = (o) => { setTimeout(() => o.onerror && o.onerror(new Error('stub')), 50); };
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
  window.unsafeWindow = window;
});
await page.goto('https://musicbrainz.org/release/1b5723bd-4b03-48d3-a2eb-6e4226412b0f', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1500);
await page.addScriptTag({ content: code });
await page.waitForSelector('#ii-btn', { timeout: 20000 });
await page.click('#ii-btn');
await page.waitForSelector('#ii-tools', { timeout: 20000 });
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const g = document.querySelector('#ii-sx-group');
  const cs = getComputedStyle(g, '::after');
  const after = { content: cs.content, position: cs.position, width: cs.width, height: cs.height, top: cs.top, pointerEvents: cs.pointerEvents, display: cs.display };
  // find every stylesheet rule that could style this pseudo
  const owners = [];
  for (const sh of document.styleSheets) {
    let rules; try { rules = sh.cssRules; } catch { continue; }
    for (const rule of rules || []) {
      const sel = rule.selectorText;
      if (!sel || !/::?after/i.test(sel)) continue;
      const bases = sel.split(',').map(s => s.trim()).filter(s => /::?after/i.test(s)).map(s => s.replace(/::?after/i, '').trim() || '*');
      for (const b of bases) {
        try { if (g.matches(b)) { owners.push({ sel, css: rule.cssText.slice(0, 220), from: sh.href || 'inline' }); break; } } catch {}
      }
    }
  }
  // hit-test bottom half of the Deezer button
  const btn = document.querySelector('#ii-dz-all');
  const b = btn.getBoundingClientRect();
  const hitTop = document.elementFromPoint(b.left + b.width / 2, b.top + 4);
  const hitBot = document.elementFromPoint(b.left + b.width / 2, b.bottom - 4);
  const idOf = el => el ? (el.id ? '#' + el.id : el.tagName + '.' + el.className) : 'null';
  return { after, owners, hitTop: idOf(hitTop), hitBot: idOf(hitBot), btnRect: { w: b.width, h: b.height } };
});
console.log(JSON.stringify(r, null, 2));
console.log('pageerrors:', errs.slice(0, 3));
await ctx.close();
