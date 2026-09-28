// #280: the configurable Tools bar. On-bar tools render in order, a tool with parameters
// as an inline group (its trigger, then its parameters); there is no ⋯ button; the Tools
// label opens a menu of the off-bar tools and Customize; Customize has no pin, and each
// tool keeps at least one of icon and name.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });   // no toolCfg: the default bar

test('the default Tools bar, its menu and Customize', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.waitForSelector('.tc-toolbtns', { timeout: 30000 });
  const layout = await page.evaluate(() => {
    const lab = sel => { const n = document.querySelector(sel); return n ? { ic: !!n.querySelector('.tc-tbic'), lab: !!n.querySelector('.tc-tblab') } : {}; };
    const collapsed = act => document.querySelector(`.tc-opt[data-tool="${act}"]`)?.classList.contains('tc-collapsed');
    return {
      order: [...document.querySelectorAll('.tc-toolbtns > *')].map(e => e.dataset.tool || e.dataset.act),
      params: ['guesscase .tc-gco', 'sr .tc-sro', 'cols .tc-colso'].every(s => { const [t, p] = s.split(' '); return !!document.querySelector(`.tc-opt[data-tool="${t}"] ${p}`); }),
      gc: lab('.tc-opt[data-tool="guesscase"] .tc-optname'), cols: lab('.tc-opt[data-tool="cols"] .tc-optname'), sr: lab('.tc-opt[data-tool="sr"] .tc-optname'),
      gcCollapsed: collapsed('guesscase'), colsCollapsed: collapsed('cols'), srCollapsed: collapsed('sr'),
      noRow2: !document.getElementById('tc-bar2'), noMore: !document.querySelector('.tc-toolbtns .tc-more'),
    };
  });
  check(JSON.stringify(layout.order) === '["guesscase","cols","sr"]', `on the bar: Guess case, Resize columns, S&R (${layout.order})`);
  check(layout.params, 'each carries its parameters inline');
  check(layout.gc.ic && !layout.gc.lab && !layout.cols.ic && layout.cols.lab && layout.sr.ic && !layout.sr.lab, 'Guess case and S&R as icons, Resize columns as its name');
  check(layout.gcCollapsed && layout.colsCollapsed && !layout.srCollapsed, "Guess case and Resize columns collapsed, S&R's fields out");
  check(layout.noRow2 && layout.noMore, 'one row, no ⋯ button');

  await page.click('.tc-toolslabel');
  await page.waitForSelector('#tc-menu');
  const menu = await page.evaluate(() => [...document.querySelectorAll('#tc-menu .tc-mi')].map(m => m.dataset.act));
  check(menu[menu.length - 1] === '__cfg' && menu.length > 1 && !menu.some(a => ['guesscase', 'cols', 'sr'].includes(a)), `the Tools menu: the off-bar tools, then Customize (${menu})`);
  await page.click('#tc-menu .tc-mi-cfg');
  await page.waitForSelector('#tc-toolcfg');
  check(await page.evaluate(() => !document.querySelector('#tc-toolcfg .tc-tc-pin')), 'Customize has no pin');
  check(await page.evaluate(() => !/\bicon\b|\btext\b/i.test(document.querySelector('#tc-toolcfg .tc-tc-dens').textContent)), 'no "icon"/"text" words in its density control');
  // Guess case is icon-only: its one "on" part cannot be switched off
  await page.click('#tc-toolcfg .tc-tc-row[data-act="guesscase"] .cb-icon').catch(() => {});
  await page.waitForTimeout(150);
  check(await page.evaluate(() => { const r = document.querySelector('#tc-toolcfg .tc-tc-row[data-act="guesscase"]'); return r.querySelector('.cb-icon').classList.contains('on') || r.querySelector('.cb-text').classList.contains('on'); }), 'a tool keeps its icon or its name');
});
