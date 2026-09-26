// #470: "All the works have 'writer' instead of 'composer'… mark all writers on
// highlighted works and change them to 'composer'." MusicBrainz has no bulk "change
// relationship type", so Replace role removes the relationship and adds the same entity
// pair under the new link type.
//
// Two bugs found live: MusicBrainz keys linkedEntities.link_type by both numeric id and
// gid, so a naive Object.values() listed every role twice; and picking a role the pair
// already has is a no-op (rel-noop, no rel-add), so the spec picks one that isn't there.
//
// test.musicbrainz.org: staged in the relationship editor, never submitted.
import { test, check } from '../../../dev/test/harness.mjs';
import { blockEdits, openRelEditor, installRelReader } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('Replace role stages a remove and an add under the new role', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posts = await blockEdits(page);
  await openRelEditor(page, inject);
  await installRelReader(page);

  const found = await page.evaluate(() => {
    const GT = window.__groupTherapy;
    for (const it of document.querySelectorAll('.relationship-item')) {
      const items = GT.replaceRoleMenuItems(it);   // [] when the item isn't a replaceable credit
      if (!items.length) continue;
      const rel = window.__rel(it); if (!rel) continue;
      const roles = GT.replacementRoles(rel);
      return { labels: items.filter(x => x.label).map(x => x.label), names: roles.map(r => r.name) };
    }
    return null;
  });
  check(found, 'the editor has a replaceable credit');
  check(found && found.labels.some(l => /^Replace role /.test(l)), 'the menu offers "Replace role <role>…"');
  check(found && found.labels.some(l => /^Replace .* for /.test(l)), 'the menu offers "Replace <role> for <target>…"');
  check(found && found.names.length > 0 && new Set(found.names).size === found.names.length, `each candidate role is offered once (${found && found.names.slice(0, 8).join(', ')})`);

  const applied = await page.evaluate(() => {
    const GT = window.__groupTherapy;
    const present = new Set([...document.querySelectorAll('.relationship-item')].map(window.__rel).filter(Boolean).map(r => r.linkTypeID));
    for (const it of document.querySelectorAll('.relationship-item')) {
      if (!GT.replaceRoleMenuItems(it).length) continue;
      const rel = window.__rel(it); if (!rel) continue;
      const roles = GT.replacementRoles(rel);
      // a role the pair doesn't have yet, or the replacement is a no-op
      const target = roles.find(r => !present.has(r.id) && /librettist|translator|revised by|orchestrator/.test(r.name)) || roles.find(r => !present.has(r.id)) || roles[0];
      return { n: GT.replaceRole([it], target, () => 'test replace'), newType: target.id };
    }
    return null;
  });
  check(applied && applied.n === 1, `one credit is replaced (${applied && applied.n})`);
  await page.waitForTimeout(1200);

  const after = await page.evaluate(newType => ({
    hasNewType: [...document.querySelectorAll('.relationship-item')].map(window.__rel).filter(Boolean).some(r => r.linkTypeID === newType),
    adds: document.querySelectorAll('.rel-add').length, removes: document.querySelectorAll('.rel-remove').length,
  }), applied ? applied.newType : -1);
  check(after.hasNewType, 'a relationship under the new role is in the editor');
  check(after.adds > 0 && after.removes > 0, `the add and the removal are staged (${after.adds} added, ${after.removes} removed)`);
  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
