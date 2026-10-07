// Round 5 (#680): the Release and entity links card grouped by barcode. Today each withheld row
// repeats its barcode in a chip and again in "barcode … differs from the release's"; grouping puts
// the barcode, the reason and a take-all-in once on a group head, and the rows under it.
// Icons and tokens come from the script, so the mock matches it.
//   node dev/mockups/mission_control/round5/build.mjs   (writes barcodes.html; barcodes.png via Playwright)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(HERE, '../../../../userscripts/mission_control/mission_control.user.js'), 'utf8');
const ST_ICONS = JSON.parse(src.match(/^const ST_ICONS = (\{.*\});$/m)[1]);
const icon = (k, n = 16) => (ST_ICONS[k] ? ST_ICONS[k].svg.replace(/<svg\b([^>]*)>/, (m, a) => '<svg' + a.replace(/\s(?:width|height)="[^"]*"/g, '') + ` width="${n}" height="${n}">`) : '');

// the release from the screenshot: Eddie Harris, For Bird and Bags
const REL = '099923855521';
const LINKS = [
    { k: 'bandcamp', n: 'Bandcamp', u: 'eddieharrismusic.bandcamp.com/album/for-bird-and-bags', bc: '0730167335256' },
    { k: 'apple', n: 'Apple', u: 'music.apple.com/us/album/for-bird-and-bags/1868545067' },
    { k: 'deezer', n: 'Deezer', u: 'deezer.com/album/291098232', bc: '730167335256' },
    { k: 'tidal', n: 'Tidal', u: 'tidal.com/album/214316433', bc: '730167335256' },
    { k: 'hdtracks', n: 'HDtracks', u: 'hdtracks.com', bc: '730167335256' },
    { k: 'soundcloud', n: 'SoundCloud', u: 'soundcloud.com/eddieharris-scmusic/sets/for-bird-and-bags', bc: '730167335256' },
    { k: 'ytmusic', n: 'YouTube Music', u: 'music.youtube.com/playlist' },
    { k: 'amazonmusic', n: 'Amazon Music', u: 'music.amazon.com/albums/B0BDXYR29M' },
    { k: 'sevendigital', n: '7digital', u: 'uk.7digital.com/artist/eddie-harris/release/for-bird-and-bags-29606751', bc: '0730167335256' },
];
const norm = b => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
const OTHER = '730167335256', OTHER_SHOW = '0730167335256'; // shown as its EAN-13 form; the 12-digit UPC is the same code
const other = LINKS.filter(x => norm(x.bc) === OTHER), unknown = LINKS.filter(x => !x.bc);
const PICKED = new Set(['tidal', 'deezer']); // a couple taken in, to show the group's partial state

const chip = (b, c, extra = '') => `<span class="bc" style="--bc:${c}"${extra}>${b}</span>`;
const pill = (cls, t) => `<span class="pill ${cls}">${t}</span>`;
const hdr = (right = '') => `<div class="sh"><span class="sq">${'((•))'}</span><b class="t">Release and entity links</b><span class="end">${icon('discogs', 14)}<span class="pdiv"></span>${icon('discogs', 14)}${icon('deezer', 14)}${icon('ytmusic', 14)}<span class="lk">✓ 4</span></span>${right}</div>`;
const master = on => `<div class="ln pick${on ? ' on' : ''}"><span class="tk">${on ? '✓' : ''}</span>${icon('discogs')}<div class="lt"><div class="tt">Discogs master</div><div class="s">discogs.com/master/669461</div><div class="s">for the release group</div></div>${pill('add', 'new')}</div>`;
const row = (x, why) => { const on = PICKED.has(x.k); return `<div class="ln pick in${on ? ' on' : ''}"><span class="tk">${on ? '✓' : ''}</span>${icon(x.k)}<div class="lt"><div class="tt">${x.n}</div><div class="s">${x.u}</div>${why ? `<div class="s">${why}</div>` : ''}</div>${x.bc && x.bc !== OTHER_SHOW && norm(x.bc) === OTHER ? '<span class="as" title="The same code without its leading 0 (UPC-A vs EAN-13)">as ' + x.bc + '</span>' : '<span></span>'}</div>`; };

// A — a group head per barcode; rows under it lose their chip, their reason and their pill
const groupHead = (lead, title, sub, n, picked, cls = '') => `<div class="gh ${cls}"><span class="tri">▾</span>${lead}<div class="gt"><b>${title}</b><span>${sub}</span></div><span class="gn">${n}</span>`
    + `<button class="all" title="Take every link in this group in, or leave them all out">${picked === n ? '✓ all taken in' : picked ? `${picked} of ${n} · take all` : 'take all in'}</button>${pill('warn', 'withheld')}</div>`;
const varA = `<div class="card">${hdr(`<span class="hbc">${chip(REL, 'var(--mbu-ok)')}</span><span class="pill ok mb">MB</span>`)}
${master(true)}
<div class="gh rel"><span class="tri">▾</span>${chip(REL, 'var(--mbu-ok)')}<div class="gt"><b>The release's barcode</b><span>no platform found it</span></div><span class="gn">0</span><span></span><span></span></div>
${groupHead(chip(OTHER_SHOW, '#2563eb'), 'Another barcode', "differs from the release's · may be another edition", other.length, other.filter(x => PICKED.has(x.k)).length)}
${other.map(x => row(x)).join('')}
${groupHead(`<span class="bc none">?</span>`, 'Barcode not confirmed', "the platform doesn't give one", unknown.length, 0, 'unk')}
${unknown.map(x => row(x)).join('')}
<div class="hint">ⓘ 6 of 9 platforms agree on <b>${OTHER_SHOW}</b> and none has the release's <b>${REL}</b>: likely a different (digital) edition. Leave them out here and add that edition as its own release, or take a group in if the release's barcode is the wrong one.</div>
</div>`;

// B — one line per barcode: the chip, the group's platforms as icons (each a toggle), its count
// and take-all; ▸ opens the group into rows as in A. Nine rows become three lines.
const lane = (lead, title, xs, cls = '', open = false) => {
    const picked = xs.filter(x => PICKED.has(x.k)).length;
    return `<div class="lane ${cls}"><span class="tri">${open ? '▾' : '▸'}</span>${lead}<div class="gt"><b>${title}</b></div>`
        + `<span class="icons">${xs.map(x => `<span class="ti${PICKED.has(x.k) ? ' on' : ''}" title="${x.n} — ${x.u}">${icon(x.k, 18)}</span>`).join('')}</span>`
        + `<button class="all">${picked === xs.length ? '✓ all' : picked ? `${picked} of ${xs.length} · take all` : 'take all in'}</button>${pill('warn', 'withheld')}</div>`
        + (open ? xs.map(x => row(x)).join('') : '');
};
const varB = `<div class="card">${hdr(`<span class="hbc">${chip(REL, 'var(--mbu-ok)')}</span><span class="pill ok mb">MB</span>`)}
${master(true)}
${lane(chip(OTHER_SHOW, '#2563eb'), "not the release's", other)}
${lane('<span class="bc none">?</span>', 'not confirmed', unknown, 'unk')}
<div class="hint">ⓘ 6 of 9 platforms agree on <b>${OTHER_SHOW}</b>; none has the release's <b>${REL}</b>. Likely a different edition.</div>
</div>`;
const varBOpen = `<div class="card">${hdr(`<span class="hbc">${chip(REL, 'var(--mbu-ok)')}</span><span class="pill ok mb">MB</span>`)}
${master(true)}
${lane(chip(OTHER_SHOW, '#2563eb'), "not the release's", other, '', true)}
${lane('<span class="bc none">?</span>', 'not confirmed', unknown, 'unk')}
</div>`;

// today, for comparison
const today = `<div class="card">${hdr(`<span class="hbc">${chip(REL, 'var(--mbu-ok)')}</span><span class="pill ok mb">MB</span>`)}${master(true)}`
    + LINKS.map(x => `<div class="ln pick old"><span class="tk"></span>${icon(x.k)}<div class="lt"><div class="tt">${x.n}</div><div class="s">${x.u}</div><div class="s">${x.bc ? `barcode ${x.bc} differs from the release's` : 'barcode not confirmed'}</div></div><span class="bccol">${x.bc ? chip(x.bc, '#2563eb') : ''}</span>${pill('warn', 'withheld')}</div>`).join('') + '</div>';

const tokens = src.match(/^const MBU_TOKENS = '(.*)';$/m)[1].replace(/\\'/g, "'");
const html = `<!doctype html><html><head><meta charset="utf-8"><title>MC links by barcode — round 5</title><style>${tokens}
body{margin:0;padding:24px 28px;font:14px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:var(--mbu-text);background:#f7f6fb}
h1{font-size:18px;margin:0 0 4px}.sub{color:var(--mbu-text-dim,#555);margin:0 0 18px;max-width:1100px}h2{font-size:15px;margin:26px 0 4px}h2+p{margin:0 0 10px;color:#555;font-size:13px;max-width:900px}
.row{display:flex;gap:28px;align-items:flex-start;flex-wrap:wrap}.col{flex:0 0 640px}.k{color:#999;font-size:12px;margin:0 0 4px}
.card{width:640px;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:10px;overflow:hidden;font-size:12px}
.sh{display:grid;grid-template-columns:22px max-content 1fr 130px 60px;gap:8px;align-items:center;padding:8px 10px;background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-divider)}
.sq{font-size:9px;color:#c00;font-weight:700}.sh .t{font-size:13px}.end{display:flex;align-items:center;gap:4px;justify-content:flex-end;opacity:.8}.pdiv{width:1px;height:14px;background:var(--mbu-border);margin:0 2px}.lk{color:var(--mbu-ok);font-weight:700;margin-left:4px}.hbc{text-align:right}.mb{justify-self:end}
.bc{display:inline-block;font:600 12px/1.5 ui-monospace,Consolas,monospace;color:var(--bc);background:color-mix(in srgb,var(--bc) 12%,transparent);border:1px solid color-mix(in srgb,var(--bc) 45%,transparent);border-radius:5px;padding:1px 6px;white-space:nowrap}
.bc.none{--bc:var(--mbu-text-weak);font-weight:700;min-width:12px;text-align:center}
.pill{font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;white-space:nowrap;border:1px solid var(--mbu-border)}.pill.add{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong)}.pill.ok{color:var(--mbu-ok);background:var(--mbu-ok-bg);border-color:var(--mbu-ok-border)}.pill.warn{color:var(--mbu-warn);background:var(--mbu-warn-bg);border-color:var(--mbu-warn-border)}
.ln{display:grid;grid-template-columns:16px 16px 1fr auto;gap:8px;align-items:center;padding:4px 10px;border-bottom:1px solid var(--mbu-divider);cursor:pointer}.ln.old{grid-template-columns:16px 16px 1fr 130px 60px}.ln.old .pill,.bccol{justify-self:end}
.ln.in{padding-left:34px}.ln:hover{background:var(--mbu-bg-hover)}.ln.on{background:var(--mbu-accent-soft);box-shadow:inset 3px 0 0 var(--mbu-accent)}.tk{color:var(--mbu-accent);font-weight:700}
.lt{min-width:0}.tt{font-size:12px}.s{font-size:10.5px;color:var(--mbu-text-weak);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.as{font:10.5px ui-monospace,Consolas,monospace;color:var(--mbu-text-weak)}
.gh,.lane{display:grid;grid-template-columns:12px auto 1fr auto auto auto;gap:8px;align-items:center;padding:6px 10px;background:var(--mbu-bg-sunken);border-bottom:1px solid var(--mbu-divider)}
.lane{grid-template-columns:12px max-content max-content 1fr auto auto;background:var(--mbu-bg)}.lane .gt b{white-space:nowrap}.tri{color:var(--mbu-text-weak);font-size:10px;cursor:pointer}
.gt{display:flex;flex-direction:column;line-height:1.25;min-width:0}.gt b{font-size:12px}.gt span{font-size:10.5px;color:var(--mbu-text-weak)}
.gn{font-size:11px;font-weight:700;color:var(--mbu-text-weak);background:var(--mbu-bg);border:1px solid var(--mbu-divider);border-radius:10px;padding:0 6px}
.gh.rel{opacity:.7}.gh.rel .gt b{color:var(--mbu-ok)}
.all{font:600 11px inherit;padding:2px 9px;border-radius:12px;border:1px solid var(--mbu-border-strong);background:var(--mbu-bg);color:var(--mbu-accent-text);cursor:pointer;white-space:nowrap}
.icons{display:flex;gap:3px;justify-content:flex-start}.ti{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;border:1px solid transparent;opacity:.6;cursor:pointer}.ti.on{opacity:1;border-color:var(--mbu-accent);background:var(--mbu-accent-soft)}
.hint{padding:7px 10px;font-size:11.5px;color:var(--mbu-text-dim,#555);background:var(--mbu-bg-raised);border-top:1px solid var(--mbu-divider)}
ul{margin:6px 0 0;padding-left:18px;font-size:13px;color:#444;max-width:1300px}li{margin:2px 0}
</style></head><body>
<h1>Mission Control: links grouped by barcode, round 5</h1>
<p class="sub">#680. Today every withheld row repeats its barcode twice (the chip and "barcode … differs from the release's") and nine rows say the same two things. Grouping states the barcode, the reason and the choice once per group. 730167335256 and 0730167335256 are one code (UPC-A vs EAN-13); PC already compares them that way, so they share a group.</p>
<h2>A · Group heads: a head per barcode, the rows under it</h2>
<p>Order: what isn't barcode-bound (the Discogs master), then the release's barcode (green; here no platform has it), each other barcode by group size, then "not confirmed". A head has the chip, the reason, a count and <b>take all in</b> (shows <i>2 of 6</i> when part is taken); ▾ folds the group. Rows drop their chip, reason line and pill; a row whose barcode is written differently keeps a small <i>as 730167335256</i>. A hint under the card says what the groups suggest.</p>
<div class="row"><div class="col"><div class="k">today</div>${today}</div><div class="col"><div class="k">A · grouped (2 of 6 taken in)</div>${varA}</div></div>
<h2>B · Lanes: one line per barcode, platforms as icons</h2>
<p>Denser: a group is one line, its platforms icons that toggle one by one (tooltip has the link), plus take all in. ▸ opens a lane into A's rows when you want the URLs. Nine rows become two lines.</p>
<div class="row"><div class="col"><div class="k">B · closed</div>${varB}</div><div class="col"><div class="k">B · first lane opened</div>${varBOpen}</div></div>
<h2>Notes</h2><ul>
<li>A group whose barcode <b>matches</b> the release's never shows withheld: those rows are <i>new</i> and pre-ticked as today; the green head is just a divider.</li>
<li>"Not confirmed" can split later if a platform reports a barcode on a second probe; the row then moves to its group.</li>
<li>Artist and label links stay in their own sub-section below; they have no barcode.</li>
<li>Out of scope (per #680): splitting the release per barcode. The hint only says so; Fusion / First Contact would do that.</li></ul>
</body></html>`;
writeFileSync(resolve(HERE, 'barcodes.html'), html);
try {
    const { chromium } = await import('playwright');
    const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1400, height: 900 } });
    await p.goto('file://' + resolve(HERE, 'barcodes.html'));
    await p.screenshot({ path: resolve(HERE, 'barcodes.png'), fullPage: true });
    await b.close();
} catch (e) { console.log('no png: ' + e.message); }
