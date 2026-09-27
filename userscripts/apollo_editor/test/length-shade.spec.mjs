// The length-gap shade: how strongly a track's length is tinted for how far it is from
// its recording's (Recordings tab, lenShade) or a duplicate's (Duplicates panel,
// dupLenShade — a deliberate mirror, #186). No network: the script in a blank page.
//
// #480 (majkinetor): "Up to 3s difference should be very mild color and should go darker
//   from there", and then over 3–30 s. Nothing under 1 s; a flat mild tint 1–3 s; a ramp
//   3–30 s; solid from 30 s.
// #564 (majkinetor): "Apollo len on dark theme is hardly or not visible". The tint is
//   translucent over the page, so its text colour must follow the theme: dark red on a
//   light page, a light tint on a dark one. Checked as WCAG contrast of the composite.
import { test, check } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

async function blank(page, inject) {
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
}

test('#480: the ramp', { tag: '@unit' }, async ({ page, inject }) => {
  await blank(page, inject);
  const a = await page.evaluate(() => Object.fromEntries([-500, 999, 1000, 2000, 2999, 3000, 10000, 15000, 20000, 29999, 30000, 60000].map(ms => [ms, window.__apolloEditor.lenShadeAlpha(ms)])));
  check(a[999] === null && a[-500] === null, `under 1 s, either way: no shade (${a[999]}, ${a[-500]})`);
  check([1000, 2000, 2999, 3000].every(ms => a[ms] === 0.12), `1–3 s: one flat mild tint (${a[1000]}, ${a[2000]}, ${a[2999]}, ${a[3000]})`);
  check(a[3000] < a[10000] && a[10000] < a[15000] && a[15000] < a[20000] && a[20000] < a[29999], `3–30 s: a strict ramp (${a[10000]}, ${a[15000]}, ${a[20000]}, ${a[29999]})`);
  check(a[10000] < 0.5, `10 s is well short of full (${a[10000]})`);
  check(a[30000] === 1 && a[60000] === 1, 'from 30 s: solid');
  const s = await page.evaluate(() => { const A = window.__apolloEditor; return { none: A.lenShade(500), l1: A.lenShade(1000), l30: A.lenShade(30000), d1: A.dupLenShade(1000), d30: A.dupLenShade(30000) }; });
  check(s.none === null, 'lenShade: nothing under 1 s');
  check(/rgba\(/.test(s.l1.bg) && s.l1.fg !== '#fff', 'a mild gap is a translucent tint, not white text');
  check(/^rgb\(/.test(s.l30.bg) && s.l30.fg === '#fff', 'a 30 s gap is solid, with white text');
  check(s.d1.bg === 'rgba(211,47,47,0.12)' && s.d30.bg === '#d32f2f' && s.d30.fg === '#fff', 'the Duplicates panel follows the same curve');
});

// WCAG 2.x contrast, and a translucent colour laid over an opaque surface
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
function parse(s) {
  s = String(s).trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) { const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]; const v = parseInt(h, 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 1]; }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; }
  throw new Error('cannot parse colour: ' + s);
}
const over = (c, surface) => { const f = parse(c), s = Array.isArray(surface) ? surface : parse(surface); return [0, 1, 2].map(i => Math.round(f[i] * f[3] + s[i] * (1 - f[3]))); };
const worst = (rows, surface) => {
  let w = { c: Infinity };
  for (const r of rows) for (const which of ['len', 'dup']) {
    const sh = r[which]; if (sh.fg === '#fff') continue;   // the solid branch is not what #564 changed
    const bg = over(sh.bg, surface), c = contrast(over(sh.fg, bg), bg);
    if (c < w.c) w = { c, gap: r.gap, which, fg: sh.fg, bg: sh.bg };
  }
  return w;
};

test('#564: the tint is legible on light and dark pages', { tag: '@unit' }, async ({ page, inject }) => {
  await blank(page, inject);
  const sample = theme => page.evaluate(([t, gaps]) => {
    document.documentElement.setAttribute('data-mbu-theme', t);
    const A = window.__apolloEditor;
    return gaps.map(g => ({ gap: g, alpha: A.lenShadeAlpha(g), len: A.lenShade(g), dup: A.dupLenShade(g) }));
  }, [theme, [1000, 2000, 3000, 8000, 15000, 20000, 25000, 29999, 30000, 60000]]);
  const light = await sample('light'), dark = await sample('dark');
  for (const surface of ['#2b2b2b', '#1e1b24', '#121212']) {   // a dark userstyle, our own dark token, a very dark one
    const w = worst(dark, surface);
    check(w.c >= 4.5, `dark, over ${surface}: the weakest tinted cell is ${w.c.toFixed(2)}:1 (${w.which} at ${w.gap} ms, ${w.fg} on ${w.bg})`);
  }
  const soft = rows => rows.filter(r => r.alpha < 0.55);
  check(soft(dark).length > 0 && soft(dark).every(r => lum(parse(r.len.fg)) > 0.4 && lum(parse(r.dup.fg)) > 0.4), 'dark: the tinted text is light');
  check(soft(light).every(r => lum(parse(r.len.fg)) < 0.1), 'light: the tinted text is still dark red');
  const at1 = light.find(r => r.gap === 1000).dup;
  check(at1.fg === '#7a0000' && at1.bg === 'rgba(211,47,47,0.12)', 'light: the Duplicates panel is unchanged');
  for (const surface of ['#ffffff', '#f5f5f5']) {
    const w = worst(light, surface);
    check(w.c >= 4.5, `light, over ${surface}: the weakest tinted cell is ${w.c.toFixed(2)}:1`);
  }
  check(dark.every(r => (r.len.fg === '#fff') === (r.dup.fg === '#fff')), 'both shades turn to white text at the same strength');
});
