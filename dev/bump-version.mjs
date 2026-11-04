#!/usr/bin/env node
/**
 * Raise a userscript's @version from the real clock, never from a guess.
 *
 *   node dev/bump-version.mjs                 # every script with uncommitted changes (staged or not)
 *   node dev/bump-version.mjs falcon fusion   # these scripts (folder names or .user.js paths)
 *
 * The new version is the local date and time, YYYY.MM.DD.HHMMSS. When the file, or origin/main's copy
 * of it, already holds a higher version (a clock that ran ahead, a parallel session), it is raised by
 * one second past the highest instead, so it never goes backwards and never jumps ahead on its own.
 * Built files (dist/) and the String Theory bundle stamp their own version and are skipped.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VER = /^(\/\/\s*@version\s+)(\S+)/m;
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const tryGit = (...a) => { try { return git(...a); } catch { return ''; } };
const skip = p => /(^|\/)dist\//.test(p) || p.startsWith('userscripts/string_theory/');

/** Every hand-versioned .user.js under userscripts/, repo-relative. */
function allScripts(dir = 'userscripts', out = []) {
  for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) allScripts(p, out);
    else if (p.endsWith('.user.js') && !skip(p)) out.push(p);
  }
  return out;
}

function targets(args) {
  const all = allScripts();
  if (!args.length) {
    const changed = (tryGit('diff', '--name-only', 'HEAD') + '\n' + tryGit('ls-files', '--others', '--exclude-standard', 'userscripts'))
      .split('\n').filter(Boolean);
    // a script counts as changed when any file in its folder changed (nested scripts claim their own folder)
    const owner = f => all.filter(s => f.startsWith(dirname(s) + '/')).sort((a, b) => b.length - a.length)[0];
    return [...new Set(changed.map(owner).filter(Boolean))];
  }
  return args.map(a => {
    const p = a.endsWith('.user.js') ? relative(ROOT, resolve(a)).replace(/\\/g, '/') : `userscripts/${a}/${a}.user.js`;
    if (!existsSync(resolve(ROOT, p))) throw new Error(`no such script: ${a} (${p})`);
    if (skip(p)) throw new Error(`${p} is built; its build stamps the version`);
    return p;
  });
}

const parts = v => v.split('.').map(Number);
function cmp(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? -1) - (y[i] ?? -1); if (d) return d; }
  return 0;
}
const pad = n => String(n).padStart(2, '0');
const stamp = d => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
/** One second past version v (a bare date counts as its first second). */
function nextAfter(v) {
  const [y, mo, d, t = 0] = parts(v), s = String(t).padStart(6, '0');
  return stamp(new Date(y, mo - 1, d, +s.slice(0, 2), +s.slice(2, 4), +s.slice(4, 6) + (v.split('.').length > 3 ? 1 : 0)));
}

let files;
try { files = targets(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(1); }
if (!files.length) { console.log('nothing to bump: no script has uncommitted changes'); process.exit(0); }
const now = stamp(new Date());
for (const p of files) {
  const file = resolve(ROOT, p), src = readFileSync(file, 'utf8'), m = src.match(VER);
  if (!m) { console.warn(`${p}: no @version line, skipped`); continue; }
  const onMain = (tryGit('show', `origin/main:${p}`).match(VER) || [])[2];
  const high = [m[2], onMain].filter(Boolean).sort(cmp).pop();
  const next = cmp(now, high) > 0 ? now : nextAfter(high);
  writeFileSync(file, src.replace(VER, `$1${next}`));
  console.log(`${p}: ${m[2]} → ${next}${next !== now ? ' (above the higher version already out, not the clock)' : ''}`);
}
