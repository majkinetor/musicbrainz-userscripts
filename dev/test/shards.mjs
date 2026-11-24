#!/usr/bin/env node
// Splits the Playwright projects (one per script, plus the shared parts) over CI's runners.
//
//   node dev/test/shards.mjs <count> <index>     → --project=a --project=b …   (index from 1)
//   node dev/test/shards.mjs <count>             → the whole split, with its minutes
//
// A script's specs stay on one runner: they share its fixtures, and the production readers
// (Event Horizon's @prod specs) stay together. The weights are the minutes each project's
// nightly specs took on one worker (2026-11); a project not listed counts 2 minutes. The
// biggest go first, each to the runner with the fewest minutes so far.
import { readdirSync, existsSync } from 'node:fs';

const MINUTES = {
  event_horizon: 25, apollo_editor: 24, falcon: 13, group_therapy: 7, credit_hoarder: 6, fusion: 5,
  mission_control: 4, platform_check: 4, string_theory: 4, art_station: 3, isrc_scout: 3,
  net: 1, ui: 1, harness: 1,
};
const shared = ['harness', 'ui', 'net', 'imgmax', 'mbpage', 'guesscase'];
const scripts = readdirSync('userscripts', { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(`userscripts/${d.name}/test`) && readdirSync(`userscripts/${d.name}/test`).some(f => f.endsWith('.spec.mjs')))
  .map(d => d.name);
const projects = [...shared, ...scripts];

const [count, index] = process.argv.slice(2).map(Number);
if (!(count >= 1)) { console.error('usage: shards.mjs <count> [index]'); process.exit(2); }
const shards = Array.from({ length: count }, () => ({ minutes: 0, projects: [] }));
for (const p of [...projects].sort((a, b) => (MINUTES[b] ?? 2) - (MINUTES[a] ?? 2) || a.localeCompare(b))) {
  const s = shards.reduce((a, b) => (b.minutes < a.minutes ? b : a));
  s.projects.push(p); s.minutes += MINUTES[p] ?? 2;
}
if (index) console.log(shards[index - 1].projects.map(p => `--project=${p}`).join(' '));
else shards.forEach((s, i) => console.log(`${i + 1}: ${s.minutes} min  ${s.projects.join(', ')}`));
