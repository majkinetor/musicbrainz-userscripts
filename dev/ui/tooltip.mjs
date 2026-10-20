// The tooltip every script shows instead of the browser's `title` (STANDARDS → Standard 14).
//
// The browser's tooltip can't be styled: one grey box, one font, the whole text as a wall.
// Apollo's match card (#654) showed what a tooltip can be, and this generalises it:
//
//   <button data-tip="Copy the log\nRight-click: copy it as Markdown">   plain text, structured
//   mbuTip(el, 'text')                                                    the same, from code
//   mbuTipOn('.tc-badge[data-slot]', el => html, { interactive: true, card: true })
//   mbuTip(el, el => html | Node, opts)                                   one element, rich
//   mbuTipCard({ head, title, aside, body, foot, footAside })            the card's markup
//   mbuTipHide(true)                                                       close it now
//
// The text form (mbuTipText) is plain text with a little structure read out of it, so the
// strings stay readable in the source:
//   · a line `Right-click: …`, `Ctrl+click: …`, `Esc: …` is a key row: a mouse action drawn as
//     its modifier keys and a mouse with its button filled in, any other key as a chip
//   · a level row `{#2f6fd6} Exact: …` has a dot in that colour; `{#… on}` marks the chosen
//     level, `{#… off}` dims one (a cutoff's table)
//   · two or more lines `On: …` / `Off: …` (≤ 3 words before the colon) are an option list
//   · ` · ` before such a label, or `. ` between two of them, starts a new line
//   · a line starting `- ` or `• ` is a bullet, one starting `⚠` a warning
//   · the first line is the lead when more follows; a long single paragraph's first sentence is
//   · `code`, **bold**, and a shortcut in brackets, (Ctrl+Alt+F) or (P), drawn as a key
//
// Behaviour: opens after 350 ms (at once while moving from one tip to the next), below the
// element or above when there's no room, its arrow at the element (or at the pointer on a wide
// one); closes on leaving, a click, a scroll or Esc. An interactive one stays while the pointer
// is on it, so its links can be followed. Keyboard focus shows it too. An element with no text
// of its own gets the tip as its aria-label.
//
// Several copies run on one page (every script carries one, String Theory carries eleven). The
// first to start takes `data-tip` and stray titles (data-mbu-tip on <html>); each copy serves
// the providers its own script registered. They share the one #mbu-tip element and its style.
//
// A leftover `title` inside one of our containers (ROOTS in ui-components.mjs, or .mbu-ui) is
// moved to data-tip when hovered, before the browser shows it.
//
// Written as real functions and emitted with Function.prototype.toString, so this file is
// linted and parsed like any other; no template literals, no imports, no ES2020+ syntax inside.

const V = 11;   // bump when the CSS changes: a newer copy replaces an older copy's <style>

