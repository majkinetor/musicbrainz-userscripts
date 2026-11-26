#!/usr/bin/env node
// The Announcements discussions as one file for the project site (#1123): String Theory's What's new reads it
// there, so it makes no GitHub API calls. Every run is a full rebuild from GitHub's current state, so an edited
// post carries its new text, and a deleted post, one moved out of Announcements or one labeled `skip changelog`
// is gone. See README.md.
import { writeFileSync, mkdirSync, readdirSync, readFileSync, existsSync, rmSync, copyFileSync } from 'node:fs';
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

// the script a post is about, from its `area | <script>` label, for the site's page (String Theory works it out
// itself): its @name and icon, a PNG where there is one (as the site's front page does). The icon is copied into the
// site, news/icons/<script>.<ext>, so neither the page nor its readers depend on raw.githubusercontent.com's limits.
// news/ is rewritten whole on every run, the post pages below too, so a deleted post loses its page.
const SITE = opt('--site', 'https://milic.info/musicbrainz-userscripts/');
const dir = dirname(OUT) + '/news';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir + '/icons', { recursive: true });
const scripts = {};
for (const d of existsSync('userscripts') ? readdirSync('userscripts') : []) {
  let name = d.replace(/_/g, ' ');
  try { name = /^\/\/ @name\s+(.+)$/m.exec(readFileSync(`userscripts/${d}/${d}.user.js`, 'utf8'))[1].trim(); } catch { /* no script */ }
  const icon = ['icon.png', 'icon.svg'].find((i) => existsSync(`userscripts/${d}/${i}`)), file = icon ? d + icon.slice(4) : '';
  if (icon) copyFileSync(`userscripts/${d}/${icon}`, `${dir}/icons/${file}`);
  scripts[d.replace(/_/g, ' ')] = scripts[name.toLowerCase()] = { name, icon: icon ? SITE + 'news/icons/' + file : '' };
}
const scriptOf = (labels) => {
  for (const l of labels) { const m = /^area \| (.+)$/.exec(l); if (m) return scripts[m[1].toLowerCase()] || { name: m[1], icon: '' }; }
  return scripts['string theory'] || { name: 'String Theory', icon: '' };
};

// GitHub renders an uploaded image as a private-user-images address signed for five minutes, which a kept file
// can't use; its stable address, github.com/user-attachments/assets/<uuid>, redirects to a fresh one
const stable = (html) => html.replace(/https:\/\/private-user-images\.githubusercontent\.com\/\d+\/\d+-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[a-z0-9]+\?jwt=[\w.-]+/gi,
  'https://github.com/user-attachments/assets/$1');

const items = posts.map((p) => {
  const labels = p.labels.nodes.map((l) => l.name), m = /Issue:\s*#(\d+)/i.exec(p.body || ''), s = scriptOf(labels);
  return { id: p.number, title: p.title, url: p.url, at: p.createdAt, edited: p.lastEditedAt || '', html: stable(p.bodyHTML || ''),
    labels, script: s.name, icon: s.icon, issue: m ? +m[1] : 0, channel: '' };
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

// one page a post, news/<id>.html, for links pasted into chats and forums: a link preview never sees news.html's
// #<id>, so it would show the page's title for every post. Each page carries its post's title, text and first image
// in the preview tags and sends a reader on to news.html#<id>.
const attr = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const text = (html) => html.replace(/<sub>\s*Issue:[\s\S]*?<\/sub>/gi, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();
const cut = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1) > n / 2 ? s.lastIndexOf(' ', n - 1) : n - 1) + '…';
for (const i of items) {
  const to = '../news.html#' + i.id, img = (/<img[^>]+src="([^"]+)"/i.exec(i.html) || [])[1] || '';
  const title = i.title + ' · ' + i.script, desc = cut(text(i.html), 200);
  writeFileSync(`${dir}/${i.id}.html`, `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${attr(title)}</title>
<meta name="description" content="${attr(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="MusicBrainz userscripts">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${attr(SITE + 'news/' + i.id)}">
<meta property="article:published_time" content="${attr(i.at)}">
${img ? `<meta property="og:image" content="${attr(img)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<meta http-equiv="refresh" content="0; url=${attr(to)}">
</head><body><p><a href="${attr(to)}">${attr(i.title)}</a></p><script>location.replace(${JSON.stringify(to)})</script></body></html>
`);
}
console.log(`news: ${items.length} announcements (${posts.length - items.length} skipped) → ${OUT}, ${dir}/`);
