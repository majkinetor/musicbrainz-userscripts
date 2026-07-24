// #465 (chaban-mb) — the #464 background auto-submit used button.submit.positive to
// find "Enter edit", but the release editor is the multi-step wizard, not the simple
// artist/label/place form: its submit button is #enter-edit. button.submit.positive
// never matches there, so the background add silently gave up ("no submit button
// found"). Read-only: confirms the finder resolves #enter-edit on a real release edit
// page — never clicks it (that would submit a real edit).
import { createRequire } from 'node:module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const MBID = 'ec2449a8-3dc5-461c-80a1-e43d96345613';

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded' });
if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
await page.waitForTimeout(2000);

const r = await page.evaluate(() => {
  const findSubmit = () => document.querySelector('#enter-edit')
    || document.querySelector('button.submit.positive')
    || [...document.querySelectorAll('button')].find(b => /enter edit/i.test(b.textContent || ''));
  const btn = findSubmit();
  return {
    found: !!btn,
    id: btn?.id || null,
    text: btn?.textContent?.trim() || null,
    oldSelectorMatched: !!document.querySelector('button.submit.positive'),
  };
});
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };
console.log(JSON.stringify(r, null, 1));
ck(r.found, 'findSubmit() resolves a real "Enter edit" button on the release editor');
ck(r.id === 'enter-edit', `resolves via #enter-edit specifically, matching what chaban's report expected (got id="${r.id}")`);
ck(!r.oldSelectorMatched, 'confirms the OLD selector (button.submit.positive) never matches here — reproduces #465');
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
