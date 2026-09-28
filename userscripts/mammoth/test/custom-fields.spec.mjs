// Custom baby fields: in Settings → Fields, a CSS selector and a label pin Mammoth's
// field memory to any input. The row shows how many elements the selector matches, and
// marks an invalid selector.
//
// test.musicbrainz.org, nothing submitted: an artist edit page, with a field added for
// the disambiguation comment.
import { test, check, until, idle, requireLogin, SANDBOX } from '../../../dev/test/harness.mjs';

const ARTIST = '8f6bd1e4-fbe1-4f50-aa9b-94c450ec0f11';   // Portishead, on the sandbox
const TARGET = 'input[id="id-edit-artist.comment"]';
test.use({ gm: { name: 'Mammoth' } });

test('a custom field pins field memory to the input its selector matches', { tag: ['@sandbox', '@login', '@critical', '@flaky'] }, async ({ page, inject }) => {
  await page.goto(`${SANDBOX}/artist/${ARTIST}/edit`, { waitUntil: 'domcontentloaded' });
  await requireLogin(page);
  await idle(page);
  await inject('mammoth');

  await page.click('button[title="Settings"]');
  // MusicBrainz's form can keep growing after load and push the Settings button far
  // below the screen; the Fields tab then widened the window and re-placed it "above"
  // that button, off screen and out of reach. Grow the page here so it happens every run.
  await page.evaluate(() => { const d = document.createElement('div'); d.style.height = '3000px'; document.body.prepend(d); });
  await page.click('.mmth-cfgtab[data-tab="fields"]');
  check(await page.evaluate(() => { const r = document.querySelector('.mmth-cfg').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), 'the widened Settings window stays on screen');
  // a new row goes on top
  const typeInto = (cls, v) => page.evaluate(([cls, v]) => {
    const inp = document.querySelector('.mmth-cf-row ' + cls);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inp, v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }, [cls, v]);
  const counter = () => page.evaluate(() => { const c = document.querySelector('.mmth-cf-row .mmth-cf-cnt'); return { text: c.textContent, title: c.title, bad: c.classList.contains('mmth-cf-bad') }; });

  await page.click('.mmth-cf-add');
  await typeInto('.mmth-cf-match', TARGET);
  await typeInto('.mmth-cf-label', 'My field');
  const good = await until(counter, c => c.text === '1');   // the refresh is debounced
  check(good.text === '1', `the row says the selector matches one element (${JSON.stringify(good)})`);

  await page.click('.mmth-cf-add');
  await typeInto('.mmth-cf-match', 'input[[');
  const bad = await until(counter, c => c.bad);
  check(bad.bad && /invalid/i.test(bad.title), `an invalid selector is marked (${JSON.stringify(bad)})`);

  // close Settings, then look at the field (a pin is parked while its field is off screen)
  await page.keyboard.press('Escape');
  await page.evaluate(sel => document.querySelector(sel).scrollIntoView({ block: 'center' }), TARGET);
  const r = await until(() => page.evaluate(sel => {
    const el = document.querySelector(sel), er = el.getBoundingClientRect();
    const pins = [...document.querySelectorAll('.mmthf-pin')];
    const near = pins.find(p => { const pr = p.getBoundingClientRect(); return Math.abs(pr.top - er.top) < 30 && pr.left > er.left && pr.left < er.right + 40; });
    return {
      pinned: el.dataset.mmthf === '1', near: !!near, title: near ? near.title : '',
      field: { t: Math.round(er.top), l: Math.round(er.left), r: Math.round(er.right) },
      pins: near ? undefined : pins.map(p => { const pr = p.getBoundingClientRect(); return { t: Math.round(pr.top), l: Math.round(pr.left), title: p.title }; }),
    };
  }, TARGET), r => r.pinned && r.near);
  check(r.pinned && r.near, `a pin sits in the comment input (${JSON.stringify(r)})`);
  check(/My field/.test(r.title), `the pin carries the label ("${r.title}")`);
});
