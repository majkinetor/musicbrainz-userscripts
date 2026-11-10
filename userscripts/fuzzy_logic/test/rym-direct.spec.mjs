import { test, expect } from '@playwright/test';
import { functionSource } from '../../../dev/test/harness.mjs';

test('RYM opens the linked album directly in front', { tag: '@unit' }, async ({ page }) => {
  const source = await functionSource('fuzzy_logic', ['readExt']);
  const opened = await page.evaluate(source => {
    const url = 'http://rateyourmusic.com/release/album/test-artist/test-album/';
    const S = { gen: 1, status: { rym: { unread: [url] } } };
    const calls = [];
    const read = new Function('S', 'GM_openInTab', 'GM_addValueChangeListener', 'GM_removeValueChangeListener', 'EXT_KEY', 'draw', source + '; return readExt;')(
      S, (url, options) => { calls.push({ url, options }); return {}; }, () => 1, () => {}, u => u, () => {},
    );
    read('rym');
    return calls;
  }, source);
  expect(opened).toEqual([{
    url: 'https://rateyourmusic.com/release/album/test-artist/test-album/',
    options: { active: true, insert: true, setParent: true },
  }]);
});
