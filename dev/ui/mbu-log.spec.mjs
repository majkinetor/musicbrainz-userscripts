// The shared activity log (mbuLog, dev/ui/ui-components.mjs), X12 of #623: Apollo, Art
// Station and Fusion each had their own copy, with a buffer that grew for the whole
// session and a window that rebuilt its whole list on every new line. On a blank page,
// nothing fetched.
import { test, check, frames } from '../test/harness.mjs';
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
