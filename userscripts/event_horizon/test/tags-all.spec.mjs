import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// MusicBrainz's most used tags (/tags) in the tags view, as a cloud first, with no voting and no Downvotes switch
test('/tags shows the most used tags in the tags view', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/tags');
  await inject('event_horizon');
  const n = await until(() => page.locator('#tg-body a[href*="/tag/"]').count(), c => c > 0);
  check(n > 0, `the tags show (${n})`);
  check(!(await page.locator('.tg-sw').count()), 'no Downvotes switch');
  check(!(await page.locator('.tg-vote').count()), 'no vote buttons');
  const href = await page.locator('#tg-body a[href*="/tag/"]').first().getAttribute('href');
  check(/\/tag\/[^/]+$/.test(href), `a tag links to its own page (${href})`);
  await page.locator('[data-tgset="view:table"]').click();
  const cell = await until(() => page.locator('.tg-t tbody tr').first().locator('td').nth(2).textContent().catch(() => ''), t => /\d/.test(t));
  check(+cell.replace(/\D/g, '') > 0, `the table shows a count (${cell})`);
  await page.screenshot({ path: 'test-results/eh-tags-all.png' });
});

test('the home search bar links to /tags', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  const a = page.locator('a.hm-es[href$="/tags"]');
  await until(() => a.count(), c => c > 0);
  await a.first().click();
  await until(() => page.locator('#tg-body a[href*="/tag/"]').count(), c => c > 0);
  check(new URL(page.url()).pathname === '/tags', `the link opens /tags (${page.url()})`);
});
