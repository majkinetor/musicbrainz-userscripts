// #584 follow-up (majkinetor: "also show in recording table") — does the
// recording entity that the release editor loads with the release even CARRY a
// .video flag? Apollo's recordings table reads r.recVideo off u(track.recording),
// while the picker reads it off /ws/js search results. If the former is
// undefined the marker can only ever appear in the picker, which would explain
// the ask. Read-only.
import { createRequire } from 'node:module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const MBID = process.env.MBID || '55530bc0-97ec-4256-97fc-e6058958c251';   // has "(video karaokė)" tracks
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
  const u = v => (typeof v === 'function' ? v() : v);
  return m.tracks().map(t => {
    const rec = u(t.recording);
    return {
      n: u(t.number), title: (u(t.name) || '').slice(0, 30),
      recName: rec ? (u(rec.name) || '').slice(0, 30) : null,
      recGid: rec ? (u(rec.gid) || '').slice(0, 8) : null,
      videoRaw: rec ? typeof rec.video : '(no recording)',
      video: rec ? u(rec.video) : null,
      recKeys: rec ? Object.keys(rec).sort().join(',').slice(0, 260) : '',
    };
  });
});
out.forEach(r => console.log(JSON.stringify(r)));
const withRec = out.filter(r => r.recGid);
console.log(`\n${withRec.length} linked · video===true on ${withRec.filter(r => r.video === true).length} · video undefined on ${withRec.filter(r => r.video === undefined).length}`);
await ctx.close();
