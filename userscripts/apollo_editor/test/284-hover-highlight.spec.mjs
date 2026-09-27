// #284: hovering an artist lights all its instances in the tracklist — an opt-in
// Appearance setting, off by default. On: a multi-instance artist lights all of them, a
// one-off clears the highlight, re-hovering lights them again.
import { test, check } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const REL = '89efad71-65d2-4f96-bc55-d69ad147bae2';   // The Journey Aflame: one artist on every track, guests once

// the artists of the tracklist's slots: one on several tracks, one on a single track
const artists = page => page.evaluate(() => {
  const counts = new Map();
  for (const s of document.querySelectorAll('.tc-aslot')) { const id = s.dataset.art; if (id && id !== 'n:' && id !== 'g:') counts.set(id, (counts.get(id) || 0) + 1); }
  const multi = [...counts].find(([, n]) => n >= 2), single = [...counts].find(([, n]) => n === 1);
  return { multi: multi && multi[0], n: multi && multi[1], single: single && single[0] };
});
const hover = (page, id) => page.evaluate(async id => {
  [...document.querySelectorAll('.tc-aslot')].find(s => s.dataset.art === id).dispatchEvent(new MouseEvent('mouseenter'));
  await new Promise(r => setTimeout(r, 30));
  return document.querySelectorAll('.tc-aslot.tc-arthl').length;
}, id);

test.describe('by default', () => {
  test.use({ gm: apolloGm() });
  test('hovering highlights nothing', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { release: REL, tab: 'tracklist' });
    await page.waitForSelector('.tc-aslot', { timeout: 30000 });
    const a = await artists(page);
    check(a.multi, 'an artist on several tracks');
    check(await hover(page, a.multi) === 0, 'off by default');
  });
});

test.describe('turned on', () => {
  test.use({ gm: apolloGm({ hoverHighlight: true }) });
  test('an artist lights all its instances', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, { release: REL, tab: 'tracklist' });
    await page.waitForSelector('.tc-aslot', { timeout: 30000 });
    const a = await artists(page);
    check(a.multi && a.single, 'an artist on several tracks, and one on a single track');
    check(await hover(page, a.multi) === a.n, `all ${a.n} instances light`);
    check(await hover(page, a.single) === 0, 'a one-off clears the highlight');
    check(await hover(page, a.multi) === a.n, 're-hovering lights them again');
  });
});
