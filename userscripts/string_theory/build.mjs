#!/usr/bin/env node
// Build "String Theory" — one installable userscript that bundles several of this
// repo's scripts, so a user can install a single file instead of many.
//
// Rebuilt automatically by the repo pre-commit hook whenever a constituent changes
// (same idea as discogs_credits' esbuild build). Run manually with:
//
//   node userscripts/string_theory/build.mjs
//
// It works because every script here is a self-contained IIFE that guards its own
// target URL internally: we only have to union the metadata block and wrap each
// body in a @run-at gate (document-start bodies run immediately; document-end/idle
// bodies wait for DOMContentLoaded).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { UI_JS } from '../../dev/ui/ui-components.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

// The bundled scripts are listed in members.txt (one folder per line, # comments) — edit that file to
// add/remove a member. The pre-commit hook watches it too, so it's the single source of truth.
const MEMBERS = readFileSync(resolve(HERE, 'members.txt'), 'utf8')
  .split(/\r?\n/).map(l => l.replace(/#.*/, '').trim()).filter(Boolean);
if (!MEMBERS.length) throw new Error('members.txt lists no scripts');
const NAME = 'String Theory';
// Embed the icon as a data URI, not a raw GitHub URL — managers render data: icons reliably (no network
// fetch, no content-type dependency), whereas the raw-URL icon didn't show up in the manager list.
// line endings as committed (LF): a Windows checkout has CRLF, and the icon then came out different
// from the one CI builds (#646)
const ICON = 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(resolve(HERE, 'icon.svg'), 'utf8').replace(/\r\n/g, '\n')).toString('base64');
const HOMEPAGE = 'https://github.com/majkinetor/musicbrainz-userscripts/tree/main/userscripts/string_theory';
const OUT = resolve(HERE, 'string_theory.user.js');

// prefer a built dist/, else the top-level single file
function distOf(n) {
  for (const rel of [`userscripts/${n}/dist/${n}.user.js`, `userscripts/${n}/${n}.user.js`]) {
    const f = resolve(ROOT, rel);
    try { readFileSync(f); return f; } catch (e) { /* try next */ }
  }
  throw new Error(`no build found for "${n}"`);
}

const META_RE = /\/\/ ==UserScript==\r?\n([\s\S]*?)\/\/ ==\/UserScript==\r?\n?/;
function parse(src, n) {
  const m = src.match(META_RE);
  if (!m) throw new Error(`no metadata block in ${n}`);
  const meta = [];
  for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^\/\/\s*@(\S+)(?:\s+(.*?))?\s*$/); if (kv) meta.push([kv[1], kv[2] || '']); }
  return { meta, body: src.slice(m.index + m[0].length).trim() };
}

const MULTI = new Set(['match', 'include', 'exclude', 'grant', 'connect', 'require', 'resource']);
const metaVal = (meta, k) => (meta.find(([kk]) => kk === k) || [])[1] || '';
const runAtOf = meta => metaVal(meta, 'run-at') || 'document-end';
const verOf = meta => metaVal(meta, 'version') || '0';
const cmpVer = (a, b) => { const pa = a.split('.').map(Number), pb = b.split('.').map(Number); for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; } return 0; };

const parts = MEMBERS.map(n => ({ n, ...parse(readFileSync(distOf(n), 'utf8'), n) }));
// Own build-stamp version (date + HHMMSS), like Credit Hoarder — always increases on rebuild, so a
// re-bundle after any constituent change ships as a newer version. (The newest constituent is logged.)
const _n = new Date(), _p = x => String(x).padStart(2, '0');
const version = `${_n.getFullYear()}.${_n.getMonth() + 1}.${_n.getDate()}.${_p(_n.getHours())}${_p(_n.getMinutes())}${_p(_n.getSeconds())}`;
const newestMember = parts.map(p => verOf(p.meta)).sort(cmpVer).at(-1);

