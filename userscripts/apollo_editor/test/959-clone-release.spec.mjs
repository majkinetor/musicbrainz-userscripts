// #959: right-clicking a release's Edit tab opens a new tab with Add release seeded from that
// release (title, release group, artist, tracklist with its recordings); the release is untouched.
import { test, check, until, SANDBOX, requireLogin } from '../../../dev/test/harness.mjs';
import { apolloGm } from './ap.mjs';

const REL = '60e810ef-7ef1-4e90-8482-ab4653802786';

test.use({ gm: apolloGm(null, { xhr: 'node' }) });   // the clone's read is answered

test('right-click Edit opens Add release seeded with a copy', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${REL}`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await inject('apollo_editor', { waitFor: '__apolloEditor' });
  // ws/2 answers a burst with a rate-limit error: retry
  const src = await until(() => page.evaluate(async rel => (await fetch(`/ws/2/release/${rel}?inc=recordings+release-groups&fmt=json`)).json(), REL), j => j && j.media, { every: 1500 });
  const tracks = src.media.reduce((n, m) => n + m.tracks.length, 0);

  // Playwright's init scripts (Apollo, the GM shim) don't reach a tab window.open makes, so the
  // right-click is checked by the URL it opens, and that URL is then loaded here
  await page.evaluate(() => { window.__opened = []; window.open = (u, t) => { window.__opened.push([u, t]); return null; }; });
  await page.locator('ul.tabs a[href$="/edit"]').first().click({ button: 'right' });
  const opened = await page.evaluate(() => window.__opened);
  check(opened.length === 1 && opened[0][0].endsWith('/release/add#mbu-clone=' + REL) && opened[0][1] === '_blank', `opens one new tab on Add release with the release (${JSON.stringify(opened)})`);
  check(page.url().endsWith(REL), `the release page stays where it was (${page.url()})`);
  await page.locator('ul.tabs a[href$="/edit"]').first().click({ button: 'right', modifiers: ['Shift'] });
  check((await page.evaluate(() => window.__opened.length)) === 1, 'Shift+right-click keeps the browser menu');

  await page.goto(opened[0][0], { waitUntil: 'domcontentloaded' });
  await inject('apollo_editor');   // a manager runs it once the page is drawn; it reads the release, then posts the seed
  const rows = await until(() => page.evaluate(() => {
    const re = window.MB?.releaseEditor?.rootField?.release?.();
    if (!re) return null;
    return { name: re.name(), rg: re.releaseGroup()?.gid, tracks: re.mediums().reduce((n, m) => n + m.tracks().length, 0), recs: re.mediums().flatMap(m => m.tracks().map(t => t.recording()?.gid || '')) };
  }).catch(() => null), v => v && v.tracks > 0, { timeout: 60_000 }).catch(() => null);
  check(page.url().endsWith('/release/add'), `the tab is Add release (${page.url()})`);
  check(rows?.name === src.title, `title copied (${rows?.name} vs ${src.title})`);
  check(rows?.rg === src['release-group'].id, `release group kept (${rows?.rg})`);
  check(rows?.tracks === tracks, `all ${tracks} tracks copied (${rows?.tracks})`);
  const want = src.media.flatMap(m => m.tracks.map(t => t.recording.id));
  check(JSON.stringify(rows?.recs) === JSON.stringify(want), `each track keeps its recording (${JSON.stringify(rows?.recs)})`);
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

  const seeded = new Promise(res => page.on('request', r => { if (r.method() === 'POST' && /\/release\/add$/.test(r.url())) res(new URLSearchParams(r.postData() || '')); }));
  await page.goto(`${SANDBOX}/release/add#mbu-clone=${REL2}`, { waitUntil: 'domcontentloaded' });
  await inject('apollo_editor');
  const form = await Promise.race([seeded, new Promise(r => setTimeout(() => r(null), 60_000))]);
  const urls = form ? [...form.keys()].filter(k => /^urls\.\d+\.url$/.test(k)).map(k => [form.get(k), form.get(k.replace('.url', '.link_type'))]) : [];
  check(urls.length === 2, `both links copied (${JSON.stringify(urls)})`);
  check(urls.every(([u, t]) => (/amazon\./.test(u) ? t === '77' : /discogs\./.test(u) ? t === '76' : false)), `each link has its type: Amazon 77, Discogs 76 (${JSON.stringify(urls)})`);
});
