import { test, expect, loadFunctions } from '../../../dev/test/harness.mjs';

test('title separators inside brackets stay in the title', { tag: '@unit' }, async () => {
  const { heroTitleParts } = await loadFunctions('event_horizon', ['heroTitleParts']);
  for (const title of ['Post (bonus disc: Extra)', 'Post (bonus disc - Extra)', 'Post [bonus disc: Extra]', 'Post {bonus disc: Extra}', 'Post (bonus [disc: Extra] - live)']) {
    expect(heroTitleParts(title)).toEqual([title]);
  }
  expect(heroTitleParts('Post (bonus disc: Extra): Live')).toEqual(['Post (bonus disc: Extra)', 'Live']);
  expect(heroTitleParts('Post [bonus disc - Extra] — Live')).toEqual(['Post [bonus disc - Extra]', 'Live']);
  expect(heroTitleParts('Post: Live (bonus disc: Extra)')).toEqual(['Post', 'Live (bonus disc: Extra)']);
  for (const separator of [': ', ' - ', ' – ', ' — ', ' − ']) {
    expect(heroTitleParts('Post' + separator + 'Live')).toEqual(['Post', 'Live']);
  }
  expect(heroTitleParts('Post')).toEqual(['Post']);
  expect(heroTitleParts('')).toEqual(['']);
});
