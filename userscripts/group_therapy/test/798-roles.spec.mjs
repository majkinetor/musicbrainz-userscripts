// #798 (majkinetor): "lyrics by not recognized. Propose general solution" — a role
// text the link-type names miss is matched word by word against MusicBrainz's own
// phrases and the synonyms, only among the credit's kind's roles; a tie is offered
// on the chip; a role you pick is remembered for its text. The picker opens with
// Suggested and the credit's kind first, every role tagged with its kind.
import { test, check, until, frames } from '../../../dev/test/harness.mjs';
import { openRelEditor, blockEdits } from './gt.mjs';

test.use({ gm: { name: 'Group Therapy', persist: true } });

const LINES = [
  ['Lyrics by: Ann Aa', 'lyricist'],
  ['All music written by: Bob Bb', 'composer'],
  ['Words and music by: Cid Cc', 'writer'],
  ['Production by: Dan Dd', 'production'],
  ['Mixed by: Eve Ee', 'mix'],
  ['Arrangement by: Gus Gg', 'arranger'],
  ['Cover photo: Hal Hh', 'photography'],
  ['Press and communication office: Fay Ff', null],
];

test('the text parser: roles by MusicBrainz\'s phrases, picks remembered, the picker by kind', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  test.setTimeout(300000);
  const posts = await blockEdits(page);
  const open = async (text) => {
    await openRelEditor(page, inject);
    await page.click('.gt-clone-btn:has-text("Text parser")');
    await page.fill('.gt-tp-ta', text);
    await page.dispatchEvent('.gt-tp-ta', 'input');
    await until(() => page.evaluate(() => !document.querySelector('.gt-tp-busy').textContent && !/Matching…/.test(document.querySelector('.gt-tp').innerText) && !!document.querySelector('.gt-tp-erow')), Boolean, { timeout: 120000 });
    await page.locator('.gt-tp-ename').first().click();   // out of the paste box
    await frames(page);
  };
  const roleOf = (line) => page.evaluate(line => {
    const tr = [...document.querySelectorAll('.gt-tp-erow')].find(t => (t.querySelector('.gt-tp-line .gt-tp-raw') || {}).value === line);
    const b = tr && tr.querySelector('.gt-tp-role-pick');
    return b ? { text: b.textContent, miss: !!b.closest('.gt-tp-role-miss') } : null;
  }, line);

  await open(LINES.map(l => l[0]).join('\n'));
  for (const [line, want] of LINES) {
    const got = await roleOf(line);
    if (want) check(got && !got.miss && got.text === want, `“${line}” → ${want} (${JSON.stringify(got)})`);
    else check(got && got.miss, `“${line}” is left to pick (${JSON.stringify(got)})`);
  }

  // the picker for the one left: the credit's kind in the header, its roles first,
  // every role tagged with its kind, other kinds under a divider
  const pressIdx = await page.evaluate(() => [...document.querySelectorAll('.gt-tp-erow')].findIndex(t => /^Press/.test((t.querySelector('.gt-tp-line .gt-tp-raw') || {}).value || '')));
  const press = page.locator('.gt-tp-erow').nth(pressIdx);
  await press.locator('.gt-tp-role-pick').click();
  await page.waitForSelector('.gt-role-pick .gt-role-row');
  const pk = await page.evaluate(() => ({
    sub: (document.querySelector('.gt-role-pick .gt-role-sub') || {}).textContent,
    secs: [...document.querySelectorAll('.gt-role-pick .gt-role-sec')].map(s => s.textContent),
    firstKind: (document.querySelector('.gt-role-pick .gt-role-row .gt-role-kind') || {}).textContent,
    otherDim: !!document.querySelector('.gt-role-pick .gt-role-other .gt-role-kind'),
    rows: document.querySelectorAll('.gt-role-pick .gt-role-row').length,
  }));
  console.log('picker: ' + JSON.stringify(pk));
  check(pk.sub === 'artist · on the release', `the header names the credit's kind (${pk.sub})`);
  check(pk.rows > 20, `a role text that matches nothing shows every role, not "no role matches" (${pk.rows})`);
  check(pk.firstKind === 'artist' && pk.secs.includes('For a label') && pk.secs.includes('For a place') && pk.otherDim, `the artist's roles first, the others below, dimmed and tagged (${JSON.stringify(pk.secs)})`);
  await page.fill('.gt-role-pick .gt-role-search', 'publish');
  await frames(page);
  const picked = await page.locator('.gt-role-pick .gt-role-row:not(.gt-role-other) .gt-role-name').first().evaluate(n => n.firstChild.textContent);
  await page.locator('.gt-role-pick .gt-role-row:not(.gt-role-other)').first().click();
  await frames(page);
  check((await roleOf(LINES[7][0])).text === picked, `the pick sets the role (${picked})`);

  // remembered: the same text on a reload resolves by itself, as your pick
  await open(LINES[7][0]);
  const again = await roleOf(LINES[7][0]);
  const tip = await page.getAttribute('.gt-tp-role-pick', 'data-tip');
  check(again && !again.miss && again.text === picked && /your pick/.test(tip), `the role text resolves to your pick next time (${JSON.stringify(again)} · ${tip})`);

  // "I choosed published label here and it didn't change it": a role of another
  // kind makes the credit that kind, and that kind is searched
  await open('Publisher: Fanzines Editions');
  await page.locator('.gt-tp-role-pick').first().click();
  await page.waitForSelector('.gt-role-pick .gt-role-row');
  await page.fill('.gt-role-pick .gt-role-search', 'published');
  await frames(page);
  await page.locator('.gt-role-pick .gt-role-row.gt-role-other').first().click();
  await until(() => page.evaluate(() => ({ kind: (document.querySelector('.gt-tp-ekind') || {}).textContent, role: (document.querySelector('.gt-tp-role-pick') || {}).textContent, sel: (document.querySelector('.gt-tp-esrch-kind') || {}).value })), v => v.kind === 'label', { timeout: 30000 }).catch(() => {});
  const pub = await page.evaluate(() => ({ kind: (document.querySelector('.gt-tp-ekind') || {}).textContent, role: (document.querySelector('.gt-tp-role-pick') || {}).textContent, sel: (document.querySelector('.gt-tp-esrch-kind') || {}).value }));
  check(pub.kind === 'label' && pub.role === 'published' && pub.sel === 'label', `a label's role makes the credit a label (${JSON.stringify(pub)})`);

  check(posts.length === 0, `nothing was submitted (${posts.length})`);
});
