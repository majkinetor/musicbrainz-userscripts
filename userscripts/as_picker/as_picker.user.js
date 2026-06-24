// ==UserScript==
// @name         Art Station Picker
// @namespace    https://musicbrainz.org/
// @version      2026.6.24.174906
// @description  Companion to Art Station: after you click "Search" on a cover in Art Station, click the higher-resolution image anywhere (the search results or the source site) and it's sent straight back to the Art Station gallery — no download + drop.
// @author       majkinetor
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/as_picker/README.md
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// @run-at       document-idle
// @noframes
// ==/UserScript==
//
// How it works — the companion has its OWN GM storage, which (unlike Art Station's)
// is shared across every origin it runs on, so it carries picks from any site back
// to MusicBrainz:
//   1. Art Station opens a reverse-image search with `mb_as_pick=<release MBID>` in the
//      URL. Seeing that param, this script starts a 30-minute "picking" window (persisted
//      in GM storage, so it survives navigating to the source site) and remembers the
//      release, so every pick is tagged for it and can't land on another release. On a
//      Google Lens result page it also auto-switches to the "Exact matches" tab.
//   2. While picking, hovering any reasonably-sized image shows a "＋ Art Station"
//      badge; clicking it queues that image's URL.
//   3. On the MusicBrainz cover-art page, this script drains the queue and hands each
//      URL to Art Station via the `artstation:add-image` document event (Art Station
//      fetches + stages it). A GM value-change listener makes that happen instantly,
//      even while the MB tab sits in the background.

