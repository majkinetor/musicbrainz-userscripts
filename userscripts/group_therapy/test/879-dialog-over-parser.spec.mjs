// #879 (majkinetor, screenshot): the Text parser's bar sat over MusicBrainz's Add relationship dialog.
import { test, check, requireLogin, SANDBOX, settled, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('the Add relationship dialog is above the Text parser', { tag: ['@sandbox', '@login', '@cosmetic'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/3a37a35f-1e06-457f-9b2a-46155c5c03ce/edit-relationships`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await settled(page);
  await inject('group_therapy', { waitFor: '__groupTherapy' });
  await idle(page);
  await page.evaluate(() => window.__groupTherapy.openTextParser());
  await page.waitForSelector('.gt-tp');
  await page.getByRole('button', { name: 'Add relationship' }).first().click();
  const dialog = page.locator('.dialog-content, [role=dialog]').first();
  await dialog.waitFor();
  const info = await page.evaluate(() => {
    const d = document.querySelector('.dialog-content, [role=dialog]');
    // laid over the bar, where the screenshot had it
    d.style.top = (document.querySelector('.gt-tp-top').getBoundingClientRect().top + scrollY) + 'px';
    const chain = [];
    for (let e = d; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      chain.push(`${e.tagName}.${e.className}#${e.id} ${c.position} z=${c.zIndex}`);
    }
    const bar = document.querySelector('.gt-tp-top').getBoundingClientRect();
    const r = d.getBoundingClientRect();
    const hits = [];
    for (let x = r.left + 4; x < r.right; x += 24) for (let y = r.top + 4; y < r.bottom; y += 16) {
      const e = document.elementFromPoint(x, y);
      if (e && e.closest('.gt-tp')) hits.push(e.className);
    }
    const css = s => { const e = d.querySelector(s); if (!e) return s + ' none'; const c = getComputedStyle(e); return `${s} bg=${c.backgroundColor} fg=${c.color} ${e.outerHTML.slice(0, 90)}`; };
    return { chain, bar: [bar.top, bar.bottom], box: [r.top, r.bottom], hits, css: [css('input[type=number]'), css('button.positive'), css('button.negative')] };
  });
  console.log(JSON.stringify(info, null, 1));
  check(info.hits.length === 0, 'no part of the parser shows over the dialog: ' + info.hits.slice(0, 5));
});
