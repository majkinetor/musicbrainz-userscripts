// #431: fills matched only by position get a length check. chaban's case: the 4-track
// "Never Ever Ever" importing the 12-track Deezer album "When I Was Lost, I
// Found Myself". The wrong Deezer link has since been removed from MusicBrainz, so it
// is added back to the release's reply here. Expected: the 12-vs-4 wrong-edition
// warning, the fills kept but flagged amber, "⚠ N implausible" in the summary, a footer
// badge, and a confirmation before submitting.
// The album holds two of the release's songs, which now go to their own tracks by title (the
// second test), so the first gives the tracks titles Deezer doesn't have: only positions are left.
//
// test.musicbrainz.org (a copy of the release), with production's data from
// fixtures/ws-431.json.gz. Deezer is live. Nothing is submitted: "Review first" is
// pressed, and the profile has no ISRC submission authorisation anyway.
import { test, check } from '../../../dev/test/harness.mjs';
import { openScout, logText, ended } from './is.mjs';

// the album chaban's release was wrongly linked to (534356522 then; Deezer has since
// given that id to another album)
const DEEZER = 'https://www.deezer.com/album/687659221';
test.use({ gm: { name: 'ISRC Scout' } });

test('position-matched fills from a different edition are flagged, kept, and confirmed before submit', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: 'ad4287f9-c658-45bb-b0c6-4d71f79d3fdd',
    replay: new URL('./fixtures/ws-431.json.gz', import.meta.url),
    // the link, and the recordings as they were then: without ISRCs
    edit: j => { (j.relations = j.relations || []).push({ url: { resource: DEEZER } }); (j.media || []).forEach(m => (m.tracks || []).forEach(t => {
      if (t.recording) { t.recording.isrcs = []; t.recording.title = 'Unrelated ' + t.position; }
      t.title = 'Unrelated ' + t.position;
    })); },
  });
  await page.click('#ii-dz-all');
  const log = await ended(page, 'Deezer', 120000);
  const r = await page.evaluate(() => {
    const suspects = [...document.querySelectorAll('input.ii-in-suspect')];
    return { suspects: suspects.length, title: suspects[0] ? suspects[0].title : '' };
  });
  const done = (log.match(/Deezer done[^\n]*/) || [''])[0];
  const perRow = (log.match(/filled by position, but length differs/g) || []).length;
  check(/12 track\(s\) but this release has 4/.test(log), 'the wrong-edition warning: 12 tracks against 4');
  check(/4 filled/.test(done), `all 4 fills are kept ("${done}")`);
  // one pair sits near the 10 s tolerance, so 3 or 4 are flagged: check consistency
  check(r.suspects >= 3 && perRow === r.suspects, `most fills are flagged amber, each with its log line (${r.suspects} amber, ${perRow} lines)`);
  check(new RegExp('⚠ ' + r.suspects + ' implausible').test(done), `the summary agrees ("${done}")`);
  check(/matched by position only, but length differs/.test(r.title), 'an amber field explains itself');

  const fu = await page.evaluate(async () => {
    // polled until the popup is there, and until it has gone
    const eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(res => setTimeout(res, 25)); return f(); };
    const badge = document.getElementById('ii-suspect-badge');
    const out = { badge: badge ? { visible: badge.style.display !== 'none', text: badge.textContent } : null };
    document.getElementById('ii-submit').click();
    const findPop = () => [...document.querySelectorAll('div')].find(d => /implausible ISRC fill/.test(d.textContent) && d.querySelector('[data-a="go"]'));
    const pop = await eventually(findPop);
    out.popup = !!pop;
    pop?.querySelector('[data-a="review"]')?.click();
    out.closed = await eventually(() => ![...document.querySelectorAll('[data-a="go"]')].length);
    out.submitEnabled = !document.getElementById('ii-submit').disabled;
    return out;
  });
  check(fu.badge && fu.badge.visible && /implausible/.test(fu.badge.text), `the footer badge shows ("${fu.badge && fu.badge.text}")`);
  check(fu.popup, 'Submit asks for confirmation first');
  check(fu.closed && fu.submitEnabled, '"Review first" cancels without submitting');
  await ws.done();
});

// The same album as it is: Deezer's 4 "Never Ever Ever" (3:09) and 3 "Affirmations" (3:21) are this
// release's 1 and 2. A position fill there by another song gives way to the song itself, by title.
test('a song at another position goes to its own track by title, over a position fill', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: 'ad4287f9-c658-45bb-b0c6-4d71f79d3fdd',
    replay: new URL('./fixtures/ws-431.json.gz', import.meta.url),
    edit: j => { (j.relations = j.relations || []).push({ url: { resource: DEEZER } }); (j.media || []).forEach(m => (m.tracks || []).forEach(t => { if (t.recording) t.recording.isrcs = []; })); },
  });
  await page.click('#ii-dz-all');
  const log = await ended(page, 'Deezer', 120000);
  const done = (log.match(/Deezer done[^\n]*/) || [''])[0];
  const r = await page.evaluate(() => [...document.querySelectorAll('.ii-input')].slice(0, 4).map(i => ({ v: i.value, amber: i.classList.contains('ii-in-suspect') })));
  console.log(done + ' · ' + JSON.stringify(r));
  check(/2 put right by title/.test(done) && !/implausible/.test(done), `two put right, none left implausible ("${done}")`);
  check(r[0].v && r[1].v && !r[0].amber && !r[1].amber, 'tracks 1 and 2 hold their songs, not amber');
  check(!r[2].v && !r[3].v, 'tracks 3 and 4, which Deezer lacks, stay empty');
  check(/goes on track 1 by its title/.test(log) && /goes on track 2 by its title/.test(log), 'the log says which went by title');
  await ws.done();
});
