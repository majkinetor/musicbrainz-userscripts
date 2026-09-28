// #461: MusicBrainz's "add a new artist/label" dialog rendered under Apollo's
// artist-credit bubble. Apollo lifts editor bubbles to z-index 50 (to clear its sticky
// nav), and the dialog's iframe sits in a .modal-backdrop that is its own stacking
// context at z-index auto, so nothing inside could rise above the bubble. The backdrop
// is lifted to 210. MusicBrainz's structure is built here and the computed z-indexes read.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('the add-entity dialog sits above the artist-credit bubble', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { release: '35e0c3ca-1130-4cfb-911d-c275ab31100e' });   // settled when it returns
  const r = await page.evaluate(() => {
    const bub = document.createElement('div'); bub.className = 'bubble'; bub.style.position = 'absolute'; bub.innerHTML = '<input>';
    const back = document.createElement('div'); back.className = 'modal-backdrop'; back.style.position = 'fixed';
    const f = document.createElement('iframe'); f.style.position = 'relative'; f.style.zIndex = '100'; back.appendChild(f);
    document.body.append(bub, back);
    const out = { riOn: document.body.classList.contains('tc-ri-on'), bub: getComputedStyle(bub).zIndex, back: getComputedStyle(back).zIndex };
    bub.remove(); back.remove();
    return out;
  });
  check(r.riOn, "Apollo's rules are on (body.tc-ri-on)");
  check(r.bub === '50', `the bubble is lifted to 50 (${r.bub})`);
  check(r.back === '210', `the dialog's backdrop is above it, at 210 (${r.back})`);
});
