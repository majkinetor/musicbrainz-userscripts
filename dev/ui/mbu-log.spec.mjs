// The shared activity log (mbuLog, dev/ui/ui-components.mjs), X12 of #623: Apollo, Art
// Station and Fusion each had their own copy, with a buffer that grew for the whole
// session and a window that rebuilt its whole list on every new line. On a blank page,
// nothing fetched.
import { test, check, frames, until } from '../test/harness.mjs';
import { UI_CSS, UI_JS } from './ui-components.mjs';

test.use({ profile: 'fresh', gm: false });

test.beforeEach(async ({ page }) => {
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addStyleTag({ content: UI_CSS });
  await page.addScriptTag({ content: UI_JS + `
    window.__store = new Map();
    window.mk = (max) => mbuLog({ name: 'Test', version: '1', key: 'k', max,
      load: k => window.__store.get(k), save: (k, v) => window.__store.set(k, v) });` });
});

test('keeps the last lines only, and says how many went before them', { tag: ['@unit'] }, async ({ page }) => {
  const r = await page.evaluate(() => {
    const L = mk(20);
    for (let i = 0; i < 50; i++) (i % 5 ? L.info : L.warn)('line ' + i);
    L.err(new Error('boom'));
    return { lines: L.lines(), md: L.markdown(), counts: L.counts() };
  });
  check(r.lines.length >= 20 && r.lines.length <= 22, `the buffer is capped near 20 (${r.lines.length})`);
  check(/line 49/.test(r.lines.at(-2)) && /ERR  boom/.test(r.lines.at(-1)), 'the newest lines are the ones kept');
  const kept = r.lines.filter(l => /WARN/.test(l)).length;
  check(r.counts.warn === kept && r.counts.error === 1, `the counts are of the lines kept (${JSON.stringify(r.counts)}, ${kept} warnings kept)`);
  check(/\(\d+ earlier lines not kept\)/.test(r.md), 'the Markdown says lines were dropped');
  check(/^<details><summary>Test v1 — session log \(\d+ warnings?, 1 error\)<\/summary>/.test(r.md) && r.md.includes('```log\n'), 'the Markdown keeps its shape');
});

test('an open window appends each line instead of rebuilding the list', { tag: ['@unit'] }, async ({ page }) => {
  await page.evaluate(() => { window.L = mk(20); for (let i = 0; i < 5; i++) L.info('before ' + i); L.open(); });
  const rows = () => page.evaluate(() => document.querySelectorAll('#mbu-logpop .mbu-log-li').length);
  check(await rows() === 5, 'the window shows the lines logged before it opened');
  // a mark on an existing row: a rebuilt list would drop it
  await page.evaluate(() => { document.querySelector('#mbu-logpop .mbu-log-li:last-child').dataset.mark = '1'; });
  await page.evaluate(() => { for (let i = 0; i < 3; i++) L.warn('after ' + i); });
  await frames(page);
  const r = await page.evaluate(() => ({
    rows: document.querySelectorAll('#mbu-logpop .mbu-log-li').length,
    marked: !!document.querySelector('#mbu-logpop .mbu-log-li[data-mark="1"]'),
    badge: document.querySelector('#mbu-logpop .mbu-log-badge').textContent,
    last: document.querySelector('#mbu-logpop .mbu-log-li:last-child').className,
  }));
  check(r.rows === 8 && r.marked, `new lines are appended, the old rows stay (${r.rows} rows, mark kept: ${r.marked})`);
  check(r.badge === '(8) · 3⚠ 0✖', `the badge follows (${r.badge})`);
  check(/mbu-log-warn/.test(r.last), 'a line keeps its severity class');
  // past the cap the window drops its oldest rows too
  await page.evaluate(() => { for (let i = 0; i < 40; i++) L.info('more ' + i); });
  await frames(page);
  const n = await page.evaluate(() => ({ rows: document.querySelectorAll('#mbu-logpop .mbu-log-li').length, kept: L.lines().length }));
  check(n.rows === n.kept, `the window holds what the buffer holds (${n.rows} rows, ${n.kept} lines)`);
});

