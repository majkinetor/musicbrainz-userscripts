// The shared guess case's sort name (#843) gives MusicBrainz's own. mb-sortnames.json holds what
// MusicBrainz's Guess sort name button made of every name in sortnames.json on the artist edit page (a
// person, a group, no type) and the artist's, label's and place's add-alias pages; the @unit spec runs mbuGuessCase.sortName
// over the same and must match all of them.
//
// The @sandbox spec presses the button again in the sandbox and compares with the file: it catches
// MusicBrainz changing its sort names. SORTNAME_RECORD=1 writes the file from that run instead.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, check, requireLogin, SANDBOX } from '../test/harness.mjs';
import mbuGuessCase from './guess-case.mjs';

test.use({ gm: false });

const at = f => fileURLToPath(new URL(f, import.meta.url));
const NAMES = JSON.parse(readFileSync(at('sortnames.json'), 'utf8'));
const STORED = at('mb-sortnames.json');

// the runs: the artist's page with each type (MusicBrainz reorders all but a group's name), and
// the add-alias pages, where MusicBrainz never reorders an artist's name, a person's included
const AR = 'a74b1b7f-71a5-4011-9441-d0b5e4122711', LABEL = '46f0f4cd-8aab-4b33-b698-f459faf64190', PLACE = '4352063b-a833-421b-a420-e7fb295dece0';
const RUNS = [
  { entity: 'artist', type: '1' }, { entity: 'artist', type: '2' }, { entity: 'artist', type: '' },
  { entity: 'artist', alias: AR }, { entity: 'label', alias: LABEL }, { entity: 'place', alias: PLACE },
];
const label = r => r.entity + (r.alias ? ' alias' : ` · type ${r.type || 'none'}`);
const ours = (r, n) => mbuGuessCase.sortName(n, { entity: r.entity, isPerson: r.entity === 'artist' && !r.alias && r.type !== '2' });

test('the port gives MusicBrainz\'s sort name for every name', { tag: ['@unit', '@critical'] }, async () => {
  const stored = JSON.parse(readFileSync(STORED, 'utf8'));
  check(stored.runs.length === RUNS.length, `mb-sortnames.json has every run (${stored.runs.length} of ${RUNS.length})`);
  for (const run of stored.runs) {
    const diffs = [];
    NAMES.forEach((n, i) => {
      if (run.out[i] == null) return;
      const got = ours(run, n);
      if (got !== run.out[i]) diffs.push(`${JSON.stringify(n)} → MB ${JSON.stringify(run.out[i])}, ours ${JSON.stringify(got)}`);
    });
    check(!diffs.length, `${label(run)}: ${diffs.length} differ\n  ${diffs.slice(0, 20).join('\n  ')}`);
  }
});

test('MusicBrainz\'s own sort names still give what mb-sortnames.json holds', { tag: ['@sandbox', '@login'] }, async ({ page }) => {
  test.setTimeout(180_000);
  const runs = [];
  for (const run of RUNS) {
    await page.goto(run.alias ? `${SANDBOX}/${run.entity}/${run.alias}/add-alias` : `${SANDBOX}/${run.entity}/create`);
    await requireLogin(page);
    const p = run.alias ? 'id-edit-alias.' : `id-edit-${run.entity}.`;
    await page.waitForSelector(`[id="${p}sort_name"]`);
    await page.waitForSelector('button.guesscase-sortname');
    await page.waitForTimeout(1000);   // the add-alias form is React's: let it hydrate
    const out = await page.evaluate(async ({ names, run, p }) => {
      const name = document.getElementById(p + 'name'), sort = document.getElementById(p + 'sort_name');
      const btn = sort.parentElement.querySelector('button.guesscase-sortname');
      if (!run.alias) document.getElementById(p + 'type_id').value = run.type;
      // set the way typing does, so React's form state follows
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const put = (el, v) => { setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const tick = () => new Promise(r => setTimeout(r, 0));
      const out = [];
      for (const n of names) { put(name, n); put(sort, ''); await tick(); btn.click(); await tick(); out.push(sort.value); }
      return out;
    }, { names: NAMES, run, p });
    runs.push({ ...run, out });
  }
  if (process.env.SORTNAME_RECORD) {
    writeFileSync(STORED, JSON.stringify({ source: SANDBOX, recorded: new Date().toISOString().slice(0, 10), runs }, null, 0)
      .replace(/\{"entity"/g, '\n{"entity"') + '\n');
    console.log('recorded', runs.length, 'runs of', NAMES.length, 'names');
    return;
  }
  const stored = JSON.parse(readFileSync(STORED, 'utf8'));
  runs.forEach((run, k) => {
    const diffs = [];
    NAMES.forEach((n, i) => { if (run.out[i] !== stored.runs[k].out[i]) diffs.push(`${JSON.stringify(n)} → now ${JSON.stringify(run.out[i])}, stored ${JSON.stringify(stored.runs[k].out[i])}`); });
    check(!diffs.length, `${label(run)}: MusicBrainz changed ${diffs.length}\n  ${diffs.slice(0, 20).join('\n  ')}`);
  });
});
