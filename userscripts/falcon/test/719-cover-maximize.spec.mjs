// #719: Falcon uploads the largest version of a suggested cover, not the size the
// suggestion happened to have. A Deezer 1000x1000 and a Bandcamp _10 are queued; the
// stores (stubbed here, no network) answer bigger versions at the maximizer's URLs
// (Deezer 4000x0, Bandcamp _0), and the pick must be the bigger Bandcamp original,
// with the edit note naming what was suggested.
//
// Nothing is submitted: pickBestCover and coverEditNote are called directly.
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, mbNoise } from '../../../dev/test/harness.mjs';

// the script brings its own GM stand-ins, as cover-pick-and-row-ui does
test.use({ gm: false });

test('suggested covers are maximised before the pick', { tag: ['@sandbox', '@login', '@critical'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');
  await context.addInitScript(() => {
    const s = new Map();
    window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
    window.GM_setValue = (k, v) => s.set(k, v);
    window.GM_deleteValue = k => s.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
    // the stores: each known URL answers a PNG of its size, anything else 404
    const SIZES = {
      'https://cdn-images.dzcdn.net/images/cover/4d82f8fedcd72ac3b3bdd5699778ee6f/4000x0-000000-100-0-0.jpg': 1400,
      'https://cdn-images.dzcdn.net/images/cover/4d82f8fedcd72ac3b3bdd5699778ee6f/1000x1000-000000-80-0-0.jpg': 1000,
      'https://f4.bcbits.com/img/a1234567890_0.jpg': 1600,
      'https://f4.bcbits.com/img/a1234567890_10.jpg': 1200,
    };
    window.__asked = [];
    window.GM_xmlhttpRequest = ({ url, onload }) => {
      window.__asked.push(url);
      const px = SIZES[url];
      if (!px) { setTimeout(() => onload({ status: 404, response: null, responseHeaders: '' })); return; }
      const c = document.createElement('canvas'); c.width = px; c.height = px;
      c.toBlob(b => onload({ status: 200, response: b, finalUrl: url, responseHeaders: 'content-type: image/png\r\n' }), 'image/png');
    };
  });
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'load', timeout: 60000 });
  await requireLogin(page);
  await page.addScriptTag({ content: code });
  await idle(page);
  await page.waitForFunction(() => window.__falconTest && window.__falconTest.pickBestCover, null, { timeout: 15000 });

  const out = await page.evaluate(async () => {
    const T = window.__falconTest;
    const DEEZER = 'https://cdn-images.dzcdn.net/images/cover/4d82f8fedcd72ac3b3bdd5699778ee6f/1000x1000-000000-80-0-0.jpg';
    const BANDCAMP = 'https://f4.bcbits.com/img/a1234567890_10.jpg';
    const item = {
      id: 'c1', entityType: 'release', mbid: '00000000-0000-0000-0000-000000000719', name: 'X', note: '', urls: [], disambiguation: '',
      isrcs: [], video: false, aliases: [], coverExistingCount: null, urlResults: null, status: 'queued', error: '',
      cover: [{ url: '', comment: '', type: 'Front', candidates: [
        { provider: 'Deezer', url: DEEZER, width: 1000, height: 1000 },
        { provider: 'Bandcamp', url: BANDCAMP },
      ] }],
    };
    T.setQueue([item]);
    await T.pickBestCover(item);
    const e = item.cover[0];
    return { picked: e.url, cands: e.candidates.map(c => ({ ...c })), note: T.coverEditNote(item, e, { size: 1, width: 1600, height: 1600 }), asked: window.__asked };
  });
  console.log(JSON.stringify(out, null, 2));
  check(out.picked === 'https://f4.bcbits.com/img/a1234567890_0.jpg', `the Bandcamp original is picked (${out.picked})`);
  const dz = out.cands.find(c => c.provider === 'Deezer');
  check(dz.url.includes('/4000x0-') && dz.width === 1400, `Deezer is measured at its maximised URL (${dz.url} ${dz.width})`);
  check(dz.original && dz.original.includes('/1000x1000-'), 'and keeps the suggested URL as its original');
  check(/Maximised from: https:\/\/f4\.bcbits\.com\/img\/a1234567890_10\.jpg/.test(out.note), 'the edit note names what was suggested');
  check(!out.asked.some(u => /musicbrainz\.org/.test(u)), 'no request to MusicBrainz through GM');
  check(!errs.length, 'no page errors: ' + errs.join(' | '));
});
