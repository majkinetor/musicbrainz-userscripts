// #431: fills matched only by position get a length check. chaban's case: the 4-track
// "Never Ever Ever" importing the 12-track Deezer album "When I Was Lost, I
// Found Myself". The wrong Deezer link has since been removed from MusicBrainz, so it
// is added back to the release's reply here. Expected: the 12-vs-4 wrong-edition
// warning, the fills kept but flagged amber, "⚠ N implausible" in the summary, a footer
// badge, and a confirmation before submitting.
//
// test.musicbrainz.org (a copy of the release), with production's data from
// fixtures/ws-431.json.gz. Deezer is live. Nothing is submitted: "Review first" is
// pressed, and the profile has no ISRC submission authorisation anyway.
import { test, check } from '../../../dev/test/harness.mjs';
import { openScout, logText } from './is.mjs';

// the album chaban's release was wrongly linked to (534356522 then; Deezer has since
// given that id to another album)
const DEEZER = 'https://www.deezer.com/album/687659221';
test.use({ gm: { name: 'ISRC Scout' } });

test('position-matched fills from a different edition are flagged, kept, and confirmed before submit', { tag: ['@sandbox', '@web'] }, async ({ page, inject }) => {
  const ws = await openScout(page, inject, {
    release: 'ad4287f9-c658-45bb-b0c6-4d71f79d3fdd',
    replay: new URL('./fixtures/ws-431.json.gz', import.meta.url),
    // the link, and the recordings as they were then: without ISRCs
    edit: j => { (j.relations = j.relations || []).push({ url: { resource: DEEZER } }); (j.media || []).forEach(m => (m.tracks || []).forEach(t => { if (t.recording) t.recording.isrcs = []; })); },
  });
  await page.waitForTimeout(800);
  await page.click('#ii-dz-all');
  await page.waitForFunction(() => /Deezer done/.test(document.getElementById('ii-log-out')?.textContent || ''), null, { timeout: 120000 });
  await page.waitForTimeout(500);
  const log = await logText(page);
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
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    const badge = document.getElementById('ii-suspect-badge');
    const out = { badge: badge ? { visible: badge.style.display !== 'none', text: badge.textContent } : null };
    document.getElementById('ii-submit').click();
    await sleep(200);
    const pop = [...document.querySelectorAll('div')].find(d => /implausible ISRC fill/.test(d.textContent) && d.querySelector('[data-a="go"]'));
    out.popup = !!pop;
    pop?.querySelector('[data-a="review"]')?.click();
    await sleep(150);
    out.closed = ![...document.querySelectorAll('[data-a="go"]')].length;
    out.submitEnabled = !document.getElementById('ii-submit').disabled;
    return out;
  });
  check(fu.badge && fu.badge.visible && /implausible/.test(fu.badge.text), `the footer badge shows ("${fu.badge && fu.badge.text}")`);
  check(fu.popup, 'Submit asks for confirmation first');
  check(fu.closed && fu.submitEnabled, '"Review first" cancels without submitting');
  await ws.done();
});
