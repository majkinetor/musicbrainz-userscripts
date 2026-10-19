#!/usr/bin/env node
// Adds the suite skill's local full run to the test history on the `test-history` branch, beside
// the nightly runs, as "source": "local" (dev/test/suite-history.mjs). Only the suite skill calls it,
// after a full run of a clean main; the README badge stays the nightly's.
//
//   node dev/test/suite-record.mjs --commit <sha the run started on> [--dir test-results/suite]
//
// It pushes as the bot (dev/.github-credentials.json), without force: when the nightly pushed
// meanwhile, it fetches again and adds the run to that.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const opt = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const commit = opt('--commit');
const dir = resolve(REPO, opt('--dir', 'test-results/suite'));
if (!commit) { console.error('usage: suite-record.mjs --commit <sha> [--dir test-results/suite]'); process.exit(2); }

const BRANCH = 'test-history';
const { username, token } = JSON.parse(readFileSync(join(REPO, 'dev/.github-credentials.json'), 'utf8'));
const origin = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: REPO, encoding: 'utf8' }).trim();
const slug = /github\.com[:/](.+?)(\.git)?$/.exec(origin)[1];
const url = `https://${username}:${token}@github.com/${slug}.git`;   // used once per push, never stored in a config

const work = mkdtempSync(join(tmpdir(), 'suite-record-'));
const git = (...a) => execFileSync('git', a, { cwd: work, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  git('init', '-q', '-b', BRANCH);
  for (let attempt = 1; ; attempt++) {
    git('fetch', '-q', '--depth=1', url, BRANCH);
    git('reset', '-q', '--hard', 'FETCH_HEAD');
    execFileSync(process.execPath, [join(REPO, 'dev/test/suite-history.mjs'), dir, join(work, 'history.json'), '--commit', commit, '--source', 'local'], { stdio: 'inherit' });
    git('add', 'history.json');
    git('-c', `user.name=${username}`, '-c', `user.email=${username}@users.noreply.github.com`, 'commit', '-qm', `suite: a local run of ${commit.slice(0, 7)}`);
    try { git('push', '-q', url, `HEAD:refs/heads/${BRANCH}`); break; }
    catch (e) { if (attempt >= 3) throw e; console.log('suite-record: the branch moved meanwhile, adding the run again'); }
  }
  console.log(`suite-record: the run is in ${BRANCH}'s history.json`);
} finally { rmSync(work, { recursive: true, force: true }); }
