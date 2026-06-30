// Release ⇄ Markdown — Phase 1 lib (dev). Three pieces:
//   toModel(ws2)  WS2 release JSON  -> canonical model   (will be re-pointed at the live editor model)
//   emit(model)   canonical model   -> Markdown
//   parse(md)     Markdown          -> canonical model
// Round-trip invariant (see roundtrip.mjs): emit(parse(emit(m))) === emit(m).

export const LANG = { eng: 'English', deu: 'German', fra: 'French', spa: 'Spanish', jpn: 'Japanese', ita: 'Italian', por: 'Portuguese', rus: 'Russian', mul: 'Multiple languages', zxx: 'No linguistic content' };
export const SCRIPT = { Latn: 'Latin', Cyrl: 'Cyrillic', Jpan: 'Japanese', Hani: 'Han', Kore: 'Korean', Grek: 'Greek' };
const HOST = [[/discogs\.com/, 'Discogs'], [/bandcamp\.com/, 'Bandcamp'], [/open\.spotify|spotify\.com/, 'Spotify'], [/music\.apple\.com/, 'Apple Music'], [/deezer\.com/, 'Deezer'], [/youtube\.com|youtu\.be/, 'YouTube'], [/tidal\.com/, 'Tidal'], [/qobuz\.com/, 'Qobuz']];
const MB = 'https://musicbrainz.org';
const TYPES = ['artist', 'label', 'recording', 'release-group', 'release', 'area', 'place', 'work'];

const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/[\[\]]/g, '\\$&');
const escTitle = s => esc(s).replace(/ — /g, ' \\— ');
const unesc = s => String(s == null ? '' : s).replace(/\\(.)/g, '$1');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ms2len = ms => ms ? `${Math.floor(ms / 60000)}:${String(Math.round(ms % 60000 / 1000)).padStart(2, '0')}` : '';
const hostName = u => { for (const [re, n] of HOST) if (re.test(u)) return n; try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };
const mbidFromUrl = u => (String(u).match(/\/([0-9a-f-]{36})\b/i) || [])[1] || null;
const typeFromUrl = u => TYPES.find(t => new RegExp(`/${t}/[0-9a-f-]{36}`, 'i').test(u)) || null;

// ── ref registry: assign a unique inline label for an entity, recording url+main ──
function makeRefs() {
  const map = new Map();   // label -> {url, main}
  function ref(display, url, main) {
    let key = display || main || url, n = 1;
    while (map.has(key) && map.get(key).url !== url) { n++; key = `${display}·${n}`; }
    map.set(key, { url, main: main || display });
    return key;
  }
  return { map, ref };
}

// ── credit: [{label, join}] with an optional leading join (lead) ──
function ws2Credit(ac, R) {
  const parts = (ac || []).map(n => ({ label: n.artist ? R.ref(n.name, `${MB}/artist/${n.artist.id}`, n.artist.name) : n.name, join: n.joinphrase || '' }));
  return { lead: '', parts };
}
const emitCredit = c => (c.lead || '') + (c.parts || []).map(p => `[${esc(p.label)}]${p.join}`).join('');
function parseCredit(str) {
  const parts = []; let lead = '', i = 0, last = 0; const re = /\[((?:\\.|[^\]])*)\]/g; let m, first = true;
  while ((m = re.exec(str))) {
    const between = str.slice(last, m.index);
    if (first) { lead = between; first = false; } else if (parts.length) parts[parts.length - 1].join = between;
    parts.push({ label: unesc(m[1]), join: '' });
    last = re.lastIndex;
  }
  if (parts.length) parts[parts.length - 1].join = str.slice(last);
  else lead = str;                       // join-only / plain text, no links
  return { lead, parts };
}

