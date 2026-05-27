// Top-of-viewport progress bar shown while a long-running task
// (preflight, dispatch) is in flight. Two modes:
//
//   • indeterminate — the marquee animation, used when the script
//                     doesn't yet know how much work is ahead.
//   • determinate   — fill stripe pinned to the left, width = pct%.
//                     Used when the caller knows done/total counts.
//
// `_showBar()` starts in indeterminate. `_setProgressPct(pct)` switches
// to determinate at the current pct. `_hideBar()` clears whichever mode
// is active.
//
// Issue #82: callers (preflight, dispatch) used to ignore the bar and
// only write done/total text. Now they push real percentages here.

let _pInterval = null;
let _pPos = -40;

export function _showBar() {
    const row1 = document.querySelector('.discogs-bar-row1');
    const row2 = document.querySelector('.discogs-bar-row2');
    const r1h = row1 ? row1.getBoundingClientRect().height : 42;
    let pb = document.getElementById('discogs-pb');
    if (!pb) {
        pb = document.createElement('div');
        pb.id = 'discogs-pb';
        pb.style.cssText = 'position:fixed;left:0;right:0;height:5px;z-index:99999;background:#ddd;overflow:hidden;';
        const fill = document.createElement('div');
        fill.id = 'discogs-pb-fill';
        fill.style.cssText = 'position:absolute;top:0;height:100%;width:40%;background:#e8771d;transition:width 0.2s linear;';
        pb.appendChild(fill);
        document.body.appendChild(pb);
    }
    pb.style.top = r1h + 'px';
    pb.style.display = 'block';
    if (row2) row2.style.marginTop = (r1h + 5) + 'px';
    // Reset to indeterminate marquee. Caller can flip to determinate
    // via `_setProgressPct` once a real percent is known.
    _startMarquee();
}

function _startMarquee() {
    clearInterval(_pInterval);
    const fill = document.getElementById('discogs-pb-fill');
    if (fill) {
        fill.style.width = '40%';
        fill.style.left  = _pPos + '%';
        // Marquee slides hard, transition would lag the animation.
        fill.style.transition = '';
    }
    _pPos = -40;
    _pInterval = setInterval(() => {
        _pPos += 1.5;
        if (_pPos > 100) _pPos = -40;
        const f = document.getElementById('discogs-pb-fill');
        if (f) f.style.left = _pPos + '%';
    }, 16);
}

// Switch the bar to determinate mode at `pct` ∈ [0, 100]. Called by
// preflight + dispatch as they progress. Side-effects: clears the
// marquee timer, pins the fill stripe to the left, sets its width.
// Restores `transition` so consecutive percentages animate smoothly
// instead of jumping.
export function _setProgressPct(pct) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    clearInterval(_pInterval);
    _pInterval = null;
    const fill = document.getElementById('discogs-pb-fill');
    if (!fill) return;
    fill.style.left = '0';
    fill.style.transition = 'width 0.2s linear';
    fill.style.width = p + '%';
}

export function _hideBar() {
    clearInterval(_pInterval);
    _pInterval = null;
    const pb = document.getElementById('discogs-pb');
    if (pb) pb.style.display = 'none';
    const row2 = document.querySelector('.discogs-bar-row2');
    if (row2) row2.style.marginTop = '';
}
