// Round 4 (#680): one header row. The release's title and artist take Probe's place (Probe and Auto
// go to ⚙, ↻ re-probes), the steps move into the header, aligned on one line, and the footer goes:
// its count, Dry run and Execute join the header (A) or stay as one slim line without the order text (B).
//   node dev/mockups/mission_control/round4/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, '../../../../userscripts/mission_control/mission_control.user.js'), 'utf8');
const ICON = JSON.parse(src.match(/const PROVIDER_ICONS = (\{[\s\S]*?\n\});/)[1].replace(/,\s*\}$/, '}'));

const AFTER = { pc: ['ok', 'nothing new', '✓'], is: ['add', '3 links to add', '3'], as: ['add', '2 new', '2'], fusion: ['ok', 'nothing new', '✓'], ch: ['ok', '0 credits found', '✓'] };
const MID = { pc: ['ok', 'nothing new', '✓'], is: ['busy', 'links: Bandcamp · 8 s', ''], as: ['stalled', 'no word for 41 s · finding the best cover', '!'], fusion: ['wait', 'waits for Fetch RG', ''], ch: ['wait', 'not probed', ''] };
const NAME = { pc: 'PC', is: 'IS', as: 'AS', fusion: 'Fusion', ch: 'CH' };
const step = (id, s) => `<span class="st ${s[0]}" title="${NAME[id]} — ${s[1]}"><span class="ring"><img alt="" src="${ICON[id]}">${s[2] ? `<sup>${s[2]}</sup>` : ''}</span><span class="tx"><b>${NAME[id]}</b><i>${s[1]}</i></span></span>`;
const steps = S => `<div class="steps"><button class="re" title="Probe again (⚙ has Auto probe)">↻</button>${step('pc', S.pc)}<span class="ar">→</span><span class="par">${step('is', S.is)}${step('as', S.as)}</span><span class="ar">→</span>${step('fusion', S.fusion)}<span class="ar">→</span>${step('ch', S.ch)}</div>`;
const title = `<div class="rel"><b title="Discret Lounge">Discret Lounge</b><span title="Fingers in the Noise">Fingers in the Noise</span></div>`;
const actions = n => `<div class="act"><span class="cnt"><b>${n}</b> changes</span><button class="btn">Dry run</button><button class="btn pri">Execute →</button></div>`;
const tail = `<button class="ic" title="Settings">⚙</button><button class="ic" title="Close">✕</button>`;
const tracks = `<div class="body"><div class="card"><div class="ch"><span class="sq">≡</span><b>Tracks</b> <span class="dim">one row per track · a column per provider</span></div>
<table><tr><th>#</th><th>Title</th><th>Len</th><th>ISRC · IS</th><th>Rec links · IS</th><th>RG duplicates · Fusion</th><th>Credits · CH</th></tr>
${['Organics Chords|5:56', 'Axiometry|4:56', 'TreeBeat|4:17', 'Aluminium Chords|5:19', 'Optimum Trajectory|6:54'].map((r, i) => { const [t, l] = r.split('|'); return `<tr><td class="dim">${i + 1}</td><td>${t}</td><td>${l}</td><td>none found</td><td>${i % 3 === 2 ? '<span class="bc"></span>' : '<span class="pk">+ <span class="bc"></span></span>'}</td><td>—</td><td>—</td></tr>`; }).join('')}</table></div></div>`;
const frameA = S => `<div class="mc"><header class="hdr">${title}${steps(S)}${actions(5)}${tail}</header>${tracks}</div>`;
const frameB = S => `<div class="mc"><header class="hdr">${title}${steps(S)}<span class="sp"></span>${tail}</header>${tracks}<footer class="ft"><span class="cnt"><b>5</b> changes</span><span class="sp"></span><button class="btn">Dry run</button><button class="btn pri">Execute →</button></footer></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>MC header — round 4</title><style>
:root{--bg:#fff;--sunk:#f4f2f9;--raised:#faf9fe;--text:#222;--dim:#555;--weak:#999;--border:#cfc6e6;--div:#eee;--strong:#9a8ccb;--acc:#5f3ec0;--acc-soft:#ece4ff;--ok:#1f8a5e;--warn:#a05a00;--warn-bg:#fff7e6;--info:#2f7fbf;--info-b:#a9c8e6}
body{margin:0;padding:24px 28px;font:14px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--text);background:#f7f6fb}
h1{font-size:18px;margin:0 0 4px}.sub{color:var(--dim);margin:0 0 18px;max-width:1100px}h2{font-size:15px;margin:22px 0 4px}h2+p{margin:0 0 10px;color:var(--dim);font-size:13px}.k{color:var(--weak);font-size:12px;margin:10px 0 4px}
.mc{width:1400px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#f5f4f9}
.hdr{display:flex;align-items:center;gap:14px;height:52px;padding:0 10px 0 16px;background:var(--bg);border-bottom:1px solid var(--border);box-shadow:0 1px 5px rgba(60,40,110,.07)}
.rel{display:flex;flex-direction:column;min-width:0;max-width:230px;flex:0 1 230px;line-height:1.2}.rel b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rel span{font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.steps{display:flex;align-items:center;gap:6px;flex:1 1 auto;min-width:0;justify-content:center}
.re{border:1px solid var(--border);background:var(--bg);color:var(--dim);border-radius:50%;width:26px;height:26px;font-size:14px;line-height:1;cursor:pointer;flex:none;margin-right:4px}
.st{display:inline-flex;align-items:center;gap:7px;min-width:0;flex:0 1 auto;height:36px;padding:0 4px}
.ring{position:relative;flex:none;width:28px;height:28px;border-radius:50%;border:2px solid var(--border);box-sizing:border-box;display:grid;place-items:center;background:var(--bg)}
.ring img{width:16px;height:16px;object-fit:contain;display:block}
.ring sup{position:absolute;right:-7px;top:-6px;min-width:15px;height:15px;padding:0 3px;box-sizing:border-box;border-radius:8px;background:var(--acc);color:#fff;font-size:10px;font-weight:700;line-height:15px;text-align:center}
.tx{display:flex;flex-direction:column;min-width:0;line-height:1.2}.tx b{font-size:12.5px}.tx i{font-style:normal;font-size:11.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.st.ok .ring{border-color:var(--ok)}.st.ok sup{background:var(--ok)}.st.add .ring{border-color:var(--acc)}.st.add i{color:var(--acc);font-weight:600}
.st.busy .ring{border-color:var(--info-b);border-top-color:var(--info);border-left-color:var(--info)}.st.busy i{color:var(--info)}
.st.stalled .ring{border-color:var(--warn);background:var(--warn-bg)}.st.stalled sup{background:var(--warn)}.st.stalled i,.st.stalled b{color:var(--warn)}
.st.wait .ring{border-style:dashed}.st.wait b{color:var(--weak)}
.ar{color:var(--weak);flex:none}.par{display:inline-flex;align-items:center;gap:4px;height:40px;padding:0 6px;border:1px dashed var(--border);border-radius:10px;box-sizing:border-box;min-width:0}
.act{display:flex;align-items:center;gap:8px;flex:none}.cnt{font-size:13px;color:var(--dim);white-space:nowrap}.cnt b{color:var(--text);font-size:14px}
.btn{font:600 13px inherit;padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer;white-space:nowrap}.btn.pri{background:var(--acc);border-color:var(--acc);color:#fff;padding:6px 14px}
.ic{border:none;background:none;color:var(--dim);font-size:15px;width:28px;height:28px;cursor:pointer;flex:none}.sp{flex:1}
.body{padding:12px 14px}.card{background:var(--bg);border:1px solid var(--border);border-radius:10px;overflow:hidden}.ch{display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--raised);border-bottom:1px solid var(--div)}.sq{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;background:var(--acc-soft);font-size:12px}
.dim{color:var(--weak);font-size:13px}table{width:100%;border-collapse:collapse;font-size:13.5px}th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);padding:8px 14px;border-bottom:1px solid var(--div)}td{padding:7px 14px;border-bottom:1px solid var(--div)}
.pk{display:inline-flex;align-items:center;gap:3px;border:1px solid var(--strong);background:var(--acc-soft);border-radius:6px;padding:1px 7px;color:var(--acc);font-weight:700}.bc{display:inline-block;width:13px;height:9px;background:#3e8ea4;transform:skewX(-20deg);border-radius:1px}
.ft{display:flex;align-items:center;gap:8px;height:44px;padding:0 14px;background:var(--bg);border-top:1px solid var(--border)}
</style></head><body>
<h1>Mission Control: one header row, round 4</h1>
<p class="sub">#680. Title and artist take Probe's place (two tight lines, cut with … when long; the cover is the one below). Probe and Auto move to ⚙: Auto probe there, ↻ before the steps probes again. The steps move into the header: ring, then name and state beside it, all on one centre line, the icon centred in its ring; IS ∥ AS keep their dashed box at the same height. The order line under "5 changes" goes (the steps show the order).</p>
<h2>A · No footer: the count, Dry run and Execute join the header</h2><p>Gains the whole footer. The header gets full; at a narrower window the state words are cut first (the full text is in each step's tooltip).</p>
<div class="k">after the probe</div>${frameA(AFTER)}
<div class="k">mid-probe (IS busy, AS stuck)</div>${frameA(MID)}
<h2>B · A one-line footer for the count, Dry run and Execute</h2><p>Keeps Execute in the bottom-right corner, where it is now; the footer is a single 44 px line without the order text.</p>
<div class="k">after the probe</div>${frameB(AFTER)}
<div class="k">mid-probe</div>${frameB(MID)}
</body></html>`;
writeFileSync(resolve(HERE, 'header.html'), html);
console.log('header.html');
