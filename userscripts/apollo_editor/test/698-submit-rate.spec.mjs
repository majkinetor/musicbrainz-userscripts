// #698: while MusicBrainz submits the release edit, Apollo shows the upload rate after
// MB's own "Submitting edits..." in the Enter edit screen: which part is going out,
// how many edits are in, the bytes and their rate, and the time.
//
// The editor sends its edits as a chain of POSTs to /ws/js/edit/create. Each is held
// here until the line has been read: the first (the release) is answered as saved, the
// second (the mediums) is failed, so nothing reaches the sandbox. A failed submit takes
// MB's message away, and a retry counts from nothing again.
import { test, check, until } from '../../../dev/test/harness.mjs';
import { openApollo, apolloGm } from './ap.mjs';

test.use({ gm: apolloGm(), pageErrors: 'ignore' });
const REL = '89efad71-65d2-4f96-bc55-d69ad147bae2';

test('the submit line follows each request, and starts over on a retry', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  const held = [];
  await page.route(/\/ws\/js\/edit\/create/, r => { held.push(r); });
  await openApollo(page, inject, { release: REL, submit: true });
  // a release edit and a medium edit: two requests
  await page.evaluate(() => { const r = MB.releaseEditor.rootField.release(); r.comment(r.comment() + ' #698'); const t = r.mediums()[0].tracks()[0]; t.name(t.name() + ' #698'); });
  await page.evaluate(() => document.querySelector('#release-editor a[href="#edit-note"]').click());
  await page.fill('#edit-note-text', 'Apollo #698 spec (never sent)');
  const line = () => page.evaluate(() => document.querySelector('.loading-message .tc-subrate')?.textContent || '');
  const submit = () => page.evaluate(() => document.querySelector('#tc-nav-wiz [data-wiz="enter"]').click());

  await submit();
  let t = await until(line, s => /release/.test(s));
  check(/^— (uploading|saving) release · 0 of 2 edits · .*\d+(\.\d+)? (B|KB)\b.* · 0:\d\d$/.test(t), `the release goes out first, 0 of 2 in: "${t}"`);

  await until(() => held.length, n => n === 1);
  await held.shift().fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ edits: [{ response: 1, edit_type: 32 }] }) });
  t = await until(line, s => /mediums/.test(s));
  check(/(uploading|saving) mediums · 1 of 2 edits · .*(sent|of)/.test(t), `then the mediums, 1 of 2 in: "${t}"`);

  await until(() => held.length, n => n === 1);
  await held.shift().abort();
  const gone = await until(() => page.evaluate(() => !document.querySelector('.loading-message')), Boolean);
  check(gone, 'a failed submit takes MB\'s message, and the line with it, away');

  // the release edit counted as saved; the retry sends only the mediums, counted from 0
  await until(() => page.evaluate(() => MB.releaseEditor.allowsSubmission()), Boolean);
  await submit();
  t = await until(line, s => /mediums/.test(s));
  check(/mediums · 0 of 1 edits/.test(t), `a retry counts from nothing: "${t}"`);
  await until(() => held.length, n => n === 1);
  await held.shift().abort();
});
