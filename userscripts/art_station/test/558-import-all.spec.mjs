// "Import all" in the Source popover, and its right-click shortcut.
//
// #558 (majkinetor): "I almost always use import all so it could be run faster with
// right click on the button. Add tooltip info too." Right-clicking the toolbar's URL
// button imports from every source at once, without opening the popover. "Import all"
// counts registered providers (#250's API) as well as linked platforms.
//
// #502 (chaban-mb): its text was unreadable on hover. #493's generic
// `.as-btn:hover:not(:disabled)` had the same specificity as `.as-src-all:hover` and
// won, leaving white text on a pale lavender background.
//
// test.musicbrainz.org, with the "Hazy Dreams" links served as the release's (several
// platforms). Every POST is aborted; each source's hidden seed page is counted, not
// loaded.
import { test, check, attachShot, until, frames } from '../../../dev/test/harness.mjs';
import { openArtStation, serveLinks } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('"Import all" counts every source, reads on hover, and right-click runs it', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
  const posts = []; let seeded = 0;
  await page.route(() => true, route => {
    const r = route.request();
    if (r.method() === 'POST' && !/\/__meb_verify$/.test(new URL(r.url()).pathname)) { posts.push(r.url()); return route.abort(); }
    // a source's hidden seed page: count it, don't load a real uploader
    if (/\/add-(cover|event)-art\?.*x_seed/.test(r.url())) { seeded++; return route.abort(); }
    return route.fallback();
  });
  await serveLinks(page);
  await openArtStation(page, inject, { path: 'add-cover-art' });

  // A registered provider matching one of the links. Without one, "all" can't tell the
  // old count (platforms only) from the new one.
  const registered = await page.evaluate(() => {
    const api = window.ArtStation;
    if (!api || !api.registerProvider) return false;
    window.__probe558Run = 0;
    api.registerProvider({ id: 'probe558', name: 'Probe 558', icon: '', match: u => /deezer\.com|spotify\.com|tidal\.com|apple\.com|beatport\.com/i.test(u), run: () => { window.__probe558Run++; return []; } });
    return true;
  });
  check(registered, 'a custom provider is registered through the public API (#250)');
  await page.waitForFunction(() => /\(\d+\)/.test((document.querySelector('.as-src-n') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});

  const btn = await page.evaluate(() => { const b = document.querySelector('.as-src'); return { n: ((b.querySelector('.as-src-n') || {}).textContent || '').trim(), title: b.title }; });
  const total = parseInt((btn.n.match(/\((\d+)\)/) || [])[1], 10);
  check(total >= 2, `the release offers several sources (${total}); otherwise "all" proves nothing`);
  check(/right-click/i.test(btn.title) && new RegExp(`import from all ${total}`, 'i').test(btn.title), `the tooltip names the right-click shortcut and the count (${JSON.stringify(btn.title)})`);

  // the popover's "Import all" agrees with the button
  await page.click('.as-src');
  await page.waitForSelector('.as-src-pop', { timeout: 5000 });
  // until every source has its button above "Import all"
  const pop = await until(() => page.evaluate(() => {
    const all = document.querySelector('.as-src-all');
    return { label: all ? all.textContent.trim() : '(none)', inWrap: !!(all && all.closest('.as-src-allwrap')),
      prov: document.querySelectorAll('.as-src-prov .as-src-prov-b').length, custom: document.querySelectorAll('.as-src-custom .as-src-prov-b').length };
  }), p => p.prov + p.custom === total && p.custom > 0);
  check(new RegExp(`Import all ${total} sources`).test(pop.label), `"Import all" counts platforms and providers (${JSON.stringify(pop.label)} vs ${total})`);
  check(pop.inWrap, 'it sits below both lists');
  check(pop.prov + pop.custom === total && pop.custom > 0, `one button per source above it, the provider among them (${pop.prov}+${pop.custom})`);
  check(!new RegExp(`Import all ${pop.prov} sources`).test(pop.label), `not the old platforms-only count (${pop.prov})`);

  // #502: readable on hover
  const box = await page.locator('.as-src-all').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await frames(page);
  const hovered = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.as-src-all')); return { color: s.color, background: s.backgroundColor }; });
  check(hovered.color === 'rgb(255, 255, 255)' && hovered.background === 'rgb(78, 50, 159)', `on hover: white on the dark accent, not the generic pale hover (${JSON.stringify(hovered)})`);
  await attachShot(testInfo, page.locator('.as-src-pop'), 'popover');

  // right-click: every source at once, no popover
  await page.evaluate(() => document.querySelectorAll('.as-pop').forEach(p => p.remove()));
  seeded = 0;
  const prevented = await page.evaluate(() => { const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.querySelector('.as-src').dispatchEvent(ev); return ev.defaultPrevented; });
  check(prevented, "the browser's context menu is suppressed");
  // sampled promptly: a slot goes as soon as its source resolves empty
  await page.waitForFunction(() => document.querySelectorAll('.as-srcing-lbl').length > 0, null, { timeout: 15000 }).catch(() => {});
  // until every platform has its slot and seed page, and the provider has run
  const after = await until(() => page.evaluate(() => ({ popOpen: !!document.querySelector('.as-src-pop'), slots: [...document.querySelectorAll('.as-srcing-lbl')].map(e => e.textContent.trim()), runs: window.__probe558Run })), a => a.slots.length === pop.prov && seeded === pop.prov && a.runs === 1);
  check(!after.popOpen, 'the popover does not open');
  // platforms seed a hidden uploader page and keep their slot while it loads; the probe
  // provider returns nothing, so its slot goes at once and its run count is what shows it ran
  check(after.slots.length === pop.prov && seeded === pop.prov, `a slot and a seed page for every platform (${after.slots.length}, ${seeded} of ${pop.prov})`);
  check(after.runs === 1, `the registered provider ran too (${after.runs})`);
  check(after.slots.every(s => /sourcing/i.test(s)), `each slot names what it is sourcing (${JSON.stringify(after.slots.slice(0, 3))})`);

  await page.click('.as-src');
  check(await until(() => page.locator('.as-src-pop').count(), n => n > 0) > 0, 'a left click still opens the popover');
  check(!posts.some(u => /\/(edit|add-cover-art|add-event-art|ws\/js)/.test(u)), `nothing was submitted (${posts.length} POSTs, all aborted)`);
});
