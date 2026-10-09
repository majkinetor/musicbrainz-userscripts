// Apollo's annotation editor, on the pages it takes over (the markup helpers under it are
// in annotation-markup.spec.mjs).
//
// In the release editor: a toolbar beside #annotation; a Markdown surface by default,
//   written through to MusicBrainz's field and model as MusicBrainz markup; the markup
//   toggle; a split live preview; help; Tab/Enter/Ctrl+B list and wrap keys, undoable;
//   maximize; Clear; Join lines; and Apollo off takes it all down.
// On /release/<mbid>/edit_annotation (no release editor): mounted on the field, the
//   changelog moved above it, one "Enter edit" that triggers the page's own; its ? help
//   opens on click, not on hover (#521); "Modify annotations" off leaves the page alone.
// History: the release's annotation versions, each viewable and revertable in place.
//
// On the sandbox; nothing is submitted (the History fixture's versions are made once).
import { test, check, functionSource, SANDBOX, until, idle, frames } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.describe('in the release editor', () => {
  test.use({ gm: apolloGm() });

  test('Markdown in, MusicBrainz markup out, and the toolbar', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, inject }) => {
    page.on('dialog', d => d.accept());   // Clear confirms
    await page.clock.install();   // "not rebuilt by the polls" runs the polls on a fake clock
    const submitted = await openApollo(page, inject, { seed: 'seed-saigon' });
    await page.waitForSelector('#annotation', { state: 'attached', timeout: 20000 });
    await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 20000 });
    const model = () => page.evaluate(() => { const r = MB.releaseEditor.rootField.release(); return typeof r.annotation === 'function' ? r.annotation() : r.annotation; });
    const vis = sel => page.isVisible(sel);
    const md = () => page.inputValue('#tc-anno-mdinput');
    check(await page.$('#tc-anno-wrap #tc-anno-bar') && await page.$('#tc-anno-body #tc-anno-edit > textarea#tc-anno-mdinput') && await page.$('#tc-anno-body #tc-anno-edit > textarea#annotation'), 'toolbar, Markdown surface and the real field, in one box');
    check((await page.$$eval('#tc-anno-bar button', b => b.length)) === 6, 'Preview, Clear, Join, markup, help, maximize (no History on a new release)');
    check(await page.$('#tc-anno-names') === null, 'no Resolve-names button: names resolve by themselves');
    check((await vis('#tc-anno-mdinput')) && !(await vis('#annotation')), 'the Markdown surface is shown, the raw field hidden');
    check(await page.$('#tc-anno-md .tc-mk-ico') && !(await page.$('#tc-anno-md .tc-mk-mb')), 'the toggle shows the Markdown logo');
    check(/mono/i.test(await page.$eval('#tc-anno-mdinput', e => getComputedStyle(e).fontFamily)) && (await page.$eval('#tc-anno-mdinput', e => e.getBoundingClientRect().height)) >= 220, 'monospace, and tall');
    await page.evaluate(() => { document.getElementById('tc-anno-wrap').dataset.tcMark = 'orig'; });
    await page.clock.runFor(3000);   // several polls
    check((await page.$eval('#tc-anno-wrap', e => e.dataset.tcMark)) === 'orig', 'not rebuilt by the polls (no flicker)');

    await page.fill('#tc-anno-mdinput', '## Notes\n\n- a\n- b\n\nSee [the label](https://example.com/x).');
    const m1 = await until(model, m => (m || '').includes('== Notes =='));
    check(m1.includes('== Notes ==\n\n    * a\n    * b') && m1.includes('[https://example.com/x|the label]'), `MusicBrainz's model holds MusicBrainz markup (${JSON.stringify(m1)})`);
    await page.click('#tc-anno-md');
    check((await vis('#annotation')) && (await page.inputValue('#annotation')).includes('== Notes ==') && await page.$('#tc-anno-md .tc-mk-mb'), 'the toggle shows the raw field, in MusicBrainz markup');
    await page.click('#tc-anno-md');
    check((await vis('#tc-anno-mdinput')) && (await md()).includes('## Notes'), 'and back');

    await page.click('#tc-anno-preview-btn');
    const html = () => page.$eval('#tc-anno-preview', e => e.innerHTML);
    await until(async () => (await vis('#tc-anno-preview')) && /<li>a<\/li>/.test(await html()));
    check((await vis('#tc-anno-preview')) && (await vis('#tc-anno-mdinput')) && /<h2 class="tc-anno-h">Notes<\/h2>/.test(await html()) && /<li>a<\/li>/.test(await html()), 'Preview renders beside the editor');
    await page.fill('#tc-anno-mdinput', '### Live');
    check(/<h3 class="tc-anno-h">Live<\/h3>/.test(await until(html, h => /Live/.test(h))), 'and follows the typing');
    await page.click('#tc-anno-preview-btn');
    check(!(await vis('#tc-anno-preview')), 'Preview off');

    await page.fill('#tc-anno-mdinput', 'one\ntwo');
    await page.click('#tc-anno-mdinput');
    await page.$eval('#tc-anno-mdinput', e => e.setSelectionRange(0, 7));
    await page.keyboard.press('Tab');
    check((await md()) === '- one\n- two', 'Tab on a selection: a bullet list');
    await page.keyboard.press('Tab');
    check((await md()) === '1. one\n1. two', 'Tab again: numbered');
    await page.keyboard.press('Shift+Tab');
    check((await md()) === 'one\ntwo', 'Shift+Tab: plain again');
    await page.fill('#tc-anno-mdinput', '- one');
    await page.click('#tc-anno-mdinput');
    await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('two');
    check((await md()) === '- one\n- two', 'Enter continues the list');
    await page.fill('#tc-anno-mdinput', 'make bold');
    await page.$eval('#tc-anno-mdinput', e => e.setSelectionRange(5, 9));
    await page.keyboard.press('Control+b');
    check((await md()) === 'make **bold**', 'Ctrl+B wraps the selection');
    await page.keyboard.press('Control+z');
    check((await md()) === 'make bold', 'Ctrl+Z undoes it');

    await page.click('#tc-anno-max');
    const max = await until(() => page.evaluate(() => { const w = document.getElementById('tc-anno-wrap'), r = w.getBoundingClientRect(); return w.classList.contains('tc-anno-max') && getComputedStyle(w).position === 'fixed' && r.width > 800 && r.height > 500; }));
    check(max, 'maximize fills the window');
    await page.click('#tc-anno-max');
    await until(() => page.evaluate(() => !document.getElementById('tc-anno-wrap').classList.contains('tc-anno-max')));

    await page.fill('#tc-anno-mdinput', 'Recorded at Some Studio, mixed by Another Person over a long\nsentence that wraps onto several physical lines\nin the imported source.');
    await page.$eval('#tc-anno-mdinput', el => { el.focus(); el.setSelectionRange(0, el.value.length); });
    await page.click('#tc-anno-join');
    await until(md, v => !v.includes('\n'));
    check((await md()) === 'Recorded at Some Studio, mixed by Another Person over a long sentence that wraps onto several physical lines in the imported source.', 'Join lines makes the wrapped lines one');
    check((await page.inputValue('#annotation')) === await md(), 'and the real field follows');

    await page.click('#tc-anno-clear');
    await until(async () => (await md()) === '' && (await model()) === '');
    check((await md()) === '' && (await model()) === '', 'Clear empties the surface and the model');

    await page.click('#tc-launch');   // Apollo off
    const off = await until(() => page.evaluate(() => { const ta = document.getElementById('annotation'); return { wrap: !!document.querySelector('#tc-anno-wrap'), riOn: document.body.classList.contains('tc-ri-on'), native: !!ta && ta.offsetParent !== null }; }), o => !o.wrap && !o.riOn && o.native);
    check(!off.wrap && !off.riOn && off.native, `Apollo off: the editor is gone, the native field back (${JSON.stringify(off)})`);
    await page.click('#tc-launch');
    check(await until(() => page.$('#tc-anno-bar #tc-anno-join')), 'on again: it comes back');
    check(submitted.length === 0, 'nothing submitted');
  });
});

