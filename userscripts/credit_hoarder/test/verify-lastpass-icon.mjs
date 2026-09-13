// majkinetor: "CH credited as field has LastPass icon" — with a screenshot of
// LastPass's red icon sitting inside the "Credited as" box.
//
// This is the SECOND report of it. The first was fixed in 2026.8.28 by adding
// every documented opt-out (`data-lpignore`, `data-1p-ignore`, `data-bwignore`,
// `data-form-type`, `autocomplete=off`), and his build carries all of them — so
// his LastPass is ignoring its own documented attribute and no further attribute
// will help. What does help is not being the kind of field a password manager
// looks at: they classify text/email/tel/password and skip `search`.
//
// LIMIT, stated rather than implied: LastPass cannot be installed here, so the
// suppression itself is reasoned, not measured. What IS measured is everything
// under our control — that every input the review table builds carries the
// attributes AND the type, that the search styling is neutralised so the change
// is invisible, and that the two parallel scripts agree.
//
// No network, no browser for the source checks; the DOM half runs on a blank
// page, since the helper is pure.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/package.json');
const { chromium } = require('playwright');
const HERE = dirname(fileURLToPath(import.meta.url));
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

const ATTRS = ['data-lpignore', 'data-1p-ignore', 'data-bwignore', 'data-form-type'];

for (const name of ['credit_hoarder', 'discogs_credits']) {
  console.log(`\n══ ${name}`);
  const root = resolve(HERE, '..', '..', name);
  const util = await readFile(resolve(root, 'src', 'util.js'), 'utf8');
  const table = await readFile(resolve(root, 'src', 'review-table.js'), 'utf8');
  const dist = await readFile(resolve(root, 'dist', `${name}.user.js`), 'utf8');

  ATTRS.forEach(a => ck(util.includes(a), `${name}: the helper still sets ${a}`));
  ck(/el\.type = 'search'/.test(util), `${name}: …and types the input so a password manager skips it`);

  /* Every input the review table makes must go through the helper. Counting the
     call sites rather than trusting one: a new input that forgets is exactly how
     the first fix would rot. */
  const created = (table.match(/document\.createElement\('input'\)/g) || []).length;
  const wrapped = (table.match(/noPasswordManagers\(document\.createElement\('input'\)\)/g) || []).length;
  ck(created > 0 && created === wrapped, `${name}: every review-table input goes through the helper (${wrapped}/${created})`);

  /* The call sites used to set `.type = 'text'` on the line after, which would
     undo the helper's type. None may do that again. */
  const overrides = (table.match(/\.type = 'text';/g) || []).length;
  ck(overrides === 0, `${name}: no call site overrides the type back to text (${overrides})`);

  // and the built file carries it, since that is what he installs
  ck(dist.includes('ch-nopw') && /type = "search"/.test(dist), `${name}: the built bundle carries the fix`);
}

/* ── the change has to be invisible ─────────────────────────────────────────
   A search input is drawn with a clear button and its own inner spacing in
   Chrome; if that showed, the cure would be worse than the icon. */
const ui = await readFile(resolve(HERE, '..', 'src', 'ui-bar.js'), 'utf8');
ck(/input\.ch-nopw \{ -webkit-appearance: textfield/.test(ui), 'the search appearance is reset to a plain text box');
ck(/ch-nopw::-webkit-search-cancel-button/.test(ui), 'and the clear button is hidden');
// the CSS lives in a JS template literal — a backtick in the comment ends it,
// which is exactly how the first attempt at this broke the build
ck(!/input\.ch-nopw[\s\S]{0,400}`/.test(ui.slice(ui.indexOf('input.ch-nopw') - 400, ui.indexOf('input.ch-nopw') + 400).replace(/`;[\s\S]*$/, '')),
  'no backtick was introduced inside the CSS template literal');

/* ── the helper, exercised ──────────────────────────────────────────────── */
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
const src = (await readFile(resolve(HERE, '..', 'src', 'util.js'), 'utf8'))
  .match(/export function noPasswordManagers\(el\) \{[\s\S]*?\n\}/)[0].replace('export function', 'function');
const res = await page.evaluate(([fn, attrs]) => {
  // eslint-disable-next-line no-new-func
  const noPasswordManagers = new Function(fn + '; return noPasswordManagers;')();
  const el = noPasswordManagers(document.createElement('input'));
  document.body.appendChild(el);
  const got = {};
  attrs.forEach(a => { got[a] = el.getAttribute(a); });
  const cs = getComputedStyle(el);
  return {
    attrs: got, type: el.type, autocomplete: el.autocomplete,
    cls: el.className,
    // a checkbox must be left alone — retyping one would break it
    checkbox: (() => { const c = document.createElement('input'); c.type = 'checkbox'; noPasswordManagers(c); return c.type; })(),
    appearance: cs.webkitAppearance || cs.appearance,
  };
}, [src, ATTRS]);
console.log('\n══ helper output:', JSON.stringify(res));
ATTRS.forEach(a => ck(res.attrs[a] != null, `a built input carries ${a}=${res.attrs[a]}`));
ck(res.type === 'search', `…and is typed search (${res.type})`);
ck(res.autocomplete === 'off', `…with autocomplete off (${res.autocomplete})`);
ck(res.cls.includes('ch-nopw'), 'and is tagged for the appearance reset');
ck(res.checkbox === 'checkbox', `a checkbox is left alone (${res.checkbox})`);

await browser.close();
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
