#!/usr/bin/env node
// Makes and checks userscript install links (Standard 10, STANDARDS.md). How to use it
// and what it checks: README.md beside this file.
//
//   node dev/install-links/install-links.mjs <script> [...] [--branch <b>]    print the links
//   node dev/install-links/install-links.mjs <script> [...] --into <body.md>  put them in a comment body
//   node dev/install-links/install-links.mjs --check <comment-url | file.md>  check posted links

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = 'majkinetor/musicbrainz-userscripts';
const RAW = `https://raw.githubusercontent.com/${REPO}/`;
// Links follow a branch: main once the work is there, else the feature branch it is on.
// Pinned links (a commit SHA) are only for releases, which dev/publish.mjs writes; --check
// still accepts them, through github.com (raw.githubusercontent.com with a full SHA gets
// wrapped in backticks when a cloud session posts it).
const PIN = `https://github.com/${REPO}/raw/`;
const HOSTS = /raw\.githubusercontent\.com|github\.com\/[^\s/]+\/[^\s/]+\/raw\//;
const MARKER = '<!-- install-links -->';

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitOk = (...a) => { try { git(...a); return true; } catch { return false; } };
const die = m => { console.error(`✗ ${m}`); process.exit(1); };

// --- the checks, shared by both modes --------------------------------------------------

// A link that renders: [label](url), not inside a code span, the target with no backtick or space.
const LINK = /\[([^\]\n]+)\]\((https:\/\/(?:raw\.githubusercontent\.com|github\.com)\/[^\s()`<>]+)\)/g;
const esc = s => s.replace(/[.]/g, '\\.');
// branch: raw.githubusercontent.com/<repo>/refs/heads/<branch>/…; pinned (releases): github.com/<repo>/raw/<40-char SHA>/…
const URL_SHAPE = new RegExp(`^(?:${esc(PIN)}([0-9a-f]{40})|${esc(RAW)}refs/heads/([\\w.-]+(?:/[\\w.-]+)*?))/userscripts/[\\w/.-]+\\.user\\.js$`);

function fetchRaw(url) {
  // curl, not fetch: it goes through the proxy in a cloud session and ships with Windows.
  const out = execFileSync('curl', ['-sSL', '--max-time', '30', '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const i = out.lastIndexOf('\n');
  return { status: Number(out.slice(i + 1)), body: out.slice(0, i) };
}

function check(text) {
  const errors = [], warnings = [];
  let inFence = false, links = 0;
  text.replace(/\r/g, '').split('\n').forEach((line, n) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return; }
    if (inFence || !HOSTS.test(line)) return;
    const at = `line ${n + 1}`;
    for (const m of line.matchAll(LINK)) {
      const [, label, url] = m;
      links++;
      if ((line.slice(0, m.index).match(/`/g) || []).length % 2) errors.push(`${at}: link is inside a code span: ${m[0]}`);
      const shape = url.match(URL_SHAPE);
      if (!shape) { errors.push(`${at}: not ${RAW}refs/heads/<branch>/… (or ${PIN}<40-char SHA>/…, a release's pinned link), …/userscripts/…user.js: ${url}`); continue; }
      const pinned = !!shape[1];
      const { status, body } = fetchRaw(url);
      if (status !== 200) { errors.push(`${at}: HTTP ${status}: ${url}`); continue; }
      const version = body.match(/^\/\/\s*@version\s+(\S+)/m)?.[1];
      const said = label.match(/@(\S+)/)?.[1];
      if (!said) (pinned ? errors : warnings).push(`${at}: label has no @<version>: [${label}]`);
      else if (said !== version) {
        // raw.githubusercontent.com caches branch URLs for a few minutes after a push.
        (pinned ? errors : warnings).push(`${at}: label says @${said}, the file says @${version}${pinned ? '' : ' (a branch link can lag a push by a few minutes)'}: ${url}`);
      }
    }
    if (HOSTS.test(line.replace(LINK, ''))) errors.push(`${at}: an install URL that is not a clickable [label](url) link: ${line.trim()}`);
  });
  if (!links) errors.push('no install links found');
  return { errors, warnings, links };
}

function report({ errors, warnings, links }) {
  for (const w of warnings) console.error(`⚠ ${w}`);
  for (const e of errors) console.error(`✗ ${e}`);
  if (errors.length) process.exit(1);
  console.error(`✓ ${links} install link${links === 1 ? '' : 's'} checked`);
}

