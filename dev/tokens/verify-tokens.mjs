#!/usr/bin/env node
// #562 — guard the one failure mode the token refactor can introduce.
//
// A `var(--mbu-x)` that no `:root{--mbu-x:…}` ever defines does not fall back to
// the old colour; the declaration is thrown away and the element renders with an
// inherited or initial value. That is invisible in a diff, invisible in the
// textual no-op proof used during the migration (the substitution IS faithful —
// it is the *availability* of the definition that is missing), and it only shows
// up as "why is that panel suddenly white".
//
// So: for every stylesheet a script emits, if it uses a token it must also carry
// the token block. Checked statically here, against the shipped sources.
//
//   node dev/tokens/verify-tokens.mjs
//
// A runtime companion (does the token resolve on a real page) lives in the
// per-script suites, e.g. userscripts/art_station/test/verify-562-tokens.mjs.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';
import { TOKENS, tokensCss } from './design-tokens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');   // dev/<subsystem>/ -> repo root
let fail = 0;
const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git' || name === 'dist' || name.endsWith('.pw-profile')) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (name.endsWith('.js')) out.push(p);
    }
    return out;
}

const files = walk(resolve(ROOT, 'userscripts'))
    .filter(f => !f.includes('string_theory') && !/[\\/]test[\\/]/.test(f));

const carriers = files.filter(f => readFileSync(f, 'utf8').includes('// <ST-TOKENS>'));
console.log(`${carriers.length} file(s) carry the token block\n`);
ck(carriers.length > 0, 'at least one script has adopted the tokens');

const expected = `const MBU_TOKENS = '${tokensCss()}';`;
const usedGlobally = new Set();

// A bundled script (credit_hoarder, discogs_credits) is many source files that
// become ONE userscript, so "carries the token block" and "wires a style sink"
// are properties of the bundle, not of each module. Checking them per file
// demands a copy of the block in every module, which is exactly what the bundle
// exists to avoid. Group by the userscript directory and assert once per unit.
const unitOf = (f) => {
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    const m = /^userscripts\/([^/]+)\//.exec(rel);
    return m ? m[1] : rel;
};
const units = new Map();
for (const f of files) {
    const u = unitOf(f);
    if (!units.has(u)) units.set(u, []);
    units.get(u).push(f);
}

