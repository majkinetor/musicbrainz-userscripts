// #530 (majkinetor): "Cover art URLs not available randomly": the Source popover said
// "No supported platforms linked on this release" while MusicBrainz's own tab offered
// "Import from Discogs". releaseUrls() cached [] when the url-rels request FAILED, and
// [] is truthy, so one unlucky 503 disabled sourcing for the whole page.
//
// Two follow-ups: the links are read off the page's "External links" list first,
// because the web service is sometimes very slow; and only the release's own list
// counts, not the release group's ("Discogs is mistakenly added here").
//
// test.musicbrainz.org, read-only. The url-rels answers are routed, and the link lists
// are written into the page before the script starts, so every case is deterministic.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation, RELEASE } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

const isUrlRels = u => u.hostname === 'test.musicbrainz.org' && u.pathname === `/ws/2/release/${RELEASE}` && /url-rels/.test(u.search);
const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
// the sidebar's link lists, as MusicBrainz renders them: a heading, then the list
const linkBlocks = (own, rg) => `<h2>External links</h2><ul class="external_links">${own.map(u => `<li><a href="${u}">${u}</a></li>`).join('')}</ul>`
  + (rg ? `<h2>Release group external links</h2><ul class="external_links">${rg.map(u => `<li><a href="${u}">${u}</a></li>`).join('')}</ul>` : '');
const addBlocks = (page, html) => page.evaluate(h => { const d = document.createElement('div'); d.id = 'test-links'; d.innerHTML = h; (document.getElementById('sidebar') || document.body).appendChild(d); }, html);
const popoverText = async page => {
  await page.click('.as-src');
  await page.waitForSelector('.as-src-pop', { timeout: 5000 });
  // wait for it to settle: the retry backoff is ~3 s
  await page.waitForFunction(() => { const b = document.querySelector('.as-src-prov'); return b && !/Looking for/.test(b.textContent); }, null, { timeout: 30000 });
  return (await page.locator('.as-src-prov').textContent() || '').trim();
};

test('a failed links lookup is retried, says so, and is not remembered as "no links"', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
  let hits = 0, mode = 'fail';
  await page.route(isUrlRels, r => { hits++; return r.fulfill(mode === 'fail' ? { status: 503, contentType: 'text/plain', body: 'busy' } : json({ relations: [{ url: { resource: 'https://www.discogs.com/release/1234' } }] })); });
  await openArtStation(page, inject);

  const failing = await popoverText(page);
  check(!/No supported platforms/.test(failing), `a failed lookup doesn't claim there are no platforms (${JSON.stringify(failing)})`);
  check(/[Cc]ould not read/.test(failing), 'it says the links could not be read');
  check(await page.locator('.as-src-retry').count() === 1, 'and offers a retry');
  check(hits >= 2, `transient failures were retried (${hits} requests)`);

  mode = 'ok';
  await page.click('.as-src-retry');
  await page.waitForSelector('.as-src-pop', { timeout: 5000 });
  await page.waitForFunction(() => { const b = document.querySelector('.as-src-prov'); return b && !/Looking for/.test(b.textContent); }, null, { timeout: 30000 });
  const ok = (await page.locator('.as-src-prov').textContent() || '').trim();
  check(/Discogs/.test(ok) && !/Could not read/.test(ok), `once MusicBrainz answers, Retry finds the Discogs link (${JSON.stringify(ok)})`);

  // the original bug: the empty verdict must not be sticky
  await page.evaluate(() => { const b = document.querySelector('.as-src'); for (let i = 0; i < 3; i++) { document.querySelectorAll('.as-pop').forEach(p => p.remove()); b.click(); } });
  // the reopened popover has given its verdict once it stops "Looking for"
  const again = await until(async () => (await page.locator('.as-src-prov').textContent().catch(() => '')) || '', t => t && !/Looking for/.test(t));
  check(/Discogs/.test(again), 'reopening keeps showing it');
});

test('links are read off the page, without waiting on a slow web service', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  let hits = 0;
  await page.route(isUrlRels, async r => { hits++; await new Promise(z => setTimeout(z, 12000)); return r.fulfill(json({ relations: [] })).catch(() => {}); });
  await openArtStation(page, inject, { before: () => addBlocks(page, linkBlocks(['https://www.discogs.com/release/1234'], ['https://www.discogs.com/master/5678'])) });
  const t0 = Date.now();
  const txt = await popoverText(page);
  const ms = Date.now() - t0;
  check(/Discogs/.test(txt), `the Discogs link is found while the web service stalls (${JSON.stringify(txt)}, ${hits} lookups)`);
  check((txt.match(/Import from Discogs/g) || []).length === 1, 'one Discogs button, not one per link');
  check(ms < 5000, `without waiting on it (${ms} ms; the stub takes 12 s)`);
});

test("the release group's links are not the release's", { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.route(isUrlRels, r => r.fulfill(json({ relations: [{ url: { resource: 'https://www.qobuz.com/gb-en/album/x/abc' } }] })));
  await openArtStation(page, inject, { before: () => addBlocks(page, linkBlocks(['https://www.qobuz.com/gb-en/album/x/abc'], ['https://www.discogs.com/master/5678'])) });
  const txt = await popoverText(page);
  check(!/Discogs/.test(txt), `the release group's Discogs master is not offered (${JSON.stringify(txt)})`);
});
