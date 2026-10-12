// Reading MusicBrainz's own pages in any interface language — ONE source for the scripts
// that need it (#722, #723). Inlined between `// <ST-MBPAGE>` markers by
// dev/mbpage/sync-mbpage.mjs; Credit Hoarder's build imports this module directly.
// Edit HERE, never in a generated block.
//
// The rule (DEVELOP → Conventions → Finding things on MusicBrainz's pages): MB translates
// every label and heading, and its layout changes without notice, so an element is found
// by an id, class, form name, data-bind/data-click or link address, and a name MB shows
// translated is mapped through its stable id. Every function here is self-contained (it
// may call the others, nothing else), so it can be inlined from its own source text.

/** Cover-art types by MB's id (its cover_art_type table), English names as the Cover Art
 *  Archive uses them. A form's checkbox value is the id, whatever language its label is in. */
export const MBP_COVER_TYPES = {
    1: 'Front', 2: 'Back', 3: 'Booklet', 4: 'Medium', 5: 'Obi', 6: 'Spine', 7: 'Track', 8: 'Other',
    9: 'Tray', 10: 'Sticker', 11: 'Poster', 12: 'Liner', 13: 'Watermark', 14: 'Raw/Unedited',
    15: 'Matrix/Runout', 48: 'Top', 49: 'Bottom',
};

/** The id of an English cover-art type name ("front" → "1"), or null. */
function mbpCoverTypeId(name) {
    const want = String(name || '').trim().toLowerCase();
    for (const [id, n] of Object.entries(MBP_COVER_TYPES)) if (n.toLowerCase() === want) return id;
    return null;
}

/** The release's own `ul.external_links` on a release page, or null when the page shows
 *  only the release group's list or it can't tell.
 *
 *  MB renders up to two lists, each after an `h2.external-links`: the release's (heading
 *  "External links") and then the release group's ("Release group external links"), and
 *  a list is left out when it has no links. Two lists: the first is the release's. One
 *  list: it is the release's when its heading is the plain one, in English or as learnt
 *  in this language from a page that showed both. */
function mbpReleaseLinkList(doc) {
    doc = doc || document;
    const lists = [...doc.querySelectorAll('ul.external_links')].map(ul => {
        let h = ul.previousElementSibling;
        while (h && !/^H\d$/.test(h.tagName)) h = h.previousElementSibling;
        return { ul, head: h && h.classList.contains('external-links') ? (h.textContent || '').trim() : null };
    }).filter(l => l.head !== null);
    const lang = (doc.documentElement && doc.documentElement.lang) || 'en';
    const key = 'mbu.extLinksHeading.' + lang;   // shared storage: every script learns it once
    if (lists.length >= 2) {
        try { localStorage.setItem(key, JSON.stringify(lists[0].head)); } catch (e) { /* storage blocked: nothing learnt */ }
        return lists[0].ul;
    }
    if (lists.length !== 1) return null;
    if (/^external links$/i.test(lists[0].head)) return lists[0].ul;
    let learnt = null;
    try { learnt = JSON.parse(localStorage.getItem(key)); } catch (e) { /* storage blocked */ }
    return learnt && learnt === lists[0].head ? lists[0].ul : null;
}

/** The release's URL relationships from the data MB embeds in a release's overview page
 *  (a `script[type="application/json"]` holding `release.relationships`; the release
 *  group's are on `release.releaseGroup`, apart), or null when the page has none. */
function mbpReleaseJsonLinks(doc) {
    doc = doc || document;
    const mbid = ((doc.location && doc.location.pathname) || '').match(/\/release\/([0-9a-f-]{36})/i);
    for (const s of doc.querySelectorAll('script[type="application/json"]')) {
        const t = s.textContent || '';
        if (t.indexOf('"relationships"') < 0) continue;
        let rel = null;
        try { rel = JSON.parse(t).release; } catch (e) { continue; }
        if (!rel || rel.entityType !== 'release' || !Array.isArray(rel.relationships)) continue;
        if (mbid && rel.gid && rel.gid.toLowerCase() !== mbid[1].toLowerCase()) continue;
        return rel.relationships.map(r => r && r.target).filter(u => u && u.entityType === 'url' && /^https?:/.test(u.href_url || '')).map(u => u.href_url);
    }
    return null;
}

/** The release's external links on a release page (absolute http(s) URLs), [] when none
 *  or when the page shows only the release group's. From MB's data where the page has it,
 *  else from the sidebar list (mbpReleaseLinkList). */
function mbpReleaseLinks(doc) {
    const data = mbpReleaseJsonLinks(doc);
    if (data) return [...new Set(data)];
    const ul = mbpReleaseLinkList(doc);
    // MB writes some hrefs protocol-relative (//x.bandcamp.com): a.href resolves them
    return ul ? [...ul.querySelectorAll('a[href]')].map(a => a.href).filter(u => /^https?:/.test(u)) : [];
}

export const MBP_INLINE = {
    consts: { MBP_COVER_TYPES },
    fns: [mbpCoverTypeId, mbpReleaseLinkList, mbpReleaseJsonLinks, mbpReleaseLinks],
};
export { mbpCoverTypeId, mbpReleaseLinkList, mbpReleaseJsonLinks, mbpReleaseLinks };
