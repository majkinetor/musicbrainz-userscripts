import { test, check, functionSource, requireLogin, idle } from '../../../dev/test/harness.mjs';

test.use({ gm: { name: 'Apollo Editor' } });

test('only background create returns stop editor initialization', { tag: '@unit' }, async () => {
  const src = await functionSource('apollo_editor', ['handleCreateFormBack']);
  for (const background of [false, true]) {
    const run = new Function('background', `
      const PENDING_KEY = 'pending';
      const location = { pathname: '/artist/create', hash: '' };
      const sessionStorage = { getItem: key => key === PENDING_KEY ? 'token' : background ? '1' : null };
      const document = { readyState: 'complete' };
      const setTimeout = () => {};
      ${src}
      return handleCreateFormBack();
    `);
    check(run(background) === background, 'foreground return tokens keep Apollo initialization running');
  }
});

test('foreground seeded artist with return token loads Apollo', { tag: ['@sandbox', '@login'] }, async ({ page, inject }) => {
  await page.goto('https://test.musicbrainz.org/artist/create?edit-artist.name=Rico&edit-artist.sort_name=Rico');
  await requireLogin(page); await idle(page);
  await page.evaluate(() => sessionStorage.setItem('apolloEditor.pendingArtist', 'tc-foreground-regression'));
  await inject('apollo_editor');
  await page.waitForSelector('#tc-af-btn');
  check(await page.locator('#tc-af-btn').isVisible(), 'Apollo initializes on a foreground artist create');
  check(await page.locator('[name="edit-artist.name"]').inputValue() === 'Rico', 'seeded name survives');
});
