// ==UserScript==
// @name         Scribe — edit MusicBrainz in your editor
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.6.30.33
// @description  Edit MusicBrainz in your real editor (VS Code, Vim, Notepad…) via the bundled `scribe` localhost helper. Two ways, chosen by trigger: Ctrl+Alt+E edits the FOCUSED text field; on a release Edit page, the bottom-left button (or Ctrl+Alt+R) edits the WHOLE release as one Markdown document and applies your saves back. Cross-browser via GM_xmlhttpRequest.
// @author       majkinetor
// @icon         https://raw.githubusercontent.com/majkinetor/musicbrainz-userscripts/main/userscripts/scribe/scribe.svg
// @match        *://*.musicbrainz.org/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-end
// @noframes
// ==/UserScript==

/* eslint-disable no-undef */
(function () {
  'use strict';
  const VERSION = '2026.6.30.33';
  const NAME = 'Scribe';
  // [ … ] reference-link brackets around a quill nib (currentColor — sits on the dark launcher/panel)
  const SCRIBE_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 4 L5 4 L5 20 L8.5 20"/><path d="M15.5 4 L19 4 L19 20 L15.5 20"/><path d="M12 7.5 L9.6 12.5 L12 17.5 L14.4 12.5 Z" fill="currentColor" stroke="none"/></svg>';
  // the PAGE window (MB.releaseEditor lives here); a userscript sandbox `window` is isolated,
  // so reach the editor model via unsafeWindow (same as Apollo). Falls back to window for tests.
  const W = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);

  // ── settings (shared defaults with the field-bridge EE) ───────────────────
  const cfg = {
    get port() { return GM_getValue('ee_port', 17999); },
    get token() { return GM_getValue('ee_token', 'extedit'); },
  };
  const base = () => `http://127.0.0.1:${cfg.port}`;
  const gm = opts => new Promise((res, rej) => GM_xmlhttpRequest({
    method: opts.method || 'GET', url: opts.url, data: opts.data, timeout: opts.timeout || 30000,
    headers: Object.assign({ 'X-ExtEdit-Token': cfg.token }, opts.headers || {}),
    onload: r => res(r), onerror: () => rej(new Error('network')), ontimeout: () => rej(new Error('timeout')),
  }));
  const ping = async () => { try { return (await gm({ url: base() + '/ping', timeout: 4000 })).status === 200; } catch (e) { return false; } };
  const sleep = ms => new Promise(z => setTimeout(z, ms));

  // bottom-right session window: ONE table of the fields changed this session — errored fields
  // first (each with a ⌖ "go to field" button) then applied changes — with an error-count badge
  // in the header. ✕ stops editing (closes the session). No other chatter.
  let panel = null, bodyEl = null, badgeEl = null, tblEl = null, collapsed = false;
  const trunc = (s, n) => { s = String(s == null ? '' : s).replace(/\n+/g, ' '); n = n || 30; return s.length > n + 2 ? s.slice(0, n) + '…' : s; };
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div'); panel.id = 'scribe-panel';
    panel.style.cssText = 'position:fixed;z-index:2147483647;right:12px;bottom:12px;width:360px;max-width:48vw;background:#222c27;color:#e7ece9;border-radius:9px;font:12px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.4);overflow:hidden';
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;gap:6px;padding:7px 10px;background:#1b2520;cursor:move;user-select:none';
    const ic = document.createElement('span'); ic.innerHTML = SCRIBE_ICON; ic.style.cssText = 'display:flex;color:#6cc08a';
    const ttl = document.createElement('span'); ttl.textContent = `${NAME} v${VERSION}`; ttl.style.cssText = 'flex:1;font-weight:700;letter-spacing:.2px';
    badgeEl = document.createElement('span'); badgeEl.title = 'fields not applied'; badgeEl.style.cssText = 'display:none;background:#c0392b;color:#fff;font-weight:700;font-size:10px;border-radius:9px;padding:1px 7px;min-width:12px;text-align:center';
    const col = document.createElement('span'); col.textContent = '–'; col.title = 'collapse'; col.style.cssText = 'padding:0 7px;cursor:pointer;font-weight:700';
    const cls = document.createElement('span'); cls.textContent = '✕'; cls.title = 'Stop editing this release'; cls.style.cssText = 'padding:0 4px;cursor:pointer';
    hdr.append(ic, ttl, badgeEl, col, cls);
    bodyEl = document.createElement('div');
    tblEl = document.createElement('div'); tblEl.style.cssText = 'max-height:60vh;overflow:auto';
    bodyEl.append(tblEl);
    panel.append(hdr, bodyEl); document.body.appendChild(panel);
    const setCol = c => { collapsed = c; bodyEl.style.display = c ? 'none' : ''; col.textContent = c ? '+' : '–'; col.title = c ? 'expand' : 'collapse'; };
    cls.onclick = e => { e.stopPropagation(); stopSession(); };   // ✕ = stop editing (and close the window)
    let dragging = false, moved = false, dx = 0, dy = 0;
    hdr.addEventListener('mousedown', e => { if (e.target === cls || e.target === col) return; dragging = true; moved = false; const r = panel.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; e.preventDefault(); });
    window.addEventListener('mousemove', e => { if (!dragging) return; moved = true; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.left = Math.max(0, Math.min(window.innerWidth - 40, e.clientX - dx)) + 'px'; panel.style.top = Math.max(0, Math.min(window.innerHeight - 24, e.clientY - dy)) + 'px'; });
    window.addEventListener('mouseup', () => { dragging = false; });
    hdr.onclick = e => { if (e.target === cls) return; if (moved) { moved = false; return; } setCol(!collapsed); };
    // re-render when MusicBrainz's own validation state flips (reliable observable — no DOM polling)
    try { const ee = W.MB.releaseEditor.validation.errorsExist; if (ee && ee.subscribe) ee.subscribe(() => { if (session && session.active && !collapsed) renderSession(); }); } catch (e) {}
  }
  function showPanel() { ensurePanel(); panel.style.display = ''; }
  // bring the editor window to the front so a flagged value can be fixed
  function reopenEditor() { if (session && session.active) gm({ method: 'POST', url: base() + '/open', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ id: session.id }) }).catch(() => {}); }
  // scroll to + focus + briefly highlight a native MB field (the error row's "go to field" action)
  function focusNative(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    try { (el.focus ? el : el.querySelector('input,select,textarea,button')).focus(); } catch (e) {}
    const prev = el.style.boxShadow; el.style.boxShadow = '0 0 0 3px #e53935';
    setTimeout(() => { try { el.style.boxShadow = prev; } catch (e) {} }, 1600);
  }
  const sectionHead = (text, kind) => { const h = document.createElement('div'); h.textContent = text; h.style.cssText = 'padding:5px 10px;font-weight:700;font-size:11px;position:sticky;top:0;' + (kind === 'err' ? 'color:#ffd9d4;background:#5e2520' : 'color:#cfeedd;background:#21492f'); return h; };
  // MusicBrainz's own validation state. The editor always renders EVERY error row (collapsing the
  // inactive ones), so scraping the DOM yields false positives ("A release title is required" while a
  // title exists). The model exposes a reliable boolean instead — surface THAT (the page itself marks
  // the offending field in red); we don't guess the individual messages.
  const mbHasErrors = () => { try { return !!W.MB.releaseEditor.validation.errorsExist(); } catch (e) { return false; } };
  // render the session table from session.changed (accumulated applied) + session.problems (current)
  function renderSession(placeholder) {
    ensurePanel(); panel.style.display = ''; tblEl.innerHTML = '';
    const problems = (session && session.problems) || [];
    const changed = (session && session.changed) || new Map();
    const mbErr = mbHasErrors();
    const errCount = problems.length + (mbErr ? 1 : 0);
    badgeEl.style.display = errCount ? '' : 'none'; badgeEl.textContent = String(errCount);
    if (mbErr) {
      tblEl.appendChild(sectionHead('⚠ MusicBrainz validation errors', 'err'));
      const row = document.createElement('div'); row.style.cssText = 'padding:5px 10px;background:#3a2420;border-top:1px solid #4a302c;color:#ffd9d4;line-height:1.35;font-size:11px';
      row.textContent = 'The form has errors and won’t submit — the offending fields are marked in red on the page.';
      tblEl.appendChild(row);
    }
    if (problems.length) {
      tblEl.appendChild(sectionHead(`⚠ ${problems.length} not applied — fix & save`, 'err'));
      for (const p of problems) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 10px;background:#3a2420;border-top:1px solid #4a302c';
        const f = document.createElement('span'); f.textContent = p.field; f.title = p.field; f.style.cssText = 'flex:0 0 40%;color:#e7c9c4;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const v = document.createElement('span'); v.textContent = p.value == null || p.value === '' ? '(empty)' : p.value; v.title = v.textContent; v.style.cssText = 'flex:1;color:#ffd9d4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const b = document.createElement('button'); b.textContent = '⌖'; b.title = 'Focus this field in MusicBrainz to fix it'; b.style.cssText = 'flex:0 0 auto;cursor:pointer;background:#6b3a34;color:#fff;border:none;border-radius:4px;padding:1px 7px;font-size:12px';
        b.onclick = () => (p.focus || reopenEditor)();
        row.append(f, v, b); tblEl.appendChild(row);
      }
    }
    if (changed.size) {
      tblEl.appendChild(sectionHead(`✓ ${changed.size} changed — review & submit`, 'ok'));
      for (const [field, c] of changed) {
        const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 10px;border-top:1px solid rgba(255,255,255,.05)';
        const f = document.createElement('span'); f.textContent = field; f.title = field; f.style.cssText = 'flex:0 0 40%;color:#bfe9cf;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const v = document.createElement('span'); v.textContent = `${trunc(c.from)} → ${trunc(c.to)}`; v.title = `${c.from} → ${c.to}`; v.style.cssText = 'flex:1;color:#e7ece9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        row.append(f, v); tblEl.appendChild(row);
      }
    }
    if (!problems.length && !changed.size && !mbErr) {
      const ph = document.createElement('div'); ph.textContent = placeholder || 'Editing — save in your editor to apply.'; ph.style.cssText = 'padding:8px 10px;color:#9aa8a1;font-size:11px';
      tblEl.appendChild(ph);
    }
  }

  // ════════════════════ release ⇄ markdown lib ════════════════════
  const LANG = { eng: 'English', deu: 'German', fra: 'French', spa: 'Spanish', jpn: 'Japanese', ita: 'Italian', por: 'Portuguese', rus: 'Russian', mul: '[Multiple languages]', zxx: '[No linguistic content]' };   // bracketed names match the editor's <select> option text exactly
  const SCRIPT = { Latn: 'Latin', Cyrl: 'Cyrillic', Jpan: 'Japanese', Hani: 'Han', Kore: 'Korean', Grek: 'Greek' };
  const HOST = [[/discogs\.com/, 'Discogs'], [/bandcamp\.com/, 'Bandcamp'], [/open\.spotify|spotify\.com/, 'Spotify'], [/music\.apple\.com/, 'Apple Music'], [/deezer\.com/, 'Deezer'], [/youtube\.com|youtu\.be/, 'YouTube'], [/tidal\.com/, 'Tidal'], [/qobuz\.com/, 'Qobuz']];
  const MBROOT = 'https://musicbrainz.org';
  const TYPES = ['artist', 'label', 'recording', 'release-group', 'release', 'area', 'place', 'work'];
  const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/[\[\]]/g, '\\$&');
  const escTitle = s => esc(s).replace(/ — /g, ' \\— ');
  const unesc = s => String(s == null ? '' : s).replace(/\\(.)/g, '$1');
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ms2len = ms => ms ? `${Math.floor(ms / 60000)}:${String(Math.round(ms % 60000 / 1000)).padStart(2, '0')}` : '';
  const hostName = u => { for (const [re, n] of HOST) if (re.test(u)) return n; try { return new URL(u).host.replace(/^www\./, ''); } catch (e) { return u; } };
  const mbidFromUrl = u => (String(u).match(/\/([0-9a-f-]{36})\b/i) || [])[1] || null;

  function makeRefs() {
    const map = new Map();
    function ref(display, url, main) { let key = display || main || url, n = 1; while (map.has(key) && map.get(key).url !== url) { n++; key = `${display}·${n}`; } map.set(key, { url, main: main || display }); return key; }
    return { map, ref };
  }
  const ws2Credit = (ac, R) => ({ lead: '', parts: (ac || []).map(n => ({ label: n.artist ? R.ref(n.name, `${MBROOT}/artist/${n.artist.id}`, n.artist.name) : n.name, join: n.joinphrase || '' })) });
  const emitCredit = c => (c.lead || '') + (c.parts || []).map(p => `[${esc(p.label)}]${p.join}`).join('');
  function parseCredit(str) {
    const parts = []; let lead = '', last = 0; const re = /\[((?:\\.|[^\]])*)\]/g; let m, first = true;
    while ((m = re.exec(str))) { const between = str.slice(last, m.index); if (first) { lead = between; first = false; } else if (parts.length) parts[parts.length - 1].join = between; parts.push({ label: unesc(m[1]), join: '' }); last = re.lastIndex; }
    if (parts.length) parts[parts.length - 1].join = str.slice(last); else lead = str;
    return { lead, parts };
  }
  function toModel(r) {
    const R = makeRefs(); const trep = r['text-representation'] || {};
    const entRef = (type, ent, credited) => ent ? R.ref(credited || ent.name || ent.title, `${MBROOT}/${type}/${ent.id}`, ent.name || ent.title) : null;
    const m = {
      mbid: r.id, h1: `${(r['artist-credit'] || []).map(a => a.name).join(', ')} — ${r.title}`,
      info: { title: r.title, disambiguation: r.disambiguation || '', status: r.status || '', packaging: r.packaging || '', barcode: r.barcode || 'none', language: LANG[trep.language] || trep.language || '', script: SCRIPT[trep.script] || trep.script || '', artist: ws2Credit(r['artist-credit'], R), releaseGroup: r['release-group'] ? entRef('release-group', r['release-group']) : null },
      events: (r['release-events'] || []).map(ev => ({ date: ev.date || '', country: ev.area ? ev.area.name : '' })),
      labels: (r['label-info'] || []).map(li => ({ label: li.label ? entRef('label', li.label) : null, catno: li['catalog-number'] || '' })),
      annotation: (r.annotation || '').trim(),
      links: (r.relations || []).filter(x => x['target-type'] === 'url').map(rel => { const url = rel.url.resource, host = hostName(url), t = norm(rel.type), h = norm(host), tok = s => (String(s).toLowerCase().match(/[a-z0-9]+/) || [''])[0]; const overlap = (t && h && (t.includes(h) || h.includes(t))) || (tok(host) && tok(host) === tok(rel.type)); return { label: host, url, type: (rel.type && !overlap) ? rel.type : '', begin: rel.begin || '', end: rel.end || '', ended: !!rel.ended }; }),   // inline [host](url); suppress a type that just echoes the host (discogs/discogs, amazon.co.uk/"amazon asin")
      media: (r.media || []).map(med => ({ position: med.position, format: med.format || '', title: med.title || '', tracks: (med.tracks || []).map(t => ({ position: t.position, title: t.title, credit: ws2Credit(t['artist-credit'], R), length: t.length ? ms2len(t.length) : '', recording: entRef('recording', t.recording) })) })),
      refs: R.map,
    };
    return m;
  }
  function emit(m) {
    const L = [], P = (...x) => L.push(...x), i = m.info;
    P(`# ${esc(m.h1)}`, '', `<!-- release ${m.mbid} · format v1 · DO NOT EDIT THIS LINE -->`, '');   // H1 is display-only (never split) — no need to escape the — delimiter here
    P('## Release information', '');   // blank line after every section header (header ↕ body)
    // order: Title · Artist · Release group · Status · Language · Script · Barcode · Packaging · Disambiguation
    P(`- **Title**: ${esc(i.title)}`, `- **Artist**: ${emitCredit(i.artist)}`);
    if (i.releaseGroup) P(`- **Release group**: [${esc(i.releaseGroup)}]`);
    // enum values are controlled vocab whose canonical names can include brackets ([Multiple languages]);
    // a field value parses whole (brackets don't break it), so emit them unescaped to match the <select> text
    P(`- **Status**: ${i.status}`, `- **Language**: ${i.language}`, `- **Script**: ${i.script}`, `- **Barcode**: ${i.barcode}`, `- **Packaging**: ${i.packaging}`, `- **Disambiguation**: ${esc(i.disambiguation)}`);   // always emit Disambiguation (even empty) so it can be filled in
    P('', '### Release events', ''); for (const e of m.events) P(`- ${[e.date, esc(e.country)].filter(Boolean).join(', ')}`);
    P('', '### Labels', ''); for (const l of m.labels) P(`- ${l.label ? `[${esc(l.label)}]` : ''}${l.catno ? ' — ' + esc(l.catno) : ''}`);
    P('', '### Annotation', '', m.annotation, '<!-- /end -->', '', '### External links', '<!-- NOT applied: links round-trip but are not written back yet — add/edit/reorder links in the native editor -->', '');
    for (const lk of m.links) { P(`- [${esc(lk.label)}](${lk.url || ''})`); let dr = ''; if (lk.begin || lk.end) dr = `${lk.begin} → ${lk.end}`.trim(); if (lk.ended && !lk.end) dr = (dr ? dr + ' · ' : '') + 'ended'; const parts = [lk.type || null, dr].filter(Boolean); if (parts.length) P(`  - ${parts.join(' · ')}`); }
    P('', '## Tracklist', '', '<!-- track titles, lengths & artists apply; adding/removing/reordering tracks does NOT — do structural changes in the native editor -->', '');
    for (const med of m.media) { P(`### Medium ${med.position}${med.format ? ' — ' + esc(med.format) : ''}${med.title ? ' — ' + esc(med.title) : ''}`, ''); for (const t of med.tracks) { const tail = [emitCredit(t.credit), t.length ? `(${t.length})` : ''].filter(Boolean).join(' '); const rec = t.recording ? ' → [' + esc(t.recording) + ']' : ''; P(`${t.position}. ${escTitle(t.title)}${(tail || rec) ? ' — ' + tail + rec : ''}`); } P(''); }
    P('<!-- references -->'); for (const [lbl, v] of m.refs) P(`[${esc(lbl)}]: ${v.url}${v.main && v.main !== lbl ? ' (' + v.main + ')' : ''}`);
    return L.join('\n');
  }
  const splitDelim = s => { const m = s.match(/(^|[^\\]) — /); if (!m) return [s, null]; const at = m.index + m[1].length; return [s.slice(0, at), s.slice(at + 3)]; };
  function parse(md) {
    const lines = md.split('\n'); const m = { mbid: null, h1: '', info: {}, events: [], labels: [], annotation: '', links: [], media: [], refs: new Map() };
    const idm = md.match(/<!-- release (\S+) · format/); if (idm) m.mbid = idm[1];
    for (const ln of lines) { const r = ln.match(/^\[((?:\\.|[^\]])*)\]:\s+(\S+)(?:\s+\((.*)\))?\s*$/); if (r) m.refs.set(unesc(r[1]), { url: r[2], main: r[3] != null ? r[3] : unesc(r[1]) }); }
    const field = s => { const r = s.match(/^- \*\*[^*]+\*\*:\s?(.*)$/); return r ? r[1] : null; };
    const reflbl = s => { const r = (s || '').match(/^\[((?:\\.|[^\]])*)\]$/); return r ? unesc(r[1]) : null; };
    let sec = '', med = null;
    for (let k = 0; k < lines.length; k++) {
      let ln = lines[k];
      if (/^# /.test(ln)) { m.h1 = unesc(ln.slice(2)); continue; }
      let mh = ln.match(/^### Medium (\d+)(?: — (.*))?$/); if (mh) { const rest = mh[2] || '', dash = rest.indexOf(' — '); med = { position: +mh[1], format: dash >= 0 ? unesc(rest.slice(0, dash)) : unesc(rest), title: dash >= 0 ? unesc(rest.slice(dash + 3)) : '', tracks: [] }; m.media.push(med); continue; }   // check medium BEFORE the generic ## / ### section header
      let h = ln.match(/^#{2,3} (.+)/); if (h) { sec = h[1].trim(); med = null; if (sec === 'Annotation') { const body = []; k++; while (k < lines.length && lines[k].trim() !== '<!-- /end -->') body.push(lines[k++]); m.annotation = body.join('\n').replace(/^\n+|\n+$/g, ''); } continue; }   // ## Release information / ## Tracklist, and ### Release events|Labels|Annotation|External links
      if (sec === 'Release information') {
        const v = field(ln); if (v == null) continue; const key = (ln.match(/\*\*([^*]+)\*\*/) || [])[1];
        if (key === 'Title') m.info.title = unesc(v); else if (key === 'Disambiguation') m.info.disambiguation = unesc(v); else if (key === 'Status') m.info.status = unesc(v);
        else if (key === 'Packaging') m.info.packaging = unesc(v); else if (key === 'Barcode') m.info.barcode = v; else if (key === 'Language') m.info.language = unesc(v);
        else if (key === 'Script') m.info.script = unesc(v); else if (key === 'Artist') m.info.artist = parseCredit(v); else if (key === 'Release group') m.info.releaseGroup = reflbl(v);
      } else if (sec === 'Release events') { const r = ln.match(/^- (.*)$/); if (r) { const c = r[1].split(', '); m.events.push({ date: c[0] || '', country: unesc(c.slice(1).join(', ')) }); } }
      else if (sec === 'Labels') { const r = ln.match(/^- (.*)$/); if (r) { const sp = splitDelim(r[1]); m.labels.push({ label: reflbl(sp[0]), catno: sp[1] ? unesc(sp[1]) : '' }); } }
      else if (sec === 'External links') {
        let r = ln.match(/^- \[((?:\\.|[^\]])*)\](?:\(([^)]*)\))?\s*$/); if (r) { m.links.push({ label: unesc(r[1]), url: (r[2] || '').trim(), type: '', begin: '', end: '', ended: false }); continue; }   // [label](url) inline notation (url optional)
        let a = ln.match(/^  - (.*)$/); if (a && m.links.length) { const lk = m.links[m.links.length - 1]; for (const s of a[1].split(' · ')) { const dm = s.match(/^(\S*) → (\S*)$/); if (dm) { lk.begin = dm[1]; lk.end = dm[2]; } else if (s === 'ended') lk.ended = true; else lk.type = s; } }
      } else if (med && /^\d+\. /.test(ln)) {
        const r = ln.match(/^(\d+)\. (.*)$/); let [titlePart, rest] = splitDelim(r[2]);
        const t = { position: +r[1], title: unesc(titlePart.replace(/\s+$/, '')), credit: { lead: '', parts: [] }, length: '', recording: null };
        if (rest != null) { let recM = rest.match(/ → \[((?:\\.|[^\]])*)\]\s*$/); if (recM) { t.recording = unesc(recM[1]); rest = rest.slice(0, recM.index); } let lenM = rest.match(/\((\d?\d:\d\d(?::\d\d)?)\)\s*$/); if (lenM) { t.length = lenM[1]; rest = rest.slice(0, lenM.index); } t.credit = parseCredit(rest.replace(/\s+$/, '')); }
        med.tracks.push(t);
      }
    }
    return m;
  }

  // ════════════════════ MB page glue ════════════════════
  const u = v => { try { return typeof v === 'function' ? v() : v; } catch (e) { return undefined; } };
  const releaseMbid = () => (location.pathname.match(/release\/([0-9a-f-]{36})/i) || [])[1] || null;
  const onEditPage = () => /\/release\/[0-9a-f-]{36}\/edit/i.test(location.pathname) && releaseMbid();
  async function fetchWs2(id) {
    const inc = 'artist-credits+labels+recordings+release-groups+url-rels+media+annotation';
    const r = await fetch(`/ws/2/release/${id}?inc=${inc}&fmt=json`, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('WS2 ' + r.status); return r.json();
  }
  async function exportMd() { const id = releaseMbid(); if (!id) throw new Error('no release id'); return emit(toModel(await fetchWs2(id))); }

  // Apollo mirrors the model from a snapshot and doesn't observe our model writes, so nudge it
  // to rebuild after we apply (native MB updates on its own). No-op if Apollo isn't installed.
  async function refreshApollo() {
    const A = W.__apolloEditor; if (!A) return;
    try { if ('apolloOn' in A && !A.apolloOn) return; } catch (e) { return; }   // Apollo is off — don't switch it on
    try {
      // nudge Apollo's Markdown annotation editor to re-read the value we just set (it syncs on
      // the textarea's input event, not on a programmatic ko change)
      const ta = document.getElementById('annotation'); if (ta) ta.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof A.rebuild === 'function') { await A.rebuild(true); return; }                       // light: rebuild model + rerender, no re-match (newer Apollo)
      // older Apollo: refresh its model from the editor, then re-mount the mirror so the rows
      // actually re-render (showMirror alone doesn't re-render an already-mounted mirror).
      if (typeof A.buildModel === 'function') await A.buildModel();
      if (typeof A.hideMirror === 'function' && typeof A.showMirror === 'function') { A.hideMirror(); await A.showMirror(); }
    } catch (e) {}
  }

  // A new linked artist must be a COMPLETE entity (with MB's internal numeric id), not just {gid,name}
  // — otherwise MB's React artist-credit widget treats it as unresolved and drops it, leaving plain
  // text ("set as text only"). Fetch the full entity by gid from MB's internal endpoint and cache it.
  const _artistCache = new Map();
  async function resolveArtist(gid) {
    if (!gid || _artistCache.has(gid)) return;
    try { const r = await fetch(`/ws/js/entity/${gid}`, { headers: { accept: 'application/json' } }); if (!r.ok) return; const d = await r.json(); if (d && d.gid && d.id != null) _artistCache.set(gid, W.MB.entity(d, 'artist')); } catch (e) {}
  }
  async function resolveArtistsIn(parsed) {
    const gids = new Set();
    const collect = pc => { for (const p of ((pc && pc.parts) || [])) { const ref = parsed.refs.get(p.label); const g = ref && mbidFromUrl(ref.url); if (g) gids.add(g); } };
    collect(parsed.info && parsed.info.artist);
    for (const med of (parsed.media || [])) for (const t of (med.tracks || [])) collect(t.credit);
    await Promise.all([...gids].map(resolveArtist));
  }
  const gidOf = art => { try { return art ? (typeof art.gid === 'function' ? art.gid() : art.gid) : null; } catch (e) { return null; } };
  const creditStr = names => (names || []).map(n => (u(n.name) || '') + (u(n.joinPhrase) || '')).join('') || '(none)';
  // Credit apply/diff. The artistCredit is a ko observable wrapping a plain object whose `names`
  // is a plain array of {name:credited-as, artist, joinPhrase}. We rebuild that array reusing the
  // existing artist objects (credited-as / join / reorder / drop), build entities for swap/add by
  // MBID, and name-only entities for brand-new artists. Records a {from,to} diff; writes only when
  // not `dry`.
  function applyCredit(acObs, pc, refs, changes, label, dry, problems) {
    if (!pc || typeof acObs !== 'function') return;
    const ac = acObs(); if (!ac || !Array.isArray(ac.names)) return;
    const curNames = ac.names, parts = pc.parts || [];
    // emptied the field but there ARE artists → can't remove (a release/track requires an artist) → flag it
    if (!parts.length) {
      // unset the credit (one empty slot, like the native "clear") — idempotent
      const alreadyEmpty = !curNames.length || (curNames.length === 1 && !u(curNames[0].name) && !curNames[0].artist);
      if (!alreadyEmpty) { changes.push({ label, from: creditStr(curNames), to: '(unset)' }); if (!dry) { try { acObs(Object.assign({}, ac, { names: [{ name: '', artist: null, joinPhrase: '' }] })); } catch (e) {} } }
      return;
    }
    const byGid = new Map(); curNames.forEach(n => { const g = gidOf(n.artist); if (g) byGid.set(g, n.artist); });
    const desired = [];
    for (const p of parts) {
      const r = refs.get(p.label), gid = r && mbidFromUrl(r.url);
      let artist = gid ? (byGid.get(gid) || _artistCache.get(gid)) : null;   // prefer a fully-resolved entity (has the internal id)
      if (!artist) { try { artist = gid ? W.MB.entity({ gid, name: r.main || p.label }, 'artist') : W.MB.entity({ name: p.label }, 'artist'); } catch (e) { problems && problems.push({ field: label, value: p.label }); return; } }
      if (!artist || (gid && gidOf(artist) !== gid)) { problems && problems.push({ field: label, value: p.label }); return; }
      desired.push({ name: p.label, artist, joinPhrase: p.join || '' });
    }
    const sig = arr => arr.map(n => `${gidOf(n.artist) || ''}|${u(n.name) || ''}|${u(n.joinPhrase) || ''}`).join('§');
    if (sig(curNames) === sig(desired)) return;
    changes.push({ label, from: creditStr(curNames), to: creditStr(desired) });
    if (!dry) {
      const write = () => { try { const cur = acObs(); acObs(Object.assign({}, cur || ac, { names: desired })); } catch (e) {} };
      write();
      // MB's React artist-credit widget re-syncs moments later and drops freshly-built linked entities
      // (keeping only the credited-as text — the "set as text only" bug); re-assert until it settles.
      setTimeout(write, 800); setTimeout(write, 1800);
    }
  }

  // Compute the diff between the parsed MD and the live editor model as [{label, from, to}].
  // With dry=true it ONLY computes (no writes) — the dry-run preview; otherwise it also applies.
  function diffMd(parsed, dry) {
    const ed = W.MB && W.MB.releaseEditor; if (!ed) throw new Error('release editor not ready');
    const rel = ed.rootField.release(); const changes = [], problems = [];
    const setObs = (label, obs, val) => { if (typeof obs !== 'function') return; const f = String(u(obs) == null ? '' : u(obs)), t = String(val == null ? '' : val); if (f !== t) { changes.push({ label, from: f || '(empty)', to: t || '(empty)' }); if (!dry) try { obs(val); } catch (e) {} } };
    const i = parsed.info || {};
    if (i.title != null) setObs('release title', rel.name, i.title);
    if (i.disambiguation != null) setObs('disambiguation', rel.comment, i.disambiguation);
    if (i.barcode != null && rel.barcode && typeof rel.barcode.value === 'function') { const bv = i.barcode === 'none' ? '' : i.barcode, f = String(u(rel.barcode.value) || ''); if (f !== bv) { changes.push({ label: 'barcode', from: f || '(none)', to: bv || '(none)' }); if (!dry) try { rel.barcode.value(bv); } catch (e) {} } }
    if (parsed.annotation != null) setObs('annotation', rel.annotation, parsed.annotation);
    if (i.artist) applyCredit(rel.artistCredit, i.artist, parsed.refs, changes, 'release artist', dry, problems);
    for (const med of (parsed.media || [])) {
      const lm = rel.mediums()[med.position - 1]; if (!lm) continue; const lts = lm.tracks();
      // medium format + title from "### Medium N — format — title" (format is an enum, like status)
      const _ci = x => String(x).trim().toLowerCase();
      let medTitle = med.title;
      if (med.format && typeof lm.formatID === 'function') {
        const fsel = [...document.querySelectorAll('select')].filter(s => (s.getAttribute('data-bind') || '').includes('value: formatID'))[med.position - 1];
        const opt = fsel && [...fsel.options].find(o => _ci(o.textContent) === _ci(med.format));
        if (opt) { const cur = String(u(lm.formatID)); if (cur !== String(opt.value)) { const co = [...fsel.options].find(o => String(o.value) === cur); changes.push({ label: `medium ${med.position} format`, from: (co ? co.textContent.trim() : '') || '(none)', to: opt.textContent.trim() }); if (!dry) try { lm.formatID(opt.value); } catch (e) {} } }
        else if (fsel && !med.title) medTitle = med.format;   // select found but segment-1 isn't a known format → it's the medium title, not a format
        else if (fsel) problems.push({ field: `medium ${med.position} format`, value: med.format, focus: () => focusNative(fsel) });   // 2-segment header with an invalid format → flag it
      }
      if (medTitle) setObs(`medium ${med.position} title`, lm.name, medTitle);   // the medium's own title (lm.name)
      for (const t of med.tracks) {
        let lt = null; const recUrl = t.recording && parsed.refs.get(t.recording) && parsed.refs.get(t.recording).url; const recGid = recUrl && mbidFromUrl(recUrl);
        if (recGid) lt = lts.find(x => { const rc = u(x.recording); return rc && u(rc.gid) === recGid; });
        if (!lt) lt = lts[t.position - 1]; if (!lt) continue;
        const tag = `track ${med.position}.${t.position}`;
        setObs(`${tag} title`, lt.name, t.title);   // the "N." marker is position/order, not the `number` field — not written
        if (t.length != null) setObs(`${tag} length`, lt.formattedLength, t.length);   // '' clears an existing length (export always shows present lengths, so '' = removed)
        applyCredit(lt.artistCredit, t.credit, parsed.refs, changes, `${tag} artist`, dry, problems);
      }
    }
    // release-level enums — name → id via the page's ko-bound <select> options
    const selFor = fid => [...document.querySelectorAll('select')].find(s => (s.getAttribute('data-bind') || '').includes('value: ' + fid));
    const optText = (s, val) => { const o = [...s.options].find(o => o.value === String(val)); return o ? o.textContent.trim() : String(val); };
    const setEnum = (label, obs, fid, name) => {
      if (name == null || typeof obs !== 'function') return;   // field absent → leave it; '' means clear (the empty <option>)
      const s = selFor(fid); if (!s) return;
      const ci = x => String(x).trim().toLowerCase();   // option text match is case-insensitive (digibook == Digibook)
      const opt = name === '' ? [...s.options].find(o => o.value === '') : [...s.options].find(o => ci(o.textContent) === ci(name));
      if (!opt) { problems.push({ field: label, value: name, focus: () => focusNative(selFor(fid)) }); return; }   // unknown value → surface it, don't silently skip
      const cur = String(u(obs)); if (cur !== String(opt.value)) { changes.push({ label, from: optText(s, cur) || '(none)', to: opt.value === '' ? '(none)' : opt.textContent.trim() }); if (!dry) try { obs(opt.value); } catch (e) {} }
    };
    setEnum('status', rel.statusID, 'statusID', i.status);
    setEnum('packaging', rel.packagingID, 'packagingID', i.packaging);
    setEnum('language', rel.languageID, 'languageID', i.language);
    setEnum('script', rel.scriptID, 'scriptID', i.script);
    const ci = x => String(x).trim().toLowerCase();
    // release events — add/remove to match the MD, then edit each by index
    const fmtd = (y, mo, d) => (y ? '' + y : '') + (mo ? '-' + String(mo).padStart(2, '0') : '') + (d ? '-' + String(d).padStart(2, '0') : '');
    const pevents = parsed.events || [];
    const evArr = () => (typeof rel.events === 'function' && rel.events()) || [];
    const ev0 = evArr().length;
    for (let idx = pevents.length; idx < ev0; idx++) { const le = evArr()[idx]; changes.push({ label: `event ${idx + 1} (remove)`, from: (le && le.date ? fmtd(u(le.date.year), u(le.date.month), u(le.date.day)) : '') || '(event)', to: '(removed)' }); }
    if (!dry) { const cur = evArr().slice(); for (let idx = cur.length - 1; idx >= pevents.length; idx--) try { rel.events.remove(cur[idx]); } catch (e) {} }
    for (let idx = ev0; idx < pevents.length; idx++) { const pe = pevents[idx]; changes.push({ label: `event ${idx + 1} (add)`, from: '(none)', to: [pe.date, pe.country].filter(Boolean).join(', ') || '(event)' }); if (!dry) try { rel.events.push(new ed.fields.ReleaseEvent({}, rel)); } catch (e) {} }
    pevents.forEach((pe, idx) => {
      const le = evArr()[idx]; if (!le) return;
      if (le.date && typeof le.date.year === 'function') {
        const m = (pe.date || '').match(/^(\d{4})?(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/) || [];
        const ny = m[1] || '', nmo = m[2] || '', nd = m[3] || '';   // STRINGS — a numeric year trips MB's "year should have four digits" check
        const cy = u(le.date.year), cmo = u(le.date.month), cd = u(le.date.day);
        const same = (a, b) => String(a == null || a === '' ? '' : +a) === String(b == null || b === '' ? '' : +b);
        if (!same(cy, ny) || !same(cmo, nmo) || !same(cd, nd)) {
          changes.push({ label: `event ${idx + 1} date`, from: fmtd(cy, cmo, cd) || '(none)', to: fmtd(ny, nmo, nd) || '(none)' });
          if (!dry) try { le.date.year(ny); le.date.month(nmo); le.date.day(nd); } catch (e) {}
        }
      }
      if (pe.country != null && typeof le.countryID === 'function') {   // '' clears the country (the empty <option>)
        const s = selFor('countryID'), opt = s && (pe.country === '' ? [...s.options].find(o => o.value === '') : [...s.options].find(o => ci(o.textContent) === ci(pe.country)));
        if (opt) { const cur = String(u(le.countryID)); if (cur !== String(opt.value)) { changes.push({ label: `event ${idx + 1} country`, from: (s ? optText(s, cur) : cur) || '(none)', to: opt.value === '' ? '(none)' : opt.textContent.trim() }); if (!dry) try { le.countryID(opt.value); } catch (e) {} } }
        else problems.push({ field: `event ${idx + 1} country`, value: pe.country, focus: () => focusNative([...document.querySelectorAll('select')].filter(x => (x.getAttribute('data-bind') || '').includes('value: countryID'))[idx]) });
      }
    });
    // labels — add/remove to match the MD, then change entity + cat# by index
    const plabels = parsed.labels || [];
    const labArr = () => (typeof rel.labels === 'function' && rel.labels()) || [];
    // a label entity: by MBID if a footer ref resolves, else a brand-new label by name (like new artists) — no link needed
    const labEnt = pl => { if (!pl.label) return null; const ref = parsed.refs.get(pl.label), gid = ref && mbidFromUrl(ref.url); return gid ? { gid, name: ref.main || pl.label } : { name: pl.label }; };
    const lab0 = labArr().length;
    for (let idx = plabels.length; idx < lab0; idx++) { const ll = labArr()[idx], nm = ll && u(ll.label) && u(u(ll.label).name); changes.push({ label: `label ${idx + 1} (remove)`, from: nm || (ll && u(ll.catalogNumber)) || '(label)', to: '(removed)' }); }
    if (!dry) { const cur = labArr().slice(); for (let idx = cur.length - 1; idx >= plabels.length; idx--) try { rel.labels.remove(cur[idx]); } catch (e) {} }
    for (let idx = lab0; idx < plabels.length; idx++) { const pl = plabels[idx], e = labEnt(pl); changes.push({ label: `label ${idx + 1} (add)`, from: '(none)', to: (pl.label || '(label)') + (pl.catno ? ' — ' + pl.catno : '') }); if (!dry) try { rel.labels.push(new ed.fields.ReleaseLabel({ label: e ? W.MB.entity(e, 'label') : null, catalogNumber: pl.catno || '' }, rel)); } catch (e2) {} }
    plabels.forEach((pl, idx) => {
      const ll = labArr()[idx]; if (!ll) return;
      const e = labEnt(pl);
      if (e && typeof ll.label === 'function') {
        const curL = u(ll.label), curGid = gidOf(curL), curName = curL ? u(curL.name) : '';
        // gid → swap to that exact label; name-only → set/rename to a new label whenever the name
        // actually changed (so renaming a linked label to plain text works; an unchanged name = no-op,
        // which preserves an existing link if you only removed its footer)
        const differs = e.gid ? (curGid !== e.gid) : (curName !== e.name);
        if (differs) { changes.push({ label: `label ${idx + 1}`, from: curName || '(none)', to: e.name }); if (!dry) try { ll.label(W.MB.entity(e, 'label')); } catch (e2) {} }
      }
      if (typeof ll.catalogNumber === 'function') { const f = String(u(ll.catalogNumber) || ''), t = String(pl.catno || ''); if (f !== t) { changes.push({ label: `label ${idx + 1} cat#`, from: f || '(none)', to: t || '(none)' }); if (!dry) try { ll.catalogNumber(t); } catch (e2) {} } }
    });
    return { changes, problems };
  }
  const applyMd = async parsed => { await resolveArtistsIn(parsed); return diffMd(parsed, false).changes; };   // resolve linked artists, then compute + write (test hook)

  // Open the release MD in the editor and KEEP it linked: every save applies to the editor,
  // so you can iterate (edit · save · see it apply · edit more · save …) until you Stop.
  let session = null;   // { id, active, lastMd, changed:Map(field→{from,to}), problems:[] }
  async function startSession() {
    if (session && session.active) { showPanel(); renderSession(); return; }
    if (!onEditPage()) return;
    session = { id: null, active: false, lastMd: '', changed: new Map(), problems: [] };
    renderSession('Exporting release…');
    let md; try { md = await exportMd(); } catch (e) { renderSession('Export failed: ' + (e.message || e)); return; }
    if (!(await ping())) { renderSession(`${NAME} helper not reachable on ${base()}.`); updateLauncher(); return; }
    const id = 'rel-' + (releaseMbid() || '').slice(0, 8) + '-' + Date.now().toString(36);
    try { const open = await gm({ method: 'POST', url: base() + '/open', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ id, content: md, ext: 'md', name: 'release' }) }); if (open.status !== 200) { renderSession(`Open failed (HTTP ${open.status})`); return; } }
    catch (e) { renderSession('Open error: ' + (e.message || e)); return; }
    session.id = id; session.active = true; session.lastMd = md;
    renderSession('Editing — save in your editor; changes appear here.');
    updateLauncher();
    poll(session);
  }
  async function poll(s) {
    while (s.active) {
      let r; try { r = await gm({ url: `${base()}/result?id=${encodeURIComponent(s.id)}`, timeout: 660000 }); } catch (e) { if (!s.active) break; await sleep(1200); continue; }
      if (!s.active) break;
      if (r.status === 204) continue;                                  // still editing
      if (r.status === 404 || r.status === 410) { s.active = false; if (session === s) session = null; if (panel) panel.style.display = 'none'; updateLauncher(); break; }
      if (r.status !== 200) { await sleep(1200); continue; }
      let content; try { content = JSON.parse(r.responseText).content || ''; } catch (e) { continue; }
      if (content.replace(/\s+$/, '') === s.lastMd.replace(/\s+$/, '')) continue;   // saved, nothing changed
      s.lastMd = content;
      try {
        const parsed = parse(content);
        await resolveArtistsIn(parsed);   // fetch full entities for any linked artists (with internal id) before applying
        const { changes, problems } = diffMd(parsed, false);
        if (changes.length) await refreshApollo();   // make Apollo's mirror reflect the model writes (if Apollo is on)
        for (const c of changes) { const ex = s.changed.get(c.label); s.changed.set(c.label, { from: ex ? ex.from : c.from, to: c.to }); }   // accumulate across the session; keep the original "from"
        s.problems = problems;
        renderSession();
      } catch (e) { renderSession('Apply error: ' + (e.message || e)); }
    }
  }
  function stopSession() {
    const s = session;
    if (s) { s.active = false; if (s.id) gm({ url: `${base()}/close?id=${encodeURIComponent(s.id)}` }).catch(() => {}); }
    session = null;
    if (panel) panel.style.display = 'none';   // ✕ / stop closes the window
    updateLauncher();
  }
  window.addEventListener('pagehide', () => { if (session && session.active) gm({ url: `${base()}/close?id=${encodeURIComponent(session.id)}` }).catch(() => {}); });

  // ── bottom-left launcher: shown only while the extedit helper is reachable (pinged) ──
  let launcher = null, _helperUp = false;
  function ensureLauncher() {
    if (launcher) return;
    launcher = document.createElement('button');
    launcher.type = 'button'; launcher.id = 'scribe-launcher';
    launcher.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:2147483646;width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;display:none;align-items:center;justify-content:center;background:#2c3a33;color:#fff;box-shadow:0 3px 12px rgba(0,0,0,.32);transition:background .15s,transform .1s';
    launcher.innerHTML = SCRIBE_ICON;
    launcher.onmouseenter = () => { launcher.style.transform = 'scale(1.06)'; };
    launcher.onmouseleave = () => { launcher.style.transform = 'scale(1)'; };
    launcher.onclick = () => { if (session && session.active) stopSession(); else startSession(); };
    document.body.appendChild(launcher);
  }
  function updateLauncher() {
    if (!launcher) return;
    const active = !!(session && session.active);
    launcher.style.display = _helperUp ? 'flex' : 'none';
    launcher.style.background = active ? '#2e9e5b' : '#2c3a33';
    launcher.title = !_helperUp ? `${NAME} — start the extedit helper to enable`
      : active ? `${NAME} — editing this release · click to stop` : `${NAME} — edit this release as Markdown (Ctrl+Alt+R)`;
  }
  async function pollHelper() {
    while (true) {
      const up = onEditPage() ? await ping() : false;
      if (up !== _helperUp) { _helperUp = up; ensureLauncher(); updateLauncher(); }
      await sleep(up ? 15000 : 4000);   // re-check often while down (so it appears when you start the helper), relax once up
    }
  }
  // Ctrl+Alt+R toggles the session — only on a release Edit page
  window.addEventListener('keydown', e => {
    if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
    if (e.code !== 'KeyR' && (e.key || '').toLowerCase() !== 'r') return;
    if (!onEditPage()) return;
    e.preventDefault(); e.stopPropagation();
    if (session && session.active) stopSession(); else startSession();
  }, true);
  if (onEditPage()) { ensureLauncher(); pollHelper(); }
  // test/automation hook
  try { W.__releaseMd = W.__scribe = { exportMd, parse, emit, toModel, applyMd, diffMd, refreshApollo, startSession, stopSession }; } catch (e) {}
  console.log(`[${NAME}] release editor ready — bottom-left button appears when the helper is running (${base()})`);
})();

