// Batch removal of relationships from MB's rel editor (issue #68).
//
// Modifier-click on a rel's `×` button removes a *group* of related rels
// in one shot, after a confirmation popup describing the blast radius:
//
//   Shift+Click       → same role across all tracks
//   Ctrl+Click        → same target entity across all tracks
//   Ctrl+Shift+Click  → same role AND same target
//
// MB renders each rel as:
//
//   <tr class="<role-kebab>">                       ← role marker
//     <th class="link-phrase"><label>role:</label> …</th>
//     <td class="relationship-list">
//       <div class="relationship-item">
//         <button class="icon remove-item" id="remove-relationship-…">×</button>
//         <a href="/<artist|work|label|place|recording>/<mbid>">name</a>
//         …
//       </div>
//     </td>
//   </tr>
//
// We don't fabricate removal ourselves — we collect peer `remove-item`
// buttons matching the criteria and trigger native `.click()` on each
// one after confirmation. MB's React handler then dispatches each
// removal exactly like a normal user click would.
//
// Cancellation paths: click outside the modal, press Escape, or click
// the Cancel button.

let _installed = false;

export function installBatchRemove() {
    if (_installed) return;
    _installed = true;
    if (!document.body) {
        document.addEventListener('DOMContentLoaded', () => {
            _installed = false;
            installBatchRemove();
        }, { once: true });
        return;
    }
    document.head.appendChild(buildStyle());
    document.body.addEventListener('click', onClick, true); // capture phase
}

// ── click intercept ──────────────────────────────────────────────────────────

function onClick(ev) {
    // Only intercept when a modifier is held — plain click stays MB's.
    if (!(ev.shiftKey || ev.ctrlKey || ev.metaKey)) return;
    const btn = ev.target.closest?.('button.icon.remove-item');
    if (!btn) return;

    const mode = modeFor(ev);
    if (!mode) return; // unsupported combo

    ev.preventDefault();
    ev.stopPropagation();

    // Rebuild the relId → position map at popup-open time. MB's state
    // is the authoritative position source; DOM scraping was fragile.
    _positionByRelIdCache = buildRelIdToPositionMap();

    const group = collectGroup(btn, mode);
    if (group.items.length === 0) return;

    openConfirm(group, mode);
}

function modeFor(ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.shiftKey) return 'role-and-target';
    if (ev.ctrlKey || ev.metaKey)                   return 'target';
    if (ev.shiftKey)                                return 'role';
    return null;
}

// ── group resolution ─────────────────────────────────────────────────────────

