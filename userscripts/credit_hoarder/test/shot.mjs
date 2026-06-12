// Ad-hoc screenshot helper for issue #118 — captures tight, high-DPR clips of
// the import toolbar at three moments: idle (borderless options + reordered
// right cluster), mid-progress (status line / "System messages"), and
// after-import (WARN/ERR + unresolved badge, toolbar pinned on top).
//
//   node test/shot.mjs            # default fixture (Midwest Funk)
//   node test/shot.mjs <mbid-or-url>
//
// Writes test/logs/shots/<moment>.png.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
    launchTestContext, openReleasePage, injectUserscript,
    clickImport, confirmReviewTable, waitForImportDone,
} from './lib/browser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT  = resolve(HERE, 'logs', 'shots');
await mkdir(OUT, { recursive: true });

const arg = process.argv[2] || '62a764a8-cf05-459c-a358-2c65dbf0b729'; // Midwest Funk
const url = arg.startsWith('http') ? arg : `https://musicbrainz.org/release/${arg}`;

async function shotRow1(page, name) {
    const box = await page.locator('.discogs-bar-row1').first().boundingBox();
    if (!box) { console.log(`  (no row1 for ${name})`); return; }
    // Pad a little and clamp to the viewport.
    const pad = 6;
    const clip = {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width:  Math.min(1400, box.width + pad * 2),
        height: box.height + pad * 2,
    };
    const path = resolve(OUT, `${name}.png`);
    await page.screenshot({ path, clip });
    console.log(`  shot: ${name}.png  (${Math.round(clip.width)}x${Math.round(clip.height)})`);
}

const context = await launchTestContext({ headed: false });
const page = await openReleasePage(context, url);
await injectUserscript(page);
console.log('injected; capturing idle…');
await shotRow1(page, '1-idle');

await clickImport(page);
// Let preflight run a few seconds so the status line + progress are populated.
await page.waitForTimeout(9000);
await shotRow1(page, '2-progress');

console.log('confirming review table (may take minutes on cold cache)…');
await confirmReviewTable(page);
await waitForImportDone(page);
// Give the post-import settle (is-importing drops after 2s; badge stays).
await page.waitForTimeout(2600);
await shotRow1(page, '3-after');

// Also a wider shot showing the pinned bar sitting on top of the staged edits.
await page.evaluate(() => window.scrollTo(0, 320));
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(OUT, '4-pinned-context.png'), clip: { x: 0, y: 0, width: 1400, height: 520 } });
console.log('  shot: 4-pinned-context.png');

await context.close();
console.log('done →', OUT);
