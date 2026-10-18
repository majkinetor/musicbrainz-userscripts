// The shared guess case (#785) gives MusicBrainz's own results. mb-guesses.json holds what
// MusicBrainz's guess case made of every title in titles.json (real MusicBrainz titles,
// lowercased and uppercased copies, and hand-written edge cases), for the track and release
// handlers, in every mode and option; the @unit spec runs the port over the same and must
// match all of them.
//
// The @sandbox spec asks MusicBrainz again, in the sandbox's release editor (MB.releaseEditor's
// guessCaseTrackName / guessCaseMediumName preview, the mode and options in the cookies they
// read), and compares with the file: it catches MusicBrainz changing its guess case.
// GUESSCASE_RECORD=1 writes the file from that run instead.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, check, requireLogin, SANDBOX } from '../test/harness.mjs';
import mbuGuessCase from './guess-case.mjs';

test.use({ gm: false });

const at = f => fileURLToPath(new URL(f, import.meta.url));
const TITLES = JSON.parse(readFileSync(at('titles.json'), 'utf8'));
const GUESSES = at('mb-guesses.json');

// the runs: each handler in each mode, and the options against the defaults
const RUNS = [];
for (const entity of ['track', 'release']) {
  for (const mode of ['English', 'Sentence', 'French', 'Turkish']) RUNS.push({ entity, mode, keepUpperCase: true, romanUpper: false });
  RUNS.push({ entity, mode: 'English', keepUpperCase: false, romanUpper: false });
  RUNS.push({ entity, mode: 'English', keepUpperCase: true, romanUpper: true });
  RUNS.push({ entity, mode: 'Sentence', keepUpperCase: false, romanUpper: true });
}
const label = r => `${r.entity} · ${r.mode}${r.keepUpperCase ? '' : ' · lowercase caps'}${r.romanUpper ? ' · roman' : ''}`;

test('the port gives MusicBrainz\'s guess for every title, mode and option', { tag: ['@unit', '@critical'] }, async () => {
  const stored = JSON.parse(readFileSync(GUESSES, 'utf8'));
  check(stored.runs.length === RUNS.length, `mb-guesses.json has every run (${stored.runs.length} of ${RUNS.length})`);
  let compared = 0;
  for (const run of stored.runs) {
    const { out, ...opts } = run; opts.extras = false;
    const diffs = [];
    TITLES.forEach((t, i) => {
      if (out[i] == null) return;
      compared++;
      const ours = mbuGuessCase(t, opts);
      if (ours !== out[i]) diffs.push(`${JSON.stringify(t)} → MB ${JSON.stringify(out[i])}, ours ${JSON.stringify(ours)}`);
    });
    check(!diffs.length, `${label(run)}: ${diffs.length} differ\n  ${diffs.slice(0, 15).join('\n  ')}`);
  }
  check(compared >= TITLES.length * RUNS.length * 0.95, `compared ${compared} guesses`);
});

test('MusicBrainz\'s own guess case still gives what mb-guesses.json holds', { tag: ['@sandbox', '@login'] }, async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(SANDBOX + '/release/add');
  await requireLogin(page);
  await page.waitForFunction(() => window.MB && MB.releaseEditor && typeof MB.releaseEditor.guessCaseTrackName === 'function', null, { timeout: 60_000 });
  const runs = [];
  for (const run of RUNS) {
    const out = await page.evaluate(({ titles, run }) => {
      const set = (k, v) => { document.cookie = `${k}=${v}; path=/`; };
      set('guesscase_mode', run.mode);
      set('guesscase_keepuppercase', String(run.keepUpperCase));
      set('guesscase_roman', String(run.romanUpper));
      const ed = MB.releaseEditor;
      return titles.map(t => {
        let got = null;
        const obj = { name: { peek: () => t }, previewName: v => { got = v; } };
        try {
          if (run.entity === 'track') ed.guessCaseTrackName(obj, { type: 'mouseenter', buttons: 0 });
          else ed.guessCaseMediumName(obj, { type: 'mouseenter', buttons: 0 });
        } catch (e) { return null; }
        return got;
      });
    }, { titles: TITLES, run });
    runs.push({ ...run, out });
  }
  if (process.env.GUESSCASE_RECORD) {
    writeFileSync(GUESSES, JSON.stringify({ source: SANDBOX + '/release/add', recorded: new Date().toISOString().slice(0, 10), runs }, null, 0)
      .replace(/\{"entity"/g, '\n{"entity"') + '\n');
    console.log('recorded', runs.length, 'runs of', TITLES.length, 'titles');
    return;
  }
  const stored = JSON.parse(readFileSync(GUESSES, 'utf8'));
  runs.forEach((run, k) => {
    const diffs = [];
    TITLES.forEach((t, i) => { if (run.out[i] !== stored.runs[k].out[i]) diffs.push(`${JSON.stringify(t)} → now ${JSON.stringify(run.out[i])}, stored ${JSON.stringify(stored.runs[k].out[i])}`); });
    check(!diffs.length, `${label(run)}: MusicBrainz changed ${diffs.length}\n  ${diffs.slice(0, 15).join('\n  ')}`);
  });
});

test('our rules: version words in brackets, CamelCase, the language modes', { tag: ['@unit'] }, async () => {
  const cases = [
    ['Song [Official Music Video]', {}, 'Song [official music video]'],
    ['Song (Slowed + Reverb)', {}, 'Song (slowed + reverb)'],
    ['Song (SLOWED + REVERB)', {}, 'Song (SLOWED + REVERB)'],
    ['Song (SLOWED + REVERB)', { keepUpperCase: false }, 'Song (slowed + reverb)'],
    ['Song (Bootleg)', {}, 'Song (bootleg)'],
    ['Flip the switch', {}, 'Flip the Switch'],
    ['Song By KoRn', {}, 'Song by KoRn'],
    ['Song By KoRn', { keepUpperCase: false }, 'Song by Korn'],
    ['Song (feat. JoJo)', {}, 'Song (feat. JoJo)'],
    ['Song By KoRn', { extras: false }, 'Song by Korn'],
    ['ijsland en de ijzeren man', { language: 'nld' }, 'IJsland en de ijzeren man'],
    ['la casa de papel', { language: 'spa' }, 'La casa de papel'],
    ['la casa de papel', { language: 'deu' }, 'La casa de papel'],
    ['la casa de papel', {}, 'La Casa de Papel'],
    ['the beatles', { entity: 'artist', mode: 'Sentence' }, 'The beatles'],
    ['Rock', { entity: 'genre' }, 'rock'],
  ];
  for (const [t, o, want] of cases) {
    const got = mbuGuessCase(t, o);
    check(got === want, `${JSON.stringify(t)} ${JSON.stringify(o)} → ${JSON.stringify(want)} (got ${JSON.stringify(got)})`);
  }
  check(mbuGuessCase.modeFor(120) === 'English' && mbuGuessCase.modeFor('134') === 'French' && mbuGuessCase.modeFor(145) === 'Sentence' && mbuGuessCase.modeFor('fra') === 'French' && mbuGuessCase.modeFor('tur') === 'Turkish' && mbuGuessCase.modeFor('deu') === 'Sentence' && mbuGuessCase.modeFor() === 'English', 'modeFor: a language\'s own mode, else Sentence, English for none');
  check(mbuGuessCase.sortName('The Beatles', { entity: 'artist' }) === 'Beatles, The', 'sort name: a group');
  check(mbuGuessCase.sortName('John Smith', { entity: 'artist', isPerson: true }) === 'Smith, John', 'sort name: a person');
});
