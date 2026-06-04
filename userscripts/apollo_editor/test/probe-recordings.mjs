// Probe the release-editor model for what #119 (recording matching) needs:
// the `track.recording` observable shape, the recordingAssociation API surface,
// how suggestions are exposed, and the object shape required to SET a recording.
// Opens an existing release's /edit page (already has a release group + linked
// recordings) using the shared logged-in .pw-profile.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
// Mozart / Casadesus classical release from issue #122 — has an RG and 9 linked recordings.
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '51bdb849-5dfc-40c0-9fcb-f49fe7395cc7';
const LOG_DIR = resolve(HERE, 'logs', 'probe-rec-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));

async function main() {
  await mkdir(LOG_DIR, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN — re-auth .pw-profile'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => {
    try {
      const ms = window.MB.releaseEditor.rootField.release().mediums();
      return ms.length && ms.some(m => { const t = m.tracks(); return t && t.length; });
    } catch { return false; }
  }, null, { timeout: 120000 });

  const out = await page.evaluate(() => {
    const w = window, u = v => (typeof v === 'function' ? v() : v);
    const isObs = v => typeof v === 'function' && typeof v.peek === 'function';
    const ed = w.MB.releaseEditor;
    const rel = u(ed.rootField.release);
    const med = u(rel.mediums).find(m => { const t = u(m.tracks); return t && t.length; }) || u(rel.mediums)[0];
    const track = u(med.tracks)[0];
    if (!track) return { error: 'no track', mediums: u(rel.mediums).length };
    const fns = o => { const r = []; let p = o; const seen = new Set(); while (p && p !== Object.prototype) { for (const k of Object.getOwnPropertyNames(p)) { if (seen.has(k)) continue; seen.add(k); try { if (typeof o[k] === 'function' && !isObs(o[k])) r.push(k); } catch {} } p = Object.getPrototypeOf(p); } return r.sort(); };
    const obsKeys = o => Object.keys(o).filter(k => isObs(o[k])).sort();
    const safe = v => { try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); } };

    const rec = track.recording ? u(track.recording) : null;
    const recObsName = isObs(track.recording);

    // recordingAssociation lives on ed or as a module; capture whatever's reachable
    const ra = ed.recordingAssociation || (w.MB.releaseEditor.recordingAssociation) || null;

    return {
      track_obs: obsKeys(track),
      track_has_recording_obs: recObsName,
      recording_keys: rec ? Object.keys(rec) : null,
      recording_sample: rec ? {
        gid: u(rec.gid), name: u(rec.name), length: u(rec.length),
        artistCredit: rec.artistCredit ? safe(u(rec.artistCredit)) : null,
        entityType: rec.entityType, video: u(rec.video),
        gidObs: isObs(rec.gid), nameObs: isObs(rec.name),
      } : null,
      // suggestion surface
      track_suggested_keys: obsKeys(track).filter(k => /suggest|recording|match/i.test(k)),
      track_fns_recording: fns(track).filter(k => /record|suggest|match|associat/i.test(k)),
      recordingAssociation_present: !!ra,
      recordingAssociation_fns: ra ? Object.keys(ra).filter(k => typeof ra[k] === 'function') : null,
      recordingAssociation_keys: ra ? Object.keys(ra) : null,
      // how MB builds a recording entity (for SETTING)
      MB_entity_present: typeof w.MB.entity === 'function',
      editorFns_recording: fns(ed).filter(k => /record|suggest|associat/i.test(k)),
      // current linked state
      track_name: u(track.name),
      track_hasExistingRecording: rec ? !!u(rec.gid) : false,
    };
  });

  await writeFile(resolve(LOG_DIR, 'recordings.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log('[probe-recordings] artifacts in', LOG_DIR);
  if (!HEADED) await ctx.close();
}
main().catch(e => { console.error(e); process.exit(1); });
