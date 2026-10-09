// The dialog itself, on a sandbox release (which release doesn't matter here).
// test.musicbrainz.org, read-only.
import { test, check, until, frames } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

// #484 (chaban-mb): the maximized state looked remembered (the button said Restore) but
// the window reopened small. pinModalToViewport() cleared the same inline styles
// toggleMaximize() sets, on every open and every viewport resize.
test('#484: a maximized window reopens maximized, and Restore restores it', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openScout(page, inject);
  const box = () => page.evaluate(() => { const m = document.getElementById('ii-modal'); return { width: m.style.width, title: document.getElementById('ii-maximize-toggle').title, px: m.getBoundingClientRect().width, vw: window.innerWidth }; });
  await page.click('#ii-maximize-toggle');
  const max = await box();
  check(max.width === '96vw' && max.title === 'Restore', `maximized (${JSON.stringify(max)})`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('ii-modal').classList.contains('open'), null, { timeout: 5000 });
  await page.evaluate(() => document.getElementById('ii-btn').click());
  await page.waitForSelector('#ii-modal.open', { timeout: 10000 });
  const reopened = await box();
  check(reopened.title === 'Restore' && reopened.width === '96vw', `reopened still maximized (${JSON.stringify(reopened)})`);
  check(reopened.px > reopened.vw * 0.9, `…and drawn near full width (${reopened.px} of ${reopened.vw} px)`);
  await page.click('#ii-maximize-toggle');
  const restored = await box();
  check(restored.title === 'Maximize' && restored.px < reopened.px, `Restore makes it smaller again (${restored.px} px)`);
});

// #490 (majkinetor): the "⚙ search SoundExchange…" link sat under every row, and
// clearing the entered ISRCs made it vanish (it lived in .ii-cands, which that wipes).
// It is a row-hover icon left of the ISRC field now, and the field lost its "—".
test('#490: SoundExchange search is a row-hover icon that survives "Clear ISRCs"', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openScout(page, inject);
  check(await page.evaluate(() => document.querySelectorAll('.ii-cand-refine').length) === 0, 'no search link under every row');
  check(!(await page.evaluate(() => document.querySelector('tr[data-idx="0"] .ii-input').getAttribute('placeholder'))), 'the ISRC field has no "—" placeholder');
  const opacity = () => page.evaluate(() => { const b = document.querySelector('tr[data-idx="0"] .ii-sx-hover'); return b ? getComputedStyle(b).opacity : null; });
  check(await opacity() === '0', 'the icon is hidden until the row is hovered');
  await page.hover('tr[data-idx="0"] .ii-input');
  check(await until(opacity, o => o !== '0') !== '0', 'hovering the row shows it');
  await page.click('tr[data-idx="0"] .ii-sx-hover');
  check(await until(() => page.evaluate(() => !!document.getElementById('ii-sxp-track')?.textContent)), 'clicking it opens the SoundExchange search for that track');
  await page.evaluate(() => document.body.click());
  await page.click('#ii-clear-toggle');
  await page.click('#ii-clear-isrcs');
  // "Clear ISRCs" has run once the row's field is empty; the icon is looked for then
  await until(() => page.evaluate(() => document.querySelector('tr[data-idx="0"] .ii-input').value === ''));
  await frames(page);
  check(await page.evaluate(() => !!document.querySelector('tr[data-idx="0"] .ii-sx-hover')), 'the icon survives "Clear ISRCs"');
  await page.hover('tr[data-idx="0"] .ii-input');
  check(await until(opacity, o => o !== '0') !== '0', '…and still shows on hover');
});

// majkinetor, on "⚠ SoundCloud failed — see Log": a message that names the log should
// open it, as Fusion's do. An ordinary progress line must not look clickable.
test('#580: a status that says "see Log" opens the log; ordinary progress does not look clickable', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await openScout(page, inject);
  await page.waitForFunction(() => !!(window.__isrcScoutTestProg && window.__isrcScoutTestProg.setProg), null, { timeout: 5000 });
  const probe = () => page.evaluate(() => { const el = document.getElementById('ii-prog'), pane = document.getElementById('mbu-logpop'); return { tolog: el.classList.contains('tolog'), err: el.classList.contains('err'), cursor: getComputedStyle(el).cursor, title: el.title, click: typeof el.onclick === 'function', open: !!pane }; });
  await page.evaluate(() => window.__isrcScoutTestProg.setProg('reading tracklist…', false));
  const plain = await probe();
  check(!plain.tolog && !plain.click && plain.cursor !== 'pointer', `a progress line is not clickable (${JSON.stringify(plain)})`);
  await page.evaluate(() => window.__isrcScoutTestProg.setProg('⚠ SoundCloud failed — see Log', true));
  const bad = await probe();
  check(bad.err && bad.tolog && bad.cursor === 'pointer' && /log/i.test(bad.title), `the failure is a way to the log, and looks it (${JSON.stringify(bad)})`);
  check(!bad.open, 'the log is still shut before a click');
  await page.evaluate(() => document.getElementById('ii-prog').click());
  check((await until(probe, p => p.open)).open, 'clicking it opens the log');
  // #701: the shared log window, over the dialog rather than under it
  check(await page.evaluate(() => { const r = document.getElementById('mbu-logpop').getBoundingClientRect(); return !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('#mbu-logpop'); }), 'the log window shows over the dialog');
  await page.evaluate(() => document.getElementById('ii-prog').click());
  await frames(page);   // the click has been handled and drawn: a toggle would have shut it
  check((await probe()).open, 'a second click leaves it open');
  await page.evaluate(() => window.__isrcScoutTestProg.setProg('done', false));
  const after = await probe();
  check(!after.tolog && !after.click, 'the next ordinary message takes the click away');
});

