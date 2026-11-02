// #896: unread announcements turn the icon golden, and clicking it opens the viewer instead of the dock.
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const post = (id, title, channel) => ({ id, title, url: 'https://github.com/x', at: new Date().toISOString(),
  html: `<p>Body ${id} on the RG page</p><sub>Issue: #${id}</sub><script>window.bad = 1</script>`, script: 'Apollo Editor', icon: '', issue: id, channel });

test.describe('what\'s new', () => {
  test.use({ gm: { name: 'String Theory', values: { stNews: { at: Date.now(), since: 1, seen: [], items: [post(2, 'Two', 'latest'), post(1, 'One', 'stable')] } } } });
  test('golden icon opens the viewer, reading clears it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.waitForSelector('#mbu-dock', { timeout: 15000 });
    await until(() => page.evaluate(() => document.documentElement.hasAttribute('data-st-news')), v => v, { timeout: 5000 });
    const stroke = await page.$eval('#mbu-dock svg path', p => getComputedStyle(p).stroke);
    check(stroke === 'rgb(224, 168, 0)', `golden (${stroke})`);
    await page.click('#mbu-dock');
    await page.waitForSelector('#st-news', { timeout: 5000 });
    check((await page.textContent('#st-news-view h3 .n')) === 'Two', 'opens on the newest unread');
    check((await page.textContent('#st-news-view .c')) === 'latest', 'channel badge');
    check(!(await page.textContent('#st-news-view .b')).includes('Issue:'), 'the issue line is dropped');
    check((await page.getAttribute('#st-news-view abbr', 'data-tip')) === 'Release group', 'short name explained');
    await page.click('#st-news-full');
    const box = await page.$eval('#st-news', e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
    check(box[0] === page.viewportSize().width && box[1] === page.viewportSize().height, `full screen (${box})`);
    await page.click('#st-news-full');
    check((await page.$eval('#st-news', e => e.getBoundingClientRect().width)) < box[0], 'restores the size');
    await page.keyboard.press('ArrowDown');
    check((await page.textContent('#st-news-view .c')) === 'stable', 'down moves to the next post');
    await until(() => page.evaluate(() => document.documentElement.hasAttribute('data-st-news')), v => !v, { timeout: 5000 });
    await page.keyboard.press('Escape');
    check(!(await page.$('#st-news')), 'Escape closes it');
    await page.click('#mbu-dock');
    check(!(await page.$('#st-news')), 'with nothing unread the icon does its usual');
    await page.keyboard.press('Escape');
    await page.click('#mbu-dock', { button: 'right' });
    await page.click('#st-cfg-news');
    await page.waitForSelector('#st-news', { timeout: 5000 });
    check(!(await page.$('#st-cfg')), 'the settings link swaps settings for the viewer');
  });
});
