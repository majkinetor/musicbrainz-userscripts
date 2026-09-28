// #118 follow-up: the toolbar's status line shows the in-place "Checking artists/places
// … N/M done — checking X, Y" progress, not only new log lines.
//
// test.musicbrainz.org: Midwest Funk (many entities, so a slow preflight); the import
// is started and the status sampled for 15 s. Nothing is staged or submitted.
import { test, check, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';
import { openReleasePage, clickImport } from './lib/browser.js';

const GM_INFO = "window.GM_info = window.GM_info || { script: { name: 'Credit Hoarder (test)', version: 'test' }, scriptHandler: 'Playwright', version: 'test' };\n";
test.use({ gm: false });

test('the status line follows the artist checks as they progress', { tag: ['@sandbox', '@login'] }, async ({ context, inject }) => {
  const page = await openReleasePage(context, `${SANDBOX}/release/62a764a8-cf05-459c-a358-2c65dbf0b729`);
  await requireLogin(page);
  await inject('credit_hoarder', { target: page, transform: code => GM_INFO + code });
  await page.waitForSelector('.discogs-bar', { timeout: 30_000 });
  await clickImport(page);

  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    const txt = await page.evaluate(() => { const e = document.querySelector('.discogs-bar-status'); return e && e.style.display !== 'none' ? (e.textContent || '').trim() : ''; });
    if (txt) seen.add(txt);
    await page.waitForTimeout(500);
  }
  const checking = [...seen].filter(t => /Checking .*\d+\/\d+ done/.test(t));
  check(checking.length > 0, `the status showed "Checking … N/M done" (${checking.slice(0, 3).join(' | ') || [...seen].slice(0, 3).join(' | ') || 'nothing'})`);
  await page.close();
});
