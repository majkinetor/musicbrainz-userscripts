// Page-wide hover-highlight (issue #63).
//
// When the user hovers an entity link OR a role chip ANYWHERE on the page
// — including MB's relationship editor below the review table — every
// matching text occurrence across the whole page lights up. Same effect as
// Chrome's Find-on-page "Highlight All", on demand.
//
// Why a global installer (not panel-scoped): majkinetor pointed out on #63
// that hovering inside the review table is useless because you can't see
// both the table and MB's rel editor on one screen. The point is to spot
// "Jamie Saft" across 5 different tracks while you're *operating in MB's
// editor*. So the listeners attach to `document.body` once, persist after
// the review table is gone, and target MB's own DOM.
//
// Hover targets:
//   - Any MB entity link (`<a href="/artist|work|label|place|recording|…/<mbid>">`)
//     → highlights the link text everywhere it appears (the entity's
//     credited name).
//   - MB rel-editor role label (`<th class="link-phrase"><label>has remixes:</label>`)
//     → highlights every occurrence of the role text across the page.
//     Confirmed DOM (release + track rel rows; majkinetor 2026-05-26):
//       <tr class="has-remixes">
//         <th class="link-phrase">
//           <label>has remixes:</label>
//           <button class="icon add-item add-another-entity" …></button>
//         </th>
//         <td class="relationship-list">…entity links + comments…</td>
//       </tr>
//     We hover-detect `th.link-phrase` (anywhere inside), read the
//     `<label>` text, strip the trailing ":". Hovers on the `+` / edit /
//     remove buttons inside the th are excluded so role highlight
//     doesn't fire when the user is reaching for the action icons.
//   - Our own `.discogs-role-chip` (rendered by review-table.js) → uses
//     `data-role-key` which already strips the track-position suffix so
//     `bass [1]` and `bass [3]` share one needle `bass`.
//   - `span.discogs-entity-name` (review-table entities without a Discogs
//     URL) → fallback for entities not rendered as links.
//
// Engine: CSS Custom Highlight API (`CSS.highlights.set(name, new
// Highlight(...ranges))` + `::highlight(name)`). Zero DOM mutation, so
// MB's React tree is undisturbed. Silently no-ops on browsers without the
// API (graceful degradation).

let _installed = false;

export function installHoverHighlight() {
    if (_installed) return;
    _installed = true;
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', () => {
            _installed = false;
            installHoverHighlight();
        }, { once: true });
        return;
    }

    // Persistent style — lives in <head>, outlives the review table.
    // Two highlight buckets so the user can tell at a glance whether a
    // matched relationship is already in MB (blue/white) or newly staged
    // by our import and not yet submitted (blue/yellow). Same engine,
    // two named Highlights — maintainer's preferred palette per #63.
    const style = document.createElement('style');
    style.id = 'discogs-hover-highlight-style';
    style.textContent = `
        ::highlight(discogs-hover-existing) { background-color: blue; color: white; }
        ::highlight(discogs-hover-new)      { background-color: blue; color: yellow; }
        .discogs-role-chip { padding: 0 2px; border-radius: 3px; transition: background 0.08s, color 0.08s; }
        .discogs-role-chip:hover { background: #ffe066; color: #222; cursor: default; }
    `;
    document.head.appendChild(style);

    // Delegated mouseover/mouseout on the body. Survives MB's React
    // re-renders and our own review-table tear-down.
    document.body.addEventListener('mouseover', (ev) => {
        const needle = needleFor(ev.target);
        if (needle) highlightPageText(needle);
    });
    document.body.addEventListener('mouseout', (ev) => {
        const needle = needleFor(ev.target);
        if (needle) clearPageHighlight();
    });
}

// Decide what (if anything) the user is hovering. Returns a string needle
// to highlight, or `null` for "ignore this element".
function needleFor(target) {
    if (!target || !target.closest) return null;
    // 1. Our own role chips — `data-role-key` already strips the track-pos
    //    suffix. Available only while the review table is mounted.
    const chip = target.closest('.discogs-role-chip');
    if (chip) return chip.dataset.roleKey || '';
    // 2. MB rel-editor role label (`<th class="link-phrase"><label>has
    //    remixes:</label> <button …></th>`). Skip when the hover target
    //    is the `+` / edit / remove button — the user is going for the
    //    action, not the label.
    const phraseTh = target.closest('th.link-phrase');
    if (phraseTh && !target.closest('button')) {
        const label = phraseTh.querySelector('label');
        if (label) {
            let text = (label.textContent || '').trim();
            if (text.endsWith(':')) text = text.slice(0, -1).trim();
            if (text) return text;
        }
    }
    // 3. MB entity links anywhere on the page. The href tells us this is
    //    a real MB entity (not nav, not docs).
    const link = target.closest('a[href]');
    if (link) {
        const href = link.getAttribute('href') || '';
        if (/\/(artist|work|label|place|recording|series|release-group|event|instrument|area)\/[a-f0-9-]/.test(href)) {
            return (link.textContent || '').trim();
        }
    }
    // 4. Review-table entity spans (no Discogs URL → rendered as plain
    //    span instead of <a>). The class is set by review-table.js.
    const span = target.closest('span.discogs-entity-name');
    if (span) return (span.textContent || '').trim();
    return null;
}

