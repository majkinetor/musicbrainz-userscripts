import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' }, profile: 'fresh' });

const openCfg = page => page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
// the hexagons on: the effect badge added when missing, then Hexagons picked
const hexOn = async cfg => {
  if (await cfg.locator('[data-fx-sel=hexagons]').count()) await cfg.locator('[data-fx-sel=hexagons]').click();
  else { await cfg.locator('[data-g=fxAdd][data-k=fx]').click(); await cfg.locator('[data-g=fxKind][data-k=hexagons]').click(); }
};
const openFx = async page => {
  await openCfg(page);
  const cfg = page.locator('#eh-cfg');
  await until(() => cfg.locator('[data-tab=effects]').count(), n => n === 1);
  await cfg.locator('[data-tab=effects]').click();
  await until(() => cfg.locator('.fx-b, .fx-add').count(), n => n > 0);
  await hexOn(cfg);
  await until(() => cfg.locator('[data-g=hexMotion]').count(), n => n === 9);
  return cfg;
};

// Settings' Effects tab: the Effect select, then the hexagons' rows; the ones the motion doesn't take are dimmed
test('the Effects tab shows the hexagons settings and dims what the motion does not take', { tag: ['@prod', '@cosmetic'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  await cfg.locator('[data-g=hexOpacity][data-k="30"]').click();
  check(await until(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--eh-hex-opacity')), v => v === '0.3') === '0.3', 'Outlines 30% sets the opacity');
  const dimmed = () => cfg.locator('.cr.dim .cl').allTextContents();
  await cfg.locator('[data-g=hexMotion][data-k=static]').click();
  check((await until(dimmed, v => v.includes('Pace'))).includes('Strength'), 'Static dims the effect rows');
  await cfg.locator('[data-g=hexMotion][data-k=electricity]').click();
  const d = await until(dimmed, v => v.length === 0);
  check(d.length === 0, 'Electricity takes all of them: ' + d);
  await cfg.locator('[data-g=hexMotion][data-k=lantern]').click();
  check((await until(dimmed, v => v.includes('Pace'))).includes('Pace'), 'Lantern takes no pace');
  await cfg.locator('[data-g=fxRm][data-k=hexagons]').click();
  check(await until(() => cfg.locator('[data-g=hexMotion]').count(), n => n === 0) === 0, 'Removing the effect hides the rows');
  await hexOn(cfg);
  await cfg.locator('.mbu-ov-panel').screenshot({ path: 'test-results/eh-hex-row.png' });
});

// each motion runs without an error, and the drawn ones draw
test('every hexagon motion runs', { tag: ['@prod', '@cosmetic'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openFx(page);
  for (const m of ['drift', 'tide', 'twinkle', 'ripple', 'lantern', 'electricity', 'neural']) {
    await cfg.locator(`[data-g=hexMotion][data-k=${m}]`).click();
    await page.mouse.move(300 + Math.random() * 200, 300);
    const st = await until(() => page.evaluate(() => {
      const l = document.getElementById('eh-hex'), cv = l?.querySelector('canvas'), r = l?.querySelector('.hex-drift');
      let ink = 0;
      if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) ink++; }
      return { mode: document.documentElement.dataset.ehHex, ink, mask: r?.style.mask || '', shown: r ? getComputedStyle(r).display : '' };
    }), s => s.ink > 0 || s.mask.includes('radial') || ((m === 'drift' || m === 'tide') && s.shown === 'block'));
    check(st.mode === m && (st.ink > 0 || st.mask.includes('radial') || st.shown === 'block'), `${m} shows: ${JSON.stringify({ ...st, mask: st.mask.slice(0, 40) })}`);
  }
});
