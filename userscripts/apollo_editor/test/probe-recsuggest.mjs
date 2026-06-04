// #119 grounding probe: on the Recordings tab, what does each track's suggestedRecordings carry?
// (releases-each-appears-on? length?) + confirm the native methods we'll drive.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = 'https://musicbrainz.org';
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || 'b2b6dc32-77a3-4a89-8af0-99d4b6f1a9ad';
const HEADED = process.argv.includes('--headed');

const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { const ms = window.MB.releaseEditor.rootField.release().mediums(); return ms.length && ms.some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });

// Switch to the Recordings tab so the recordingAssociation loads suggestions.
await page.locator('a, button, li', { hasText: /^Recordings$/ }).first().click().catch(() => {});
await page.waitForTimeout(3500);

const out = await page.evaluate(async () => {
  const u = v => (typeof v === 'function' ? v() : v);
  const isObs = v => typeof v === 'function' && typeof v.peek === 'function';
  const ed = window.MB.releaseEditor;
  const ra = ed.recordingAssociation;
  const med = u(ed.rootField.release().mediums).find(m => u(m.tracks).length);
  const tracks = u(med.tracks);
  const t0 = tracks[0];

  // try to force suggestions for the first track if not present
  if (ra && typeof ra.findRecordingSuggestions === 'function' && (!u(t0.suggestedRecordings) || !u(t0.suggestedRecordings).length)) {
    try { ra.findRecordingSuggestions(t0); } catch (e) {}
  }
  await new Promise(r => setTimeout(r, 2500));

  const dump = (tr) => {
    const sugg = u(tr.suggestedRecordings) || [];
    const rec = tr.recording ? u(tr.recording) : null;
    const s0 = sugg[0] ? u(sugg[0]) : null;
    return {
      trackTitle: u(tr.name),
      loading: isObs(tr.loadingSuggestedRecordings) ? u(tr.loadingSuggestedRecordings) : 'n/a',
      suggCount: sugg.length,
      hasNewRecording: isObs(tr.hasNewRecording) ? u(tr.hasNewRecording) : 'n/a',
      recordingGID: typeof tr.recordingGID === 'function' ? (() => { try { return tr.recordingGID(); } catch (e) { return 'ERR'; } })() : 'n/a',
      titleDiffers: typeof tr.titleDiffersFromRecording === 'function' ? (() => { try { return tr.titleDiffersFromRecording(); } catch (e) { return 'ERR'; } })() : 'n/a',
      artistDiffers: typeof tr.artistDiffersFromRecording === 'function' ? (() => { try { return tr.artistDiffersFromRecording(); } catch (e) { return 'ERR'; } })() : 'n/a',
      sample_suggestion_keys: s0 ? Object.keys(s0) : null,
      sample_suggestion: s0 ? {
        gid: u(s0.gid), name: u(s0.name), length: u(s0.length),
        artistCredit_keys: s0.artistCredit ? Object.keys(u(s0.artistCredit) || {}) : null,
        // hunt for a release list on the suggestion under any plausible key
        releaseKeys: Object.keys(s0).filter(k => /release|appear/i.test(k)),
        releases_sample: (() => {
          for (const k of Object.keys(s0)) {
            if (!/release|appear/i.test(k)) continue;
            try { const v = u(s0[k]); if (Array.isArray(v) && v.length) return { key: k, count: v.length, first: { name: u(v[0].name), gid: u(v[0].gid) } }; } catch (e) {}
          }
          return null;
        })(),
      } : null,
    };
  };

  return {
    recordingAssociation_fns: ra ? Object.keys(ra).filter(k => typeof ra[k] === 'function') : null,
    track_update_methods: ['updateRecordingTitle', 'updateRecordingArtist', 'setRecordingValue'].map(m => `${m}:${typeof t0[m]}`),
    tracks: tracks.slice(0, 3).map(dump),
  };
});
console.log(JSON.stringify(out, null, 2));
if (!HEADED) await ctx.close();
