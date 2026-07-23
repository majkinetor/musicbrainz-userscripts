// #456 UI polish — (a) the [a:X] stop-at-character slice, (b) a clear-✕ inside the pattern
// input (shown only when it has a value), (c) the paste box is vertically resizable, (d) raw
// cells show full selectable text (no ellipsis clipping, so you can select spans to bind).
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

const sd = await page.evaluate(() => window.__apolloEditor.tpCompile('#[1:.] T').exec('12. So What'));
ck(sd && sd.pos === '12' && sd.title === 'So What', `engine #[1:.] T -> pos=${sd && sd.pos} title=${sd && sd.title}`);
await page.evaluate(() => window.__apolloEditor.openTrackPatternParser(0));
await page.waitForSelector('#tc-tpppop');
ck(await page.evaluate(() => getComputedStyle(document.querySelector('#tc-tpppop .tc-tpp-piclr')).display !== 'none'), 'clear-x visible when the pattern input has a value');
await page.click('#tc-tpppop .tc-tpp-piclr');
await page.waitForTimeout(150);
const ac = await page.evaluate(() => ({ val: document.querySelector('#tc-tpppop .tc-tpp-pi').value, shown: getComputedStyle(document.querySelector('#tc-tpppop .tc-tpp-piclr')).display !== 'none' }));
ck(ac.val === '' && !ac.shown, 'clicking clear empties the pattern and hides the x');
ck(await page.evaluate(() => getComputedStyle(document.querySelector('#tc-tpppop .tc-tpp-ta')).resize === 'vertical'), 'paste textarea is vertically resizable');
await page.evaluate(() => document.querySelector('#tc-tpppop .tc-tpp-src').classList.remove('tc-collapsed'));
await page.fill('#tc-tpppop .tc-tpp-pi', '#. T');
await page.fill('#tc-tpppop .tc-tpp-ta', '01 A very very very very very very very very long garbage raw line that would otherwise be truncated');
await page.waitForTimeout(200);
const rs = await page.evaluate(() => { const c = document.querySelector('#tc-tpppop tbody tr .tc-tpp-raw'); const s = getComputedStyle(c); return { ws: s.whiteSpace, to: s.textOverflow, notClipped: c.scrollWidth <= c.clientWidth + 1 }; });
ck(rs.ws === 'normal' && rs.to !== 'ellipsis' && rs.notClipped, 'raw cell shows full selectable text (no ellipsis clip): ' + JSON.stringify(rs));
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
