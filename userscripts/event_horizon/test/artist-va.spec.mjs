import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// MB's ?va=1 on an artist page lists the various-artists release groups it appears on, even when it has its own;
// EH's ?va=2 lists both; the Discography header switches between the three
test('an artist page follows ?va=1, ?va=2 lists both, the header switches', { tag: '@prod' }, async ({ page, inject }) => {
  const id = 'c0463607-f9a1-4bfe-b058-de3bbd3fc9ce'; // Baltes: one own single, two Various Artists compilations
  const titles = () => page.locator('#s-dg a[href*="/release-group/"]').allInnerTexts();
  const sw = t => page.locator('#s-dg .secthead .vasw a', { hasText: new RegExp(`^${t}$`) });
  await page.goto(`https://musicbrainz.org/artist/${id}?all=0&va=1`);
  await inject('event_horizon');
  const va = await until(titles, l => l.some(t => /Schwingungen/.test(t)));
  check(va.some(t => /Schwingungen/.test(t)) && !va.some(t => /Where You Are/.test(t)), 'va=1 lists the various-artists groups only');
  await sw('Own').click();
  const own = await until(titles, l => l.some(t => /Where You Are/.test(t)));
  check(own.some(t => /Where You Are/.test(t)) && !own.some(t => /Schwingungen/.test(t)), 'Own shows its own single');
  check(!/va=/.test(page.url()), 'the address drops va');
  await sw('Both').click();
  const both = await until(titles, l => l.some(t => /Schwingungen/.test(t)) && l.some(t => /Where You Are/.test(t)));
  check(both.some(t => /Dreamzcape/.test(t)), 'Both lists its own single and the compilations');
  check(/va=2/.test(page.url()), 'the address carries va=2');
  await sw('Various artists').click();
  check((await until(titles, l => l.some(t => /Schwingungen/.test(t)) && !l.some(t => /Where You Are/.test(t)))).length > 0, 'Various artists switches back');
});
