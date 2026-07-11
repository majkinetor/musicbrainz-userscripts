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
const bodyHtml = marked.parse(md);

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