// Every var() has its fallback: Scribe and Bandcamp Player Enhanced carry no tokens, and with
// no other script on the page there is no :root block to read from.
const CSS = [
    '#mbu-tip{position:fixed;left:0;top:0;z-index:var(--mbu-z-tip,2147483600);box-sizing:border-box;',
    'max-width:min(330px,calc(100vw - 16px));padding:7px 11px 8px;',
    'background:var(--mbu-bg,#fff);color:var(--mbu-text,#222);',
    'border:1px solid var(--mbu-border,#cfc6e6);border-radius:9px;',
    'box-shadow:0 6px 24px rgba(40,20,80,.2),0 1px 3px rgba(40,20,80,.12);',
    'font:12.5px/1.45 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);',
    'text-align:left;white-space:normal;overflow-wrap:break-word;letter-spacing:normal;text-transform:none;',
    'pointer-events:none;visibility:hidden;opacity:0;transform:translateY(-3px);',
    'transition:opacity .12s ease,transform .12s ease,visibility 0s linear .12s}',
    '#mbu-tip.mbu-tip-up{transform:translateY(3px)}',
    '#mbu-tip.mbu-tip-on{visibility:visible;opacity:1;transform:none;transition:opacity .12s ease,transform .12s ease}',
    '#mbu-tip.mbu-tip-act.mbu-tip-on{pointer-events:auto}',
    '#mbu-tip.mbu-tip-wide{max-width:min(460px,calc(100vw - 16px))}',
    // the arrow: a square turned 45°, two of its borders showing, at --mbu-tip-ax
    '#mbu-tip::before{content:"";position:absolute;left:calc(var(--mbu-tip-ax,50%) - 5px);top:-5px;width:8px;height:8px;',
    'background:inherit;border:1px solid var(--mbu-border,#cfc6e6);border-right:0;border-bottom:0;transform:rotate(45deg)}',
    '#mbu-tip.mbu-tip-up::before{top:auto;bottom:-5px;border:1px solid var(--mbu-border,#cfc6e6);border-left:0;border-top:0}',
    '#mbu-tip.mbu-tip-card:not(.mbu-tip-up)::before{background:var(--mbu-bg-raised,#faf9fe)}',
    // the text form
    '#mbu-tip .mbu-tip-lead{font-weight:600;color:var(--mbu-text,#222)}',
    '#mbu-tip .mbu-tip-p{margin:0;color:var(--mbu-text-dim,#555)}',
    '#mbu-tip .mbu-tip-lead+*,#mbu-tip .mbu-tip-p+*,#mbu-tip .mbu-tip-ul+*,#mbu-tip .mbu-tip-rows+*{margin-top:5px}',
    '#mbu-tip>.mbu-tip-p:first-child:last-child{color:var(--mbu-text,#222)}',
    '#mbu-tip .mbu-tip-warn{color:var(--mbu-warn,#a05a00)}',
    '#mbu-tip .mbu-tip-rows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:start;color:var(--mbu-text-dim,#555)}',
    // a label is centred on its text's first line (12.5px × 1.45 ≈ 18px), whether keys, a mouse or both
    // (majkinetor: "why is the first mouse lower?" — a baseline set by a mouse's bottom edge needed nudging)
    '#mbu-tip .mbu-tip-rows>.mbu-tip-kk,#mbu-tip .mbu-tip-rows>.mbu-tip-dl{min-height:18px}',
    '#mbu-tip .mbu-tip-rows>.mbu-tip-k{line-height:18px}',
    '#mbu-tip .mbu-tip-rows>:nth-child(odd){justify-self:start}',
    '#mbu-tip .mbu-tip-rows>.mbu-tip-span{grid-column:2;justify-self:stretch;margin:-2px 0 0}',
    // a key is bold grey text, no box (majkinetor picked B of six mocks, then "make keys gray too")
    '#mbu-tip .mbu-tip-k{display:inline-block;padding:0;border:0;',
    'background:none;color:var(--mbu-text-weak,#888);font:600 11.5px/1.5 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}',
    '#mbu-tip .mbu-tip-kk{display:inline-flex;align-items:center;gap:3px;color:var(--mbu-accent-text,#5f3ec0);white-space:nowrap}',
    '#mbu-tip .mbu-tip-dl{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--mbu-text,#222);white-space:nowrap}',
    '#mbu-tip .mbu-tip-dl i{flex:none;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.22)}',
    '#mbu-tip .mbu-tip-on{color:var(--mbu-accent-text,#5f3ec0)}',
    '#mbu-tip .mbu-tip-dl.mbu-tip-on::after{content:"◂";margin-left:-2px;font-size:11px}',
    '#mbu-tip .mbu-tip-off{opacity:.45}',
    '#mbu-tip .mbu-tip-sym{letter-spacing:.2px}',
    // the mouse small and grey, only the pressed button in the accent (majkinetor: 6 of six mocks)
    '#mbu-tip .mbu-tip-mouse{display:block;flex:none;position:relative}',
    '#mbu-tip .mbu-tip-mouse rect[fill=none],#mbu-tip .mbu-tip-mouse path[stroke]{stroke:var(--mbu-text-weak,#888);stroke-width:1}',
    '#mbu-tip .mbu-tip-kx{font:600 10px/1 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);color:var(--mbu-text-weak,#888)}',
    '#mbu-tip .mbu-tip-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '#mbu-tip .mbu-tip-o{display:inline-block;padding:0 7px;border-radius:999px;background:var(--mbu-accent-soft,#ece4ff);',
    'color:var(--mbu-accent-text,#5f3ec0);font:600 11px/1.6 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}',
    '#mbu-tip .mbu-tip-ul{margin:0;padding:0 0 0 15px;color:var(--mbu-text-dim,#555)}',
    '#mbu-tip .mbu-tip-ul li{margin:1px 0;padding:0}',
    '#mbu-tip code{font:11.5px var(--mbu-font-mono,ui-monospace,Consolas,monospace);padding:0 4px;border-radius:4px;background:var(--mbu-bg-sunken,#f4f2f9)}',
    '#mbu-tip b{font-weight:600;color:var(--mbu-text,#222)}',
    '#mbu-tip a{color:var(--mbu-accent-text,#5f3ec0)}',
    // the card: a header band, a body, a quiet footer (Apollo's match card)
    '#mbu-tip.mbu-tip-card{padding:0;width:380px;max-width:min(380px,calc(100vw - 16px));overflow:visible}',
    '#mbu-tip .mbu-tip-ch{display:flex;align-items:center;gap:8px;padding:8px 11px;border-bottom:1px solid var(--mbu-border-soft,#e2dcef);',
    'background:var(--mbu-bg-raised,#faf9fe);border-radius:9px 9px 0 0}',
    '#mbu-tip .mbu-tip-ca{margin-left:auto;font-size:11px;color:var(--mbu-text-weak,#999);white-space:nowrap}',
    '#mbu-tip .mbu-tip-cb{padding:8px 11px;display:flex;flex-direction:column;gap:6px}',
    '#mbu-tip .mbu-tip-cf{display:flex;gap:10px;padding:6px 11px;border-top:1px solid var(--mbu-border-soft,#e2dcef);font-size:11px;color:var(--mbu-text-weak,#999)}',
    '#mbu-tip .mbu-tip-cf>:last-child:not(:first-child){margin-left:auto}',
    '@media (prefers-reduced-motion:reduce){#mbu-tip,#mbu-tip.mbu-tip-on{transition:none;transform:none}}',
].join('');

