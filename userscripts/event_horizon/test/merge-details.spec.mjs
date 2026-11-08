import { test, check, functionSource } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh' });

// Structure of /edit/157416007: the release comparison precedes table.details.
const changes = `<table class="tbl merge-releases"><thead><tr><th>Release</th><th>Barcode</th></tr></thead><tbody>
<tr><td><a href="/release/66d7efa3-9c76-3e07-bcf7-a043210fac16">Post (bonus disc: Extra)</a></td><td></td></tr>
<tr class="subh"><th colspan="2">Into:</th></tr>
<tr><td><a href="/release/88a10793-d534-478c-9b30-b2a967e8e8a5">Post</a></td><td>731452773326</td></tr></tbody></table>
<p><strong>All recordings for these releases are already merged.</strong></p>
<table class="details"><tr><th>Merge strategy:</th><td>Merge mediums and recordings</td></tr></table>`;

test('individual merge edits preserve all changes and keep voting separate', async ({ page }) => {
  const src = await functionSource('event_horizon', ['histParse', 'histSt', 'histTime', 'histNoteTime']);
  const parsed = await page.evaluate(({ src, changes }) => {
    const parse = new Function('const LOG = { debug() {} }; const MBID = /[0-9a-f-]{36}/;\n' + src + '\nreturn histParse;')();
    const header = '<div class="edit-header open edit-merge merge-releases"><h1>Edit #157416007 - Merge releases</h1></div>';
    // A translated heading must work too; the comparison and message remain in order.
    const single = parse('<div id="content">' + header + '<h2>Änderungen</h2>' + changes + '<h2>Abstimmungen</h2><table class="vote-tally"><tr><td class="vote">1 yes : 0 no</td></tr></table></div>');
    const list = parse('<div class="edit-list"><div class="edit-header open merge-releases"><h2><a href="/edit/157416007">Merge releases</a></h2></div><div class="edit-details">' + changes + '</div></div>');
    const d = new DOMParser().parseFromString(single.edits[0].det, 'text/html');
    const norm = s => s.replace(/>\s+</g, '><').trim();
    return { single, same: norm(single.edits[0].det) === norm(list.edits[0].det), tables: d.querySelectorAll('table').length, text: d.body.textContent };
  }, { src, changes });
  check(parsed.tables === 2, 'both the release comparison and merge strategy survive');
  check(parsed.text.includes('731452773326'), 'the destination release metadata survives');
  check(parsed.text.includes('All recordings for these releases are already merged.'), 'the explanation between the tables survives');
  check(!parsed.text.includes('1 yes'), 'the vote tally stays outside the changes');
  check(parsed.single.rid === '66d7efa3-9c76-3e07-bcf7-a043210fac16', 'the release can be identified from the comparison');
  check(parsed.same, 'individual and list edit pages preserve identical changes');
});
