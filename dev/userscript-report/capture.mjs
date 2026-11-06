// Public source collection for the AI-reviewed pilot. See README.md.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { userscriptText, wikiRevision } from './lib.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
process.env.GIT_EDITOR = 'true';
process.env.GIT_SEQUENCE_EDITOR = 'true';
process.env.GIT_MERGE_AUTOEDIT = 'no';
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 50e6 });
const gh = args => execFileSync('gh', ['api', ...args], { maxBuffer: 20e6 });
const sha = data => createHash('sha256').update(data).digest('hex');
const cache = path.join(dir, '.cache');
mkdirSync(cache, { recursive: true });
const json = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const targets = JSON.parse(readFileSync(path.join(dir, 'data/targets.json')));
const observedAt = new Date().toISOString();
const commits = new Map();
const external = [];
for (const target of targets) {
  const key = target.repo + '/' + target.branch;
  if (!commits.has(key)) commits.set(key, JSON.parse(gh([`repos/${target.repo}/commits/${target.branch}`])).sha);
  const commit = commits.get(key);
  const bytes = gh(['-H', 'Accept: application/vnd.github.raw+json', `repos/${target.repo}/contents/${target.path}?ref=${commit}`]);
  const text = userscriptText(bytes);
  const hash = sha(bytes);
  writeFileSync(path.join(cache, hash + '.js'), bytes);
  external.push({ ...target, stableId: `github:${target.repo}/${target.path}`, commit, sha256: hash,
    version: text.match(/^\/\/\s*@version\s+(.+)$/m)?.[1].trim() || null,
    license: [...text.matchAll(/^\/\/\s*@licen[cs]e\s+(.+)$/gm)].map(m => m[1].trim()),
    requires: [...text.matchAll(/^\/\/\s*@require\s+(.+)$/gm)].map(m => m[1].trim()),
    url: `https://github.com/${target.repo}/blob/${commit}/${target.path}`, checkedAt: observedAt,
    dependencyScope: 'Entry script captured; @require dependencies have not been independently verified.' });
}
// Fail closed: the old successful manifest is replaced only after every collection succeeds.
const wikiFile = path.join(cache, 'wiki-response.json');
execFileSync('curl.exe', ['--fail', '--location', '--silent', '--show-error', '--output', wikiFile,
  'https://wiki.musicbrainz.org/api.php?action=query&prop=revisions&titles=Guides%2FUserscripts&rvprop=ids%7Ctimestamp%7Ccontent&rvslots=main&format=json&formatversion=2']);
const rev = wikiRevision(readFileSync(wikiFile));
const wiki = rev.slots.main.content;
writeFileSync(path.join(cache, sha(wiki) + '.wikitext'), wiki);
const commit = git(['rev-parse', 'origin/main']).toString().trim();
const paths = git(['ls-tree', '-r', '--name-only', commit, 'userscripts', 'dev/aliases']).toString().trim().split('\n')
  .filter(p => /\.user\.js$/.test(p) || /^userscripts\/.*\/(?:README|DEVELOP)\.md$/.test(p) || p === 'dev/aliases/alias-editor.mjs');
const files = paths.map(p => {
  const bytes = git(['show', `${commit}:${p}`]);
  return { path: p, sha256: sha(bytes), version: bytes.toString().match(/^\/\/\s*@version\s+(.+)$/m)?.[1].trim() || null };
});
const manifest = { schemaVersion: 1, collectedAt: observedAt,
  wiki: { revision: rev.revid, timestamp: rev.timestamp, sha256: sha(wiki), url: `https://wiki.musicbrainz.org/index.php?title=Guides/Userscripts&oldid=${rev.revid}`, scope: 'Wiki source; MusicBrainz mirror and non-list template content not captured.' },
  toolset: { commit, files }, external };
const temp = path.join(dir, 'data/sources.json.tmp');
json(temp, manifest);
renameSync(temp, path.join(dir, 'data/sources.json'));
console.log(`Captured wiki ${rev.revid}, ${external.length} external scripts, ${files.length} toolset files at ${commit.slice(0, 8)}.`);
