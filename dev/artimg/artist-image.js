// An artist's picture (or a label's logo), found through its URL relationships and cached. #834
// Inlined by sync-artimg.mjs into every script carrying a `// <ST-ARTIMG>` marker; edit only here.
//
//   const ai = new ArtistImage({ get: GM_getValue, set: GM_setValue }, { http: gmFetch });
//   const img = await ai.find(mbid, urls);    // { src, from, key, url } or null
//   const all = await ai.findAll(mbid, urls); // every provider's image, in order
//
// Every provider with a matching URL is asked; the order (the option, else PROVIDERS') picks which
// image comes first, so changing it needs no new requests. The cache keeps the image URLs (the
// browser's HTTP cache keeps the images) and misses too, each with its own expiry.
class ArtistImage {
    constructor(store = {}, o = {}) {
        this.store = store;
        this.key = o.key || 'mbu:artimg';
        this.hitDays = o.hitDays || 30;
        this.missDays = o.missDays || 7;
        this.max = o.max || 2000;
        this.providers = o.providers || ArtistImage.PROVIDERS;
        this.order = o.order || null; // provider keys, or a function returning them; one left out is off
        this.http = o.http || (u => fetch(u));
        this.log = o.log || null;
    }

    // Discogs, Deezer and Wikimedia answer JSON; Tidal, Apple Music and SoundCloud are read off their pages' og:image,
    // which only a manager's request can reach (no CORS): pass `http` for those.
    static PROVIDERS = [
        { key: 'discogs', name: 'Discogs', re: /^https?:\/\/(?:www\.)?discogs\.com\/(artist|label)\/(\d+)/, get: async (m, http) => {
            const r = await http('https://api.discogs.com/' + m[1] + 's/' + m[2]);
            if (!r.ok) return null;
            const im = (await r.json()).images || [], i = im.find(x => x.type === 'primary') || im[0];
            return i && i.uri ? i.uri : null;
        } },
        { key: 'deezer', name: 'Deezer', re: /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/, get: async (m, http) => {
            const r = await http('https://api.deezer.com/artist/' + m[1]);
            if (!r.ok) return null;
            const p = (await r.json()).picture_big;
            return p && !p.includes('/artist//') ? p : null; // an empty hash is Deezer's placeholder
        } },
        { key: 'tidal', name: 'Tidal', re: /^https?:\/\/(?:listen\.|www\.)?tidal\.com\/(?:browse\/)?artist\/(\d+)/, get: async (m, http) => {
            const r = await http('https://tidal.com/artist/' + m[1]);
            if (!r.ok) return null;
            return ArtistImage.og(await r.text());
        } },
        { key: 'apple', name: 'Apple Music', re: /^https?:\/\/(?:music|itunes)\.apple\.com\/(?:[a-z]{2}\/)?artist\/(?:[^/?#]+\/)?(?:id)?(\d+)/, get: async (m, http) => {
            const r = await http('https://music.apple.com/us/artist/' + m[1]);
            if (!r.ok) return null;
            const s = ArtistImage.og(await r.text());
            return s ? s.replace(/\/[^/]+$/, '/500x500bb.jpg') : null; // the page's is a 1200x630 crop
        } },
        { key: 'soundcloud', name: 'SoundCloud', re: /^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([^/?#]+)\/?(?:[?#]|$)/, get: async (m, http) => {
            const r = await http('https://soundcloud.com/' + m[1]);
            if (!r.ok) return null;
            const s = ArtistImage.og(await r.text());
            return s && !/default_avatar/.test(s) ? s : null;
        } },
        // the entity's own Commons image first, else its Wikidata item's (P18), else its Wikipedia article's
        { key: 'wikipedia', name: 'Wikipedia', re: [/^https?:\/\/commons\.wikimedia\.org\/wiki\/(File:[^?#]+)/, /^https?:\/\/(?:www\.)?wikidata\.org\/wiki\/(Q\d+)/, /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/], get: async (m, http) => {
            const fp = f => 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(decodeURIComponent(f).replace(/^File:/, '').replace(/ /g, '_')) + '?width=500';
            if (m[1].startsWith('File:')) return fp(m[1]);
            if (/^Q\d+$/.test(m[1]) && !m[2]) {
                const r = await http('https://www.wikidata.org/w/api.php?action=wbgetclaims&property=P18&format=json&origin=*&entity=' + m[1]);
                if (!r.ok) return null;
                const c = ((await r.json()).claims || {}).P18, v = c && c[0] && c[0].mainsnak.datavalue;
                return v ? fp(v.value) : null;
            }
            const r = await http('https://' + m[1] + '.wikipedia.org/w/api.php?action=query&prop=pageimages&pithumbsize=500&format=json&origin=*&titles=' + m[2]);
            if (!r.ok) return null;
            const pg = Object.values(((await r.json()).query || {}).pages || {})[0];
            return pg && pg.thumbnail ? pg.thumbnail.source : null;
        } },
    ];
    static og(html) {
        const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/);
        return m ? m[1].replace(/&amp;/g, '&') : null;
    }

    load() { try { return (this.store.get && this.store.get(this.key, null)) || {}; } catch (e) { return {}; } }
    save(c) {
        const ks = Object.keys(c);
        if (ks.length > this.max) ks.sort((a, b) => c[a].t - c[b].t).slice(0, ks.length - this.max).forEach(k => delete c[k]);
        try { if (this.store.set) this.store.set(this.key, c); } catch (e) { /* no storage */ }
    }
    sorted(all) {
        const o = (typeof this.order === 'function' ? this.order() : this.order) || this.providers.map(p => p.key);
        const at = k => o.indexOf(k);
        return all.filter(x => o.includes(x.key)).sort((a, b) => at(a.key) - at(b.key)); // a provider left out of the order is off
    }

    // every cached image in order ([] for a cached miss), undefined when there is none or it expired
    cachedAll(mbid) {
        const e = mbid && this.load()[mbid];
        if (!e || !Array.isArray(e.all)) return undefined; // older entries held one image: ask again
        const days = e.all.length ? this.hitDays : this.missDays;
        return Date.now() - e.t < days * 864e5 ? this.sorted(e.all) : undefined;
    }
    cached(mbid) { const a = this.cachedAll(mbid); return a === undefined ? undefined : a[0] || null; }

    async findAll(mbid, urls) {
        const hit = this.cachedAll(mbid);
        if (hit !== undefined) return hit;
        let failed = false;
        const got = await Promise.all(this.providers.map(async p => {
            let m = null, url = '';
            for (const re of [].concat(p.re)) { for (const u of urls) if ((m = u.match(re))) { url = u; break; } if (m) break; }
            if (!m) return null;
            try { const src = await p.get(m, this.http); return src ? { src, from: p.name, key: p.key, url } : null; }
            catch (e) { failed = true; if (this.log) this.log(p.name + ' image failed: ' + e.message); return null; }
        }));
        const all = got.filter(Boolean);
        // a failed request isn't a miss: ask again next time
        if (mbid && (all.length || !failed)) { const c = this.load(); c[mbid] = { all, t: Date.now() }; this.save(c); }
        return this.sorted(all);
    }
    async find(mbid, urls) { return (await this.findAll(mbid, urls))[0] || null; }

    forget(mbid) { const c = this.load(); delete c[mbid]; this.save(c); }
}
if (typeof module !== 'undefined') module.exports = ArtistImage;
