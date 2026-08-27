// majkinetor, with a screenshot of LastPass's icon sitting inside the
// "Credited as" box in the review table: a bare `<input type="text">` next to a
// label is enough for LastPass (and 1Password, Bitwarden, Dashlane) to treat it
// as a credentials field — it covers the text with its overlay and offers to
// autofill, which in a credit name is worse than the icon.
//
// Group Therapy already opts every input it creates out of this (#522); Credit
// Hoarder now does the same through one helper.
//
// Two checks, deliberately: the helper does what it claims, AND no text input
// in the source skips it — the second is what stops the next input added here
// from quietly reintroducing the problem.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// ── 1. the helper itself, against a minimal element stub ────────────────────
const attrs = {};
const el = {
  autocomplete: '',
  setAttribute(k, v) { attrs[k] = v; },
  getAttribute(k) { return attrs[k]; },
};
globalThis.document = { createElement: () => ({ ...el, setAttribute: el.setAttribute, getAttribute: el.getAttribute }) };
const { noPasswordManagers } = await import('../src/util.js');
noPasswordManagers(el);
console.log('attributes set: ' + JSON.stringify({ autocomplete: el.autocomplete, ...attrs }));
ck(el.autocomplete === 'off', 'autocomplete is off');
ck(attrs['data-lpignore'] === 'true', 'LastPass is told to ignore it (the reported one)');
ck(attrs['data-1p-ignore'] === 'true', '1Password too');
ck(attrs['data-bwignore'] === 'true', 'Bitwarden too');
ck(attrs['data-form-type'] === 'other', 'and Dashlane');

// ── 2. no text input in the source escapes it ───────────────────────────────
const files = (await readdir(SRC, { recursive: true })).filter(f => f.endsWith('.js'));
const offenders = [];
for (const f of files) {
  const path = join(SRC, f);
  const text = await readFile(path, 'utf8');
  const lines = text.split(String.fromCharCode(10));
  lines.forEach((line, i) => {
    if (!/createElement\(['"]input['"]\)/.test(line)) return;
    if (/noPasswordManagers/.test(line)) return;                 // wrapped
    if (f === 'util.js') return;                                 // the helper's own factory
    // a checkbox/radio is never mistaken for a credentials field
    const next = (lines[i + 1] || '') + (lines[i + 2] || '');
    if (/type\s*=\s*['"](checkbox|radio)['"]/.test(next)) return;
    offenders.push(`${f}:${i + 1}  ${line.trim()}`);
  });
}
console.log('unwrapped text inputs: ' + (offenders.length ? String.fromCharCode(10) + '   ' + offenders.join(String.fromCharCode(10) + '   ') : 'none'));
ck(offenders.length === 0, 'every text input in src/ goes through the helper');

// ── 3. and it survives the build ────────────────────────────────────────────
const dist = await readFile(resolve(HERE, '..', 'dist', 'credit_hoarder.user.js'), 'utf8');
ck(/data-lpignore/.test(dist), 'the built script carries the opt-out (the build is what actually ships)');
const count = (dist.match(/noPasswordManagers\(/g) || []).length;
console.log('helper call sites in dist: ' + count);
ck(count >= 4, `every review-table input is wrapped in the build (${count} call sites)`);

console.log(fail ? ('FAILURES: ' + fail) : 'ALL PASS');
process.exit(fail ? 1 : 0);
