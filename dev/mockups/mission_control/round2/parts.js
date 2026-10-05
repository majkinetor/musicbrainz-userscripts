// Shared header + sidebar toggles for the round-2 mockups.
// <header data-mode="new|existing"> is filled in here so the three variants stay identical up top.
(function () {
  const hdr = document.querySelector('header.hdr');
  const isNew = hdr.dataset.mode === 'new';
  hdr.innerHTML = `
    <div class="l">
      <span class="logo"><span class="glyph">◎</span>MC</span><span class="ver">2026.10.5</span>
      <span class="sep"></span>
      <label class="src" title="Source link (or handed off from First Contact)">
        <input value="https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc" readonly>
        <button class="btn primary">Probe</button>
      </label>
    </div>
    <div class="c">
      <span class="cover"></span>
      <div>
        <div class="ttl">Daft Punk — Discovery</div>
        <div class="sub">${isNew ? 'new release · from First Contact' : 'existing · <span class="mono">8f4e…c21a</span>'} · Album · 14 tr · 2001 · CD</div>
      </div>
      <div class="badges">
        ${isNew ? '<span class="bdg add">new</span>' : ''}
        <span class="bdg add" title="Platform Check">🔗 <b>+4</b></span>
        <span class="bdg warn" title="ISRC Scout">ISRC <b>6/14</b></span>
        <span class="bdg add" title="Art Station">🖼 <b>+1</b></span>
        <span class="bdg info" title="Credit Hoarder (info only)">CH <b>42</b></span>
        <span class="bdg idle" title="Fusion — not fetched yet">Fusion <b>?</b></span>
      </div>
    </div>
    <div class="r">
      <button class="btn tog" data-side="left" title="Execution order sidebar">⫷ Order</button>
      <button class="btn tog" data-side="right" title="Release / info sidebar">Info ⫸</button>
      <span class="sep"></span>
      <button class="btn ghost">Log</button><button class="btn ghost">? Help</button><button class="btn ghost">⚙</button>
    </div>`;
  const sync = () => hdr.querySelectorAll('[data-side]').forEach(b => {
    const s = b.dataset.side;
    b.hidden = !document.querySelector('.side.' + s);
    b.classList.toggle('on', !document.body.classList.contains('no-' + s));
  });
  hdr.addEventListener('click', e => {
    const b = e.target.closest('[data-side]');
    if (b) { document.body.classList.toggle('no-' + b.dataset.side); sync(); }
  });
  document.addEventListener('click', e => {
    const x = e.target.closest('[data-close]');
    if (x) { document.body.classList.add('no-' + x.dataset.close); sync(); }
    const s = e.target.closest('.seg span');
    if (s) { s.parentNode.querySelectorAll('span').forEach(o => o.classList.toggle('on', o === s)); }
    const c = e.target.closest('.cb');
    if (c && !c.closest('.foot')) { c.classList.toggle('on'); c.classList.remove('half'); }
  });
  sync();
})();
