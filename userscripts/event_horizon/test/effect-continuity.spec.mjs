import { test, expect, functionSource } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Event Horizon', values: { view: { on: true, fx: ['tron', 'stars', 'aurora'], tronSpeed: 2, starDrift: 1, auroraSpeed: 2 } } } });

test('ambient redraws retain the canvas, simulation and clock while taking new parameters', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('event_horizon', ['AMBIENT', 'AMBIENT_DEFAULTS', 'FX_OWN', 'fxSpan', 'FX_STRIP', 'ucolOk', 'ambientApply', 'ambientDraw', 'tronHit', 'tronSpawn', 'tronCreate', 'tronStep']);
  const result = await page.evaluate(async src => {
    const S = {}, hexReduce = { matches: false };
    const apply = new Function('S', 'hexReduce', src + '; Object.assign(S, AMBIENT_DEFAULTS, FX_OWN); return ambientApply;')(S, hexReduce);
    const layer = document.createElement('div');
    layer.style.cssText = 'width:400px;height:300px;color:rgb(30, 100, 200)'; document.body.append(layer);
    apply(layer, 'tron');
    const canvas = layer.querySelector('canvas'), ctx = canvas.getContext('2d'), state = ctx._ehTron;
    await new Promise(requestAnimationFrame);
    const before = state.time;
    S.tronSpeed = 2; S.tronGlow = 2; S.starsGlow = 0;
    apply(layer, 'tron');
    await new Promise(requestAnimationFrame);
    const kept = canvas === layer.querySelector('canvas') && state === ctx._ehTron;
    const advanced = state.time > before;
    const params = layer._ehPattern.P;
    // a 20–200% strip squares its value around the default (fxSpan, 0ac1db96): tron's 2 over 1 runs at 4
    const updated = params?.tronSpeed === 4 && params?.glow === 2;
    layer.style.width = '500px'; apply(layer, 'tron');
    const resized = layer.querySelector('canvas') !== canvas && layer.querySelector('canvas').style.width === '500px';
    layer._ehPattern.stop();
    const stopped = !layer.querySelector('canvas') && !layer._ehPattern;
    return { kept, advanced, updated, resized, stopped };
  }, src);
  expect(result).toEqual({ kept: true, advanced: true, updated: true, resized: true, stopped: true });
});

test('navigation keeps all ambient effects running with the selected parameters', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon');
  await expect(page.locator('.eh-amb canvas')).toHaveCount(3);
  await page.evaluate(() => {
    window.effectLayers = [...document.querySelectorAll('.eh-amb')].map(layer => ({ layer, canvas: layer.querySelector('canvas'), pattern: layer._ehPattern }));
    const link = document.createElement('a'); link.href = '/search?query=continuity&type=artist&method=indexed';
    document.querySelector('#app').append(link); link.click();
  });
  await expect(page).toHaveURL(/\/search\?/);
  await expect(page.locator('#app input')).not.toHaveCount(0);
  expect(await page.evaluate(() => window.effectLayers.every(({ layer, canvas, pattern }) => layer.isConnected && layer.querySelector('canvas') === canvas && layer._ehPattern === pattern))).toBe(true);
  expect(await page.evaluate(() => window.effectLayers.map(({ layer }) => {
    const p = layer._ehPattern.P;
    return p?.tronSpeed ?? p?.starDrift ?? p?.auroraSpeed;
  }))).toEqual([4, 1, 10]);   // fxSpan (0ac1db96): tron 2 over its default 1, aurora 2 over 0.4; starDrift's 0–100 strip is linear
  await page.screenshot({ path: 'test-results/eh-effect-continuity.png' });
});
