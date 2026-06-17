// Verify recEntity.name (recording title) is populated in the editor state for #232,
// so the #232 fix (empty Qobuz title -> fall back to recording name) yields named works.
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const MBID = '01f17c95-b4d4-430a-b1af-bd6ba0b602fe';

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true, viewport: { width: 1400, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit-relationships`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.MB?.relationshipEditor?.state?.entity, null, { timeout: 30000 });
const rows = await page.evaluate(() => {
  const re = MB.relationshipEditor, T = MB.tree, out = [];
  for (const [, medium] of T.iterate(re.state.mediums)) {
    const tracks = medium?.tracks ?? medium;
    for (const raw of T.iterate(tracks)) {
      const t = Array.isArray(raw) ? raw[1] : raw;
      const rec = t?.recording ?? t;
      if (rec) out.push({ pos: t?.position ?? t?.number, name: rec.name, gid: !!rec.gid });
      if (out.length >= 6) return out;
    }
  }
  return out;
});
console.log('recordings (pos / name / hasGid):');
rows.forEach(r => console.log(`  ${r.pos}  "${r.name}"  gid=${r.gid}`));
console.log('all have non-empty name:', rows.length > 0 && rows.every(r => r.name && r.name.trim()));
await ctx.close();
