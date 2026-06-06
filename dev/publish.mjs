#!/usr/bin/env node
/*
 * Repo-wide publish for mb-userscripts.
 *
 *   node dev/publish.mjs            # DRY RUN — compute + print the plan, write/push nothing
 *   node dev/publish.mjs --yes      # execute: write changelogs, commit, merge main→stable, push, release, label
 *
 * What it does
 *   1. Collect CLOSED issues that are not yet `released`, carry an `area | <script>` label and a
 *      `bug` or `enhancement` label, and are NOT `skip changelog` / `wontfix`.
 *   2. Group them by script (area label → directory); enhancement → Features, bug → Fixes.
 *   3. Find which scripts' .user.js changed since `stable` — those get a stable link in the release.
 *   4. Prepend a dated section to each affected script's CHANGELOG.md.
 *   5. (--yes) commit the changelogs on main, merge main→stable, push both.
 *   6. (--yes) create ONE dated GitHub Release whose body lists every changed script as a stable
 *      raw link pinned to the merge commit, with that script's changelog entries; then label every
 *      included issue `released`.
 *
 * Releases are date-based (tag = YYYY.M.D) because each script keeps its own @version.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'majkinetor/musicbrainz-userscripts';
const YES = process.argv.includes('--yes');
const raw = (sha, path) => `https://raw.githubusercontent.com/${REPO}/${sha}/${path}`;
const issueUrl = n => `https://github.com/${REPO}/issues/${n}`;
const tagUrl = t => `https://github.com/${REPO}/releases/tag/${t}`;

function run(cmd, args, opts = {}) { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts }).trim(); }
const git = (...a) => run('git', a);
const gh = (...a) => run('gh', a);
function tryRun(fn) { try { return fn(); } catch (e) { return null; } }

// area label → script directory (e.g. "area | apollo editor" → "apollo_editor")
const AREA_RE = /^area \| (.+)$/;
const dirFromArea = name => name.match(AREA_RE)[1].trim().toLowerCase().replace(/\s+/g, '_');
function userJsPath(dir) {
  for (const p of [`userscripts/${dir}/${dir}.user.js`, `userscripts/${dir}/dist/${dir}.user.js`]) if (existsSync(resolve(ROOT, p))) return p;
  return null;
}
function scriptDisplayName(path) { const m = path && readFileSync(resolve(ROOT, path), 'utf8').match(/@name\s+(.+)/); return m ? m[1].trim() : path; }

function todayTag() {
  const d = new Date();
  let base = `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, tag = base, n = 1;
  while (tryRun(() => gh('release', 'view', tag, '--repo', REPO))) { n++; tag = `${base}.${n}`; }   // avoid collision on same-day re-publish
  return tag;
}

function collectIssues() {
  const all = JSON.parse(gh('issue', 'list', '--repo', REPO, '--state', 'closed', '--limit', '1000', '--json', 'number,title,labels'));
  const groups = {};   // dir → { name, path, features:[], fixes:[] }
  const included = [];
  for (const i of all) {
    const names = i.labels.map(l => l.name);
    if (['released', 'skip changelog', 'wontfix'].some(x => names.includes(x))) continue;
    const area = names.find(n => AREA_RE.test(n)); if (!area) continue;
    const kind = names.includes('enhancement') ? 'features' : names.includes('bug') ? 'fixes' : null; if (!kind) continue;
    const dir = dirFromArea(area), path = userJsPath(dir);
    (groups[dir] ||= { dir, name: scriptDisplayName(path), path, features: [], fixes: [] })[kind].push(i);
    included.push(i.number);
  }
  return { groups, included };
}

function changedScripts() {
  const files = tryRun(() => git('diff', '--name-only', 'stable...main')) || '';
  const dirs = new Set();
  for (const f of files.split('\n')) { const m = f.match(/^userscripts\/([^/]+)\/.*\.user\.js$/); if (m) dirs.add(m[1]); }
  return dirs;
}

function changelogSection(group, tag) {
  const list = arr => arr.map(i => `1. ${i.title} ([#${i.number}](${issueUrl(i.number)}))`).join('\n');
  let s = `## [${tag}](${tagUrl(tag)})\n`;
  if (group.features.length) s += `\n### Features\n\n${list(group.features)}\n`;
  if (group.fixes.length) s += `\n### Fixes\n\n${list(group.fixes)}\n`;
  if (!group.features.length && !group.fixes.length) s += `\n- Small improvements\n`;   // changed, but no tracked issues
  return s;
}
function updateChangelog(group, tag) {
  const file = resolve(ROOT, `userscripts/${group.dir}/CHANGELOG.md`);
  const section = changelogSection(group, tag);
  const title = `# ${group.name} Changelog`;
  let content;
  if (existsSync(file)) {
    const cur = readFileSync(file, 'utf8');
    const nl = cur.indexOf('\n');
    content = cur.slice(0, nl + 1) + '\n' + section + cur.slice(nl + 1).replace(/^\n+/, '\n');
  } else {
    content = `${title}\n\n${section}`;
  }
  return { file, content };
}

function releaseBody(groups, changed, tag, sha) {
  const lines = [];   // no leading "# <tag>" — GitHub already shows the release title
  const dirs = [...new Set([...changed, ...Object.keys(groups)])].sort();
  for (const dir of dirs) {
    const g = groups[dir]; const path = (g && g.path) || userJsPath(dir);
    const name = (g && g.name) || (path && scriptDisplayName(path)) || dir;
    lines.push(`## ${name}`, '');
    // only scripts whose code changed get install links — both the pinned link
    // (frozen to this release's commit) and the non-pinned one (tracks `stable`,
    // so the script manager auto-updates to future releases).
    if (changed.has(dir) && path) lines.push(`[Install — pinned to this release](${raw(sha, path)}) | [Install — latest (auto-updates)](${raw('stable', path)})`, '');
    if (g && g.features.length) { lines.push('### Features', ''); g.features.forEach(i => lines.push(`- ${i.title} ([#${i.number}](${issueUrl(i.number)}))`)); lines.push(''); }
    if (g && g.fixes.length) { lines.push('### Fixes', ''); g.fixes.forEach(i => lines.push(`- ${i.title} ([#${i.number}](${issueUrl(i.number)}))`)); lines.push(''); }
    if (g && !g.features.length && !g.fixes.length) { lines.push('- Small improvements', ''); }   // changed, but no tracked issues
  }
  return lines.join('\n');
}

function main() {
  // sanity
  tryRun(() => git('fetch', 'github', 'main', 'stable', '--quiet'));
  const { groups, included } = collectIssues();
  const changed = changedScripts();
  // a changed script with no tracked issues still gets a changelog + release entry ("Small improvements")
  for (const dir of changed) { if (!groups[dir]) { const path = userJsPath(dir); groups[dir] = { dir, name: (path && scriptDisplayName(path)) || dir, path, features: [], fixes: [] }; } }
  const dirs = [...new Set([...Object.keys(groups), ...changed])];
  if (!dirs.length) { console.log('Nothing to publish: no unreleased issues and no changed scripts.'); return; }
  const tag = todayTag();

  console.log(`\n=== publish ${YES ? '(EXECUTE)' : '(dry run — pass --yes to execute)'} ===`);
  console.log(`Release tag: ${tag}`);
  console.log(`Changed scripts (since stable): ${[...changed].join(', ') || '(none)'}`);
  console.log(`Issues to include & mark released: ${included.length ? included.map(n => '#' + n).join(', ') : '(none)'}\n`);

  const edits = [];
  for (const dir of Object.keys(groups)) {
    const g = groups[dir];
    console.log(`--- ${g.name} (${dir})  +${g.features.length} features, +${g.fixes.length} fixes`);
    const { file, content } = updateChangelog(g, tag);
    edits.push({ file, content });
    console.log(changelogSection(g, tag).split('\n').map(l => '   ' + l).join('\n'));
  }
  // bump each linked (changed) script's @version to the release date — a script edited days before the
  // release would otherwise ship a stale-dated version that differs from the tag.
  for (const dir of changed) {
    const path = userJsPath(dir); if (!path) continue;
    const file = resolve(ROOT, path), cur = readFileSync(file, 'utf8');
    const cm = cur.match(/@version\s+(\S+)/), curV = cm ? cm[1] : '?';
    if (curV === tag) continue;
    edits.push({ file, content: cur.replace(/(\/\/\s*@version\s+)\S+/, `$1${tag}`) });
    console.log(`--- bump ${dir} @version ${curV} → ${tag}`);
  }

  if (!YES) {
    console.log('\n(dry run) — would write the changelogs above, commit on main, merge main→stable,');
    console.log('           push both, create the dated release, and label the issues `released`.');
    console.log('\nRelease body preview:\n');
    console.log(releaseBody(groups, changed, tag, '<stable-sha>').split('\n').map(l => '   ' + l).join('\n'));
    return;
  }

  // EXECUTE
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') throw new Error('publish --yes must be run on `main`');
  if (git('status', '--porcelain', '--untracked-files=no')) throw new Error('working tree has uncommitted changes');
  for (const e of edits) writeFileSync(e.file, e.content);
  git('add', ...edits.map(e => e.file));
  git('commit', '-m', `changelog: release ${tag}`);
  git('push', 'github', 'main');
  git('checkout', 'stable');
  git('merge', '--ff-only', 'main');
  const sha = git('rev-parse', 'HEAD');
  git('push', 'github', 'stable');
  git('checkout', 'main');

  const body = releaseBody(groups, changed, tag, sha);
  gh('release', 'create', tag, '--repo', REPO, '--title', tag, '--target', sha, '--notes', body);
  for (const n of included) gh('issue', 'edit', String(n), '--repo', REPO, '--add-label', 'released');
  console.log(`\nPublished ${tag}: ${tagUrl(tag)}`);
}

main();
