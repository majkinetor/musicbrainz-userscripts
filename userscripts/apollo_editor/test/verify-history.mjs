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

check('5 buttons incl. History on an edit page', (await page.$$eval('#tc-anno-bar button', b => b.length)) === 5);
check('History button present', await page.$('#tc-anno-history-btn') !== null);

await page.click('#tc-anno-history-btn');
await page.waitForSelector('#tc-anno-history .tc-hist-row', { timeout: 15000 });
const rows = await page.$$eval('#tc-anno-history .tc-hist-row', rs => rs.map(r => r.textContent));
check('version list loaded (>=2 versions)', rows.length >= 2, JSON.stringify(rows));
check('rows show a date', /\d{4}-\d{2}-\d{2}/.test(rows[0] || ''), rows[0]);

await page.click('#tc-anno-history .tc-hist-row');
await page.waitForSelector('#tc-anno-history .tc-hist-view .tc-anno-rendered', { timeout: 15000 });
check('selecting a version shows its rendered annotation', await page.$('#tc-anno-history .tc-hist-view .tc-anno-rendered') !== null);
check('selected row highlighted', await page.$('#tc-anno-history .tc-hist-row.on') !== null);
await page.$eval('#tc-anno-wrap', e => e.scrollIntoView({ block: 'center' }));
await page.locator('#tc-anno-wrap').screenshot({ path: resolve(HERE, 'logs', 'shot-history.png') }).catch(() => {});

// History toggles back to the editor
await page.click('#tc-anno-history-btn');
check('History toggles back to the Markdown surface', await page.isVisible('#tc-anno-mdinput'));

await page.screenshot({ path: resolve(HERE, 'logs', 'verify-history.png'), fullPage: false }).catch(() => {});
console.log(`\n${pass} passed, ${fail} failed`);
await ctx.close();
process.exit(fail ? 1 : 0);