// ── the runtime (emitted into every carrier) ──────────────────────────────────

function mbuTipEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
}

// a label before ': ' — at most three words, no sentence punctuation
function mbuTipLabel(line) {
    var m = /^([^\s:.,;!?()][^:.,;!?()]{0,40}?): (\S[\s\S]*)$/.exec(line);
    if (!m || m[1].split(/\s+/).length > 3 || /https?$/i.test(m[1])) return null;
    return { label: m[1], text: m[2], key: mbuTipIsKey(m[1]) };
}
function mbuTipIsKey(label) {
    return /click|drag|wheel|scroll|hover|double|press|paste|\bkey\b|^(esc|escape|enter|return|tab|space|ctrl|shift|alt|cmd|meta|del|delete|backspace|f\d{1,2})\b|\+|^[↑↓←→]/i.test(label);
}
function mbuTipInline(s) {
    return mbuTipEsc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\(((?:(?:Ctrl|Alt|Shift|Cmd|Meta)\+)+[^\s()]+)\)/g, function (m, k) { return mbuTipKbd(k); })
        .replace(/\s\((Esc|Enter|Space|Tab|[A-Z0-9]|[↑↓←→])\)(?=$|[\s.,;])/g, ' <kbd class="mbu-tip-k">$1</kbd>');
}
function mbuTipCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// A key row's label: a mouse action is drawn — its modifiers as keys, then a mouse with the
// button it takes filled in (×2 for a double click) — with the words kept for a screen reader;
// any other label (Esc, Ctrl+V, Hover) is a key chip with its text.
function mbuTipKey(label) {
    // two ways to do the same, "Middle-click / Alt+click": each drawn, a grey slash between
    var alts = String(label).split(/\s+\/\s+/);
    if (alts.length > 1) return '<span class="mbu-tip-kk">' + alts.map(mbuTipKey).join('<span class="mbu-tip-kx">/</span>') + '</span>';
    var m = /^((?:(?:ctrl|alt|shift|cmd|meta)\s*[+-]\s*)*)(left|right|middle|double)?[- ]?(click|drag|wheel|scroll)$/i.exec(String(label).trim());
    if (!m) return /^(?:(?:ctrl|alt|shift|cmd|meta)\s*\+\s*)+\S/i.test(label) ? mbuTipKbd(label) : '<span class="mbu-tip-k">' + mbuTipEsc(mbuTipCap(label)) + '</span>';
    var mods = m[1] ? m[1].split(/\s*[+-]\s*/).filter(Boolean) : [];
    var btn = (m[2] || '').toLowerCase(), act = m[3].toLowerCase();
    var wheel = btn === 'middle' || act === 'wheel' || act === 'scroll';
    var fill = wheel ? '' : btn === 'right' ? 'M6 1C8.8 1 11 3.2 11 6v1H6z' : 'M6 1C3.2 1 1 3.2 1 6v1h5z';
    var svg = '<svg class="mbu-tip-mouse" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">'
        + (fill ? '<path d="' + fill + '" fill="currentColor"/>' : '')
        + '<rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/>'
        + '<path d="M1 7h10' + (wheel ? '' : 'M6 1v6') + '" stroke="currentColor" stroke-width="1.1"/>'
        + (wheel ? '<rect x="5" y="2.6" width="2" height="3.4" rx="1" fill="currentColor"/>' : '')
        + '</svg>';
    var extra = btn === 'double' ? '×2' : act === 'drag' ? 'drag' : (act === 'wheel' || act === 'scroll') ? '↕' : '';
    return '<span class="mbu-tip-kk"><span class="mbu-tip-sr">' + mbuTipEsc(mbuTipCap(label)) + '</span>'
        + (mods.length ? '<kbd class="mbu-tip-k mbu-tip-sym" aria-hidden="true">' + mods.map(mbuTipMod).join('+') + '</kbd>' : '')
        + svg + (extra ? '<span class="mbu-tip-kx" aria-hidden="true">' + extra + '</span>' : '') + '</span>';
}

