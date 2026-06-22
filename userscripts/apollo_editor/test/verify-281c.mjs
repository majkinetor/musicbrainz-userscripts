// Verifies #281: the Discogs "missing link" chain / mismatch warning only shows
// on RESOLVED (committed) artists — never on unresolved slots (which littered every
// row on add-release). create-with-link is unaffected (the ＋ button seeds the URL).
//
// Drives the exposed __apolloEditor API on a real release: takes a slot the check
// flagged as addable, marks it uncommitted, re-checks, and asserts the flag clears
// (and _discogsChecked is false); restoring committed re-flags it.
//
//   node test/verify-281c.mjs [--headed] [MBID]
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT_PATH = resolve(HERE, '..', 'apollo_editor.user.js');
const ORIGIN = 'https://musicbrainz.org';
const HEADED = process.argv.includes('--headed');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '06278b3f-1b45-4355-9b1e-368c5016b831';
const LOG_DIR = resolve(HERE, 'logs', 'verify-281c');

const out = [];
const say = (...a) => { const s = a.join(' '); out.push(s); console.log('[281c]', s); };

const main = async () => {
  await mkdir(LOG_DIR, { recursive: true });
  const scriptCode = await readFile(SCRIPT_PATH, 'utf8');
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(`${ORIGIN}/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.error('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().some(m => m.tracks().length); } catch { return false; } }, null, { timeout: 120000 });
  await page.addScriptTag({ content: scriptCode });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const a = document.querySelector('#release-editor ul.ui-tabs-nav a[href="#tracklist"]'); if (a) a.click(); });
  await page.waitForSelector('.tc-discstat', { timeout: 30000 }).catch(() => {});

  // wait for the check to settle to "N links" (committed artists with a missing link)
  await page.waitForFunction(() => /tc-disc-badge/.test((document.querySelector('.tc-discstat') || {}).className || ''), null, { timeout: 60000 }).catch(() => {});

  const res = await page.evaluate(async () => {
    const ap = window.__apolloEditor; const m = ap.model;
    let target = null;
    for (const t of m.tracks) for (const s of t.slots) { if (s._discogsAddable && s.committed && s.gid) { target = s; break; } if (target) break; }
    if (!target) return { ok: false, why: 'no addable committed slot to test' };
    const url = target._discogsUrl;
    // 1) committed → addable (baseline)
    await ap.tagDiscogsAddable(target, url);
    const baseAddable = !!target._discogsAddable, baseChecked = !!target._discogsChecked;
    // 2) mark uncommitted → must NOT be addable, NOT checked
    const savedCommitted = target.committed;
    target.committed = false;
    await ap.tagDiscogsAddable(target, url);
    const offAddable = !!target._discogsAddable, offChecked = !!target._discogsChecked, urlKept = target._discogsUrl === url;
    // 3) restore committed → addable again
    target.committed = savedCommitted;
    await ap.tagDiscogsAddable(target, url);
    const onAgain = !!target._discogsAddable;
    return { ok: true, baseAddable, baseChecked, offAddable, offChecked, urlKept, onAgain };
  });
  say('result:', JSON.stringify(res));

  const pass = res.ok && res.baseAddable && res.baseChecked && res.offAddable === false && res.offChecked === false && res.urlKept === true && res.onAgain === true;
  say(pass ? 'PASS — flagged only when committed; uncommitted slot is not flagged/checked; _discogsUrl kept (create-with-link intact)'
           : 'FAIL — ' + (res.why || 'gate did not behave as expected'));
  await writeFile(resolve(LOG_DIR, 'result.txt'), out.join('\n'));
  await ctx.close();
  process.exit(pass ? 0 : 1);
};
main().catch(e => { console.error(e); process.exit(2); });
