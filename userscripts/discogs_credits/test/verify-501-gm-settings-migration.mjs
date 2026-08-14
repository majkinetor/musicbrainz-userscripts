// #501 (majkinetor): mirrors the credit_hoarder fix (shared source lineage) —
// discogs-importer-opts (the whole import-options blob) and
// discogs-importer-log-open (log-panel UI state) move from localStorage to GM
// storage. GM storage is per-script, unlike localStorage which every script on
// the same origin shares — so this also drops the incidental (never a
// documented feature) settings coupling with Credit Hoarder that came from
// both scripts happening to use the same literal key string.
import { launchTestContext, openReleasePage, injectUserscript } from './lib/browser.js';

const url = 'https://musicbrainz.org/release/62a764a8-cf05-459c-a358-2c65dbf0b729';
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const context = await launchTestContext({ headed: false });
const page = await openReleasePage(context, url);

// pre-existing localStorage settings (the pre-#501 world), no GM value yet.
await page.evaluate(() => {
  localStorage.setItem('discogs-importer-opts', JSON.stringify({ tracklist: false, applyTracks: true, createWorksReset421: true, createWorksMode: 'never' }));
  localStorage.setItem('discogs-importer-log-open', '1');
});
await injectUserscript(page);

const migrated = await page.evaluate(() => ({
  opts: JSON.parse(window.__gmStore.get('discogs-importer-opts') || 'null'),
  logOpen: window.__gmStore.get('discogs-importer-log-open'),
  lsOptsStillThere: localStorage.getItem('discogs-importer-opts') !== null,
}));
console.log('migration result:', JSON.stringify(migrated));
ck(migrated.opts && migrated.opts.tracklist === false && migrated.opts.applyTracks === true, `the old localStorage options were adopted into GM storage on load (got ${JSON.stringify(migrated.opts)})`);
ck(migrated.logOpen === '1', `the old localStorage log-open state was adopted too (got "${migrated.logOpen}")`);
ck(migrated.lsOptsStillThere, 'the old localStorage key is left in place (non-destructive), just no longer read from');

const trackCbChecked = await page.evaluate(() => {
  const lbl = [...document.querySelectorAll('label')].find(l => (l.textContent || '').trim().startsWith('Per-track credits'));
  return lbl?.querySelector('input[type="checkbox"]')?.checked;
});
ck(trackCbChecked === false, `the migrated setting actually applied to the UI (Per-track credits unchecked, got ${trackCbChecked})`);

await context.close();
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
