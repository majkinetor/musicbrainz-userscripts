// majkinetor: "When CH is invoked with 'All', if one provider has no credits,
// once the right status bar shows 'No importable credits' it stops there and no
// new status messages are shown, although preflight continues."
//
// `_setStopMessage` is a RUN-level verdict — it sets `bar._stopActive`, and
// `_setProgress` then refuses to write any further status so the reason a run
// stopped survives (#216). Correct when the provider IS the run; wrong under
// "All", where it is one of several and the merge plus the whole preflight still
// follow. His screenshot is exactly that: the bar frozen on "No importable
// credits found" while the log beneath it reads "Checking artists against
// MusicBrainz… 19/34 done".
//
// LIMITS OF THIS TEST, stated rather than papered over: the bar is built when a
// run starts, and a run needs live providers, so there is no cheap way to drive
// the real element here. What is checked instead is structural — that no
// provider can set a run-level verdict any more, that the two verdicts which
// genuinely are run-level still do, and that #216's guard is still in place so
// this fix did not simply delete the behaviour it protects. It would not catch a
// regression that reintroduced the freeze by some other route.
//
// No browser, no network.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = process.env.CH_SRC || resolve(HERE, '..', 'src', 'ui-bar.js');
const src = await readFile(SRC, 'utf8');
let fail = 0; const ck = (c, m) => { console.log((c ? 'ok  : ' : 'FAIL: ') + m); if (!c) fail++; };

// Every provider verdict routes through the guard…
const guarded = (src.match(/stopMsg\(collect,/g) || []).length;
ck(guarded >= 9, `every provider verdict goes through the collect guard (${guarded} call sites)`);

// …and `collect` really is a parameter of the function each one sits in. A guard
// reading an undefined name would throw at runtime, and `node --check` does not
// see that.
const lines = src.split('\n');
let scopeOk = 0, scopeBad = [];
lines.forEach((ln, i) => {
  if (!ln.includes('stopMsg(collect')) return;
  for (let j = i; j >= 0 && j > i - 160; j--) {
    const m = lines[j].match(/(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
    if (!m) continue;
    if (/\bcollect\b/.test(m[2])) scopeOk++; else scopeBad.push(`line ${i + 1} in ${m[1]}(${m[2]})`);
    return;
  }
  scopeBad.push(`line ${i + 1}: no enclosing function found`);
});
ck(scopeBad.length === 0, `collect is in scope at each of them (${scopeOk} ok${scopeBad.length ? '; bad: ' + scopeBad.join(', ') : ''})`);

// The two that ARE run-level keep saying it unconditionally: after the merge
// ("no credits from any source") and in the pipeline ("nothing to review").
const ungated = lines.filter(l => /_setStopMessage\?\.\(/.test(l) && !l.includes('const stopMsg'));
ck(ungated.length === 2, `exactly two ungated run-level verdicts remain (${ungated.length})`);
ck(ungated.some(l => l.includes('no credits from any source')), 'one of them is the post-merge "no credits from any source"');
ck(ungated.some(l => l.includes('Nothing to import')), 'the other is the pipeline\'s "nothing to review"');

// #216 must survive: a verdict, once set, still blocks later progress writes.
// Deleting that guard would "fix" his report by breaking the thing it protects.
ck(/_stopActive\s*=\s*!!msg/.test(src), '#216 still records a verdict (_stopActive)');
ck(/!bar\._stopActive/.test(src), '#216 still blocks progress writes once a verdict is set');

// And the per-run reset is still there, so a verdict never leaks into the next run.
ck(/_setStopMessage\('''?\)/.test(src) || src.includes("_setStopMessage('')"), 'a new run clears any prior verdict');

console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
