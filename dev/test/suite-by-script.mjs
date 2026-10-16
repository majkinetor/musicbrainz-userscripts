#!/usr/bin/env node
// The whole suite, one Playwright project (script) at a time, for the suite skill
// (.claude/skills/suite). Each project gets its own output folder and JSON report, so a
// recheck of one script can run beside the next one without either wiping the other's.
//
//   node dev/test/suite-by-script.mjs [--from <project>] [--only a,b] [-- <playwright args>]
//
// Prints "=== <project> start" and "=== <project> done <passed> passed, <failed> failed,
// <skipped> skipped" around Playwright's own list output; a failed spec shows as a ✘ line.
// Reports: test-results/suite/<project>.json, artifacts in test-results/suite/<project>/.
import { readdirSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const dash = argv.indexOf('--');
const own = dash < 0 ? argv : argv.slice(0, dash), extra = dash < 0 ? [] : argv.slice(dash + 1);
const opt = name => { const i = own.indexOf(name); return i < 0 ? null : own[i + 1]; };

// The same projects as playwright.config.mjs, in its order
const scripts = readdirSync(resolve(REPO, 'userscripts'), { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(REPO, 'userscripts', d.name, 'test'))
    && readdirSync(resolve(REPO, 'userscripts', d.name, 'test')).some(f => f.endsWith('.spec.mjs')))
  .map(d => d.name);
let projects = ['harness', 'ui', 'net', 'imgmax', 'mbpage', ...scripts];
if (opt('--only')) projects = opt('--only').split(',');
if (opt('--from')) projects = projects.slice(Math.max(0, projects.indexOf(opt('--from'))));

const out = resolve(REPO, 'test-results', 'suite');
mkdirSync(out, { recursive: true });
const total = { passed: 0, failed: 0, skipped: 0 };
for (const p of projects) {
  console.log(`=== ${p} start`);
  const json = resolve(out, `${p}.json`);
  spawnSync(process.execPath, [resolve(REPO, 'node_modules/@playwright/test/cli.js'), 'test', `--project=${p}`, '--reporter=list,json', `--output=${resolve(out, p)}`, ...extra], {
    cwd: REPO, stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: json },
  });
  let s = {};
  try { s = JSON.parse(readFileSync(json, 'utf8')).stats || {}; } catch { /* no report: counted as nothing */ }
  const n = { passed: (s.expected || 0) + (s.flaky || 0), failed: s.unexpected || 0, skipped: s.skipped || 0 };
  for (const k in n) total[k] += n[k];
  console.log(`=== ${p} done ${n.passed} passed, ${n.failed} failed, ${n.skipped} skipped`);
}
console.log(`=== all done ${total.passed} passed, ${total.failed} failed, ${total.skipped} skipped`);
