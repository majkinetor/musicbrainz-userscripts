// #160 — deterministic CSS-scoping test. With body.tc-tl-on present, the #154 medium glyphs (✕ / Aa) must
// apply ONLY to buttons inside fieldset.advanced-medium, never to identical generic-class buttons elsewhere
// (Release-information external-link remove / title guess-case). Pure selector test — no settings needed.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'apollo_editor.user.js');
const ctx = await chromium.launchPersistentContext(resolve(HERE, '..', '..', '..', '.pw-profile'), { headless: true });
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('about:blank');
// Pull just the injected <style> the script builds, by running the script in a stubbed page is overkill;
// instead inject the whole userscript on a blank MB-less page guarded to not crash, then read the stylesheet.
await page.setContent('<body><div id="information"></div></body>');
const src = await readFile(SCRIPT, 'utf8');
// Pull every `body.tc-tl-on …{…}` rule straight from the source (the #154 medium-header theming) and inject
// it as a real stylesheet — tests the exact selectors as written, independent of MB globals / settings.
const rules = src.split('\n').map(l => l.trim()).filter(l => /^body\.tc-tl-on .*\{.*\}$/.test(l)).join('\n');
console.error(`injected ${rules.split('\n').length} tc-tl-on rules`);
await page.addStyleTag({ content: rules });
await page.waitForTimeout(100);

const out = await page.evaluate(() => {
  document.body.classList.add('tc-tl-on');
  const mk = (html, host) => { host.innerHTML = html; return host.firstElementChild.querySelector('button') || host.firstElementChild; };
  // medium-scoped button
  const med = document.createElement('div'); document.body.appendChild(med);
  const medBtn = mk('<fieldset class="advanced-medium"><button class="icon remove-item"></button></fieldset>', med);
  const medGuess = (() => { const d = document.createElement('div'); document.body.appendChild(d); d.innerHTML = '<fieldset class="advanced-medium"><button class="icon guesscase-title"></button></fieldset>'; return d.querySelector('button'); })();
  // RI-style buttons OUTSIDE any medium (external-links remove + title guess-case)
  const ri = document.createElement('div'); ri.id = 'external-links-editor'; document.body.appendChild(ri);
  ri.innerHTML = '<button class="icon remove-item"></button>';
  const riRemove = ri.querySelector('button');
  const info = document.getElementById('information'); info.innerHTML = '<button class="icon guesscase-title"></button>';
  const riGuess = info.querySelector('button');
  const cb = el => getComputedStyle(el, '::before').content;
  return {
    medRemove: cb(medBtn), medGuess: cb(medGuess),
    riRemove: cb(riRemove), riGuess: cb(riGuess),
    styleInjected: !!document.querySelector('style')
  };
});
console.log(JSON.stringify(out, null, 2));
const ok = /✕/.test(out.medRemove) && /Aa/.test(out.medGuess) && out.riRemove === 'none' && out.riGuess === 'none';
console.log(ok ? 'PASS — medium glyphs themed, RI buttons native' : 'FAIL');
await ctx.close();
process.exit(ok ? 0 : 1);
