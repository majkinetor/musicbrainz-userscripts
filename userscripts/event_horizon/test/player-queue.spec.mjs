import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh', gm: { name: 'Event Horizon', persist: true, values: { view: { on: true, player: true } } } });

test('queues releases and recordings and restores the last queue', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon', { waitFor: '__ehPlayerTest' });
  const src = [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }];
  const release = (id, title) => ({ id, title, ac: [{ name: 'Artist' }], media: [{ tracks: [1, 2].map(n => ({ n, title: title + n, rid: id + n, lenMs: 100000, links: src })) }] });
  await page.evaluate(r => window.__ehPlayerTest.startRelease(r), release('one', 'First'));
  await page.evaluate(r => window.__ehPlayerTest.addRelease(r, '1-2'), release('two', 'Second'));
  await page.evaluate(({ src }) => window.__ehPlayerTest.recording({ id: 'rec', title: 'Single', ac: [], links: src }, [], true), { src });
  const state = await page.evaluate(() => window.__ehPlayerTest.state());
  expect(state.i).toBe(0);
  expect(state.q.map(t => t.title)).toEqual(['First1', 'First2', 'Second2', 'Single']);
  await page.locator('.ply-ctl [data-ply="list"]').click();
  await expect(page.locator('#eh-ply-menu .ply-group')).toContainText(['First', 'Second', 'Recordings']);
  await expect(page.locator('#eh-ply-menu .qi .qn')).toHaveText(['1', '2', '3', '4']);
  // the head counts the releases and the loose recordings; each jumps to its part of the playlist
  await expect(page.locator('#eh-ply-menu .ply-cb')).toHaveText(['2', '1']);
  await page.locator('#eh-ply-menu .ply-cb[data-pc="rec"]').click();
  await expect(page.locator('#eh-ply-menu .ply-group[data-pg="rec"]')).toHaveClass(/ply-flash/);
  await page.locator('#eh-ply-menu .ply-cb[data-pc="rel"]').click();
  // the releases' covers show as a grid in place of the rows; a cover's click closes it and goes to its release
  await expect(page.locator('#eh-ply-menu .ply-grid .ply-sc')).toHaveCount(2);
  await expect(page.locator('#eh-ply-menu .qi').first()).toBeHidden();
  await page.locator('#eh-ply-menu .ply-sc[data-grel="two"]').click();
  await expect(page.locator('#eh-ply-menu .ply-sc')).toHaveCount(0);
  await expect(page.locator('#eh-ply-menu .ply-group[data-grel="two"]')).toHaveClass(/ply-flash/);
  await page.locator('#eh-ply-menu .ply-cb[data-pc="rel"]').click();
  await expect(page.locator('#eh-ply-menu .ply-sc')).toHaveCount(2);
  await page.locator('#eh-ply-menu .ply-cb[data-pc="rel"]').click();
  await expect(page.locator('#eh-ply-menu .ply-sc')).toHaveCount(0);
  await page.locator('#eh-ply-menu .qi[data-k="q2"]').click();
  await expect(page.locator('#eh-ply-menu')).toBeVisible();
  await expect(page.locator('#eh-ply-menu .qi[aria-current]')).toContainText('Second2');
  await expect(page.locator('#eh-ply-menu .ply-rh')).toContainText('Second');
  await page.evaluate(() => window.__ehPlayerTest.toggle());
  await expect(page.locator('#eh-ply iframe')).toHaveCount(0);
  await page.reload();
  await inject('event_horizon', { waitFor: '__ehPlayerTest' });
  await page.evaluate(() => window.__mbuPalette['Event Horizon']().find(c => c.id === 'player').run());
  await expect(page.locator('#eh-ply iframe')).toHaveCount(1);
  expect((await page.evaluate(() => window.__ehPlayerTest.state())).q.map(t => t.title)).toEqual(['First1', 'First2', 'Second2', 'Single']);
  const updated = release('two', 'Second');
  updated.media[0].tracks.push({ n: 3, title: 'Second3', rid: 'two3', lenMs: 100000, links: src });
  await page.evaluate(r => window.__ehPlayerTest.refreshRelease(r), updated);
  expect((await page.evaluate(() => window.__ehPlayerTest.state())).q.map(t => t.title)).toEqual(['First1', 'First2', 'Second2', 'Single']);
});

