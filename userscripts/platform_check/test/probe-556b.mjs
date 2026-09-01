// #556 A/B probe 2 — the payload-consumption defect, isolated.
// Seeds a pending payload whose URL MusicBrainz will NOT create a row for, loads
// the real editor, and reports whether the queue survived for a retry.
// Hook-free so it runs against any build.  node test/probe-556b.mjs [script]
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const SCRIPT = process.argv[2] || 'C:/Work/mb-userscripts/userscripts/platform_check/platform_check.user.js';
const code = await readFile(SCRIPT, 'utf8');
const REL = 'ec2449a8-3dc5-461c-80a1-e43d96345613';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1500, height: 1000 }, bypassCSP: true });
await ctx.addInitScript(() => {
  const store = new Map();
  window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
  window.GM_setValue = (k, v) => store.set(k, v);
  window.GM_deleteValue = k => store.delete(k);
  window.GM_listValues = () => [...store.keys()];
  window.GM_info = { script: { name: 'Platform Check', version: 't' } };
  window.unsafeWindow = window;
  window.GM_xmlhttpRequest = (o) => { setTimeout(() => o.onerror && o.onerror({ status: 0 }), 0); };
});
const page = await ctx.newPage();
await page.route(() => true, r => r.request().method() === 'POST' ? r.abort() : r.continue());
await page.goto(`https://musicbrainz.org/release/${REL}`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.evaluate(rel => localStorage.setItem(`pc:pending:${rel}`, JSON.stringify({ bogus: 'https://example.invalid/not-a-provider-url' })), REL);
const before = await page.evaluate(rel => localStorage.getItem(`pc:pending:${rel}`), REL);
console.log('queued before  :', before);
await page.goto(`https://musicbrainz.org/release/${REL}/edit`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.addScriptTag({ content: code });
await page.waitForTimeout(17000);   // past injectInto's 10s input wait + 5s row wait
const after = await page.evaluate(rel => localStorage.getItem(`pc:pending:${rel}`), REL);
console.log('queued after   :', after);
console.log(after ? '=> CORRECT: nothing landed, so the queue survives and can retry'
                  : '=> BUG REPRODUCED: nothing landed, but the queue was consumed — cannot retry');
await page.evaluate(rel => localStorage.removeItem(`pc:pending:${rel}`), REL);
await ctx.close();
