// #959: right-clicking a release's Edit tab opens a new tab straight on Add release seeded from
// that release (title, release group, artist, tracklist with its recordings, links with their
// types), never on an empty Add release first; the release is untouched.
import { test, check, until, SANDBOX, requireLogin } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

const REL = '60e810ef-7ef1-4e90-8482-ab4653802786';

test.use({ gm: apolloGm(null, { xhr: 'node' }) });   // the clone's read is answered

// right-click the Edit tab; returns the new tab and every page it loaded
async function rightClickEdit(page, rel) {
  const loads = [];
  const tabP = page.context().waitForEvent('page');
  await page.locator('ul.tabs a[href$="/edit"]').first().click({ button: 'right' });
  const tab = await tabP;
  tab.on('request', r => { if (r.isNavigationRequest()) loads.push(r.method() + ' ' + r.url()); });
  const post = await tab.waitForRequest(r => r.method() === 'POST' && /\/release\/add$/.test(r.url()), { timeout: 60_000 }).catch(() => null);
  check(page.url().endsWith(rel), `the release page stays where it was (${page.url()})`);
  return { tab, loads, form: post ? new URLSearchParams(post.postData() || '') : null };
}

test('right-click Edit opens Add release seeded with a copy', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  // ws/2 answers a burst with a rate-limit error: retry
  const src = await until(() => page.evaluate(async rel => (await fetch(`/ws/2/release/${rel}?inc=recordings+release-groups&fmt=json`)).json(), REL), j => j && j.media, { every: 1500 });
  const tracks = src.media.reduce((n, m) => n + m.tracks.length, 0);

  await page.evaluate(() => { window.__opened = 0; const o = window.open; window.open = (...a) => { window.__opened++; return o.apply(window, a); }; });
  await page.locator('ul.tabs a[href$="/edit"]').first().click({ button: 'right', modifiers: ['Shift'] });
  check((await page.evaluate(() => window.__opened)) === 0, 'Shift+right-click keeps the browser menu');

  const { tab, loads, form } = await rightClickEdit(page, REL);
  check(!!form, 'the seed is posted into the new tab');
  const rows = await until(() => tab.evaluate(() => {
    const re = window.MB?.releaseEditor?.rootField?.release?.();
    if (!re) return null;
    return { name: re.name(), rg: re.releaseGroup()?.gid, tracks: re.mediums().reduce((n, m) => n + m.tracks().length, 0), recs: re.mediums().flatMap(m => m.tracks().map(t => t.recording()?.gid || '')) };
  }).catch(() => null), v => v && v.tracks > 0, { timeout: 60_000 }).catch(() => null);
  check(tab.url().endsWith('/release/add'), `the tab is Add release (${tab.url()})`);
  check(!loads.some(l => /^GET .*\/release\/add/.test(l)), `no empty Add release first (${JSON.stringify(loads)})`);
  check(rows?.name === src.title, `title copied (${rows?.name} vs ${src.title})`);
  check(rows?.rg === src['release-group'].id, `release group kept (${rows?.rg})`);
  check(rows?.tracks === tracks, `all ${tracks} tracks copied (${rows?.tracks})`);
  const want = src.media.flatMap(m => m.tracks.map(t => t.recording.id));
  check(JSON.stringify(rows?.recs) === JSON.stringify(want), `each track keeps its recording (${JSON.stringify(rows?.recs)})`);
  await tab.close();
});

test('the copy keeps each link with its type; the Edit tooltip names the right-click', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const REL2 = 'ecd965f4-f75f-4360-9dde-26f31dc44f46';   // Abbey Road on test: an Amazon and a Discogs link
  await page.goto(`${SANDBOX}/release/${REL2}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  const edit = page.locator('ul.tabs a[href$="/edit"]').first();
  await edit.hover();
  const tip = await edit.getAttribute('data-tip');
  check(/Right-click: clone/.test(tip || ''), `the Edit tab's tooltip names the right-click (${tip})`);

  const { tab, form } = await rightClickEdit(page, REL2);
  const urls = form ? [...form.keys()].filter(k => /^urls\.\d+\.url$/.test(k)).map(k => [form.get(k), form.get(k.replace('.url', '.link_type'))]) : [];
  check(urls.length === 2, `both links copied (${JSON.stringify(urls)})`);
  check(urls.every(([u, t]) => (/amazon\./.test(u) ? t === '77' : /discogs\./.test(u) ? t === '76' : false)), `each link has its type: Amazon 77, Discogs 76 (${JSON.stringify(urls)})`);
  await tab.close();
});
