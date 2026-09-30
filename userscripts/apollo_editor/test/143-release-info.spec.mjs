// Apollo's Release information view (#143), from majkinetor's review of it.
//
// Focusing an entity field (release group, label) shows a small popover holding the
//   link to the selected entity — the help the native layout gave and Apollo's had lost;
//   a plain field (barcode) shows none.
// An oversized favicon (Discogs's) stays inside its cell; checkbox labels are not bold;
//   switching Apollo → Original leaves no native bubble floating mispositioned.
// Dated relationships take two cells, not the whole row, so several dated types share a
//   row; a long date wraps inside its cell without overlapping its neighbour.
//
// Sandbox copies of the releases he reviewed; nothing is submitted.
import { test, check, until, idle, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm({ apolloEnabled: true, replaceReleaseInfo: true }) });

async function releaseInfo(page) {
  await page.evaluate(() => { const t = [...document.querySelectorAll('a,button,li')].find(e => /^\s*release information\s*$/i.test(e.textContent || '')); if (t) (t.querySelector('a') || t).click(); });
  await page.waitForFunction(() => document.body.classList.contains('tc-ri-on'), null, { timeout: 15000 });
  await idle(page);
  await frames(page);
}

test('an entity field shows its link when focused', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { release: '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7' });
  await releaseInfo(page);
  const focus = re => page.evaluate(async src => {
    const r = new RegExp(src, 'i');
    let f = null;
    for (const l of document.getElementById('information').querySelectorAll('label')) if (r.test(l.textContent || '')) { f = (l.htmlFor && document.getElementById(l.htmlFor)) || l.parentElement?.querySelector('input,select'); if (f) break; }
    if (!f) return null;
    f.focus();
    await new Promise(z => setTimeout(z, 250));
    const p = document.getElementById('tc-ri-help');
    return { on: !!(p && p.classList.contains('on')), links: p ? [...p.querySelectorAll('a')].map(a => a.getAttribute('href') || '') : [] };
  }, re.source);
  const rg = await focus(/release group/);
  check(rg && rg.on && rg.links.some(h => /\/release-group\/[0-9a-f-]{36}/.test(h)), `release group: a popover with its link (${JSON.stringify(rg)})`);
  const bc = await focus(/barcode/);
  check(bc && !bc.on, 'barcode: none');
});

test("the favicon fits, checkbox labels aren't bold, and switching leaves no stray bubble", { tag: ['@cosmetic', '@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { release: 'ce9529d6-b490-4010-b8ff-5e1fb0f8441e' });   // Shelflife 8, with its Discogs link
  await releaseInfo(page);
  const s = await page.evaluate(() => {
    const fav = document.querySelector('#external-links-editor .favicon'), cell = fav && fav.closest('td');
    return {
      fav: fav && { w: fav.getBoundingClientRect().width, h: fav.getBoundingClientRect().height, cellW: cell.getBoundingClientRect().width },
      ...(() => {
        const labels = [...document.querySelectorAll('#information table.row-form input[type=checkbox]')].map(i => i.closest('label') || document.querySelector(`label[for="${i.id}"]`)).filter(Boolean);
        return { boxes: labels.length, bold: labels.filter(l => +getComputedStyle(l).fontWeight >= 600).map(l => l.textContent.trim().slice(0, 20)) };
      })(),
    };
  });
  check(s.fav && s.fav.w <= s.fav.cellW, `the favicon stays inside its cell (${JSON.stringify(s.fav)})`);
  check(s.boxes > 0 && s.bold.length === 0, `checkbox labels are not bold (${s.boxes} checked) (${JSON.stringify(s.bold)})`);
  await page.evaluate(() => document.querySelector('#tc-launch .tc-launch-lbl')?.click());
  await page.waitForFunction(() => !document.body.classList.contains('tc-ri-on'), null, { timeout: 8000 });
  await frames(page);
  const bubbles = await page.evaluate(() => { const d = document.querySelector('#information > div.documentation'); return d ? [...d.querySelectorAll('.bubble')].filter(b => b.offsetParent !== null).length : 0; });
  check(bubbles === 0, `switched to the original: no native bubble left showing (${bubbles})`);
});

test('dated relationships share a row, and dates wrap in their cell', { tag: ['@cosmetic', '@sandbox', '@login'] }, async ({ page, inject }) => {
  const submitted = await openApollo(page, inject, { release: 'd39b6cab-6ae6-4de8-b782-528865f4e832' });   // Misanthrope: one link with two types
  await releaseInfo(page);
  const addDate = async (n, parts) => {
    const ok = await page.evaluate(n => {
      const rels = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].filter(r => r.querySelector('button.edit-item') && /purchase for download|streaming page/i.test(r.textContent || ''));
      if (!rels[n]) return false;
      rels[n].querySelector('button.edit-item').click();
      return true;
    }, n);
    if (!ok) return false;
    const dlg = page.locator('.dialog.popover, .bubble, [role="dialog"]').filter({ has: page.locator('input[name="period.begin_date.year"]') }).filter({ visible: true }).first();
    await dlg.waitFor({ timeout: 10000 }).catch(() => {});
    for (const [k, v] of Object.entries(parts)) await dlg.locator(`input[name="period.${k}"]`).fill(v).catch(() => {});
    await dlg.locator('button').filter({ hasText: /^\s*Done\s*$/ }).first().click().catch(() => {});
    await dlg.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});   // closed, and the date is on the row
    await frames(page);
    return true;
  };
  check(await addDate(0, { 'begin_date.year': '1111', 'begin_date.month': '11', 'begin_date.day': '11', 'end_date.year': '1112', 'end_date.month': '11', 'end_date.day': '11' }), 'a date on the first type');
  check(await addDate(1, { 'begin_date.year': '1233', 'end_date.year': '1234' }), 'and on the second');
  const r = await page.evaluate(() => {
    const dated = [...document.querySelectorAll('#external-links-editor tr.relationship-item')].filter(x => x.querySelector('.date-period'));
    const colR = document.getElementById('tc-ri-rightcol')?.getBoundingClientRect().right ?? 1e9;
    let overlap = false;
    for (let i = 0; i < dated.length; i++) for (let j = i + 1; j < dated.length; j++) { const a = dated[i].getBoundingClientRect(), b = dated[j].getBoundingClientRect(); if (Math.abs(a.top - b.top) < 6 && a.left < b.right && b.left < a.right) overlap = true; }
    return { n: dated.length, rows: new Set(dated.map(d => Math.round(d.getBoundingClientRect().top))).size, overlap, fit: dated.every(d => d.getBoundingClientRect().right <= colR + 1), pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  check(r.n >= 2 && r.rows < r.n, `the dated types share a row (${r.n} on ${r.rows} row(s))`);
  check(!r.overlap && r.fit && !r.pageOverflow, `no overlap, all inside the column (${JSON.stringify(r)})`);
  check(submitted.length === 0, 'nothing submitted');
});
