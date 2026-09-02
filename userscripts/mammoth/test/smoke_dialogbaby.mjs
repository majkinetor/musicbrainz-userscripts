import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/mammoth/mammoth.user.js', 'utf8');
const GID = process.argv[2] || '7e015d5f-4026-4739-ba98-7d4cd1680e91'; // Music to My Ears — Mocky
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(`https://musicbrainz.org/recording/${GID}/edit`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.addScriptTag({ content: script });
await page.waitForTimeout(1500);

// add a custom field for the dialog "Credited as" via the Fields tab
await page.evaluate(() => document.querySelector('button[title="Settings"]')?.click());
await page.waitForTimeout(200);
await page.evaluate(() => document.querySelector('.mmth-cfgtab[data-tab="fields"]')?.click());
await page.waitForTimeout(150);
await page.evaluate(() => {
  document.querySelector('.mmth-cf-add').click();
  const row = document.querySelector('.mmth-cf-row');
  const inp = row.querySelector('.mmth-cf-match'); inp.value = '.attribute-credit'; inp.dispatchEvent(new Event('input', { bubbles: true }));
  const lbl = row.querySelector('.mmth-cf-label'); lbl.value = 'Credited as'; lbl.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(700);
// close the config so it doesn't sit over the dialog
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await page.waitForTimeout(200);

async function openRelDialog(roleText) {
  // find the relationships row whose label matches roleText and click its first pencil (edit-item)
  return page.evaluate(role => {
    const rows = [...document.querySelectorAll('tr, li, p, div')];
    // MB recording edit page lists roles as "<b>bass:</b> ... pencil". Find a pencil near text.
    const pencils = [...document.querySelectorAll('button.icon.edit-item, .rel-editor a.icon.edit-item, a.edit-item, button.edit-item')];
    // fallback: any element whose text starts with the role, then its nearest edit control
    let target = null;
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && new RegExp('^' + role + '\\b', 'i').test((el.textContent || '').trim())) { target = el; break; }
    }
    if (!target) return { ok: false, reason: 'role label not found' };
    const container = target.closest('tr, li, div, p') || target.parentElement;
    const pencil = container && (container.querySelector('button.icon.edit-item, a.edit-item, .edit-item'));
    if (!pencil) return { ok: false, reason: 'no pencil' };
    pencil.click();
    return { ok: true };
  }, roleText);
}

async function inspectDialog(label) {
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const dlg = document.querySelector('.dialog.popover, .relationship-dialog');
    if (!dlg) return { dialog: false };
    const credited = dlg.querySelectorAll('.attribute-credit');
    const hasTask = !!dlg.querySelector('.attribute-container.text.task input, .task input');
    // pins whose field is inside this dialog
    const pins = [...document.querySelectorAll('.mmthf-pin')];
    const inDlgPins = pins.filter(p => { const t = p.title || ''; return /Credited as/i.test(t); });
    const visiblePins = inDlgPins.filter(p => getComputedStyle(p).opacity !== '0' && p.style.display !== 'none');
    return {
      dialog: true,
      creditedFields: credited.length,
      creditedPinned: [...credited].filter(c => c.dataset.mmthf === '1').length,
      hasTask,
      htmlBlockingClass: document.documentElement.classList.contains('mmthf-dialog'),
      creditedPins: inDlgPins.length, creditedPinsVisible: visiblePins.length,
    };
  });
  console.log(`[${label}]`, JSON.stringify(info));
  return info;
}

const p = await openRelDialog('producer');
console.log('open producer dialog:', JSON.stringify(p));
await inspectDialog('producer');
await page.evaluate(() => document.querySelector('.dialog.popover button.negative, .dialog.popover .cancel, button.cancel')?.click());
await page.waitForTimeout(300);

const b = await openRelDialog('bass');
console.log('open bass dialog:', JSON.stringify(b));
const bassInfo = await inspectDialog('bass');
await page.screenshot({ path: 'userscripts/mammoth/test/_smoke_dialogbaby.png' });
console.log('pageerrors:', errs.length ? errs.slice(0, 4) : 'none');
await ctx.close();
