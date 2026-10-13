// #731: the release artist cell's unresolved artist kept its whole name when it lost focus.
// The field shrinks to its text once it's blurred, but measured that text in the tracklist's
// 13px font: in the release cell's larger one the name was cut off.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

const NAME = 'Leitung Winston Jonesddasfasdfasdf';
const seed = {
  name: 'Apollo 731 release info', status: 'official',
  'artist_credit.names.0.name': 'Zzq Nobody 731', 'artist_credit.names.0.join_phrase': ', ',
  'artist_credit.names.1.name': NAME,
  'mediums.0.format': 'Digital Media',
  'mediums.0.track.0.name': 'One', 'mediums.0.track.0.length': '200000', 'mediums.0.track.0.artist_credit.names.0.name': 'Zzq Nobody 731',
};

test.use({ gm: apolloGm() });

test('an unresolved release artist shows its whole name, focused or not', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await openApollo(page, inject, { seed });
  const sel = '#information .tc-search input.nm';
  await until(() => page.evaluate(n => [...document.querySelectorAll('#information .tc-search input.nm')].some(i => i.value === n), NAME));
  const measure = () => page.evaluate(n => {
    const i = [...document.querySelectorAll('#information .tc-search input.nm')].find(x => x.value === n);
    return i && { focused: document.activeElement === i, clipped: i.scrollWidth > i.clientWidth + 1, width: Math.round(i.getBoundingClientRect().width), scroll: i.scrollWidth, font: getComputedStyle(i).fontSize };
  }, NAME);
  await page.evaluate(n => { const i = [...document.querySelectorAll('#information .tc-search input.nm')].find(x => x.value === n); i.focus(); }, NAME);
  const on = await measure();
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(300);
  const off = await until(measure, m => m && !m.focused);
  check(on && !on.clipped, `focused: the whole name (${JSON.stringify(on)})`);
  check(off && !off.clipped, `unfocused: still the whole name (${JSON.stringify(off)})`);
  await page.locator(sel).first().scrollIntoViewIfNeeded();
});
