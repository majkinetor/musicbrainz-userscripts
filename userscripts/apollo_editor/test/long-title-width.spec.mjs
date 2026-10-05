// A very long release title in the nav bar is cut to … and never widens the page. MB's
//   #page is display:table, so the unwrapped title stretched it to its full length and
//   the medium warnings (centred) ended up off-screen to the right.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm(), viewport: { width: 1000, height: 700 } });

test('a long release title ellipsizes instead of widening the page', { tag: ['@cosmetic', '@sandbox', '@login'] }, async ({ page, inject }) => {
  const name = "Most Of The Remixes We've Made For Other People Over The Years Except For The One For Einstürzende Neubauten Because We Lost It And A Few We Didn't Think Sounded Good Enough Or Just Didn't Fit In Length-Wise";
  await openApollo(page, inject, { seed: { name, 'artist_credit.names.0.name': 'Gossip', 'mediums.0.format': 'CD', 'mediums.0.name': 'CD One - Unmixed',
    'mediums.0.track.0.name': 'Standing In The Way Of Control (Soulwax Nite Version)', 'mediums.0.track.0.artist_credit.names.0.name': 'Gossip' }, tab: 'tracklist' });
  await until(() => page.evaluate(() => document.querySelector('#tc-nav-title .tc-nav-title-album')?.textContent || ''), t => t.length > 100);
  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth, w = document.querySelector('fieldset.advanced-medium .medium-title.warning');
    return { vw, sw: document.documentElement.scrollWidth, warn: w ? Math.round(w.getBoundingClientRect().right) : null, tip: document.querySelector('#tc-nav-title .tc-nav-title-album').title.length };
  });
  check(r.sw <= r.vw, `the page stays the window's width (${r.sw} in ${r.vw})`);
  check(r.warn !== null && r.warn <= r.vw, `the medium-title warning is on screen (right edge ${r.warn})`);
  check(r.tip > 100, 'the cut title shows whole on hover');
});
