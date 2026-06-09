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

check('toolbar inside #tc-anno-wrap box', await page.$eval('#tc-anno-wrap #tc-anno-bar', () => true).catch(() => false));
check('textarea moved inside the box', await page.$eval('#tc-anno-wrap > textarea#annotation', () => true).catch(() => false));
const btnCount = await page.$$eval('#tc-anno-bar button', bs => bs.length);
check('4 toolbar buttons (no extras)', btnCount === 4, 'got ' + btnCount);
const taH = await page.$eval('#annotation', e => e.getBoundingClientRect().height);
check('textarea is bigger (>=200px)', taH >= 200, 'height ' + Math.round(taH));

// NO FLICKER: mark the wrapper, wait past 3× the 500ms applyReleaseInfo poll, assert it's the SAME node
await page.evaluate(() => { document.getElementById('tc-anno-wrap').dataset.tcMark = 'orig'; });
await page.waitForTimeout(1700);
check('wrapper not rebuilt across polls (no flicker)', (await page.$eval('#tc-anno-wrap', e => e.dataset.tcMark)) === 'orig');

// 1. Markdown TOGGLE — start in MB markup, toggle to Markdown, toggle back
await page.fill('#annotation', "= Notes =\nA '''bold''' note, see [https://example.com/x|the label].");
await page.click('#tc-anno-md');                                  // MB → Markdown
const asMd = await page.inputValue('#annotation');
check('toggle → Markdown', asMd.includes('# Notes') && asMd.includes('**bold**') && asMd.includes('[the label](https://example.com/x)'), JSON.stringify(asMd));
check('button relabels to "MB markup"', (await page.textContent('#tc-anno-md')).includes('MB markup'));
check('Markdown propagated to MB model', (await readModel()) === asMd);
await page.click('#tc-anno-md');                                  // Markdown → MB
const backToMb = await page.inputValue('#annotation');
check('toggle back → MB markup', backToMb.includes('= Notes =') && backToMb.includes("'''bold'''") && backToMb.includes('[https://example.com/x|the label]'), JSON.stringify(backToMb));
check('button relabels to "Markdown"', (await page.textContent('#tc-anno-md')).includes('Markdown'));

// 2. Preview swaps IN PLACE: textarea hidden, preview shown; toggle back restores the textarea
await page.click('#tc-anno-preview-btn');
await page.waitForTimeout(150);
check('preview shown', await page.isVisible('#tc-anno-preview'));
check('textarea hidden while previewing', !(await page.isVisible('#annotation')));
const prevHtml = await page.$eval('#tc-anno-preview', e => e.innerHTML);
check('preview rendered h1 + link + bold', /<h1 class="tc-anno-h">Notes<\/h1>/.test(prevHtml) && /<a href="https:\/\/example\.com\/x"/.test(prevHtml) && /<b>bold<\/b>/.test(prevHtml), prevHtml);
await page.click('#tc-anno-preview-btn');
await page.waitForTimeout(150);
check('textarea restored after preview off', await page.isVisible('#annotation'));

// 3. Clear empties textarea + model (dialog auto-accepted)
await page.click('#tc-anno-clear');
await page.waitForTimeout(150);
check('Clear emptied textarea', (await page.inputValue('#annotation')) === '');
check('Clear propagated to MB model', (await readModel()) === '');

await page.screenshot({ path: resolve(HERE, 'logs/verify-annotation.png'), fullPage: false }).catch(() => {});
console.log(`\n${pass} passed, ${fail} failed`);
await ctx.close();
process.exit(fail ? 1 : 0);