const ANNO = 'textarea[name="edit-annotation.text"]';
const REL = '67d009f9-417a-439c-878f-d8f163867544';   // Love Songs of the 70s, on the sandbox
async function editAnnotationPage(page, inject) {
  await page.goto(`${SANDBOX}/release/${REL}/edit_annotation`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(ANNO, { state: 'attached', timeout: 30000 });
  await inject('apollo_editor');
}

test.describe('on edit_annotation', () => {
  test.use({ gm: apolloGm() });
  test('it takes the page over', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await editAnnotationPage(page, inject);
    await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 20000 });
    check(await page.$('#tc-anno-wrap ' + ANNO) && !(await page.isVisible(ANNO)), 'mounted on the annotation field, which is hidden');
    check(await page.$('#tc-anno-history-btn') && await page.$('#tc-anno-max'), 'History and maximize are there');
    check(await page.evaluate(() => { const cl = document.querySelector('input[name="edit-annotation.changelog"]').closest('.row'), an = document.querySelector('#tc-anno-wrap').closest('.row'), rows = [...an.parentElement.children]; return rows.indexOf(cl) < rows.indexOf(an); }), 'the changelog is above the annotation');
    await page.fill('#tc-anno-mdinput', '## Hi\n\n- a\n- b');
    const raw = await until(() => page.inputValue(ANNO), r => r.includes('== Hi =='));
    check(raw.includes('== Hi ==') && raw.includes('    * a'), `the field gets MusicBrainz markup (${JSON.stringify(raw)})`);
    check(await page.evaluate(() => { const h = [...document.querySelectorAll('#content h3')].find(e => /annotation formatting/i.test(e.textContent)); return !h || !h.offsetParent; }), 'the formatting guide is hidden');
    check(!(await page.isVisible('textarea[name="edit-annotation.edit_note"]')), 'the edit note is hidden');
    check(await page.evaluate(() => { const r = document.querySelector('#content form .row.buttons, #content form .row.no-label.buttons'); return !!r && (!r.offsetParent || getComputedStyle(r).display === 'none'); }), "the page's own buttons are hidden");
    check(await page.isVisible('#tc-anno-submit') && await page.evaluate(() => !!document.getElementById('tc-anno-submit').closest('.row')?.querySelector('input[name="edit-annotation.changelog"]')), 'our Enter edit sits beside the changelog');
    check(await page.evaluate(() => {
      const native = [...document.querySelectorAll('#content form button, #content form input[type=submit]')].find(b => b.id !== 'tc-anno-submit' && /enter edit/i.test((b.textContent || b.value || '').trim()));
      let hit = false;
      if (native) native.addEventListener('click', e => { hit = true; e.preventDefault(); e.stopImmediatePropagation(); }, { capture: true, once: true });
      document.getElementById('tc-anno-submit').click();
      return hit;
    }), "which presses the page's own (stopped here)");
    check(await page.$('#tc-launch') && await page.$('#tc-anno-fouc') === null, 'the Apollo switch is there; the load guard is gone');
    check(await page.evaluate(() => { const r = document.getElementById('tc-anno-wrap').getBoundingClientRect(); return r.bottom >= window.innerHeight - 40 && r.height > 300; }), 'the editor fills the window height');
    const pop = () => page.evaluate(() => document.getElementById('tc-anno-help-pop').classList.contains('on'));
    await page.hover('#tc-anno-help'); await frames(page);   // a hover is handled as the mouse moves
    check(!(await pop()), '#521: hovering ? shows nothing');
    await page.click('#tc-anno-help');
    check(await until(pop), 'a click opens the help');
    await page.click('#tc-anno-help');
    check(!(await until(pop, o => !o)), 'another closes it');
    await page.click('#tc-anno-help'); await until(pop);
    await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
    check(!(await until(pop, o => !o)), 'a click elsewhere closes it');
    await page.click('#tc-anno-help'); await until(pop);
    await page.keyboard.press('Escape');
    check(!(await until(pop, o => !o)), 'and Escape');
  });
});

