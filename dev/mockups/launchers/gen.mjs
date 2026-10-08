// Corner launchers: the round buttons Mission Control, Fusion and Falcon stack in the bottom-right corner, today with
// their old glyphs (◎, ⚛, a stroke rocket) and with each script's own icon in place of the glyph, at a few sizes.
// Writes preview.html (light and dark page).
//   node dev/mockups/launchers/gen.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url)), root = join(dir, '../../..');
const uri = s => 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(join(root, 'userscripts', s, 'icon.svg'))).toString('base64');
const ROCKET = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 C15 5 16 9.5 16 13.5 L8 13.5 C8 9.5 9 5 12 2 Z"/><path d="M8 13.5 L5 19 L8.6 16.6 Z"/><path d="M16 13.5 L19 19 L15.4 16.6 Z"/><circle cx="12" cy="8.2" r="1.5" fill="currentColor" stroke="none"/><path d="M9.6 13.5 L9 19 L12 22 L15 19 L14.4 13.5 Z"/></svg>';
// top to bottom, as they stack: Mission Control (order 40), Fusion (30), Falcon (20)
const S = [['mission_control', 'Mission Control', '◎', 'accent'], ['fusion', 'Fusion', '⚛', 'accent'], ['falcon', 'Falcon', ROCKET, 'info']];
const glyph = ([, t, g, c]) => `<button class="l" title="${t}" style="color:var(--${c})"><span style="font-size:22px;line-height:1;display:flex">${g}</span></button>`;
const icon = z => ([s, t]) => `<button class="l" title="${t}"><img src="${uri(s)}" width="${z}" height="${z}" alt=""></button>`;
const bare = z => ([s, t]) => `<button class="l bare" title="${t}"><img src="${uri(s)}" width="${z}" height="${z}" alt=""></button>`;
const V = [['A · today, the glyphs', glyph], ['B · own icon, 24px', icon(24)], ['C · own icon, 28px', icon(28)], ['D · own icon, 32px', icon(32)], ['E · own icon 34px, no disc', bare(34)]];
const col = ([t, f]) => `<figure><figcaption>${t}</figcaption><div class="stack">${S.map(f).join('')}</div></figure>`;
const sec = cls => `<section class="${cls}">${V.map(col).join('')}</section>`;
writeFileSync(join(dir, 'preview.html'), `<!doctype html><meta charset="utf-8"><title>Corner launchers</title>
<style>body{margin:0;font:13px system-ui,sans-serif}section{display:flex;gap:28px;padding:22px 26px}
.light{background:#fff;color:#222;--bg:#fff;--accent:#5b3fc4;--info:#2f6fb0}.dark{background:#2b2b2b;color:#ddd;--bg:#1e1e24;--accent:#b9a8ec;--info:#7fb2e5}
figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:12px;width:150px}.stack{display:flex;flex-direction:column;gap:10px}
.l{width:40px;height:40px;border-radius:50%;border:none;padding:0;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--bg) 55%,transparent);box-shadow:0 2px 8px rgba(0,0,0,.18);opacity:.85}
.l.bare{background:none;box-shadow:none;opacity:1}.l img{display:block}</style>
${sec('light')}${sec('dark')}\n`);
console.log('wrote preview.html');
