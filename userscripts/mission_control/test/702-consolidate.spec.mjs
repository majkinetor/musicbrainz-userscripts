// #702: consolidation of a new release. First Contact hands the album it read to Mission Control
// on /release/add#mc=<token>; Platform Check scans for it from the seed (no release yet), First
// Contact reads each platform headless (mc:read), and Mission Control seeds the release editor
// with what was taken (fc:seed). Nothing is submitted: the seed is caught before it posts.
//
// Fixture: Daft Punk, "Discovery" on Deezer (album 302127, barcode 724384960650, 14 tracks).
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

const TOKEN = 'ctest702';
const DEEZER = 'https://www.deezer.com/album/302127';

test.use({ gm: { name: 'Mission Control' } });

test('First Contact reads a platform headless, and Platform Check scans from a seed', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  test.setTimeout(240_000);
  await page.goto(`${SANDBOX}/release/add#mc=${TOKEN}`, { waitUntil: 'domcontentloaded' });
  await inject('first_contact', { waitFor: '__fcTest' });
  // a headless read: the same release an import of that page gives
  const read = await page.evaluate(url => new Promise(res => {
    document.addEventListener('mc:read-result', e => { const d = JSON.parse(e.detail); if (d.url === url) res(d); });
    document.dispatchEvent(new CustomEvent('mc:read', { detail: JSON.stringify({ url, run: 'r1' }) }));
  }), DEEZER);
  const n = read.ok ? read.rel.mediums.reduce((k, m) => k + m.tracks.length, 0) : 0;
  check(read.ok && read.provider.id === 'deezer' && n === 14, `Deezer read headless: ${read.ok ? read.rel.title + ', ' + n + ' tracks, barcode ' + read.rel.barcode : read.error}`);
  check(read.ok && read.rel.credit[0].url === 'https://www.deezer.com/artist/27', `the artist carries its Deezer link (${read.ok && read.rel.credit[0].url})`);
  const spot = await page.evaluate(url => new Promise(res => {
    document.addEventListener('mc:read-result', e => { const d = JSON.parse(e.detail); if (d.url === url) res(d); });
    document.dispatchEvent(new CustomEvent('mc:read', { detail: JSON.stringify({ url, run: 'r1' }) }));
  }), 'https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc');
  check(!spot.ok && /web player/.test(spot.error), `Spotify says why it isn't read: ${spot.error}`);

  await inject('platform_check', { waitFor: '__pcTest702' });
  check(await page.evaluate(() => window.__pcTest702.seed()), 'Platform Check is in seed mode on this page');
  const rel = read.rel;
  const found = await page.evaluate(seed => new Promise(res => {
    document.addEventListener('mc:findings', e => { const d = JSON.parse(e.detail); if (d.id === 'pc' && d.run === 's1') res(d); });
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ run: 's1', only: ['pc'], seed }) }));
  }), { barcode: rel.barcode, title: rel.title, artist: rel.credit.map(c => c.name + c.join).join(''), tracks: 14, format: 'Digital Media', year: rel.date.year, label: rel.labels[0] && rel.labels[0].name });
  const withUrl = found.findings.filter(f => f.url);
  console.log(JSON.stringify(withUrl.map(f => [f.key, f.url, f.barcode, f.tracks, f.state])));
  check(withUrl.length >= 3, `Platform Check found the album on ${withUrl.length} platform(s): ${withUrl.map(f => f.key).join(', ')}`);
  check(found.findings.every(f => f.state !== 'linked'), 'nothing is linked: there is no release yet');
});