// --- arguments ------------------------------------------------------------------------

const args = process.argv.slice(2);
const opt = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; if (!v || v.startsWith('--')) die(`${name} needs a value`); args.splice(i, 2); return v; };

const checkTarget = opt('--check');
if (checkTarget) {
  const m = checkTarget.match(/github\.com\/([^/]+\/[^/]+)\/(?:issues|pull)\/\d+#issuecomment-(\d+)/);
  const text = m
    ? execFileSync('gh', ['api', `repos/${m[1]}/issues/comments/${m[2]}`, '--jq', '.body'], { encoding: 'utf8' })
    : existsSync(checkTarget) ? readFileSync(checkTarget, 'utf8') : die(`not a comment URL or a file: ${checkTarget}`);
  report(check(text));
  process.exit(0);
}

const branchArg = opt('--branch');
const into = opt('--into');
if (!args.length || args.some(a => a.startsWith('--'))) die('usage: node dev/install-links/install-links.mjs <script> [...] [--branch <branch>] [--into <body.md>] | --check <comment-url | file.md>');

// --- making the links -----------------------------------------------------------------

// The branch to link: --branch, else main when HEAD is on origin/main, else the branch checked out.
const head = git('rev-parse', 'HEAD');
const onMain = gitOk('rev-parse', '--verify', 'origin/main') && gitOk('merge-base', '--is-ancestor', head, 'origin/main');
const branch = branchArg || (onMain ? 'main' : git('rev-parse', '--abbrev-ref', 'HEAD'));
if (branch === 'HEAD') die('HEAD is detached and not on origin/main: name the branch with --branch');
const sha = gitOk('rev-parse', '--verify', `origin/${branch}^{commit}`) ? git('rev-parse', `origin/${branch}^{commit}`) : die(`origin/${branch} not found: push the branch (and git fetch) first`);
if (!branchArg && !onMain && sha !== head) die(`origin/${branch} is not HEAD: push first, so the links install this code`);
const exists = (rev, path) => gitOk('cat-file', '-e', `${rev}:${path}`);

// The shipped file of a script folder: dist/ when it has one (built scripts), else the folder's own.
function scriptFile(arg) {
  if (arg.endsWith('.user.js')) return arg.replace(/\\/g, '/').replace(/^\.\//, '');
  const name = basename(arg);
  const dirs = [`userscripts/${arg}`, ...git('ls-tree', '-d', '--name-only', sha, 'userscripts/').split('\n').map(d => `${d}/${arg}`)];
  for (const dir of dirs) for (const f of [`${dir}/dist/${name}.user.js`, `${dir}/${name}.user.js`]) if (exists(sha, f)) return f;
  return die(`no ${name}.user.js for "${arg}" at ${sha.slice(0, 8)}`);
}

const header = (rev, path, key) => git('show', `${rev}:${path}`).match(new RegExp(`^//\\s*@${key}\\s+(.+?)\\s*$`, 'm'))?.[1];
const members = git('show', `${sha}:userscripts/string_theory/members.txt`).split('\n').map(l => l.replace(/#.*/, '').trim()).filter(Boolean);

const files = [...new Set(args.map(scriptFile))];
const ST = 'userscripts/string_theory/string_theory.user.js';
// A script's folder is the one holding its file, or holding its dist/.
const folder = f => f.split('/').slice(0, -1).filter((d, i, a) => !(d === 'dist' && i === a.length - 1)).at(-1);
if (!files.includes(ST) && files.some(f => members.includes(folder(f)))) files.push(ST);

const lines = [];
for (const f of files) {
  const name = header(sha, f, 'name');
  lines.push(`[Install ${name} @${header(sha, f, 'version')} (${branch === 'main' ? 'latest' : 'branch ' + branch}, auto-updates)](${RAW}refs/heads/${branch}/${f})`);
}
const block = lines.join('\n');
report(check(block));

if (!into) { console.log(block); process.exit(0); }
const body = existsSync(into) ? readFileSync(into, 'utf8') : '';
const next = body.includes(MARKER) ? body.replace(MARKER, block) : `${body.replace(/\s*$/, '')}${body ? '\n\n' : ''}${block}\n`;
writeFileSync(into, next);
console.error(`✓ links written to ${into}${body.includes(MARKER) ? '' : ' (appended: no ' + MARKER + ' line)'}`);
