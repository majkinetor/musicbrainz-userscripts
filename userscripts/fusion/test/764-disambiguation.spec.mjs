// #764 (chaban-mb): "These recordings are not the same but this is not very obvious due to
// disambiguations not being shown."
//
// Read-only on test.musicbrainz.org: Fusion opened on a recording with a disambiguation shows it
// after the title, in brackets, as MusicBrainz does.
import { test, check, until, mbJson, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Fusion' } });

const REC = 'effa9b02-4c08-4ea7-b136-cea70acd5b67';   // James Taylor, "You Make It Easy" (live)

test("a recording's disambiguation shows after its title", { tag: ['@sandbox'] }, async ({ page, inject }) => {
  const want = (await mbJson(`${SANDBOX}/ws/2/recording/${REC}?fmt=json`)).disambiguation;
  test.skip(!want, 'the sandbox recording has no disambiguation any more');
  await page.goto(`${SANDBOX}/recording/${REC}`, { waitUntil: 'domcontentloaded' });
  await inject('fusion', { waitFor: '__fusion' });
  await page.evaluate(() => window.__fusion.openFusion());
  const got = await until(() => page.evaluate(gid => {
    const a = document.querySelector(`.fs-t a[href$="/recording/${gid}"]`);
    const dis = a && a.parentElement.querySelector('.fs-dis');
    return dis && { text: dis.textContent, tip: a.parentElement.dataset.tip };
  }, REC), Boolean, { timeout: 45000 });
  console.log('shown: ' + JSON.stringify(got));
  check(got && got.text === '(' + want + ')', `the title is followed by "(${want})" (shown ${got && got.text})`);
  check(got && got.tip.includes('(' + want + ')'), 'the tooltip carries it too');   // #789: then live and the place
});
