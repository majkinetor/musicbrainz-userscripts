// Themes (#879). Built into the bundle by build.mjs, which fills in the themes from this folder.
// Runs at document-start, before the members, on MusicBrainz pages only.
var __stTheme = (function () {
  var THEMES = __ST_THEMES__;
  var KEY = 'string_theory.theme';
  var MODES = ['light', 'dark', 'auto', 'sun'];
  var onMb = /(^|\.)musicbrainz\.org$/.test(location.hostname);
  var style = null;
  var sys = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;

  function read() {
    var v; try { v = GM_getValue(KEY, null); } catch (e) { v = null; }
    v = v && typeof v === 'object' ? v : {};
    // light is the start: its Default is MusicBrainz untouched, so nothing changes until it's asked for
    return { mode: MODES.indexOf(v.mode) < 0 ? 'light' : v.mode, dark: v.dark || 'Default', light: v.light || 'Default', lat: v.lat, lon: v.lon };
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
  function variant(s) {
    if (s.mode === 'light' || s.mode === 'dark') return s.mode;
    if (s.mode === 'sun' && s.lat != null) return isDay(s.lat, s.lon, new Date()) ? 'light' : 'dark';
    return sys && sys.matches ? 'dark' : 'light';
  }
  function apply() {
    if (!onMb) return;
    var s = read(), v = variant(s);
    var css = THEMES[v][s[v]] || THEMES[v].Default;
    if (!style) { style = document.createElement('style'); style.id = 'st-theme'; }
    style.setAttribute('data-variant', v);
    if (style.textContent !== css) style.textContent = css;
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
  }
  if (onMb) {
    apply();
    // last in the page, or MusicBrainz's stylesheet, loaded after it, wins every tie
    var last = function () { if (style) document.documentElement.appendChild(style); apply(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', last, { once: true }); else last();
    if (sys && sys.addEventListener) sys.addEventListener('change', apply);
    setInterval(function () { if (read().mode === 'sun') apply(); }, 60000);
  }

  function set(patch) { var s = read(); Object.keys(patch).forEach(function (k) { s[k] = patch[k]; }); save(s); apply(); }
  return {
    read: read, set: set, isDay: isDay,
    names: function (v) { return Object.keys(THEMES[v]); },
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
