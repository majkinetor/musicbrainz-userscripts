// Every platform icon side by side, on white and on dark, to check a new or changed mark against the set.
// Writes dev/ui/platform-icons.html and, with --png, a screenshot of it (platform-icons.png).
//   node dev/ui/preview-icons.mjs [--png]
import fs from 'fs';
import { PLATFORM_ICONS } from './platform-icons.mjs';

const dir = new URL('.', import.meta.url);
const cell = ([k, v]) => `<div class="c">${v.svg.replace('<svg', '<svg width="40" height="40"')}${v.svg.replace('<svg', '<svg width="16" height="16"')}<span>${k}</span></div>`;
const panel = (bg, fg) => `<div class="p" style="background:${bg};color:${fg};--mbu-text:${fg};--mbu-bg:${bg}">${Object.entries(PLATFORM_ICONS).map(cell).join('')}</div>`;
const html = `<!doctype html><meta charset="utf-8"><title>Platform icons</title>
<style>body{margin:0;font:11px sans-serif}.p{padding:8px}.c{display:inline-flex;flex-direction:column;align-items:center;gap:4px;width:92px;margin:6px}</style>
${panel('#fff', '#222')}${panel('#1e1e1e', '#ddd')}`;
const out = new URL('platform-icons.html', dir);
fs.writeFileSync(out, html);
console.log(`${Object.keys(PLATFORM_ICONS).length} icons → dev/ui/platform-icons.html`);

if (process.argv.includes('--png')) {
    const { chromium } = await import('@playwright/test');
    const br = await chromium.launch();
    const p = await br.newPage({ viewport: { width: 1100, height: 400 } });
    await p.goto(out.href);
    await p.screenshot({ path: new URL('platform-icons.png', dir).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
    await br.close();
    console.log('→ dev/ui/platform-icons.png');
}
