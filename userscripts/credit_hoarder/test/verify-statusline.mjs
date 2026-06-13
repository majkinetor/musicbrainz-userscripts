// #118 follow-up: the toolbar status line must reflect the in-place "Checking
// artists/places … N/M done — checking X, Y" progress, not just new log lines.
// Opens Midwest Funk (many entities → slow preflight), clicks import, polls the
// status element, and asserts it shows a "Checking … N/M" value.
import { launchTestContext, openReleasePage, injectUserscript, clickImport } from './lib/browser.js';

const url = 'https://musicbrainz.org/release/62a764a8-cf05-459c-a358-2c65dbf0b729';
const context = await launchTestContext({ headed: false });
const page = await openReleasePage(context, url);
await injectUserscript(page);
await clickImport(page);

const seen = new Set();
for (let i = 0; i < 30; i++) {
  const txt = await page.evaluate(() => { const e = document.querySelector('.discogs-bar-status'); return e && e.style.display !== 'none' ? (e.textContent || '').trim() : ''; });
  if (txt) seen.add(txt);
  await page.waitForTimeout(500);
}
const all = [...seen];
const checking = all.filter(t => /Checking .*\d+\/\d+ done/.test(t));
console.log('distinct status values seen:', all.length);
console.log('checking-progress samples:');
checking.slice(0, 8).forEach(t => console.log('  •', t.slice(0, 110)));
console.log(checking.length ? 'PASS — status line reflected the in-place checking progress' : 'FAIL — never saw a "Checking N/M" status');
await context.close();
process.exit(checking.length ? 0 : 1);
