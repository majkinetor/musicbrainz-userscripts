import { hash } from './lib.mjs';

const plain = s => s.replace(/\[\[(?:Image|File):[^\]]*\]\]/gi, '')
  .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1').replace(/<[^>]*>/g, ' ')
  .replace(/'{2,5}/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const url = s => s.match(/link=(https?:\/\/[^\s|\]]+)/i)?.[1] || s.match(/https?:\/\/[^\s|\]]+/)?.[0] || '';

export function githubIdentity(value) {
  try {
    const u = new URL(value);
    let p = decodeURIComponent(u.pathname).split('/').filter(Boolean);
    if (u.hostname === 'raw.githubusercontent.com' || u.hostname === 'raw.github.com') p.splice(2, p[2] === 'refs' && p[3] === 'heads' ? 3 : 1);
    else if (u.hostname === 'github.com' && ['blob', 'raw', 'tree'].includes(p[2])) {
      p.splice(2, p[3] === 'refs' && p[4] === 'heads' ? 4 : 2);
    } else return null;
    return `github:${p.slice(0,2).join('/').toLowerCase()}/${p.slice(2).join('/')}`;
  } catch { return null; }
}

// The listing uses vertical cells, icon-only URLs and one rowspan-based fork.
// Expand spans before interpreting columns; merge repeated source identities,
// keeping distinct downloads/forks even where names match.
export function parseCatalog(wiki) {
  const entries = new Map();
  let section = '', active = false, cells = [], spans = new Map();
  function flush() {
    if (!cells.length) return;
    const expanded = [];
    for (const [i, span] of spans) {
      expanded[i] = span.text;
      if (--span.left === 0) spans.delete(i);
    }
    let i = 0;
    for (const cell of cells) {
      while (expanded[i] !== undefined) i++;
      expanded[i] = cell.text;
      if (cell.span > 1) spans.set(i, {text:cell.text,left:cell.span - 1});
      i++;
    }
    cells = [];
    if (expanded.length !== 8) throw new Error(`Unexpected wiki row width ${expanded.length} in ${section}`);
    const [name,status,description,site,author,download,source,bugs] = expanded;
    const sourceUrl = url(source), downloadUrl = url(download);
    const identity = githubIdentity(downloadUrl) || githubIdentity(sourceUrl) || downloadUrl || sourceUrl;
    const stableId = identity || `wiki:${hash(plain(name) + '|' + plain(author)).slice(0, 24)}`;
    const id = 'wiki-' + hash(stableId).slice(0, 20);
    if (entries.has(stableId)) { const old = entries.get(stableId); if (!old.categories.includes(section)) old.categories.push(section); return; }
    entries.set(stableId, {id, stableId, name:plain(name), author:plain(author), description:plain(description),
      wikiStatus:plain(status), platforms:plain(site), sourceUrl, downloadUrl, bugsUrl:url(bugs), categories:[section],
      rowHash:hash(expanded.join('\n')), kind:stableId.startsWith('github:majkinetor/musicbrainz-userscripts/') ? 'Suite entry' : plain(name) === 'Harmony' ? 'Companion tool' : 'External script'});
  }
  for (const line of wiki.split(/\r?\n/)) {
    if (/^==[^=]/.test(line)) { if (active) flush(); section = line.replace(/^==\s*|\s*==$/g,'').trim(); active=false; spans=new Map(); }
    else if (line.startsWith('{|')) active=section.startsWith('Userscripts:');
    else if (active && (line.startsWith('|-') || line.startsWith('|}'))) { flush(); if (line.startsWith('|}')) active=false; }
    else if (active && line.startsWith('|') && !line.startsWith('|+')) {
      const text = line.slice(1), match = text.match(/^([^|]*\b(?:style|rowspan|colspan|class)\s*=[^|]*)\|(.*)$/);
      cells.push({text:match ? match[2] : text,span:Number(match?.[1].match(/rowspan\s*=\s*"?(\d+)/)?.[1] || 1)});
    } else if (active && cells.length && !line.startsWith('!')) cells.at(-1).text += '\n' + line;
  }
  if (active) flush();
  return [...entries.values()];
}
