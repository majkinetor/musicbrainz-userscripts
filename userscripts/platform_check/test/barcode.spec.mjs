// Barcode lookups, on Random Access Memories (barcode 886443984059), with the release's
// HDtracks and Tidal links taken off so the barcode paths have to find them:
//
// #176: HDtracks resolves the album from the barcode search (ObjectId 5e182300…, 13 tracks).
// #182: Tidal resolves the EXACT-barcode album 211822890, not another edition; Spotify is
//       looked up by barcode too (through Wallstream since #602); a Discogs match carries
//       the barcode read from the API's identifiers. Under strict barcode confidence, a
//       link that can't be confirmed is shown greyed and can't be clicked, not as a ✓ that
//       does nothing; an exact-barcode one stays usable.
// #422: the ↻ button is the progress indicator — it spins and can't be clicked while the
//       scans run, then shows the scan time in its tooltip.
//
// test.musicbrainz.org, with production's data and every provider's answers replayed from
// fixtures/ws-182*.json.gz (RECORD_WS=1 re-records).
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc, scansDone, row, logText } from './pc.mjs';

const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const links = { drop: /hdtracks\.com|tidal\.com/ };

test.describe('default settings', () => {
  test.use({ gm: { name: 'Platform Check' } });
  test('HDtracks, Tidal and Spotify are found by barcode, and ↻ shows the scan', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    const ws = await openPc(page, inject, { release: RAM, links, settle: false, replay: new URL('./fixtures/ws-182.json.gz', import.meta.url) });
    const btn = () => page.evaluate(() => { const b = document.getElementById('mb-refresh-btn'); return { spinning: b.classList.contains('pc-scanning'), title: b.title, pe: getComputedStyle(b).pointerEvents }; });
    const busy = await btn();
    await scansDone(page);
    const done = await btn();
    check(busy.spinning && busy.pe === 'none' && /Scanning platforms/.test(busy.title), `#422: while scanning, ↻ spins and can't be clicked (${JSON.stringify(busy)})`);
    check(!done.spinning && done.pe !== 'none', '#422: …and is clickable again once done');
    check(/Refresh — clear cache and re-scan \(last scan: \d+(\.\d+)?s\)/.test(done.title), `#422: the tooltip gives the scan time ("${done.title}")`);
    check(!(await page.evaluate(() => !!document.getElementById('mb-scan-status'))), '#422: no separate status line');

    const log = await logText(page);
    const hd = await row(page, 'hdtracks');
    check(/5e182300c10cf717bb0315f2/.test(hd.url || ''), `#176: HDtracks resolves the album (${hd.url})`);
    check(hd.value === '13' && /pc-st-match/.test(hd.cls), `#176: …a match, with its 13 tracks (${hd.value}, ${hd.cls})`);
    const tidal = await row(page, 'tidal');
    check(/Barcode 886443984059 → album 211822890/.test(log) && /album\/211822890/.test(tidal.url || ''), `#182: Tidal resolves the exact-barcode album (${tidal.url})`);
    check(/Wallstream.*Spotify barcode lookup 886443984059/.test(log), '#182, #602: Spotify is looked up by barcode');
    check(/API detail parsed:.*barcode=\d/.test(log), '#182: the Discogs match carries its barcode');
    // #501: the scan's cache is the page's (localStorage), not synced script storage
    const stored = await page.evaluate(() => ({ gm: GM_listValues().filter(k => /^pc:(cache|mbdata|pending)/.test(k)), ls: Object.keys(localStorage).filter(k => k.startsWith('pc:cache:v2:')).length }));
    check(stored.gm.length === 0 && stored.ls > 0, `#501: the cache is in localStorage (${stored.ls} entries), none in GM storage (${stored.gm.join(', ') || 'none'})`);
    await ws.done();
  });
});

test.describe('dark theme', () => {
  test.use({ gm: { name: 'Platform Check' } });
  // Tidal's icon is drawn in the theme's text colour, not black: on a dark theme (MusicBrainz's own
  // text colour left black underneath, as a dark userstyle can) its diamonds were black on dark
  test('Tidal\'s icon follows the dark theme', { tag: ['@cosmetic', '@sandbox'] }, async ({ page, inject }) => {
    const ws = await openPc(page, inject, { release: RAM, links, replay: new URL('./fixtures/ws-182.json.gz', import.meta.url) });
    const fill = async theme => page.evaluate(t => {
      if (t) document.documentElement.setAttribute('data-mbu-theme', t); else document.documentElement.removeAttribute('data-mbu-theme');
      // what the icon inherits is the page's business (a dark userstyle left it black): make it black
      document.getElementById('plat-tidal').style.color = '#000';
      const p = document.querySelector('#plat-tidal svg path');
      const rgb = (getComputedStyle(p).fill.match(/\d+/g) || []).slice(0, 3).map(Number);
      return rgb.reduce((x, y) => x + y, 0) / 3;   // brightness 0..255
    }, theme);
    const light = await fill(null), dark = await fill('dark');
    check(light < 100, `on the light theme the diamonds are dark (${Math.round(light)})`);
    check(dark > 180, `on the dark theme they are light (${Math.round(dark)})`);
    await ws.done();
  });
});

