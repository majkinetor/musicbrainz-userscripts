#!/usr/bin/env node
// Render the unified documentation (DOCS.md, produced by build.mjs) to DOCS.pdf.
//
// Kept SEPARATE from build.mjs (and out of the pre-commit hook) because it needs
// heavier tooling — `marked` (this folder's devDependency) for Markdown→HTML and
// a headless Chromium (reused from apollo_editor's Playwright, which already has
// the browser installed) for HTML→PDF. Run it on demand / before a release:
//
//   node userscripts/string_theory/build.mjs      # regenerate DOCS.md first
//   node userscripts/string_theory/build-pdf.mjs  # then DOCS.md → DOCS.pdf
//   (or:  pnpm --dir userscripts/string_theory docs:pdf)

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { marked } from 'marked';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const DOCS_MD  = resolve(HERE, 'DOCS.md');
const DOCS_PDF = resolve(HERE, 'DOCS.pdf');

// Reuse apollo_editor's Playwright (its Chromium is already installed) so this
// folder needs no second browser download.
const require = createRequire(resolve(ROOT, 'userscripts/apollo_editor/package.json'));
const { chromium } = require('playwright');

const md = readFileSync(DOCS_MD, 'utf8');
marked.setOptions({ gfm: true, breaks: false });
let bodyHtml = marked.parse(md);

// Make links clickable in the PDF:
// 1. add heading ids (marked adds none) — GitHub-accurate slug + collision suffix,
//    matching DOCS.md's anchors, so the TOC and cross-refs jump within the PDF;
// 2. rewrite the doc's relative `../<member>/…` LINKS to absolute GitHub URLs (a PDF
//    can't follow a repo-relative path). Image src stays relative so it embeds locally.
const ghSlug = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s/g, '-');
const makeSlugger = () => { const seen = new Map(); return t => { const b = ghSlug(t); const k = seen.get(b) || 0; seen.set(b, k + 1); return k ? `${b}-${k}` : b; }; };
const slug = makeSlugger();
bodyHtml = bodyHtml.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_m, d, inner) => `<h${d} id="${slug(inner.replace(/<[^>]+>/g, ''))}">${inner}</h${d}>`);
const GH_BLOB = 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/';
bodyHtml = bodyHtml.replace(/href="\.\.\/([^"#]+)"/g, (_m, p) => `href="${GH_BLOB}${p}"`);

// GitHub admonitions (`> [!NOTE] optional title`) — marked has no support, so it renders the
// literal `[!NOTE]` in a plain blockquote. Convert to a styled callout: pull the type + optional
// custom title off the blockquote's first line, and tag the blockquote with an `adm adm-<type>` class.
bodyHtml = bodyHtml.replace(
  /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*([^\n<]*)\n?/gi,
  (_m, type, title) => {
    const t = type.toLowerCase();
    const label = (title || '').trim() || (t[0].toUpperCase() + t.slice(1));
    return `<blockquote class="adm adm-${t}"><p class="adm-title">${label}</p><p>`;
  });

// Minimal GitHub-ish print stylesheet. Images in DOCS.md are `../<member>/…` — a
// temp HTML written INTO this folder makes those resolve to the real files.
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  :root { color-scheme: light; }
  body { font: 14px/1.6 -apple-system, "Segoe UI", Arial, sans-serif; color: #1f2328; max-width: 900px; margin: 0 auto; padding: 8px 16px; }
  h1, h2, h3, h4, h5 { font-weight: 600; line-height: 1.25; margin: 1.4em 0 .5em; }
  h1 { font-size: 1.9em; } h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
  h2 { page-break-before: always; } h1 + * ~ h2:first-of-type { page-break-before: auto; }
  h3 { font-size: 1.2em; } h4 { font-size: 1.05em; }
  h2, h3, h4 { page-break-after: avoid; }
  a { color: #0969da; text-decoration: none; }
  code { background: #eff1f3; border-radius: 6px; padding: .15em .4em; font: .88em ui-monospace, Consolas, monospace; }
  pre { background: #f6f8fa; border-radius: 6px; padding: 12px; overflow: auto; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  blockquote { margin: .6em 0; padding: .2em 1em; color: #57606a; border-left: 3px solid #d0d7de; background: #f6f8fa; }
  .adm { color: #1f2328; border-left-width: 4px; border-radius: 0 6px 6px 0; padding: 6px 14px; page-break-inside: avoid; }
  .adm .adm-title { font-weight: 700; margin: 2px 0 4px; }
  .adm p:last-child { margin-bottom: 2px; }
  .adm-note { border-left-color: #0969da; }      .adm-note .adm-title { color: #0969da; }
  .adm-tip { border-left-color: #1a7f37; }       .adm-tip .adm-title { color: #1a7f37; }
  .adm-important { border-left-color: #8250df; } .adm-important .adm-title { color: #8250df; }
  .adm-warning { border-left-color: #9a6700; }   .adm-warning .adm-title { color: #9a6700; }
  .adm-caution { border-left-color: #cf222e; }   .adm-caution .adm-title { color: #cf222e; }
  table { border-collapse: collapse; margin: .8em 0; font-size: .95em; page-break-inside: avoid; }
  th, td { border: 1px solid #d0d7de; padding: 5px 11px; }
  th { background: #f6f8fa; } tr:nth-child(2n) td { background: #f6f8fa; }
  img { max-width: 100%; height: auto; border: 1px solid #d0d7de; border-radius: 6px; page-break-inside: avoid; }
  hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
  ul, ol { padding-left: 1.6em; } li { margin: .15em 0; }
</style></head><body>${bodyHtml}</body></html>`;

const TMP = resolve(HERE, '.docs-print.html');
writeFileSync(TMP, html);
try {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(TMP).href, { waitUntil: 'networkidle' });
  await page.pdf({
    path: DOCS_PDF, format: 'A4', printBackground: true,
    margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#8a8a8a;text-align:center;">String Theory — Unified Documentation · <span class="pageNumber"></span>/<span class="totalPages"></span></div>',
  });
  await browser.close();
} finally {
  try { unlinkSync(TMP); } catch (e) { /* best effort */ }
}
console.log(`✓ DOCS.pdf → ${DOCS_PDF}`);
