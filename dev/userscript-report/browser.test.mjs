// Offline behavioral tests; no MusicBrainz or other external requests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const url = process.env.REPORT_TEST_URL || new URL('./out/index.html',import.meta.url).href;
const cache = fileURLToPath(new URL('./.cache/',import.meta.url));
mkdirSync(cache,{recursive:true});
test('collapsed listing, weighted review, comments, reload and export/import round trip',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1500,height:1000}});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    assert.equal(await page.locator('.script').count(),293);
    assert.equal(await page.locator('.script[open]').count(),0);
    await page.locator('#search').fill('Elephant Editor');
    assert.equal(await page.locator('.script:visible').count(),1);
    const row=page.locator('.script:visible');
    await row.locator('summary').first().click();
    await row.locator('.caps').waitFor();
    await row.locator('[data-feature="notes.autofill"] [data-field="weight"]').selectOption('0');
    await row.locator('[data-feature="notes.acoustid"] [data-field="weight"]').selectOption('0');
    assert.match(await row.locator('.personal').textContent(),/Fully replaceable/);
    await row.locator('.note').fill('Only need MusicBrainz.\nKeep my weights.');
    const comment='<img src=x onerror="window.reviewXss=true"> Important gap';
    await row.locator('.comment-draft').fill(comment);
    await row.locator('.post').click();
    assert.equal(await row.locator('.comments li').count(),1);
    assert.equal(await row.locator('.comments img').count(),0);
    await row.locator('.comment-draft').fill('Unposted draft retained');
    await row.locator('.feature-name').fill('My missing essential feature');
    await row.locator('.add').click();
    const extra=row.locator('[data-feature^="custom:"]');
    await extra.locator('[data-field="coverage"]').selectOption('Gap');
    await extra.locator('[data-field="weight"]').selectOption('10');
    assert.match(await row.locator('.personal').textContent(),/Partial overlap/);
    await page.reload();
    await page.locator('#search').fill('Elephant Editor');
    await row.locator('summary').first().click();
    assert.equal(await row.locator('.note').inputValue(),'Only need MusicBrainz.\nKeep my weights.');
    assert.equal(await row.locator('.comment-draft').inputValue(),'Unposted draft retained');
    const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();
    const download=await downloadPromise;const exportFile=cache+'review-roundtrip.json';await download.saveAs(exportFile);
    const payload=JSON.parse(readFileSync(exportFile,'utf8'));
    assert.equal(payload.entries.length,1);assert.equal(payload.entries[0].review.comments[0].text,comment);
    assert.equal(payload.entries[0].review.features['notes.acoustid'].weight,0);
    assert.equal(payload.entries[0].review.draft,'Unposted draft retained');
    assert.equal(payload.entries[0].review.basis.sourceVersion,'2026.4.6');
    assert.ok(payload.report.sourceManifestSha256);
    assert.equal(payload.scoringPolicy.coverageCredit.Partial,.5);
    assert.ok(payload.entries[0].currentFinding.assessment.evidence.length);
    const restoredContext=await browser.newContext();const restored=await restoredContext.newPage();await restored.goto(url);
    await restored.locator('#import-file').setInputFiles(exportFile);
    await restored.waitForFunction(()=>document.getElementById('message').textContent.startsWith('Imported'));
    await restored.locator('#search').fill('Elephant Editor');
    const restoredRow=restored.locator('.script:visible');await restoredRow.locator('summary').first().click();
    assert.equal(await restoredRow.locator('.note').inputValue(),'Only need MusicBrainz.\nKeep my weights.');
    assert.equal(await restoredRow.locator('.comments li').count(),1);
    assert.equal(await restoredRow.locator('[data-feature^="custom:"] [data-field="weight"]').inputValue(),'10');
    await restored.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"invalid"}')});
    await restored.waitForFunction(()=>document.getElementById('message').textContent.includes('Invalid review file'));
    assert.equal(await restoredRow.locator('.comments li').count(),1);
    // A review made against a changed baseline remains recoverable and visibly stale.
    payload.entries[0].review.updatedAt='2099-01-01T00:00:00Z';
    payload.entries[0].review.basis.hash='previous-snapshot';
    await restored.locator('#import-file').setInputFiles({name:'old-basis.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
    await restoredRow.locator('.ack').waitFor();
    assert.match(await restoredRow.locator('.review-marker').textContent(),/Needs recheck/);
    await restoredRow.locator('.ack').click();
    assert.equal(await restoredRow.locator('.review-marker').textContent(),'Confirmed');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
test('blocked browser storage preserves in-memory edits for export',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage blocked');}}));
    await page.goto(url);await page.locator('#search').fill('Elephant Editor');
    const row=page.locator('.script:visible');await row.locator('summary').first().click();
    await row.locator('.note').fill('Survives storage failure through export');
    assert.match(await page.locator('#save-status').textContent(),/not saved in browser/);
    const wait=page.waitForEvent('download');await page.locator('#export').click();
    const download=await wait;const file=cache+'storage-fallback.json';await download.saveAs(file);
    assert.equal(JSON.parse(readFileSync(file,'utf8')).entries[0].review.note,'Survives storage failure through export');
  } finally {await browser.close();}
});

