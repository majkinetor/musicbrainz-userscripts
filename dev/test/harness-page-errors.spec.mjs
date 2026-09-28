// The harness's page-error check (#625): MusicBrainz's own React #418 (hydration,
// recovered on the client) never fails a test; any other page error still does (that
// path is every other spec). On a blank page, nothing fetched.
import { test, expect, mbNoise } from './harness.mjs';

test.use({ profile: 'fresh', gm: false });

const throwInPage = (page, msg) => page.evaluate(m => { setTimeout(() => { throw new Error(m); }, 0); }, msg).then(() => page.evaluate(() => new Promise(r => setTimeout(r, 0))));

test('MusicBrainz\'s React #418 is not a page error', { tag: ['@unit'] }, async ({ page }) => {
  await page.setContent('<!doctype html><title>t</title>');
  expect(mbNoise('Minified React error #418; visit https://react.dev/errors/418?args[]=text')).toBe(true);
  expect(mbNoise('Minified React error #4180')).toBe(false);
  await throwInPage(page, 'Minified React error #418; visit https://react.dev/errors/418?args[]=text');
});

