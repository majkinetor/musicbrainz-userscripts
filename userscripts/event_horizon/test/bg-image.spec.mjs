import { test, check, until } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon', persist: true }, profile: 'fresh' });   // the reload reads the saved background

const openBg = async page => {
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('mbu-open-settings', { detail: 'event_horizon', cancelable: true })));
  const cfg = page.locator('#eh-cfg');
  await until(() => cfg.locator('[data-tab=effects]').count(), n => n === 1);
  await cfg.locator('[data-tab=effects]').click();
  if (await cfg.locator('[data-fx-sel=bg]').count()) await cfg.locator('[data-fx-sel=bg]').click();
  else await cfg.locator('[data-g=fxAdd][data-k=bg]').click();
  await until(() => cfg.locator('[data-g=bg]').count(), n => n > 0);
  return cfg;
};
const layer = page => page.evaluate(() => {
  const d = document.getElementById('eh-bgimg');
  if (!d) return null;
  const cs = getComputedStyle(d), i = getComputedStyle(d.querySelector('i'));
  return { shown: cs.display !== 'none' && document.documentElement.hasAttribute('data-eh-bgimg'), img: i.backgroundImage.slice(0, 40), filter: i.filter, op: cs.opacity, fit: d.dataset.fit };
});

// Artwork: a scene drawn behind the page; the filters reach it; Shuffle draws it anew
test('the Artwork background draws a scene behind the page', { tag: ['@prod'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openBg(page);
  await cfg.locator('[data-g=bg][data-k=art]').click();
  await until(() => cfg.locator('[data-g=bgArt]').count(), n => n === 4);
  let l = await until(() => layer(page), v => v?.shown);
  check(l?.img.startsWith('url("data:image/jpeg'), 'the artwork shows: ' + JSON.stringify(l));
  const first = await page.evaluate(() => getComputedStyle(document.querySelector('#eh-bgimg i')).backgroundImage.length);
  await cfg.locator('[data-g=bgArt][data-k=bokeh]').click();
  await cfg.locator('[data-g=bgBlur][data-k="8"]').click();
  await cfg.locator('[data-g=bgOpacity][data-k="40"]').click();
  l = await until(() => layer(page), v => /blur\(8px\)/.test(v?.filter) && v.op === '0.4');
  check(/blur\(8px\)/.test(l?.filter) && l.op === '0.4', 'blur and opacity apply: ' + JSON.stringify(l));
  const before = await page.evaluate(() => getComputedStyle(document.querySelector('#eh-bgimg i')).backgroundImage);
  await cfg.locator('[data-g=bgSeed]').click();
  check(await until(() => page.evaluate(() => getComputedStyle(document.querySelector('#eh-bgimg i')).backgroundImage), v => v !== before) !== before, 'Shuffle draws it anew');
  check(first > 1000, 'a real picture');
  await page.reload();
  await inject('event_horizon');
  l = await until(() => layer(page), v => v?.shown);
  check(l?.shown && /blur\(8px\)/.test(l.filter), 'kept across a reload: ' + JSON.stringify(l));
});

// Image: an address taken on Enter; a broken one says so; a non-address too
test('the Image background shows a picture from an address', { tag: ['@prod'] }, async ({ page, inject }) => {
  await page.goto('https://musicbrainz.org/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await inject('event_horizon');
  const cfg = await openBg(page);
  await cfg.locator('[data-g=bg][data-k=url]').click();
  const box = cfg.locator('[data-eh-bgurl]');
  await until(() => box.count(), n => n === 1);
  await box.fill('ftp://nope');
  await box.press('Enter');
  check(await until(() => cfg.locator('.fx-err').count(), n => n === 1) === 1, 'not an address: said');
  const src = 'https://musicbrainz.org/static/images/entity/artist.svg';
  await cfg.locator('[data-eh-bgurl]').fill('https://musicbrainz.org/no-such-picture.png');
  await cfg.locator('[data-eh-bgurl]').press('Enter');
  check(await until(() => cfg.locator('.fx-err').textContent().catch(() => ''), v => /didn.t load/.test(v)), 'a broken picture: said');
  await cfg.locator('[data-eh-bgurl]').fill(src);
  await cfg.locator('[data-eh-bgurl-ok]').click();
  const l = await until(() => layer(page), v => v?.shown && v.img.includes('artist.svg'));
  check(l?.shown, 'the picture shows: ' + JSON.stringify(l));
  check(await cfg.locator('.fx-err').count() === 0, 'and the error is gone');
  await cfg.locator('[data-g=bgFit][data-k=tile]').click();
  await cfg.locator('[data-g=bgTone][data-k=mono]').click();
  const t = await until(() => layer(page), v => v?.fit === 'tile' && /grayscale/.test(v.filter));
  check(t?.fit === 'tile' && /grayscale/.test(t.filter), 'Fit and Tone apply: ' + JSON.stringify(t));
});