test('a track replaces or appends only itself, while the release queues all tracks', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon', { waitFor: '__ehPlayerTest' });
  const links = [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }];
  const release = { id: 'rel', title: 'Album', ac: [], media: [{ tracks: [1, 2, 3].map(n => ({ n, title: 'Track ' + n, rid: 'rec' + n, lenMs: 100000, links })) }] };
  await page.evaluate(r => window.__ehPlayerTest.startRelease(r, '1-2'), release);
  expect((await page.evaluate(() => window.__ehPlayerTest.state())).q.map(t => t.title)).toEqual(['Track 2']);
  await page.evaluate(r => window.__ehPlayerTest.addRelease(r, '1-1'), release);
  expect((await page.evaluate(() => window.__ehPlayerTest.state())).q.map(t => t.title)).toEqual(['Track 2', 'Track 1']);
  await page.evaluate(r => window.__ehPlayerTest.refreshRelease(r), release);
  expect((await page.evaluate(() => window.__ehPlayerTest.state())).q.map(t => t.title)).toEqual(['Track 2', 'Track 1']);
  await page.evaluate(r => window.__ehPlayerTest.startRelease(r), release);
  expect((await page.evaluate(() => window.__ehPlayerTest.state())).q.map(t => t.title)).toEqual(['Track 1', 'Track 2', 'Track 3']);
});

test('a right-click on a row or a release heading takes its tracks out of the playlist', { tag: '@sandbox' }, async ({ page, context, inject }) => {
  await context.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<p>player fixture</p>' }));
  await page.goto('https://test.musicbrainz.org/');
  await inject('event_horizon', { waitFor: '__ehPlayerTest' });
  const src = [{ key: 'youtube', name: 'YouTube', urls: [{ url: 'https://www.youtube.com/watch?v=abcdefghijk' }] }];
  const release = (id, title) => ({ id, title, ac: [{ name: 'Artist' }], media: [{ tracks: [1, 2, 3].map(n => ({ n, title: title + n, rid: id + n, lenMs: 100000, links: src })) }] });
  await page.evaluate(r => window.__ehPlayerTest.startRelease(r), release('one', 'First'));
  await page.evaluate(r => window.__ehPlayerTest.addRelease(r), release('two', 'Second'));
  const titles = async () => (await page.evaluate(() => window.__ehPlayerTest.state())).q.map(t => t.title);
  await page.locator('.ply-ctl [data-ply="list"]').click();
  await page.locator('#eh-ply-menu .qi[data-k="q1"]').click({ button: 'right' });
  expect(await titles()).toEqual(['First1', 'First3', 'Second1', 'Second2', 'Second3']);
  expect((await page.evaluate(() => window.__ehPlayerTest.state())).i).toBe(0);
  await expect(page.locator('#eh-ply-menu .qi')).toHaveCount(5);
  // a right-click on the release heading removes its tracks, and the link doesn't open
  await page.locator('#eh-ply-menu .ply-group').nth(1).click({ button: 'right' });
  expect(await titles()).toEqual(['First1', 'First3']);
  await expect(page.locator('#eh-ply-menu .qi')).toHaveCount(2);
  expect(context.pages()).toHaveLength(1);
  // removing the one playing starts the next
  await page.locator('#eh-ply-menu .qi[data-k="q0"]').click({ button: 'right' });
  const st = await page.evaluate(() => window.__ehPlayerTest.state());
  expect(st.q.map(t => t.title)).toEqual(['First3']);
  expect(st.i).toBe(0);
});
