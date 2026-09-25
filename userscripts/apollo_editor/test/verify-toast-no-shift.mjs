// majkinetor: "it doesn't seem like a good idea to show messages in the toolbar as it moves
// buttons around" (the split result pushed "Split medium" onto a second row). Messages now go
// to the shared floating toast (mbuToast) and the toolbar keeps its layout.
//
// test.musicbrainz.org release editor, nothing submitted: put Merge + Split on the bar,
// record every toolbar button's position, trigger a harmless refusal toast (Merge with one
// medium ticked → "Merge: tick at least two mediums"), and check: the message is in the
// floating toast (amber), not in the toolbar, and no button moved. APOLLO_SRC=<old build>.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js'), 'utf8');
const REL = process.argv[2] || 'c16af706-4926-4248-80c5-5faee767d579';   // sandbox, several media
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1250, height: 900 } });
await ctx.addInitScript(() => { const s = new Map(); window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d; window.GM_setValue = (k, v) => s.set(k, v); window.GM_info = { script: { name: 'Apollo Editor', version: 't' } }; });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://test.musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => window.MB && MB.releaseEditor && MB.releaseEditor.rootField && MB.releaseEditor.rootField.release(), null, { timeout: 60000 });
await page.waitForTimeout(2000);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => window.__apolloEditor, null, { timeout: 20000 });
await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(x => x.textContent.trim() === 'Tracklist'); if (a) a.click(); });
await page.waitForSelector('.tc-tools', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__apolloEditor.pickTool('splitmed'); window.__apolloEditor.pickTool('mergemed'); });
await page.waitForSelector('.tc-opt[data-tool="mergemed"] .tc-mmo input', { timeout: 15000 });
await page.waitForTimeout(500);
const layout = () => page.evaluate(() => [...document.querySelectorAll('.tc-toolbtns > *, .tc-opt[data-tool] .tc-opttrig')].map(e => { const r = e.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top); }).join(' '));
const before = await layout();
// untick every medium but the first → Merge refuses with a toast; nothing changes in the release
await page.evaluate(() => { const bs = [...document.querySelectorAll('.tc-opt[data-tool="mergemed"] .tc-mmo input')]; bs.slice(1).forEach(b => { if (b.checked) b.click(); }); });
await page.click('.tc-opt[data-tool="mergemed"] .tc-opttrig');
await page.waitForTimeout(400);
const after = await layout();
const st = await page.evaluate(() => {
  const t = document.getElementById('mbu-toast');
  const bar = document.querySelector('.tc-tools') ? document.querySelector('.tc-tools').closest('#tc-mirror-wrap, .tc-bar, #tc-bar') || document.querySelector('.tc-tools').parentElement : null;
  return { toast: t ? t.textContent : null, toastOn: !!(t && t.classList.contains('mbu-toast-on')), warn: !!(t && t.classList.contains('mbu-toast-warn')), inBar: bar ? /tick at least two mediums/.test(bar.innerText) : null, media: MB.releaseEditor.rootField.release().mediums().length };
});
console.log(JSON.stringify(st));
ck(st.toastOn && /tick at least two mediums/.test(st.toast || ''), 'the message shows in the floating toast');
ck(st.warn, 'a refusal is shown as a warning (amber)');
ck(st.inBar === false, 'the toolbar carries no message text');
ck(before === after, 'no toolbar button moved' + (before === after ? '' : `\n   before: ${before}\n   after : ${after}`));
ck(st.media >= 3, 'nothing was merged (refused)');
ck(await page.evaluate(() => !document.querySelector('.tc-toast, .tc-disc-msg')), 'the toolbar has no message spans left (toast, Discogs-link note)');
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
