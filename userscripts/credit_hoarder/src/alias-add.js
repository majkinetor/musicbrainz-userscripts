// #613 "+ alias": after a MANUAL pick, when the source credit is neither the picked
// artist's name nor one of its aliases, offer to add it as an alias — so the next import
// (anyone's) matches it at once. majkinetor: "Always show, left click foreground, right
// click background (no type should be set)".
//
// Both go through MusicBrainz's own add-alias form on the CURRENT MB origin (so beta /
// the test sandbox write to themselves): left click opens it pre-filled in a new tab
// for you to review and submit; right click submits the same form in the background —
// the way Falcon submits aliases (#535) — with the alias type left empty.
/* global DOMParser */
import { mbmHolds, MBM_SPECIAL_PURPOSE } from '../../../dev/match/artist-match.mjs';
import { log } from './log.js';

const SPECIAL = new Set(MBM_SPECIAL_PURPOSE);

/** Does `artist` (a search hit or candidate: aliases as strings or {name}) already carry `credit`? */
export function aliasHeldBy(artist, credit) {
    if (!artist || !credit) return true;
    const aliases = (artist.aliases || []).map(a => (typeof a === 'string' ? { name: a } : a)).filter(Boolean);
    return !!mbmHolds({ name: artist.name, aliases }, credit);
}
/** Offer "+ alias" for this pick? Artists only, never special-purpose ones. When the pick's
 *  aliases aren't known (a candidate list cached before #613), offer it whenever the credit
 *  differs from the name — the background submit re-checks the live aliases first. */
export function wantsAliasButton(entityType, artist, credit) {
    if (entityType !== 'artist' || !artist || !artist.id || SPECIAL.has(artist.id)) return false;
    if (!Array.isArray(artist.aliases)) return !aliasHeldBy({ name: artist.name, aliases: [] }, credit);
    return !aliasHeldBy(artist, credit);
}

const aliasFormUrl = mbid => `${location.origin}/artist/${mbid}/add-alias`;

/** Left click: MB's add-alias form, pre-filled, in a foreground tab. */
export function openAddAliasForm(mbid, name, note) {
    const q = new URLSearchParams({ 'edit-alias.name': name, 'edit-alias.sort_name': name });
    if (note) q.set('edit-alias.edit_note', note);
    const url = aliasFormUrl(mbid) + '?' + q.toString();
    log.info(`+ alias: opening MusicBrainz's add-alias form for "${name}" — ${url.split('?')[0]}`);
    window.open(url, '_blank');
}

/** Right click: submit the add-alias form in the background (no alias type).
 *  → { already: true } when the artist carries the name by now (nothing submitted — MB would
 *  happily store an exact duplicate, #535), else the landing URL. Throws on failure. */
export async function submitAliasBackground(mbid, name, note) {
    const url = aliasFormUrl(mbid);
    // the LIVE aliases, not the review table's (possibly cached) view — collaborative space
    const live = await fetch(`${location.origin}/ws/2/artist/${mbid}?inc=aliases&fmt=json`, { headers: { Accept: 'application/json' } }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (live && live.id && aliasHeldBy({ name: live.name, aliases: live.aliases || [] }, name)) {
        log.info(`+ alias: "${name}" is already a name/alias of ${live.name} — nothing submitted`);
        return { already: true };
    }
    const html = await fetch(url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error(`GET add-alias HTTP ${r.status}`); return r.text(); });
    const form = new DOMParser().parseFromString(html, 'text/html').querySelector('form.edit-alias');
    if (!form) throw new Error('MusicBrainz did not serve an alias form (still logged in?)');
    const p = new URLSearchParams();
    form.querySelectorAll('input, select, textarea').forEach(el => {   // the form's own defaults, so nothing MB expects goes missing
        if (!el.name) return;
        if (el.type === 'checkbox' || el.type === 'radio') { if (el.checked) p.set(el.name, el.value || '1'); return; }
        p.set(el.name, el.value || '');
    });
    p.set('edit-alias.name', name);
    p.set('edit-alias.sort_name', name);
    p.set('edit-alias.type_id', '');   // no type — majkinetor: "no type should be set"
    p.set('edit-alias.locale', '');
    p.delete('edit-alias.primary_for_locale');
    if (note) p.set('edit-alias.edit_note', note);
    log.info(`+ alias: submitting "${name}" as an alias of ${url.split('/artist/')[1].split('/')[0]} in the background (no type)`);
    const res = await fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: p.toString() });
    if (!res.ok) throw new Error(`add-alias submit HTTP ${res.status}`);
    // MB redirects to the artist's aliases on success and re-renders the form with errors on failure
    if (!/\/add-alias\b/.test(res.url)) return res.url;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const msg = [...doc.querySelectorAll('.error, .errors li, p.error')].map(n => (n.textContent || '').trim()).filter(Boolean)[0];
    throw new Error(msg || 'MusicBrainz rejected the alias without saying why');
}
