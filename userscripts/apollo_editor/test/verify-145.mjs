// #145 — toggling the Apollo/Original editor then visiting a tab must not flash the stale UI.
// The takeover was only re-applied by a 500ms watcher; now a tab-nav click re-applies it on the next
// animation frame (before paint). This probe creates a genuinely stale tab state, clicks the tab, and
// samples the DOM frame-by-frame. The discriminating, release-agnostic signal is the Apollo mirror's
// presence: it must already be correct on frame 1 (the hook's rAF) — far under the old 500ms window.
//
//   Sc-A: Apollo ON, on Recordings -> toggle OFF -> visit Tracklist.  Stale Apollo mirror must vanish.
//   Sc-B: Apollo OFF, on Recordings -> toggle ON  -> visit Tracklist.  Mirror must mount immediately.
//
// Point SCRIPT at the pre-fix file to see the regression (mirror lingers wrong for several frames).
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE = resolve(HERE, '..', '..', '..', '.pw-profile');
const SCRIPT = process.env.SCRIPT || resolve(HERE, '..', 'apollo_editor.user.js');
const MBID = process.argv.find(a => /^[a-f0-9-]{36}$/.test(a)) || '60e810ef-7ef1-4e90-8482-ab4653802786';
const HEADED = process.argv.includes('--headed');

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: !HEADED, viewport: { width: 1500, height: 1000 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
if (page.url().includes('/login')) { console.error('not logged in'); await ctx.close(); process.exit(3); }
await page.waitForFunction(() => { try { return window.MB.releaseEditor.rootField.release().mediums().length > 0; } catch { return false; } }, null, { timeout: 60000 });
await page.addScriptTag({ content: await readFile(SCRIPT, 'utf8') });
await page.waitForTimeout(1200);

await page.evaluate(() => {
  window.__t = {
    clickTab: key => { const a = document.querySelector(`#release-editor ul.ui-tabs-nav a[href="#${key}"]`); if (a) a.click(); },
    apolloOn: () => window.__apolloEditor.apolloOn,
    toggle: () => document.querySelector('#tc-launch .tc-launch-lbl').click(),
    state: () => ({ mirror: !!document.getElementById('tc-mirror-wrap'), recOn: document.body.classList.contains('tc-rec-on'), apolloOn: window.__apolloEditor.apolloOn }),
    // click `key`, then sample mirror presence once per animation frame for `frames` frames
    clickAndSample: (key, frames) => new Promise(res => {
      const samples = [];
      document.querySelector(`#release-editor ul.ui-tabs-nav a[href="#${key}"]`).click();
      let i = 0;
      const step = () => { samples.push({ frame: i, mirror: !!document.getElementById('tc-mirror-wrap') }); if (++i > frames) return res(samples); requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }),
  };
});

const ensureOn = async on => { const cur = await page.evaluate(() => window.__t.apolloOn()); if (cur !== on) { await page.evaluate(() => window.__t.toggle()); await page.waitForTimeout(600); } };

// ── Sc-A: stale Apollo mirror on Tracklist after toggling editor OFF ──
await ensureOn(true);
await page.evaluate(() => window.__t.clickTab('recordings')); await page.waitForTimeout(700);
await page.evaluate(() => window.__t.toggle());                                  // Apollo -> Original (Tracklist now holds a stale mirror)
await page.waitForTimeout(50);                                                   // shorter than the 500ms watcher
const preA = await page.evaluate(() => window.__t.state());
const A = await page.evaluate(() => window.__t.clickAndSample('tracklist', 8));

// ── Sc-B: missing mirror on Tracklist after toggling editor ON ──
await ensureOn(false);
await page.evaluate(() => window.__t.clickTab('recordings')); await page.waitForTimeout(700);
await page.evaluate(() => window.__t.toggle());                                  // Original -> Apollo (Tracklist has no mirror yet)
await page.waitForTimeout(50);
const preB = await page.evaluate(() => window.__t.state());
const B = await page.evaluate(() => window.__t.clickAndSample('tracklist', 8));

console.log('Sc-A pre (toggled OFF on rec):', JSON.stringify(preA));
console.log('Sc-A frames (visit tracklist):', JSON.stringify(A));
console.log('Sc-B pre (toggled ON on rec): ', JSON.stringify(preB));
console.log('Sc-B frames (visit tracklist):', JSON.stringify(B));

const f1A = A[1] || A[0], f1B = B[1] || B[0];
// Sc-A: editor is Original -> the stale Apollo mirror must be gone by frame 1.
// Sc-B: editor is Apollo  -> the mirror must be mounted by frame 1.
const pass = preA.mirror === true && f1A.mirror === false &&
             preB.mirror === false && f1B.mirror === true;
console.log(pass ? 'PASS' : 'FAIL');
if (!HEADED) await ctx.close();
process.exit(pass ? 0 : 1);
