// Lists every script's report verdict from a built report page, and the ones
// that differ from an earlier list.
// node verdicts.mjs <report.html> <out.json> [<earlier.json>]
import fs from 'node:fs';
const html = fs.readFileSync(process.argv[2], 'utf8');
const out = {};
for (const m of html.matchAll(/<details class="script" data-id="([^"]+)"><summary><span class="name">(.*?)<\/span>.*?<span class="baseline">(.*?)<\/span>/gs)) out[m[1]] = m[2].replace(/<[^>]+>/g, '') + ' | ' + m[3];
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1) + '\n');
if (process.argv[4]) {
  const old = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
  for (const k of Object.keys(out)) if (old[k] !== out[k]) console.log((old[k] || '(new)') + '  =>  ' + out[k]);
}
console.log(Object.keys(out).length + ' entries');
