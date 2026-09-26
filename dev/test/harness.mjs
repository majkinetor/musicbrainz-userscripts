// Shared Playwright Test harness for every userscript's specs (#625).
//
//   import { test, expect, check } from '../../../dev/test/harness.mjs';
//   test('what it proves', { tag: '@sandbox' }, async ({ page, inject }) => { … });
//
// Each test gets:
//   context / page — the shared logged-in profile (.pw-profile), or a throwaway
//                    one with test.use({ profile: 'fresh' }).
//   inject(name)   — loads userscripts/<name>/<name>.user.js into the page.
//                    <NAME>_SRC=<file> runs the spec against another build: that
//                    is how a regression test is shown to fail on the broken one.
//   the GM shim    — GM_getValue/SetValue (in-memory), GM_info, GM_xmlhttpRequest
//                    (fetch-backed, or a no-op with gm.xhr: 'none'), unsafeWindow.
//   a production write guard, always on — see below.
//   page errors fail the test (test.use({ pageErrors: 'ignore' }) to opt out, or
//                    pageErrors: [regex sources] to let only those through).
//
// The guard itself lives in guard.mjs; see there.
//
// Tags: @unit (no network: pure functions, stub pages), @prod (read-only on musicbrainz.org), @sandbox
// (test.musicbrainz.org, may write), @web (another live site, read-only: Bandcamp, Discogs…),
// @login (needs the logged-in profile), @critical (the quick run: pnpm test --grep @critical).
import { test as base, expect, chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { installProdGuard, hostOf } from './guard.mjs';

export { expect };
export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROFILE = resolve(REPO, '.pw-profile');
export const PROD = 'https://musicbrainz.org';
export const SANDBOX = 'https://test.musicbrainz.org';

// A soft assertion with a readable message, so one failing check doesn't hide
// the rest (the ck() every old test carried).
export const check = (cond, msg) => expect.soft(!!cond, msg).toBe(true);

// Where each userscript's built source lives (default: userscripts/<name>/<name>.user.js).
const SOURCES = {
  credit_hoarder: 'userscripts/credit_hoarder/dist/credit_hoarder.user.js',
  as_picker: 'userscripts/art_station/as_picker/as_picker.user.js',
};
// Older tests used these names for the source override; they keep working.
const LEGACY_SRC_ENV = { apollo_editor: 'APOLLO_SRC', group_therapy: 'GT_SRC', credit_hoarder: 'CH_SRC' };
export function sourceOf(name) {
  const env = process.env[name.toUpperCase() + '_SRC'] || (LEGACY_SRC_ENV[name] && process.env[LEGACY_SRC_ENV[name]]);
  return env ? resolve(env) : resolve(REPO, SOURCES[name] || `userscripts/${name}/${name}.user.js`);
}

export const test = base.extend({
  // options — override per file with test.use({ … })
  profile: ['logged-in', { option: true }],   // 'logged-in' → .pw-profile · 'fresh' → a throwaway profile
  gm: [{}, { option: true }],                   // { name, version, values, persist, xhr: 'fetch' | 'none' } · false = no GM shim
  prodWrites: ['fail', { option: true }],       // 'fail' · 'block' (refused silently; read the blockedWrites fixture)
  prodPostAllow: [[], { option: true }],        // extra production paths (regex sources) a POST may reach
  pageErrors: ['fail', { option: true }],       // 'fail' · 'ignore' · [regex sources]: fail on any other

  // every production write the guard refused (layer 1 or 2); a spec using 'block' reads it
  blockedWrites: async ({}, use) => { await use([]); },

  context: async ({ headless, viewport, deviceScaleFactor, profile, gm, prodWrites, prodPostAllow, pageErrors, blockedWrites: refused }, use, testInfo) => {
    const ctx = await chromium.launchPersistentContext(profile === 'fresh' ? '' : PROFILE, { headless, viewport, deviceScaleFactor });
    const errors = [];
    const guard = await installProdGuard(ctx, { allow: prodPostAllow, gm: gm === false ? null : gm, onRefused: w => refused.push(w) });
    const watch = p => p.on('pageerror', e => errors.push(e.message));
    ctx.pages().forEach(watch); ctx.on('page', watch);

    await use(ctx);

    const failed = testInfo.status !== testInfo.expectedStatus;
    if (failed) for (const p of ctx.pages()) {
      try { await testInfo.attach('page ' + p.url(), { body: await p.screenshot(), contentType: 'image/png' }); } catch (e) { /* page already gone */ }
    }
    await ctx.close();
    const leaked = guard.leaked();
    expect(leaked, 'writes that reached PRODUCTION MusicBrainz — the guard has a hole').toEqual([]);
    if (prodWrites === 'fail') expect(refused.map(w => `${w.method} ${w.url} (${w.via})`), 'the test tried to write to production MusicBrainz (refused)').toEqual([]);
    const letThrough = Array.isArray(pageErrors) ? pageErrors.map(r => new RegExp(r)) : [];
    if (pageErrors !== 'ignore') expect(errors.filter(e => !letThrough.some(r => r.test(e))), 'page errors').toEqual([]);
  },
  page: async ({ context }, use) => { await use(context.pages()[0] || await context.newPage()); },

  inject: async ({ page }, use) => {
    await use(async (name, { waitFor, target = page, atStart = false } = {}) => {
      const file = sourceOf(name);
      const code = await readFile(file, 'utf8');
      if (atStart) await target.addInitScript({ content: code });
      else await target.addScriptTag({ content: code });
      if (waitFor && !atStart) await target.waitForFunction(g => !!window[g], waitFor, { timeout: 20000 });
      return { file, version: (code.match(/@version\s+(\S+)/) || [])[1] || '' };
    });
  },
});

// A MusicBrainz web-service read from Node (fixture lookups): sends a User-Agent
// (MB answers 403 without one) and waits out throttling (503/429, honouring
// Retry-After) instead of failing the test on the next line.
export async function mbJson(url, { tries = 6 } = {}) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'mb-userscripts-tests/1.0 ( https://github.com/majkinetor/musicbrainz-userscripts )' } });
    if (r.ok) return r.json();
    if ((r.status !== 503 && r.status !== 429) || i >= tries - 1) throw new Error(`${r.status} from ${url}`);
    const after = Number(r.headers.get('retry-after')) || 0;
    await new Promise(z => setTimeout(z, Math.max(after * 1000, 1000 * 2 ** i)));
  }
}