// ── merged metadata ──────────────────────────────────────────────────────────
const out = [
  ['name', NAME],
  ['namespace', 'https://github.com/majkinetor/musicbrainz-userscripts'],
  ['version', version],
  ['description', `Unified bundle of ${MEMBERS.length} MusicBrainz userscripts (${MEMBERS.join(', ')}). Built by userscripts/string_theory/build.mjs — do not hand-edit.`],
  ['author', 'majkinetor'],
  ['icon', ICON],
  ['homepageURL', HOMEPAGE],
  ['run-at', 'document-start'],   // superset; document-end bodies are gated below
];
const seen = new Set();
for (const p of parts) for (const [k, v] of p.meta) {
  if (!MULTI.has(k)) continue;
  const id = `${k}\t${v}`;
  if (seen.has(id)) continue;
  seen.add(id);
  out.push([k, v]);
}
// the bundle's own grants: the on/off menu below (#693)
for (const g of ['GM_getValue', 'GM_setValue', 'GM_registerMenuCommand', 'GM_unregisterMenuCommand']) {
  if (!seen.has(`grant\t${g}`)) { seen.add(`grant\t${g}`); out.push(['grant', g]); }
}
const metaBlock = ['// ==UserScript==', ...out.map(([k, v]) => `// @${k.padEnd(12)} ${v}`.trimEnd()), '// ==/UserScript=='].join('\n');

// Per-script GM_info shadow: in a bundle the real GM_info.script carries String Theory's own name/
// version/homepage, so any script that builds a help link or edit-note attribution from GM_info would
// point at the bundle instead of itself. We shadow GM_info inside each script's scope with a copy whose
// .script fields come from that constituent's own metadata (inheriting scriptHandler etc. from the real one).
const single = (meta, k) => (meta.find(([kk]) => kk === k) || [])[1];
function scriptShadow(meta) {
  const m = {};
  // Always emit every identity field — value from the constituent, or explicit null — so a field the
  // constituent lacks (e.g. GT has no @homepageURL) OVERRIDES the bundle's rather than inheriting it.
  for (const k of ['name', 'namespace', 'version', 'description', 'author', 'homepage', 'homepageURL', 'supportURL', 'icon']) {
    const v = single(meta, k); m[k] = v == null ? null : v;
  }
  if (m.name) m.name += '*';   // mark bundle-run scripts (their edit-note signatures read GM_info.script.name)
  return JSON.stringify(m);
}

// ── bodies, each gated to its original @run-at, with a per-script GM_info shadow ──
const GATE_NOW = '(f=>f())';
const GATE_DOM = "(f=>document.readyState!=='loading'?f():document.addEventListener('DOMContentLoaded',f,{once:true}))";
const bodies = parts.map(p => {
  const runAt = runAtOf(p.meta);
  const gate = runAt === 'document-start' ? GATE_NOW : GATE_DOM;
  const shadow = scriptShadow(p.meta);
  return `// ===== ${p.n} (@run-at ${runAt}) ${'='.repeat(Math.max(0, 50 - p.n.length))}\n`
    + `if (__stOff.indexOf(${JSON.stringify(p.n)}) < 0) (function(__stGM){\n`
    + `  var GM_info = __stGM ? Object.assign({}, __stGM, { script: Object.assign({}, __stGM.script || {}, ${shadow}) }) : { script: ${shadow} };\n`
    // A member that throws while starting must not stop the members after it: ISRC Scout's
    // "Cannot access 'btnStatus' before initialization" kept Platform Check's panel away until
    // a reload (oblaka). The body stays in a function of its own, so its 'use strict' still counts.
    + `  ${gate}(function(){ try { (function(){\n${p.body}\n})(); } catch (e) { try { console.error('[String Theory] ${p.n} failed while starting — the other scripts carry on:', e); } catch (x) {} } });\n`
    + `})(typeof GM_info !== 'undefined' ? GM_info : undefined);`;
}).join('\n\n');

