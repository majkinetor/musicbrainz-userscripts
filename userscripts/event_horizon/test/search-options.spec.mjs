import {test,expect,idle} from '../../../dev/test/harness.mjs';
test.use({gm:{name:'Event Horizon'}});

test('compact matching choices preserve every native combination in saved queries', {tag:'@sandbox'},async({page,inject})=>{
  await page.goto('https://test.musicbrainz.org/search/edits?conditions.0.field=id&conditions.0.operator=%3D&conditions.0.args.0=4');
  await idle(page);await inject('event_horizon');
  const logic=page.locator('#app select[data-es-logic]');
  await expect(logic).toHaveCount(1);
  for(const [choice,negation,combinator] of [['all','0','and'],['any','0','or'],['none','1','or'],['not-all','1','and']]){
    await logic.evaluate((s,v)=>{s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}))},choice);
    await page.getByLabel('Search name',{exact:true}).fill('Logic review');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    const q=new URLSearchParams((await page.evaluate(()=>GM_getValue('editSearches')))[0].query);
    expect(q.get('negation')).toBe(negation);expect(q.get('combinator')).toBe(combinator);
    expect([...q.keys()].some(k=>k.includes('logic'))).toBe(false);
  }
  await page.locator('#eh-launch').evaluate(b=>b.click());
  await expect(page.locator('#edit-search select[name=negation]')).toBeVisible();
  await expect(page.locator('#edit-search select[name=combinator]')).toHaveValue('and');
  await page.locator('#eh-launch').evaluate(b=>b.click());
  await expect(page.locator('#app select[data-es-logic]')).toHaveValue('not-all');
});
