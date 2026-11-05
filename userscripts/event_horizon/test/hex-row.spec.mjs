import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, profile: 'fresh' });

const openCfg = page => page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));

// Settings' Hexagons row holds Show, the motion and Depth; the rows under it, the two opacities and the effect's settings
test('the Hexagons settings step both opacities and show only what the motion takes', { tag: ['@prod', '@cosmetic'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  await openCfg(page);
  const cfg = page.locator('#eh-cfg');
  check(await until(() => cfg.locator('select[data-hex-motion]').count(), n => n === 1) === 1, 'Settings has the motion select');
  check(await cfg.locator('[data-hex-opacity]').count() === 0, 'no opacity while the hexagons are hidden');
  await cfg.locator('[data-g=hex]').click();
  const field = cfg.locator('input[data-hex-opacity]');
  check(await until(() => field.count(), n => n === 1) === 1, 'Show brings the opacity');
  await field.locator('xpath=..').locator('button[aria-label=More]').click();
  check(await until(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--eh-hex-opacity')), v => v === '0.25') === '0.25', '+ steps the hexagons 20 to 25');
  const rows = () => cfg.locator('.cl').allTextContents();
  await cfg.locator('select[data-hex-motion]').selectOption('static');
  check(!(await rows()).includes('Pace') && await cfg.locator('[data-hex-fx]').count() === 0, 'Static takes no effect settings');
  await cfg.locator('select[data-hex-motion]').selectOption('electricity');
  const r = await until(rows, v => v.includes('Trail'));
  check(['Pace', 'Trail', 'How often', 'Colour'].every(x => r.includes(x)) && await cfg.locator('[data-hex-fx]').count() === 1, 'Electricity takes all of them: ' + r);
  await cfg.locator('select[data-hex-motion]').selectOption('lantern');
  check(!(await until(rows, v => !v.includes('Pace'))).includes('Pace'), 'Lantern takes no pace');
  await cfg.locator('.mbu-ov-panel').screenshot({ path: 'test-results/eh-hex-row.png' });
});

// each motion runs without an error, and the drawn ones draw
test('every hexagon motion runs', { tag: ['@prod', '@cosmetic'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  await openCfg(page);
  const cfg = page.locator('#eh-cfg');
  await until(() => cfg.locator('[data-g=hex]').count(), n => n === 1);
  await cfg.locator('[data-g=hex]').click();
  for (const m of ['drift', 'tide', 'twinkle', 'ripple', 'lantern', 'horizon', 'electricity', 'neural']) {
    await cfg.locator('select[data-hex-motion]').selectOption(m);
    await page.mouse.move(300 + Math.random() * 200, 300);
    const st = await until(() => page.evaluate(() => {
      const l = document.getElementById('eh-hex'), cv = l?.querySelector('canvas'), r = l?.querySelector('.hex-drift');
      let ink = 0;
      if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) ink++; }
      return { mode: document.documentElement.dataset.ehHex, ink, mask: r?.style.mask || '', shown: r ? getComputedStyle(r).display : '' };
    }), s => s.ink > 0 || s.mask.includes('radial') || ((m === 'drift' || m === 'tide') && s.shown === 'block'));
    check(st.mode === m && (st.ink > 0 || st.mask.includes('radial') || st.shown === 'block'), `${m} shows: ${JSON.stringify({ ...st, mask: st.mask.slice(0, 40) })}`);
    await page.screenshot({ path: `test-results/eh-hex-${m}.png` });
  }
});
