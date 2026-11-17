import { readFile } from 'node:fs/promises';
import { test, expect } from '../../../dev/test/harness.mjs';

test.use({ profile: 'fresh' });
test('Bandcamp loads metadata on play and resumes without playing the beginning', { tag: '@unit' }, async ({ page }) => {
  await page.route('https://bandcamp.com/EmbeddedPlayer/**', route => route.fulfill({ contentType: 'text/html', body: '<button id="play">Play</button><audio></audio>' }));
  await page.setContent('<iframe src="https://bandcamp.com/EmbeddedPlayer/track=1/"></iframe>');
  const frame = page.frameLocator('iframe');
  await frame.locator('#play').waitFor();
  const widget = page.frames().find(f => f.url().includes('bandcamp.com/EmbeddedPlayer/'));
  await widget.evaluate(() => {
    const audio = document.querySelector('audio');
    let ready = 0, paused = true, position = 0;
    Object.defineProperties(audio, {
      readyState: { get: () => ready }, paused: { get: () => paused }, seeking: { get: () => false },
      currentTime: { get: () => position, set: value => { position = value; } },
    });
    document.querySelector('#play').onclick = () => {
      window.audibleStart = !audio.muted && position === 0;
      ready = 1; paused = false; audio.dispatchEvent(new Event('play', { bubbles: true }));
    };
  });
  const source = await readFile(process.env.EVENT_HORIZON_SRC || 'userscripts/event_horizon/event_horizon.user.js', 'utf8');
  await widget.evaluate(code => { new Function(code)(); }, source);
  await page.locator('iframe').evaluate(f => f.contentWindow.postMessage({ ehPlyCmd: 'play', pos: 47 }, '*'));
  await expect.poll(() => widget.evaluate(() => ({ paused: document.querySelector('audio').paused, position: document.querySelector('audio').currentTime, muted: document.querySelector('audio').muted, audibleStart: window.audibleStart })), { timeout: 4000 }).toEqual({ paused: false, position: 47, muted: false, audibleStart: false });
});
