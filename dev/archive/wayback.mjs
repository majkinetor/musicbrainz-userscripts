// Saving pages on the Internet Archive's Wayback Machine — ONE source for First Contact and
// Apollo Editor (#659, #736). Inlined between `// <ST-ARCHIVE>` markers by
// dev/archive/sync-archive.mjs. Edit HERE, never in a generated block.
//
// The archive.org keys are one GM value, `mbu.archive` = { iaKey, iaSecret }, read and written
// by every script that carries this block: standalone each script has its own copy; in String
// Theory the members share one GM store, so keys set in one script show in the others. GM
// storage belongs to the script, not the site, so First Contact's panel on a platform's page and
// Apollo on MusicBrainz see the same value. Whether a script archives at all is its own setting.
//
// Every function is self-contained (it may call the others and the manager's GM_* functions,
// nothing else), so it can be inlined from its own source text. `log` is the script's logger
// ({ info, ok, warn, debug }).

export const MBA_KEY = 'mbu.archive';

/** A Wayback timestamp (`YYYYMMDDhhmmss`, UTC). A date-only one is read as the END of that day,
 *  so it can land on a later snapshot: links carry all 14 digits. */
function mbaTs(d) { return (d || new Date()).toISOString().replace(/[^0-9]/g, '').slice(0, 14); }

/** The URL without its scheme and `www.`, which Wayback doesn't need (it files `www.` and the
 *  bare host together), for the short links in an edit note. */
function mbaShort(url) { return String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, ''); }

/** The link to the snapshot of `url` nearest to `ts`. */
function mbaSnapshot(ts, url) { return 'https://web.archive.org/web/' + ts + '/' + mbaShort(url); }

/** A page as the user has it, without the fragment and share/tracking parameters. The query is
 *  cut as text: open.spotify.com replaces URLSearchParams with its own, whose keys() can't be
 *  iterated ("u.searchParams.keys() is not iterable" stopped First Contact's import there). */
function mbaCleanUrl(href) {
    const [base, query = ''] = String(href).split('#')[0].split(/\?(.*)/s);
    const kept = query.split('&').filter(p => p && !/^(si|utm_\w+|fbclid|gclid|ref|from|context|nd|feature|redirected)$/i.test(decodeURIComponent(p.split('=')[0].replace(/\+/g, ' '))));
    return base + (kept.length ? '?' + kept.join('&') : '');
}

/** The address to save for a link: the link itself, or, for a site that refuses archive.org
 *  (HTTP 403 to Save Page Now), the same data where archive.org can read it. Discogs refuses its
 *  pages but not its API: /release/<id>, /master/<id>, /artist/<id>, /label/<id> → api.discogs.com. */
function mbaSavable(url) {
    const d = String(url).match(/^https?:\/\/(?:www\.)?discogs\.com\/(?:[a-z]{2}\/)?(release|master|artist|label)\/(\d+)(?:[-/?#]|$)/i);
    return d ? `https://api.discogs.com/${d[1].toLowerCase()}s/${d[2]}` : url;
}

/** The archive.org keys, or null when either is missing (saves are then anonymous). */
function mbaKeys() {
    let v = null;
    try { v = GM_getValue(MBA_KEY, null); } catch (e) { /* no storage: anonymous */ }
    return v && v.iaKey && v.iaSecret ? { key: v.iaKey, secret: v.iaSecret } : null;
}
/** The keys as stored, for the settings fields: { iaKey, iaSecret }. */
function mbaKeysStored() {
    let v = null;
    try { v = GM_getValue(MBA_KEY, null); } catch (e) { /* no storage */ }
    return { iaKey: (v && v.iaKey) || '', iaSecret: (v && v.iaSecret) || '' };
}
function mbaSetKeys(iaKey, iaSecret) {
    const prev = (() => { try { return GM_getValue(MBA_KEY, null) || {}; } catch (e) { return {}; } })();
    GM_setValue(MBA_KEY, Object.assign({}, prev, { iaKey: String(iaKey || '').trim(), iaSecret: String(iaSecret || '').trim() }));
}

/** Anonymous Save Page Now: a GET that answers (in seconds to a minute) with a redirect to the snapshot. */
function mbaSaveAnon(url, log) {
    const t0 = Date.now(), wait = 180000;
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method: 'GET', url: 'https://web.archive.org/save/' + url, timeout: wait, anonymous: true,
            headers: { Accept: 'text/html' },
            onload: r => {
                const snap = /\/web\/\d{14}\//.test(r.finalUrl || '') ? r.finalUrl : null;
                const ms = Date.now() - t0;
                if (r.status >= 200 && r.status < 300 && snap) log.ok(`archive: saved ${url} → ${snap} (${ms} ms)`);
                else if (r.status === 429) log.warn(`archive: ${url} not saved: Save Page Now is limiting anonymous saves (HTTP 429). archive.org keys in the settings raise the limit`);
                else log.warn(`archive: ${url} → HTTP ${r.status}${snap ? '' : ', no snapshot in the answer'} (${ms} ms)${r.finalUrl ? ', ended at ' + r.finalUrl : ''}`);
                resolve();
            },
            onerror: () => { log.warn(`archive: network error saving ${url}`); resolve(); },
            ontimeout: () => { log.warn(`archive: no answer for ${url} in ${wait / 60000} minutes (the save may still finish)`); resolve(); },
        });
    });
}

