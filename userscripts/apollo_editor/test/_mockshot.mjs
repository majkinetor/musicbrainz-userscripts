import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 940, height: 1100 }, deviceScaleFactor: 2 });
await p.goto('file:///C:/Work/mb-userscripts/dev/mockup_scout_301.html', { waitUntil: 'networkidle' });
await p.locator('.wrap').screenshot({ path: 'C:/Work/mb-userscripts/dev/_mockup_301.png' });
console.log('ok'); await b.close();
