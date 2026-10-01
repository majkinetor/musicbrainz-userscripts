// #650 (majkinetor): "we should add annotations (should be optional) from all providers (Qobuz
// above has it, BC almost always has it, Discogs has notes etc.)".
//
// Off by default: the seed has no annotation. On: the platform's notes, plain text, with a line
// naming where they come from. Fixtures: Discogs 4570366 (notes), Apple us/617154241 (Random Access Memories,
// editorial notes).
import { test, check, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'First Contact' } });

test('annotation: off by default; on, the platform\'s notes with their source', { tag: ['@web'] }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  const r = await page.evaluate(async () => {
    const T = window.__fcTest, P = id => T.providers.find(p => p.id === id);
    const dg = await P('discogs').fetchRelease('4570366');
    const am = await P('apple').fetchRelease('us/617154241');
    const seedHas = rel => T.seedParams(rel, 'note').some(([k]) => k === 'annotation');
    return { dg: dg.annotation, am: am.annotation, seedWith: seedHas({ ...dg, annotation: 'x' }), seedWithout: seedHas({ ...dg, annotation: null }) };
  });
  check(typeof r.dg === 'string' && r.dg.length > 20 && !/<[a-z]/i.test(r.dg), `Discogs's notes, plain text (${JSON.stringify((r.dg || '').slice(0, 80))})`);
  check(typeof r.am === 'string' && r.am.length > 20 && !/<[a-z]|&[a-z]+;/i.test(r.am), `Apple's editorial notes, markup gone (${JSON.stringify((r.am || '').slice(0, 80))})`);
  check(r.seedWith && !r.seedWithout, 'the seed carries an annotation only when there is one');
});

// the setting, on a real import from a Bandcamp page (its about and credits): off by default, so
// the seed has no annotation; on, the notes, ending with where they come from
test('annotation setting: off, no annotation in the seed; on, the notes and their source', { tag: ['@web'] }, async ({ page, inject }) => {
  test.info().annotations.push({ type: 'fixture', description: 'bullion.bandcamp.com/album/nearly' });
  await page.goto('https://bullion.bandcamp.com/album/nearly', { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  await page.locator('#fc-root .fc-go').waitFor({ state: 'visible' });
  const seedOf = () => page.evaluate(async () => {
    window.open = () => null;                                       // no tab: the form would post into this one…
    HTMLFormElement.prototype.submit = function () { };             // …so it isn't sent at all
    window.__fcLastSeed = null;
    await window.__fcTest.importCurrent();
    const s = window.__fcLastSeed;
    return s && (s.params.find(([k]) => k === 'annotation') || [null, null])[1];
  });
  const off = await seedOf();
  check(off === null, `off by default: no annotation (${JSON.stringify(off)})`);
  await page.locator('#fc-root .fc-more').click();
  await page.locator('#fc-panel .fc-annotation').check();
  await page.mouse.click(5, 5);
  const on = await seedOf();
  const tail = 'From Bandcamp: https://bullion.bandcamp.com/album/nearly';
  check(typeof on === 'string' && on.endsWith('\n\n' + tail) && on.length > tail.length + 40, `on: the album's notes and their source (${JSON.stringify((on || '').slice(-120))})`);
});
