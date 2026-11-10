import { test, check, functionSource } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm() });

test('automated edits keep the driving script note without an Apollo signature', { tag: '@unit' }, async () => {
  const src = await functionSource('apollo_editor', ['ensureApolloEditNote']);
  for (const automated of [true, false]) {
    const ta = { value: 'Platform Check: added barcode\nVia Mission Control' };
    const sign = new Function('AUTOMATED', 'ta', `
      const _apolloUsed = true, ENT_KIND = 'release', HELP_URL = 'https://example.com';
      const document = { getElementById: () => ta };
      const GM_info = { script: { name: 'Apollo Editor', author: 'majkinetor' } };
      const scriptVersion = () => 'test';
      const setEditNote = (el, value) => { el.value = value; };
      ${src}
      ensureApolloEditNote(); ensureApolloEditNote();
    `);
    sign(automated, ta);
    check(ta.value.startsWith('Platform Check: added barcode\nVia Mission Control'), 'the driving scripts retain their note');
    check((ta.value.match(/Apollo Editor/g) || []).length === (automated ? 0 : 1), `automated=${automated}: only interactive use signs, once`);
  }
});

for (const automated of [true, false]) {
  test(`real editor attribution, automated=${automated}`, { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
    await openApollo(page, inject, {
      release: 'aba74013-0e72-4ab9-87ee-7dc82193dc35',
      before: async () => {
        if (automated) await page.evaluate(() => history.replaceState(null, '', location.pathname + '?mbu-auto=0'));
      },
    });
    await page.waitForSelector('.tc-ri-mirror', { state: 'attached' });
    const note = await page.evaluate(() => {
      const ta = document.getElementById('edit-note-text');
      ta.value = 'Platform Check: added barcode\nVia Mission Control';
      window.__apolloEditor.ensureApolloEditNote();
      return ta.value;
    });
    check(note.includes('Platform Check: added barcode\nVia Mission Control'), 'the PC/MC note is preserved');
    check(/Apollo Editor/.test(note) === !automated, 'Apollo signs interactive use only');
  });
}
