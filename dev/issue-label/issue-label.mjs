// Labels a new issue by the scripts its title names (#890): every script's name or short name in the title
// adds its `area | <script>` label; String Theory's adds `general`. A leading "<Script>: " that names only
// scripts is then taken off the title, which keeps no script name (Standard 1). Run by
// .github/workflows/issue-label.yml on issues.opened; see README.md.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// the maintainer's short names (AGENTS.md), and names said without the rest
const ALIASES = {
  AS: 'art station', BP: 'bandcamp player enhanced', CH: 'credit hoarder', DC: 'discogs credits', EH: 'event horizon',
  FC: 'first contact', GT: 'group therapy', IS: 'isrc scout', MC: 'mission control', MM: 'mammoth', PC: 'platform check',
  apollo: 'apollo editor'
};
const GENERAL = ['string theory', 'ST'];
const words = s => s.trim().split(/[\s_-]+/).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s_-]+');

// [{ re, label }]: what in a title stands for which label, from the labels the repo has
export function matchers(repoLabels) {
  const area = new Map();   // 'art station' → 'area | art station', the spelling with spaces first
  for (const l of repoLabels) {
    const m = /^area \| (.+)$/.exec(l);
    if (!m) continue;
    const key = m[1].replace(/_/g, ' ').toLowerCase();
    if (!area.has(key) || !/_/.test(l)) area.set(key, l);
  }
  const out = [];
  for (const [name, label] of area) out.push({ re: new RegExp(`(^|[^\\w])${words(name)}(?![\\w])`, 'i'), label });
  for (const [alias, name] of Object.entries(ALIASES)) {
    if (!area.has(name)) continue;
    // a short name only in capitals: "is" and "as" are words
    out.push({ re: new RegExp(`(^|[^\\w])${alias}(?![\\w])`, /^[A-Z]+$/.test(alias) ? '' : 'i'), label: area.get(name) });
  }
  if (repoLabels.includes('general')) {
    out.push({ re: new RegExp(`(^|[^\\w])${words(GENERAL[0])}(?![\\w])`, 'i'), label: 'general' });
    out.push({ re: new RegExp(`(^|[^\\w])${GENERAL[1]}(?![\\w])`), label: 'general' });
  }
  return out;
}

// the labels a title asks for, and the title without a leading prefix made only of script names
export function classify(title, repoLabels) {
  const ms = matchers(repoLabels);
  const labels = [...new Set(ms.filter(m => m.re.test(title)).map(m => m.label))];
  let newTitle = title;
  const p = /^\s*([^:]{1,60}?)\s*:\s*(\S[\s\S]*)$/.exec(title);
  if (p) {
    // every part of the prefix ("Apollo, PC") must be a script
    const parts = p[1].split(/\s*(?:,|&|\+|\/|\band\b)\s*/i).filter(Boolean);
    if (parts.length && parts.every(part => ms.some(m => new RegExp(`^${m.re.source.replace('(^|[^\\w])', '')}$`, m.re.flags).test(part)))) newTitle = p[2].trim().replace(/^\p{Ll}/u, c => c.toUpperCase());
  }
  return { labels, title: newTitle };
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const repo = process.env.GITHUB_REPOSITORY, issue = event.issue;
  const api = (path, opts = {}) => fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...opts, headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'content-type': 'application/json' }
  }).then(async r => { if (!r.ok) throw new Error(`${opts.method || 'GET'} ${path}: ${r.status} ${await r.text()}`); return r.json(); });
  const repoLabels = [];
  for (let page = 1; ; page++) {
    const batch = await api(`/labels?per_page=100&page=${page}`);
    repoLabels.push(...batch.map(l => l.name));
    if (batch.length < 100) break;
  }
  const { labels, title } = classify(issue.title, repoLabels);
  console.log(`#${issue.number} "${issue.title}" → ${labels.join(', ') || 'no label'}${title !== issue.title ? `, title "${title}"` : ''}`);
  if (labels.length) await api(`/issues/${issue.number}/labels`, { method: 'POST', body: JSON.stringify({ labels }) });
  if (title !== issue.title) await api(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ title }) });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e); process.exit(1); });
