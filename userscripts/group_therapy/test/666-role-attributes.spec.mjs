// #666: the text parser resolves vocal types ("Lead Vocals", "Backing Vocals")
// to the "vocal" relationship PLUS that vocal attribute, the way instruments
// already resolve, and a leading qualifier ("Guest", "Additional", "Co-",
// "Executive" …) becomes an extra attribute when the role allows it.
//
// Runs against test.musicbrainz.org and never submits: every POST to /edit is
// aborted and asserted zero at the end.
import { test, check, requireLogin, SANDBOX, settled, idle, frames, until } from '../../../dev/test/harness.mjs';
import { blockEdits, installRelReader, RELEASE } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy' } });

test('vocal types and qualifiers resolve to role + attributes', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/release/${RELEASE}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await requireLogin(page);
  await settled(page);
  const posts = await blockEdits(page);
  await inject('group_therapy', { waitFor: '__groupTherapy' });
  await idle(page);
  await installRelReader(page);

  // ── auto-resolution of the role column ──────────────────────────────────────
  await page.evaluate(() => window.__groupTherapy.openTextParser());
  await frames(page);
  await page.fill('.gt-tp-pat', 'R: E');
  await page.fill('.gt-tp-ta', [
    'Lead Vocals: A', 'Backing Vocals: B', 'Vocals: C', 'Guest Vocals: D', 'Guest Lead Vocals: E',
    'Co-Producer: F', 'Executive Producer: G', 'Additional Guitar: H', 'Co-Writer: I', 'Tenor: J',
  ].join('\n'));
  await frames(page);
  await page.click('.gt-tp-resolve');
  await page.waitForFunction(() => { const b = document.querySelector('.gt-tp-resolve'); return b && !b.disabled; }, null, { timeout: 60000 }).catch(() => {});
  await frames(page);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-row')].map(tr => {
    const cs = [...tr.querySelectorAll('.gt-tp-c')];
    return { role: cs[0]?.textContent, resolved: (tr.querySelector('button.gt-tp-resolved')?.textContent || '').toLowerCase() };
  }));
  console.log('rows: ' + JSON.stringify(rows));
  const got = role => (rows.find(r => r.role === role) || {}).resolved;
  check(got('Lead Vocals') === 'lead vocals', `"Lead Vocals" → the lead vocals attribute, not bare "vocal" (got "${got('Lead Vocals')}")`);
  check(got('Backing Vocals') === 'background vocals', `"Backing Vocals" → background vocals (got "${got('Backing Vocals')}")`);
  check(got('Vocals') === 'vocal', `plain "Vocals" stays the bare vocal role (got "${got('Vocals')}")`);
  check(got('Guest Vocals') === 'guest vocal', `"Guest Vocals" → vocal + guest (got "${got('Guest Vocals')}")`);
  check(got('Guest Lead Vocals') === 'guest lead vocals', `"Guest Lead Vocals" → vocal + lead + guest (got "${got('Guest Lead Vocals')}")`);
  check(got('Co-Producer') === 'co producer', `"Co-Producer" → producer + co (got "${got('Co-Producer')}")`);
  check(got('Executive Producer') === 'executive producer', `"Executive Producer" → producer + executive (got "${got('Executive Producer')}")`);
  check(got('Additional Guitar') === 'additional guitar', `"Additional Guitar" → instrument guitar + additional (got "${got('Additional Guitar')}")`);
  check(!/^co /.test(got('Co-Writer') || ''), `"Co-Writer" gets no co attribute — writer doesn't allow it (got "${got('Co-Writer')}")`);
  check(!/vocal/.test(got('Tenor') || ''), `"Tenor" alone is not taken as tenor vocals (got "${got('Tenor')}")`);

  // ── apply one: the staged rel carries BOTH attributes ───────────────────────
  await page.fill('.gt-tp-ta', 'Guest Lead Vocals: Test Artist For 666');
  await frames(page);
  await page.click('.gt-tp-resolve');
  await page.waitForFunction(() => { const b = document.querySelector('.gt-tp-resolve'); return b && !b.disabled; }, null, { timeout: 60000 }).catch(() => {});
  await frames(page);
  const gid = await page.evaluate(() => { const a = document.querySelector('.relationship-item a[href^="/artist/"]'); return a ? a.getAttribute('href').split('/')[2] : null; });
  check(!!gid, 'found an artist on the release to credit');
  await page.click('.gt-tp-search:not(.gt-tp-resolved)');
  await frames(page);
  await page.fill('.gt-tp-q', gid);
  await page.waitForFunction(() => !document.querySelector('.gt-tp-apop'), null, { timeout: 15000 });
  await frames(page);
  await page.click('.gt-cons-apply');
  await until(() => page.isVisible('.gt-cons.gt-tp'), v => !v);
  await frames(page);
  const staged = await page.evaluate(() => {
    const lat = MB.linkedEntities.link_attribute_type;
    return [...document.querySelectorAll('.relationship-item')].map(window.__rel).filter(r => r && r._status === 1)
      .map(r => ({ lt: MB.linkedEntities.link_type[r.linkTypeID].name, attrs: r.attributes ? [...MB.tree.iterate(r.attributes)].map(a => lat[a.typeID].name).sort() : [] }));
  });
  console.log('staged: ' + JSON.stringify(staged));
  check(staged.some(s => s.lt === 'vocal' && s.attrs.join(',') === 'guest,lead vocals'), 'Apply stages a vocal rel with the guest + lead vocals attributes');
  check(posts.length === 0, `nothing was submitted (${posts.length} POSTs)`);
});