test('the window escapes text, links URLs, minimises, closes on Escape and remembers', { tag: ['@unit'] }, async ({ page }) => {
  await page.evaluate(() => { window.L = mk(); L.info('<b>bold</b> see https://musicbrainz.org/x.'); L.open(); });
  const m = await page.evaluate(() => {
    const el = document.querySelector('#mbu-logpop .mbu-log-m');
    return { b: !!el.querySelector('b'), href: el.querySelector('a') && el.querySelector('a').getAttribute('href'), text: el.textContent };
  });
  check(!m.b && m.text.startsWith('<b>bold</b>'), 'logged markup shows as text');
  check(m.href === 'https://musicbrainz.org/x', `a URL is a link, without its trailing full stop (${m.href})`);
  await page.click('#mbu-logpop .mbu-logpop-min');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('#mbu-logpop .mbu-log-list')).display === 'none'), 'Minimise hides the list');
  check(await page.evaluate(() => JSON.parse(window.__store.get('k')).min === true), 'and is remembered');
  await page.keyboard.press('Escape');
  check(await page.evaluate(() => !document.getElementById('mbu-logpop') && !L.isOpen()), 'Escape closes it');
  check(await page.evaluate(() => { L.reopen(); return !document.getElementById('mbu-logpop'); }), 'closed, it is not reopened on the next load');
  const back = await page.evaluate(() => { L.open(); L.close(); window.__store.set('k', JSON.stringify({ open: true })); const L2 = mk(); L2.reopen(); return !!document.getElementById('mbu-logpop'); });
  check(back, 'left open, it is');
});

test('Clear empties the log; 20000 lines are kept by default', { tag: ['@unit'] }, async ({ page }) => {
  const r = await page.evaluate(async () => {
    const L = mk();   // no max: the default
    for (let i = 0; i < 2500; i++) L.info('line ' + i);
    L.warn('careful');
    const kept = L.lines().length;
    L.open();
    const rowsBefore = document.querySelectorAll('#mbu-logpop .mbu-log-li').length;
    document.querySelector('#mbu-logpop .mbu-logpop-clear').click();
    await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z)));
    const after = { lines: L.lines().length, counts: L.counts(), rows: document.querySelectorAll('#mbu-logpop .mbu-log-li').length, empty: !!document.querySelector('#mbu-logpop .mbu-log-empty'), md: L.markdown() };
    L.info('after the clear');
    await new Promise(z => requestAnimationFrame(() => requestAnimationFrame(z)));
    return { kept, rowsBefore, after, rowsNow: document.querySelectorAll('#mbu-logpop .mbu-log-li').length };
  });
  check(r.kept === 2501 && r.rowsBefore === 2501, `2501 lines, all kept and shown (the old default kept 2000): ${r.kept}, ${r.rowsBefore} rows`);
  check(r.after.lines === 0 && r.after.rows === 0 && r.after.empty && r.after.counts.warn === 0, `Clear empties the lines, the rows and the counts (${JSON.stringify({ ...r.after, md: undefined })})`);
  check(/no activity logged/.test(r.after.md) && !/not kept/.test(r.after.md), 'and the Markdown says there is nothing, without an "earlier lines" note');
  check(r.rowsNow === 1, `logging goes on after a clear (${r.rowsNow} row)`);
});

test('a toast with an action is clickable, runs it, and closes', { tag: ['@unit'] }, async ({ page }) => {
  const r = await page.evaluate(async () => {
    let ran = 0;
    const el = mbuToast('⚠ something happened', { action: { label: 'Copy log', onClick: () => { ran++; } } });
    const btn = el.querySelector('.mbu-toast-btn');
    const clickable = getComputedStyle(el).pointerEvents !== 'none';
    btn.click();
    await new Promise(z => setTimeout(z, 1100));
    const plain = mbuToast('plain');
    return { label: btn.textContent, clickable, ran, closed: !el.classList.contains('mbu-toast-on') || el.textContent === 'plain', plainInert: getComputedStyle(plain).pointerEvents === 'none', plainNoBtn: !plain.querySelector('.mbu-toast-btn') };
  });
  check(r.label === 'Copy log' && r.clickable, `the toast carries the button and takes clicks (${JSON.stringify(r)})`);
  check(r.ran === 1 && r.closed, 'the button runs its action, and the toast closes');
  check(r.plainInert && r.plainNoBtn, 'a toast without an action stays click-through, with no button');
});

