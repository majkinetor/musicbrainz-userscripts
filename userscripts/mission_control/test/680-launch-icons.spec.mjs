// #680: the corner launchers (Mission Control, Fusion, Falcon) wear each script's own icon, 34px with no disc
// behind it (launchers mockup, variant E), in place of the old ◎ / ⚛ / stroke-rocket glyphs.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

test('#680: corner launchers show their script icons, no disc', { tag: ['@sandbox'] }, async ({ page, inject }, info) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  await inject('fusion');
  await inject('falcon');
  await page.waitForSelector('#mc-launch img');
  await page.waitForSelector('#fs-launch img');
  await page.waitForSelector('#falcon-launcher img');
  const L = await page.evaluate(() => ['#mc-launch', '#fs-launch', '#falcon-launcher'].map(sel => {
    const b = document.querySelector(sel), img = b.querySelector('img'), r = img.getBoundingClientRect(), cs = getComputedStyle(b);
    return { sel, text: b.textContent.trim(), src: img.src.slice(0, 26), loaded: img.complete && img.naturalWidth > 0, w: Math.round(r.width), h: Math.round(r.height), bg: cs.backgroundColor, shadow: cs.boxShadow };
  }));
  console.log(JSON.stringify(L, null, 1));
  for (const l of L) {
    check(l.text === '', `${l.sel}: no glyph text (${JSON.stringify(l.text)})`);
    check(l.src === 'data:image/svg+xml;base64,' && l.loaded, `${l.sel}: the icon loads`);
    check(l.w === 34 && l.h === 34, `${l.sel}: icon is 34px (${l.w}x${l.h})`);
    check(/rgba\(0, 0, 0, 0\)|transparent/.test(l.bg) && l.shadow === 'none', `${l.sel}: no disc (${l.bg}, ${l.shadow})`);
  }
  const box = await page.evaluate(() => { const r = [...document.querySelectorAll('[data-mb-corner="br"]')].map(e => e.getBoundingClientRect());
    const x = Math.min(...r.map(b => b.left)), y = Math.min(...r.map(b => b.top)); return { x: x - 16, y: y - 16, width: innerWidth - x + 16, height: innerHeight - y + 16 }; });
  await page.screenshot({ path: info.outputPath('launchers.png'), clip: box });
});