// A script's pure helpers, evaluated in Node — for @unit specs of functions that
// need no page. Each name must be a `function name(…) { … }` declaration, or a
// one-line `const name = …;` helper, in the script; they are evaluated together, so
// one may call another. Anything they use beyond each other and the JS built-ins
// isn't available, and evaluating fails.
//   const { normName } = await loadFunctions('fusion', ['normName']);
export async function loadFunctions(name, names) {
  const code = (await readFile(sourceOf(name), 'utf8')).replace(/\r\n/g, '\n');
  const bodies = names.map(n => {
    let at = code.search(new RegExp('(^|\\n)[ \\t]*function ' + n + '\\s*\\('));
    if (at < 0) {
      at = code.search(new RegExp('(^|\\n)[ \\t]*const ' + n + '\\s*='));
      if (at < 0) throw new Error(`loadFunctions: no "function ${n}(" or "const ${n} =" in ${name}`);
      const line = code.slice(at).replace(/^\n/, '');
      return line.slice(0, line.indexOf('\n') < 0 ? line.length : line.indexOf('\n'));
    }
    const open = code.indexOf('{', code.indexOf(')', at));
    let depth = 0, i = open;
    for (; i < code.length; i++) { if (code[i] === '{') depth++; else if (code[i] === '}' && --depth === 0) break; }
    return code.slice(at, i + 1);
  });
  return new Function(bodies.join('\n') + `\nreturn { ${names.join(', ')} };`)();
}

// A screenshot of a page or locator, attached to the test's report. Never fails the
// test: the element may be gone by the time it's taken.
export async function attachShot(testInfo, target, name) {
  try { await testInfo.attach(name, { body: await target.screenshot(), contentType: 'image/png' }); } catch (e) { /* nothing to show */ }
}

// Skip (not fail) when the profile isn't logged in to the site the page is on.
export async function requireLogin(page) {
  const out = page.url().includes('/login') || await page.evaluate(() => !document.querySelector('a[href*="/logout"]'));
  test.skip(out, 'the test profile is not logged in to ' + hostOf(page.url()) + ' (node dev/test/login.mjs)');
}
