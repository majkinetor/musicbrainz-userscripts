// #608 (chaban-mb) — "Parallel merge submissions silently fail due to session
// queue race condition". MB keeps the merge queue in ONE per-user session slot
// and wipes it when a merge submits, so parallel Merge All workers clobbered each
// other: the losers' POSTs were bounced to "/" with no edit created, and Fusion
// counted that as success ("redirected away").
//
// REAL merges on test.musicbrainz.org (the sanctioned sandbox): three 2-member
// groups, Merge All clicked, then for EVERY group MB itself is asked whether the
// merge edit exists (both members now have a pending edit, or — auto-edit — the
// merged-away recording resolves to another one). A group marked "done" without
// that is the #608 bug. Run with FUSION_SRC=<old build> to watch it fail.
import { test, check, requireLogin } from '../../../dev/test/harness.mjs';

const GROUPS = 3;
test.use({ gm: { name: 'Fusion' } });

test('Merge All submits one merge at a time, and only reports what MusicBrainz created', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await requireLogin(page);

  // Fresh fixtures every run: earlier runs merged theirs. Recordings with NO pending
  // edit, so a pending edit afterwards can only be the merge this run created.
  const fixtures = await page.evaluate(async (need) => {
      // A broad title search, not one artist's catalogue: every earlier merge test
      // left its artist's recordings with pending (never-voted) edits on the sandbox.
      const out = [];
      for (let offset = 0; offset < 1000 && out.length < need; offset += 100) {
          const sr = await fetch(`/ws/2/recording?query=${encodeURIComponent('recording:love')}&limit=100&offset=${offset}&fmt=json`).then(r => r.json()).catch(() => null);
          const recs = (sr && sr.recordings) || [];
          if (!recs.length) break;
          for (const r of recs) {
              if (out.length >= need) break;
              const j = await fetch('/ws/js/entity/' + r.id).then(x => x.ok ? x.json() : null).catch(() => null);
              if (j && j.gid === r.id && !j.editsPending) out.push(r.id);
              await new Promise(z => setTimeout(z, 250));
          }
      }
      return out;
  }, GROUPS * 2);
  test.skip(fixtures.length < GROUPS * 2, 'only ' + fixtures.length + ' clean recordings left on the sandbox');

  await page.goto(`https://test.musicbrainz.org/recording/${fixtures[0]}`, { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });
  const version = await page.evaluate(() => window.__fusion.VERSION);
  console.log('Fusion', version, '— fixtures', fixtures.join(', '));

  const groups = await page.evaluate(async ([gids, n]) => {
      const F = window.__fusion;
      await F.openFusion();   // the real window, so Merge All is the real button
      F.clearBoard();
      const out = [];
      for (let g = 0; g < n; g++) {
          const a = await F.fetchRecordingByGid(gids[2 * g]), b = await F.fetchRecordingByGid(gids[2 * g + 1]);
          F.addToPool(a); F.addToPool(b);
          const grp = F.createGroupWithMember(a.gid); F.addToGroup(b.gid, grp.id);
          out.push({ id: grp.id, target: grp.target, members: grp.memberGids.slice() });
      }
      F.STATE.recordings.forEach(r => { r.editsPending = false; });   // fixtures were checked clean above
      F.renderAll();
      return out;
  }, [fixtures, GROUPS]);
  check(groups.length === GROUPS, `built ${GROUPS} two-member groups`);

  console.log('Clicking Merge All — REAL merges on test.musicbrainz.org (sandbox)…');
  await page.click('#fs-mergeall');
  await page.waitForFunction(() => window.__fusion.STATE.groups.every(g => g.state === 'done' || g.state === 'error'), null, { timeout: 120000 });
  const result = await page.evaluate(() => window.__fusion.STATE.groups.map(g => ({ id: g.id, state: g.state, error: g.error, url: g.mergedUrl })));
  console.log('Fusion says:', JSON.stringify(result, null, 1));

  // Ask MB. A created merge edit puts a pending edit on every member (or, if it
  // auto-applied, the merged-away gid now resolves to the kept recording).
  await page.waitForTimeout(1500);
  const truth = await page.evaluate(async (groups) => {
      const out = {};
      for (const g of groups) {
          const st = [];
          for (const gid of g.members) {
              const j = await fetch('/ws/js/entity/' + gid).then(x => x.ok ? x.json() : null).catch(() => null);
              st.push(!!j && (j.editsPending || j.gid !== gid));
          }
          out[g.id] = st.every(Boolean);
      }
      return out;
  }, groups);
  console.log('MB has the merge edit:', JSON.stringify(truth));
  const lies = result.filter(r => r.state === 'done' && !truth[r.id]);
  check(lies.length === 0, `no group reported "done" without a merge edit in MB (#608) — ${lies.length} did: ${lies.map(l => l.id + ' → ' + l.url).join(', ')}`);
  check(result.every(r => r.state === 'done') && groups.every(g => truth[g.id]), `all ${GROUPS} groups really merged (${Object.values(truth).filter(Boolean).length}/${GROUPS} in MB)`);
  const lines = await page.evaluate(() => window.__fusion.getLogLines());
  const posts = lines.filter(l => /→ (GET|POST) \/recording\/merge|POST landed at|merge_queue redirected|▶ Merge group|merge session free/.test(l));
  console.log(posts.map(l => '   ' + l).join('\n'));
});