test.describe('"Modify annotations" off', () => {
  test.use({ gm: apolloGm({ modifyAnnotation: false }) });
  test('the page is left alone', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await editAnnotationPage(page, inject);
    await idle(page);   // Apollo has read its setting and decided
    check(await page.$('#tc-anno-wrap') === null && await page.isVisible(ANNO), 'no editor; the native field shows');
  });
});

// a release with two annotation versions (made once; annotation edits apply at once)
const HIST = '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';
async function ensureHistory(page) {
  const { onSandbox } = await import('../../../dev/test/harness.mjs');
  const rel = onSandbox(HIST);
  const versions = async () => { await page.goto(`${SANDBOX}/release/${rel}/annotations`, { waitUntil: 'load' }); return page.locator('a:has-text("View this version")').count(); };
  for (let v = await versions(); v < 2; v = await versions()) {
    await page.goto(`${SANDBOX}/release/${rel}/edit_annotation`, { waitUntil: 'load' });
    await page.fill(ANNO, `== Test fixture ==\nVersion ${v + 1} of this release's annotation, for the mb-userscripts tests (#625).`);
    await page.fill('input[name="edit-annotation.changelog"]', `test fixture v${v + 1}`);
    await Promise.all([page.waitForURL(u => !/edit_annotation/.test(u.pathname), { timeout: 60000 }), page.click('#content form button.submit, #content form button[type=submit]:has-text("Enter edit")')]);
  }
}

