// #456 round 4 — (1) [X:Y] char-start slice, (2) chip bar lives on <body> so the modal's transform
// doesn't misplace it, (3) a clear-✕ on each per-row override input, (4) the parser opens seeded with
// the current tracklist in the #. T - A (L) format (like the native parser). Read-only.
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

// (1) char-start slice via API
const cs = await page.evaluate(() => window.__apolloEditor.tpCompile('L[(:)]').exec('So What (9:22)'));
ck(cs && cs.length === '9:22', `char-start slice L[(:)] -> ${cs && cs.length}`);

// (4) opens seeded with the current tracklist + pattern #. T - A (L)
await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
await page.waitForSelector('#tc-tpppop');
const seeded = await page.evaluate(() => ({ pat: document.querySelector('#tc-tpppop .tc-tpp-pi').value, taLines: document.querySelector('#tc-tpppop .tc-tpp-ta').value.split('\n').filter(Boolean).length, rows: document.querySelectorAll('#tc-tpppop tbody tr').length }));
ck(seeded.pat === '#. T - A (L)', `opens with pattern "#. T - A (L)" (got "${seeded.pat}")`);
ck(seeded.taLines > 0 && seeded.rows === seeded.taLines, `paste box seeded with the current tracklist (${seeded.taLines} lines → ${seeded.rows} rows)`);

// (2) chip bar is a direct child of <body>, not inside the modal
ck(await page.evaluate(() => { const b = document.querySelector('.tc-tpp-chipbar'); return !!b && b.parentElement === document.body; }), 'chip bar is appended to <body> (transform-safe positioning)');

// (3) per-row override clear-✕: set an override → clear shows → click clears it
await page.fill('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ov', 'T[1:.]');
await page.waitForTimeout(150);
ck(await page.evaluate(() => document.querySelector('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ovwrap').classList.contains('has')), 'override clear-✕ shows when the row has an override');
await page.click('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ovclr');
await page.waitForTimeout(150);
ck(await page.evaluate(() => document.querySelector('#tc-tpppop tbody tr:nth-child(1) .tc-tpp-ov').value === ''), 'clicking the override ✕ clears that row’s pattern');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
