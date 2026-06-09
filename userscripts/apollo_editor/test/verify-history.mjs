// Verify the annotation History feature on a real release edit page (production, logged in): the History
// button lists past versions and clicking one displays its rendered annotation. Read-only — never submits.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.env.MBID || '933de217-cb24-4d7f-bba1-1c6fe8b72aab';
const ctx = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: true, viewport: { width: 1400, height: 1100 } });
ctx.on('page', async p => { try { const u = p.url(); if (/\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN to production'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length >= 0; } catch { return false; } }, null, { timeout: 120000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForFunction(() => !!window.__apolloEditor, null, { timeout: 15000 });
await page.waitForSelector('#tc-anno-bar', { timeout: 20000 });

let pass = 0, fail = 0;
const check = (l, ok, extra) => { if (ok) { pass++; console.log('  ok  ', l); } else { fail++; console.log('  FAIL', l, extra ?? ''); } };

check('6 buttons incl. History on an edit page', (await page.$$eval('#tc-anno-bar button', b => b.length)) === 6);
check('History button present', await page.$('#tc-anno-history-btn') !== null);

await page.click('#tc-anno-history-btn');
await page.waitForSelector('#tc-anno-history .tc-hist-card', { timeout: 15000 });
const rows = await page.$$eval('#tc-anno-history .tc-hist-card', rs => rs.map(r => r.textContent));
check('version list loaded (>=2 versions)', rows.length >= 2, JSON.stringify(rows));
check('rows show a date', /\d{4}-\d{2}-\d{2}/.test(rows[0] || ''), rows[0]);
// while History is active, other toolbar buttons are inert — except History + maximize
check('History active disables other buttons (except maximize)', await page.evaluate(() => {
  const pe = id => getComputedStyle(document.getElementById(id)).pointerEvents;
  return pe('tc-anno-preview-btn') === 'none' && pe('tc-anno-clear') === 'none' && pe('tc-anno-md') === 'none' && pe('tc-anno-help') === 'none'
    && pe('tc-anno-max') !== 'none' && pe('tc-anno-history-btn') !== 'none';
}));

await page.click('#tc-anno-history .tc-hist-card');
await page.waitForSelector('#tc-anno-history .tc-hist-view .tc-anno-rendered', { timeout: 15000 });
check('selecting a version shows its rendered annotation', await page.$('#tc-anno-history .tc-hist-view .tc-anno-rendered') !== null);
check('selected row highlighted', await page.$('#tc-anno-history .tc-hist-card.on') !== null);
// the revert (↶) button lives inside non-current cards only
check('every card has an in-card revert button (incl. current → discard session edits)', await page.evaluate(() => { const cards = [...document.querySelectorAll('#tc-anno-history .tc-hist-card')]; return cards.length > 0 && cards.every(c => c.querySelector('.tc-hist-revert')); }));
check('revert is right-aligned (meta grows to push it to the edge)', (await page.evaluate(() => { const m = document.querySelector('#tc-anno-history .tc-hist-card:not(:first-child) .tc-hist-meta'); return getComputedStyle(m).flexGrow; })) === '1');
check('revert hidden by default, shown on .on/hover (CSS rule present)', await page.evaluate(() => [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => /tc-hist-card\.on .tc-hist-revert/.test(r.cssText)); } catch { return false; } })));
const noGap = await page.evaluate(() => { const b = document.getElementById('tc-anno-history-btn'); return getComputedStyle(b).marginLeft === '0px' || getComputedStyle(b).marginLeft === 'auto' ? getComputedStyle(b).marginLeft : getComputedStyle(b).marginLeft; });
check('History button is not pushed right (no auto margin)', (await page.evaluate(() => getComputedStyle(document.getElementById('tc-anno-history-btn')).marginLeft)) !== 'auto', 'marginLeft=' + noGap);
// select a non-current card so its revert shows, then screenshot
await page.click('#tc-anno-history .tc-hist-card:not(:first-child)');
await page.waitForTimeout(200);
check('revert fully inside the list (not clipped / offscreen)', await page.evaluate(() => { const r = document.querySelector('#tc-anno-history .tc-hist-card.on .tc-hist-revert'); const l = document.querySelector('#tc-anno-history .tc-hist-list'); if (!r) return true; const rr = r.getBoundingClientRect(), lr = l.getBoundingClientRect(); return rr.right <= lr.right + 1; }));
await page.$eval('#tc-anno-wrap', e => e.scrollIntoView({ block: 'center' }));
await page.locator('#tc-anno-wrap').screenshot({ path: resolve(HERE, 'logs', 'shot-history.png') }).catch(() => {});
// click an older card's revert (NO confirm) → editor restored with that version
await page.hover('#tc-anno-history .tc-hist-card:not(:first-child)');
await page.click('#tc-anno-history .tc-hist-card:not(:first-child) .tc-hist-revert', { force: true });
await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 8000 }).catch(() => {});
check('in-card revert returns to the editor (no confirm)', await page.isVisible('#tc-anno-mdinput'));

// annoHtmlToMb reconstruction (inject the extracted function + a known rendered HTML)
const src = await readFile(SCRIPT, 'utf8');
const ext = (n) => { const s = src.indexOf('function ' + n + '('); let i = src.indexOf('{', s), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } } return src.slice(s, i); };
const mb = await page.evaluate(({ fn, html }) => { const f = new Function(fn + '; return annoHtmlToMb;')(); return f(html); }, { fn: ext('annoHtmlToMb'), html: '<h2>Title</h2><p>A <strong>bold</strong> and <em>soft</em> note with a <a href="https://e.com/x">link</a>.</p><ul><li>one</li><li>two<ul><li>sub</li></ul></li></ul><ol><li>first</li><li>second</li></ol>' });
check('annoHtmlToMb reconstructs MB markup', mb.includes('== Title ==') && mb.includes("'''bold'''") && mb.includes("''soft''") && mb.includes('[https://e.com/x|link]') && mb.includes('\n    * one') && mb.includes('\n        * sub') && mb.includes('\n    a. first'), JSON.stringify(mb));

// changelog parsing (mock the /annotations page) — one row with a changelog, one without
const histRows = await page.evaluate(({ fn, html }) => {
  const realFetch = window.fetch; window.fetch = async () => ({ ok: true, text: async () => html });
  const f = new Function('async ' + fn + '; return annoFetchHistory;')();
  return f('00000000-0000-0000-0000-000000000000').finally(() => { window.fetch = realFetch; });
}, { fn: ext('annoFetchHistory'), html: '<table><tr><th>Editor</th></tr>' +
  '<tr><td><a href="/user/bob"><img src="/av.png">bob</a></td><td>2026-06-09 10:39 UTC</td><td><a href="/release/x/annotation/123">View this version</a> (Testing change message)</td></tr>' +
  '<tr><td><a href="/user/bob">bob</a></td><td>2026-06-09 10:37 UTC</td><td><a href="/release/x/annotation/122">View this version</a> (no changelog specified)</td></tr></table>' });
check('changelog parsed from a history row', histRows[0]?.changelog === 'Testing change message', JSON.stringify(histRows));
check('"no changelog specified" → empty', histRows[1]?.changelog === '', JSON.stringify(histRows));

console.log(`\n${pass} passed, ${fail} failed`);
await ctx.close();
process.exit(fail ? 1 : 0);
