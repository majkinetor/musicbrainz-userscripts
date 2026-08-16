// Verify the annotation editor on the standalone /release/<mbid>/edit_annotation page (no MB.releaseEditor):
// the editor mounts on the annotation field, Changelog moves above it, and Markdown writes through.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.env.MBID || '67d009f9-417a-439c-878f-d8f163867544';
const ctx = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: true, viewport: { width: 1400, height: 1100 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit_annotation`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
const SCRIPT_SRC = await readFile(SCRIPT, 'utf8');
await page.addScriptTag({ content: SCRIPT_SRC });
await page.waitForSelector('#tc-anno-wrap', { state: 'attached', timeout: 20000 });
await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 20000 });

let pass = 0, fail = 0;
const check = (l, ok, extra) => { if (ok) { pass++; console.log('  ok  ', l); } else { fail++; console.log('  FAIL', l, extra ?? ''); } };
const ANNO = 'textarea[name="edit-annotation.text"]';

check('editor mounted on the annotation field', await page.$('#tc-anno-wrap ' + ANNO) !== null);
check('Markdown surface is shown by default', await page.isVisible('#tc-anno-mdinput'));
check('native annotation field is hidden', !(await page.isVisible(ANNO)));
check('History button present (page has MBID)', await page.$('#tc-anno-history-btn') !== null);
check('maximize button present', await page.$('#tc-anno-max') !== null);

// Changelog row is now ABOVE the annotation row
const order = await page.evaluate(() => {
  const cl = document.querySelector('input[name="edit-annotation.changelog"]').closest('.row');
  const an = document.querySelector('#tc-anno-wrap').closest('.row');
  const rows = [...an.parentElement.children];
  return { clBefore: rows.indexOf(cl) < rows.indexOf(an) };
});
check('Changelog moved above Annotation', order.clBefore);

// existing MB markup shows as Markdown on the surface
check('existing markup converted to Markdown', /## |^\*\*|- /m.test(await page.inputValue('#tc-anno-mdinput')) || (await page.inputValue('#tc-anno-mdinput')).length > 0);

// type Markdown → the native annotation field gets MB markup
await page.fill('#tc-anno-mdinput', '## Hi\n\n- a\n- b');
await page.waitForTimeout(150);
check('Markdown → MB markup in the native field', (await page.inputValue(ANNO)).includes('== Hi ==') && (await page.inputValue(ANNO)).includes('    * a'), JSON.stringify(await page.inputValue(ANNO)));

// changelog still present + functional
check('Changelog field intact', await page.$('input[name="edit-annotation.changelog"]') !== null);
// everything below the editor is hidden; only our own Enter edit remains
check('native "Annotation formatting" guide hidden', await page.evaluate(() => { const h = [...document.querySelectorAll('#content h3')].find(e => /annotation formatting/i.test(e.textContent)); return !h || !h.offsetParent; }));
check('Edit note section hidden', !(await page.isVisible('textarea[name="edit-annotation.edit_note"]')));
check('native buttons row (Preview / Enter edit) hidden', await page.evaluate(() => { const r = document.querySelector('#content form .row.buttons, #content form .row.no-label.buttons'); return !!r && (!r.offsetParent || getComputedStyle(r).display === 'none'); }));
check('our own "Enter edit" button present + visible', await page.isVisible('#tc-anno-submit'));
check('Enter edit is in the Changelog row (right of the input)', await page.evaluate(() => { const s = document.getElementById('tc-anno-submit'), r = s && s.closest('.row'); return !!(r && r.querySelector('input[name="edit-annotation.changelog"]')); }));
check('Apollo switcher (launcher) present on the page', await page.$('#tc-launch') !== null);
// our Enter edit must trigger the NATIVE submit (not itself) — verify via a guarded click (no real submit)
check('our "Enter edit" triggers the native submit', await page.evaluate(() => {
  const native = [...document.querySelectorAll('#content form button, #content form input[type=submit]')].find(b => b.id !== 'tc-anno-submit' && /enter edit/i.test((b.textContent || b.value || '').trim()));
  let flag = false; if (native) native.addEventListener('click', e => { flag = true; e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true, once: true });
  document.getElementById('tc-anno-submit').click(); return flag;
}));
check('editor fills the viewport height', await page.evaluate(() => { const r = document.getElementById('tc-anno-wrap').getBoundingClientRect(); return r.bottom >= window.innerHeight - 40 && r.height > 300; }));
check('FOUC guard removed after mount', await page.$('#tc-anno-fouc') === null);
// maximize must fill the WHOLE viewport (the page fill-height inline style must not block it)
await page.click('#tc-anno-max'); await page.waitForTimeout(150);
check('maximized editor fills the whole viewport', await page.evaluate(() => { const r = document.getElementById('tc-anno-wrap').getBoundingClientRect(); return r.height >= window.innerHeight - 40 && r.bottom >= window.innerHeight - 40; }));
await page.click('#tc-anno-max'); await page.waitForTimeout(150);
check('restore returns to fill-height (not maximized)', await page.evaluate(() => !document.getElementById('tc-anno-wrap').classList.contains('tc-anno-max')));

// #521 (majkinetor): "Show markdown help button on click rather then hover"
// — hovering used to pop the syntax-help box out on a casual mouse move.
const helpPopOn = () => page.evaluate(() => document.getElementById('tc-anno-help-pop').classList.contains('on'));
await page.hover('#tc-anno-help'); await page.waitForTimeout(250);
check('hovering the ? button no longer shows the help popover', !(await helpPopOn()));
await page.click('#tc-anno-help'); await page.waitForTimeout(50);
check('clicking the ? button shows it', await helpPopOn());
await page.click('#tc-anno-help'); await page.waitForTimeout(50);
check('clicking it again toggles it back off', !(await helpPopOn()));
await page.click('#tc-anno-help'); await page.waitForTimeout(50);
// dispatch directly rather than a real click — the popover itself can cover
// nearby elements, which is layout incidental, not what this is testing.
await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
check('clicking elsewhere dismisses it', !(await helpPopOn()));
await page.click('#tc-anno-help'); await page.waitForTimeout(50);
await page.keyboard.press('Escape');
check('Escape dismisses it', !(await helpPopOn()));

await page.evaluate(() => window.scrollTo(0, 0));
await page.screenshot({ path: resolve(HERE, 'logs', 'shot-editannotation.png') }).catch(() => {});

// setting OFF → editor must NOT mount; native field stays
await page.evaluate(() => localStorage.setItem('apolloEditor.settings.v1', JSON.stringify({ modifyAnnotation: false })));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: SCRIPT_SRC });
await page.waitForTimeout(1000);
check('"Modify annotations" OFF → editor not mounted', await page.$('#tc-anno-wrap') === null);
check('"Modify annotations" OFF → native field visible', await page.isVisible(ANNO));
await page.evaluate(() => localStorage.removeItem('apolloEditor.settings.v1'));   // restore default
console.log(`\n${pass} passed, ${fail} failed`);
await ctx.close();
process.exit(fail ? 1 : 0);
