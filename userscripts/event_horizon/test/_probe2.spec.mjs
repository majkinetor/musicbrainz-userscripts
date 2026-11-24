import { test, SANDBOX } from '../../../dev/test/harness.mjs';
import { appendFileSync, writeFileSync } from 'node:fs';
const F = 'test-results/probe.txt';
writeFileSync(F, '');
const log = (...a) => appendFileSync(F, a.join(' ') + '\n');

test.use({ gm: { name: 'Event Horizon' }, pageErrors: 'ignore' });

test('probe2', async ({ page, inject }) => {
  page.on('pageerror', e => log('PAGEERROR ' + e.message));
  await page.goto(SANDBOX + '/artist/f27ec8db-af05-4f36-916e-3d57f91ecf5e');
  await page.evaluate(() => {
    const b = document.createElement('button'); b.hidden = true; b.dataset.mbuMenuItem = 'saed'; b.dataset.mbuMenuTitle = 'Open in SAED';
    document.documentElement.append(b);
    window.__st = [];
    const st = () => new Error().stack.split(/\n/).slice(2, 7).map(x => x.trim().replace(/\(.*?(\d+:\d+)\)$/, '$1')).join(' < ');
    const hit = n => n && n.nodeType === 1 && (n.matches('[data-eh-menu-item]') || n.querySelector('[data-eh-menu-item]'));
    const r0 = Element.prototype.remove; Element.prototype.remove = function () { if (hit(this)) window.__st.push('remove ' + st()); return r0.call(this); };
    const rc = Node.prototype.removeChild; Node.prototype.removeChild = function (c) { if (hit(c)) window.__st.push('removeChild ' + st()); return rc.call(this, c); };
    const ib = Node.prototype.insertBefore; Node.prototype.insertBefore = function (c, r) { if (hit(c)) window.__st.push('insertBefore into ' + this.className + ' ' + st()); return ib.call(this, c, r); };
    const ap = Element.prototype.append; Element.prototype.append = function (...c) { if (c.some(hit)) window.__st.push('append into ' + this.className + ' ' + st()); return ap.apply(this, c); };
    const ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    Object.defineProperty(Element.prototype, 'innerHTML', { get: ih.get, configurable: true, set(v) { if (this.querySelector && this.querySelector('[data-eh-menu-item]')) window.__st.push('innerHTML on ' + this.className + ' ' + st()); return ih.set.call(this, v); } });
  });
  await inject('event_horizon');
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(2000);
    log(await page.evaluate(() => JSON.stringify({ items: [...document.querySelectorAll('[data-eh-menu-item]')].length, st: window.__st })));
  }
});
