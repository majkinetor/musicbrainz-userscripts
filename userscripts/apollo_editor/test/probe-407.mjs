// #407 — auto-match an unset release Label to its unique exact MusicBrainz hit.
// Loads a real /edit page, forces the label into an unresolved state (name, no gid)
// before Apollo mounts, opens the Tracklist tab (→ loadAndRender → matchReleaseLabels),
// and asserts the label resolved. Also checks the Matching-tab "Label" checkbox.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');

const CODE = await readFile('C:/Work/mb-userscripts/userscripts/apollo_editor/apollo_editor.user.js', 'utf8');
const REL = '43794b9b-ac76-4591-807f-c192d6258ba0';   // Ko Sira — label "World Circuit" (unique exact)
const WC_GID = 'ad3947c8-2a1e-45b7-a41b-fd0f4d1065bc';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1600, height: 1050 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.addInitScript(() => { window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'Apollo', version: 'test' } }; });
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN — run login first'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(4500);

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// 1) force unresolved BEFORE Apollo loads, so the once-guard hasn't fired
const pre = await page.evaluate(() => {
  const lf = window.MB.releaseEditor.rootField.release().labels()[0];
  lf.label(window.MB.entity({ name: 'World Circuit', entityType: 'label' }, 'label'));
  const e = lf.label(); return { name: e && e.name, gid: e && e.gid || null };
});
ck(pre.name === 'World Circuit' && !pre.gid, 'forced an unresolved "World Circuit" label');

// 2) inject Apollo, open the Tracklist tab
await page.addScriptTag({ content: CODE });
await page.waitForTimeout(1200);
await page.evaluate(() => { const t = document.querySelector('a[href="#tracklist"]'); if (t) t.click(); });
await page.waitForTimeout(7000);

const post = await page.evaluate(() => {
  const e = window.MB.releaseEditor.rootField.release().labels()[0].label();
  return { gid: e && e.gid || null, input: (document.querySelector('#label-0') || {}).value };
});
ck(post.gid === WC_GID, `label auto-matched to World Circuit MBID (got ${post.gid})`);
ck(post.input === 'World Circuit', 'label input reflects the resolved entity');

// 3) Matching-tab "Label" checkbox present + default ON
await page.evaluate(() => { const g = document.querySelector('.tc-launch-gear'); if (g) g.click(); });
await page.waitForTimeout(600);
const ui = await page.evaluate(() => {
  const mt = [...document.querySelectorAll('.tc-tab-btn')].find(b => /matching/i.test(b.textContent)); if (mt) mt.click();
  const cb = document.querySelector('#tc-s-automatchlabel'); const row = cb && cb.closest('.tc-s-row');
  return { present: !!cb, checked: cb && cb.checked, rowText: row && row.textContent.replace(/\s+/g, ' ').trim() };
});
ck(ui.present && ui.checked === true, 'Matching tab has a "Label" checkbox, ON by default');
ck(/Tracklist.*Recordings.*Label/i.test(ui.rowText || ''), `row: "${ui.rowText}"`);
ck(errs.filter(e => !/ResizeObserver/.test(e)).length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));

// restore the real entity so a re-run starts clean (no save happens either way)
await page.evaluate((gid) => { window.MB.releaseEditor.rootField.release().labels()[0].label(window.MB.entity({ name: 'World Circuit', gid, id: 3496, entityType: 'label' }, 'label')); }, WC_GID);
console.log(fail ? `\n${fail} FAILURE(S)` : '\nALL ASSERTIONS PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
