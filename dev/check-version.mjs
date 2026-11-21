#!/usr/bin/env node
/**
 * Pre-commit guard: a staged userscript's @version must be what dev/bump-version.mjs writes.
 *
 *   node dev/check-version.mjs <file.user.js>…
 *
 * A version is refused when it is not a real date and time (YYYY.MM.DD.HHMMSS, no hour 24),
 * or when it is ahead of both the clock and the version already out (HEAD or origin/main)
 * by more than a few minutes. Hand-typed round steps (.242000 → .243000 is one hour) once
 * pushed every version a day ahead, and a version can never come back down.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const VER = /^\/\/\s*@version\s+(\S+)/m;
const SLACK = 10 * 60 * 1000;
const tryGit = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; } };
const pad = n => String(n).padStart(2, '0');
const stamp = d => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
/** Date of a stamp, or null when the stamp is not a real local date and time. */
function toDate(v) {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})(?:\.(\d{2})(\d{2})(\d{2}))?$/.exec(v || '');
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  if (m[4] === undefined) return stamp(d).startsWith(v) ? d : null;
  return stamp(d) === v ? d : null;
}

let bad = 0;
const now = Date.now();
for (const f of process.argv.slice(2)) {
  if (!existsSync(f)) continue;
  const staged = (tryGit('show', `:${f}`) || readFileSync(f, 'utf8')).match(VER)?.[1];
  if (!staged) continue;
  const old = ['HEAD', 'origin/main'].map(r => tryGit('show', `${r}:${f}`).match(VER)?.[1]).filter(Boolean);
  if (old.includes(staged)) continue; // unchanged
  const d = toDate(staged);
  if (!d) { console.error(`[pre-commit] ${f}: @version ${staged} is not a real date and time`); bad++; continue; }
  const high = Math.max(now, ...old.map(toDate).filter(Boolean).map(x => x.getTime() + 1000));
  if (d.getTime() > high + SLACK) {
    console.error(`[pre-commit] ${f}: @version ${staged} is ahead of the clock and of the version already out`);
    bad++;
  }
}
if (bad) {
  console.error('[pre-commit] set @version with `node dev/bump-version.mjs <script>`, never by hand — nothing committed');
  process.exit(1);
}
