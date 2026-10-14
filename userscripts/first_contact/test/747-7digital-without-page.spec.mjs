// #747: Mission Control's read (mc:read) of a 7digital album whose page asks to verify you're human (AWS WAF, HTTP 405,
// which the test browser gets too): the release and its tracks come from 7digital's API search instead, by the words of
// the address and the release's id. The page's answer is the captcha, set here. Sunset Vision, "Sunrise Paradise" (79548957): 2 tracks, from #746.
import { test, check, sourceOf, answerGm } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'First Contact' } });

test('#747: a 7digital album whose page is refused is read from the API', { tag: ['@sandbox', '@web'] }, async ({ page, context }) => {
  test.setTimeout(120_000);
  // the page answers with the captcha, as it does in a browser 7digital doubts; the API is asked for real
  answerGm(context, ({ url }) => /^https:\/\/[a-z]{2}\.7digital\.com\/artist\//.test(url) ? { status: 405, body: '<!DOCTYPE html><html><head><title>Human Verification</title></head><body><div id="captcha-container"></div></body></html>' } : null);
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(c => (0, eval)(c), await readFile(sourceOf('first_contact'), 'utf8'));
  const d = await page.evaluate(() => new Promise(res => {
    document.addEventListener('mc:read-result', e => res(JSON.parse(e.detail)));
    window.__fcTest.mcRead(JSON.stringify({ url: 'https://uk.7digital.com/artist/sunset-vision/release/sunrise-paradise-79548957', run: 'r747' }));
  }));
  const rel = d.rel || {};
  const tracks = ((rel.mediums || [])[0] || {}).tracks || [];
  console.log(JSON.stringify({ ok: d.ok, error: d.error, title: rel.title, barcode: rel.barcode, types: rel.types, label: rel.labels, tracks: tracks.map(t => [t.title, t.lengthMs, t.isrc]) }));
  check(d.ok, `the read succeeds (${d.error || 'ok'})`);
  check(rel.title === 'Sunrise Paradise' && rel.barcode === '5054290231397' && (rel.types || []).includes('Single'), `the release: "${rel.title}", ${rel.barcode}, ${JSON.stringify(rel.types)}`);
  check(tracks.length === 2 && tracks[0].isrc === 'DENP32600367' && tracks[0].lengthMs === 372000 && tracks[1].isrc === 'DENP32600368', `its two tracks, in order, with ISRCs and lengths (${JSON.stringify(tracks.map(t => [t.title, t.lengthMs, t.isrc]))})`);
  check((rel.labels || [])[0] && rel.labels[0].name === 'Redux Magic', `its label (${JSON.stringify(rel.labels)})`);
});
