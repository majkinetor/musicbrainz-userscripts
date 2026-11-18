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
  await expect(page.locator('#eh-ply-menu .ply-group')).toHaveText(['First', 'Second', 'Recordings']);
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