test('visitor verdict, edited and deleted notes, and versioned GitHub draft',async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1500,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
    const entry=await page.evaluate(()=>JSON.parse(document.getElementById('report-data').textContent).entries.find(e=>e.name==='Harmony'));
    await page.locator('#search').fill('Harmony');const row=page.locator('.script[data-id="'+entry.id+'"]');await row.locator('summary').first().click();
    await row.locator('.my-verdict').selectOption('Replaceable');assert.match(await row.locator('.personal').textContent(),/Fully replaceable/);
    await row.locator('.note').fill('Remove this note');await row.locator('.clear-note').click();assert.equal(await row.locator('.note').inputValue(),'');
    await row.locator('.comment-draft').fill('Original comment');await row.locator('.post').click();await row.locator('.edit-comment').click();
    await row.locator('.comment-edit').fill('Edited comment');await row.locator('.save-comment').click();assert.match(await row.locator('.comments').textContent(),/Edited comment/);
    const wait=page.waitForEvent('download');await page.locator('#export').click();const previous=await wait;const oldFile=cache+'before-delete.json';await previous.saveAs(oldFile);
    await row.locator('.delete-comment').click();assert.equal(await row.locator('.comments li').count(),0);
    await page.locator('#import-file').setInputFiles(oldFile);await page.waitForFunction(()=>document.getElementById('message').textContent.startsWith('Imported'));
    assert.equal(await row.locator('.comments li').count(),0);assert.equal(await row.locator('.my-verdict').inputValue(),'Replaceable');
    await row.locator('.note').fill('Please use my verdict in the next report');
    await row.locator('.my-verdict').hover();await page.locator('#mbu-tip.mbu-tip-on').waitFor();
    await page.locator('#github').click();await page.locator('#share-dialog').waitFor();
    const body=await page.locator('#share-body').inputValue();assert.ok(body.includes('**Harmony**: Companion tool → Fully replaceable'));
    const exported=JSON.parse(body.match(/```json\n([\s\S]*?)\n```/)[1]);
    assert.equal(exported.entries[0].review.proposedVerdict,'Replaceable');assert.equal(exported.entries[0].review.comments.length,0);
    assert.equal(exported.entries[0].review.deletedComments.length,1);assert.equal(exported.entries[0].review.note,'Please use my verdict in the next report');
    assert.ok(exported.report.permanentUrl.endsWith('/reports/'+exported.report.reportVersion+'.html'));
    assert.equal(new URL(await page.locator('#share-open').getAttribute('href')).searchParams.get('category'),'3rd-party');
    if(process.env.REPORT_SCREENSHOT_DIR){await page.screenshot({path:process.env.REPORT_SCREENSHOT_DIR+'/926-site-share.png'});await page.locator('#share-dialog form button').click();await row.scrollIntoViewIfNeeded();await page.screenshot({path:process.env.REPORT_SCREENSHOT_DIR+'/926-site-review.png'});}
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