test.describe('the consolidation page', () => {
  test.use({ gm: { name: 'Mission Control', persist: true } });

  test('Mission Control compares the platforms and seeds the release editor', { tag: ['@sandbox', '@web'] }, async ({ page, inject }, info) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    // what Consolidate stores on the platform's page: the album read, here read the same way
    await page.goto(`${SANDBOX}/release/add#mc=${TOKEN}`, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.evaluate(async ({ url, token }) => {
      const d = await new Promise(res => {
        document.addEventListener('mc:read-result', e => { const x = JSON.parse(e.detail); if (x.url === url) res(x); });
        document.dispatchEvent(new CustomEvent('mc:read', { detail: JSON.stringify({ url, run: 'prep' }) }));
      });
      GM_setValue('fc.handoff.cons.' + token, { v: 1, token, created: Date.now(), source: 'deezer', sourceName: 'Deezer', platform: d.provider, id: '302127', page: url, url: d.rel.url, rel: d.rel });
    }, { url: DEEZER, token: TOKEN });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await inject('platform_check', { waitFor: '__pcTest702' });
    await inject('mission_control', { waitFor: '__mccTest' });
    await page.waitForSelector('#mcc-root');
    check(await page.evaluate(() => !!window.__mccTest.state().src), 'Mission Control has the album First Contact stored');
    // versions: lengths chain within a second, a missing ISRC or length differs from none, case counts
    const vs = await page.evaluate(() => {
      const tr = (key, title, lengthMs, isrc) => ({ key, t: { title, lengthMs, isrc } });
      return window.__mccTest.versions({ tracks: [tr('a', 'Song', 274000, 'X1'), tr('b', 'Song', 275000, null), tr('c', 'Song', 276000, 'X1'), tr('d', 'Song', null, null), tr('e', 'SONG', 275000, 'X1'), tr('f', 'Song', 290000, 'X1')] }).map(v => v.keys.sort().join(''));
    });
    check(JSON.stringify(vs.slice().sort()) === JSON.stringify(['abcd', 'e', 'f']), `4:34, 4:35, 4:36 and a track without a length are one version; case and 4:50 are others (${vs})`);
    // Platform Check finds the others, and First Contact reads the taken ones
    const st = await until(() => page.evaluate(() => { const s = window.__mccTest.state(); return { pc: s.pc.state, n: s.sources.length, reads: s.sources.filter(x => x.take).map(x => x.key + ':' + x.read.state) }; }),
      s => s.pc === 'done' && s.reads.every(r => !/:(queued|reading|none)$/.test(r) || /^spotify/.test(r)), { timeout: 180_000 });
    console.log(JSON.stringify(st));
    const done = st.reads.filter(r => /:done$/.test(r)).length;
    check(st.pc === 'done' && st.n >= 4, `Platform Check found ${st.n - 1} other platform(s)`);
    check(done >= 3, `at least 3 platforms read and compared (${st.reads.join(', ')})`);
    await page.waitForTimeout(500);
    await info.attach('consolidation', { body: await page.screenshot(), contentType: 'image/png' });

    console.log(await page.evaluate(() => JSON.stringify(window.__mccTest.model().tracks.rows.filter(r => r.versions.length > 1).map(r => r.versions.map(v => [v.title, v.len, v.isrc, v.keys.join(',')])))));
    const m = await page.evaluate(() => { const m = window.__mccTest.model(); return { title: m.fields.title.win.val, rows: m.tracks.rows.length, differ: m.tracks.rows.filter(r => r.versions.length > 1).length, barcode: m.fields.barcode.win && m.fields.barcode.win.show }; });
    check(m.title === 'Discovery' && m.rows === 14, `title and tracklist: "${m.title}", ${m.rows} rows (${m.differ} differ)`);
    check(/724384960650$/.test(m.barcode || ''), `barcode: ${m.barcode}`);
    // a row that differs opens into its versions; a click on another takes it
    const row = page.locator('#mcc-root tr.row:has(.mcc-chip.warn)').first();
    if (await row.count()) {
      const id = await row.getAttribute('data-r');
      await row.click();
      const vers = page.locator(`#mcc-root tr.ver[data-r="${id}"]`);
      check(await vers.count() >= 2, `the row opens into its ${await vers.count()} versions`);
      check(await page.locator('#mcc-root .mcc-insp dl').count() === 1, 'and the inspector shows them');
      await info.attach('versions', { body: await page.screenshot(), contentType: 'image/png' });
      const other = vers.nth(1), k = await other.getAttribute('data-k');
      await other.click();
      const win = await page.evaluate(id => window.__mccTest.model().tracks.rows.find(r => r.id === id).win.keys, id);
      check(win.includes(k), `${k}'s version is taken by hand (${win.join(', ')})`);
    }
    // "N differ" opens every row that differs, and a second click closes them all
    if (m.differ) {
      const tog = page.locator('#mcc-root [data-cc="differ"]');
      const openRows = () => page.evaluate(() => { const m = window.__mccTest.model(); return m.tracks.rows.filter(r => r.versions.length > 1 && document.querySelector('#mcc-root tr.ver[data-r="' + r.id + '"]')).length; });
      await tog.click();
      check(await openRows() === m.differ, `the differ chip opens all ${m.differ} rows that differ`);
      await info.attach('differ-open', { body: await page.screenshot(), contentType: 'image/png' });
      await page.locator('#mcc-root [data-cc="differ"]').click();
      check(await openRows() === 0, 'and closes them all');
    }
    // a field's other value, taken by a click
    const alt = page.locator('#mcc-root .mcc-f[data-field="date"] .mcc-alt').first();
    if (await alt.count()) {
      const v = await alt.getAttribute('data-v');
      await alt.click();
      check(await page.evaluate(() => window.__mccTest.model().fields.date.win.val) === v, `the date taken by hand: ${v}`);
    }
    const rel = await page.evaluate(() => window.__mccTest.seedRel());
    check(rel.urls.length >= done, `every platform taken is linked: ${rel.urls.map(u => u.url).join(' ')}`);
    const dp = rel.credit[0];
    check(dp.url === 'https://www.deezer.com/artist/27' && (dp.alt || []).length >= 1, `Daft Punk keeps its Deezer link and carries ${(dp.alt || []).length} more: ${(dp.alt || []).map(a => a.platform.abbr + ' ' + a.url).join(' ')}`);
    const md = await page.evaluate(() => window.__mccTest.markdown());
    check(/^## Discovery: \d+ platforms compared/.test(md) && /\| Title \| Discovery/.test(md), 'Copy as Markdown has the comparison');

    // Open in release editor: First Contact posts the seed to the editor in this tab, with no
    // "leave page?" from the empty editor (it asks only after a click on the page, as here)
    const dialogs = [];
    page.on('dialog', dl => { dialogs.push(dl.type()); dl.accept(); });
    await Promise.all([page.waitForURL(/\/release\/add\?first_contact=/, { timeout: 60_000 }), page.click('#mcc-root .mcc-foot [data-cc="open"]')]);
    check(!dialogs.length, `no dialog on the way to the editor (${dialogs.join(', ') || 'none'})`);
    await page.waitForSelector('#release-editor', { timeout: 60_000 });
    const name = await page.locator('#name').inputValue();
    check(name === 'Discovery', `the release editor is seeded: "${name}"`);
    const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mc.after') || 'null'));
    check(after && after.title === 'Discovery' && after.isrcs.filter(Boolean).length >= 10, `after saving, Mission Control is to open (${after && after.isrcs.filter(Boolean).length} ISRCs noted)`);
  });
});

// After saving: the editor's tab lands on the new release, where Mission Control opens and probes.
// ISRC Scout takes the ISRCs taken in the consolidation, by track, and what wasn't ticked starts
// left out. The sandbox copy of Mocky's "Music Will Explain" has no ISRCs (680-is-adapter).
test.describe('after saving', () => {
  test.use({ gm: { name: 'Mission Control' } });
  const RELEASE = '54b7bca2-7ed6-4484-bdd3-fe35a3f33dda';

  test('the new release opens Mission Control with the consolidation\'s ISRCs', { tag: ['@sandbox', '@web', '@critical'] }, async ({ page, inject }) => {
    test.setTimeout(180_000);
    await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
    const title = (await page.locator('.releaseheader h1').textContent()).trim();
    const isrcs = ['ZZZZZ2600001', null, 'ZZZZZ2600003'];
    await page.evaluate(n => sessionStorage.setItem('mc.after', JSON.stringify(n)), { created: Date.now(), title, tracks: 3, isrcs, ticks: { is: true, as: false, pc: false } });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#content table.medium');
    await inject('isrc_scout', { waitFor: '__isTest680' });
    await inject('mission_control', { waitFor: '__mcTest' });
    await page.waitForSelector('#mc-root', { timeout: 10_000 });
    check(await page.evaluate(() => sessionStorage.getItem('mc.after') === null), 'the note is used once');
    const is = await until(() => page.evaluate(() => { const r = window.__mcTest.results().is; return r && r.state === 'done' ? r.findings.filter(f => !f.kind).map(f => [f.isrc, f.source, f.state]) : null; }), Boolean, { timeout: 150_000 });
    console.log(JSON.stringify(is));
    check(is && is[0][0] === 'ZZZZZ2600001' && is[0][1] === 'Mission Control' && is[0][2] === 'new', `track 1 takes the consolidation's ISRC (${JSON.stringify(is && is[0])})`);
    check(is && is[2][0] === 'ZZZZZ2600003' && is[2][1] === 'Mission Control', `track 3 too (${JSON.stringify(is && is[2])})`);
    check(is && is[1][1] !== 'Mission Control', `track 2, given none, is left to ISRC Scout's sources (${JSON.stringify(is && is[1])})`);
  });

  test('a note for another release is dropped', { tag: ['@sandbox'] }, async ({ page, inject }) => {
    await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.setItem('mc.after', JSON.stringify({ created: Date.now(), title: 'Zzq something else 702', tracks: 1, isrcs: [], ticks: { is: true, as: true, pc: true } })));
    await inject('mission_control', { waitFor: '__mcTest' });
    await page.waitForTimeout(800);
    check(!(await page.locator('#mc-root').count()), 'Mission Control stays shut');
    check(await page.evaluate(() => sessionStorage.getItem('mc.after') === null), 'and the note is gone');
  });
});