// Ctrl C, Alt A, Shift ⇧, Cmd ⌘ (majkinetor picked these, 5 of six mocks); the words go to a screen reader
function mbuTipMod(k) { return { ctrl: 'C', alt: 'A', shift: '⇧', cmd: '⌘', meta: '⌘' }[String(k).toLowerCase()] || k; }
// a shortcut, Ctrl+Shift+F → one key "C+⇧+F", its words kept for a screen reader
function mbuTipKbd(combo) {
    var parts = String(combo).split(/\s*\+\s*/);
    var key = parts.pop();
    return '<kbd class="mbu-tip-k mbu-tip-sym"><span class="mbu-tip-sr">' + mbuTipEsc(combo) + '</span><span aria-hidden="true">'
        + parts.concat('').map(mbuTipMod).join('+') + mbuTipEsc(key.length === 1 ? key.toUpperCase() : mbuTipCap(key)) + '</span></kbd>';
}

// Plain text → the tooltip's HTML (see the header for what is read out of it).
function mbuTipText(src) {
    var raw = String(src == null ? '' : src).replace(/\r/g, '').replace(/^\s+|\s+$/g, '');
    if (!raw) return '';
    var lines = [];
    // the shapes the old title texts took, read as the rows they mean:
    //   "… — click to open it"              → "…" + "Click: open it"
    //   "… (right-click: guess case all)"   → "…" + "Right-click: guess case all"
    //   "Ctrl-click", "Alt-click"           → "Ctrl+click", "Alt+click"
    raw = raw.replace(/\b(Ctrl|Alt|Shift|Cmd)-(click|drag)/gi, '$1+$2')
        .replace(/\s*\(((?:(?:right|middle|double|ctrl|alt|shift|cmd)[-+ ]?)+click|(?:ctrl|alt|shift|cmd)\+\w+):\s*([^()\n]+)\)(?=\s*(?:$|\n))/gim, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/\s+[—–-]\s+((?:(?:right|middle|double|ctrl|alt|shift)[-+ ]?)?click) to ([^\n·]+)/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/[.;]\s+((?:right|middle|double|ctrl|alt|shift)[-+ ]?click|click) to ([^\n·.]+)\.?(?=\s*(?:$|\n))/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; });
    raw.split('\n').forEach(function (line) {
        line = line.replace(/\s+$/, '');
        // ' · Label: ' starts a new line; so does '. Label: ' once the line itself opened with a label
        var parts = line.split(/\s+·\s+/), out = [parts[0]];
        for (var i = 1; i < parts.length; i++) {
            if (mbuTipLabel(parts[i])) out.push(parts[i]); else out[out.length - 1] += ' · ' + parts[i];
        }
        out.forEach(function (seg) {
            if (!mbuTipLabel(seg)) { lines.push(seg); return; }
            var bits = seg.split(/(?<=\.)\s+(?=[A-Z][\w+-]*(?:\s[\w+-]+)?:\s)/);
            bits.forEach(function (b) { lines.push(b); });
        });
    });
    // blocks: lead / paragraph / rows / bullets
    var blocks = [], rowRun = [];
    var flushRows = function () {
        if (!rowRun.length) return;
        var keyed = rowRun.filter(function (r) { return r.key; }).length;
        if (rowRun.length >= 2 || keyed) blocks.push({ t: 'rows', rows: rowRun });
        else blocks.push({ t: 'p', s: rowRun[0].line });
        rowRun = [];
    };
    lines.forEach(function (line, n) {
        if (!line.trim()) { flushRows(); return; }
        var b = /^\s*[-•]\s+(.*)$/.exec(line);
        if (b) {
            flushRows();
            var last = blocks[blocks.length - 1];
            if (last && last.t === 'ul') last.items.push(b[1]); else blocks.push({ t: 'ul', items: [b[1]] });
            return;
        }
        // a level row, "{#2f6fd6} Exact: …": a dot in the colour before the label; "{#… on}" marks the
        // chosen level, "{#… off}" dims one past it (a cutoff's table)
        var lv = /^\{(#[0-9a-f]{3,8})(?: (on|off))?\}\s*(\S[\s\S]*)$/i.exec(line);
        if (lv) {
            var ll = mbuTipLabel(lv[3]) || { label: lv[3], text: '' };
            rowRun.push({ label: ll.label, text: ll.text, dot: lv[1], st: lv[2] ? lv[2].toLowerCase() : '', line: line });
            return;
        }
        var l = mbuTipLabel(line);
        // the first line is a row only as a key or when a label follows: alone, "Release group: when…" is a sentence
        if (l && (l.key || blocks.length || rowRun.length || (lines[n + 1] && mbuTipLabel(lines[n + 1])))) { l.line = line; rowRun.push(l); return; }
        flushRows();
        blocks.push({ t: 'p', s: line });
    });
    flushRows();
    // one long paragraph: its first sentence becomes the lead
    if (blocks.length === 1 && blocks[0].t === 'p' && blocks[0].s.length > 110) {
        var m = /^(.{12,110}?[.!?])\s+(?=[A-Z(“"'])([\s\S]+)$/.exec(blocks[0].s);
        if (m) blocks = [{ t: 'p', s: m[1].replace(/\.$/, '') }, { t: 'p', s: m[2] }];
    }
    var lead = blocks.length > 1 && blocks[0].t === 'p';
    var rowsHtml = function (bl) {
        return bl.rows.map(function (r) {
            if (r.dot) {
                var c = r.st ? ' mbu-tip-' + r.st : '';
                return '<span class="mbu-tip-dl' + c + '"><i style="background:' + r.dot + '"></i>' + mbuTipEsc(mbuTipCap(r.label)) + '</span>'
                    + '<span class="mbu-tip-dt' + c + '">' + mbuTipInline(r.text) + '</span>';
            }
            return (r.key ? mbuTipKey(r.label) : '<span class="mbu-tip-o">' + mbuTipEsc(mbuTipCap(r.label)) + '</span>') + '<span>' + mbuTipInline(r.text) + '</span>';
        }).join('');
    };
    var html = function (bl, i, span) {
        var sp = span ? ' mbu-tip-span' : '';
        if (bl.t === 'ul') return '<ul class="mbu-tip-ul' + sp + '">' + bl.items.map(function (x) { return '<li>' + mbuTipInline(x) + '</li>'; }).join('') + '</ul>';
        if (bl.t === 'rows') return span ? rowsHtml(bl) : '<div class="mbu-tip-rows">' + rowsHtml(bl) + '</div>';
        var warn = /^⚠/.test(bl.s);
        return '<div class="' + (lead && i === 0 ? 'mbu-tip-lead' : 'mbu-tip-p') + (warn ? ' mbu-tip-warn' : '') + sp + '">' + mbuTipInline(bl.s) + '</div>';
    };
    // rows with a note between them stay one grid, the note under the row before it, so their labels line up
    var first = -1, last = -1;
    blocks.forEach(function (bl, i) { if (bl.t === 'rows') { if (first < 0) first = i; last = i; } });
    var out = '';
    for (var i = 0; i < blocks.length; i++) {
        if (i === first && last > first) {
            out += '<div class="mbu-tip-rows">';
            for (; i <= last; i++) out += html(blocks[i], i, true);
            out += '</div>';
            i = last;
        } else out += html(blocks[i], i, false);
    }
    return out;
}

// A card's markup: head (HTML: a badge, an icon) · title · aside / body (HTML) / foot · footAside.
function mbuTipCard(o) {
    o = o || {};
    var h = '';
    if (o.head || o.title || o.aside) {
        h += '<div class="mbu-tip-ch">' + (o.head || '') + (o.title ? '<b>' + mbuTipEsc(o.title) + '</b>' : '')
            + (o.aside ? '<span class="mbu-tip-ca">' + mbuTipEsc(o.aside) + '</span>' : '') + '</div>';
    }
    if (o.body) h += '<div class="mbu-tip-cb">' + o.body + '</div>';
    if (o.foot || o.footAside) h += '<div class="mbu-tip-cf"><span>' + (o.foot || '') + '</span>' + (o.footAside ? '<span>' + o.footAside + '</span>' : '') + '</div>';
    return h;
}

// This copy's state, made on first use: a script can call mbuTip() before the line its block sits
// on has run (or return before it, as a copy switched off by mbuClaim does), so nothing here may
// rest on a statement having run. Every function is a hoisted declaration.
function mbuTipS() {
    return mbuTipS.s || (mbuTipS.s = {
        me: Math.random().toString(36).slice(2, 10), lead: false, els: typeof WeakMap === 'function' ? new WeakMap() : null, prov: [],
        cur: null, curOpts: null, pend: null, showT: 0, hideT: 0, liveT: 0, warm: 0, quiet: null, mx: -1, my: -1, obs: null,
    });
}

// mbuTip(el, 'text' | null, opts) sets or clears the element's tip; mbuTip(el, fn, opts) gives it
// a rich one, fn(el) returning HTML or a Node (or nothing, for no tip this time).
function mbuTip(el, content, opts) {
    if (!el) return el;
    var _mbuTip = mbuTipS();
    mbuTipStart();
    opts = opts || {};
    if (typeof content === 'function') {
        if (_mbuTip.els) _mbuTip.els.set(el, { fn: content, opts: opts });
        el.setAttribute('data-mbu-tip-own', '');
        el.removeAttribute('title');
        return el;
    }
    if (content == null || content === '') el.removeAttribute('data-tip'); else el.setAttribute('data-tip', String(content));
    if (opts.place) el.setAttribute('data-tip-place', opts.place);
    if (opts.wide) el.setAttribute('data-tip-wide', '');
    el.removeAttribute('title');
    if (_mbuTip.cur === el) mbuTipRender();
    return el;
}
// A rich tip for every element matching a selector, now and after any re-render:
//   mbuTipOn('.tc-badge[data-slot]', function (el) { return html; }, { interactive: true, card: true })
// opts: interactive (the pointer can move onto it), card (mbuTipCard markup), wide, place: 'above', delay (ms)
function mbuTipOn(selector, fn, opts) {
    mbuTipS().prov.push({ sel: selector, fn: fn, opts: opts || {} });
    mbuTipStart();
}

// Show a tip at an element now, for a script that decides itself when one is due (Group
// Therapy's count on MusicBrainz's own links): content is HTML, a Node, or fn(el) giving either.
// It closes as any tip does, when the pointer leaves the element, or with mbuTipHide(true).
function mbuTipShowFor(el, content, opts) {
    if (!el || content == null || content === '') { mbuTipHide(true); return; }
    mbuTipStart();
    var o = opts || {};
    var fn = typeof content === 'function' ? content : function () { return content; };
    var S = mbuTipS();
    if (S.cur === el) { S.curOpts.fn = fn; if (!mbuTipRender()) mbuTipHide(true); return; }
    mbuTipShow({ el: el, fn: fn, opts: o });
}

// HTML for innerHTML on a page that enforces Trusted Types (YouTube Music, #650), as mbuHtml in
// ui-components.mjs does; the tooltip carries its own, since Scribe and BPE have no ST-UI block.
function mbuTipHtml(s) {
    if (mbuTipHtml.tt === undefined) {
        mbuTipHtml.tt = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) mbuTipHtml.tt = tt.createPolicy('mbu-tip-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings */ }
    }
    return mbuTipHtml.tt ? mbuTipHtml.tt.createHTML(String(s)) : String(s);
}

function mbuTipCss() {
    var s = document.getElementById('mbu-tip-css');
    if (s && +s.getAttribute('data-v') >= mbuTipV()) return;
    if (!s) { s = document.createElement('style'); s.id = 'mbu-tip-css'; (document.head || document.documentElement).appendChild(s); }
    s.setAttribute('data-v', String(mbuTipV()));
    s.textContent = mbuTipCssText();
}
function mbuTipEl() {
    var t = document.getElementById('mbu-tip');
    if (!t) {
        t = document.createElement('div');
        t.id = 'mbu-tip';
        t.setAttribute('role', 'tooltip');
        (document.body || document.documentElement).appendChild(t);
    }
    return t;
}

// what to show for the element under the pointer: the nearest of this copy's registrations,
// and — for the copy that leads — data-tip, or a title inside one of our containers
function mbuTipFind(node) {
    var _mbuTip = mbuTipS();
    var tip = document.getElementById('mbu-tip');
    for (var el = node && node.nodeType === 1 ? node : node && node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        if (el === tip) return null;
        var reg = _mbuTip.els && _mbuTip.els.get(el);
        if (reg) return { el: el, fn: reg.fn, opts: reg.opts };
        for (var i = 0; i < _mbuTip.prov.length; i++) {
            var p = _mbuTip.prov[i];
            try { if (el.matches(p.sel)) return { el: el, fn: p.fn, opts: p.opts }; } catch (e) { /* a bad selector matches nothing */ }
        }
        if (!_mbuTip.lead) continue;
        if (el.hasAttribute('data-mbu-tip-own')) return null;   // another copy's rich tip
        if (el.hasAttribute('data-tip')) return { el: el, opts: { place: el.getAttribute('data-tip-place'), wide: el.hasAttribute('data-tip-wide') } };
        // an <option> keeps its title: the browser draws a dropdown's list, where no page tooltip reaches
        if (el.hasAttribute('title') && el.getAttribute('title') && el.namespaceURI === 'http://www.w3.org/1999/xhtml' && !/^(OPTION|OPTGROUP)$/.test(el.tagName)) {
            var root = null;
            try { root = el.closest(mbuTipRoots()); } catch (e) { /* no roots */ }
            if (root) {
                el.setAttribute('data-tip', el.getAttribute('title'));
                el.removeAttribute('title');
                return { el: el, opts: {} };
            }
        }
    }
    return null;
}

function mbuTipRender() {
    var _mbuTip = mbuTipS();
    var a = _mbuTip.cur, o = _mbuTip.curOpts || {}, t = mbuTipEl(), c;
    if (!a) return false;
    if (o.fn) {
        try { c = o.fn(a); } catch (e) { c = null; }
        if (c == null || c === '') return false;
        if (typeof c === 'string') t.innerHTML = mbuTipHtml(c);
        else { t.textContent = ''; t.appendChild(c); }
    } else {
        var s = a.getAttribute('data-tip');
        if (!s) return false;
        var h = mbuTipText(s);
        t.innerHTML = mbuTipHtml(h);
        // an element with nothing to read of its own is named by its tip
        if (!a.getAttribute('aria-label') && !/[\p{L}\p{N}]/u.test(a.textContent || '') && !a.querySelector('img[alt]:not([alt=""])')) {
            a.setAttribute('aria-label', s.split('\n')[0]);
        }
    }
    t.className = 'mbu-ui' + (o.card ? ' mbu-tip-card' : '') + (o.interactive ? ' mbu-tip-act' : '') + (o.wide ? ' mbu-tip-wide' : '');
    t.setAttribute('data-owner', _mbuTip.me);
    mbuTipPlace(t, a, o.place);
    return true;
}

function mbuTipPlace(t, a, place) {
    var _mbuTip = mbuTipS();
    var r = a.getBoundingClientRect();
    if (!r.width && !r.height && a.firstElementChild) r = a.firstElementChild.getBoundingClientRect();
    t.style.left = '0px'; t.style.top = '0px';
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight, gap = 8, m = 6;
    var below = place !== 'above';
    if (below && r.bottom + gap + h > vh - m && r.top - gap - h >= m) below = false;
    else if (!below && r.top - gap - h < m && r.bottom + gap + h <= vh - m) below = true;
    var top = below ? r.bottom + gap : r.top - gap - h;
    // a wide element (a row, a long field): the arrow points where the pointer is
    var cx = r.left + r.width / 2;
    if (r.width > 220 && _mbuTip.mx >= r.left && _mbuTip.mx <= r.right) cx = _mbuTip.mx;
    var left = Math.max(m, Math.min(vw - w - m, Math.round(cx - w / 2)));
    t.style.left = left + 'px';
    t.style.top = Math.max(m, Math.round(top)) + 'px';
    t.style.setProperty('--mbu-tip-ax', Math.max(12, Math.min(w - 12, Math.round(cx - left))) + 'px');
    t.classList.toggle('mbu-tip-up', !below);
}

function mbuTipShow(found) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.hideT); clearTimeout(_mbuTip.showT);
    if (_mbuTip.cur && _mbuTip.cur !== found.el) mbuTipHide(true);
    mbuTipCss();
    _mbuTip.cur = found.el;
    _mbuTip.curOpts = { fn: found.fn, interactive: !!found.opts.interactive, card: !!found.opts.card, wide: !!found.opts.wide, place: found.opts.place };
    if (!mbuTipRender()) { _mbuTip.cur = null; return; }
    var t = mbuTipEl();
    found.el.setAttribute('aria-describedby', 'mbu-tip');
    // next frame, so the transition runs from the hidden state
    requestAnimationFrame(function () { if (_mbuTip.cur === found.el) t.classList.add('mbu-tip-on'); });
    // the element can go (a re-render) or change its text while the tip is up
    clearInterval(_mbuTip.liveT);
    _mbuTip.liveT = setInterval(function () { if (!_mbuTip.cur || !_mbuTip.cur.isConnected) mbuTipHide(true); }, 300);
    try {
        if (!_mbuTip.obs) _mbuTip.obs = new MutationObserver(function () { if (_mbuTip.cur && !mbuTipRender()) mbuTipHide(true); });
        _mbuTip.obs.disconnect();
        if (!found.fn) _mbuTip.obs.observe(found.el, { attributes: true, attributeFilter: ['data-tip'] });
    } catch (e) { /* no observer: the text is read again on the next hover */ }
}

// mbuTipHide(true) closes the tip at once; without, after the short grace a leaving pointer gets
function mbuTipHide(now) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.showT); clearTimeout(_mbuTip.hideT);
    _mbuTip.pend = null;
    var hide = function () {
        var a = _mbuTip.cur;
        if (!a) return;
        _mbuTip.cur = null;
        clearInterval(_mbuTip.liveT);
        try { if (_mbuTip.obs) _mbuTip.obs.disconnect(); } catch (e) { /* gone */ }
        if (a.getAttribute('aria-describedby') === 'mbu-tip') a.removeAttribute('aria-describedby');
        var t = document.getElementById('mbu-tip');
        if (t && t.getAttribute('data-owner') === _mbuTip.me) t.classList.remove('mbu-tip-on');
        _mbuTip.warm = Date.now();
    };
    if (now) hide();
    else _mbuTip.hideT = setTimeout(hide, _mbuTip.curOpts && _mbuTip.curOpts.interactive ? 220 : 70);
}

