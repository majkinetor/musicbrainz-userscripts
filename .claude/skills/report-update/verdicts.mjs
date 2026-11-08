// Lists every script's report verdict from a built report page, and the ones
// that differ from an earlier list.
// node verdicts.mjs <report.html> <out.json> [<earlier.json>]
// The verdict is read from the row select's first option (data-report="<n> · <label>"),
// or from the older row's <span class="baseline">.
import fs from 'node:fs';
const html = fs.readFileSync(process.argv[2], 'utf8');
const out = {};
for (const row of html.split('<details class="script" data-id="').slice(1)) {
  const id = row.slice(0, row.indexOf('"'));
  const name = row.match(/<span class="name">(.*?)<\/span>/s)?.[1].replace(/<[^>]+>/g, '');
  const verdict = row.match(/data-report="(?:\d+ · )?([^"]*)"/)?.[1] ?? row.match(/<span class="baseline">(.*?)<\/span>/s)?.[1];
  if (name !== undefined) out[id] = name + ' | ' + verdict;
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1) + '\n');
if (process.argv[4]) {
  const old = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
  for (const k of Object.keys(out)) if (old[k] !== out[k]) console.log((old[k] || '(new)') + '  =>  ' + out[k]);
}
console.log(Object.keys(out).length + ' entries');
