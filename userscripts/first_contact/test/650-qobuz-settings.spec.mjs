// #650 (majkinetor): "Qobuz is missing config UI elements, works fine in others". In Firefox the
// settings window's checkboxes (Icon only, Annotation) drew as nothing on qobuz.com: the page's
// sheet sets appearance:none in a rule only Firefox applies (Chromium never shows the bug), and
// its <meta name="color-scheme" content="dark"> made the native controls dark on our light panel.
// So this spec runs its own Firefox with a small GM stand-in instead of the harness's Chromium.
import { readFile } from 'node:fs/promises';
import { firefox } from '@playwright/test';
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';

test('Qobuz in Firefox: the settings window draws its checkboxes, in our colours', { tag: ['@web'] }, async ({}, testInfo) => {
  const code = await readFile(sourceOf('first_contact'), 'utf8');
  const browser = await firefox.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ bypassCSP: true, viewport: { width: 1600, height: 1000 } });
    await ctx.addInitScript(() => {
      const store = {};
      Object.assign(window, {
        __mbuTest: true, unsafeWindow: window,
        GM_info: { script: { name: 'First Contact', version: 'test' }, scriptHandler: 'test' },
        GM_getValue: (k, d) => (k in store ? store[k] : d), GM_setValue: (k, v) => { store[k] = v; }, GM_deleteValue: k => { delete store[k]; },
        GM_xmlhttpRequest: () => {}, GM_openInTab: () => {},
      });
    });
    const page = await ctx.newPage();
    await page.goto('https://www.qobuz.com/us-en/album/vegas-the-crystal-method/0060075303364', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ content: code });
    await page.locator('#fc-root .fc-more').click();
    await page.locator('#fc-panel').waitFor({ state: 'visible' });
    const boxes = await page.evaluate(() => [...document.querySelectorAll('#fc-panel input[type=checkbox]')].map(el => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      return { cls: el.className, w: Math.round(r.width), h: Math.round(r.height), appearance: cs.appearance, display: cs.display,
        opacity: cs.opacity, visibility: cs.visibility, scheme: cs.colorScheme };
    }));
    console.log('checkboxes:', JSON.stringify(boxes));
    await testInfo.attach('panel', { body: await page.locator('#fc-panel').screenshot(), contentType: 'image/png' });
    check(boxes.length >= 2, `the panel has its checkboxes (${boxes.length})`);
    for (const b of boxes) {
      check(b.w >= 10 && b.h >= 10 && b.appearance !== 'none' && b.display !== 'none' && Number(b.opacity) > 0.5 && b.visibility === 'visible',
        `${b.cls} is drawn (${JSON.stringify(b)})`);
      check(b.scheme === 'light', `${b.cls} takes our light theme, not the page's dark color-scheme (${b.scheme})`);
    }
    const box = page.locator('#fc-panel .fc-iconly-opt'), before = await box.isChecked();
    await page.locator('#fc-panel label:has(.fc-iconly-opt)').click();
    check((await box.isChecked()) !== before, 'clicking the label toggles it');
  } finally {
    await browser.close();
  }
});