(function () {
  'use strict';
  const SESS = 'aspick:until', QUEUE = 'aspick:queue', MBKEY = 'aspick:mbid';
  const now = () => Date.now();
  const getNum = k => { try { return +GM_getValue(k, 0) || 0; } catch (e) { return 0; } };
  const getArr = k => { try { return JSON.parse(GM_getValue(k, '[]') || '[]'); } catch (e) { return []; } };
  const setArr = (k, v) => { try { GM_setValue(k, JSON.stringify(v)); } catch (e) {} };
  const pageWin = () => (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);

  // Art Station opened us with mb_as_pick=<release MBID> → open a 30-min picking window
  // and remember which release it's for, so every pick is tagged with that MBID and can
  // only ever land back on THAT release's cover-art page (not whatever release you open
  // next). It's a query param (not a #hash): Yandex's image SPA blanks its results on an
  // unexpected hash but ignores an unknown query param. The regex also matches a bare
  // `mb_as_pick` / legacy `#mb-as-pick` (no value) → empty MBID = add anywhere.
  const sig = location.href.match(/mb[-_]as[-_]pick(?:=([^&#]*))?/i);
  if (sig) {
    try {
      GM_setValue(SESS, now() + 30 * 60 * 1000);
      let v = ''; try { v = decodeURIComponent(sig[1] || ''); } catch (e) { v = sig[1] || ''; }
      GM_setValue(MBKEY, /^[0-9a-f-]{36}$/i.test(v) ? v : '');
    } catch (e) {}
  }

  const onMB = /(^|\.)musicbrainz\.org$/i.test(location.hostname)
    && /\/(release|event)\/[0-9a-f-]{36}\/(add-)?(cover|event)-art/i.test(location.pathname);
  const pageMbid = (location.pathname.match(/\/(?:release|event)\/([0-9a-f-]{36})/i) || [])[1] || '';

  // ── On the MB art page: drain the queue into Art Station ────────────────────
  if (onMB) {
    let flushing = false;
    const flush = () => {
      if (flushing) return;
      const q = getArr(QUEUE);
      if (!q.length) return;
      if (!pageWin().ArtStation) { setTimeout(flush, 400); return; }   // wait for AS to load
      flushing = true;
      // Claim a pick only if it's tagged for THIS release (our MBID). An UNTAGGED pick
      // (old Art Station, or a capture failure) is claimed ONLY by the focused tab —
      // never broadcast to every open release, which is what made one grab land on all
      // of them. CRUCIAL: only a tab that actually claims (or expires) something rewrites
      // the queue — a non-claiming tab leaving it alone can't race-restore an item that
      // another tab took at the same instant (the other half of the "added to all" bug).
      const mine = [], rest = [], cutoff = now() - 2 * 60 * 60 * 1000; let changed = false;
      q.forEach(it => {
        const o = (typeof it === 'string') ? { url: it, mbid: '' } : (it || {});
        if (!o.url || (o.t && o.t < cutoff)) { changed = true; return; }   // drop blanks / expired orphans
        const isMine = o.mbid ? (o.mbid === pageMbid) : document.hasFocus();
        if (isMine) { mine.push(o.url); changed = true; } else rest.push(it);
      });
      if (changed) setArr(QUEUE, rest);
      mine.forEach(url => { try { document.dispatchEvent(new CustomEvent('artstation:add-image', { detail: { url } })); } catch (e) {} });
      flushing = false;
    };
    flush();
    try { GM_addValueChangeListener(QUEUE, () => flush()); } catch (e) {}                 // instant pick → appear, even in the background
    document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
    window.addEventListener('focus', flush);                                             // untagged picks land on the tab you focus
    return;
  }

  // ── Everywhere else: the picker, only while a session is active ─────────────
  if (getNum(SESS) <= now()) return;

  // On a Google Lens results page, jump straight to the "Exact matches" tab — it lists
  // the very same artwork at every resolution found on the web, which is exactly what
  // you're after when hunting a higher-res copy. (Google can't be deep-linked to that
  // tab: its URL carries post-upload session tokens, so we click it client-side.)
  if (/(^|\.)google\.[a-z.]+$/i.test(location.hostname)) {
    let done = false;
    const toExact = () => {
      if (done) return;
      const tab = [...document.querySelectorAll('a,[role="link"],[role="tab"],span,div')]
        .find(e => e.offsetParent && /^exact\s*matches$/i.test((e.textContent || '').trim()));
      if (tab) { done = true; (tab.closest('a,[role="link"],[role="tab"],button') || tab).click(); }
    };
    const iv = setInterval(toExact, 400);
    setTimeout(() => clearInterval(iv), 9000);
  }

  const badge = document.createElement('div');
  badge.id = 'aspick-badge';
  badge.textContent = '＋ Art Station';
  badge.style.cssText = 'position:absolute;z-index:2147483647;background:#2e9e5b;color:#fff;font:700 12px Arial;padding:3px 8px;border-radius:7px;box-shadow:0 2px 9px rgba(0,0,0,.45);cursor:pointer;display:none';
  let curImg = null;
  const place = img => {
    const r = img.getBoundingClientRect();
    badge.style.display = 'block';
    badge.style.top = (r.top + scrollY + 6) + 'px';
    badge.style.left = (r.right + scrollX - badge.offsetWidth - 6) + 'px';
  };
  const hide = () => { badge.style.display = 'none'; curImg = null; };
  const MIN = 80;
  const onPoint = e => {
    const t = e.target;
    if (t === badge) return;                                   // moving onto the badge keeps curImg
    const img = t && t.closest && t.closest('img');
    if (img && img.naturalWidth >= MIN && img.naturalHeight >= MIN) {
      if (img === curImg && badge.style.display !== 'none') return;   // already shown for this image — cheap no-op on mousemove
      curImg = img; place(img);
    } else hide();
  };
  // mouseover catches entering an image; mousemove also covers the case where the cursor
  // is ALREADY over the image when the picker mounts (e.g. a standalone-image page) —
  // mouseover never fires there until you leave and come back.
  document.addEventListener('mouseover', onPoint, true);
  document.addEventListener('mousemove', onPoint, true);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);

  // Thumbnail/proxy CDNs that serve a downscaled, hotlink-protected copy — never the
  // original. Bing's "view image" lands you on one of these; sending it just makes
  // Art Station fail ("returned no image"), and it wouldn't be higher-res anyway.
  const PROXY = /(\.mm\.bing\.net|th\.bing\.com|encrypted-tbn\d*\.gstatic\.com|tse\d*\.(?:mm\.bing\.net|explicit\.bing\.net))/i;

  const bestUrl = img => {
    // Bing image search: the visible <img> is a proxy thumbnail; the real source URL is
    // elsewhere. In the detail/lightbox view it's the `mediaurl` URL param (the image
    // you're looking at); in the results grid it's the result tile's JSON `m` attribute
    // (`murl`). So clicking the badge works whether you open a thumb or not.
    if (/(^|\.)bing\.com$/i.test(location.hostname)) {
      try { const mu = new URL(location.href).searchParams.get('mediaurl'); if (/^https?:\/\//i.test(mu || '')) return mu; } catch (e) {}
      const ius = img.closest && img.closest('.iusc, a.iusc, [m]');
      const m = ius && ius.getAttribute && ius.getAttribute('m');
      if (m) { try { const murl = JSON.parse(m).murl; if (/^https?:\/\//i.test(murl || '')) return murl; } catch (e) {} }
    }
    const a = img.closest && img.closest('a');                 // a thumbnail linking to the full file → prefer the link
    if (a && a.href && /\.(jpe?g|png|gif|webp|bmp|tiff?)(\?|$)/i.test(a.href)) return a.href;
    if (img.srcset) {                                          // else the widest srcset candidate
      const c = img.srcset.split(',').map(s => s.trim().split(/\s+/)).map(p => ({ u: p[0], w: parseInt(p[1], 10) || 0 })).sort((x, y) => y.w - x.w);
      if (c[0] && c[0].u) { try { return new URL(c[0].u, location.href).href; } catch (e) {} }
    }
    return img.currentSrc || img.src;
  };
  const toast = (msg, bg) => {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:2147483647;background:' + (bg || '#2e9e5b') + ';color:#fff;font:600 13px Arial;padding:9px 16px;border-radius:9px;box-shadow:0 6px 22px rgba(0,0,0,.35)';
    document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
  };
  badge.onclick = e => {
    e.stopPropagation(); e.preventDefault();
    if (!curImg) return;
    const url = bestUrl(curImg);
    if (!/^https?:\/\//i.test(url)) { toast('Open the full image first — that looks like an inline / preview image', '#c0392b'); return; }
    if (PROXY.test(url)) { toast("That's a search-engine thumbnail proxy, not the original — open the result on its source site, then click here", '#c0392b'); return; }
    let mbid = ''; try { mbid = GM_getValue(MBKEY, '') || ''; } catch (e) {}   // the release this search was launched from
    const q = getArr(QUEUE); q.push({ url, mbid, t: now() }); setArr(QUEUE, q);
    toast('Sent to Art Station ✓'); hide();
  };

  const bar = document.createElement('div');
  bar.id = 'aspick-bar';
  bar.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#2e9e5b;color:#fff;font:600 13px Arial;padding:8px 12px;border-radius:9px;box-shadow:0 6px 22px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px;user-select:none';
  bar.innerHTML = '🎨 Art Station — click an image to send it';
  const stop = document.createElement('button');
  stop.textContent = 'Stop';
  stop.style.cssText = 'background:rgba(255,255,255,.22);color:#fff;border:none;border-radius:6px;padding:3px 9px;cursor:pointer;font:inherit';
  stop.onclick = () => { try { GM_setValue(SESS, 0); } catch (e) {} bar.remove(); badge.remove(); };
  bar.appendChild(stop);

  const mount = () => { const b = document.body || document.documentElement; if (b && !document.getElementById('aspick-bar')) { b.appendChild(bar); b.appendChild(badge); } };
  mount(); setTimeout(mount, 1000);
})();
