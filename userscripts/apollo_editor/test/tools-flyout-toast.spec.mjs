// The Tools bar with Merge and Split on it (#615), on a 4-medium sandbox release.
//
// majkinetor: "it doesn't seem like a good idea to show messages in the toolbar as it
//   moves buttons around". Messages go to the shared floating toast; a refusal (Merge
//   with one medium ticked) is amber there, and no button moves.
// Collapsed tools' flyouts (#280): majkinetor, on Merge/Split collapsed to icons — the
//   flyout was as narrow as the icon, so every label wrapped a word per line, and a flyout
//   held open by a focused checkbox overlapped the next tool's. Each is one line now, and
//   hovering another tool closes it. Both looks: icon and name, and icon only.
// Nothing is submitted.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const REL = 'c16af706-4926-4248-80c5-5faee767d579';

test.describe('messages', () => {
  test.use({ gm: apolloGm(), viewport: { width: 1250, height: 900 } });
  test('a refusal is a floating toast, and the toolbar holds still', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    const submitted = await openApollo(page, inject, { release: REL, tab: 'tracklist' });
    await page.waitForSelector('.tc-tools', { timeout: 30000 });
    await page.evaluate(() => { window.__apolloEditor.pickTool('splitmed'); window.__apolloEditor.pickTool('mergemed'); });
    await page.waitForSelector('.tc-opt[data-tool="mergemed"] .tc-mmo input', { timeout: 15000 });
    await page.waitForTimeout(500);
    const layout = () => page.evaluate(() => [...document.querySelectorAll('.tc-toolbtns > *, .tc-opt[data-tool] .tc-opttrig')].map(e => { const r = e.getBoundingClientRect(); return Math.round(r.left) + ',' + Math.round(r.top); }).join(' '));
    const before = await layout();
    await page.evaluate(() => [...document.querySelectorAll('.tc-opt[data-tool="mergemed"] .tc-mmo input')].slice(1).forEach(b => { if (b.checked) b.click(); }));
    await page.click('.tc-opt[data-tool="mergemed"] .tc-opttrig');
    await page.waitForTimeout(400);
    const after = await layout();
    const st = await page.evaluate(() => {
      const t = document.getElementById('mbu-toast'), tools = document.querySelector('.tc-tools');
      const bar = tools.closest('#tc-mirror-wrap, .tc-bar, #tc-bar') || tools.parentElement;
      return { toast: t ? t.textContent : '', on: !!(t && t.classList.contains('mbu-toast-on')), warn: !!(t && t.classList.contains('mbu-toast-warn')), inBar: /tick at least two mediums/.test(bar.innerText), media: MB.releaseEditor.rootField.release().mediums().length, spans: !!document.querySelector('.tc-toast, .tc-disc-msg') };
    });
    check(st.on && /tick at least two mediums/.test(st.toast), `the message is in the floating toast (${st.toast})`);
    check(st.warn, 'as a warning (amber)');
    check(!st.inBar && !st.spans, 'the toolbar carries no message');
    check(before === after, `no button moved${before === after ? '' : `\n  before: ${before}\n  after:  ${after}`}`);
    check(st.media >= 3, 'nothing merged');
    check(submitted.length === 0, 'nothing submitted');
  });
});

for (const iconOnly of [false, true]) {
  test.describe(`flyouts, ${iconOnly ? 'icon only' : 'icon and name'}`, () => {
    test.use({ gm: apolloGm(iconOnly ? { toolCfg: ['mergemed', 'splitmed'].map(act => ({ act, onBar: true, icon: true, text: false, hideParams: true })) } : null) });
    test('each flyout is one line, and one at a time', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
      await openApollo(page, inject, { release: REL, tab: 'tracklist' });
      await page.waitForSelector('.tc-tools', { timeout: 30000 });
      for (const act of ['mergemed', 'splitmed']) {
        if (!iconOnly) await page.evaluate(a => window.__apolloEditor.pickTool(a), act);
        await page.waitForSelector(`.tc-opt[data-tool="${act}"] .tc-opttrig`, { timeout: 15000 });
        if (!iconOnly) await page.click(`.tc-opt[data-tool="${act}"] .tc-opttrig`, { button: 'right' });   // collapse to a flyout
        await page.waitForTimeout(300);
      }
      const flyout = act => page.evaluate(a => {
        const g = document.querySelector(`.tc-opt[data-tool="${a}"]`), f = g && [...g.children].find(c => !c.classList.contains('tc-optname'));
        if (!f) return null;
        const lab = f.querySelector('.tc-mmo-lab');
        return { shown: getComputedStyle(f).display !== 'none', h: Math.round(f.getBoundingClientRect().height), labelH: lab ? Math.round(lab.getBoundingClientRect().height) : null, collapsed: g.classList.contains('tc-collapsed') };
      }, act);
      for (const act of ['mergemed', 'splitmed']) {
        await page.mouse.move(0, 0); await page.waitForTimeout(150);
        await page.hover(`.tc-opt[data-tool="${act}"] .tc-opttrig`); await page.waitForTimeout(300);
        const f = await flyout(act);
        check(f && f.collapsed && f.shown, `${act}: collapsed, its flyout shows on hover`);
        check(f && f.labelH != null && f.labelH < 26 && f.h < 48, `${act}: one line (label ${f && f.labelH}px, flyout ${f && f.h}px)`);
      }
      await page.hover('.tc-opt[data-tool="mergemed"] .tc-opttrig'); await page.waitForTimeout(250);
      await page.click('.tc-opt[data-tool="mergemed"] .tc-mmo input[type=checkbox]');   // keeps the focus
      await page.hover('.tc-opt[data-tool="splitmed"] .tc-opttrig'); await page.waitForTimeout(300);
      const m = await flyout('mergemed'), s = await flyout('splitmed');
      check(s.shown && !m.shown, 'hovering Split closes the Merge flyout its focus kept open');
    });
  });
}
