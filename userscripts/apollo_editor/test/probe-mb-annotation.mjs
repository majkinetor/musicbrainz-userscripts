// Capture MusicBrainz's OWN annotation renderer from the standalone edit_annotation page, so we can
// compare our annoToHtml preview against it (and learn MB's real nested-bullet syntax).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const URL = process.env.MB_ANNO_URL || 'https://musicbrainz.org/release/933de217-cb24-4d7f-bba1-1c6fe8b72aab/edit_annotation';
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: true, viewport: { width: 1200, height: 1200 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN to musicbrainz.org (production) — profile may only have beta'); await ctx.close(); process.exit(3); }

// the annotation textarea on this form
const taSel = await page.evaluate(() => {
  const t = document.querySelector('textarea[name="edit-annotation.text"], textarea[name$=".text"], #annotation, textarea');
  return t ? (t.name ? `textarea[name="${t.name}"]` : 'textarea') : null;   // id has a literal dot → use name
});
console.log('textarea selector:', taSel);
if (!taSel) { console.error('no annotation textarea found'); await ctx.close(); process.exit(2); }

const DOC = [
  '= Heading 1 =',
  '== Heading 2 ==',
  '=== Heading 3 ===',
  '',
  "Para with '''bold''' and ''italic'' and '''''both'''''.",
  '',
  'A [https://example.com|labeled link] and bare https://example.com here.',
  '',
  '    * bullet one',
  '    * bullet two',
  '        * candidate nested (8sp+*)',
  '    ** candidate nested (4sp+**)',
  '    * bullet three',
  '',
  '----',
  '',
  '        code line 1',
  '        code line 2',
].join('\n');

await page.fill(taSel, DOC);
// MB's edit forms have a "Preview" submit button; click it and read the rendered annotation
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, input[type=submit]')].find(e => /preview/i.test(e.textContent || e.value || ''));
  if (b) { b.click(); return true; } return false;
});
console.log('clicked preview:', clicked);
await page.waitForLoadState('domcontentloaded').catch(() => {});
await page.waitForTimeout(1200);

const html = await page.evaluate(() => {
  const cand = document.querySelector('.annotation-preview, .preview .annotation, div.annotation, .wikicontent, #content .annotation, .preview');
  return cand ? cand.innerHTML : null;
});
console.log('\n===== MB RENDERED ANNOTATION HTML =====\n');
console.log(html || '(preview container not found — dumping body text)');
if (!html) { console.log((await page.evaluate(() => document.querySelector('#page, #content, body')?.innerText.slice(0, 1500)))); }
await page.screenshot({ path: resolve(HERE, 'logs', 'mb-annotation-preview.png'), fullPage: true }).catch(() => {});
await ctx.close();
