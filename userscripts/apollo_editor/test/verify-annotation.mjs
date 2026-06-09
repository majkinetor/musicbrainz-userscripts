// verify the annotation editor on a real (beta) release editor: the toolbar injects next to
// #annotation, Preview renders MB markup, and Markdown→MB / Clear write through to MB's editor model.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const SEED_PATH = resolve(HERE, 'seed-saigon.local.json');
const ORIGIN = process.env.TC_ORIGIN || 'https://beta.musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const log = (...a) => console.log('[verify-annotation]', ...a);

if (!existsSync(SEED_PATH)) { console.error('missing seed'); process.exit(2); }
const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });
ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('dialog', d => d.accept());   // auto-accept the Clear confirm()

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN to ' + ORIGIN + ' — re-login the .pw-profile'); await ctx.close(); process.exit(3); }
await page.evaluate(({ origin, params }) => {
  const f = document.createElement('form'); f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
  const add = (n, v) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i); };
  for (const [k, v] of Object.entries(params)) Array.isArray(v) ? v.forEach(x => add(k, x)) : add(k, v);
  document.body.appendChild(f); f.submit();
}, { origin: ORIGIN, params: seed });
await page.waitForLoadState('domcontentloaded');
if (await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0)) {
  await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
  await page.waitForLoadState('domcontentloaded');
}
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length; } catch { return false; } }, null, { timeout: 120000 });
log('editor ready');
await page.addScriptTag({ content: scriptCode });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });

// The Information tab is the default; wait for the annotation field + our toolbar to appear.
await page.waitForSelector('#annotation', { timeout: 20000 });
await page.waitForSelector('#tc-anno-bar', { timeout: 20000 });
log('toolbar injected');

let pass = 0, fail = 0;
const check = (label, ok, extra) => { if (ok) { pass++; console.log('  ok  ', label); } else { fail++; console.log('  FAIL', label, extra ?? ''); } };

// discover the annotation model accessor once
const modelPath = await page.evaluate(() => {
  try { const r = window.MB.releaseEditor.rootField.release(); return typeof r.annotation === 'function' ? 'release().annotation()' : (typeof r.annotation === 'string' ? 'release().annotation' : 'none'); } catch { return 'error'; }
});
log('annotation model accessor:', modelPath);
const readModel = () => page.evaluate(() => { try { const r = window.MB.releaseEditor.rootField.release(); return typeof r.annotation === 'function' ? r.annotation() : r.annotation; } catch { return '<unreadable>'; } });

const btnCount = await page.$$eval('#tc-anno-bar button', bs => bs.length);
check('4 toolbar buttons', btnCount === 4, 'got ' + btnCount);

// 1. type Markdown straight into the textarea, then convert
await page.fill('#annotation', '## Notes\n\nSee [the label](https://example.com/x) and **bold** text.');
await page.click('#tc-anno-md');
const afterMd = await page.inputValue('#annotation');
check('MD→MB transformed textarea', afterMd.includes('== Notes ==') && afterMd.includes('[https://example.com/x|the label]') && afterMd.includes("'''bold'''"), JSON.stringify(afterMd));
const modelAfterMd = await readModel();
check('MD→MB propagated to MB model', modelAfterMd === afterMd, 'model=' + JSON.stringify(modelAfterMd));

// 2. Preview renders the markup
await page.click('#tc-anno-preview-btn');
await page.waitForTimeout(200);
const prevVisible = await page.isVisible('#tc-anno-preview');
const prevHtml = await page.$eval('#tc-anno-preview', e => e.innerHTML);
check('preview visible', prevVisible);
check('preview rendered h2 + link + bold', /<h2 class="tc-anno-h">Notes<\/h2>/.test(prevHtml) && /<a href="https:\/\/example\.com\/x"/.test(prevHtml) && /<b>bold<\/b>/.test(prevHtml), prevHtml);

// 3. Clear empties textarea + model (dialog auto-accepted)
await page.click('#tc-anno-clear');
await page.waitForTimeout(150);
const afterClear = await page.inputValue('#annotation');
const modelAfterClear = await readModel();
check('Clear emptied textarea', afterClear === '', JSON.stringify(afterClear));
check('Clear propagated to MB model', modelAfterClear === '' , 'model=' + JSON.stringify(modelAfterClear));

await page.screenshot({ path: resolve(HERE, 'logs/verify-annotation.png'), fullPage: false }).catch(() => {});
console.log(`\n${pass} passed, ${fail} failed`);
await ctx.close();
process.exit(fail ? 1 : 0);