test.describe('History', () => {
  test.use({ gm: apolloGm() });
  test('versions list, show, and revert in place', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await ensureHistory(page);
    const submitted = await openApollo(page, inject, { release: HIST });
    await page.waitForSelector('#tc-anno-bar', { timeout: 20000 });
    check((await page.$$eval('#tc-anno-bar button', b => b.length)) === 7 && await page.$('#tc-anno-history-btn'), 'on an existing release the toolbar has History');
    await page.click('#tc-anno-history-btn');
    await page.waitForSelector('#tc-anno-history .tc-hist-card', { timeout: 15000 });
    const rows = await page.$$eval('#tc-anno-history .tc-hist-card', rs => rs.map(r => r.textContent));
    check(rows.length >= 2 && /\d{4}-\d{2}-\d{2}/.test(rows[0]), `the versions, dated (${rows.length})`);
    check(await page.evaluate(() => { const pe = id => getComputedStyle(document.getElementById(id)).pointerEvents; return ['tc-anno-preview-btn', 'tc-anno-clear', 'tc-anno-md', 'tc-anno-help'].every(i => pe(i) === 'none') && pe('tc-anno-max') !== 'none' && pe('tc-anno-history-btn') !== 'none'; }), 'meanwhile only History and maximize work');
    await page.click('#tc-anno-history .tc-hist-card');
    await page.waitForSelector('#tc-anno-history .tc-hist-view .tc-anno-rendered', { timeout: 15000 });
    check(await page.$('#tc-anno-history .tc-hist-card.on'), 'a version shows, its card marked');
    check(await page.evaluate(() => [...document.querySelectorAll('#tc-anno-history .tc-hist-card')].every(c => c.querySelector('.tc-hist-revert'))), 'every card can revert');
    check((await page.evaluate(() => getComputedStyle(document.getElementById('tc-anno-history-btn')).marginLeft)) !== 'auto', 'History is not pushed right');
    await page.click('#tc-anno-history .tc-hist-card:not(:first-child)');
    await until(() => page.evaluate(() => !!document.querySelector('#tc-anno-history .tc-hist-card.on:not(:first-child)')));
    await frames(page);
    check(await page.evaluate(() => { const r = document.querySelector('#tc-anno-history .tc-hist-card.on .tc-hist-revert'), l = document.querySelector('#tc-anno-history .tc-hist-list'); return !r || r.getBoundingClientRect().right <= l.getBoundingClientRect().right + 1; }), 'its revert is inside the list');
    await page.hover('#tc-anno-history .tc-hist-card:not(:first-child)');
    await page.click('#tc-anno-history .tc-hist-card:not(:first-child) .tc-hist-revert', { force: true });
    check(await page.waitForSelector('#tc-anno-mdinput', { state: 'visible', timeout: 8000 }).then(() => true).catch(() => false), 'reverting returns to the editor, no confirm');
    check(/Version 1/.test(await page.inputValue('#tc-anno-mdinput')), 'with that version in it');
    check(submitted.length === 0, 'nothing submitted');
  });

  test('a version rebuilds as markup; the changelog is read', { tag: '@unit' }, async ({ page }) => {
    await page.setContent('<!DOCTYPE html><html><body></body></html>');
    const [toMb, hist] = [await functionSource('apollo_editor', ['annoHtmlToMb']), await functionSource('apollo_editor', ['annoFetchHistory'])];
    const mb = await page.evaluate(src => new Function(src + '; return annoHtmlToMb;')()('<h2>Title</h2><p>A <strong>bold</strong> and <em>soft</em> note with a <a href="https://e.com/x">link</a>.</p><ul><li>one</li><li>two<ul><li>sub</li></ul></li></ul><ol><li>first</li><li>second</li></ol>'), toMb);
    check(['== Title ==', "'''bold'''", "''soft''", '[https://e.com/x|link]', '\n    * one', '\n        * sub', '\n    a. first'].every(s => mb.includes(s)), `annoHtmlToMb (${JSON.stringify(mb)})`);
    const rows = await page.evaluate(src => {
      window.fetch = async () => ({ ok: true, text: async () => '<table><tr><th>Editor</th></tr>'
        + '<tr><td><a href="/user/bob">bob</a></td><td>2026-06-09 10:39 UTC</td><td><a href="/release/x/annotation/123">View this version</a> (Testing change message)</td></tr>'
        + '<tr><td><a href="/user/bob">bob</a></td><td>2026-06-09 10:37 UTC</td><td><a href="/release/x/annotation/122">View this version</a> (no changelog specified)</td></tr></table>' });
      return new Function(src + '; return annoFetchHistory;')()('00000000-0000-0000-0000-000000000000');
    }, hist);
    check(rows[0]?.changelog === 'Testing change message' && rows[1]?.changelog === '', `the changelog, and "no changelog specified" as none (${JSON.stringify(rows)})`);
  });
});
