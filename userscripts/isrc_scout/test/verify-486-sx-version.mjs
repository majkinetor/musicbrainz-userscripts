// #486 (chaban-mb): SoundExchange auto-match picked the SAME ISRC for two different
// tracks — "Sing (radio edit)" and "Sing (club edit)" both landed on GBAYE0600449 (the
// radio edit's ISRC), because MB encodes the edit in the title ("Sing (radio edit)") but
// SoundExchange returns the SAME bare title ("Sing") for every edit and keeps the
// distinguishing text in a separate `version` field — which SX.classify() ignored
// entirely, so both queries converged on whichever candidate ranked first.
//
// Real release: https://musicbrainz.org/release/248bf391-33cf-4796-9648-6608f676e498
// Real SX data (from chaban's CSV, pulled from SoundExchange's own UI):
//   "Sing" / Radio Edit; Feat. Angie Brown / GBAYE0600449
//   "Sing" / Club Edit; Feat. Angie Brown  / GBAYE0600486
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'isrc_scout.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1200, height: 800 }, bypassCSP: true });
await ctx.addInitScript(() => {
  window.GM_getValue = (k, d) => d;
  window.GM_setValue = () => {};
  window.GM_info = { script: { name: 'ISRC Scout', version: 't', homepageURL: 'x' } };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/release/1bfa31f9-b196-4eb1-a805-e747a610372d', { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__isrcScoutTestSX, { timeout: 10000 });

const radioEditItem = {
  isrc: 'GBAYE0600449', recordingTitle: 'Sing', recordingArtistName: 'Soul Avengerz Featuring Angie Brown',
  recordingVersion: 'Radio Edit; Feat. Angie Brown', recordingYear: '2006', duration: '',
};
const clubEditItem = {
  isrc: 'GBAYE0600486', recordingTitle: 'Sing', recordingArtistName: 'Soul Avengerz Featuring Angie Brown',
  recordingVersion: 'Club Edit; Feat. Angie Brown', recordingYear: '2006', duration: '',
};

const result = await page.evaluate(({ radioEditItem, clubEditItem }) => {
  const SX = window.__isrcScoutTestSX;
  const cls = (item, mbTitle) => SX.classify(SX.fields(item), mbTitle, 'Soul Avengerz Featuring Angie Brown', '', 2006);
  return {
    radioAgainstRadioTitle: cls(radioEditItem, 'Sing (radio edit)'),   // correct match — must stay 'best'
    radioAgainstClubTitle:  cls(radioEditItem, 'Sing (club edit)'),    // #486: wrong edit — must NOT be 'best'
    clubAgainstClubTitle:   cls(clubEditItem, 'Sing (club edit)'),     // correct match — must stay 'best'
    clubAgainstRadioTitle:  cls(clubEditItem, 'Sing (radio edit)'),    // #486: wrong edit — must NOT be 'best'
    // no version data on the SX side at all — must NOT be penalized (SX data is often messy)
    noVersionData: (() => {
      const item = Object.assign({}, radioEditItem, { recordingVersion: '' });
      return cls(item, 'Sing (club edit)');
    })(),
    // no edit hint in the MB title at all — must NOT be penalized
    plainTitleNoHint: cls(radioEditItem, 'Sing'),
  };
}, { radioEditItem, clubEditItem });
console.log(JSON.stringify(result, null, 2));

ck(result.radioAgainstRadioTitle === 'best', `radio-edit SX candidate classifies 'best' against "Sing (radio edit)" (got ${result.radioAgainstRadioTitle})`);
ck(result.clubAgainstClubTitle === 'best', `club-edit SX candidate classifies 'best' against "Sing (club edit)" (got ${result.clubAgainstClubTitle})`);
ck(result.radioAgainstClubTitle !== 'best', `radio-edit SX candidate does NOT classify 'best' against "Sing (club edit)" — the #486 bug (got ${result.radioAgainstClubTitle})`);
ck(result.clubAgainstRadioTitle !== 'best', `club-edit SX candidate does NOT classify 'best' against "Sing (radio edit)" — the #486 bug (got ${result.clubAgainstRadioTitle})`);
ck(result.noVersionData === 'best', `missing SX version data isn't penalized — still 'best' (got ${result.noVersionData})`);
ck(result.plainTitleNoHint === 'best', `a plain MB title with no edit hint isn't penalized — still 'best' (got ${result.plainTitleNoHint})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
