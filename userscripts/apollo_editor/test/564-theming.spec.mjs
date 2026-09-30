// #564 (majkinetor), Apollo in light and dark themes.
//
// "Apollo pending changes on Recordings could be more readable (currently blue over
//   redish)": the diff highlight set its own white text, but the highlighted run is
//   usually an artist link, and `.tc-rectbl td a` beat it (1.13:1). A link in the
//   highlight now reads exactly like the text beside it. And "the blue color on the left
//   that marks modified row … doesn't look very visible": it was the light theme's accent,
//   hard-coded (2.37:1 on a dark row). His DevTools structure, copied:
//   td.tc-tka > span.tc-dh > a.
// "Apollo tracklist in white theme doesn't have edit background and in dark has them
//   black … They should be transparent as in white theme": measured under kellnerd's
//   "Dark Side of MusicBrainz", fetched live (a vendored copy would test a userstyle
//   nobody runs), and with no userstyle.
import { test, check, until, settled } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('a link in the diff highlight, and the modified-row marker, read in both themes', { tag: ['@cosmetic', '@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed: 'seed-saigon' });
  await page.waitForFunction(() => [...document.styleSheets].some(sh => { try { return [...sh.cssRules].some(r => r.selectorText && r.selectorText.includes('tc-dh')); } catch (e) { return false; } }), null, { timeout: 30000 });
  const out = await page.evaluate(async () => {
    const parse = s => { let m = s.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/); if (m) return { r: +m[1] * 255, g: +m[2] * 255, b: +m[3] * 255, a: m[4] === undefined ? 1 : +m[4] }; m = s.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    const mirror = document.createElement('table'); mirror.className = 'tc-mirror mbu-ui';
    mirror.innerHTML = '<tbody><tr class="tc-changed"><td>1</td><td>Bule bule21</td></tr></tbody>';
    const host = document.createElement('div'); host.id = 'tc-recwrap'; host.className = 'mbu-ui';
    host.innerHTML = '<table class="tc-rectbl compact alt gridcols"><tbody><tr class="tc-recrow"><td>1</td><td class="tc-tkt">Incomprendidos</td>'
      + '<td class="tc-tka"><span class="tc-dh"><a href="https://musicbrainz.org/artist/7013b20e-43ce-4da3-b1f5-8a644c9873de">Los 1 Nivram</a></span></td></tr></tbody></table>';
    document.body.append(mirror, host);
    const res = {};
    for (const t of ['light', 'dark']) {
      document.documentElement.setAttribute('data-mbu-theme', t);
      document.body.style.background = t === 'dark' ? '#1e1b24' : '#ffffff';
      await new Promise(r => requestAnimationFrame(r));
      const span = host.querySelector('span.tc-dh'), a = span.querySelector('a'), body = parse(getComputedStyle(document.body).backgroundColor);
      const bg = over(parse(getComputedStyle(span).backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }, body);
      const mk = getComputedStyle(mirror.querySelector('td:first-child')).boxShadow.match(/(rgba?\([^)]*\)|color\(srgb[^)]*\))/);
      res[t] = { link: ratio(over(parse(getComputedStyle(a).color), bg), bg), text: ratio(over(parse(getComputedStyle(span).color), bg), bg), marker: mk ? ratio(parse(mk[1]), body) : 0 };
    }
    return res;
  });
  for (const t of ['light', 'dark']) {
    const m = out[t];
    check(m.link >= 4.0, `${t}: a link in the diff highlight reads (${m.link.toFixed(2)}:1)`);
    check(Math.abs(m.link - m.text) < 0.01, `${t}: exactly like the text beside it (${m.link.toFixed(2)} vs ${m.text.toFixed(2)})`);
    check(m.marker >= 4.5, `${t}: the modified-row marker stands out from the row (${m.marker.toFixed(2)}:1)`);
  }
});

for (const dark of [true, false]) {
  test(`tracklist inputs show the row through them (${dark ? 'dark userstyle' : 'no userstyle'})`, { tag: ['@cosmetic', '@sandbox', '@login', ...(dark ? ['@web'] : [])] }, async ({ page, inject }) => {
    const css = dark ? (await (await fetch('https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css')).text()).replace(/^[\s\S]*?@-moz-document[^{]*\{/, '').replace(/\}\s*$/, '') : null;
    await openApollo(page, inject, { seed: 'seed-saigon', before: css ? () => page.addStyleTag({ content: css }) : null, tab: 'tracklist' });
    await page.waitForSelector('.tc-mirror', { state: 'visible', timeout: 60000 });
    await settled(page);
    if (dark) await until(() => page.evaluate(() => document.documentElement.getAttribute('data-mbu-theme')), t => t === 'dark');
    const inputs = await page.evaluate(() => {
      const seen = new Map();
      for (const el of document.querySelectorAll('.tc-mirror input')) { const k = el.className || '(none)'; if (!seen.has(k)) seen.set(k, { cls: k, bg: getComputedStyle(el).backgroundColor }); }
      return [...seen.values()];
    });
    // a field with no state shows the row; one that carries a state (diff, preview, pending) keeps its fill
    const STATE = /diff|gcpreview|hasfeat|pending|can-split/;
    const plain = inputs.filter(i => !STATE.test(i.cls)), stateful = inputs.filter(i => STATE.test(i.cls));
    check(plain.length > 0 && plain.every(i => i.bg === 'rgba(0, 0, 0, 0)'), `every plain input is transparent (${plain.filter(i => i.bg !== 'rgba(0, 0, 0, 0)').map(i => i.cls + '=' + i.bg).join(', ') || plain.length + ' kinds'})`);
    check(stateful.every(i => i.bg !== 'rgba(0, 0, 0, 0)' && i.bg !== 'rgb(34, 34, 34)'), `a state keeps its own fill (${stateful.map(i => i.cls.split(' ').pop() + '=' + i.bg).join(', ') || 'none here'})`);
  });
}
