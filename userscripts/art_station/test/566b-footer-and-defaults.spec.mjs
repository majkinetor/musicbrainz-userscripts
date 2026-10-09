// #566 follow-up (majkinetor, with a screenshot): "The message doesn't fit and moves
// buttons around. Set it as a window footer. Also, change defaults to 10/10 and enable
// the option by default."
//
// His screenshot had the auto-repeat line in the button row, clipped to "… 1 fail…",
// with "Dry run" and "Make votable" pushed onto two lines each, which moved Close and
// Repeat sideways under a pointer on its way to them.
//
// Layout: the note has its own row under the buttons, is not clipped, and showing it
// doesn't move the buttons. Defaults: on, 10/10. Raising a default reaches nobody
// who already has settings stored (save() writes every key), so the migration is
// checked too: the old defaults move, deliberate values stay.
//
// test.musicbrainz.org: nothing is uploaded or submitted (every POST is aborted).
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { openArtStation, blockPosts } from './as.mjs';

const seeded = stored => ({ gm: { name: 'Art Station', values: stored ? { 'artstation:settings': JSON.stringify(stored) } : {} } });
const panel = async page => {
  await page.click('#as-switch', { button: 'right' });
  await page.waitForSelector('#as-setup', { timeout: 5000 });
  return page.evaluate(() => ({
    checked: document.querySelector('.as-setup-autorepeat').checked,
    min: document.querySelector('.as-setup-ar-min').value,
    times: document.querySelector('.as-setup-ar-times').value,
  }));
};

test.describe('a fresh install', () => {
  test.use(seeded(null));
  test('auto-repeat is on, 10 minutes or 10 times', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject, { path: 'add-cover-art' });
    const p = await panel(page);
    check(p.checked === true && p.min === '10' && p.times === '10', `on, 10/10 (${JSON.stringify(p)})`);
  });
});

test.describe('the old defaults stored', () => {
  test.use(seeded({ autoRepeat: false, autoRepeatMin: 20, autoRepeatTimes: 20, tile: 200 }));
  test('are migrated to the new ones, and the migration is saved', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject, { path: 'add-cover-art' });
    const p = await panel(page);
    check(p.checked === true && p.min === '10' && p.times === '10', `migrated to on, 10/10 (${JSON.stringify(p)})`);
    const s = await page.evaluate(() => JSON.parse(GM_getValue('artstation:settings') || 'null'));
    check(s && s.autoRepeatMin === 10 && s.autoRepeat === true, 'the migration is saved, not just shown');
    check(s && s.tile === 200, 'unrelated settings are left alone');
  });
});

test.describe('deliberate values stored', () => {
  test.use(seeded({ autoRepeat: true, autoRepeatMin: 30, autoRepeatTimes: 7 }));
  test('survive the migration', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openArtStation(page, inject, { path: 'add-cover-art' });
    const p = await panel(page);
    check(p.min === '30' && p.times === '7', `30/7 survives (${p.min}/${p.times})`);
  });
});

test.describe('the commit window', () => {
  test.use(seeded(null));
  test('shows the note as its own footer, without moving the buttons', { tag: ['@cosmetic', '@sandbox', '@login'] }, async ({ page, inject }, testInfo) => {
    const posts = await blockPosts(page);
    await openArtStation(page, inject, { path: 'add-cover-art' });
    // Stage a file and open the commit window. What matters here is where the note sits
    // and what it does to the buttons, so it is shown directly rather than by failing a
    // real upload (566-auto-repeat does that).
    const opened = await page.evaluate(async () => {
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
      const dt = new DataTransfer(); dt.items.add(new File([png], 'footer-probe.png', { type: 'image/png' }));
      window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
      for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 100)); if (!document.querySelector('.as-commit')?.disabled) break; }
      document.querySelector('.as-commit').click();
      for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); if (document.querySelector('#as-commit .as-cm-ar')) return true; }
      return false;
    });
    check(opened, 'the commit window opened with an auto-repeat row');
    if (!opened) return;

    const geom = await page.evaluate(() => {
      const q = s => document.querySelector(s);
      const el = q('#as-commit .as-cm-ar'), row = q('#as-commit .as-cm-f');
      const box = b => { const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
      const btns = () => [...document.querySelectorAll('#as-commit .as-cm-f .as-btn')].map(box);
      const labels = () => [...document.querySelectorAll('#as-commit .as-cm-f label')].map(box);
      const before = { btns: btns(), labels: labels() };
      // the longest thing it ever says (arSchedule's template), shown the way arNote shows it
      el.className = 'as-cm-ar on';
      el.textContent = 'Auto-repeat: attempt 10/10 in 1m00s · 9m48s of 10m used · 12 failing';
      const after = { btns: btns(), labels: labels() };
      return { insideRow: row.contains(el), clipped: el.scrollWidth > el.clientWidth + 1, below: box(el).y >= box(row).y + box(row).h - 1, before, after };
    });
    check(!geom.insideRow && geom.below, 'the note sits below the button row, as the window footer');
    check(!geom.clipped, 'a full-length message is not clipped');
    check(JSON.stringify(geom.before.btns) === JSON.stringify(geom.after.btns), `showing it doesn't move the buttons (${JSON.stringify(geom.before.btns)} → ${JSON.stringify(geom.after.btns)})`);
    check(JSON.stringify(geom.before.labels) === JSON.stringify(geom.after.labels), "and doesn't wrap the Make votable label");
    await attachShot(testInfo, page.locator('#as-commit .as-cm-box'), 'footer');
    check(!posts.some(u => /ws\/js\/edit\/create/.test(u)), `no edit was submitted (${posts.length} POSTs, all aborted)`);
  });
});
