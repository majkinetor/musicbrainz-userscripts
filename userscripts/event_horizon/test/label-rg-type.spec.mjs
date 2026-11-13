import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const LABEL = 'https://test.musicbrainz.org/label/04201e6d-c430-4a53-a9a0-56170825fbde';

const heads = page => page.$$eval('table.ed-t thead th[data-c]:not([hidden])', x => x.map(h => h.dataset.c).join());

test("a label's releases show their release group's type", { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(LABEL);
  await inject('event_horizon');
  await until(() => page.locator('[data-edview="table"]').count(), n => n > 0);
  await page.locator('[data-edview="table"]').first().click();
  await until(() => page.locator('table.ed-t tbody tr.ed-r').count(), n => n > 1);
  check((await heads(page)).includes('format,rgtype'), 'Type follows Format');
  const types = await page.$$eval('table.ed-t tbody tr.ed-r td[data-c="rgtype"]', x => x.map(t => t.textContent.trim()));
  check(types.some(Boolean), 'the rows have a type');
});
