// Probe MB's link-type auto-classification on a release /edit page (logged-in
// profile) for each provider Platform Check can insert. For each URL it reports
// the type MB auto-selects — or "(blank)" when MB can't classify it, meaning we
// must force a type in injectInto's TYPE_FORCE. Reloads per URL for clean state.
import { chromium } from 'playwright';
import { resolve }  from 'node:path';

const PROFILE = resolve('../../.pw-profile');
const MBID = 'ec116461-5b0d-4c98-bb44-a4de5de63076';
const URLS = {
    HDtracks: 'https://www.hdtracks.com/#/album/5e182300c10cf717bb0315f2',
    Volumo:   'https://volumo.com/album/198474',
    Deezer:   'https://www.deezer.com/album/302127',
    Spotify:  'https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc',
    Tidal:    'https://tidal.com/album/20115556',
    Beatport: 'https://www.beatport.com/release/discovery/19618',
};

const ctx = await chromium.launchPersistentContext(PROFILE, { headless: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' });
const p = await ctx.newPage();

for (const [name, url] of Object.entries(URLS)) {
    await p.goto(`https://musicbrainz.org/release/${MBID}/edit`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForTimeout(3500);
    const addLink = p.getByPlaceholder(/add (another )?link|add another url/i).first();
    if (!(await addLink.count())) { console.log(`${name.padEnd(9)} LOGIN? no add-link input (title: ${await p.title()})`); break; }
    await addLink.fill(url);
    await addLink.evaluate(el => { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); });
    await addLink.press('Enter').catch(() => {});
    await p.waitForTimeout(2500);
    // read the link-type select of the ROW we just added (match by the URL's tail),
    // exactly as injectInto locates it: external-link-item → next relationship-item.
    const tail = url.split('/').filter(Boolean).pop();
    const r = await p.evaluate(t => {
        const row = [...document.querySelectorAll('tr.external-link-item')].find(tr => (tr.querySelector('a[href]')?.getAttribute('href') || '').includes(t));
        if (!row) return { sel: '(row not found)' };
        const sib = row.nextElementSibling;
        const sel = sib && sib.querySelector ? sib.querySelector('select.link-type') : null;
        if (!sel) return { sel: '(no type select — MB auto-typed)' };
        const lab = i => (sel.options[i]?.textContent || '').trim();
        const before = sel.value ? `${sel.value} = ${lab(sel.selectedIndex)}` : '(blank — needs TYPE_FORCE)';
        // replicate injectInto: force id 74 via the native setter + change event
        let after = before;
        if (!sel.value) {
            const opt = [...sel.options].find(o => o.value === '74');
            if (opt) {
                const setSel = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
                setSel.call(sel, '74'); sel.dispatchEvent(new Event('change', { bubbles: true }));
                after = `forced → ${sel.value} = ${lab(sel.selectedIndex)}`;
            } else after = '(74 not offered!)';
        }
        return { sel: before, after };
    }, tail);
    const note = r.after && r.after !== r.sel ? `   ${r.after}` : '';
    console.log(`${name.padEnd(9)} ${r.sel}${note}`);
}
await ctx.close();
