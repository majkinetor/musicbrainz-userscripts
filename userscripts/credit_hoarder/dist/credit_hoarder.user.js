// ==UserScript==
// @name         Credit Hoarder
// @namespace    majkinetor
// @version      2026.6.18
// @description  Import per-track release credits from streaming/database providers (Discogs, Tidal, Qobuz) into MusicBrainz relationships, with a review phase
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij4KICANCiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMmY2ZjU0IiBzdHJva2Utd2lkdGg9IjkiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+DQogICAgPGNpcmNsZSBjeD0iMzQiIGN5PSIzOCIgcj0iMi41IiBmaWxsPSIjMmY2ZjU0IiBzdHJva2U9Im5vbmUiLz4NCiAgICA8bGluZSB4MT0iNTAiIHkxPSIzOCIgeDI9Ijk4IiB5Mj0iMzgiLz4NCiAgICA8Y2lyY2xlIGN4PSIzNCIgY3k9IjY0IiByPSIyLjUiIGZpbGw9IiMyZjZmNTQiIHN0cm9rZT0ibm9uZSIvPg0KICAgIDxsaW5lIHgxPSI1MCIgeTE9IjY0IiB4Mj0iOTgiIHkyPSI2NCIvPg0KICAgIDxjaXJjbGUgY3g9IjM0IiBjeT0iOTAiIHI9IjIuNSIgZmlsbD0iIzJmNmY1NCIgc3Ryb2tlPSJub25lIi8+DQogICAgPGxpbmUgeDE9IjUwIiB5MT0iOTAiIHgyPSI3NCIgeTI9IjkwIi8+DQogIDwvZz4NCiAgPGNpcmNsZSBjeD0iOTIiIGN5PSI5MiIgcj0iMjMiIGZpbGw9IiMyZTllNWIiLz4NCiAgPGcgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lY2FwPSJyb3VuZCI+DQogICAgPGxpbmUgeDE9IjkyIiB5MT0iODEiIHgyPSI5MiIgeTI9IjEwMyIvPg0KICAgIDxsaW5lIHgxPSI4MSIgeTE9IjkyIiB4Mj0iMTAzIiB5Mj0iOTIiLz4NCiAgPC9nPg0KPC9zdmc+DQo=
// @match        https://*.musicbrainz.org/release/*/edit-relationships
// @match        https://*.musicbrainz.org/artist/*
// @match        https://*.musicbrainz.org/label/*
// @match        https://*.musicbrainz.org/place/*
// @match        https://tidal.com/album/*
// @match        https://listen.tidal.com/album/*
// @license      MIT
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md
// @supportURL   https://github.com/majkinetor/musicbrainz-userscripts/issues
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      qobuz.com
// @connect      www.qobuz.com
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// ==/UserScript==

