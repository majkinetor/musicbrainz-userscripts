// Probe what each platform actually returns for the test query.
// Saves raw HTML + a small extraction summary to test/probe-out/.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath }    from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT  = resolve(HERE, 'probe-out');
await mkdir(OUT, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const ARTIST = 'Menahan Street Band';
const ALBUM  = 'The Exciting Sounds of Menahan Street Band';
const Q      = `${ARTIST} ${ALBUM}`;

const probes = [
    // What the script currently hits:
    { name: 'spotify-search',  url: `https://open.spotify.com/search/${encodeURIComponent(Q)}` },
    { name: 'discogs-search',  url: `https://www.discogs.com/search/?q=${encodeURIComponent(Q)}&type=release` },
    { name: 'bandcamp-search', url: `https://bandcamp.com/search?q=${encodeURIComponent(Q)}&item_type=a` },
    // Spotify direct album page (we'd need the ID — using the user's expected one):
    { name: 'spotify-album-direct', url: 'https://open.spotify.com/album/41aeU2fQpLCNn3n1AVqCIF' },
    // Spotify embed (server-rendered):
    { name: 'spotify-embed',   url: 'https://open.spotify.com/embed/album/41aeU2fQpLCNn3n1AVqCIF' },
    // DuckDuckGo HTML search as a search-proxy candidate:
    { name: 'ddg-spotify',     url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:open.spotify.com album ${Q}`)}` },
    { name: 'ddg-bandcamp',    url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:bandcamp.com ${Q}`)}` },
    { name: 'ddg-discogs',     url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:discogs.com release ${Q}`)}` },
    // Discogs with browser-like UA:
    { name: 'discogs-search-ua', url: `https://www.discogs.com/search/?q=${encodeURIComponent(Q)}&type=release`, ua: UA },
    // Direct Bandcamp page (expected URL):
    { name: 'bandcamp-album-direct', url: 'https://menahanstreetband.bandcamp.com/album/the-exciting-sounds-of-menahan-street-band' },
];

for (const p of probes) {
    process.stdout.write(`probing ${p.name}… `);
    try {
        const resp = await fetch(p.url, {
            headers: {
                'User-Agent': p.ua || UA,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
        });
        const body = await resp.text();
        console.log(`${resp.status}  (${body.length} bytes)  -> ${resp.url}`);
        await writeFile(resolve(OUT, `${p.name}.html`), body);
        await writeFile(resolve(OUT, `${p.name}.meta.json`),
            JSON.stringify({ status: resp.status, finalUrl: resp.url, headers: Object.fromEntries(resp.headers) }, null, 2));
    } catch (e) {
        console.log(`ERR ${e.message}`);
    }
}
console.log(`Probes written to ${OUT}`);
