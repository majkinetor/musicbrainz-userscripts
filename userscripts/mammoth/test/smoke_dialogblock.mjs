import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const script = readFileSync('userscripts/mammoth/mammoth.user.js', 'utf8');
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2,
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/recording/7e015d5f-4026-4739-ba98-7d4cd1680e91/edit', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.addScriptTag({ content: script });
await page.waitForTimeout(1200);

// configure a custom field for ".attribute-credit"
await page.evaluate(() => document.querySelector('button[title="Settings"]')?.click());
await page.waitForTimeout(150);
await page.evaluate(() => document.querySelector('.mmth-cfgtab[data-tab="fields"]')?.click());
await page.waitForTimeout(120);
await page.evaluate(() => {
  document.querySelector('.mmth-cf-add').click();
  const row = document.querySelector('.mmth-cf-row');
  const set = (c, v) => { const i = row.querySelector(c); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
  set('.mmth-cf-match', '.attribute-credit'); set('.mmth-cf-label', 'Credited as');
});
await page.waitForTimeout(600);
await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
await page.waitForTimeout(200);

// helper: build a faithful MB relationship dialog and measure
const measure = hasTask => page.evaluate(hasTask => {
  document.querySelectorAll('.dialog.popover.__t').forEach(d => d.remove());
  const dlg = document.createElement('div'); dlg.className = 'dialog popover __t';
  dlg.style.cssText = 'position:absolute;left:200px;top:200px;width:520px;background:#fff;border:1px solid #ccc;padding:16px;';
  dlg.innerHTML =
    '<div class="attribute-container text"><label>Artist</label><input class="relationship-target lookup-performed" type="text" value="Mocky"></div>' +
    '<div class="attribute-container credit"><input class="attribute-credit" type="text" placeholder="Credited as"></div>' +
    (hasTask ? '<div class="attribute-container text task"><input type="text" placeholder="Task"></div>' : '<div class="attribute-container"><label>Instrument</label><input class="relationship-target" type="text" value="bass"></div>');
  document.body.appendChild(dlg);
  return true;
}, hasTask);

async function snap(label, hasTask) {
  await measure(hasTask);
  await page.waitForTimeout(700); // let scan (150ms) + re-sync run
  const r = await page.evaluate(() => {
    const dlg = document.querySelector('.dialog.popover.__t');
    const cf = dlg.querySelector('.attribute-credit');
    const pin = [...document.querySelectorAll('.mmthf-pin')].find(p => /Credited as/i.test(p.title || ''));
    return {
      blockingClass: document.documentElement.classList.contains('mmthf-dialog'),
      creditPinned: cf.dataset.mmthf === '1',
      pinExists: !!pin,
      pinVisible: pin ? (getComputedStyle(pin).opacity !== '0' && pin.style.display !== 'none') : false,
    };
  });
  console.log(`[${label}]`, JSON.stringify(r));
  await page.evaluate(() => document.querySelector('.dialog.popover.__t')?.remove());
  await page.waitForTimeout(300);
  return r;
}

const bass = await snap('instrument dialog (no Task) — bass case', false);
const mixer = await snap('mixed dialog (has Task) — mixer case', true);
// control: a blocking dialog with NO baby field must still block
await page.evaluate(() => { const d = document.createElement('div'); d.className = 'dialog popover __t'; d.innerHTML = '<input type="text" class="nothing">'; document.body.appendChild(d); });
await page.waitForTimeout(500);
const control = await page.evaluate(() => document.documentElement.classList.contains('mmthf-dialog'));
console.log('[control] plain dialog (no baby) still blocking:', control);

console.log('\nRESULT:', (bass.pinVisible && mixer.pinVisible && control) ? 'PASS — credited-as pin shows in BOTH, plain dialog still blocks' : 'FAIL');
console.log('pageerrors:', errs.length ? errs.slice(0, 4) : 'none');
await ctx.close();
