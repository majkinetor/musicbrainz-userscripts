// Shared design tokens for every userscript in this repo. #562
//
// THIS FILE IS THE SINGLE PLACE WHERE THE LOOK IS CONFIGURED. Change a value
// here, run `node dev/sync-tokens.mjs` (the pre-commit hook does it for you),
// and every script carrying a `// <ST-TOKENS>` marker picks it up.
//
// Rules that keep this honest:
//
//  · SEMANTIC NAMES ONLY. `ok`, never `green`. A name says what the colour is
//    for, so a theme can re-derive it; a name that says what it *looks like*
//    can't be themed without lying.
//  · BRAND COLOURS DO NOT BELONG HERE. Spotify green, Discogs black and the
//    rest live in dev/platform-icons.mjs and stay literal — they are data
//    about the outside world, not decisions about our UI.
//  · The values below are TODAY'S APPEARANCE, deliberately. #562 is a refactor:
//    a script adopting tokens must render identically, pixel for pixel. Values
//    were taken from the most-used literal for each role across the scripts.
//
// Why plain literals and not `var(--background, #fff)` seeding off kellnerd's
// userstyles (as the issue first proposed): a half-adopted script would then
// take a dark `--background` from an installed userstyle for its tokenised
// surfaces while every not-yet-tokenised literal stayed light, i.e. installing
// a theme would make things *worse* mid-migration. The userstyle bridge is
// #564's job, once a script is fully tokenised and there is a switch to gate
// it. The "single place to configure" is here either way.

export const TOKENS = {
    // ── surface ──────────────────────────────────────────────────────────────
    'bg': '#fff',                 // panels, popovers, the gallery ground
    'bg-raised': '#faf9fe',       // a card/popover sitting on top of --mbu-bg
    'bg-sunken': '#f4f2f9',       // inset strips: headers, footers, toolbars
    'bg-hover': '#f3eefe',        // row/button hover wash

    // ── text ─────────────────────────────────────────────────────────────────
    'text': '#222',
    'text-dim': '#555',           // secondary copy, still readable
    'text-weak': '#999',          // placeholders, disabled, timestamps
    'text-on-accent': '#fff',

    // ── lines ────────────────────────────────────────────────────────────────
    'border': '#cfc6e6',          // the default 1px edge
    'border-soft': '#e2dcef',     // a quieter edge (large panels)
    'border-strong': '#9a8ccb',   // focus/active edge
    'divider': '#eee',            // neutral hairline between rows

    // ── accent ───────────────────────────────────────────────────────────────
    // #5f3ec0 across art_station/apollo/group_therapy/isrc_scout/scribe; the
    // other seven scripts' #6f42c1 is the same intent and is folded in here as
    // those scripts adopt tokens (called out per-script, it is a visible change).
    'accent': '#5f3ec0',
    'accent-hover': '#4e329f',
    'accent-deep': '#3b2c70',     // pressed / on-accent-surface text
    'accent-soft': '#ece4ff',     // accent tint used as a background
    'accent-fg': '#fff',          // text on top of --mbu-accent

    // ── status ───────────────────────────────────────────────────────────────
    'ok': '#1f9d6b',
    'ok-bg': '#eef7f1',
    'ok-border': '#9bd3b6',
    'warn': '#a05a00',
    'warn-bg': '#fff7e6',
    'warn-border': '#f0c877',
    'error': '#c0392b',
    'error-bg': '#fdecec',
    'error-border': '#e2a1a1',
    'info': '#2f7fbf',
    'info-bg': '#eef4fb',
    'info-border': '#a9c8e6',

    // ── type ─────────────────────────────────────────────────────────────────
    // 164 uses of bare `Arial` across the repo become this one stack.
    'font': '-apple-system,Segoe UI,Roboto,Arial,sans-serif',
    'font-mono': 'ui-monospace,SFMono-Regular,Consolas,Menlo,monospace',
    'fs': '14px',
    'fs-sm': '12px',
    'fs-xs': '11px',

    // ── shape & elevation ────────────────────────────────────────────────────
    'radius': '6px',
    'radius-lg': '10px',
    'shadow': '0 1px 5px rgba(60,40,110,.07)',        // resting panel
    'shadow-lg': '0 8px 30px rgba(40,20,80,.3)',      // floating popover/modal

    // ── layering ─────────────────────────────────────────────────────────────
    // Three rungs replacing 46 ad-hoc z-index values. Anything that must sit
    // over MusicBrainz's own chrome uses --mbu-z-pop; only a true modal (which
    // must also beat other userscripts' popovers) uses --mbu-z-modal.
    'z-panel': '30',
    'z-pop': '99998',
    'z-modal': '2147483000',
    // A backdrop and its panel are a PAIR. When the panel is a CHILD of the
    // backdrop, DOM order handles it; when they are SIBLINGS (ISRC Scout's modal
    // is), the panel needs its own level or the backdrop covers it — the window
    // then looks faded and every click lands on the backdrop and dismisses it.
    // Changing one of the pair without the other is exactly how that happened.
    'z-modal-panel': '2147483001',
};

/** The `:root{…}` rule as a single CSS string. */
export function tokensCss() {
    const decls = Object.entries(TOKENS).map(([k, v]) => `--mbu-${k}:${v}`).join(';');
    return `:root{${decls}}`;
}
