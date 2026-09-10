// #586 probe — what does MB's NATIVE tracklist offer for moving a track into
// the data-track section? Read-only: opens the release editor for the release
// majkinetor linked and dumps the medium's controls + the KO observables the
// native buttons drive. Write endpoints are blocked (never a catch-all route —
// that breaks navigation on production MB outright).
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
  const res = { url: location.href, tabs: [], mediumHtml: '', trackRowSample: '', ko: null, buttons: [] };
  res.tabs = [...document.querySelectorAll('.tabs a, ul.tabs li')].map(e => e.textContent.trim()).slice(0, 12);
  // the tracklist tab
  const tl = document.getElementById('tracklist');
  if (tl) {
    const med = tl.querySelector('.advanced-disc, .medium, table.medium');
    res.mediumHtml = (med ? med.outerHTML : tl.innerHTML).slice(0, 6000);
    const row = tl.querySelector('tr.track');
    res.trackRowSample = row ? row.outerHTML.slice(0, 2500) : '(no tr.track)';
    res.buttons = [...tl.querySelectorAll('button, a.icon, input[type=button]')]
      .map(b => ({ txt: (b.textContent || '').trim().slice(0, 40), cls: b.className, title: b.title }))
      .filter(b => b.txt || b.title).slice(0, 60);
  }
  // what the KO medium/track objects expose
  try {
    const ed = window.MB && window.MB.releaseEditor;
    const meds = ed && ed.rootField && ed.rootField.release && ed.rootField.release().mediums();
    if (meds) {
      const m = meds[0];
      const t = m.tracks()[0];
      res.ko = {
        mediumKeys: Object.keys(m).filter(k => typeof m[k] === 'function').sort(),
        trackKeys: Object.keys(t).filter(k => typeof t[k] === 'function').sort(),
        hasDataTracks: typeof m.hasDataTracks === 'function' ? !!m.hasDataTracks() : null,
        counts: meds.map(x => ({ pos: x.position(), tracks: x.tracks().length, data: x.tracks().filter(y => typeof y.isDataTrack === 'function' && y.isDataTrack()).length })),
      };
    }
  } catch (e) { res.ko = { error: e.message }; }
  return res;
});

console.log('URL:', out.url);
console.log('\nKO:', JSON.stringify(out.ko, null, 1));
console.log('\nBUTTONS in #tracklist:'); out.buttons.forEach(b => console.log('  ', JSON.stringify(b)));
console.log('\nTRACK ROW SAMPLE:\n', out.trackRowSample);
console.log('\nMEDIUM HTML (head):\n', out.mediumHtml.slice(0, 2500));
console.log('\nposted (should be empty):', posted.length);
await ctx.close();
