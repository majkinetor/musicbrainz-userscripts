// #487 (vzell, chaban-mb): the "Internet Archive is currently experiencing difficulties"
// warning MusicBrainz shows on /add-cover-art never surfaced in Art Station's gallery.
// #367 had replaced a live text scan with a one-time snapshot of `.caa-warning`'s
// visibility at mount(), but MusicBrainz reveals the warning asynchronously (an inline
// script asks s3.us.archive.org, then `$(".caa-warning").parent().toggle()`), nearly
// always after that snapshot.
//
// Now detectIaNotice() reads the live visibility, and its observer watches attributes
// too (jQuery's .toggle() flips an inline style). A follow-up found a React re-render
// hiding the warning again a moment later, so Art Station's banner latches.
//
// test.musicbrainz.org, read-only: MusicBrainz's reveal is simulated on the cover-art
// page, which has the same #content structure mount() works on.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openArtStation } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test("MusicBrainz's Internet Archive warning shows in the gallery, and stays", { tag: ['@sandbox'] }, async ({ page, inject }) => {
  // a fake clock: the observer's 200 ms debounce is passed exactly, and "the banner
  // stays" is read after the re-check that would have removed it
  await page.clock.install();
  await openArtStation(page, inject);

  // MusicBrainz's markup, added after mount(), hidden as it starts
  await page.evaluate(() => {
    const wrap = document.createElement('div');
    wrap.id = 'test-ia-wrap';
    wrap.style.display = 'none';
    wrap.innerHTML = '<div class="warning caa-warning">Warning: The Internet Archive is currently experiencing difficulties. Adding images is unlikely to work at the moment.</div>';
    (document.getElementById('content') || document.body).appendChild(wrap);
  });
  const banner = () => page.evaluate(() => { const el = document.querySelector('.as-ia.as-ia-warn'); return el ? el.textContent.trim() : null; });
  check(await banner() === null, 'no banner while the warning is still hidden');

  // revealed the way jQuery's .toggle() does it: an attribute change
  await page.evaluate(() => { document.getElementById('test-ia-wrap').style.display = ''; });
  await page.clock.runFor(1500);   // past the observer's 200 ms debounce, and the 1 s poll
  const shown = await until(banner, b => !!b, { timeout: 5000 });
  check(/experiencing difficulties/i.test(shown || ''), `Art Station's banner appears once MusicBrainz reveals the warning (${JSON.stringify(shown)})`);

  // a React re-render puts it back to hidden; the banner stays
  await page.evaluate(() => { document.getElementById('test-ia-wrap').style.display = 'none'; });
  await page.clock.runFor(1500);
  const latched = await banner();
  check(/experiencing difficulties/i.test(latched || ''), `the banner stays when MusicBrainz hides the warning again (${JSON.stringify(latched)})`);
});
