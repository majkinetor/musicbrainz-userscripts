// #586 probe part 5 — moveTrackDown turned out to only ever flip isDataTrack
// when the track BELOW is already data, so the section has to be opened another
// way. Read hasDataTracks' write function, then check whether setting
// isDataTrack directly keeps audioTracks/dataTracks (plain observables, both
// looped by the native tbody) in sync. Model-only; writes are blocked.
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

const step = async (label, fn) => {
  const r = await page.evaluate(f => {
    const ed = window.MB.releaseEditor;
    const m = ed.rootField.release().mediums()[0];
    // eslint-disable-next-line no-new-func
    const out = new Function('ed', 'm', f)(ed, m);
    return {
      out,
      tracks: m.tracks().length, audio: m.audioTracks().length, data: m.dataTracks().length,
      hasDataTracks: !!m.hasDataTracks(),
      flags: m.tracks().map(t => (t.isDataTrack() ? 'D' : '.')).join(''),
      numbers: m.tracks().map(t => t.number()).join(','),
      names: m.tracks().map(t => (t.name() || '').slice(0, 14)).join(' | '),
      domRows: document.querySelectorAll('#tracklist table.medium tbody tr.track').length,
      domFlags: [...document.querySelectorAll('#tracklist table.medium tbody tr.track')].map(tr => (tr.className.includes('data') ? 'D' : '.')).join(''),
    };
  }, fn);
  console.log('\n══ ' + label + '\n' + JSON.stringify(r, null, 1));
  await page.waitForTimeout(400);
};

await step('0 · baseline + hasDataTracks source', `
  const d = Object.getOwnPropertyDescriptor(m, 'hasDataTracks');
  return { write: (m.hasDataTracks && m.hasDataTracks.toString().slice(0,200)) };
`);
await step('1 · set isDataTrack(true) on the LAST track directly', `
  const t = m.tracks()[m.tracks().length - 1]; t.isDataTrack(true); return t.name();
`);
await step('2 · then moveTrackDown on the second-to-last (next is now data)', `
  const t = m.tracks()[m.tracks().length - 2]; return ed.moveTrackDown(t);
`);
await step('3 · moveTrackUp on the FIRST data track (should promote it back)', `
  const dt = m.tracks().filter(t => t.isDataTrack()); const first = dt[0];
  return first ? [first.name(), ed.moveTrackUp(first)] : 'none';
`);
await step('4 · restore: clear every isDataTrack', `
  m.tracks().forEach(t => t.isDataTrack(false)); return 'ok';
`);
console.log('\nposted (must be 0):', posted.length);
await ctx.close();
