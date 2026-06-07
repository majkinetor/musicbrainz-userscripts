// #154 — dump the native medium-header DOM (fieldset.advanced-medium) so we can target it with
// Apollo-themed CSS: the legend, collapse toggle, format cell, "Medium title" row, move/remove buttons.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '60e810ef-7ef1-4e90-8482-ab4653802786';

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(1200);
await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
await page.waitForTimeout(800);

const dump = await page.evaluate(() => {
  const fs = document.querySelector('fieldset.advanced-medium');
  if (!fs) return { err: 'no fieldset.advanced-medium' };
  const brief = el => {
    if (!el) return null;
    return {
      tag: el.tagName.toLowerCase(),
      cls: el.className || '',
      id: el.id || '',
      type: el.getAttribute && el.getAttribute('type'),
      text: (el.textContent || '').trim().slice(0, 40),
      title: el.getAttribute && el.getAttribute('title'),
    };
  };
  const legend = fs.querySelector('legend');
  const headerRow = fs.querySelector('table') ? null : null;
  // collect the structural children of the fieldset (header area) before the track table
  const trackTbl = [...fs.querySelectorAll('table')].find(t => t.querySelector('tr.track'));
  const buttons = [...fs.querySelectorAll(':scope button, :scope a.icon, :scope input[type=button], :scope .buttons button')].slice(0, 20).map(brief);
  const inputs = [...fs.querySelectorAll('input[type=text]')].slice(0, 6).map(brief);
  const labels = [...fs.querySelectorAll('label')].slice(0, 8).map(l => ({ for: l.getAttribute('for'), text: (l.textContent || '').trim().slice(0, 30), cls: l.className }));
  // the top-level structure: fieldset > legend + (rows) — capture outerHTML of the header region (sans track table)
  const clone = fs.cloneNode(true);
  const ct = [...clone.querySelectorAll('table')].find(t => t.querySelector('tr.track'));
  if (ct) ct.remove();
  // also drop any Apollo-injected section + the giant <option> lists to see native structure
  clone.querySelectorAll('.tc-medsec, #tc-mirror-wrap, option').forEach(n => n.remove());
  const headerHtml = clone.innerHTML.replace(/\s+/g, ' ').slice(0, 3000);
  // every icon button/link in the header (move up/down, remove, collapse, Aa guess-case)
  const iconCtrls = [...fs.querySelectorAll('button.icon, a.icon, button[data-click], a[data-click]')].map(brief);
  return { legend: brief(legend), iconCtrls, inputs, labels, headerHtml };
});

console.log(JSON.stringify(dump, null, 2));
await ctx.close();
