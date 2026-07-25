// ==UserScript==
// @name         Falcon — bulk MusicBrainz link editor
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.7.25.123741
// @description  Add external links to a BATCH of MusicBrainz artists/labels/recordings at once — no popup-per-entity, no tab churn. A small pool of persistent worker iframes churns through a queue, each submitting its own edit and moving straight to the next entity. Paste a list, hand it a queue via a `?falcon=` URL param, or click "Send to Falcon" on a Harmony actions page to import its suggested links directly.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHBhdGggZD0iTTY0IDEwIEM4MiAyOCA5MCA1NiA5MCA4MCBMMzggODAgQzM4IDU2IDQ2IDI4IDY0IDEwIFoiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFiMmE0YSIgc3Ryb2tlLXdpZHRoPSI3IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8cGF0aCBkPSJNMzggODAgTDIwIDExMCBMNDAgOTYgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWIyYTRhIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik05MCA4MCBMMTA4IDExMCBMODggOTYgWiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWIyYTRhIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogIDxjaXJjbGUgY3g9IjY0IiBjeT0iNDQiIHI9IjEwIiBmaWxsPSIjMWIyYTRhIi8+CiAgPHBhdGggZD0iTTUwIDgwIEw0NSAxMDggTDY0IDEyMiBMODMgMTA4IEw3OCA4MCBaIiBmaWxsPSIjZmY2YTAwIiBzdHJva2U9IiMxYjJhNGEiIHN0cm9rZS13aWR0aD0iNSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8L3N2Zz4K
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/falcon/README.md
// @match        https://*.musicbrainz.org/*
// @match        https://harmony.pulsewidth.org.uk/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @noframes
// ==/UserScript==
(function () {
  'use strict';
  const VERSION = '2026.7.25.123741';
  const scriptVersion = () => { try { return GM_info.script.version || VERSION; } catch (e) { return VERSION; } };
  const NAME = 'Falcon';
  const MB_ORIGIN = location.origin;
  // the ACTUAL MusicBrainz origin — used to build the outbound url when this script
  // is running ON Harmony (there, MB_ORIGIN above is Harmony's own origin, not MB's).
  const MB_TARGET = 'https://musicbrainz.org';
  const ON_HARMONY = /(^|\.)harmony\.pulsewidth\.org\.uk$/i.test(location.hostname);
  const HELP_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/falcon/README.md';
  // simple rocket glyph — reused at both launcher and panel-header size (currentColor)
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 2 C15 5 16 9.5 16 13.5 L8 13.5 C8 9.5 9 5 12 2 Z"/>' +
    '<path d="M8 13.5 L5 19 L8.6 16.6 Z"/><path d="M16 13.5 L19 19 L15.4 16.6 Z"/>' +
    '<circle cx="12" cy="8.2" r="1.5" fill="currentColor" stroke="none"/>' +
    '<path d="M9.6 13.5 L9 19 L12 22 L15 19 L14.4 13.5 Z"/></svg>';

  /* ── shared corner-slot convention (#468) ───────────────────────────────
     Every floating launcher across these scripts (Apollo Editor, Art
     Station, Scribe, Falcon) tags its element with data-mb-corner (which
     screen corner) + data-mb-corner-order (priority — lower sits closest to
     the actual corner) and calls mbRestackCorner() right after it shows /
     hides / creates / removes its own element. No MutationObserver needed:
     whichever script's state just changed triggers a full recompute that
     repositions every element sharing that corner, regardless of load
     order — so two independent scripts' buttons never land on the same
     pixel. Duplicated per-script on purpose (no shared file to import). */
  function mbRestackCorner(corner) {
    const bottom = corner[0] === 'b', right = corner[1] === 'r';
    const els = [...document.querySelectorAll('[data-mb-corner="' + corner + '"]')]
      .filter(el => getComputedStyle(el).display !== 'none')   // offsetParent is always null for position:fixed — not a usable visibility check here
      .sort((a, b) => (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0));
    let pos = 14;
    els.forEach(el => {
      el.style[bottom ? 'bottom' : 'top'] = pos + 'px';
      el.style[right ? 'right' : 'left'] = '14px';
      pos += el.getBoundingClientRect().height + 8;
    });
  }

  /* ── settings ────────────────────────────────────────────────────────── */
  const cfg = {
    get workers() { const n = Number(GM_getValue('falcon:workers', 3)); return Math.max(1, Math.min(6, isFinite(n) ? n : 3)); },
    set workers(n) { GM_setValue('falcon:workers', Math.max(1, Math.min(6, Number(n) || 3))); },
  };

  /* ── tiny logger — kept in-memory + console, surfaced in the panel's log tab ── */
  const LOG = [];
  function log(level, msg) {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${level.toUpperCase().padEnd(5)} ${msg}`;
    LOG.push(line); if (LOG.length > 500) LOG.shift();
    try { (console[level] || console.log).call(console, '[Falcon]', msg); } catch (e) {}
    renderLog();
  }

  /* ── queue item shape: {id, entityType, mbid, urls: [{url,linkTypeId}], note,
     urlResults, status, error} ── #467 (majkinetor): the same entity can carry
     several URLs — group those into ONE item/one edit-page visit rather than
     revisiting the same mbid N times (both unsafe — two workers must never load
     the same entity's /edit at once — and wasteful). Grouping happens at add-time
     (see addToQueue); nextQueued() additionally refuses to hand out a queued item
     whose entity is already 'active' in another worker, so a later-added item for
     the same entity can never race the one already in flight.
     `linkTypeId` is optional — when present (e.g. from Harmony, which already
     knows exactly which relationship type it wants) it's used to set the type
     select if MB renders one instead of auto-classifying; when absent MB's own
     classifier decides, same as before. The SAME url can legitimately appear
     twice with two different linkTypeId values (Harmony does this for e.g. a
     Bandcamp track that's both "stream for free" and "purchase for download") —
     handled by fillAndSubmit via MB's own "Add another relationship" row rather
     than re-typing the url, so dedup below is keyed on (url, linkTypeId), not url
     alone. */
  let queue = [];
  let _idSeq = 0;
  let running = false;
  // review-UX state (#467): which rows are checked (for bulk remove) / expanded
  // (showing their full url list) — kept outside `queue` itself since it's pure
  // display state, survives across renderQueue() calls (a full innerHTML replace).
  let _selectedIds = new Set();
  let _expandedIds = new Set();
  const ENTITY_RE = /^(artist|label|recording)$/;
  const MBID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function normalizeEntityType(raw) {
    const t = String(raw || 'artist').trim().toLowerCase();
    return ENTITY_RE.test(t) ? t : 'artist';
  }
  // accepts: "<mbid>,<url>" · "<mbid> <url>" · "<entityType>:<mbid>,<url>" ·
  // or a full MB artist/label/recording URL in place of the bare mbid.
  function parseLine(line) {
    const s = line.trim();
    if (!s || s.startsWith('#')) return null;
    let entityType = 'artist';
    let rest = s;
    const etm = rest.match(/^(artist|label|recording)\s*:\s*(.+)$/i);
    if (etm) { entityType = normalizeEntityType(etm[1]); rest = etm[2]; }
    const parts = rest.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) return null;
    let [entityPart, ...urlParts] = parts;
    const url = urlParts.join(' ');
    const um = entityPart.match(/musicbrainz\.org\/(artist|label|recording)\/([0-9a-f-]{36})/i);
    let mbid = entityPart;
    if (um) { entityType = normalizeEntityType(um[1]); mbid = um[2]; }
    if (!MBID_RE.test(mbid) || !/^https?:\/\//i.test(url)) return null;
    return { entityType, mbid: mbid.toLowerCase(), url, linkTypeId: null };
  }
  function parsePaste(text) {
    return String(text || '').split('\n').map(parseLine).filter(Boolean);
  }
  // Shared MB API throttle for name lookups (majkinetor, #467: "fetch them in
  // paralel with rate limit protection as usual (retry after etc, see how CH
  // does it") — mirrors Credit Hoarder's api-mb.js pattern: up to MAX_CONCURRENT
  // requests in flight with NO artificial per-request gap (a strict serial
  // 1.1s-apart queue was tried first and was simply too slow for a big batch),
  // and on an actual 429/503 every in-flight request cooperatively backs off
  // until a shared `pauseUntil` timestamp elapses (from the Retry-After header,
  // or exponential backoff if MB didn't send one) — so the throttle only ever
  // slows down in response to MB actually signalling overload, not preemptively.
  const mbThrottle = (() => {
    const MAX_CONCURRENT = 4;
    let running = 0, pauseUntil = 0;
    const queue = [];
    async function waitForPause() {
      let w = pauseUntil - Date.now();
      while (w > 0) { await wait(w); w = pauseUntil - Date.now(); }
    }
    function drain() {
      while (running < MAX_CONCURRENT && queue.length) {
        running++;
        const item = queue.shift();
        run(item).finally(() => { running--; drain(); });
      }
    }
    async function run(item) {
      for (let attempt = 0; attempt <= item.retries; attempt++) {
        await waitForPause();
        try {
          const res = await fetch(item.url, { headers: { Accept: 'application/json' } });
          if (res.status === 429 || res.status === 503) {
            const ra = parseInt(res.headers.get('Retry-After'), 10);
            const waitMs = ra > 0 ? ra * 1000 : Math.min(1000 * Math.pow(2, attempt), 30000);
            pauseUntil = Math.max(pauseUntil, Date.now() + waitMs);   // push forward only
            continue;
          }
          if (!res.ok) { item.resolve(null); return; }
          item.resolve(await res.json());
          return;
        } catch (e) {
          if (attempt === item.retries) { item.resolve(null); return; }
          await wait(500);
        }
      }
      item.resolve(null);
    }
    return {
      fetchJson: (url, retries) => new Promise(resolve => { queue.push({ url, retries: retries == null ? 3 : retries, resolve }); drain(); }),
    };
  })();
  // resolves an entity's real name/title for display, instead of a truncated mbid —
  // same-origin fetch to MB's own public API (no GM_xmlhttpRequest needed; Falcon's
  // panel only ever renders on musicbrainz.org itself), through the throttle above.
  // Cached per entity since the same mbid can appear across several queue items.
  const _nameCache = new Map();
  async function fetchEntityName(entityType, mbid) {
    const key = entityType + ':' + mbid;
    if (_nameCache.has(key)) return _nameCache.get(key);
    const j = await mbThrottle.fetchJson(`${MB_ORIGIN}/ws/2/${entityType}/${mbid}?fmt=json`);
    const name = j ? (j.title || j.name || null) : null;   // recordings: title; artist/label: name
    if (name) _nameCache.set(key, name);
    return name;
  }
  function entityLabel(item) { return item.name || `${item.entityType}/${item.mbid.slice(0, 8)}`; }
  // merges each parsed {entityType,mbid,url,linkTypeId,note?} into an existing
  // STILL-QUEUED item for the same entity (never merges into an active/done/failed
  // one — that item has already been claimed or finished), else creates a new item.
  function addToQueue(parsed) {
    let merged = 0, added = 0;
    parsed.forEach(p => {
      const existing = queue.find(i => i.status === 'queued' && i.entityType === p.entityType && i.mbid === p.mbid);
      const linkTypeId = p.linkTypeId || null;
      if (existing) {
        if (!existing.urls.some(u => u.url === p.url && u.linkTypeId === linkTypeId)) { existing.urls.push({ url: p.url, linkTypeId }); merged++; }
        if (p.note && !existing.note) existing.note = p.note;
        return;
      }
      const item = { id: 'f' + (++_idSeq), entityType: p.entityType, mbid: p.mbid, urls: [{ url: p.url, linkTypeId }], note: p.note || '', name: null, urlResults: null, status: 'queued', error: '' };
      queue.push(item);
      fetchEntityName(p.entityType, p.mbid).then(name => { if (name) { item.name = name; renderQueue(); } });
      added++;
    });
    return { merged, added };
  }
  // `?falcon=` accepts TWO schemes:
  //   1. base64(JSON array of {entityType?,mbid,url,linkTypeId?,note?}) directly in
  //      the URL — the documented contract for any external script to hand Falcon a
  //      queue with one link.
  //   2. a short random TOKEN keyed into GM storage (`falcon:pending:<token>`) — used
  //      by the Harmony bridge itself (see ensureHarmonyButton below), since GM
  //      storage is shared across every tab this SAME script runs in regardless of
  //      domain. This is what lets a batch include recordings again: no JSON ever
  //      has to fit in a URL, so there's no length ceiling to hit (#467's
  //      PR_END_OF_FILE_ERROR was hitting exactly that ceiling on the base64 scheme).
  //      A different script can't use this scheme — GM storage isn't shared BETWEEN
  //      different userscripts, only within one script's own tabs — hence keeping
  //      scheme 1 as the general contract.
  function tryDecodeBase64Json(raw) {
    let text; try { text = decodeURIComponent(escape(atob(raw))); } catch (e) { return null; }
    try { JSON.parse(text); return text; } catch (e) { return null; }
  }
  function parseUrlParam() {
    const raw = new URLSearchParams(location.search).get('falcon');
    if (!raw) return null;
    let json = tryDecodeBase64Json(raw);
    if (json == null) {
      const stored = GM_getValue('falcon:pending:' + raw, null);
      if (stored != null) { json = stored; try { GM_deleteValue('falcon:pending:' + raw); } catch (e) {} }
    }
    if (json == null) { log('warn', 'falcon= param present but neither valid base64 JSON nor a known pending token'); return null; }
    try {
      const arr = JSON.parse(json);
      if (!Array.isArray(arr)) return null;
      return arr.map(it => ({ entityType: normalizeEntityType(it.entityType), mbid: String(it.mbid || '').toLowerCase(), url: String(it.url || ''), linkTypeId: it.linkTypeId ? String(it.linkTypeId) : null, note: it.note ? String(it.note) : '' }))
        .filter(it => MBID_RE.test(it.mbid) && /^https?:\/\//i.test(it.url));
    } catch (e) { log('warn', 'falcon= payload not valid JSON: ' + e.message); return null; }
  }
  // Parses one Harmony "Link external IDs" href — a standard MB seed URL:
  // https://musicbrainz.org/<artist|label|recording>/<mbid>/edit
  //   ?edit-<type>.url.0.text=<url>&edit-<type>.url.0.link_type_id=<id>
  //   &edit-<type>.url.1.text=...&edit-<type>.url.1.link_type_id=...
  //   &edit-<type>.edit_note=<text>
  // Returns a FLAT array of {entityType,mbid,url,linkTypeId,note} tuples (one per
  // url.N) ready for addToQueue, or [] if href isn't a recognized seed URL.
  function parseHarmonySeedUrl(href) {
    let u; try { u = new URL(href, MB_ORIGIN); } catch (e) { return []; }
    const m = u.pathname.match(/^\/(artist|label|recording)\/([0-9a-f-]{36})\/edit\/?$/i);
    if (!m) return [];
    const entityType = normalizeEntityType(m[1]);
    const mbid = m[2].toLowerCase();
    const prefix = `edit-${m[1].toLowerCase()}.`;
    const note = u.searchParams.get(prefix + 'edit_note') || '';
    const byIndex = {};
    for (const [key, val] of u.searchParams) {
      if (!key.startsWith(prefix + 'url.')) continue;
      const km = key.slice((prefix + 'url.').length).match(/^(\d+)\.(text|link_type_id)$/);
      if (!km) continue;
      (byIndex[km[1]] || (byIndex[km[1]] = {}))[km[2]] = val;
    }
    return Object.values(byIndex).filter(e => e.text).map(e => ({ entityType, mbid, url: e.text, linkTypeId: e.link_type_id || null, note }));
  }
  function encodeFalconPayload(tuples) {
    const json = JSON.stringify(tuples.map(t => ({ entityType: t.entityType, mbid: t.mbid, url: t.url, linkTypeId: t.linkTypeId || undefined, note: t.note || undefined })));
    return btoa(unescape(encodeURIComponent(json)));
  }

  /* ── Harmony bridge (#467, #459) ─────────────────────────────────────────
     Running ON a Harmony actions page: every "Link external IDs" action IS
     already a standard MB seed url (parseHarmonySeedUrl handles it) — scrape
     them all, combine into one queue, and open MB with it in a new tab
     instead of Harmony's own tab-per-entity popups. Harmony's actions render
     asynchronously (client-rendered), so the button's count is kept live by
     a short polling loop that settles once the count stops changing.
     Recordings ARE included again (majkinetor, #467) — a real release's
     recording actions vastly outnumber its artist/label ones (86 total, 80
     recordings, measured live), and packing all of them into a base64
     query-string payload blew past ~32,000 characters, past what MB's
     front-end accepts (Firefox surfaced that as a bare PR_END_OF_FILE_ERROR
     instead of a clean "414 URI Too Long"). The GM-storage-token scheme (see
     parseUrlParam) sidesteps that entirely — nothing goes in the URL but a
     short random token. */
  function scrapeHarmonyActions() {
    const anchors = [...document.querySelectorAll('a')].filter(a => /link external ids/i.test(a.textContent || ''));
    const tuples = [];
    anchors.forEach(a => { const href = a.getAttribute('href'); if (href) tuples.push(...parseHarmonySeedUrl(href)); });
    return tuples;
  }
  function makePendingToken() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  let harmonyBtn = null;
  function ensureHarmonyButton() {
    const items = scrapeHarmonyActions();
    if (!harmonyBtn) {
      harmonyBtn = document.createElement('button');
      harmonyBtn.type = 'button'; harmonyBtn.id = 'falcon-harmony-btn';
      harmonyBtn.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;padding:10px 16px;border-radius:20px;border:none;cursor:pointer;background:#1b2a4a;color:#fff;font:bold 13px Arial;box-shadow:0 3px 12px rgba(0,0,0,.3);display:flex;align-items:center;gap:8px;transition:opacity .15s';
      harmonyBtn.innerHTML = `<span style="display:flex;color:#ff9d5c">${ICON}</span><span id="falcon-harmony-lbl"></span>`;
      harmonyBtn.onclick = () => {
        const found = scrapeHarmonyActions();
        if (!found.length) { alert(`${NAME}: no "Link external IDs" actions found on this page.`); return; }
        const token = makePendingToken();
        GM_setValue('falcon:pending:' + token, JSON.stringify(found.map(t => ({ entityType: t.entityType, mbid: t.mbid, url: t.url, linkTypeId: t.linkTypeId || undefined, note: t.note || undefined }))));
        window.open(`${MB_TARGET}/?falcon=${token}`, '_blank');
      };
      document.body.appendChild(harmonyBtn);
    }
    const lbl = document.getElementById('falcon-harmony-lbl');
    lbl.textContent = items.length ? `Send ${items.length} to Falcon` : 'No Falcon actions found yet…';
    harmonyBtn.style.opacity = items.length ? '1' : '.6';
    harmonyBtn.title = items.length ? `Opens MusicBrainz with ${items.length} link(s) queued in Falcon` : 'Waiting for Harmony to render its actions…';
  }

  /* ── waiters (mirrors Platform Check's pcWait/pcWaitFor, retargeted at a frame doc) ── */
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  function waitFor(predicate, timeoutMs) {
    timeoutMs = timeoutMs || 10000;
    return new Promise(resolve => {
      const start = Date.now();
      const tick = () => {
        let v; try { v = predicate(); } catch (e) { v = null; }
        if (v) return resolve(v);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(tick, 150);
      };
      tick();
    });
  }
  // accepts EITHER a worker <iframe> element OR a plain window handle (from
  // window.open — used by the "open in a real tab" manual-review path, #467) —
  // same-origin either way, so fillAndSubmit's own logic never needs to know which.
  function frameDoc(target) { try { return ('contentDocument' in target) ? target.contentDocument : (target.document || null); } catch (e) { return null; } }
  function frameWin(target) { try { return ('contentWindow' in target) ? target.contentWindow : target; } catch (e) { return null; } }

  function findAddLinkInput(doc) {
    const all = [...doc.querySelectorAll('input[type="text"], input[type="url"], input:not([type])')];
    const RE = /^(?:add (?:another )?link|add another url)$/i;
    return all.find(i => RE.test((i.placeholder || '').trim()) && !i.value)
      || all.find(i => RE.test((i.placeholder || '').trim())) || null;
  }
  function findSubmitButton(doc) {
    return doc.querySelector('button.submit.positive')
      || [...doc.querySelectorAll('button')].find(b => /enter edit/i.test(b.textContent || ''));
  }
  // #467 (majkinetor): when a url is rejected, MB almost always renders the REAL reason
  // right on the page (e.g. "This URL is not allowed for artists.", "This relationship
  // already exists.") — scrape it instead of guessing. Falls back to a generic message
  // only when MB genuinely didn't show one.
  function findFieldError(doc) {
    const texts = [...doc.querySelectorAll('.error, .field-error')].map(el => (el.textContent || '').trim()).filter(Boolean);
    return texts.length ? [...new Set(texts)].join(' / ') : null;
  }
  function setEditNote(doc, win, text) {
    const ta = doc.querySelector('textarea.edit-note, textarea[name="edit-note"], textarea[name="edit_note"], #id-edit-note, .edit-note textarea');
    if (!ta) return false;
    try {
      const setVal = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value').set;
      const existing = (ta.value || '').trim();
      setVal.call(ta, existing ? existing + '\n' + text : text);
      ta.dispatchEvent(new win.Event('input', { bubbles: true }));
      ta.dispatchEvent(new win.Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }
  const editNoteText = (results, harmonyNote) => {
    const added = results.filter(r => r.ok).map(r => r.url);
    const lines = [`${NAME} v${scriptVersion()} by majkinetor - ${HELP_URL}`, ''];
    if (harmonyNote) lines.push(harmonyNote, '');
    lines.push('Bulk-added via the Falcon queue:', ...added);
    return lines.join('\n');
  };

  // MB shows the relationship type as a plain read-only label when there's only one
  // valid type for that url (nothing to set), or a <select class="link-type"> when
  // ambiguous (e.g. Bandcamp: streaming vs purchase). When Harmony hands us an
  // explicit linkTypeId, honor it whenever a select is actually present.
  async function setRowLinkType(iframe, row, linkTypeId) {
    if (!linkTypeId) return null;
    const typeRow = row.nextElementSibling;
    const select = typeRow?.classList?.contains('relationship-item') ? typeRow.querySelector('select.link-type') : null;
    if (!select) return null;   // unambiguous — MB already resolved it, nothing to override
    if (![...select.options].some(o => o.value === String(linkTypeId))) return false;
    const w = frameWin(iframe);
    const setSel = Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set;
    setSel.call(select, String(linkTypeId));
    select.dispatchEvent(new w.Event('change', { bubbles: true }));
    return true;
  }
  // Harmony sometimes wants TWO relationship types on the IDENTICAL url (e.g. a
  // Bandcamp track as both "stream for free" and "purchase for download") — MB
  // supports this via the row's own "Add another relationship" control, not by
  // re-typing the url again (that wouldn't create a second row at all).
  async function addSecondRelationshipType(iframe, row, linkTypeId) {
    if (!linkTypeId) return false;
    const typeRow = row.nextElementSibling;
    if (!typeRow || !typeRow.classList?.contains('relationship-item')) return false;
    const addRow = typeRow.nextElementSibling;
    const addBtn = addRow?.classList?.contains('add-relationship') ? addRow.querySelector('button.add-item') : null;
    if (!addBtn) return false;
    addBtn.click();
    const newSelect = await waitFor(() => {
      const s = typeRow.nextElementSibling;
      if (!s || !s.classList?.contains('relationship-item')) return null;
      const sel = s.querySelector('select.link-type');
      return (sel && !sel.value) ? sel : null;
    }, 3000);
    if (!newSelect || ![...newSelect.options].some(o => o.value === String(linkTypeId))) return false;
    const w = frameWin(iframe);
    const setSel = Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype, 'value').set;
    setSel.call(newSelect, String(linkTypeId));
    newSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
    return true;
  }

  // fill every URL in item.urls (one "Add another link" round-trip each, or a second
  // relationship type on an already-present url) then submit ONCE for the whole
  // group, all directly against the iframe's OWN document/window (same-origin — no
  // postMessage needed, see #467). A url that MB rejects (e.g. already present)
  // doesn't abort the rest — it's recorded in the returned per-url results and the
  // others still go in. Only truly infra-level failures (no submit button, never
  // redirected) throw; "nothing to submit" is signalled via `committed: false`, not
  // a throw, since it isn't necessarily an error (every url in the group may simply
  // already be on the entity).
  async function fillAndSubmit(iframe, item, opts) {
    const skipSubmit = !!(opts && opts.skipSubmit);
    const results = [];
    for (const { url, linkTypeId } of item.urls) {
      try {
        const doc0 = frameDoc(iframe);
        const existingRow = doc0 && [...doc0.querySelectorAll('tr.external-link-item')].find(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === url);
        if (existingRow) {
          const added = await addSecondRelationshipType(iframe, existingRow, linkTypeId);
          results.push({ url, ok: added, error: added ? undefined : (linkTypeId ? 'could not add a second relationship type — this url is already present' : 'this url is already present') });
          continue;
        }
        const input = await waitFor(() => frameDoc(iframe) && findAddLinkInput(frameDoc(iframe)), 12000);
        if (!input) { results.push({ url, ok: false, error: 'no "Add another link" input ever appeared' }); continue; }
        const d2 = frameDoc(iframe), w2 = frameWin(iframe);
        const setVal = Object.getOwnPropertyDescriptor(w2.HTMLInputElement.prototype, 'value').set;
        input.focus();
        setVal.call(input, url);
        input.dispatchEvent(new w2.Event('input', { bubbles: true }));
        input.dispatchEvent(new w2.Event('change', { bubbles: true }));
        input.dispatchEvent(new w2.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new w2.KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.blur();
        const row = await waitFor(() => {
          const dd = frameDoc(iframe); if (!dd) return null;
          const r = [...dd.querySelectorAll('tr.external-link-item')].find(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '') === url);
          return r || null;
        }, 8000);
        if (!row) {
          const mbError = findFieldError(frameDoc(iframe));
          results.push({ url, ok: false, error: mbError || 'URL row never appeared after Enter (MB gave no specific reason)' });
          continue;
        }
        if (linkTypeId) await setRowLinkType(iframe, row, linkTypeId);
        // #467 (majkinetor, production failure): an AMBIGUOUS url (a Bandcamp
        // track is the common case — could be "purchase for download", "download
        // for free", etc.) renders a REQUIRED relationship-type <select> that
        // starts blank. If Falcon has no linkTypeId to set it, that blank select
        // invalidates the WHOLE form — not just this row — and disables the
        // submit button for the entire group, which used to surface as a bare
        // "submit button disabled (form invalid?)" with no indication of why or
        // which url caused it. Detect it here and remove the row instead of
        // leaving an unresolvable dud blocking every other url in the group —
        // report it as a clear, actionable failure (open the entity in a tab
        // and pick the type by hand) rather than silently marking it ok.
        const typeRow = row.nextElementSibling;
        const ambiguousSelect = typeRow?.classList?.contains('relationship-item') ? typeRow.querySelector('select.link-type') : null;
        if (!linkTypeId && ambiguousSelect && !ambiguousSelect.value) {
          const removeBtn = row.querySelector('button.remove-item');
          if (removeBtn) removeBtn.click();
          results.push({ url, ok: false, error: 'ambiguous relationship type — MusicBrainz needs you to pick one; use ⇗ "open in tab" to add this url manually' });
          continue;
        }
        results.push({ url, ok: true });
      } catch (e) { results.push({ url, ok: false, error: e.message || String(e) }); }
    }
    if (!results.some(r => r.ok)) return { committed: false, results };
    const d2 = frameDoc(iframe), w2 = frameWin(iframe);
    setEditNote(d2, w2, editNoteText(results, item.note));
    await wait(150);
    // manual-review path (openInTab, #467): fill the form and stop here — a human
    // reviews and clicks "Enter edit" themselves, exactly like a Harmony tab.
    if (skipSubmit) return { committed: false, results, manual: true };
    const btn = findSubmitButton(frameDoc(iframe));
    if (!btn) throw new Error('no submit button found');
    if (btn.disabled) {
      const reason = findFieldError(frameDoc(iframe));
      throw new Error(reason ? `submit button disabled — ${reason}` : 'submit button disabled (form invalid?)');
    }
    btn.click();
    // #467 (majkinetor): observed real "never redirected" failures under 3
    // concurrent workers all submitting heavy recording pages around the same
    // time — bumped from 15s since that's tight once the browser is actually
    // under that kind of concurrent load, not because a single submit is slow.
    const left = await waitFor(() => {
      const w = frameWin(iframe); if (!w) return null;
      try { return /\/edit(?:[?#]|$)/.test(w.location.pathname) ? null : true; } catch (e) { return null; }
    }, 25000);
    if (!left) throw new Error('never redirected off /edit after submit — did it actually commit?');
    return { committed: true, results };
  }

  // never hand out a queued item for an entity that's ALREADY being worked on by
  // another iframe — closes the race a later-added item for the same mbid would
  // otherwise open (grouping at add-time only covers items still queued at that
  // moment; this covers the rest).
  function nextQueued() {
    const activeKeys = new Set(queue.filter(i => i.status === 'active').map(i => i.entityType + ':' + i.mbid));
    return queue.find(i => i.status === 'queued' && !activeKeys.has(i.entityType + ':' + i.mbid));
  }
  function editUrl(item) { return `${MB_ORIGIN}/${item.entityType}/${item.mbid}/edit`; }

  // "open in a real tab" (majkinetor, #467): same reason Harmony itself opens a tab
  // per entity — a human can inspect, fix, and commit by hand. Uses the exact same
  // fillAndSubmit form-filling procedure as the worker iframes (frameDoc/frameWin
  // accept a window handle just as readily as an iframe — see above), just stopped
  // short of clicking submit. Primary use: retrying something the queue couldn't
  // commit automatically. window.open must be the very first thing that runs (no
  // preceding await) or popup blockers treat it as not user-triggered.
  function openInTab(item) {
    const tab = window.open(editUrl(item), '_blank');
    if (!tab) { log('error', `${item.mbid}: popup blocked — allow popups for this site to use "open in tab"`); return; }
    item.status = 'manual'; item.error = ''; renderQueue();
    log('info', `${entityLabel(item)} — opened in a new tab for manual review (${item.urls.length} link(s))`);
    (async () => {
      const loaded = await waitFor(() => { const d = frameDoc(tab); return d && d.readyState !== 'loading' ? true : null; }, 15000);
      if (!loaded) { log('error', `${item.mbid}: the manually-opened tab never finished loading`); return; }
      try {
        const r = await fillAndSubmit(tab, item, { skipSubmit: true });
        item.urlResults = r.results;
        const failed = r.results.filter(x => !x.ok);
        log(failed.length ? 'warn' : 'info', `${entityLabel(item)} — filled ${r.results.length - failed.length}/${r.results.length} link(s) in the manual tab, ready for you to review and submit` + (failed.length ? `; ${failed.length} couldn't be added: ${failed.map(x => `${x.url}: ${x.error}`).join('; ')}` : ''));
      } catch (e) { log('error', `${item.mbid}: filling the manual tab failed — ${e.message || e}`); }
      renderQueue();
    })();
  }

  // #467 (majkinetor, production hang): a MB edit form with typed-but-unsubmitted
  // changes registers a STICKY "unsaved changes" flag (addEventListener('beforeunload'))
  // — even removing the offending row afterward doesn't clear it (verified live).
  // Reassigning .src on that SAME iframe then triggers a native "leave site?" confirm
  // dialog, which — being a real modal — freezes the WHOLE TAB until a human dismisses
  // it. That's why every item now gets a genuinely FRESH iframe (see workerLoop) —
  // removing the old element outright, rather than reassigning .src, sidesteps the
  // dialog regardless of whether the previous page was dirty.
  // #467 follow-up (majkinetor: "the UI was unresponsive... full session"): a run
  // with NO failures at all still went unresponsive over several minutes — pointing
  // at leftover background activity (MB's own client JS: polling/retry timers) from
  // EACH earlier document not being fully torn down by a plain .src reassignment,
  // compounding across a long session. Always creating a fresh iframe (discarding
  // the old one) fixes the in-flight case; retireCard below additionally discards
  // the CURRENT iframe outright for a card that's done being useful, rather than
  // leaving a dead/failed page's scripts running in the background indefinitely.
  // The item's error text is already captured in the queue data model (that's what
  // actually matters for inspection), so a static message replaces the live iframe.
  function retireCard(card, reason) {
    card.dataset.retired = '1';
    card.style.opacity = '.55';
    const lbl = card.querySelector('.falcon-worker-lbl');
    if (lbl) lbl.textContent = (lbl.textContent || '') + ' — stopped';
    card.title = 'This worker hit an issue and was retired — kept visible for inspection. ' + (reason || '');
    const body = card.querySelector('.falcon-worker-body');
    if (body) {
      body.querySelector('iframe')?.remove();
      body.innerHTML = `<div style="position:absolute;inset:0;padding:8px;overflow:auto;font-size:11px;color:#a33;white-space:pre-wrap;background:#fff">${esc(reason || 'stopped')}</div>`;
    }
  }
  function spawnWorkerCard() {
    const strip = document.getElementById('falcon-workers'); if (!strip) return null;
    const idx = workerCards.length;
    const card = document.createElement('div');
    card.className = 'falcon-worker-card';
    card.style.cssText = 'border:1px solid #ccc;border-radius:4px;overflow:hidden;display:flex;flex-direction:column;width:260px;height:210px;';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:4px;padding:3px 6px;background:#f3f3f3;border-bottom:1px solid #ddd;font-size:10px">
        <span class="falcon-worker-lbl" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#555">idle</span>
        <button type="button" class="falcon-worker-zoom" title="Maximize this worker" style="border:none;background:none;cursor:pointer;font-size:12px;padding:0 2px">⛶</button>
      </div>
      <div class="falcon-worker-body" style="flex:1;position:relative;"></div>`;
    card.querySelector('.falcon-worker-zoom').onclick = () => { _zoomedWorker = _zoomedWorker === idx ? null : idx; renderWorkerLayout(); };
    strip.appendChild(card);
    workerCards.push(card);
    renderWorkerLayout();
    return card;
  }
  // MB's own pages aren't responsive down to a worker card's small width — loaded
  // at 260px wide, real content renders far outside that narrow viewport and
  // never becomes visible at all, showing as a blank white box (majkinetor,
  // #467, confirmed live: DOM had real, visible content, it was just laid out
  // off-screen). Fix: render the iframe at MB's normal desktop width, then
  // CSS-scale the whole thing down to exactly fill the card — MB always lays
  // out the page the way it was actually designed to, and the card just shows a
  // shrunk, still-legible thumbnail of it.
  const IFRAME_NATIVE_W = 980;
  function applyIframeScale(card) {
    const body = card.querySelector('.falcon-worker-body');
    const iframe = body?.querySelector('iframe');
    if (!body || !iframe) return;
    // body.clientHeight is unreliable here — observed reading 0 even once the
    // card itself was fully laid out (flex:1 child of a column flex container
    // whose own height came from a plain inline style; some engines don't
    // settle its cross-size on the first pass). card's OWN clientWidth/Height
    // are solid, so derive the body's actual area from those instead of
    // trusting the (buggy) computed height on the flex child itself.
    const header = card.children[0];
    const w = card.clientWidth;
    const h = card.clientHeight - (header ? header.clientHeight : 0);
    if (!w || h <= 0) return;   // card is hidden (display:none) right now — nothing to size
    const scale = w / IFRAME_NATIVE_W;
    iframe.style.width = IFRAME_NATIVE_W + 'px';
    iframe.style.height = Math.round(h / scale) + 'px';
    iframe.style.transform = `scale(${scale})`;
  }
  function newIframeIn(card) {
    const body = card.querySelector('.falcon-worker-body');
    const old = body.querySelector('iframe');
    if (old) old.remove();
    const f = document.createElement('iframe');
    f.className = 'falcon-worker'; f.style.cssText = 'position:absolute;top:0;left:0;border:none;background:#fff;transform-origin:0 0;';
    body.appendChild(f);
    applyIframeScale(card);
    return f;
  }

  async function workerLoop(card) {
    while (running) {
      const item = nextQueued();
      if (!item) break;
      item.status = 'active'; renderQueue();
      log('info', `${item.entityType} ${item.mbid} — loading edit page (${item.urls.length} link(s))`);
      // ALWAYS a fresh iframe, even after a clean commit on this same card — a
      // real multi-item session showed the tab going fully unresponsive over
      // time (majkinetor, #467), consistent with the previous item's document
      // (its own polling/background JS) not being fully torn down by a plain
      // `.src` reassignment. newIframeIn() removes the old element outright —
      // that unambiguously kills its whole browsing context, whether it was
      // clean or dirty — the card visually keeps flowing either way.
      const iframe = newIframeIn(card);
      updateWorkerLabel(card, item);
      iframe.src = editUrl(item);
      const loaded = await waitFor(() => { const w = frameWin(iframe); return w && frameDoc(iframe) && frameDoc(iframe).readyState !== 'loading' ? true : null; }, 15000);
      if (!loaded) {
        item.status = 'failed'; item.error = 'edit page never loaded';
        log('error', `${item.mbid}: edit page never loaded`);
        retireCard(card, item.error); renderQueue();
        const replacement = spawnWorkerCard();
        if (replacement) workerLoop(replacement);
        return;
      }
      let r = null;
      try {
        r = await fillAndSubmit(iframe, item);
        item.urlResults = r.results;
        const failedUrls = r.results.filter(x => !x.ok);
        if (!r.committed) {
          item.status = 'failed';
          item.error = failedUrls.map(x => `${x.url}: ${x.error}`).join('; ');
          log('error', `${item.mbid}: nothing added — ${item.error}`);
        } else if (failedUrls.length) {
          item.status = 'partial';
          item.error = failedUrls.map(x => `${x.url}: ${x.error}`).join('; ');
          log('warn', `${item.entityType} ${item.mbid} — committed ${r.results.length - failedUrls.length}/${r.results.length} link(s)`);
        } else {
          item.status = 'done';
          log('info', `${item.entityType} ${item.mbid} — committed ${r.results.length} link(s)`);
        }
      } catch (e) {
        item.status = 'failed'; item.error = e.message || String(e);
        log('error', `${item.mbid}: ${item.error}`);
      }
      renderQueue();
      if (r && r.committed) {
        // a real submit happened — this card keeps going (a fresh iframe loads
        // the NEXT item next iteration, see above) rather than retiring, so you
        // can watch one worker flow through a whole run instead of every single
        // item spawning a new card.
        updateWorkerLabel(card, null);
        continue;
      }
      // anything else: this card's form may still be dirty — retire it in place
      // (stays visible with its last state, per majkinetor) and hand off to a fresh
      // replacement card rather than risk the beforeunload freeze.
      retireCard(card, item.error);
      const next = spawnWorkerCard();
      if (next) workerLoop(next);
      return;
    }
    updateWorkerLabel(card, null);
  }

  // #467 (majkinetor): each worker gets its own card — a small label (which entity
  // it's on right now) plus a ⛶ toggle to view just that one large, so a failure can
  // actually be read instead of squinting at a 220x160 thumbnail. Zooming one worker
  // hides the others rather than trying to fit everything in a responsive grid.
  // Cards accumulate as a visible history (retired ones dim + freeze in place, see
  // above) rather than being torn down — only ever appended, never removed/reused
  // across a Start click, so old state stays inspectable until the panel closes.
  let workerCards = [];
  let _zoomedWorker = null;   // index into workerCards, or null
  function updateWorkerLabel(card, item) {
    if (card.dataset.retired) return;   // don't overwrite a retired card's frozen label
    const lbl = card.querySelector('.falcon-worker-lbl');
    if (lbl) lbl.textContent = item ? `${entityLabel(item)} — ${item.urls.length} link(s)` : 'idle';
  }
  function renderWorkerLayout() {
    workerCards.forEach((card, i) => {
      const zoomBtn = card.querySelector('.falcon-worker-zoom');
      if (_zoomedWorker === null) {
        card.style.display = ''; card.style.width = '260px'; card.style.height = '210px';
        if (zoomBtn) { zoomBtn.textContent = '⛶'; zoomBtn.title = 'Maximize this worker'; }
      } else if (_zoomedWorker === i) {
        card.style.display = ''; card.style.width = '100%'; card.style.height = '560px';
        if (zoomBtn) { zoomBtn.textContent = '❐'; zoomBtn.title = 'Restore'; }
      } else {
        card.style.display = 'none';
      }
      if (card.style.display !== 'none') applyIframeScale(card);   // card size just changed — rescale its iframe to match
    });
  }
  function start() {
    if (running) return;
    if (!queue.some(i => i.status === 'queued')) { log('warn', 'nothing queued'); return; }
    running = true;
    const need = Math.min(cfg.workers, queue.filter(i => i.status === 'queued').length);
    log('info', `starting ${need} worker(s) for ${queue.filter(i => i.status === 'queued').length} queued item(s)`);
    for (let i = 0; i < need; i++) { const card = spawnWorkerCard(); if (card) workerLoop(card); }
    updateRunBtn();
  }
  function stop() { running = false; log('info', 'stopping — in-flight items finish, no new ones start'); updateRunBtn(); }

  /* ════════════════════════ UI ════════════════════════ */
  let launcher = null;
  function ensureLauncher() {
    if (launcher) return;
    launcher = document.createElement('button');
    launcher.type = 'button'; launcher.id = 'falcon-launcher';
    launcher.title = `${NAME} — bulk link editor (Ctrl+Alt+F)`;
    launcher.dataset.mbCorner = 'br'; launcher.dataset.mbCornerOrder = '20';
    launcher.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483646;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.55);color:#1b2a4a;box-shadow:0 2px 8px rgba(0,0,0,.18);transition:background .15s,transform .1s;opacity:.55';
    launcher.innerHTML = ICON;
    launcher.onmouseenter = () => { launcher.style.transform = 'scale(1.08)'; launcher.style.opacity = '1'; };
    launcher.onmouseleave = () => { launcher.style.transform = 'scale(1)'; launcher.style.opacity = '.55'; };
    launcher.onclick = () => togglePanel();
    document.body.appendChild(launcher);
    mbRestackCorner('br');
  }

  let panel = null, tab = 'queue';
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div'); panel.id = 'falcon-panel';
    panel.style.cssText = 'display:none;flex-direction:column;position:fixed;z-index:2147483647;left:50%;top:50%;transform:translate(-50%,-50%);width:460px;max-width:90vw;max-height:70vh;background:#fff;color:#222;border-radius:8px;font:12px -apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.28);border:1px solid #ddd;overflow:hidden';
    panel.innerHTML = `
      <div id="falcon-hdr" style="display:flex;align-items:center;gap:6px;padding:8px 10px;background:#1b2a4a;color:#fff;cursor:move;user-select:none">
        <span style="display:flex;color:#ff9d5c">${ICON}</span>
        <span style="flex:1;font-weight:700">${NAME} <span style="opacity:.7;font-weight:400">v${scriptVersion()}</span></span>
        <button type="button" id="falcon-tab-queue" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Queue</button>
        <button type="button" id="falcon-tab-workers" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Workers</button>
        <button type="button" id="falcon-tab-log" style="background:none;border:none;color:#fff;opacity:.7;cursor:pointer;font:inherit">Log</button>
        <a href="${HELP_URL}" target="_blank" rel="noopener" style="color:#fff;opacity:.7;text-decoration:none;font-weight:700">?</a>
        <button type="button" id="falcon-maximize" title="Maximize" style="background:none;border:none;color:#fff;cursor:pointer;font:inherit;font-size:14px">⛶</button>
        <button type="button" id="falcon-close" style="background:none;border:none;color:#fff;cursor:pointer;font:inherit;font-size:14px">✕</button>
      </div>
      <div id="falcon-body-queue" style="padding:0;overflow:hidden;flex:1;display:flex;flex-direction:column">
        <div id="falcon-queue-toolbar" style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;color:#666;flex:0 0 auto">
          <button type="button" id="falcon-paste-toggle" title="Paste entities to add to the queue" style="width:26px;height:26px;border-radius:50%;border:1px solid #ccc;background:#fafafa;cursor:pointer;font:16px/1 Arial;color:#1b2a4a;flex:0 0 auto">+</button>
          <span style="width:1px;height:18px;background:#ddd;flex:0 0 auto"></span>
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer;flex:0 0 auto" title="Select all">
            <input type="checkbox" id="falcon-select-all" />
            <span>all</span>
          </label>
          <button type="button" id="falcon-expand-all" style="padding:2px 8px;cursor:pointer" title="Expand every row's url detail">Expand all</button>
          <span id="falcon-select-count"></span>
          <button type="button" id="falcon-remove-selected" disabled style="margin-left:auto;padding:2px 8px;cursor:pointer">Remove selected</button>
        </div>
        <div id="falcon-paste-box" style="display:none;padding:6px 10px;border-bottom:1px solid #eee;flex:0 0 auto">
          <textarea id="falcon-paste" placeholder="One entity per line: <artist-mbid>,<url>  (or  artist:<mbid>,<url>  /  label:<mbid>,<url>  /  recording:<mbid>,<url>)  — multiple lines for the same mbid are grouped into one edit" style="width:100%;height:64px;box-sizing:border-box;font:11px monospace;resize:vertical"></textarea>
          <div style="display:flex;gap:6px;margin-top:4px">
            <button type="button" id="falcon-add" style="padding:4px 10px;cursor:pointer">+ Add to queue</button>
          </div>
        </div>
        <div id="falcon-queue-list" style="overflow:auto;flex:1;padding:0 10px"></div>
        <div id="falcon-queue-bottom" style="display:flex;gap:6px;align-items:center;padding:8px 10px;border-top:1px solid #eee;flex:0 0 auto">
          <span style="color:#666">workers</span>
          <input type="number" id="falcon-worker-count" min="1" max="6" style="width:40px" />
          <button type="button" id="falcon-run" style="margin-left:auto;padding:4px 12px;font-weight:700;cursor:pointer;background:#1b2a4a;color:#fff;border:none;border-radius:4px">▶ Start</button>
        </div>
      </div>
      <div id="falcon-body-workers" style="display:none;padding:8px 10px;overflow:auto;flex:1">
        <div style="color:#888;margin-bottom:6px">Live worker iframes — each one loads an entity's edit page, fills it, submits, then moves to the next queued item.</div>
        <div id="falcon-workers" style="display:flex;gap:8px;flex-wrap:wrap"></div>
      </div>
      <div id="falcon-body-log" style="display:none;padding:8px 10px;overflow:auto;flex:1;font:10px monospace;white-space:pre-wrap"></div>`;
    document.body.appendChild(panel);
    document.getElementById('falcon-close').onclick = () => { panel.style.display = 'none'; };
    document.getElementById('falcon-maximize').onclick = toggleMaximize;
    const wIn = document.getElementById('falcon-worker-count'); wIn.value = cfg.workers;
    wIn.onchange = () => { cfg.workers = wIn.value; wIn.value = cfg.workers; };
    document.getElementById('falcon-add').onclick = () => {
      const ta = document.getElementById('falcon-paste');
      const parsed = parsePaste(ta.value);
      if (!parsed.length) { log('warn', 'nothing parseable in the paste box'); return; }
      const { merged, added } = addToQueue(parsed);
      ta.value = ''; renderQueue();
      log('info', `queued ${added} new item(s)` + (merged ? `, merged ${merged} url(s) into already-queued entities` : ''));
      document.getElementById('falcon-paste-box').style.display = 'none';
    };
    // paste box starts collapsed to a small (+) button (majkinetor, #467) — expands
    // on click, auto-collapses again once something's added (above) or on blur if
    // left empty (mirrors Apollo Editor's collapsible paste-box convention).
    document.getElementById('falcon-paste-toggle').onclick = () => {
      const box = document.getElementById('falcon-paste-box');
      const opening = box.style.display === 'none';
      box.style.display = opening ? 'block' : 'none';
      if (opening) document.getElementById('falcon-paste').focus();
    };
    document.getElementById('falcon-paste').addEventListener('blur', function () {
      if (!this.value.trim()) document.getElementById('falcon-paste-box').style.display = 'none';
    });
    document.getElementById('falcon-run').onclick = () => { if (running) stop(); else { start(); setTab('workers'); } };
    document.getElementById('falcon-select-all').onchange = function () {
      const selectable = queue.filter(i => i.status !== 'active');
      if (this.checked) selectable.forEach(i => _selectedIds.add(i.id));
      else selectable.forEach(i => _selectedIds.delete(i.id));
      renderQueue();
    };
    document.getElementById('falcon-remove-selected').onclick = () => {
      const removable = [..._selectedIds].filter(id => { const it = queue.find(q => q.id === id); return it && it.status !== 'active'; });
      if (!removable.length) return;
      queue = queue.filter(i => !removable.includes(i.id));
      removable.forEach(id => _selectedIds.delete(id));
      log('info', `removed ${removable.length} item(s) from the queue`);
      renderQueue();
    };
    // #467 (majkinetor): toggles between expanding every row's url detail at
    // once and collapsing them all — its own label reflects which action is
    // next, kept in sync from renderQueue() since expanding/collapsing an
    // individual row can also change whether "all" are currently expanded.
    document.getElementById('falcon-expand-all').onclick = () => {
      const allExpanded = queue.length > 0 && queue.every(i => _expandedIds.has(i.id));
      if (allExpanded) _expandedIds.clear();
      else queue.forEach(i => _expandedIds.add(i.id));
      renderQueue();
    };
    // one delegated listener for every row action — rows are fully re-rendered on
    // every renderQueue(), so per-element handlers would just leak; look the
    // clicked/changed item up by its data-id instead.
    const list = document.getElementById('falcon-queue-list');
    list.addEventListener('click', e => {
      const expandBtn = e.target.closest('.falcon-row-expand');
      if (expandBtn) { const id = expandBtn.dataset.id; _expandedIds.has(id) ? _expandedIds.delete(id) : _expandedIds.add(id); renderQueue(); return; }
      const removeBtn = e.target.closest('.falcon-row-remove');
      if (removeBtn) { const id = removeBtn.dataset.id; queue = queue.filter(i => i.id !== id); _selectedIds.delete(id); _expandedIds.delete(id); renderQueue(); return; }
      const tabBtn = e.target.closest('.falcon-row-opentab');
      if (tabBtn) { const it = queue.find(i => i.id === tabBtn.dataset.id); if (it) openInTab(it); return; }
      const statusBtn = e.target.closest('.falcon-row-status');
      if (statusBtn) {
        const it = queue.find(i => i.id === statusBtn.dataset.id);
        if (it && (it.status === 'failed' || it.status === 'partial')) showItemPopup(it);
        return;
      }
    });
    list.addEventListener('change', e => {
      const chk = e.target.closest('.falcon-row-check');
      if (!chk) return;
      chk.checked ? _selectedIds.add(chk.dataset.id) : _selectedIds.delete(chk.dataset.id);
      renderQueue();
    });
    document.getElementById('falcon-tab-queue').onclick = () => setTab('queue');
    document.getElementById('falcon-tab-workers').onclick = () => setTab('workers');
    document.getElementById('falcon-tab-log').onclick = () => setTab('log');
    // drag by header
    const hdr = document.getElementById('falcon-hdr');
    let dragging = false, dx = 0, dy = 0;
    hdr.addEventListener('mousedown', e => {
      if (e.target.closest('button, a')) return;
      dragging = true;
      const r = panel.getBoundingClientRect();
      // detach from the centering transform BEFORE reading dx/dy — otherwise the
      // first drag move jumps (translate(-50%,-50%) would double-apply against the
      // new left/top). getBoundingClientRect() already reflects the transformed
      // (visual) position, so this keeps the panel exactly where it looked like it was.
      panel.style.transform = 'none'; panel.style.left = r.left + 'px'; panel.style.top = r.top + 'px'; panel.style.right = 'auto'; panel.style.bottom = 'auto';
      dx = e.clientX - r.left; dy = e.clientY - r.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => { if (!dragging) return; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)) + 'px'; panel.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + 'px'; });
    window.addEventListener('mouseup', () => { dragging = false; });
  }
  function setTab(t) {
    tab = t;
    document.getElementById('falcon-body-queue').style.display = t === 'queue' ? 'flex' : 'none';
    document.getElementById('falcon-body-workers').style.display = t === 'workers' ? 'block' : 'none';
    document.getElementById('falcon-body-log').style.display = t === 'log' ? 'block' : 'none';
    if (t === 'log') renderLog();
  }
  function showPanel() { ensurePanel(); panel.style.display = 'flex'; renderQueue(); }
  function togglePanel() { ensurePanel(); if (panel.style.display === 'none') showPanel(); else panel.style.display = 'none'; }

  // #467 (majkinetor): "maximize" — grows the whole panel (and, on the Workers tab,
  // gives each worker card more natural room) so log/queue/worker content isn't
  // squinted at in a 460px-wide box. Detaches from whatever corner it's anchored to
  // (or wherever it's been dragged) and restores the exact prior box on toggle-back.
  let _maxed = false, _prevBox = null;
  function toggleMaximize() {
    const btn = document.getElementById('falcon-maximize');
    if (!_maxed) {
      _prevBox = { left: panel.style.left, top: panel.style.top, right: panel.style.right, bottom: panel.style.bottom, width: panel.style.width, height: panel.style.height, maxWidth: panel.style.maxWidth, maxHeight: panel.style.maxHeight, transform: panel.style.transform };
      panel.style.left = '3vw'; panel.style.top = '3vh'; panel.style.right = 'auto'; panel.style.bottom = 'auto'; panel.style.transform = 'none';
      panel.style.width = '94vw'; panel.style.maxWidth = '94vw'; panel.style.height = '94vh'; panel.style.maxHeight = '94vh';
      _maxed = true; if (btn) { btn.textContent = '❐'; btn.title = 'Restore'; }
    } else {
      if (_prevBox) Object.assign(panel.style, _prevBox);
      _maxed = false; if (btn) { btn.textContent = '⛶'; btn.title = 'Maximize'; }
    }
  }

  const DOT = { queued: '#999', active: '#e08a1e', done: '#2e9e5b', partial: '#d68910', failed: '#c0392b', manual: '#6b5bce' };
  function renderRowDetail(it) {
    const results = it.urlResults || [];
    return it.urls.map(u => {
      const res = results.find(r => r.url === u.url);
      const icon = res ? (res.ok ? '✓' : '✗') : '·';
      const color = res ? (res.ok ? '#2e9e5b' : '#c0392b') : '#aaa';
      return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0 2px 30px;font-size:10.5px" title="${res && res.error ? esc(res.error) : ''}">
        <span style="color:${color};width:10px;flex:0 0 auto;text-align:center">${icon}</span>
        <span style="color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(u.url)}</span>
        ${u.linkTypeId ? `<span style="color:#999;flex:0 0 auto">type ${esc(u.linkTypeId)}</span>` : ''}
      </div>`;
    }).join('');
  }
  function renderQueue() {
    const list = document.getElementById('falcon-queue-list'); if (!list) return;
    list.innerHTML = queue.map(it => {
      const expanded = _expandedIds.has(it.id);
      const checked = _selectedIds.has(it.id);
      const isActive = it.status === 'active';
      return `
      <div class="falcon-row" data-id="${it.id}" style="border-bottom:1px solid #f3f3f3">
        <div style="display:flex;align-items:center;gap:6px;padding:2px 0" title="${it.error ? esc(it.error) : ''}">
          <input type="checkbox" class="falcon-row-check" data-id="${it.id}" ${checked ? 'checked' : ''} ${isActive ? 'disabled' : ''} style="flex:0 0 auto" />
          <button type="button" class="falcon-row-expand" data-id="${it.id}" title="${it.urls.length > 1 ? 'Show/hide urls' : 'Show url detail'}" style="border:none;background:none;cursor:pointer;color:#777;flex:0 0 auto;font-size:15px;line-height:1;width:22px;height:22px;padding:0;display:flex;align-items:center;justify-content:center">${expanded ? '▾' : '▸'}</button>
          <span style="width:8px;height:8px;border-radius:50%;background:${DOT[it.status] || '#999'};flex:0 0 auto"></span>
          <a href="${MB_ORIGIN}/${it.entityType}/${it.mbid}" target="_blank" rel="noopener" title="${esc(it.entityType)}/${esc(it.mbid)}" style="color:#1b2a4a;text-decoration:none;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto">${esc(entityLabel(it))}</a>
          <span style="color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${it.urls.length > 1 ? `${it.urls.length} links` : esc(it.urls[0]?.url || '')}</span>
          <span class="falcon-row-status" data-id="${it.id}" title="${it.status === 'failed' || it.status === 'partial' ? 'Click to inspect this failure' : ''}" style="text-transform:uppercase;font-size:9px;flex:0 0 auto;${it.status === 'failed' || it.status === 'partial' ? 'color:#c0392b;cursor:pointer;text-decoration:underline' : 'color:#999'}">${it.status}</span>
          <button type="button" class="falcon-row-opentab" data-id="${it.id}" title="Open this entity's edit page in a real tab, pre-filled, to inspect/complete manually" style="border:none;background:none;cursor:pointer;color:#666;flex:0 0 auto">⇗</button>
          <button type="button" class="falcon-row-remove" data-id="${it.id}" ${isActive ? 'disabled' : ''} title="Remove from queue" style="border:none;background:none;cursor:pointer;color:#999;flex:0 0 auto">✕</button>
        </div>
        ${expanded ? renderRowDetail(it) : ''}
      </div>`;
    }).join('') || '<div style="color:#999;padding:8px 0">Queue is empty — click + above to paste some entities.</div>';
    const selCount = document.getElementById('falcon-select-count');
    if (selCount) selCount.textContent = _selectedIds.size ? `${_selectedIds.size} selected` : '';
    const removeBtn = document.getElementById('falcon-remove-selected');
    if (removeBtn) removeBtn.disabled = _selectedIds.size === 0;
    const selectAll = document.getElementById('falcon-select-all');
    if (selectAll) { const selectable = queue.filter(i => i.status !== 'active'); selectAll.checked = selectable.length > 0 && selectable.every(i => _selectedIds.has(i.id)); }
    const expandAllBtn = document.getElementById('falcon-expand-all');
    if (expandAllBtn) {
      const allExpanded = queue.length > 0 && queue.every(i => _expandedIds.has(i.id));
      expandAllBtn.textContent = allExpanded ? 'Collapse all' : 'Expand all';
    }
  }

  // #467 (majkinetor): "click the failed label, open its worker alone in a
  // popup... show error in header" — a dedicated popup for ONE failed/partial
  // item, its error shown prominently (not just on hover), its url detail
  // below, and a maximize toggle matching the panel/worker-card convention.
  // Doesn't need a live iframe — retired cards no longer keep one running
  // (see retireCard) and the queue's own data model already has everything
  // needed for inspection.
  let _itemPopupId = null, _itemPopupMaxed = false;
  function ensureItemPopup() {
    if (document.getElementById('falcon-item-popup')) return;
    const el = document.createElement('div');
    el.id = 'falcon-item-popup';
    el.style.cssText = 'display:none;position:fixed;z-index:2147483647;left:50%;top:50%;transform:translate(-50%,-50%);width:520px;max-width:92vw;max-height:70vh;background:#fff;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.3);border:1px solid #ddd;overflow:hidden;flex-direction:column;font:12px -apple-system,Segoe UI,Arial,sans-serif';
    el.innerHTML = `
      <div id="falcon-item-popup-hdr" style="padding:8px 10px;background:#7a2020;color:#fff;display:flex;align-items:center;gap:8px">
        <span id="falcon-item-popup-title" style="flex:1;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
        <button type="button" id="falcon-item-popup-maximize" title="Maximize" style="background:none;border:none;color:#fff;cursor:pointer;font-size:14px">⛶</button>
        <button type="button" id="falcon-item-popup-close" style="background:none;border:none;color:#fff;cursor:pointer;font-size:14px">✕</button>
      </div>
      <div id="falcon-item-popup-error" style="padding:8px 10px;background:#fdecea;color:#a33;font-size:11px;white-space:pre-wrap;border-bottom:1px solid #f3c8c3"></div>
      <div id="falcon-item-popup-body" style="padding:8px 10px;overflow:auto;flex:1"></div>
      <div style="padding:8px 10px;border-top:1px solid #eee;display:flex;justify-content:flex-end">
        <button type="button" id="falcon-item-popup-opentab" style="padding:4px 10px;cursor:pointer">⇗ Open in tab</button>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('falcon-item-popup-close').onclick = () => { el.style.display = 'none'; _itemPopupId = null; };
    document.getElementById('falcon-item-popup-maximize').onclick = () => {
      _itemPopupMaxed = !_itemPopupMaxed;
      el.style.width = _itemPopupMaxed ? '94vw' : '520px';
      el.style.height = _itemPopupMaxed ? '90vh' : '';
      document.getElementById('falcon-item-popup-maximize').textContent = _itemPopupMaxed ? '❐' : '⛶';
      document.getElementById('falcon-item-popup-maximize').title = _itemPopupMaxed ? 'Restore' : 'Maximize';
    };
    document.getElementById('falcon-item-popup-opentab').onclick = () => {
      const it = queue.find(i => i.id === _itemPopupId);
      if (it) openInTab(it);
    };
  }
  function showItemPopup(item) {
    ensureItemPopup();
    _itemPopupId = item.id;
    const el = document.getElementById('falcon-item-popup');
    document.getElementById('falcon-item-popup-title').textContent = `${entityLabel(item)} — ${item.status.toUpperCase()}`;
    document.getElementById('falcon-item-popup-error').textContent = item.error || '(no error message recorded)';
    document.getElementById('falcon-item-popup-body').innerHTML = renderRowDetail(item) || '<div style="color:#999">No url detail available.</div>';
    el.style.display = 'flex';
  }
  function renderLog() {
    const el = document.getElementById('falcon-body-log'); if (!el || tab !== 'log') return;
    el.textContent = LOG.join('\n');
    el.scrollTop = el.scrollHeight;
  }
  function updateRunBtn() {
    const b = document.getElementById('falcon-run'); if (!b) return;
    b.textContent = running ? '■ Stop' : '▶ Start';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ── boot ────────────────────────────────────────────────────────────── */
  if (ON_HARMONY) {
    ensureHarmonyButton();
    // Harmony's actions render client-side after load — rescan until the count
    // settles (3 unchanged reads), then stop polling.
    let stableCount = 0, lastN = -1;
    const iv = setInterval(() => {
      const n = scrapeHarmonyActions().length;
      ensureHarmonyButton();
      if (n === lastN) { if (++stableCount >= 3) clearInterval(iv); } else { stableCount = 0; lastN = n; }
    }, 1000);
  } else {
    const seeded = parseUrlParam();
    ensureLauncher();
    if (seeded && seeded.length) {
      addToQueue(seeded);
      log('info', `seeded ${seeded.length} item(s) from the falcon= URL param`);
      showPanel();
    }
    window.addEventListener('keydown', e => {
      if (!e.ctrlKey || !e.altKey || e.shiftKey || e.metaKey) return;
      if ((e.key || '').toLowerCase() !== 'f') return;
      e.preventDefault(); e.stopPropagation();
      togglePanel();
    });
  }

  // Test hook only (#467) — no behavior change.
  window.__falconTest = { parseLine, parsePaste, parseUrlParam, parseHarmonySeedUrl, encodeFalconPayload, scrapeHarmonyActions, makePendingToken, addToQueue, getQueue: () => queue, setQueue: q => { queue = q; renderQueue(); }, start, stop, cfg, fillAndSubmit, findAddLinkInput, findSubmitButton, findFieldError, setRowLinkType, addSecondRelationshipType, editUrl, nextQueued, fetchEntityName, entityLabel, openInTab, getSelectedIds: () => _selectedIds, getExpandedIds: () => _expandedIds, mbThrottle, showItemPopup };
})();
