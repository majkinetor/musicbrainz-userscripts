import { test, expect, pristine, requireLogin, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('your own edit accepts a note without voting permission', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org');
  await requireLogin(page);
  const { mbid } = await pristine(page, 'artist');
  await page.goto(`https://test.musicbrainz.org/artist/${mbid}/edits`);
  const href = await page.locator('.edit-header h2 a').first().getAttribute('href');
  await page.goto('https://test.musicbrainz.org' + href);
  await idle(page);
  await expect(page.locator('.voteopts')).toHaveCount(0);
  await expect(page.locator('textarea[name$=".edit_note"]')).toBeVisible();
  await inject('event_horizon');
  const edit = page.locator('#app .hed.one');
  await expect(edit.locator('.hnadd textarea')).toBeVisible();
  await inject('mammoth');
  await expect(edit.locator('.hnadd .mmth-wrap textarea')).toBeVisible();
  await expect(edit.locator('.hvote')).toHaveCount(0);
  await expect(edit.locator('.hwho')).toContainText('majkinetor');
  const note = 'Own-edit note regression ' + Date.now();
  await edit.locator('.hnadd textarea').fill(note);
  await page.screenshot({ path: 'dev/_mammoth-edit-note.png', fullPage: true });
  await edit.locator('.hnadd > button[type="submit"]').click();
  await expect(edit.locator('.hnote').last()).toContainText(note);
  await page.goto('https://test.musicbrainz.org' + href);
  await expect(page.locator('.edit-notes')).toContainText(note);
});
