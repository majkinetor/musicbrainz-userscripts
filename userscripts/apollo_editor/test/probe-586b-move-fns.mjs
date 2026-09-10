// #586 probe part 2 — read (never call) MB's own moveTrackUp/moveTrackDown so
// Apollo can drive the exact same model transition instead of inventing one.
import { createRequire } from 'node:module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => r.abort());
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(6000);

const out = await page.evaluate(() => {
  const ed = window.MB && window.MB.releaseEditor;
  const meds = ed.rootField.release().mediums();
  const m = meds[0], t = m.tracks()[0];
  const proto = Object.getPrototypeOf(t);
  const src = (o, k) => { try { return typeof o[k] === 'function' ? o[k].toString().slice(0, 1400) : '(not a fn: ' + typeof o[k] + ')'; } catch (e) { return 'ERR ' + e.message; } };
  return {
    trackProtoKeys: Object.getOwnPropertyNames(proto),
    mediumProtoKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(m)),
    moveTrackDown: src(t, 'moveTrackDown'),
    moveTrackUp: src(t, 'moveTrackUp'),
    audioTracks: src(m, 'audioTracks'),
    dataTracks: src(m, 'dataTracks'),
    hasDataTracks: src(m, 'hasDataTracks'),
    isDataTrackType: typeof t.isDataTrack,
    // is isDataTrack writable (an observable) or computed?
    isDataTrackHasWrite: !!(t.isDataTrack && typeof t.isDataTrack === 'function' && t.isDataTrack.valueWillMutate),
    previous: src(t, 'previous'),
    next: src(t, 'next'),
  };
});
for (const [k, v] of Object.entries(out)) console.log('\n══ ' + k + ':\n' + (Array.isArray(v) ? v.join(', ') : v));
await ctx.close();
