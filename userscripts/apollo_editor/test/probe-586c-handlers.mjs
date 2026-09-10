// #586 probe part 3 — locate MB's moveTrackUp/moveTrackDown click handlers and
// see how tracks / audioTracks / dataTracks relate. Read-only.
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
  const ed = window.MB.releaseEditor;
  const m = ed.rootField.release().mediums()[0];
  const t = m.tracks()[0];
  const fnSrc = f => { try { return typeof f === 'function' ? f.toString().slice(0, 1800) : '(' + typeof f + ')'; } catch (e) { return 'ERR'; } };
  const res = {
    releaseEditorKeys: Object.keys(ed).sort(),
    tracksIsComputed: !!(m.tracks && m.tracks.peek && !m.tracks.push),
    tracksSrc: fnSrc(m.tracks),
    trackCounts: { tracks: m.tracks().length, audio: m.audioTracks() ? m.audioTracks().length : null, data: m.dataTracks() ? m.dataTracks().length : null },
    isDataTrackSrc: fnSrc(t.isDataTrack),
  };
  // hunt for the handlers wherever they live
  const seen = [];
  const scan = (obj, path, depth) => {
    if (!obj || depth > 2 || seen.includes(obj)) return null;
    seen.push(obj);
    for (const k of Object.keys(obj)) {
      let v; try { v = obj[k]; } catch (e) { continue; }
      if (/^moveTrack(Up|Down)$/.test(k) && typeof v === 'function') return { where: path + '.' + k, src: fnSrc(v) };
      if (v && typeof v === 'object' && depth < 2) { const r = scan(v, path + '.' + k, depth + 1); if (r) return r; }
    }
    return null;
  };
  res.moveDown = scan(ed, 'MB.releaseEditor', 0) || scan(window.MB, 'MB', 0) || '(not found)';
  // the actual DOM button — what does clicking it call?
  const btn = document.querySelector('#tracklist button.track-down');
  res.btnBinding = btn ? btn.getAttribute('data-bind') + ' | data-click=' + btn.getAttribute('data-click') : '(none)';
  // ko's registered event handler on the button (jQuery-style delegation?)
  res.tbodyHasDelegate = !!document.querySelector('#tracklist table.medium tbody');
  return res;
});
for (const [k, v] of Object.entries(out)) console.log('\n══ ' + k + ':\n' + (typeof v === 'object' ? JSON.stringify(v, null, 1) : v));
await ctx.close();
