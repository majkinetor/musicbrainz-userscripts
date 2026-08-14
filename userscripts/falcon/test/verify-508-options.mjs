// #508 (majkinetor): "Add standard options screen like on other scripts and
// move [?] and version to it. Then add: 1. Hide MB icon 2. Add covers only
// when there aren't any." Matches the reference pattern (Apollo/Art Station:
// icon+name+version+Help), adapted to Falcon's own tab-based panel instead of
// a popup — a new "Options" (⚙) tab holds that header plus the two toggles.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const errs = []; const page = ctx.pages()[0] || await ctx.newPage();
page.on('pageerror', e => errs.push(e.message));
await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 5000 });

// 1. version + Help are OUT of the main header.
const hdr = await page.evaluate(() => document.getElementById('falcon-hdr').textContent);
console.log('main header text:', JSON.stringify(hdr));
ck(!/v\d/.test(hdr), `no version string in the main header (got "${hdr}")`);
const helpInHdr = await page.evaluate(() => !!document.querySelector('#falcon-hdr a[href*="README"]'));
ck(!helpInHdr, 'the ? Help link is not in the main header');

// 2. Options tab exists and opens.
await page.click('#falcon-tab-options');
await page.waitForTimeout(150);
const optionsVisible = await page.evaluate(() => getComputedStyle(document.getElementById('falcon-body-options')).display !== 'none');
ck(optionsVisible, 'Options tab opens');

// 3. it carries the standard icon+name+version+Help header.
const optHdrText = await page.evaluate(() => document.getElementById('falcon-body-options').textContent);
console.log('options tab text:', JSON.stringify(optHdrText.slice(0, 80)));
ck(/Falcon/.test(optHdrText) && /v\S/.test(optHdrText), `Options tab shows name + version (got "${optHdrText.slice(0, 60)}")`);
const helpInOptions = await page.evaluate(() => !!document.querySelector('#falcon-body-options a[href*="README"]'));
ck(helpInOptions, 'the ? Help link moved into the Options tab');

// 4. "Hide Falcon icon" toggle — hides/shows the launcher live, persists via GM storage.
const launcherVisibleBefore = await page.evaluate(() => !!document.getElementById('falcon-launcher'));
ck(launcherVisibleBefore, 'launcher icon exists before toggling the option');
await page.click('#falcon-opt-hide-launcher');
await page.waitForTimeout(150);
const launcherGone = await page.evaluate(() => !document.getElementById('falcon-launcher'));
ck(launcherGone, 'checking "Hide Falcon icon" removes the launcher immediately, live');
const persisted = await page.evaluate(() => window.GM_getValue('falcon:hideLauncher', false));
ck(persisted === true, `the choice is persisted via GM storage (got ${persisted})`);
// Ctrl+Alt+F must still reach the panel even with the icon hidden.
await page.evaluate(() => { document.getElementById('falcon-close').click(); });
await page.waitForTimeout(150);
await page.keyboard.press('Control+Alt+F');
await page.waitForTimeout(200);
const panelReopened = await page.evaluate(() => document.getElementById('falcon-panel')?.style.display !== 'none');
ck(panelReopened, 'Ctrl+Alt+F still opens the panel with the launcher icon hidden');
// toggle back off — launcher must reappear live too.
await page.click('#falcon-tab-options');
await page.click('#falcon-opt-hide-launcher');
await page.waitForTimeout(150);
const launcherBack = await page.evaluate(() => !!document.getElementById('falcon-launcher'));
ck(launcherBack, 'unchecking "Hide Falcon icon" brings the launcher back immediately, live');

// 5. "Add covers only when there aren't any" — persists, and runCoverItem
// actually skips (not fails) when the release already has cover art.
await page.click('#falcon-opt-cover-only-if-none');
await page.waitForTimeout(150);
const coverOnlyPersisted = await page.evaluate(() => window.GM_getValue('falcon:coverOnlyIfNone', false));
ck(coverOnlyPersisted === true, `"Add covers only when there aren't any" persists via GM storage (got ${coverOnlyPersisted})`);

const skipResult = await page.evaluate(async () => {
  const item = { mbid: 'aaaaaaaa-5080-0000-0000-000000000000', note: '', coverExistingCount: 2, cover: [{ url: 'https://musicbrainz.org/should-not-be-fetched.jpg', comment: '', type: 'Front', candidates: [] }] };
  await window.__falconTest.runCoverItem(item, '[test]', { querySelector: () => null, dataset: {} });
  return { status: item.status, error: item.error };
});
console.log('skip-when-existing result:', JSON.stringify(skipResult));
ck(skipResult.status === 'skipped', `an item for a release that already has covers is marked skipped, not done/failed (got "${skipResult.status}")`);
ck(skipResult.error === '', `no error — this is an intentional skip (got "${skipResult.error}")`);

// with the option OFF, the same release (existing covers) still gets a real upload attempt.
await page.click('#falcon-tab-options');
await page.click('#falcon-opt-cover-only-if-none');
await page.waitForTimeout(150);
const attemptResult = await page.evaluate(async () => {
  const item = { mbid: 'aaaaaaaa-5080-0000-0000-000000000000', note: '', coverExistingCount: 2, cover: [{ url: 'https://musicbrainz.org/still-should-fail-fast.jpg', comment: '', type: 'Front', candidates: [] }] };
  await window.__falconTest.runCoverItem(item, '[test]', { querySelector: () => null, dataset: {} });
  return { status: item.status };
});
console.log('option-off result:', JSON.stringify(attemptResult));
ck(attemptResult.status !== 'skipped', `with the option off, an existing-cover release is NOT auto-skipped (got "${attemptResult.status}")`);

// 6. majkinetor follow-up: "Lets move workers to options." — the worker-count
// stepper moves out of the always-visible queue footer into Options.
const workerNotInFooter = await page.evaluate(() => !document.querySelector('#falcon-queue-bottom #falcon-worker-count'));
ck(workerNotInFooter, 'the worker-count control is no longer in the queue footer');
await page.click('#falcon-tab-options');
await page.waitForTimeout(150);
const workerInOptions = await page.evaluate(() => !!document.querySelector('#falcon-body-options #falcon-worker-count'));
ck(workerInOptions, 'the worker-count control now lives in the Options tab');
const workerVal = await page.evaluate(() => document.getElementById('falcon-worker-count').value);
ck(String(+workerVal) === workerVal && +workerVal > 0, `worker-count still shows a real value after relocating (got "${workerVal}")`);
await page.fill('#falcon-worker-count', '3');
await page.dispatchEvent('#falcon-worker-count', 'change');
await page.waitForTimeout(100);
const workersPersisted = await page.evaluate(() => window.__falconTest.cfg.workers);
ck(workersPersisted === '3' || workersPersisted === 3, `changing it in its new home still updates cfg.workers (got ${JSON.stringify(workersPersisted)})`);

// 7. majkinetor follow-up: "make window resizable."
const resizeCss = await page.evaluate(() => getComputedStyle(document.getElementById('falcon-panel')).resize);
ck(resizeCss === 'both', `the panel has a native resize handle (got resize:${resizeCss})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
