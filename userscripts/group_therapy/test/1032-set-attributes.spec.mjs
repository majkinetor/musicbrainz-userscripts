// #1032: "bulk-change an attribute of a role across that person's relationships" (vocals →
// lead vocals / choir vocals). The pencil menu offers "Set attributes of <role>…": the values the
// link type allows (link_type.attributes, each root expanded through link_attribute_type), ticked
// ones set on every credit in scope as an update in place.
//
// test.musicbrainz.org: staged in the relationship editor, never submitted.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { blockEdits, openRelEditor, installRelReader } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('Set attributes stages an attribute on a credit, in place', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const posts = await blockEdits(page);
  await openRelEditor(page, inject);
  await installRelReader(page);

  const res = await page.evaluate(() => {
    const GT = window.__groupTherapy;
    for (const it of document.querySelectorAll('.relationship-item')) {
      const rel = window.__rel(it); if (!rel || !GT.relEnds(rel)) continue;
      const { choices } = GT.allowedAttrChoices(rel.linkTypeID);
      if (!choices.length) continue;
      const labels = GT.replaceRoleMenuItems(it).filter(x => x.label).map(x => x.label);
      const have = new Set([...(rel.attributes ? window.MB.tree.iterate(rel.attributes) : [])].map(a => a.typeID));
      const pick = choices.find(c => !have.has(c.id)); if (!pick) continue;
      const offered = new Set(choices.map(c => c.id));
      const ok = GT.setRelAttrs(GT.RE(), rel, GT.relEnds(rel), offered, [...have].filter(id => offered.has(id)).concat(pick.id));
      return { labels, pick: pick.id, name: pick.name, ok, lt: rel.linkTypeID, choices: choices.map(c => c.name).slice(0, 12) };
    }
    return null;
  });
  check(res, 'the editor has a credit whose role allows attributes');
  check(res && res.labels.some(l => /^Set attributes of /.test(l)), `the pencil menu offers "Set attributes of…" (${res && res.labels.join(' | ')})`);
  check(res && res.ok, `the attribute "${res && res.name}" is staged (choices: ${res && res.choices.join(', ')})`);
  const after = await until(() => page.evaluate(({ pick, lt }) => [...document.querySelectorAll('.relationship-item')].map(window.__rel).filter(Boolean)
    .some(r => r.linkTypeID === lt && r.attributes && [...window.MB.tree.iterate(r.attributes)].some(a => a.typeID === pick)), res || {}), x => x);
  check(after, 'a credit of that role now carries the attribute');
  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
