// #508 follow-up (majkinetor): "Lets add another option: 1. Auto start
// Harmony import (off by default)". A Harmony-sourced seed (the GM-storage
// token scheme — see parseUrlParam's fromHarmony marker) auto-starts the
// queue when cfg.autoStartHarmonyImport is on; a manually-constructed
// `?falcon=` base64 payload never auto-starts, on or off, since that's the
// general external contract any script/user can hand Falcon, not something
// Harmony specifically vouches for.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'falcon.user.js'), 'utf8');
const RECORDING = 'e42f8e08-3150-4c6c-be5b-4030c29b1bf7';

let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1400, height: 900 } });

async function bootWithToken({ autoStart }) {
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route('**/recording/*/edit*', async (route, request) => {
    if (request.method() === 'POST') {
      const mbid = (request.url().match(/\/recording\/([0-9a-f-]{36})\/edit/) || [])[1];
      return route.fulfill({ status: 302, headers: { Location: `https://musicbrainz.org/recording/${mbid}` } });
    }
    return route.continue();
  });
  await page.addInitScript((autoStart) => {
    const store = new Map();
    store.set('falcon:autoStartHarmonyImport', autoStart);
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  }, autoStart);
  // Seed the pending token, then set the URL via history.replaceState — NOT
  // a second page.goto — since a real navigation re-runs addInitScript and
  // wipes the in-page GM mock store, losing the token we just seeded. The
  // boot code only runs once, at script-injection time, reading
  // location.search directly, so replaceState is enough to make it see the
  // param without an actual reload.
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  if (page.url().includes('/login')) { console.log('NOT LOGGED IN'); await ctx.close(); process.exit(3); }
  const token = await page.evaluate(() => Math.random().toString(36).slice(2));
  const tuples = [{ entityType: 'recording', mbid: RECORDING, url: 'https://example.com/auto-start-test', linkTypeId: null }];
  await page.evaluate(({ token, tuples }) => {
    window.GM_setValue('falcon:pending:' + token, JSON.stringify(tuples));
    history.replaceState(null, '', '/?falcon=' + token);
  }, { token, tuples });
  await page.waitForTimeout(200);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page.waitForTimeout(1500);
  const state = await page.evaluate(() => window.__falconTest.getQueue().map(i => i.status));
  return { state, errs, page };
}

// 1. autoStart ON + Harmony-sourced (token scheme) seed -> the queue actually runs.
{
  const { state, errs } = await bootWithToken({ autoStart: true });
  console.log('autoStart=ON, token scheme, item status after boot:', JSON.stringify(state));
  ck(state.length === 1 && state[0] !== 'queued', `the item left 'queued' on its own — start() was auto-triggered (got "${state[0]}")`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
}

// 2. autoStart OFF (default) + Harmony-sourced seed -> queued, waits for a manual Start.
{
  const { state, errs } = await bootWithToken({ autoStart: false });
  console.log('autoStart=OFF, token scheme, item status after boot:', JSON.stringify(state));
  ck(state.length === 1 && state[0] === 'queued', `the item stays 'queued' — no auto-start when the option is off (default) (got "${state[0]}")`);
  ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
}

// 3. autoStart ON, but a base64-scheme (non-Harmony) seed -> still just queued.
{
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(() => {
    const store = new Map();
    store.set('falcon:autoStartHarmonyImport', true);
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page.goto('https://musicbrainz.org/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.addScriptTag({ content: code });
  await page.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  const payload = await page.evaluate((RECORDING) => window.__falconTest.encodeFalconPayload([{ entityType: 'recording', mbid: RECORDING, url: 'https://example.com/base64-test', linkTypeId: null }]), RECORDING);
  await page.close();

  const page2 = await ctx.newPage();
  const errs2 = []; page2.on('pageerror', e => errs2.push(e.message));
  await page2.addInitScript(() => {
    const store = new Map();
    store.set('falcon:autoStartHarmonyImport', true);
    window.GM_getValue = (k, d) => store.has(k) ? store.get(k) : d;
    window.GM_setValue = (k, v) => store.set(k, v);
    window.GM_deleteValue = k => store.delete(k);
    window.GM_info = { script: { name: 'Falcon', version: 't' } };
  });
  await page2.goto('https://musicbrainz.org/?falcon=' + encodeURIComponent(payload), { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(400);
  await page2.addScriptTag({ content: code });
  await page2.waitForFunction(() => !!window.__falconTest, { timeout: 5000 });
  await page2.waitForTimeout(1000);
  const state = await page2.evaluate(() => window.__falconTest.getQueue().map(i => i.status));
  console.log('autoStart=ON, base64 scheme (not Harmony), item status after boot:', JSON.stringify(state));
  ck(state.length === 1 && state[0] === 'queued', `a base64-scheme seed never auto-starts, even with the option on (got "${state[0]}")`);
  ck(errs2.length === 0, 'no page errors: ' + JSON.stringify(errs2.slice(0, 3)));
}

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
