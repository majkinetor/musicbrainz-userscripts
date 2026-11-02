// What's new (#896): the Announcements discussions, checked once a day. While something is unread the
// String Theory icon is golden and clicking it opens this viewer instead of the dock.
// The discussions API ignores sort and category and answers oldest first, so read the last two pages.
var ST_NEWS_KEY = 'stNews', ST_NEWS_MAX = 20, ST_NEWS_DAY = 864e5, ST_NEWS_FIRST = 14 * ST_NEWS_DAY;
var ST_NEWS_ALL = 'https://github.com/' + ST_REPO + '/discussions/categories/announcements';
var stNewsOv = null;
var ST_NEWS_CSS = ''
  + '#st-news{width:min(880px,94vw);height:min(78vh,640px);display:flex;flex-direction:column;font:13px/1.45 var(--mbu-font);color:var(--mbu-text);outline:none}'
  + '#st-news-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--mbu-border)}'
  + '#st-news-head h2{flex:1 1 auto;margin:0;padding:0;border:0;background:none;color:var(--mbu-text);font:600 15px/1.3 var(--mbu-font)}'
  + '#st-news-head button{min-height:30px;box-sizing:border-box}'
  + '#st-news-body{flex:1 1 auto;min-height:0;display:flex}'
  + '#st-news-list{flex:0 0 300px;overflow:auto;margin:0;padding:0;list-style:none;border-right:1px solid var(--mbu-border)}'
  + '#st-news-list li{display:flex;gap:8px;margin:0;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--mbu-border)}'
  + '#st-news-list li:hover{background:var(--mbu-bg-hover)}'
  + '#st-news-list li[aria-selected=true]{background:var(--mbu-accent-soft)}'
  + '#st-news-list img,#st-news-view h3 img{width:20px;height:20px;flex:0 0 auto;object-fit:contain}'
  + '#st-news-list .t{display:block;font-weight:400}#st-news-list .u .t{font-weight:700}'
  + '#st-news-list .s{display:block;color:var(--mbu-text-weak);font-size:12px}'
  + '#st-news-view{flex:1 1 auto;min-width:0;overflow:auto;padding:12px 16px}'
  + '#st-news-view h3{display:flex;align-items:center;gap:8px;margin:0 0 2px;padding:0;border:0;background:none;color:var(--mbu-text);font:600 16px/1.3 var(--mbu-font)}'
  + '#st-news-view .m{display:flex;align-items:center;gap:8px;margin:0 0 10px;color:var(--mbu-text-weak);font-size:12px}'
  + '#st-news-view .c{padding:0 6px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius)}'
  + '#st-news-view .b img{max-width:100%;height:auto}#st-news-view .b{overflow-wrap:anywhere}'
  + '#st-news-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;border-top:1px solid var(--mbu-border);color:var(--mbu-text-weak);font-size:12px}'
  + '@media (max-width:640px){#st-news-body{flex-direction:column}#st-news-list{flex:0 0 38%;border-right:0;border-bottom:1px solid var(--mbu-border)}}';

