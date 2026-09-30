// #642: the in-MB marker is a choice — Ring (the default), Ring with a gap, ✓ badge, Dot, Underline,
// Rounded square — and the glow is gone: a stored 'glow' becomes the ring.
//
// test.musicbrainz.org, Random Access Memories with its answers replayed (fixtures/ws-182.json.gz), so
// some rows are already in MB; each option is picked in Settings and read off an in-MB icon.
import { test, check } from '../../../dev/test/harness.mjs';
import { openPc } from './pc.mjs';

const RAM = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
test.use({ gm: { name: 'Platform Check', values: { 'pc:mb-marker': 'glow' } } });

test('#642: six in-MB markers to choose from, and a stored glow becomes the ring', { tag: ['@sandbox'] }, async ({ page, inject }, testInfo) => {
  const ws = await openPc(page, inject, { release: RAM, links: { drop: /hdtracks\.com|tidal\.com/ }, replay: new URL('./fixtures/ws-182.json.gz', import.meta.url) });
  const panelClass = () => page.evaluate(() => [...document.getElementById('mb-pc-panel').classList].filter(c => c.startsWith('pc-mark-')));
  check((await panelClass()).join() === 'pc-mark-circle', `a stored glow is drawn as the ring (${await panelClass()})`);
  const ico = '#mb-pc-panel .pc-row.pc-inmb .pc-plat-ico';
  check(await page.locator(ico).count() > 0, 'there are in-MB rows to look at');
  const opts = await page.evaluate(() => [...document.querySelectorAll('#mb-marker option')].map(o => o.value));
  check(opts.join() === 'circle,gap,badge,dot,underline,square', `the options (${opts.join()})`);
  const read = () => page.evaluate(sel => {
    const el = document.querySelector(sel), cs = getComputedStyle(el), af = getComputedStyle(el, '::after');
    return { border: cs.borderTopStyle, outline: cs.outlineStyle, offset: cs.outlineOffset, radius: cs.borderTopLeftRadius, after: af.content, afterW: af.width, afterH: af.height };
  }, ico);
  const want = {
    circle: r => r.border === 'solid' && r.outline === 'none',
    gap: r => r.outline === 'solid' && r.offset === '2px',
    badge: r => r.after === '"✓"',
    dot: r => r.after === '""' && r.afterW === '8px',
    underline: r => r.after === '""' && r.afterH === '2.5px',
    square: r => r.outline === 'solid' && r.offset === '3px' && r.radius === '6px',
  };
  for (const v of opts) {
    await page.evaluate(v => { const s = document.getElementById('mb-marker'); s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }, v);
    const r = await read();
    check(want[v](r), `${v}: drawn (${JSON.stringify(r)})`);
    check((await panelClass()).join() === 'pc-mark-' + v, `${v}: the only marker class`);
    await testInfo.attach('marker-' + v, { body: await page.locator('#mb-pc-panel').screenshot(), contentType: 'image/png' });
  }
  check(await page.evaluate(() => typeof GM_getValue === 'function' ? GM_getValue('pc:mb-marker') : null) !== 'glow', 'the stored value is no longer glow');
  await ws.done();
});
