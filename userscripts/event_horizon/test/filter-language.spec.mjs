import { test, check, until, functionSource } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

const ROWS = [
  { label: 'Parlophone', year: '2022', title: 'Live at the Hall' },
  { label: 'Parlophone', year: '2020', title: 'Rock and Roll' },
  { label: 'XL', year: '2023', title: 'Studio' },
  { label: 'Warp', year: '2024', title: 'Remixes' },
  { label: 'Warp', year: '', title: 'Abbey Road (Remixes)' },
];

// the positions of the rows a filter keeps, through the parser and the matcher the boxes use
async function matcher() {
  const src = await functionSource('event_horizon', ['fltFold', 'tqRange', 'tqParse', 'tqTest', 'tqHit']);
  const { tqParse, tqTest, tqHit } = new Function(`${src}; return { tqParse, tqTest, tqHit };`)();
  const keys = ['label', 'year', 'title'];
  return q => {
    const { tree } = tqParse(q, keys);
    return ROWS.flatMap((r, i) => tqTest(tree, n => tqHit(n, n.c == null ? r.title : r[keys[n.c]])) ? [i] : []).join('');
  };
}

test('the filter language: negation, ranges, AND, OR, brackets', { tag: '@unit' }, async () => {
  const keep = await matcher();
  const cases = {
    '': '01234',
    'label:par': '01',
    '-label:par': '234',
    '-label:par -label:warp': '2',
    'label:par OR label:xl': '012',
    'label:par label:xl': '',
    'year:2022-2023': '02',
    'year:2022-': '023',
    'year:-2022': '01',
    '-year:2022-2023': '134',    // a row with no year isn't in the range, so it isn't excluded
    '(label:par OR label:warp) AND (year:2022-2024)': '03',
    '(label:par OR label:warp) year:2022-2024': '03',
    'label:xl OR label:warp year:2024': '23',    // AND binds first
    '-(label:par OR label:xl)': '34',
    'rock and roll': '1',    // lowercase and is a word, words side by side are a phrase
    'roll rock': '',
    '"roll" "rock"': '1',
    'remixes -abbey': '3',
    'abbey road (remixes)': '4',
    // half typed
    'label:': '01234',
    '-label:': '01234',
    '(label:par': '01',
    'label:par)': '01',
    'label:par OR': '01',
    '(': '01234',
    'label:"par': '01',
    'year:2022-20': '023',    // the end still being typed
    'nokey:x': '',
  };
  for (const [q, want] of Object.entries(cases)) check(keep(q) === want, `"${q}" keeps ${want}, got ${keep(q)}`);
});

test('a date column keeps a date prefix as text', { tag: '@unit' }, async () => {
  const src = await functionSource('event_horizon', ['fltFold', 'tqRange']);
  const tqRange = new Function(`${src}; return tqRange;`)();
  check(tqRange('date', '2022-01') === null, 'date:2022-01 is text');
  check(tqRange('date', '2022-2024')?.join() === '2022,2024', 'date:2022-2024 is a range');
  check(tqRange('label', '2022-2024') === null, 'another column has no ranges');
});

test('the filter excludes in the discography', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/a74b1b7f-71a5-4011-9441-d0b5e4122711');
  await inject('event_horizon');
  const open = page.locator('[data-fopen="dg"]');
  await until(() => open.count(), n => n === 1);
  await until(() => page.locator('#s-dg tbody tr, #s-dg .dg-card, #s-dg li').count(), n => n > 5);
  await page.locator('#s-dg [data-dgview="table"]').click();
  await open.click();
  const count = () => page.locator('#s-dg .fn').first().textContent();
  const box = page.locator('[data-fq="dg"]');
  await box.fill('year:1990-1999');
  const some = await until(count, t => /^\d+ of/.test(t));
  const [kept, all] = some.match(/\d+/g).map(Number);
  check(kept > 0 && kept < all, `a range keeps some (${some})`);
  await box.fill('-year:1990-1999');
  const rest = await until(count, t => t !== some);
  check(+rest.match(/\d+/)[0] === all - kept, `its negation keeps the rest (${rest})`);
});
