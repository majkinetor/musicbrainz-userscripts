// #644: Amazon Music track links, from the release's Amazon Music album. Amazon Music shows no
// ISRCs, so it goes by the album, like Bandcamp: every track by position, its title and length
// (within 3 s) checked. Without an album link there is nothing to go on, and no slot is offered.
//
// Random Access Memories (fixtures/ws-458.json.gz: production's data on the sandbox), with its
// Amazon Music album (B00CRMWMZ0) added to the release's links. Amazon Music is live, read as a
// guest. The edit is stopped on its way out; only its link type is read.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });
const RAM = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';
const RAM_AMZ = 'https://music.amazon.com/albums/B00CRMWMZ0';
const slots = page => page.evaluate(() => document.querySelectorAll('#ii-modal .ii-tl[data-code="az"]').length);

test('#644: Amazon Music track links from the release\'s album, by position, title- and length-checked', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: RAM, replay: new URL('./fixtures/ws-458.json.gz', import.meta.url),
    edit: j => { (j.relations = j.relations || []).push({ type: 'streaming page', url: { resource: RAM_AMZ } }); },
  });
  const edits = [];
  await page.route('**/ws/js/edit/create', r => { try { edits.push(JSON.parse(r.request().postData() || '{}')); } catch (e) {} return r.abort(); });
  const cands = await until(() => page.evaluate(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="az"]').length), n => n > 0, { timeout: 20000 });
  check(cands === 13, `every track offers an Amazon Music slot (${cands})`);
  await page.click('#ii-links-btn');
  const r = await until(() => page.evaluate(() => {
    const n = sel => document.querySelectorAll('#ii-modal .ii-tl' + sel + '[data-code="az"]').length;
    return { found: n('.new'), absent: n('.absent'), spinning: n('.spin'), hrefs: [...document.querySelectorAll('#ii-modal .ii-tl.new[data-code="az"]')].map(a => a.href) };
  }), r => r.spinning === 0 && r.found + r.absent > 0, { timeout: 120000 });
  const log = await page.evaluate(() => (window.__isrcScoutLog?.() || '').split('\n').filter(l => /Amazon Music/.test(l)));
  console.log(JSON.stringify({ ...r, log: log.slice(0, 20) }, null, 1));
  check(r.found === 13, `all 13 tracks resolve (${r.found}, ${r.absent} not)`);
  check(r.hrefs.every(h => /^https:\/\/music\.amazon\.com\/tracks\/[A-Z0-9]{10}$/.test(h)) && new Set(r.hrefs).size === 13, `each its own track link (${r.hrefs.slice(0, 2).join(', ')})`);
  check(r.hrefs[4] === 'https://music.amazon.com/tracks/B00CRMX43E', `track 5 is Instant Crush's (${r.hrefs[4]})`);
  // right-click one: it goes out as a "streaming page" (979)
  await page.evaluate(() => document.querySelector('#ii-modal tr[data-idx="0"] .ii-tl.new[data-code="az"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await until(() => edits.length, n => n > 0, { timeout: 15000 });
  const e = (edits[0].edits || [])[0] || {};
  check(e.linkTypeID === 979 && (e.entities || []).some(x => /music\.amazon\.com\/tracks\//.test(x.name || '')), `submitted as a streaming page (979) (${JSON.stringify(e).slice(0, 200)})`);
  await ws.done();
});

test('#644: without an Amazon Music album link, no Amazon Music slot', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, { release: RAM, replay: new URL('./fixtures/ws-458.json.gz', import.meta.url) });
  await until(() => page.evaluate(() => document.querySelectorAll('#ii-modal .ii-tl.cand').length), n => n > 0, { timeout: 20000 });
  check(await slots(page) === 0, 'none offered');
  await ws.done();
});
