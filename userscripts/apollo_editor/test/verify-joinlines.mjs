// Verify (1) the new "Join lines" toolbar button reflows selected lines, and
// (2) toggling Apollo OFF tears the annotation editor down (native field returns, no toolbar).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = process.env.TC_ORIGIN || 'https://beta.musicbrainz.org';
const seed = JSON.parse(await readFile(resolve(HERE, 'seed-saigon.local.json'), 'utf8'));
const scriptCode = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1280, height: 1300 }, deviceScaleFactor: 3 });
ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(({ origin, params }) => { const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none'; const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); }; for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v); document.body.appendChild(f); f.submit(); }, { origin: ORIGIN, params: seed });
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) { await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click(); await page.waitForLoadState('domcontentloaded'); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: scriptCode });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 20000 });

let pass = 0, fail = 0;
const eq = (label, got, want) => { if (got === want) { pass++; console.log('  ok  ', label); } else { fail++; console.log('  FAIL', label, '\n        got: ', JSON.stringify(got), '\n        want:', JSON.stringify(want)); } };

// ── (1) Join lines ──────────────────────────────────────────────────────────
const content = ['Recorded at Some Studio, mixed by Another Person over a long', 'sentence that wraps onto several physical lines', 'in the imported source.'].join('\n');
await page.fill('#tc-anno-mdinput', content);
await page.waitForTimeout(150);
// select the whole thing and click Join
await page.$eval('#tc-anno-mdinput', el => { el.focus(); el.setSelectionRange(0, el.value.length); });
await page.click('#tc-anno-join');
await page.waitForTimeout(150);
const mdAfter = await page.$eval('#tc-anno-mdinput', el => el.value);
eq('Join merged the wrapped lines into one (no newline)', mdAfter, 'Recorded at Some Studio, mixed by Another Person over a long sentence that wraps onto several physical lines in the imported source.');
const rawAfter = await page.$eval('#annotation', el => el.value);
eq('hidden MB field stays in sync after Join', rawAfter, mdAfter);

// screenshot the toolbar showing the new Join button (between Clear and the markup switch)
const clip = await page.$eval('#tc-anno-wrap', e => { const r = e.getBoundingClientRect(); return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 40), width: Math.min(r.width + 20, 1270), height: 150 }; });
await page.evaluate(y => window.scrollTo(0, Math.max(0, y)), clip.y);
const clip2 = await page.$eval('#tc-anno-wrap', e => { const r = e.getBoundingClientRect(); return { x: Math.max(0, r.x - 10), y: Math.max(0, r.y - 10), width: Math.min(r.width + 20, 1270), height: 130 }; });
await page.screenshot({ path: resolve(HERE, 'logs', 'verify-join-toolbar.png'), clip: clip2 });

// ── (2) Apollo OFF tears the editor down ─────────────────────────────────────
const beforeOff = await page.evaluate(() => ({ wrap: !!document.querySelector('#tc-anno-wrap'), bar: !!document.querySelector('#tc-anno-bar') }));
eq('editor mounted while Apollo on', JSON.stringify(beforeOff), JSON.stringify({ wrap: true, bar: true }));
await page.click('#tc-launch .tc-launch-lbl');   // global toggle → Apollo off
await page.waitForTimeout(400);
const afterOff = await page.evaluate(() => {
  const ta = document.getElementById('annotation');
  return { wrap: !!document.querySelector('#tc-anno-wrap'), bar: !!document.querySelector('#tc-anno-bar'), riOn: document.body.classList.contains('tc-ri-on'), nativeVisible: !!ta && ta.offsetParent !== null && getComputedStyle(ta).display !== 'none' };
});
eq('Apollo off → toolbar gone', afterOff.bar, false);
eq('Apollo off → editor wrap gone', afterOff.wrap, false);
eq('Apollo off → tc-ri-on removed', afterOff.riOn, false);
eq('Apollo off → native #annotation visible', afterOff.nativeVisible, true);

// toggle back ON and confirm it remounts
await page.click('#tc-launch .tc-launch-lbl');
await page.waitForTimeout(400);
const backOn = await page.evaluate(() => ({ bar: !!document.querySelector('#tc-anno-bar'), join: !!document.querySelector('#tc-anno-join') }));
eq('Apollo back on → toolbar (with Join) remounts', JSON.stringify(backOn), JSON.stringify({ bar: true, join: true }));

console.log(`\n${pass} passed, ${fail} failed`);
await ctx.close();
process.exit(fail ? 1 : 0);
