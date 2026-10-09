// HDtracks, as an ISRC source and as a per-track lookup.
//
// #176: pasting an HDtracks album URL imports its ISRCs (detectSource → parseStreamingId
// → fetchHDtracks → the track table). Random Access Memories already carries all 13
// ISRCs, so the import fills nothing and reports "13 already present": proof that 13
// ISRCs came back and each matched a recording.
//
// #181: the per-track [SX] buttons are a menu of every ISRC provider available for the
// release. Picking one re-skins every per-track button and sends each lookup there; the
// bulk SoundExchange button stays as it is; a lookup only searches, it never fills.
// HDtracks is made available the way a real Platform Check install does it: an anchor
// with its confident match.
//
// test.musicbrainz.org, read-only; HDtracks is live.
import { test, check } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';   // Daft Punk — Random Access Memories
const HD = 'https://www.hdtracks.com/#/album/5e182300c10cf717bb0315f2';
test.use({ gm: { name: 'ISRC Scout' } });

test('a pasted HDtracks URL imports its 13 ISRCs', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openScout(page, inject, { release: RAM });
  await page.click('#ii-url-btn');
  await page.waitForSelector('#ii-urladd.open', { timeout: 5000 });
  await page.fill('#ii-url-input', HD);
  await page.dispatchEvent('#ii-url-input', 'input');
  check((await page.evaluate(() => document.getElementById('ii-url-btn')?.title || '')).includes('HDtracks'), 'the + button recognises HDtracks');
  await page.press('#ii-url-input', 'Enter');
  await page.waitForFunction(() => /HDtracks done/i.test(window.__isrcScoutLog?.() || ''), null, { timeout: 30000 }).catch(() => {});
  const log = await logText(page);
  check(/HDtracks album .*: 13 track\(s\)/i.test(log), '13 tracks came back from HDtracks');
  const m = log.match(/HDtracks done — (\d+) filled, (\d+) already present/i);
  check(m && +m[1] + +m[2] === 13 && +m[2] === 13, `each matched a recording that has it already (${m && m[0]})`);
});

test('the per-track provider menu re-skins the buttons, searches without filling', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  await openScout(page, inject, { release: RAM, open: false });
  // what Platform Check exposes for a confident HDtracks match
  await page.evaluate(href => {
    const a = document.createElement('a'); a.id = 'mb-online-hdtracks'; a.href = href; a.style.display = 'none';
    const row = document.createElement('div'); row.id = 'row-hdtracks'; row.className = 'pc-st-match'; row.style.display = 'none';
    document.body.append(a, row);
  }, HD);
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('#ii-modal.open', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('#ii-tbody tr[data-idx]').length > 0, null, { timeout: 45000 });

  const bulkBefore = await page.evaluate(() => document.getElementById('ii-sx-all')?.textContent?.trim());
  await page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx] .ii-sxprov').click());
  await page.waitForSelector('#ii-prov-menu.open', { timeout: 5000 });
  const providers = await page.evaluate(() => [...document.querySelectorAll('#ii-prov-menu .ii-prov-item .ii-prov-name')].map(n => n.textContent.trim()));
  check(providers.includes('SoundExchange') && providers.includes('HDtracks'), `the menu offers SoundExchange and HDtracks (${providers.join(', ')})`);
  await page.evaluate(() => [...document.querySelectorAll('#ii-prov-menu .ii-prov-item')].find(b => /HDtracks/.test(b.textContent))?.click());
  const after = await page.evaluate(() => ({
    bulk: document.getElementById('ii-sx-all')?.textContent?.trim(),
    allIcons: [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-sx')].every(b => !!b.querySelector('svg')),
    prov: document.querySelector('#ii-tbody tr[data-idx] .ii-sx')?.dataset?.prov,
    exact: getComputedStyle(document.getElementById('ii-exact-toggle')).display !== 'none',
  }));
  check(after.prov === 'hdtracks' && after.allIcons, `every per-track button now looks up HDtracks (${JSON.stringify(after)})`);
  check(after.bulk === bulkBefore && /SoundExchange/.test(after.bulk || ''), 'the bulk SoundExchange button is unchanged');
  check(after.exact, 'the exact-match controls are still shown');

  const fieldsBefore = await page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-input')].map(i => i.value));
  await page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-sx')].find(x => !x.disabled)?.click());
  const bullet = await page.waitForFunction(() => { const t = document.querySelector('#ii-tbody tr[data-idx] .ii-lookup')?.textContent?.trim(); return t && /✓|⚠|✗/.test(t) ? t : false; }, null, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => '(timeout)');
  check(/✓|⚠/.test(bullet) && /Daft Punk/.test(bullet) && !/already in MB/i.test(bullet), `one track looked up on HDtracks ("${bullet}")`);
  // a right click looks up every track
  await page.evaluate(() => document.querySelector('#ii-tbody tr[data-idx] .ii-sx').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  const resolved = await page.waitForFunction(() => { const n = [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-lookup')].filter(el => /✓|⚠/.test(el.textContent || '')).length; return n >= 13 ? n : false; }, null, { timeout: 45000 }).then(h => h.jsonValue()).catch(() => 0);
  check(resolved >= 13, `a right click looks up all 13 (${resolved})`);
  const fieldsAfter = await page.evaluate(() => [...document.querySelectorAll('#ii-tbody tr[data-idx] .ii-input')].map(i => i.value));
  check(JSON.stringify(fieldsBefore) === JSON.stringify(fieldsAfter), 'lookups fill nothing');
});