function collectGroup(seedBtn, mode) {
    const seedItem = seedBtn.closest('.relationship-item');
    const seedRow  = seedBtn.closest('tr');
    if (!seedItem || !seedRow) return { items: [], roleClass: null, roleLabel: '', targetHref: null, targetLabel: '' };

    const roleClass    = pickRoleClass(seedRow); // kebab-case role e.g. 'has-remixes'
    const targetHref   = pickTargetHref(seedItem); // e.g. '/artist/<mbid>'
    const targetLabel  = pickTargetLabel(seedItem);
    const roleLabel    = pickRoleLabel(seedRow);

    // Candidate rel-items: ALL .relationship-item on page, filtered by mode.
    const allItems = Array.from(document.querySelectorAll('.relationship-item'));
    const matched = allItems.filter(item => {
        if (mode === 'role') {
            return rowHasClass(item.closest('tr'), roleClass);
        }
        if (mode === 'target') {
            return hasTargetHref(item, targetHref);
        }
        // role-and-target
        return rowHasClass(item.closest('tr'), roleClass)
            && hasTargetHref(item, targetHref);
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
        targetLabel,
    };
}

// True iff this .relationship-item represents a rel that was added in
// the current session (not yet committed to MB). MB's React layer
// assigns negative ids to freshly-staged rels; persisted rels carry
// positive DB ids. The id is encoded in the `remove-item` button's
// `id` attribute we already parse for the position lookup.
function isSessionRel(item) {
    const btn = item.querySelector('button.icon.remove-item[id^="remove-relationship-"]');
    const relId = parseRelIdFromButton(btn);
    if (relId == null) return false;
    return Number(relId) < 0;
}

function buttonsFor(items) {
    return items.map(it => it.querySelector('button.icon.remove-item')).filter(Boolean);
}

function pickRoleClass(tr) {
    if (!tr) return null;
    // The role class is the kebab on <tr>, but MB also adds classes like
    // 'odd'/'even'/'highlighted'. Skip those; keep the first
    // non-presentational class. As a robust shortcut, MB role classes
    // never start with a digit and aren't in this stoplist.
    const stop = new Set(['odd', 'even', 'highlighted', 'selected', 'subrow', 'rel-add', 'rel-edit', 'rel-remove']);
    for (const c of tr.classList) {
        if (!stop.has(c) && /^[a-z][a-z0-9-]*$/.test(c)) return c;
    }
    return null;
}

function pickRoleLabel(tr) {
    if (!tr) return '';
    const lbl = tr.querySelector('th.link-phrase label');
    if (!lbl) return '';
    return (lbl.textContent || '').replace(/:\s*$/, '').trim();
}

function pickTargetHref(item) {
    if (!item) return null;
    // The TARGET entity link is one of /artist|work|label|place|recording|series|release-group/<mbid>.
    // MB rel-items can have multiple links (e.g. "X by Y" — both X and Y are
    // links). The 'target' for the rel is the LAST entity link in normal
    // MB rendering for 'has remixes' / 'arranger' style rels — but for
    // 'instrument' style rels on a recording, the target IS the recording.
    // Pragmatic shortcut: pick the first entity-type link that matches our
    // recognized set.
    const a = item.querySelector(
        'a[href^="/artist/"], a[href^="/work/"], a[href^="/label/"], ' +
        'a[href^="/place/"], a[href^="/recording/"], a[href^="/series/"], ' +
        'a[href^="/release-group/"], a[href^="/event/"], a[href^="/instrument/"], a[href^="/area/"]'
    );
    return a ? a.getAttribute('href') : null;
}

function pickTargetLabel(item) {
    if (!item) return '';
    const a = item.querySelector(
        'a[href^="/artist/"], a[href^="/work/"], a[href^="/label/"], ' +
        'a[href^="/place/"], a[href^="/recording/"], a[href^="/series/"], ' +
        'a[href^="/release-group/"], a[href^="/event/"], a[href^="/instrument/"], a[href^="/area/"]'
    );
    return a ? (a.textContent || '').trim() : '';
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
    // Minimal href-escape: only chars that break attribute selectors.
    return String(s).replace(/(["\\\\])/g, '\\$1');
}

// Classify each matched rel-item by where the rel is anchored: the
// release, a specific recording (track), or a work. The modal expects
// the breakdown shape maintainer specified on #68:
//   Total: N
//   - X rel from release
//   - Y rel from tracks: 5, 8
//   - Z rel from works: 5, 8
// so we bucket counts per source-type (release / recording / work /
// other) AND collect the unique track positions touched by each
// bucket. Source type comes from MB's `remove-item` button id pattern
//   id="remove-relationship-<targetType>-<sourceType>-<relId>"
// Track positions come from DOM walking (best-effort -- positions of
// the enclosing track wrapper apply to both `recording`-source and
// `work`-source rels since works live inside tracks in MB's editor).
function collectLocations(items) {
    const buckets = {
        release:   { count: 0, positions: new Set() },
        recording: { count: 0, positions: new Set() },
        work:      { count: 0, positions: new Set() },
        other:     { count: 0, positions: new Set() },
    };
    for (const item of items) {
        const btn = item.querySelector('button.icon.remove-item[id^="remove-relationship-"]');
        const srcType = parseSourceTypeFromButton(btn);
        const key = (srcType === 'release' || srcType === 'recording' || srcType === 'work') ? srcType : 'other';
        buckets[key].count++;
        // Track position is only meaningful for recording/work rels.
        if (key === 'recording' || key === 'work') {
            const pos = findRecordingPosition(item);
            if (pos) buckets[key].positions.add(pos);
        }
    }
    // Stable order: release, tracks (recording), works, other. Always
    // include release/recording/work rows even when their count is 0 so
    // the maintainer's "Total: 4  • 0 rel from release  • 1 rel from
    // tracks: 5, 8 …" shape lines up. Drop `other` entirely when zero.
    const order = [
        ['release',   'release'],
        ['recording', 'tracks'],
        ['work',      'works'],
    ];
    const out = [];
    for (const [key, label] of order) {
        const b = buckets[key];
        const positions = sortPositions([...b.positions]);
        out.push({ key, label, count: b.count, positions });
    }
    if (buckets.other.count > 0) {
        out.push({ key: 'other', label: 'other', count: buckets.other.count, positions: [] });
    }
    return out;
}

function sortPositions(arr) {
    // Numeric-aware: "5" < "8" < "10" < "A1". parseFloat handles "5",
    // "1.01", "1-5"; falls back to lexicographic for non-numeric.
    return arr.sort((a, b) => {
        const na = parseFloat(a), nb = parseFloat(b);
        if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
        return String(a).localeCompare(String(b));
    });
}

function parseSourceTypeFromButton(btn) {
    if (!btn || !btn.id) return null;
    // id="remove-relationship-<targetType>-<sourceType>-<relId>"
    // <relId> may be a negative number (-3) for newly-staged rels; the
    // hyphen there doesn't break the split because we slice the last
    // two segments off the end.
    const segs = btn.id.split('-');
    // Find the last all-numeric (or "-N" negative) segment from the end.
    // Source type is the segment just before it.
    let i = segs.length - 1;
    while (i >= 0 && (segs[i] === '' || /^-?\d+$/.test(segs[i]))) i--;
    return segs[i] || null;
}

// Build a relId → position lookup ONCE per popup-open by walking MB's
// own state. Far more reliable than DOM scraping — MB knows exactly
// which recording each rel belongs to, and where that recording sits
// in the medium/track tree.
// Returns a Map(string relId → string position e.g. "1.05" or "A1").
// Empty map if MB state isn't accessible.
let _positionByRelIdCache = null; // recomputed each popup-open
function buildRelIdToPositionMap() {
    const map = new Map();
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const MB = win.MB;
    const re = MB?.relationshipEditor;
    if (!MB || !re?.state) return map;

    // Step 1: build sourceGid → "M.T" position string.
    const positionByRecGid = new Map();
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
                // Prefer the displayable track-position MB ships if any;
                // fall back to numeric "M.T".
                let pos = trackObj?.number || trackObj?.position;
                if (pos == null) pos = `${mediumIndex}.${String(trackIndex).padStart(2, '0')}`;
                // Multi-medium prefix only when there's more than one medium.
                positionByRecGid.set(rec.gid, String(pos));
            }
        }
    } catch (e) { /* state shape varies — best effort */ }

    // Step 2: walk all relationships in state, build relId → position.
    // Source can be a recording (use position), a work (look up the
    // work's parent recording via relatedWorks reverse-map), or release
    // (no track position).
    try {
        const root = re.state.relationshipsBySource;
        if (!root) return map;
        // relationshipsBySource[sourceGid][targetType] = nested objects
        // ending in { relationships: [rels...] }. Walk recursively.
        function walk(node, sourceGid) {
            if (!node) return;
            if (Array.isArray(node)) {
                for (const r of node) {
                    if (r?.id != null) {
                        // Some rels store the source as `entity0` / `entity1`
                        // depending on orientation; the sourceGid passed in
                        // is the indexed key, that's the authoritative one.
                        const pos = positionByRecGid.get(sourceGid);
                        if (pos) map.set(String(r.id), pos);
                    }
                }
                return;
            }
            if (typeof node === 'object') {
                for (const v of Object.values(node)) walk(v, sourceGid);
            }
        }
        for (const [gid, perSource] of Object.entries(root)) {
            walk(perSource, gid);
        }
    } catch (e) { /* fall through — empty map is fine */ }
    return map;
}

function parseRelIdFromButton(btn) {
    if (!btn || !btn.id) return null;
    // id="remove-relationship-<targetType>-<sourceType>-<relId>"
    // <relId> is a (possibly-negative) integer. Match it at the very
    // end with a single regex -- string-splitting on '-' loses the
    // negative sign (negative ids produce a `--N` tail which splits to
    // ['', 'N'] and the earlier loop returned 'N' instead of '-N').
    const m = btn.id.match(/-(-?\d+)$/);
    return m ? m[1] : null;
}

function findRecordingPosition(item) {
    // 1) Authoritative path: relId from button → MB state lookup.
    const btn = item.querySelector('button.icon.remove-item[id^="remove-relationship-"]');
    const relId = parseRelIdFromButton(btn);
    if (relId && _positionByRelIdCache && _positionByRelIdCache.has(relId)) {
        return _positionByRelIdCache.get(relId);
    }
    // 2) Fallback A: data-* attribute on any ancestor.
    let el = item.closest(
        '[data-track-position], [data-position], [data-medium-track-position], [data-track-number]'
    );
    if (el) {
        const pos = el.getAttribute('data-track-position')
                 || el.getAttribute('data-medium-track-position')
                 || el.getAttribute('data-position')
                 || el.getAttribute('data-track-number');
        if (pos) return String(pos).trim();
    }
    // 3) Fallback B: walk up looking for a textual position label.
    let scope = item.closest('table, tbody, .relationship-list-wrapper, .track-relationships, .track-rel');
    while (scope) {
        const candidates = scope.querySelectorAll?.(
            '.track-position, .position, .track-number, .medium-track-pos'
        );
        for (const c of (candidates || [])) {
            const txt = c.textContent?.trim();
            if (txt && /^[A-Z]?\d+([\-.]\d+|[A-Z]?\d*)?$/.test(txt)) return txt;
        }
        scope = scope.parentElement?.closest('table, .relationship-list-wrapper, .track-relationships, .track-rel');
    }
    return null;
}

// ── modal UI ─────────────────────────────────────────────────────────────────

function buildStyle() {
    const style = document.createElement('style');
    style.id = 'discogs-batch-remove-style';
    // Selectors are namespaced under `.discogs-batch-modal` and use
    // `box-sizing: border-box` + explicit `line-height` on the buttons
    // to keep them visually aligned regardless of MB's global page CSS
    // (which sometimes injects extra vertical padding on bare buttons).
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
    // Pre-split items by "this session" vs "pre-existing" so the toggle
    // can flip between them without re-scanning the DOM. See
    // `isSessionRel` for the criterion (negative MB-state rel id).
    const sessionItems = group.items.filter(isSessionRel);
    const allItems     = group.items;
    // Default OFF: keep the prior behaviour of "remove everything in
    // the group" so this is purely additive. Toggle is offered only
    // when there's actually a mix or session-only subset; if every
    // matched rel is session-only the toggle is hidden (it would do
    // nothing).
    let onlySession = false;

    const overlay = document.createElement('div');
    overlay.className = 'discogs-batch-overlay';

    const modal = document.createElement('div');
    modal.className = 'discogs-batch-modal';

    const title = document.createElement('h2');
    modal.appendChild(title);

    const what = document.createElement('p');
    what.className = 'what';
    what.innerHTML = describeAction(group, mode);
    modal.appendChild(what);

    // Optional toggle: only remove rels added in this session (#68 follow-up).
    // Hidden when there are no session-staged rels or no pre-existing
    // ones in the group — either way the toggle has nothing to switch.
    let toggleCb = null;
    if (sessionItems.length > 0 && sessionItems.length < allItems.length) {
        const toggleWrap = document.createElement('label');
        toggleWrap.className = 'session-toggle';
        toggleWrap.style.cssText = 'display:flex;align-items:center;gap:0.4rem;margin:0.3rem 0 0.7rem;font-size:0.9rem;cursor:pointer;user-select:none;';
        toggleCb = document.createElement('input');
        toggleCb.type = 'checkbox';
        toggleCb.checked = false;
        toggleWrap.appendChild(toggleCb);
        toggleWrap.appendChild(document.createTextNode('Only remove relationships added in this session'));
        modal.appendChild(toggleWrap);
    }

    // Total + breakdown live in their own container so we can re-render
    // them in place when the toggle flips.
    const total = document.createElement('div');
    total.className = 'total';
    modal.appendChild(total);

    const list = document.createElement('ul');
    list.className = 'locations';
    modal.appendChild(list);

    function activeItems() {
        return onlySession ? sessionItems : allItems;
    }

    function render() {
        const items = activeItems();
        const buttons = buttonsFor(items);
        const locs = collectLocations(items);
        title.textContent = `Remove ${buttons.length} relationship${buttons.length === 1 ? '' : 's'}?`;
        total.textContent = `Total: ${buttons.length}`;
        list.innerHTML = '';
        for (const { label, count, positions } of locs) {
            const li = document.createElement('li');
            li.className = 'loc';
            const noun = count === 1 ? 'rel' : 'rels';
            const tail = (positions && positions.length) ? `: ${positions.join(', ')}` : '';
            li.textContent = `${count} ${noun} from ${label}${tail}`;
            list.appendChild(li);
        }
        // Confirm button is disabled when there's nothing to remove,
        // e.g. session-only toggle on but every matched rel is
        // pre-existing (can happen if the user re-clicks after some
        // rels were removed earlier in the same modal).
        if (confirmBtn) {
            confirmBtn.disabled = (buttons.length === 0);
            confirmBtn.style.setProperty('opacity', buttons.length === 0 ? '0.5' : '1', 'important');
            confirmBtn.style.setProperty('cursor', buttons.length === 0 ? 'default' : 'pointer', 'important');
        }
    }
    if (toggleCb) {
        toggleCb.addEventListener('change', () => {
            onlySession = toggleCb.checked;
            render();
        });
    }

    let confirmBtn; // forward-decl for render()
    // First render happens after confirm is built (below); see end of
    // function for the initial render() call.

    // Build actions row + buttons with inline `!important` styles so
    // MB's global page CSS can't unstack them or change dimensions.
    // External stylesheets — including the one I shipped — keep losing
    // to MB's selectors in the user's environment; inline + important
    // wins specificity unconditionally.
    const actions = document.createElement('div');
    actions.className = 'actions';
    const actionsCss = {
        'display': 'flex',
        'flex-direction': 'row',
        'justify-content': 'flex-end',
        'align-items': 'center',
        'gap': '0.5rem',
        'margin-top': '1rem',
        'padding': '0',
        'width': '100%',
    };
    for (const [k, v] of Object.entries(actionsCss)) actions.style.setProperty(k, v, 'important');

    function styleBtn(b, isConfirm) {
        const css = {
            'flex': '0 0 auto',
            'display': 'inline-block',
            'box-sizing': 'border-box',
            'margin': '0',
            'padding': '0.45rem 1.1rem',
            'min-width': '6rem',
            'height': '2.2rem',
            'line-height': '1',
            'border-radius': '4px',
            'border': isConfirm ? '1px solid #962c20' : '1px solid #bbb',
            'background': isConfirm ? '#c0392b' : '#f5f5f5',
            'color': isConfirm ? '#fff' : '#333',
            'cursor': 'pointer',
            'font-size': '0.9rem',
            'font-family': 'inherit',
            'font-weight': '500',
            'text-align': 'center',
            'vertical-align': 'middle',
            'white-space': 'nowrap',
        };
        for (const [k, v] of Object.entries(css)) b.style.setProperty(k, v, 'important');
    }

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'cancel';
    cancel.textContent = 'Cancel';
    styleBtn(cancel, false);
    confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'confirm';
    confirmBtn.textContent = 'Remove';
    styleBtn(confirmBtn, true);
    actions.appendChild(cancel);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);

    // Final render now that confirmBtn exists so the disabled-state
    // update can reach it.
    render();
    overlay.appendChild(modal);

    function close() {
        overlay.remove();
        document.removeEventListener('keydown', onKey, true);
    }
    function doRemove() {
        const buttons = buttonsFor(activeItems());
        if (buttons.length === 0) return;
        for (const b of buttons) b.click();
    }
    function onKey(ev) {
        if (ev.key === 'Escape') { close(); ev.preventDefault(); }
        if (ev.key === 'Enter')  { doRemove(); close(); ev.preventDefault(); }
    }
    cancel.addEventListener('click', close);
    confirmBtn.addEventListener('click', () => { doRemove(); close(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    confirmBtn.focus();
}

function describeAction(group, mode) {
    const role = group.roleLabel ? `<b>${escapeHtml(group.roleLabel)}</b>` : '<i>(unknown role)</i>';
    const target = group.targetLabel ? `<b>${escapeHtml(group.targetLabel)}</b>` : '<i>(unknown entity)</i>';
    if (mode === 'role')             return `Remove role ${role} from every relationship on this release.`;
    if (mode === 'target')           return `Remove entity ${target} from every relationship on this release, regardless of role.`;
    if (mode === 'role-and-target')  return `Remove entity ${target} on role ${role}.`;
    return 'Remove these relationships.';
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
        c === '&' ? '&amp;' :
        c === '<' ? '&lt;'  :
        c === '>' ? '&gt;'  :
        c === '"' ? '&quot;': '&#39;'
    ));
}
