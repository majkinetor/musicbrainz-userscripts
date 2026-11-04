// #916 (majkinetor): "When the userscript is enabled in the script manager, but the improvements
// turned off, dragging and releasing any image onto the drop area has no effect. The files are not
// attached. Disabling the script entirely makes the problem go away."
//
// Art Station's capture-phase window drop listener staged every file drop and stopped it, also
// while the switch had it off and MusicBrainz's own uploader shown, so MB's drop zone never saw it.
// Switched off, a file dropped on MB's drop zone lands in MB's own upload list, and Art Station
// stages nothing.
//
// test.musicbrainz.org: nothing is uploaded or submitted (every POST is aborted).
import { test, check, attachShot } from '../../../dev/test/harness.mjs';
import { openArtStation, blockPosts } from './as.mjs';

test.use({ gm: { name: 'Art Station' } });

test('switched off, a file dropped on MusicBrainz’s drop zone reaches MusicBrainz', { tag: ['@sandbox', '@login'] }, async ({ page, inject }, info) => {
  const posts = await blockPosts(page);
  await openArtStation(page, inject, { path: 'add-cover-art' });
  await page.click('#as-switch');
  await page.waitForFunction(() => document.getElementById('as-root').classList.contains('as-orig'));

  const zone = page.locator('#add-cover-art .image-drop-zone, #add-cover-art #drop-zone').first();
  await zone.waitFor({ state: 'visible', timeout: 10000 });
  const rows = () => page.evaluate(() => document.querySelectorAll('#add-cover-art .uploader-preview-image, #add-cover-art tr.file-info, #add-cover-art [data-bind*="files_to_upload"] > *').length);
  const before = await rows();

  const res = await zone.evaluate(async el => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 400;
    const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 400, 400);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'cover.jpg', { type: 'image/jpeg' }));
    const fire = t => { const e = new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
    fire('dragenter'); fire('dragover');
    const drop = fire('drop');
    return { prevented: drop.defaultPrevented, html: el.outerHTML.slice(0, 300) };
  });
  console.log('drop zone:', res.html);
  const after = await page.waitForFunction(n => {
    const k = document.querySelectorAll('#add-cover-art .uploader-preview-image, #add-cover-art tr.file-info, #add-cover-art [data-bind*="files_to_upload"] > *').length;
    return k > n && k;
  }, before, { timeout: 10000 }).then(h => h.jsonValue()).catch(() => before);
  const staged = await page.evaluate(() => document.querySelectorAll('.as-card.new').length);
  await attachShot(info, page, 'mb-uploader');

  check(after > before, `MusicBrainz listed the dropped file (${before} → ${after} rows)`);
  check(staged === 0, `Art Station staged nothing (${staged} new cards)`);
  // MB's page posts its own Sentry telemetry; only a POST to MusicBrainz would be an upload
  const sent = posts.filter(u => /musicbrainz\.org/.test(u));
  check(sent.length === 0, `nothing was sent to MusicBrainz (${sent.join(', ') || 'no POSTs'})`);
});