// ══════════════════════════════════════════════════════════════════════════════
// Field editor — edit the FOCUSED text field in your editor (Ctrl+Alt+E).
// Self-contained module; shares the helper port/token (ee_port / ee_token) with the
// release editor above. The trigger you use picks the feature: E = field, R = release.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── settings (GM-persisted) ───────────────────────────────────────────────
  const DEF = { port: 17999, token: 'extedit', hotkey: { ctrl: true, alt: true, shift: false, meta: false, key: 'e' } };
  const cfg = {
    get port()   { return GM_getValue('ee_port', DEF.port); },
    get token()  { return GM_getValue('ee_token', DEF.token); },
    get hotkey() { try { return JSON.parse(GM_getValue('ee_hotkey', '')) || DEF.hotkey; } catch (e) { return DEF.hotkey; } },
  };
  const base = () => `http://127.0.0.1:${cfg.port}`;
  const hotkeyLabel = h => [h.ctrl && 'Ctrl', h.alt && 'Alt', h.shift && 'Shift', h.meta && 'Meta', (h.key || '').toUpperCase()].filter(Boolean).join('+');

  // ── tiny GM request helpers (no CORS / mixed-content wall) ────────────────
  const gm = opts => new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: opts.method || 'GET', url: opts.url, data: opts.data, timeout: opts.timeout || 30000,
      headers: Object.assign({ 'X-ExtEdit-Token': cfg.token }, opts.headers || {}),
      onload: r => resolve(r), onerror: () => reject(new Error('network')), ontimeout: () => reject(new Error('timeout')),
    });
  });
  const ping = async () => { try { const r = await gm({ url: base() + '/ping', timeout: 4000 }); return r.status === 200; } catch (e) { return false; } };

  // ── toast ─────────────────────────────────────────────────────────────────
  let toastEl = null, toastT = 0;
  function toast(msg, kind, sticky) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:14px;transform:translateX(-50%);background:#2c3a33;color:#fff;padding:7px 13px;border-radius:7px;font:13px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:70vw;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.background = kind === 'err' ? '#b3352e' : kind === 'ok' ? '#2e7d44' : '#2c3a33';
    toastEl.style.display = '';
    clearTimeout(toastT);
    if (!sticky) toastT = setTimeout(() => { if (toastEl) toastEl.style.display = 'none'; }, 2600);
  }

  // ── editable field read/write ─────────────────────────────────────────────
  function editableOf(el) {
    if (!el) return null;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return { el, kind: 'value' };
    if (tag === 'INPUT' && /^(text|search|url|email|tel|number|)$/i.test(el.type || 'text')) return { el, kind: 'value' };
    if (el.isContentEditable) return { el, kind: 'ce' };
    return null;
  }
  const readVal = t => t.kind === 'ce' ? t.el.innerText : t.el.value;
  function writeVal(t, text) {
    text = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
    if (t.kind === 'ce') { t.el.innerText = text; t.el.dispatchEvent(new InputEvent('input', { bubbles: true })); return; }
    const proto = t.el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const set = Object.getOwnPropertyDescriptor(proto, 'value').set;
    set.call(t.el, text);
    t.el.dispatchEvent(new Event('input', { bubbles: true }));
    t.el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const extFor = el => (el.classList && (el.classList.contains('edit-note') || /annotation/i.test(el.name || el.id || ''))) ? 'md' : 'txt';

  // ── per-field sessions (many fields linked at once) ───────────────────────
  const sessions = new Map();
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const sleep = ms => new Promise(z => setTimeout(z, ms));

  function fieldLabel(el) {
    let lbl = '';
    if (el.id) { try { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) lbl = l.textContent; } catch (e) {} }
    lbl = (lbl || el.getAttribute('aria-label') || el.placeholder || el.name || el.id || el.tagName.toLowerCase()).replace(/\s+/g, ' ').trim();
    return lbl.slice(0, 32) || 'field';
  }
  function onHotkeyField(t) { const s = sessions.get(t.el); if (s && s.connected) reopen(s); else connect(t); }

  async function connect(t) {
    if (!(await ping())) { toast(`Scribe helper not reachable on ${base()} — start it (see README)`, 'err'); return; }
    const id = genId();
    const s = { id, el: t.el, t, connected: true, label: fieldLabel(t.el) };
    sessions.set(t.el, s);
    setLinked(t.el, true); renderPanel();
    try {
      const open = await gm({ method: 'POST', url: base() + '/open', headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({ id, content: readVal(t), ext: extFor(t.el), name: s.label }) });
      if (open.status !== 200) { toast(`Open failed (HTTP ${open.status})`, 'err'); disconnect(t.el, true); return; }
    } catch (e) { toast('Open error: ' + e.message, 'err'); disconnect(t.el, true); return; }
    toast(`“${s.label}” opened in your editor — save to apply (stays linked; Esc to disconnect)`, 'ok');
    poll(s);
  }
  async function reopen(s) {
    try {
      const r = await gm({ method: 'POST', url: base() + '/open', headers: { 'Content-Type': 'application/json' }, data: JSON.stringify({ id: s.id, reopen: true }) });
      if (r.status === 200) toast(`Re-opened “${s.label}” — switch to your editor`, 'ok');
      else if (r.status === 404 || r.status === 410) { disconnect(s.el, true); connect(s.t); }
      else toast(`Re-open failed (HTTP ${r.status})`, 'err');
    } catch (e) { toast('Re-open error: ' + e.message, 'err'); }
  }
  async function poll(s) {
    while (s.connected) {
      let r;
      try { r = await gm({ url: `${base()}/result?id=${encodeURIComponent(s.id)}`, timeout: 660000 }); }
      catch (e) { if (!s.connected) break; await sleep(1200); continue; }
      if (!s.connected) break;
      if (r.status === 204) continue;
      if (r.status === 404 || r.status === 410) { toast(`“${s.label}” session ended`); disconnect(s.el, true); break; }
      if (r.status !== 200) { await sleep(1200); continue; }
      try { const out = JSON.parse(r.responseText); writeVal(s.t, out.content || ''); flashLinked(s.el); toast(`“${s.label}” updated ✓`, 'ok'); } catch (e) {}
    }
  }
  function disconnect(el, fromServer) {
    const s = sessions.get(el); if (!s) return;
    s.connected = false; sessions.delete(el);
    setLinked(el, false); renderPanel();
    if (!fromServer) { gm({ url: `${base()}/close?id=${encodeURIComponent(s.id)}` }).catch(() => {}); toast(`“${s.label}” disconnected`); }
  }
  const disconnectAll = () => { for (const el of [...sessions.keys()]) disconnect(el, false); };

  // ── "linked" indicator: a glow on the field + a small panel of live links ──
  const _prevShadow = new WeakMap();
  function setLinked(el, on) {
    if (on) { if (!_prevShadow.has(el)) _prevShadow.set(el, el.style.boxShadow || ''); el.style.boxShadow = '0 0 0 2px #2e9e5b'; }
    else { el.style.boxShadow = _prevShadow.get(el) || ''; _prevShadow.delete(el); }
  }
  function flashLinked(el) { el.style.boxShadow = '0 0 0 3px #57d07e'; setTimeout(() => { if (sessions.has(el)) el.style.boxShadow = '0 0 0 2px #2e9e5b'; }, 380); }
  const focusField = s => { try { s.el.scrollIntoView({ block: 'center' }); s.el.focus(); } catch (e) {} };

  let panel = null;
  const _btn = 'background:#3d5147;color:#fff;border:none;border-radius:4px;padding:1px 7px;cursor:pointer;font-size:12px;line-height:1.4;';
  function renderPanel() {
    if (!sessions.size) { if (panel) panel.style.display = 'none'; return; }
    if (!panel) {
      panel = document.createElement('div');
      // sits a little higher than the release-editor panel so they don't overlap when both are active
      panel.style.cssText = 'position:fixed;z-index:2147483646;right:12px;bottom:64px;background:#2c3a33;color:#fff;border-radius:8px;padding:7px 9px;font:12px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:300px;';
      document.body.appendChild(panel);
    }
    panel.style.display = ''; panel.textContent = '';
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
    const title = document.createElement('span');
    title.textContent = `✎ Fields — ${sessions.size} linked`;
    title.style.cssText = 'font-weight:600;opacity:.85;flex:1;white-space:nowrap;';
    head.appendChild(title);
    const finishAll = document.createElement('button');
    finishAll.textContent = 'Finish all'; finishAll.title = 'Disconnect every linked field';
    finishAll.style.cssText = _btn; finishAll.onclick = () => disconnectAll();
    head.appendChild(finishAll);
    panel.appendChild(head);
    for (const s of sessions.values()) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:3px 0;';
      const dot = document.createElement('span'); dot.textContent = '●'; dot.style.color = '#57d07e'; row.appendChild(dot);
      const name = document.createElement('span');
      name.textContent = s.label; name.title = 'Focus this field in the browser';
      name.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';
      name.onclick = () => focusField(s);
      row.appendChild(name);
      const fb = document.createElement('button'); fb.textContent = '◎'; fb.title = 'Focus this field in the browser'; fb.style.cssText = _btn; fb.onclick = () => focusField(s); row.appendChild(fb);
      const rf = document.createElement('button'); rf.textContent = '✎'; rf.title = 'Re-open in your editor'; rf.style.cssText = _btn; rf.onclick = () => reopen(s); row.appendChild(rf);
      const x = document.createElement('button'); x.textContent = '✕'; x.title = 'Disconnect'; x.style.cssText = _btn; x.onclick = () => disconnect(s.el, false); row.appendChild(x);
      panel.appendChild(row);
    }
  }
  window.addEventListener('pagehide', () => { for (const s of sessions.values()) gm({ url: `${base()}/close?id=${encodeURIComponent(s.id)}` }).catch(() => {}); });

  // ── hotkey (Ctrl+Alt+E by default) ───────────────────────────────────────
  let capturing = false;
  document.addEventListener('keydown', e => {
    if (capturing) return;
    if (e.key === 'Escape') { const te = editableOf(document.activeElement); if (te && sessions.has(te.el)) { e.preventDefault(); disconnect(te.el, false); } return; }
    const h = cfg.hotkey;
    if (e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift || e.metaKey !== !!h.meta) return;
    if ((e.key || '').toLowerCase() !== (h.key || '').toLowerCase()) return;
    const t = editableOf(document.activeElement);
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    onHotkeyField(t);
  }, true);

  // ── menu commands (shared helper config) ─────────────────────────────────
  GM_registerMenuCommand(`Set helper port (now: ${cfg.port})`, () => {
    const v = prompt('Scribe — helper port', String(cfg.port));
    if (v && /^\d+$/.test(v)) { GM_setValue('ee_port', +v); toast('Port set to ' + v, 'ok'); }
  });
  GM_registerMenuCommand('Set helper token', () => {
    const v = prompt('Scribe — shared token (must match the helper\'s --token)', cfg.token);
    if (v != null) { GM_setValue('ee_token', v); toast('Token saved', 'ok'); }
  });
  GM_registerMenuCommand(`Set field hotkey (now: ${hotkeyLabel(cfg.hotkey)})`, () => {
    capturing = true;
    toast('Press the new hotkey combo…', '', true);
    const cap = e => {
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      const h = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, key: e.key.toLowerCase() };
      GM_setValue('ee_hotkey', JSON.stringify(h));
      document.removeEventListener('keydown', cap, true); capturing = false;
      toast('Field hotkey set to ' + hotkeyLabel(h), 'ok');
    };
    document.addEventListener('keydown', cap, true);
  });
  GM_registerMenuCommand('Test helper connection', async () => toast(await ping() ? `Helper OK on ${base()} ✓` : `Helper not reachable on ${base()}`, (await ping()) ? 'ok' : 'err'));
  GM_registerMenuCommand('Disconnect all field edits', () => { if (sessions.size) disconnectAll(); else toast('No fields are linked'); });

  console.log(`[Scribe] field editor ready — ${hotkeyLabel(cfg.hotkey)} in a focused text field; helper ${base()}`);
})();
