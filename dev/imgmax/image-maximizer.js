// ImageMaximizer: the largest cover image behind a store page or an image URL (#717).
//
// One self-contained class: no DOM, no userscript API, nothing from outside the class.
// It talks to the network only through the `request` function it is given, so it runs
// in a userscript (GM_xmlhttpRequest, via ImageMaximizer.gmRequest), in Node or a page
// (global fetch, the default) and in tests (a stub).
//
// Use it from anywhere:
//   - this repo's scripts: the `// <ST-IMGMAX>` block, filled by dev/imgmax/sync-imgmax.mjs;
//   - any userscript: `// @require` this file's raw URL (it declares `ImageMaximizer`);
//   - Node: `import ImageMaximizer from './image-maximizer.js'`.
// The API is in dev/imgmax/README.md. Edit HERE, never in a generated block.
//
// Two parts:
//   - URL rules (synchronous, no network): candidates(imageUrl) lists the bigger
//     versions of an image on a CDN we know, largest first, the URL itself last;
//   - platform resolvers (network): find(pageUrl) reads a store page or API for its
//     cover image(s). fetchImages(url) does both and downloads the first candidate of
//     each image that answers with an image.
class ImageMaximizer {
    // ── URL rules ────────────────────────────────────────────────────────────────
    // host → (URL) → bigger URLs, largest first. Measured on the live CDNs (2026-10-11).
    static RULES = [
        // Apple: the largest rendition the resizer gives, which is the stored size. The
        // uploaded original (a1.mzstatic.com/us/r1000/0/<path>) answers 403 for every path
        // since 2026-10-16; 100000x100000-999 answers 400.
        { host: /(^|\.)mzstatic\.com$/, max: u => {
            const m = u.pathname.match(/^\/image\/thumb\/(.+)\/[^/]+$/);
            return m ? [`https://${u.host}/image/thumb/${m[1]}/9999x9999bb.jpg`] : [];
        } },
        // AllMusic (#832): fastly-s3.allmusic.com/release/<mr>/<side>/<size>/<c>.jpg → TiVo's image server, f=0 is the upload
        { host: /^fastly-s3\.allmusic\.com$/, max: u => {
            const m = u.pathname.match(/^\/release\/mr\d+\/[^/]+\/\d+\/([^/]+)\.jpg$/i);
            return m ? [`https://rovimusic.rovicorp.com/image.jpg?c=${m[1]}&f=0`] : [];
        } },
        // Deezer: 4000x0 at quality 100 gives the stored size (1900 too; 0x0 and 3000x3000 are 403)
        { host: /(^|\.)dzcdn\.net$/, max: u => {
            const m = u.pathname.match(/^(\/images\/\w+\/[0-9a-f]{32})\/\d+x\d+-[^/]+$/);
            return m ? [`https://${u.host}${m[1]}/4000x0-000000-100-0-0.jpg`, `https://${u.host}${m[1]}/1200x1200-000000-80-0-0.jpg`] : [];
        } },
        // Spotify: the size is a code inside the id; 82c1 is the upload (1500 px and more), b273 640
        { host: /(^|\.)(scdn\.co|spotifycdn\.com)$/, max: u => {
            const m = u.pathname.match(/\/image\/ab67616d[0-9a-f]{8}([0-9a-f]+)$/);
            return m ? ['000082c1', '0000b273'].map(c => `https://i.scdn.co/image/ab67616d${c}${m[1]}`) : [];
        } },
        // Bandcamp: _0 is the original upload, _10 the largest rendition
        { host: /(^|\.)bcbits\.com$/, max: u => {
            const m = u.pathname.match(/^\/img\/(a?\d+)_\d+\.(jpg|png|gif)$/);
            return m ? [`https://f4.bcbits.com/img/${m[1]}_0.${m[2]}`, `https://f4.bcbits.com/img/${m[1]}_10.jpg`] : [];
        } },
        // Tidal: origin.jpg is the upload; 1280 the largest rendition (3000 is 403)
        { host: /^resources\.tidal\.com$/, max: u => {
            const m = u.pathname.match(/^(\/images\/(?:[0-9a-f]+\/){4}[0-9a-f]+)\/[^/]+$/);
            return m ? [`https://resources.tidal.com${m[1]}/origin.jpg`, `https://resources.tidal.com${m[1]}/1280x1280.jpg`] : [];
        } },
        // Qobuz: _org is the upload, _max the largest rendition
        { host: /^static\.qobuz\.com$/, max: u => {
            const m = u.pathname.match(/^(\/images\/covers\/.+?)_(?:\d+|max|org)\.jpg$/);
            return m ? [`https://static.qobuz.com${m[1]}_org.jpg`, `https://static.qobuz.com${m[1]}_max.jpg`] : [];
        } },
        // Beatport: any size is rendered on demand (3000 is an upscale); 0x0 is the stored size
        { host: /(^|\.)beatport\.com$/, max: u => {
            const m = u.pathname.match(/^\/image_size\/\d+x\d+\/(.+)$/);
            return m ? [`https://${u.host}/image_size/0x0/${m[1]}`] : [];
        } },
        // Amazon: drop the ._SL500_-style modifiers for the stored image
        { host: /(^|\.)(media-amazon\.com|ssl-images-amazon\.com|images-amazon\.com)$/, max: u => {
            const m = u.pathname.match(/^\/images\/I\/([^./]+)(?:\.[^/]*)?\.(jpg|png|gif)$/);
            return m ? [`https://m.media-amazon.com/images/I/${m[1]}.${m[2]}`] : [];
        } },
        // 7digital: 800 is the largest rendition
        { host: /(^|\.)7static\.com$/, max: u => {
            const m = u.pathname.match(/^(.+)_\d+\.jpg$/);
            return m ? [`https://${u.host}${m[1]}_800.jpg`] : [];
        } },
        // Melon (#815): _org is the upload (2000 px and more), _1000 the largest rendition
        { host: /^cdnimg\.melon\.co\.kr$/, max: u => {
            const m = u.pathname.match(/^(\/.+\/images\/.+\/\d+_\d+)_(?:\d+|org)\.(jpg|png)$/);
            return m ? [`https://${u.host}${m[1]}_org.${m[2]}`, `https://${u.host}${m[1]}_1000.${m[2]}`] : [];
        } },
        // Bugs (#816): the size in the path; original is the upload (4096 px on CRASH)
        { host: /^image\.bugsm\.co\.kr$/, max: u => {
            const m = u.pathname.match(/^\/album\/images\/(?:\d+|original)\/(\d+\/\d+\.(?:jpg|png))$/);
            return m ? [`https://${u.host}/album/images/original/${m[1]}`, `https://${u.host}/album/images/1000/${m[1]}`] : [];
        } },
        // Juno: /full/…-BIG
        { host: /(^|\.)(juno\.co\.uk|junostatic\.com)$/, max: u => {
            const m = u.pathname.match(/^\/(?:\d+|full)\/(.+?)(?:-(?:TN|MED|BIG))?\.(jpg|png)$/i);
            return m ? [`https://${u.host}/full/${m[1]}-BIG.${m[2]}`] : [];
        } },
        // VGMdb: thumbnails and medium copies live on their own hosts; the full image on media.vgm.io
        { host: /(^|\.)vgm\.io$/, max: u => /^(thumb|medium)-media\./.test(u.host) ? [`https://media.vgm.io${u.pathname}`] : [] },
        // Google (YouTube Music, Play): =s0 is the original
        { host: /^(lh\d|yt\d)\.(googleusercontent|ggpht)\.com$/, max: u => {
            const m = u.href.match(/^([^=]+)=[^/]*$/);
            return m ? [`${m[1]}=s0`] : [];
        } },
        // YouTube thumbnails
        { host: /^i\d?\.ytimg\.com$/, max: u => {
            const m = u.pathname.match(/^\/vi(?:_webp)?\/([^/]+)\/[a-z]*default\.(?:jpg|webp)$/);
            return m ? [`https://i.ytimg.com/vi/${m[1]}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`] : [];
        } },
        // SoundCloud: -original, else the 500 px rendition
        { host: /(^|\.)sndcdn\.com$/, max: u => {
            const m = u.pathname.match(/^(.+)-(?:t\d+x\d+|large|crop|small|badge|tiny|mini|original)\.(jpg|png)$/);
            return m ? [`https://${u.host}${m[1]}-original.${m[2]}`, `https://${u.host}${m[1]}-t500x500.${m[2]}`] : [];
        } },
        // Cover Art Archive thumbnails → the original (its extension is unknown, so both)
        { host: /^(coverartarchive\.org|archive\.org|ia\d+\.us\.archive\.org)$/, max: u => {
            const m = u.href.match(/^(.+\/\d+)-(?:250|500|1200)\.jpg$/);
            return m ? [`${m[1]}.jpg`, `${m[1]}.png`] : [];
        } },
    ];

