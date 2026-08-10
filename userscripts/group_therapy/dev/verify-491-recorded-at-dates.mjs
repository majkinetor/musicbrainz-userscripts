// #491 (vzell): Group Therapy's "Set relationship dates" tool pre-selected and stamped a date onto
// a recording→event "recorded at" relationship, flagging it as changed even though the user only
// meant to date the (unrelated) recording-engineer credits. Confirmed via the reporter's own
// screenshot of MB's native "Edit relationship" dialog: a recording→event "recorded at" AR shows NO
// Period (begin/end date) section at all — unlike recording→place "recorded at", which does — because
// the Event entity already carries its own date, so MB doesn't duplicate one onto the relationship.
// "recorded at" is a single default remembered role in the date picker (DATE_ROLES_DEFAULT), and since
// both the place- and event-targeted relationships share that exact display name, matching by name
// alone can't tell them apart.
//
// Fix: ltHasDates(linkTypeID) reads MB's own has_dates flag (confirmed field name from MB's server
// source, root/types/relationship.js) and openDatePicker()'s credits filter now excludes any
// relationship whose link type doesn't support dates at all — so a non-datable "recorded at" (event)
// can never appear in, be pre-selected by, or be stamped by this tool, regardless of name collisions.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
const code = await readFile(resolve(HERE, '..', 'group_therapy.user.js'), 'utf8');

const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', { headless: true, viewport: { width: 1200, height: 800 }, bypassCSP: true });
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const page = ctx.pages()[0] || await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
// any real /edit-relationships-shaped page works — this only exercises ltHasDates against synthetic
// W.MB.linkedEntities data, not any relationship actually present on the page.
await page.goto('https://musicbrainz.org/release/1bfa31f9-b196-4eb1-a805-e747a610372d', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(400);
await page.addScriptTag({ content: code });
await page.waitForFunction(() => !!window.__gtTest, { timeout: 10000 });

const result = await page.evaluate(() => {
  window.MB = window.MB || {};
  window.MB.linkedEntities = window.MB.linkedEntities || {};
  window.MB.linkedEntities.link_type = {
    100: { id: 100, name: 'recorded at', has_dates: true },    // recording-place "recorded at"
    101: { id: 101, name: 'recorded at', has_dates: false },   // recording-event "recorded at" — #491
    102: { id: 102, name: 'recording engineer', has_dates: true },
  };
  const { ltHasDates } = window.__gtTest;
  return {
    place: ltHasDates(100),            // datable — must stay true
    event: ltHasDates(101),            // NOT datable — must be false
    engineer: ltHasDates(102),         // datable — must stay true
    unknownType: ltHasDates(999),      // type not in the cache yet — default true (don't hide on a cache miss)
  };
});
console.log(JSON.stringify(result, null, 2));

ck(result.place === true, `recording-place "recorded at" (has_dates: true) stays datable (got ${result.place})`);
ck(result.event === false, `recording-event "recorded at" (has_dates: false) is correctly excluded (got ${result.event}) — the #491 bug`);
ck(result.engineer === true, `an unrelated datable type (recording engineer) is unaffected (got ${result.engineer})`);
ck(result.unknownType === true, `a link type not yet in the cache defaults to datable, not hidden (got ${result.unknownType})`);

ck(errs.length === 0, 'no page errors: ' + JSON.stringify(errs.slice(0, 3)));
console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
await ctx.close();
process.exit(fail ? 1 : 0);