function mbuTipStart() {
    if (mbuTipStart.done || typeof document === 'undefined') return;
    var _mbuTip = mbuTipS();
    var root = document.documentElement;
    if (!root) { document.addEventListener('DOMContentLoaded', mbuTipStart, { once: true }); return; }
    mbuTipStart.done = true;
    if (!root.hasAttribute('data-mbu-tip')) { root.setAttribute('data-mbu-tip', _mbuTip.me); _mbuTip.lead = true; }
    var inTip = function (n) { var t = document.getElementById('mbu-tip'); return !!(t && n && t.contains(n)); };
    window.addEventListener('mousemove', function (e) { _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; }, { passive: true, capture: true });
    window.addEventListener('mouseover', function (e) {
        _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; _mbuTip.over = e.target;   // :hover can read false in a page that has not seen a real move
        if (inTip(e.target)) { if (_mbuTip.cur) clearTimeout(_mbuTip.hideT); return; }
        var f = mbuTipFind(e.target);
        if (!f) { if (_mbuTip.cur && !_mbuTip.cur.contains(e.target)) mbuTipHide(); return; }
        if (f.el === _mbuTip.cur) { clearTimeout(_mbuTip.hideT); return; }
        if (f.el === _mbuTip.quiet || (_mbuTip.pend && _mbuTip.pend.el === f.el)) return;
        clearTimeout(_mbuTip.showT);
        _mbuTip.pend = f;
        var warm = _mbuTip.cur || Date.now() - _mbuTip.warm < 450;
        _mbuTip.showT = setTimeout(function () {
            _mbuTip.pend = null;
            if (f.el.isConnected && f.el.contains(_mbuTip.over)) mbuTipShow(f);
        }, warm ? 40 : (f.opts.delay != null ? f.opts.delay : 350));
    }, true);
    window.addEventListener('mouseout', function (e) {
        var to = e.relatedTarget;
        var q = _mbuTip.quiet;
        if (q && q.contains(e.target) && !(to && q.contains(to))) _mbuTip.quiet = null;
        var p = _mbuTip.pend;
        if (p && p.el.contains(e.target) && !(to && p.el.contains(to))) { clearTimeout(_mbuTip.showT); _mbuTip.pend = null; }
        var a = _mbuTip.cur;
        if (!a) return;
        if (to && (a.contains(to) || (_mbuTip.curOpts.interactive && inTip(to)))) return;
        if (a.contains(e.target) || inTip(e.target)) mbuTipHide();
    }, true);
    window.addEventListener('mousedown', function (e) {
        if (inTip(e.target)) return;
        clearTimeout(_mbuTip.showT); _mbuTip.pend = null;
        var f = mbuTipFind(e.target);
        _mbuTip.quiet = f ? f.el : null;   // no tip again on the element just clicked until the pointer leaves it
        if (_mbuTip.cur) mbuTipHide(true);
    }, true);
    document.addEventListener('keydown', function (e) {
        if (!_mbuTip.cur) return;
        var interactive = _mbuTip.curOpts && _mbuTip.curOpts.interactive;
        // typing closes a plain tip, as it does the browser's; modifiers alone don't
        if (e.key !== 'Escape') { if (!interactive && !/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) mbuTipHide(true); return; }
        mbuTipHide(true);
        if (interactive) e.stopPropagation();   // a card is a popover: Esc closes it and nothing else
    }, true);
    window.addEventListener('scroll', function (e) { if (_mbuTip.cur && !inTip(e.target)) mbuTipHide(true); }, true);
    window.addEventListener('blur', function () { if (_mbuTip.cur) mbuTipHide(true); });
    document.addEventListener('focusin', function (e) {
        var el = e.target, vis = false;
        try { vis = el.matches(':focus-visible'); } catch (x) { /* old browser */ }
        if (!vis) return;
        var f = mbuTipFind(el);
        if (f && f.el === el) { clearTimeout(_mbuTip.showT); _mbuTip.showT = setTimeout(function () { if (document.activeElement === el) mbuTipShow(f); }, 150); }
    }, true);
    document.addEventListener('focusout', function (e) {
        if (_mbuTip.cur && _mbuTip.cur === e.target && !(e.relatedTarget && inTip(e.relatedTarget))) mbuTipHide();
    }, true);
}

