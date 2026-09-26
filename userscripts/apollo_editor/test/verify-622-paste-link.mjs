// #622 (majkinetor): "Paste link in Length Parser — It would be nice if we can CTRL+v like in AS
// so external link is parsed the same way release links are parsed."
//
// test.musicbrainz.org, nothing submitted. The "external page" is a fake host served by
// Playwright (never reaches the network). Checks: a pasted URL on the open parser is fetched and
// parsed like a favicon click (source credited in the edit note on Apply); pasted plain text goes
// into the box; a URL pasted into some OTHER field on the page is left alone; once the parser is
// closed a paste does nothing. APOLLO_SRC=<old build> to watch it ignore the paste.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = process.env.APOLLO_SRC || resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://test.musicbrainz.org';
const FAKE = 'https://tracklist.example.test/album/622';
const log = (...a) => console.log('[verify-622]', ...a);
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1600, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// belt and braces: this test must never submit anything
await page.route('**/ws/js/edit/**', r => { log('BLOCKED write', r.request().method(), r.request().url()); return r.abort(); });
// the fake external page — a Bandcamp-ish tracklist with nav noise around it
let fakeHits = 0;
await page.route(FAKE, r => {
  fakeHits++;
  const rows = ['3:01', '3:02', '3:03'].map((d, i) => `<tr><td>${i + 1}</td><td>Song ${i + 1}</td><td>${d}</td></tr>`).join('');
  return r.fulfill({ status: 200, contentType: 'text/html', headers: { 'Access-Control-Allow-Origin': '*' }, body: `<html><body><nav>Home</nav><table>${rows}</table><footer>© 2026</footer></body></html>` });
});
// the userscript runs as a plain page script here, so give it a GM_xmlhttpRequest (fetch-backed)
await ctx.addInitScript(() => {
  window.GM_getValue = (k, d) => d; window.GM_setValue = () => {}; window.GM_info = { script: { name: 'apollo', version: 'test' } };
  window.GM_xmlhttpRequest = async o => { try { const r = await fetch(o.url, { method: o.method || 'GET' }); o.onload && o.onload({ status: r.status, responseText: await r.text(), finalUrl: r.url }); } catch (e) { o.onerror && o.onerror(e); } };
});

await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { log('NOT LOGGED IN on', ORIGIN); await ctx.close(); process.exit(3); }
const seed = { name: 'Apollo 622 test ' + Date.now(), 'artist_credit.names.0.name': 'Apollo Test Artist', type: ['album'], 'mediums.0.format': 'CD', edit_note: '#622 verification' };
['one', 'two', 'three'].forEach((t, i) => { seed[`mediums.0.track.${i}.name`] = 'track ' + t; seed[`mediums.0.track.${i}.artist_credit.names.0.name`] = 'Apollo Test Artist'; });
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
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums()[0].tracks().length === 3; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: scriptCode });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
await page.waitForTimeout(1200);

// a real Ctrl+V: a paste event carrying clipboardData, dispatched at whatever has focus
const paste = (text, selector) => page.evaluate(([text, selector]) => {
  const dt = new DataTransfer(); dt.setData('text/plain', text);
  const target = selector ? document.querySelector(selector) : (document.activeElement || document.body);
  if (selector && target && target.focus) target.focus();
  const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
  (target || document.body).dispatchEvent(ev);
  return ev.defaultPrevented;
}, [text, selector || null]);
const state = () => page.evaluate(() => {
  const p = document.getElementById('tc-lppop'); if (!p) return null;
  return { vals: [...p.querySelectorAll('.tc-lp-val')].map(i => i.value), ta: p.querySelector('.tc-lp-ta').value, foot: p.querySelector('.tc-lp-cnt').textContent,
    chooser: getComputedStyle(p.querySelector('.tc-lp-choose')).display !== 'none', hint: (p.querySelector('.tc-lp-clbl') || {}).textContent || '' };
});

// 1) a URL pasted onto the chooser (focus on the page, nothing typed)
await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.__apolloEditor.openLengthParser(0); });
await page.waitForSelector('#tc-lppop .tc-lp-ta');
const s0 = await state();
ck(s0.chooser && /Ctrl\+V/.test(s0.hint), `the chooser says a link can be pasted: "${s0.hint}"`);
const prevented = await paste(FAKE);
await page.waitForFunction(() => document.querySelectorAll('#tc-lppop .tc-lp-val').length >= 3, null, { timeout: 10000 }).catch(() => {});
const s1 = await state();
log('after URL paste:', JSON.stringify(s1));
ck(prevented && fakeHits === 1, `the paste was taken and the page fetched once (${fakeHits})`);
ck(JSON.stringify(s1.vals) === JSON.stringify(['3:01', '3:02', '3:03']), 'its lengths are read: 3:01 · 3:02 · 3:03 (nav/footer noise skipped)');
ck(/from external link/.test(s1.foot) && !s1.chooser, `…as an external source: "${s1.foot}"`);

// 2) Apply → the pasted link is credited in the edit note, like a favicon click
const okBtn = page.locator('#tc-lppop .tc-lp-ok');
if (await okBtn.isDisabled()) ck(false, 'Apply is disabled — the pasted link was never read');
else await okBtn.click();
await page.waitForTimeout(500);
const note = await page.evaluate(() => (document.getElementById('edit-note-text') || {}).value || '');
const lens = await page.evaluate(() => window.MB.releaseEditor.rootField.release().mediums()[0].tracks().map(t => t.formattedLength() || ''));
ck(JSON.stringify(lens) === JSON.stringify(['3:01', '3:02', '3:03']), `applied: ${JSON.stringify(lens)}`);
ck(note.includes('Track lengths from ' + FAKE), 'the edit note credits the pasted link');

// 3) plain text pasted onto the chooser goes into the box
await page.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); window.__apolloEditor.openLengthParser(0); });
await page.waitForSelector('#tc-lppop .tc-lp-ta');
await paste('1. a 4:01\n2. b 4:02');
const s3 = await state();
ck(!s3.chooser && /4:01/.test(s3.ta) && JSON.stringify(s3.vals) === JSON.stringify(['4:01', '4:02']) && !/external/.test(s3.foot), `plain text lands in the box and is parsed (${JSON.stringify(s3.vals)})`);

// 4) a URL pasted into some OTHER field on the page is none of the parser's business
const hitsBefore = fakeHits;
const otherPrevented = await paste(FAKE, '#name');
await page.waitForTimeout(400);
ck(!otherPrevented && fakeHits === hitsBefore, 'a URL pasted into the release title field is left alone');

// 5) closed → the listener is gone
await page.keyboard.press('Escape').catch(() => {});
await page.evaluate(() => document.getElementById('tc-lppop') && document.querySelector('#tc-lppop .tc-lp-x').click());
await page.waitForTimeout(200);
const closedPrevented = await paste(FAKE);
await page.waitForTimeout(400);
ck(!(await page.$('#tc-lppop')) && !closedPrevented && fakeHits === hitsBefore, 'after closing, a paste does nothing');

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close(); process.exit(fail ? 1 : 0);
