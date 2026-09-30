#!/usr/bin/env node
// Regenerate everything the pre-commit hook builds (#646): the shared blocks inlined into the
// scripts (icons, design tokens, UI components, artist matching, the request gate), Credit
// Hoarder's dist/ and the String Theory bundle with its DOCS.md.
//
//   node dev/regen.mjs           rebuild; keep what really changed (CI's build job commits it)
//   node dev/regen.mjs --check   the same, then fail if anything changed (pull requests)
//
// The hook rebuilds only what a commit touches; this rebuilds everything, so a commit made
// without the hook (the web editor, another machine, --no-verify, a merge) comes out complete.
// A rebuild with nothing new still stamps a fresh @version and "Built" date: a file whose only
// change is such a stamp is put back as committed, so an unchanged build commits nothing.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32', ...opts });
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const OUTPUTS = /^userscripts\//;   // what a regeneration writes; nothing else is looked at
const dirty = () => git('status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean).map(l => l.slice(3)).filter(f => OUTPUTS.test(f));
const before = new Set(dirty());
if (before.size) console.log(`regen: already modified, left as they are: ${[...before].join(', ')}`);

const SYNCS = ['dev/ui/sync-icons.mjs', 'dev/tokens/sync-tokens.mjs', 'dev/ui/sync-ui.mjs', 'dev/match/sync-match.mjs', 'dev/net/sync-gate.mjs'];
for (const s of SYNCS) run('node', [s]);
run('pnpm', ['run', 'build'], { cwd: resolve(ROOT, 'userscripts/credit_hoarder') });   // after the syncs: it imports dev/match and dev/net
run('node', ['userscripts/string_theory/build.mjs']);                                  // last: it bundles the members synced above

// the build stamps: a version (2026.9.30, 2026.9.30.224334, "v2026.9.30.224334") and DOCS.md's "Built 2026-09-30 22:43"
const unstamped = t => t.replace(/\r\n/g, '\n').replace(/(?<![\d.])20\d\d\.\d{1,2}\.\d{1,2}(?:\.\d{6})?(?![\d.])/g, 'V').replace(/Built 20\d\d-\d\d-\d\d \d\d:\d\d/g, 'Built T');
const changed = [];
for (const f of dirty()) {
  if (before.has(f)) continue;
  const committed = git('show', `HEAD:${f}`), now = readFileSync(resolve(ROOT, f), 'utf8');
  if (unstamped(committed) === unstamped(now)) git('checkout', '--', f);   // only a new stamp
  else changed.push(f);
}
if (!changed.length) { console.log('regen: everything is current'); process.exit(0); }
console.log(`regen: rebuilt ${changed.length} file(s):\n  ${changed.join('\n  ')}`);
if (CHECK) {
  for (const f of changed) console.log(`::error file=${f}::not regenerated from its sources — run node dev/regen.mjs (or commit with the pre-commit hook) and commit the result`);
  process.exit(1);
}