// #697: a line can carry a category; the window filters by level and by category,
// and shows the filter row only when there is something to choose between.
test('categories: tagged lines, a filter row only when needed, one-click filters', { tag: ['@unit'] }, async ({ page }) => {
  const vis = () => page.evaluate(() => [...document.querySelectorAll('#mbu-logpop .mbu-log-li')].filter(d => getComputedStyle(d).display !== 'none').length);
  const row = () => page.evaluate(() => { const f = document.querySelector('#mbu-logpop .mbu-log-f'); return f.hidden ? null : [...f.querySelectorAll('.mbu-log-fb')].map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join(' '); });
  await page.evaluate(() => { window.L = mk(); L.info('plain'); L.ok('done'); L.open(); });
  check(await row() === null, 'info and ok alone: no filter row');
  await page.evaluate(() => { L.cat('Spotify').info('sp one'); L.cat('Spotify').warn('sp two'); });
  check(await row() === 'warn info', `a second level brings the level filters, ok counted as info (${await row()})`);
  await page.evaluate(() => { L.cat('Deezer').err('dz'); });
  check(await row() === 'error warn info Spotify Deezer', `a second category brings the category filters (${await row()})`);
  check(await page.evaluate(() => L.cat('Spotify') === L.cat('Spotify')), 'the same category gives the same logger');
  const tag = await page.evaluate(() => [...document.querySelectorAll('#mbu-logpop .mbu-log-li')].map(d => d.querySelector('.mbu-log-c')?.textContent || '-').join(','));
  check(tag === '-,-,Spotify,Spotify,Deezer', `rows carry their category tag (${tag})`);
  await page.click('#mbu-logpop .mbu-log-fb[data-cat="Spotify"]');
  check(await vis() === 2, 'Spotify: only its two lines');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  check(await vis() === 1 && await row() === 'error warn* info Spotify* Deezer', `and warn on top of it: one line (${await row()})`);
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="info"]');
  check(await vis() === 1, 'info with Spotify: its one info line, none of the untagged ones');
  await page.click('#mbu-logpop .mbu-log-fb[data-cat="Spotify"]');
  check(await vis() === 3, 'Spotify off again: info covers the plain, ok and Spotify info lines');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="info"]');
  check(await vis() === 5, 'and everything shows when nothing is picked');
  const md = await page.evaluate(() => L.markdown());
  check(/WARN \[Spotify\] sp two/.test(md) && /ERR {2}\[Deezer\] dz/.test(md) && /OK {3}done/.test(md), 'the Markdown carries the category after the level');
  await page.click('#mbu-logpop .mbu-log-fb[data-cat="Deezer"]');
  await page.click('#mbu-logpop .mbu-logpop-clear');
  await page.evaluate(() => { L.info('fresh'); });
  await frames(page);
  check(await row() === null && await vis() === 1, 'Clear forgets the categories and the filter');
});

