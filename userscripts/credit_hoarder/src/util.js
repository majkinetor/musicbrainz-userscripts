// Zero-dep helpers — DOM event constructors and a tiny promise scheduler.
// Pure: no module state, no MB/Discogs assumptions.

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