// Classify the rel-row a text node belongs to as 'new' (freshly staged
// by our import, not yet committed) or 'existing' (already in MB).
// Returns 'new', 'existing', or null when the text node isn't inside a
// relationship row at all (e.g. label text, headers, other parts of the
// page).
//
// Detection signals (any one is enough to call it 'new'):
//   1. Closest `.relationship-item` ancestor has any class containing
//      `add` or matches `rel-add` / `relationship-add` — MB's React layer
//      flags newly-dispatched rels with these conventionally.
//   2. The row's `button.remove-item` id ends in a negative number —
//      MB's id counter for newly-dispatched rels runs negative
//      (`remove-relationship-artist-release--3`) while DB-persisted rels
//      have positive numeric ids (`…-1672558`).
// If neither signal fires inside a rel-item, it's existing.
function classifyRow(textNode) {
    const item = textNode.parentNode && textNode.parentNode.closest
        ? textNode.parentNode.closest('.relationship-item, [class*="relationship-item"]')
        : null;
    if (!item) return null; // not inside an MB rel row at all
    // Signal 1 — class-based marker.
    const cls = item.className || '';
    if (/(^|\s)(rel-add|relationship-add)(\s|$)/.test(cls) || /\badd(ed)?\b/i.test(cls)) {
        return 'new';
    }
    // Signal 2 — negative remove-item id.
    const rm = item.querySelector('button.remove-item[id^="remove-relationship-"]');
    if (rm) {
        const tail = rm.id.split('-').pop();
        // `'-3'` becomes `'3'` after pop because '-' is a separator; need
        // to look at the slice BEFORE the last segment to spot the sign.
        const segs = rm.id.split('-');
        const last = segs[segs.length - 1];
        const secondLast = segs[segs.length - 2];
        // Two shapes seen in MB: `remove-relationship-artist-release-1672558`
        // (positive: last segment is the number) vs `remove-relationship-…--3`
        // (negative: empty second-last segment between two consecutive
        // hyphens). Empty second-last + numeric last → negative id.
        if (secondLast === '' && /^\d+$/.test(last)) return 'new';
        if (/^-\d+$/.test(last)) return 'new';
    }
    return 'existing';
}

// Walks `document.body`'s text nodes, builds a Range for every
// case-insensitive substring match of `needle`, and stashes them under
// `discogs-hover-new` or `discogs-hover-existing` based on whether the
// containing relationship row was newly staged or already persisted.
// Text matches outside any rel row fall into the 'existing' bucket so
// labels, page chrome, etc. don't go unhighlighted.
function highlightPageText(needle) {
    if (!needle || !window.CSS?.highlights || typeof Highlight === 'undefined') return;
    const lower = needle.toLowerCase();
    // Single-char needles match everything — guard against accidentally
    // painting half the page when an entity name is one letter.
    if (lower.length < 2) return;
    const rangesExisting = [];
    const rangesNew = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
            const p = n.parentNode;
            if (!p) return NodeFilter.FILTER_REJECT;
            const tag = p.tagName;
            if (tag === 'STYLE' || tag === 'SCRIPT' || tag === 'NOSCRIPT' ||
                tag === 'TEXTAREA' || tag === 'INPUT') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });
    let node;
    while ((node = walker.nextNode())) {
        const txt = node.nodeValue;
        if (txt.length < lower.length) continue;
        const lowerTxt = txt.toLowerCase();
        const bucket = (classifyRow(node) === 'new') ? rangesNew : rangesExisting;
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
        window.CSS.highlights.set('discogs-hover-existing', new Highlight(...rangesExisting));
        window.CSS.highlights.set('discogs-hover-new',      new Highlight(...rangesNew));
    } catch (e) { /* HighlightConstructor missing or range error — silent */ }
}

function clearPageHighlight() {
    try {
        window.CSS.highlights?.delete('discogs-hover-existing');
        window.CSS.highlights?.delete('discogs-hover-new');
    } catch (e) {}
}
