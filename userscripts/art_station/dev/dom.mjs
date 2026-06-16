import { createRequire } from 'module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/cover-art`, { waitUntil: 'domcontentloaded' });
const out = await page.evaluate(() => {
  const c = document.querySelector('#content');
  if (!c) return 'no #content';
  const desc = el => `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''}>`;
  return [...c.children].map(ch => {
    const flags = [];
    if (ch.querySelector('ul.tabs') || ch.matches?.('ul.tabs')) flags.push('HAS-TABS');
    if (ch.querySelector('.artwork-cont')) flags.push('HAS-ARTWORK');
    if (ch.tagName === 'H1' || ch.querySelector('h1')) flags.push('HAS-H1');
    return desc(ch) + (flags.length ? '  [' + flags.join(', ') + ']' : '');
  }).join('\n');
});
console.log(out);
const tabsLoc = await page.evaluate(() => {
  const t = document.querySelector('ul.tabs');
  if (!t) return 'no ul.tabs';
  let chain = [], n = t;
  while (n && n.id !== 'content') { chain.push(n.tagName.toLowerCase() + (n.className ? '.' + String(n.className).trim().split(/\s+/)[0] : '')); n = n.parentElement; }
  return 'tabs chain up to #content: ' + chain.join(' < ');
});
console.log(tabsLoc);
await ctx.close();