// The same page with String Theory, which bundles all of them: each starts only where its own
// @match does (#710), and every one this flow needs matches /release/add.
test.describe('in String Theory', () => {
  test.use({ gm: { name: 'String Theory', persist: true } });

  test('the bundle consolidates too', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
    test.setTimeout(240_000);
    await page.goto(`${SANDBOX}/release/add#mc=${TOKEN}`, { waitUntil: 'domcontentloaded' });
    await inject('first_contact', { waitFor: '__fcTest' });
    await page.evaluate(async ({ url, token }) => {
      const d = await new Promise(res => {
        document.addEventListener('mc:read-result', e => { const x = JSON.parse(e.detail); if (x.url === url) res(x); });
        document.dispatchEvent(new CustomEvent('mc:read', { detail: JSON.stringify({ url, run: 'prep' }) }));
      });
      GM_setValue('fc.handoff.cons.' + token, { v: 1, token, created: Date.now(), source: 'deezer', sourceName: 'Deezer', platform: d.provider, id: '302127', page: url, url: d.rel.url, rel: d.rel });
    }, { url: DEEZER, token: TOKEN });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await inject('string_theory', { waitFor: '__mccTest' });
    await page.waitForSelector('#mcc-root');
    const st = await until(() => page.evaluate(() => { const s = window.__mccTest.state(); return { pc: s.pc.state, done: s.sources.filter(x => x.read.state === 'done').length, busy: s.sources.some(x => /queued|reading/.test(x.read.state)) }; }),
      s => s.pc === 'done' && !s.busy, { timeout: 180_000 });
    check(st.pc === 'done' && st.done >= 3, `Platform Check found the album and First Contact read ${st.done} platform(s)`);
  });
});
