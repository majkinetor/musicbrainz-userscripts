// The shared tooltip (mbuTip, dev/ui/tooltip.mjs): every script's tooltip, in place of the
// browser's `title` (STANDARDS → Standard 14). On a blank page, nothing fetched.
import { test, check, frames, until } from '../test/harness.mjs';
import { UI_CSS, UI_JS, TIP_JS } from './ui-components.mjs';
import { mbuTipText } from './tooltip.mjs';

test.use({ profile: 'fresh', gm: false });

const PAGE = `<!doctype html><html><head></head><body style="margin:40px;font:14px Arial">
  <div class="mbu-ui" id="win">
    <button id="plain" data-tip="Copy the log&#10;Right-click: copy it as Markdown">Copy</button>
    <button id="icon" data-tip="Close the window">✕</button>
    <button id="stray" title="Left behind as a title">stray</button>
    <select id="sel"><option id="opt" title="An option keeps its title">a</option></select>
    <span id="card">card</span>
    <input id="field" data-tip="Type a name">
  </div>
  <button id="outside" title="MusicBrainz's own title">mb</button>
  <div style="height:2000px"></div>
</body></html>`;

const shown = page => page.evaluate(() => { const t = document.getElementById('mbu-tip'); return t && t.classList.contains('mbu-tip-on') ? t.innerHTML : ''; });

test.beforeEach(async ({ page }) => {
  await page.setContent(PAGE);
  await page.addStyleTag({ content: UI_CSS });
  await page.addScriptTag({ content: UI_JS + `
    mbuTipOn('#card', function () { return mbuTipCard({ title: 'A card', aside: 'aside', body: '<a href="#" id="inlink">a link</a>', foot: 'foot' }); }, { interactive: true, card: true });` });
});

