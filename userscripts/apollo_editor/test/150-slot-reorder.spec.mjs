// #150: a track's artist-credit slots reorder by dragging the ⠿ handle among a slot's
// hover icons. The real handle and drag handlers: a track gets a second slot (↵), slot 0
// is dropped on the lower half of slot 1, and both Apollo's model and MusicBrainz's
// committed artist credit flip.
import { test, check, settled } from '../../../dev/test/harness.mjs';
import { openApollo, matchDone, toTab, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('dragging a slot handle reorders the credit, in the model and in MusicBrainz', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.clock.install();   // to run Apollo's debounced re-renders out, below
  const submitted = await openApollo(page, inject, { seed: 'seed-saigon', tab: 'tracklist' });
  await page.waitForFunction(() => { const l = document.querySelector('.tc-mirror tr .tc-aslot'); return l && l.offsetParent !== null; }, null, { timeout: 20000 });
  // matching rebuilds the model as it finishes, and a debounced re-render follows
  // MusicBrainz's DOM changes: both are run out first, or the slots marked below are
  // replaced by fresh ones mid-test
  await matchDone(page);
  await page.clock.runFor(3000);
  await settled(page);

  const r = await page.evaluate(async () => {
    const eventually = async f => { for (let i = 0; i < 400 && !f(); i++) await new Promise(r => setTimeout(r, 25)); return f(); };
    const A = window.__apolloEditor;
    const row = [...document.querySelectorAll('.tc-mirror tbody tr')].find(r => r.querySelector('.c-art .tc-aslot'));
    if (!row) return { err: 'no track row' };
    row.querySelector('.c-art .tc-aslot .tc-enter').click();   // a second slot
    const mi = +row.dataset.mi, ti = +row.dataset.ti;
    const trackOf = () => A.model.tracks.find(t => t.mi === mi && t.ti === ti) || A.model.tracks[0];
    await eventually(() => trackOf().slots.length >= 2 && document.querySelectorAll(`.tc-mirror tr[data-mi="${mi}"][data-ti="${ti}"] .c-art .tc-aslot`).length >= 2);
    const track = trackOf();
    if (track.slots.length < 2) return { err: 'expected 2 slots after ↵, got ' + track.slots.length };
    track.slots.forEach((s, i) => { s._tid = i; });
    track.slots[0].creditedAs = 'ZZZ_first'; track.slots[1].creditedAs = 'ZZZ_second';
    A.commitTrack(track);
    const committed = () => window.MB.releaseEditor.rootField.release().mediums()[mi].tracks()[ti].artistCredit().names.map(n => n.name);
    const sel = `.tc-mirror tr[data-mi="${mi}"][data-ti="${ti}"] .c-art`;
    const before = { order: track.slots.map(s => s._tid), handles: document.querySelectorAll(sel + ' .tc-slotgrab').length, committed: committed() };

    const lines = [...document.querySelectorAll(sel + ' .tc-aslot')];
    const grab0 = lines[0].querySelector('.tc-slotgrab'), r1 = lines[1].getBoundingClientRect();
    const dt = new DataTransfer(), at = { bubbles: true, dataTransfer: dt, clientX: r1.left + 5, clientY: r1.bottom - 2 };
    grab0.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    lines[1].dispatchEvent(new DragEvent('dragover', at));
    lines[1].dispatchEvent(new DragEvent('drop', at));
    grab0.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    await eventually(() => JSON.stringify(committed()) === '["ZZZ_second","ZZZ_first"]');
    const t2 = trackOf();
    return { before, after: { order: t2.slots.map(s => s._tid), committed: committed() } };
  });
  check(!r.err, r.err || 'a track row with two slots');
  if (r.err) return;
  check(r.before.handles === 2, `each slot has a ⠿ handle (${r.before.handles})`);
  check(JSON.stringify(r.before.committed) === '["ZZZ_first","ZZZ_second"]', `the credit before: ${JSON.stringify(r.before.committed)}`);
  check(JSON.stringify(r.after.order) === '[1,0]', `Apollo's slots flipped (${JSON.stringify(r.after.order)})`);
  check(JSON.stringify(r.after.committed) === '["ZZZ_second","ZZZ_first"]', `MusicBrainz's credit flipped (${JSON.stringify(r.after.committed)})`);
  check(submitted.length === 0, 'nothing submitted');
});
