import { createRequire } from 'module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');
const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto(`https://musicbrainz.org/release/${MBID}/add-cover-art`, { waitUntil: 'domcontentloaded' });

// mask anything that looks like a secret in the dumped structure
const mask = obj => JSON.parse(JSON.stringify(obj, (k, v) =>
  (typeof v === 'string' && v.length > 24 && /[A-Za-z0-9+/=_-]{24,}/.test(v) && !/^https?:/.test(v)) ? `‹${v.length}-char value›` : v));

const res = await page.evaluate(async (mbid) => {
  const out = {};
  // 1) the per-file signing endpoint MB uses
  try {
    const r = await fetch(`/ws/js/cover-art-upload/${mbid}?mime_type=${encodeURIComponent('image/jpeg')}`, { credentials: 'same-origin' });
    out.ws_status = r.status;
    out.ws_body = await r.json().catch(() => null);
  } catch (e) { out.ws_err = String(e); }
  // 2) the nonce in the add form (filled by server?) + form action
  const f = [...document.querySelectorAll('form')].find(x => /add-cover-art/.test(x.getAttribute('action') || '') || x.querySelector('input[name="add-cover-art.nonce"]'));
  out.nonce = f?.querySelector('input[name="add-cover-art.nonce"]')?.value || '(empty)';
  out.position = f?.querySelector('input[name="add-cover-art.position"]')?.value;
  // 3) does add-cover-art form post an image id? look for hidden id field names
  out.addFields = [...(f?.querySelectorAll('input,select,textarea') || [])].map(el => el.name).filter(Boolean);
  return out;
}, MBID);

console.log('cover-art-upload ws status:', res.ws_status);
console.log('cover-art-upload ws body (masked):', JSON.stringify(mask(res.ws_body), null, 2));
if (res.ws_err) console.log('ws err:', res.ws_err);
console.log('\nadd form nonce:', res.nonce === '(empty)' ? '(empty in static HTML)' : '‹present›');
console.log('add form position:', res.position);
console.log('add form field names:', JSON.stringify(res.addFields));
await ctx.close();
