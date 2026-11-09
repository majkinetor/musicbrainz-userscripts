// #977: a page whose Content Security Policy refuses inline styles (MusicBrainz's /user/<name>/report:
// style-src without 'unsafe-inline') drops every <style> the members add and every style="" they write,
// so the dock and the windows came out unstyled. CSSOM isn't under that policy: once the page reports a
// refused style, each <style> is mirrored into a constructed sheet (document.adoptedStyleSheets, kept in
// step with its text and dropped with it), and a refused style attribute is set again through el.style.
(function () {
  if (typeof CSSStyleSheet === 'undefined' || !('adoptedStyleSheets' in Document.prototype)) return;
  var on = false, tracked = [];
  function sync() {
    var adopted = document.adoptedStyleSheets.slice(), changed = false;
    tracked = tracked.filter(function (r) {
      if (r.el.isConnected) return true;
      var i = adopted.indexOf(r.sheet); if (i >= 0) { adopted.splice(i, 1); changed = true; }
      return false;
    });
    document.querySelectorAll('style').forEach(function (el) {
      var r = null;
      for (var i = 0; i < tracked.length; i++) if (tracked[i].el === el) { r = tracked[i]; break; }
      if (!r) { r = { el: el, sheet: new CSSStyleSheet(), text: null }; tracked.push(r); adopted.push(r.sheet); changed = true; }
      if (r.text !== el.textContent) { r.text = el.textContent; try { r.sheet.replaceSync(r.text); } catch (e) {} }
    });
    if (changed) document.adoptedStyleSheets = adopted;
  }
  var queued = false;
  function later() { if (!queued) { queued = true; Promise.resolve().then(function () { queued = false; sync(); }); } }
  function start() {
    if (on) return;
    on = true; sync();
    new MutationObserver(later).observe(document, { childList: true, subtree: true, characterData: true });
  }
  document.addEventListener('securitypolicyviolation', function (e) {
    var d = e.effectiveDirective || e.violatedDirective || '';
    if (d === 'style-src-elem' || d === 'style-src') start();
    if (d === 'style-src-attr' || d === 'style-src') {
      var t = e.target;
      if (t && t.nodeType === 1 && t.hasAttribute('style')) { try { t.style.cssText = t.getAttribute('style'); } catch (x) {} }
    }
  }, true);
})();
