import { test, expect, functionSource } from '../../../dev/test/harness.mjs';

test('header redraws share a cached cover load and retain missing-cover fallback', { tag: '@unit' }, async ({ page }) => {
  const src = await functionSource('event_horizon', ['cvWire']);
  const result = await page.evaluate(async src => {
    const calls = [], cvGone = new Set(), cvPending = new Map(), LOG = { debug() {} };
    const keptCover = async (id, img) => { calls.push([id, img.thumbnails[500]]); return { u: 'blob:kept-cover' }; };
    const wire = new Function('cvGone', 'cvPending', 'LOG', 'keptCover', src + '; return cvWire;')(cvGone, cvPending, LOG, keptCover);
    const html = '<img class="rhcv" data-cover="https://coverartarchive.org/release/example/front-250"><span class="rhic" hidden></span>';
    const a = document.createElement('div'), b = document.createElement('div'); a.innerHTML = html; b.innerHTML = html;
    wire(a); wire(b);
    await Promise.resolve(); await Promise.resolve();
    const images = [a, b].map(el => el.querySelector('img').getAttribute('src'));
    a.querySelector('img').dispatchEvent(new Event('error'));
    return { calls, images, hidden: a.querySelector('img').hidden, fallback: !a.querySelector('span').hidden };
  }, src);
  expect(result.calls).toEqual([['example', 'https://coverartarchive.org/release/example/front-250']]);
  expect(result.images).toEqual(['blob:kept-cover', 'blob:kept-cover']);
  expect(result.hidden && result.fallback).toBe(true);
});
