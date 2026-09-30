// #564 (majkinetor): "CH log menu text is not visible". Under kellnerd's "Dark Side of
// MusicBrainz", the Log ▾ dropdown's items rendered dark on dark, while the hovered one
// was readable. He found it: "it shows when i disable filter -invert-value: invert(0.9)
// hue-rotate(180deg)".
//
// The userstyle runs every button through that filter. The shared theme sheet turns it
// off with `--invert-value: none` inside the containers it lists, and .discogs-log-menu
// is appended to <body>, outside them, so the menu's correct colours were inverted back
// into the page's dark. The fix is the documented opt-in hook, `mbu-ui`.
//
// test.musicbrainz.org, read-only, under kellnerd's current stylesheet (fetched, not
// vendored: a stale copy would test a stylesheet nobody runs).
import { test, check, expect, requireLogin, SANDBOX, until } from '../../../dev/test/harness.mjs';
import { openReleasePage } from './lib/browser.js';

test.use({ gm: { name: 'Credit Hoarder' } });

test('the Log menu stays readable under a dark userstyle', { tag: ['@cosmetic', '@sandbox', '@login', '@web'] }, async ({ context, inject }) => {
  const raw = await (await fetch('https://raw.githubusercontent.com/kellnerd/userstyles/main/musicbrainz-dark.user.css')).text();
  const css = raw.replace(/^[\s\S]*?@-moz-document[^{]*\{/, '').replace(/\}\s*$/, '');
  expect(/--invert-value/.test(css), 'the userstyle still defines --invert-value').toBe(true);

  // Credit Hoarder mounts on the relationship editor
  const page = await openReleasePage(context, `${SANDBOX}/release/fdb4fbd8-fcc9-4469-b3a4-a91c1975dde5`);
  await requireLogin(page);
  await page.addStyleTag({ content: css });
  await inject('credit_hoarder', { target: page });
  await page.waitForSelector('.discogs-log-menu', { timeout: 25000, state: 'attached' });

  // until the userstyle has been recognised (the theme is read after the bar mounts)
  const seen = await until(() => page.evaluate(() => {
    const menu = document.querySelector('.discogs-log-menu');
    menu.classList.add('open');   // only laid out when open
    const btn = menu.querySelector('button');
    const cs = getComputedStyle(btn), ms = getComputedStyle(menu);
    return { theme: document.documentElement.getAttribute('data-mbu-theme'), invertVar: ms.getPropertyValue('--invert-value').trim(), btnFilter: cs.filter, btnColor: cs.color, menuBg: ms.backgroundColor };
  }), s => s.theme === 'dark');
  check(seen.theme === 'dark', `the userstyle is recognised as dark (${seen.theme})`);
  // the bug: the filter is what made correct colours unreadable
  check(seen.invertVar === 'none' && seen.btnFilter === 'none', `the menu's items are not inverted (--invert-value ${JSON.stringify(seen.invertVar)}, filter ${seen.btnFilter})`);
  // the declared colours were always fine (#DDD on #333); this guards them
  const rgb = s => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const L1 = lum(rgb(seen.btnColor)), L2 = lum(rgb(seen.menuBg));
  const contrast = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  check(contrast >= 4.5, `a menu item is legible on its background (${seen.btnColor} on ${seen.menuBg}: ${contrast.toFixed(2)}:1)`);
  await page.close();
});
