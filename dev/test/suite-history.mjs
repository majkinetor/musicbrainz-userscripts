#!/usr/bin/env node
// Every nightly suite run, kept (#647): what passed, what failed and why, what was flaky.
//
//   node dev/test/suite-history.mjs <results.json> <history.json> [--badge suite.json] [--commit sha] [--run url]
//
// <results.json> is Playwright's JSON report of the run (PW_JSON=<file> turns it on in
// playwright.config.mjs); a missing or unreadable one is recorded as a run that produced no
// report. <history.json> gains the run, newest first, keyed by its UTC start time:
//
//   "2026-09-30 02:00:14": {
//     "passed": 320, "failed": 2, "flaky": 1, "skipped": 4, "color": "orange",
//     "minutes": 124, "commit": "8136e0f", "run": "https://github.com/…/actions/runs/…",
//     "failures": [{ "name": "[isrc_scout] 640-ytmusic.spec.mjs › #640: …", "error": "Error: …" }],
//     "flakes":   [{ "name": "…", "error": "the error of the attempt that failed" }]
//   }
//
// --badge also writes the shields.io badge the README shows (the numbers of this run).
// dev/test/flaky-report.mjs reads the history back: which specs keep failing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const [resultsFile, historyFile] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));
const opt = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
if (!resultsFile || !historyFile) { console.error('usage: suite-history.mjs <results.json> <history.json> [--badge file] [--commit sha] [--run url]'); process.exit(2); }

const ansi = s => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
// an error in a line or four (message, expected, received): the message, without the stack or the code frame
const brief = err => {
  if (!err) return '';
  const lines = ansi(err.message || err.value || err).split('\n').map(l => l.trimEnd()).filter(l => l.trim());
  const keep = [];
  for (const l of lines) { if (/^\s+at |^\s*\d+ \||^\s*>?\s*\d+ \|/.test(l)) break; keep.push(l.trim()); if (keep.length === 4) break; }
  return keep.join(' · ').slice(0, 400);
};

// the run: counts from the report's stats, the failed and flaky tests from its suites
function summarise(report) {
  const out = { failures: [], flakes: [] };
  const walk = (suite, path) => {
    for (const s of suite.suites || []) walk(s, s.title ? [...path, s.title] : path);
    for (const spec of suite.specs || []) for (const t of spec.tests || []) {
      if (t.status !== 'unexpected' && t.status !== 'flaky') continue;
      const name = `[${t.projectName}] ${[...path, spec.title].join(' › ')}`.replace(/\\/g, '/');   // one name on every OS
      const results = t.results || [];
      const bad = t.status === 'flaky' ? results.find(r => r.status !== 'passed' && r.status !== 'skipped') : results[results.length - 1];
      const error = brief(bad && (bad.error || (bad.errors || [])[0]));
      (t.status === 'flaky' ? out.flakes : out.failures).push(error ? { name, error } : { name });
    }
  };
  for (const s of report.suites || []) walk(s, s.title ? [s.title] : []);
  const st = report.stats || {};
  return {
    start: st.startTime ? new Date(st.startTime) : new Date(),
    passed: st.expected || 0, failed: st.unexpected || 0, flaky: st.flaky || 0, skipped: st.skipped || 0,
    minutes: st.duration ? Math.round(st.duration / 60000) : null, ...out,
  };
}

let run;
try { run = summarise(JSON.parse(readFileSync(resultsFile, 'utf8'))); }
catch (e) { run = { start: new Date(), passed: 0, failed: 0, flaky: 0, skipped: 0, minutes: null, failures: [], flakes: [], error: `no report: ${String(e.message).split('\n')[0]}` }; }

const color = run.error ? 'red' : run.failed > 5 ? 'red' : run.failed ? 'orange' : run.flaky ? 'yellowgreen' : 'brightgreen';
const key = run.start.toISOString().replace('T', ' ').slice(0, 19);
const entry = {
  passed: run.passed, failed: run.failed, flaky: run.flaky, skipped: run.skipped, color,
  ...(run.minutes != null ? { minutes: run.minutes } : {}),
  ...(opt('--commit') ? { commit: opt('--commit').slice(0, 7) } : {}),
  ...(opt('--run') ? { run: opt('--run') } : {}),
  ...(run.error ? { error: run.error } : {}),
  failures: run.failures, flakes: run.flakes,
};

let history = {};
if (existsSync(historyFile)) { try { history = JSON.parse(readFileSync(historyFile, 'utf8') || '{}'); } catch (e) { console.warn(`suite-history: ${historyFile} unreadable, starting over (${e.message})`); } }
history = { [key]: entry, ...Object.fromEntries(Object.entries(history).filter(([k]) => k !== key)) };   // newest first
writeFileSync(historyFile, JSON.stringify(history, null, 2) + '\n');

const msg = run.error ? 'no report' : [`${run.passed} passed`, run.flaky && `${run.flaky} flaky`, run.failed && `${run.failed} failed`].filter(Boolean).join(', ');
if (opt('--badge')) writeFileSync(opt('--badge'), JSON.stringify({ schemaVersion: 1, label: 'suite', message: msg, color }) + '\n');
console.log(`suite-history: ${key} — ${msg} (${Object.keys(history).length} run(s) recorded)`);
for (const f of run.failures) console.log(`  ✗ ${f.name}${f.error ? '\n      ' + f.error : ''}`);
for (const f of run.flakes) console.log(`  ~ ${f.name}`);
