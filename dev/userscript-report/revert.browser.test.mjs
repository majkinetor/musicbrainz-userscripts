// Regression: reverting a collapsed row clears the complete local record.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const url=process.env.REPORT_TEST_URL || new URL('./out/index.html',import.meta.url).href;
test('Revert clears all local input and keeps published contributor evidence',async()=>{
 const browser=await chromium.launch();
 try{
  const page=await browser.newPage();await page.goto(url);await page.locator('#name-filter').fill('Harmony');
  const row=page.locator('.script').filter({has:page.locator('.name',{hasText:/^Harmony$/})});
  await row.locator('.row-verdict').selectOption('No equivalent');await row.locator('.row-note').click();await page.locator('#quick-note').fill('Local note');await page.locator('#quick-note-close').click();
  await row.locator('.name').first().click();const first=row.locator('[data-feature]').first();await first.locator('[data-field="weight"]').selectOption('0');await first.locator('[data-field="comment"]').fill('Local capability note');
  await row.locator('[data-action="feature"]').click();await row.locator('.feature-name').fill('Local capability');await row.locator('.add').click();
  await row.locator('[data-action="comments"]').click();await row.locator('.comment-draft').fill('Local comment');await row.locator('.post').click();await row.locator('.delete-comment').click();await row.locator('.comment-draft').fill('Local draft');
  await row.locator('.name').first().click();assert.equal(await row.getAttribute('open'),null);await row.locator('.row-revert').click({timeout:2000});
  assert.equal(await row.getAttribute('open'),null);assert.equal(await row.locator('.row-verdict').inputValue(),'');assert.equal(await row.locator('.row-revert').isVisible(),false);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('mb-userscripts:926:reviews:v1')));assert.equal(saved.entries.length,0);
  await page.reload();await page.locator('#name-filter').fill('Harmony');await row.locator('.name').first().click();assert.equal(await row.locator('[data-feature^="custom:"]').count(),0);
  assert.equal(await row.locator('.comment-draft').inputValue(),'');assert.equal(await row.locator('.note').inputValue(),'');assert.equal(await row.locator('.comments li').count(),0);assert.match(await row.locator('.row-accepted-note').first().textContent(),/Verdict: Mostly replaceable — majkinetor #943/);
 }finally{await browser.close();}
});