// majkinetor: "IS column separators are not visible on light theme". The line was
// drawn in --mbu-bg-sunken, a surface token (~#f0f0f0 on a white header); it is
// --mbu-border now. Measured as contrast against the header, in both themes, the dark
// one under kellnerd's userstyle.
test('#581: column separators are visible in the light and the dark theme', { tag: ['@cosmetic', '@sandbox', '@web'] }, async ({ context, inject }) => {
  const rgb = s => { const n = (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number); return /^color\(/i.test(String(s).trim()) ? n.map(v => v * 255) : n; };
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const contrast = (a, b) => { const l1 = lum(rgb(a)), l2 = lum(rgb(b)); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const raw = await (await fetch('https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css')).text();
  const darkCss = raw.replace(/^[\s\S]*?@-moz-document[^{]*\{/, '').replace(/\}\s*$/, '');
  for (const theme of ['light', 'dark']) {
    const page = await context.newPage();   // a page each: the script is injected at start, once per page
    if (theme === 'dark') await page.addInitScript(css => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, darkCss);
    await openScout(page, inject);
    // the theme is read once the page has a body (the script runs at document-start)
    await page.waitForFunction(() => document.documentElement.getAttribute('data-mbu-theme'), null, { timeout: 5000 }).catch(() => {});
    const m = await page.evaluate(() => {
      const h = document.querySelector('.ii-col-resize'), line = getComputedStyle(h, '::after');
      let el = h.closest('th'), surface = 'rgba(0, 0, 0, 0)';
      while (el && (surface === 'rgba(0, 0, 0, 0)' || surface === 'transparent')) { surface = getComputedStyle(el).backgroundColor; el = el.parentElement; }
      return { theme: document.documentElement.getAttribute('data-mbu-theme'), line: line.backgroundColor, width: line.width, surface, count: document.querySelectorAll('.ii-col-resize').length };
    });
    const c = contrast(m.line, m.surface);
    check(m.count >= 2 && parseFloat(m.width) >= 1, `${theme}: separators with a width (${m.count}, ${m.width})`);
    check(m.theme === theme, `${theme}: the script recognises the theme (${m.theme})`);
    // a hairline doesn't need 4.5:1, but below ~1.4:1 it reads as nothing
    check(c >= 1.4, `${theme}: a separator stands off the header (${c.toFixed(2)}:1)`);
  }
});

// #625 (found converting these tests): a document-start script runs before <head> and
// <body> exist, so the #569 watches on them attached to nothing, and a userstyle that
// arrived or changed after the first 2 seconds was never noticed. They attach once the
// document is parsed now. ISRC Scout runs at document-start, like Apollo and Art Station.
test('#625: a dark userstyle that arrives late is still noticed', { tag: ['@cosmetic', '@sandbox'] }, async ({ page, inject }) => {
  // a fake clock, so "past the one-shot re-checks at 0.4 s and 2 s" is exact and instant
  await page.clock.install();
  await openScout(page, inject);
  await page.clock.runFor(2600);
  const before = await page.evaluate(() => document.documentElement.getAttribute('data-mbu-theme'));
  await page.evaluate(() => { const s = document.createElement('style'); s.textContent = 'html, body { background: #15131a !important; color: #ddd !important; }'; document.head.appendChild(s); });
  const after = await page.waitForFunction(() => document.documentElement.getAttribute('data-mbu-theme') === 'dark', null, { timeout: 3000 }).then(() => 'dark').catch(() => page.evaluate(() => document.documentElement.getAttribute('data-mbu-theme')));
  check(before === 'light', `light to begin with (${before})`);
  check(after === 'dark', `the late stylesheet turns it dark (${after})`);
});
