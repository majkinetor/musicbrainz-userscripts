// Added by server.mjs to the copy of Event Horizon it serves at /eh.user.js, after the player's log is made.
// Not part of EH: it lets a test in the emulator start a queue and read the player's state and log lines.
//   #ehyt=<id>[@<second>],…   a queue of YouTube videos (from that second, so a long song ends soon)
//   #ehbc=<url>@<length s>,…  a queue of Bandcamp track pages; the length lets #ehnear find the end
//   #ehrel=1                  on a release page: the button presses the release's Play, wherever it is on the page
//   #ehnear=<seconds>         each track jumps to that many seconds before its end, once it played 5 s: ends come soon
// It shows a big "EH test start" button: a tap is the user's click that lets the player start with sound.
;(() => {
    if (window.top !== window) return;
    const H = 'http://localhost:8777';
    const post = (path, data) => { try { GM_xmlhttpRequest({ method: 'POST', url: H + path, data }); } catch (e) {} };
    for (const [lg, tag] of [[LOG, 'eh'], [PLOG, 'eh player']]) for (const lv of ['info', 'warn', 'error', 'debug']) {
        const f = lg[lv]; if (typeof f !== 'function') continue;
        lg[lv] = function (...a) { post('/log', tag + ' ' + lv + ' ' + a.map(x => typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })()).join(' ')); return f.apply(this, a); };
    }
    // #ehsrc=<source key> (ytmusic, archive, bandcamp…): the source a track plays from when it has it, as a remembered choice
    const q = new URLSearchParams(location.hash.slice(1)), yt = q.get('ehyt'), bc = q.get('ehbc'), mbid = q.get('ehrel'), src = q.get('ehsrc');
    if (src) { ply.pref = src; document.addEventListener('click', () => { ply.pref = src; }, true); }
    // the test widget script (control/yt-visible.user.js) sends its lines here
    window.addEventListener('message', ev => { if (ev.data && typeof ev.data.ehTestLog === 'string') post('/log', ev.data.ehTestLog); });
    // YouTube's state words as the page gets them
    // every word from a frame, the first few of each kind
    const seen = {}; window.addEventListener('message', ev => { let d = ev.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) {} } const k = (d && (d.event || Object.keys(d)[0])) || typeof d; seen[k] = (seen[k] || 0) + 1; if (seen[k] <= 2) post('/log', 'page message ' + k + ' from ' + (ev.origin || '?') + ' ' + JSON.stringify(d).slice(0, 120)); });
    window.addEventListener('message', ev => { if (typeof ev.data !== 'string' || !ev.data.includes('State')) return; try { const m = JSON.parse(ev.data); const st = m.event === 'onStateChange' ? m.info : m.info && m.info.playerState; if (st !== undefined) post('/log', 'page got youtube state ' + st + ' from ' + (ev.source === (document.querySelector('#eh-ply .ply-dock iframe:not(.ply-nx):not(.ply-old)') || {}).contentWindow ? 'the current widget' : 'another frame') + ' i=' + ply.i + ' yt=' + ply.yt + ' nx=' + !!ply.nx + ' fade=' + !!ply.fadeIv); } catch (e) {} });
    if (!yt && !bc && !mbid && !src) return;
    const near = +q.get('ehnear') || 0;
    setInterval(() => {
        const t = ply.q[ply.i];
        if (near && t && t.len > (near + 10) * 1000 && !t.ehNear && (t.played || 0) > 5000) { t.ehNear = true; post('/log', 'eh test: to ' + near + ' s before the end of ' + t.title); plySeek(t.len - near * 1000); }
        post('/state', JSON.stringify({ kind: 'eh ' + (ply.kind || ''), i: ply.i, state: ply.i < 0 ? 'idle' : ply.paused ? 'paused' : 'playing', pos: t ? (t.played || 0) / 1000 : 0, ended: ply.q.filter(x => x.done).length, vis: document.visibilityState }));
    }, 1000);
    const ytRel = () => ({ id: '00000000-0000-0000-0000-000000000000', title: 'EH test', ac: [{ name: 'EH test' }], media: [{ tracks: yt.split(',').map((x, k) => {
        const [id, s] = x.split('@');
        return { n: k + 1, title: `Video ${k + 1} ${id}`, rid: 'eh-test-' + k, lenMs: 0, links: [{ key: 'youtube', name: 'YouTube', kinds: [], urls: [{ url: `https://www.youtube.com/watch?v=${id}${s ? '&t=' + s : ''}` }] }] };
    }) }] });
    const bcRel = () => ({ id: '00000000-0000-0000-0000-000000000000', title: 'EH test', ac: [{ name: 'EH test' }], media: [{ tracks: bc.split(',').map((x, k) => {
        const [url, len] = x.split('@');
        return { n: k + 1, title: 'Bandcamp ' + (k + 1) + ' ' + url.split('/').pop(), rid: 'eh-test-' + k, lenMs: (+len || 0) * 1000, links: [{ key: 'bandcamp', name: 'Bandcamp', kinds: [], urls: [{ url }] }] };
    }) }] });
    const start = async () => {
        if (yt) { plyStart(ytRel()); return; }
        if (bc) { plyStart(bcRel()); return; }
        const b = document.querySelector('[data-playall]');
        if (b) b.click(); else post('/log', 'eh test: no Play button on this page');
    };
    const show = () => {
        const b = document.createElement('button');
        b.textContent = 'EH test start';
        b.style.cssText = 'position:fixed;top:30%;left:10%;width:80%;height:90px;z-index:2147483647;font-size:24px';
        let gone = false;
        b.onclick = () => { gone = true; b.remove(); start(); };
        // EH draws the page again after it loads, which can drop the button: it goes back until it is tapped
        const put = () => { if (!gone && !b.isConnected) document.documentElement.append(b); };
        put(); const iv = setInterval(() => { if (gone) clearInterval(iv); else put(); }, 500);
    };
    if (yt || bc || mbid) if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
