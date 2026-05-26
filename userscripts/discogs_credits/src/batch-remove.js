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

    const group = collectGroup(btn, mode);
    if (group.buttons.length === 0) return;

    openConfirm(group, mode, () => {
        // Confirmed → trigger native click on every peer remove-item.
        for (const b of group.buttons) b.click();
    });
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
    if (!seedItem || !seedRow) return { buttons: [] };

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

    const buttons = matched
        .map(it => it.querySelector('button.icon.remove-item'))
        .filter(Boolean);

    return {
        buttons,
        roleClass,
        roleLabel,
        targetHref,
        targetLabel,
        locations: collectLocations(matched),
    };
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
// release, a specific recording (track), or a work. Returns a flat list
// the modal renders, grouped by location with counts. The source type
// is decoded from MB's `remove-item` button id pattern:
//   id="remove-relationship-<targetType>-<sourceType>-<relId>"
// so we don't need to parse MB's React DOM further to know whether the
// rel is release-level or track-level.
function collectLocations(items) {
    const byLocation = new Map(); // label -> count
    for (const item of items) {
        const btn = item.querySelector('button.icon.remove-item[id^="remove-relationship-"]');
        const srcType = parseSourceTypeFromButton(btn);
        let label;
        if (srcType === 'release')   label = 'Release';
        else if (srcType === 'work') label = 'Work';
        else if (srcType === 'recording') {
            // Look up the track position from nearby DOM. MB usually
            // renders the position in a header cell on the same row or
            // in an ancestor track wrapper. Several selectors are tried;
            // first hit wins, otherwise we fall back to `Track ?`.
            const pos = findRecordingPosition(item);
            label = pos ? `Track ${pos}` : 'Track ?';
        }
        else label = srcType ? `${srcType[0].toUpperCase() + srcType.slice(1)}` : 'Other';
        byLocation.set(label, (byLocation.get(label) || 0) + 1);
    }
    return [...byLocation.entries()].map(([label, count]) => ({ label, count }));
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

function findRecordingPosition(item) {
    // 1) data-* attribute on any ancestor (cheapest signal if MB renders it).
    let el = item.closest(
        '[data-track-position], [data-position], [data-medium-track-position]'
    );
    if (el) {
        const pos = el.getAttribute('data-track-position')
                 || el.getAttribute('data-medium-track-position')
                 || el.getAttribute('data-position');
        if (pos) return String(pos).trim();
    }
    // 2) Walk up the table chain. For track-level rels, MB nests the
    //    rels under a track wrapper (typically `<table>` or `<div>`)
    //    that has a header row containing the position.
    let scope = item.closest('table, tbody, .relationship-list-wrapper');
    while (scope) {
        // Position is usually in the FIRST child <tr> or a header cell.
        const h = scope.querySelector?.(
            ':scope > thead .track-position, ' +
            ':scope > tbody > tr:first-child .track-position, ' +
            ':scope > tbody > tr:first-child .position, ' +
            ':scope > tr:first-child .track-position, ' +
            ':scope > tr:first-child .position'
        );
        if (h && h.textContent) return h.textContent.trim();
        // Sometimes MB shows the position as the first td in the first row.
        const firstRow = scope.querySelector?.(':scope > tbody > tr:first-child, :scope > tr:first-child');
        if (firstRow) {
            const td = firstRow.querySelector?.(':scope > td:first-child, :scope > th:first-child');
            const txt = td?.textContent?.trim();
            // Accept "1", "1.01", "A1", "1-A1", etc. as a position-looking string.
            if (txt && /^[A-Z]?\d+([\-.]\d+|[A-Z]?\d*)?$/.test(txt)) return txt;
        }
        scope = scope.parentElement?.closest('table, .relationship-list-wrapper, .track-relationships');
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
        .discogs-batch-modal .locations {
            margin: 0.4rem 0 0.9rem; padding: 0.5rem 0.7rem;
            background: #f6f6f6; border-radius: 4px;
            font-size: 0.85rem; line-height: 1.55;
            max-height: 12rem; overflow-y: auto;
        }
        .discogs-batch-modal .locations .loc {
            display: flex; justify-content: space-between; gap: 0.6rem;
        }
        .discogs-batch-modal .locations .loc-label { color: #333; }
        .discogs-batch-modal .locations .loc-count {
            font-variant-numeric: tabular-nums; color: #666;
        }
        .discogs-batch-modal .actions {
            display: flex; justify-content: flex-end; align-items: center;
            gap: 0.5rem; margin-top: 1rem;
        }
        .discogs-batch-modal button {
            padding: 0.4rem 1rem; border-radius: 4px;
            border: 1px solid #bbb; cursor: pointer; font-size: 0.9rem;
            line-height: 1.2; min-width: 5.5rem;
            font-family: inherit;
        }
        .discogs-batch-modal button.confirm {
            background: #c0392b; color: #fff; border-color: #962c20;
        }
        .discogs-batch-modal button.confirm:hover { background: #a83426; }
        .discogs-batch-modal button.cancel {
            background: #f5f5f5; color: #333;
        }
        .discogs-batch-modal button.cancel:hover { background: #eaeaea; }
    `;
    return style;
}

function openConfirm(group, mode, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'discogs-batch-overlay';

    const modal = document.createElement('div');
    modal.className = 'discogs-batch-modal';

    const title = document.createElement('h2');
    title.textContent = `Remove ${group.buttons.length} relationship${group.buttons.length === 1 ? '' : 's'}?`;
    modal.appendChild(title);

    const what = document.createElement('p');
    what.className = 'what';
    what.innerHTML = describeAction(group, mode);
    modal.appendChild(what);

    if (group.locations && group.locations.length) {
        const list = document.createElement('div');
        list.className = 'locations';
        for (const { label, count } of group.locations) {
            const row = document.createElement('div');
            row.className = 'loc';
            const l = document.createElement('span');
            l.className = 'loc-label';
            l.textContent = label;
            const c = document.createElement('span');
            c.className = 'loc-count';
            c.textContent = count === 1 ? '1 rel' : `${count} rels`;
            row.appendChild(l);
            row.appendChild(c);
            list.appendChild(row);
        }
        modal.appendChild(list);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    const cancel = document.createElement('button');
    cancel.className = 'cancel';
    cancel.textContent = 'Cancel';
    const confirm = document.createElement('button');
    confirm.className = 'confirm';
    confirm.textContent = 'Remove';
    actions.appendChild(cancel);
    actions.appendChild(confirm);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    function close() {
        overlay.remove();
        document.removeEventListener('keydown', onKey, true);
    }
    function onKey(ev) {
        if (ev.key === 'Escape') { close(); ev.preventDefault(); }
        if (ev.key === 'Enter')  { onConfirm(); close(); ev.preventDefault(); }
    }
    cancel.addEventListener('click', close);
    confirm.addEventListener('click', () => { onConfirm(); close(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    confirm.focus();
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
