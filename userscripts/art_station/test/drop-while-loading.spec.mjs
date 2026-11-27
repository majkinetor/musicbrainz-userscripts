// A cover dropped while the gallery still waits for the archive's listing stays staged once the
// listing is in. The listing used to replace every cover with the listed ones, so the drop was lost.
// The listing is held back 6 s here; the drop comes in that time. Runs on test.musicbrainz.org.
import { test, check, until, answerGm, requireLogin, SANDBOX, idle } from '../../../dev/test/harness.mjs';
import { RELEASE, blockPosts, artLoaded } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('a drop before the cover list loads stays staged', { tag: ['@sandbox', '@login'] }, async ({ page, context, inject }) => {
  await blockPosts(page);
  answerGm(context, async ({ url }) => { if (/coverartarchive\.org\/release\//.test(url)) await new Promise(r => setTimeout(r, 6000)); return null; });
  await page.goto(`${SANDBOX}/release/${RELEASE}/add-cover-art`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await idle(page);
  await inject('art_station');
  await page.waitForSelector('#as-root .as-loading', { timeout: 20000 });
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 600;
    const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 600, 600);
    const f = new File([await new Promise(r => c.toBlob(r, 'image/png'))], 'early-drop.png', { type: 'image/png' });
    const dt = new DataTransfer(); dt.items.add(f);
    window.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  check(await page.evaluate(() => !!document.querySelector('.as-loading')), 'fixture: the drop came while the listing loaded');
  await artLoaded(page);
  const cards = await until(() => page.evaluate(() => ({ fresh: document.querySelectorAll('.as-card.new').length, all: document.querySelectorAll('.as-card').length })), c => c.all > 1, { timeout: 10000 });
  check(cards.fresh === 1, `the dropped cover is staged (${cards.fresh} new)`);
  check(cards.all > cards.fresh, `the listed covers are there too (${cards.all} cards)`);
  check(await page.evaluate(() => document.querySelector('.as-card')?.classList.contains('new')), 'the dropped cover comes first');
});
