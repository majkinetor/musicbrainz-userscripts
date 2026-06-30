// Phase-1 Release→Markdown exporter (WS2 source, for format validation only).
// Usage: node export-md.mjs <release-mbid>
// The real feature will read window.MB.releaseEditor; this validates the FORMAT on real data.
const id = process.argv[2] || '3aafc2e7-27b4-4793-b6e7-8555dece33db';
const MB = 'https://musicbrainz.org';
const inc = 'artist-credits+labels+recordings+release-groups+url-rels+media+annotation';
const LANG = { eng: 'English', deu: 'German', fra: 'French', spa: 'Spanish', jpn: 'Japanese', ita: 'Italian', por: 'Portuguese', rus: 'Russian', mul: 'Multiple languages', zxx: 'No linguistic content' };
const SCRIPT = { Latn: 'Latin', Cyrl: 'Cyrillic', Jpan: 'Japanese', Hani: 'Han', Kore: 'Korean', Grek: 'Greek' };
const HOST = [[/discogs\.com/, 'Discogs'], [/bandcamp\.com/, 'Bandcamp'], [/open\.spotify|spotify\.com/, 'Spotify'], [/music\.apple\.com/, 'Apple Music'], [/deezer\.com/, 'Deezer'], [/youtube\.com|youtu\.be/, 'YouTube'], [/tidal\.com/, 'Tidal'], [/qobuz\.com/, 'Qobuz']];

const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/[\[\]]/g, '\\$&');
const escTitle = s => String(s == null ? '' : s).replace(/ — /g, ' \\— ');   // only the delimiter needs care in a title
const hostName = u => { for (const [re, n] of HOST) if (re.test(u)) return n; try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };

// reference registry: unique label -> {url, main}
const refs = new Map();
function ref(display, url, main) {
  let lbl = display || main || url, n = 1, key = lbl;
  while (refs.has(key) && refs.get(key).url !== url) { n++; key = `${lbl}·${n}`; }
  refs.set(key, { url, main: main || display });
  return key;
}
const typePath = t => ({ artist: 'artist', label: 'label', recording: 'recording', release: 'release', 'release-group': 'release-group' }[t] || t);
function entRef(type, ent, credited) {
  if (!ent) return credited ? `[${esc(credited)}]` : '';
  const disp = credited || ent.name || ent.title;
  return `[${esc(ref(disp, `${MB}/${typePath(type)}/${ent.id}`, ent.name || ent.title))}]`;
}
const credit = ac => (!ac || !ac.length) ? '' : ac.map(n => entRef('artist', n.artist, n.name) + (n.joinphrase || '')).join('');
const ms2len = ms => ms ? `${Math.floor(ms / 60000)}:${String(Math.round(ms % 60000 / 1000)).padStart(2, '0')}` : '';

const r = await (await fetch(`${MB}/ws/2/release/${id}?inc=${inc}&fmt=json`, { headers: { 'User-Agent': 'ee-export/0.1' } })).json();
const L = [];
const push = (...x) => L.push(...x);
push(`# ${esc((r['artist-credit'] || []).map(a => a.name).join(', '))} — ${esc(r.title)}`, '');
push(`<!-- release ${id} · format v1 · DO NOT EDIT THIS LINE -->`, '');

push('## Release information');
push(`- **Title**: ${esc(r.title)}`);
if (r.disambiguation) push(`- **Disambiguation**: ${esc(r.disambiguation)}`);
push(`- **Status**: ${esc(r.status || '')}`);
push(`- **Packaging**: ${esc(r.packaging || '')}`);
push(`- **Barcode**: ${r.barcode || 'none'}`);
const trep = r['text-representation'] || {};
push(`- **Language**: ${LANG[trep.language] || trep.language || ''}`);
push(`- **Script**: ${SCRIPT[trep.script] || trep.script || ''}`);
push(`- **Artist**: ${credit(r['artist-credit'])}`);
if (r['release-group']) push(`- **Release group**: ${entRef('release-group', r['release-group'])}`);
push('');

push('## Release events');
for (const ev of (r['release-events'] || [])) push(`- ${[ev.date || '—', ev.area ? esc(ev.area.name) : ''].filter(Boolean).join(', ')}`);
push('');

push('## Labels');
for (const li of (r['label-info'] || [])) push(`- ${li.label ? entRef('label', li.label) : ''}${li['catalog-number'] ? ' — ' + esc(li['catalog-number']) : ''}`);
push('');

push('## Annotation', (r.annotation || '').trim(), '<!-- /end -->', '');

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
push('## External links');
for (const rel of (r.relations || []).filter(x => x['target-type'] === 'url')) {
  const url = rel.url.resource, host = hostName(url);
  push(`- [${esc(ref(host, url, host))}]`);
  let dr = ''; if (rel.begin || rel.end) dr = `${rel.begin || ''} → ${rel.end || ''}`.trim(); if (rel.ended && !rel.end) dr = (dr ? dr + ' · ' : '') + 'ended';
  // suppress the type when it's host-redundant (e.g. "discogs" on Discogs); keep meaningful ones (free streaming / purchase)
  const t = norm(rel.type), h = norm(host);
  const showType = rel.type && !(t && h && (t.includes(h) || h.includes(t)));
  const parts = [showType ? rel.type : null, dr].filter(Boolean);
  if (parts.length) push(`  - ${parts.join(' · ')}`);
}
push('');

push('## Tracklist');
for (const m of (r.media || [])) {
  push(`### Medium ${m.position}${m.format ? ' — ' + esc(m.format) : ''}${m.title ? ' — ' + esc(m.title) : ''}`);
  for (const t of (m.tracks || [])) {
    const tail = [credit(t['artist-credit']), t.length ? `(${ms2len(t.length)})` : ''].filter(Boolean).join(' ');
    const rec = t.recording ? ' → ' + entRef('recording', t.recording) : '';
    push(`${t.position}. ${escTitle(t.title)}${(tail || rec) ? ' — ' + tail + rec : ''}`);
  }
  push('');
}

push('<!-- references -->');
for (const [lbl, v] of refs) push(`[${esc(lbl)}]: ${v.url}${v.main && v.main !== lbl ? ' (' + v.main + ')' : ''}`);
console.log(L.join('\n'));
