// Single source of truth for the brand/platform icons shared across the userscripts
// (Platform Check, ISRC Scout, Credit Hoarder, Art Station, …). #404
//
// Each entry is a full-colour inline SVG (brand colours baked in — some marks are
// multi-colour, e.g. MusicBrainz and Discogs) plus an `color` accent for text/borders.
// The SVGs carry NO width/height: `stIcon(name, size)` stamps a consistent size, so
// the same platform renders identically (design, colour AND size) in every script.
//
// This module is NOT loaded by the userscripts at runtime. `dev/sync-icons.mjs`
// inlines a generated `ST_ICONS` map + `stIcon()` into each script between
// `// <ST-ICONS> … // </ST-ICONS>` markers (run by the pre-commit hook, like the
// String Theory bundle). Edit icons HERE, never the generated blocks.
//
// Adding a platform: add an entry below, then rebuild (`node dev/sync-icons.mjs`).

export const PLATFORM_ICONS = {
    // ── MusicBrainz — two-tone hexagon (the reference entity) ──
    musicbrainz: { color: '#eb743b', svg: '<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.5)"><path d="m13 1-12 7v14l12 7z" fill="#ba478f"/><path d="m14 1 12 7v14l-12 7z" fill="#eb743b"/></g></svg>' },

    // ── Discogs — dark disc + white spiral (real logo) ──
    discogs: { color: '#333333', svg: '<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="512" fill="#333"/><path fill="#fff" d="M439.84 511.58A72.58 72.58 0 0 1 512.41 439 72.54 72.54 0 0 1 585 511.58a72.56 72.56 0 0 1-72.57 72.56 72.56 72.56 0 0 1-72.57-72.56zm3.18 0A69.48 69.48 0 0 0 512.41 581a69.4 69.4 0 0 0 69.4-69.38 69.49 69.49 0 0 0-69.4-69.43A69.44 69.44 0 0 0 443 511.58zm69.42-11.44a11.43 11.43 0 1 0 11.47 11.45 11.45 11.45 0 0 0-11.48-11.45zm-131.08 11.43a130.68 130.68 0 0 0 40.3 94.43l24.68-26.69.33.3a94.59 94.59 0 0 1 113.08-149.95l17.51-31.95a130.23 130.23 0 0 0-64.82-17.22c-72.27.01-131.08 58.81-131.08 131.08zm225.73 0a94.6 94.6 0 0 1-138.64 83.79l-17.83 31.74a130.26 130.26 0 0 0 61.82 15.53c72.28 0 131.08-58.8 131.08-131.08a130.63 130.63 0 0 0-37.73-91.9L581 446.39a94.3 94.3 0 0 1 26.1 65.2zm-267.34 0a172.17 172.17 0 0 0 53.68 125l25-27.07a135.38 135.38 0 0 1-41.82-97.89c0-74.88 60.92-135.8 135.8-135.8a134.92 134.92 0 0 1 67.08 17.8l17.73-32.34a171.57 171.57 0 0 0-84.81-22.35c-95.19-.03-172.66 77.43-172.66 172.65zm308.49 0c0 74.88-60.92 135.8-135.8 135.8a135 135 0 0 1-64.14-16.14l-18.07 32.17a171.62 171.62 0 0 0 82.21 20.86c95.22 0 172.69-77.47 172.69-172.69a172.15 172.15 0 0 0-51-122.4l-25.12 27a135.35 135.35 0 0 1 39.23 95.4zm41.61 0c0 97.83-79.58 177.43-177.41 177.43a176.32 176.32 0 0 1-84.52-21.46l-18.18 32.36a213.21 213.21 0 0 0 102.7 26.23C630.74 726.11 727 629.87 727 511.57a213.87 213.87 0 0 0-64.38-153l-25.26 27.18a176.85 176.85 0 0 1 52.49 125.82zm-392 0A213.9 213.9 0 0 0 365 667.24L390.23 640A176.88 176.88 0 0 1 335 511.57c0-97.82 79.59-177.41 177.41-177.41a176.26 176.26 0 0 1 87.08 22.93l17.84-32.55A213.14 213.14 0 0 0 512.44 297c-118.3 0-214.54 96.28-214.54 214.57zm392.55-183-24.64 26.49a218.57 218.57 0 0 1 65.94 156.51c0 120.9-98.36 219.26-219.26 219.26a217.9 217.9 0 0 1-105-26.84l-18.24 32.47A255.43 255.43 0 0 0 512 768c141.39 0 256-114.64 256-256a255.23 255.23 0 0 0-77.55-183.41zm-397.27 183c0-120.9 98.36-219.26 219.26-219.26a217.84 217.84 0 0 1 107.19 28.09L637 288.65A254.46 254.46 0 0 0 516.12 256H512c-140.54.22-254.42 113.26-256 253.5v2.5a255.69 255.69 0 0 0 80.51 186.08l25.31-27.36a218.61 218.61 0 0 1-68.64-159.15z"/></svg>' },

    // ── Spotify — the real wordless mark ──
    spotify: { color: '#1DB954', svg: '<svg viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>' },

    // ── Apple Music — the Apple mark ──
    apple: { color: '#FA243C', svg: '<svg viewBox="0 0 24 24" fill="#FA243C"><path d="M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.97-.88-3.24-.86-1.67.03-3.21.97-4.07 2.46-1.73 3.01-.44 7.47 1.24 9.92.82 1.2 1.8 2.54 3.08 2.49 1.24-.05 1.71-.8 3.21-.8 1.5 0 1.92.8 3.23.77 1.33-.02 2.18-1.22 3-2.42.94-1.39 1.33-2.73 1.35-2.8-.03-.01-2.59-.99-2.62-3.93zM14.6 4.59c.68-.83 1.14-1.97 1.01-3.11-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.21-.55 2.89-1.38z"/></svg>' },

    // ── Deezer — equalizer bars (brand-coloured stand-in) ──
    deezer: { color: '#A238FF', svg: '<svg viewBox="0 0 24 24" fill="#A238FF"><rect x="1" y="14" width="4" height="6" rx=".6"/><rect x="6.7" y="10" width="4" height="10" rx=".6"/><rect x="12.4" y="6" width="4" height="14" rx=".6"/><rect x="18.1" y="11" width="4" height="9" rx=".6"/></svg>' },

    // ── Tidal — four interlocking diamonds ──
    tidal: { color: '#000000', svg: '<svg viewBox="0 0 24 24" fill="#000000"><path d="M6 3l3 3-3 3-3-3zM12 3l3 3-3 3-3-3zM18 3l3 3-3 3-3-3zM12 9l3 3-3 3-3-3z"/></svg>' },

    // ── Qobuz — brand-blue roundel ──
    qobuz: { color: '#0070ef', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0070ef"/><circle cx="12" cy="12" r="5" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M14.5 14.5 19 19" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>' },

    // ── Beatport — green disc + play wedge (stand-in) ──
    beatport: { color: '#0a8754', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#0a8754"/><path d="M10 8l6 4-6 4z" fill="#fff"/></svg>' },

    // ── Bandcamp — the parallelogram logomark ──
    bandcamp: { color: '#629AA9', svg: '<svg viewBox="0 0 24 24" fill="#629AA9"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5z"/></svg>' },

    // ── Volumo — violet disc + V (stand-in) ──
    volumo: { color: '#7c4dff', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#7c4dff"/><path d="M7 8h2.2l2.8 6 2.8-6H17l-4 9h-2z" fill="#fff"/></svg>' },

    // ── HDtracks — red disc + HD monogram (stand-in) ──
    hdtracks: { color: '#e63329', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#e63329"/><path d="M5 7.5h1.7v3.1h2.6V7.5H11v8H9.3v-3.2H6.7v3.2H5zm7.2 0h2.9c2 0 3.4 1.6 3.4 4s-1.4 4-3.4 4h-2.9zm1.7 1.5v5h1.1c1.1 0 1.8-1 1.8-2.5s-.7-2.5-1.8-2.5z" fill="#fff"/></svg>' },

    // ── SoundCloud — orange disc + waveform bars (stand-in) ──
    soundcloud: { color: '#ff5500', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ff5500"/><g fill="#fff"><rect x="6" y="12" width="1.4" height="4" rx=".6"/><rect x="8.5" y="10" width="1.4" height="6" rx=".6"/><rect x="11" y="8.5" width="1.4" height="7.5" rx=".6"/><rect x="13.5" y="10.5" width="1.4" height="5.5" rx=".6"/><rect x="16" y="11.5" width="1.4" height="4.5" rx=".6"/></g></svg>' },

    // ── SoundExchange — purple disc + waveform (stand-in) ──
    soundexchange: { color: '#6f42c1', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#6f42c1"/><path d="M6.5 12h1.3l1-3 1.6 6 1.6-9 1.6 12 1.4-6h1.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>' },

    // ── Generic streaming host (unknown provider fallback) ──
    globe: { color: '#6f7d75', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="#6f7d75" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>' },
};

/** Return the platform's SVG stamped with a consistent square size (default 16px).
 *  The source SVG carries no width/height, so this is the single place size is set —
 *  guaranteeing identical rendering across scripts. Unknown name → '' (caller decides). */
export function stIcon(name, size = 16) {
    const i = PLATFORM_ICONS[name];
    if (!i) return '';
    // Only touch the ROOT <svg>'s width/height — child elements (e.g. Deezer's equalizer
    // <rect width height>) keep theirs. Also ensure an xmlns, so the SVG works as a
    // `data:image/svg+xml` <img src> (Art Station), not only inline in HTML.
    return i.svg.replace(/<svg\b([^>]*)>/, (_m, a) => {
        const attrs = a.replace(/\s(?:width|height)="[^"]*"/g, '');
        const ns = /\bxmlns=/.test(attrs) ? '' : ' xmlns="http://www.w3.org/2000/svg"';
        return `<svg${attrs}${ns} width="${size}" height="${size}">`;
    });
}

/** Brand accent colour for a platform (for text/borders), or '' if unknown. */
export function stColor(name) { return PLATFORM_ICONS[name]?.color || ''; }
