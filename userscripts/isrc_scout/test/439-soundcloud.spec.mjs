// SoundCloud (#439), as an ISRC source and a per-track link source. ISRCs come from
// publisher_metadata.isrc through the anonymous api-v2 (client_id taken from the web
// player's JS, no login).
//
//   - a release linking a SoundCloud set: the import button shows and fills ISRCs; a
//     pasted set URL imports too (the shape of #436's "fetcher is not a function");
//   - Find links resolves each track's permalink from the set by position (title-
//     guarded), as an addable candidate, no ISRC needed;
//   - a one-track release linking a track URL imports that track's ISRC.
//
// test.musicbrainz.org (copies of the releases), with production's data
// (fixtures/ws-439*.json.gz). SoundCloud is live. Nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

const KAWAII = 'ec2449a8-3dc5-461c-80a1-e43d96345613';   // Kawaiitrap Nitecore, links a set
const SET = 'https://soundcloud.com/ace-uzumakii/sets/ace-uzumakii-kawaiitrap';
const withSet = j => { if (!(j.relations || []).some(x => /soundcloud\.com/.test(x.url?.resource || ''))) (j.relations = j.relations || []).push({ url: { resource: SET } }); };
const filled = page => page.evaluate(() => [...document.querySelectorAll('#ii-modal tbody input')].filter(i => i.dataset.autofill === '1' && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(i.value.trim())).length);
test.use({ gm: { name: 'ISRC Scout' } });

test('a SoundCloud set fills ISRCs, and a pasted set URL imports', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: KAWAII, replay: new URL('./fixtures/ws-439.json.gz', import.meta.url), edit: withSet });
  await page.waitForTimeout(600);
  check(await page.evaluate(() => getComputedStyle(document.getElementById('ii-sc-all')).display !== 'none'), 'the SoundCloud import button shows');
  await page.click('#ii-sc-all');
  await page.waitForFunction(() => /SoundCloud done|SoundCloud \d+\/|SoundCloud .*failed/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(800);
  let log = await logText(page);
  check(/SoundCloud set ".*": \d+ track/.test(log) && /SoundCloud done/.test(log), 'the set came back through api-v2, and the import finished');
  check(await filled(page) >= 1, `ISRCs were filled (${await filled(page)})`);
  await page.click('#ii-url-btn');
  await page.waitForTimeout(200);
  await page.fill('#ii-url-input', SET);
  await page.press('#ii-url-input', 'Enter');
  await page.waitForFunction(() => /importing pasted album/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  log = await logText(page);
  check(/importing pasted album/.test(log) && !/fetcher is not a function/.test(log), 'the pasted set URL imports');
  await ws.done();
});

test('Find links resolves each track\'s SoundCloud permalink from the set', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: KAWAII, replay: new URL('./fixtures/ws-439-links.json.gz', import.meta.url), edit: withSet });
  await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="sc"]').length > 0, null, { timeout: 20000 });
  await page.click('#ii-links-btn');
  await page.waitForFunction(() => document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sc"], #ii-modal .ii-tl.absent[data-code="sc"]').length > 0, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ n: document.querySelectorAll('#ii-modal .ii-tl.new[data-code="sc"]').length, href: (document.querySelector('#ii-modal .ii-tl.new[data-code="sc"]') || {}).href || '' }));
  check(r.n >= 1, `per-track SoundCloud links resolve as addable (${r.n})`);
  check(/soundcloud\.com\/[^/]+\/(?!sets\/)/.test(r.href), `a track permalink, not the set ("${r.href}")`);
  await ws.done();
});

test('a one-track release linking a SoundCloud track imports its ISRC', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: '6e569b63-124b-47a6-ba2f-e8af96d2d1bc', replay: new URL('./fixtures/ws-439-track.json.gz', import.meta.url) });   // Ice Punch!
  await page.waitForTimeout(400);
  check(await page.evaluate(() => getComputedStyle(document.getElementById('ii-sc-all')).display !== 'none'), 'the SoundCloud button shows');
  await page.click('#ii-sc-all');
  await page.waitForFunction(() => /SoundCloud done|SoundCloud .*failed/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(500);
  check(/SoundCloud track/.test(await logText(page)), 'the track URL is read as a one-track release');
  check(await filled(page) >= 1, `its ISRC was filled (${await filled(page)})`);
  await ws.done();
});
