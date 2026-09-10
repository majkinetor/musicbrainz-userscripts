// #586 probe part 4 — what does MB's own moveTrackDown actually DO to the model
// when it runs on the last audio track? audioTracks/dataTracks turned out to be
// plain observables, not computeds, so "just set isDataTrack" would very likely
// leave the two arrays (which the native tbody loops over) out of sync.
//
// Nothing is submitted: this only mutates the in-page Knockout model, and every
// write endpoint is blocked. The page is closed afterwards without saving.
import { createRequire } from 'node:module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile',
  { headless: !process.argv.includes('--headed'), viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
const posted = [];
await page.route(/\/ws\/js\/edit\/|\/relationship-editor|\/edit\/create/i, r => { posted.push(r.request().url()); return r.abort(); });
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(6000);

const out = await page.evaluate(() => {
  const ed = window.MB.releaseEditor;
  const m = ed.rootField.release().mediums()[0];
  const snap = tag => ({
    tag,
    tracks: m.tracks().length,
    audio: m.audioTracks().length,
    data: m.dataTracks().length,
    hasDataTracks: !!m.hasDataTracks(),
    flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
    numbers: m.tracks().map(t => t.number()).join(','),
    domRows: document.querySelectorAll('#tracklist table.medium tbody tr.track').length,
  });
  const res = [snap('before')];
  res.push({ moveTrackDownSrc: ed.moveTrackDown.toString().slice(0, 900) });
  res.push({ swapTracksSrc: (ed.swapTracks ? ed.swapTracks.toString() : '(n/a)').slice(0, 900) });
  // last audio track → down
  const last = m.tracks()[m.tracks().length - 1];
  try { ed.moveTrackDown(last); } catch (e) { res.push({ err: e.message }); }
  res.push(snap('after moveTrackDown(last audio)'));
  // and the one before it
  const last2 = m.tracks()[m.tracks().length - 2];
  try { ed.moveTrackDown(last2); } catch (e) { res.push({ err2: e.message }); }
  res.push(snap('after moveTrackDown(second-to-last)'));
  // put them back
  m.tracks().filter(t => t.isDataTrack()).slice().reverse().forEach(t => { try { ed.moveTrackUp(t); } catch (e) {} });
  res.push(snap('after moveTrackUp x2 (restore)'));
  return res;
});
out.forEach(o => console.log(JSON.stringify(o, null, 1)));
console.log('\nposted (must be 0):', posted.length);
await ctx.close();
