// majkinetor, twice, with a screenshot of LastPass's icon inside the review table's
// "Credited as" box. A bare `<input type="text">` next to a label is enough for LastPass
// (and 1Password, Bitwarden, Dashlane) to treat it as a credentials field: it covers
// the text with its overlay and offers to autofill a credit name.
//
// The first fix added every documented opt-out (data-lpignore, data-1p-ignore,
// data-bwignore, data-form-type, autocomplete=off); his LastPass ignored its own
// attribute. The second makes the inputs a kind password managers skip: type=search,
// with the search styling reset so nothing looks different. LastPass can't be
// installed here, so the suppression itself is reasoned, not measured; what is
// measured is everything under our control.
//
// No MusicBrainz: the source, the build, and the helper on a blank page.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, check, REPO, sourceOf } from '../../../dev/test/harness.mjs';

const ATTRS = ['data-lpignore', 'data-1p-ignore', 'data-bwignore', 'data-form-type'];
const SRC = join(REPO, 'userscripts/credit_hoarder/src');
test.use({ profile: 'fresh', gm: false });

test('every text input Credit Hoarder makes is one password managers leave alone', { tag: ['@unit'] }, async ({ page }) => {
  // every text input in src/ goes through the helper
  const offenders = [];
  for (const f of (await readdir(SRC, { recursive: true })).filter(f => f.endsWith('.js'))) {
    const lines = (await readFile(join(SRC, f), 'utf8')).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/createElement\(['"]input['"]\)/.test(line) || /noPasswordManagers/.test(line) || f === 'util.js') return;
      // a checkbox or radio is never mistaken for a credentials field
      if (/type\s*=\s*['"](checkbox|radio)['"]/.test((lines[i + 1] || '') + (lines[i + 2] || ''))) return;
      offenders.push(`${f}:${i + 1}  ${line.trim()}`);
    });
  }
  check(offenders.length === 0, `every text input goes through noPasswordManagers (unwrapped: ${offenders.join(' | ') || 'none'})`);

  const util = await readFile(join(SRC, 'util.js'), 'utf8');
  const table = await readFile(join(SRC, 'review-table.js'), 'utf8');
  ATTRS.forEach(a => check(util.includes(a), `the helper sets ${a}`));
  check(/el\.type = 'search'/.test(util), '…and types the input search');
  check((table.match(/\.type = 'text';/g) || []).length === 0, 'no review-table call site sets the type back to text');
  const dist = await readFile(sourceOf('credit_hoarder'), 'utf8');
  check(dist.includes('ch-nopw') && /type = "search"/.test(dist) && /data-lpignore/.test(dist), 'the built script carries all of it');

  // the change has to be invisible
  const ui = await readFile(join(SRC, 'ui-bar.js'), 'utf8');
  check(/input\.ch-nopw \{ -webkit-appearance: textfield/.test(ui), 'the search appearance is reset to a plain text box');
  check(/ch-nopw::-webkit-search-cancel-button/.test(ui), 'and its clear button is hidden');

  // the helper, on a real input
  await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
  const fn = util.match(/export function noPasswordManagers\(el\) \{[\s\S]*?\n\}/)[0].replace('export function', 'function');
  const res = await page.evaluate(([fn, attrs]) => {
    const noPasswordManagers = new Function(fn + '; return noPasswordManagers;')();
    const el = noPasswordManagers(document.createElement('input'));
    document.body.appendChild(el);
    const got = {}; attrs.forEach(a => { got[a] = el.getAttribute(a); });
    const cb = document.createElement('input'); cb.type = 'checkbox'; noPasswordManagers(cb);
    return { attrs: got, type: el.type, autocomplete: el.autocomplete, cls: el.className, checkbox: cb.type };
  }, [fn, ATTRS]);
  ATTRS.forEach(a => check(res.attrs[a] != null, `an input gets ${a}=${res.attrs[a]}`));
  check(res.type === 'search' && res.autocomplete === 'off' && res.cls.includes('ch-nopw'), `…is typed search, autocomplete off, tagged for the reset (${JSON.stringify(res)})`);
  check(res.checkbox === 'checkbox', 'a checkbox is left alone');
});