function stNewsRead() {
  var v = null;
  try { v = GM_getValue(ST_NEWS_KEY, null); } catch (e) { /* no storage */ }
  return v && typeof v === 'object' ? v : { at: 0, items: [], seen: [], since: 0 };
}
function stNewsSave(v) { try { GM_setValue(ST_NEWS_KEY, v); } catch (e) { /* no storage */ } }
function stNewsUnread(v) {
  return v.items.filter(function (i) { return v.seen.indexOf(i.id) < 0 && Date.parse(i.at) >= v.since; });
}
function stNewsGet(url, accept, cb) {
  var h = { Accept: accept };
  try {
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({ method: 'GET', url: url, headers: h, timeout: 20000,
        onload: function (r) { cb(r.status >= 200 && r.status < 300 ? r.responseText : null, r.responseHeaders || ''); },
        onerror: function () { cb(null, ''); }, ontimeout: function () { cb(null, ''); } });
    } else {
      fetch(url, { headers: h }).then(function (r) {
        return r.ok ? r.text().then(function (t) { cb(t, 'link: ' + (r.headers.get('link') || '')); }) : cb(null, '');
      }).catch(function () { cb(null, ''); });
    }
  } catch (e) { cb(null, ''); }
}
// the script a post is about, from its `area | <script>` label
function stNewsScript(labels) {
  var out = null;
  labels.forEach(function (l) {
    var m = !out && /^area \| (.+)$/.exec(l), a = m && m[1].toLowerCase();
    if (!a) return;
    if (a === 'string theory') { out = { name: 'String Theory', icon: ST_ICON }; return; }
    var s = stMembers.filter(function (x) { return x[1].toLowerCase() === a || x[0].replace(/_/g, ' ') === a; })[0];
    out = s ? { name: s[1], icon: s[3] } : { name: m[1].charAt(0).toUpperCase() + m[1].slice(1), icon: '' };
  });
  return out || { name: 'String Theory', icon: ST_ICON };
}
function stNewsItem(d) {
  var labels = (d.labels || []).map(function (l) { return l.name; });
  var s = stNewsScript(labels), m = /Issue:\s*#(\d+)/i.exec(d.body || '');
  return { id: d.number, title: d.title, url: d.html_url, at: d.created_at, html: d.body_html || '',
    script: s.name, icon: s.icon, issue: m ? +m[1] : 0, channel: '' };
}
function stNewsPick(pages) {
  var all = [];
  pages.forEach(function (t) { try { all = all.concat(JSON.parse(t)); } catch (e) { /* a bad page */ } });
  return all.filter(function (d) {
    return d.category && d.category.slug === 'announcements'
      && !(d.labels || []).some(function (l) { return l.name === 'skip changelog'; });
  }).sort(function (a, b) { return Date.parse(b.created_at) - Date.parse(a.created_at); }).slice(0, ST_NEWS_MAX).map(stNewsItem);
}
// an issue with the `released` label is on stable, any other on latest
function stNewsChannels(items, old, cb) {
  var known = {}, left = 0;
  old.forEach(function (i) { if (i.channel === 'stable') known[i.issue] = 'stable'; });
  var finish = function () { if (!left) cb(items); };
  items.forEach(function (i) {
    if (!i.issue) return;
    if (known[i.issue]) { i.channel = known[i.issue]; return; }
    left++;
    stNewsGet('https://api.github.com/repos/' + ST_REPO + '/issues/' + i.issue, 'application/vnd.github+json', function (t) {
      try {
        i.channel = JSON.parse(t).labels.some(function (l) { return l.name === 'released'; }) ? 'stable' : 'latest';
      } catch (e) { i.channel = ''; }
      left--; finish();
    });
  });
  finish();
}
function stNewsCheck(force) {
  var v = stNewsRead();
  if (!force && Date.now() - v.at < ST_NEWS_DAY) return;
  var base = 'https://api.github.com/repos/' + ST_REPO + '/discussions?per_page=100', full = 'application/vnd.github.full+json';
  v.at = Date.now(); stNewsSave(v);   // another tab need not check too; a failure waits for tomorrow
  stNewsGet(base + '&page=1', full, function (first, head) {
    if (!first) return;
    var last = /[?&]page=(\d+)>;\s*rel="last"/.exec(head), n = last ? +last[1] : 1;
    var done = function (pages) {
      var items = stNewsPick(pages);
      stNewsChannels(items, v.items, function () {
        var now = stNewsRead();
        now.items = items;
        if (!now.since) now.since = Date.now() - ST_NEWS_FIRST;   // a first run doesn't flag the whole history
        stNewsSave(now); stNewsSignal();
      });
    };
    if (n < 2) return done([first]);
    stNewsGet(base + '&page=' + n, full, function (a) {
      if (n === 2) return done([first, a || '[]']);
      stNewsGet(base + '&page=' + (n - 1), full, function (b) { done([a || '[]', b || '[]']); });
    });
  });
}
// the golden icon and its count in the hover label
function stNewsSignal() {
  var n = stNewsUnread(stNewsRead()).length, root = document.documentElement, b = document.getElementById('mbu-dock');
  root.toggleAttribute('data-st-news', n > 0);
  if (!b) return;
  if (n) {
    if (!b.hasAttribute('data-st-label')) b.setAttribute('data-st-label', b.getAttribute('data-mb-corner-label') || '');
    b.setAttribute('data-mb-corner-label', "What's new: " + n);
  } else if (b.hasAttribute('data-st-label')) {
    b.setAttribute('data-mb-corner-label', b.getAttribute('data-st-label'));
    b.removeAttribute('data-st-label');
  }
}
function stNewsClean(html) {
  var d = new DOMParser().parseFromString(html, 'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,form').forEach(function (e) { e.remove(); });
  d.querySelectorAll('*').forEach(function (e) {
    Array.prototype.slice.call(e.attributes).forEach(function (a) {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) e.removeAttribute(a.name);
    });
    if (e.tagName === 'A') { e.target = '_blank'; e.rel = 'noopener'; }
  });
  d.querySelectorAll('sub').forEach(function (e) { if (/^\s*Issue:/i.test(e.textContent)) e.remove(); });
  return d.body.innerHTML;
}
function stNewsDate(at) { try { return new Date(at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; } }
function stNewsIcon(i) { return i.icon ? '<img src="' + stEsc(stFitIcon(i.icon)) + '" alt="">' : ''; }
function stNewsOpen() {
  if (stNewsOv && stNewsOv.isConnected) return;
  var U = stUI(), T = stTokens();
  if (!document.getElementById('st-news-css')) {
    var css = document.createElement('style'); css.id = 'st-news-css';
    css.textContent = T.MBU_TOKENS + U.MBU_UI_CSS + ST_CSS + ST_NEWS_CSS;
    (document.head || document.documentElement).appendChild(css);
  }
  var v = stNewsRead(), items = v.items, at = 0, focusBack = document.activeElement;
  var checked = Math.floor((Date.now() - v.at) / ST_NEWS_DAY);
  var ov = document.createElement('div');
  ov.className = 'mbu-ov'; ov.id = 'st-news-ov';
  ov.innerHTML = '<div class="mbu-ov-panel mbu-ui" id="st-news" role="dialog" aria-label="What\'s new" tabindex="-1">'
    + '<div id="st-news-head"><h2>What\'s new</h2><button type="button" class="st-b" id="st-news-all">Mark all read</button><button type="button" class="st-b" id="st-news-x">Close</button></div>'
    + '<div id="st-news-body"><ul id="st-news-list" role="listbox"></ul><div id="st-news-view"></div></div>'
    + '<div id="st-news-foot"><span>Latest ' + ST_NEWS_MAX + ' · checked ' + (checked < 1 ? 'today' : checked + ' d ago') + '</span>'
    + '<a href="' + ST_NEWS_ALL + '" target="_blank" rel="noopener">All announcements</a></div></div>';
  (document.body || document.documentElement).appendChild(ov);
  stNewsOv = ov;
  var list = ov.querySelector('#st-news-list'), view = ov.querySelector('#st-news-view');
  var persist = function () { var now = stNewsRead(); now.seen = v.seen; stNewsSave(now); stNewsSignal(); };
  var draw = function () {
    var un = stNewsUnread(v).map(function (i) { return i.id; });
    list.innerHTML = items.map(function (i, n) {
      return '<li role="option" data-n="' + n + '" aria-selected="' + (n === at) + '"' + (un.indexOf(i.id) >= 0 ? ' class="u"' : '') + '>' + stNewsIcon(i)
        + '<span><span class="t">' + stEsc(i.title) + '</span><span class="s">' + stEsc(i.script) + ' · ' + stEsc(stNewsDate(i.at)) + '</span></span></li>';
    }).join('');
  };
  var show = function (n) {
    at = n; var i = items[n];
    if (!i) { view.textContent = 'Nothing yet.'; return; }
    if (v.seen.indexOf(i.id) < 0) { v.seen.push(i.id); persist(); }
    draw();
    view.innerHTML = '<h3>' + stNewsIcon(i) + stEsc(i.title) + '</h3><div class="m"><span>' + stEsc(i.script) + '</span><span>' + stEsc(stNewsDate(i.at)) + '</span>'
      + (i.channel ? '<span class="c">' + i.channel + '</span>' : '') + '<a href="' + stEsc(i.url) + '" target="_blank" rel="noopener">On GitHub</a></div><div class="b">' + stNewsClean(i.html) + '</div>';
    view.scrollTop = 0;
    var li = list.children[n]; if (li) li.scrollIntoView({ block: 'nearest' });
  };
  var close = function () { ov.remove(); document.removeEventListener('keydown', key, true); try { if (focusBack) focusBack.focus(); } catch (e) { /* gone */ } };
  var key = function (e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      var n = at + (e.key === 'ArrowDown' ? 1 : -1);
      if (n >= 0 && n < items.length) show(n);
    }
  };
  document.addEventListener('keydown', key, true);
  list.onclick = function (e) { var li = e.target.closest('li'); if (li) show(+li.dataset.n); };
  ov.querySelector('#st-news-x').onclick = close;
  ov.querySelector('#st-news-all').onclick = function () { items.forEach(function (i) { if (v.seen.indexOf(i.id) < 0) v.seen.push(i.id); }); persist(); draw(); };
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
  // open on the newest unread post
  var first = stNewsUnread(v)[0], idx = first ? items.indexOf(first) : 0;
  show(idx < 0 ? 0 : idx);
  ov.querySelector('#st-news').focus();
}
function stNewsStart() {
  var css = document.createElement('style'); css.id = 'st-news-gold';
  css.textContent = ':root[data-st-news] #mbu-dock svg path{stroke:#e0a800!important}';
  (document.head || document.documentElement).appendChild(css);
  // ahead of the dock's own click: while golden, the icon opens the news
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('#mbu-dock');
    if (!b || !document.documentElement.hasAttribute('data-st-news')) return;
    e.preventDefault(); e.stopPropagation(); stNewsOpen();
  }, true);
  stNewsSignal(); stNewsCheck(false);
  var late = 0, t = setInterval(function () { stNewsSignal(); if (++late > 10) clearInterval(t); }, 1000);   // the button comes late
}
