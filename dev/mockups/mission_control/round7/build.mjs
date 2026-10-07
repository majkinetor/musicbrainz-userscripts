// Round 7 (#680): a card's background shows its provider's status, the same colours as its step in
// the top bar: add (purple), ok (green), waiting (none), busy (blue), stalled (amber), error (red), off.
// The dashboard is the real one (a stand-in PC and AS, the real CH), snapshotted into dash.parts.json
// by a throwaway spec. Three ways to show it: Header · Whole card · Stripe. A card's header click
// cycles its status, to see them all.
//   node dev/mockups/mission_control/round7/build.mjs   (writes status.html; shot.mjs takes the PNGs)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { css, root } = JSON.parse(readFileSync(resolve(HERE, 'dash.parts.json'), 'utf8'));
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card status colours</title>
<style>${css}</style>
<style>
body{margin:0;background:#f4f4f6}
/* the status colours: the step bar's */
#mc-root .mc-sect[data-st]{--st:transparent;--st-bg:transparent}
#mc-root .mc-sect[data-st="add"]{--st:var(--mbu-accent);--st-bg:var(--mbu-accent-soft)}
#mc-root .mc-sect[data-st="ok"]{--st:var(--mbu-ok);--st-bg:var(--mbu-ok-bg)}
#mc-root .mc-sect[data-st="busy"]{--st:var(--mbu-info);--st-bg:var(--mbu-info-bg)}
#mc-root .mc-sect[data-st="stalled"]{--st:var(--mbu-warn);--st-bg:var(--mbu-warn-bg)}
#mc-root .mc-sect[data-st="err"]{--st:var(--mbu-error);--st-bg:var(--mbu-error-bg)}
#mc-root .mc-sect[data-st="off"]{--st:var(--mbu-text-weak);--st-bg:var(--mbu-bg-sunken)}
/* A · header: the header band takes the colour, a darker line under it */
body.v-head #mc-root .mc-sect[data-st] > .mc-sect-h{background:var(--st-bg);border-bottom-color:color-mix(in srgb,var(--st) 35%,transparent)}
/* B · whole card: the card and its rows take the colour, the border its full colour */
body.v-card #mc-root .mc-sect[data-st]{background:var(--st-bg);border-color:color-mix(in srgb,var(--st) 45%,transparent)}
body.v-card #mc-root .mc-sect[data-st] > *, body.v-card #mc-root .mc-sect[data-st] .mc-line:not(.on){background:transparent}
/* C · stripe: a 4px edge in the full colour, the header lightly tinted */
body.v-stripe #mc-root .mc-sect[data-st]{box-shadow:inset 4px 0 0 var(--st)}
body.v-stripe #mc-root .mc-sect[data-st] > .mc-sect-h{background:var(--st-bg)}
#mc-root .mc-sect[data-st] > .mc-sect-h{cursor:pointer}
.st-tag{margin-left:8px;font:600 10.5px system-ui;letter-spacing:.04em;text-transform:uppercase;color:var(--st);opacity:.9}
#mock-bar{position:fixed;z-index:2147483647;left:50%;bottom:16px;transform:translateX(-50%);display:flex;gap:4px;padding:5px;background:#222;border-radius:10px;box-shadow:0 4px 18px #0005;font:600 13px system-ui}
#mock-bar button{border:0;border-radius:7px;padding:7px 14px;font:inherit;background:none;color:#ccc;cursor:pointer}
#mock-bar button.on{background:#7c5cff;color:#fff}
#mock-bar span{color:#888;padding:7px 6px 7px 10px;font-weight:400}
</style>
<body class="v-head">
${root}
<div id="mock-bar"><button data-v="head" class="on">Header</button><button data-v="card">Whole card</button><button data-v="stripe">Stripe</button><button data-v="none">Today</button><span>click a card's header to cycle its status</span></div>
<script>
const CYCLE = ['add', 'ok', 'wait', 'busy', 'stalled', 'err', 'off'];
// each card takes its provider's state from the step bar (the Tracks card has no single provider)
document.querySelectorAll('#mc-root .mc-sect[data-sect]').forEach(s => {
  const step = document.querySelector('#mc-root .mc-step[data-step="' + s.dataset.sect + '"]'); if (!step) return;
  s.dataset.st = CYCLE.find(c => step.classList.contains(c)) || 'wait';
  const h = s.querySelector('.mc-sect-h'), tag = document.createElement('span'); tag.className = 'st-tag';
  h.querySelector('.mc-icsw') ? h.querySelector('.mc-icsw').after(tag) : h.append(tag);
  const show = () => tag.textContent = s.dataset.st === 'wait' ? '' : s.dataset.st;
  show();
  h.addEventListener('click', e => { if (e.target.closest('a,button:not(.mc-icsw)')) return; e.preventDefault(); e.stopPropagation(); s.dataset.st = CYCLE[(CYCLE.indexOf(s.dataset.st) + 1) % CYCLE.length]; show(); }, true);
});
document.getElementById('mock-bar').onclick = e => {
  const v = e.target.dataset && e.target.dataset.v; if (!v) return;
  document.body.className = 'v-' + v;
  document.querySelectorAll('#mock-bar button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
};
</script>`;
writeFileSync(resolve(HERE, 'status.html'), html);
console.log('wrote status.html');
