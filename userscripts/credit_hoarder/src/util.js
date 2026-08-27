// Zero-dep helpers — DOM event constructors and a tiny promise scheduler.
// Pure: no module state, no MB/Discogs assumptions.

/**
 * #523: a multi-medium digital release repeats per-track numbers per
 * medium/volume (1..n, 1..n, …) on Tidal, Deezer, Qobuz and Apple alike —
 * MB's own position map keys multi-medium releases as "<medium>-<track>",
 * so a bare repeated number is ambiguous and, left unresolved, collapses
 * onto medium 1 wherever it's looked up (dispatch.js's `getRecordingEntity`
 * sweeps mediums 1..10 and returns the FIRST match). Detect the reset (a
 * number seen earlier in the list) and, when found, emit compound
 * "volume-track" positions instead so each credit lands on the right
 * medium.
 *
 * `items` MUST be in the source's own natural per-medium-sequential order
 * (all of medium 1, then all of medium 2, …) — sorting by number first
 * destroys the very signal this detects (ties would interleave mediums
 * instead of grouping them), so callers must not pre-sort by number.
 *
 * Returns one position string per item, `"<vol>-<num>"` when a reset was
 * detected, otherwise the bare `num` — plus whether a reset was detected
 * at all, so the caller can surface an advisory (this is a heuristic, not
 * a guarantee — same caveat Tidal's own version of this already carried).
 */
export function assignVolumePositions(items, getNum) {
    const nums = items.map(it => String(getNum(it) || '').trim());
    const multiVolume = nums.some((n, i) => n && nums.indexOf(n) < i);
    let vol = 1; const seenInVol = new Set();
    const positions = nums.map(num => {
        if (multiVolume && num && seenInVol.has(num)) { vol++; seenInVol.clear(); }
        if (num) seenInVol.add(num);
        return multiVolume ? `${vol}-${num}` : num;
    });
    return { positions, multiVolume };
}

/**
 * `setTimeout` wrapped in a Promise. The function `fn` runs after `ms`; its
 * return value (or thrown error) flows through the returned Promise.
 * If `fn` returns a thenable, the Promise waits for it to settle.
 */
export function doNext(fn, ms = 80) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                const response = fn();
                if (response && typeof response.then === 'function') {
                    response.then(resolve).catch(e => reject(e));
                } else {
                    resolve();
                }
            } catch (e) {
                reject(e);
            }
        }, ms);
    });
}

/**
 * Set the value of an input element AND notify React that it changed (React
 * tracks values internally via `_valueTracker`, so a plain `.value = …`
 * assignment doesn't update React's controlled-component state). Used by the
 * MB autocomplete inputs which are React-controlled.
 */
export function setNativeValue(element, value) {
    if (typeof element === 'string') {
        element = $(element).get(0);
    }
    let lastValue = element.value;
    element.value = value;
    let event = new Event('input', { target: element, bubbles: true });
    // React 15
    event.simulated = true;
    // React 16
    let tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
}

/** Same as setNativeValue but dispatches a `change` event instead of `input`. */
export function selectValue(element, value) {
    if (typeof element === 'string') {
        element = $(element).get(0);
    }
    let lastValue = element.value;
    element.value = value;
    let event = new Event('change', { target: element, bubbles: true });
    // React 15
    event.simulated = true;
    // React 16
    let tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
}

/** Synthetic Enter keydown — used to commit MB's autocomplete inputs. */
export function makeKeyDownEvent(keyCode) {
    return new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true, keyCode: 13,
    });
}

/**
 * Dispatch a synthetic trusted-looking click on `element`. Used where MB's
 * own click handler is wired in a way that ignores plain `.click()`.
 */
export function makeClickEvent(element) {
    const clickEvent = new PointerEvent('click', {
        pointerType: 'mouse',
        type: 'click',
        isTrusted: true,
        view: unsafeWindow,
        bubbles: true,    // bubble up the DOM tree
        cancelable: true, // can be cancelled by handlers
    });
    element.dispatchEvent(clickEvent);
}

/**
 * Keep password managers out of our own text inputs.
 *
 * majkinetor, with a screenshot of LastPass's icon sitting inside the
 * "Credited as" box: a bare `<input type="text">` next to a label is enough for
 * LastPass (and 1Password, Bitwarden, Dashlane) to decide it might be a
 * username field, so it injects its overlay icon and offers to fill it. That
 * covers the text and, worse, invites a stray autofill into a credit name.
 *
 * Group Therapy already does exactly this for every input it creates (#522);
 * same attribute set here, kept in one place so a new input cannot forget it.
 */
export function noPasswordManagers(el) {
    if (!el) return el;
    el.autocomplete = 'off';
    el.setAttribute('data-lpignore', 'true');      // LastPass
    el.setAttribute('data-1p-ignore', 'true');     // 1Password
    el.setAttribute('data-bwignore', 'true');      // Bitwarden
    el.setAttribute('data-form-type', 'other');    // Dashlane
    return el;
}

/** `document.createElement('input')` with the above already applied. */
export function textInput(type = 'text') {
    const el = document.createElement('input');
    el.type = type;
    return noPasswordManagers(el);
}
