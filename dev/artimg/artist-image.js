// An artist's picture (or a label's logo), found through its URL relationships and cached. #834
// Inlined by sync-artimg.mjs into every script carrying a `// <ST-ARTIMG>` marker; edit only here.
//
//   const ai = new ArtistImage({ get: GM_getValue, set: GM_setValue });
//   const img = await ai.find(mbid, urls);   // { src, from, url } or null
//
// Providers are tried in order; the first with an image wins. The cache keeps the image URL
// (the browser's HTTP cache keeps the image itself) and misses too, each with its own expiry.
class ArtistImage {
    constructor(store = {}, o = {}) {
        this.store = store;
        this.key = o.key || 'mbu:artimg';
        this.hitDays = o.hitDays || 30;
        this.missDays = o.missDays || 7;
        this.max = o.max || 2000;
        this.providers = o.providers || ArtistImage.PROVIDERS;
        this.log = o.log || null;
    }

    static PROVIDERS = [
        { name: 'Discogs', re: /^https?:\/\/(?:www\.)?discogs\.com\/(artist|label)\/(\d+)/, get: async m => {
            const r = await fetch('https://api.discogs.com/' + m[1] + 's/' + m[2]);
            if (!r.ok) return null;
            const im = (await r.json()).images || [], i = im.find(x => x.type === 'primary') || im[0];
            return i && i.uri ? i.uri : null;
        } },
    ];

    load() { try { return (this.store.get && this.store.get(this.key, null)) || {}; } catch (e) { return {}; } }
    save(c) {
        const ks = Object.keys(c);
        if (ks.length > this.max) ks.sort((a, b) => c[a].t - c[b].t).slice(0, ks.length - this.max).forEach(k => delete c[k]);
        try { if (this.store.set) this.store.set(this.key, c); } catch (e) { /* no storage */ }
    }

    // the cached answer, undefined when there is none or it expired
    cached(mbid) {
        const e = mbid && this.load()[mbid];
        if (!e) return undefined;
        const days = e.img ? this.hitDays : this.missDays;
        return Date.now() - e.t < days * 864e5 ? e.img : undefined;
    }

    async find(mbid, urls) {
        const hit = this.cached(mbid);
        if (hit !== undefined) return hit;
        let img = null, failed = false;
        for (const p of this.providers) {
            for (const u of urls) {
                const m = u.match(p.re);
                if (!m) continue;
                try { const src = await p.get(m); if (src) { img = { src, from: p.name, url: u }; break; } }
                catch (e) { failed = true; if (this.log) this.log(p.name + ' image failed: ' + e.message); }
            }
            if (img) break;
        }
        // a failed request isn't a miss: ask again next time
        if (mbid && (img || !failed)) { const c = this.load(); c[mbid] = { img, t: Date.now() }; this.save(c); }
        return img;
    }

    forget(mbid) { const c = this.load(); delete c[mbid]; this.save(c); }
}
if (typeof module !== 'undefined') module.exports = ArtistImage;
