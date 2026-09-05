// #572 (majkinetor): "Falcon should be able to seed from RG and release series.
// … I would like to change names (#571) of included RGs in bulk so they conform
// to the standard."
//
// Runs against the real sandbox series (the same MBID exists on production and
// test), so it exercises the actual API shape rather than a stub — a series'
// membership is expressed as RELATIONSHIPS, and there is no browse endpoint for
// it, which is the one thing about this that had to be got right.
//
// Counts are deliberately NOT hardcoded: the sandbox carries 15 members where
// production has 12, and a test that pinned the number would fail for a reason
// that has nothing to do with Falcon.
//
// Nothing is submitted: every POST is aborted, and counted.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const code = await readFile('C:/Work/mb-userscripts/userscripts/falcon/falcon.user.js', 'utf8');

const HOST = 'https://test.musicbrainz.org';
const SERIES = '5d225177-9e66-4956-9602-11d3076d604d';   // "Movements (Compiled By Tobias Kirmayer)", a release-group series
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 950 } });
await ctx.addInitScript(() => {
  const s = new Map();
  window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
  window.GM_setValue = (k, v) => s.set(k, v);
  window.GM_deleteValue = k => s.delete(k);
  window.GM_info = { script: { name: 'Falcon', version: 't' } };
});
const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));

let posts = [];
await page.route(() => true, route => {
  const r = route.request();
  if (r.method() === 'POST') { posts.push(r.url()); return route.abort(); }
  return route.continue();
});

for (let a = 1; ; a++) {
  try { await page.goto(`${HOST}/series/${SERIES}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
  catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
}
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(1200);
await page.addScriptTag({ content: code });
await page.waitForTimeout(600);

// ── a series page is a place Falcon can seed from ───────────────────────────
const pctx = await page.evaluate(() => window.__falconTest.pageEntityContext());
console.log('pageEntityContext: ' + JSON.stringify(pctx));
ck(pctx && pctx.kind === 'series' && pctx.mbid === '5d225177-9e66-4956-9602-11d3076d604d', 'a /series/<mbid> page is recognised');

// ── membership comes back from the relationships, in the series' own order ──
const info = await page.evaluate(m => window.__falconTest.fetchSeriesMembers(m), SERIES);
console.log(`series "${info.name}" (${info.type}) — ${info.members.length} member(s)`);
console.log('  first 3: ' + JSON.stringify(info.members.slice(0, 3)));
ck(info.type === 'Release group series', 'its type is read (Release group series)');
ck(info.members.length > 0, `its members are read (${info.members.length})`);
ck(info.members.every(m => m.entityType === 'release_group'), 'every member of a release-group series is a release group');
ck(info.members.every(m => m.mbid && m.name), 'each carries an mbid and a name, so no row needs a follow-up name lookup');
const keys = info.members.map(m => m.orderingKey);
ck(keys.every((k, i) => i === 0 || keys[i - 1] <= k), 'rows arrive in the series\' own ordering, not MB\'s relation order');

// ── the button offers it ────────────────────────────────────────────────────
await page.click('#falcon-launcher');
await page.waitForSelector('#falcon-panel', { timeout: 15000 });
await page.waitForTimeout(400);
const btnVisible = await page.isVisible('#falcon-add-page');
const btnLabel = (await page.textContent('#falcon-add-page .falcon-bt') || '').trim();
console.log('add button: visible=' + btnVisible + ' label=' + JSON.stringify(btnLabel));
ck(btnVisible, 'the "Add from" button is offered on a series page');
ck(btnLabel === 'Add from series', 'and names the series (got "' + btnLabel + '")');

await page.click('#falcon-add-page');
await page.waitForSelector('.falcon-addmenu', { timeout: 30000 });
const menuText = (await page.textContent('.falcon-addmenu') || '').replace(/\s+/g, ' ').trim();
console.log('menu: ' + menuText);
ck(/Release groups/.test(menuText), 'the menu offers the release groups');
ck(new RegExp('\\(' + info.members.length + '\\)').test(menuText), `and says how many there are (${info.members.length})`);
ck(/Releases/.test(menuText), 'plus the option to pull in all their releases');

// ── adding them fills the queue ─────────────────────────────────────────────
await page.click('.falcon-addmenu [data-a="ok"]');
await page.waitForFunction(() => window.__falconTest.getQueue().length > 0, null, { timeout: 120000 });
await page.waitForTimeout(500);
const queue = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ t: i.entityType, mbid: i.mbid, name: i.name, rename: i.rename, status: i.status })));
console.log(`queued ${queue.length} row(s); first: ` + JSON.stringify(queue[0]));
ck(queue.length === info.members.length, `every member is queued (${queue.length}/${info.members.length})`);
ck(queue.every(i => i.t === 'release_group'), 'all as release groups');
ck(queue.every(i => !!i.name), 'each row already knows its name');
ck(queue.every(i => !i.rename), 'and none of them has a rename yet — adding is not editing');

// ── #571 meets #572: those rows can be renamed ──────────────────────────────
await page.click('#falcon-expand-all');
await page.waitForTimeout(600);
const renameBoxes = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.falcon-rename-input')];
  return { count: els.length, firstValue: els[0] && els[0].value };
});
console.log('rename boxes: ' + JSON.stringify(renameBoxes));
ck(renameBoxes.count === queue.length, 'every queued release group offers a rename box');
ck(renameBoxes.firstValue === queue[0].name, 'prefilled with the current name, so conforming it to a standard is an edit, not a retype');

// MB's own pages POST to Sentry; that is not evidence of anything here. What
// must be zero is a POST at an EDIT endpoint.
const editPosts = posts.filter(u => /test\.musicbrainz\.org\/(ws\/js\/edit\/|.*\/edit)/.test(u));
console.log('POSTs seen: ' + JSON.stringify(posts));
ck(editPosts.length === 0, `nothing was submitted (${editPosts.length} edit POST(s) of ${posts.length} total)`);
ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
await ctx.close();
console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
