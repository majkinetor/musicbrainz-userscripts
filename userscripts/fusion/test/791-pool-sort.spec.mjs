// #791 (majkinetor): the pool can be sorted by title or artist, so the versions of one song
// sit together. A title that repeats (the same artist too, under Artist) is a run and its
// cards are tinted, alternating two colours; a title on its own stays plain. Added keeps
// the order recordings came in. Sorting is only the view: poolOrder doesn't change.
import { test, check } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', viewport: { width: 1400, height: 900 }, gm: { name: 'Fusion', xhr: 'none' } });

test('sort by title or artist, repeats tinted', { tag: '@unit' }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r =>
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><meta charset="utf-8"><body><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release-group/a07cbaff-aa79-35a9-9932-af7335f306eb', { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });

  const got = await page.evaluate(async () => {
    const F = window.__fusion;
    await F.openFusion();
    F.clearBoard();
    let n = 0;
    const add = (title, artist) => F.addToPool(F.mkRecording('bbbbbbbb-0000-4000-8000-' + String(n++).padStart(12, '0'), {
      title, length: 240000, isrcs: [], acoustids: [], artistCredit: artist, artistGid: artist, artistGids: [artist],
      video: false, releases: [{ title: 'R' }], isrcsKnown: true }));
    add('Praise Lamented Shade', 'Paradise Lost');
    add('Embers Fire', 'Paradise Lost');
    add('As I Die', 'Paradise Lost');
    add('Embers Fire', 'My Dying Bride');
    add('Embers Fire (remastered)', 'Paradise Lost');
    add('Christendom', 'Paradise Lost');
    const view = () => [...document.querySelectorAll('#fs-pool-body .fs-pcard')].map(c => {
      const t = c.querySelector('.fs-t a').textContent, a = (c.querySelector('.fs-artist') || {}).textContent || '';
      const run = c.classList.contains('fs-run0') ? 0 : c.classList.contains('fs-run1') ? 1 : null;
      return t + ' / ' + a.replace(/^\s*—\s*/, '') + (run == null ? '' : ' #' + run);
    });
    const poolOrder = () => F.STATE.poolOrder.join(',');
    const before = poolOrder();
    const buttons = document.querySelectorAll('#fs-pool-sort [data-sort]').length;
    F.setPoolSort('title'); const title = view();
    const titleOn = document.querySelector('#fs-pool-sort .fs-on').dataset.sort;
    F.setPoolSort('artist'); const artist = view();
    F.setPoolSort('added'); const added = view();
    const orderKept = poolOrder() === before;
    // all titles different: nothing tinted
    F.STATE.poolOrder.length = 0;
    add('A', 'X'); add('B', 'X'); add('C', 'X');
    F.setPoolSort('title'); const distinct = view();
    F.setPoolSort('added');
    return { buttons, title, titleOn, artist, added, distinct, orderKept };
  });
  console.log(JSON.stringify(got, null, 1));
  check(got.buttons === 3, 'three sort buttons: Added, Title, Artist');
  check(got.titleOn === 'title', 'the chosen sort is lit');
  check(JSON.stringify(got.title) === JSON.stringify([
    'As I Die / Paradise Lost',
    'Christendom / Paradise Lost',
    'Embers Fire / My Dying Bride #0',
    'Embers Fire / Paradise Lost #0',
    'Embers Fire (remastered) / Paradise Lost #0',
    'Praise Lamented Shade / Paradise Lost',
  ]), 'Title: the versions of one song together, "(remastered)" with them, the run tinted, single titles plain');
  check(JSON.stringify(got.artist) === JSON.stringify([
    'Embers Fire / My Dying Bride',
    'As I Die / Paradise Lost',
    'Christendom / Paradise Lost',
    'Embers Fire / Paradise Lost #0',
    'Embers Fire (remastered) / Paradise Lost #0',
    'Praise Lamented Shade / Paradise Lost',
  ]), 'Artist: by artist, then title; a run is the same artist and title');
  check(got.added[0].startsWith('Praise Lamented Shade') && got.added[3].startsWith('Embers Fire / My Dying Bride') && got.added.every(s => !/#\d$/.test(s)),
    'Added: the order they came in, nothing tinted');
  check(got.orderKept, 'sorting leaves the pool order (and so Match) alone');
  check(got.distinct.every(s => !/#\d$/.test(s)), 'all titles different: nothing tinted');
});

test('runs alternate colours', { tag: '@unit' }, async ({ page, context, inject }) => {
  await context.route(/musicbrainz\.org/, r =>
    r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><body><div id="content"></div></body>' }));
  await page.goto('https://musicbrainz.org/release-group/a07cbaff-aa79-35a9-9932-af7335f306eb', { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });
  const runs = await page.evaluate(() => {
    const F = window.__fusion;
    const r = t => ({ title: t, artistCredit: 'X' });
    return F.sortPool([r('B'), r('A'), r('C'), r('A'), r('B'), r('D')], 'title').map(x => x.rec.title + (x.run == null ? '' : x.run)).join(' ');
  });
  check(runs === 'A0 A0 B1 B1 C D', `two neighbouring runs get different colours (${runs})`);
});
