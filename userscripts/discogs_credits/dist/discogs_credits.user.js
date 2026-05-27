// ==UserScript==
// @name         Import Discogs Credits
// @namespace    majkinetor
// @version      2026.5.27.163056
// @description  Add a button to import Discogs release relationships to MusicBrainz
// @author       majkinetor
// @match        https://musicbrainz.org/release/*/edit-relationships
// @match        https://musicbrainz.org/artist/*
// @match        https://musicbrainz.org/label/*
// @match        https://musicbrainz.org/place/*
// @match        https://beta.musicbrainz.org/release/*/edit-relationships
// @match        https://beta.musicbrainz.org/artist/*
// @match        https://beta.musicbrainz.org/label/*
// @match        https://beta.musicbrainz.org/place/*
// @license      MIT
// @downloadURL  https://update.greasyfork.org/scripts/578977/MusicBrainz%20-%20Import%20Discogs%20Credits.user.js
// @updateURL    https://update.greasyfork.org/scripts/578977/MusicBrainz%20-%20Import%20Discogs%20Credits.meta.js
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/discogs_credits
// @supportURL   https://github.com/majkinetor/musicbrainz-userscripts/issues
// @installURL   https://greasyfork.org/en/scripts/578977
// @grant        unsafeWindow
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
  function setLogContainer(el) {
    _logs = el;
  }
  function getLogContainer() {
    return _logs;
  }
  function _emit(html, plainText) {
    if (!_logs) return;
    const li = document.createElement("li");
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
    warn: (msg) => _emit(`<span style="color:orange">WARN ${msg}</span>`, `WARN ${msg}`),
    error: (msg) => _emit(`<span style="color:red">ERR ${msg}</span>`, `ERR ${msg}`)
  };

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
      let wait;
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
    async function _run(item) {
      for (let attempt = 0; attempt <= item.retries; attempt++) {
        await _waitForPause();
        _totalRequests++;
        try {
          const res = await fetch(item.url);
          if (res.status === 429 || res.status === 503) {
            _rateLimited++;
            const ra = parseInt(res.headers.get("Retry-After"), 10);
            const waitMs = ra > 0 ? ra * 1e3 : Math.min(1e3 * Math.pow(2, attempt), 3e4);
            _pauseUntil = Math.max(_pauseUntil, Date.now() + waitMs);
            continue;
          }
          if (!res.ok) {
            item.resolve(null);
            return;
          }
          const data = item.wantJson ? await res.json() : res;
          item.resolve(data);
          return;
        } catch (e) {
          if (attempt === item.retries) {
            item.resolve(null);
            return;
          }
          await new Promise((r) => setTimeout(r, 500));
        }
      }
      item.resolve(null);
    }
    function _enqueue(url, retries, wantJson) {
      return new Promise((resolve) => {
        _queue.push({ url, retries, wantJson, resolve });
        _drain();
      });
    }
    return {
      fetchJson: (url, retries = 3) => _enqueue(url, retries, true),
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
  function getDiscogsUrlForRelease(mbid) {
    const url = `/ws/js/release/${mbid}?fmt=json&inc=rels`;
    return fetch(url).then((body) => body.json()).then((json) => {
      const matchingRel = (json.relationships || []).find((rel) => {
        return rel.target?.sidebar_name === "Discogs";
      });
      return matchingRel?.target?.href_url || null;
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
      fill.style.cssText = "position:absolute;top:0;height:100%;width:40%;background:#e8771d;";
      pb.appendChild(fill);
      document.body.appendChild(pb);
    }
    pb.style.top = r1h + "px";
    pb.style.display = "block";
    if (row2) row2.style.marginTop = r1h + 5 + "px";
    clearInterval(_pInterval);
    _pPos = -40;
    _pInterval = setInterval(() => {
      _pPos += 1.5;
      if (_pPos > 100) _pPos = -40;
      const fill = document.getElementById("discogs-pb-fill");
      if (fill) fill.style.left = _pPos + "%";
    }, 16);
  }
  function _hideBar() {
    clearInterval(_pInterval);
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
      linkType: "instruments technician"
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
    Afox\u00E9: null,
    Agog\u00F4: null,
    Ashiko: null,
    Atabal: null,
    Bapang: null,
    "Clarinet": "clarinet",
    "Percussion": "percussion",
    "Congas": "conga drum",
    "Bongos": "bongo drum",
    "Tambourine": "tambourine",
    "Cuica": "cu\xEDca",
    "Guiro": "g\xFCiro",
    "G\xFCiro": "g\xFCiro",
    "Udu": "udu",
    "La\xFAd": "la\xFAd",
    "Laud": "la\xFAd",
    "Mbira": "mbira",
    "Slide Guitar": "slide guitar",
    "Acoustic Guitar": "acoustic guitar",
    "Double Bass": "double bass",
    "Goblet Drum": "goblet drum",
    "Maracas": "maracas",
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
    "Bass Drum": null,
    Bata: null,
    "Bell Tree": null,
    Bendir: null,
    Bodhr\u00E1n: null,
    "Body Percussion": null,
    Bombo: null,
    Bones: null,
    Buhay: null,
    Buk: null,
    Cabasa: null,
    Caixa: null,
    "Caja Vallenata": null,
    Caj\u00F3n: null,
    Calabash: null,
    Castanets: null,
    Caxixi: null,
    "Chak'chas": null,
    Chinch\u00EDn: null,
    Ching: null,
    Cymbal: null,
    Daf: null,
    Davul: null,
    Dhol: null,
    Dholak: null,
    Djembe: null,
    Doira: null,
    Doli: null,
    Drum: "drum set",
    "Drum Programming": null,
    Drums: "drum set",
    Dunun: null,
    "Electronic Drums": null,
    "Finger Cymbals": null,
    "Finger Snaps": null,
    "Frame Drum": null,
    "Friction Drum": null,
    Frottoir: null,
    Ganz\u00E1: null,
    Ghatam: null,
    Ghungroo: null,
    Gong: null,
    Guacharaca: null,
    Handbell: null,
    Handclaps: null,
    "Hang Drum": null,
    Hihat: null,
    Hosho: null,
    Hyoshigi: null,
    Idiophone: null,
    Jaggo: null,
    Janggu: null,
    Jing: null,
    "K'kwaengwari": null,
    Ka: null,
    "Kagura Suzu": null,
    Kanjira: null,
    Karkabas: null,
    Khartal: null,
    Khurdak: null,
    Kynggari: null,
    Lagerphone: null,
    "Lion's Roar": null,
    Madal: null,
    Mallets: null,
    "Monkey stick": null,
    Mridangam: null,
    Pakhavaj: null,
    Pandeiro: null,
    Rainstick: null,
    Ratchet: null,
    Rattle: "shaken idiophone",
    "Reco-reco": null,
    Repinique: null,
    Rototoms: null,
    Scraper: null,
    Shakubyoshi: null,
    Shekere: null,
    Shuitar: null,
    "Singing Bowls": null,
    Skratjie: null,
    Slapstick: null,
    "Slit Drum": null,
    Snare: null,
    Spoons: null,
    "Stomp Box": null,
    Surdo: null,
    Surigane: null,
    Taiko: null,
    "Talking Drum": null,
    "Tam-tam": null,
    Tambora: null,
    Tamboril: null,
    Tamborim: null,
    "Tan-Tan": null,
    "Tap Dance": null,
    "Tar (Drum)": null,
    "Temple Bells": null,
    "Temple Block": null,
    Thavil: null,
    Timpani: null,
    "Tom Tom": null,
    Triangle: null,
    T\u00FCng\u00FCr: null,
    Vibraslap: null,
    Washboard: null,
    Waterphone: null,
    "Wood Block": null,
    Zabumba: null,
    Amadinda: null,
    Angklung: null,
    Balafon: null,
    Boomwhacker: null,
    Carillon: null,
    Crotales: null,
    Guitaret: null,
    Kalimba: null,
    Lamellophone: null,
    Marimbula: null,
    Metallophone: null,
    "Musical Box": null,
    Prempensua: null,
    Slagbordun: null,
    "Steel Drums": null,
    "Thumb Piano": null,
    Tubaphone: null,
    "Tubular Bells": null,
    Tun: null,
    Txalaparta: null,
    "Baby Grand Piano": null,
    Chamberlin: null,
    Claviorgan: null,
    "Concert Grand Piano": null,
    Dulcitone: null,
    "Electric Harmonium": null,
    "Electric Harpsichord": null,
    "Electric Organ": null,
    Fortepiano: null,
    "Grand Piano": null,
    Mellotron: null,
    Omnichord: null,
    "Ondes Martenot": null,
    "Parlour Grand Piano": null,
    Pedalboard: null,
    "Player Piano": null,
    Regal: null,
    Stylophone: null,
    "Tangent Piano": null,
    "Toy Piano": null,
    "Upright Piano": null,
    Virginal: null,
    "12-String Acoustic Guitar": null,
    "12-String Bass": null,
    "5-String Banjo": null,
    "6-String Banjo": null,
    "6-String Bass": null,
    "Acoustic Bass": null,
    "Arco Bass": null,
    Arpa: null,
    Autoharp: null,
    Baglama: null,
    "Bajo Quinto": null,
    "Bajo Sexto": null,
    Balalaika: null,
    Bandola: null,
    Bandura: null,
    Bandurria: null,
    Banhu: null,
    Banjolin: null,
    "Baroque Guitar": null,
    Baryton: null,
    "Bass Guitar": null,
    Berimbau: null,
    Bhapang: null,
    Biwa: null,
    "Blaster Beam": null,
    Bolon: null,
    Bouzouki: null,
    "Bulbul Tarang": null,
    Byzaanchi: null,
    Cavaquinho: null,
    "Cello Banjo": null,
    Changi: null,
    Chanzy: null,
    "Chapman Stick": null,
    Charango: null,
    Chitarrone: null,
    Chonguri: null,
    Chuniri: null,
    Cimbalom: null,
    Citole: null,
    Cittern: null,
    Cl\u00E0rsach: null,
    "Classical Guitar": null,
    Clavichord: null,
    Clavinet: null,
    Cobza: null,
    Contrabass: null,
    Cuatro: null,
    C\u00FCmb\u00FC\u015F: null,
    Cura: null,
    Deaejeng: null,
    "Diddley Bow": null,
    Dilruba: null,
    Dobro: null,
    Dojo: null,
    Dombra: null,
    Domra: null,
    Doshpuluur: null,
    Dulcimer: null,
    Dutar: null,
    "\u0110\xE0n b\u1EA7u": null,
    Ektare: null,
    "Electric Bass": null,
    "Electric Guitar": null,
    "Electric Upright Bass": null,
    "Electric Violin": null,
    "Epinette des Vosges": null,
    Erhu: null,
    Esraj: null,
    Fiddle: null,
    "Flamenco Guitar": null,
    "Fretless Bass": null,
    "Fretless Guitar": null,
    Gadulka: null,
    Gaohu: null,
    Gayageum: null,
    Geomungo: null,
    Giga: null,
    Gittern: null,
    Gottuv\u00E2dyam: null,
    Guimbri: null,
    Guitalele: null,
    Guitar: null,
    "Guitar Banjo": null,
    "Guitar Synthesizer": null,
    Guitarr\u00F3n: null,
    GuitarViol: null,
    Guqin: null,
    Gusli: null,
    Guzheng: null,
    Haegum: null,
    Halldorophone: null,
    Hardingfele: null,
    "Harp Guitar": null,
    Hummel: null,
    Huqin: null,
    "Hurdy Gurdy": null,
    Igil: null,
    Jarana: null,
    Jinghu: null,
    Jouhikko: null,
    Kabosy: null,
    Kamancha: null,
    Kankl\u0117s: null,
    Kantele: null,
    Kanun: null,
    Kemenche: null,
    Kirar: null,
    Kobyz: null,
    Kokyu: null,
    Koto: null,
    Krar: null,
    Langeleik: null,
    Laouto: null,
    "Lap Steel Guitar": null,
    Lavta: null,
    "Lead Guitar": null,
    Lira: null,
    "Lira da Braccio": null,
    Lirone: null,
    Liuqin: null,
    Lute: null,
    Lyre: null,
    Mandobass: null,
    Mandocello: null,
    Mandoguitar: null,
    Mandola: null,
    "Mandolin Banjo": null,
    Mandolincello: null,
    Marxophone: null,
    Masinko: null,
    Monochord: null,
    Morinhoor: null,
    "Mountain Dulcimer": null,
    "Musical Bow": null,
    Ngoni: null,
    Nyckelharpa: null,
    "Open-Back Banjo": null,
    Outi: null,
    Panduri: null,
    "Pedal Steel Guitar": null,
    "Piccolo Banjo": null,
    Pipa: null,
    "Plectrum Banjo": null,
    "Portuguese Guitar": null,
    Psalmodicon: null,
    Psaltery: null,
    Rabab: null,
    Rabeca: null,
    Rebab: null,
    Rebec: null,
    Reikin: null,
    "Requinto Guitar": null,
    "Resonator Banjo": null,
    "Resonator Guitar": null,
    "Rhythm Guitar": null,
    Ronroco: null,
    Ruan: null,
    Sanshin: null,
    Santoor: null,
    Sanxian: null,
    Sarangi: null,
    Sarod: null,
    "Selmer-Maccaferri Guitar": null,
    "Semi-Acoustic Guitar": null,
    Seperewa: null,
    "Shahi Baaja": null,
    Shamisen: null,
    Sintir: null,
    Spinet: null,
    "Steel Guitar": null,
    "Stroh Violin": null,
    Strumstick: null,
    Surbahar: null,
    "Svara Mandala": null,
    Swarmandel: null,
    Sympitar: null,
    SynthAxe: null,
    Taish\u014Dgoto: null,
    Talharpa: null,
    Tambura: null,
    Tamburitza: null,
    Tapboard: null,
    "Tar (lute)": null,
    "Tenor Banjo": null,
    "Tenor Guitar": null,
    Theorbo: null,
    Timple: null,
    Tiple: null,
    Tipple: null,
    Tonkori: null,
    Tres: null,
    "Tromba Marina": null,
    "Twelve-String Guitar": null,
    Tzouras: null,
    "Ukulele Banjo": null,
    \u00DCt\u0151gardon: null,
    Valiha: null,
    Veena: null,
    Vielle: null,
    Vihuela: null,
    Viol: null,
    "Viola Caipira": null,
    "Viola d'Amore": null,
    "Viola da Gamba": null,
    "Viola de Cocho": null,
    "Viola Kontra": null,
    "Viola Nordestina": null,
    "Violino Piccolo": null,
    Violoncello: null,
    Violone: null,
    "Washtub Bass": null,
    Xalam: null,
    "Yang T'Chin": null,
    Yanggeum: null,
    Zither: null,
    Zongora: null,
    Algoza: null,
    Alphorn: null,
    "Alto Clarinet": null,
    "Alto Flute": null,
    "Alto Horn": null,
    "Alto Recorder": null,
    Apito: null,
    Bagpipes: null,
    Bandoneon: null,
    Bansuri: null,
    "Baritone Horn": null,
    "Barrel Organ": null,
    "Bass Harmonica": null,
    "Bass Saxophone": null,
    "Bass Trombone": null,
    "Bass Trumpet": null,
    "Bass Tuba": null,
    "Basset Horn": null,
    Bawu: null,
    Bayan: null,
    Bellowphone: null,
    Beresta: null,
    "Blues Harp": null,
    "Bolivian Flute": null,
    Bombarde: null,
    Brass: null,
    "Brass Bass": null,
    Bucium: null,
    Bugle: null,
    Chalumeau: null,
    Chanter: null,
    Charamel: null,
    Chirimia: null,
    Clarion: null,
    Claviola: null,
    Comb: null,
    "Concert Flute": null,
    Concertina: null,
    Conch: null,
    "Contra-Alto Clarinet": null,
    "Contrabass Clarinet": null,
    "Contrabass Saxophone": null,
    Contrabassoon: null,
    "Cor Anglais": null,
    Cornett: null,
    Cromorne: null,
    Crumhorn: null,
    Daegeum: null,
    Danso: null,
    "Dili Tuiduk": null,
    Dizi: null,
    Drone: null,
    Duduk: null,
    Dulcian: null,
    Dulzaina: null,
    "Electronic Valve Instrument": null,
    "Electronic Wind Instrument": null,
    "English Horn": null,
    Euphonium: null,
    Fife: null,
    Flageolet: null,
    Flugabone: null,
    Fluier: null,
    Flumpet: null,
    "Flute D'Amour": null,
    Friscaletto: null,
    Fujara: null,
    Galoubet: null,
    Gemshorn: null,
    Gudastviri: null,
    Harmet: null,
    Heckelphone: null,
    Helicon: null,
    Hichiriki: null,
    "Highland Pipes": null,
    Horagai: null,
    Horn: null,
    Horns: null,
    Hotchiku: null,
    "Hunting Horn": null,
    Jug: null,
    Kagurabue: null,
    Kaval: null,
    Kazoo: null,
    Khene: null,
    Kortholt: null,
    Launeddas: null,
    Limbe: null,
    Liru: null,
    "Low Whistle": null,
    Lur: null,
    Lyricon: null,
    M\u00E4nkeri: null,
    Mellophone: null,
    Melodeon: null,
    Mey: null,
    Mizmar: null,
    Mizwad: null,
    Moce\u00F1o: null,
    "Mouth Organ": null,
    Murli: null,
    Musette: null,
    Nadaswaram: null,
    Ney: null,
    "Northumbrian Pipes": null,
    "Nose Flute": null,
    "Oboe d'Amore": null,
    "Oboe Da Caccia": null,
    Ocarina: null,
    Ophicleide: null,
    "Overtone Flute": null,
    Panpipes: null,
    "Piano Accordion": null,
    "Piccolo Flute": null,
    "Piccolo Trumpet": null,
    Pipe: null,
    Piri: null,
    Pito: null,
    Pixiephone: null,
    Quena: null,
    Quenacho: null,
    Quray: null,
    Rauschpfeife: null,
    Recorder: null,
    Reeds: null,
    Rhaita: null,
    Rondador: null,
    Rozhok: null,
    Ryuteki: null,
    Sackbut: null,
    Salamuri: null,
    Sampona: null,
    Sarrusophone: null,
    Saxello: null,
    Saxhorn: null,
    Schwyzer\u00F6rgeli: null,
    Serpent: null,
    Shakuhachi: null,
    Shanai: null,
    Shawm: null,
    Shenai: null,
    Sheng: null,
    Shinobue: null,
    Sho: null,
    "Shruti Box": null,
    "Slide Whistle": null,
    Smallpipes: null,
    Sodina: null,
    Sopilka: null,
    "Sopranino Saxophone": null,
    "Soprano Clarinet": null,
    "Soprano Cornet": null,
    "Soprano Flute": null,
    "Soprano Trombone": null,
    Souna: null,
    Sousaphone: null,
    "Subcontrabass Saxophone": null,
    Suling: null,
    Suona: null,
    Taepyungso: null,
    T\u00E1rogat\u00F3: null,
    "Tenor Horn": null,
    "Tenor Trombone": null,
    "Ti-tse": null,
    "Tin Whistle": null,
    Tonette: null,
    Txirula: null,
    Txistu: null,
    "Uilleann Pipes": null,
    "Valve Trombone": null,
    "Valve Trumpet": null,
    "Wagner Tuba": null,
    Whistle: null,
    "Whistling Water Jar": null,
    Wind: null,
    Woodwind: null,
    Xiao: null,
    Yorgaphone: null,
    Zhaleika: null,
    Zukra: null,
    Zurna: null,
    "Automatic Orchestra": null,
    Computer: null,
    "Drum Machine": null,
    Effects: null,
    Groovebox: null,
    Loops: null,
    "MIDI Controller": null,
    Noises: null,
    Sampler: null,
    Scratches: null,
    Sequencer: null,
    "Software Instrument": null,
    Talkbox: null,
    Tannerin: null,
    Tape: null,
    Turntables: null,
    // 'Accompanied By' deliberately NOT in INSTRUMENTS — it's a meta role,
    // not an instrument. Mapped in ENTITY_TYPE_MAP to performer + additional.
    "Audio Generator": null,
    "Backing Band": null,
    Band: null,
    Bass: null,
    "Brass Band": null,
    Bullroarer: null,
    "Concert Band": null,
    "E-Bow": null,
    Ensemble: null,
    Gamelan: null,
    "Glass Harmonica": null,
    Guest: null,
    Homus: null,
    Instruments: null,
    "Jew's Harp": null,
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
    Trautonium: null,
    "Wind Chimes": null,
    "Wobble Board": null
  };

  // src/mappers.js
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
  function getAllArtistTracks(tracklist, artistTracks) {
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
      if (!mapping && INSTRUMENTS[actualRole] !== void 0) {
        let instrumentName = actualRole;
        if (INSTRUMENTS[actualRole]) {
          instrumentName = INSTRUMENTS[actualRole];
        }
        let role2 = ENTITY_TYPE_MAP.Instruments;
        if ("Drum Programming" === actualRole) {
          role2 = ENTITY_TYPE_MAP["Programmed By"];
          instrumentName = INSTRUMENTS["Drum Machine"];
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
        additionalAttributes = additionalAttributes.concat(mapping.attributes);
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
    const parsed = parseDiscogsUrl(entity.resource_url);
    const key = parsed?.key;
    const searchName = entity.name;
    const displayName = kind === "artist" ? entity.anv && entity.anv.trim() || entity.name : entity.name;
    const discogsHref = entity.resource_url.replace(/https:\/\/api\.discogs\.com\/(\w+?)s\/(\d+)/, "https://www.discogs.com/$1/$2");
    function buildResolved(mbUrl, mbName, mbDisambig, via2, actualKind = kind, fromCache = false, urlLinkedIds2) {
      return {
        type: "resolved",
        entityType: actualKind,
        entity,
        displayName,
        discogsHref,
        mbUrl,
        mbName,
        mbDisambig,
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
    function buildAttention(nameMatches2, nameSearchFailed2, ambiguityReason, urlLinkedIds2) {
      return {
        type: "attention",
        entityType: kind,
        entity,
        displayName,
        discogsHref,
        nameMatches: nameMatches2 || [],
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
    if (!bypassIdb && key) {
      const cachedRec = await readIdbRecord(key);
      if (cachedRec?.mbid && cachedRec?.entityType) {
        const via2 = cachedRec.resolvedVia || "cache";
        let cachedLinkedIds = cachedRec.urlLinkedIds;
        if (cachedLinkedIds === void 0 && (via2 === "url" || via2 === "both")) {
          cachedLinkedIds = [cachedRec.mbid];
        }
        if (cachedRec.name) {
          return buildResolved(
            cachedRec.mbUrl,
            cachedRec.name,
            cachedRec.disambiguation || "",
            via2,
            cachedRec.entityType,
            true,
            cachedLinkedIds
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
          cachedLinkedIds
        );
      }
      if (cachedRec && Array.isArray(cachedRec.nameMatches)) {
        return buildAttention(cachedRec.nameMatches, false, null, cachedRec.urlLinkedIds);
      }
    }
    const [nameJson, urlJson] = await Promise.all([
      mbThrottle.fetchJson(
        `//musicbrainz.org/ws/2/${kind}?query=${encodeURIComponent(searchName)}&fmt=json&limit=${searchLimit}`
      ),
      parsed ? mbThrottle.fetchJson(
        `//musicbrainz.org/ws/2/url?resource=${encodeURIComponent(parsed.cleanUrl)}&inc=${incRels}&fmt=json`
      ) : Promise.resolve(null)
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
    const urlLinkedIds = (urlJson?.relations || []).map((r) => kind === "place" ? r.place?.id || r.label?.id || null : r[kind]?.id || null).filter(Boolean);
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
          urlLinkedIds
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
          urlLinkedIds
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
      if (!progressLi) return;
      const remaining = entities.length - done;
      const checking = inFlightNames.size ? ` \u2014 checking <em>${[...inFlightNames].join(", ")}</em>` : "";
      progressLi.innerHTML = `${progressLabel}\u2026 <strong>${done}/${entities.length}</strong> done${checking}` + (remaining === 0 ? " \u2714" : ` (${remaining} remaining)`);
    }
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const queue = entities.map((e, i) => ({ entity: e, index: i }));
    const results = new Array(entities.length);
    setProgress();
    async function worker(slotIndex) {
      await delay(slotIndex * MIN_GAP_MS);
      while (queue.length > 0) {
        const { entity, index } = queue.shift();
        const kind = kindOf(entity);
        if (!kind) {
          done++;
          setProgress();
          continue;
        }
        const displayName = kind === "artist" ? entity.anv && entity.anv.trim() || entity.name : entity.name;
        inFlightNames.add(displayName);
        setProgress();
        results[index] = await resolveEntity(entity, kind, { bypassIdb });
        inFlightNames.delete(displayName);
        done++;
        setProgress();
      }
    }
    const slots = Math.min(CONCURRENCY, entities.length);
    if (slots > 0) await Promise.all(Array.from({ length: slots }, (_, i) => worker(i)));
    return { allResults: results.filter(Boolean) };
  }
  var ARTIST_KIND = () => "artist";
  var COMPANY_KIND = (c) => ENTITY_TYPE_MAP[c.entity_type_name]?.entityType ?? null;

  // src/review-table.js
  var _urlCheckSessionCache = /* @__PURE__ */ new Map();
  async function showReviewTable(allResults, rolesMap, companiesRolesMap, opts) {
    rolesMap = rolesMap || /* @__PURE__ */ new Map();
    companiesRolesMap = companiesRolesMap || /* @__PURE__ */ new Map();
    const onRefresh = opts?.onRefresh || null;
    const _preloadedNames = /* @__PURE__ */ new Map();
    const _nullNames = allResults.filter((r) => r.type === "resolved" && r.mbUrl && !r.mbName);
    for (const r of _nullNames) {
      const rUrl = r.entity?.resource_url;
      try {
        const idbKey = parseDiscogsUrl(rUrl)?.key;
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
        try {
          let walk = function(node) {
            if (!node) return;
            if (Array.isArray(node)) {
              for (const r of node) tally(r);
              return;
            }
            if (typeof node === "object") {
              for (const v of Object.values(node)) walk(v);
            }
          }, tally = function(rel) {
            if (!rel || rel._status === 2) return;
            const credit = rel.entity1_credit;
            if (!credit) return;
            const tgt = rel.entity1?.gid;
            if (!tgt) return;
            if (!counts.has(tgt)) counts.set(tgt, /* @__PURE__ */ new Map());
            const m = counts.get(tgt);
            m.set(credit, (m.get(credit) || 0) + 1);
          };
          const root = pageWindow?.MB?.relationshipEditor?.state?.relationshipsBySource;
          if (!root) return /* @__PURE__ */ new Map();
          walk(root);
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
      const headingText = document.createElement("span");
      headingText.style.cssText = "font-weight:bold;font-size:1rem;color:#5a4000;flex:1;";
      headingText.textContent = `Review \u2014 ${allResults.length} entit${allResults.length === 1 ? "y" : "ies"}`;
      heading.appendChild(headingText);
      if (onRefresh) {
        const refreshBtn = document.createElement("button");
        refreshBtn.textContent = "\u{1F504} Refresh from MB";
        refreshBtn.title = "Re-resolve every entity via MusicBrainz API, ignoring the local IDB cache";
        refreshBtn.style.cssText = "font-size:0.8rem;cursor:pointer;padding:0.2rem 0.5rem;border:1px solid #b59a00;border-radius:3px;background:#fff;color:#5a4000;";
        refreshBtn.addEventListener("click", () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = "\u{1F504} Refreshing\u2026";
          (panelLi || panel).remove();
          onRefresh().then((freshResults) => {
            showReviewTable(freshResults, rolesMap, companiesRolesMap, { onRefresh }).then((confirmedMap) => resolve(confirmedMap));
          });
        });
        heading.appendChild(refreshBtn);
      }
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
      ["Discogs entity", "MB match / search"].forEach((col) => {
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
        if (!hasDiscogsUrl) {
          const noUrl = document.createElement("span");
          noUrl.textContent = " \u26A0\uFE0F";
          noUrl.title = "No Discogs artist page \u2014 manual search needed";
          noUrl.style.cssText = "cursor:help;color:#c80;";
          nameWrap.appendChild(noUrl);
        }
        if (nameMismatch) {
          const w = document.createElement("span");
          w.textContent = " \u26A0\uFE0F";
          w.title = "Name differs from MB match";
          w.style.cursor = "help";
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
        credLine.style.cssText = "display:flex;align-items:center;gap:0.3rem;margin-top:0.6rem;max-width:280px;";
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
Leave empty to use the default (Discogs name, or MB's most-frequent existing credit when known).`;
        function refreshCredBg() {
          const value = (credInput.value || "").trim();
          const same = value === "" || value === displayName;
          credInput.style.background = same ? CRED_BG_SAME : CRED_BG_DIFFERENT;
        }
        function pickPrefill(mbUrl) {
          if (mbUrl) {
            const mbid = (String(mbUrl).split("/").pop() || "").replace(/[^a-f0-9-]/gi, "").slice(0, 36);
            if (mbid && existingCreditByMbid.has(mbid)) return existingCreditByMbid.get(mbid);
          }
          return displayName;
        }
        credInput.value = pickPrefill(r.mbUrl);
        credInput._userTouched = false;
        refreshCredBg();
        credInput.addEventListener("input", () => {
          credInput._userTouched = true;
          const url = credInput._activeMbUrl;
          if (url) creditOverrides.set(url, credInput.value);
          refreshCredBg();
        });
        credInput._activeMbUrl = r.mbUrl;
        if (r.mbUrl) creditOverrides.set(r.mbUrl, credInput.value);
        credLine.appendChild(credLabel);
        credLine.appendChild(credInput);
        tdDiscogs.appendChild(credLine);
        r._credInput = credInput;
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
        const searchBtn = document.createElement("button");
        searchBtn.textContent = "\u{1F50D}";
        searchBtn.title = "Search MusicBrainz";
        searchBtn.style.cssText = "padding:0.15rem 0.35rem;cursor:pointer;";
        searchRow.appendChild(searchInput);
        searchRow.appendChild(searchBtn);
        tdMb.appendChild(candidateList);
        tdMb.appendChild(searchRow);
        tr.appendChild(tdMb);
        const tdAction = actionsLine;
        tbody.appendChild(tr);
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
          }
          const _idbKey = r.entity?.resource_url ? parseDiscogsUrl(r.entity.resource_url)?.key : null;
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
                  applyUrlCheckResult(result);
                }).catch(() => applyUrlCheckResult("none"))
              );
            }, applyUrlCheckResult = function(result) {
              if (result === "linked") {
                linkSlot.textContent = "\u2713";
                linkSlot.title = "Discogs URL already linked to this MB " + entityType;
                linkSlot.style.color = "#5a5";
                linkSlot.style.fontWeight = "bold";
              } else if (result === "other") {
                linkSlot.textContent = "\u26A0\uFE0F";
                linkSlot.title = `Discogs URL is linked to a DIFFERENT MB ${entityType}`;
                linkSlot.style.color = "#c80";
              } else {
                linkSlot.textContent = "";
                linkSlot.style.color = "";
                const addLinkBtn = document.createElement("button");
                addLinkBtn.textContent = "\u{1F517}";
                addLinkBtn.title = "Add Discogs link to MB " + entityType;
                addLinkBtn.style.cssText = ACTION_CHIP_STYLE + "color:#e8771d;";
                addLinkBtn.addEventListener("click", () => {
                  const ltId = entityType === "label" ? "217" : entityType === "place" ? "705" : "180";
                  const p = new URLSearchParams({ [`edit-${entityType}.url.0.text`]: discogsHref, [`edit-${entityType}.url.0.link_type_id`]: ltId });
                  const mbid = selected.id.replace(/.*\//, "").replace(/[^a-f0-9-]/gi, "").substring(0, 36);
                  window.open(`https://musicbrainz.org/${entityType}/${mbid}/edit?${p}`, "_blank", "noopener,noreferrer");
                  linkSlot.innerHTML = "";
                  linkSlot.textContent = "\u2026";
                  linkSlot.title = "Verifying Discogs link on return to this tab\u2026";
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
            linkSlot.title = "Checking whether MB already has this Discogs URL linked";
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
              linkSlot.textContent = "\u26A0 No Discogs page";
              linkSlot.style.color = "#c80";
            } else if (Array.isArray(r.urlLinkedIds)) {
              const result = r.urlLinkedIds.includes(selected.id) ? "linked" : r.urlLinkedIds.length > 0 ? "other" : "none";
              _urlCheckSessionCache.set(urlCheckCacheKey, result);
              try {
                localStorage.setItem(urlCheckLsKey, JSON.stringify({ date: urlCheckToday, result }));
              } catch (e2) {
              }
              applyUrlCheckResult(result);
            } else if (urlCheckCached !== null) {
              applyUrlCheckResult(urlCheckCached);
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
              if (discogsHref) {
                createParams["edit-artist.url.0.text"] = discogsHref;
                createParams["edit-artist.url.0.link_type_id"] = "180";
              }
              if (disambiguation) createParams["edit-artist.comment"] = disambiguation;
              createUrl = "https://musicbrainz.org/artist/create";
            } else {
              const ltId = entityType === "label" ? "217" : "705";
              createParams = {
                [`edit-${entityType}.name`]: finalName,
                [`edit-${entityType}.url.0.text`]: discogsHref,
                [`edit-${entityType}.url.0.link_type_id`]: ltId
              };
              if (disambiguation) createParams[`edit-${entityType}.comment`] = disambiguation;
              createUrl = `https://musicbrainz.org/${entityType}/create`;
            }
            const p = new URLSearchParams(createParams);
            const newTab = window.open(`${createUrl}?${p}`, "_blank");
            if (newTab) {
              const trySet = () => {
                try {
                  newTab.sessionStorage.setItem("discogs-importer-pending-artist", r.entity.resource_url);
                } catch (e2) {
                  setTimeout(trySet, 50);
                }
              };
              trySet();
            }
            const onCreated = (evt) => {
              if (evt.data?.type !== "artist-created") return;
              if (evt.data.resourceUrl !== r.entity.resource_url) return;
              DISCOGS_CHANNEL.removeEventListener("message", onCreated);
              setRowResolved({ id: evt.data.id, name: evt.data.name, disambiguation: evt.data.disambiguation });
            };
            DISCOGS_CHANNEL.addEventListener("message", onCreated);
          }
          const createBtn = document.createElement("button");
          createBtn.textContent = "\u{1F195}";
          createBtn.title = "Create in MB with default Discogs name + URL";
          createBtn.style.cssText = ACTION_CHIP_STYLE + "color:#2a7;";
          createBtn.addEventListener("click", () => openCreateTab());
          const createAdvBtn = document.createElement("button");
          createAdvBtn.textContent = "\u25BE";
          createAdvBtn.title = "Create in MB with editable name + disambiguation, pre-filled from the Discogs profile";
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
            const profileLabel = document.createElement("div");
            profileLabel.style.cssText = "font-size:0.78rem;color:#888;margin-top:0.55rem;";
            profileLabel.textContent = "Discogs profile \u2014 select text to copy into Disambiguation";
            modal.appendChild(profileLabel);
            const profileBox = document.createElement("div");
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
            try {
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
          const selBtn = document.createElement("button");
          selBtn.textContent = "Select";
          selBtn.style.cssText = "font-size:0.78rem;cursor:pointer;padding:0.1rem 0.3rem;white-space:nowrap;";
          selBtn.addEventListener("click", () => setRowResolved(a));
          row.appendChild(selBtn);
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
          mbThrottle.fetchJson(`//musicbrainz.org/ws/2/${entityType}?query=${encodeURIComponent(q)}&fmt=json&limit=8`).then((json) => {
            if (!json) return;
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
      importBtn.style.cssText = "border:none;padding:0.4rem 1.1rem;border-radius:0.3rem;cursor:pointer;font-weight:bold;font-size:0.95rem;";
      const issueNote = document.createElement("span");
      issueNote.style.cssText = "font-size:0.85rem;color:#7a5c00;";
      function updateImportBtn() {
        const unresolved = [...rowState.values()].filter((s) => !s.confirmed).length;
        const mismatch = [...rowState.values()].filter((s) => s.confirmed && s.mbName && s.mbName.toLowerCase().trim() !== s.mbUrl).length;
        if (unresolved === 0) {
          importBtn.textContent = "Start import \u2192";
          importBtn.style.background = "#2ecc40";
          importBtn.style.color = "#fff";
          issueNote.textContent = "";
        } else {
          importBtn.textContent = `Start import anyway \u2192`;
          importBtn.style.background = "#e0a800";
          importBtn.style.color = "#fff";
          issueNote.textContent = `\u26A0 ${unresolved} artist(s) unresolved \u2014 they will be skipped`;
        }
      }
      updateImportBtn();
      importBtn.addEventListener("click", () => {
        const confirmedMap = /* @__PURE__ */ new Map();
        rowState.forEach((s, key) => {
          if (s.mbUrl) confirmedMap.set(key, s.mbUrl);
        });
        const tbl = document.createElement("table");
        tbl.style.cssText = "border-collapse:collapse;width:100%;font-size:0.78rem;margin:0.4rem 0;";
        const thRow = document.createElement("tr");
        thRow.style.background = "#f5f5f5";
        ["Discogs entity", "Roles / Tracks", "MB match", "MBID", "Resolved via"].forEach((h) => {
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
        getLogContainer().appendChild(tblLi);
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
        resolve(confirmedMap);
      });
      btnRow.appendChild(importBtn);
      btnRow.appendChild(issueNote);
      panel.appendChild(btnRow);
      const panelLi = document.createElement("li");
      panelLi.style.cssText = "list-style:none;margin:0;padding:0;";
      panelLi.appendChild(panel);
      getLogContainer().appendChild(panelLi);
      getLogContainer().scrollIntoView({ behavior: "smooth", block: "nearest" });
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
      if (typeof attr === "string") {
        attrName = attr;
      } else if (attr && typeof attr === "object" && attr._type) {
        if (attr._type === "task") {
          attrName = "task";
          textValue = attr.value;
        } else {
          attrName = attr.value;
        }
      } else if (typeof attr === "function") {
        attrName = extractFnValue(attr);
      }
      if (!attrName) continue;
      const found = findAttrByName(attrName);
      if (!found || seen.has(found.id)) continue;
      seen.add(found.id);
      attrObjs.push({ type: found, typeID: found.id, credited_as: "", text_value: textValue });
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
  function buildEditNote(discogsUrl, opts, extraLines) {
    const s = GM_info.script;
    const mbUrl = location.href.replace(/\/edit-relationships$/, "");
    const homepage = s.homepageURL || s.homepage || "https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/discogs_credits";
    const header = s.name + " v" + s.version + " by " + s.author + " - " + homepage;
    const lines = [
      header,
      "",
      "Release URL: " + mbUrl,
      "Discogs URL: " + discogsUrl
    ];
    if (opts) lines.push("Options: " + opts);
    if (extraLines) lines.push(...Array.isArray(extraLines) ? extraLines : [extraLines]);
    return lines.join("\n");
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
    "inspired the name of"
  ];

  // src/dispatch.js
  async function dispatchAllRelationships(companies, artistRoles, tracklistRels, applyToTracks, createWorks, discogsTracklist, processTracklist, resolvedEntityTypes, confirmedMap, discogsUrl, dedupOpts) {
    resolvedEntityTypes = resolvedEntityTypes || /* @__PURE__ */ new Map();
    confirmedMap = confirmedMap || /* @__PURE__ */ new Map();
    dedupOpts = dedupOpts || {};
    const dedupeEquivalenceSets = dedupOpts.dedupeEquivalenceSets !== false;
    const dedupeDuplicateRoles = dedupOpts.dedupeDuplicateRoles !== false;
    const creditOverrides = dedupOpts.creditOverrides || /* @__PURE__ */ new Map();
    const re = await waitForMBEditor();
    if (!re) return;
    const MB = pageWindow.MB;
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
    log.info(`Starting instant fill: ${companies.length} companies, ${artistRoles.length} release artist roles, ${tracklistRels.length} tracklist roles`);
    const bar = document.querySelector(".discogs-bar");
    function tickProgress() {
      const done = added + skipped + failed;
      const est = Math.max(done + 1, companies.length + artistRoles.length + tracklistRels.length);
      const pct = Math.min(Math.round(done / est * 99), 99);
      const _pct = document.querySelector("#discogs-progress-pct");
      if (_pct) _pct.textContent = pct + "%";
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
      const candSig = (() => {
        if (!attrTree) return "";
        try {
          return [...pageWindow.MB.tree.iterate(attrTree)].map((a) => `${a.typeID}:${a.text_value || ""}`).sort().join(",");
        } catch (e) {
          return "";
        }
      })();
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
        const existingSig = (r.attributes || []).map((a) => `${a.typeID}:${a.text_value || ""}`).sort().join(",");
        const exactMatch = existingSig === candSig;
        if (exactMatch) {
          return { kind: isEquivalent ? "equivalence" : "exact", existingLinkName: lookupName(r.linkTypeID) };
        }
        if (dedupeDuplicateRoles && !dupMatch) {
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
          return [...pageWindow.MB.tree.iterate(attrTree)].map((a) => a.typeID || "").join(",");
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
          log.warn(`Skipped ${company.name} \u2014 not resolved in review`);
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
        if (applyToTracks && RECORDING_LINK_TYPES.has(role.linkType)) continue;
        if (WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const mbUrl = confirmedMbUrl(role.artist);
        if (!mbUrl) {
          log.warn(`Skipped ${role.artist.name} (${role.linkType}) \u2014 not resolved in review`);
          skipped++;
          tickProgress();
          continue;
        }
        const credit = role.artist.anv?.trim() || role.artist.name;
        await processOne(releaseEntity, "artist", "release", role.linkType, mbUrl, role.attributes || [], credit);
        tickProgress();
      }
    }
    async function dispatchTracklist() {
      if (applyToTracks && recordingByGid.size > 0) {
        const applicable = artistRoles.filter((role) => RECORDING_LINK_TYPES.has(role.linkType) && !WORK_ONLY_ARTIST_RELS.includes(role.linkType));
        if (applicable.length > 0) {
          log.info(`Applying ${applicable.length} release credit(s) to ${recordingByGid.size} recording(s)\u2026`);
          for (const role of applicable) {
            const mbUrl = confirmedMbUrl(role.artist);
            if (!mbUrl) {
              log.warn(`Skipped ${role.artist.name} (${role.linkType}) in applyToTracks \u2014 not resolved in review`);
              continue;
            }
            const credit = role.artist.anv?.trim() || role.artist.name;
            for (const recEntity of recordingByGid.values()) {
              await processOne(recEntity, "artist", "recording", role.linkType, mbUrl, role.attributes || [], credit, positionByGid.get(recEntity.gid) || "*");
            }
          }
        }
      }
    }
    async function dispatchWorks() {
      const recordingOfLinkTypeId = resolveLinkTypeId("performance", "recording", "work");
      const workOnlyByGid = /* @__PURE__ */ new Map();
      for (const role of tracklistRels) {
        if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
          log.error(`Work-only rel for track ${role.track.position} "${role.track.title}" \u2014 no recording found, skipped`);
          failed++;
          continue;
        }
        if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
        workOnlyByGid.get(recEntity.gid).push({ role, recEntity });
      }
      if (createWorks) {
        for (const role of artistRoles) {
          if (!WORK_ONLY_ARTIST_RELS.includes(role.linkType)) continue;
          for (const recEntity of recordingByGid.values()) {
            const syntheticRole = { ...role, track: { position: "", title: recEntity.name || "" } };
            if (!workOnlyByGid.has(recEntity.gid)) workOnlyByGid.set(recEntity.gid, []);
            workOnlyByGid.get(recEntity.gid).push({ role: syntheticRole, recEntity });
          }
        }
      }
      if (createWorks && recordingOfLinkTypeId) {
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
        const trackTitle = entries[0]?.role.track.title ?? recEntity?.name ?? recGid;
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
        if (!workEntity) {
          if (!createWorks) {
            for (const { role } of entries) {
              log.error(`Track ${trackPos} "${trackTitle}": no work exists for ${role.linkType} (${role.artist.name}) \u2014 enable "Create missing works" or add work manually`);
              failed++;
            }
            continue;
          }
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
            log.warn(`Skipped ${role.artist.name} \u2014 not resolved in review (${role.linkType})`);
            continue;
          }
          const credit = role.artist.anv?.trim() || role.artist.name;
          if (workEntity.gid) {
            await processOne(workEntity, "artist", "work", role.linkType, mbUrl, role.attributes || [], credit, trackPos || entries[0]?.role?.track?.position);
          } else {
            const linkTypeID = resolveLinkTypeId(role.linkType, "artist", "work");
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
          log.warn(`Skipped ${role.artist.name} on track ${role.track.position} \u2014 not resolved in review`);
          continue;
        }
        const recEntity = getRecordingEntity(role.track);
        if (!recEntity) {
          log.warn(`No recording found for track ${role.track.position} "${role.track.title}" \u2014 skipped`);
          failed++;
          continue;
        }
        const credit = role.artist.anv?.trim() || role.artist.name;
        const attrKey = (role.attributes || []).map((a) => a.value || a._type || "").join(",");
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
        createWorks !== void 0 ? `create-works:${createWorks ? "on" : "off"}` : null
      ].filter(Boolean).join(", ");
      const trackCount2 = Array.isArray(discogsTracklist) ? discogsTracklist.length : 0;
      const inputStats = `Input: ${companies?.length || 0} companies, ${artistRoles?.length || 0} release credits, ${tracklistRels?.length || 0} tracklist credits on ${trackCount2} track${trackCount2 === 1 ? "" : "s"}`;
      const unresolvedCount = confirmedMap?.unresolvedCount || 0;
      const totalEntities = confirmedMap?.totalEntities || 0;
      const unresolvedLine = unresolvedCount > 0 ? `Unresolved: ${unresolvedCount} of ${totalEntities} entit${totalEntities === 1 ? "y" : "ies"} skipped in review` : null;
      const editNoteDedupPart = dedupedThisSession > 0 ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? "" : "s"}` : "";
      const resultStats = `Result: ${added} added, ${existedInMb} already in MB${editNoteDedupPart}, ${skipped} skipped, ${failed} failed`;
      const note = buildEditNote(discogsUrl, opts, [inputStats, unresolvedLine, resultStats].filter(Boolean));
      re.dispatch({ type: "update-edit-note", editNote: note });
    } catch (e) {
    }
    const dedupPart = dedupedThisSession > 0 ? `, ${dedupedThisSession} dispatch duplicate${dedupedThisSession === 1 ? "" : "s"}` : "";
    log.info(`<strong>Done: ${added} added, ${existedInMb} already in MB${dedupPart}, ${skipped} skipped, ${failed} failed</strong>`);
  }

  // src/ui-bar.js
  var _logs2;
  var _summary;
  function insertDiscogsBar(discogsUrl) {
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
            padding: 0.5rem 0.75rem;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
        }
        .discogs-bar img.discogs-logo {
            height: 20px;
            width: auto;
            flex-shrink: 0;
            opacity: 0.85;
        }
        .discogs-bar .discogs-source {
            flex: 1;
            font-size: 0.82rem;
            color: #555;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
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
        .discogs-toggle {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.15rem 0.55rem 0.15rem 0.35rem;
            border: 1px solid #d8c8a0;
            border-radius: 2rem;
            background: #fffdf7;
            cursor: pointer;
            font-size: 0.8rem;
            color: #555;
            user-select: none;
            transition: background 0.12s, border-color 0.12s;
        }
        .discogs-toggle:hover { border-color: #e8771d; color: #333; }
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
            background: #fff8ee;
            border-color: #e8771d;
            color: #333;
        }
        .discogs-toggle.active .discogs-toggle-dot {
            border-color: #e8771d;
            background: #e8771d;
        }
        .discogs-output { padding: 0.5rem 0.75rem 0.25rem; }
        .discogs-output .summary { margin: 0 0 0.25rem; font-size: 0.88rem; color: #555; }
        .discogs-output .logs { margin: 0; padding-left: 1.2rem; font-size: 0.83rem; }
        /* \u2500\u2500 Progress / sticky bar \u2500\u2500 */
        .discogs-bar.is-importing .discogs-bar-row1 {
            position: fixed;
            top: 0; left: 0; right: 0;
            z-index: 9000;
            background: #fdf8f0;
            border-bottom: 1px solid #eeddb0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
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
        .discogs-tooltip {
            display: none;
            position: absolute;
            bottom: calc(100% + 6px);
            left: 50%;
            transform: translateX(-50%);
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
            left: 50%;
            transform: translateX(-50%);
            border: 5px solid transparent;
            border-top-color: #333;
        }
        .discogs-toggle:hover .discogs-tooltip { display: block; }
    `;
    document.head.appendChild(style);
    const bar = document.createElement("div");
    bar.className = "discogs-bar";
    const row1 = document.createElement("div");
    row1.className = "discogs-bar-row1";
    const importBtn = document.createElement("button");
    importBtn.className = "discogs-import-btn";
    importBtn.textContent = "Import from Discogs";
    const progressPct = document.createElement("span");
    progressPct.id = "discogs-progress-pct";
    progressPct.style.cssText = "display:none; margin-left:0.5rem; font-size:0.85rem; color:#e8771d; font-weight:bold; min-width:3.5rem;";
    row1.appendChild(importBtn);
    row1.appendChild(progressPct);
    const logo = document.createElement("img");
    logo.src = DISCOGS_LOGO_URL;
    logo.className = "discogs-logo";
    logo.alt = "Discogs";
    row1.appendChild(logo);
    const sourceSpan = document.createElement("span");
    sourceSpan.className = "discogs-source";
    sourceSpan.innerHTML = `<a href="${discogsUrl}" target="_blank" rel="noopener noreferrer nofollow">${discogsUrl}</a>`;
    row1.appendChild(sourceSpan);
    bar.appendChild(row1);
    const row2 = document.createElement("div");
    row2.className = "discogs-bar-row2";
    const optsLabel = document.createElement("span");
    optsLabel.className = "discogs-opts-label";
    optsLabel.textContent = "Options:";
    row2.appendChild(optsLabel);
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
      }
      lbl.addEventListener("click", (e) => {
        e.preventDefault();
        cb.checked = !cb.checked;
        lbl.classList.toggle("active", cb.checked);
      });
      row2.appendChild(lbl);
      return cb;
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
      "Import per-track artist credits from Discogs."
    );
    const applyTracksCb = makeCheckbox(
      "Move release credits to tracks",
      bv("applyTracks", true),
      "Move performance credits from the release down to every recording."
    );
    const createWorksCb = makeCheckbox(
      "Create missing works",
      bv("createWorks", true),
      "Create a new inline work for recordings without one, and link composer/lyricist/writer credits to it."
    );
    const dedupSep = document.createElement("span");
    dedupSep.textContent = "Dedup:";
    dedupSep.style.cssText = "margin:0 0.2rem 0 0.6rem;color:#888;font-size:0.85rem;font-weight:600;";
    row2.appendChild(dedupSep);
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
    const saveOpts = () => {
      try {
        localStorage.setItem(OPTS_KEY, JSON.stringify({
          tracklist: tracklistCb.checked,
          applyTracks: applyTracksCb.checked,
          createWorks: createWorksCb.checked,
          dedupeEquivalenceSets: dedupeEqCb.checked,
          dedupeDuplicateRoles: dedupeDupCb.checked
        }));
      } catch (e) {
      }
    };
    [tracklistCb, applyTracksCb, createWorksCb, dedupeEqCb, dedupeDupCb].forEach((cb) => cb.closest("label").addEventListener("click", () => setTimeout(saveOpts, 0)));
    bar.appendChild(row2);
    const outputDiv = document.createElement("div");
    outputDiv.className = "discogs-output";
    importBtn.addEventListener("click", () => {
      importBtn.disabled = true;
      importBtn.textContent = "Importing\u2026";
      progressPct.style.display = "inline";
      progressPct.textContent = "0%";
      bar.classList.add("is-importing");
      _showBar();
      bar.scrollIntoView({ behavior: "smooth", block: "start" });
      bar._showProgress = () => {
        _showBar();
      };
      requestAnimationFrame(bar._showProgress);
      _logs2 = document.createElement("ul");
      _logs2.className = "logs";
      setLogContainer(_logs2);
      _summary = document.createElement("p");
      _summary.className = "summary";
      outputDiv.innerHTML = "";
      outputDiv.appendChild(_summary);
      outputDiv.appendChild(_logs2);
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
                if (n.tagName?.toLowerCase() === "strong") return "**" + n.textContent + "**";
                return n.textContent;
              }).join("") : "";
              if (skipDiscogsJson && /raw Discogs JSON/i.test(sumText)) {
                return "";
              }
              const body = [...node.childNodes].filter((n) => n !== sum).map(nodeToMd).join("");
              return "<details><summary>" + sumText + "</summary>\n\n" + body + "\n</details>";
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
        const lines = [..._logs2.querySelectorAll("li")].map((li) => {
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
      const copyLogBtn = document.createElement("button");
      copyLogBtn.textContent = "Copy log";
      copyLogBtn.title = "Copy the full import log (incl. raw Discogs JSON)";
      copyLogBtn.style.cssText = "font-size:0.78rem;padding:0.15rem 0.5rem;cursor:pointer;margin-left:auto;flex-shrink:0;";
      copyLogBtn.addEventListener("click", () => {
        copyToClipboard(buildCopyText({ skipDiscogsJson: false }), copyLogBtn, "Copy log");
      });
      row2.appendChild(copyLogBtn);
      const copyLogNoJsonBtn = document.createElement("button");
      copyLogNoJsonBtn.textContent = "Copy log (no JSON)";
      copyLogNoJsonBtn.title = "Copy the log without the raw Discogs JSON block \u2014 small enough to fit in a GitHub issue";
      copyLogNoJsonBtn.style.cssText = "font-size:0.78rem;padding:0.15rem 0.5rem;cursor:pointer;flex-shrink:0;";
      copyLogNoJsonBtn.addEventListener("click", () => {
        copyToClipboard(buildCopyText({ skipDiscogsJson: true }), copyLogNoJsonBtn, "Copy log (no JSON)");
      });
      row2.appendChild(copyLogNoJsonBtn);
      bar._setProgress = (pct) => {
        if (pct !== null && pct >= 100) _hideBar();
      };
      requestAnimationFrame(_showBar);
      const opts = `per-track:${tracklistCb.checked ? "on" : "off"}, move-to-tracks:${applyTracksCb.checked ? "on" : "off"}, create-works:${createWorksCb.checked ? "on" : "off"}`;
      const editNote = buildEditNote(discogsUrl, opts);
      editNote.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const html = line.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>');
        log.info(html);
      });
      runImport(discogsUrl, tracklistCb.checked, applyTracksCb.checked, createWorksCb.checked, dedupeEqCb.checked, dedupeDupCb.checked).finally(() => {
        importBtn.disabled = false;
        importBtn.textContent = "Import from Discogs";
        progressPct.textContent = "100%";
        setTimeout(() => {
          progressPct.style.display = "none";
        }, 2e3);
        setTimeout(() => {
          bar.classList.remove("is-importing");
          _hideBar();
        }, 2e3);
        delete bar._setProgress;
      });
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
  function runImport(discogsUrl, processTracklist, applyToTracks, createWorks, dedupeEquivalenceSets, dedupeDuplicateRoles) {
    return getDiscogsReleaseData(discogsUrl).then((json) => {
      let artistRoles = rolesFromDiscogsArtists(json.extraartists?.filter((artist) => !artist.tracks));
      if (!_logs2._releaseInfoAdded) {
        _logs2._releaseInfoAdded = true;
        const trackCount = (json.tracklist || []).filter((t) => t.type_ === "track").length;
        const summary = `${json.title || ""}${json.year ? " \xB7 " + json.year : ""} \xB7 ${trackCount} tracks`;
        const li = document.createElement("li");
        const pre = document.createElement("pre");
        pre.style.cssText = "max-height:400px;overflow:auto;font-size:0.72rem;background:#f8f8f8;padding:0.5rem;border:1px solid #ddd;border-radius:3px;margin:0.3rem 0 0 0;white-space:pre-wrap;word-break:break-all;";
        pre.textContent = JSON.stringify(json, null, 2);
        const copyJsonBtn = document.createElement("button");
        copyJsonBtn.textContent = "Copy JSON";
        copyJsonBtn.style.cssText = "font-size:0.75rem;padding:0.1rem 0.4rem;cursor:pointer;margin-left:0.5rem;vertical-align:middle;";
        copyJsonBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(JSON.stringify(json, null, 2)).catch(() => {
            const ta = Object.assign(document.createElement("textarea"), { value: JSON.stringify(json, null, 2) });
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
          });
          copyJsonBtn.textContent = "Copied!";
          setTimeout(() => {
            copyJsonBtn.textContent = "Copy JSON";
          }, 1500);
        });
        li.innerHTML = `<details><summary style="cursor:pointer;user-select:none;"><strong>${summary} \u2014 raw Discogs JSON</strong></summary></details>`;
        li.querySelector("summary").appendChild(copyJsonBtn);
        li.querySelector("details").appendChild(pre);
        _logs2.appendChild(li);
      }
      log.info(`Found ${json.companies.length + artistRoles.length} release relationships`);
      artistRoles = artistRoles.concat(convertPotentialDJMixers(json));
      let tracklistRels = [];
      if (processTracklist) {
        tracklistRels = json.tracklist.filter((track) => track.type_ === "track").reduce((map, track) => {
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
      json.companies.forEach((c) => {
        if (!c.resource_url) return;
        if (!companiesRolesMap.has(c.resource_url)) companiesRolesMap.set(c.resource_url, []);
        companiesRolesMap.get(c.resource_url).push({ linkType: c.entity_type_name || "" });
      });
      const uniqueCompanies = [];
      const seenCompanyUrls = /* @__PURE__ */ new Set();
      json.companies.forEach((c) => {
        if (c.resource_url && !seenCompanyUrls.has(c.resource_url) && ENTITY_TYPE_MAP[c.entity_type_name]) {
          seenCompanyUrls.add(c.resource_url);
          uniqueCompanies.push(c);
        }
      });
      function runPreflight(bypassIdb = false) {
        const artistProgressLi = document.createElement("li");
        artistProgressLi.textContent = `Checking ${uniqueArtists.length} artist(s) against MusicBrainz\u2026`;
        _logs2.appendChild(artistProgressLi);
        const companyProgressLi = document.createElement("li");
        companyProgressLi.textContent = `Checking ${uniqueCompanies.length} label(s)/place(s) against MusicBrainz\u2026`;
        _logs2.appendChild(companyProgressLi);
        return Promise.all([
          resolveAll(uniqueArtists, {
            progressLi: artistProgressLi,
            progressLabel: "Checking artists against MusicBrainz",
            kindOf: ARTIST_KIND,
            bypassIdb
          }),
          resolveAll(uniqueCompanies, {
            progressLi: companyProgressLi,
            progressLabel: "Checking labels/places against MusicBrainz",
            kindOf: COMPANY_KIND,
            bypassIdb
          })
        ]).then(([artistResults, companyResults]) => [...artistResults.allResults, ...companyResults.allResults].filter(Boolean));
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
        return showReviewTable(capturedResults, rolesMap, companiesRolesMap, {
          // "🔄 Refresh from MB" — bypass the IDB cache and re-resolve
          // every entity via MB API. Used when a cached MBID is stale.
          onRefresh: () => runPreflight(true).then((freshResults) => {
            annotateRoles(freshResults);
            capturedResults = freshResults;
            return freshResults;
          })
        });
      }).then((confirmedMap) => {
        capturedConfirmedMap = confirmedMap;
        const cachePromises = [];
        confirmedMap.forEach((mbUrl, resourceUrl) => {
          const key = parseDiscogsUrl(resourceUrl)?.key;
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
        const resolvedEntityTypes = /* @__PURE__ */ new Map();
        (capturedResults || []).forEach((r) => {
          if (r.entity?.resource_url && r.mbUrl && r.entityType) {
            resolvedEntityTypes.set(r.entity.resource_url, r.entityType);
          }
        });
        const dedupOpts = {
          dedupeEquivalenceSets,
          dedupeDuplicateRoles,
          creditOverrides: capturedConfirmedMap?.creditOverrides
        };
        return dispatchAllRelationships(json.companies, artistRoles, tracklistRels, applyToTracks, createWorks, json.tracklist, processTracklist, resolvedEntityTypes, capturedConfirmedMap, discogsUrl, dedupOpts);
      });
    }).then(() => {
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

  // src/discogs_credits.user.js
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
    fetch(`//musicbrainz.org/ws/2/${entityType}/${mbid}?fmt=json`).then((r) => r.json()).then((json) => {
      DISCOGS_CHANNEL.postMessage({
        type: "artist-created",
        // keep same message type for compatibility
        id: mbid,
        name: json.name || "",
        disambiguation: json.disambiguation || "",
        resourceUrl: pending
      });
      setTimeout(() => window.close(), 800);
    }).catch(() => {
      DISCOGS_CHANNEL.postMessage({
        type: "artist-created",
        id: mbid,
        name: "",
        disambiguation: "",
        resourceUrl: pending
      });
      setTimeout(() => window.close(), 800);
    });
  })();
  $(document).ready(function() {
    const re = /musicbrainz\.org\/release\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/edit-relationships/i;
    const m = window.location.href.match(re);
    if (!m) return;
    installHoverHighlight();
    installBatchRemove();
    getDiscogsUrlForRelease(m[1]).then((discogsUrl) => {
      if (discogsUrl) {
        insertDiscogsBar(discogsUrl);
      }
    });
  });
})();
