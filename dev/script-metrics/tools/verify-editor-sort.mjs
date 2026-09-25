// The dashboard's tables sorted text case-sensitively — every capitalised editor name came
// before every lowercase one ("Zento" before "angriestchair"). Loads a generated dashboard
// (default docs/stats.html), sorts the editors table by name via its header, and checks the
// order is case-insensitive. PAGE=<file> to check another copy.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = process.env.PAGE || resolve(HERE, '..', '..', '..', 'docs', 'stats.html');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(pathToFileURL(PAGE).href);
await page.waitForSelector('th.sortable[data-t="editors"]', { timeout: 20000 });
const keys = await page.evaluate(() => [...document.querySelectorAll('th.sortable[data-t="editors"]')].map(t => t.dataset.k + '=' + t.textContent.trim()));
console.log('editor columns:', keys.join(', '));
const nameKey = keys.map(k => k.split('=')).find(([, l]) => /editor|name/i.test(l));
ck(!!nameKey, 'found the editor-name column');
// ascending by name (click until the header says asc)
for (let i = 0; i < 3; i++) {
  const asc = await page.evaluate(k => document.querySelector(`th.sortable[data-t="editors"][data-k="${k}"]`).classList.contains('asc'), nameKey[0]);
  if (asc) break;
  await page.click(`th.sortable[data-t="editors"][data-k="${nameKey[0]}"]`);
  await page.waitForTimeout(200);
}
// every rendered editor-table row (the table may be capped — show all first if there's a toggle)
await page.evaluate(() => { const b = [...document.querySelectorAll('button, a')].find(x => /show all|all editors/i.test(x.textContent)); if (b) b.click(); });
await page.waitForTimeout(300);
const names = await page.evaluate(k => {
  const th = document.querySelector(`th.sortable[data-t="editors"][data-k="${k}"]`);
  const col = [...th.parentElement.children].indexOf(th);
  return [...th.closest('table').querySelectorAll('tbody tr')].map(tr => (tr.children[col] || {}).textContent.trim()).filter(Boolean);
}, nameKey[0]);
console.log(`${names.length} editors, first: ${names.slice(0, 5).join(' · ')} … last: ${names.slice(-3).join(' · ')}`);
const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
ck(names.length > 10, 'the editors table has rows');
ck(JSON.stringify(names) === JSON.stringify(sorted), 'sorted by name case-insensitively (lower- and upper-case names interleave)');
const firstLower = names.findIndex(n => /^[a-z]/.test(n)), lastUpper = names.map(n => /^[A-Z]/.test(n)).lastIndexOf(true);
ck(firstLower === -1 || lastUpper === -1 || firstLower < lastUpper, `not "all capitals first" (first lowercase at #${firstLower + 1}, last capital at #${lastUpper + 1})`);
ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 2)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await browser.close(); process.exit(fail ? 1 : 0);