// ── WS2 -> model ──
export function toModel(r) {
  const R = makeRefs();
  const trep = r['text-representation'] || {};
  const entRef = (type, ent, credited) => ent ? R.ref(credited || ent.name || ent.title, `${MB}/${type}/${ent.id}`, ent.name || ent.title) : null;
  const m = {
    mbid: r.id,
    h1: `${(r['artist-credit'] || []).map(a => a.name).join(', ')} — ${r.title}`,
    info: {
      title: r.title, disambiguation: r.disambiguation || '',
      status: r.status || '', packaging: r.packaging || '', barcode: r.barcode || 'none',
      language: LANG[trep.language] || trep.language || '', script: SCRIPT[trep.script] || trep.script || '',
      artist: ws2Credit(r['artist-credit'], R),
      releaseGroup: r['release-group'] ? entRef('release-group', r['release-group']) : null,
    },
    events: (r['release-events'] || []).map(ev => ({ date: ev.date || '', country: ev.area ? ev.area.name : '' })),
    labels: (r['label-info'] || []).map(li => ({ label: li.label ? entRef('label', li.label) : null, catno: li['catalog-number'] || '' })),
    annotation: (r.annotation || '').trim(),
    links: (r.relations || []).filter(x => x['target-type'] === 'url').map(rel => {
      const url = rel.url.resource, host = hostName(url), t = norm(rel.type), h = norm(host);
      R.ref(host, url, host);
      return { label: host, type: (rel.type && !(t && h && (t.includes(h) || h.includes(t)))) ? rel.type : '', begin: rel.begin || '', end: rel.end || '', ended: !!rel.ended };
    }),
    media: (r.media || []).map(med => ({
      position: med.position, format: med.format || '', title: med.title || '',
      tracks: (med.tracks || []).map(t => ({ position: t.position, title: t.title, credit: ws2Credit(t['artist-credit'], R), length: t.length ? ms2len(t.length) : '', recording: entRef('recording', t.recording) })),
    })),
    refs: R.map,
  };
  return m;
}

// ── model -> Markdown ──
export function emit(m) {
  const L = [], P = (...x) => L.push(...x);
  const i = m.info;
  P(`# ${escTitle(m.h1)}`, '');
  P(`<!-- release ${m.mbid} · format v1 · DO NOT EDIT THIS LINE -->`, '');
  P('## Release information');
  P(`- **Title**: ${esc(i.title)}`);
  if (i.disambiguation) P(`- **Disambiguation**: ${esc(i.disambiguation)}`);
  P(`- **Status**: ${esc(i.status)}`);
  P(`- **Packaging**: ${esc(i.packaging)}`);
  P(`- **Barcode**: ${i.barcode}`);
  P(`- **Language**: ${esc(i.language)}`);
  P(`- **Script**: ${esc(i.script)}`);
  P(`- **Artist**: ${emitCredit(i.artist)}`);
  if (i.releaseGroup) P(`- **Release group**: [${esc(i.releaseGroup)}]`);
  P('');
  P('## Release events');
  for (const e of m.events) P(`- ${[e.date, esc(e.country)].filter(Boolean).join(', ')}`);
  P('');
  P('## Labels');
  for (const l of m.labels) P(`- ${l.label ? `[${esc(l.label)}]` : ''}${l.catno ? ' — ' + esc(l.catno) : ''}`);
  P('');
  P('## Annotation', m.annotation, '<!-- /end -->', '');
  P('## External links');
  for (const lk of m.links) {
    P(`- [${esc(lk.label)}]`);
    let dr = ''; if (lk.begin || lk.end) dr = `${lk.begin} → ${lk.end}`.trim(); if (lk.ended && !lk.end) dr = (dr ? dr + ' · ' : '') + 'ended';
    const parts = [lk.type || null, dr].filter(Boolean);
    if (parts.length) P(`  - ${parts.join(' · ')}`);
  }
  P('');
  P('## Tracklist');
  for (const med of m.media) {
    P(`### Medium ${med.position}${med.format ? ' — ' + esc(med.format) : ''}${med.title ? ' — ' + esc(med.title) : ''}`);
    for (const t of med.tracks) {
      const tail = [emitCredit(t.credit), t.length ? `(${t.length})` : ''].filter(Boolean).join(' ');
      const rec = t.recording ? ' → [' + esc(t.recording) + ']' : '';
      P(`${t.position}. ${escTitle(t.title)}${(tail || rec) ? ' — ' + tail + rec : ''}`);
    }
    P('');
  }
  P('<!-- references -->');
  for (const [lbl, v] of m.refs) P(`[${esc(lbl)}]: ${v.url}${v.main && v.main !== lbl ? ' (' + v.main + ')' : ''}`);
  return L.join('\n');
}

