#!/usr/bin/env node
// The Announcements discussions as one file for the project site (#1123): String Theory's What's new reads it
// there, so it makes no GitHub API calls. Every run is a full rebuild from GitHub's current state, so an edited
// post carries its new text, and a deleted post, one moved out of Announcements or one labeled `skip changelog`
// is gone. See README.md.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const OUT = opt('--out', 'docs/news.json');
const [OWNER, NAME] = opt('--repo', process.env.GITHUB_REPOSITORY || 'majkinetor/musicbrainz-userscripts').split('/');
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) { console.error('news: set GITHUB_TOKEN (or GH_TOKEN)'); process.exit(2); }

async function gql(query, variables) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: 'bearer ' + TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'mb-userscripts-news' },
      body: JSON.stringify({ query, variables }),
    });
    const j = r.ok ? await r.json() : null;
    if (j && j.data) return j;
    if (attempt >= 3) throw new Error('GitHub answered ' + r.status + (j && j.errors ? ': ' + JSON.stringify(j.errors) : ''));
    await new Promise((ok) => setTimeout(ok, 5000 * attempt));
  }
}

const cats = await gql('query($o:String!,$n:String!){repository(owner:$o,name:$n){discussionCategories(first:50){nodes{id slug}}}}', { o: OWNER, n: NAME });
const cat = cats.data.repository.discussionCategories.nodes.find((c) => c.slug === 'announcements');
if (!cat) throw new Error('no Announcements category');

const posts = [];
for (let after = null; ;) {
  const j = await gql(`query($o:String!,$n:String!,$c:ID!,$a:String){repository(owner:$o,name:$n){
    discussions(first:50,after:$a,categoryId:$c,orderBy:{field:CREATED_AT,direction:DESC}){
      pageInfo{hasNextPage endCursor}
      nodes{number title url createdAt lastEditedAt body bodyHTML labels(first:20){nodes{name}}}}}}`,
  { o: OWNER, n: NAME, c: cat.id, a: after });
  const d = j.data.repository.discussions;
  posts.push(...d.nodes);
  if (!d.pageInfo.hasNextPage) break;
  after = d.pageInfo.endCursor;
}

const items = posts.map((p) => {
  const labels = p.labels.nodes.map((l) => l.name), m = /Issue:\s*#(\d+)/i.exec(p.body || '');
  return { id: p.number, title: p.title, url: p.url, at: p.createdAt, edited: p.lastEditedAt || '', html: p.bodyHTML || '',
    labels, issue: m ? +m[1] : 0, channel: '' };
}).filter((i) => !i.labels.includes('skip changelog'));

// an issue with the `released` label is on stable, any other on latest; 50 issues a query
const issues = [...new Set(items.map((i) => i.issue).filter(Boolean))], channel = {};
for (let k = 0; k < issues.length; k += 50) {
  const part = issues.slice(k, k + 50);
  const q = 'query($o:String!,$n:String!){repository(owner:$o,name:$n){' + part.map((n) =>
    `i${n}:issueOrPullRequest(number:${n}){...on Issue{labels(first:30){nodes{name}}}...on PullRequest{labels(first:30){nodes{name}}}}`).join('') + '}}';
  const j = await gql(q, { o: OWNER, n: NAME });   // a number that is no issue comes back null, with an error beside the data
  part.forEach((n) => {
    const x = j.data.repository['i' + n];
    if (x && x.labels) channel[n] = x.labels.nodes.some((l) => l.name === 'released') ? 'stable' : 'latest';
  });
}
items.forEach((i) => { i.channel = channel[i.issue] || ''; });

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: new Date().toISOString(), items }) + '\n');
console.log(`news: ${items.length} announcements (${posts.length - items.length} skipped) → ${OUT}`);
