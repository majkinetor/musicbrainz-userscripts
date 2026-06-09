// Probe the annotation history page + a "View this version" page to learn how to list versions and
// extract each version's annotation (for the toolbar History feature).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const ctx = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: true });
const page = ctx.pages()[0] || await ctx.newPage();
const mbid = process.env.MBID || '933de217-cb24-4d7f-bba1-1c6fe8b72aab';
await page.goto(`https://musicbrainz.org/release/${mbid}/annotations`, { waitUntil: 'domcontentloaded' });

const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('table.tbl tr, table tr')].map(tr => ({
    cells: [...tr.querySelectorAll('th,td')].map(c => c.textContent.trim().slice(0, 40)),
    links: [...tr.querySelectorAll('a')].map(a => ({ t: a.textContent.trim().slice(0, 30), href: a.getAttribute('href') })),
    radios: [...tr.querySelectorAll('input[type=radio]')].map(r => ({ name: r.name, value: r.value })),
  })).filter(r => r.cells.length);
  return rows.slice(0, 8);
});
console.log('HISTORY ROWS:\n', JSON.stringify(info, null, 1));

// follow the first "view this version" link and see how the annotation is presented
const viewHref = await page.evaluate(() => { const a = [...document.querySelectorAll('a')].find(a => /this version/i.test(a.textContent)); return a && a.getAttribute('href'); });
console.log('\nVIEW HREF:', viewHref);
if (viewHref) {
  await page.goto(new URL(viewHref, 'https://musicbrainz.org').href, { waitUntil: 'domcontentloaded' });
  const v = await page.evaluate(() => {
    const cand = document.querySelector('.annotation .wikicontent, .annotation, .wikicontent, #content .annotation');
    return { url: location.href, h1: document.querySelector('h1,h2')?.textContent?.trim(), annoHtml: cand ? cand.innerHTML.slice(0, 800) : null, bodyText: document.querySelector('#content,#page')?.innerText?.slice(0, 600) };
  });
  console.log('\nVERSION PAGE:', JSON.stringify(v, null, 1));
}
await ctx.close();