function mbaRequest(method, url, auth, body) {
    return new Promise(resolve => {
        GM_xmlhttpRequest({
            method, url, data: body, timeout: 30000, anonymous: true,
            headers: Object.assign({ Accept: 'application/json', Authorization: 'LOW ' + auth }, body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
            onload: r => { let j = null; try { j = JSON.parse(r.responseText || 'null'); } catch (e) { /* not JSON */ } resolve({ status: r.status, json: j, text: r.responseText || '' }); },
            onerror: () => resolve({ status: 0, json: null, text: 'network error' }),
            ontimeout: () => resolve({ status: 0, json: null, text: 'timeout' }),
        });
    });
}

/** Save Page Now 2 with the user's keys: higher limits, a screenshot, and a snapshot from the last
 *  30 days is reused. Starts a job; with `follow`, polls it for the log (nothing waits for it). */
async function mbaSaveWithKeys(url, keys, log, follow) {
    const auth = keys.key + ':' + keys.secret, wait = 180000;
    const body = new URLSearchParams({ url, if_not_archived_within: '30d', capture_screenshot: '1' }).toString();
    const r = await mbaRequest('POST', 'https://web.archive.org/save', auth, body);
    log.debug(`archive: POST /save ${url} → HTTP ${r.status} ${r.text.slice(0, 300)}`);
    if (r.status === 401 || r.status === 403) { log.warn(`archive: archive.org refused your keys (HTTP ${r.status}); check them in the settings`); return; }
    const job = r.json && r.json.job_id;
    if (!job) {
        const msg = (r.json && (r.json.message || r.json.status_ext)) || r.text.slice(0, 200) || 'no answer';
        if (r.status === 200 && /archived|already/i.test(msg)) log.ok(`archive: ${url} has a recent snapshot, not saved again (${msg})`);
        else log.warn(`archive: ${url} not saved (HTTP ${r.status}: ${msg})`);
        return;
    }
    log.info(`archive: ${url} queued as job ${job}`);
    if (!follow) return;
    const t0 = Date.now();
    while (Date.now() - t0 < wait) {
        await new Promise(res => setTimeout(res, 6000));
        const st = await mbaRequest('GET', 'https://web.archive.org/save/status/' + encodeURIComponent(job), auth);
        const j = st.json || {};
        log.debug(`archive: job ${job} → HTTP ${st.status}, ${j.status || '?'}`);
        if (j.status === 'pending') continue;
        if (j.status === 'success') log.ok(`archive: saved ${url} → https://web.archive.org/web/${j.timestamp}/${j.original_url || url}${j.screenshot ? ', screenshot ' + j.screenshot : ''} (${Date.now() - t0} ms)`);
        else log.warn(`archive: job ${job} for ${url} ended ${j.status || 'HTTP ' + st.status}: ${j.message || j.status_ext || st.text.slice(0, 200)}`);
        return;
    }
    log.info(`archive: job ${job} for ${url} still running after ${wait / 60000} minutes; archive.org finishes it on its side`);
}

/** Save one URL, with the keys when they're set. Never throws. */
async function mbaSave(url, log, follow) {
    const keys = mbaKeys();
    try { await (keys ? mbaSaveWithKeys(url, keys, log, follow) : mbaSaveAnon(url, log)); } catch (e) { log.warn(`archive: ${url}: ${e && e.message || e}`); }
}

/** The archive.org keys part of a settings panel: a heading with where to get them, and the two
 *  fields. `off` dims it (archiving is off in this script). Wire it with mbaKeysWire. */
function mbaKeysHtml(off) {
    const k = mbaKeysStored(), q = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    // no password-manager icon in the fields: they opt out by attribute (LastPass, 1Password,
    // Bitwarden, Dashlane), and the secret is a text field masked in CSS, since type=password draws every manager in
    const opt = 'autocomplete="off" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other" spellcheck="false"';
    return `<div class="mbu-ia${off ? ' mbu-ia-off' : ''}" title="Optional, and shared by First Contact and Apollo Editor. With your archive.org keys the save uses Save Page Now 2: higher limits, and a screenshot of the page, which is the evidence for platforms that build their pages in the browser (Spotify, Tidal, YouTube Music). Without keys the save is anonymous.">`
        + `<div class="mbu-ia-h">archive.org keys <span class="mbu-ia-st">${mbaKeysState(k.iaKey, k.iaSecret)}</span> <a href="https://archive.org/account/s3.php" target="_blank" rel="noopener">get them</a></div>`
        + `<input type="text" class="mbu-ia-key" placeholder="access key" ${opt} value="${q(k.iaKey)}">`
        + `<input type="text" class="mbu-ia-secret" placeholder="secret" ${opt} value="${q(k.iaSecret)}"></div>`;
}
/** What the heading says about the keys: the secret is masked, so this is how to tell it's there. */
function mbaKeysState(k, s) {
    k = String(k || '').trim(); s = String(s || '').trim();
    return k && s ? '✓ set' : k ? 'secret missing' : s ? 'access key missing' : 'not set';
}
/** Save the keys from the fields mbaKeysHtml made, inside `root`, as they're typed or pasted:
 *  `change` alone missed a paste when the panel was closed with the field still focused. */
function mbaKeysWire(root, log) {
    const key = root.querySelector('.mbu-ia-key'), secret = root.querySelector('.mbu-ia-secret'), st = root.querySelector('.mbu-ia-st');
    if (!key || !secret) return;
    const save = () => {
        mbaSetKeys(key.value, secret.value);
        if (st) { st.textContent = mbaKeysState(key.value, secret.value); st.classList.toggle('mbu-ia-ok', !!(key.value.trim() && secret.value.trim())); }
    };
    const logged = () => log.info(`archive.org keys: ${mbaKeysState(key.value, secret.value)}`);
    for (const f of [key, secret]) { f.addEventListener('input', save); f.addEventListener('change', logged); }
    if (st) st.classList.toggle('mbu-ia-ok', !!(key.value.trim() && secret.value.trim()));
}
/** The fields' look, under `scope` (the panel's selector). Starts from `all: revert`: on a
 *  platform's page the site's own input styles would win. */
function mbaKeysCss(scope) {
    const s = scope + ' .mbu-ia';
    return `${s} { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 6px; }
${s}.mbu-ia-off { opacity: .5; }
${s} .mbu-ia-secret { -webkit-text-security: disc; }
${s} .mbu-ia-h { grid-column: 1 / -1; color: var(--mbu-text-weak); }
${s} .mbu-ia-h a { color: var(--mbu-accent-text); margin-left: 4px; }
${s} .mbu-ia-st { margin-left: 4px; }
${s} .mbu-ia-st.mbu-ia-ok { color: var(--mbu-ok); }
${s} input { all: revert; box-sizing: border-box; width: 100%; min-width: 0; font: 12px var(--mbu-font-mono, monospace);
  padding: 3px 6px; border: 1px solid var(--mbu-border); border-radius: 4px; background: var(--mbu-bg-sunken); color: var(--mbu-text); }
${s} input::placeholder { color: var(--mbu-text-weak); opacity: 1; font-style: normal; }
`;
}

// What the sync inlines, in order. Node specs import the functions from here.
export const MBA_INLINE = {
    consts: { MBA_KEY },
    fns: [mbaTs, mbaShort, mbaSnapshot, mbaCleanUrl, mbaSavable, mbaKeys, mbaKeysStored, mbaSetKeys, mbaSaveAnon, mbaRequest, mbaSaveWithKeys, mbaSave, mbaKeysState, mbaKeysHtml, mbaKeysWire, mbaKeysCss],
};
export { mbaTs, mbaShort, mbaSnapshot, mbaCleanUrl, mbaSavable };
