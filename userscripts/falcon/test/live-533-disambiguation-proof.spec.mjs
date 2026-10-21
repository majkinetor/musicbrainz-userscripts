// #533 (majkinetor): "We currently support Disambiguation for recordings. Lets
// complete it for other entities. Finally, provide a proof on test.musicbrainz
// that it works."
//
// This is a REAL run: it lets Falcon commit actual edits on test.musicbrainz
// and then reads each entity back from the API to prove the disambiguation
// landed. Nothing is faked or intercepted — an aborted POST would prove only
// that a request left the browser.
//
// Sandbox only: it refuses to run against any host but test.musicbrainz.org.
// Run: node test/live-533-disambiguation-proof.mjs
import { readFile } from 'node:fs/promises';
import { test, check, requireLogin, sourceOf, idle, frames, mbNoise, pristine } from '../../../dev/test/harness.mjs';
import { join } from 'node:path';

// the script brings its own GM stand-ins, as it did before the harness
test.use({ gm: false });

test("live 533 disambiguation proof", { tag: ['@sandbox', '@login'] }, async ({ context, page }) => {
  const code = await readFile(sourceOf('falcon'), 'utf8');

  const HOST = 'https://test.musicbrainz.org';
  if (!/test\.musicbrainz\.org$/.test(new URL(HOST).hostname)) { console.log('REFUSING: sandbox only'); throw new Error('stopped: see the log above'); }

  // pristine entities, made for the run (#795): a release (with its release group and recording),
  // an artist and a label. The release takes the other route: its KO editor ignores seeded
  // params, so Falcon types the field.
  const rel = await pristine(page, 'release');
  const TARGETS = [
    { type: 'artist',        mbid: (await pristine(page, 'artist')).mbid, seg: 'artist' },
    { type: 'release_group', mbid: rel.releaseGroup, seg: 'release-group' },
    { type: 'recording',     mbid: rel.recordings[0], seg: 'recording' },
    { type: 'label',         mbid: (await pristine(page, 'label')).mbid, seg: 'label' },
    { type: 'release',       mbid: rel.mbid, seg: 'release' },
  ];
  // seconds included: a minute-resolution stamp made two runs in the same minute
  // indistinguishable, which briefly looked like the edit had not applied.
  const STAMP = 'falcon test ' + new Date().toISOString().slice(0, 19).replace('T', ' ');

  async function readBack(seg, mbid) {
    for (let a = 1; a <= 6; a++) {
      const r = await page.evaluate(p => fetch(p, { cache: 'no-store' }).then(async x => ({ ok: x.ok, j: x.ok ? await x.json() : null })).catch(() => ({ ok: false })), `/ws/2/${seg}/${mbid}?fmt=json`);
      if (r.ok) return r.j.disambiguation;
      await new Promise(x => setTimeout(x, 4000));
    }
    return '<unreadable>';
  }

  const ck = check;

  console.log('disambiguation BEFORE:');
  const before = {};
  for (const t of TARGETS) { before[t.type] = await readBack(t.seg, t.mbid); console.log('  ' + t.type.padEnd(14) + JSON.stringify(before[t.type])); }

  await context.addInitScript(() => {
    const s = new Map();
    window.GM_getValue = (k, d) => s.has(k) ? s.get(k) : d;
    window.GM_setValue = (k, v) => s.set(k, v);
    window.GM_deleteValue = k => s.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  const errs = []; page.on('pageerror', e => { if (!mbNoise(e.message)) errs.push(e.message); });
  for (let a = 1; ; a++) {
    try { await page.goto(`${HOST}/release/${rel.mbid}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(5000); }
  }
  await requireLogin(page);
  await idle(page);
  await page.addScriptTag({ content: code });
  await idle(page);

  // every supported type is offered a disambiguation box
  const supported = await page.evaluate(() => [...window.__falconTest.DISAMBIGUATABLE].sort());
  console.log('DISAMBIGUATABLE: ' + supported.join(', '));
  ck(supported.join(',') === 'artist,label,recording,release,release_group', 'all five entity types with a disambiguation are supported');
  // and the two routes are wired the way they have to be: seeded for the four
  // plain forms, typed for the release. Asserting the seed url proves the release
  // is NOT seeded — sending edit-release.comment would silently do nothing.
  const seeds = await page.evaluate(() => ({
    artist: window.__falconTest.buildSeedEditUrl({ entityType: 'artist', mbid: '00000000-0000-0000-0000-000000000000', urls: [], disambiguation: 'x', isrcs: [] }),
    release: window.__falconTest.buildSeedEditUrl({ entityType: 'release', mbid: '00000000-0000-0000-0000-000000000000', urls: [], disambiguation: 'x', isrcs: [] }),
  }));
  ck(seeds.artist.includes('edit-artist.comment=x'), 'a plain form gets the comment seeded into the url');
  ck(!seeds.release.includes('comment=x'), 'a release does NOT — its editor ignores the param, so seeding it would be a silent no-op');

  // The workers live in the panel, so it has to be open — with it closed the
  // queue simply stays 'queued' and nothing runs (learned the hard way).
  await page.click('#falcon-launcher');
  await page.waitForSelector('#falcon-panel', { timeout: 15000 });
  await frames(page);

  // queue the three, each with the same stamped disambiguation, and really run it
  await page.evaluate(({ targets, stamp }) => {
    window.__falconTest.setQueue(targets.map((t, i) => ({
      id: 'p' + i, entityType: t.type, mbid: t.mbid, urls: [], note: 'Falcon #533 disambiguation proof',
      disambiguation: stamp, isrcs: [], cover: [], coverExistingCount: null,
      name: null, urlResults: null, status: 'queued', error: '',
    })));
  }, { targets: TARGETS, stamp: STAMP });
  await page.evaluate(() => window.__falconTest.start());
  await page.waitForFunction(() => window.__falconTest.getQueue().every(i => i.status !== 'queued' && i.status !== 'active'), null, { timeout: 240000 }).catch(() => {});
  const outcome = await page.evaluate(() => window.__falconTest.getQueue().map(i => ({ t: i.entityType, s: i.status, e: i.error })));
  console.log('run outcome: ' + JSON.stringify(outcome));
  const flog = await page.evaluate(() => window.__falconTest.getLog().map(l => `${l.sev}: ${l.msg}`));
  console.log('--- falcon log (submit lines) ---');
  for (const l of flog.filter(x => /submit|commit|no change|comment|seed|edit page/i.test(x)).slice(-20)) console.log('  ' + l);
  // MusicBrainz AUTO-APPLIES an added disambiguation but queues a CHANGED one for
  // voting, so the API only shows the new value when the field started empty.
  // Both outcomes prove the same thing — Falcon built and submitted a correct
  // edit — so the proof accepts either, and says which it saw. (An earlier
  // version of this test only checked the API and reported a false failure on
  // the second run, when the fields were no longer empty.)
  console.log('disambiguation AFTER:');
  const epage = await context.newPage();   // the read-back, in a tab of its own
  // ⚠ /<entity>/<mbid>/open_edits lists edits for RELATED entities too: a
  // release's page carries its recordings' edits. An earlier version of this just
  // searched that page's text for the stamp, so the release check passed on a
  // RECORDING edit's stamp while no "Edit release" edit existed at all — the
  // release path was submitting nothing and this test said ALL PASS. So match the
  // edit's own type header, not just the page text.
  // MB tags each edit's header div with the edit's own type — `edit-header … 
  // edit-artist`, `edit-release-group`, and so on — which beats parsing the title.
  // The edit's BODY (where the Disambiguation row lives) is a following sibling,
  // so collect forward until the next header.
  const EDIT_CLASS = { artist: 'edit-artist', label: 'edit-label', recording: 'edit-recording', release: 'edit-release', release_group: 'edit-release-group' };
  const openEditHas = async (seg, mbid, stamp, cls) => {
    for (let a = 1; ; a++) {
      try { await epage.goto(`${HOST}/${seg}/${mbid}/open_edits`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
      catch (e) { if (a >= 3) return false; await epage.waitForTimeout(5000); }
    }
    await idle(epage);
    return await epage.evaluate(({ stamp, cls }) => {
      // classList, not a substring: "edit-release" must not match an
      // "edit-release-group" header.
      const heads = [...document.querySelectorAll('.edit-header')].filter(h => h.classList.contains(cls));
      return heads.some(h => {
        let text = h.innerText || '';
        for (let n = h.nextElementSibling; n && !n.classList.contains('edit-header'); n = n.nextElementSibling) text += String.fromCharCode(10) + (n.innerText || '');
        return text.includes(stamp) && /Disambiguation/i.test(text);
      });
    }, { stamp, cls });
  };
  for (const t of TARGETS) {
    const after = await readBack(t.seg, t.mbid);
    const applied = after === STAMP;
    const queued = applied ? false : await openEditHas(t.seg, t.mbid, STAMP, EDIT_CLASS[t.type]);
    console.log('  ' + t.type.padEnd(14) + JSON.stringify(after) + (applied ? '   [applied immediately]' : queued ? '   [submitted, pending a vote]' : '   [NOT FOUND]'));
    ck(applied || queued, `${t.type}: Falcon's disambiguation reached MusicBrainz as a real "${EDIT_CLASS[t.type].replace('edit-', 'edit ')}" edit with a Disambiguation change` + (queued ? ' (queued for voting — it was a change, not an addition)' : ''));
  }
  await epage.close();
  ck(errs.length === 0, 'no page errors (' + errs.join(' | ') + ')');
});