(() => {
  // src/constants.js
  var REL_TEMPLATE = {
    _lineage: [],
    _original: null,
    _status: 1,
    attributes: null,
    begin_date: null,
    editsPending: false,
    end_date: null,
    ended: false,
    entity0_credit: "",
    entity1_credit: "",
    id: null,
    linkOrder: 0,
    linkTypeID: null
  };
  var SELECTORS = {
    MediumsInput: ".multiselect-input",
    MediumsInputOptions: ".multiselect-input + .menu a",
    InstrumentsInput: "#add-relationship-dialog .multiselect.instrument input[aria-autocomplete]",
    VocalsTypeInput: "#add-relationship-dialog .multiselect.vocal input[aria-autocomplete]",
    AddRelationshipsDialogEntityType: "#add-relationship-dialog .entity-type",
    AddRelationshipsDialogRelationshipType: "#add-relationship-dialog input.relationship-type",
    AddRelationshipsDialogRelationshipTarget: "#add-relationship-dialog input.relationship-target",
    AddRelationshipsDialogEntityCredit: "#add-relationship-dialog input.entity-credit",
    AddRelationshipsDialogDoneButton: "#add-relationship-dialog .buttons button.positive",
    AddRelationshipsDialogError: "#add-relationship-dialog .error",
    AddRelationshipsDialogCancelButton: "#add-relationship-dialog .buttons button.negative",
    AddReleaseRelationshipButton: "#release-rels button.add-relationship",
    EditNote: "#edit-note-text",
    TaskInput: "#add-relationship-dialog .attribute-container.task input"
  };
  var DISCOGS_LOGO_URL = "https://volkerzell.de/favicons/discogs.png";
  var EQUIVALENCE_SETS = [
    ["writer", "composer"]
  ];
  var DISCOGS_CHANNEL = new BroadcastChannel("discogs-importer-artist");
  var pageWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  // src/log.js
  var _logs = null;
  var _warn = 0;
  var _err = 0;
  var _countListener = null;
  function onLogCounts(fn) {
    _countListener = fn;
  }
  function resetLogCounts() {
    _warn = 0;
    _err = 0;
    _notifyCounts();
  }
  function _notifyCounts() {
    if (_countListener) {
      try {
        _countListener(_warn, _err);
      } catch (e) {
      }
    }
  }
  function setLogContainer(el) {
    _logs = el;
  }
  function getLogContainer() {
    return _logs;
  }
  var _review = null;
  function setReviewContainer(el) {
    _review = el;
  }
  function getReviewContainer() {
    return _review || _logs;
  }
  function _emit(html, plainText, sev) {
    if (!_logs) return;
    const li = document.createElement("li");
    if (sev) li.dataset.sev = sev;
    if (sev === "warn") {
      _warn++;
      _notifyCounts();
    } else if (sev === "error") {
      _err++;
      _notifyCounts();
    }
    const d = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    li.innerHTML = `<span style="color:#999;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.82em;">${stamp}</span> ${html}`;
    _logs.insertAdjacentElement("beforeend", li);
    const bar = document.querySelector(".discogs-bar");
    if (bar?._setProgress) {
      bar._setProgress(null, plainText.replace(/<[^>]*>/g, "").trim().substring(0, 120));
    }
  }
  var log = {
    info: (msg) => _emit(msg, msg),
    warn: (msg) => _emit(`<span style="color:orange">WARN ${msg}</span>`, `WARN ${msg}`, "warn"),
    error: (msg) => _emit(`<span style="color:red">ERR ${msg}</span>`, `ERR ${msg}`, "error"),
    // Entity skipped because it wasn't matched on MB in the review (#118). Kept
    // OUT of the WARN tally — these are surfaced by the separate "N unresolved"
    // badge, and the maintainer asked not to lump them with real warnings. Still
    // rendered (muted amber) so the log shows exactly which roles were dropped.
    skip: (msg) => _emit(`<span style="color:#8a6d3b">SKIP ${msg}</span>`, `SKIP ${msg}`, "skip")
  };
  var _debugUl = null;
  var _debugStartT = null;
  function _ensureDebugUl() {
    if (_debugUl) return _debugUl;
    if (!_logs) return null;
    const details = document.createElement("details");
    details.style.cssText = "margin:0.3rem 0;";
    const summary = document.createElement("summary");
    summary.textContent = "Preflight diagnostics";
    summary.style.cssText = "cursor:pointer;font-size:0.8rem;color:#888;user-select:none;";
    details.appendChild(summary);
    const ul = document.createElement("ul");
    ul.style.cssText = "list-style:none;margin:0.3rem 0;padding:0.4rem 0.6rem;background:#f7f7f7;border-radius:0.25rem;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:0.72rem;color:#444;max-height:24rem;overflow-y:auto;";
    details.appendChild(ul);
    const li = document.createElement("li");
    li.style.listStyle = "none";
    li.appendChild(details);
    _logs.appendChild(li);
    _debugUl = ul;
    _debugStartT = performance.now();
    return _debugUl;
  }
  function logDebug(line) {
    const ul = _ensureDebugUl();
    if (!ul) return;
    const t = Math.round(performance.now() - _debugStartT);
    const row = document.createElement("div");
    row.textContent = `[+${t}ms] ${line}`;
    ul.appendChild(row);
  }

  // src/api-mb.js
  async function fetchMBEntity(mbid) {
    const res = await fetch(`/ws/js/entity/${mbid}`);
    if (!res.ok) throw new Error(`/ws/js/entity/${mbid} \u2192 ${res.status}`);
    return res.json();
  }
  var mbThrottle = /* @__PURE__ */ (() => {
    const MAX_CONCURRENT = 4;
    let _running = 0;
    let _pauseUntil = 0;
    const _queue = [];
    let _totalRequests = 0;
    let _rateLimited = 0;
    async function _waitForPause() {
      let wait = _pauseUntil - Date.now();
      if (wait <= 0) return;
      logDebug(`throttle: waiting ${wait}ms for shared pause`);
      while ((wait = _pauseUntil - Date.now()) > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }
    }
    function _drain() {
      while (_running < MAX_CONCURRENT && _queue.length > 0) {
        _running++;
        const item = _queue.shift();
        _run(item).finally(() => {
          _running--;
          _drain();
        });
      }
    }
    let _diagReqSeq = 0;
    const REQUEST_TIMEOUT_MS = 1e4;
    async function _run(item) {
      const tag = `req#${++_diagReqSeq}`;
      const shortUrl = item.url.replace("//musicbrainz.org", "").replace(/^https:/, "");
      for (let attempt = 0; attempt <= item.retries; attempt++) {
        await _waitForPause();
        _totalRequests++;
        const attemptTag = attempt === 0 ? "" : ` (retry ${attempt})`;
        logDebug(`${tag} [running=${_running} queued=${_queue.length}] GET ${shortUrl}${attemptTag}`);
        const t0 = Date.now();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        try {
          const res = await fetch(item.url, { signal: ctrl.signal });
          const elapsed = Date.now() - t0;
          if (res.status === 429 || res.status === 503) {
            _rateLimited++;
            const ra = parseInt(res.headers.get("Retry-After"), 10);
            const waitMs = ra > 0 ? ra * 1e3 : Math.min(1e3 * Math.pow(2, attempt), 3e4);
            _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
            logDebug(`${tag} <- ${res.status} in ${elapsed}ms; shared pause pushed to +${waitMs}ms`);
            continue;
          }
          if (!res.ok) {
            logDebug(`${tag} <- ${res.status} (give up) in ${elapsed}ms`);
            item.resolve(item.nf && res.status === 404 ? { notFound: true } : null);
            return;
          }
          const data = item.wantJson ? await res.json() : res;
          logDebug(`${tag} <- ${res.status} in ${elapsed}ms`);
          item.resolve(data);
          return;
        } catch (e) {
          const elapsed = Date.now() - t0;
          const isTimeout = e?.name === "AbortError";
          const reason = isTimeout ? `timed out after ${REQUEST_TIMEOUT_MS}ms` : `${e?.message || e}`;
          if (isTimeout) {
            _rateLimited++;
            const waitMs = Math.min(1e3 * Math.pow(2, attempt), 8e3);
            _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
            logDebug(`${tag} threw in ${elapsed}ms: ${reason}; shared pause pushed to +${waitMs}ms`);
          } else {
            logDebug(`${tag} threw in ${elapsed}ms: ${reason}`);
          }
          if (attempt === item.retries) {
            item.resolve(null);
            return;
          }
          await new Promise((r) => setTimeout(r, 500));
        } finally {
          clearTimeout(timer);
        }
      }
      item.resolve(null);
    }
    function _enqueue(url, retries, wantJson, nf = false) {
      return new Promise((resolve) => {
        _queue.push({ url, retries, wantJson, nf, resolve });
        _drain();
      });
    }
    return {
      fetchJson: (url, retries = 3) => _enqueue(url, retries, true),
      // Like fetchJson, but a 404 resolves `{ notFound: true }` instead of
      // null — so null unambiguously means "lookup FAILED" (#193 chip bug).
      fetchJson404: (url, retries = 3) => _enqueue(url, retries, true, true),
      fetchRaw: (url, retries = 3) => _enqueue(url, retries, false),
      stats: () => ({
        total: _totalRequests,
        rateLimited: _rateLimited,
        inFlight: _running,
        queued: _queue.length
      })
    };
  })();
  async function fetchWithRetry(url, retries = 4) {
    return mbThrottle.fetchJson(url, retries);
  }
  var _relTypeCache = /* @__PURE__ */ new Map();
  async function fetchArtistRelTypes(mbid) {
    if (!mbid) return null;
    if (_relTypeCache.has(mbid)) return _relTypeCache.get(mbid);
    const json = await mbThrottle.fetchJson(
      `//musicbrainz.org/ws/2/artist/${mbid}?inc=recording-rels+release-rels+release-group-rels+work-rels&fmt=json&limit=100`
    );
    if (!json) return null;
    const types = [...new Set((json.relations || []).map((r) => r.type).filter(Boolean))].sort();
    _relTypeCache.set(mbid, types);
    return types;
  }
  function getSourceUrlsForRelease(mbid) {
    const url = `/ws/js/release/${mbid}?fmt=json&inc=rels`;
    return fetch(url).then((body) => body.json()).then((json) => {
      const rels = json.relationships || [];
      const abs = (u) => u && u.startsWith("//") ? "https:" + u : u;
      const href = (pred) => abs(rels.find(pred)?.target?.href_url || null);
      return {
        discogs: href((rel) => rel.target?.sidebar_name === "Discogs"),
        tidal: href((rel) => /(^|\/\/)(www\.|listen\.)?tidal\.com\/(browse\/)?album\/\d+/i.test(rel.target?.href_url || "")),
        qobuz: href((rel) => /(^|\/\/)(www\.|play\.|open\.)?qobuz\.com\/([a-z]{2}-[a-z]{2}\/)?album\//i.test(rel.target?.href_url || ""))
      };
    });
  }
  function resolveLinkTypeId(name, type0, type1) {
    const lt = pageWindow.MB?.linkedEntities?.link_type;
    if (!lt) {
      log.error("MB.linkedEntities.link_type not available");
      return null;
    }
    const needle = name.toLowerCase().trim();
    const stripAttrs = (s) => (s || "").toLowerCase().replace(/\{[^}]*\}/g, "").replace(/\s+/g, " ").trim();
    const candidates = Object.values(lt).filter(
      (v) => v.type0 === type0 && v.type1 === type1 && !v.deprecated
    );
    for (const v of candidates) {
      if ((v.name || "").toLowerCase() === needle) return v.id;
    }
    for (const v of candidates) {
      if (stripAttrs(v.link_phrase) === needle) return v.id;
      if (stripAttrs(v.reverse_link_phrase) === needle) return v.id;
    }
    const contains = candidates.filter((v) => {
      const blobs = [v.name, stripAttrs(v.link_phrase), stripAttrs(v.reverse_link_phrase)].filter(Boolean);
      return blobs.some((b) => b.includes(needle) || needle.includes(b));
    });
    if (contains.length > 0) {
      contains.sort((a, b) => ((a.name || "").length || 999) - ((b.name || "").length || 999));
      const best = contains[0];
      if ((best.name || "").toLowerCase() !== needle) {
        log.info(`Fuzzy match: "${name}" \u2192 "${best.name}" (${type0}\u2192${type1})`);
      }
      return best.id;
    }
    const availableNames = candidates.map((v) => v.name).filter(Boolean).sort().join(", ");
    const allByName = Object.values(lt).filter(
      (v) => (v.name || "").toLowerCase() === needle || stripAttrs(v.link_phrase) === needle || stripAttrs(v.reverse_link_phrase) === needle
    );
    const deprecatedHit = allByName.find((v) => v.type0 === type0 && v.type1 === type1 && v.deprecated);
    const wrongPairHits = allByName.filter((v) => !(v.type0 === type0 && v.type1 === type1));
    if (deprecatedHit) {
      const altPairs = [...new Set(allByName.filter((v) => !v.deprecated).map((v) => `${v.type0}\u2192${v.type1}`))].join(", ");
      log.error(`"${name}" (${type0}\u2192${type1}) is deprecated by MB and would block the commit \u2014 skipping${altPairs ? `. Valid alternative(s): ${altPairs}` : ""}.`);
    } else if (wrongPairHits.length > 0) {
      const hitDesc = wrongPairHits.map((v) => `${v.name}(${v.type0}\u2192${v.type1})`).join(", ");
      log.warn(`No "${name}" link type for (${type0}\u2192${type1}) \u2014 exists for other entity pairs: ${hitDesc} \u2014 skipping`);
    } else {
      log.warn(`Unknown link type "${name}" (${type0}\u2192${type1}). Available for this pair: ${availableNames || "none"}`);
    }
    return null;
  }

  // src/storage.js
  var DB_NAME = "mblink";
  var DB_VERSION = 2;
  var STORE = "entity_cache";
  var db = null;
  var _request = indexedDB.open(DB_NAME, DB_VERSION);
  _request.onerror = function() {
    console.error("Why didn't you allow my web app to use IndexedDB?!");
  };
  _request.onsuccess = function(event) {
    db = event.target.result;
  };
  _request.onupgradeneeded = function(event) {
    const upgradeDb = event.target.result;
    if (!upgradeDb.objectStoreNames.contains(STORE)) {
      upgradeDb.createObjectStore(STORE, { keyPath: "discogs_id" });
    }
  };
  function mbUrlOf(entityType, mbid) {
    return `//musicbrainz.org/${entityType}/${mbid}`;
  }
  function readIdbRecord(key) {
    return new Promise((resolve) => {
      if (!key || !db) return resolve(null);
      try {
        const tx = db.transaction([STORE], "readonly");
        const req = tx.objectStore(STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  function writeIdbRecord(key, partial) {
    return new Promise((resolve) => {
      if (!key || !db) return resolve(null);
      try {
        const tx = db.transaction([STORE], "readwrite");
        const store = tx.objectStore(STORE);
        const getReq = store.get(key);
        getReq.onsuccess = () => {
          const existing = getReq.result || {};
          const merged = { ...existing, ...partial, discogs_id: key, resolvedAt: (/* @__PURE__ */ new Date()).toISOString() };
          if (merged.mbid && merged.entityType && !partial.mbUrl) {
            merged.mbUrl = mbUrlOf(merged.entityType, merged.mbid);
          }
          const putReq = store.put(merged);
          putReq.onsuccess = () => resolve(merged);
          putReq.onerror = () => resolve(null);
        };
        getReq.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  function deleteIdbRecord(key) {
    return new Promise((resolve) => {
      if (!key || !db) return resolve(false);
      try {
        const tx = db.transaction([STORE], "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // src/progress-bar.js
  var _pInterval = null;
  var _pPos = -40;
  function _showBar() {
    const row1 = document.querySelector(".discogs-bar-row1");
    const row2 = document.querySelector(".discogs-bar-row2");
    const r1h = row1 ? row1.getBoundingClientRect().height : 42;
    let pb = document.getElementById("discogs-pb");
    if (!pb) {
      pb = document.createElement("div");
      pb.id = "discogs-pb";
      pb.style.cssText = "position:fixed;left:0;right:0;height:5px;z-index:99999;background:#ddd;overflow:hidden;";
      const fill = document.createElement("div");
      fill.id = "discogs-pb-fill";
      fill.style.cssText = "position:absolute;top:0;height:100%;width:40%;background:#e8771d;transition:width 0.2s linear;";
      pb.appendChild(fill);
      document.body.appendChild(pb);
    }
    pb.style.top = r1h + "px";
    pb.style.display = "block";
    if (row2) row2.style.marginTop = r1h + 5 + "px";
    _startMarquee();
  }
  function _startMarquee() {
    clearInterval(_pInterval);
    const fill = document.getElementById("discogs-pb-fill");
    if (fill) {
      fill.style.width = "40%";
      fill.style.left = _pPos + "%";
      fill.style.transition = "";
    }
    _pPos = -40;
    _pInterval = setInterval(() => {
      _pPos += 1.5;
      if (_pPos > 100) _pPos = -40;
      const f = document.getElementById("discogs-pb-fill");
      if (f) f.style.left = _pPos + "%";
    }, 16);
  }
  function _setProgressPct(pct) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    clearInterval(_pInterval);
    _pInterval = null;
    const pctEl = document.getElementById("discogs-progress-pct");
    if (pctEl) pctEl.textContent = Math.round(p) + "%";
    const fill = document.getElementById("discogs-pb-fill");
    if (!fill) return;
    fill.style.left = "0";
    fill.style.transition = "width 0.2s linear";
    fill.style.width = p + "%";
  }
  function _hideBar() {
    clearInterval(_pInterval);
    _pInterval = null;
    const pb = document.getElementById("discogs-pb");
    if (pb) pb.style.display = "none";
    const row2 = document.querySelector(".discogs-bar-row2");
    if (row2) row2.style.marginTop = "";
  }

  // src/api-discogs.js
  var DISCOGS_URL_RE = /^https?:\/\/(?:www|api)\.discogs\.com\/(?:(?:(?!sell).+|sell.+)\/)?(master|release|artist|label)s?\/(\d+)(?:[^?#]*)(?:\?noanv=1|\?anv=[^=]+)?$/i;
  function parseDiscogsUrl(url) {
    const m = DISCOGS_URL_RE.exec(url);
    if (!m) return null;
    const type = m[1];
    const id = m[2];
    return {
      type,
      id,
      key: `${type}/${id}`,
      cleanUrl: `https://www.discogs.com/${type}/${id}`
    };
  }
  var _releaseDataCache = /* @__PURE__ */ new Map();
  function getDiscogsReleaseData(url) {
    if (_releaseDataCache.has(url)) return Promise.resolve(_releaseDataCache.get(url));
    return fetch(
      `${url.replace(
        "https://www.discogs.com/release/",
        "https://api.discogs.com/releases/"
      )}?token=gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ`
    ).then((body) => body.json()).then((json) => {
      _releaseDataCache.set(url, json);
      return json;
    });
  }
  var _entityDataCache = /* @__PURE__ */ new Map();
  function getDiscogsEntityData(resourceUrl) {
    if (!resourceUrl) return Promise.resolve(null);
    if (_entityDataCache.has(resourceUrl)) return Promise.resolve(_entityDataCache.get(resourceUrl));
    return fetch(`${resourceUrl}?token=gYAnSAmIoXiHezHBmHoqcBCuJRyQLJBYSjurbGTZ`).then((r) => r.ok ? r.json() : null).then((json) => {
      if (!json) {
        _entityDataCache.set(resourceUrl, null);
        return null;
      }
      const slim = {
        profile: json.profile || "",
        name: json.name || "",
        namevariations: json.namevariations || [],
        realname: json.realname || ""
      };
      _entityDataCache.set(resourceUrl, slim);
      return slim;
    }).catch(() => null);
  }

  // src/data/entity-map.js
  var ENTITY_TYPE_MAP = {
    // Places
    "Arranged At": {
      entityType: "place",
      linkType: "arranged at"
    },
    "Engineered At": {
      entityType: "place",
      linkType: "engineered at"
    },
    "Recorded At": {
      entityType: "place",
      linkType: "recorded at"
    },
    "Mixed At": {
      entityType: "place",
      linkType: "mixed at"
    },
    "Mastered At": {
      entityType: "place",
      linkType: "mastered at"
    },
    "Lacquer Cut At": {
      entityType: "place",
      linkType: "lacquer cut at"
    },
    "edited At": {
      entityType: "place",
      linkType: "edited at"
    },
    "Remixed At": {
      entityType: "place",
      linkType: "remixed at"
    },
    "Produced At": {
      entityType: "place",
      linkType: "produced at"
    },
    "Overdubbed At": null,
    "manufactured At": {
      entityType: "place",
      linkType: "manufactured at"
    },
    "Glass Mastered At": {
      entityType: "place",
      linkType: "glass mastered at"
    },
    "Pressed At": {
      entityType: "place",
      linkType: "pressed at"
    },
    "Designed At": null,
    "Filmed At": null,
    "Exclusive Retailer": null,
    // labels
    "Copyright (c)": {
      entityType: "label",
      linkType: "copyright"
    },
    "Phonographic Copyright (p)": {
      entityType: "label",
      linkType: "phonographic copyright"
    },
    "Copyright \xA9": {
      entityType: "label",
      linkType: "copyright"
    },
    "Phonographic Copyright \u2117": {
      entityType: "label",
      linkType: "phonographic copyright"
    },
    "Licensed From": {
      entityType: "label",
      linkType: "licensor"
    },
    "Licensed To": {
      entityType: "label",
      linkType: "licensee"
    },
    "Licensed Through": null,
    "Distributed By": {
      entityType: "label",
      linkType: "distributed"
    },
    "Made By": {
      entityType: "label",
      linkType: "manufactured"
    },
    "Manufactured By": {
      entityType: "label",
      linkType: "manufactured"
    },
    "Glass Mastered By": {
      entityType: "label",
      linkType: "glass mastered"
    },
    "Pressed By": {
      entityType: "label",
      linkType: "pressed"
    },
    "Marketed By": {
      entityType: "label",
      linkType: "marketed"
    },
    "Printed By": {
      entityType: "label",
      linkType: "printed"
    },
    "Promoted By": {
      entityType: "label",
      linkType: "promoted"
    },
    "Published By": {
      entityType: "label",
      linkType: "published"
    },
    "Rights Society": {
      entityType: "label",
      linkType: "rights society"
    },
    "Arranged For": {
      entityType: "label",
      linkType: "arranged for"
    },
    "Manufactured For": {
      entityType: "label",
      linkType: "manufactured for"
    },
    "Mixed For": {
      entityType: "label",
      linkType: "mixed for"
    },
    "Produced For": {
      entityType: "label",
      linkType: "produced for"
    },
    "Miscellaneous Support": {
      entityType: "label",
      linkType: "misc"
    },
    "Exported By": null,
    // Artists
    Performer: {
      entityType: "artist",
      linkType: "performer"
    },
    // Discogs role "Accompanied By" → MB has no dedicated link type or
    // attribute for this. Closest semantic fit is `performer` with the
    // `additional` attribute (used elsewhere in MB for non-primary
    // contributions). Previously this fell through to the INSTRUMENTS map
    // and was dispatched as a bare `instrument` rel with the bogus
    // attribute value "accompanied by" — which MB silently drops, leaving
    // a junk instrument rel with no instrument named.
    "Accompanied By": {
      entityType: "artist",
      linkType: "performer",
      attributes: ["additional"]
    },
    Instruments: {
      entityType: "artist",
      linkType: "instrument"
    },
    Vocals: {
      entityType: "artist",
      linkType: "vocal"
    },
    "Backing Vocals": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "background vocals" }]
    },
    Choir: {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "choir vocals" }]
    },
    Chorus: {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "choir vocals" }]
    },
    "Choir Vocals": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "choir vocals" }]
    },
    "Lead Vocals": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "lead vocals" }]
    },
    Orchestra: {
      entityType: "artist",
      linkType: "orchestra"
    },
    Conductor: {
      entityType: "artist",
      linkType: "conductor"
    },
    "Chorus Master": {
      entityType: "artist",
      linkType: "chorus master"
    },
    Concertmaster: {
      entityType: "artist",
      linkType: "concertmaster"
    },
    Concertmistress: {
      entityType: "artist",
      linkType: "concertmaster"
    },
    "Compiled By": {
      entityType: "artist",
      linkType: "compiler"
    },
    "DJ Mix": {
      entityType: "artist",
      linkType: "DJ-mixer"
    },
    Remix: {
      entityType: "artist",
      linkType: "remixer"
    },
    "contains samples by": {
      entityType: "artist",
      linkType: "contains samples by"
    },
    "Written-By": {
      entityType: "artist",
      linkType: "writer"
    },
    "Written By": {
      entityType: "artist",
      linkType: "writer"
    },
    "Composed By": {
      entityType: "artist",
      linkType: "composer"
    },
    // #233: author of the source text (e.g. the novel a Hörspiel adapts). MB
    // 'writer' is a work-level rel, so this lands on the work CH creates.
    Author: {
      entityType: "artist",
      linkType: "writer"
    },
    // #233: spoken-word performer (audio play / Hörspiel cast). MB convention is
    // the 'vocal' relationship with the 'spoken vocals' attribute; the character
    // in the Discogs bracket becomes the credited-as (handled in mappers.js).
    "Voice Actor": {
      entityType: "artist",
      linkType: "vocal",
      attributes: [{ _type: "vocal", value: "spoken vocals" }]
    },
    "Words By": {
      entityType: "artist",
      linkType: "lyricist"
    },
    "Lyrics By": {
      entityType: "artist",
      linkType: "lyricist"
    },
    "Libretto By": {
      entityType: "artist",
      linkType: "librettist"
    },
    "Translated By": {
      entityType: "artist",
      linkType: "translator"
    },
    "Arranged By": {
      entityType: "artist",
      linkType: "arranger"
    },
    "Instrumentation By": {
      entityType: "artist",
      linkType: "instruments arranger"
    },
    "Orchestrated By": {
      entityType: "artist",
      linkType: "orchestrator"
    },
    "vocals arranger": {
      entityType: "artist",
      linkType: "vocals arranger"
    },
    Producer: {
      entityType: "artist",
      linkType: "producer"
    },
    "Co-producer": {
      entityType: "artist",
      linkType: "producer",
      // MB has no `co` attribute. The convention for "Co-X" is `additional`
      // on the base role (issue #3). See also the matching remap in
      // `getArtistRoles` for the regex /Co /.
      attributes: ["additional"]
    },
    "Executive-Producer": {
      entityType: "artist",
      linkType: "producer",
      attributes: ["executive"]
    },
    "Post Production": {
      entityType: "artist",
      linkType: "producer"
    },
    Engineer: {
      entityType: "artist",
      linkType: "engineer"
    },
    "Audio Engineer": {
      entityType: "artist",
      linkType: "audio engineer"
    },
    "Mastered By": {
      entityType: "artist",
      linkType: "mastering"
    },
    "Remastered By": {
      entityType: "artist",
      linkType: "mastering",
      attributes: ["re"]
    },
    "Lacquer Cut By": {
      entityType: "artist",
      linkType: "lacquer cut"
    },
    "sound engineer": {
      entityType: "artist",
      linkType: "sound engineer"
    },
    "Mixed By": {
      entityType: "artist",
      linkType: "mix"
    },
    "Recorded By": {
      entityType: "artist",
      linkType: "recording"
    },
    "Recording Engineer": {
      entityType: "artist",
      linkType: "recording"
    },
    "Programmed By": {
      entityType: "artist",
      linkType: "programming"
    },
    Editor: {
      entityType: "artist",
      linkType: "editor"
    },
    "Edited By": {
      entityType: "artist",
      linkType: "editor"
    },
    "balance engineer": {
      entityType: "artist",
      linkType: "engineer"
    },
    "copyrighted by": {
      entityType: "artist",
      linkType: "copyright"
    },
    "phonographic copyright by": {
      entityType: "artist",
      linkType: "phonographic copyright"
    },
    Legal: {
      entityType: "artist",
      linkType: "legal representation"
    },
    Booking: {
      entityType: "artist",
      linkType: "booking"
    },
    "Art Direction": {
      entityType: "artist",
      linkType: "art direction"
    },
    Artwork: {
      entityType: "artist",
      linkType: "artwork"
    },
    "Artwork By": {
      entityType: "artist",
      linkType: "artwork"
    },
    Cover: {
      entityType: "artist",
      linkType: "artwork"
    },
    Design: {
      entityType: "artist",
      linkType: "design"
    },
    "Graphic Design": {
      entityType: "artist",
      linkType: "graphic design"
    },
    Illustration: {
      entityType: "artist",
      linkType: "illustration"
    },
    "Booklet Editor": {
      entityType: "artist",
      linkType: "booklet editor"
    },
    Photography: {
      entityType: "artist",
      linkType: "photography"
    },
    "Photography By": {
      entityType: "artist",
      linkType: "photography"
    },
    Technician: {
      entityType: "artist",
      // MB's link type is singular ("instrument technician"). The plural
      // form here missed the exact-name match in resolveLinkTypeId, so the
      // fuzzy contains-match collapsed "instruments technician" down to the
      // bare "instrument" performance link type — turning a piano tuner /
      // tech credit into an instrument performer. #155
      linkType: "instrument technician"
    },
    publisher: {
      entityType: "artist",
      linkType: "published"
    },
    "Liner Notes": {
      entityType: "artist",
      linkType: "liner notes"
    },
    "A&R": {
      entityType: "artist",
      linkType: "misc"
    },
    Advisor: {
      entityType: "artist",
      linkType: "misc"
    },
    "Concept By": {
      entityType: "artist",
      linkType: "misc"
    },
    Contractor: {
      entityType: "artist",
      linkType: "misc"
    },
    Coordinator: {
      entityType: "artist",
      linkType: "misc"
    },
    Management: {
      entityType: "artist",
      linkType: "misc"
    },
    "Musical Assistance": {
      entityType: "artist",
      linkType: "misc"
    },
    "Tour Manager": {
      entityType: "artist",
      linkType: "misc"
    },
    Other: {
      entityType: "artist",
      linkType: "misc"
    },
    "Public Relations": {
      entityType: "artist",
      linkType: "misc"
    },
    Promotion: {
      entityType: "artist",
      linkType: "misc"
    },
    Crew: {
      entityType: "artist",
      linkType: "misc"
    },
    "Supervised By": {
      entityType: "artist",
      linkType: "misc"
    },
    "Director Of Photography": {
      entityType: "artist",
      linkType: "photography",
      attributes: [{ _type: "task", value: "director of photography" }]
    }
  };

  // src/data/instruments.js
  var INSTRUMENTS = {
    Afox\u00E9: "afox\xE9",
    Agog\u00F4: "agog\xF4",
    Ashiko: "ashiko",
    Atabal: null,
    Bapang: "bhapang",
    "Clarinet": "clarinet",
    "Percussion": "percussion",
    "Congas": "congas",
    "Conga": "congas",
    "Conga Drum": "congas",
    "Bongos": "bongos",
    "Bongo": "bongos",
    "Tambourine": "tambourine",
    "Cuica": "cu\xEDca",
    "Guiro": "g\xFCiro",
    "G\xFCiro": "g\xFCiro",
    "Udu": "udu",
    "La\xFAd": "la\xFAd",
    "Laud": "la\xFAd",
    "Mbira": "mbira",
    "Kalimba": "mbira",
    "Slide Guitar": "slide guitar",
    "Acoustic Guitar": "acoustic guitar",
    "Double Bass": "double bass",
    "Goblet Drum": "goblet drum",
    "Maracas": "maracas",
    "Steel Drum": "steelpan",
    "Steelpan": "steelpan",
    "Electronics": "electronics",
    "Electronic": "electronics",
    "Synth Bass": "bass synthesizer",
    "Vocoder": "vocoder",
    "Xylophone": "xylophone",
    "Bells": "bells",
    "Chimes": "wind chimes",
    "Glockenspiel": "glockenspiel",
    "Shakers": "shaker",
    "Shaker": "shaker",
    "Cowbell": "cowbell",
    "Claves": "claves",
    "Timbales": "timbales",
    "Baritone Guitar": "baritone guitar",
    "Synth": "synthesizer",
    "Synthesizer": "synthesizer",
    "Synths": "synthesizer",
    "Keyboards": "keyboard",
    "Keyboard": "keyboard",
    "Organ": "organ",
    "Harmonium": "harmonium",
    "Piano": "piano",
    "Electric Piano": "electric piano",
    "Harpsichord": "harpsichord",
    "Celesta": "celesta",
    "Strings": "string instruments",
    "Flute": "flute",
    "Saxophone": "saxophone",
    "Vibraphone": "vibraphone",
    "Trumpet": "trumpet",
    "Trombone": "trombone",
    "Violin": "violin",
    "Cello": "cello",
    "Viola": "viola",
    "Harp": "harp",
    "Banjo": "banjo",
    "Mandolin": "mandolin",
    "Ukulele": "ukulele",
    "Harmonica": "harmonica",
    "Accordion": "accordion",
    "Oboe": "oboe",
    "Bassoon": "bassoon",
    "Tuba": "tuba",
    "French Horn": "French horn",
    "Marimba": "marimba",
    "Melodica": "melodica",
    "Sitar": "sitar",
    "Oud": "oud",
    "Kora": "kora",
    "Tabla": "tabla",
    "Didgeridoo": "didgeridoo",
    "Theremin": "theremin",
    "Flugelhorn": "flugelhorn",
    "Cornet": "cornet",
    "Alto Saxophone": "alto saxophone",
    "Tenor Saxophone": "tenor saxophone",
    "Soprano Saxophone": "soprano saxophone",
    "Baritone Saxophone": "baritone saxophone",
    "Bass Clarinet": "bass clarinet",
    "Bass Flute": "bass flute",
    "Piccolo": "piccolo",
    "Bass Drum": "bass drum",
    Bata: "bat\xE1 drum",
    "Bell Tree": "bell tree",
    Bendir: "bendir",
    Bodhr\u00E1n: "bodhr\xE1n",
    "Body Percussion": "body percussion",
    Bombo: null,
    Bones: "bones",
    Buhay: null,
    Buk: "buk",
    Cabasa: "cabasa",
    Caixa: "caixa",
    "Caja Vallenata": null,
    Caj\u00F3n: "caj\xF3n",
    Calabash: "calabash",
    Castanets: "castanets",
    Caxixi: "caxixi",
    "Chak'chas": null,
    Chinch\u00EDn: null,
    Ching: "ching",
    Cymbal: "cymbal",
    Daf: "daf",
    Davul: "davul",
    Dhol: "dhol",
    Dholak: "dholak",
    Djembe: "djembe",
    Doira: null,
    Doli: null,
    Drum: "drum set",
    "Drum Programming": null,
    Drums: "drum set",
    Dunun: "dunun",
    "Electronic Drums": null,
    "Finger Cymbals": "finger cymbals",
    "Finger Snaps": "finger snaps",
    "Frame Drum": "frame drum",
    "Friction Drum": "friction drum",
    Frottoir: "frottoir",
    Ganz\u00E1: "ganz\xE1",
    Ghatam: "ghatam",
    Ghungroo: null,
    Gong: "gong",
    Guacharaca: null,
    Handbell: "handbell",
    Handclaps: "handclaps",
    "Hang Drum": "handpan",
    Hihat: "hi-hat",
    Hosho: null,
    Hyoshigi: "hyoshigi",
    Idiophone: "idiophone",
    Jaggo: null,
    Janggu: "janggu",
    Jing: "jing",
    "K'kwaengwari": null,
    Ka: null,
    "Kagura Suzu": null,
    Kanjira: "kanjira",
    Karkabas: null,
    Khartal: null,
    Khurdak: "duggi",
    Kynggari: null,
    Lagerphone: "monkey stick",
    "Lion's Roar": null,
    Madal: "madal",
    Mallets: null,
    "Monkey stick": "monkey stick",
    Mridangam: "mridangam",
    Pakhavaj: "pakhawaj",
    Pandeiro: null,
    Rainstick: "rainstick",
    Ratchet: "ratchet",
    Rattle: "shaken idiophone",
    "Reco-reco": "reco-reco",
    Repinique: "repinique",
    Rototoms: null,
    Scraper: null,
    Shakubyoshi: null,
    Shekere: "shekere",
    Shuitar: null,
    "Singing Bowls": null,
    Skratjie: null,
    Slapstick: "slapstick",
    "Slit Drum": "slit drum",
    Snare: null,
    Spoons: "spoons",
    "Stomp Box": null,
    Surdo: "surdo",
    Surigane: "atarigane",
    Taiko: "taiko",
    "Talking Drum": "talking drum",
    "Tam-tam": "chau gong",
    Tambora: null,
    Tamboril: "tabor",
    Tamborim: "tamborim",
    "Tan-Tan": null,
    "Tap Dance": "tap dance",
    "Tar (Drum)": null,
    "Temple Bells": null,
    "Temple Block": null,
    Thavil: "thavil",
    Timpani: "timpani",
    "Tom Tom": "tom-tom",
    Triangle: "triangle",
    T\u00FCng\u00FCr: null,
    Vibraslap: "vibraslap",
    Washboard: "washboard",
    Waterphone: "waterphone",
    "Wood Block": "wood block",
    Zabumba: "zabumba",
    Amadinda: "amadinda",
    Angklung: "angklung",
    Balafon: "balafon",
    Boomwhacker: "boomwhacker",
    Carillon: null,
    Crotales: "crotales",
    Guitaret: "guitaret",
    Lamellophone: "lamellaphone",
    Marimbula: "mar\xEDmbula",
    Metallophone: "metallophone",
    "Musical Box": "musical box",
    Prempensua: null,
    Slagbordun: null,
    "Steel Drums": "steelpan",
    "Thumb Piano": "mbira",
    Tubaphone: null,
    "Tubular Bells": "tubular bells",
    Tun: null,
    Txalaparta: "txalaparta",
    "Baby Grand Piano": null,
    Chamberlin: "chamberlin",
    Claviorgan: "claviorganum",
    "Concert Grand Piano": null,
    Dulcitone: "dulcitone",
    "Electric Harmonium": null,
    "Electric Harpsichord": null,
    "Electric Organ": "electronic organ",
    Fortepiano: null,
    "Grand Piano": "grand piano",
    Mellotron: "mellotron",
    Omnichord: "omnichord",
    "Ondes Martenot": "ondes martenot",
    "Parlour Grand Piano": null,
    Pedalboard: null,
    "Player Piano": null,
    Regal: "regal",
    Stylophone: null,
    "Tangent Piano": "tangent piano",
    "Toy Piano": "toy piano",
    "Upright Piano": "upright piano",
    Virginal: "virginal",
    "12-String Acoustic Guitar": null,
    "12-String Bass": null,
    "5-String Banjo": null,
    "6-String Banjo": null,
    "6-String Bass": null,
    "Acoustic Bass": "acoustic bass guitar",
    // #209 — Discogs separates this from "Double Bass", which maps to upright
    "Arco Bass": null,
    Arpa: null,
    Autoharp: "autoharp",
    Baglama: null,
    "Bajo Quinto": null,
    "Bajo Sexto": "bajo sexto",
    Balalaika: "balalaika",
    Bandola: null,
    Bandura: "bandura",
    Bandurria: "bandurria",
    Banhu: "banhu",
    Banjolin: "banjolin",
    "Baroque Guitar": "baroque guitar",
    Baryton: "baryton",
    "Bass Guitar": "bass guitar",
    Berimbau: "berimbau",
    Bhapang: "bhapang",
    Biwa: "biwa",
    "Blaster Beam": "blaster beam",
    Bolon: "bolon",
    Bouzouki: "bouzouki",
    "Bulbul Tarang": "bulbul tarang",
    Byzaanchi: null,
    Cavaquinho: "cavaquinho",
    "Cello Banjo": null,
    Changi: null,
    Chanzy: "chanzy",
    "Chapman Stick": "chapman stick",
    Charango: "charango",
    Chitarrone: null,
    Chonguri: null,
    Chuniri: null,
    Cimbalom: "cimbalom",
    Citole: "citole",
    Cittern: "cittern",
    Cl\u00E0rsach: null,
    "Classical Guitar": "classical guitar",
    Clavichord: "clavichord",
    Clavinet: "clavinet",
    Cobza: null,
    Contrabass: "double bass",
    Cuatro: "cuatro",
    C\u00FCmb\u00FC\u015F: "c\xFCmb\xFC\u015F",
    Cura: null,
    Deaejeng: null,
    "Diddley Bow": "diddley bow",
    Dilruba: "dilruba",
    Dobro: "resonator guitar",
    Dojo: null,
    Dombra: "dombra",
    Domra: "domra",
    Doshpuluur: "doshpuluur",
    Dulcimer: null,
    Dutar: "dutar",
    "\u0110\xE0n b\u1EA7u": "\u0111\xE0n b\u1EA7u",
    Ektare: null,
    "Electric Bass": null,
    "Electric Guitar": "electric guitar",
    "Electric Upright Bass": "electric upright bass",
    "Electric Violin": "electric violin",
    "Epinette des Vosges": null,
    Erhu: "erhu",
    Esraj: "esraj",
    Fiddle: "fiddle",
    "Flamenco Guitar": "flamenco guitar",
    "Fretless Bass": "fretless bass",
    "Fretless Guitar": null,
    Gadulka: "gadulka",
    Gaohu: "gaohu",
    Gayageum: "gayageum",
    Geomungo: "geomungo",
    Giga: "\u0123\u012Bga",
    Gittern: "gittern",
    Gottuv\u00E2dyam: null,
    Guimbri: "gumbri",
    Guitalele: "guitalele",
    Guitar: "guitar",
    "Guitar Banjo": "banjitar",
    "Guitar Synthesizer": "guitar synthesizer",
    Guitarr\u00F3n: null,
    GuitarViol: null,
    Guqin: "guqin",
    Gusli: "gusli",
    Guzheng: "guzheng",
    Haegum: "haegeum",
    Halldorophone: null,
    Hardingfele: "hardingfele",
    "Harp Guitar": "harp guitar",
    Hummel: "hummel",
    Huqin: "huqin",
    "Hurdy Gurdy": "hurdy gurdy",
    Igil: "igil",
    Jarana: null,
    Jinghu: "jinghu",
    Jouhikko: "jouhikko",
    Kabosy: null,
    Kamancha: "kamancheh",
    Kankl\u0117s: "kankl\u0117s",
    Kantele: "kantele",
    Kanun: "kanun",
    Kemenche: "kemenche",
    Kirar: null,
    Kobyz: null,
    Kokyu: "kokyu",
    Koto: "koto",
    Krar: "krar",
    Langeleik: "langeleik",
    Laouto: "laouto",
    "Lap Steel Guitar": "lap steel guitar",
    Lavta: "lavta",
    "Lead Guitar": "guitar",
    // #209 — MB has no lead/rhythm-guitar instrument; both are just "guitar"
    Lira: null,
    "Lira da Braccio": "lira da braccio",
    Lirone: "lirone",
    Liuqin: "liuqin",
    Lute: "lute",
    Lyre: "lyre",
    Mandobass: null,
    Mandocello: "mandocello",
    Mandoguitar: "mandoguitar",
    Mandola: "mandola",
    "Mandolin Banjo": null,
    Mandolincello: null,
    Marxophone: "marxophone",
    Masinko: null,
    Monochord: null,
    Morinhoor: null,
    "Mountain Dulcimer": null,
    "Musical Bow": "musical bow",
    Ngoni: "ng\u0254ni",
    Nyckelharpa: "nyckelharpa",
    "Open-Back Banjo": null,
    Outi: "oud",
    Panduri: null,
    "Pedal Steel Guitar": "pedal steel guitar",
    "Piccolo Banjo": null,
    Pipa: "pipa",
    "Plectrum Banjo": null,
    "Portuguese Guitar": "portuguese guitar",
    Psalmodicon: null,
    Psaltery: "psaltery",
    Rabab: "rebab",
    Rabeca: "rebec",
    Rebab: "rebab",
    Rebec: "rebec",
    Reikin: null,
    "Requinto Guitar": null,
    "Resonator Banjo": null,
    "Resonator Guitar": "resonator guitar",
    "Rhythm Guitar": "guitar",
    // #209 — see Lead Guitar
    Ronroco: "ronroco",
    Ruan: "ruan",
    Sanshin: "sanshin",
    Santoor: "santoor",
    Sanxian: "sanxian",
    Sarangi: "sarangi",
    Sarod: "sarod",
    "Selmer-Maccaferri Guitar": null,
    "Semi-Acoustic Guitar": null,
    Seperewa: null,
    "Shahi Baaja": "bulbul tarang",
    Shamisen: "shamisen",
    Sintir: "gumbri",
    Spinet: "spinet",
    "Steel Guitar": "steel guitar",
    "Stroh Violin": "stroh violin",
    Strumstick: null,
    Surbahar: "surbahar",
    "Svara Mandala": null,
    Swarmandel: null,
    Sympitar: null,
    SynthAxe: null,
    Taish\u014Dgoto: "taishogoto",
    Talharpa: "talharpa",
    Tambura: "tambura",
    Tamburitza: null,
    Tapboard: null,
    "Tar (lute)": null,
    "Tenor Banjo": "tenor banjo",
    "Tenor Guitar": "tenor guitar",
    Theorbo: "theorbo",
    Timple: "tiple",
    Tiple: "tiple",
    Tipple: "tiple",
    Tonkori: "tonkori",
    Tres: "tres",
    "Tromba Marina": "tromba marina",
    "Twelve-String Guitar": null,
    Tzouras: "tzoura",
    "Ukulele Banjo": "banjo-ukulele",
    \u00DCt\u0151gardon: "\xFCt\u0151gardon",
    Valiha: "valiha",
    Veena: "saraswati veena",
    Vielle: "vielle",
    Vihuela: "vihuela",
    Viol: "viola da gamba",
    "Viola Caipira": "viola caipira",
    "Viola d'Amore": "viola d'amore",
    "Viola da Gamba": "viola da gamba",
    "Viola de Cocho": null,
    "Viola Kontra": null,
    "Viola Nordestina": null,
    "Violino Piccolo": "violino piccolo",
    Violoncello: "cello",
    Violone: "violone",
    "Washtub Bass": "washtub bass",
    Xalam: "xalam",
    "Yang T'Chin": "yangqin",
    Yanggeum: null,
    Zither: "zither",
    Zongora: null,
    Algoza: "algozey",
    Alphorn: "alphorn",
    "Alto Clarinet": "alto clarinet",
    "Alto Flute": "alto flute",
    "Alto Horn": null,
    "Alto Recorder": "treble recorder / alto recorder",
    Apito: null,
    Bagpipes: "bagpipe",
    Bandoneon: "bandone\xF3n",
    Bansuri: "bansuri",
    "Baritone Horn": "baritone horn",
    "Barrel Organ": "barrel organ",
    "Bass Harmonica": "bass harmonica",
    "Bass Saxophone": "bass saxophone",
    "Bass Trombone": "bass trombone",
    "Bass Trumpet": "bass trumpet",
    "Bass Tuba": null,
    "Basset Horn": "basset horn",
    Bawu: "bawu",
    Bayan: "bayan",
    Bellowphone: null,
    Beresta: null,
    "Blues Harp": "harmonica",
    "Bolivian Flute": null,
    Bombarde: "bombarde",
    Brass: "brass",
    "Brass Bass": null,
    Bucium: null,
    Bugle: null,
    Chalumeau: "chalumeau",
    Chanter: null,
    Charamel: null,
    Chirimia: "chirim\xEDa",
    Clarion: null,
    Claviola: "claviola",
    Comb: null,
    "Concert Flute": "concert flute",
    Concertina: null,
    Conch: "conch",
    "Contra-Alto Clarinet": null,
    "Contrabass Clarinet": "contrabass clarinet",
    "Contrabass Saxophone": "contrabass saxophone",
    Contrabassoon: "contrabassoon",
    "Cor Anglais": "cor anglais",
    Cornett: "cornett",
    Cromorne: "crumhorn",
    Crumhorn: "crumhorn",
    Daegeum: "daegeum",
    Danso: "danso",
    "Dili Tuiduk": null,
    Dizi: "dizi",
    Drone: null,
    Duduk: "duduk",
    Dulcian: "dulcian",
    Dulzaina: "dulzaina",
    "Electronic Valve Instrument": null,
    "Electronic Wind Instrument": "wind synthesizer",
    "English Horn": "cor anglais",
    Euphonium: "euphonium",
    Fife: "fife",
    Flageolet: "flageolet",
    Flugabone: null,
    Fluier: null,
    Flumpet: "flumpet",
    "Flute D'Amour": "fl\xFBte d'amour",
    Friscaletto: null,
    Fujara: "fujara",
    Galoubet: "three-hole pipe",
    Gemshorn: "gemshorn",
    Gudastviri: null,
    Harmet: null,
    Heckelphone: "heckelphone",
    Helicon: "helicon",
    Hichiriki: "hichiriki",
    "Highland Pipes": null,
    Horagai: null,
    Horn: "horn",
    Horns: null,
    Hotchiku: "hotchiku",
    "Hunting Horn": null,
    Jug: "jug",
    Kagurabue: "kagurabue",
    Kaval: "kaval",
    Kazoo: "kazoo",
    Khene: "khene",
    Kortholt: "kortholt",
    Launeddas: "launeddas",
    Limbe: "limbe",
    Liru: null,
    "Low Whistle": "low whistle",
    Lur: null,
    Lyricon: "lyricon",
    M\u00E4nkeri: null,
    Mellophone: "mellophone",
    Melodeon: null,
    Mey: null,
    Mizmar: null,
    Mizwad: "mezwed",
    Moce\u00F1o: null,
    "Mouth Organ": "mouth organ",
    Murli: null,
    Musette: null,
    Nadaswaram: "nadaswaram",
    Ney: "ney",
    "Northumbrian Pipes": "northumbrian pipes",
    "Nose Flute": "nose flute",
    "Oboe d'Amore": "oboe d'amore",
    "Oboe Da Caccia": "oboe da caccia",
    Ocarina: "ocarina",
    Ophicleide: "ophicleide",
    "Overtone Flute": null,
    Panpipes: "pan flute",
    "Piano Accordion": "piano accordion",
    "Piccolo Flute": null,
    "Piccolo Trumpet": "piccolo trumpet",
    Pipe: null,
    Piri: "piri",
    Pito: "three-hole pipe",
    Pixiephone: null,
    Quena: "quena",
    Quenacho: null,
    Quray: null,
    Rauschpfeife: "rauschpfeife",
    Recorder: "recorder",
    Reeds: "reeds",
    Rhaita: null,
    Rondador: "rondador",
    Rozhok: null,
    Ryuteki: "ryuteki",
    Sackbut: "sackbut",
    Salamuri: null,
    Sampona: "siku",
    Sarrusophone: "sarrusophone",
    Saxello: null,
    Saxhorn: null,
    Schwyzer\u00F6rgeli: "schwyzer\xF6rgeli",
    Serpent: "serpent",
    Shakuhachi: "shakuhachi",
    Shanai: "shehnai",
    Shawm: "shawm",
    Shenai: "shehnai",
    Sheng: "sheng",
    Shinobue: "shinobue",
    Sho: "sho",
    "Shruti Box": "shruti box",
    "Slide Whistle": "slide whistle",
    Smallpipes: null,
    Sodina: null,
    Sopilka: "sopilka",
    "Sopranino Saxophone": "sopranino saxophone",
    "Soprano Clarinet": "soprano clarinet",
    "Soprano Cornet": null,
    "Soprano Flute": "soprano flute",
    "Soprano Trombone": null,
    Souna: null,
    Sousaphone: "sousaphone",
    "Subcontrabass Saxophone": null,
    Suling: "suling",
    Suona: "suona",
    Taepyungso: null,
    T\u00E1rogat\u00F3: "taragot",
    "Tenor Horn": null,
    "Tenor Trombone": "tenor trombone",
    "Ti-tse": null,
    "Tin Whistle": "tin whistle",
    Tonette: "tonette",
    Txirula: "three-hole pipe",
    Txistu: "three-hole pipe",
    "Uilleann Pipes": "uilleann pipes",
    "Valve Trombone": "valve trombone",
    "Valve Trumpet": null,
    "Wagner Tuba": "wagner tuba",
    Whistle: "whistle",
    "Whistling Water Jar": "jug",
    Wind: null,
    Woodwind: "woodwind",
    Xiao: "xiao",
    Yorgaphone: null,
    Zhaleika: "zhaleika",
    Zukra: null,
    Zurna: "zurna",
    "Automatic Orchestra": null,
    Computer: null,
    "Drum Machine": "drum machine",
    "Rhythm Box": "drum machine",
    // #223 — Discogs "[Rhythm Box]" preset drum unit
    Effects: "effects",
    Groovebox: null,
    Loops: null,
    "MIDI Controller": null,
    Noises: null,
    Sampler: "sampler",
    Scratches: "turntable",
    Sequencer: null,
    "Software Instrument": null,
    Talkbox: "talkbox",
    Tannerin: null,
    Tape: "tape",
    Turntables: "turntable",
    // 'Accompanied By' deliberately NOT in INSTRUMENTS — it's a meta role,
    // not an instrument. Mapped in ENTITY_TYPE_MAP to performer + additional.
    "Audio Generator": null,
    "Backing Band": null,
    Band: null,
    // Discogs "Bass" is generic (could be bass guitar, double bass, …) but MB
    // has a generic "bass" instrument for exactly that case. Leaving it null
    // dispatched a bare instrument rel with no instrument → "Missing instrument"
    // on commit (#133). Map to MB's generic "bass".
    Bass: "bass",
    "Brass Band": null,
    Bullroarer: "bullroarer",
    "Concert Band": null,
    "E-Bow": "ebow",
    Ensemble: null,
    Gamelan: "gamelan",
    "Glass Harmonica": "glass harmonica",
    Guest: null,
    Homus: null,
    Instruments: null,
    "Jew's Harp": "mouth harp",
    Morchang: null,
    Musician: null,
    Orchestra: null,
    Performer: null,
    "Rhythm Section": null,
    Saw: null,
    Siren: null,
    Soloist: null,
    Sounds: null,
    Toy: null,
    Trautonium: "trautonium",
    "Wind Chimes": null,
    "Wobble Board": null
  };

  // src/mappers.js
  var INSTRUMENTS_CI = Object.fromEntries(
    Object.entries(INSTRUMENTS).map(([k, v]) => [k.toLowerCase(), v])
  );
  function guessSortName(name) {
    if (!name || !name.trim()) return name;
    name = name.trim();
    const articleRe = /^(the|a|an)\s+(.+)$/i;
    const honorifics = /^(dr\.?|prof\.?|sir|lady|lord|rev\.?|st\.?|dj|mc|mc\.?)\s+/i;
    const suffixRe = /^(.*?),?\s+(jr\.?|sr\.?|ii|iii|iv|v|esq\.?)$/i;
    const words = name.split(/\s+/);
    if (words.length === 1) return name;
    const articleMatch = name.match(articleRe);
    if (articleMatch) {
      const article = articleMatch[1];
      const rest = articleMatch[2];
      return `${rest}, ${article.charAt(0).toUpperCase() + article.slice(1).toLowerCase()}`;
    }
    let suffix = "";
    let baseName = name;
    const suffixMatch = name.match(suffixRe);
    if (suffixMatch) {
      baseName = suffixMatch[1].trim();
      suffix = " " + suffixMatch[2];
    }
    const baseWords = baseName.split(/\s+/);
    if (baseWords.length === 1) return name;
    const familyName = baseWords[baseWords.length - 1];
    const givenPart = baseWords.slice(0, -1).join(" ");
    return `${familyName}, ${givenPart}${suffix}`;
  }
  function flattenTracklist(tracklist) {
    if (!Array.isArray(tracklist)) return [];
    return tracklist.flatMap((t) => {
      if (t?.type_ === "index" && Array.isArray(t.sub_tracks)) {
        const parentExtra = Array.isArray(t.extraartists) ? t.extraartists : [];
        if (!parentExtra.length) return t.sub_tracks;
        return t.sub_tracks.map((st) => Object.assign({}, st, {
          extraartists: [...Array.isArray(st.extraartists) ? st.extraartists : [], ...parentExtra]
        }));
      }
      return [t];
    });
  }
  function getAllArtistTracks(tracklist, artistTracks) {
    tracklist = flattenTracklist(tracklist);
    return artistTracks.split(",").reduce((trackArray, trackNumber) => {
      if (/ to /.test(trackNumber)) {
        const parts = trackNumber.split(" to ");
        const startTrack = parts[0].trim().replace(".", "-");
        const lastTrack = parts[1].trim().replace(".", "-");
        let hasFoundStart = false, hasFoundEnd = false;
        tracklist.forEach((track) => {
          const resolvedTrackPosition = track.position.replace(".", "-");
          if (!hasFoundStart && resolvedTrackPosition === startTrack) {
            hasFoundStart = true;
            trackArray.push(track);
          } else if (hasFoundStart && !hasFoundEnd) {
            if (resolvedTrackPosition === lastTrack) {
              hasFoundEnd = true;
              trackArray.push(track);
            } else if (track.position === "") {
              hasFoundEnd = true;
            } else {
              trackArray.push(track);
            }
          }
        });
      } else {
        const track = tracklist.find((track2) => {
          return track2.position === trackNumber.trim();
        });
        if (track) {
          trackArray.push(track);
        }
      }
      return trackArray;
    }, []);
  }
  function convertPotentialDJMixers(json) {
    let djmixers = json.extraartists?.filter((artist) => artist.role === "DJ Mix") || [];
    djmixers = djmixers.map((artist) => {
      const tracks = getAllArtistTracks(json.tracklist, artist.tracks);
      const mediums = json.tracklist.reduce(
        (mediums2, track, index) => {
          if (track.type_ === "heading") {
            if (index > 0) {
              mediums2.push([]);
            }
          } else {
            mediums2[mediums2.length - 1].push(track);
          }
          return mediums2;
        },
        [[]]
      );
      tracks.forEach((t) => {
        for (let i = 0; i < mediums.length; i++) {
          mediums[i] = mediums[i].filter((track) => {
            return t.position !== track.position;
          });
        }
      });
      let mediumsDjAppearsOn = mediums.filter((medium) => medium.length === 0);
      if (mediumsDjAppearsOn.length !== mediums.length) {
        json.extraartists = json.extraartists?.filter((a) => {
          return a !== artist;
        }) || [];
        return Object.assign({}, ENTITY_TYPE_MAP["DJ Mix"], {
          artist,
          attributes: [
            () => {
              for (let j = mediums.length - 1; j >= 0; j--) {
                if (mediums[j].length === 0) {
                  $(SELECTORS.MediumsInput).click();
                  $($(SELECTORS.MediumsInputOptions).get(j)).click();
                }
              }
            }
          ]
        });
      } else if (mediumsDjAppearsOn.length === mediums.length) {
        json.extraartists = json.extraartists?.filter((a) => {
          return a !== artist;
        }) || [];
        return Object.assign({}, ENTITY_TYPE_MAP["DJ Mix"], {
          artist
        });
      }
      return null;
    }).filter((role) => role !== null);
    return djmixers;
  }
  function getArtistRoles(artist) {
    const roleStr = artist.role;
    const rawRoles = roleStr.split(",");
    if (/\([0-9]+\)/.test(artist.anv)) {
      artist.anv = artist.anv.replace(/\([0-9]+\)/, "").trim();
    }
    if (/\([0-9]+\)/.test(artist.name)) {
      artist.name = artist.name.replace(/\([0-9]+\)/, "").trim();
    }
    return rawRoles.map((role) => {
      let additionalAttributes = [];
      let creditedAs = null;
      let rolePart = role.trim().split("[");
      const actualRole = rolePart[0].trim();
      if (/Recording Engineer/.test(rolePart[1]) && actualRole === "Engineer") {
        return Object.assign({}, ENTITY_TYPE_MAP["Recording Engineer"], {
          artist
        });
      }
      if (/Mastering Engineer/.test(rolePart[1]) && actualRole === "Engineer") {
        return Object.assign({}, ENTITY_TYPE_MAP["Mastered By"], {
          artist
        });
      }
      if (/Cover Design/.test(rolePart[1]) && actualRole === "Artwork") {
        return Object.assign({}, ENTITY_TYPE_MAP["Design"], {
          artist
        });
      }
      if (/Design/.test(rolePart[1]) && actualRole === "Cover") {
        return Object.assign({}, ENTITY_TYPE_MAP["Design"], {
          artist
        });
      }
      if (/Art/.test(rolePart[1]) && actualRole === "Cover") {
        return Object.assign({}, ENTITY_TYPE_MAP["Artwork"], {
          artist
        });
      }
      if (/Additional/.test(rolePart[1])) {
        additionalAttributes.push("additional");
      }
      if (/Assistant/.test(rolePart[1])) {
        additionalAttributes.push("assistant");
      }
      if (/Co /.test(rolePart[1])) {
        additionalAttributes.push("additional");
      }
      if (/Executive/.test(rolePart[1])) {
        additionalAttributes.push("executive");
      }
      if (/Associate/.test(rolePart[1])) {
        additionalAttributes.push("associate");
      }
      if (/Guest/.test(rolePart[1])) {
        additionalAttributes.push("guest");
      }
      if (/Solo/.test(rolePart[1])) {
        additionalAttributes.push("solo");
      }
      const mapping = ENTITY_TYPE_MAP[actualRole];
      if (mapping && mapping.linkType == "misc") {
        const taskValue = rolePart[1] ? rolePart[1].replace("]", "").trim().toLowerCase() : actualRole.trim().toLowerCase();
        additionalAttributes.push({ _type: "task", value: taskValue });
      }
      if (mapping && mapping.linkType == "engineer" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "mix" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "photography" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "artwork" && rolePart[1]) {
        additionalAttributes.push({ _type: "task", value: rolePart[1].replace("]", "").trim().toLowerCase() });
      }
      if (mapping && mapping.linkType == "vocal" && rolePart[1]) {
        creditedAs = rolePart[1].replace(/]/g, "").trim() || null;
      }
      const actualRoleLc = actualRole.toLowerCase();
      if (!mapping && Object.prototype.hasOwnProperty.call(INSTRUMENTS_CI, actualRoleLc)) {
        let instrumentName = INSTRUMENTS_CI[actualRoleLc];
        let role2 = ENTITY_TYPE_MAP.Instruments;
        if (actualRoleLc === "drum programming") {
          role2 = ENTITY_TYPE_MAP["Programmed By"];
          instrumentName = INSTRUMENTS_CI["drum machine"];
        }
        if (!instrumentName && rolePart[1]) {
          const bracket = rolePart[1].replace(/]/g, "").trim();
          for (const candidate of [bracket, bracket.split(",")[0].trim()]) {
            const lc = candidate.toLowerCase();
            if (lc && Object.prototype.hasOwnProperty.call(INSTRUMENTS_CI, lc) && INSTRUMENTS_CI[lc]) {
              instrumentName = INSTRUMENTS_CI[lc];
              break;
            }
          }
        }
        return Object.assign({}, role2, {
          artist,
          attributes: instrumentName ? [{ _type: "instrument", value: instrumentName.toLowerCase() }] : []
        });
      }
      if (!mapping) {
        return null;
      }
      if (Array.isArray(mapping.attributes)) {
        let mapped = mapping.attributes;
        if (creditedAs && mapping.linkType === "vocal") {
          mapped = mapped.map((a) => a && a._type === "vocal" ? Object.assign({}, a, { creditedAs }) : a);
        }
        additionalAttributes = additionalAttributes.concat(mapped);
      }
      return Object.assign({}, mapping, {
        artist,
        attributes: additionalAttributes
      });
    }).filter((resolvedRole) => {
      return !!resolvedRole;
    });
  }
  function rolesFromDiscogsArtists(artists) {
    return artists?.reduce((rolesArr, artist) => {
      const roles = getArtistRoles(artist);
      if (Array.isArray(roles) && roles.length > 0) {
        return rolesArr.concat(roles);
      }
      return rolesArr;
    }, []) || [];
  }

  // src/sources/tidal.js
  var TIDAL_ROLE_MAP = {
    "Producer": { target: "recording", rel: "producer" },
    "Mixing Engineer": { target: "recording", rel: "mix" },
    "Recording Engineer": { target: "recording", rel: "recording" },
    "Sound Engineer": { target: "recording", rel: "sound engineer" },
    "Composer": { target: "work", rel: "composer" },
    "Lyricist": { target: "work", rel: "lyricist" },
    "Writer": { target: "work", rel: "writer" },
    "Orchestrator": { target: "work", rel: "orchestrator" },
    "Music Publisher": { target: "work", rel: "publisher" },
    "Publisher": { target: "work", rel: "publisher" }
    // Not mapped (reported, not imported): Mastering Engineer (artist→recording mastering
    // is deprecated in MB — it's release-level), Sound Editor, the Assistant * Engineer
    // variants (need an MB "assistant" attribute), and Studio Personnel (too generic).
  };
  var TIDAL_COPYRIGHT_CONTROL_ID = "15780";
  var isCopyrightControl = (n) => n?.tidalId === TIDAL_COPYRIGHT_CONTROL_ID || /^copyright control$/i.test(n?.name || "");
  var TIDAL_RELEASE_ROLE_MAP = {
    "Mixing": "Mixed By",
    "Mixing Engineer": "Mixed By",
    "Recording": "Recorded By",
    "Recording Engineer": "Recorded By",
    "Sound Engineer": "sound engineer",
    "Mastering": "Mastered By",
    "Mastering Engineer": "Mastered By",
    "Vocals (Background)": "Backing Vocals",
    "Background Vocals": "Backing Vocals",
    "Composer": "Composed By",
    "Lyricist": "Lyrics By",
    "Writer": "Written-By",
    "Orchestrator": "Orchestrated By"
  };
  var TIDAL_RELEASE_COMPANY_MAP = {
    "Current Distributor": "Distributed By",
    "Distributor": "Distributed By"
  };
  var TIDAL_RELEASE_ROLE_SKIP = /* @__PURE__ */ new Set([
    "Primary Artist",
    "Featured Artist",
    "Main Artist",
    "Artist",
    "Record Label",
    "Manufacturer",
    "Copyright",
    "Phonographic Copyright"
  ]);
  var TIDAL_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?album\/(\d+)/i;
  function parseTidalAlbumUrl(url) {
    const m = TIDAL_ALBUM_RE.exec(url || "");
    if (!m) return null;
    return { id: m[1], creditsUrl: `https://tidal.com/album/${m[1]}/credits` };
  }
  function extractTidalCreditsDom(doc) {
    const out = [];
    for (const item of doc.querySelectorAll('[data-test="album-info-item"]')) {
      const num = item.querySelector('[class*="_trackNumber"]')?.textContent?.trim() || "";
      const titleEl = item.querySelector('[class*="_title_"]');
      const credits = [];
      for (const cell of item.querySelectorAll('[class*="_creditsCell"]')) {
        const role = cell.querySelector("[data-uppercase]")?.textContent?.trim();
        if (!role) continue;
        const names = [...cell.querySelectorAll('[data-test="grid-item-detail-text-title-artist"]')].map((el) => ({
          name: el.getAttribute("title") || el.textContent.trim(),
          tidalId: (el.getAttribute("href") || "").match(/\/artist\/(\d+)/)?.[1] || null
        })).filter((n) => n.name);
        credits.push({ role, names });
      }
      out.push({
        num,
        title: titleEl?.getAttribute("title") || titleEl?.textContent?.trim() || "",
        tidalTrackId: titleEl?.getAttribute("data-test-id") || null,
        credits
      });
    }
    return out;
  }
  function extractTidalReleaseCreditsDom(doc) {
    const out = [];
    for (const cell of doc.querySelectorAll('[class*="_creditsCell"]')) {
      if (cell.closest('[data-test="album-info-item"]')) continue;
      const role = cell.querySelector("[data-uppercase]")?.textContent?.trim();
      if (!role) continue;
      const names = [];
      const seen = /* @__PURE__ */ new Set();
      const textBox = cell.querySelector('[class*="_creditsCellText"]') || cell;
      for (const el of textBox.querySelectorAll("a, [title]")) {
        const name = (el.getAttribute("title") || el.textContent || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        names.push({ name, tidalId: (el.getAttribute("href") || "").match(/\/artist\/(\d+)/)?.[1] || null });
      }
      if (!names.length) {
        (textBox.textContent || "").split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean).forEach((name) => {
          if (!seen.has(name)) {
            seen.add(name);
            names.push({ name, tidalId: null });
          }
        });
      }
      if (names.length) out.push({ role, names });
    }
    return out;
  }
  var ASSISTANT_RE = /^Assistant\s+(.+)$/i;
  function tidalRoleBase(role) {
    const m = ASSISTANT_RE.exec(role || "");
    return m ? m[1] : role;
  }
  function filterTidalCredits(tracks) {
    return tracks.map((t) => ({
      ...t,
      credits: t.credits.filter((c) => TIDAL_ROLE_MAP[tidalRoleBase(c.role)]).map((c) => ({
        ...c,
        names: c.names.filter((n) => !(/^(?:Music )?Publisher$/.test(c.role) && isCopyrightControl(n)))
      })).filter((c) => c.names.length)
    }));
  }
  var TIDAL_ARTIST_RE = /^(?:https?:)?\/\/(?:www\.|listen\.)?tidal\.com\/(?:browse\/)?artist\/(\d+)/i;
  function parseTidalArtistUrl(url) {
    const m = TIDAL_ARTIST_RE.exec(url || "");
    if (!m) return null;
    return { id: m[1], key: `tidal-artist/${m[1]}`, cleanUrl: `https://tidal.com/artist/${m[1]}` };
  }
  function tidalPublisherRole(name, track) {
    const role = {
      linkType: "publishing",
      entityType: "label",
      attributes: [],
      artist: { name, anv: "", entityType: "label", resource_url: "" }
    };
    if (track) role.track = track;
    return role;
  }
  function tidalCompany(name, entityTypeName) {
    return {
      entity_type_name: entityTypeName,
      name,
      resource_url: "https://tidal.com/_company/" + encodeURIComponent(entityTypeName) + "/" + encodeURIComponent(name)
    };
  }
  function tidalToEngine(tracks) {
    const IMPORT_ROLES = {
      "Producer": "producer",
      "Mixing Engineer": "mix",
      "Recording Engineer": "recording",
      "Sound Engineer": "sound engineer",
      "Composer": "composer",
      "Lyricist": "lyricist",
      "Writer": "writer",
      "Orchestrator": "orchestrator"
    };
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    const seenPositions = /* @__PURE__ */ new Set();
    let multiVolume = false;
    for (const t of filterTidalCredits(tracks)) {
      const position = String(t.num || "").trim();
      if (seenPositions.has(position)) multiVolume = true;
      seenPositions.add(position);
      const track = { position, title: t.title || "", type_: "track" };
      tracklist.push(track);
      for (const c of t.credits) {
        const base = tidalRoleBase(c.role);
        const assistant = base !== c.role;
        if (base === "Music Publisher" || base === "Publisher") {
          for (const n of c.names) {
            if (isCopyrightControl(n)) continue;
            tracklistRels.push(tidalPublisherRole(n.name, track));
          }
          continue;
        }
        const linkType = IMPORT_ROLES[base];
        for (const n of c.names) {
          if (!linkType) {
            skipped.push(`track ${position} "${t.title}": ${c.role} \u2014 ${n.name}`);
            continue;
          }
          tracklistRels.push({
            linkType,
            entityType: "artist",
            attributes: assistant ? ["assistant"] : [],
            artist: {
              id: n.tidalId ? `tidal-${n.tidalId}` : void 0,
              name: n.name,
              anv: "",
              resource_url: n.tidalId ? `https://tidal.com/artist/${n.tidalId}` : ""
            },
            track
          });
        }
      }
    }
    return { tracklistRels, tracklist, skipped, multiVolume };
  }
  function tidalReleaseArtists(releaseCredits) {
    const artists = [];
    const publishers = [];
    const companies = [];
    const skipped = [];
    for (const c of releaseCredits || []) {
      const baseRole = tidalRoleBase(c.role);
      if (baseRole === "Music Publisher" || baseRole === "Publisher") {
        for (const n of c.names || []) {
          if (isCopyrightControl(n)) continue;
          publishers.push(tidalPublisherRole(n.name));
        }
        continue;
      }
      if (TIDAL_RELEASE_COMPANY_MAP[c.role]) {
        for (const n of c.names || []) companies.push(tidalCompany(n.name, TIDAL_RELEASE_COMPANY_MAP[c.role]));
        continue;
      }
      if (TIDAL_RELEASE_ROLE_SKIP.has(c.role)) {
        (c.names || []).forEach((n) => skipped.push(`release: ${c.role} \u2014 ${n.name}`));
        continue;
      }
      const base = tidalRoleBase(c.role);
      const assistant = base !== c.role;
      const discogsRole = TIDAL_RELEASE_ROLE_MAP[base] || base;
      for (const n of c.names || []) {
        artists.push({
          id: n.tidalId ? `tidal-${n.tidalId}` : void 0,
          name: n.name,
          anv: "",
          role: discogsRole,
          assistant,
          tidalRole: c.role,
          // for "not imported" reporting at the call site
          resource_url: n.tidalId ? `https://tidal.com/artist/${n.tidalId}` : ""
        });
      }
    }
    return { artists, publishers, companies, skipped };
  }
  var HARVEST_KEY = (reqId) => `ch-tidal-result:${reqId}`;
  var HARVEST_TIMEOUT_MS = 45e3;
  function runTidalHarvestPage() {
    const m = location.hash.match(/ch-req=([a-z0-9.-]+)/i);
    if (!m) return;
    const reqId = m[1];
    const albumId = (location.pathname.match(/\/album\/(\d+)/) || [])[1] || null;
    const post = (payload) => {
      try {
        GM_setValue(HARVEST_KEY(reqId), { albumId, ts: Date.now(), ...payload });
      } catch (e) {
      }
    };
    const started = Date.now();
    let lastCount = -1, stableSince = 0;
    const timer = setInterval(() => {
      const items = document.querySelectorAll('[data-test="album-info-item"]');
      if (items.length > 0) {
        if (items.length !== lastCount) {
          lastCount = items.length;
          stableSince = Date.now();
        } else if (Date.now() - stableSince > 1200) {
          clearInterval(timer);
          const tracks = extractTidalCreditsDom(document);
          harvestReleaseThenPost(tracks, post);
          return;
        }
      }
      if (Date.now() - started > HARVEST_TIMEOUT_MS - 5e3) {
        clearInterval(timer);
        post({ ok: false, error: lastCount > 0 ? "render never stabilised" : "credits never rendered (login wall? geo block?)" });
        setTimeout(() => window.close(), 250);
      }
    }, 300);
  }
  function harvestReleaseThenPost(tracks, post) {
    const finish = (releaseCredits) => {
      post({ ok: true, tracks, releaseCredits });
      setTimeout(() => window.close(), 250);
    };
    const infoTab = document.querySelector('[data-test="album-info-tab-info"]');
    if (!infoTab) {
      finish([]);
      return;
    }
    try {
      infoTab.click();
    } catch (e) {
      finish([]);
      return;
    }
    const start = Date.now();
    const t = setInterval(() => {
      const cells = [...document.querySelectorAll('[class*="_creditsCell"]')].filter((c) => !c.closest('[data-test="album-info-item"]'));
      if (cells.length > 0) {
        clearInterval(t);
        setTimeout(() => finish(extractTidalReleaseCreditsDom(document)), 600);
      } else if (Date.now() - start > 6e3) {
        clearInterval(t);
        finish([]);
      }
    }, 250);
  }
  function harvestTidalAlbum(albumUrl) {
    const parsed = parseTidalAlbumUrl(albumUrl);
    if (!parsed) return Promise.reject(new Error(`Not a Tidal album URL: ${albumUrl}`));
    const reqId = `${parsed.id}.${Date.now().toString(36)}`;
    const key = HARVEST_KEY(reqId);
    const harvestUrl = `${parsed.creditsUrl}#ch-req=${reqId}`;
    if (typeof GM_openInTab === "function") {
      GM_openInTab(harvestUrl, { active: false, insert: true, setParent: true });
    } else {
      const tab = window.open(harvestUrl, "_blank");
      if (!tab) return Promise.reject(new Error("Popup blocked \u2014 allow popups for musicbrainz.org and retry"));
    }
    return new Promise((resolve, reject) => {
      let listenerId = null;
      let pollTimer = null;
      const done = (fn, arg) => {
        if (pollTimer) clearInterval(pollTimer);
        clearTimeout(deadline);
        try {
          if (listenerId !== null && typeof GM_removeValueChangeListener === "function") GM_removeValueChangeListener(listenerId);
        } catch (e) {
        }
        try {
          GM_deleteValue(key);
        } catch (e) {
        }
        fn(arg);
      };
      const check = (value) => {
        if (value && typeof value === "object") done(resolve, value);
      };
      if (typeof GM_addValueChangeListener === "function") {
        listenerId = GM_addValueChangeListener(key, (_n, _o, value) => check(value));
      }
      pollTimer = setInterval(() => {
        try {
          check(GM_getValue(key));
        } catch (e) {
        }
      }, 700);
      const deadline = setTimeout(() => done(reject, new Error("Tidal harvest timed out \u2014 is the credits tab open and loading?")), HARVEST_TIMEOUT_MS);
    });
  }

  // src/sources/registry.js
  function parseSourceEntityUrl(url) {
    if (!url) return null;
    return parseDiscogsUrl(url) || parseTidalArtistUrl(url);
  }
  function sourceNameForUrl(url) {
    if (/tidal\.com\//i.test(url || "")) return "Tidal";
    if (/qobuz\.com\//i.test(url || "")) return "Qobuz";
    return "Discogs";
  }
  function sourceUrlLinkTypeId(url, entityType) {
    const src = sourceNameForUrl(url);
    if (src === "Tidal") return entityType === "artist" ? "978" : null;
    if (src === "Qobuz") return null;
    return entityType === "label" ? "217" : entityType === "place" ? "705" : "180";
  }

  // src/preflight.js
  var KIND_TABLE = {
    artist: { searchLimit: 10, resultKey: "artists", incRels: "artist-rels" },
    label: { searchLimit: 8, resultKey: "labels", incRels: "label-rels" },
    // Places also accept label-rels because MB editors often file a
    // facility as a label rather than a place (issue we've worked around
    // since the original company resolver).
    place: { searchLimit: 8, resultKey: "places", incRels: "place-rels+label-rels" }
  };
  async function resolveEntity(entity, kind, opts) {
    const { bypassIdb } = opts;
    const { searchLimit, resultKey, incRels } = KIND_TABLE[kind];
    const parsed = parseSourceEntityUrl(entity.resource_url);
    const key = parsed?.key;
    const searchName = entity.name;
    const displayName = kind === "artist" ? entity.anv && entity.anv.trim() || entity.name : entity.name;
    const discogsHref = entity.resource_url.replace(/https:\/\/api\.discogs\.com\/(\w+?)s\/(\d+)/, "https://www.discogs.com/$1/$2");
    function buildResolved(mbUrl, mbName, mbDisambig, via2, actualKind = kind, fromCache = false, urlLinkedIds2, creditOverride) {
      return {
        type: "resolved",
        entityType: actualKind,
        entity,
        displayName,
        discogsHref,
        mbUrl,
        mbName,
        mbDisambig,
        // User's saved "Credited as" override from a prior session
        // (IDB `creditOverride` field). Review-table reads this in
        // `pickPrefill` to populate the field. Undefined when no
        // prior override exists. #105.
        creditOverride,
        // `urlLinkedIds` — MBIDs that have a relation to this Discogs URL,
        //                  harvested from the URL lookup done during
        //                  preflight. The review-table uses this to render
        //                  the "Add Discogs link" / "already linked" / "linked
        //                  to different MB <type>" badge without issuing
        //                  another `/ws/2/url?…` query per row. `undefined`
        //                  means "preflight didn't ask MB" (IDB hit on a
        //                  legacy record that predates this field), in which
        //                  case review-table falls back to its own per-row
        //                  fetch. `[]` means "asked MB, got no relations" —
        //                  no fallback needed.
        urlLinkedIds: urlLinkedIds2,
        // `via`      — the resolution mechanism (`name` / `url` / `both` / `user`,
        //              or `cache` only when a legacy IDB record predates the
        //              `resolvedVia` field and we genuinely can't recover it).
        // `fromCache`— whether THIS resolution came from IDB rather than a fresh
        //              MB lookup. The two are orthogonal: a name-resolved entity
        //              loaded from cache is `via='name'` + `fromCache=true`, and
        //              the UI surfaces both as `name (cache)`.
        logEntry: { displayName, discogsHref, mbUrl, mbName, mbDisambig, via: via2, fromCache }
      };
    }
    function buildAttention(nameMatches2, nameSearchFailed2, ambiguityReason, urlLinkedIds2, creditOverride) {
      return {
        type: "attention",
        entityType: kind,
        entity,
        displayName,
        discogsHref,
        nameMatches: nameMatches2 || [],
        // Saved "Credited as" override — see buildResolved. #105.
        creditOverride,
        // Same `urlLinkedIds` contract as on the resolved shape — review-table
        // uses it to skip the per-row URL fetch even for attention rows once
        // the user picks an MBID from the candidate list.
        urlLinkedIds: urlLinkedIds2,
        // Only artists track this — used by the review table to badge
        // entries that failed because of a rate-limited name search vs
        // entries that genuinely don't exist in MB.
        rateLimited: kind === "artist" && nameSearchFailed2 && !nameMatches2?.length,
        ambiguityReason: ambiguityReason || null
      };
    }
    async function fetchMbEntityInfo(et, mbid) {
      const json = await mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${et}/${mbid}?fmt=json`);
      return json ? { name: json.name || null, disambiguation: json.disambiguation || "" } : { name: null, disambiguation: "" };
    }
    if (bypassIdb && key) {
      await deleteIdbRecord(key);
    }
    if (!bypassIdb && key) {
      const cachedRec = await readIdbRecord(key);
      if (cachedRec?.mbid && cachedRec?.entityType) {
        const via2 = cachedRec.resolvedVia || "cache";
        let cachedLinkedIds = cachedRec.urlLinkedIds;
        if (cachedLinkedIds === void 0 && (via2 === "url" || via2 === "both")) {
          cachedLinkedIds = [cachedRec.mbid];
        }
        if (Array.isArray(cachedLinkedIds) && cachedLinkedIds.length === 0) cachedLinkedIds = void 0;
        if (cachedRec.name) {
          return buildResolved(
            cachedRec.mbUrl,
            cachedRec.name,
            cachedRec.disambiguation || "",
            via2,
            cachedRec.entityType,
            true,
            cachedLinkedIds,
            cachedRec.creditOverride
          );
        }
        const info = await fetchMbEntityInfo(cachedRec.entityType, cachedRec.mbid);
        if (info.name) {
          await writeIdbRecord(key, {
            name: info.name,
            disambiguation: info.disambiguation
          });
        }
        return buildResolved(
          cachedRec.mbUrl,
          info.name,
          info.disambiguation,
          via2,
          cachedRec.entityType,
          true,
          cachedLinkedIds,
          cachedRec.creditOverride
        );
      }
      if (cachedRec && Array.isArray(cachedRec.nameMatches)) {
        const attnLinkedIds = Array.isArray(cachedRec.urlLinkedIds) && cachedRec.urlLinkedIds.length === 0 ? void 0 : cachedRec.urlLinkedIds;
        return buildAttention(cachedRec.nameMatches, false, null, attnLinkedIds, cachedRec.creditOverride);
      }
    }
    const [nameJson, urlJson] = await Promise.all([
      mbThrottle.fetchJson(
        `//musicbrainz.org/ws/2/${kind}?query=${encodeURIComponent(searchName)}&fmt=json&limit=${searchLimit}`
      ),
      parsed ? mbThrottle.fetchJson404(
        `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(parsed.cleanUrl)}&inc=${incRels}&fmt=json`
      ) : Promise.resolve({ notFound: true })
    ]);
    const nameSearchFailed = nameJson === null;
    const normalized = searchName.toLowerCase().trim();
    const nameMatches = !nameJson?.[resultKey] ? [] : nameJson[resultKey].filter((a) => a.name.toLowerCase().trim() === normalized || a.score != null && a.score >= 70).map((a) => ({
      id: a.id,
      name: a.name,
      disambiguation: a.disambiguation || a["disambiguation-comment"] || "",
      score: a.score || 0
    }));
    const exactNameMatches = nameMatches.filter((a) => a.name.toLowerCase().trim() === normalized);
    const nameHit = exactNameMatches.length === 1 ? {
      kind,
      mbid: exactNameMatches[0].id,
      name: exactNameMatches[0].name,
      disambiguation: exactNameMatches[0].disambiguation || ""
    } : null;
    let urlHit = null;
    const urlLinkedIds = urlJson === null ? void 0 : (urlJson.relations || []).map((r) => kind === "place" ? r.place?.id || r.label?.id || null : r[kind]?.id || null).filter(Boolean);
    if (urlJson?.relations?.length > 0) {
      const rel = kind === "place" ? urlJson.relations.find((r) => r.place || r.label) : urlJson.relations.find((r) => r[kind]);
      if (rel) {
        const actualKind = rel[kind] ? kind : rel.label ? "label" : "place";
        const a = rel[actualKind];
        urlHit = {
          kind: actualKind,
          mbid: a.id,
          name: a.name || null,
          disambiguation: a.disambiguation || ""
        };
      }
    }
    async function cacheAttention(matches) {
      if (key && !nameSearchFailed) {
        await writeIdbRecord(key, {
          mbid: null,
          entityType: null,
          name: null,
          mbUrl: null,
          disambiguation: "",
          resolvedVia: null,
          nameMatches: matches,
          // Omit when unknown (lookup failed) — never persist a guess.
          ...urlLinkedIds !== void 0 && { urlLinkedIds }
        });
      }
    }
    let resolved = null;
    let via = null;
    if (nameHit && urlHit) {
      if (nameHit.mbid === urlHit.mbid && nameHit.kind === urlHit.kind) {
        resolved = urlHit;
        via = "both";
      } else {
        await cacheAttention(nameMatches);
        return buildAttention(
          nameMatches,
          false,
          `name \u2192 ${nameHit.kind}/${nameHit.mbid}, URL \u2192 ${urlHit.kind}/${urlHit.mbid}`,
          urlLinkedIds
        );
      }
    } else if (urlHit) {
      resolved = urlHit;
      via = "url";
    } else if (nameHit) {
      resolved = nameHit;
      via = "name";
    }
    if (resolved) {
      const mbUrl = `//musicbrainz.org/${resolved.kind}/${resolved.mbid}`;
      let finalName = resolved.name;
      let finalDisam = resolved.disambiguation;
      if (!finalName) {
        const info = await fetchMbEntityInfo(resolved.kind, resolved.mbid);
        finalName = info.name || null;
        finalDisam = info.disambiguation || "";
      }
      if (key) {
        await writeIdbRecord(key, {
          mbid: resolved.mbid,
          entityType: resolved.kind,
          name: finalName,
          disambiguation: finalDisam || "",
          resolvedVia: via,
          // Omit when unknown (lookup failed) — never persist a guess.
          ...urlLinkedIds !== void 0 && { urlLinkedIds }
        });
      }
      return buildResolved(mbUrl, finalName, finalDisam || "", via, resolved.kind, false, urlLinkedIds);
    }
    await cacheAttention(nameMatches);
    return buildAttention(nameMatches, nameSearchFailed, null, urlLinkedIds);
  }
  async function resolveAll(entities, opts) {
    const { kindOf, progressLi, bypassIdb, progressLabel } = opts;
    const CONCURRENCY = 5;
    const MIN_GAP_MS = 50;
    let done = 0;
    const inFlightNames = /* @__PURE__ */ new Set();
    function setProgress() {
      if (entities.length > 0) {
        try {
          _setProgressPct(done / entities.length * 100);
        } catch (_) {
        }
      }
      if (!progressLi) return;
      const remaining = entities.length - done;
      const checking = inFlightNames.size ? ` \u2014 checking <em>${[...inFlightNames].join(", ")}</em>` : "";
      progressLi.innerHTML = `${progressLabel}\u2026 <strong>${done}/${entities.length}</strong> done${checking}` + (remaining === 0 ? " \u2714" : ` (${remaining} remaining)`);
      try {
        const plain = `${progressLabel}\u2026 ${done}/${entities.length} done` + (inFlightNames.size ? ` \u2014 checking ${[...inFlightNames].join(", ")}` : "") + (remaining === 0 ? " \u2714" : ` (${remaining} remaining)`);
        document.querySelector(".discogs-bar")?._setProgress?.(null, plain);
      } catch (_) {
      }
    }
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const queue = entities.map((e, i) => ({ entity: e, index: i }));
    const results = new Array(entities.length);
    setProgress();
    async function worker(slotIndex) {
      const tag = `worker#${slotIndex}`;
      logDebug(`${tag} starting (stagger ${slotIndex * MIN_GAP_MS}ms)`);
      await delay(slotIndex * MIN_GAP_MS);
      let processed = 0;
      while (queue.length > 0) {
        const { entity, index } = queue.shift();
        const kind = kindOf(entity);
        if (!kind) {
          logDebug(`${tag} skip "${entity?.name || "?"}" \u2014 no resolvable kind`);
          done++;
          setProgress();
          continue;
        }
        const displayName = kind === "artist" ? entity.anv && entity.anv.trim() || entity.name : entity.name;
        inFlightNames.add(displayName);
        setProgress();
        const t0 = Date.now();
        logDebug(`${tag} resolving "${displayName}" (${kind})`);
        results[index] = await resolveEntity(entity, kind, { bypassIdb });
        const elapsed = Date.now() - t0;
        const r = results[index];
        const outcome = r?.type === "resolved" ? `resolved via ${r.logEntry?.via || "?"}${r.logEntry?.fromCache ? " (cache)" : ""}` : r?.type === "attention" ? `unresolved (${r.nameMatches?.length || 0} candidates)` : "skipped";
        logDebug(`${tag} "${displayName}" -> ${outcome} in ${elapsed}ms`);
        inFlightNames.delete(displayName);
        done++;
        processed++;
        setProgress();
      }
      logDebug(`${tag} finished (${processed} entit${processed === 1 ? "y" : "ies"})`);
    }
    const slots = Math.min(CONCURRENCY, entities.length);
    logDebug(`resolveAll: ${entities.length} entit${entities.length === 1 ? "y" : "ies"}, ${slots} worker slot(s)`);
    if (slots > 0) await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));
    logDebug(`resolveAll: done`);
    return { allResults: results.filter(Boolean) };
  }
  var ENTITY_KIND = (e) => e?.entityType || "artist";
  var COMPANY_KIND = (c) => ENTITY_TYPE_MAP[c.entity_type_name]?.entityType ?? null;

  // src/review-table.js
  var _urlCheckSessionCache = /* @__PURE__ */ new Map();
  async function showReviewTable(allResults, rolesMap, companiesRolesMap, opts) {
    rolesMap = rolesMap || /* @__PURE__ */ new Map();
    companiesRolesMap = companiesRolesMap || /* @__PURE__ */ new Map();
    const onRefresh = opts?.onRefresh || null;
    const headerSlot = opts?.headerSlot || null;
    const importSourceName = opts?.sourceName || "Discogs";
    const sourceIcon = opts?.sourceIcon || "";
    const _preloadedNames = /* @__PURE__ */ new Map();
    const _nullNames = allResults.filter((r) => r.type === "resolved" && r.mbUrl && !r.mbName);
    for (const r of _nullNames) {
      const rUrl = r.entity?.resource_url;
      try {
        const idbKey = parseSourceEntityUrl(rUrl)?.key;
        const rec = await readIdbRecord(idbKey);
        if (rec?.name) {
          _preloadedNames.set(rUrl, { name: rec.name, dis: rec.disambiguation || "" });
          continue;
        }
        const mbid = (r.mbUrl || "").split("/").pop().replace(/[^a-f0-9-]/g, "").substring(0, 36);
        if (!mbid) continue;
        const et = r.entityType || "artist";
        const data = await mbThrottle.fetchJson(`https://musicbrainz.org/ws/2/${et}/${mbid}?fmt=json`);
        if (data?.name) {
          _preloadedNames.set(rUrl, { name: data.name, dis: data.disambiguation || "" });
          if (idbKey) {
            await writeIdbRecord(idbKey, {
              mbid,
              entityType: et,
              name: data.name,
              disambiguation: data.disambiguation || ""
              // No resolvedVia change — this is just a name-display
              // populate; whatever set the cached mbid stays the
              // source of truth for `resolvedVia`.
            });
          }
        }
      } catch (e) {
      }
    }
    return new Promise((resolve) => {
      const rowState = /* @__PURE__ */ new Map();
      const rowSearchInputs = /* @__PURE__ */ new Map();
      const keyOf = (r) => r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
      const attentionCount = allResults.filter((r) => r.type === "attention").length;
      const mismatchCount = allResults.filter((r) => {
        if (r.type !== "resolved") return false;
        const e = r.logEntry;
        return e && e.mbName && e.displayName && e.mbName.toLowerCase().trim() !== e.displayName.toLowerCase().trim();
      }).length;
      const URL_CHECK_CONCURRENCY = 5;
      const urlCheckPending = [];
      let urlCheckRunning = 0;
      let urlCheckStarted = false;
      function queuedUrlCheck(fn) {
        return new Promise((resolve2, reject) => {
          urlCheckPending.push({ fn, resolve: resolve2, reject });
          if (urlCheckRunning < URL_CHECK_CONCURRENCY) {
            runUrlCheckWorker();
          }
        });
      }
      async function runUrlCheckWorker() {
        urlCheckRunning++;
        while (urlCheckPending.length > 0) {
          const { fn, resolve: resolve2, reject } = urlCheckPending.shift();
          try {
            resolve2(await fn());
          } catch (e) {
            reject(e);
          }
        }
        urlCheckRunning--;
      }
      const VIA_STYLES = {
        both: { text: "name+url", color: "#2a7" },
        // green — high confidence
        url: { text: "url", color: "#46a" },
        // blue
        name: { text: "name", color: "#46a" },
        // blue
        user: { text: "user", color: "#777" },
        // grey
        cache: { text: "cache", color: "#777" }
        // grey (legacy: original mechanism unknown)
      };
      function viaCfg(via, fromCache) {
        const base = VIA_STYLES[via];
        if (!base) return null;
        if (fromCache && via !== "cache") {
          return { text: `${base.text} (cache)`, color: base.color };
        }
        return base;
      }
      function makeViaBadge(via, fromCache) {
        const cfg = viaCfg(via, fromCache);
        if (!cfg) return null;
        const span = document.createElement("span");
        span.textContent = cfg.text;
        span.title = fromCache && via !== "cache" ? `Resolved via ${via}, served from cache` : `Resolved via ${via}`;
        span.style.cssText = `font-size:0.68rem;background:#f5f5f5;color:${cfg.color};padding:0 0.35rem;border-radius:8px;border:1px solid #ddd;flex-shrink:0;`;
        return span;
      }
      const creditOverrides = /* @__PURE__ */ new Map();
      const existingCreditByMbid = computeExistingCreditByMbid();
      function computeExistingCreditByMbid() {
        const counts = /* @__PURE__ */ new Map();
        const MB = pageWindow?.MB;
        const iterate = MB?.tree?.iterate;
        if (!iterate) return counts;
        const valueOf = (yielded) => Array.isArray(yielded) ? yielded[1] : yielded;
        const isTree = (x) => x && typeof x === "object" && x.size != null && (x.left !== void 0 || x.right !== void 0 || x.value !== void 0);
        function tally(rel) {
          if (!rel || rel._status === 2) return;
          for (const side of [1, 0]) {
            const entity = rel[`entity${side}`];
            const tgt = entity?.gid;
            if (!tgt) continue;
            const credit = rel[`entity${side}_credit`] || entity.name;
            if (!credit) continue;
            if (!counts.has(tgt)) counts.set(tgt, /* @__PURE__ */ new Map());
            const m = counts.get(tgt);
            m.set(credit, (m.get(credit) || 0) + 1);
          }
        }
        function walkRels(rels) {
          if (!isTree(rels)) return;
          for (const e of iterate(rels)) tally(valueOf(e));
        }
        function walkPhraseGroups(phraseGroups) {
          if (!isTree(phraseGroups)) return;
          for (const e of iterate(phraseGroups)) {
            const pg = valueOf(e);
            if (pg?.relationships) walkRels(pg.relationships);
          }
        }
        function walkTypeGroups(byTypeId) {
          if (!isTree(byTypeId)) return;
          for (const e of iterate(byTypeId)) {
            const tg = valueOf(e);
            if (tg?.phraseGroups) walkPhraseGroups(tg.phraseGroups);
          }
        }
        function walkPerSource(perSource) {
          if (!isTree(perSource)) return;
          for (const e of iterate(perSource)) {
            walkTypeGroups(valueOf(e));
          }
        }
        function walkSource(root) {
          if (!isTree(root)) return;
          for (const e of iterate(root)) {
            walkPerSource(valueOf(e));
          }
        }
        try {
          walkSource(MB.relationshipEditor?.state?.existingRelationshipsBySource);
        } catch (e) {
        }
        try {
          walkSource(MB.relationshipEditor?.state?.relationshipsBySource);
        } catch (e) {
        }
        const out = /* @__PURE__ */ new Map();
        for (const [mbid, m] of counts) {
          let best = null, bestN = 0;
          for (const [credit, n] of m) {
            if (n > bestN) {
              best = credit;
              bestN = n;
            }
          }
          if (best) out.set(mbid, best);
        }
        return out;
      }
      const panel = document.createElement("div");
      panel.style.cssText = "border:2px solid #c8a000;border-radius:0.5rem;background:#fffef5;padding:1rem 1.5rem;margin:0.5rem 0;";
      {
        const _pb = document.getElementById("discogs-progress-bar");
        if (_pb) _pb.style.display = "none";
      }
      const _bar = document.querySelector(".discogs-bar");
      if (_bar) {
        _hideBar();
        const _r2 = _bar.querySelector(".discogs-bar-row2");
        if (_r2) _r2.style.marginTop = "";
      }
      const heading = document.createElement("div");
      heading.style.cssText = "display:flex;align-items:center;gap:0.6rem;margin:0 0 0.5rem;padding:0.4rem 0.6rem;border-radius:0.3rem;background:#f5e8a0;border:1px solid #d4b800;";
      if (onRefresh) {
        const refreshBtn = document.createElement("button");
        refreshBtn.textContent = "\u{1F504} Refresh from MB";
        refreshBtn.title = "Re-resolve every entity via MusicBrainz API, ignoring the local IDB cache";
        refreshBtn.style.cssText = "font-size:0.8rem;cursor:pointer;padding:0.2rem 0.5rem;border:1px solid #b59a00;border-radius:3px;background:#fff;color:#5a4000;flex-shrink:0;";
        refreshBtn.addEventListener("click", () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "\u{1F504} Refreshing\u2026";
          (panelLi || panel).remove();
          if (headerSlot) headerSlot.replaceChildren();
          onRefresh().then((freshResults) => {
            showReviewTable(freshResults, rolesMap, companiesRolesMap, opts).then((confirmedMap) => resolve(confirmedMap));
          });
        });
        heading.appendChild(refreshBtn);
      }
      const headingText = document.createElement("span");
      headingText.style.cssText = "font-weight:bold;font-size:1rem;color:#5a4000;flex:1;";
      headingText.textContent = `Review \u2014 ${allResults.length} entit${allResults.length === 1 ? "y" : "ies"}`;
      heading.appendChild(headingText);
      panel.appendChild(heading);
      const intro = document.createElement("p");
      intro.style.cssText = "margin:0 0 0.75rem;font-size:0.85rem;color:#666;";
      intro.innerHTML = 'Review all artist matches before importing. <span style="background:#ffe0e0;padding:0 0.3rem;border-radius:2px;">Red rows</span> need attention. <span style="background:#fff8e1;padding:0 0.3rem;border-radius:2px;">Yellow rows</span> have a name mismatch \u2014 verify. Green rows are confirmed. Use the search or create buttons to resolve outstanding issues.';
      panel.appendChild(intro);
      const table = document.createElement("table");
      table.style.cssText = "border-collapse:collapse;width:100%;font-size:0.85rem;";
      const thead = document.createElement("thead");
      const hr = document.createElement("tr");
      hr.style.background = "#f5e8a0";
      [importSourceName + " entity", "MB match / search"].forEach((col) => {
        const th = document.createElement("th");
        th.style.cssText = "text-align:left;padding:0.3rem 0.5rem;border:1px solid #d4b800;white-space:nowrap;";
        th.textContent = col;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      allResults.forEach((r) => {
        const entityType = r.entityType || "artist";
        const displayName = r.displayName || r.entity?.name || "";
        const discogsHref = r.discogsHref || "";
        const srcName = discogsHref ? sourceNameForUrl(discogsHref) : importSourceName;
        const e = r.logEntry || null;
        const artist = r.entity;
        const isResolved = r.type === "resolved";
        const initMbUrl = isResolved ? r.mbUrl : null;
        const _entityKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
        const _pl = _preloadedNames.get(_entityKey) || _preloadedNames.get(r.entity?.resource_url);
        const initMbName = e && e.mbName ? e.mbName : _pl?.name || (isResolved ? r.mbName : null) || null;
        const initMbDisam = e && e.mbDisambig ? e.mbDisambig : _pl?.dis || r.mbDisambig || "";
        const nameMismatch = isResolved && initMbName && initMbName.toLowerCase().trim() !== displayName.toLowerCase().trim();
        const needsAttention = r.type === "attention";
        const rowBg = needsAttention ? "#ffe0e0" : nameMismatch ? "#fff8e1" : "#fff";
        const borderColor = needsAttention ? "#cc6666" : "#d4d4d4";
        const tr = document.createElement("tr");
        tr.style.cssText = `vertical-align:top;background:${rowBg};`;
        tr.dataset.entityKey = _entityKey;
        rowState.set(_entityKey, {
          mbUrl: initMbUrl,
          mbName: initMbName,
          mbDisambig: initMbDisam,
          confirmed: isResolved && !needsAttention,
          via: isResolved ? r.logEntry?.via || null : null,
          fromCache: isResolved ? r.logEntry?.fromCache || false : false
        });
        const tdDiscogs = document.createElement("td");
        tdDiscogs.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};white-space:nowrap;`;
        const nameRow = document.createElement("div");
        nameRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:0.6rem;";
        const nameWrap = document.createElement("span");
        nameWrap.style.cssText = "min-width:0;overflow:hidden;text-overflow:ellipsis;";
        if (entityType !== "artist") {
          const badge = document.createElement("span");
          badge.textContent = entityType;
          badge.style.cssText = "font-size:0.7rem;background:#e0e0e0;border-radius:3px;padding:0 0.3rem;margin-right:0.3rem;color:#555;vertical-align:middle;";
          nameWrap.appendChild(badge);
        }
        const hasDiscogsUrl = !!r.entity?.resource_url;
        const dlA = document.createElement(hasDiscogsUrl ? "a" : "span");
        dlA.href = discogsHref;
        dlA.target = "_blank";
        dlA.rel = "noopener noreferrer nofollow";
        dlA.textContent = displayName;
        if (!hasDiscogsUrl) dlA.className = "discogs-entity-name";
        nameWrap.appendChild(dlA);
        const BADGE_BASE = "display:inline-flex;align-items:center;margin-left:0.35rem;padding:0.05rem 0.4rem;font-size:0.65rem;font-weight:600;border-radius:0.7rem;letter-spacing:0.01em;cursor:help;text-transform:lowercase;line-height:1.4;";
        if (!hasDiscogsUrl) {
          const noUrl = document.createElement("span");
          noUrl.textContent = "no profile";
          noUrl.title = "No Discogs artist page \u2014 name lookup unavailable, search MB manually";
          noUrl.style.cssText = BADGE_BASE + "background:#fde0e0;color:#a02020;border:1px solid #d44040;";
          nameWrap.appendChild(noUrl);
        }
        if (nameMismatch) {
          const w = document.createElement("span");
          w.textContent = "name differs";
          w.title = "MB entity name differs from the Discogs display name \u2014 double-check this is the right match";
          w.style.cssText = BADGE_BASE + "background:#fff1c4;color:#7a5800;border:1px solid #d4ad3a;";
          nameWrap.appendChild(w);
        }
        nameRow.appendChild(nameWrap);
        const actionsLine = document.createElement("span");
        actionsLine.style.cssText = "display:inline-flex;align-items:center;gap:0.3rem;flex-shrink:0;";
        nameRow.appendChild(actionsLine);
        tdDiscogs.appendChild(nameRow);
        tr.appendChild(tdDiscogs);
        const rolesList = r._roles || [];
        if (rolesList.length > 0) {
          const seen = /* @__PURE__ */ new Map();
          rolesList.forEach(({ displayLabel, linkType, trackPos }) => {
            const key = displayLabel || linkType;
            if (!key) return;
            const uniqueKey = key + (trackPos ? "[" + trackPos + "]" : "");
            if (seen.has(uniqueKey)) return;
            seen.set(uniqueKey, {
              roleKey: key,
              displayText: key + (trackPos ? " [" + trackPos + "]" : "")
            });
          });
          const chips = [...seen.values()];
          const rolesLine = document.createElement("div");
          rolesLine.style.cssText = "font-size:0.75rem;color:#888;margin-top:0.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;";
          rolesLine.title = chips.map((c) => c.displayText).join(", ");
          chips.forEach((chip, i) => {
            if (i > 0) rolesLine.appendChild(document.createTextNode(", "));
            const span = document.createElement("span");
            span.className = "discogs-role-chip";
            span.dataset.roleKey = chip.roleKey;
            span.textContent = chip.displayText;
            rolesLine.appendChild(span);
          });
          tdDiscogs.appendChild(rolesLine);
        }
        const credLine = document.createElement("div");
        credLine.style.cssText = "display:flex;align-items:center;gap:0.3rem;margin-top:1rem;padding-top:0.25rem;max-width:280px;";
        const credLabel = document.createElement("label");
        credLabel.textContent = "Credited as:";
        credLabel.style.cssText = "font-size:0.72rem;color:#888;flex-shrink:0;";
        const credInput = document.createElement("input");
        credInput.type = "text";
        const CRED_BG_SAME = "#fff";
        const CRED_BG_DIFFERENT = "#fff4d0";
        credInput.style.cssText = "flex:1;padding:0.15rem 0.35rem;font-size:0.78rem;border:1px solid #ddd;border-radius:3px;background:" + CRED_BG_SAME + ";";
        credInput.placeholder = displayName;
        credInput.title = `Override the credited name dispatched with every rel for this entity.
Leave empty to use the default (${srcName} name, or MB's most-frequent existing credit when known).`;
        function refreshCredBg() {
          const value = (credInput.value || "").trim();
          const same = value === "" || value === displayName;
          credInput.style.background = same ? CRED_BG_SAME : CRED_BG_DIFFERENT;
        }
        function pickPrefill(mbUrl) {
          if (r.creditOverride !== void 0 && r.creditOverride !== null && r.creditOverride !== "") {
            return r.creditOverride;
          }
          if (mbUrl) {
            const mbid = (String(mbUrl).split("/").pop() || "").replace(/[^a-f0-9-]/gi, "").slice(0, 36);
            if (mbid && existingCreditByMbid.has(mbid)) return existingCreditByMbid.get(mbid);
          }
          return displayName;
        }
        credInput.value = pickPrefill(r.mbUrl);
        credInput._userTouched = false;
        refreshCredBg();
        let _credSaveTimer;
        credInput.addEventListener("input", () => {
          credInput._userTouched = true;
          const url = credInput._activeMbUrl;
          if (url) creditOverrides.set(url, credInput.value);
          refreshCredBg();
          clearTimeout(_credSaveTimer);
          _credSaveTimer = setTimeout(() => {
            const idbKey = parseSourceEntityUrl(r.entity?.resource_url)?.key;
            if (idbKey) writeIdbRecord(idbKey, { creditOverride: credInput.value });
          }, 500);
        });
        credInput._activeMbUrl = r.mbUrl;
        if (r.mbUrl) creditOverrides.set(r.mbUrl, credInput.value);
        const CRED_BTN_STYLE = "flex-shrink:0;padding:0.05rem 0.35rem;font-size:0.7rem;line-height:1;cursor:pointer;border:1px solid #c8a000;border-radius:3px;background:#fffbe6;color:#7a5000;";
        const mbBtn = document.createElement("button");
        mbBtn.type = "button";
        mbBtn.textContent = "MB";
        mbBtn.title = "Set Credited as to the MB entity name";
        mbBtn.style.cssText = CRED_BTN_STYLE;
        const dBtn = document.createElement("button");
        dBtn.type = "button";
        dBtn.textContent = srcName.charAt(0);
        dBtn.title = `Set Credited as to the ${srcName} name`;
        dBtn.style.cssText = CRED_BTN_STYLE;
        function currentMbName() {
          return rowState.get(_entityKey)?.mbName || r.mbName || null;
        }
        function refreshCredBtns() {
          const val = credInput.value;
          const mbName = currentMbName();
          mbBtn.style.display = !mbName || val === mbName ? "none" : "";
          dBtn.style.display = val === displayName ? "none" : "";
        }
        function setCredViaButton(value) {
          credInput.value = value;
          credInput._userTouched = true;
          credInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        mbBtn.addEventListener("click", () => {
          const mbName = currentMbName();
          if (mbName) setCredViaButton(mbName);
        });
        dBtn.addEventListener("click", () => setCredViaButton(displayName));
        credInput.addEventListener("input", refreshCredBtns);
        refreshCredBtns();
        credLine.appendChild(credLabel);
        credLine.appendChild(credInput);
        credLine.appendChild(mbBtn);
        credLine.appendChild(dBtn);
        tdDiscogs.appendChild(credLine);
        r._credInput = credInput;
        r._refreshCredBtns = refreshCredBtns;
        const tdMb = document.createElement("td");
        tdMb.style.cssText = `padding:0.3rem 0.5rem;border:1px solid ${borderColor};min-width:240px;`;
        const candidateList = document.createElement("div");
        candidateList.style.cssText = "display:flex;flex-direction:column;gap:0.2rem;margin-bottom:0.3rem;";
        const searchRow = document.createElement("div");
        searchRow.style.cssText = "display:flex;gap:0.3rem;";
        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.value = displayName;
        searchInput.style.cssText = "flex:1;padding:0.15rem 0.35rem;font-size:0.82rem;border:1px solid #bbb;border-radius:3px;";
        rowSearchInputs.set(_entityKey, searchInput);
        const searchBtn = document.createElement("button");
        searchBtn.type = "button";
        searchBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>';
        searchBtn.title = "Search MusicBrainz";
        searchBtn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;padding:0 0.45rem;cursor:pointer;color:#666;background:#fff;border:1px solid #bbb;border-radius:3px;";
        searchRow.appendChild(searchBtn);
        searchRow.appendChild(searchInput);
        tdMb.appendChild(candidateList);
        tdMb.appendChild(searchRow);
        tr.appendChild(tdMb);
        const tdAction = actionsLine;
        tbody.appendChild(tr);
        function buildMbRolesEl() {
          if (entityType !== "artist") return null;
          const wrap = document.createElement("span");
          wrap.style.cssText = "display:inline-flex;align-items:center;gap:0.25rem;margin-left:0.5rem;min-width:0;overflow:hidden;font-size:0.72rem;";
          const trigger = document.createElement("a");
          trigger.href = "#";
          trigger.textContent = "MB roles \u25BE";
          trigger.style.cssText = "color:#7a7a9a;text-decoration:none;cursor:pointer;white-space:nowrap;";
          trigger.title = "Fetch this artist's existing MB relationship types to compare with the Discogs role";
          trigger.addEventListener("click", async (ev) => {
            ev.preventDefault();
            const st = rowState.get(_entityKey);
            const curUrl = st?.mbUrl || r.mbUrl;
            const mbid = (String(curUrl || "").split("/").pop() || "").replace(/[^a-f0-9-]/gi, "").slice(0, 36);
            if (!mbid) {
              trigger.textContent = "MB roles: (none selected)";
              return;
            }
            trigger.textContent = "MB roles\u2026";
            const types = await fetchArtistRelTypes(mbid);
            wrap.innerHTML = "";
            const label = document.createElement("span");
            label.style.color = "#888";
            if (!types) {
              label.textContent = "MB roles: fetch failed";
              label.style.color = "#a02020";
              wrap.appendChild(label);
              return;
            }
            if (!types.length) {
              label.textContent = "MB roles: none";
              wrap.appendChild(label);
              return;
            }
            label.textContent = "MB roles: ";
            label.style.whiteSpace = "nowrap";
            label.style.flex = "0 0 auto";
            wrap.style.alignItems = "flex-start";
            wrap.style.overflow = "visible";
            wrap.appendChild(label);
            wrap.title = types.join(", ");
            const chipsBox = document.createElement("span");
            chipsBox.style.cssText = "display:flex;flex-wrap:wrap;gap:0.25rem;min-width:0;";
            wrap.appendChild(chipsBox);
            types.forEach((t) => {
              const c = document.createElement("span");
              c.textContent = t;
              c.style.cssText = "background:#eaeaf5;border:1px solid #ccccdd;border-radius:0.7rem;padding:0 0.4rem;color:#4a4a77;white-space:nowrap;";
              chipsBox.appendChild(c);
            });
          });
          wrap.appendChild(trigger);
          return wrap;
        }
        function setRowResolved(a) {
          const mbUrl = `//musicbrainz.org/${entityType}/${a.id}`;
          rowState.set(_entityKey, { mbUrl, mbName: a.name, mbDisambig: a.disambiguation || "", confirmed: true, via: "user", fromCache: false });
          if (r._credInput) {
            const oldUrl = r._credInput._activeMbUrl;
            if (oldUrl && oldUrl !== mbUrl) creditOverrides.delete(oldUrl);
            r._credInput._activeMbUrl = mbUrl;
            if (!r._credInput._userTouched) {
              const fresh = pickPrefill(mbUrl);
              r._credInput.value = fresh;
            }
            creditOverrides.set(mbUrl, r._credInput.value);
            refreshCredBg();
            if (r._refreshCredBtns) r._refreshCredBtns();
          }
          const _idbKey = r.entity?.resource_url ? parseSourceEntityUrl(r.entity.resource_url)?.key : null;
          if (_idbKey) {
            writeIdbRecord(_idbKey, {
              mbid: a.id,
              entityType,
              name: a.name,
              disambiguation: a.disambiguation || "",
              resolvedVia: "user"
              // user picked this in the review table
            });
          }
          tr.style.background = "#f0fff0";
          searchInput.disabled = true;
          searchBtn.disabled = true;
          candidateList.innerHTML = "";
          const selRow = document.createElement("div");
          selRow.style.cssText = "padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;";
          const selA = document.createElement("a");
          selA.href = "https:" + mbUrl;
          selA.target = "_blank";
          selA.rel = "noopener noreferrer nofollow";
          selA.textContent = "\u2713 " + a.name + (a.disambiguation ? ` (${a.disambiguation})` : "");
          selA.style.fontWeight = "bold";
          const undoBtn = document.createElement("button");
          undoBtn.textContent = "\u2715";
          undoBtn.title = "Clear selection";
          undoBtn.style.cssText = "font-size:0.75rem;cursor:pointer;padding:0 0.3rem;margin-left:auto;";
          undoBtn.addEventListener("click", () => setRowUnresolved());
          selRow.appendChild(selA);
          const viaBadge = makeViaBadge("user", false);
          if (viaBadge) selRow.appendChild(viaBadge);
          const mbRolesEl = buildMbRolesEl();
          if (mbRolesEl) selRow.appendChild(mbRolesEl);
          selRow.appendChild(undoBtn);
          candidateList.appendChild(selRow);
          renderActions(a);
          updateImportBtn();
        }
        function setRowUnresolved() {
          rowState.set(_entityKey, { mbUrl: null, mbName: null, mbDisambig: "", confirmed: false, via: null, fromCache: false });
          if (r._credInput && r._credInput._activeMbUrl) {
            creditOverrides.delete(r._credInput._activeMbUrl);
            r._credInput._activeMbUrl = null;
          }
          tr.style.background = "#ffe0e0";
          searchInput.disabled = false;
          searchBtn.disabled = false;
          candidateList.innerHTML = "";
          const none = document.createElement("div");
          none.style.cssText = "font-size:0.82rem;color:#888;";
          none.textContent = "No selection \u2014 search or create";
          candidateList.appendChild(none);
          renderActions(null);
          updateImportBtn();
        }
        const ACTION_CHIP_STYLE = "display:inline-flex;align-items:center;justify-content:center;min-width:1.6rem;height:1.6rem;padding:0 0.35rem;font-size:0.95rem;line-height:1;cursor:pointer;border:1px solid #d6d6d6;border-radius:0.3rem;background:#fafafa;";
        function renderActions(selected) {
          tdAction.innerHTML = "";
          if (selected) {
            let recheckUrlBypassCache = function() {
              _urlCheckSessionCache.delete(urlCheckCacheKey);
              try {
                localStorage.removeItem(urlCheckLsKey);
              } catch (e2) {
              }
              queuedUrlCheck(
                () => fetchWithRetry(`//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(discogsHref)}&inc=${entityType}-rels&fmt=json`).then((json) => {
                  const linkedIds = (json.relations || []).filter((r2) => r2[entityType]).map((r2) => r2[entityType].id);
                  const result = linkedIds.includes(selected.id) ? "linked" : linkedIds.length > 0 ? "other" : "none";
                  _urlCheckSessionCache.set(urlCheckCacheKey, result);
                  try {
                    localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result }));
                  } catch (e2) {
                  }
                  const healKey = parseSourceEntityUrl(r.entity?.resource_url)?.key;
                  if (healKey) writeIdbRecord(healKey, { urlLinkedIds: linkedIds });
                  applyUrlCheckResult(result);
                }).catch(() => applyUrlCheckResult("none"))
              );
            }, applyUrlCheckResult = function(result) {
              if (result === "linked") {
                linkSlot.textContent = "\u2713";
                linkSlot.title = srcName + " URL already linked to this MB " + entityType;
                linkSlot.style.color = "#5a5";
                linkSlot.style.fontWeight = "bold";
              } else if (result === "other") {
                linkSlot.textContent = "\u26A0\uFE0F";
                linkSlot.title = `${srcName} URL is linked to a DIFFERENT MB ${entityType}`;
                linkSlot.style.color = "#c80";
              } else {
                linkSlot.textContent = "";
                linkSlot.style.color = "";
                const addLinkBtn = document.createElement("button");
                addLinkBtn.textContent = "\u{1F517}";
                addLinkBtn.title = `Add ${srcName} link to MB ` + entityType;
                addLinkBtn.style.cssText = ACTION_CHIP_STYLE + "color:#e8771d;";
                addLinkBtn.addEventListener("click", () => {
                  const ltId = sourceUrlLinkTypeId(discogsHref, entityType);
                  if (!ltId) return;
                  const p = new URLSearchParams({ [`edit-${entityType}.url.0.text`]: discogsHref, [`edit-${entityType}.url.0.link_type_id`]: ltId });
                  const mbid = selected.id.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
                  window.open(`https://musicbrainz.org/${entityType}/${mbid}/edit?${p}`, "_blank", "noopener,noreferrer");
                  linkSlot.innerHTML = "";
                  linkSlot.textContent = "\u2026";
                  linkSlot.title = `Verifying ${srcName} link on return to this tab\u2026`;
                  linkSlot.style.color = "#888";
                  linkSlot.style.fontStyle = "italic";
                  const onReturn = () => {
                    if (document.visibilityState !== "visible") return;
                    document.removeEventListener("visibilitychange", onReturn);
                    window.removeEventListener("focus", onReturn);
                    recheckUrlBypassCache();
                  };
                  document.addEventListener("visibilitychange", onReturn);
                  window.addEventListener("focus", onReturn);
                });
                linkSlot.appendChild(addLinkBtn);
              }
            };
            const linkSlot = document.createElement("span");
            linkSlot.style.cssText = "display:inline-flex;align-items:center;font-size:0.8rem;color:#888;";
            linkSlot.textContent = "\u2026";
            linkSlot.title = `Checking whether MB already has this ${srcName} URL linked`;
            tdAction.appendChild(linkSlot);
            const urlCheckCacheKey = `${selected.id}|${discogsHref}`;
            const urlCheckLsKey = `discogs-urlcheck-${selected.id}-${discogsHref.replace(/[^a-z0-9]/gi, "-").substring(0, 80)}`;
            const urlCheckToday = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
            const urlCheckExpiry = /* @__PURE__ */ new Date();
            urlCheckExpiry.setDate(urlCheckExpiry.getDate() - 7);
            const urlCheckExpiryStr = urlCheckExpiry.toISOString().slice(0, 10);
            let urlCheckCached = _urlCheckSessionCache.get(urlCheckCacheKey) ?? null;
            if (urlCheckCached === null) {
              try {
                const s = JSON.parse(localStorage.getItem(urlCheckLsKey) || "null");
                if (s?.date >= urlCheckExpiryStr) urlCheckCached = s.result;
              } catch (e2) {
              }
              if (urlCheckCached !== null) _urlCheckSessionCache.set(urlCheckCacheKey, urlCheckCached);
            }
            if (!discogsHref) {
              linkSlot.textContent = `\u26A0 No ${srcName} page`;
              linkSlot.style.color = "#c80";
            } else if (urlCheckCached !== null) {
              applyUrlCheckResult(urlCheckCached);
            } else if (Array.isArray(r.urlLinkedIds)) {
              const result = r.urlLinkedIds.includes(selected.id) ? "linked" : r.urlLinkedIds.length > 0 ? "other" : "none";
              _urlCheckSessionCache.set(urlCheckCacheKey, result);
              try {
                localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result }));
              } catch (e2) {
              }
              applyUrlCheckResult(result);
            } else {
              queuedUrlCheck(
                () => fetchWithRetry(`//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(discogsHref)}&inc=${entityType}-rels&fmt=json`).then((json) => {
                  const linkedIds = (json.relations || []).filter((r2) => r2[entityType]).map((r2) => r2[entityType].id);
                  const result = linkedIds.includes(selected.id) ? "linked" : linkedIds.length > 0 ? "other" : "none";
                  _urlCheckSessionCache.set(urlCheckCacheKey, result);
                  try {
                    localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result }));
                  } catch (e2) {
                  }
                  const healKey = parseSourceEntityUrl(r.entity?.resource_url)?.key;
                  if (healKey) writeIdbRecord(healKey, { urlLinkedIds: linkedIds });
                  applyUrlCheckResult(result);
                }).catch(() => applyUrlCheckResult("none"))
              );
            }
          }
          function openCreateTab({ name, disambiguation } = {}) {
            const finalName = (name || displayName).trim();
            let createUrl;
            let createParams;
            if (entityType === "artist") {
              createParams = {
                "edit-artist.name": finalName,
                "edit-artist.sort_name": guessSortName(finalName),
                "edit-artist.type_id": "1"
              };
              const ltArtist = sourceUrlLinkTypeId(discogsHref, "artist");
              if (discogsHref && ltArtist) {
                createParams["edit-artist.url.0.text"] = discogsHref;
                createParams["edit-artist.url.0.link_type_id"] = ltArtist;
              }
              if (disambiguation) createParams["edit-artist.comment"] = disambiguation;
              createUrl = "https://musicbrainz.org/artist/create";
            } else {
              const ltId = sourceUrlLinkTypeId(discogsHref, entityType);
              createParams = {
                [`edit-${entityType}.name`]: finalName
              };
              if (discogsHref && ltId) {
                createParams[`edit-${entityType}.url.0.text`] = discogsHref;
                createParams[`edit-${entityType}.url.0.link_type_id`] = ltId;
              }
              if (disambiguation) createParams[`edit-${entityType}.comment`] = disambiguation;
              createUrl = `https://musicbrainz.org/${entityType}/create`;
            }
            const p = new URLSearchParams(createParams);
            const newTab = window.open(`${createUrl}?${p}`, "_blank");
            const pendingKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || displayName}`;
            if (newTab) {
              const trySet = () => {
                try {
                  newTab.sessionStorage.setItem("discogs-importer-pending-artist", pendingKey);
                } catch (e2) {
                  setTimeout(trySet, 50);
                }
              };
              trySet();
            }
            const onCreated = (evt) => {
              if (evt.data?.type !== "artist-created") return;
              if (evt.data.resourceUrl !== pendingKey) return;
              DISCOGS_CHANNEL.removeEventListener("message", onCreated);
              _urlCheckSessionCache.set(`${evt.data.id}|${discogsHref}`, "linked");
              setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
            };
            DISCOGS_CHANNEL.addEventListener("message", onCreated);
          }
          const createBtn = document.createElement("button");
          createBtn.textContent = "+";
          createBtn.title = discogsHref ? `Create in MB with default ${srcName} name + URL` : "Create in MB with the credited name";
          createBtn.style.cssText = ACTION_CHIP_STYLE + "color:#2a7;font-size:1.15rem;font-weight:600;";
          createBtn.addEventListener("click", () => openCreateTab());
          const createAdvBtn = document.createElement("button");
          createAdvBtn.textContent = "\u25BE";
          createAdvBtn.title = "Create in MB with editable name + disambiguation" + (srcName === "Discogs" && discogsHref ? ", pre-filled from the Discogs profile" : "");
          createAdvBtn.style.cssText = ACTION_CHIP_STYLE + "color:#666;";
          createAdvBtn.addEventListener("click", () => openAdvancedCreatePopup());
          tdAction.appendChild(createBtn);
          tdAction.appendChild(createAdvBtn);
          async function openAdvancedCreatePopup() {
            const distinctRoles = [];
            const seen = /* @__PURE__ */ new Set();
            for (const role of r._roles || []) {
              const label = (role.displayLabel || role.linkType || "").trim();
              if (!label || seen.has(label)) continue;
              seen.add(label);
              distinctRoles.push(label);
              if (distinctRoles.length === 3) break;
            }
            const defaultDis = distinctRoles.join(", ");
            const overlay = document.createElement("div");
            overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10000;display:flex;align-items:center;justify-content:center;";
            const modal = document.createElement("div");
            modal.style.cssText = "background:#fff;border-radius:0.5rem;padding:1.1rem 1.35rem 1rem;max-width:600px;width:92%;max-height:82vh;display:flex;flex-direction:column;gap:0.55rem;box-shadow:0 12px 32px rgba(0,0,0,0.32);font-family:inherit;";
            const heading2 = document.createElement("div");
            heading2.style.cssText = "font-weight:bold;font-size:1.02rem;color:#222;margin-bottom:0.15rem;";
            heading2.textContent = `Create ${entityType} in MusicBrainz`;
            modal.appendChild(heading2);
            const FIELD_LABEL = "font-size:0.78rem;color:#666;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;margin-top:0.25rem;";
            const FIELD_INPUT = "padding:0.45rem 0.55rem;border:1px solid #c8c8c8;border-radius:0.3rem;font-size:0.93rem;font-family:inherit;";
            const nameLabel = document.createElement("label");
            nameLabel.style.cssText = FIELD_LABEL;
            nameLabel.textContent = "Name";
            modal.appendChild(nameLabel);
            const nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.value = displayName;
            nameInput.style.cssText = FIELD_INPUT;
            modal.appendChild(nameInput);
            let nameUserTouched = false;
            nameInput.addEventListener("input", () => {
              nameUserTouched = true;
            });
            const disLabel = document.createElement("label");
            disLabel.style.cssText = FIELD_LABEL;
            disLabel.textContent = "Disambiguation";
            modal.appendChild(disLabel);
            const disInput = document.createElement("input");
            disInput.type = "text";
            disInput.value = defaultDis;
            disInput.style.cssText = FIELD_INPUT;
            modal.appendChild(disInput);
            let disUserTouched = false;
            disInput.addEventListener("input", () => {
              disUserTouched = true;
            });
            const showProfile = srcName === "Discogs" && !!discogsHref;
            let profileBox = null;
            if (showProfile) {
              const profileLabel = document.createElement("div");
              profileLabel.style.cssText = "font-size:0.78rem;color:#888;margin-top:0.55rem;";
              profileLabel.textContent = "Discogs profile \u2014 select text to copy into Disambiguation";
              modal.appendChild(profileLabel);
              profileBox = document.createElement("div");
              profileBox.style.cssText = "border:1px solid #e0e0e0;border-radius:0.3rem;padding:0.5rem 0.6rem;background:#fafafa;font-size:0.85rem;line-height:1.5;white-space:pre-wrap;overflow:auto;min-height:5rem;max-height:18rem;flex:1;color:#444;";
              profileBox.textContent = "Loading profile from Discogs\u2026";
              modal.appendChild(profileBox);
              const captureSelection = () => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) return;
                if (!profileBox.contains(sel.anchorNode)) return;
                const text = sel.toString().trim();
                if (!text) return;
                disInput.value = text;
                disUserTouched = true;
              };
              profileBox.addEventListener("mouseup", captureSelection);
              profileBox.addEventListener("keyup", captureSelection);
            }
            const btnRow2 = document.createElement("div");
            btnRow2.style.cssText = "display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.55rem;";
            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.style.cssText = "padding:0.4rem 1rem;cursor:pointer;border:1px solid #c8c8c8;border-radius:0.25rem;background:#fafafa;color:#444;font-size:0.88rem;";
            const submitBtn = document.createElement("button");
            submitBtn.textContent = "Create \u2197";
            submitBtn.style.cssText = "padding:0.4rem 1.1rem;cursor:pointer;font-weight:bold;background:#2ecc40;color:#fff;border:none;border-radius:0.25rem;font-size:0.9rem;";
            btnRow2.appendChild(cancelBtn);
            btnRow2.appendChild(submitBtn);
            modal.appendChild(btnRow2);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            const close = () => {
              document.removeEventListener("keydown", onKey);
              overlay.remove();
            };
            const submit = () => {
              const name = nameInput.value.trim();
              const dis = disInput.value.trim();
              close();
              openCreateTab({ name: name || displayName, disambiguation: dis || null });
            };
            const onKey = (ev) => {
              if (ev.key === "Escape") {
                close();
              } else if (ev.key === "Enter" && (ev.target === disInput || ev.target === nameInput)) submit();
            };
            document.addEventListener("keydown", onKey);
            overlay.addEventListener("click", (ev) => {
              if (ev.target === overlay) close();
            });
            cancelBtn.addEventListener("click", close);
            submitBtn.addEventListener("click", submit);
            disInput.focus();
            disInput.select();
            if (showProfile) try {
              const data = await getDiscogsEntityData(r.entity?.resource_url);
              if (data?.realname && !nameUserTouched && data.realname.trim() !== displayName.trim()) {
                nameInput.value = data.realname.trim();
              }
              const lines = [];
              if (data?.namevariations?.length) lines.push(`Also known as: ${data.namevariations.slice(0, 6).join(", ")}`);
              if (data?.profile) {
                if (lines.length) lines.push("");
                lines.push(data.profile);
              }
              profileBox.textContent = lines.length ? lines.join("\n") : "(no Discogs profile)";
            } catch (e2) {
              profileBox.textContent = "(failed to load Discogs profile)";
            }
          }
        }
        function makeCandidateRow(a) {
          const row = document.createElement("div");
          row.style.cssText = "display:flex;align-items:center;gap:0.35rem;padding:0.2rem 0.35rem;border:1px solid #ddd;border-radius:3px;background:#fff;font-size:0.82rem;";
          const selBtn = document.createElement("button");
          selBtn.textContent = "\u2713";
          selBtn.title = "Select this candidate as the MB match";
          selBtn.style.cssText = "font-size:0.95rem;line-height:1;cursor:pointer;padding:0.1rem 0.45rem;white-space:nowrap;border:1px solid #b5d5b5;border-radius:0.25rem;background:#eaf6ea;color:#2a7;font-weight:600;flex-shrink:0;";
          selBtn.addEventListener("click", () => setRowResolved(a));
          row.appendChild(selBtn);
          const info = document.createElement("span");
          info.style.flex = "1";
          const nameA = document.createElement("a");
          nameA.href = `https://musicbrainz.org/${entityType}/${a.id}`;
          nameA.target = "_blank";
          nameA.rel = "noopener noreferrer nofollow";
          nameA.style.fontWeight = "bold";
          nameA.textContent = a.name;
          info.appendChild(nameA);
          if (a.disambiguation) {
            const d = document.createElement("span");
            d.style.cssText = "color:#777;margin-left:0.25rem;";
            d.textContent = `(${a.disambiguation})`;
            info.appendChild(d);
          }
          row.appendChild(info);
          return row;
        }
        function extractMbid(q) {
          const m = q.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
          return m ? m[0] : null;
        }
        function doSearch(q) {
          if (!q) return;
          const mbid = extractMbid(q);
          if (mbid) {
            candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;">Looking up MBID\u2026</div>';
            mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`).then((json) => {
              if (!json) return;
              candidateList.innerHTML = "";
              if (json.id) {
                candidateList.appendChild(makeCandidateRow({
                  id: json.id,
                  name: json.name,
                  disambiguation: json.disambiguation || ""
                }));
              } else {
                candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;">Not found</div>';
              }
            }).catch(() => {
              candidateList.innerHTML = `<div style="font-size:0.82rem;color:#c00;">MBID not found or wrong entity type</div>`;
            });
            return;
          }
          candidateList.innerHTML = '<div style="font-size:0.82rem;color:#888;font-style:italic;">Searching\u2026</div>';
          mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}?query=${encodeURIComponent(q)}&fmt=json&limit=8`).then((json) => {
            if (!json) {
              candidateList.innerHTML = '<div style="font-size:0.82rem;color:#c00;">Search failed \u2014 MB unavailable</div>';
              return;
            }
            candidateList.innerHTML = "";
            const resultKey = entityType === "label" ? "labels" : entityType === "place" ? "places" : "artists";
            if (!json[resultKey] || json[resultKey].length === 0) {
              const none = document.createElement("div");
              none.style.cssText = "font-size:0.82rem;color:#888;";
              none.textContent = "No results";
              candidateList.appendChild(none);
            } else {
              json[resultKey].forEach((a) => candidateList.appendChild(makeCandidateRow(a)));
            }
          }).catch(() => {
            candidateList.innerHTML = '<div style="font-size:0.82rem;color:#c00;">Search failed</div>';
          });
        }
        let searchTimer;
        searchInput.addEventListener("input", () => {
          clearTimeout(searchTimer);
          searchTimer = setTimeout(() => doSearch(searchInput.value.trim()), 300);
        });
        searchInput.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            doSearch(searchInput.value.trim());
          }
        });
        searchBtn.addEventListener("click", () => doSearch(searchInput.value.trim()));
        if (isResolved && initMbUrl) {
          const mbid = initMbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
          const correctedMbUrl = `//musicbrainz.org/${entityType}/${mbid}`;
          const displayName2 = initMbName || mbid;
          if (!initMbName) {
            rowState.set(_entityKey, { mbUrl: initMbUrl, mbName: null, mbDisambig: "", confirmed: true, via: r.logEntry?.via || null, fromCache: r.logEntry?.fromCache || false });
            tr.style.background = "#fff8e1";
          }
          const fakeA = { id: mbid, name: displayName2, disambiguation: initMbDisam };
          candidateList.innerHTML = "";
          const selRow = document.createElement("div");
          selRow.style.cssText = "padding:0.15rem 0.4rem;border:1px solid #5a5;border-radius:3px;background:#e8f8e8;display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;";
          const selA = document.createElement("a");
          selA.href = "https:" + correctedMbUrl;
          selA.target = "_blank";
          selA.rel = "noopener noreferrer nofollow";
          selA.textContent = "\u2713 " + displayName2 + (initMbDisam ? ` (${initMbDisam})` : "") + (!initMbName ? " \u26A0 name unknown" : "");
          selA.style.fontWeight = "bold";
          const undoBtn = document.createElement("button");
          undoBtn.textContent = "\u2715";
          undoBtn.title = "Clear selection";
          undoBtn.style.cssText = "font-size:0.75rem;cursor:pointer;padding:0 0.3rem;margin-left:auto;";
          undoBtn.addEventListener("click", () => setRowUnresolved());
          selRow.appendChild(selA);
          const viaBadge = makeViaBadge(r.logEntry?.via, r.logEntry?.fromCache);
          if (viaBadge) selRow.appendChild(viaBadge);
          const mbRolesEl = buildMbRolesEl();
          if (mbRolesEl) selRow.appendChild(mbRolesEl);
          selRow.appendChild(undoBtn);
          candidateList.appendChild(selRow);
          renderActions(fakeA);
        } else if (r.nameMatches && r.nameMatches.length > 0) {
          r.nameMatches.forEach((a) => candidateList.appendChild(makeCandidateRow(a)));
          renderActions(null);
        } else {
          const none = document.createElement("div");
          none.style.cssText = "font-size:0.82rem;color:#888;";
          none.textContent = needsAttention ? "No suggestions \u2014 search or create" : "";
          if (needsAttention) candidateList.appendChild(none);
          renderActions(null);
        }
      });
      table.appendChild(tbody);
      panel.appendChild(table);
      const btnRow = document.createElement("div");
      btnRow.style.cssText = "display:flex;gap:0.75rem;align-items:center;margin-top:0.75rem;flex-wrap:wrap;";
      const importBtn = document.createElement("button");
      importBtn.style.cssText = "border:none;padding:0.4rem 1.1rem;border-radius:0.3rem;cursor:pointer;font-weight:bold;font-size:0.95rem;display:inline-flex;align-items:center;gap:5px;";
      const issueNote = document.createElement("span");
      issueNote.className = "discogs-issue-note";
      issueNote.style.cssText = "font-size:0.85rem;color:#7a5c00;";
      let _jumpIdx = -1;
      function jumpNextUnresolved() {
        const n = allResults.length;
        let found = -1;
        for (let step = 1; step <= n; step++) {
          const i = (_jumpIdx + step) % n;
          if (!rowState.get(keyOf(allResults[i]))?.confirmed) {
            found = i;
            break;
          }
        }
        if (found === -1) return;
        _jumpIdx = found;
        const input = rowSearchInputs.get(keyOf(allResults[found]));
        if (!input) return;
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }
        input.select?.();
      }
      issueNote.addEventListener("click", jumpNextUnresolved);
      function updateImportBtn() {
        const unresolved = [...rowState.values()].filter((s) => !s.confirmed).length;
        if (unresolved === 0) {
          importBtn.innerHTML = sourceIcon + " Start import \u2192";
          importBtn.style.background = "#2ecc40";
          importBtn.style.color = "#fff";
          issueNote.textContent = "";
          issueNote.classList.remove("clickable");
          issueNote.removeAttribute("title");
        } else {
          importBtn.innerHTML = sourceIcon + ` Start import anyway \u2192`;
          importBtn.style.background = "#e0a800";
          importBtn.style.color = "#fff";
          issueNote.textContent = `\u26A0 ${unresolved} unresolved`;
          issueNote.classList.add("clickable");
          issueNote.title = "Jump to the next unresolved entity \u2014 click again to cycle through them; these will be skipped on import";
        }
      }
      updateImportBtn();
      function buildStaticTableLi() {
        const tbl = document.createElement("table");
        tbl.style.cssText = "border-collapse:collapse;width:100%;font-size:0.78rem;margin:0.4rem 0;";
        const thRow = document.createElement("tr");
        thRow.style.background = "#f5f5f5";
        [importSourceName + " entity", "Roles / Tracks", "MB match", "MBID", "Resolved via"].forEach((h) => {
          const th = document.createElement("th");
          th.style.cssText = "text-align:left;padding:0.2rem 0.4rem;border:1px solid #ddd;white-space:nowrap;";
          th.textContent = h;
          thRow.appendChild(th);
        });
        tbl.appendChild(thRow);
        allResults.forEach((r) => {
          const _rKey = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
          const state = rowState.get(_rKey) || {};
          const tr2 = document.createElement("tr");
          const url = r.entity?.resource_url || r.entity?._syntheticKey || "";
          const rolesList2 = url ? rolesMap.get(url) || companiesRolesMap.get(url) || [] : [];
          const grouped2 = /* @__PURE__ */ new Map();
          rolesList2.forEach(({ displayLabel, linkType, trackPos }) => {
            const key = displayLabel || linkType;
            if (!grouped2.has(key)) grouped2.set(key, /* @__PURE__ */ new Set());
            if (trackPos) grouped2.get(key).add(trackPos);
          });
          const rolesText = [...grouped2.entries()].map(([label, tr]) => label + (tr.size ? " [" + [...tr].join(",") + "]" : "")).join("; ");
          const mbid = state.mbUrl ? state.mbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36) : "";
          const matchText = state.mbName || (state.mbUrl ? mbid : "");
          const vCfg = state.via ? viaCfg(state.via, state.fromCache) : null;
          const viaText = vCfg ? vCfg.text : state.mbUrl ? "\u2014" : "";
          [r.displayName || r.entity?.name, rolesText, matchText, mbid, viaText].forEach((val, ci) => {
            const td = document.createElement("td");
            td.style.cssText = "padding:0.15rem 0.4rem;border:1px solid #ddd;" + (ci === 2 && !val ? "color:#aaa;" : ci === 2 ? "color:#060;" : ci === 4 && vCfg ? `color:${vCfg.color};` : "");
            if (ci === 2 && mbid) {
              const a = document.createElement("a");
              a.href = "https:" + state.mbUrl;
              a.target = "_blank";
              a.rel = "noopener noreferrer nofollow";
              a.textContent = val || mbid;
              td.appendChild(a);
            } else {
              td.textContent = val || (ci === 1 ? "" : ci === 2 ? "\u2014" : "");
            }
            tr2.appendChild(td);
          });
          tbl.appendChild(tr2);
        });
        const tblLi = document.createElement("li");
        tblLi.style.cssText = "list-style:none;margin:0;padding:0;";
        tblLi.appendChild(tbl);
        return tblLi;
      }
      importBtn.addEventListener("click", () => {
        const confirmedMap = /* @__PURE__ */ new Map();
        rowState.forEach((s, key) => {
          if (s.mbUrl) confirmedMap.set(key, s.mbUrl);
        });
        getLogContainer().appendChild(buildStaticTableLi());
        const unresolvedCount = allResults.filter((r) => {
          const _k = r.entity?.resource_url || r.entity?._syntheticKey || `_nourl_${r.entity?.name || r.displayName}`;
          return !rowState.get(_k)?.confirmed;
        }).length;
        if (unresolvedCount > 0) {
          const unresolvedLi = document.createElement("li");
          unresolvedLi.style.cssText = "list-style:none;margin:0.2rem 0;font-size:0.82rem;color:#a06000;";
          unresolvedLi.textContent = `\u26A0 ${unresolvedCount} entity/entities unresolved \u2014 will be skipped`;
          getLogContainer().appendChild(unresolvedLi);
        }
        confirmedMap.unresolvedCount = unresolvedCount;
        confirmedMap.totalEntities = allResults.length;
        confirmedMap.creditOverrides = creditOverrides;
        (panelLi || panel).remove();
        if (headerSlot) headerSlot.replaceChildren();
        resolve(confirmedMap);
      });
      if (headerSlot) {
        headerSlot.replaceChildren(importBtn, issueNote);
      } else {
        btnRow.appendChild(importBtn);
        btnRow.appendChild(issueNote);
        panel.appendChild(btnRow);
      }
      const panelLi = document.createElement("li");
      panelLi.style.cssText = "list-style:none;margin:0;padding:0;";
      panelLi.classList.add("discogs-review-panel-li");
      panelLi._buildStaticTableLi = buildStaticTableLi;
      panelLi.appendChild(panel);
      getReviewContainer().appendChild(panelLi);
      panelLi.scrollIntoView({ behavior: "smooth", block: "nearest" });
      _hideBar();
    });
  }

  // src/editor-state.js
  async function waitForMBEditor(timeoutMs = 15e3) {
    log.info("Waiting for MB relationship editor\u2026");
    let waited = 0;
    while (waited < timeoutMs) {
      const MB = pageWindow.MB;
      const re = MB?.relationshipEditor;
      const st = re?.state;
      if (st?.entity) {
        log.info(`Editor ready (${waited}ms). Release: "${st.entity.name}"`);
        return re;
      }
      if (waited % 2e3 === 0 && waited > 0) {
        const mbKeys = MB ? Object.keys(MB).join(", ") : "undefined";
        const reKeys = re ? Object.keys(re).join(", ") : "undefined";
        const stKeys = st ? Object.keys(st).join(", ") : "undefined";
        log.info(`[${waited}ms] MB={${mbKeys}} re={${reKeys}} state={${stKeys}}`);
      }
      await new Promise((r) => setTimeout(r, 200));
      waited += 200;
    }
    log.error("MB editor not ready after 15s \u2014 aborting");
    return null;
  }
  function dispatchRelationship(re, sourceEntity, targetEntity, linkTypeID, credit, attributes, trackPos) {
    if (credit && credit === (targetEntity.name || "")) credit = "";
    const swapped = sourceEntity.entityType > targetEntity.entityType;
    const e0 = swapped ? targetEntity : sourceEntity;
    const e1 = swapped ? sourceEntity : targetEntity;
    const ltEntry = pageWindow.MB?.linkedEntities?.link_type?.[linkTypeID];
    const ltName = ltEntry ? ltEntry.name : linkTypeID;
    let attrDesc = "";
    if (attributes) {
      try {
        const parts = [];
        for (const a of pageWindow.MB.tree.iterate(attributes)) {
          const n = a.type?.name || a.typeID;
          const v = a.text_value ? `=${a.text_value}` : "";
          if (n) parts.push(n + v);
        }
        if (parts.length) attrDesc = ` [${parts.join(", ")}]`;
      } catch (e) {
      }
    }
    const posLabel = trackPos != null && trackPos !== "" ? ` <span style="color:#888;font-size:0.85em">#${trackPos}</span>` : "";
    log.info(`\u2192 <strong>${ltName}</strong>${attrDesc}${posLabel}: ${sourceEntity.name || sourceEntity.gid} \u2194 ${targetEntity.name || targetEntity.gid}${credit && credit !== (targetEntity.name || targetEntity.gid) ? ` (credited: ${credit})` : ""}`);
    re.dispatch({
      type: "update-relationship-state",
      sourceEntity,
      batchSelectionCount: null,
      creditsToChangeForSource: "",
      creditsToChangeForTarget: "",
      oldRelationshipState: null,
      newRelationshipState: {
        ...REL_TEMPLATE,
        entity0: e0,
        entity0_credit: swapped ? credit || "" : "",
        entity1: e1,
        entity1_credit: swapped ? "" : credit || "",
        id: re.getRelationshipStateId(),
        linkTypeID,
        attributes: attributes || null
      }
    });
  }
  function buildAttributes(rawAttributes) {
    if (!rawAttributes || rawAttributes.length === 0) return null;
    const MB = pageWindow.MB;
    const tree = MB?.tree;
    const lat = MB?.linkedEntities?.link_attribute_type;
    if (!tree || !lat) return null;
    function findAttrByName(name) {
      const lower = name.toLowerCase().trim();
      for (const v of Object.values(lat)) {
        if (v.name?.toLowerCase() === lower) return v;
      }
      if (lower.length >= 4) {
        for (const v of Object.values(lat)) {
          const vl = v.name?.toLowerCase() || "";
          if (vl.length < 4) continue;
          if (vl.includes(lower) || lower.includes(vl)) return v;
        }
      }
      log.warn(`Attribute "${name}" not found in MB \u2014 dropping attribute but keeping the rel`);
      return null;
    }
    function extractFnValue(fn) {
      const src = fn.toString();
      const m = src.match(/,\s*['"`]([^'"`]+)['"`]\s*\)/);
      return m ? m[1] : null;
    }
    const attrObjs = [];
    const seen = /* @__PURE__ */ new Set();
    for (const attr of rawAttributes) {
      let attrName = null;
      let textValue = "";
      let creditedAs = "";
      if (typeof attr === "string") {
        attrName = attr;
      } else if (attr && typeof attr === "object" && attr._type) {
        if (attr._type === "task") {
          attrName = "task";
          textValue = attr.value;
        } else {
          attrName = attr.value;
        }
        if (attr.creditedAs) creditedAs = attr.creditedAs;
      } else if (typeof attr === "function") {
        attrName = extractFnValue(attr);
      }
      if (!attrName) continue;
      const found = findAttrByName(attrName);
      if (!found || seen.has(found.id)) continue;
      seen.add(found.id);
      attrObjs.push({ type: found, typeID: found.id, credited_as: creditedAs, text_value: textValue });
    }
    if (attrObjs.length === 0) return null;
    attrObjs.sort((a, b) => a.typeID - b.typeID);
    try {
      return tree.fromDistinctAscArray(attrObjs);
    } catch (e) {
      log.warn(`Attribute tree build failed (${e.message}) \u2014 importing without attributes`);
      return null;
    }
  }

  // src/edit-note.js
  function buildEditNote(sourceUrl, opts, extraLines) {
    const s = GM_info.script;
    const mbUrl = location.href.split(/[?#]/)[0].replace(/\/edit-relationships$/, "");
    const homepage = s.homepageURL || s.homepage || "https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md";
    const header = s.name + " v" + s.version + " by " + s.author + " - " + homepage;
    const cleanSource = String(sourceUrl || "").split(/[?#]/)[0];
    const sourceName = /tidal\.com/i.test(cleanSource) ? "Tidal" : /qobuz\.com/i.test(cleanSource) ? "Qobuz" : "Discogs";
    const lines = [
      header,
      "",
      "Release URL: " + mbUrl,
      sourceName + " URL: " + cleanSource
    ];
    if (opts) lines.push("Options: " + opts);
    if (extraLines) lines.push(...Array.isArray(extraLines) ? extraLines : [extraLines]);
    return lines.join("\n");
  }
  function combineEditNote(existingNote, ourNote) {
    const headerPrefix = GM_info.script.name + " v";
    let base = String(existingNote || "");
    const lines = base.split("\n");
    const ourIdx = lines.findIndex((l) => l.startsWith(headerPrefix));
    if (ourIdx !== -1) base = lines.slice(0, ourIdx).join("\n");
    base = base.replace(/\s+$/, "");
    return base ? base + "\n\n" + ourNote : ourNote;
  }

  // src/data/work-only-rels.js
  var WORK_ONLY_ARTIST_RELS = [
    "writer",
    "composer",
    "lyricist",
    "librettist",
    "revised by",
    "translator",
    "reconstructed by",
    // 'arranger',
    // 'instruments arranger',
    "orchestrator",
    // 'vocals arranger',
    "previously attributed to",
    "miscellaneous support",
    "dedicated to",
    "premiered by",
    "was commissioned by",
    "publisher",
    // MB's actual link-type name for the music-publisher rel (label→work).
    // Tidal/Qobuz "Music Publisher" credits resolve to a label and attach here.
    "publishing",
    "inspired the name of"
  ];

  // src/dispatch.js
  function makeIdentifyingClassifier(lat) {
    const identifyingRoots = /* @__PURE__ */ new Set();
    if (lat) {
      for (const v of Object.values(lat)) {
        const isRoot = v.parent_id == null || v.parent_id === v.id;
        if (isRoot && /^(instrument|vocal)$/i.test(v.name || "")) identifyingRoots.add(v.id);
      }
    }
    const rootCache = /* @__PURE__ */ new Map();
    const rootIdOf = (typeID) => {
      if (rootCache.has(typeID)) return rootCache.get(typeID);
      let node = lat ? lat[typeID] : null;
      let guard = 0;
      while (node && node.parent_id != null && node.parent_id !== node.id && lat[node.parent_id] && guard++ < 64) {
        node = lat[node.parent_id];
      }
      const rootId = node ? node.id : typeID;
      rootCache.set(typeID, rootId);
      return rootId;
    };
    return (typeID) => identifyingRoots.has(rootIdOf(typeID));
  }
  async function dispatchAllRelationships(companies, artistRoles, tracklistRels, applyToTracks, createWorksMode, discogsTracklist, processTracklist, resolvedEntityTypes, confirmedMap, discogsUrl, dedupOpts) {
    resolvedEntityTypes = resolvedEntityTypes || /* @__PURE__ */ new Map();
    confirmedMap = confirmedMap || /* @__PURE__ */ new Map();
    dedupOpts = dedupOpts || {};
    const dedupeEquivalenceSets = dedupOpts.dedupeEquivalenceSets !== false;
    const dedupeDuplicateRoles = dedupOpts.dedupeDuplicateRoles !== false;
    const creditOverrides = dedupOpts.creditOverrides || /* @__PURE__ */ new Map();
    const re = await waitForMBEditor();
    if (!re) return;
    const MB = pageWindow.MB;
    const isIdentifyingAttr = makeIdentifyingClassifier(MB?.linkedEntities?.link_attribute_type);
    const equivalenceLookup = (() => {
      const m = /* @__PURE__ */ new Map();
      if (!dedupeEquivalenceSets || !MB?.linkedEntities?.link_type) return m;
      for (const set of EQUIVALENCE_SETS) {
        const byPair = /* @__PURE__ */ new Map();
        for (const [id, lt] of Object.entries(MB.linkedEntities.link_type)) {
          if (!lt?.name) continue;
          if (!set.includes(String(lt.name).toLowerCase())) continue;
          const key = `${lt.type0}|${lt.type1}`;
          if (!byPair.has(key)) byPair.set(key, []);
          byPair.get(key).push(Number(id));
        }
        for (const ids of byPair.values()) {
          if (ids.length < 2) continue;
          const sibSet = new Set(ids);
          for (const id of ids) m.set(id, sibSet);
        }
      }
      return m;
    })();
    const releaseEntity = re.state.entity;
    let added = 0, existedInMb = 0, dedupedThisSession = 0, skipped = 0, failed = 0;
    const dispatchedThisSession = /* @__PURE__ */ new Set();
    const RECORDING_LINK_TYPES = /* @__PURE__ */ new Set([
      "performer",
      "instrument",
      "vocal",
      "vocals",
      "orchestra",
      "conductor",
      "concertmaster",
      "chorus master",
      "producer",
      "engineer",
      "mix",
      "recording",
      "remixer",
      "DJ-mixer",
      "additional",
      "guest",
      "programming"
      // NOT 'mastering' — MB deprecated artist→recording mastering (link type 136).
    ]);
    const isExecProducer = (role) => role.linkType === "producer" && (role.attributes || []).some((a) => a === "executive" || a && a.value === "executive");
    log.info(`Starting instant fill: ${companies.length} companies, ${artistRoles.length} release artist roles, ${tracklistRels.length} tracklist roles`);
    try {
      _showBar();
    } catch (_) {
    }
    const bar = document.querySelector(".discogs-bar");
    function tickProgress() {
      const done = added + skipped + failed;
      const est = Math.max(done + 1, companies.length + artistRoles.length + tracklistRels.length);
      const pct = Math.min(Math.round(done / est * 99), 99);
      try {
        _setProgressPct(pct);
      } catch (_) {
      }
    }
    const recordingByGid = /* @__PURE__ */ new Map();
    const recordingByPosition = /* @__PURE__ */ new Map();
    const editorWorkByRecGid = /* @__PURE__ */ new Map();
    const positionByGid = /* @__PURE__ */ new Map();
    let trackCount = 0;
    try {
      let mediumIndex = 0;
      for (const [mediumKey, medium] of MB.tree.iterate(re.state.mediums)) {
        mediumIndex++;
        const tracks = medium?.tracks ?? medium;
        let trackIndex = 0;
        for (const rawTrack of MB.tree.iterate(tracks)) {
          const trackObj = Array.isArray(rawTrack) ? rawTrack[1] : rawTrack;
          const trackKey = Array.isArray(rawTrack) ? rawTrack[0] : null;
          const rec = trackObj?.recording ?? trackObj;
          if (!rec) continue;
          trackCount++;
          if (rec.gid) {
            recordingByGid.set(rec.gid, rec);
            positionByGid.set(rec.gid, `${mediumIndex}-${trackIndex + 1}`);
            const rw = trackObj?.relatedWorks;
            if (rw && rw.size > 0) {
              try {
                for (const entry of MB.tree.iterate(rw)) {
                  const raw = Array.isArray(entry) ? entry[1] : entry;
                  const work = raw?.work ?? raw;
                  if (work?.gid || work?.id) {
                    editorWorkByRecGid.set(rec.gid, work);
                    break;
                  }
                }
              } catch (e) {
              }
            }
          }
          const positions = new Set([
            trackObj?.position,
            trackObj?.number,
            rec?.position,
            rec?.number,
            trackKey,
            trackIndex + 1,
            // Compound keys: "mediumIndex-trackPosition"
            `${mediumIndex}-${trackIndex + 1}`,
            trackObj?.position != null ? `${mediumIndex}-${trackObj.position}` : null,
            trackObj?.number != null ? `${mediumIndex}-${trackObj.number}` : null
          ].filter((x) => x != null).map(String));
          for (const p of positions) recordingByPosition.set(p, rec);
          trackIndex++;
        }
      }
      log.info(`Found ${trackCount} track(s) in editor state (${recordingByGid.size} with GID, ${recordingByPosition.size} position entries: ${[...recordingByPosition.keys()].join(",")}). relatedWorks: ${editorWorkByRecGid.size} pre-linked`);
    } catch (e) {
      log.warn(`Iterating MB state: ${e.message}`);
    }
    const positionToGid = /* @__PURE__ */ new Map();
    try {
      const relMbid = releaseEntity.gid;
      log.info(`WS2: fetching recordings for release ${relMbid}\u2026`);
      const wsJson = await fetchWithRetry(`/ws/2/release/${relMbid}?inc=recordings&fmt=json`);
      log.info(`WS2: response received`);
      if (wsJson) {
        const mediaCount = wsJson.media?.length ?? 0;
        log.info(`WS2: ${mediaCount} medium/media in response`);
        const mediaArr = wsJson.media || [];
        const isMultiMedium2 = mediaArr.length > 1;
        for (const medium of mediaArr) {
          const medPos = medium.position;
          for (const track of medium.tracks || []) {
            const gid = track.recording?.id;
            if (!gid) continue;
            if (medPos != null && track.position != null) {
              positionToGid.set(`${medPos}-${track.position}`, gid);
            }
            if (medPos != null && track.number != null) {
              positionToGid.set(`${medPos}-${track.number}`, gid);
            }
            if (!isMultiMedium2) {
              if (track.position != null) positionToGid.set(String(track.position), gid);
              if (track.number != null) positionToGid.set(String(track.number), gid);
            }
          }
        }
        log.info(`WS2 position map: ${positionToGid.size} entries (${[...positionToGid.keys()].sort().join(", ")})`);
      }
    } catch (e) {
      log.warn(`WS2 recording fetch failed: ${e.message} \u2014 using editor state positions only`);
    }
    const isMultiMedium = positionToGid.size > 0 && [...positionToGid.keys()].some((k) => /^[2-9]-/.test(k));
    function inferDiscFromVinylSide(pos) {
      const m = String(pos || "").match(/^([A-Z])\d+$/i);
      if (!m) return null;
      return Math.floor((m[1].toUpperCase().charCodeAt(0) - 65) / 2) + 1;
    }
    function getRecordingEntity(track) {
      const stripPad = (s) => String(s).replace(/-0+(\d)/g, "-$1");
      const pos = track.position != null ? String(track.position) : "";
      const num = track.number != null ? String(track.number) : "";
      const compounds = /* @__PURE__ */ new Set();
      const plain = /* @__PURE__ */ new Set();
      if (/^\d+-/.test(pos)) {
        compounds.add(pos);
        const unpadded = stripPad(pos);
        if (unpadded !== pos) compounds.add(unpadded);
      } else if (pos) {
        plain.add(pos);
        const inferredDisc = inferDiscFromVinylSide(pos);
        if (inferredDisc != null) compounds.add(`${inferredDisc}-${pos}`);
        for (let m = 1; m <= 10; m++) compounds.add(`${m}-${pos}`);
      }
      if (num && num !== pos) {
        plain.add(num);
        for (let m = 1; m <= 10; m++) compounds.add(`${m}-${num}`);
      }
      const tryKeys = isMultiMedium ? [...compounds] : [...plain, ...compounds];
      for (const c of tryKeys) {
        const gid = positionToGid.get(c);
        if (gid) {
          const rec = recordingByGid.get(gid);
          if (rec) return rec;
          log.warn(`Recording ${gid} for track ${track.position} not in editor state`);
          return null;
        }
      }
      for (const c of tryKeys) {
        const rec = recordingByPosition.get(c);
        if (rec) return rec;
      }
      if (trackCount > 0) {
        const ws2Keys = positionToGid.size ? [...positionToGid.keys()].join(", ") : "(empty)";
        const stateKeys = recordingByPosition.size ? [...recordingByPosition.keys()].join(", ") : "(empty)";
        log.warn(`No recording for track ${track.position} "${track.title}". WS2 keys: ${ws2Keys} | State keys: ${stateKeys}`);
      }
      return null;
    }
    function confirmedMbUrl(entity) {
      if (!entity) return null;
      const direct = confirmedMap.get(entity.resource_url) || confirmedMap.get(entity._syntheticKey) || null;
      if (direct) return direct;
      if (entity.name) {
        return confirmedMap.get(`_nourl_${entity.name}`) || null;
      }
      return null;
    }
    function relAlreadyExists(sourceEntity, linkTypeID, targetGid, attrTree) {
      const rels = sourceEntity?.relationships;
      if (!Array.isArray(rels) || rels.length === 0) return null;
      const acceptableLinkTypes = equivalenceLookup.get(linkTypeID) || /* @__PURE__ */ new Set([linkTypeID]);
      const sigOf = (attrs) => attrs.map((a) => `${a.typeID}:${a.text_value || ""}:${a.credited_as || ""}`).sort().join(",");
      const idSigOf = (attrs) => attrs.filter((a) => isIdentifyingAttr(a.typeID)).map((a) => `${a.typeID}:${a.text_value || ""}:${a.credited_as || ""}`).sort().join(",");
      const candAttrs = (() => {
        if (!attrTree) return [];
        try {
          return [...pageWindow.MB.tree.iterate(attrTree)].map((a) => ({ typeID: a.typeID, text_value: a.text_value || "", credited_as: a.credited_as || "" }));
        } catch (e) {
          return [];
        }
      })();
      const candSig = sigOf(candAttrs);
      const candIdSig = idSigOf(candAttrs);
      const lookupName = (id) => {
        try {
          return pageWindow.MB.linkedEntities.link_type[id]?.name || `#${id}`;
        } catch (e) {
          return `#${id}`;
        }
      };
      let dupMatch = null;
      for (const r of rels) {
        if (!acceptableLinkTypes.has(r.linkTypeID)) continue;
        const tgt = r.target?.gid || r.entity0?.gid || r.entity1?.gid;
        if (tgt !== targetGid) continue;
        const isEquivalent = r.linkTypeID !== linkTypeID;
        const existingAttrs = (r.attributes || []).map((a) => ({ typeID: a.typeID, text_value: a.text_value || "", credited_as: a.credited_as || "" }));
        const exactMatch = sigOf(existingAttrs) === candSig;
        if (exactMatch) {
          return { kind: isEquivalent ? "equivalence" : "exact", existingLinkName: lookupName(r.linkTypeID) };
        }
        if (dedupeDuplicateRoles && !dupMatch && idSigOf(existingAttrs) === candIdSig) {
          dupMatch = { kind: isEquivalent ? "equivalence" : "duplicate-role", existingLinkName: lookupName(r.linkTypeID) };
        }
      }
      return dupMatch;
    }
    async function processOne(sourceEntity, entityType0, entityType1, linkTypeName, mbUrl, rawAttributes, credit, trackPos) {
      const overrideCredit = creditOverrides.get(mbUrl);
      if (overrideCredit && String(overrideCredit).trim()) {
        credit = String(overrideCredit).trim();
      }
      const mbid = mbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
      if (!mbid) {
        log.error(`Bad MBID URL: ${mbUrl}`);
        failed++;
        return;
      }
      const linkTypeID = resolveLinkTypeId(linkTypeName, entityType0, entityType1);
      if (!linkTypeID) {
        failed++;
        return;
      }
      const attrTree = buildAttributes(rawAttributes);
      const attrSig = attrTree ? (() => {
        try {
          return [...pageWindow.MB.tree.iterate(attrTree)].map((a) => (a.typeID || "") + (a.credited_as ? "~" + a.credited_as : "")).join(",");
        } catch (e) {
          return "";
        }
      })() : "";
      const sessionKey = `${sourceEntity.gid}|${linkTypeID}|${mbid}|${attrSig}`;
      if (dispatchedThisSession.has(sessionKey)) {
        log.info(`Skipped duplicate dispatch of <strong>${linkTypeName}</strong>: ${sourceEntity.name} \u2194 ${credit || ""} \u2014 already queued earlier this run`);
        dedupedThisSession++;
        return;
      }
      dispatchedThisSession.add(sessionKey);
      let targetEntity;
      try {
        targetEntity = await fetchMBEntity(mbid);
      } catch (e) {
        log.error(`Entity fetch failed for ${mbid}: ${e.message}`);
        failed++;
        return;
      }
      const PLACE_TO_LABEL_LINK = {
        "glass mastered at": "glass mastered",
        "mastered at": "mastering",
        "pressed at": "pressed",
        "manufactured at": "manufactured",
        "recorded at": "engineer",
        "mixed at": "mix"
      };
      const LABEL_TO_PLACE_LINK = Object.fromEntries(
        Object.entries(PLACE_TO_LABEL_LINK).map(([k, v]) => [v, k])
      );
      let resolvedLinkTypeID = linkTypeID;
      if (targetEntity.entityType !== entityType1 && targetEntity.entityType !== entityType0) {
        const at = targetEntity.entityType;
        const [rt0, rt1] = at < sourceEntity.entityType ? [at, sourceEntity.entityType] : [sourceEntity.entityType, at];
        let reResolved = resolveLinkTypeId(linkTypeName, rt0, rt1);
        if (!reResolved) {
          const altName = at === "label" ? PLACE_TO_LABEL_LINK[linkTypeName] : LABEL_TO_PLACE_LINK[linkTypeName];
          if (altName) reResolved = resolveLinkTypeId(altName, rt0, rt1);
        }
        if (reResolved) {
          resolvedLinkTypeID = reResolved;
        } else {
          log.warn(`Entity "${targetEntity.name}" is a ${targetEntity.entityType} but expected ${entityType0}/${entityType1} \u2014 link type "${linkTypeName}" may not apply`);
        }
      }
      const dedupHit = relAlreadyExists(sourceEntity, resolvedLinkTypeID, targetEntity.gid, attrTree);
      if (dedupHit) {
        const pair = `${sourceEntity.name} \u2194 ${targetEntity.name}${credit && credit !== targetEntity.name ? ` (credited: ${credit})` : ""}`;
        const existing = dedupHit.existingLinkName;
        if (dedupHit.kind === "equivalence") {
          log.info(`Deduplication (equivalence sets): <strong>${linkTypeName}</strong> not added \u2014 equivalent <strong>${existing}</strong> already on ${pair}`);
        } else if (dedupHit.kind === "duplicate-role") {
          log.info(`Deduplication (duplicate roles): <strong>${linkTypeName}</strong> not added \u2014 same role already exists with different attributes on ${pair}`);
        } else {
          log.info(`Already in MB: <strong>${linkTypeName}</strong>: ${pair}`);
        }
        existedInMb++;
        return;
      }
      dispatchRelationship(re, sourceEntity, targetEntity, resolvedLinkTypeID, credit, attrTree, trackPos);
      added++;
    }
    async function dispatchCompanies() {
      for (const company of companies) {
        const details = ENTITY_TYPE_MAP[company.entity_type_name];
        if (!details) continue;
        const resolvedEt = resolvedEntityTypes.get(company.resource_url) || details.entityType;
        if (resolvedEt !== details.entityType) {
          if (details.entityType === "place" && resolvedEt === "label") {
            log.warn(`Skipped ${company.name}: MB has no "${details.linkType}" relationship for labels (only places). Add manually if needed.`);
            skipped++;
            tickProgress();
            continue;
          }
        }
        const mbUrl = confirmedMbUrl(company);
        if (!mbUrl) {
          log.skip(`Skipped ${company.name} \u2014 not resolved in review`);
          skipped++;
          tickProgress();
          continue;
        }
        const et = resolvedEt;
        const [t0, t1] = et <= "release" ? [et, "release"] : ["release", et];
        await processOne(releaseEntity, t0, t1, details.linkType, mbUrl, [], "");
        tickProgress();
      }
    }
    async function dispatchReleaseArtists() {
      for (const role of artistRoles) {
        if (applyToTracks && RECORDING_LINK_TYPES.has(role.linkType) && !isExecProducer(role)) continue;
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const mbUrl = confirmedMbUrl(role.artist);
        if (!mbUrl) {
          log.skip(`Skipped ${role.artist.name} (${role.linkType}) \u2014 not resolved in review`);
          skipped++;
          tickProgress();
          continue;
        }
        const credit = role.creditedAs || role.artist.anv?.trim() || role.artist.name;
        await processOne(releaseEntity, "artist", "release", role.linkType, mbUrl, role.attributes || [], credit);
        tickProgress();
      }
    }
    async function dispatchTracklist() {
      if (applyToTracks && recordingByGid.size > 0) {
        const applicable = artistRoles.filter((role) => RECORDING_LINK_TYPES.has(role.linkType) && !WORK_ONLY_ARTIST_RELS.includes(role.linkType) && !isExecProducer(role));
        if (applicable.length > 0) {
          log.info(`Applying ${applicable.length} release credit(s) to ${recordingByGid.size} recording(s)\u2026`);
          for (const role of applicable) {
            const mbUrl = confirmedMbUrl(role.artist);
            if (!mbUrl) {
              log.skip(`Skipped ${role.artist.name} (${role.linkType}) in applyToTracks \u2014 not resolved in review`);
              continue;
            }
            const credit = role.creditedAs || role.artist.anv?.trim() || role.artist.name;
            for (const recEntity of recordingByGid.values()) {
              await processOne(recEntity, "artist", "recording", role.linkType, mbUrl, role.attributes || [], credit, positionByGid.get(recEntity.gid) || "*");
            }
          }
        }
      }
    }
    async function dispatchWorks() {
      const recordingOfLinkTypeId = resolveLinkTypeId("performance", "recording", "work");
      const includeOnlyResolved = createWorksMode === "when-needed";
      const workOnlyByGid = /* @__PURE__ */ new Map();
      for (const role of tracklistRels) {
        if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        if (includeOnlyResolved && !confirmedMbUrl(role.artist)) continue;
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
          log.error(`Work-only rel for track ${role.track.position} "${role.track.title}" \u2014 no recording found, skipped`);
          failed++;
          continue;
        }
        if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
        workOnlyByGid.get(recEntity.gid).push({ role, recEntity });
      }
      for (const role of artistRoles) {
        if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        if (includeOnlyResolved && !confirmedMbUrl(role.artist)) continue;
        for (const recEntity of recordingByGid.values()) {
          const syntheticRole = { ...role, track: { position: "", title: recEntity.name || "" } };
          if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
          workOnlyByGid.get(recEntity.gid).push({ role: syntheticRole, recEntity });
        }
      }
      if (createWorksMode === "when-missing" && recordingOfLinkTypeId) {
        for (const recEntity of recordingByGid.values()) {
          if (!workOnlyByGid.has(recEntity.gid)) {
            workOnlyByGid.set(recEntity.gid, []);
          }
        }
      }
      if (workOnlyByGid.size === 0) return;
      if (!recordingOfLinkTypeId) {
        log.error('Could not resolve "performance" link type \u2014 work processing skipped');
        return;
      }
      log.info(`Processing work relationships for ${workOnlyByGid.size} recording(s)\u2026`);
      const existingWorkByRecGid = editorWorkByRecGid;
      log.info(`Editor state: ${existingWorkByRecGid.size} recording(s) already have a linked work`);
      function getWorkFromEditorState(recEntity) {
        try {
          for (const rel of MB.tree.iterate(recEntity.relationships)) {
            if (rel._status === 1 && rel.linkTypeID === recordingOfLinkTypeId) {
              return rel.entity0?.entityType === "work" ? rel.entity0 : rel.entity1;
            }
          }
        } catch (e) {
        }
        return null;
      }
      for (const [recGid, entries] of workOnlyByGid) {
        const recEntity = entries[0]?.recEntity ?? recordingByGid.get(recGid);
        const trackTitle = entries[0]?.role.track.title || recEntity?.name || recGid;
        const trackPos = entries[0]?.role.track.position ?? "";
        if (!recEntity) continue;
        const hasExistingWork = editorWorkByRecGid.has(recGid);
        let workEntity = null;
        if (hasExistingWork) {
          workEntity = editorWorkByRecGid.get(recGid);
          const wid = workEntity.gid || workEntity.id;
          log.info(`Track ${trackPos} "${trackTitle}": work already linked (${workEntity.name || wid || "existing"}) \u2014 skipping creation`);
          if (!workEntity.gid && !workEntity.id) continue;
        }
        if (!workEntity) workEntity = getWorkFromEditorState(recEntity);
        if (!workEntity && createWorksMode === "never") {
          for (const { role } of entries) {
            log.error(`Track ${trackPos} "${trackTitle}": no work exists for ${role.linkType} (${role.artist.name}) \u2014 "Create works" is set to "never". Add the work manually or change the mode.`);
            failed++;
          }
          continue;
        }
        if (!workEntity) {
          const newWorkId = re.getRelationshipStateId();
          workEntity = {
            _fromBatchCreateWorksDialog: true,
            attributes: [],
            comment: "",
            editsPending: false,
            entityType: "work",
            gid: null,
            id: newWorkId,
            iswcs: [],
            languages: [],
            name: trackTitle,
            typeID: null
          };
          if (MB.mergeLinkedEntities) {
            MB.mergeLinkedEntities({ work: { [newWorkId]: workEntity } });
          }
          re.dispatch({
            type: "update-relationship-state",
            sourceEntity: recEntity,
            batchSelectionCount: null,
            creditsToChangeForSource: "",
            creditsToChangeForTarget: "",
            oldRelationshipState: null,
            newRelationshipState: {
              _lineage: ["batch-created work"],
              _original: null,
              _status: 1,
              attributes: null,
              begin_date: null,
              editsPending: false,
              end_date: null,
              ended: false,
              entity0: recEntity,
              entity0_credit: "",
              entity1: workEntity,
              entity1_credit: "",
              id: re.getRelationshipStateId(),
              linkOrder: 0,
              linkTypeID: recordingOfLinkTypeId
            }
          });
          log.info(`Track ${trackPos} "${trackTitle}": created new work "${trackTitle}"`);
          added++;
          tickProgress();
          workEntity = getWorkFromEditorState(recEntity) || workEntity;
        }
        for (const { role } of entries) {
          const mbUrl = confirmedMbUrl(role.artist);
          if (!mbUrl) {
            log.skip(`Skipped ${role.artist.name} \u2014 not resolved in review (${role.linkType})`);
            continue;
          }
          const credit = role.creditedAs || role.artist.anv?.trim() || role.artist.name;
          const srcType = role.entityType || "artist";
          if (workEntity.gid) {
            await processOne(workEntity, srcType, "work", role.linkType, mbUrl, role.attributes || [], credit, trackPos || entries[0]?.role?.track?.position);
          } else {
            const linkTypeID = resolveLinkTypeId(role.linkType, srcType, "work");
            if (linkTypeID) {
              const mbid = mbUrl.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
              try {
                const artistEntity = await fetchMBEntity(mbid);
                dispatchRelationship(re, workEntity, artistEntity, linkTypeID, credit, buildAttributes(role.attributes || []));
                added++;
              } catch (e) {
                log.error(`Failed to add ${role.linkType} for new work: ${e.message}`);
              }
            }
          }
        }
      }
    }
    async function dispatchTracklistArtists() {
      const seenTrackRels = /* @__PURE__ */ new Set();
      for (const role of tracklistRels) {
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const mbUrl = confirmedMbUrl(role.artist);
        if (!mbUrl) {
          log.skip(`Skipped ${role.artist.name} on track ${role.track.position} \u2014 not resolved in review`);
          continue;
        }
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
          log.warn(`No recording found for track ${role.track.position} "${role.track.title}" \u2014 skipped`);
          failed++;
          continue;
        }
        const credit = role.creditedAs || role.artist.anv?.trim() || role.artist.name;
        const attrKey = (role.attributes || []).map((a) => typeof a === "string" ? a : a.value || a._type || "").join(",");
        const trackRelKey = `${role.track.position}|${role.linkType}|${mbUrl}|${attrKey}`;
        if (seenTrackRels.has(trackRelKey)) continue;
        seenTrackRels.add(trackRelKey);
        log.info(`Track ${role.track.position} "${role.track.title}": adding <strong>${role.linkType}</strong> \u2014 ${credit}`);
        await processOne(recEntity, "artist", "recording", role.linkType, mbUrl, role.attributes || [], credit, role.track.position);
        tickProgress();
      }
    }
    await dispatchCompanies();
    await dispatchReleaseArtists();
    await dispatchTracklist();
    await dispatchWorks();
    await dispatchTracklistArtists();
    try {
      const opts = [
        processTracklist !== void 0 ? `per-track:${processTracklist ? "on" : "off"}` : null,
        applyToTracks !== void 0 ? `move-to-tracks:${applyToTracks ? "on" : "off"}` : null,
        createWorksMode !== void 0 ? `create-works:${createWorksMode}` : null
      ].filter(Boolean).join(", ");
      const trackCount2 = Array.isArray(discogsTracklist) ? discogsTracklist.length : 0;
      const inputStats = `Input: ${companies?.length || 0} companies, ${artistRoles?.length || 0} release credits, ${tracklistRels?.length || 0} tracklist credits on ${trackCount2} track${trackCount2 === 1 ? "" : "s"}`;
      const unresolvedCount = confirmedMap?.unresolvedCount || 0;
      const totalEntities = confirmedMap?.totalEntities || 0;
      const unresolvedLine = unresolvedCount > 0 ? `Unresolved: ${unresolvedCount} of ${totalEntities} entit${totalEntities === 1 ? "y" : "ies"} skipped in review` : null;
      const editNoteDedupPart = dedupedThisSession > 0 ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? "" : "s"}` : "";
      const resultStats = `Result: ${added} added, ${existedInMb} already in MB${editNoteDedupPart}, ${skipped} skipped, ${failed} failed`;
      const ourNote = buildEditNote(discogsUrl, opts, [inputStats, unresolvedLine, resultStats].filter(Boolean));
      const existingNote = document.querySelector(SELECTORS.EditNote)?.value || "";
      const note = combineEditNote(existingNote, ourNote);
      re.dispatch({ type: "update-edit-note", editNote: note });
    } catch (e) {
    }
    const dedupPart = dedupedThisSession > 0 ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? "" : "s"}` : "";
    log.info(`<strong>Done: ${added} added, ${existedInMb} already in MB${dedupPart}, ${skipped} skipped, ${failed} failed</strong>`);
  }

  // src/sources/qobuz.js
  var QOBUZ_ROLE_MAP = {
    "Composer": { target: "work", rel: "composer" },
    "Lyricist": { target: "work", rel: "lyricist" },
    "Author": { target: "work", rel: "lyricist" },
    "ComposerLyricist": { target: "work", rel: "writer" },
    "Writer": { target: "work", rel: "writer" },
    "Arranger": { target: "work", rel: "arranger" },
    "Producer": { target: "recording", rel: "producer" },
    "Co-Producer": { target: "recording", rel: "producer" },
    "Mixer": { target: "recording", rel: "mix" },
    "MixingEngineer": { target: "recording", rel: "mix" },
    "Engineer": { target: "recording", rel: "engineer" },
    "RecordingEngineer": { target: "recording", rel: "recording" },
    "MasteringEngineer": { target: "recording", rel: "mastering" },
    "Remixer": { target: "recording", rel: "remixer" },
    "Conductor": { target: "recording", rel: "conductor" },
    "MusicPublisher": { target: "work", rel: "publisher" },
    "MainArtist": null,
    "FeaturedArtist": null,
    "AssociatedPerformer": null,
    "StudioPersonnel": null,
    "Vocals": null
  };
  var QOBUZ_ALBUM_RE = /^(?:https?:)?\/\/(?:www\.|play\.|open\.)?qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/(?:[^/]+\/)?([a-z0-9]+)\/?(?:[?#]|$)/i;
  function parseQobuzAlbumUrl(url) {
    const m = QOBUZ_ALBUM_RE.exec(url || "");
    if (!m) return null;
    const original = String(url).replace(/^\/\//, "https://");
    const isStore = /^https?:\/\/(www\.)?qobuz\.com\/[a-z]{2}-[a-z]{2}\/album\//i.test(original);
    return { id: m[1], pageUrl: isStore ? original.split(/[?#]/)[0] : `https://www.qobuz.com/us-en/album/x/${m[1]}` };
  }
  function decodeEntities(s) {
    return String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
  }
  function parseQobuzCreditLine(line) {
    const out = [];
    for (const seg of String(line).split(" - ")) {
      const tokens = seg.split(",").map((t) => t.trim()).filter(Boolean);
      const firstRole = tokens.findIndex((t) => Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, t));
      if (firstRole === -1) {
        if (out.length) out[out.length - 1].name += " - " + seg.trim();
        continue;
      }
      const name = tokens.slice(0, firstRole).join(", ");
      const roles = tokens.slice(firstRole).filter((t) => Object.prototype.hasOwnProperty.call(QOBUZ_ROLE_MAP, t));
      if (name) out.push({ name, roles });
      else if (out.length) out[out.length - 1].roles.push(...roles);
    }
    return out;
  }
  function extractQobuzCredits(html) {
    const byTrack = /* @__PURE__ */ new Map();
    const re = /id="popinAddToCartBtnPlayerTrack(\d+)"|<p[^>]*class="[^"]*\btrack__info\b[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
    let m, current = 0;
    while ((m = re.exec(html)) !== null) {
      if (m[1] !== void 0) {
        current = parseInt(m[1], 10);
        continue;
      }
      const text = decodeEntities((m[2] || "").replace(/<[^>]+>/g, "").trim());
      if (!text || !current) continue;
      if (!byTrack.has(current)) byTrack.set(current, parseQobuzCreditLine(text));
    }
    return [...byTrack.entries()].sort((a, b) => a[0] - b[0]).map(([index, credits]) => ({ index, credits }));
  }
  function extractQobuzAlbumInfo(html) {
    const og = html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || "";
    return decodeEntities(og.replace(/ - Qobuz$/, ""));
  }
  function qobuzToEngine(parsedTracks) {
    const tracklistRels = [];
    const tracklist = [];
    const skipped = [];
    for (const t of parsedTracks) {
      const track = { position: String(t.index), title: "", type_: "track" };
      tracklist.push(track);
      for (const credit of t.credits) {
        for (const role of credit.roles) {
          if (role === "MusicPublisher") {
            if (!/^copyright control$/i.test(credit.name)) skipped.push(`track ${track.position}: MusicPublisher \u2014 ${credit.name}`);
            continue;
          }
          const plan = QOBUZ_ROLE_MAP[role];
          if (!plan) continue;
          tracklistRels.push({
            linkType: plan.rel,
            entityType: "artist",
            attributes: [],
            artist: { name: credit.name, anv: "", resource_url: "" },
            track
          });
        }
      }
    }
    return { tracklistRels, tracklist, skipped };
  }
  function fetchQobuzAlbumPage(pageUrl) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest unavailable"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: pageUrl,
        headers: { "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.8" },
        timeout: 2e4,
        onload: (r) => r.status >= 200 && r.status < 400 && r.responseText ? resolve(r.responseText) : reject(new Error(`Qobuz page returned ${r.status}`)),
        onerror: () => reject(new Error("Qobuz page fetch failed (network)")),
        ontimeout: () => reject(new Error("Qobuz page fetch timed out"))
      });
    });
  }

  // src/ui-bar.js
  var _logs2;
  var _summary;
  var _discogsJson = null;
  var _tidalJson = null;
  var _qobuzJson = null;
  var SRC_ICON = {
    Discogs: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/></svg>',
    Tidal: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 5l3 3-3 3-3-3zM12 5l3 3-3 3-3-3zM18 5l3 3-3 3-3-3zM12 11l3 3-3 3-3-3z"/></svg>',
    Qobuz: '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#0070ef"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M14.5 14.5 19 19" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>'
  };
  var srcIconByUrl = (url) => SRC_ICON[sourceNameForUrl(url)] || "";
  function insertDiscogsBar(discogsUrl, sources = {}) {
    const style = document.createElement("style");
    style.innerText = `
        .discogs-bar {
            font-family: inherit;
            background: #fff;
            border: 1px solid #e0c88a;
            border-left: 4px solid #e8771d;
            border-radius: 0.35rem;
            margin-bottom: 1rem;
            overflow: hidden;
        }
        .discogs-bar-row1 {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            row-gap: 0.4rem;
            flex-wrap: wrap;
            padding: 0.5rem 0.75rem;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
        }
        /* inline options strip in the single bar (#139) */
        .discogs-bar-opts { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
        .discogs-bar-opts .discogs-opts-label { font-size: 0.75rem; color: #999; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .discogs-opts-btn { font-size: 0.8rem; color: #555; background: #fffdf7; border: 1px solid #d8c8a0; border-radius: 2rem; padding: 0.15rem 0.6rem; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem; }
        .discogs-opts-btn:hover { border-color: #e8771d; color: #333; }
        .discogs-opts-caret { color: #999; font-size: 0.7rem; }
        /* "Options \u25BE" popover (Dedup toggles) */
        .discogs-opts-panel { position: fixed; z-index: 100002; display: none; flex-direction: column; gap: 0.4rem; background: #fff; border: 1px solid #d8c8a0; border-radius: 0.4rem; box-shadow: 0 6px 22px rgba(40,20,80,0.18); padding: 0.55rem 0.6rem; font-family: inherit; }
        .discogs-opts-panel.open { display: flex; }
        .discogs-opts-panel .discogs-opts-panel-hd { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: #999; font-weight: 600; }
        /* "Log" header toggle \u2014 a split button (#142, #217): "Log" toggles, the
           \u25BE half (its own clickable target) opens the copy menu. */
        .discogs-log-split { display: inline-flex; align-items: stretch; }
        .discogs-logtoggle-btn { font-size: 0.78rem; color: #555; background: #fff; border: 1px solid #cfcfcf; border-radius: 0.25rem 0 0 0.25rem; border-right: none; padding: 0.15rem 0.55rem; cursor: pointer; display: inline-flex; align-items: center; white-space: nowrap; }
        .discogs-log-caret-btn { font-size: 0.78rem; color: #777; background: #fff; border: 1px solid #cfcfcf; border-radius: 0 0.25rem 0.25rem 0; padding: 0.15rem 0.45rem; cursor: pointer; display: inline-flex; align-items: center; }
        .discogs-logtoggle-btn:hover, .discogs-log-caret-btn:hover { border-color: #999; }
        .discogs-log-caret-btn:hover { background: #f6f3fc; }
        .discogs-log-split.active .discogs-logtoggle-btn, .discogs-log-split.active .discogs-log-caret-btn { background: #f0ecfa; border-color: #b9a4e0; color: #5a3e94; }
        /* "Log \u25BE" dropdown menu (#118): show/hide + the three copy actions. */
        .discogs-log-menu { position: fixed; z-index: 100002; display: none; flex-direction: column; min-width: 11rem; background: #fff; border: 1px solid #cfcfcf; border-radius: 0.4rem; box-shadow: 0 6px 22px rgba(40,20,80,0.18); padding: 0.3rem; font-family: inherit; }
        .discogs-log-menu.open { display: flex; }
        .discogs-log-menu button { text-align: left; font-size: 0.82rem; color: #444; background: none; border: none; border-radius: 0.25rem; padding: 0.3rem 0.5rem; cursor: pointer; white-space: nowrap; }
        .discogs-log-menu button:hover { background: #f0ecfa; color: #333; }
        /* log panel toolbar: severity filter + copy buttons */
        .discogs-log-toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; padding: 0.3rem 0 0.45rem; }
        .discogs-log-filter { display: inline-flex; border: 1px solid #ddd; border-radius: 0.3rem; overflow: hidden; }
        .discogs-log-filterbtn { font-size: 0.75rem; color: #666; background: #fff; border: none; border-right: 1px solid #eee; padding: 0.15rem 0.55rem; cursor: pointer; }
        .discogs-log-filterbtn:last-child { border-right: none; }
        .discogs-log-filterbtn:hover { background: #f6f3fc; }
        .discogs-log-filterbtn.active { background: #5f3ec0; color: #fff; }
        .discogs-log-copyslot { display: inline-flex; gap: 0.4rem; margin-left: auto; }
        .discogs-log-copybtn { font-size: 0.78rem; color: #555; background: #fff; border: 1px solid #cfcfcf; border-radius: 0.25rem; padding: 0.15rem 0.5rem; cursor: pointer; white-space: nowrap; }
        .discogs-log-copybtn:hover { border-color: #999; }
        .discogs-bar img.discogs-logo {
            height: 20px;
            width: auto;
            flex-shrink: 0;
            opacity: 0.85;
        }
        .discogs-bar .discogs-source-icon { display: inline-flex; align-items: center; flex-shrink: 0; }
        .discogs-bar .discogs-source-icon:hover .discogs-logo { opacity: 1; }
        .discogs-bar .discogs-source {
            flex: 0 1 auto;
            max-width: 20rem;
            font-size: 0.82rem;
            color: #555;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        /* Slot in the always-visible header that hosts the review "Start import"
           button + unresolved message (#139). Content-sized; the right cluster's
           margin-left:auto does the pushing so the link/help stay right even when
           this slot is empty (initial state). */
        .discogs-bar-action {
            flex: 0 1 auto;
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 0.6rem;
        }
        .discogs-bar-action:empty { display: none; }
        /* Reserved message area (#118): badge + transient status, right-aligned
           just left of the Discogs/Help/Log cluster. margin-left:auto pushes
           it (and the right cluster after it) to the edge, leaving the gap up to
           the "Options" button free for these messages. Collapses to nothing
           when empty (hidden children don't count as flex items, so the gap
           contributes no width). */
        /* #139: grow to fill the gap between "Options" and the right cluster so the
           status message can use that whole width (right-aligned next to the cluster).
           flex:1 also keeps the right cluster pinned to the edge whether this is empty
           or not \u2014 replacing the old margin-left:auto. Basis 0 (not auto) is essential:
           with an auto basis a very long message's content width is used for row1's
           wrap calculation and bumps the whole slot to a second row; basis 0 keeps it
           on the line and the status just ellipsises inside it. */
        .discogs-bar-msgs {
            flex: 1 1 0;
            justify-content: flex-end;
            display: flex;
            align-items: center;
            gap: 0.4rem;
            min-width: 0;
        }
        /* #139: no fixed cap \u2014 the message takes the available space up to "Options"
           and only ellipsises when it genuinely doesn't fit (flex-shrink + min-width:0). */
        .discogs-bar-status {
            font-size: 0.8rem;
            color: #888;
            flex: 0 1 auto;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        /* #216: persistent end-of-run message (e.g. "No importable credits found") */
        .discogs-bar-status-final {
            color: #b26a00;
            font-weight: 600;
        }
        /* Count badges. Buttons so they can focus/open the log; styled as pills.
           Borderless + a touch larger per #139; the (deepened) fill carries them. */
        .discogs-badge {
            flex-shrink: 0;
            font-size: 0.9rem;
            font-weight: 600;
            line-height: 1.2;
            padding: 0.2rem 0.7rem;
            border-radius: 2rem;
            border: none;
            cursor: pointer;
            white-space: nowrap;
        }
        .discogs-badge-warn      { color: #8a4b00; background: #ffe1a8; }
        .discogs-badge-warn:hover{ background: #ffd68a; }
        .discogs-badge-err       { color: #9c1b1b; background: #f9c9c9; }
        .discogs-badge-err:hover { background: #f5b4b4; }
        .discogs-badge-unresolved{ color: #6a4a86; background: #e3d8f5; }
        .discogs-badge-unresolved:hover { background: #d6c6f0; }
        /* Discogs logo + Help + Log \u2014 pinned to the right edge (the msgs slot's
           margin-left:auto does the pushing). */
        .discogs-bar-right {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 0.6rem;
            min-width: 0;
        }
        /* During the review wait the import isn't running, so the "Importing\u2026"
           button + percentage are redundant \u2014 hide them; they reappear while a
           real import phase (preflight / dispatch) is active (#139). */
        .discogs-bar.is-reviewing .discogs-import-btn,
        .discogs-bar.is-reviewing #discogs-progress-pct { display: none !important; }   /* !important: the % span carries an inline display set by JS */
        .discogs-bar-action .discogs-issue-note {
            font-size: 0.85rem;
            color: #7a5c00;
            min-width: 7.5rem;   /* reserve space so the bar doesn't reflow as the count appears / changes (#139) */
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .discogs-bar-action .discogs-issue-note.clickable {
            cursor: pointer;
            text-decoration: underline dotted;
        }
        .discogs-bar-action .discogs-issue-note.clickable:hover { color: #a06000; }
        .discogs-bar .discogs-source a {
            color: #e8771d;
            text-decoration: none;
            font-weight: bold;
        }
        .discogs-bar .discogs-source a:hover { text-decoration: underline; }
        .discogs-import-btn {
            flex-shrink: 0;
            padding: 0.3rem 1rem;
            background: #e8771d;
            color: #fff;
            border: none;
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.88rem;
            font-weight: bold;
            letter-spacing: 0.01em;
        }
        .discogs-import-btn:hover { background: #cf6618; }
        .discogs-import-btn:disabled { background: #c8a070; cursor: default; }
        .discogs-import-btn svg { vertical-align: -2px; margin-right: 2px; }
        /* split button (#193): main + attached caret read as one control */
        .discogs-import-split { display: inline-flex; align-items: stretch; }
        .discogs-import-btn.has-caret { border-top-right-radius: 0; border-bottom-right-radius: 0; }
        .discogs-import-caret { border-top-left-radius: 0; border-bottom-left-radius: 0; border-left: 1px solid rgba(255,255,255,.4); padding-left: 0.4rem; padding-right: 0.55rem; font-weight: normal; }
        .discogs-log-menu button svg { vertical-align: -2px; margin-right: 4px; }
        .discogs-bar-row2 {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.35rem 0.75rem;
            flex-wrap: wrap;
        }
        .discogs-bar-row2 .discogs-opts-label {
            font-size: 0.75rem;
            color: #999;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-right: 0.2rem;
            flex-shrink: 0;
        }
        /* Borderless toggles (#118): no pill outline/background \u2014 the dot alone
           signals on/off, matching the maintainer's mockup. */
        .discogs-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.15rem 0.4rem 0.15rem 0.2rem;
            border: none;
            border-radius: 2rem;
            background: transparent;
            cursor: pointer;
            font-size: 0.8rem;
            color: #555;
            user-select: none;
            transition: color 0.12s;
        }
        .discogs-toggle:hover { color: #222; }
        .discogs-toggle input[type=checkbox] { display: none; }
        .discogs-toggle .discogs-toggle-dot {
            width: 14px; height: 14px;
            border-radius: 50%;
            border: 2px solid #bbb;
            background: #fff;
            flex-shrink: 0;
            transition: border-color 0.12s, background 0.12s;
        }
        .discogs-toggle.active {
            color: #333;
        }
        .discogs-toggle.active .discogs-toggle-dot {
            border-color: #e8771d;
            background: #e8771d;
        }
        .discogs-output { padding: 0.5rem 0.75rem 0.25rem; }
        .discogs-output.empty { display: none; }   /* no log yet \u2192 hide the whole section (#142) */
        .discogs-output .summary { margin: 0 0 0.25rem; font-size: 0.88rem; color: #555; }
        .discogs-output .logs { margin: 0; padding-left: 1.2rem; font-size: 0.83rem; }
        /* log panel hides behind the header "Log \u25BE" button (#142); the review
           panel sits in .discogs-review-slot OUTSIDE the panel, always visible. */
        .discogs-log-panel { display: none; }
        .discogs-output.log-open .discogs-log-panel { display: block; }
        .discogs-review-slot:not(:empty) { margin: 0.2rem 0; }
        /* severity filter: Warnings shows only warn lines, Errors only error
           lines \u2014 each view matches its header badge count. "skip" lines
           (unresolved-entity skips, #118) and info lines show only under
           "All"; errors are NOT lumped into the Warnings view. */
        .discogs-output[data-logfilter="warn"] .discogs-log-body .logs > li:not([data-sev="warn"]) { display: none; }
        .discogs-output[data-logfilter="error"] .discogs-log-body .logs > li:not([data-sev="error"]) { display: none; }
        /* \u2500\u2500 Progress / sticky bar \u2500\u2500 */
        /* Pinned during import (is-importing) AND kept pinned afterwards
           (is-pinned, #118) so the WARN/ERR badge stays visible on top while the
           user scrolls the staged edits below. overflow:hidden on .discogs-bar
           rules out position:sticky, so we use fixed + an in-flow spacer that
           reserves row1's height (see .discogs-sticky-spacer). */
        .discogs-bar.is-importing .discogs-bar-row1,
        .discogs-bar.is-pinned .discogs-bar-row1 {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9000;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        /* Occupies row1's height in the flow while row1 is fixed, so the page
           content below the bar doesn't jump up under it. Height set by JS. */
        .discogs-sticky-spacer { display: none; }
        .discogs-bar.is-importing .discogs-sticky-spacer,
        .discogs-bar.is-pinned .discogs-sticky-spacer { display: block; }
        .discogs-progress-track {
            height: 5px;
            background: #eeddb0;
            border-radius: 3px;
            overflow: hidden;
        }
        .discogs-progress-fill {
            height: 100%;
            width: 0%;
            background: #e8771d;
            border-radius: 3px;
            transition: width 0.3s ease;
        }
        .discogs-progress-fill.indeterminate {
            width: 40%;
            animation: discogs-slide 1.4s ease-in-out infinite;
        }
        @keyframes discogs-slide {
            0%   { margin-left: -40%; }
            100% { margin-left: 100%; }
        }
        .discogs-progress-status {
            font-size: 0.8rem;
            color: #7a5000;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-recent-logs {
            font-size: 0.78rem;
            color: #888;
            max-height: 3.2rem;
            overflow: hidden;
            line-height: 1.4;
        }
        .discogs-recent-logs span {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .discogs-toggle { position: relative; }
        /* position:fixed so the tooltip escapes .discogs-bar's
           overflow:hidden (needed there to clip child backgrounds to
           the bar's rounded corners). Per-hover JS in makeCheckbox
           sets top/left from the toggle's viewport rect, so the
           tooltip renders outside any overflow-clipping ancestor.
           Issue #89. */
        .discogs-tooltip {
            display: none;
            position: fixed;
            background: #333;
            color: #fff;
            font-size: 0.78rem;
            line-height: 1.45;
            padding: 0.45rem 0.65rem;
            border-radius: 0.3rem;
            white-space: normal;
            width: 220px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            pointer-events: none;
            z-index: 9999;
            text-align: left;
        }
        .discogs-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: var(--arrow-x, 50%);
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #333;
        }
        /* When the tooltip flipped below the toggle (no room above),
           flip the arrow to point up from the tooltip's top edge. */
        .discogs-tooltip.below::after {
            top: auto;
            bottom: 100%;
            border-top-color: transparent;
            border-bottom-color: #333;
        }
        /* Tooltip shown by JS adding .discogs-tooltip-visible after a
           hover-intent delay (see makeCheckbox). Native browser title=
           tooltips have a ~1s delay by convention; the custom tooltips
           used to fire instantly and felt jumpy when sweeping across
           toggles. */
        .discogs-tooltip.discogs-tooltip-visible { display: block; }
    `;
    document.head.appendChild(style);
    const bar = document.createElement("div");
    bar.className = "discogs-bar";
    const row1 = document.createElement("div");
    row1.className = "discogs-bar-row1";
    const importHtml = (s) => (SRC_ICON[s.name] || "") + " Import from " + s.name;
    const importSources = [];
    if (discogsUrl) importSources.push({ name: "Discogs", url: discogsUrl, run: (g) => runImport(discogsUrl, g) });
    if (sources.tidal) importSources.push({ name: "Tidal", url: sources.tidal, run: (g) => runTidalImport(sources.tidal, g) });
    if (sources.qobuz) importSources.push({ name: "Qobuz", url: sources.qobuz, run: (g) => runQobuzImport(sources.qobuz, g) });
    const multiSource = importSources.length > 1;
    const importSplit = document.createElement("span");
    importSplit.className = "discogs-import-split";
    const importBtn = document.createElement("button");
    importBtn.className = "discogs-import-btn" + (multiSource ? " has-caret" : "");
    importBtn.innerHTML = importHtml(importSources[0]);
    const importCaretBtn = document.createElement("button");
    importCaretBtn.className = "discogs-import-btn discogs-import-caret";
    importCaretBtn.textContent = "\u25BE";
    importCaretBtn.title = "Import from another source";
    if (!multiSource) importCaretBtn.style.display = "none";
    importSplit.append(importBtn, importCaretBtn);
    const progressPct = document.createElement("span");
    progressPct.id = "discogs-progress-pct";
    progressPct.style.cssText = "display:none; margin-left:0.5rem; font-size:0.85rem; color:#e8771d; font-weight:bold; min-width:3.5rem;";
    row1.appendChild(importSplit);
    row1.appendChild(progressPct);
    const actionSlot = document.createElement("div");
    actionSlot.className = "discogs-bar-action";
    row1.appendChild(actionSlot);
    const optsWrap = document.createElement("div");
    optsWrap.className = "discogs-bar-opts";
    row1.appendChild(optsWrap);
    let _optsHost = optsWrap;
    const msgSlot = document.createElement("div");
    msgSlot.className = "discogs-bar-msgs";
    const statusEl = document.createElement("span");
    statusEl.className = "discogs-bar-status";
    statusEl.style.display = "none";
    const warnPill = document.createElement("button");
    warnPill.type = "button";
    warnPill.className = "discogs-badge discogs-badge-warn";
    warnPill.style.display = "none";
    warnPill.title = "Show warnings in the log";
    const errPill = document.createElement("button");
    errPill.type = "button";
    errPill.className = "discogs-badge discogs-badge-err";
    errPill.style.display = "none";
    errPill.title = "Show errors in the log";
    const unresolvedPill = document.createElement("button");
    unresolvedPill.type = "button";
    unresolvedPill.className = "discogs-badge discogs-badge-unresolved";
    unresolvedPill.style.display = "none";
    unresolvedPill.title = "Entities not matched on MusicBrainz \u2014 skipped on import";
    msgSlot.append(statusEl, warnPill, errPill, unresolvedPill);
    row1.appendChild(msgSlot);
    const rightGroup = document.createElement("div");
    rightGroup.className = "discogs-bar-right";
    const logSplit = document.createElement("span");
    logSplit.className = "discogs-log-split";
    logSplit.style.display = "none";
    const logToggleBtn = document.createElement("button");
    logToggleBtn.type = "button";
    logToggleBtn.className = "discogs-logtoggle-btn";
    logToggleBtn.textContent = "Log";
    logToggleBtn.title = "Show / hide the import log";
    const logCaretBtn = document.createElement("button");
    logCaretBtn.type = "button";
    logCaretBtn.className = "discogs-log-caret-btn";
    logCaretBtn.textContent = "\u25BE";
    logCaretBtn.title = "More log actions (copy)";
    logSplit.append(logToggleBtn, logCaretBtn);
    const logoLink = document.createElement("a");
    logoLink.href = discogsUrl || sources.tidal || "#";
    logoLink.target = "_blank";
    logoLink.rel = "noopener noreferrer nofollow";
    logoLink.className = "discogs-source-icon";
    logoLink.title = discogsUrl || sources.tidal || "";
    if (!discogsUrl) logoLink.style.display = "none";
    const logo = document.createElement("img");
    logo.src = DISCOGS_LOGO_URL;
    logo.className = "discogs-logo";
    logo.alt = "Discogs";
    logoLink.appendChild(logo);
    const docsHref = typeof GM_info !== "undefined" && (GM_info?.script?.homepageURL || GM_info?.script?.homepage) || "https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/credit_hoarder/README.md";
    const docsLink = document.createElement("a");
    docsLink.href = docsHref;
    docsLink.target = "_blank";
    docsLink.rel = "noopener noreferrer nofollow";
    docsLink.textContent = "? Help";
    docsLink.title = "Open the script's README in a new tab";
    docsLink.style.cssText = "flex-shrink:0;font-size:0.82rem;color:#7a5000;text-decoration:none;padding:0.1rem 0.45rem;border:1px solid #d4b800;border-radius:0.25rem;background:#fff8e6;";
    const tidalLink = document.createElement("a");
    tidalLink.className = "discogs-source-icon";
    tidalLink.target = "_blank";
    tidalLink.rel = "noopener noreferrer nofollow";
    if (sources.tidal) {
      tidalLink.href = sources.tidal;
      tidalLink.title = sources.tidal;
      tidalLink.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#000" aria-label="Tidal" style="vertical-align:middle;"><path d="M6 5l3 3-3 3-3-3zM12 5l3 3-3 3-3-3zM18 5l3 3-3 3-3-3zM12 11l3 3-3 3-3-3z"/></svg>';
    } else {
      tidalLink.style.display = "none";
    }
    const qobuzLink = document.createElement("a");
    qobuzLink.className = "discogs-source-icon";
    qobuzLink.target = "_blank";
    qobuzLink.rel = "noopener noreferrer nofollow";
    if (sources.qobuz) {
      qobuzLink.href = sources.qobuz;
      qobuzLink.title = sources.qobuz;
      qobuzLink.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-label="Qobuz" style="vertical-align:middle;"><circle cx="12" cy="12" r="10" fill="#0070ef"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M14.5 14.5 L19 19" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>';
    } else {
      qobuzLink.style.display = "none";
    }
    rightGroup.append(logSplit, logoLink, tidalLink, qobuzLink, docsLink);
    row1.appendChild(rightGroup);
    bar.appendChild(row1);
    const stickySpacer = document.createElement("div");
    stickySpacer.className = "discogs-sticky-spacer";
    bar.appendChild(stickySpacer);
    bar._pin = () => {
      const h = row1.getBoundingClientRect().height;
      if (h) stickySpacer.style.height = h + "px";
    };
    window.addEventListener("resize", () => {
      if (bar.classList.contains("is-pinned")) bar._pin();
    });
    function makeCheckbox(labelText, checkedByDefault, tooltipText) {
      const lbl = document.createElement("label");
      lbl.className = "discogs-toggle" + (checkedByDefault ? " active" : "");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checkedByDefault;
      const dot = document.createElement("span");
      dot.className = "discogs-toggle-dot";
      lbl.appendChild(cb);
      lbl.appendChild(dot);
      lbl.appendChild(document.createTextNode(labelText));
      if (tooltipText) {
        const tip = document.createElement("span");
        tip.className = "discogs-tooltip";
        tip.textContent = tooltipText;
        lbl.appendChild(tip);
        const TIP_W = 220, TIP_MARGIN = 6, EDGE_PAD = 8;
        const HOVER_DELAY_MS = 1e3;
        let _showTimer, _hideTimer;
        lbl.addEventListener("mouseenter", () => {
          clearTimeout(_showTimer);
          _showTimer = setTimeout(() => {
            const r = lbl.getBoundingClientRect();
            const centerX = r.left + r.width / 2;
            let x = centerX - TIP_W / 2;
            x = Math.max(EDGE_PAD, Math.min(x, window.innerWidth - TIP_W - EDGE_PAD));
            tip.style.left = `${x}px`;
            tip.style.top = "-9999px";
            tip.classList.add("discogs-tooltip-visible");
            const h = tip.offsetHeight;
            const above = r.top - TIP_MARGIN - h;
            const fitsAbove = above >= EDGE_PAD;
            tip.style.top = fitsAbove ? `${above}px` : `${r.bottom + TIP_MARGIN}px`;
            tip.classList.toggle("below", !fitsAbove);
            tip.style.setProperty("--arrow-x", `${centerX - x}px`);
            clearTimeout(_hideTimer);
            _hideTimer = setTimeout(() => tip.classList.remove("discogs-tooltip-visible"), 4e3);
          }, HOVER_DELAY_MS);
        });
        lbl.addEventListener("mouseleave", () => {
          clearTimeout(_showTimer);
          clearTimeout(_hideTimer);
          tip.classList.remove("discogs-tooltip-visible");
        });
      }
      lbl.addEventListener("click", (e) => {
        e.preventDefault();
        cb.checked = !cb.checked;
        lbl.classList.toggle("active", cb.checked);
        document.querySelectorAll(".discogs-tooltip-visible").forEach((t) => t.classList.remove("discogs-tooltip-visible"));
      });
      _optsHost.appendChild(lbl);
      return cb;
    }
    function makeSelect(labelText, initialValue, options, tooltipText) {
      const wrap = document.createElement("span");
      wrap.className = "discogs-select-wrap";
      wrap.style.cssText = "display:inline-flex;align-items:center;gap:0.3rem;font-size:0.8rem;color:#555;padding:0.15rem 0.2rem;border:none;background:transparent;";
      const lbl = document.createElement("span");
      lbl.textContent = labelText + ":";
      wrap.appendChild(lbl);
      const sel = document.createElement("select");
      sel.style.cssText = "font-size:0.8rem;padding:0.05rem 0.2rem;border:none;background:transparent;cursor:pointer;color:#333;font-weight:600;";
      options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === initialValue) o.selected = true;
        sel.appendChild(o);
      });
      if (tooltipText) wrap.title = tooltipText;
      wrap.appendChild(sel);
      _optsHost.appendChild(wrap);
      return sel;
    }
    const OPTS_KEY = "discogs-importer-opts";
    let savedOpts = {};
    try {
      savedOpts = JSON.parse(localStorage.getItem(OPTS_KEY) || "{}");
    } catch (e) {
    }
    const bv = (k, d) => k in savedOpts ? savedOpts[k] : d;
    const tracklistCb = makeCheckbox(
      "Per-track credits",
      bv("tracklist", true),
      "Import per-track artist credits."
    );
    const applyTracksCb = makeCheckbox(
      "Move release credits to tracks",
      bv("applyTracks", false),
      "Move performance credits from the release down to every recording."
    );
    const _legacyCreateWorks = savedOpts.createWorks;
    const _initialCreateWorksMode = bv(
      "createWorksMode",
      _legacyCreateWorks === true ? "when-missing" : _legacyCreateWorks === false ? "never" : "when-needed"
    );
    const createWorksMode = makeSelect("Create works", _initialCreateWorksMode, [
      { value: "when-needed", label: "when needed" },
      { value: "when-missing", label: "when missing" },
      { value: "never", label: "never" }
    ], "when needed: create a work only when there is a composer/lyricist/writer credit to attach. when missing: create a work for every recording without one. never: do not create works \u2014 work-only credits with no existing work are logged and skipped.");
    const optsBtn = document.createElement("button");
    optsBtn.type = "button";
    optsBtn.className = "discogs-opts-btn";
    optsBtn.innerHTML = 'Options <span class="discogs-opts-caret">\u25BE</span>';
    optsBtn.title = "Deduplication options";
    const optsPanel = document.createElement("div");
    optsPanel.className = "discogs-opts-panel";
    const dedupHd = document.createElement("div");
    dedupHd.className = "discogs-opts-panel-hd";
    dedupHd.textContent = "Deduplication";
    optsPanel.appendChild(dedupHd);
    _optsHost = optsPanel;
    const dedupeEqCb = makeCheckbox(
      "Equivalence sets",
      bv("dedupeEquivalenceSets", true),
      "Skip a role when an equivalent role already exists on the target (writer \u2261 composer)."
    );
    const dedupeDupCb = makeCheckbox(
      "Duplicate roles",
      bv("dedupeDuplicateRoles", true),
      "Skip adding a role when the target already has the same role (regardless of task / dates / attributes)."
    );
    _optsHost = optsWrap;
    optsWrap.appendChild(optsBtn);
    document.body.appendChild(optsPanel);
    optsBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = optsPanel.classList.toggle("open");
      if (!open) return;
      const r = optsBtn.getBoundingClientRect();
      optsPanel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - optsPanel.offsetWidth - 8)) + "px";
      optsPanel.style.top = r.bottom + 4 + "px";
      const off = (ev) => {
        if (!optsPanel.contains(ev.target) && ev.target !== optsBtn && !optsBtn.contains(ev.target)) {
          optsPanel.classList.remove("open");
          document.removeEventListener("mousedown", off);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", off), 0);
    });
    const saveOpts = () => {
      try {
        localStorage.setItem(OPTS_KEY, JSON.stringify({
          tracklist: tracklistCb.checked,
          applyTracks: applyTracksCb.checked,
          createWorksMode: createWorksMode.value,
          dedupeEquivalenceSets: dedupeEqCb.checked,
          dedupeDuplicateRoles: dedupeDupCb.checked
        }));
      } catch (e) {
      }
    };
    [tracklistCb, applyTracksCb, dedupeEqCb, dedupeDupCb].forEach((cb) => cb.closest("label").addEventListener("click", () => setTimeout(saveOpts, 0)));
    createWorksMode.addEventListener("change", saveOpts);
    const outputDiv = document.createElement("div");
    outputDiv.className = "discogs-output empty";
    const LOG_OPEN_KEY = "discogs-importer-log-open";
    const reviewSlot = document.createElement("div");
    reviewSlot.className = "discogs-review-slot";
    setReviewContainer(reviewSlot);
    const logPanel = document.createElement("div");
    logPanel.className = "discogs-log-panel";
    const logToolbar = document.createElement("div");
    logToolbar.className = "discogs-log-toolbar";
    const logFilter = document.createElement("div");
    logFilter.className = "discogs-log-filter";
    [["all", "All"], ["warn", "\u26A0 Warnings"], ["error", "\u26D4 Errors"]].forEach(([f, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "discogs-log-filterbtn" + (f === "all" ? " active" : "");
      b.dataset.f = f;
      b.textContent = label;
      b.addEventListener("click", () => {
        outputDiv.dataset.logfilter = f;
        logFilter.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.f === f));
      });
      logFilter.appendChild(b);
    });
    logToolbar.append(logFilter);
    const logBody = document.createElement("div");
    logBody.className = "discogs-log-body";
    logPanel.append(logToolbar, logBody);
    outputDiv.append(reviewSlot, logPanel);
    outputDiv.dataset.logfilter = "all";
    const applyLogOpen = () => {
      const open = localStorage.getItem(LOG_OPEN_KEY) === "1";
      outputDiv.classList.toggle("log-open", open);
      logSplit.classList.toggle("active", open);
    };
    try {
      applyLogOpen();
    } catch (e) {
    }
    const setLogOpen = (open) => {
      outputDiv.classList.toggle("log-open", open);
      logSplit.classList.toggle("active", open);
      try {
        localStorage.setItem(LOG_OPEN_KEY, open ? "1" : "0");
      } catch (e) {
      }
    };
    const logMenu = document.createElement("div");
    logMenu.className = "discogs-log-menu";
    const mkMenuItem = (label, title, fn) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.addEventListener("click", () => fn(b, label));
      return b;
    };
    const copyLogItem = mkMenuItem("Copy log", "Copy the full import log (incl. the raw source data)", (b, l) => bar._copy?.log(b, l));
    const copyNoJsonItem = mkMenuItem("Copy without JSON", "Copy the log without the raw source-data block \u2014 fits in a GitHub issue", (b, l) => bar._copy?.noJson(b, l));
    logMenu.append(copyLogItem, copyNoJsonItem);
    if (discogsUrl) logMenu.appendChild(mkMenuItem("Copy Discogs", "Copy the raw Discogs JSON for this release", (b, l) => bar._copy?.discogs(b, l)));
    if (sources.tidal) logMenu.appendChild(mkMenuItem("Copy Tidal", "Copy the raw Tidal credits harvest for this release", (b, l) => bar._copy?.tidal(b, l)));
    if (sources.qobuz) logMenu.appendChild(mkMenuItem("Copy Qobuz", "Copy the parsed Qobuz credits for this release", (b, l) => bar._copy?.qobuz(b, l)));
    document.body.appendChild(logMenu);
    function openLogMenu() {
      const open = logMenu.classList.toggle("open");
      if (!open) return;
      const r = logSplit.getBoundingClientRect();
      logMenu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - logMenu.offsetWidth - 8)) + "px";
      logMenu.style.top = r.bottom + 4 + "px";
      const off = (ev) => {
        if (!logMenu.contains(ev.target) && !logSplit.contains(ev.target)) {
          logMenu.classList.remove("open");
          document.removeEventListener("mousedown", off);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", off), 0);
    }
    logToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      logMenu.classList.remove("open");
      setLogOpen(!outputDiv.classList.contains("log-open"));
    });
    logCaretBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openLogMenu();
    });
    function openLog(filter, scrollSel) {
      const f = filter || "all";
      outputDiv.classList.add("log-open");
      logSplit.classList.add("active");
      outputDiv.dataset.logfilter = f;
      logFilter.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x.dataset.f === f));
      requestAnimationFrame(() => {
        const target = scrollSel && logBody.querySelector(scrollSel) || logPanel;
        const headerH = bar.classList.contains("is-pinned") ? row1.getBoundingClientRect().height + 6 : 0;
        const top = target.getBoundingClientRect().top + window.scrollY - headerH - 10;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    }
    warnPill.addEventListener("click", () => openLog("warn", 'li[data-sev="warn"]'));
    errPill.addEventListener("click", () => openLog("error", 'li[data-sev="error"]'));
    unresolvedPill.addEventListener("click", () => openLog("all", 'li[data-sev="skip"]'));
    onLogCounts((w, e) => {
      warnPill.textContent = `\u26A0 ${w}`;
      warnPill.style.display = w > 0 ? "" : "none";
      errPill.textContent = `\u26D4 ${e}`;
      errPill.style.display = e > 0 ? "" : "none";
    });
    bar._setUnresolved = (n) => {
      unresolvedPill.textContent = `\u2298 ${n} unresolved`;
      unresolvedPill.style.display = n > 0 ? "" : "none";
    };
    bar._setStopMessage = (msg) => {
      bar._stopActive = !!msg;
      statusEl.textContent = msg || "";
      statusEl.style.display = msg ? "" : "none";
      statusEl.classList.toggle("discogs-bar-status-final", !!msg);
    };
    function startImport(srcBtn, restoreLabel, sourceUrl, runner) {
      importBtn.disabled = true;
      importCaretBtn.disabled = true;
      srcBtn.innerHTML = srcIconByUrl(sourceUrl) + " Importing\u2026";
      progressPct.style.display = "inline";
      progressPct.textContent = "0%";
      bar.classList.add("is-importing", "is-pinned");
      bar._pin();
      _showBar();
      bar.scrollIntoView({ behavior: "smooth", block: "start" });
      bar._showProgress = () => {
        _showBar();
      };
      requestAnimationFrame(bar._showProgress);
      resetLogCounts();
      bar._setUnresolved(0);
      bar._setStopMessage("");
      _logs2 = document.createElement("ul");
      _logs2.className = "logs";
      setLogContainer(_logs2);
      _summary = document.createElement("p");
      _summary.className = "summary";
      logBody.innerHTML = "";
      logBody.appendChild(_summary);
      logBody.appendChild(_logs2);
      outputDiv.classList.remove("empty");
      logSplit.style.display = "";
      try {
        applyLogOpen();
      } catch (e) {
      }
      function buildCopyText({ skipDiscogsJson }) {
        function htmlToMd(el) {
          function nodeToMd(node) {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            const tag = node.tagName?.toLowerCase();
            const inner = [...node.childNodes].map(nodeToMd).join("");
            if (tag === "strong" || tag === "b") return `**${inner}**`;
            if (tag === "em" || tag === "i") return `_${inner}_`;
            if (tag === "a") return `[${inner}](${node.href})`;
            if (tag === "br") return "\n";
            if (tag === "pre") {
              return "\n```json\n" + node.textContent + "\n```\n";
            }
            if (tag === "details") {
              const sum = node.querySelector("summary");
              const sumText = sum ? [...sum.childNodes].map((n) => {
                if (n.nodeType === Node.TEXT_NODE) return n.textContent;
                const t = n.tagName?.toLowerCase();
                if (t === "button" || t === "input") return "";
                return n.textContent;
              }).join("").trim() : "";
              if (skipDiscogsJson && /raw Discogs JSON/i.test(sumText)) {
                return "";
              }
              const body = [...node.childNodes].filter((n) => n !== sum).map(nodeToMd).join("");
              return "\n\n<details><summary>" + sumText + "</summary>\n\n" + body + "\n</details>\n\n";
            }
            if (tag === "summary") return "";
            if (tag === "span") return inner;
            if (tag === "div") return inner + "\n";
            if (tag === "ul") return inner;
            if (tag === "li" && el !== node) return "- " + inner + "\n";
            if (tag === "table") {
              const rows = [...node.querySelectorAll("tr")];
              if (!rows.length) return "";
              const cells = rows.map((r) => [...r.querySelectorAll("th,td")].map((c) => c.innerText.trim().replace(/\|/g, "\\|")));
              const widths = cells[0]?.map((_, i) => Math.max(...cells.map((r) => (r[i] || "").length), 3));
              const pad = (s, w) => s + " ".repeat(Math.max(0, w - s.length));
              const mdRows = cells.map((row) => "| " + row.map((c, i) => pad(c, widths[i])).join(" | ") + " |");
              if (mdRows.length > 1) mdRows.splice(1, 0, "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |");
              return "\n\n" + mdRows.join("\n") + "\n\n";
            }
            return inner;
          }
          const _md = nodeToMd(el);
          return _md.startsWith("\n\n") || _md.endsWith("\n\n") ? _md : _md.replace(/^\n/, "").replace(/\n$/, "");
        }
        const _panel = document.querySelector(".discogs-review-slot .discogs-review-panel-li");
        const lines = [..._panel ? [_panel] : [], ..._logs2.querySelectorAll("li")].map((li) => {
          if (li.classList?.contains("discogs-review-panel-li") && typeof li._buildStaticTableLi === "function") {
            return htmlToMd(li._buildStaticTableLi());
          }
          const md = htmlToMd(li);
          if (!md) return "";
          if (md.startsWith("\n\n|") || md.startsWith("<details>")) return md;
          return md + "  ";
        }).filter(Boolean).join("\n");
        const releaseName = pageWindow?.MB?.relationshipEditor?.state?.entity?.name || document.title.replace(/ - MusicBrainz.*/, "").trim() || "Import log";
        return `<details><summary>${releaseName}</summary>

${lines}

</details>`;
      }
      function copyToClipboard(text, btn, restoreText) {
        const restore = () => {
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = restoreText;
          }, 1500);
        };
        const fallback = () => {
          const ta = Object.assign(document.createElement("textarea"), { value: text });
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          restore();
        };
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(text).then(restore, fallback);
        } else {
          fallback();
        }
      }
      bar._copy = {
        log: (item, label) => copyToClipboard(buildCopyText({ skipDiscogsJson: false }), item, label),
        noJson: (item, label) => copyToClipboard(buildCopyText({ skipDiscogsJson: true }), item, label),
        discogs: (item, label) => {
          if (_discogsJson) copyToClipboard(JSON.stringify(_discogsJson, null, 2), item, label);
        },
        tidal: (item, label) => {
          if (_tidalJson) copyToClipboard(JSON.stringify(_tidalJson, null, 2), item, label);
        },
        qobuz: (item, label) => {
          if (_qobuzJson) copyToClipboard(JSON.stringify(_qobuzJson, null, 2), item, label);
        }
      };
      bar._setProgress = (pct, text) => {
        if (pct !== null && pct >= 100) _hideBar();
        if (text && bar.classList.contains("is-importing") && !bar._stopActive) {
          statusEl.textContent = text;
          statusEl.style.display = "";
        }
      };
      requestAnimationFrame(_showBar);
      const getOpts = () => ({
        processTracklist: tracklistCb.checked,
        applyToTracks: applyTracksCb.checked,
        createWorksMode: createWorksMode.value,
        dedupeEquivalenceSets: dedupeEqCb.checked,
        dedupeDuplicateRoles: dedupeDupCb.checked
      });
      const _click = getOpts();
      const opts = `per-track:${_click.processTracklist ? "on" : "off"}, move-to-tracks:${_click.applyToTracks ? "on" : "off"}, create-works:${_click.createWorksMode}`;
      const editNote = buildEditNote(sourceUrl, opts);
      editNote.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const html = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
        log.info(html);
      });
      runner(getOpts).finally(() => {
        importBtn.disabled = false;
        importCaretBtn.disabled = false;
        srcBtn.innerHTML = restoreLabel;
        progressPct.textContent = "100%";
        setTimeout(() => {
          progressPct.style.display = "none";
        }, 2e3);
        bar.classList.remove("is-reviewing");
        setTimeout(() => {
          bar.classList.remove("is-importing");
          _hideBar();
          bar._pin();
        }, 2e3);
        delete bar._setProgress;
      });
    }
    let srcMenu = null;
    if (multiSource) {
      srcMenu = document.createElement("div");
      srcMenu.className = "discogs-log-menu";
      for (const s of importSources.slice(1)) {
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = (SRC_ICON[s.name] || "") + " from " + s.name;
        b.title = s.url;
        b.addEventListener("click", () => {
          srcMenu.classList.remove("open");
          startImport(importBtn, importHtml(importSources[0]), s.url, s.run);
        });
        srcMenu.appendChild(b);
      }
      document.body.appendChild(srcMenu);
    }
    importBtn.addEventListener("click", () => startImport(importBtn, importHtml(importSources[0]), importSources[0].url, importSources[0].run));
    importCaretBtn.addEventListener("click", (e) => {
      if (!srcMenu) return;
      e.stopPropagation();
      const open = srcMenu.classList.toggle("open");
      if (!open) return;
      const r = importCaretBtn.getBoundingClientRect();
      srcMenu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - srcMenu.offsetWidth - 8)) + "px";
      srcMenu.style.top = r.bottom + 4 + "px";
      const off = (ev) => {
        if (!srcMenu.contains(ev.target) && ev.target !== importCaretBtn && !importCaretBtn.contains(ev.target)) {
          srcMenu.classList.remove("open");
          document.removeEventListener("mousedown", off);
        }
      };
      setTimeout(() => document.addEventListener("mousedown", off), 0);
    });
    bar.appendChild(outputDiv);
    function insertBar() {
      const anchor = document.querySelector(".release-rel-editor") || // MB React wrapper
      document.querySelector("#content > div") || // generic first content div
      document.querySelector("#content");
      if (!anchor) return setTimeout(insertBar, 300);
      anchor.insertBefore(bar, anchor.firstChild);
    }
    insertBar();
  }
  (function cleanupLocalStorage() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith("discogs-release-")) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
    }
  })();
  function runImport(discogsUrl, getOpts) {
    const initial = getOpts();
    const { processTracklist } = initial;
    return getDiscogsReleaseData(discogsUrl).then((json) => {
      _discogsJson = json;
      let artistRoles = rolesFromDiscogsArtists(json.extraartists?.filter((artist) => !artist.tracks));
      if (!_logs2._releaseInfoAdded) {
        _logs2._releaseInfoAdded = true;
        const trackCount = flattenTracklist(json.tracklist).filter((t) => t.type_ === "track").length;
        const summary = `${json.title || ""}${json.year ? " \xB7 " + json.year : ""} \xB7 ${trackCount} tracks`;
        const li = document.createElement("li");
        const pre = document.createElement("pre");
        pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:#f8f8f8;padding:0.5rem;border:1px solid #ddd;border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
        pre.textContent = JSON.stringify(json, null, 2);
        li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${summary} \u2014 raw Discogs JSON</strong></summary></details>`;
        li.querySelector("details").appendChild(pre);
        _logs2.appendChild(li);
      }
      log.info(`Found ${json.companies.length + artistRoles.length} release relationships`);
      artistRoles = artistRoles.concat(convertPotentialDJMixers(json));
      let tracklistRels = [];
      if (processTracklist) {
        tracklistRels = flattenTracklist(json.tracklist).filter((track) => track.type_ === "track").reduce((map, track) => {
          if (!track.extraartists || !Array.isArray(track.extraartists)) {
            return map;
          }
          return map.concat(
            rolesFromDiscogsArtists(track.extraartists).map((rel) => {
              return Object.assign({}, rel, {
                track
              });
            })
          );
        }, []);
        const releaseLevelTracklistRels = json.extraartists?.filter((artist) => artist.tracks && artist.tracks !== "") || [];
        if (releaseLevelTracklistRels.length > 0) {
          tracklistRels = tracklistRels.concat(
            releaseLevelTracklistRels.reduce((array, artist) => {
              return array.concat(
                getAllArtistTracks(json.tracklist, artist.tracks).reduce((array2, track) => {
                  return array2.concat(
                    getArtistRoles(artist).map((rel) => {
                      return Object.assign({}, rel, {
                        artist,
                        track
                      });
                    })
                  );
                }, [])
              );
            }, [])
          );
        }
        log.info(`Found ${tracklistRels.length} tracklist relationships`);
      }
      return runSourcePipeline({ companies: json.companies, artistRoles, tracklistRels, tracklist: json.tracklist, sourceUrl: discogsUrl, processTracklist, getOpts });
    });
  }
  function runTidalImport(tidalUrl, getOpts) {
    log.info(`Opening the Tidal credits tab \u2014 it closes itself once harvested (a few seconds)\u2026`);
    return harvestTidalAlbum(tidalUrl).then((harvest) => {
      _tidalJson = harvest;
      if (!harvest.ok) throw new Error(`Tidal harvest failed: ${harvest.error || "unknown error"}`);
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:#f8f8f8;padding:0.5rem;border:1px solid #ddd;border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(harvest, null, 2);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${harvest.tracks.length} tracks \u2014 raw Tidal harvest</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      const { tracklistRels, tracklist, skipped, multiVolume } = tidalToEngine(harvest.tracks);
      const { artists: relArtists, publishers: relPublishers, companies: relCompanies, skipped: relSkipped } = tidalReleaseArtists(harvest.releaseCredits);
      const artistRoles = [...relPublishers];
      for (const a of relArtists) {
        const roles = getArtistRoles(a);
        if (!roles.length) {
          relSkipped.push(`release: ${a.tidalRole} \u2014 ${a.name}`);
          continue;
        }
        if (a.assistant) roles.forEach((r) => {
          r.attributes = (r.attributes || []).concat("assistant");
        });
        artistRoles.push(...roles);
      }
      const companies = relCompanies || [];
      log.info(`Tidal credits: ${tracklistRels.length} per-track + ${artistRoles.length} release-level relationship(s)${companies.length ? ` + ${companies.length} label/company` : ""} across ${tracklist.length} track(s)`);
      skipped.concat(relSkipped).forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (multiVolume) log.warn(`Multi-volume Tidal album \u2014 track numbers repeat per volume; positions may not all match this release's mediums. Review carefully.`);
      if (!tracklistRels.length && !artistRoles.length && !companies.length) {
        log.warn("No importable credits found on the Tidal credits page.");
        document.querySelector(".discogs-bar")?._setStopMessage?.("No importable credits found");
        return;
      }
      return runSourcePipeline({ companies, artistRoles, tracklistRels, tracklist, sourceUrl: tidalUrl, processTracklist: true, getOpts });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runQobuzImport(qobuzUrl, getOpts) {
    const parsed = parseQobuzAlbumUrl(qobuzUrl);
    if (!parsed) {
      log.error(`Not a Qobuz album URL: ${qobuzUrl}`);
      return Promise.resolve();
    }
    log.info(`Fetching Qobuz store page: ${parsed.pageUrl}`);
    return fetchQobuzAlbumPage(parsed.pageUrl).then((html) => {
      const albumInfo = extractQobuzAlbumInfo(html);
      const tracks = extractQobuzCredits(html);
      _qobuzJson = { pageUrl: parsed.pageUrl, album: albumInfo, tracks };
      const li = document.createElement("li");
      const pre = document.createElement("pre");
      pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:#f8f8f8;padding:0.5rem;border:1px solid #ddd;border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
      pre.textContent = JSON.stringify(_qobuzJson, null, 2);
      li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${albumInfo || "Qobuz album"} \xB7 ${tracks.length} tracks \u2014 parsed Qobuz credits</strong></summary></details>`;
      li.querySelector("details").appendChild(pre);
      _logs2.appendChild(li);
      if (!tracks.length) {
        log.warn("No credits found on the Qobuz page \u2014 nothing to import.");
        document.querySelector(".discogs-bar")?._setStopMessage?.("No importable credits found");
        return;
      }
      const { tracklistRels, tracklist, skipped } = qobuzToEngine(tracks);
      log.info(`Qobuz credits: ${tracklistRels.length} per-track relationship(s) across ${tracklist.length} track(s)`);
      skipped.forEach((s) => log.info(`Not imported (v1 scope): ${s}`));
      if (!tracklistRels.length) {
        log.warn("No importable credits found on the Qobuz page.");
        document.querySelector(".discogs-bar")?._setStopMessage?.("No importable credits found");
        return;
      }
      return runSourcePipeline({ companies: [], artistRoles: [], tracklistRels, tracklist, sourceUrl: qobuzUrl, processTracklist: true, getOpts });
    }).catch((err) => {
      log.error(err.message || String(err));
    });
  }
  function runSourcePipeline({ companies, artistRoles, tracklistRels, tracklist, sourceUrl, processTracklist, getOpts }) {
    const allArtistRoles = artistRoles.concat(tracklistRels);
    const uniqueArtists = [];
    const seenResourceUrls = /* @__PURE__ */ new Set();
    const rolesMap = /* @__PURE__ */ new Map();
    allArtistRoles.forEach((role) => {
      const url = role.artist?.resource_url || `_nourl_${role.artist?.name || role.artist?.id}`;
      if (!rolesMap.has(url)) rolesMap.set(url, []);
      let displayLabel = role.linkType;
      if (role.attributes && role.attributes.length > 0) {
        const attr = role.attributes[0];
        if (attr._type === "instrument" && attr.value) displayLabel = attr.value;
        else if (attr._type === "vocal" && attr.value) displayLabel = attr.value;
        else if (typeof attr === "string") displayLabel = `${role.linkType} [${attr}]`;
      }
      rolesMap.get(url).push({
        linkType: role.linkType,
        displayLabel,
        trackPos: role.track?.position || "",
        trackTitle: role.track?.title || ""
      });
      if (!seenResourceUrls.has(url)) {
        seenResourceUrls.add(url);
        if (!role.artist?.resource_url && role.artist) role.artist._syntheticKey = url;
        uniqueArtists.push(role.artist);
      }
    });
    const companiesRolesMap = /* @__PURE__ */ new Map();
    companies.forEach((c) => {
      if (!c.resource_url) return;
      if (!companiesRolesMap.has(c.resource_url)) companiesRolesMap.set(c.resource_url, []);
      companiesRolesMap.get(c.resource_url).push({ linkType: c.entity_type_name || "" });
    });
    const uniqueCompanies = [];
    const seenCompanyUrls = /* @__PURE__ */ new Set();
    companies.forEach((c) => {
      if (c.resource_url && !seenCompanyUrls.has(c.resource_url) && ENTITY_TYPE_MAP[c.entity_type_name]) {
        seenCompanyUrls.add(c.resource_url);
        uniqueCompanies.push(c);
      }
    });
    function runPreflight(bypassIdb = false) {
      log.info(`Starting preflight: ${uniqueArtists.length} artist(s), ${uniqueCompanies.length} label(s)/place(s).`);
      const artistProgressLi = document.createElement("li");
      artistProgressLi.textContent = `Checking ${uniqueArtists.length} artist(s) against MusicBrainz\u2026`;
      _logs2.appendChild(artistProgressLi);
      const companyProgressLi = document.createElement("li");
      companyProgressLi.textContent = `Checking ${uniqueCompanies.length} label(s)/place(s) against MusicBrainz\u2026`;
      _logs2.appendChild(companyProgressLi);
      const t0 = performance.now();
      return (async () => {
        const artistResults = await resolveAll(uniqueArtists, {
          progressLi: artistProgressLi,
          progressLabel: "Checking artists against MusicBrainz",
          kindOf: ENTITY_KIND,
          bypassIdb
        });
        const companyResults = await resolveAll(uniqueCompanies, {
          progressLi: companyProgressLi,
          progressLabel: "Checking labels/places against MusicBrainz",
          kindOf: COMPANY_KIND,
          bypassIdb
        });
        const elapsed = (performance.now() - t0) / 1e3;
        log.info(`Preflight done in ${elapsed.toFixed(1)}s.`);
        return [...artistResults.allResults, ...companyResults.allResults].filter(Boolean);
      })();
    }
    function annotateRoles(allResults) {
      allResults.forEach((r) => {
        if (!r) return;
        const url = r.entity?.resource_url || r.entity?._syntheticKey;
        if (url) r._roles = rolesMap.get(url) || companiesRolesMap.get(url) || [];
      });
    }
    let capturedResults = null;
    let capturedConfirmedMap = null;
    return runPreflight().then((allResults) => {
      annotateRoles(allResults);
      capturedResults = allResults;
      if (!allResults.length) {
        log.warn("Nothing to import \u2014 no entities to review.");
        document.querySelector(".discogs-bar")?._setStopMessage?.("Nothing to import \u2014 no entities to review");
        return;
      }
      document.querySelector(".discogs-bar")?.classList.add("is-reviewing");
      return showReviewTable(capturedResults, rolesMap, companiesRolesMap, {
        // Mount the Start-import button + unresolved message in the
        // always-visible header rather than below the table (#139).
        // Resolved via the DOM (there's one bar) — `runImport` is a
        // separate function from the bar builder that owns the slot.
        headerSlot: document.querySelector(".discogs-bar-action"),
        // Label fallback for URL-less credits (#193): a Qobuz row
        // must say "No Qobuz page", not "No Discogs page".
        sourceName: sourceNameForUrl(sourceUrl),
        sourceIcon: srcIconByUrl(sourceUrl),
        // #193 — shown on the "Start import" button
        // "🔄 Refresh from MB" — bypass the IDB cache and re-resolve
        // every entity via MB API. Used when a cached MBID is stale.
        onRefresh: () => runPreflight(true).then((freshResults) => {
          annotateRoles(freshResults);
          capturedResults = freshResults;
          return freshResults;
        })
      });
    }).then((confirmedMap) => {
      if (!confirmedMap) return;
      capturedConfirmedMap = confirmedMap;
      document.querySelector(".discogs-bar")?.classList.remove("is-reviewing");
      document.querySelector(".discogs-bar")?._setUnresolved?.(confirmedMap.unresolvedCount || 0);
      const cachePromises = [];
      confirmedMap.forEach((mbUrl, resourceUrl) => {
        const key = parseSourceEntityUrl(resourceUrl)?.key;
        if (!key) return;
        const m = mbUrl.match(/\/(artist|label|place)\/([a-f0-9-]+)/);
        if (!m) return;
        cachePromises.push(writeIdbRecord(key, {
          mbid: m[2],
          entityType: m[1]
          // No resolvedVia change — the inline write owns it.
        }));
      });
      return Promise.all(cachePromises);
    }).then(() => {
      if (!capturedConfirmedMap) return;
      const resolvedEntityTypes = /* @__PURE__ */ new Map();
      (capturedResults || []).forEach((r) => {
        if (r.entity?.resource_url && r.mbUrl && r.entityType) {
          resolvedEntityTypes.set(r.entity.resource_url, r.entityType);
        }
      });
      const live = getOpts();
      if (live.processTracklist !== processTracklist) {
        log.warn(`"Per-track credits" toggled during review (preflight ran with "${processTracklist ? "on" : "off"}", import will follow preflight). To change, restart the import.`);
      }
      const dedupOpts = {
        dedupeEquivalenceSets: live.dedupeEquivalenceSets,
        dedupeDuplicateRoles: live.dedupeDuplicateRoles,
        creditOverrides: capturedConfirmedMap?.creditOverrides
      };
      return dispatchAllRelationships(companies, artistRoles, tracklistRels, live.applyToTracks, live.createWorksMode, tracklist, processTracklist, resolvedEntityTypes, capturedConfirmedMap, sourceUrl, dedupOpts);
    });
  }

  // src/hover-highlight.js
  var _installed = false;
  function installHoverHighlight() {
    if (_installed) return;
    _installed = true;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", () => {
        _installed = false;
        installHoverHighlight();
      }, { once: true });
      return;
    }
    const style = document.createElement("style");
    style.id = "discogs-hover-highlight-style";
    style.textContent = `
        ::highlight(discogs-hover-existing) { background-color: blue; color: white; }
        ::highlight(discogs-hover-new)      { background-color: blue; color: yellow; }
        .discogs-role-chip { padding: 0 2px; border-radius: 3px; transition: background 0.08s, color 0.08s; }
        .discogs-role-chip:hover { background: #ffe066; color: #222; cursor: default; }
    `;
    document.head.appendChild(style);
    document.body.addEventListener("mouseover", (ev) => {
      const needle = needleFor(ev.target);
      if (needle) highlightPageText(needle);
    });
    document.body.addEventListener("mouseout", (ev) => {
      const needle = needleFor(ev.target);
      if (needle) clearPageHighlight();
    });
  }
  function needleFor(target) {
    if (!target || !target.closest) return null;
    const chip = target.closest(".discogs-role-chip");
    if (chip) return chip.dataset.roleKey || "";
    const phraseTh = target.closest("th.link-phrase");
    if (phraseTh && !target.closest("button")) {
      const label = phraseTh.querySelector("label");
      if (label) {
        let text = (label.textContent || "").trim();
        if (text.endsWith(":")) text = text.slice(0, -1).trim();
        if (text) return text;
      }
    }
    const link = target.closest("a[href]");
    if (link) {
      const href = link.getAttribute("href") || "";
      if (/\/(artist|work|label|place|recording|series|release-group|event|instrument|area)\/[a-f0-9-]/.test(href)) {
        return (link.textContent || "").trim();
      }
    }
    const span = target.closest("span.discogs-entity-name");
    if (span) return (span.textContent || "").trim();
    return null;
  }
  function classifyRow(textNode) {
    const item = textNode.parentNode && textNode.parentNode.closest ? textNode.parentNode.closest('.relationship-item, [class*="relationship-item"]') : null;
    if (!item) return null;
    const cls = item.className || "";
    if (/(^|\s)(rel-add|relationship-add)(\s|$)/.test(cls) || /\badd(ed)?\b/i.test(cls)) {
      return "new";
    }
    const rm = item.querySelector('button.remove-item[id^="remove-relationship-"]');
    if (rm) {
      const tail = rm.id.split("-").pop();
      const segs = rm.id.split("-");
      const last = segs[segs.length - 1];
      const secondLast = segs[segs.length - 2];
      if (secondLast === "" && /^\d+$/.test(last)) return "new";
      if (/^-\d+$/.test(last)) return "new";
    }
    return "existing";
  }
  function highlightPageText(needle) {
    if (!needle || !window.CSS?.highlights || typeof Highlight === "undefined") return;
    const lower = needle.toLowerCase();
    if (lower.length < 2) return;
    const rangesExisting = [];
    const rangesNew = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.tagName;
        if (tag === "STYLE" || tag === "SCRIPT" || tag === "NOSCRIPT" || tag === "TEXTAREA" || tag === "INPUT") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while (node = walker.nextNode()) {
      const txt = node.nodeValue;
      if (txt.length < lower.length) continue;
      const lowerTxt = txt.toLowerCase();
      const bucket = classifyRow(node) === "new" ? rangesNew : rangesExisting;
      let i = 0;
      while ((i = lowerTxt.indexOf(lower, i)) !== -1) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + lower.length);
        bucket.push(r);
        i += lower.length;
      }
    }
    try {
      window.CSS.highlights.set("discogs-hover-existing", new Highlight(...rangesExisting));
      window.CSS.highlights.set("discogs-hover-new", new Highlight(...rangesNew));
    } catch (e) {
    }
  }
  function clearPageHighlight() {
    try {
      window.CSS.highlights?.delete("discogs-hover-existing");
      window.CSS.highlights?.delete("discogs-hover-new");
    } catch (e) {
    }
  }

  // src/batch-remove.js
  var _installed2 = false;
  function installBatchRemove() {
    if (_installed2) return;
    _installed2 = true;
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", () => {
        _installed2 = false;
        installBatchRemove();
      }, { once: true });
      return;
    }
    document.head.appendChild(buildStyle());
    document.body.addEventListener("click", onClick, true);
  }
  function onClick(ev) {
    if (!(ev.shiftKey || ev.ctrlKey || ev.metaKey)) return;
    const btn = ev.target.closest?.("button.icon.remove-item");
    if (!btn) return;
    const mode = modeFor(ev);
    if (!mode) return;
    ev.preventDefault();
    ev.stopPropagation();
    _positionByRelIdCache = buildRelIdToPositionMap();
    const group = collectGroup(btn, mode);
    if (group.items.length === 0) return;
    openConfirm(group, mode);
  }
  function modeFor(ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey) return "role-and-target";
    if (ev.ctrlKey || ev.metaKey) return "target";
    if (ev.shiftKey) return "role";
    return null;
  }
  function collectGroup(seedBtn, mode) {
    const seedItem = seedBtn.closest(".relationship-item");
    const seedRow = seedBtn.closest("tr");
    if (!seedItem || !seedRow) return { items: [], roleClass: null, roleLabel: "", targetHref: null, targetLabel: "" };
    const roleClass = pickRoleClass(seedRow);
    const targetHref = pickTargetHref(seedItem);
    const targetLabel = pickTargetLabel(seedItem);
    const roleLabel = pickRoleLabel(seedRow);
    const allItems = Array.from(document.querySelectorAll(".relationship-item"));
    const matched = allItems.filter((item) => {
      if (mode === "role") {
        return rowHasClass(item.closest("tr"), roleClass);
      }
      if (mode === "target") {
        return hasTargetHref(item, targetHref);
      }
      return rowHasClass(item.closest("tr"), roleClass) && hasTargetHref(item, targetHref);
    });
    return {
      // Return raw items; modal will derive `buttons` / `locations`
      // depending on the "only this session" toggle state at confirm
      // time. Per #68 follow-up: pre-existing rels stay untouched
      // when the toggle is on.
      items: matched,
      roleClass,
      roleLabel,
      targetHref,
      targetLabel
    };
  }
  function isSessionRel(item) {
    const btn = item.querySelector('button.icon.remove-item[id^="remove-relationship-"]');
    const relId = parseRelIdFromButton(btn);
    if (relId == null) return false;
    return Number(relId) < 0;
  }
  function buttonsFor(items) {
    return items.map((it) => it.querySelector("button.icon.remove-item")).filter(Boolean);
  }
  function pickRoleClass(tr) {
    if (!tr) return null;
    const stop = /* @__PURE__ */ new Set(["odd", "even", "highlighted", "selected", "subrow", "rel-add", "rel-edit", "rel-remove"]);
    for (const c of tr.classList) {
      if (!stop.has(c) && /^[a-z][a-z0-9-]*$/.test(c)) return c;
    }
    return null;
  }
  function pickRoleLabel(tr) {
    if (!tr) return "";
    const lbl = tr.querySelector("th.link-phrase label");
    if (!lbl) return "";
    return (lbl.textContent || "").replace(/:\s*$/, "").trim();
  }
  function pickTargetHref(item) {
    if (!item) return null;
    const a = item.querySelector(
      'a[href^="/artist/"], a[href^="/work/"], a[href^="/label/"], a[href^="/place/"], a[href^="/recording/"], a[href^="/series/"], a[href^="/release-group/"], a[href^="/event/"], a[href^="/instrument/"], a[href^="/area/"]'
    );
    return a ? a.getAttribute("href") : null;
  }
  function pickTargetLabel(item) {
    if (!item) return "";
    const a = item.querySelector(
      'a[href^="/artist/"], a[href^="/work/"], a[href^="/label/"], a[href^="/place/"], a[href^="/recording/"], a[href^="/series/"], a[href^="/release-group/"], a[href^="/event/"], a[href^="/instrument/"], a[href^="/area/"]'
    );
    return a ? (a.textContent || "").trim() : "";
  }
  function rowHasClass(tr, cls) {
    if (!tr || !cls) return false;
    return tr.classList.contains(cls);
  }
  function hasTargetHref(item, href) {
    if (!item || !href) return false;
    return !!item.querySelector(`a[href="${cssEscape(href)}"]`);
  }
  function cssEscape(s) {
    return String(s).replace(/(["\\\\])/g, "\\$1");
  }
  function collectLocations(items) {
    const buckets = {
      release: { count: 0, positions: /* @__PURE__ */ new Set() },
      recording: { count: 0, positions: /* @__PURE__ */ new Set() },
      work: { count: 0, positions: /* @__PURE__ */ new Set() },
      other: { count: 0, positions: /* @__PURE__ */ new Set() }
    };
    for (const item of items) {
      const btn = item.querySelector('button.icon.remove-item[id^="remove-relationship-"]');
      const srcType = parseSourceTypeFromButton(btn);
      const key = srcType === "release" || srcType === "recording" || srcType === "work" ? srcType : "other";
      buckets[key].count++;
      if (key === "recording" || key === "work") {
        const pos = findRecordingPosition(item);
        if (pos) buckets[key].positions.add(pos);
      }
    }
    const order = [
      ["release", "release"],
      ["recording", "tracks"],
      ["work", "works"]
    ];
    const out = [];
    for (const [key, label] of order) {
      const b = buckets[key];
      const positions = sortPositions([...b.positions]);
      out.push({ key, label, count: b.count, positions });
    }
    if (buckets.other.count > 0) {
      out.push({ key: "other", label: "other", count: buckets.other.count, positions: [] });
    }
    return out;
  }
  function sortPositions(arr) {
    return arr.sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      return String(a).localeCompare(String(b));
    });
  }
  function parseSourceTypeFromButton(btn) {
    if (!btn || !btn.id) return null;
    const segs = btn.id.split("-");
    let i = segs.length - 1;
    while (i >= 0 && (segs[i] === "" || /^-?\d+$/.test(segs[i]))) i--;
    return segs[i] || null;
  }
  var _positionByRelIdCache = null;
  function buildRelIdToPositionMap() {
    const map = /* @__PURE__ */ new Map();
    const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
    const MB = win.MB;
    const re = MB?.relationshipEditor;
    if (!MB || !re?.state) return map;
    const positionByRecGid = /* @__PURE__ */ new Map();
    try {
      let mediumIndex = 0;
      const mediums = re.state.mediums;
      if (!mediums) return map;
      const iter = MB.tree?.iterate ? MB.tree.iterate(mediums) : null;
      if (!iter) return map;
      for (const [mediumKey, medium] of iter) {
        mediumIndex++;
        const tracks = medium?.tracks ?? medium;
        let trackIndex = 0;
        for (const rawTrack of MB.tree.iterate(tracks)) {
          trackIndex++;
          const trackObj = Array.isArray(rawTrack) ? rawTrack[1] : rawTrack;
          const rec = trackObj?.recording ?? trackObj;
          if (!rec?.gid) continue;
          let pos = trackObj?.number || trackObj?.position;
          if (pos == null) pos = `${mediumIndex}.${String(trackIndex).padStart(2, "0")}`;
          positionByRecGid.set(rec.gid, String(pos));
        }
      }
    } catch (e) {
    }
    try {
      let walk = function(node, sourceGid) {
        if (!node) return;
        if (Array.isArray(node)) {
          for (const r of node) {
            if (r?.id != null) {
              const pos = positionByRecGid.get(sourceGid);
              if (pos) map.set(String(r.id), pos);
            }
          }
          return;
        }
        if (typeof node === "object") {
          for (const v of Object.values(node)) walk(v, sourceGid);
        }
      };
      const root = re.state.relationshipsBySource;
      if (!root) return map;
      for (const [gid, perSource] of Object.entries(root)) {
        walk(perSource, gid);
      }
    } catch (e) {
    }
    return map;
  }
  function parseRelIdFromButton(btn) {
    if (!btn || !btn.id) return null;
    const m = btn.id.match(/-(-?\d+)$/);
    return m ? m[1] : null;
  }
  function findRecordingPosition(item) {
    const btn = item.querySelector('button.icon.remove-item[id^="remove-relationship-"]');
    const relId = parseRelIdFromButton(btn);
    if (relId && _positionByRelIdCache && _positionByRelIdCache.has(relId)) {
      return _positionByRelIdCache.get(relId);
    }
    let el = item.closest(
      "[data-track-position], [data-position], [data-medium-track-position], [data-track-number]"
    );
    if (el) {
      const pos = el.getAttribute("data-track-position") || el.getAttribute("data-medium-track-position") || el.getAttribute("data-position") || el.getAttribute("data-track-number");
      if (pos) return String(pos).trim();
    }
    let scope = item.closest("table, tbody, .relationship-list-wrapper, .track-relationships, .track-rel");
    while (scope) {
      const candidates = scope.querySelectorAll?.(
        ".track-position, .position, .track-number, .medium-track-pos"
      );
      for (const c of candidates || []) {
        const txt = c.textContent?.trim();
        if (txt && /^[A-Z]?\d+([\-.]\d+|[A-Z]?\d*)?$/.test(txt)) return txt;
      }
      scope = scope.parentElement?.closest("table, .relationship-list-wrapper, .track-relationships, .track-rel");
    }
    return null;
  }
  function buildStyle() {
    const style = document.createElement("style");
    style.id = "discogs-batch-remove-style";
    style.textContent = `
        .discogs-batch-overlay {
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            z-index: 100000; display: flex; align-items: center; justify-content: center;
            font-family: inherit; font-size: 14px;
        }
        .discogs-batch-modal {
            background: #fff; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            max-width: 540px; width: 90%; padding: 1.2rem 1.4rem;
            box-sizing: border-box; color: #222;
        }
        .discogs-batch-modal * { box-sizing: border-box; }
        .discogs-batch-modal h2 {
            margin: 0 0 0.6rem; font-size: 1.05rem; line-height: 1.3;
        }
        .discogs-batch-modal .what { margin: 0 0 0.5rem; }
        .discogs-batch-modal .total {
            font-weight: 600; margin: 0.5rem 0 0.3rem; font-size: 0.95rem;
        }
        .discogs-batch-modal ul.locations {
            margin: 0 0 0.9rem; padding: 0.5rem 0.7rem 0.5rem 1.5rem;
            background: #f6f6f6; border-radius: 4px;
            font-size: 0.88rem; line-height: 1.6;
            max-height: 12rem; overflow-y: auto;
            list-style: disc;
        }
        .discogs-batch-modal ul.locations li.loc { margin: 0; padding: 0; }
        .discogs-batch-modal .actions {
            display: flex; flex-direction: row !important;
            justify-content: flex-end; align-items: center;
            gap: 0.5rem; margin-top: 1rem;
        }
        .discogs-batch-modal .actions button {
            flex: 0 0 auto;
            display: inline-block;
            box-sizing: border-box;
            margin: 0;
            padding: 0.45rem 1.1rem;
            min-width: 6rem; height: 2.2rem;
            border-radius: 4px;
            border: 1px solid #bbb;
            cursor: pointer;
            font-size: 0.9rem;
            font-family: inherit;
            font-weight: 500;
            line-height: 1; vertical-align: middle;
            text-align: center;
            white-space: nowrap;
        }
        .discogs-batch-modal .actions button.confirm {
            background: #c0392b; color: #fff; border-color: #962c20;
        }
        .discogs-batch-modal .actions button.confirm:hover { background: #a83426; }
        .discogs-batch-modal .actions button.cancel {
            background: #f5f5f5; color: #333;
        }
        .discogs-batch-modal .actions button.cancel:hover { background: #eaeaea; }
    `;
    return style;
  }
  function openConfirm(group, mode) {
    const sessionItems = group.items.filter(isSessionRel);
    const allItems = group.items;
    let onlySession = false;
    const overlay = document.createElement("div");
    overlay.className = "discogs-batch-overlay";
    const modal = document.createElement("div");
    modal.className = "discogs-batch-modal";
    const title = document.createElement("h2");
    modal.appendChild(title);
    const what = document.createElement("p");
    what.className = "what";
    what.innerHTML = describeAction(group, mode);
    modal.appendChild(what);
    let toggleCb = null;
    if (sessionItems.length > 0 && sessionItems.length < allItems.length) {
      const toggleWrap = document.createElement("label");
      toggleWrap.className = "session-toggle";
      toggleWrap.style.cssText = "display:flex;align-items:center;gap:0.4rem;margin:0.3rem 0 0.7rem;font-size:0.9rem;cursor:pointer;user-select:none;";
      toggleCb = document.createElement("input");
      toggleCb.type = "checkbox";
      toggleCb.checked = false;
      toggleWrap.appendChild(toggleCb);
      toggleWrap.appendChild(document.createTextNode("Only remove relationships added in this session"));
      modal.appendChild(toggleWrap);
    }
    const total = document.createElement("div");
    total.className = "total";
    modal.appendChild(total);
    const list = document.createElement("ul");
    list.className = "locations";
    modal.appendChild(list);
    function activeItems() {
      return onlySession ? sessionItems : allItems;
    }
    function render() {
      const items = activeItems();
      const buttons = buttonsFor(items);
      const locs = collectLocations(items);
      title.textContent = `Remove ${buttons.length} relationship${buttons.length === 1 ? "" : "s"}?`;
      total.textContent = `Total: ${buttons.length}`;
      list.innerHTML = "";
      for (const { label, count, positions } of locs) {
        const li = document.createElement("li");
        li.className = "loc";
        const noun = count === 1 ? "rel" : "rels";
        const tail = positions && positions.length ? `: ${positions.join(", ")}` : "";
        li.textContent = `${count} ${noun} from ${label}${tail}`;
        list.appendChild(li);
      }
      if (confirmBtn) {
        confirmBtn.disabled = buttons.length === 0;
        confirmBtn.style.setProperty("opacity", buttons.length === 0 ? "0.5" : "1", "important");
        confirmBtn.style.setProperty("cursor", buttons.length === 0 ? "default" : "pointer", "important");
      }
    }
    if (toggleCb) {
      toggleCb.addEventListener("change", () => {
        onlySession = toggleCb.checked;
        render();
      });
    }
    let confirmBtn;
    const actions = document.createElement("div");
    actions.className = "actions";
    const actionsCss = {
      "display": "flex",
      "flex-direction": "row",
      "justify-content": "flex-end",
      "align-items": "center",
      "gap": "0.5rem",
      "margin-top": "1rem",
      "padding": "0",
      "width": "100%"
    };
    for (const [k, v] of Object.entries(actionsCss)) actions.style.setProperty(k, v, "important");
    function styleBtn(b, isConfirm) {
      const css = {
        "flex": "0 0 auto",
        "display": "inline-block",
        "box-sizing": "border-box",
        "margin": "0",
        "padding": "0.45rem 1.1rem",
        "min-width": "6rem",
        "height": "2.2rem",
        "line-height": "1",
        "border-radius": "4px",
        "border": isConfirm ? "1px solid #962c20" : "1px solid #bbb",
        "background": isConfirm ? "#c0392b" : "#f5f5f5",
        "color": isConfirm ? "#fff" : "#333",
        "cursor": "pointer",
        "font-size": "0.9rem",
        "font-family": "inherit",
        "font-weight": "500",
        "text-align": "center",
        "vertical-align": "middle",
        "white-space": "nowrap"
      };
      for (const [k, v] of Object.entries(css)) b.style.setProperty(k, v, "important");
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel";
    cancel.textContent = "Cancel";
    styleBtn(cancel, false);
    confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "confirm";
    confirmBtn.textContent = "Remove";
    styleBtn(confirmBtn, true);
    actions.appendChild(cancel);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);
    render();
    overlay.appendChild(modal);
    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKey, true);
    }
    function doRemove() {
      const buttons = buttonsFor(activeItems());
      if (buttons.length === 0) return;
      for (const b of buttons) b.click();
    }
    function onKey(ev) {
      if (ev.key === "Escape") {
        close();
        ev.preventDefault();
      }
      if (ev.key === "Enter") {
        doRemove();
        close();
        ev.preventDefault();
      }
    }
    cancel.addEventListener("click", close);
    confirmBtn.addEventListener("click", () => {
      doRemove();
      close();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(overlay);
    confirmBtn.focus();
  }
  function describeAction(group, mode) {
    const role = group.roleLabel ? `<b>${escapeHtml(group.roleLabel)}</b>` : "<i>(unknown role)</i>";
    const target = group.targetLabel ? `<b>${escapeHtml(group.targetLabel)}</b>` : "<i>(unknown entity)</i>";
    if (mode === "role") return `Remove role ${role} from every relationship on this release.`;
    if (mode === "target") return `Remove entity ${target} from every relationship on this release, regardless of role.`;
    if (mode === "role-and-target") return `Remove entity ${target} on role ${role}.`;
    return "Remove these relationships.";
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;");
  }

  // src/credit_hoarder.user.js
  if (/(^|\.)tidal\.com$/i.test(location.hostname)) {
    runTidalHarvestPage();
  }
  (function handleEntityPageIfNeeded() {
    const entityMatch = location.href.match(
      /musicbrainz\.org\/(artist|label|place)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:[^/]|$)/i
    );
    if (!entityMatch) return;
    const entityType = entityMatch[1];
    const mbid = entityMatch[2];
    const pendingKey = "discogs-importer-pending-artist";
    const pending = sessionStorage.getItem(pendingKey);
    if (!pending) return;
    sessionStorage.removeItem(pendingKey);
    const NAME_FETCH_TIMEOUT_MS = 1e3;
    const CLOSE_DELAY_MS = 50;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), NAME_FETCH_TIMEOUT_MS);
    fetch(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`, { signal: ctrl.signal }).then((r) => r.json()).then((json) => ({ name: json.name || "", disambiguation: json.disambiguation || "" })).catch(() => ({ name: "", disambiguation: "" })).then(({ name, disambiguation }) => {
      clearTimeout(timer);
      DISCOGS_CHANNEL.postMessage({
        type: "artist-created",
        // keep same message type for compatibility
        id: mbid,
        name,
        disambiguation,
        resourceUrl: pending
      });
      setTimeout(() => window.close(), CLOSE_DELAY_MS);
    });
  })();
  if (/musicbrainz\.org$/i.test(location.hostname)) $(document).ready(function() {
    const re = /musicbrainz\.org\/release\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/edit-relationships/i;
    const m = window.location.href.match(re);
    if (!m) return;
    installHoverHighlight();
    installBatchRemove();
    getSourceUrlsForRelease(m[1]).then((sources) => {
      if (sources.discogs || sources.tidal || sources.qobuz) {
        insertDiscogsBar(sources.discogs, sources);
      }
    });
  });
})();
