import { chromium } from '@playwright/test';
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.goto(new URL('status.html', import.meta.url).href);
for (const v of ['head', 'card', 'stripe']) {
  await p.click(`#mock-bar [data-v="${v}"]`);
  await p.screenshot({ path: new URL(`status-${v}.png`, import.meta.url).pathname.slice(1) });
}
await b.close();
