// The right-click background add, end to end — the part a stubbed test can't prove.
//
// #464, #556: right-click + opens the release editor in a background tab; Platform Check
//   fills it, submits, and the tab closes once the edit is in; the opener reloads. The
//   edit tab runs as a background tab does (#556 was a hidden-tab bug): hidden, no
//   animation frames, timers held to a second. The link is then read back from the
//   release: landing in the form is not proof, landing in the database is.
// #556 (majkinetor): "how am I supposed to fetch this log if both original and new tab
//   gets killed" — the add's timeline reaches the opener's Log, and survives its reload.
// #559: the Discogs master goes onto the release GROUP the same way.
//
// test.musicbrainz.org, logged in. This SUBMITS real edits there, each test to a pristine
// release of its own, made for the run (#795). Platform Check runs in every tab, as a manager
// runs it (from once the release is made).
import { test, check, requireLogin, sourceOf, mbJson, SANDBOX, pristine } from '../../../dev/test/harness.mjs';
import { readFile } from 'node:fs/promises';

test.use({ gm: { name: 'Platform Check', xhr: 'none' } });

// Platform Check in every tab (at document-end), each edit tab in the background, and
// GM_openInTab opening a real tab whose handle the opener can close. Returns what the
// opened tabs say in their consoles.
async function everyTab(context) {
  const code = await readFile(sourceOf('platform_check'), 'utf8');
  // a tab of its own, as a manager opens one: not a window.open popup, which keeps its
  // first (about:blank) window as it navigates and so never runs a script again
  const tabs = [], said = [];
  await context.exposeBinding('__openTab', async (_src, url) => {
    const p = await context.newPage();
    tabs.push(p);
    p.on('console', m => said.push(m.text()));
    p.goto(url).catch(() => {});
    return tabs.length - 1;
  });
  await context.exposeBinding('__closeTab', async (_src, i) => { await tabs[i].close().catch(() => {}); });
  await context.addInitScript(() => {
    if (/\/edit(\?|#|$)/.test(location.href)) {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      window.requestAnimationFrame = () => 0;
      const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
      window.setTimeout = (fn, d, ...a) => st(fn, Math.max(Number(d) || 0, 1000), ...a);
      window.setInterval = (fn, d, ...a) => si(fn, Math.max(Number(d) || 0, 1000), ...a);
      console.log('[test] an edit tab, hidden: ' + document.hidden);
    }
    window.GM_openInTab = url => {
      const i = window.__openTab(url);
      let closed = false;
      return { get closed() { return closed; }, close() { closed = true; sessionStorage.setItem('__closedByOpener', '1'); i.then(n => window.__closeTab(n)); } };
    };
  });
  await context.addInitScript({ content: `document.addEventListener('DOMContentLoaded', () => {\n${code}\n}, { once: true });` });
  return said;
}
// a release's (or group's) links, read back from the sandbox
const linksOf = async (kind, mbid) => {
  const j = await mbJson(`${SANDBOX}/ws/2/${kind}/${mbid}?inc=url-rels&fmt=json`);
  return (j.relations || []).map(r => r.url && r.url.resource).filter(Boolean);
};
const until = async (cond, ms) => { for (const t0 = Date.now(); Date.now() - t0 < ms && !cond(); ) await new Promise(r => setTimeout(r, 250)); return cond(); };
const hiddenEditTab = said => until(() => said.some(l => /an edit tab, hidden: true/.test(l)), 30000);

test('#464, #556: a background add lands on the release, closes its tab, and leaves its log', { tag: ['@sandbox', '@login', '@critical'] }, async ({ page, context }) => {
  const { mbid: REL, releaseGroup: RG } = await pristine(page, 'release');
  const said = await everyTab(context);
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForFunction(() => !!window.__pcTest464, null, { timeout: 30000 });
  const url = `https://www.deezer.com/album/${1e9 + Date.now() % 1e9}`;   // a new one each run
  check(!(await linksOf('release', REL)).includes(url), 'the link is not on the release yet');
  await page.evaluate(([id, u]) => { localStorage.removeItem('pc:bg-log'); localStorage.setItem('pc:pending:' + id, JSON.stringify({ deezer: u })); }, [REL, url]);

  const opened = context.waitForEvent('page', { timeout: 30000 });
  await page.evaluate(() => { window.__beforeTheAdd = true; });   // gone once the opener reloads
  await page.evaluate(id => window.__pcTest464.openReleaseEditTab(id, { background: true }), REL);
  const tab = await opened;
  check(await hiddenEditTab(said), 'a hidden background tab opens the editor');
  check(await until(() => tab.isClosed(), 120000), 'it submits and is closed');
  let reloaded = false;
  for (const t0 = Date.now(); !reloaded && Date.now() - t0 < 30000; await new Promise(r => setTimeout(r, 500))) {
    reloaded = await page.evaluate(() => !window.__beforeTheAdd && document.readyState !== 'loading').catch(() => false);
  }
  check(reloaded, 'the opener reloads');
  await page.waitForLoadState('domcontentloaded');
  check((await page.evaluate(() => sessionStorage.getItem('__closedByOpener'))) === '1', 'the opener closed it, through its GM_openInTab handle');
  check((await linksOf('release', REL)).includes(url), `the link is on the release now (${url})`);

  await page.waitForFunction(() => /background add/.test(window.__pcLog ? window.__pcLog.messages().join('\n') : ''), null, { timeout: 30000 }).catch(() => {});
  const log = await page.evaluate(() => window.__pcLog ? window.__pcLog.messages().join('\n') : '');
  check(/Enter edit clicked/.test(log) && /edit committed/.test(log), "the add's timeline, written in the tab that closed, is in the reloaded opener's Log");
  check((log.match(/Enter edit clicked/g) || []).length === 1, 'each entry once');
});

test('#559: the Discogs master lands on the release group, in the background', { tag: ['@sandbox', '@login'] }, async ({ page, context }) => {
  const { mbid: REL, releaseGroup: RG } = await pristine(page, 'release');
  const said = await everyTab(context);
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForFunction(() => !!window.__pcTest464, null, { timeout: 30000 });
  const master = `https://www.discogs.com/master/${900000 + Date.now() % 99999}`;
  check(!(await linksOf('release-group', RG)).includes(master), 'the master is not on the group yet');
  await page.evaluate(([rg, m]) => localStorage.setItem('pc:pending:rg:' + rg, JSON.stringify({ 'discogs-master': m })), [RG, master]);

  const opened = context.waitForEvent('page', { timeout: 30000 });
  await page.evaluate(rg => window.__pcTest464.openRgEditTab(rg, { background: true }), RG);
  const tab = await opened;
  check(await hiddenEditTab(said), 'a hidden background tab opens the release-group editor');
  check(await until(() => tab.isClosed(), 120000), 'it submits and is closed');
  check((await linksOf('release-group', RG)).includes(master), `the master is on the release group now (${master})`);
});

// #780: a barcode from the found-barcodes list, right-clicked: the release editor fills the barcode alone
// (a link queued for the release stays out, and stays queued), submits, and closes.
const gtin = core => core + String((10 - [...core].reverse().reduce((a, d, i) => a + Number(d) * (i % 2 ? 1 : 3), 0) % 10) % 10);
const barcodeOf = async rel => (await mbJson(`${SANDBOX}/ws/2/release/${rel}?fmt=json`)).barcode;
test('#780: a barcode alone lands on the release, in the background', { tag: ['@sandbox', '@login'] }, async ({ page, context }) => {
  const { mbid: REL, releaseGroup: RG } = await pristine(page, 'release');
  const said = await everyTab(context);
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await page.waitForFunction(() => !!window.__pcTest464, null, { timeout: 30000 });
  check(!(await barcodeOf(REL)), 'the release has no barcode yet');
  const code = gtin('5' + String(Date.now()).slice(-11));   // a new one each run
  const url = `https://www.deezer.com/album/${1e9 + Date.now() % 1e9}`;
  await page.evaluate(([id, c, u]) => {
    localStorage.setItem('pc:bg-barcode:' + id, JSON.stringify({ code: c, from: 'reported by Deezer' }));
    localStorage.setItem('pc:pending:' + id, JSON.stringify({ deezer: u }));
  }, [REL, code, url]);

  const opened = context.waitForEvent('page', { timeout: 30000 });
  await page.evaluate(() => { window.__beforeTheAdd = true; });   // gone once the opener reloads
  await page.evaluate(id => window.__pcTest464.openReleaseEditTab(id, { background: true, hash: '#pc-autocommit-pc-barcode' }), REL);
  const tab = await opened;
  check(await hiddenEditTab(said), 'a hidden background tab opens the editor');
  check(await until(() => tab.isClosed(), 120000), 'it submits and is closed');
  check((await barcodeOf(REL)) === code, `the barcode is on the release now (${code})`);
  check(!(await linksOf('release', REL)).includes(url), 'the queued link is not');
  let reloaded = false;
  for (const t0 = Date.now(); !reloaded && Date.now() - t0 < 30000; await new Promise(r => setTimeout(r, 500))) {
    reloaded = await page.evaluate(() => !window.__beforeTheAdd && document.readyState !== 'loading').catch(() => false);
  }
  check(reloaded, 'the opener reloads');
  const left = await page.evaluate(id => ({ bc: localStorage.getItem('pc:bg-barcode:' + id), links: localStorage.getItem('pc:pending:' + id) }), REL);
  check(!left.bc && (left.links || '').includes(url), `the barcode is consumed, the link still queued (${JSON.stringify(left)})`);
  await page.evaluate(id => localStorage.removeItem('pc:pending:' + id), REL);
});
