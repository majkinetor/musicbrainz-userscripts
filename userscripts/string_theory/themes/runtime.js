// Themes (#879). Built into the bundle by build.mjs, which fills in the themes from this folder.
// Runs at document-start, before the members, on MusicBrainz pages only.
var __stTheme = (function () {
  var THEMES = __ST_THEMES__;
  var KEY = 'string_theory.theme';
  var MODES = ['light', 'dark', 'auto', 'sun', 'time'];
  var onMb = /(^|\.)musicbrainz\.org$/.test(location.hostname);
  var style = null, wasDark = false, over = null;   // over: a theme shown but not saved (the command palette's preview)
  var sys = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var idle = false, idleTimer = null, idleChoice = null;
  // The theme chooser stays open across pages until it is closed: { only, v, n } in this tab's sessionStorage,
  // read here at document-start so the next page opens in the theme it shows, not the saved one first.
  var TC = 'st-tc';
  function tcRead() { try { var t = JSON.parse(sessionStorage.getItem(TC)); return t && t.v && t.n ? t : null; } catch (e) { return null; } }
  function tcPut(t) { try { if (t) sessionStorage.setItem(TC, JSON.stringify(t)); else sessionStorage.removeItem(TC); } catch (e) {} }

  function read() {
    var v; try { v = GM_getValue(KEY, null); } catch (e) { v = null; }
    v = v && typeof v === 'object' ? v : {};
    // a theme's Event Horizon preset that was deleted there is no longer mapped
    var fx = null; try { fx = JSON.parse(localStorage.getItem('mbu.ehFxPresets')); } catch (e) {}
    if (Array.isArray(fx) && v.eh && typeof v.eh === 'object') { var eh = {}; Object.keys(v.eh).forEach(function (k) { if (v.eh[k] === '-' || fx.indexOf(v.eh[k]) >= 0) eh[k] = v.eh[k]; }); v.eh = eh; }
    // light is the start: its Default is MusicBrainz untouched, so nothing changes until it's asked for
    var i = v.idle && typeof v.idle === 'object' ? v.idle : {};
    // Idle is on by default, Random theme and effect; a saved '' still means Current.
    // Older idle settings included a variant; only the theme name is kept now.
    var name = typeof i.theme === 'string' ? i.theme.replace(/^(light|dark):/, '') : '';
    return { mode: MODES.indexOf(v.mode) < 0 ? 'light' : v.mode, dark: v.dark || 'Default', light: v.light || 'Default', lat: v.lat, lon: v.lon, from: v.from || '20:00', to: v.to || '07:00', eh: v.eh && typeof v.eh === 'object' ? v.eh : {}, idle: { on: i.on !== false, minutes: Math.max(1, Math.min(1440, Number(i.minutes) || 5)), theme: typeof i.theme !== 'string' ? '*' : name === '*' || THEMES.light[name] != null || THEMES.dark[name] != null ? name : '', effect: typeof i.effect !== 'string' ? '*' : i.effect === '*' || i.effect === '-' || !Array.isArray(fx) || fx.indexOf(i.effect) >= 0 ? i.effect : '' } };
  }
  function save(s) { try { GM_setValue(KEY, s); } catch (e) {} }

  // Sunrise and sunset, in hours UTC (NOAA's simplified formula), or which polar case it is.
  function sunHours(lat, lon, now) {
    var rad = Math.PI / 180;
    var day = Math.floor((now - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5);
    var g = 2 * Math.PI / 365 * (day - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g);
    var c = (Math.cos(90.833 * rad) - Math.sin(lat * rad) * Math.sin(dec)) / (Math.cos(lat * rad) * Math.cos(dec));
    if (Math.abs(c) > 1) return { polar: c < 0 ? 'day' : 'night' };
    var ha = Math.acos(c) / rad;
    return { rise: (720 - 4 * (lon + ha) - eq) / 60, set: (720 - 4 * (lon - ha) - eq) / 60 };
  }
  function isDay(lat, lon, now) {
    var s = sunHours(lat, lon, now);
    if (s.polar) return s.polar === 'day';
    var h = now.getUTCHours() + now.getUTCMinutes() / 60;
    var since = (((h - s.rise) % 24) + 24) % 24;   // both may fall outside 0-24 far from Greenwich
    return since < (((s.set - s.rise) % 24) + 24) % 24;
  }
  // from and to are 'HH:MM' local; a span across midnight is the usual case
  function isDarkAt(from, to, now) {
    var min = function (t) { var p = t.split(':'); return p[0] * 60 + +p[1]; };
    var f = min(from), t = min(to), n = now.getHours() * 60 + now.getMinutes();
    return f <= t ? n >= f && n < t : n >= f || n < t;
  }
  function variant(s) {
    if (s.mode === 'light' || s.mode === 'dark') return s.mode;
    if (s.mode === 'sun' && s.lat != null) return isDay(s.lat, s.lon, new Date()) ? 'light' : 'dark';
    if (s.mode === 'time') return isDarkAt(s.from, s.to, new Date()) ? 'dark' : 'light';
    return sys && sys.matches ? 'dark' : 'light';
  }
  function apply() {
    if (!onMb) return;
    var saved = read(), s = over || saved, v = variant(s);
    // A scheduled light/dark change may happen during idle; keep the random theme in that variant.
    if (idle && saved.idle.theme === '*' && idleChoice.variant !== variant(saved)) randomTheme(saved);
    if (idle && !over && idleChoice.theme) {
      s = Object.assign({}, saved); s[v] = idleChoice.theme;
    }
    var css = THEMES[v][s[v]] || THEMES[v].Default;
    // Say which variant this is: a page's own background can't, Event Horizon paints over ours.
    // Not before dark was ever used here, so a dark userstyle over the light start keeps being measured.
    wasDark = wasDark || v === 'dark';
    if (wasDark) css += '\n:root{--mbu-theme:' + v + '}';
    if (!style) { style = document.createElement('style'); style.id = 'st-theme'; }
    style.setAttribute('data-variant', v);
    if (style.textContent !== css) style.textContent = css;
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
    document.documentElement.classList.toggle('st-dark', v === 'dark');   // wakes the shared theme watch
    // Event Horizon's effect preset for this theme, by 'variant:name'; EH applies a new one once
    // the saved theme's preset on data-st-eh-fx ('-': no effect); a preview names its own on data-st-eh-fx-try,
    // which Event Horizon shows without saving and drops when it goes
    var de = document.documentElement, attr = function (k, x) { if (x) de.setAttribute(k, x); else de.removeAttribute(k); };
    var sv = saved, svv = variant(saved);
    attr('data-st-eh-fx', sv.eh[svv + ':' + sv[svv]]);
    attr('data-st-eh-fx-try', over ? s.eh[v + ':' + s[v]] : '');
    attr('data-st-eh-fx-idle', idle && !over ? idleChoice.effect : '');
    de.toggleAttribute('data-st-idle', idle && !over);
  }
  function randomPick(list) { return list.length ? list[Math.floor(Math.random() * list.length)] : ''; }
  function randomTheme(s) {
    var v = variant(s);
    idleChoice.variant = v;
    idleChoice.theme = randomPick(Object.keys(THEMES[v]));
  }
  function beginIdle() {
    var s = read();
    idleChoice = { theme: s.idle.theme, effect: s.idle.effect };
    if (s.idle.theme === '*') randomTheme(s);
    if (s.idle.effect === '*') {
      var fx = []; try { fx = JSON.parse(localStorage.getItem('mbu.ehFxPresets')) || []; } catch (e) {}
      idleChoice.effect = randomPick(Array.isArray(fx) ? fx : []);
    }
    idle = true; apply();
  }
  function activity() {
    clearTimeout(idleTimer);
    if (idle) { idle = false; idleChoice = null; apply(); }
    var s = read().idle;
    if (!onMb || window.top !== window || !s.on || (!s.theme && !s.effect)) return;
    idleTimer = setTimeout(beginIdle, s.minutes * 60000);
  }
  var tc = onMb && tcRead();
  if (tc) { over = read(); over.mode = tc.v; over[tc.v] = tc.n; if (tc.eh && typeof tc.eh === 'object') over.eh = tc.eh; }
  if (onMb) {
    apply();
    activity();
    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (name) {
      window.addEventListener(name, activity, { capture: true, passive: true });
    });
    window.addEventListener('focus', activity);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) activity(); });
    // last in the page, or MusicBrainz's stylesheet, loaded after it, wins every tie
    var last = function () { if (style) document.documentElement.appendChild(style); apply(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', last, { once: true }); else last();
    if (sys && sys.addEventListener) sys.addEventListener('change', apply);
    setInterval(function () { var m = read().mode; if (m === 'sun' || m === 'time') apply(); }, 60000);
  }

  function set(patch) { var s = read(); Object.keys(patch).forEach(function (k) { s[k] = patch[k]; }); over = null; save(s); activity(); apply(); }
  // shows the settings with patch on top, saving nothing; no patch goes back to what is saved
  function preview(patch) {
    over = null;
    if (patch) { over = read(); Object.keys(patch).forEach(function (k) { over[k] = patch[k]; }); }
    apply();
  }
  return {
    read: read, set: set, preview: preview, variant: function () { return variant(read()); }, isDay: isDay, isDarkAt: isDarkAt,
    names: function (v) { return v ? Object.keys(THEMES[v]) : Object.keys(Object.assign({}, THEMES.light, THEMES.dark)).sort(); },
    chooser: tcRead, chooserPut: tcPut,
    // the location mode asks the browser where we are, once, and keeps it coarse
    setMode: function (mode, done) {
      var s = read();
      set({ mode: mode });
      if (mode !== 'sun' || s.lat != null || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(function (p) {
        set({ lat: Math.round(p.coords.latitude * 10) / 10, lon: Math.round(p.coords.longitude * 10) / 10 });
        if (done) done();
      }, function () {}, { maximumAge: 864e5, timeout: 30000 });
    }
  };
})();
