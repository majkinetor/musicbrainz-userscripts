// #642: the in-MB marker is a choice — Ring (the default), Bold ring, ✓ badge, Dot, Rounded square —
// and the glow is gone: a stored 'glow' becomes the ring.
//
// test.musicbrainz.org, Random Access Memories with its answers replayed (fixtures/ws-182.json.gz), so
// some rows are already in MB; each option is picked in Settings and read off an in-MB icon.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
test.use({ gm: { name: 'Platform Check', values: { 'pc:mb-marker': 'glow' } } });

test('#642: five in-MB markers to choose from, and a stored glow becomes the ring', { tag: ['@cosmetic', '@sandbox'] }, async ({ page, inject }, testInfo) => {
  const ws = await openPc(page, inject, { release: RAM, links: { drop: /hdtracks\.com|tidal\.com/ }, replay: new URL('./fixtures/ws-182.json.gz', import.meta.url) });
  const panelClass = () => page.evaluate(() => [...document.getElementById('mb-pc-panel').classList].filter(c => c.startsWith('pc-mark-')));
  check((await panelClass()).join() === 'pc-mark-circle', `a stored glow is drawn as the ring (${await panelClass()})`);
  const ico = '#mb-pc-panel .pc-row.pc-inmb .pc-plat-ico';
  check(await page.locator(ico).count() > 0, 'there are in-MB rows to look at');
  const opts = await page.evaluate(() => [...document.querySelectorAll('#mb-marker option')].map(o => o.value));
  check(opts.join() === 'circle,bold,badge,dot,square', `the options (${opts.join()})`);
  const read = () => page.evaluate(sel => {
    const el = document.querySelector(sel), cs = getComputedStyle(el), af = getComputedStyle(el, '::after');
    const box = el.getBoundingClientRect(), row = el.closest('.pc-row').getBoundingClientRect();
    return { border: cs.borderTopStyle, bw: cs.borderTopWidth, pad: cs.paddingTop, outline: cs.outlineStyle, radius: cs.borderTopLeftRadius, after: af.content, afterW: af.width, afterH: af.height, w: box.width, inRow: box.top >= row.top - 0.5 && box.bottom <= row.bottom + 0.5 };
  }, ico);
  const want = {
    circle: r => r.border === 'solid' && r.outline === 'none',
    bold: r => r.border === 'solid' && r.bw === '2px' && r.pad === '3px' && r.outline === 'none',
    badge: r => r.after === '"✓"',
    dot: r => r.after === '""' && r.afterW === '8px',
    square: r => r.border === 'solid' && r.pad === '3px' && r.radius === '6px' && r.outline === 'none',
  };
  const base = await read();   // the ring: the box as it always was
  for (const v of opts) {
    await page.evaluate(v => { const s = document.getElementById('mb-marker'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    const r = await read();
    check(want[v](r), `${v}: drawn (${JSON.stringify(r)})`);
    check(r.inRow && Math.abs(r.w - base.w) < 0.5, `${v}: inside the icon box, which keeps its size and stays within its row (${r.w} vs ${base.w})`);
    check((await panelClass()).join() === 'pc-mark-' + v, `${v}: the only marker class`);
    await testInfo.attach('marker-' + v, { body: await page.locator('#mb-pc-panel').screenshot(), contentType: 'image/png' });
  }
  check(await page.evaluate(() => typeof GM_getValue === 'function' ? GM_getValue('pc:mb-marker') : null) !== 'glow', 'the stored value is no longer glow');
  await ws.done();
});