const banner = `// Auto-generated by userscripts/string_theory/build.mjs — do NOT edit by hand.\n// Bundles (verbatim, each wrapped in a run-at gate): ${MEMBERS.join(', ')}.\n`;
// Startup console banner: the bundle's own build version + every constituent's version, so the ACTUAL
// running versions are visible on every page load (useful when a manager reports one version but serves
// a cached copy). Runs at document-start, before the gated bodies.
const memberVers = parts.map(p => `${metaVal(p.meta, 'name')} v${verOf(p.meta)}`);
const startupLog = `try {\n  console.log('%c String Theory %c v${version} ', 'background:#7c5cff;color:#fff;font-weight:bold;border-radius:3px;padding:2px 6px', 'color:#7c5cff;font-weight:bold');\n  console.log(${JSON.stringify('String Theory bundles:\n' + memberVers.map(v => '  · ' + v).join('\n'))});\n} catch (e) {}`;
// Per-script on/off (#693): the manager's menu lists every member as ☑/☐; a click flips it and the
// change applies from the next page load. Each entry shows the member's version. The off list is the GM value OFF_KEY (folder names), read
// once here; an off member's body doesn't run, so its standalone copy (if installed) can claim the page.
// The menu goes only in the top frame, or a manager lists it again for every iframe.
const OFF_KEY = 'string_theory.off';
// The corner launchers' layout: a column (the default) or a row along the page's edge. It's a shared
// setting (mbuShared 'cornerFlow': the page's localStorage, which every script's mbRestackCorner reads,
// standalone copies too); the menu entry flips it and restacks the corners at once, with the same
// mbRestackCorner and mbuShared the members carry.
const SHARED = (UI_JS.match(/function mbuShared\(key, value\) \{[\s\S]*?\n\}\n/) || [])[0];
if (!SHARED) throw new Error('mbuShared not found in dev/ui/ui-components.mjs');
const RESTACK = (UI_JS.match(/function mbRestackCorner\(corner\) \{[\s\S]*?\n\}\n/) || [])[0];
if (!RESTACK) throw new Error('mbRestackCorner not found in dev/ui/ui-components.mjs');
const toggles = `function __stReadOff() { try { var v = GM_getValue(${JSON.stringify(OFF_KEY)}, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
var __stOff = __stReadOff();
(function () {
  if (typeof GM_registerMenuCommand !== 'function') return;
  try { if (window.top !== window.self) return; } catch (e) { return; }
  var members = ${JSON.stringify(parts.map(p => [p.n, metaVal(p.meta, 'name') || p.n, verOf(p.meta)]))};
  // Each entry carries a stable id (options.id): Violentmonkey and Tampermonkey then relabel it in
  // place, where it stands. Unregister-and-add left Violentmonkey's open menu with the old entry
  // still there and the new one appended at the end. A manager that ignores options.id hands back
  // an id of its own, and only then is the old entry unregistered.
  var ids = {};
  function put(id, caption, fn, title) {
    var got = GM_registerMenuCommand(caption, fn, { id: id, autoClose: false, title: title });
    if (ids[id] != null && ids[id] !== got && typeof GM_unregisterMenuCommand === 'function') { try { GM_unregisterMenuCommand(ids[id]); } catch (e) {} }
    ids[id] = got;
  }
  function draw() {
    var off = GM_getValue(${JSON.stringify(OFF_KEY)}, []);
    members.forEach(function (m) {
      var on = off.indexOf(m[0]) < 0;
      put('st-' + m[0], (on ? '☑ ' : '☐ ') + m[1] + ' v' + m[2], function () { flip(m[0]); },
        (on ? 'On' : 'Off') + ' — click to turn ' + (on ? 'off' : 'on') + '; applies from the next page load');
    });
    var row = mbuShared('cornerFlow') === 'row';
    put('st-flow', row ? '↔ Launchers in a row' : '↕ Launchers in a column', flipFlow,
      'The round launchers in the page corner — click to put them in a ' + (row ? 'column' : 'row'));
  }
  ${SHARED.replace(/\n/g, '\n  ').trimEnd()}
  ${RESTACK.replace(/\n/g, '\n  ').trimEnd()}
  function flipFlow() {
    mbuShared('cornerFlow', mbuShared('cornerFlow') === 'row' ? null : 'row');
    ['br', 'bl', 'tr', 'tl'].forEach(mbRestackCorner);
    draw();
  }
  function flip(key) {
    var off = GM_getValue(${JSON.stringify(OFF_KEY)}, []);
    if (!Array.isArray(off)) off = [];
    var i = off.indexOf(key);
    if (i < 0) off.push(key); else off.splice(i, 1);
    GM_setValue(${JSON.stringify(OFF_KEY)}, off);
    draw();
  }
  try { draw(); } catch (e) { try { console.error('[String Theory] menu failed:', e); } catch (x) {} }
})();
try { if (__stOff.length) console.log('String Theory: turned off in the manager menu — ' + __stOff.join(', ')); } catch (e) {}`;
writeFileSync(OUT, `${metaBlock}\n\n${banner}\n${startupLog}\n\n${toggles}\n\n${bodies}\n`);
console.log(`✓ ${NAME} v${version} → ${OUT}`);
console.log(`  ${MEMBERS.length} scripts (newest constituent v${newestMember}) · ${out.filter(([k]) => k === 'match').length} @match · ${out.filter(([k]) => k === 'grant').length} @grant · ${out.filter(([k]) => k === 'connect').length} @connect`);

