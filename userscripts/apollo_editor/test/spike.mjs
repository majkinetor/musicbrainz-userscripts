// Track Cannon — spike harness.
//
// Goal of this early harness: seed the MB release editor with a real captured
// release (test/seed-saigon.local.json — gitignored), inject the userscript, and
// dump (a) the script's own console trace, (b) a deep introspection of the
// MB.releaseEditor model, and (c) the tracklist the script reads. This is how we
// discover the model shape and confirm read/write before building the UI.
//
// Requires the shared repo-level logged-in profile (.pw-profile). If you're not
// logged in there, run the discogs_credits login helper first.

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE        = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'track_cannon.user.js');
const SEED_PATH   = resolve(HERE, 'seed-saigon.local.json');
const HEADED      = process.argv.includes('--headed');
const ORIGIN      = 'https://musicbrainz.org';

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const LOG_DIR = resolve(HERE, 'logs', stamp);

function log(...a) { console.log('[spike]', ...a); }

async function main() {
  if (!existsSync(SEED_PATH)) {
    console.error('Missing seed:', SEED_PATH, '\nExtract it from the captured confirm-page HTML first.');
    process.exit(2);
  }
  await mkdir(LOG_DIR, { recursive: true });
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');

  log('launching context (profile:', PROFILE_DIR + ')');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: !HEADED, viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1.5,
  });
  // don't let entity-creation tabs pop during the spike
  ctx.on('page', async p => { try { const u = p.url(); if (u && u !== 'about:blank' && /\/(artist|label)\/(add|create)/.test(u)) await p.close(); } catch {} });

  const page = ctx.pages()[0] || await ctx.newPage();
  const consoleLines = [];
  page.on('console', m => consoleLines.push(`[${new Date().toTimeString().slice(0,8)}] ${m.type().padEnd(7)} ${m.text()}`));
  page.on('pageerror', e => consoleLines.push(`[pageerror] ${e.name}: ${e.message}`));

  // 1) land logged-in on MB, then POST-seed /release/add via an in-page form
  log('navigating to MB home (login check)…');
  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('Not logged in in .pw-profile. Run the login helper first.'); await ctx.close(); process.exit(3); }

  log('seeding /release/add with', Object.keys(seed).length, 'params…');
  await page.evaluate(({ origin, params }) => {
    const f = document.createElement('form');
    f.method = 'POST'; f.action = origin + '/release/add'; f.style.display = 'none';
    const add = (name, value) => { const i = document.createElement('input'); i.type = 'hidden'; i.name = name; i.value = value; f.appendChild(i); };
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) v.forEach(x => add(k, x));   // e.g. type: ["compilation","album"]
      else add(k, v);
    }
    document.body.appendChild(f); f.submit();
  }, { origin: ORIGIN, params: seed });

  // 2) handle MB's "Confirm form submission" interstitial if it appears
  await page.waitForLoadState('domcontentloaded');
  const isConfirm = await page.locator('h1', { hasText: /Confirm form submission/i }).count().catch(() => 0);
  if (isConfirm) {
    log('confirm interstitial → clicking Continue');
    await page.locator('button[type=submit]', { hasText: /Continue/i }).first().click();
    await page.waitForLoadState('domcontentloaded');
  }
  log('landed on:', page.url());

  // 3) wait for the Knockout editor to mount, then inject the script
  log('waiting for MB.releaseEditor…');
  const ready = await page.waitForFunction(() => {
    const w = window; try { const e = w.MB && w.MB.releaseEditor; return e && e.rootField && e.rootField.release && e.rootField.release(); } catch { return false; }
  }, null, { timeout: 120000 }).then(() => true).catch(() => false);
  log('editor ready?', ready);

  log('injecting userscript…');
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(2500);   // let it probe + read

  // 4) deep introspection from the harness side (independent of the script)
  const introspection = await page.evaluate(() => {
    const w = window; const u = v => { try { return typeof v === 'function' ? v() : v; } catch { return undefined; } };
    const out = { ok: false };
    try {
      const ed = w.MB.releaseEditor;
      out.mbKeys = Object.keys(w.MB);
      out.editorKeys = Object.keys(ed);
      const rel = u(ed.rootField.release);
      out.releaseKeys = rel ? Object.keys(rel) : null;
      out.releaseGroupGid = rel && u(rel.releaseGroup) ? u(u(rel.releaseGroup).gid) : null;
      const mediums = u(rel.mediums) || [];
      out.mediumCount = mediums.length;
      const tracks = mediums[0] ? (u(mediums[0].tracks) || []) : [];
      out.trackCount = tracks.length;
      if (tracks[0]) {
        out.trackKeys = Object.keys(tracks[0]);
        const ac = u(tracks[0].artistCredit);
        out.acKeys = ac ? Object.keys(ac) : null;
        const names = ac ? (u(ac.names) || []) : [];
        out.nameKeys = names[0] ? Object.keys(names[0]) : null;
        const a0 = names[0] ? u(names[0].artist) : null;
        out.artistKeys = a0 ? Object.keys(a0) : null;
      }
      out.tracklist = (w.__trackCannon && w.__trackCannon.readTracklist()) || null;
      out.ok = true;
    } catch (e) { out.error = String(e && (e.stack || e.message)); }
    return out;
  });

  await page.screenshot({ path: resolve(LOG_DIR, 'editor.png'), fullPage: false }).catch(() => {});
  await writeFile(resolve(LOG_DIR, 'console.log'), consoleLines.join('\n'));
  await writeFile(resolve(LOG_DIR, 'introspection.json'), JSON.stringify(introspection, null, 2));

  log('── script console (TrackCannon lines) ──');
  consoleLines.filter(l => l.includes('TrackCannon')).forEach(l => console.log('   ', l));
  log('── introspection summary ──');
  console.log(JSON.stringify({
    ok: introspection.ok, error: introspection.error,
    editorKeys: introspection.editorKeys, releaseKeys: introspection.releaseKeys,
    mediumCount: introspection.mediumCount, trackCount: introspection.trackCount,
    trackKeys: introspection.trackKeys, acKeys: introspection.acKeys,
    nameKeys: introspection.nameKeys, artistKeys: introspection.artistKeys,
    releaseGroupGid: introspection.releaseGroupGid,
    firstTracks: (introspection.tracklist || []).slice(0, 4),
  }, null, 2));
  log('artifacts in', LOG_DIR);

  if (!HEADED) await ctx.close();
  else log('headed mode — leaving browser open; Ctrl-C to exit');
}

main().catch(e => { console.error(e); process.exit(1); });
