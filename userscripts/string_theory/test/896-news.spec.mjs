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
    await page.click('#st-news-refresh');
    await until(() => page.textContent('#st-news-state'), t => /checked today|check failed/.test(t), { timeout: 20000 });
  });
  test('a phone: full screen, the list or one post', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.waitForSelector('#mbu-dock', { timeout: 15000 });
    await until(() => page.evaluate(() => document.documentElement.hasAttribute('data-st-news')), v => v, { timeout: 5000 });
    await page.click('#mbu-dock');
    await page.waitForSelector('#st-news-view h3', { timeout: 5000 });
    const box = await page.$eval('#st-news', e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
    check(box[0] === 390 && box[1] === 800, `full screen (${box})`);
    check(!(await page.isVisible('#st-news-list')) && await page.isVisible('#st-news-view'), 'opens on the post alone');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-post.png' });
    check(await page.isDisabled('#st-news-prev'), 'no previous on the newest');
    await page.click('#st-news-next');
    check((await page.textContent('#st-news-view h3 .n')) === 'One' && await page.isDisabled('#st-news-next'), 'Next goes to the older post');
    await page.click('#st-news-prev');
    check((await page.textContent('#st-news-view h3 .n')) === 'Two', 'Prev comes back');
    const swipe = (from, to) => page.$eval('#st-news-view', (v, [a, b]) => {
      const t = x => new Touch({ identifier: 1, target: v, clientX: x, clientY: 300 });
      v.dispatchEvent(new TouchEvent('touchstart', { touches: [t(a)], changedTouches: [t(a)], bubbles: true }));
      v.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(b)], bubbles: true }));
    }, [from, to]);
    await swipe(300, 100);
    check((await page.textContent('#st-news-view h3 .n')) === 'One', 'swiping left goes to the next post');
    await swipe(100, 300);
    check((await page.textContent('#st-news-view h3 .n')) === 'Two', 'swiping right goes back');
    await page.click('#st-news-back');
    check(await page.isVisible('#st-news-list') && !(await page.isVisible('#st-news-view')), 'back shows the list alone');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-list.png' });
    await page.click('#st-news-list li[data-n="1"]');
    check((await page.textContent('#st-news-view h3 .n')) === 'One' && !(await page.isVisible('#st-news-list')), 'a tap opens that post');
  });
});
test.describe("what's new, older posts", () => {
  const full = Array.from({ length: 20 }, (_, k) => post(990020 - k, 'Cached ' + (20 - k), 'stable'));
  test.use({ gm: { name: 'String Theory', values: { stNews: { at: Date.now(), since: 1, seen: [], items: full } } } });
  test('scrolling to the end loads older posts', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.waitForSelector('#mbu-dock', { timeout: 15000 });
    await until(() => page.evaluate(() => document.documentElement.hasAttribute('data-st-news')), v => v, { timeout: 5000 });
    await page.click('#mbu-dock');
    await page.waitForSelector('#st-news-list li[data-n="19"]', { timeout: 5000 });
    await page.$eval('#st-news-list', l => { l.scrollTop = l.scrollHeight; });
    const n = await until(() => page.$$eval('#st-news-list li[data-n]', xs => xs.length), v => v > 20, { timeout: 30000 });
    check(n > 20, `older posts appended (${n})`);
    check((await page.textContent('#st-news-n')) === String(n), 'the footer counts them');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-more.png' });
  });
});
