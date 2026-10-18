// #727: what a consolidation brings to a release MusicBrainz already has, which since #782 the release's own
// comparison with the platforms gives Platform Check (cons; here through Mission Control's test hook). Platform
// Check offers what the release lacks: the consolidation's barcode, a catalog number for a label the release has (matched by
// name: "Artoffact" is "Artoffact Records"), a label the release hasn't once it is one MusicBrainz label (here
// by its MBID), the platforms' links it took in, a release event and the lengths of its tracks (#782). A label MusicBrainz hasn't is left out. Execute hands them to Falcon on one release item; a stand-in
// Falcon records it (Falcon's real run: falcon/test/live-727-catno-proof).
import { test, check, until, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Mission Control' } });

const RELEASE = '9d290316-dcd3-4d7e-a62b-392ab2396f27';     // "Rushing Pictures": label Artoffact Records, no catalog number, no barcode
const ARTOFFACT = '25364892-b3e9-4692-bcbe-018fc26b9256';
const METROPOLIS = '55305fee-ba51-4dd5-afee-73c242b8046b';  // a sandbox label the release hasn't
const DEEZER = 'https://www.deezer.com/album/727727727';

test('#727: a consolidation brings its barcode, catalog number and links to a release MusicBrainz has', { tag: ['@sandbox', '@web', '@critical'] }, async ({ page, inject }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  const cons = {
    barcode: '4006381333931',
    labels: [{ name: 'Artoffact', mbid: null, catno: 'AOF 727' }, { name: 'Metropolis Records', mbid: METROPOLIS, catno: 'MET 727' }, { name: 'Zqx No Such Label 727', mbid: null, catno: 'SOL 1' }],
    urls: [{ key: 'deezer', url: DEEZER }],
    from: ['Beatport', 'Deezer'],
    event: { date: { year: 2008, month: 8, day: 29 }, country: 'XW', countryName: '[Worldwide]', why: 'the date from Deezer' },
    lengths: [{ medium: 1, position: 1, ms: 241000 }, { medium: 1, position: 2, ms: 302000 }],
  };
  await inject('platform_check', { waitFor: '__pcTest680' });
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.click('#mc-launch');
  await page.waitForSelector('#mc-root', { timeout: 10_000 });
  await until(() => page.evaluate(() => (window.__mcTest.results().pc || {}).state), st => st === 'done', { timeout: 200_000 });
  await page.evaluate(c => window.__mcTest.withCons(c), cons);
  const fs = await until(() => page.evaluate(() => { const r = window.__mcTest.results().pc; return r && r.state === 'done' && r.findings.some(f => f.cons) ? r.findings : null; }), Boolean, { timeout: 200_000 });
  check(!!fs, 'Platform Check answered the probe');
  if (!fs) return;
  const catnos = fs.filter(f => f.kind === 'catno' && f.cons), bc = fs.filter(f => f.kind === 'barcode'), dz = fs.find(f => f.key === 'deezer');
  console.log(JSON.stringify({ catnos, bc, dz }));
  check(catnos.length === 1 && catnos[0].key === `catno:${ARTOFFACT}:AOF 727` && catnos[0].state === 'new' && catnos[0].label.name === 'Artoffact Records',
    `the catalog number goes to the release's own Artoffact Records (${JSON.stringify(catnos)})`);
  const adds = fs.filter(f => f.kind === 'label');
  check(adds.length === 1 && adds[0].key === `label:${METROPOLIS}:MET 727` && adds[0].state === 'new' && adds[0].label.name === 'Metropolis Records', `a label the release hasn't is added, with its catalog number (${JSON.stringify(adds)})`);
  check(!catnos.concat(adds).some(f => f.code === 'SOL 1'), 'a label MusicBrainz hasn\'t is left out');
  // by its name alone: only when exactly one MusicBrainz label has it (the sandbox has three Metropolis Records)
  const byName = await page.evaluate(async () => [await window.__pcTest680.pcResolveLabel({ name: 'Metropolis Records' }), await window.__pcTest680.pcResolveLabel({ name: 'Artoffact Records' })]);
  check(byName[0] === null && byName[1] && byName[1].mbid === ARTOFFACT && byName[1].via === 'name', `a name several labels have finds none; a unique one finds it (${JSON.stringify(byName)})`);
  const cb = bc.find(f => f.code === cons.barcode);
  check(cb && cb.state === 'new' && bc.filter(f => f.state === 'new').length === 1, `the consolidation's barcode is taken in, alone (${JSON.stringify(bc.map(f => [f.code, f.state]))})`);
  check(dz && (dz.state === 'linked' || (dz.url === DEEZER && dz.state === 'new')), `the consolidation's Deezer link is offered (${JSON.stringify(dz)})`);
  const ev = fs.find(f => f.kind === 'event'), ln = fs.find(f => f.kind === 'lengths');
  check(ev && ev.key === 'event:2008-08-29:XW' && ev.state === 'new' && ev.code === '2008-08-29 [Worldwide]', `the release event is a finding (${JSON.stringify(ev)})`);
  check(ln && ln.key === 'lengths:2' && ln.state === 'new' && ln.code === '2 tracks', `so are the track lengths (${JSON.stringify(ln)})`);
  const pk = await page.evaluate(() => window.__mcTest.picked().pc);
  check(pk.includes(`catno:${ARTOFFACT}:AOF 727`) && pk.includes(`label:${METROPOLIS}:MET 727`) && pk.includes('barcode:' + cons.barcode), `they start taken in (${pk})`);

  const card = page.locator('#mc-root [data-card="pc"]');
  check(await card.locator('.mc-line:has-text("Label Metropolis Records")').count() === 1, 'the label to add is a row too');
  const row = card.locator('.mc-line:has(.mc-bcn:text("AOF 727"))');
  check(await row.count() === 1, 'the catalog number is a row in the Release section');
  const txt = (await row.textContent()).replace(/\s+/g, ' ');
  check(/Cat\. no\. AOF 727 · Artoffact Records/.test(txt) && /consolidated by Mission Control from Beatport, Deezer/.test(txt) && /as "Artoffact"/.test(txt), `it names the label and where it came from (${txt})`);
  await info.attach('catno-row', { body: await page.locator('#mc-root .mc-sect:has([data-card="pc"])').screenshot(), contentType: 'image/png' });

  // Execute: one release item with the barcode, the catalog number and the link, and PC's edit note says so
  await page.evaluate(() => {
    window.__falconGot = [];
    for (const ev of ['falcon:run', 'falcon:import']) document.addEventListener(ev, e => { window.__falconGot.push({ ev, json: JSON.parse(e.detail) }); document.dispatchEvent(new CustomEvent('falcon:import-ok')); });
  });
  await page.click('#mc-root [data-act="exec"]');
  await page.waitForFunction(() => window.__falconGot.some(g => g.ev === 'falcon:run'), null, { timeout: 30_000 });
  const run = await page.evaluate(() => window.__falconGot.find(g => g.ev === 'falcon:run').json);
  const item = run.items.find(i => i.entityType === 'release');
  console.log(JSON.stringify(item)); console.log(run.note);
  check(item && JSON.stringify(item.labels) === JSON.stringify([{ mbid: ARTOFFACT, name: 'Artoffact Records', catno: 'AOF 727' }, { mbid: METROPOLIS, name: 'Metropolis Records', catno: 'MET 727', add: true }]),
    'the release item carries the catalog number for its label, and the label to add');
  check(/Added label Metropolis Records, catalog number MET 727/.test(run.note), 'the edit note names the label added');
  check(item && item.barcode === cons.barcode, 'and the barcode');
  check(item && JSON.stringify(item.event) === JSON.stringify({ date: cons.event.date, country: 'XW' }) && JSON.stringify(item.tracks) === JSON.stringify(cons.lengths.map(l => ({ ...l, was: { ms: null } }))), `and the release event and the track lengths, as track changes for tracks without one (${JSON.stringify(item && [item.event, item.tracks])})`);
  check(/Added release event 2008-08-29 \[Worldwide\]/.test(run.note) && /Added the lengths of 2 tracks that had none/.test(run.note), 'the edit note names them');
  check(dz.state === 'linked' || (item && item.urls.some(u => u.url === DEEZER)), 'and the link');
  check(/Added catalog number AOF 727 for Artoffact Records/.test(run.note) && /Consolidated by Mission Control from Beatport, Deezer/.test(run.note), 'the edit note names the catalog number and the consolidation');
});

// #782: Update this release hands nothing over but the After saving ticks: the release compares itself
test('#782: Update this release opens the release and compares it with the platforms', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(n => sessionStorage.setItem('mc.after', JSON.stringify(n)), { created: Date.now(), mbid: RELEASE, title: '', ticks: { is: true, as: true, pc: true }, compare: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#content table.medium');
  await inject('mission_control', { waitFor: '__mcTest' });
  // stand-ins: Platform Check finds nothing, First Contact is there to read
  await page.evaluate(release => {
    const send = (type, d) => document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify(d) }));
    document.addEventListener('mc:probe', e => { const d = JSON.parse(e.detail); if (d.only.includes('pc')) setTimeout(() => send('mc:findings', { id: 'pc', run: d.run, release, findings: [] }), 50); });
    send('mc:provider', { id: 'pc', name: 'Platform Check', version: 1, release, capabilities: ['probe', 'apply'] });
    send('mc:provider', { id: 'fc', name: 'First Contact', version: 1, capabilities: ['read'] });
  }, RELEASE);
  await page.waitForSelector('#mc-root', { timeout: 10_000 });
  check(await page.evaluate(() => sessionStorage.getItem('mc.after') === null), 'the note opens Mission Control by the release\'s MBID, and is used once');
  const fc = await until(() => page.evaluate(() => window.__mcTest.results().fc), r => r && r.state === 'done');
  check(fc && fc.state === 'done' && /Platform Check found no platform/.test(fc.summary), `the Platforms step ran though it is on Ask (${JSON.stringify(fc)})`);
});

test('#727: an update for another release is dropped', { tag: ['@sandbox'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  const title = (await page.locator('.releaseheader h1').textContent()).trim();
  // the same title, another MBID: the MBID decides
  await page.evaluate(t => sessionStorage.setItem('mc.after', JSON.stringify({ created: Date.now(), mbid: '00000000-0000-0000-0000-000000000727', title: t, tracks: 5, isrcs: [], ticks: { is: true, as: true, pc: true }, cons: {} })), title);
  await inject('mission_control', { waitFor: '__mcTest' });
  await page.waitForTimeout(800);
  check(!(await page.locator('#mc-root').count()), 'Mission Control stays shut');
  check(await page.evaluate(() => sessionStorage.getItem('mc.after') === null), 'and the note is gone');
});
