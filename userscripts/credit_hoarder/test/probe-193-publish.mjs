// Probe — dump MB link types matching "publish" with their entity-type pairs,
// to decide how to model a Tidal Music Publisher credit (release↔label vs
// work↔label, and the exact link-type name resolveLinkTypeId must match).
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const ORIGIN = process.argv.includes('--beta') ? 'https://beta.musicbrainz.org' : 'https://musicbrainz.org';
const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true });
const page = ctx.pages()[0] || await ctx.newPage();
// Any release edit page boots MB.linkedEntities with link_type table.
await page.goto(`${ORIGIN}/release/79dd22c3-7f53-4152-a27b-b29f1d1b053c/edit`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.MB?.linkedEntities?.link_type && Object.keys(MB.linkedEntities.link_type).length > 100, null, { timeout: 45000 }).catch(()=>{});
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const lt = window.MB?.linkedEntities?.link_type;
  if (!lt) return { error: 'no MB.linkedEntities.link_type (logged out?)', url: location.href };
  const hits = [];
  for (const v of Object.values(lt)) {
    const blob = `${v.name} ${v.link_phrase} ${v.reverse_link_phrase}`.toLowerCase();
    if (/publish/.test(blob)) hits.push({
      id: v.id, name: v.name, type0: v.type0, type1: v.type1,
      phrase: v.link_phrase, deprecated: !!v.deprecated,
    });
  }
  // also: how many label↔work and label↔release types exist at all?
  const all = Object.values(lt);
  const labelWork = all.filter(v => (v.type0==='label'&&v.type1==='work')||(v.type0==='work'&&v.type1==='label')).map(v=>v.name);
  const labelRel = all.filter(v => (v.type0==='label'&&v.type1==='release')||(v.type0==='release'&&v.type1==='label')).map(v=>v.name);
  return { total: all.length, count: hits.length, hits, labelWork, labelRelease: labelRel };
});
console.log(JSON.stringify(out, null, 2));
await ctx.close();
