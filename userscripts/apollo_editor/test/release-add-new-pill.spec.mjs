// Adding a release reads as the other Add pages: the bar's New pill replaces MB's heading.
import { test, expect } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('/release/add shows New · Release in the bar and no "Add release" heading', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: {} });
  await page.waitForSelector('#tc-nav-title .tc-nav-new', { timeout: 15000 });
  const s = await page.evaluate(() => {
    const h = document.querySelector('#content > h1, #page > h1'), t = document.getElementById('tc-nav-title');
    return { h1: h ? getComputedStyle(h).display : 'gone', kind: t.querySelector('.tc-nav-kind').textContent, name: t.querySelector('.tc-nav-title-name').textContent };
  });
  expect(['none', 'gone']).toContain(s.h1);
  expect(s.kind.trim()).toMatch(/^new\s*release$/i);
  expect(s.name).toBe('Untitled');
});