// ── unified documentation (#403) ──────────────────────────────────────────────
// Concatenate every member's README into one DOCS.md, stamped with the build date.
// Each member README is written relative to ITS OWN folder, so links/images are
// re-pointed to `../<member>/…` to resolve from the string_theory folder, and its
// headings are demoted one level so the merged doc has a single H1 and each member
// is an H2. Code fences are left untouched (no heading/link rewriting inside them).
const DOCS_OUT = resolve(HERE, 'DOCS.md');
const buildDate = `${_n.getFullYear()}-${_p(_n.getMonth() + 1)}-${_p(_n.getDate())} ${_p(_n.getHours())}:${_p(_n.getMinutes())}`;
const stripImg    = s => s.replace(/<img[^>]*>/gi, '').replace(/\s{2,}/g, ' ').trim();
// GitHub's heading→anchor slug, and its collision suffixing (the 2nd "Features" → features-1, 3rd → features-2).
const ghSlug      = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-');   // \s (not \s+): GitHub does NOT collapse the gap a removed "&" / "/" leaves ("A & B" → a--b)
const makeSlugger = () => { const seen = new Map(); return t => { const b = ghSlug(t); const k = seen.get(b) || 0; seen.set(b, k + 1); return k ? `${b}-${k}` : b; }; };
// Apply fn to everything OUTSIDE fenced code blocks. Only a fence at line start (≤3-space
// indent) opens a block — an inline `` ``` `` in prose (e.g. Apollo's "fenced ``` ↔ code") is
// NOT a fence, so it can't mis-pair with a real block and swallow content.
function outsideCode(md, fn) {
  const FENCE = /^[ \t]{0,3}(```+|~~~+)[^\n]*\n[\s\S]*?^[ \t]{0,3}\1[^\n]*$/gm;
  let out = '', last = 0, m;
  while ((m = FENCE.exec(md)) !== null) {
    out += fn(md.slice(last, m.index)) + m[0];   // non-code, then the fenced block verbatim
    last = FENCE.lastIndex;
  }
  return out + fn(md.slice(last));
}
const demote      = md => md.replace(/^(#{1,6})(\s)/gm, (_m, h, s) => (h.length < 6 ? '#' + h : h) + s);
const fixPath     = (p, member) => /^(https?:|mailto:|#|\/|\.\.\/)/i.test(p) ? p : `../${member}/${p.replace(/^\.\//, '')}`;
const remapAnchor = (a, map) => (map[a] != null ? map[a] : a);   // in-member slug → doc-wide slug
function rewriteLinks(md, member, map) {
  return md
    .replace(/\]\((#[^)\s]+)(\s+[^)]*)?\)/g, (_m, a, t) => `](#${remapAnchor(a.slice(1), map)}${t || ''})`)   // ](#anchor) → doc-wide
    .replace(/\]\(([^)\s]+)(\s+[^)]*)?\)/g, (_m, p, t) => `](${fixPath(p, member)}${t || ''})`)                // ](path) → ../member/
    .replace(/\b(src|href)=("|')([^"']+)\2/gi, (_m, a, q, p) => `${a}=${q}${fixPath(p, member)}${q}`);          // html src/href
}
// Reference-style links (`[text][label]`, `[label]`, defined by `[label]: url`) have DOCUMENT-GLOBAL
// labels, so two members both defining `[Features]:` collide. Resolve each member's reference links to
// INLINE links from that member's own definitions (anchors remapped), then drop the definitions — so no
// reference labels survive to collide. Handles full [text][label], collapsed [text][], and shortcut [label].
function inlineRefs(md, member, map) {
  const defs = {};
  md = md.replace(/^[ \t]*\[([^\]]+)\]:[ \t]*(\S+)(?:[ \t]+.*)?$/gm, (_m, label, target) => {
    defs[label.trim().toLowerCase()] = target.startsWith('#') ? `#${remapAnchor(target.slice(1), map)}` : fixPath(target, member);
    return '';   // drop the definition line
  });
  const ref = (text, label) => { const d = defs[(label || text).trim().toLowerCase()]; return d != null ? `[${text}](${d})` : null; };
  return outsideCode(md, seg => seg
    .replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (m, text, label) => ref(text, label) ?? m)           // [text][label] / [text][]
    .replace(/(!?)\[([^\]]+)\](?![([:])/g, (m, bang, text) => (bang ? m : (ref(text, text) ?? m))));   // shortcut [label]
}

// One document-wide slugger, fed headings in render order so collision suffixes match GitHub's.
const gslug = makeSlugger();
gslug('String Theory — Unified Documentation');   // reserve the doc's own H1
gslug('Table of contents');
const sections = [];
for (const n of MEMBERS) {
  let md;
  try { md = readFileSync(resolve(ROOT, `userscripts/${n}/README.md`), 'utf8'); }
  catch (e) { console.warn(`  ⚠ no README for "${n}" — skipped in DOCS.md`); continue; }
  md = md.replace(/\r\n/g, '\n');
  const heads = [...md.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map(m => m[1]);
  const title = stripImg(heads[0] || n) || n;
  // map each in-member heading slug → its doc-wide slug (same heading order → 1:1 with the doc slugger)
  const localSlug = makeSlugger();
  const map = {};
  heads.forEach((h, i) => { map[localSlug(h)] = i === 0 ? gslug(title) : gslug(h); });   // H1 → the H2 title we emit
  md = md.replace(/^#\s+.+\n?/m, '');                       // drop the member's own H1
  md = inlineRefs(md, n, map);                              // ref-links → inline (whole-body: defs live at the bottom)
  const body = outsideCode(md, seg => rewriteLinks(demote(seg), n, map)).trim();
  sections.push({ title, slug: map[ghSlug(heads[0])], body });
}
const README_URL = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/string_theory/README.md';
const toc = sections.map((s, i) => `${i + 1}. [${s.title}](#${s.slug})`).join('\n');
const docHead =
`# String Theory — Unified Documentation

*Built ${buildDate} · [String Theory README ↗](${README_URL})*

## Table of contents

${toc}`;
const docBody = sections.map(s => `## ${s.title}\n\n${s.body}`).join('\n\n---\n\n');
const docFoot = `\n\n---\n\n*[String Theory](${README_URL}) — by majkinetor*\n`;
writeFileSync(DOCS_OUT, `${docHead}\n\n---\n\n${docBody}\n${docFoot}`);
console.log(`  docs → ${DOCS_OUT} (${sections.length} READMEs, built ${buildDate})`);
