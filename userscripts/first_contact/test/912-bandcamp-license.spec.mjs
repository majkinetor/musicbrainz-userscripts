// #912: a Creative Commons Bandcamp album links its licence under "license" ("some rights reserved");
// First Contact seeds it as the release's license link (301).
//
// Fixtures:
//   Natural Empath, "Exercises in Relaxation": CC BY-SA 4.0.
//   Bullion, "Nearly": all rights reserved, so no licence link.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' }, pageErrors: 'ignore' });   // bandcamp.com's own scripts are not ours

async function read(page, inject, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  return page.evaluate(async () => {
    const bc = window.__fcTest.providers.find(p => p.id === 'bandcamp');
    const rel = await bc.fetchRelease(bc.albumId(location));
    return { rel, seed: window.__fcTest.seedParams(rel, '') };
  });
}

test('a Creative Commons album: its licence is seeded as the release license', { tag: ['@web'] }, async ({ page, inject }) => {
  const { rel, seed } = await read(page, inject, 'https://naturalempath.bandcamp.com/album/exercises-in-relaxation');
  const lic = rel.urls.filter(u => u.linkType === 301);
  check(lic.length === 1 && lic[0].url === 'https://creativecommons.org/licenses/by-sa/4.0/', `licence link: ${JSON.stringify(rel.urls)}`);
  const s = JSON.stringify(seed);
  check(s.includes('creativecommons.org/licenses/by-sa/4.0') && seed.some(([k, v]) => /^urls\.\d+\.link_type$/.test(k) && v === '301'), `the seed carries it: ${s.slice(0, 400)}`);
});

test('an all-rights-reserved album gets no licence link', { tag: ['@web'] }, async ({ page, inject }) => {
  const { rel } = await read(page, inject, 'https://bullion.bandcamp.com/album/nearly');
  check(!rel.urls.some(u => u.linkType === 301), `no licence: ${JSON.stringify(rel.urls)}`);
});
