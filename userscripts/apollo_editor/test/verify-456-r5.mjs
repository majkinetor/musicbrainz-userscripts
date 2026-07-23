// #456 round 5 — (1) ~ as "last occurrence" modifier on a char delimiter in [from:to] slices,
// fixing a title with its own "(...)" grabbing the wrong paren before the real "(length)".
// (2) "Freeze matched" — lock the current pattern onto every still-«default» row that already
// matches, so changing the pattern afterward only affects what's still unmatched (iterative
// refinement: freeze → change pattern → freeze → … until every row is solved).
import { createRequire } from 'node:module';
const { chromium } = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/')('playwright');
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const REL = '20b03c7d-9e8a-42b9-8a96-bcc9564de034';
const ctx = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } }; });
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForSelector('#release-editor, form', { timeout: 30000 }).catch(() => {});
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__apolloEditor, { timeout: 20000 });
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const buggy = await page.evaluate(() => window.__apolloEditor.tpCompile('L[(:)]').exec('Hide Me (Bop remix) - Stillhead (4:20)'));
ck(buggy && buggy.length === 'Bop remix', `reproduces the bug: plain [(:)] grabs the wrong paren (got "${buggy && buggy.length}")`);
const fixed = await page.evaluate(() => window.__apolloEditor.tpCompile('L[~(:)]').exec('Hide Me (Bop remix) - Stillhead (4:20)'));
ck(fixed && fixed.length === '4:20', `~( fixes it: L[~(:)] -> ${fixed && fixed.length}`);

await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
await page.waitForSelector('#tc-tpppop');
await page.evaluate(() => document.querySelector('#tc-tpppop .tc-tpp-src').classList.remove('tc-collapsed'));
await page.fill('#tc-tpppop .tc-tpp-pi', '#. T');
await page.fill('#tc-tpppop .tc-tpp-ta', '1. Alpha\n2. Beta\nGARBAGE Gamma GARBAGE');
await page.waitForTimeout(200);
await page.click('#tc-tpppop .tc-tpp-freeze');
await page.waitForTimeout(200);
const afterFirst = await page.evaluate(() => [...document.querySelectorAll('#tc-tpppop tbody tr')].map(tr => tr.querySelector('.tc-tpp-ov').value));
ck(afterFirst[0] === '#. T' && afterFirst[1] === '#. T' && afterFirst[2] === '', `freeze locked the 2 matched rows, left the unmatched one on default (${JSON.stringify(afterFirst)})`);
await page.fill('#tc-tpppop .tc-tpp-pi', 'GARBAGE T GARBAGE');
await page.waitForTimeout(200);
const cells = await page.evaluate(() => [...document.querySelectorAll('#tc-tpppop tbody tr')].map(tr => tr.querySelectorAll('.tc-tpp-c')[2].textContent));
ck(cells[0] === 'Alpha' && cells[1] === 'Beta' && cells[2] === 'Gamma', `frozen rows keep their titles + the new pattern solves the 3rd (${JSON.stringify(cells)})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
