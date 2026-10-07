import { chromium } from '@playwright/test';
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
await p.goto(new URL('dash.html', import.meta.url).href);
for (const m of ['now', 'side', 'area']) {
  await p.click(`#mock-bar [data-m="${m}"]`);
  await p.screenshot({ path: new URL(`dash-${m}.png`, import.meta.url).pathname.slice(1), clip: { x: 234, y: 455, width: 952, height: 275 } });
}
await b.close();