// #653: two compact options. Unmatched (on by default) folds only the rows that found nothing;
// Compact low-confidence providers (off by default) folds a found row that isn't a clean match, so by default a withheld
// row keeps its full row with its track count, year and label.
test.describe('strict barcode confidence, default compact options', () => {
  test.use({ gm: { name: 'Platform Check', values: { 'pc:respect-barcode': true, 'pc:barcode-mode': 'strict' } } });
  test('#653: a withheld find keeps its row; only what found nothing is folded', { tag: ['@sandbox', '@critical'] }, async ({ page, inject }) => {
    const ws = await openPc(page, inject, { release: RAM, links, replay: new URL('./fixtures/ws-182b.json.gz', import.meta.url) });
    const rows = await page.evaluate(() => [...document.querySelectorAll('#mb-pc-panel .pc-row[id^="row-"]')].filter(r => r.style.display !== 'none').map(r => {
      const p = r.id.replace(/^row-/, '');
      return { p, st: (r.className.match(/pc-st-(\w+)/) || [])[1] || 'pending', compacted: r.classList.contains('pc-compacted'), inmb: r.classList.contains('pc-inmb'), tracks: (document.getElementById('val-' + p)?.textContent || '').trim() };
    }));
    const strip = await page.locator('#pc-compact-strip .pc-compact-ico').count();
    console.log(JSON.stringify(rows), 'strip', strip);
    const mism = rows.filter(r => r.st === 'mismatch' && !r.inmb);
    const none = rows.filter(r => r.st === 'notfound' && !r.inmb && r.p !== 'discogs' && r.p !== 'bandcamp');
    check(mism.length > 0, `the fixture has withheld/mismatched finds (${mism.map(r => r.p).join(', ')})`);
    check(mism.every(r => !r.compacted), `low-confidence off: every mismatched find keeps its full row (${mism.filter(r => r.compacted).map(r => r.p).join(', ') || 'ok'})`);
    check(mism.some(r => /\d/.test(r.tracks)), `…showing its track count (${mism.map(r => r.p + ':' + r.tracks).join(', ')})`);
    check(none.every(r => r.compacted), `unmatched on: what found nothing is folded (${none.filter(r => !r.compacted).map(r => r.p).join(', ') || 'ok'})`);
    check(strip === none.length, `the strip holds exactly the not-found providers (${strip} vs ${none.length})`);
    check(!(await page.locator('#pc-compact-strip .pc-compact-mismatch').count()), 'no amber-ringed (mismatch) icon in the strip');
    await ws.done();
  });
});

