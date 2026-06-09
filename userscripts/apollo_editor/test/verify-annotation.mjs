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

// The Information tab is the default; wait for the annotation field (attached, may be hidden) + our toolbar.
await page.waitForSelector('#annotation', { state: 'attached', timeout: 20000 });
await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 20000 });
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

const vis = sel => page.isVisible(sel);
check('toolbar + Markdown surface + raw field all inside the box',
  await page.$eval('#tc-anno-wrap #tc-anno-bar', () => true).catch(() => false) &&
  await page.$eval('#tc-anno-body #tc-anno-edit > textarea#tc-anno-mdinput', () => true).catch(() => false) &&
  await page.$eval('#tc-anno-body #tc-anno-edit > textarea#annotation', () => true).catch(() => false));
check('4 toolbar buttons (Preview, markup, help, Clear — no Resolve/History on add)', (await page.$$eval('#tc-anno-bar button', bs => bs.length)) === 4);
check('no Resolve-names button (auto now)', await page.$('#tc-anno-names') === null);
check('help (?) button present', await page.$('#tc-anno-help') !== null);
check('Markdown surface is the default (visible); raw field hidden', (await vis('#tc-anno-mdinput')) && !(await vis('#annotation')));
check('markup toggle shows the Markdown logo (svg) in md mode', await page.$('#tc-anno-md .tc-mk-ico') !== null && !(await page.$('#tc-anno-md .tc-mk-mb')));
check('Markdown surface is monospace', /mono/i.test(await page.$eval('#tc-anno-mdinput', e => getComputedStyle(e).fontFamily)));
check('editing surface is bigger (>=220px)', (await page.$eval('#tc-anno-mdinput', e => e.getBoundingClientRect().height)) >= 220);

// NO FLICKER
await page.evaluate(() => { document.getElementById('tc-anno-wrap').dataset.tcMark = 'orig'; });
await page.waitForTimeout(1700);
check('wrapper not rebuilt across polls (no flicker)', (await page.$eval('#tc-anno-wrap', e => e.dataset.tcMark)) === 'orig');
check('still on the Markdown surface after polls', await vis('#tc-anno-mdinput'));

// 1. CORE INVARIANT: type Markdown → the real MB field + model hold MB markup
await page.fill('#tc-anno-mdinput', '## Notes\n\n- a\n- b\n\nSee [the label](https://example.com/x).');
await page.waitForTimeout(150);
const model1 = await readModel();
check('Markdown → MB markup in the model (headings/bullets/link)',
  model1.includes('== Notes ==') && model1.includes('\n    * a\n    * b') && model1.includes('[https://example.com/x|the label]') && model1.includes('Notes ==\n\n    * a'),
  JSON.stringify(model1));

// 2. markup toggle (icon) → raw MB markup, then back
await page.click('#tc-anno-md');
check('toggle shows raw MB field', (await vis('#annotation')) && !(await vis('#tc-anno-mdinput')));
check('raw field holds MB markup', (await page.inputValue('#annotation')).includes('== Notes =='));
check('markup toggle shows the MB logo in raw mode', await page.$('#tc-anno-md .tc-mk-mb') !== null);
await page.click('#tc-anno-md');                       // back to Markdown surface
check('back on Markdown surface', (await vis('#tc-anno-mdinput')) && (await page.inputValue('#tc-anno-mdinput')).includes('## Notes'));

// 3. SPLIT Preview — editor stays visible, preview renders alongside and updates live
await page.click('#tc-anno-preview-btn');
await page.waitForTimeout(150);
check('split preview: editor AND preview both visible', (await vis('#tc-anno-preview')) && (await vis('#tc-anno-mdinput')));
check('preview rendered h2 + list + link', /<h2 class="tc-anno-h">Notes<\/h2>/.test(await page.$eval('#tc-anno-preview', e => e.innerHTML)) && /<li>a<\/li>/.test(await page.$eval('#tc-anno-preview', e => e.innerHTML)));
await page.fill('#tc-anno-mdinput', '### Live');     // edit while previewing
await page.waitForTimeout(200);
check('preview updates live as you type', /<h3 class="tc-anno-h">Live<\/h3>/.test(await page.$eval('#tc-anno-preview', e => e.innerHTML)));
await page.click('#tc-anno-preview-btn');
check('preview off → editor still there', (await vis('#tc-anno-mdinput')) && !(await vis('#tc-anno-preview')));

// 3b. help popover shows on hover
await page.hover('#tc-anno-help');
await page.waitForTimeout(150);
check('help popover appears on hover', await vis('#tc-anno-help-pop'));

// 4. Bullet continuation on Enter (real keystrokes)
await page.fill('#tc-anno-mdinput', '- one');
await page.click('#tc-anno-mdinput');
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.keyboard.type('two');
check('Enter continues the bullet list', (await page.inputValue('#tc-anno-mdinput')) === '- one\n- two', JSON.stringify(await page.inputValue('#tc-anno-mdinput')));

// 5. Ctrl+B wraps the selection (Markdown ** on the surface)
await page.fill('#tc-anno-mdinput', 'make bold');
await page.$eval('#tc-anno-mdinput', e => e.setSelectionRange(5, 9));   // select "bold"
await page.keyboard.press('Control+b');
check('Ctrl+B wraps selection with **', (await page.inputValue('#tc-anno-mdinput')) === 'make **bold**', JSON.stringify(await page.inputValue('#tc-anno-mdinput')));

// 6. Clear empties both surfaces + model
await page.click('#tc-anno-clear');
await page.waitForTimeout(120);
check('Clear emptied the surface + model', (await page.inputValue('#tc-anno-mdinput')) === '' && (await readModel()) === '');

await page.screenshot({ path: resolve(HERE, 'logs/verify-annotation.png'), fullPage: false }).catch(() => {});
console.log(`\n${pass} passed, ${fail} failed`);
await ctx.close();
process.exit(fail ? 1 : 0);