// ── Markdown -> model ──
const splitDelim = s => {                 // split a track line on the first UN-escaped " — "
  const m = s.match(/(^|[^\\]) — /);
  if (!m) return [s, null];
  const at = m.index + m[1].length;
  return [s.slice(0, at), s.slice(at + 3)];
};
export function parse(md) {
  const lines = md.split('\n');
  const m = { mbid: null, h1: '', info: {}, events: [], labels: [], annotation: '', links: [], media: [], refs: new Map() };
  const idm = md.match(/<!-- release (\S+) · format/); if (idm) m.mbid = idm[1];
  // foot refs first (needed by nothing here, but kept in model order as written)
  for (const ln of lines) { const r = ln.match(/^\[((?:\\.|[^\]])*)\]:\s+(\S+)(?:\s+\((.*)\))?\s*$/); if (r) m.refs.set(unesc(r[1]), { url: r[2], main: r[3] != null ? r[3] : unesc(r[1]) }); }
  const field = (s) => { const r = s.match(/^- \*\*[^*]+\*\*:\s?(.*)$/); return r ? r[1] : null; };
  const reflbl = (s) => { const r = (s || '').match(/^\[((?:\\.|[^\]])*)\]$/); return r ? unesc(r[1]) : null; };
  let sec = '', med = null;
  for (let k = 0; k < lines.length; k++) {
    let ln = lines[k];
    if (/^# /.test(ln)) { m.h1 = unesc(ln.slice(2)); continue; }
    let h = ln.match(/^## (.+)/); if (h) { sec = h[1].trim(); med = null; if (sec === 'Annotation') { const body = []; k++; while (k < lines.length && lines[k].trim() !== '<!-- /end -->') body.push(lines[k++]); m.annotation = body.join('\n').replace(/^\n+|\n+$/g, ''); } continue; }
    let mh = ln.match(/^### Medium (\d+)(?: — (.*))?$/); if (mh) { const rest = mh[2] || ''; const dash = rest.indexOf(' — '); med = { position: +mh[1], format: dash >= 0 ? unesc(rest.slice(0, dash)) : unesc(rest), title: dash >= 0 ? unesc(rest.slice(dash + 3)) : '', tracks: [] }; m.media.push(med); continue; }
    if (sec === 'Release information') {
      const v = field(ln); if (v == null) continue;
      const key = (ln.match(/\*\*([^*]+)\*\*/) || [])[1];
      if (key === 'Title') m.info.title = unesc(v);
      else if (key === 'Disambiguation') m.info.disambiguation = unesc(v);
      else if (key === 'Status') m.info.status = unesc(v);
      else if (key === 'Packaging') m.info.packaging = unesc(v);
      else if (key === 'Barcode') m.info.barcode = v;
      else if (key === 'Language') m.info.language = unesc(v);
      else if (key === 'Script') m.info.script = unesc(v);
      else if (key === 'Artist') m.info.artist = parseCredit(v);
      else if (key === 'Release group') m.info.releaseGroup = reflbl(v);
    } else if (sec === 'Release events') { const r = ln.match(/^- (.*)$/); if (r) { const c = r[1].split(', '); m.events.push({ date: c[0] === '' ? '' : c[0], country: unesc(c.slice(1).join(', ')) }); } }
    else if (sec === 'Labels') { const r = ln.match(/^- (.*)$/); if (r) { const [lab, cat] = splitOnEm(r[1]); m.labels.push({ label: reflbl(lab), catno: cat ? unesc(cat) : '' }); } }
    else if (sec === 'External links') {
      let r = ln.match(/^- \[((?:\\.|[^\]])*)\]\s*$/); if (r) { m.links.push({ label: unesc(r[1]), type: '', begin: '', end: '', ended: false }); continue; }
      let a = ln.match(/^  - (.*)$/); if (a && m.links.length) { const lk = m.links[m.links.length - 1]; const segs = a[1].split(' · '); for (const s of segs) { const dm = s.match(/^(\S*) → (\S*)$/); if (dm) { lk.begin = dm[1]; lk.end = dm[2]; } else if (s === 'ended') lk.ended = true; else lk.type = s; } }
    } else if (med && /^\d+\. /.test(ln)) {
      const r = ln.match(/^(\d+)\. (.*)$/);
      let [titlePart, rest] = splitDelim(r[2]);
      const t = { position: +r[1], title: unesc(titlePart.replace(/\s+$/, '')), credit: { lead: '', parts: [] }, length: '', recording: null };
      if (rest != null) {
        let recM = rest.match(/ → \[((?:\\.|[^\]])*)\]\s*$/); if (recM) { t.recording = unesc(recM[1]); rest = rest.slice(0, recM.index); }
        let lenM = rest.match(/\((\d?\d:\d\d(?::\d\d)?)\)\s*$/); if (lenM) { t.length = lenM[1]; rest = rest.slice(0, lenM.index); }
        t.credit = parseCredit(rest.replace(/\s+$/, ''));
      }
      med.tracks.push(t);
    }
  }
  return m;
}
function splitOnEm(s) { const m = s.match(/(^|[^\\]) — /); return m ? [s.slice(0, m.index + m[1].length), s.slice(m.index + m[1].length + 3)] : [s, null]; }
