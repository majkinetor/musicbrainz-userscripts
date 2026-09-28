// Shared setup for Credit Hoarder's browser specs.
import { requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

// What Credit Hoarder needs from a manager in these specs: GM_info (edit notes, the
// summary) and GM storage that remembers nothing. No GM_xmlhttpRequest, so the sources
// are fetched as they are without one. Prepended to the script: test.use({ gm: false })
// and inject('credit_hoarder', { transform: withShim }).
const SHIM = "window.GM_info = window.GM_info || { script: { name: 'Credit Hoarder', version: 'test', author: 'majkinetor', homepageURL: 'https://github.com/majkinetor/musicbrainz-userscripts' }, scriptHandler: 'Playwright', version: 'test' };"
  + ' window.GM_getValue = window.GM_getValue || ((k, d) => d); window.GM_setValue = window.GM_setValue || (() => {}); window.unsafeWindow = window;\n';
export const withShim = code => SHIM + code;

// A release's relationship editor on the sandbox, once MusicBrainz's editor is up.
export async function openEditor(page, release) {
  for (let a = 1; ; a++) {
    try { await page.goto(`${SANDBOX}/release/${release}/edit-relationships`, { waitUntil: 'domcontentloaded', timeout: 60000 }); break; }
    catch (e) { if (a >= 3) throw e; await page.waitForTimeout(4000); }
  }
  await requireLogin(page);
  await page.waitForFunction(() => window.MB && MB.relationshipEditor && MB.relationshipEditor.state && MB.relationshipEditor.state.entity, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
}
