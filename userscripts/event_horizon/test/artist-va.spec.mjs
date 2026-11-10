import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// MB's ?va=1 on an artist page lists the various-artists release groups it appears on, even when it has its own;
// the Discography header switches between the two
test('an artist page follows ?va=1 and switches back to its own groups', { tag: '@prod' }, async ({ page, inject }) => {
  const id = 'c0463607-f9a1-4bfe-b058-de3bbd3fc9ce'; // Baltes: one own single, two Various Artists compilations
  const titles = () => page.locator('#s-dg a[href*="/release-group/"]').allInnerTexts();
  await page.goto(`https://musicbrainz.org/artist/${id}?all=0&va=1`);
  await inject('event_horizon');
  const va = await until(titles, l => l.some(t => /Schwingungen/.test(t)));
  check(va.some(t => /Schwingungen/.test(t)) && !va.some(t => /Where You Are/.test(t)), 'va=1 lists the various-artists groups only');
  await page.locator('#s-dg .secthead a', { hasText: 'Own release groups' }).click();
  const own = await until(titles, l => l.some(t => /Where You Are/.test(t)));
  check(own.some(t => /Where You Are/.test(t)) && !own.some(t => /Schwingungen/.test(t)), 'Own release groups shows its own single');
  check(!/va=1/.test(page.url()), 'the address drops va=1');
  await page.locator('#s-dg .secthead a', { hasText: 'Various artists' }).click();
  check((await until(titles, l => l.some(t => /Schwingungen/.test(t)))).length > 0, 'Various artists switches back');
});