// stand-ins for the generated three, so this module parses and lints on its own
function mbuTipV() { return V; }
function mbuTipCssText() { return CSS; }
function mbuTipRoots() { return '.mbu-ui'; }

const RUNTIME = [mbuTipEsc, mbuTipLabel, mbuTipIsKey, mbuTipInline, mbuTipCap, mbuTipMod, mbuTipKbd, mbuTipKey, mbuTipText, mbuTipCard, mbuTipS,
    mbuTip, mbuTipOn, mbuTipShowFor, mbuTipHtml, mbuTipCss, mbuTipEl, mbuTipFind, mbuTipRender, mbuTipPlace, mbuTipShow, mbuTipHide, mbuTipStart];

/** The tooltip's JS, for the ST-UI and ST-TIP blocks. `roots`: our containers (ui-components' ROOTS). */
export function tipJs(roots) {
    return [
        '// Tooltips: our own, never the browser\'s title (dev/ui/tooltip.mjs, STANDARDS → Standard 14).',
        'function mbuTipV() { return ' + V + '; }',
        'function mbuTipCssText() { return ' + JSON.stringify(CSS) + '; }',
        'function mbuTipRoots() { return ' + JSON.stringify(roots.join(',')) + '; }',
        ...RUNTIME.map(String),
        'mbuTipStart();',
    ].join('\n');
}

// for the unit spec: the text form, runnable in Node
export { mbuTipText, CSS as TIP_CSS };
