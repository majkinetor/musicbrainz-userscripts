// One-time baseline of the OLD standalone test scripts (#625): which pass today,
// before they are converted to specs. Each runs on its own, one at a time, under
// baseline-guard.mjs (the production write guard), and the outcome goes to
// test-results/baseline/report.{json,md}. Re-running resumes: finished entries are
// kept unless --fresh.
//
//   node dev/test/baseline.mjs [--fresh] [--only=<substring>]
import { spawn } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = resolve(REPO, 'test-results', 'baseline');
const LOGS = resolve(OUT, 'logs');
mkdirSync(LOGS, { recursive: true });
const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7);
const REPORT = resolve(OUT, 'report.json');
const done = !args.includes('--fresh') && existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : {};

// the old scripts: everything in a test/ folder except specs, one-off probes and helpers
const SKIP = /^(probe|_|shot|spike|login\b)|\.spec\.mjs$/i;
const FROZEN = new Set(['discogs_credits']);   // no longer developed — not part of the suite
const files = [];
for (const d of readdirSync(resolve(REPO, 'userscripts'))) {
  const dir = resolve(REPO, 'userscripts', d, 'test');
  if (FROZEN.has(d) || !existsSync(dir) || !statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir).sort()) if (f.endsWith('.mjs') && !SKIP.test(f)) files.push({ script: d, file: resolve(dir, f) });
}
const todo = files.filter(x => (!only || relative(REPO, x.file).includes(only)) && !done[relative(REPO, x.file)]);
console.log(`${files.length} old test scripts; ${todo.length} to run`);

const GUARD = pathToFileURL(resolve(REPO, 'dev', 'test', 'baseline-guard.mjs')).href;
function run({ script, file }) {
  return new Promise(ok => {
    const rel = relative(REPO, file), slug = rel.replace(/[\\/]/g, '__');
    const guardLog = resolve(LOGS, slug + '.guard.jsonl'), log = resolve(LOGS, slug + '.log');
    rmSync(guardLog, { force: true });   // the preload appends; a rerun must not re-read the last run's lines
    const long = /run\.mjs$|integration|529/.test(file);
    const limit = (long ? 45 : 15) * 60_000, t0 = Date.now();
    const child = spawn(process.execPath, ['--import', GUARD, file], {
      cwd: resolve(REPO, 'userscripts', script), env: { ...process.env, BASELINE_GUARD_LOG: guardLog }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, limit);
    child.on('close', code => {
      clearTimeout(timer);
      writeFileSync(log, out);
      const guard = existsSync(guardLog) ? readFileSync(guardLog, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
      const fails = (out.match(/^\s*(FAIL|✗|✘)\b.*$/gm) || []).map(s => s.trim().slice(0, 200));
      const status = timedOut ? 'timeout' : code === 0 ? 'pass' : code === 2 || code === 3 ? 'skip' : 'fail';
      const tail = out.trim().split('\n').slice(-4).join(' | ').slice(0, 400);
      ok({ rel, script, status, code, secs: Math.round((Date.now() - t0) / 1000), fails, prodWrites: guard, tail });
    });
  });
}

function report() {
  writeFileSync(REPORT, JSON.stringify(done, null, 1));
  const rows = Object.values(done).sort((a, b) => a.rel.localeCompare(b.rel));
  const count = s => rows.filter(r => r.status === s).length;
  const md = [`# Test baseline — ${new Date().toISOString().slice(0, 10)}`, '',
    `${rows.length} old test scripts: **${count('pass')} pass**, **${count('fail')} fail**, ${count('skip')} skipped, ${count('timeout')} timed out. ` +
    `${rows.filter(r => r.prodWrites.length).length} tried to write to production (refused).`, '',
    '| Script | Test | Result | s | Notes |', '|---|---|---|---|---|',
    ...rows.map(r => `| ${r.script} | ${r.rel.split(/[\\/]/).pop()} | ${r.status}${r.prodWrites.length ? ' ⚠ prod write' : ''} | ${r.secs} | ${(r.fails[0] || (r.status === 'pass' ? '' : r.tail)).replace(/\|/g, '\\|').slice(0, 160)} |`)];
  writeFileSync(resolve(OUT, 'report.md'), md.join('\n') + '\n');
}

for (const [i, x] of todo.entries()) {
  const r = await run(x);
  done[r.rel] = r; report();
  console.log(`[${i + 1}/${todo.length}] ${r.status.padEnd(7)} ${String(r.secs).padStart(4)}s  ${r.rel}${r.prodWrites.length ? '  ⚠ ' + r.prodWrites.length + ' production write(s) refused' : ''}`);
}
report();
console.log('report: ' + relative(REPO, resolve(OUT, 'report.md')));
