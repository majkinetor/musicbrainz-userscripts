// Settings v2 made the panel start minimized. Before it the whole settings object was saved, so an
// install that ever saved one setting has minimized: false stored: the old default, not a choice.
// It is dropped once and the panel starts minimized; another stored setting stays.
import { test, check, idle, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

const ARTIST = '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11';   // Portishead, on the sandbox
test.use({ gm: { name: 'Mammoth', values: { 'mammoth:settings': JSON.stringify({ minimized: false, visibleRows: 4 }) } } });

test('settings v2: an old stored minimized: false gives way to the minimized panel', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/artist/${ARTIST}/edit`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await idle(page);
  await inject('mammoth');
  const title = await page.locator('.mmth-min-btn').first().getAttribute('data-tip');
  check(title === 'Restore the panel', `the panel starts minimized (min button: ${title})`);
});
