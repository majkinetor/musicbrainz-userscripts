// #896: unread announcements turn the icon golden, and clicking it opens the viewer instead of the dock.
import { test, check, until, SANDBOX, answerGm } from '../../../dev/test/harness.mjs';

const post = (id, title, channel) => ({ id, title, url: 'https://github.com/x', at: new Date().toISOString(),
  html: `<p>Body ${id} on the RG page</p><sub>Issue: #${id}</sub><script>window.bad = 1</script>`, script: 'Apollo Editor', icon: '', issue: id, channel });

test.describe('what\'s new', () => {
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['event_horizon'], stNews: { at: Date.now(), since: 1, seen: [], items: [post(2, 'Two', 'latest'), post(1, 'One', 'stable')] } } } });
  test('golden icon opens the viewer, reading clears it', { tag: ['@sandbox', '@env'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate(() => localStorage.removeItem('st:news:full'));   // the viewer remembers full screen in the profile
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
  test('a phone: full screen, the list or one post', { tag: ['@sandbox', '@env'] }, async ({ page, inject }) => {
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
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['event_horizon'], stNews: { at: Date.now(), since: 1, seen: [], items: full } } } });
  // GitHub's discussions API, answered here: anonymous calls get 60 an hour per address, and the nightly runners and
  // a day of local runs use them up ("403 rate limit exceeded"), so the live API failed this spec every night.
  // Page 1 has no announcements and links to page 2, the last; page 2 has 25 older ones, of which 20 are appended.
  const older = Array.from({ length: 25 }, (_, k) => ({ number: 980000 - k, title: 'Older ' + (k + 1), html_url: 'https://github.com/x/' + k,
    created_at: new Date(Date.UTC(2025, 0, 28 - k)).toISOString(), body: '', body_html: '<p>Older ' + (k + 1) + '</p>',
    category: { slug: 'announcements' }, labels: [{ name: 'area | apollo editor' }] }));
  test('scrolling to the end loads older posts', { tag: ['@sandbox'] }, async ({ page, inject, context }) => {
    const asked = [];
    answerGm(context, ({ url }) => {
      const m = /^https:\/\/api\.github\.com\/repos\/[^/]+\/[^/]+\/discussions\?per_page=100&page=(\d+)$/.exec(url);
      if (!m) return null;
      asked.push(+m[1]);
      return m[1] === '1'
        ? { status: 200, url, headers: 'content-type: application/json\r\nlink: <' + url.replace(/page=1$/, 'page=2') + '>; rel="last"', body: '[]' }
        : { status: 200, url, headers: 'content-type: application/json', body: JSON.stringify(m[1] === '2' ? older : []) };
    });
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.waitForSelector('#mbu-dock', { timeout: 15000 });
    await until(() => page.evaluate(() => document.documentElement.hasAttribute('data-st-news')), v => v, { timeout: 5000 });
    await page.click('#mbu-dock');
    await page.waitForSelector('#st-news-list li[data-n="19"]', { timeout: 5000 });
    await page.$eval('#st-news-list', l => { l.scrollTop = l.scrollHeight; });
    const n = await until(() => page.$$eval('#st-news-list li[data-n]', xs => xs.length), v => v > 20, { timeout: 30000 });
    check(n === 40, `20 older posts appended (${n}, pages asked: ${asked.join(', ')})`);
    check((await page.textContent('#st-news-n')) === String(n), 'the footer counts them');
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-more.png' });
  });
});
test.describe("what's new, from the site's file", () => {
  // #1123: news.json on the project site, rebuilt whole by the pages workflow; each check replaces the list with it
  const filePost = (id, title, at) => ({ id, title, url: 'https://github.com/x/' + id, at, edited: '', html: '<p>' + title + '</p>',
    labels: ['area | apollo editor'], issue: 0, channel: 'stable' });
  const day = (k) => new Date(Date.now() - k * 864e5).toISOString();
  // cached: 3 (unread), 2 (read), 1 (read); the file meanwhile edited 3, deleted 2, and has 44 older ones after 1
  const cached = [3, 2, 1].map((id) => ({ id, title: 'Old ' + id, url: 'https://github.com/x/' + id, at: day(4 - id), html: '<p>Old ' + id + '</p>',
    script: 'Apollo Editor', icon: '', issue: 0, channel: '' }));
  const file = { generated: day(0), items: [filePost(3, 'Edited 3', day(1)), filePost(1, 'Old 1', day(3))]
    .concat(Array.from({ length: 44 }, (_, k) => filePost(970000 - k, 'File older ' + (k + 1), day(10 + k)))) };
  test.use({ gm: { name: 'String Theory', values: { 'string_theory.off': ['event_horizon'], stNews: { at: 0, since: 1, seen: [2, 1], items: cached } } } });
  test('edits and deletions follow the file, older posts come from it', { tag: ['@sandbox'] }, async ({ page, inject, context }) => {
    const asked = [];
    answerGm(context, ({ url }) => {
      if (url === 'https://milic.info/musicbrainz-userscripts/news.json') { asked.push('file'); return { status: 200, url, headers: 'content-type: application/json', body: JSON.stringify(file) }; }
      if (/^https:\/\/api\.github\.com\//.test(url)) { asked.push('api'); return { status: 500, url, headers: '', body: '' }; }
      return null;
    });
    await page.goto(`${SANDBOX}/search/edits`, { waitUntil: 'load', timeout: 60000 });
    await inject('string_theory');
    await page.waitForSelector('#mbu-dock', { timeout: 15000 });
    await until(() => page.evaluate(() => document.documentElement.hasAttribute('data-st-news')), v => v, { timeout: 10000 });
    await page.click('#mbu-dock');
    await page.waitForSelector('#st-news-list li[data-n="19"]', { timeout: 5000 });
    const titles = await page.$$eval('#st-news-list li[data-n] .t', xs => xs.map(x => x.textContent));
    check(titles[0] === 'Edited 3', `an edited post shows its new title (${titles[0]})`);
    check(!titles.includes('Old 2'), 'a deleted post is gone');
    check(titles.length === 20, `the newest 20 are kept (${titles.length})`);
    check((await page.textContent('#st-news-view h3 .n')) === 'Edited 3' && (await page.textContent('#st-news-view .b')).includes('Edited 3'), 'its new text');
    // scrolled to the end on every look: each scroll to the end loads the next 20
    const n = await until(() => page.$eval('#st-news-list', l => { l.scrollTop = l.scrollHeight; l.dispatchEvent(new Event('scroll')); return l.querySelectorAll('li[data-n]').length; }), v => v >= 46, { timeout: 30000 });
    check(n === 46, `older posts come from the file, to its end (${n})`);
    check(!asked.includes('api'), `no GitHub API call (${asked.join(', ')})`);
  });
});
