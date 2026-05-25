// Top-of-viewport "marquee" progress bar shown while a long-running task
// (preflight, dispatch) is in flight. Module-level state because both the
// UI bar (insertDiscogsBar) and the review table reach for `_showBar` /
// `_hideBar` at different points.
//
// Single shared `<div id="discogs-pb">` element appended to `<body>` on
// first `_showBar()`. The fill stripe (`#discogs-pb-fill`) is animated
// across via a setInterval timer; `_hideBar` clears it and hides the bar.

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
        fill.style.cssText = 'position:absolute;top:0;height:100%;width:40%;background:#e8771d;';
        pb.appendChild(fill);
        document.body.appendChild(pb);
    }
    pb.style.top = r1h + 'px';
    pb.style.display = 'block';
    if (row2) row2.style.marginTop = (r1h + 5) + 'px';
    clearInterval(_pInterval);
    _pPos = -40;
    _pInterval = setInterval(() => {
        _pPos += 1.5;
        if (_pPos > 100) _pPos = -40;
        const fill = document.getElementById('discogs-pb-fill');
        if (fill) fill.style.left = _pPos + '%';
    }, 16);
}

export function _hideBar() {
    clearInterval(_pInterval);
    const pb = document.getElementById('discogs-pb');
    if (pb) pb.style.display = 'none';
    const row2 = document.querySelector('.discogs-bar-row2');
    if (row2) row2.style.marginTop = '';
}