test.describe('strict barcode confidence', () => {
  test.use({ gm: { name: 'Platform Check', values: { 'pc:respect-barcode': true, 'pc:barcode-mode': 'strict', 'pc:compact-nonstrict': true } } });
  test('an unconfirmed link is greyed and inert; an exact-barcode one is not', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    const ws = await openPc(page, inject, { release: RAM, links, replay: new URL('./fixtures/ws-182b.json.gz', import.meta.url) });
    const rows = {};
    for (const p of ['spotify', 'discogs', 'deezer', 'apple', 'tidal', 'qobuz', 'beatport', 'hdtracks']) rows[p] = await row(page, p);
    const blocked = Object.entries(rows).filter(([, r]) => r.blocked);
    check(blocked.length > 0, `#182: under strict, some links are withheld (${blocked.map(([p]) => p).join(', ') || 'none'})`);
    check(blocked.every(([, r]) => !r.clickable), `#182: …and none of them can be clicked (${blocked.filter(([, r]) => r.clickable).map(([p]) => p).join(', ') || 'ok'})`);
    check(!rows.tidal.blocked && /211822890/.test(rows.tidal.url || ''), `#182: the exact-barcode Tidal album is not withheld (${JSON.stringify(rows.tidal)})`);
    // the flash-message anchor, in icon mode: a visible element, not the page corner
    const anchor = await page.evaluate(() => {
      const panel = document.getElementById('mb-pc-panel'); panel.classList.add('pc-icons-mode');
      const ico = panel.querySelector('.pc-row:not(.pc-compacted) .pc-plat-ico');
      const r = ico ? ico.getBoundingClientRect() : { width: 0, height: 0 }; panel.classList.remove('pc-icons-mode');
      return { id: ico && ico.id, visible: r.width > 0 && r.height > 0 };
    });
    check(anchor.visible, `#182: in icon mode, a row message anchors to a visible icon (${anchor.id})`);
    await ws.done();
  });

  // #641: strict settings sometimes withhold a legitimate find. A middle click on a withheld row's
  // icon, or on +, adds it anyway, in the foreground. The editor tab it opens is caught and its
  // queue read; nothing is submitted.
  test('#641: middle click adds a withheld link anyway, on the icon and on +', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    const ws = await openPc(page, inject, { release: RAM, links, replay: new URL('./fixtures/ws-182b.json.gz', import.meta.url) });
    await page.evaluate(() => { window.__opened = []; window.__bg = []; window.open = (u) => { window.__opened.push(String(u)); return null; }; window.GM_openInTab = (u, o) => { window.__bg.push({ url: String(u), active: !!(o && o.active) }); return { close() {} }; }; });
    const target = await page.evaluate(() => [...document.querySelectorAll('.pc-row.pc-blocked')].map(r => r.id.replace(/^row-/, '')).find(p => document.getElementById('ico-' + p)?.textContent.trim() === '✓'));
    check(!!target, `a withheld ✓ row to try it on (${target})`);
    const middle = sel => page.evaluate(sel => { const el = document.querySelector(sel); for (const t of ['mousedown', 'mouseup', 'auxclick']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 1 })); }, sel);
    // a plain click on the withheld icon still does nothing
    await page.evaluate(p => document.getElementById('ico-' + p).click(), target);
    const plain = await page.evaluate(() => window.__opened.length);
    // with Compact low-confidence providers on, a withheld row is folded into the strip: its icon there is
    // what you see, so the middle click goes to it, as a real mouse click
    const stripName = await page.evaluate(p => document.getElementById('plat-' + p)?.title.split(' ')[0] || p, target);
    const inStrip = page.locator(`#pc-compact-strip .pc-compact-ico[title^="${stripName}"]`);
    check(await inStrip.count() === 1, `the withheld ${target} row sits in the compact strip (${await inStrip.count()})`);
    await inStrip.click({ button: 'middle' });
    const one = await page.evaluate(p => ({ opened: window.__opened.slice(), queued: Object.keys(JSON.parse(Object.entries(localStorage).find(([k]) => /^pc:pending:[0-9a-f-]{36}$/.test(k))?.[1] || '{}')), mine: p }), target);
    check(plain === 0, `a plain click on the withheld icon still adds nothing (${plain})`);
    check(one.opened.length === 1 && /\/release\/[0-9a-f-]{36}\/edit$/.test(one.opened[0]), `middle-click opens the release editor in the foreground (${one.opened.join(', ')})`);
    check(one.queued.length === 1 && one.queued[0] === target, `…with the withheld ${target} link queued (${one.queued.join(', ')})`);
    const log1 = await logText(page);
    check(new RegExp(target + ' is withheld by barcode/format confidence — added anyway').test(log1), 'the log says it was added anyway');
    const forced1 = await page.evaluate(() => { const e = Object.entries(localStorage).find(([k]) => /^pc:forced:[0-9a-f-]{36}$/.test(k)); return e ? JSON.parse(e[1]) : null; });
    check(forced1 && Object.values(forced1).length === 1 && /barcode/.test(Object.values(forced1)[0]), `…and recorded for the edit note, with why (${JSON.stringify(forced1)})`);
    // a legitimate find (the exact-barcode Tidal album): a middle click is just a foreground add
    await page.evaluate(() => { window.__opened = []; Object.keys(localStorage).filter(k => /^pc:(pending|forced):/.test(k)).forEach(k => localStorage.removeItem(k)); });
    await middle('#ico-tidal');
    const legit = await page.evaluate(() => ({ opened: window.__opened.length, queued: Object.keys(JSON.parse(Object.entries(localStorage).find(([k]) => /^pc:pending:[0-9a-f-]{36}$/.test(k))?.[1] || '{}')), forced: Object.keys(localStorage).some(k => /^pc:forced:/.test(k)) }));
    check(legit.opened === 1 && legit.queued.join() === 'tidal' && !legit.forced, `on a legitimate find a middle click adds it like a left click, nothing marked as forced (${JSON.stringify(legit)})`);
    const reset = () => page.evaluate(() => { window.__opened = []; window.__bg = []; Object.keys(localStorage).filter(k => /^pc:(pending|forced):/.test(k)).forEach(k => localStorage.removeItem(k)); });
    const after = () => page.evaluate(() => ({ opened: window.__opened.length, bg: window.__bg.map(b => b.url.replace(/^.*\/release\/[0-9a-f-]{36}\/edit/, 'edit') + (b.active ? ' active' : '')), queued: Object.keys(JSON.parse(Object.entries(localStorage).find(([k]) => /^pc:pending:[0-9a-f-]{36}$/.test(k))?.[1] || '{}')), forced: Object.keys(localStorage).some(k => /^pc:forced:/.test(k)) }));
    const click = (p, mods) => page.evaluate(([p, mods]) => document.getElementById('plat-' + p).dispatchEvent(new MouseEvent('click', Object.assign({ bubbles: true, cancelable: true }, mods))), [p, mods]);
    // #653, as changed in #641 (majkinetor): "Laptop users currently use ctrl click to force, so lets
    // change that to alt click, so that ctrl can have the same meaning for them": Alt+click does what
    // a middle click does (a touchpad has no middle button)
    await reset();
    await click(target, { altKey: true });
    const alt = await after();
    check(alt.opened === 1 && !alt.bg.length && alt.queued.join() === target && alt.forced, `Alt+click on the withheld icon adds it anyway, in the foreground, like a middle click (${JSON.stringify(alt)})`);
    await reset();
    await click(target, { ctrlKey: true });
    const ctrlOnly = await after();
    check(!ctrlOnly.opened && !ctrlOnly.bg.length && !ctrlOnly.queued.length, `Ctrl+click alone no longer forces it (${JSON.stringify(ctrlOnly)})`);
    // #641 (majkinetor): "I miss the background option with middle click. Lets use CTRL middle click
    // … ctrl + alt + click forces to background"
    await reset();
    await page.evaluate(p => { const el = document.getElementById('plat-' + p); for (const t of ['mousedown', 'mouseup', 'auxclick']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 1, ctrlKey: true })); }, target);
    const ctrlMiddle = await after();
    check(!ctrlMiddle.opened && ctrlMiddle.bg.join() === 'edit#pc-autocommit' && ctrlMiddle.queued.join() === target && ctrlMiddle.forced, `Ctrl+middle-click adds it anyway, in a background tab that submits itself (${JSON.stringify(ctrlMiddle)})`);
    await reset();
    await click(target, { ctrlKey: true, altKey: true });
    const ctrlAlt = await after();
    check(!ctrlAlt.opened && ctrlAlt.bg.join() === 'edit#pc-autocommit' && ctrlAlt.queued.join() === target && ctrlAlt.forced, `Ctrl+Alt+click does the same (${JSON.stringify(ctrlAlt)})`);
    await reset();
    await page.evaluate(() => { const el = document.getElementById('mb-inject-btn'); for (const t of ['mousedown', 'mouseup', 'auxclick']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 1, ctrlKey: true })); });
    const plusBg = await after();
    check(!plusBg.opened && plusBg.bg.join() === 'edit#pc-autocommit' && plusBg.queued.includes(target), `Ctrl+middle-click on + adds every link, the withheld ones too, in the background (${JSON.stringify(plusBg)})`);
    await page.evaluate(() => { Object.keys(localStorage).filter(k => /^pc:(pending|forced):/.test(k)).forEach(k => localStorage.removeItem(k)); });
    // + : every confirmed link, the withheld ones included
    await page.evaluate(() => { window.__opened = []; });
    const blockedAll = await page.evaluate(() => [...document.querySelectorAll('.pc-row.pc-blocked')].map(r => r.id.replace(/^row-/, '')).filter(p => document.getElementById('ico-' + p)?.textContent.trim() === '✓' && !document.getElementById('ico-' + p).classList.contains('pc-ico-circled')));
    await middle('#mb-inject-btn');
    const all = await page.evaluate(() => Object.keys(JSON.parse(Object.entries(localStorage).find(([k]) => /^pc:pending:[0-9a-f-]{36}$/.test(k))?.[1] || '{}')));
    check(blockedAll.every(p => all.includes(p)), `middle-click on + queues the withheld links too (${blockedAll.join(', ')} → ${all.join(', ')})`);
    await ws.done();
  });
});