// #697: the window resizes from its corner grip and goes full screen; both are remembered.
test('the window resizes from its corner, goes full screen, and remembers both', { tag: ['@unit'] }, async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.evaluate(() => { window.L = mk(); for (let i = 0; i < 80; i++) L.info('line ' + i); L.open(); });
  const box = () => page.evaluate(() => { const r = document.getElementById('mbu-logpop').getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
  const b0 = await box();
  const g = await page.locator('#mbu-logpop .mbu-logpop-grip').boundingBox();
  await page.mouse.move(g.x + 8, g.y + 8); await page.mouse.down();
  await page.mouse.move(g.x + 8 + 150, g.y + 8 - 200, { steps: 4 }); await page.mouse.up();
  const b1 = await box();
  check(b1.x === b0.x && b1.y === b0.y, `the top-left corner stays put (${JSON.stringify(b0)} → ${JSON.stringify(b1)})`);
  check(Math.abs(b1.w - (b0.w + 150)) <= 2 && Math.abs(b1.h - (b0.h - 200)) <= 2, `the grip sets the size (${b0.w}×${b0.h} → ${b1.w}×${b1.h})`);
  const st = await page.evaluate(() => JSON.parse(window.__store.get('k')));
  check(st.w === b1.w + 'px' && st.h === b1.h + 'px', `the size is remembered (${st.w} × ${st.h})`);

  await page.click('#mbu-logpop .mbu-logpop-full');
  const f = await box();
  check(f.x === 12 && f.y === 12 && f.w === 1200 - 24 && f.h === 800 - 24, `full screen fills the viewport less 12px (${JSON.stringify(f)})`);
  check(await page.evaluate(() => JSON.parse(window.__store.get('k')).full === true), 'and is remembered');
  await page.dblclick('#mbu-logpop .mbu-logpop-h b');
  const back = await box();
  check(JSON.stringify(back) === JSON.stringify(b1), `a double-click on the title bar restores the size it had (${JSON.stringify(back)})`);

  await page.click('#mbu-logpop .mbu-logpop-full');
  await page.click('#mbu-logpop .mbu-logpop-min');
  const m = await page.evaluate(() => ({ full: document.getElementById('mbu-logpop').classList.contains('full'), st: JSON.parse(window.__store.get('k')) }));
  check(!m.full && m.st.full === false && m.st.min === true, `minimising leaves full screen (${JSON.stringify(m)})`);
  await page.click('#mbu-logpop .mbu-logpop-min');
  await page.evaluate(() => { L.close(); L.open(); });
  const again = await box();
  check(again.w === b1.w && again.h === b1.h, `reopened, it has the size it was given (${JSON.stringify(again)})`);
});

// #697: a text filter in the title bar; it combines with the level and category filters.
test('the text filter shows only the lines with its text, and Escape empties it', { tag: ['@unit'] }, async ({ page }) => {
  const vis = () => page.evaluate(() => [...document.querySelectorAll('#mbu-logpop .mbu-log-li')].filter(d => getComputedStyle(d).display !== 'none').map(d => d.querySelector('.mbu-log-m').textContent));
  await page.evaluate(() => { window.L = mk(); L.cat('Spotify').info('Search picked album'); L.cat('Deezer').warn('No album found'); L.cat('Tidal').info('HTTP 429'); L.open(); });
  await page.fill('#mbu-logpop .mbu-log-q', 'ALBUM');
  await until(vis, v => v.length === 2);
  check((await vis()).join('|') === 'Search picked album|No album found', `case-insensitive, on the message (${(await vis()).join('|')})`);
  await page.fill('#mbu-logpop .mbu-log-q', 'tidal');
  await until(vis, v => v.length === 1);
  check((await vis()).join('|') === 'HTTP 429', 'and on the category');
  await page.fill('#mbu-logpop .mbu-log-q', 'album');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  await until(vis, v => v.length === 1);
  check((await vis()).join('|') === 'No album found', 'it combines with the level filter');
  await page.click('#mbu-logpop .mbu-log-fb[data-sev="warn"]');
  await page.evaluate(() => L.cat('Qobuz').info('album arrives later'));
  await until(vis, v => v.length === 3);
  check((await vis()).includes('album arrives later'), 'a new line that matches shows; one that does not stays hidden');
  await page.evaluate(() => L.info('unrelated'));
  await frames(page);
  check(!(await vis()).includes('unrelated'), '…and one that does not stays hidden');
  await page.focus('#mbu-logpop .mbu-log-q');
  await page.keyboard.press('Escape');
  await until(vis, v => v.length === 5);
  check(await page.evaluate(() => !!document.getElementById('mbu-logpop') && document.querySelector('#mbu-logpop .mbu-log-q').value === ''), 'Escape in the filter empties it and keeps the window open');
});
