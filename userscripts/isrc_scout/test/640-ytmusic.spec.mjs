// #640: YouTube Music track links, found by each track's ISRC. YouTube Music shows no ISRCs,
// but its search (the "songs" filter) finds most songs by one; a miss comes back as unrelated
// songs, so a hit counts only when it is official audio, with the track's title and length.
//
// Random Access Memories, whose recordings are on YouTube Music: their YouTube Music links
// are taken out of the reply, and Find links finds them again, one per track, each a watch
// link. Its log shows the guard at work on the results it skipped.
//
// test.musicbrainz.org, with production's data (fixtures/ws-458.json.gz). YouTube Music is
// live. Nothing is submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openScout } from './is.mjs';

test.use({ gm: { name: 'ISRC Scout' } });

test('#640: YouTube Music track links, by ISRC, title- and length-checked', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: '5000a285-b67e-4cfc-b54b-2b98f1810d2e', replay: new URL('./fixtures/ws-458.json.gz', import.meta.url),
    edit: j => (j.media || []).forEach(md => (md.tracks || []).forEach(tk => { const rec = tk.recording; if (rec && rec.relations) rec.relations = rec.relations.filter(x => !/music\.youtube\.com/i.test(x.url?.resource || '')); })),
  });
  const cands = await until(() => page.evaluate(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="yt"]').length), n => n > 0, { timeout: 20000 });
  await page.click('#ii-links-btn');
  const r = await until(() => page.evaluate(() => {
    const n = sel => document.querySelectorAll('#ii-modal .ii-tl' + sel + '[data-code="yt"]').length;
    return { found: n('.new'), absent: n('.absent'), spinning: n('.spin'), hrefs: [...document.querySelectorAll('#ii-modal .ii-tl.new[data-code="yt"]')].map(a => a.href) };
  }), r => r.spinning === 0 && r.found + r.absent > 0, { timeout: 120000 });
  const log = await page.evaluate(() => (window.__isrcScoutLog?.() || '').split('\n').filter(l => /YouTube Music/.test(l)));
  console.log(JSON.stringify({ cands, ...r, log: log.slice(0, 40) }, null, 1));
  check(cands === 13, `every track offers a YouTube Music slot (${cands})`);
  // live search: which songs an ISRC brings up varies a little from run to run (10–11 of 13 seen)
  check(r.found >= 8, `most tracks find their YouTube Music song (${r.found} of 13, ${r.absent} not)`);
  check(r.hrefs.every(h => /^https:\/\/music\.youtube\.com\/watch\?v=[\w-]{11}$/.test(h)), `each a watch link (${r.hrefs.slice(0, 2).join(', ')})`);
  check(new Set(r.hrefs).size === r.hrefs.length, 'no two tracks share a song');
  check(log.some(l => /matches "/.test(l)), 'the log says what each match was');
  await ws.done();
});

const RAM = '5000a285-b67e-4cfc-b54b-2b98f1810d2e';
const RAM_YTM = 'https://music.youtube.com/playlist?list=OLAK5uy_kNhM2yaBTOVwrcZJepB1C9P3-n5_Sfy5c';
const noYtm = j => (j.media || []).forEach(md => (md.tracks || []).forEach(tk => { const rec = tk.recording; if (rec && rec.relations) rec.relations = rec.relations.filter(x => !/music\.youtube\.com/i.test(x.url?.resource || '')); }));

test('#640: with the release\'s YouTube Music album linked, its tracklist resolves the links, and the edit note names the album', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: RAM, replay: new URL('./fixtures/ws-458.json.gz', import.meta.url),
    edit: j => { noYtm(j); (j.relations = j.relations || []).push({ type: 'free streaming', url: { resource: RAM_YTM } }); },
  });
  // the edit is stopped on its way out: only its note is read
  const notes = [];
  await page.route('**/ws/js/edit/create', r => { try { notes.push(JSON.parse(r.request().postData() || '{}').editNote || ''); } catch (e) {} return r.abort(); });
  await until(() => page.evaluate(() => document.querySelectorAll('#ii-modal .ii-tl.cand[data-code="yt"]').length), n => n > 0, { timeout: 20000 });
  await page.click('#ii-links-btn');
  const r = await until(() => page.evaluate(() => {
    const n = sel => document.querySelectorAll('#ii-modal .ii-tl' + sel + '[data-code="yt"]').length;
    return { found: n('.new'), absent: n('.absent'), spinning: n('.spin') };
  }), r => r.spinning === 0 && r.found + r.absent > 0, { timeout: 120000 });
  const log = await page.evaluate(() => (window.__isrcScoutLog?.() || '').split('\n').filter(l => /YouTube Music/.test(l)));
  // #690: from the album's playlist, as YouTube's own client lists it (the album page can hold music videos)
  check(log.some(l => /YouTube Music album "Random Access Memories" \(OLAK5uy_[\w-]+\): 13 song/.test(l)), `the album is read once, from its playlist (${log.find(l => /album "/.test(l))})`);
  check(r.found === 13, `all 13 tracks resolve from it (${r.found}, ${r.absent} not)`);
  check(!log.some(l => /YouTube Music USQX/.test(l)), 'no ISRC search was needed');
  // right-click one: the note names the album it came from
  await page.evaluate(() => document.querySelector('#ii-modal tr[data-idx="0"] .ii-tl.new[data-code="yt"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  await until(() => notes.length, n => n > 0, { timeout: 15000 });
  console.log(notes[0]);
  check(/YouTube Music https:\/\/music\.youtube\.com\/watch\?v=[\w-]{11} ← album "Random Access Memories" https:\/\/www\.youtube\.com\/playlist\?list=OLAK5uy_[\w-]+ \(the release's album, track 1\)/.test(notes[0] || ''), 'the edit note names the YouTube Music album and how the link was found');
  await ws.done();
});

// JP92Q2400507 is both メズマライザー (2024, on "Mesmerizer") and its "Critical Damage ver." (2026,
// on "Critical Damage"), same title, same 2:37 (rinsuki). Searched, the ISRC brings up the
// original's song. On "Critical Damage" it must be skipped; on "Mesmerizer" it's the one.
for (const [album, want] of [['Critical Damage', false], ['Mesmerizer', true]]) {
  test(`#640: a shared ISRC — on "${album}" the original's song is ${want ? 'taken' : 'skipped'}`, { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
    await openScout(page, inject, { edit: j => { j.title = album; } });   // any sandbox release, retitled
    await page.waitForFunction(() => !!window.__isrcScoutTest466, null, { timeout: 5000 });
    const url = await page.evaluate(async () => {
      const yt = window.__isrcScoutTest466.PROV.find(p => p.code === 'yt');
      return yt.resolve('JP92Q2400507', { title: 'メズマライザー', dur: '2:37' }, 0);
    });
    const log = await page.evaluate(() => (window.__isrcScoutLog?.() || '').split('\n').filter(l => /JP92Q2400507/.test(l)));
    console.log(JSON.stringify({ album, url, log }, null, 1));
    if (want) check(/^https:\/\/music\.youtube\.com\/watch\?v=[\w-]{11}$/.test(url || ''), `on "Mesmerizer" the song is taken (${url})`);
    else {
      check(url === null, `on "Critical Damage" nothing is taken (${url})`);
      check(log.some(l => /skipped: from the album "Mesmerizer", not "Critical Damage"/.test(l)), 'the log says why: another album, the ISRC may be shared');
    }
  });
}