test('the text form: key rows, option rows, the lead, a shortcut', { tag: ['@unit'] }, async () => {
  const keys = mbuTipText('Use it as if it were pasted · right-click: add it in the background · Ctrl+click: copy it');
  check(/mbu-tip-lead">Use it as if it were pasted</.test(keys) && (keys.match(/class="mbu-tip-mouse"/g) || []).length === 2 && /aria-hidden="true">Ctrl<\/kbd><svg/.test(keys), `" · Right-click: …" become key rows under a lead (${keys})`);
  const opts = mbuTipText('Auto: fetch during Probe · Ask: fetch on a button · Off: skip');
  check((opts.match(/class="mbu-tip-o">/g) || []).length === 3, 'two or more "Label: …" lines are an option list, the first line too');
  check(!/mbu-tip-o|mbu-tip-k/.test(mbuTipText('Release group: when one release group fits, pick it')), 'a lone "Label: …" sentence stays a sentence');
  const sc = mbuTipText('Falcon (Ctrl+Alt+F)');
  // majkinetor: "replace ctrl shift alt with symbols too"
  check(/<kbd class="mbu-tip-k mbu-tip-sym"><span class="mbu-tip-sr">Ctrl\+Alt\+F<\/span><span aria-hidden="true">Ctrl\+Alt\+F<\/span><\/kbd>/.test(sc), `a shortcut in brackets is one key, its Ctrl and Alt as words (majkinetor: "whats ⌥") (${sc})`);
  check(/Ctrl\+V</.test(mbuTipText('Paste it\nCtrl+V: paste a barcode')), 'a Ctrl+V key row too');
  // majkinetor: "add cutoff table with meanings"
  const lv = mbuTipText('The cutoff\n{#2f6fd6} Exact: same\n{#86c686 on} Strong: close\n{#ffb74d off} Weak: a guess\n{red;x} Bad: not a colour');
  check(/<i style="background:#2f6fd6"><\/i>Exact<\/span><span class="mbu-tip-dt">same/.test(lv) && /mbu-tip-dl mbu-tip-on/.test(lv) && /mbu-tip-dt mbu-tip-off">a guess/.test(lv), `level rows: a dot, the chosen one marked, the ones past it dimmed (${lv})`);
  check(!/background:red/.test(lv), 'only a hex colour makes a dot');
  const old = mbuTipText('Couldn’t reach Discogs — click to retry');
  check(/mbu-tip-sr">Click<\/span>.*<\/svg><\/span><span>retry/.test(old), `"… — click to X" reads as a Click row (${old})`);
  check(/^<div class="mbu-tip-p">/.test(mbuTipText('deadmau5')) && /deadmau5/.test(mbuTipText('deadmau5')), 'data is shown as it is, not capitalised');
  check(!/<script/.test(mbuTipText('<script>alert(1)</script>')), 'the text is escaped');
  const long = mbuTipText('Tidy the Release information tab and use the right column. Apollo keeps the original layout one click away, and a second click brings it back.');
  check(/mbu-tip-lead">Tidy the Release information tab and use the right column</.test(long), 'a long paragraph leads with its first sentence');
});

test('hovering shows the tip after a moment, styled, and leaving hides it', { tag: ['@unit'] }, async ({ page }) => {
  await page.hover('#plain');
  check(await shown(page) === '', 'not at once: a pointer passing over shows nothing');
  const html = await until(() => shown(page), h => !!h);
  check(/mbu-tip-lead">Copy the log/.test(html) && /Right-click/.test(html), `it shows, with its lead and key row (${html.slice(0, 120)})`);
  const box = await page.evaluate(() => { const t = document.getElementById('mbu-tip').getBoundingClientRect(), b = document.getElementById('plain').getBoundingClientRect(); return { below: t.top >= b.bottom, z: getComputedStyle(document.getElementById('mbu-tip')).zIndex }; });
  check(box.below && +box.z > 2147483001, `under the button, over every modal (${JSON.stringify(box)})`);
  check(await page.getAttribute('#plain', 'aria-describedby') === 'mbu-tip', 'the button is described by it');
  await page.mouse.move(5, 600);
  check(await until(() => shown(page), h => !h) === '', 'leaving hides it');
});

// majkinetor: Apollo's release-title Aa still showed MusicBrainz's "Guess case", because Apollo
// stops the page's mouseover at the window, before a document listener hears it
test('a page that stops mouseover at the window still gets its tip; a lone key line is a key row', { tag: ['@unit'] }, async ({ page }) => {
  const rc = mbuTipText('Right-click: edit the URL');
  check(/mbu-tip-sr">Right-click<\/span><svg[^]*M6 1C8\.8[^]*<\/svg><\/span><span>edit the URL/.test(rc), `a lone "Right-click: …" is a key row, a mouse with its right button filled (${rc})`);
  // majkinetor: "replace Click/Right click … with more concise (mouse icon, modifiers etc.)"
  const k = l => mbuTipText(l + ': x');
  check(/M6 1C3\.2/.test(k('Click')) && !/<kbd/.test(k('Click')), 'Click: the left button, no key');
  check(/mbu-tip-kx" aria-hidden="true">×2/.test(k('Double-click')), 'Double-click: ×2');
  check(/aria-hidden="true">Ctrl\+⇧<\/kbd><svg/.test(k('Ctrl+Shift+click')), 'Ctrl+Shift+click: Ctrl+⇧ and the mouse');
  check(/rx="1" fill/.test(k('Middle-click')) && !/<path d="M6 1C/.test(k('Middle-click')), 'Middle-click: the wheel');
  check(/mbu-tip-k">Esc</.test(k('Esc')) && !/svg/.test(k('Esc')), 'Esc stays a key chip');
  // rows with a note between them are one grid, the note across it (majkinetor: "not aligned properly")
  const split = mbuTipText('Apollo is on\nClick: show MusicBrainz’s own\nOn every tab, until you switch back.\nRight-click: settings');
  check((split.match(/class="mbu-tip-rows"/g) || []).length === 1 && /mbu-tip-p mbu-tip-span">On every tab/.test(split), `one grid, the note in the text column (${split})`);
  await page.evaluate(() => window.addEventListener('mouseover', e => e.stopPropagation(), true));
  await page.hover('#plain');
  check(/Copy the log/.test(await until(() => shown(page), h => !!h)), 'the tip shows');
});

test('a click, Esc and a scroll close it; typing in a field does too', { tag: ['@unit'] }, async ({ page }) => {
  await page.hover('#plain'); await until(() => shown(page), h => !!h);
  await page.mouse.down(); await page.mouse.up();
  check(await shown(page) === '', 'a click closes it');
  await frames(page, 3);
  check(await shown(page) === '', 'and it stays closed on the button just clicked');
  await page.hover('#icon'); await until(() => shown(page), h => !!h);
  await page.keyboard.press('Escape');
  check(await shown(page) === '', 'Esc closes it');
  await page.mouse.move(5, 600); await page.hover('#icon'); await until(() => shown(page), h => !!h);
  await page.mouse.wheel(0, 300);
  check(await until(() => shown(page), h => !h) === '', 'a scroll closes it');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(5, 600); await page.hover('#field'); await until(() => shown(page), h => !!h);
  await page.focus('#field'); await page.keyboard.type('a');
  check(await shown(page) === '', 'typing closes it');
});

test('an icon-only button is named by its tip; a stray title in our window is taken over', { tag: ['@unit'] }, async ({ page }) => {
  await page.hover('#icon'); await until(() => shown(page), h => !!h);
  check(await page.getAttribute('#icon', 'aria-label') === 'Close the window', 'the ✕ gets the tip as its accessible name');
  await page.mouse.move(5, 600);
  await page.hover('#stray');
  const st = await page.evaluate(() => ({ title: document.getElementById('stray').getAttribute('title'), tip: document.getElementById('stray').getAttribute('data-tip') }));
  check(st.title === null && st.tip === 'Left behind as a title', `the title moved to data-tip before the browser could show it (${JSON.stringify(st)})`);
  check(/Left behind as a title/.test(await until(() => shown(page), h => /Left behind/.test(h))), 'and shows as our tooltip');
  await page.mouse.move(5, 600);
  await page.hover('#outside'); await frames(page, 30);
  check(await page.getAttribute('#outside', 'title') === "MusicBrainz's own title", 'a title outside our windows is MusicBrainz\'s, and left alone');
  check(await page.getAttribute('#opt', 'title') === 'An option keeps its title', 'an <option> keeps its title: no page tooltip reaches a dropdown');
});

test('a rich card stays while the pointer is on it, and its links can be followed', { tag: ['@unit'] }, async ({ page }) => {
  await page.hover('#card');
  const html = await until(() => shown(page), h => !!h);
  check(/mbu-tip-ch/.test(html) && /A card/.test(html) && /mbu-tip-cf/.test(html), 'the card has its header, body and footer');
  const link = await page.locator('#mbu-tip #inlink').boundingBox();
  await page.mouse.move(link.x + 3, link.y + 3, { steps: 8 });
  await frames(page, 20);
  check(!!(await shown(page)), 'moving onto the card keeps it open');
  await page.mouse.move(5, 600, { steps: 4 });
  check(await until(() => shown(page), h => !h) === '', 'leaving the card closes it');
});

test('two copies on one page: one serves data-tip, each its own providers', { tag: ['@unit'] }, async ({ page }) => {
  // a second copy, as String Theory's members and standalone scripts bring: its own sandbox-like scope
  await page.addScriptTag({ content: '(function () {' + TIP_JS + '\nmbuTipOn("#icon", function () { return "<b>second copy</b>"; }); })();' });
  check(await page.evaluate(() => document.querySelectorAll('#mbu-tip-css').length <= 1), 'one stylesheet, whichever copy wrote it');
  await page.hover('#plain');
  await until(() => shown(page), h => !!h);
  check(await page.evaluate(() => document.querySelectorAll('#mbu-tip').length) === 1, 'one tooltip element for the page');
  await page.mouse.move(5, 600);
  await page.hover('#icon');
  check(/second copy/.test(await until(() => shown(page), h => /second copy/.test(h))), 'the second copy shows its own provider');
});
