import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ALBUM = process.argv.find(a => /^\d+$/.test(a)) || '73397990';
const ctx = await chromium.launchPersistentContext(resolve(HERE, 'logs', '193-info', 'ctx2'), {
  headless: true, viewport: { width: 1400, height: 1200 },
  locale: 'en-US', extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://tidal.com/album/${ALBUM}/credits`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-test="album-info-item"]', { timeout: 30000 }).catch(()=>{});
await page.waitForTimeout(1500);
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')].map(t => ({
    text: (t.textContent||'').trim(), cls: t.className, sel: t.getAttribute('aria-selected'),
    href: t.getAttribute('href'), tag: t.tagName,
  }));
  // also any element whose text is exactly Credits/Zasluge or Info/Informacije
  const tablistHtml = document.querySelector('[role="tablist"]')?.outerHTML?.slice(0, 600) || '(no tablist)';
  return { tabCount: tabs.length, tabs, tablistHtml };
});
console.log(JSON.stringify(info, null, 2));
await ctx.close();
