// #819: a removed cover that a new one replaces says by what in its edit note: the new image, its size, and the
// edit that added it, read from the "your edit has been entered" banner on the page the add redirects to.
//
// For real on test.musicbrainz.org: a release made for the run gets a cover, Art Station rotates it (a rotated
// copy is added and the original removed), and the removal's note is read back from the edit's own page.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, check, until, pristine, pristineCover, SANDBOX, idle } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

// a real, decodable PNG to stand in for the archive's original: the sandbox's archive sends no CORS headers
const ICON_PNG = readFileSync(fileURLToPath(new URL('../icon.png', import.meta.url)));

test.use({ gm: { name: 'Art Station', values: {} } });

test('#819: the removal of a rotated cover names the image and the edit that replace it', { tag: ['@sandbox', '@login', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(300000);
  const { mbid: release } = await pristine(page, 'release');
  await pristineCover(page, release);
  // the cover's add applied (testing servers can): removing a cover whose add is still open adds the note to that add
  await page.goto(`${SANDBOX}/release/${release}/open_edits`, { waitUntil: 'load' });
  for (const href of await page.$$eval('a[href*="/test/accept-edit/"]', as => as.map(a => a.href))) await page.goto(href, { waitUntil: 'load' });

  await page.route(u => /coverartarchive\.org$/.test(u.hostname) && /\.(jpg|jpeg|png|gif)(\?|$)/i.test(u.pathname),
    r => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: ICON_PNG }));
  await openArtStation(page, inject, { release });
  await page.click('.as-card:not(.new) .as-thumb');
  await until(() => page.evaluate(() => !!document.querySelector('.as-lb-rot[data-deg="90"]')), Boolean, { timeout: 10000 });
  await page.click('.as-lb-rot[data-deg="90"]');
  await until(() => page.evaluate(() => document.querySelectorAll('.as-card.new').length === 1 && document.querySelectorAll('.as-card.del').length === 1), Boolean, { timeout: 30000 });
  await page.click('.as-lb-x');

  await until(() => page.evaluate(() => !document.querySelector('.as-commit')?.disabled), Boolean);
  await page.click('.as-commit');
  await until(() => page.evaluate(() => !!document.querySelector('#as-commit .as-cm-go')), Boolean);
  await page.click('#as-commit .as-cm-go');
  const sts = await until(() => page.evaluate(() => [...document.querySelectorAll('#as-commit .as-cm-st')].map(e => e.textContent)), s => s.length && s.every(x => '✅❌⛔'.includes(x)), { timeout: 180000 });
  check(sts.every(x => x === '✅'), `every edit went in (${sts.join(' ')})`);

  // the removal, read back from the release's open edits (after the reload a clean run ends with): Art Station's add,
  // removal and reorder
  await page.waitForLoadState('domcontentloaded');
  const listIds = async () => {
    try {
      await page.goto(`${SANDBOX}/release/${release}/open_edits`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/edit/"]')].map(a => (a.getAttribute('href').match(/\/edit\/(\d+)\/?$/) || [])[1]).filter(Boolean))]);
    } catch (e) { return []; }   // the page's own reload took over
  };
  const ids = await until(listIds, x => x.length >= 3, { timeout: 60000, every: 3000 });
  const edits = [];
  for (const id of ids.slice(0, 6)) {
    await page.goto(`${SANDBOX}/edit/${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    edits.push(await page.evaluate(id => ({ id, head: (document.querySelector('h1') || {}).textContent || '', text: (document.querySelector('#content') || document.body).innerText,
      links: [...document.querySelectorAll('.edit-notes a[href]')].map(a => a.href) }), id));
  }
  const add = edits.find(e => /Add cover art/.test(e.head) && /Rotated 90°/.test(e.text));
  const rem = edits.find(e => /Remove cover art/.test(e.head));
  check(!!add && !!rem, `the add and the removal are on the release (${edits.map(e => e.id + ' ' + e.head.replace(/\s+/g, ' ').trim().slice(0, 40)).join(' | ')})`);
  if (!add || !rem) return;
  const note = rem.text.replace(/\s+/g, ' ');   // MusicBrainz shortens a long URL in a note's text: its link has it whole
  console.log(note + '\n' + rem.links.join('\n'));
  check(/Replaced by \S+ \(\d+×\d+, [\d.]+ [KM]?B\), this image rotated 90°/.test(note), 'the note names the new image, its size and the rotation');
  check(rem.links.some(u => new RegExp(`^https://coverartarchive\\.org/release/${release}/\\d+\\.jpg$`).test(u)), '…links the new image');
  check(/Added in /.test(note) && rem.links.includes(`${SANDBOX}/edit/${add.id}`), `…and the edit that added it, #${add.id}`);
});