    // Images a store shows when it has none.
    static PLACEHOLDERS = [
        /dzcdn\.net\/images\/cover\/d41d8cd98f00b204e9800998ecf8427e\//,   // Deezer's empty md5
        /7static\.com\/.*\/0{8}16_\d+\.jpg$/,                              // 7digital
        /\/images\/I\/(01RmK\+J4pJL|01QFb8SNuTL|01PkLIhTX3L|01MKUOLsA5L|31CTP6oiIBL)\./,   // Amazon
        /vgmdb\.net\/db\/img\/album-(nocover|nsfw)-medium\.gif$/,
    ];

    // ── platform resolvers ────────────────────────────────────────────────────────
    // A resolver turns a store page into its cover image(s): [{ url, types?, comment? }].
    // `this` is the ImageMaximizer, so a resolver uses this._text / this._json / this._log.
    static PLATFORMS = [
        { id: 'apple', name: 'Apple Music', host: /^(music|itunes)\.apple\.com$/, async find(u) {
            const id = (u.pathname.match(/\/album\/(?:[^/]+\/)?(?:id)?(\d+)/) || [])[1];
            if (!id) throw new Error('no album id in the URL');
            const cc = (u.pathname.match(/^\/([a-z]{2})\//) || [])[1] || 'us';
            const j = await this._json(`https://itunes.apple.com/lookup?id=${id}&country=${cc}&entity=album`);
            const art = j && j.results && j.results[0] && j.results[0].artworkUrl100;
            if (art) return [{ url: art, types: ['Front'] }];
            this._log('debug', `Apple: lookup had no artwork for ${id} in ${cc}, reading the page`);
            return this._metaImage(u.href, ['Front']);
        } },
        { id: 'melon', name: 'Melon', host: /^(www|m2|m\.app)\.melon\.com$/, async find(u) {
            const id = u.searchParams.get('albumId');
            if (!/^\d+$/.test(id || '')) throw new Error('no album id in the URL');
            const j = await this._json(`https://m2.melon.com/m6/v3/album/info.json?albumId=${id}`);
            const a = j && j.response && j.response.ALBUMINFO;
            const art = a && (a.ALBUMIMGLARGE || a.ALBUMIMG);
            return art ? [{ url: art.replace(/\?.*$/, ''), types: ['Front'] }] : [];
        } },
        // Bugs (#816): the page's og:image is the 1200 rendition; the max rule takes it to the original
        { id: 'bugs', name: 'Bugs', host: /^(music|m)\.bugs\.co\.kr$/, async find(u) {
            if (!/^\/album\/\d+/.test(u.pathname)) throw new Error('not an album page');
            return this._metaImage(u.href, ['Front']);
        } },
        { id: 'deezer', name: 'Deezer', host: /(^|\.)deezer\.com$/, async find(u) {
            const id = (u.pathname.match(/\/album\/(\d+)/) || [])[1];
            if (!id) throw new Error('no album id in the URL');
            const j = await this._json(`https://api.deezer.com/album/${id}`);
            if (j && j.error) throw new Error(j.error.message || 'album not found');
            return j && j.cover_xl ? [{ url: j.cover_xl, types: ['Front'] }] : [];
        } },
        { id: 'spotify', name: 'Spotify', host: /^open\.spotify\.com$/, async find(u) {
            const id = (u.pathname.match(/\/album\/(\w+)/) || [])[1];
            if (!id) throw new Error('no album id in the URL');
            const j = await this._json(`https://open.spotify.com/oembed?url=${encodeURIComponent('https://open.spotify.com/album/' + id)}`);
            return j && j.thumbnail_url ? [{ url: j.thumbnail_url, types: ['Front'] }] : [];
        } },
        { id: 'bandcamp', name: 'Bandcamp', host: /(^|\.)bandcamp\.com$/, async find(u) {
            const html = await this._text(u.href);
            // data-tralbum's art_id where the page has it, else the og:image
            const art = (html.match(/&quot;art_id&quot;:(\d+)/) || html.match(/"art_id":(\d+)/) || [])[1];
            if (art) return [{ url: `https://f4.bcbits.com/img/a${art}_10.jpg`, types: ['Front'] }];
            const og = ImageMaximizer.metaImage(html, u.href);
            return og ? [{ url: og, types: ['Front'] }] : [];
        } },
        { id: 'tidal', name: 'Tidal', host: /^(listen\.|store\.|www\.)?tidal\.com$/, async find(u) {
            const id = (u.pathname.match(/\/album\/(\d+)/) || [])[1];
            if (!id) throw new Error('no album id in the URL');
            const headers = { 'x-tidal-token': ImageMaximizer.TIDAL_TOKEN };
            const countries = [];
            try { const c = await this._json('https://listen.tidal.com/v1/country/context?countryCode=WW&locale=en_US&deviceType=BROWSER', headers); if (c && c.countryCode) countries.push(c.countryCode); } catch (e) { this._log('debug', 'Tidal: country lookup failed — ' + e.message); }
            for (const c of ['US', 'GB', 'DE', 'NL', 'CA', 'NZ', 'JP', 'IT']) if (!countries.includes(c)) countries.push(c);
            let last;
            for (const cc of countries) {
                try {
                    const j = await this._json(`https://api.tidal.com/v1/albums/${id}?countryCode=${cc}`, headers);
                    if (j && j.cover) return [{ url: `https://resources.tidal.com/images/${j.cover.replace(/-/g, '/')}/1280x1280.jpg`, types: ['Front'] }];
                } catch (e) { last = e; this._log('debug', `Tidal: album ${id} not in ${cc} — ${e.message}`); }
            }
            throw last || new Error('album not found');
        } },
        { id: 'qobuz', name: 'Qobuz', host: /(^|\.)qobuz\.com$/, async find(u) {
            const id = (u.pathname.match(/\/album\/(?:[^/]+\/)?([A-Za-z\d]+)\/?$/) || [])[1];
            if (!id) throw new Error('no album id in the URL');
            // the store's covers are addressed by the album id (…/covers/<last 2>/<the 2 before>/<id>);
            // the API, when it answers, adds the booklets
            const out = [{ url: `https://static.qobuz.com/images/covers/${id.slice(-2)}/${id.slice(-4, -2)}/${id}_600.jpg`, types: ['Front'] }];
            try {
                const j = await this._json(`https://www.qobuz.com/api.json/0.2/album/get?album_id=${id}&offset=0&limit=20`, { 'x-app-id': ImageMaximizer.QOBUZ_APP });
                if (j && j.image && j.image.large) out[0].url = j.image.large;
                for (const g of (j && j.goodies) || []) {
                    if (!g.original_url) continue;
                    const booklet = /livret|booklet/i.test(g.name || '');
                    out.push({ url: g.original_url, types: booklet ? ['Booklet'] : [], comment: booklet ? '' : (g.name || '') });
                }
            } catch (e) { this._log('debug', `Qobuz: API gave nothing for ${id} (${e.message}); the cover alone, from its URL`); }
            return out;
        } },
        { id: 'beatport', name: 'Beatport', host: /(^|\.)beatport\.com$/, async find(u) {
            const html = await this._text(u.href);
            const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (m) {
                try {
                    const d = JSON.parse(m[1]), r = d.props && d.props.pageProps && d.props.pageProps.release;
                    if (r && r.image && r.image.uri) return [{ url: r.image.uri, types: ['Front'] }];
                } catch (e) { this._log('debug', 'Beatport: page data unreadable — ' + e.message); }
            }
            const og = ImageMaximizer.metaImage(html, u.href);
            return og ? [{ url: og, types: ['Front'] }] : [];
        } },
        { id: 'discogs', name: 'Discogs', host: /(^|\.)discogs\.com$/, async find(u) {
            const rel = (u.pathname.match(/\/release\/(\d+)/) || [])[1], master = (u.pathname.match(/\/master\/(\d+)/) || [])[1];
            if (!rel && !master) throw new Error('no release id in the URL');
            if (rel) {
                // the site's own API has the full-size images (Cloudflare may stop it until the
                // site has been opened once); the public API caps them at 600 px
                try {
                    const q = new URLSearchParams({ operationName: 'ReleaseAllImages', variables: JSON.stringify({ discogsId: +rel, count: 500 }),
                        extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: ImageMaximizer.DISCOGS_QUERY } }) });
                    const j = await this._json('https://www.discogs.com/internal/release-page/api/graphql?' + q);
                    const edges = j && j.data && j.data.release && j.data.release.images && j.data.release.images.edges;
                    if (edges && edges.length) return edges.map(e => ({ url: e.node.fullsize.sourceUrl }));
                } catch (e) { this._log('debug', 'Discogs: full-size images unavailable (' + e.message + '), using the public API (600 px)'); }
            }
            const j = await this._json(`https://api.discogs.com/${rel ? 'releases/' + rel : 'masters/' + master}`);
            return ((j && j.images) || []).map(i => ({ url: i.uri })).filter(i => i.url);
        } },
        // AllMusic (experiment): the album page's cover is a Rovi image; f= picks its size, 5 the largest
        { id: 'allmusic', name: 'AllMusic', host: /(^|\.)allmusic\.com$/, async find(u) {
            if (!/^\/album\//.test(u.pathname)) throw new Error('not an album page');
            const html = await this._text(u.href);
            // AllMusic's own image host: /release/<id>/<front|back|…>/<size>/<c>.jpg; c on TiVo's image server with f=0 is the upload (#832)
            const own = new Map();
            // the other sides sit in the page's data, with escaped slashes and maybe without the host
            for (const m of html.replace(/\\+\//g, '/').matchAll(/\/release\/(mr\d+)\/([a-z-]+)\/\d+\/([\w=-]+)\.jpg/g))
                own.set(m[2] + m[3], { url: `https://rovimusic.rovicorp.com/image.jpg?c=${m[3]}&f=0`,
                    types: [{ front: 'Front', back: 'Back', booklet: 'Booklet', medium: 'Medium', tray: 'Tray', spine: 'Spine', obi: 'Obi', sticker: 'Sticker', liner: 'Liner' }[m[2]]].filter(Boolean) });
            if (own.size) return [...own.values()];
            // every Rovi image on the page (the cover and its gallery), each once at its largest size
            const rovi = [...new Set((html.match(/https?:\/\/(?:cps-static|rovimusic)\.rovicorp\.com\/[^"'\s<>\\]+/g) || [])
                .map(x => x.replace(/&amp;/g, '&').replace(/([?&]f=)\d+/, '$15')))];
            if (rovi.length) return rovi.map((url, i) => ({ url, types: i ? [] : ['Front'] }));
            const og = ImageMaximizer.metaImage(html, u.href);
            return og ? [{ url: og, types: ['Front'] }] : [];
        } },
        { id: 'amazon', name: 'Amazon', host: /(^|\.)amazon\.(com|ca|de|fr|it|es|nl|pl|se|in|sg|ae|sa|eg|cn|jp|co\.jp|co\.uk|com\.au|com\.br|com\.mx|com\.tr|com\.be)$/, async find(u) {
            const asin = (u.pathname.match(/\/(?:gp\/product|dp|albums|hz\/audible\/mlp\/mfpdp)\/([A-Z\d]{10})(?:[/?]|$)/i) || [])[1];
            if (!asin) throw new Error('no product id in the URL');
            const tld = u.host.replace(/^.*?amazon\./, '');
            const html = await this._text(`https://www.amazon.${tld}/dp/${asin}`);
            if (/validateCaptcha|\/errors\/validateCaptcha/.test(html)) throw new Error('Amazon answered with a captcha; open the page once, then retry');
            const m = html.match(/'colorImages':\s*\{\s*'initial':\s*(\[[\s\S]*?\])\s*\},?\s*\n/);
            if (m) {
                try {
                    const variant = { MAIN: 'Front', FRNT: 'Front', BACK: 'Back', SIDE: 'Spine' };
                    return JSON.parse(m[1]).map(i => ({ url: i.hiRes || i.large, types: variant[i.variant] ? [variant[i.variant]] : [] })).filter(i => i.url);
                } catch (e) { this._log('debug', 'Amazon: image data unreadable — ' + e.message); }
            }
            const hi = (html.match(/data-old-hires="([^"]+)"/) || [])[1];
            if (hi) return [{ url: hi, types: ['Front'] }];
            const og = ImageMaximizer.metaImage(html, u.href);
            return og ? [{ url: og }] : [];
        } },
        { id: 'vgmdb', name: 'VGMdb', host: /(^|\.)vgmdb\.net$/, async find(u) {
            const html = await this._text(u.href);
            const out = [], seen = new Set();
            const gallery = (html.match(/id="cover_gallery"[\s\S]*?(?=<\/table>|<div id="(?!cover)|$)/) || [''])[0];
            for (const m of gallery.matchAll(/<a[^>]*id="thumb_\d+"[^>]*href="([^"]+)"[^>]*>[\s\S]*?class="label"[^>]*>([^<]*)</g)) {
                const url = ImageMaximizer.decode(m[1]);
                if (seen.has(url)) continue; seen.add(url);
                out.push(Object.assign({ url }, ImageMaximizer.captionType(ImageMaximizer.decode(m[2]).trim())));
            }
            const main = (html.match(/id="coverart"[^>]*background-image:\s*url\(['"]?([^'")]+)/) || [])[1];
            const base = n => String(n).split('/').pop();
            if (main && !/album-(nocover|nsfw)-medium\.gif$/.test(main) && !out.some(i => base(i.url) === base(main))) out.unshift({ url: new URL(ImageMaximizer.decode(main), u.origin).href, types: ['Front'] });
            return out;
        } },
        { id: '7digital', name: '7digital', host: /(^|\.)7digital\.com$/, async find(u) { return this._metaImage(u.href, ['Front']); } },
        { id: 'juno', name: 'Juno', host: /(^|\.)(junodownload\.com|juno\.co\.uk)$/, async find(u) { return this._metaImage(u.href, ['Front']); } },
    ];

    static TIDAL_TOKEN = 'CzET4vdadNUFQ5JU';   // the web player's public token
    static QOBUZ_APP = '712109809';
    static DISCOGS_QUERY = 'c7033a9fd1facb3e69fa50074b47e8aa0076857a968e6ed086153840e02b988a';   // ReleaseAllImages

    // VGMdb-style captions ("Front", "Back", "Disc 2", "Booklet p. 3–4") → a type + the rest as comment
    static captionType(caption) {
        const map = { front: 'Front', cover: 'Front', back: 'Back', booklet: 'Booklet', disc: 'Medium', disk: 'Medium', cd: 'Medium', medium: 'Medium', vinyl: 'Medium',
            obi: 'Obi', spine: 'Spine', tray: 'Tray', inside: 'Tray', sticker: 'Sticker', poster: 'Poster', liner: 'Liner', inlay: 'Liner', insert: 'Liner', jacket: 'Front', matrix: 'Matrix/Runout' };
        const word = (String(caption).match(/^[A-Za-z]+/) || [''])[0].toLowerCase();
        const type = map[word];
        return type ? { types: [type], comment: caption.toLowerCase() === word ? '' : caption } : { types: [], comment: caption };
    }

    // ── instance ─────────────────────────────────────────────────────────────────
    // request(url, { headers, type: 'text' | 'blob' }) → { status, url, contentType, text | blob }
    // log(level, message), level = 'debug' | 'info' | 'warn'
    constructor(opts) {
        opts = opts || {};
        this.request = opts.request || ImageMaximizer.fetchRequest;
        this.log = opts.log || null;
    }
    _log(level, msg) { try { if (this.log) this.log(level, msg); } catch (e) { /* a broken logger must not break a fetch */ }}
    async _get(url, type, headers) {
        const r = await this.request(url, { type, headers: headers || {} });
        if (!r || r.status < 200 || r.status >= 300) {
            const body = r && typeof r.text === 'string' ? r.text : '';
            if (r && r.status === 403 && /<title>Just a moment\.\.\.<\/title>/.test(body)) throw new Error('Cloudflare check; open the page once in this browser, then retry');
            throw new Error('HTTP ' + (r ? r.status : '?'));
        }
        return r;
    }
    async _text(url, headers) { return (await this._get(url, 'text', headers)).text; }
    async _json(url, headers) {
        const t = await this._text(url, headers);
        try { return JSON.parse(t); } catch (e) { throw new Error('not JSON'); }
    }
    async _metaImage(url, types) {
        const og = ImageMaximizer.metaImage(await this._text(url), url);
        return og ? [{ url: og, types: types || [] }] : [];
    }

    /** The platform resolver for a page URL, or null. */
    platform(url) {
        let u; try { u = new URL(url); } catch (e) { return null; }
        const p = ImageMaximizer.PLATFORMS.find(x => x.host.test(u.hostname));
        return p ? { id: p.id, name: p.name } : null;
    }

    /** Bigger versions of an image URL, largest first, ending with the URL itself. Synchronous. */
    candidates(url) {
        let u; try { u = new URL(url); } catch (e) { return [String(url)]; }
        const out = [];
        for (const r of ImageMaximizer.RULES) {
            if (!r.host.test(u.hostname)) continue;
            try { out.push(...r.max(u)); } catch (e) { this._log('debug', `rule for ${u.hostname} failed — ${e.message}`); }
            break;
        }
        out.push(u.href);
        return [...new Set(out)];
    }

    /** Images behind a URL, unmaximised: [{ url, types, comment, page }]. A store page goes to its
     *  resolver; any other page to its og:image; an image URL is itself. */
    async find(url) {
        const u = new URL(url);
        const p = ImageMaximizer.PLATFORMS.find(x => x.host.test(u.hostname));
        // an image URL is an image even on a store's host (Beatport's geo-media, say), not a page
        if (ImageMaximizer.looksLikeImage(u.href)) {
            return [{ url: u.href, types: [], comment: '', page: '' }];
        }
        let list;
        if (p) {
            this._log('debug', `${p.name}: reading ${u.href}`);
            list = await p.find.call(this, u);
        } else {
            // unknown host: an image answers as one, a page by its og:image
            const r = await this._get(u.href, 'text');
            if (/^image\//i.test(r.contentType || '')) return [{ url: u.href, types: [], comment: '', page: '' }];
            const og = ImageMaximizer.metaImage(r.text || '', u.href);
            list = og ? [{ url: og }] : [];
        }
        list = (list || []).filter(i => i && i.url && !ImageMaximizer.PLACEHOLDERS.some(re => re.test(i.url)));
        this._log('debug', `${p ? p.name : u.hostname}: ${list.length} image(s)${list.length ? ' — ' + list.map(i => i.url).join(', ') : ''}`);
        return list.map(i => ({ url: i.url, types: i.types || [], comment: i.comment || '', page: u.href }));
    }

    /** Download the largest version of each image behind a URL.
     *  → [{ blob, url, original, page, types, comment, width, height }]; throws when there is none.
     *  opts.minSize drops images whose longer side is smaller (a store's logo). */
    async fetchImages(url, opts) {
        opts = opts || {};
        const found = await this.find(url);
        if (!found.length) throw new Error('no image found');
        const got = [];
        for (const img of found) {
            const r = await this.fetchLargest(img.url);
            if (!r) { this._log('warn', `no candidate of ${img.url} answered with an image`); continue; }
            if (opts.minSize && r.width && Math.max(r.width, r.height) < opts.minSize) { this._log('debug', `skipped ${r.url}: ${r.width}×${r.height} is under ${opts.minSize} px`); continue; }
            got.push(Object.assign(r, { original: img.url, page: img.page, types: img.types, comment: img.comment }));
        }
        if (!got.length) throw new Error('no image could be downloaded');
        return got;
    }

    /** The first candidate of one image URL that answers with an image: { blob, url, width, height } or null. */
    async fetchLargest(url) {
        for (const c of this.candidates(url)) {
            try {
                const r = await this.request(c, { type: 'blob', headers: {} });
                const type = (r && (r.contentType || (r.blob && r.blob.type))) || '';
                if (!r || r.status < 200 || r.status >= 300 || !r.blob || !r.blob.size) { this._log('debug', `candidate ${c}: HTTP ${r ? r.status : '?'}`); continue; }
                if (!/^image\/|^application\/pdf/i.test(type) && !/^(application\/octet-stream|binary\/octet-stream)?$/i.test(type)) { this._log('debug', `candidate ${c}: not an image (${type})`); continue; }
                let d = {};
                try { d = ImageMaximizer.dimensions(await r.blob.slice(0, 262144).arrayBuffer()) || {}; } catch (e) { /* size unknown */ }
                if (!d.type && !/^image\/|pdf/i.test(type)) { this._log('debug', `candidate ${c}: unrecognised bytes`); continue; }
                this._log('debug', `candidate ${c}: ${d.width ? d.width + '×' + d.height : 'size unknown'}, ${r.blob.size} bytes`);
                return { blob: r.blob, url: c, width: d.width || 0, height: d.height || 0 };
            } catch (e) { this._log('debug', `candidate ${c}: ${e.message}`); }
        }
        return null;
    }

    // ── helpers (static, pure) ────────────────────────────────────────────────────
    /** True when the URL's path ends in an image extension. */
    static looksLikeImage(url) {
        try { return /\.(jpe?g|png|gif|webp|avif|bmp|tiff?)$/i.test(new URL(url).pathname); } catch (e) { return false; }
    }
    /** og:image / twitter:image / image_src of an HTML page, resolved against its URL. */
    static metaImage(html, base) {
        const tags = String(html).match(/<(?:meta|link)\b[^>]*>/gi) || [];
        const want = [/^og:image(:secure_url|:url)?$/i, /^twitter:image(:src)?$/i, /^image_src$/i];
        for (const re of want) {
            for (const t of tags) {
                const key = (t.match(/\b(?:property|name|itemprop|rel)\s*=\s*["']([^"']+)["']/i) || [])[1];
                const val = (t.match(/\b(?:content|href)\s*=\s*["']([^"']+)["']/i) || [])[1];
                if (key && val && re.test(key.trim())) { try { return new URL(ImageMaximizer.decode(val), base).href; } catch (e) { /* bad URL */ } }
            }
        }
        return null;
    }
    static decode(s) {
        return String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
    /** { type, width, height } from the first bytes of a JPEG, PNG, GIF or WebP; null otherwise. */
    static dimensions(buf) {
        const b = new Uint8Array(buf);
        if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return { type: 'png', width: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, height: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 };
        if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { type: 'gif', width: b[6] | b[7] << 8, height: b[8] | b[9] << 8 };
        if (b.length > 30 && b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) {
            const f = String.fromCharCode(b[12], b[13], b[14], b[15]);
            if (f === 'VP8X') return { type: 'webp', width: 1 + (b[24] | b[25] << 8 | b[26] << 16), height: 1 + (b[27] | b[28] << 8 | b[29] << 16) };
            if (f === 'VP8 ') return { type: 'webp', width: (b[26] | b[27] << 8) & 0x3fff, height: (b[28] | b[29] << 8) & 0x3fff };
            if (f === 'VP8L') return { type: 'webp', width: 1 + ((b[22] << 8 | b[21]) & 0x3fff), height: 1 + ((b[24] << 4 | b[23] >> 4) & 0x3fff) };
            return { type: 'webp', width: 0, height: 0 };
        }
        if (b.length > 4 && b[0] === 0xFF && b[1] === 0xD8) {
            let i = 2;
            while (i + 9 < b.length) {
                if (b[i] !== 0xFF) { i++; continue; }
                const m = b[i + 1];
                if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7) || m === 0xFF) { i++; continue; }
                const len = b[i + 2] << 8 | b[i + 3];
                if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { type: 'jpeg', width: b[i + 7] << 8 | b[i + 8], height: b[i + 5] << 8 | b[i + 6] };
                i += 2 + len;
            }
            return { type: 'jpeg', width: 0, height: 0 };
        }
        if (b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { type: 'pdf', width: 0, height: 0 };
        return null;
    }

    // ── request adapters ──────────────────────────────────────────────────────────
    /** The default: global fetch (Node 18+, a page; CORS applies in a page). */
    static async fetchRequest(url, o) {
        const r = await fetch(url, { headers: (o && o.headers) || {} });
        const out = { status: r.status, url: r.url || url, contentType: r.headers.get('content-type') || '' };
        if (o && o.type === 'blob') out.blob = await r.blob(); else out.text = await r.text();
        return out;
    }
    /** An adapter for a userscript manager's GM_xmlhttpRequest / GM.xmlHttpRequest (no CORS). */
    static gmRequest(gmXhr, timeout) {
        return (url, o) => new Promise((resolve, reject) => {
            gmXhr({ method: 'GET', url, headers: (o && o.headers) || {}, responseType: o && o.type === 'blob' ? 'blob' : 'text', timeout: timeout || 60000,
                onload: r => {
                    const ct = (String(r.responseHeaders || '').match(/^content-type:\s*([^\r\n]+)/im) || [])[1] || '';
                    const out = { status: r.status, url: r.finalUrl || url, contentType: ct.trim() };
                    if (o && o.type === 'blob') out.blob = r.response; else out.text = typeof r.responseText === 'string' ? r.responseText : String(r.response || '');
                    resolve(out);
                },
                onerror: () => reject(new Error('network error')), ontimeout: () => reject(new Error('timed out')) });
        });
    }
}
if (typeof module === 'object' && module && module.exports) module.exports = ImageMaximizer;
