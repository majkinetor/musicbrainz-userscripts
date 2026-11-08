import { test, expect, functionSource, SANDBOX } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Event Horizon' } });

test('external menu launchers survive redraws and can update or unregister', { tag: '@unit' }, async ({ page }) => {
  await page.setContent('<main id="app"><div class="kicker"><span class="acts"></span></div></main>');
  await page.addScriptTag({ content: 'const SVG = () => ""; const actsFit = () => {};\n' + await functionSource('event_horizon', ['foreignMenuSync']) });
  await page.evaluate(() => {
    const source = document.createElement('button'); source.hidden = true;
    source.dataset.mbuMenuItem = 'test'; source.dataset.mbuMenuTitle = '<Launch>';
    source.dataset.mbuMenuIcon = 'javascript:alert(1)';
    source.onclick = () => { window.launches = (window.launches || 0) + 1; };
    document.documentElement.append(source); foreignMenuSync();
  });
  const item = page.locator('[data-eh-menu-item="test"]');
  await expect(item).toHaveText('<Launch>');
  await expect(item.locator('img')).toHaveCount(0);
  await page.locator('.eh-more summary').click();
  await item.click();
  expect(await page.evaluate(() => window.launches)).toBe(1);
  await expect(page.locator('.eh-more')).not.toHaveAttribute('open');
  await page.evaluate(() => {
    const b = document.querySelector('[data-mbu-menu-item]'); b.dataset.mbuMenuTitle = 'Updated';
    document.querySelector('.acts').innerHTML = ''; foreignMenuSync(); foreignMenuSync();
  });
  await expect(item).toHaveCount(1); await expect(item).toHaveText('Updated');
  await page.evaluate(() => { document.querySelector('[data-mbu-menu-item]').disabled = true; foreignMenuSync(); });
  await expect(item).toHaveCount(0);
  await page.evaluate(() => { document.querySelector('[data-mbu-menu-item]').remove(); foreignMenuSync(); });
  await expect(page.locator('.eh-more')).toHaveCount(0);
});

test('live EH discovers early and late launchers and honours the keyboard opt-out', { tag: '@sandbox' }, async ({ page, inject }) => {
  await page.goto(SANDBOX + '/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await page.evaluate(() => {
    const b = document.createElement('button'); b.hidden = true; b.dataset.mbuMenuItem = 'saed'; b.dataset.mbuMenuTitle = 'Open in SAED';
    b.onclick = () => { window.menuPath = location.pathname; }; document.documentElement.append(b);
  });
  await inject('event_horizon');
  await expect(page.locator('#app [data-eh-menu-item="saed"]')).toHaveCount(1);
  await page.evaluate(() => document.documentElement.setAttribute('data-mbu-quiet', 'saed'));
  await page.screenshot({ path: 'dev/_938-quiet.png' });
  await page.evaluate(() => document.documentElement.removeAttribute('data-mbu-quiet'));
  await page.evaluate(() => document.documentElement.setAttribute('data-mbu-keys-off', ''));
  await page.keyboard.press('h');
  expect(new URL(page.url()).pathname).not.toContain('/edits');
  expect(await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true, cancelable: true });
    document.dispatchEvent(e); return e.defaultPrevented;
  })).toBe(false);
  await page.locator('#app .eh-more summary').first().click();
  await page.screenshot({ path: 'dev/_938-menu.png' });
  await page.locator('#app [data-eh-menu-item="saed"]').click();
  expect(await page.evaluate(() => window.menuPath)).toContain('/artist/');
  await page.evaluate(() => document.querySelector('[data-mbu-menu-item]').dataset.mbuMenuTitle = 'Analyse page');
  await expect(page.locator('#app [data-eh-menu-item="saed"]')).toHaveText('Analyse page');
  await page.evaluate(() => document.querySelector('[data-mbu-menu-item]').remove());
  await expect(page.locator('#app [data-eh-menu-item]')).toHaveCount(0);
  await page.evaluate(() => {
    const b = document.createElement('button'); b.hidden = true; b.dataset.mbuMenuItem = 'late'; b.dataset.mbuMenuTitle = 'Late launcher';
    document.documentElement.append(b);
  });
  await expect(page.locator('#app [data-eh-menu-item="late"]')).toHaveCount(1);
  await page.evaluate(() => document.querySelector('[data-mbu-menu-item="late"]').removeAttribute('data-mbu-menu-item'));
  await expect(page.locator('#app [data-eh-menu-item]')).toHaveCount(0);
  await page.evaluate(() => document.documentElement.removeAttribute('data-mbu-keys-off'));
  await page.keyboard.press('h');
  await expect(page).toHaveURL(/\/edits$/);
});
