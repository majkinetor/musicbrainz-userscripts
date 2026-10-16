// #772: Escapades' disc and runout were in the archive, yet Mission Control offered Discogs' same files as new: the
// archive's 250px thumbnail and the 600px file came out 7 and 10 bits apart (the limit is 6), since a picture drawn
// straight to 9×8 is sampled, not averaged. Art Station's own dHash is taken from its source and run in the page on
// both, with the other disc as a different picture that must stay far apart. No network: the images are fixtures
// (release 07219c13 on musicbrainz.org, discogs.com/release/19269505).
import { readFile } from 'node:fs/promises';
import { test, check, sourceOf } from '../../../dev/test/harness.mjs';

const fx = n => readFile(new URL(`./fixtures/772-${n}.jpg`, import.meta.url)).then(b => b.toString('base64'));

test('#772: a store file and the archive thumbnail of the same picture have near fingerprints', { tag: ['@unit'] }, async ({ page }) => {
  const src = (await readFile(sourceOf('art_station'), 'utf8')).replace(/\r\n/g, '\n');
  const dHash = src.slice(src.indexOf('  function dHash'), src.indexOf('  const hamming ='));
  const same = Number(/const SAME_PICTURE = (\d+)/.exec(src)[1]);
  const imgs = {};
  for (const n of ['runout-archive-250', 'runout-discogs', 'medium-archive-250', 'medium-discogs']) imgs[n] = await fx(n);
  await page.setContent('<!doctype html><title>dHash</title>');
  const h = await page.evaluate(async ({ dHash, imgs }) => {
    const f = new Function(dHash + '\nreturn dHash;')(), out = {};
    for (const [n, b64] of Object.entries(imgs)) out[n] = f(await createImageBitmap(await (await fetch('data:image/jpeg;base64,' + b64)).blob()));
    return out;
  }, { dHash, imgs });
  const ham = (a, b) => [...a].filter((c, i) => c !== b[i]).length;
  const runout = ham(h['runout-discogs'], h['runout-archive-250']), medium = ham(h['medium-discogs'], h['medium-archive-250']);
  const apart = Math.min(ham(h['runout-discogs'], h['medium-archive-250']), ham(h['medium-discogs'], h['runout-archive-250']));
  console.log({ runout, medium, apart, same });
  check(runout <= same, `the runout is the same picture (${runout} bits apart, limit ${same})`);
  check(medium <= same, `the disc is the same picture (${medium} bits apart, limit ${same})`);
  check(apart > 3 * same, `the disc and the runout stay different pictures (${apart} bits apart)`);
});
