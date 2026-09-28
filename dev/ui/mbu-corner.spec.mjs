// The #468 corner slots (mbRestackCorner, dev/ui/ui-components.mjs), shared since #623:
// launchers from different scripts in one corner stack by their order, whatever order
// they were added in, and a hidden one gives up its slot. On a blank page.
import { test, check } from '../test/harness.mjs';
import { UI_JS } from './ui-components.mjs';

test.use({ profile: 'fresh', gm: false });

test('launchers in one corner stack by order, and a hidden one leaves no gap', { tag: ['@unit'] }, async ({ page }) => {
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addScriptTag({ content: UI_JS });
  const at = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-mb-corner]')].map(el => [el.id, el.style.display === 'none' ? null : { bottom: el.style.bottom, right: el.style.right }])));
  await page.evaluate(() => {
    const add = (id, order, h) => {
      const el = document.createElement('div'); el.id = id;
      el.style.cssText = 'position:fixed;width:40px;height:' + h + 'px';
      el.dataset.mbCorner = 'br'; el.dataset.mbCornerOrder = String(order);
      document.body.appendChild(el); mbRestackCorner('br');
    };
    add('fusion', 30, 30);   // added first, stacks last
    add('falcon', 20, 40);
    add('apollo', 10, 50);
  });
  const a = await at();
  check(a.apollo.bottom === '14px' && a.falcon.bottom === '72px' && a.fusion.bottom === '120px', `stacked by order from the corner (${JSON.stringify(a)})`);
  check(a.apollo.right === '14px' && a.fusion.right === '14px', 'all at the corner\'s side');
  await page.evaluate(() => { document.getElementById('falcon').style.display = 'none'; mbRestackCorner('br'); });
  const b = await at();
  check(b.falcon === null && b.fusion.bottom === '72px', `a hidden launcher gives up its slot (${JSON.stringify(b)})`);
});
