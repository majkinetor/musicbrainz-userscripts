import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// a release whose first tracks' recordings carry tags (A1 tag1 tag2 …)
const RELEASE = 'https://test.musicbrainz.org/release/8e2c6a06-3c10-481f-a83a-1ecad781954d';

test('Show › Tags puts recording tags after the title, off at first', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(RELEASE);
  await inject('event_horizon');
  const btn = page.locator('.tx[data-col="tags"]');
  await until(() => btn.count(), n => n === 1);
  check(await btn.getAttribute('aria-pressed') === 'false', 'the toggle starts off');
  check(!(await page.locator('.tl .tr .tg').first().isVisible()), 'tags hidden while off');
  await btn.click();
  await until(() => page.locator('.tl .tr .tg').first().isVisible(), v => v);
  const first = await page.locator('.tl .tr').first().locator('.tg .chip').allInnerTexts();
  check(first.join() === 'tag1,tag2', `A1 shows its tags (${first})`);
  await page.locator('.tl .tr').first().locator('.n').click();
  // the recording's facts box: its short line names the tags; opened, it has the chips with their votes
  await until(() => page.locator('.detail [data-fx]').count(), n => n > 0);
  check(/tag1, tag2/.test(await page.locator('.detail').first().textContent()), 'the facts line names the tags');
  if (!(await page.locator('.rtg').count())) await page.locator('.detail [data-fx]').first().click();
  const rt = await until(() => page.evaluate(() => (document.querySelector('.rtg') || {}).textContent || ''), t => /tag1/.test(t));
  check(/tag1\s*1/.test(rt), `the opened track lists tags with votes (${rt})`);
  await page.screenshot({ path: 'test-results/eh-tags.png' });
});
