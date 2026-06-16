import { createRequire } from 'module';
const require = createRequire('C:/Work/mb-userscripts/userscripts/apollo_editor/');
const { chromium } = require('playwright');

const MBID = '51431e0c-fdae-41a9-b8ff-65364c600eb4';
const ctx = await chromium.launchPersistentContext('C:/Work/mb-userscripts/.pw-profile', {
  headless: true, bypassCSP: true, viewport: { width: 1280, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();

// a CAA id for this release
const caa = await page.evaluate(async (mbid) => {
  const j = await fetch(`https://coverartarchive.org/release/${mbid}`, { headers: { Accept: 'application/json' } }).then(r => r.json());
  return j.images[0].id;
}, MBID);
console.log('using caa id:', caa, '\n');

function dumpForms() {
  return [...document.querySelectorAll('form')].map(f => ({
    action: f.getAttribute('action') || location.pathname,
    method: (f.getAttribute('method') || 'GET').toUpperCase(),
    enctype: f.getAttribute('enctype') || '',
    fields: [...f.querySelectorAll('input,select,textarea')].map(el => ({
      tag: el.tagName.toLowerCase(), type: el.type || '', name: el.name || '',
      value: el.type === 'hidden' ? (el.value.length > 40 ? el.value.slice(0, 40) + '…' : el.value) : (el.value || ''),
      checked: el.type === 'checkbox' ? el.checked : undefined,
    })).filter(x => x.name),
  }));
}

async function probe(path, label) {
  try {
    await page.goto(`https://musicbrainz.org${path}`, { waitUntil: 'domcontentloaded' });
    const url = page.url();
    if (/\/login/.test(url)) { console.log(`### ${label}\n  -> redirected to LOGIN (not authed)\n`); return; }
    const forms = await page.evaluate(dumpForms);
    const relevant = forms.filter(f => /cover-art|confirm/i.test(JSON.stringify(f.fields)) || /cover-art/i.test(f.action) || f.enctype.includes('multipart'));
    console.log(`### ${label}  (${url.replace('https://musicbrainz.org','')})`);
    (relevant.length ? relevant : forms).forEach(f => {
      console.log(`  form ${f.method} ${f.action} ${f.enctype}`);
      f.fields.forEach(x => console.log(`    ${x.tag}/${x.type} ${x.name} = ${JSON.stringify(x.value)}${x.checked!==undefined?` checked=${x.checked}`:''}`));
    });
    // hint about the upload mechanism on add-cover-art
    if (/add-cover-art/.test(path)) {
      const up = await page.evaluate(() => {
        const txt = [...document.scripts].map(s => s.textContent).join('\n');
        const m = txt.match(/(archive\.org|s3|signature|upload|formdata|x-amz)[^\n]{0,80}/gi) || [];
        return [...new Set(m)].slice(0, 12);
      });
      console.log('  upload hints:', JSON.stringify(up, null, 0));
    }
    console.log('');
  } catch (e) { console.log(`### ${label}: ERROR ${e.message}\n`); }
}

await probe(`/release/${MBID}/edit-cover-art/${caa}`, 'EDIT cover art');
await probe(`/release/${MBID}/remove-cover-art/${caa}`, 'REMOVE cover art');
await probe(`/release/${MBID}/reorder-cover-art`, 'REORDER cover art');
await probe(`/release/${MBID}/add-cover-art`, 'ADD cover art (upload)');

await ctx.close();
