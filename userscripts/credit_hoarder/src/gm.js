/**
 * GM_xmlhttpRequest that the gate's log shows: a request to another site
 * (a credit source) is logged as external, from start to answer, error or timeout.
 */
import { mbnLog } from '../../../dev/net/mb-gate.mjs';

export function gmLogged(opts) {
    let fin = null;
    mbnLog(opts.url, { method: opts.method || 'GET', body: opts.data }, {
        send: () => new Promise((ok, no) => { fin = { ok, no }; }),
    }).catch(() => {});
    const end = (x, err) => {
        if (!fin) return;
        const g = fin; fin = null;
        if (err) g.no(err); else g.ok({ status: (x && x.status) || 0 });
    };
    const wrap = (name, err) => {
        const f = opts[name];
        return (...a) => { end(a[0], err && (() => { const e = new Error(err); if (err === 'aborted') e.name = 'AbortError'; return e; })()); if (f) return f(...a); };
    };
    return GM_xmlhttpRequest(Object.assign({}, opts, {
        onload: wrap('onload'),
        onerror: wrap('onerror', 'network error'),
        ontimeout: wrap('ontimeout', 'timeout'),
        onabort: wrap('onabort', 'aborted'),
    }));
}
