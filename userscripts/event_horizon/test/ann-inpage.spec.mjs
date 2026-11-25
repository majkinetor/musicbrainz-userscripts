import { test, expect, idle } from '../../../dev/test/harness.mjs';
import { RELEASE } from '../../art_station/test/as.mjs';

test.use({ gm: { name: 'Event Horizon' } });

// From a release's overview Edit annotation opens in the tab, without a page load (the player plays on), and Apollo
// builds its editor on the fetched form; Back returns to the overview and takes the editor's page styles with it.
test('the annotation editor opens from the overview without a page load', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/release/${RELEASE}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  await inject('apollo_editor');
  await expect(page.locator('#app')).toBeVisible();
  await page.evaluate(() => { window.__stay = 1; });
  const tab = () => page.locator(`#app a[href$="/release/${RELEASE}/edit_annotation"]`).first();
  await tab().evaluate(a => a.click());
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}/edit_annotation$`));
  await expect(page.locator('#eh-anno #tc-anno-wrap')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#eh-anno #tc-anno-submit')).toBeVisible();
  expect(await page.locator('#eh-anno form').first().evaluate(f => f.action)).toMatch(new RegExp(`/release/${RELEASE}/edit_annotation$`));
  expect(await page.evaluate(() => window.__stay)).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/release/${RELEASE}(#.*)?$`));
  await expect(page.locator('#eh-anno')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('tc-anno-page'))).toBe(false);
  await tab().evaluate(a => a.click());
  await expect(page.locator('#eh-anno #tc-anno-wrap')).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => window.__stay)).toBe(1);
  await page.screenshot({ path: process.env.SHOT || 'ann.png' });
});

// #1085 moved another entity's Annotation into the tab too: Apollo must be asked to build its editor there as well
const LABEL = 'b4d3280a-184b-4a22-bc08-158052450d38';
test("a label's annotation editor opens in the tab with Apollo's editor", { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/label/${LABEL}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  await inject('apollo_editor');
  await expect(page.locator('#app')).toBeVisible();
  await page.evaluate(() => { window.__stay = 1; });
  await page.locator(`#app a[href$="/label/${LABEL}/edit_annotation"]`).first().evaluate(a => a.click());
  await expect(page).toHaveURL(new RegExp(`/label/${LABEL}/edit_annotation$`));
  await expect(page.locator('#eh-anno #tc-anno-wrap')).toBeVisible({ timeout: 30000 });
  expect(await page.evaluate(() => window.__stay)).toBe(1);
});

// Enter edit posts the annotation in the background and opens the label's page in the tab: no page load, so the player plays on
test("Enter edit on a label's annotation opens the label in the tab without a page load", { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(`https://test.musicbrainz.org/label/${LABEL}`, { waitUntil: 'domcontentloaded' });
  await idle(page);
  await inject('event_horizon');
  await inject('apollo_editor');
  await expect(page.locator('#app')).toBeVisible();
  await page.evaluate(() => { window.__stay = 1; });
  await page.locator(`#app a[href$="/label/${LABEL}/edit_annotation"]`).first().evaluate(a => a.click());
  await expect(page.locator('#eh-anno #tc-anno-submit')).toBeVisible({ timeout: 30000 });
  const text = 'EH test annotation ' + Date.now();
  await page.locator('#eh-anno textarea[name="edit-annotation.text"]').evaluate((t, v) => { t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); }, text);
  await page.locator('#eh-anno #tc-anno-submit').click();
  await expect(page).toHaveURL(new RegExp(`/label/${LABEL}/?$`), { timeout: 30000 });
  await expect(page.locator('#app')).toContainText(text, { timeout: 30000 });
  expect(await page.evaluate(() => window.__stay)).toBe(1);
});