for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    const uses = [...new Set([...src.matchAll(/var\(--mbu-([a-z-]+)\)/g)].map(m => m[1]))];
    if (!uses.length) continue;
    uses.forEach(u => usedGlobally.add(u));

    // 1. every token referenced must exist — a typo resolves to nothing, silently
    const unknown = uses.filter(n => !(n in TOKENS));
    ck(unknown.length === 0, `${rel}: every referenced token is defined (${uses.length} used${unknown.length ? ', UNKNOWN: ' + unknown.join(', ') : ''})`);

    // 2. the UNIT must carry the block, and it must be current
    const unit = units.get(unitOf(f)).map(x => readFileSync(x, 'utf8'));
    const unitHas = (needle) => unit.some(s => s.includes(needle));
    if (!src.includes('// <ST-TOKENS>') && unitHas('// <ST-TOKENS>')) continue;   // a sibling module carries it
    ck(unitHas('// <ST-TOKENS>'), `${rel}: uses tokens, so it must carry the // <ST-TOKENS> block`);
    ck(unitHas(expected), `${rel}: its inlined block is in sync with dev/tokens/design-tokens.mjs (run: node dev/tokens/sync-tokens.mjs)`);

    // 2b. THE BLOCKS MUST BE AT MODULE SCOPE. The generated helpers are function
    // declarations, so a block that lands inside `function foo() {…}` defines them
    // only there — every call site elsewhere throws ReferenceError. This bit Fusion
    // (options window would not open) and then Group Therapy (Apply and Options
    // dead, because every handler calls toast()). Both shipped, and both were found
    // by majkinetor rather than by this suite, which reaches the components through
    // window.MBU — populated from inside that very function — while the scripts use
    // the bare names.
    //
    // Decided by brace balance, not indentation: sync-ui.mjs preserves the marker's
    // own indent, so a nested block can sit at the same column as its enclosing
    // function and look top-level.
    {
        const ls = src.split(/\r?\n/);
        const blk = ls.findIndex(l => l.includes('// <ST-UI>'));
        let enclosing = null;
        for (let i = 0; blk >= 0 && i < blk; i++) {
            if (!/^\s*(async\s+)?function\s+\w+\s*\(/.test(ls[i])) continue;
            let depth = 0, closedAt = -1;
            for (let j = i; j < ls.length; j++) {
                for (const ch of ls[j].replace(/\/\/.*$/, '')) { if (ch === '{') depth++; else if (ch === '}') depth--; }
                if (depth === 0 && j > i) { closedAt = j; break; }
            }
            if (closedAt > blk) enclosing = ls[i].trim().slice(0, 48);
        }
        ck(!enclosing, `${rel}: the generated blocks are at module scope${enclosing ? ` (INSIDE ${JSON.stringify(enclosing)} — its helpers are invisible everywhere else)` : ''}`);
    }
    // 3. every stylesheet-producing site that uses a token must also emit the block.
    // A script with several <style> elements (Apollo has three, Platform Check two)
    // can mount one without the other, and only the one carrying :root would work.
    // Fusion builds its sheet as `= MBU_TOKENS` followed by a chain of `+ '…'`
    // on later lines, so "wired" cannot require a quote right after the name.
    const count = re => (src.match(re) || []).length;
    const wired = count(/(?:const|let|var)\s+css\s*=\s*MBU_TOKENS\b/g)
        + count(/\.(?:textContent|innerText)\s*=\s*MBU_TOKENS\b/g)
        + count(/<style>\s*\n?\$\{MBU_TOKENS\}/g);
    const bare = count(/(?:const|let|var)\s+css\s*=\s*[`']/g)
        + count(/\.(?:textContent|innerText)\s*=\s*[`']/g);
    // Not every textContent assignment is a stylesheet, so this is reported rather
    // than asserted outright — but a file that wires NONE of them is certainly wrong.
    ck(wired > 0, `${rel}: at least one style sink prepends MBU_TOKENS (${wired} wired, ${bare} other assignment(s))`);
}

// ── text themed onto a ground that is NOT themed ────────────────────────────
// A panel with a fixed dark background — a console, a tooltip, a chip — needs a
// fixed light foreground. The background sweep deliberately left dark grounds
// alone, but the foreground sweep tokenised the text sitting on them, so in the
// LIGHT theme that text turns dark and vanishes into its own panel. ISRC Scout's
// activity log was exactly this: ground #0d1117 with the text on
// var(--mbu-info), which is a dark blue when the page is light.
//
// --mbu-text-on-accent is exempt: it exists precisely to sit on a coloured
// ground and is fixed in both themes.
{
    const relLum = (hex) => {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const f of files) {
        const src = readFileSync(f, 'utf8');
        const rel = relative(ROOT, f).replace(/\\/g, '/');
        const bad = [];
        // Strip CSS comments first and allow a generous block: an explanatory
        // comment inside a rule pushed it past the length cap, and the check
        // then silently saw nothing at all — which is how it passed on a build
        // where the bug had deliberately been put back.
        const clean = src.replace(/\/\*[\s\S]*?\*\//g, ' ');
        for (const block of clean.match(/\{[^{}]{0,900}\}/g) || []) {
            const bg = /background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})\b/.exec(block);
            if (!bg || relLum(bg[1]) > 0.35) continue;
            const fg = /(?:^|[^-\w])color\s*:\s*var\(--mbu-([a-z-]+)\)/.exec(block);
            if (!fg || fg[1] === 'text-on-accent') continue;
            bad.push(`${bg[1]} + var(--mbu-${fg[1]})`);
        }
        if (!bad.length) continue;
        ck(false, `${rel}: themed text on a fixed dark ground — unreadable in the light theme — ${JSON.stringify(bad)}`);
    }
}

// ── and the mirror: themed text on a fixed LIGHT ground ─────────────────────
// The same half-sweep in the other direction, and the one majkinetor actually
// hits: the foreground was tokenised and the background left as a literal, so
// on the dark theme var(--mbu-text) is near-white on a hard-coded white pill.
// Falcon's cover-picker chips were exactly this — `background:#fff` with
// `color:var(--mbu-text)` — invisible on the dark panel they sit in.
//
// Proximity-based rather than block-based on purpose: these live in template
// literals inside `style="…"` attributes with a ternary per property, which is
// not a CSS rule and never matched the block scan above.
{
    const relLum = (hex) => {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    for (const f of files) {
        // The generated token block is DEFINITIONS, not a rule that paints
        // anything: `--mbu-bg: var(--background, #fff)` followed a few hundred
        // characters later by the text tokens looks exactly like the bug and is
        // not one. Cut it out before scanning.
        // Whole-line `//` comments go too. The shared components carry the line
        //   `// carries \`input{background:#fff}\` — specificity 0,0,1 …`
        // which sync-ui.mjs inlines into every script, and it reads as a light
        // ground sitting next to the components' own themed text. Only lines
        // that START with `//` are cut, so an inline `https://…` is safe.
        const src = readFileSync(f, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, ' ')
            .replace(/\/\/ <ST-TOKENS>[\s\S]*?\/\/ <\/ST-TOKENS>/g, ' ')   // BEFORE the line-comment strip: its own markers are line comments
            .replace(/^\s*\/\/.*$/gm, ' ');
        const rel = relative(ROOT, f).replace(/\\/g, '/');
        const bad = new Set();
        for (const m of src.matchAll(/background(?:-color)?\s*:/g)) {
            // The VALUE region may be a plain literal or a whole ternary:
            //   background:#fff
            //   background:${on ? '#eef1fa' : '#fff'}
            // so take every hex in it, not just one right after the colon. A
            // regex anchored on `background:\s*#` matched neither of Falcon's
            // two broken chips, and the guard passed on the build with the bug
            // still in it — the exact failure this suite exists to prevent.
            // ONLY this declaration's own value — up to the next `;`. Taking a
            // flat 120-character window swept in the neighbouring `color:#fff`
            // and reported every dark chip in the repo as a light one.
            const value = src.slice(m.index, m.index + 160).split(';')[0];
            const hexes = [...value.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map(h => h[0]);
            const light = hexes.filter(h => relLum(h) >= 0.75);
            if (!light.length) continue;
            const near = src.slice(m.index, m.index + 260);
            const fg = /(?:^|[^-\w])color\s*:\s*(?:[^;"']*?')?var\(--mbu-(text|text-dim|text-weak|accent-text|accent-deep-text)\)/.exec(near);
            if (fg) light.forEach(h => bad.add(`${h} + var(--mbu-${fg[1]})`));
        }
        if (!bad.size) continue;
        ck(false, `${rel}: themed text on a fixed LIGHT ground — unreadable in the dark theme — ${JSON.stringify([...bad])}`);
    }
}

// ── a spinner whose ring and top segment are the same colour ────────────────
// A CSS spinner is a ring with one differently-coloured side; rotate it and the
// difference is what you see. The border sweep mapped `border` and
// `border-top-color` to the SAME token in three of them, and the result is a
// perfectly still circle — the animation is still running, there is just
// nothing to see. Nothing else in this suite could catch that: every colour
// involved is a valid token, correctly themed, and the rule parses fine.
for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f).replace(/\\/g, '/');
    const flat = [...src.matchAll(/border:\s*[\d.]+px\s+solid\s+var\(--mbu-([a-z-]+)\)\s*;\s*border-top-color:\s*var\(--mbu-([a-z-]+)\)/g)]
        .filter(m => m[1] === m[2]).map(m => m[1]);
    if (!flat.length) continue;
    ck(false, `${rel}: a spinner's ring and its top segment are the same colour, so it looks stationary — ${JSON.stringify(flat)}`);
}

console.log('');
const unused = Object.keys(TOKENS).filter(t => !usedGlobally.has(t));
console.log(`tokens in use across the repo: ${usedGlobally.size}/${Object.keys(TOKENS).length}`);
if (unused.length) console.log('  not yet used anywhere: ' + unused.join(', '));

console.log(fail ? `\n${fail} FAIL` : '\nALL PASS');
process.exit(fail ? 1 : 0);
