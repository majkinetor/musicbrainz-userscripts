// ==UserScript==
// @name         Mission Control
// @namespace    https://musicbrainz.org/
// @version      2026.10.28.150000
// @description  One window on the release page that asks the other scripts (Platform Check, ISRC Scout, Art Station, Fusion, Credit Hoarder) what is missing, shows it all in one review, and applies the selected changes in order.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5NaXNzaW9uIENvbnRyb2w8L3RpdGxlPgo8ZGVmcz48ZmlsdGVyIGlkPSJtY28xMy1oIiB4PSItMTAlIiB5PSItMTAlIiB3aWR0aD0iMTIwJSIgaGVpZ2h0PSIxMjAlIj48ZmVNb3JwaG9sb2d5IGluPSJTb3VyY2VBbHBoYSIgb3BlcmF0b3I9ImRpbGF0ZSIgcmFkaXVzPSIxLjUiIHJlc3VsdD0iZCIvPjxmZUZsb29kIGZsb29kLWNvbG9yPSIjZmZmIiBmbG9vZC1vcGFjaXR5PSIuNyIvPjxmZUNvbXBvc2l0ZSBpbjI9ImQiIG9wZXJhdG9yPSJpbiIvPjxmZU1lcmdlPjxmZU1lcmdlTm9kZS8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjwvZGVmcz48ZyBmaWx0ZXI9InVybCgjbWNvMTMtaCkiPjxwYXRoIGQ9Ik03NyAzNS41IEw2NCA0MyBMNTEgMzUuNSBMNTEgMjAuNSBMNjQgMTMgTDc3IDIwLjVaIiBmaWxsPSIjN2E1N2U4IiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik01OS43IDc3LjUgTDQ2LjcgODUgTDMzLjcgNzcuNSBMMzMuNyA2Mi41IEw0Ni43IDU1IEw1OS43IDYyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik05NC4zIDc3LjUgTDgxLjMgODUgTDY4LjMgNzcuNSBMNjguMyA2Mi41IEw4MS4zIDU1IEw5NC4zIDYyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik00Mi4zIDEwNy41IEwyOS40IDExNSBMMTYuNCAxMDcuNSBMMTYuNCA5Mi41IEwyOS40IDg1IEw0Mi4zIDkyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik03NyAxMDcuNSBMNjQgMTE1IEw1MSAxMDcuNSBMNTEgOTIuNSBMNjQgODUgTDc3IDkyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xMTEuNiAxMDcuNSBMOTguNiAxMTUgTDg1LjcgMTA3LjUgTDg1LjcgOTIuNSBMOTguNiA4NSBMMTExLjYgOTIuNVoiIGZpbGw9IiNmZmM5NGEiIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9nPgo8L3N2Zz4K
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mission_control/README.md
// @match        https://*.musicbrainz.org/release/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// ==/UserScript==

(function () {
'use strict';
// one copy per page: with String Theory and a standalone install both on, the newer one runs (#653)
if (!mbuClaim('mission_control', 'Mission Control')) return;

const VERSION = (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version) || '?';
// the corner launcher wears the script's own icon (the same picture as @icon)
const ICON_URL = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5NaXNzaW9uIENvbnRyb2w8L3RpdGxlPgo8ZGVmcz48ZmlsdGVyIGlkPSJtY28xMy1oIiB4PSItMTAlIiB5PSItMTAlIiB3aWR0aD0iMTIwJSIgaGVpZ2h0PSIxMjAlIj48ZmVNb3JwaG9sb2d5IGluPSJTb3VyY2VBbHBoYSIgb3BlcmF0b3I9ImRpbGF0ZSIgcmFkaXVzPSIxLjUiIHJlc3VsdD0iZCIvPjxmZUZsb29kIGZsb29kLWNvbG9yPSIjZmZmIiBmbG9vZC1vcGFjaXR5PSIuNyIvPjxmZUNvbXBvc2l0ZSBpbjI9ImQiIG9wZXJhdG9yPSJpbiIvPjxmZU1lcmdlPjxmZU1lcmdlTm9kZS8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjwvZGVmcz48ZyBmaWx0ZXI9InVybCgjbWNvMTMtaCkiPjxwYXRoIGQ9Ik03NyAzNS41IEw2NCA0MyBMNTEgMzUuNSBMNTEgMjAuNSBMNjQgMTMgTDc3IDIwLjVaIiBmaWxsPSIjN2E1N2U4IiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik01OS43IDc3LjUgTDQ2LjcgODUgTDMzLjcgNzcuNSBMMzMuNyA2Mi41IEw0Ni43IDU1IEw1OS43IDYyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik05NC4zIDc3LjUgTDgxLjMgODUgTDY4LjMgNzcuNSBMNjguMyA2Mi41IEw4MS4zIDU1IEw5NC4zIDYyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik00Mi4zIDEwNy41IEwyOS40IDExNSBMMTYuNCAxMDcuNSBMMTYuNCA5Mi41IEwyOS40IDg1IEw0Mi4zIDkyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik03NyAxMDcuNSBMNjQgMTE1IEw1MSAxMDcuNSBMNTEgOTIuNSBMNjQgODUgTDc3IDkyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xMTEuNiAxMDcuNSBMOTguNiAxMTUgTDg1LjcgMTA3LjUgTDg1LjcgOTIuNSBMOTguNiA4NSBMMTExLjYgOTIuNVoiIGZpbGw9IiNmZmM5NGEiIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9nPgo8L3N2Zz4K';

// Only the release overview: MC reads its tracklist, and the subpages (edit,
// cover-art, edit-relationships, …) belong to other scripts.
const RELEASE = (location.pathname.match(/^\/release\/([0-9a-fA-F-]{36})\/?$/) || [])[1];
// #702: and /release/add#mc=<token>, where First Contact's Consolidate hands over a release MusicBrainz doesn't have yet
const CONS = !RELEASE && /^\/release\/add\/?$/.test(location.pathname) ? (location.hash.match(/[#&]mc=([a-z0-9]+)/i) || [])[1] : null;
if (!RELEASE && !CONS) return;

// #811: the last 10 page logs with an Execute in them stay in this browser (an Execute reloads the page)
const Log = mbuLog({ name: 'Mission Control', version: VERSION, header: 'Mission Control — activity log', key: 'mc.logwin', before: () => mcStyle(), history: { prefix: 'mc:session:' } });
// keep this page's log, named after the release, once it does something worth reading back
function keepLog() {
    Log.keep();
    const h = document.querySelector('.releaseheader h1 bdi') || document.querySelector('.releaseheader h1');
    const name = h && h.textContent.trim();
    if (name) Log.name(name);
}
Log.cat('System').info(mbuStartupInfo('Mission Control'));

/* ── settings (GM storage, #501) ───────────────────────────────────────────── */

// fusion / ch: 'auto' fetches during Probe, 'ask' waits for the card's Fetch
// button, 'off' drops the step. Both fetches can take minutes (#680).
// linkedOpen: the sections whose already-linked are listed as rows (else: icons on its heading), one
// key each: a card's id, or PC's 'pc:release' / 'pc:artist' / 'pc:label'
// reloadAfter: reload the release page after an Execute without errors
// consAfter: after saving a consolidated release (#702), open Mission Control on it and probe
// consExec: …and Execute once that probe has finished, after a countdown a click cancels (#776); consExecS: its seconds
// review: Execute lists what it will send first, to confirm (#841); a right-click on Execute skips it
// disabled: the providers without a mode (PC, IS, AS) switched off with their step in the header (#753)
// platforms: the comparison with the platforms (#782), First Contact's reads: as fusion and ch
const DEFAULTS = { fusion: 'ask', ch: 'ask', platforms: 'auto', disabled: [], left: true, right: true, linkedOpen: [], autoProbe: true, reloadAfter: true, consAfter: true, consExec: false, consExecS: 10, ccDiffOpen: false, review: true, v: 3 };
// a card and the providers whose selections it holds (Tracks: the per-track ones without a card of their own)
const CARDS = [['tracks', ['is', 'fusion', 'fc']], ['pc', ['pc']], ['as', ['as']], ['ch', ['ch']]];
// The cards switched off with the switch in their header: folded, and Execute leaves out what is selected
// in them. For this page only, never saved: the next release starts with every card on.
const OFF = new Set();
const cardOff = id => OFF.has(id);
// and a provider switched off in the header (#753)
const providerOff = id => CARDS.some(([c, ps]) => cardOff(c) && ps.includes(id)) || modeOf(PROVIDERS.find(p => p.id === id)) === 'off';
function loadSettings() {
    let s = {};
    try { s = JSON.parse(GM_getValue('mc.settings', '{}')) || {}; } catch (e) { Log.cat('Settings').warn('settings unreadable, using defaults: ' + e.message); }
    // v2 turned autoProbe and reloadAfter on by default; the whole object was saved before, so a
    // false stored then is the old default, not a choice: drop it once and the new default shows
    if (!(s.v >= 2)) {
        if (s.autoProbe === false) delete s.autoProbe;
        if (s.reloadAfter === false) delete s.reloadAfter;
        s.v = 2;
        Log.cat('Settings').info('settings v2: probe on open and reload after Execute now default on');
    }
    // v3 made the Platforms step (First Contact's comparison) Auto by default; an 'ask' saved before is the old default
    if (!(s.v >= 3)) {
        if (s.platforms === 'ask') delete s.platforms;
        s.v = 3;
        Log.cat('Settings').info('settings v3: the Platforms step now compares on every probe by default');
    }
    return Object.assign({}, DEFAULTS, s);
}
const S = loadSettings();
function saveSettings() {
    try { GM_setValue('mc.settings', JSON.stringify(S)); } catch (e) { Log.cat('Settings').warn('settings not saved: ' + e.message); }
    Log.cat('Settings').debug('settings ' + JSON.stringify(S));
}

/* ── execution order ───────────────────────────────────────────────────────── */

// Each step is a provider; a step with `lanes` runs them in parallel (they hit
// different APIs with their own rate limits). `mode` names the setting that can
// switch an optional step to auto / ask / off.
const STEPS = [
    { id: 'pc', name: 'Release and entity links', short: 'PC', provider: 'Platform Check', glyph: '🔗' },
    // #782: reads the platforms Platform Check found (First Contact) and hands what the release lacks back to it
    { id: 'fc', name: 'Platforms', short: 'FC', provider: 'First Contact', glyph: '≡', mode: 'platforms' },
    { id: 'enrich', name: 'Enrich', glyph: '⇶', lanes: [
        { id: 'is', name: 'ISRCs & recording links', short: 'IS', provider: 'ISRC Scout', glyph: '#' },
        { id: 'as', name: 'Cover art', short: 'AS', provider: 'Art Station', glyph: '🖼' },
    ] },
    { id: 'fusion', name: 'Merge suggestions', short: 'Fusion', provider: 'Fusion', glyph: '⚛', mode: 'fusion' },
    { id: 'ch', name: 'Credits', short: 'CH', provider: 'Credit Hoarder', glyph: '✎', mode: 'ch', info: true },
];
const PROVIDERS = STEPS.flatMap(s => s.lanes || [s]);
// each provider's own userscript icon, for its badge (embedded: an image from raw.githubusercontent didn't load)
const PROVIDER_ICONS = {
    "fc": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5GaXJzdCBDb250YWN0PC90aXRsZT4KPGxpbmVhckdyYWRpZW50IGlkPSJmYy1kIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjYmFlNmZkIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMzhiZGY4Ii8+PC9saW5lYXJHcmFkaWVudD48cmFkaWFsR3JhZGllbnQgaWQ9ImZjLWIiIGN4PSIuMzUiIGN5PSIuMyIgcj0iLjgiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZjdjYyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2Y2YzQzMSIvPjwvcmFkaWFsR3JhZGllbnQ+PHBhdGggZD0iTTUwIDQyIEw3OCA0MiBMMTA0IDExMiBMMjQgMTEyIFoiIGZpbGw9IiNmNmM0MzEiIG9wYWNpdHk9Ii45Ii8+PHBhdGggZD0iTTU2IDQyIEw3MiA0MiBMODggMTEyIEw0MCAxMTIgWiIgZmlsbD0iI2ZkZTY4YSIgb3BhY2l0eT0iLjciLz48ZWxsaXBzZSBjeD0iNjQiIGN5PSIxMTQiIHJ4PSI0MiIgcnk9IjgiIGZpbGw9IiMxZTIzNDYiIHN0cm9rZT0iI2M5Y2RmMiIgc3Ryb2tlLXdpZHRoPSIzIi8+PGVsbGlwc2UgY3g9IjY0IiBjeT0iMTEzIiByeD0iMjYiIHJ5PSI0LjIiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y2YzQzMSIgc3Ryb2tlLXdpZHRoPSIyLjQiLz48cGF0aCBkPSJNNDIgMjggQTIyIDE4IDAgMCAxIDg2IDI4IFoiIGZpbGw9InVybCgjZmMtZCkiIHN0cm9rZT0iI2M5Y2RmMiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTUwLjM2IDE5LjkgQTE1LjM5OTk5OTk5OTk5OTk5OSAxMy41IDAgMCAxIDYxLjggMTEuOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIuNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBvcGFjaXR5PSIuOSIvPjxlbGxpcHNlIGN4PSI2NCIgY3k9IjMyIiByeD0iNTYiIHJ5PSIxMiIgZmlsbD0iIzFlMjM0NiIgc3Ryb2tlPSIjYzljZGYyIiBzdHJva2Utd2lkdGg9IjMiLz48ZWxsaXBzZSBjeD0iNjQiIGN5PSI0MCIgcng9IjIyIiByeT0iNiIgZmlsbD0idXJsKCNmYy1iKSIgc3Ryb2tlPSIjYzljZGYyIiBzdHJva2Utd2lkdGg9IjIuNCIvPjxjaXJjbGUgY3g9IjIyIiBjeT0iMzEiIHI9IjQiIGZpbGw9IiNmNmM0MzEiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjMxIiByPSI0IiBmaWxsPSIjZjZjNDMxIi8+PGNpcmNsZSBjeD0iODgiIGN5PSIzMSIgcj0iNCIgZmlsbD0iI2Y2YzQzMSIvPjxjaXJjbGUgY3g9IjEwNiIgY3k9IjMxIiByPSI0IiBmaWxsPSIjZjZjNDMxIi8+PHBhdGggZD0iTTY0IDU4IEw4NCA2OS41IEw4NCA5Mi41IEw2NCAxMDQgTDQ0IDkyLjUgTDQ0IDY5LjUgWiIgZmlsbD0iIzdiNGZkNiIvPjxwYXRoIGQ9Ik02NCA1OCBMODQgNjkuNSBMNjQgODEgTDQ0IDY5LjUgWiIgZmlsbD0iIzliNzJlYSIvPjxwYXRoIGQ9Ik02MCA3MiBMNzQgNjkgTDc0IDg5IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMy40IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTYwIDcyIEw2MCA5MiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMuNCIvPjxlbGxpcHNlIGN4PSI1NiIgY3k9IjkyIiByeD0iNC42IiByeT0iMy42IiBmaWxsPSIjZmZmIi8+PGVsbGlwc2UgY3g9IjcwIiBjeT0iODkiIHJ4PSI0LjYiIHJ5PSIzLjYiIGZpbGw9IiNmZmYiLz4KPC9zdmc+Cg==",
    "pc": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5NQiBQbGF0Zm9ybSBDaGVjazwvdGl0bGU+CjxnIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik02NCA2NCBMODggMjIuNCIvPjxwYXRoIGQ9Ik02NCA2NCBMMTEyIDY0Ii8+PHBhdGggZD0iTTY0IDY0IEw4OCAxMDUuNiIvPjxwYXRoIGQ9Ik02NCA2NCBMNDAgMTA1LjYiLz48cGF0aCBkPSJNNjQgNjQgTDE2IDY0Ii8+PHBhdGggZD0iTTY0IDY0IEw0MCAyMi40Ii8+PC9nPjxjaXJjbGUgY3g9Ijg4IiBjeT0iMjIuNCIgcj0iMTIiIGZpbGw9IiNmNDcyYjYiLz48Y2lyY2xlIGN4PSIxMTIiIGN5PSI2NCIgcj0iMTIiIGZpbGw9IiNmYWNjMTUiLz48Y2lyY2xlIGN4PSI4OCIgY3k9IjEwNS42IiByPSIxMiIgZmlsbD0iIzRhZGU4MCIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iMTA1LjYiIHI9IjEyIiBmaWxsPSIjMzhiZGY4Ii8+PGNpcmNsZSBjeD0iMTYiIGN5PSI2NCIgcj0iMTIiIGZpbGw9IiNhNzhiZmEiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjIyLjQiIHI9IjEyIiBmaWxsPSIjZmI5MjNjIi8+PGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iMjQiIGZpbGw9IiMwZjE3MmEiLz48cGF0aCBkPSJNNTQuMjIyMjIyMjIyMjIyMjIgNjQgTDYxLjMzMzMzMzMzMzMzMzMzNiA3MS4xMTExMTExMTExMTExMSBMNzQuNjY2NjY2NjY2NjY2NjcgNTYuODg4ODg4ODg4ODg4ODg2IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=",
    "is": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+DQogIDx0aXRsZT5JU1JDIFNjb3V0PC90aXRsZT4NCiAgICA8cGF0aCBkPSJNNjQgNjQgTDY0IDI0IEE0MCA0MCAwIDAgMSA5OSA4NCBaIiBmaWxsPSIjZTNkOGY3Ii8+DQogIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZmNDJjMSIgc3Ryb2tlLXdpZHRoPSI2Ij4NCiAgICA8Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI0MCIvPg0KICAgIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjI2IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZT0iI2I5YTNlOCIvPg0KICAgIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjEzIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZT0iI2I5YTNlOCIvPg0KICA8L2c+DQogIDxsaW5lIHgxPSI2NCIgeTE9IjY0IiB4Mj0iNjQiIHkyPSIyNCIgc3Ryb2tlPSIjNmY0MmMxIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPg0KICA8Y2lyY2xlIGN4PSI4NiIgY3k9IjUwIiByPSI3IiBmaWxsPSIjNGIyZTgzIi8+DQo8L3N2Zz4NCg==",
    "as": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5BcnQgU3RhdGlvbjwvdGl0bGU+CjxjaXJjbGUgY3g9Ijg2IiBjeT0iNjQiIHI9IjM4IiBmaWxsPSIjMWIwZjNiIiBzdHJva2U9IiNiOTY3ZmYiIHN0cm9rZS13aWR0aD0iMyIvPgo8Y2lyY2xlIGN4PSI4NiIgY3k9IjY0IiByPSIyOC44OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNGEzNDgwIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxjaXJjbGUgY3g9Ijg2IiBjeT0iNjQiIHI9IjIwLjkwMDAwMDAwMDAwMDAwMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNGEzNDgwIiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8Y2lyY2xlIGN4PSI4NiIgY3k9IjY0IiByPSIxMS4wMiIgZmlsbD0iI2ZmNzFjZSIvPjxjaXJjbGUgY3g9Ijg2IiBjeT0iNjQiIHI9IjIuNTA4IiBmaWxsPSIjMWIwZjNiIi8+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhcy1za3ljIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwLjAwIiBzdG9wLWNvbG9yPSIjN2ZlN2ZmIi8+PHN0b3Agb2Zmc2V0PSIwLjUwIiBzdG9wLWNvbG9yPSIjZDlhNmZmIi8+PHN0b3Agb2Zmc2V0PSIxLjAwIiBzdG9wLWNvbG9yPSIjZmY3MWNlIi8+PC9saW5lYXJHcmFkaWVudD48Y2xpcFBhdGggaWQ9ImFzLWNjIj48cmVjdCB4PSIxMCIgeT0iMjIiIHdpZHRoPSI3OCIgaGVpZ2h0PSI4NCIgcng9IjgiLz48L2NsaXBQYXRoPjwvZGVmcz4KPGcgY2xpcC1wYXRoPSJ1cmwoI2FzLWNjKSI+PHJlY3QgeD0iMTAiIHk9IjIyIiB3aWR0aD0iNzgiIGhlaWdodD0iODQiIGZpbGw9InVybCgjYXMtc2t5YykiLz4KPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhcy1nczIiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmZmY2YTgiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNmZjhhNWMiLz48L2xpbmVhckdyYWRpZW50Pgo8bWFzayBpZD0iYXMtbXMyIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjI1LjYiIHk9IjY3LjIiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjEuMiIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9IjY5LjgiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjEuNSIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9IjczLjAiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjEuOCIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9Ijc3LjAiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjIuMyIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9IjgyLjAiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjIuOSIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9Ijg4LjMiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjMuNiIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9Ijk2LjIiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjQuNSIgZmlsbD0iIzAwMCIvPjwvbWFzaz48L2RlZnM+CjxjaXJjbGUgY3g9IjQ5IiBjeT0iNzYuMDgiIHI9IjIzLjQiIGZpbGw9InVybCgjYXMtZ3MyKSIgbWFzaz0idXJsKCNhcy1tczIpIi8+PHJlY3QgeD0iMTAiIHk9Ijc0LjA4IiB3aWR0aD0iNzgiIGhlaWdodD0iMzEuOTIiIGZpbGw9IiNiOTY3ZmYiLz48cGF0aCBkPSJNMTAgNzQuMDhIODhNMTAgNzcuOUg4OE0xMCA4My4ySDg4TTEwIDkxLjRIODhNMTAgMTA0LjJIODhNMzQuOCA3NC4wOEwtNDguNSAxMDZNMzguNCA3NC4wOEwtMjQuMSAxMDZNNDEuOSA3NC4wOEwwLjMgMTA2TTQ1LjUgNzQuMDhMMjQuNiAxMDZNNDkuMCA3NC4wOEw0OS4wIDEwNk01Mi41IDc0LjA4TDczLjQgMTA2TTU2LjEgNzQuMDhMOTcuOCAxMDZNNTkuNiA3NC4wOEwxMjIuMSAxMDZNNjMuMiA3NC4wOEwxNDYuNSAxMDYiIHN0cm9rZT0iI2ZmZmI5NiIgc3Ryb2tlLXdpZHRoPSIxLjMiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvZz48cmVjdCB4PSIxMCIgeT0iMjIiIHdpZHRoPSI3OCIgaGVpZ2h0PSI4NCIgcng9IjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzJhMTQ1OCIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjwvc3ZnPgo=",
    "fusion": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+CiAgPHRpdGxlPkZ1c2lvbjwvdGl0bGU+CiAgPGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYTE4NGY4IiBzdHJva2Utd2lkdGg9IjUuNSI+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiLz4KICAgIDxlbGxpcHNlIGN4PSI2NCIgY3k9IjY0IiByeD0iNTIiIHJ5PSIyMiIgdHJhbnNmb3JtPSJyb3RhdGUoNjAgNjQgNjQpIi8+CiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiIHRyYW5zZm9ybT0icm90YXRlKDEyMCA2NCA2NCkiLz4KICA8L2c+CiAgPGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iMTEiIGZpbGw9IiM3YzRkZmYiLz4KPC9zdmc+Cg==",
    "ch": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9Ii0xNS41IC0xLjUgMTM2LjUgMTM2LjUiIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij4KPHRpdGxlPkNyZWRpdCBIb2FyZGVyPC90aXRsZT4KPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJjaGMwNC1nIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZjlhODI2Ii8+PHN0b3Agb2Zmc2V0PSIuNSIgc3RvcC1jb2xvcj0iI2YzNzIyYyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2QwMDA3MCIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxnIG9wYWNpdHk9Ii43Ij48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSg2NiA3MCkgcm90YXRlKDApIHNjYWxlKDEuNTUpIHRyYW5zbGF0ZSgtNjYgLTcwKSI+PGcgZmlsbD0iI2ZmZiIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEuOTM1NDgzODcwOTY3NzQxOCI+PGVsbGlwc2UgY3g9IjMwIiBjeT0iODAiIHJ4PSIxNCIgcnk9IjEwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI3NiIgcj0iOCIvPjxjaXJjbGUgY3g9IjY2IiBjeT0iNzAiIHI9IjEwIi8+PC9nPjxnIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI1LjE2MTI5MDMyMjU4MDY0NSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMjYgODYgbC02IDEyIE0zNCA4OCBsMiAxMiBNNDYgODIgbC00IDE2IE01MiA4NCBsOCAxNCIvPjwvZz48L2c+PGcgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjYuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNNzIgNjIgQzc4IDUyIDg2IDQ4IDkyIDQ4IE03MCA2MiBDNzIgNTIgNzAgNDQgNjQgNDAiLz48L2c+PHBhdGggZD0iTTExMy42IDQ1LjAgTDk4LjAgNTQuMCBMODIuNCA0NS4wIEw4Mi40IDI3LjAgTDk4LjAgMTguMCBMMTEzLjYgMjcuMFoiIGZpbGw9IiNmZmYiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSI2IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiB0cmFuc2Zvcm09InJvdGF0ZSgtMTAgOTggMzYpIi8+PC9nPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDY2IDcwKSByb3RhdGUoMCkgc2NhbGUoMS41NSkgdHJhbnNsYXRlKC02NiAtNzApIj48ZyBmaWxsPSIjMjIyMjNiIiBzdHJva2U9Im5vbmUiIHN0cm9rZS13aWR0aD0iMCI+PGVsbGlwc2UgY3g9IjMwIiBjeT0iODAiIHJ4PSIxNCIgcnk9IjEwIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI3NiIgcj0iOCIvPjxjaXJjbGUgY3g9IjY2IiBjeT0iNzAiIHI9IjEwIi8+PC9nPjxnIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSIzLjIyNTgwNjQ1MTYxMjkwMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNMjYgODYgbC02IDEyIE0zNCA4OCBsMiAxMiBNNDYgODIgbC00IDE2IE01MiA4NCBsOCAxNCIvPjwvZz48L2c+PGcgc3Ryb2tlPSIjMjIyMjNiIiBzdHJva2Utd2lkdGg9IjMuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIj48cGF0aCBkPSJNNzIgNjIgQzc4IDUyIDg2IDQ4IDkyIDQ4IE03MCA2MiBDNzIgNTIgNzAgNDQgNjQgNDAiLz48L2c+PHBhdGggZD0iTTExMy42IDQ1LjAgTDk4LjAgNTQuMCBMODIuNCA0NS4wIEw4Mi40IDI3LjAgTDk4LjAgMTguMCBMMTEzLjYgMjcuMFoiIGZpbGw9InVybCgjY2hjMDQtZykiIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiB0cmFuc2Zvcm09InJvdGF0ZSgtMTAgOTggMzYpIi8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoOTggMzcpIHNjYWxlKDAuOSkiIGZpbGw9IiNmZmYiPjxjaXJjbGUgY3g9IjAiIGN5PSItNSIgcj0iNSIvPjxwYXRoIGQ9Ik0tOSA5IEMtOSAwIDkgMCA5IDlaIi8+PC9nPgo8L3N2Zz4K"
};

/* ── provider bus ──────────────────────────────────────────────────────────── */

// MC asks with 'mc:discover'; each member script that has an adapter answers
// with 'mc:provider'. Details are JSON strings, never objects: scripts run in
// separate sandboxes, and Firefox's Xray wrappers hide an object's fields from
// another realm. Contract: DEVELOP.md.
const found = {};   // provider id -> { name, version, capabilities }
document.addEventListener('mc:provider', e => {
    let d;
    try { d = JSON.parse(e.detail); } catch (x) { Log.cat('Settings').warn('mc:provider with unreadable detail: ' + x.message); return; }
    if (!d || !d.id) { Log.cat('Settings').warn('mc:provider without an id'); return; }
    found[d.id] = d;
    if (d.id === 'fc' && !CONS && results.pc) setTimeout(pcVet, 0);   // #792: the links held for want of it
    Log.cat('Settings').info('provider ' + d.id + ' answered: ' + (d.name || '?') + ' v' + (d.version || '?') + ' · ' + JSON.stringify(d.capabilities || []));
    if (ui) { paintBadges(); paintReleaseCredits(); fitCards(); }
});

// Probe: MC sends 'mc:probe' { release, run, only }; a provider answers with
// 'mc:progress' { id, run, state, note } while it works and 'mc:findings'
// { id, run, findings } when done. Events from an older run are ignored.
const results = {};   // provider id -> { state: 'busy' | 'done', note, findings }
const picked = {};    // provider id -> Set of finding keys selected for Execute
const fxOpen = new Set();   // tracks (recording MBIDs) whose Fusion comparison is open under their row
const fxBusy = new Set();   // tracks whose group Fusion is checking (or is queued to check) for ISRCs and AcoustIDs
const fxWaiters = new Map();   // track -> resolves when Fusion answers that track's check
let fxCheckGen = 0;   // a newer Fusion answer stops the check queue of the one before
let run = null;
// #782: the comparison with the platforms (the Platforms step): waiting for Platform Check's platforms, what it
// brings for Platform Check (cons) and ISRC Scout (isrcs, by track), the release's title on the platforms when it differs
const CMP = { waiting: false, cons: null, isrcs: null, title: null, timer: 0, picks: {} };   // picks: track index → { title?, ms?, recording?, from }
function busEvent(e, kind) {
    let d;
    try { d = JSON.parse(e.detail); } catch (x) { Log.cat('Providers').warn(kind + ' with unreadable detail: ' + x.message); return null; }
    if (!d || !d.id) { Log.cat('Providers').warn(kind + ' without an id'); return null; }
    if (d.run !== run) { Log.cat('Providers').debug(kind + ' from ' + d.id + ' for run ' + d.run + ', not the current ' + run + ' — ignored'); return null; }
    return d;
}
document.addEventListener('mc:progress', e => {
    const d = busEvent(e, 'mc:progress'); if (!d) return;
    const r = results[d.id];
    // during Execute a provider that already answered keeps its findings: the note goes beside them
    // (a late tick from the probe, after its findings, is dropped: no stuck spinner)
    if (r && r.state === 'done') { if (executing) { r.working = d.note || 'working'; r.at = Date.now(); if (d.best) r.best = d.best; } }
    else results[d.id] = Object.assign(r || {}, { state: 'busy', note: d.note || '', at: Date.now() });
    Log.cat('Providers').debug('progress ' + d.id + ': ' + (d.note || d.state));
    paintAll();
});
// #730: MusicBrainz's special-purpose entities — Various Artists, [anonymous], [data], [dialogue],
// [no artist], [traditional], [unknown] and the label [no label]. Since MBS-14146 (musicbrainz-server
// #3626) a regular editor can't edit any of them: the edit page never loads. The list is MusicBrainz's
// own, root/static/scripts/common/constants.js (SPECIAL_ARTIST_GIDS, NOLABEL_GID).
const SPECIAL_PURPOSE = new Set([
  '89ad4ac3-39f7-470e-963a-56509c546377', 'f731ccc4-e22a-43af-a747-64213329e088', '33cf029c-63b0-41a0-9855-be2a3665fb3b',
  '314e1c25-dde7-4e4d-b2f4-0a7b9f7c56dc', 'eec63d3c-3b81-4ad4-b1e4-7c147d4d2b61', '9be7f096-97ec-4615-8957-8d40b5dcbc41',
  '125ec42a-7229-4250-afc5-e057484327fe', '157afde4-4bf5-4039-8ad2-5a15acc85176',
]);
const isSpecialPurpose = (type, mbid) => (type === 'artist' || type === 'label') && SPECIAL_PURPOSE.has(String(mbid || '').toLowerCase());
// a finding on one is left out (state 'none'), whichever provider sent it: Falcon couldn't apply it
function dropSpecialPurpose(x) {
    if (x && x.entity && isSpecialPurpose(x.entity.type, x.entity.mbid) && x.state !== 'none') {
        Log.cat('Probe').info('left out: ' + x.entity.type + ' ' + (x.entity.name || x.entity.mbid) + ' is special-purpose, not editable (#730)');
        x.state = 'none'; x.why = 'special-purpose ' + x.entity.type + ': MusicBrainz lets only a few editors change it';
    }
    return x;
}
document.addEventListener('mc:findings', e => {
    const d = busEvent(e, 'mc:findings'); if (!d) return;
    const findings = (Array.isArray(d.findings) ? d.findings : []).map(dropSpecialPurpose);
    results[d.id] = { state: 'done', findings, summary: d.summary || '', best: d.best || null, open: Array.isArray(d.open) ? d.open : null, barcode: d.barcode || null };
    // selected by default: only what the provider is sure of
    // #810: a label has one catalog number, so of its sure ones only the consolidation's (else the first) is
    const catOf = x => x.kind === 'catno' && x.label && x.label.mbid;
    const catPick = new Map();
    findings.filter(x => x.state === 'new' && catOf(x)).forEach(x => { if (!catPick.has(catOf(x)) || (x.cons && !catPick.get(catOf(x)).cons)) catPick.set(catOf(x), x); });
    picked[d.id] = new Set(findings.filter(x => x.state === 'new' && (!catOf(x) || catPick.get(catOf(x)) === x)).map(x => x.key));
    if (findings.some(x => x.state === 'new' && catOf(x) && catPick.get(catOf(x)) !== x)) Log.cat('Probe').debug('catalog numbers: one per label selected, ' + [...catPick.values()].map(x => x.label.name + ' ' + x.code).join(', '));
    afterPicks(d.id);
    const tally = findings.reduce((t, x) => (t[x.state] = (t[x.state] || 0) + 1, t), {});
    Log.cat('Probe').ok('findings ' + d.id + ': ' + findings.length + ' ' + JSON.stringify(tally));
    noteProbeDone();
    if (d.id === 'fusion') fxAutoCheck();
    if (d.id === 'pc' && CMP.waiting) cmpStart();   // #782: the comparison waited for Platform Check's platforms
    if (d.id === 'pc' && !CONS) pcVet();   // #792
    findings.forEach(x => Log.cat('Probe').debug('  ' + d.id + ' ' + x.key + ' ' + x.state + (x.why ? ' (' + x.why + ')' : '') + (x.url ? ' ' + x.url : '')));
    paintAll();
    syncLinks();
});
// a provider sends some findings again (Fusion, after checking one group's ISRCs and AcoustIDs):
// each replaces the one with its key and keeps its selection, unless it can't be selected any more
document.addEventListener('mc:update', e => {
    const d = busEvent(e, 'mc:update'); if (!d) return;
    (d.keys || []).forEach(k => { fxBusy.delete(k); const w = fxWaiters.get(k); if (w) { fxWaiters.delete(k); w(); } });
    if (d.error) mbuToast(((PROVIDERS.find(p => p.id === d.id) || {}).provider || d.id) + ': ' + d.error);
    const r = results[d.id];
    if (r && r.state === 'done' && r.findings) {
        for (const x of (Array.isArray(d.findings) ? d.findings : []).map(dropSpecialPurpose)) {
            const i = r.findings.findIndex(y => y.key === x.key);
            if (i === -1) r.findings.push(x); else r.findings[i] = x;
            if (!PICKABLE[x.state] && picked[d.id]) picked[d.id].delete(x.key);
            fxBusy.delete(x.key);
        }
        Log.cat('Probe').ok('update ' + d.id + ': ' + (d.findings || []).length + ' finding(s)');
    }
    paintAll();
});
// ISRC Scout reads the release's album links (Bandcamp, Spotify, Apple…) for its ISRCs and
// recording links, Art Station for its cover (#724). The album links selected in Platform Check's
// card are not on the release yet (Execute adds them first), so both are probed with them too:
// again whenever the selected set changes, once the probe out is answered. Nothing is asked of
// either before the first Probe.
const laneOpen = new Set();   // PC barcode lanes opened into rows (#680), by barcode digits
const LINK_READERS = ['is', 'as'];
const linksAsked = {};   // provider id → the album links its current findings were probed with (JSON)
function pcAlbumLinks() {
    const r = results.pc, set = picked.pc;
    if (!r || r.state !== 'done' || !set) return [];
    return (r.findings || []).filter(x => !x.entity && x.url && x.state !== 'linked' && x.state !== 'none' && set.has(x.key)).map(x => x.url).sort();
}
let _linksTimer = 0;
function syncLinks(delay) {
    clearTimeout(_linksTimer);
    if (delay) { _linksTimer = setTimeout(syncLinks, delay); return; }
    if (executing) return;
    const now = JSON.stringify(pcAlbumLinks());
    for (const id of LINK_READERS) {
        const r = results[id];
        if (!found[id] || !r || r.state === 'busy' || now === linksAsked[id]) continue;
        Log.cat('Probe').info('the selected album links changed: asking ' + ((PROVIDERS.find(p => p.id === id) || {}).provider || id) + ' again (was ' + (linksAsked[id] || 'none') + ', now ' + now + ')');
        probeOne(id);
    }
}
function probe() {
    if (autoTimer) autoExecCancel('a new probe started');
    run = Date.now().toString(36);
    cmpReset();
    fxCheckGen++;   // the last answer's check queue stops
    for (const k in results) delete results[k];
    for (const k in picked) delete picked[k];
    const ask = PROVIDERS.filter(p => found[p.id] && modeOf(p) === 'auto').map(p => p.id);
    ask.forEach(id => { results[id] = { state: 'busy', note: '', at: Date.now() }; });
    probeAt = Date.now(); probeTook = 0;
    LINK_READERS.forEach(id => { linksAsked[id] = '[]'; });   // nothing is selected yet
    Log.cat('Probe').info('probe run ' + run + ' · asking ' + (ask.join(', ') || 'nobody') + '');
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ release: RELEASE, run, only: ask.filter(id => id !== 'fc'), links: [], isrcs: isrcsNow(), cons: CMP.cons || undefined }) }));
    // #782: the comparison starts once Platform Check has answered; Update this release runs it whatever its mode
    if (found.fc && (ask.includes('fc') || (AFTER && AFTER.compare && !AFTER.compared))) { if (AFTER && AFTER.compare) AFTER.compared = true; cmpStart(); }
    paintAll();
    return ask.length;
}
// An Ask-mode provider is probed on its own Fetch button, inside the current run
// (a run is started if there is none), leaving the others' results alone.
function probeOne(id) {
    if (!found[id]) return;
    if (id === 'fc') { cmpStart(); return; }
    if (!run) run = Date.now().toString(36);
    delete picked[id];
    if (id === 'fusion') fxCheckGen++;
    results[id] = { state: 'busy', note: '', at: Date.now() };
    probeAt = Date.now(); probeTook = 0;
    const links = pcAlbumLinks();
    if (LINK_READERS.includes(id)) linksAsked[id] = JSON.stringify(links);
    Log.cat('Probe').info('probe ' + id + ' on request · run ' + run + (links.length ? ' · selected album links ' + links.join(' ') : ''));
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ release: RELEASE, run, only: [id], links, isrcs: isrcsNow(), cons: CMP.cons || undefined }) }));
    paintAll();
}
// Execute: the steps in order, the lanes of a parallel step together. Each
// provider with selected findings gets 'mc:apply' { id, run, release, keys, dry }
// and answers 'mc:applied' { id, run, ok, sent, note }. A provider works as long as it keeps
// saying so (mc:progress, each one restarts APPLY_SILENT), up to APPLY_MAX in all; one silent for
// longer, or still at it then, counts as failed, and the next step still runs. Its answer, when it
// comes after all, is still taken (lateApplied): what it applied shows as applied.
let APPLY_SILENT = 60000, APPLY_MAX = 10 * 60000;
let executing = false;
const lateApplied = {};   // provider id -> the listener for an answer that came after the wait
// what a provider's answer applied shows as linked: all it was given, or (#748) what it says is done
function takeApplied(o, dry) {
    if (dry) return;
    if (o.ok && o.sent && o.via !== 'falcon') markApplied(o.id, o.keys || []);
    else if (Array.isArray(o.doneKeys) && o.doneKeys.length) markApplied(o.id, o.doneKeys);
}
function applyOne(id, dry) {
    const keys = Array.from(picked[id] || []);
    const tracks = id === 'pc' ? pfChanges() : [];   // #782: the track titles and lengths taken in on the tracks
    if (lateApplied[id]) { document.removeEventListener('mc:applied', lateApplied[id]); delete lateApplied[id]; }
    return new Promise(resolve => {
        // a provider still working says so with mc:progress, and each one restarts the wait (#680: a cover upload takes minutes)
        const done = o => { document.removeEventListener('mc:applied', on); document.removeEventListener('mc:progress', alive); clearTimeout(t); clearTimeout(cap); if (results[id]) delete results[id].working; resolve(o); };
        const on = e => { const d = busEvent(e, 'mc:applied'); if (d && d.id === id) done(Object.assign({ keys }, d)); };
        const late = e => {
            const d = busEvent(e, 'mc:applied'); if (!d || d.id !== id) return;
            document.removeEventListener('mc:applied', late); delete lateApplied[id];
            const o = Object.assign({ keys }, d);
            results[id] = Object.assign(results[id] || {}, { applied: o });
            takeApplied(o, dry);
            if (o.ok) Log.cat('Execute').ok(id + ': answered late: ' + (o.note || 'done')); else Log.cat('Execute').err(id + ': answered late: ' + (o.note || 'failed'));
            paintAll();
        };
        const giveUp = why => { done({ id, ok: false, sent: 0, note: why + ' (its answer is still taken if it comes)' }); lateApplied[id] = late; document.addEventListener('mc:applied', late); };
        const ago = ms => ms >= 60000 ? ms / 60000 + ' min' : ms / 1000 + ' s';
        const timeout = () => setTimeout(() => giveUp('no word for ' + ago(APPLY_SILENT)), APPLY_SILENT);
        let t = timeout();
        const cap = setTimeout(() => giveUp('not done in ' + ago(APPLY_MAX)), APPLY_MAX);
        const alive = e => { let d = null; try { d = JSON.parse(e.detail); } catch (x) { return; } if (d && d.id === id && d.run === run) { clearTimeout(t); t = timeout(); } };
        document.addEventListener('mc:applied', on);
        document.addEventListener('mc:progress', alive);
        if (results[id]) Object.assign(results[id], { working: dry ? 'queueing' : 'applying', at: Date.now() });
        Log.cat('Execute').info((dry ? 'dry run' : 'apply') + ' ' + id + ': ' + keys.length + ' item(s) ' + JSON.stringify(keys) + (id === 'as' && asMore() ? ' + ' + asMore() + ' gallery change(s)' : '') + (tracks.length ? ' + tracks ' + JSON.stringify(tracks) : ''));
        document.dispatchEvent(new CustomEvent('mc:apply', { detail: JSON.stringify(Object.assign({ id, run, release: RELEASE, keys, dry: !!dry, mc: VERSION, mcName: (typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.name) || 'Mission Control' }, tracks.length ? { tracks } : {})) }));
    });
}
// #680: a provider that hands its edits to Falcon tags the batch 'mc:<id>:<run>'. Falcon runs
// it with its panel shut and reports each change as falcon:status; the card shows it.
document.addEventListener('falcon:status', e => {
    let d = null;
    try { d = JSON.parse(e.detail); } catch (x) { return; }
    const m = d && /^mc:([a-z]+):(.+)$/.exec(d.tag || '');
    if (!m || m[2] !== run || !results[m[1]]) return;
    const r = results[m[1]];
    r.falcon = { running: !!d.running, items: d.items || [] }; r.at = Date.now();
    if (r.falconWait && !d.running && !r.falcon.items.some(i => ['queued', 'active'].includes(i.status))) { r.falconWait = false; Log.cat('Execute').debug('falcon ' + m[1] + ': batch settled'); }
    // the findings of each item Falcon finished (done, or skipped as already there) are linked now
    const fin = (d.items || []).filter(i => i.status === 'done' || i.status === 'skipped');
    const keys = (r.falconKeys || []).filter(k => { const x = (r.findings || []).find(f => f.key === k); return x && fin.some(i => x.entity ? i.mbid === x.entity.mbid : i.entityType === 'release'); });
    if (keys.length) { markApplied(m[1], keys); r.falconKeys = r.falconKeys.filter(k => !keys.includes(k)); }
    Log.cat('Execute').info('falcon ' + m[1] + ': ' + (d.items || []).map(i => i.entityType + ' ' + (i.name || i.mbid) + ' ' + i.status + (i.error ? ' (' + i.error + ')' : '')).join(' · '));
    paintAll();
    if (reloadPending) reloadWhenClean();
});
// reloadAfter: an Execute with no errors reloads the release page so it shows the new data. A batch
// handed to Falcon runs in this page, so the reload waits for it and drops if an item went wrong.
let reloadPending = false, reloadGiveUp = 0;
function reloadWhenClean() {
    const fs = Object.values(results).map(r => r.falcon).filter(Boolean);
    // #825: Falcon's first status comes after Execute returns, so wait on the hand-off itself too
    const waiting = Object.keys(results).filter(k => results[k].falconWait);
    if (waiting.length || fs.some(f => f.running)) {
        Log.cat('Execute').debug('reload after Execute waits for Falcon' + (waiting.length ? ': ' + waiting.join(', ') : ''));
        if (!reloadGiveUp) reloadGiveUp = setTimeout(() => { if (!reloadPending) return; reloadPending = false; Log.cat('Execute').warn('reload after Execute dropped: Falcon did not finish within 5 minutes'); }, 300000);
        return;
    }
    reloadPending = false;
    clearTimeout(reloadGiveUp); reloadGiveUp = 0;
    if (fs.some(f => f.items.some(i => !['done', 'skipped'].includes(i.status)))) { Log.cat('Execute').warn('reload after Execute dropped: Falcon reported a problem'); return; }
    Log.cat('Execute').info('Execute done without errors: reloading the release page');
    setTimeout(() => location.reload(), 1200);
}
// #776 consExec: after a consolidation opened Mission Control, Execute once the probe has finished
// (every provider answered, the second ask after the album links changed included), after a
// countdown on the Execute button that a click cancels, like Falcon's Auto send on Harmony
const AUTO_EXEC_SETTLE = 1500, AUTO_EXEC_GIVEUP = 180000;
let autoArmed = 0, autoSettle = 0, autoGiveUp = 0, autoTimer = 0, autoEnd = 0;
function autoExecArm() {
    autoArmed = Date.now();
    clearTimeout(autoGiveUp);
    autoGiveUp = setTimeout(() => { if (autoArmed) { autoArmed = 0; Log.cat('Execute').warn('auto execute: the probe hasn\'t finished in ' + AUTO_EXEC_GIVEUP / 60000 + ' min: no Execute'); } }, AUTO_EXEC_GIVEUP);
    Log.cat('Execute').info('auto execute: waiting for the probe to finish');
    autoExecCheck();
}
function autoExecCheck() {
    if (!autoArmed || autoTimer || autoSettle || isProbing() || executing) return;
    // a short wait: an answer can set off another ask (the album links), which is waited for too;
    // still probing then, the next answer's paint checks again
    autoSettle = setTimeout(() => {
        autoSettle = 0;
        if (!autoArmed || autoTimer || isProbing() || executing) return;
        autoArmed = 0; clearTimeout(autoGiveUp);
        if (!ui) { Log.cat('Execute').info('auto execute: Mission Control was closed: no Execute'); return; }
        const n = changeCount();
        if (!n) { Log.cat('Execute').info('auto execute: the probe selected nothing: no Execute'); return; }
        autoEnd = Date.now() + S.consExecS * 1000;
        Log.cat('Execute').info('auto execute: ' + n + ' change(s) in ' + S.consExecS + ' s, click Execute to cancel');
        autoTimer = setInterval(autoExecTick, 100);
        paintExec();
    }, AUTO_EXEC_SETTLE);
}
function autoExecTick() {
    if (!ui) { autoExecCancel('Mission Control was closed'); return; }
    if (isProbing()) { autoExecCancel('a new probe started'); return; }
    if (!changeCount()) { autoExecCancel('nothing is selected any more'); return; }
    if (Date.now() < autoEnd) { paintExec(); return; }
    clearInterval(autoTimer); autoTimer = 0;
    Log.cat('Execute').info('auto execute: started');
    execute(false);   // #841: no review, the countdown was it
}
// true when a countdown was running (the click that cancels it doesn't also execute)
function autoExecCancel(why) {
    if (!autoTimer && !autoArmed) return false;
    const counting = !!autoTimer;
    clearInterval(autoTimer); clearTimeout(autoSettle); clearTimeout(autoGiveUp);
    autoSettle = 0;
    autoTimer = 0; autoArmed = 0;
    Log.cat('Execute').info('auto execute: cancelled, ' + why);
    if (ui) paintExec();
    return counting;
}
const FALCON_MARK = { queued: ['…', 'waiting'], active: ['⟳', 'running'], done: ['✓', 'done'], skipped: ['✓', 'already there'], partial: ['!', 'partly done'], failed: ['✕', 'failed'], manual: ['✋', 'needs you'] };
// #680: the cover Art Station picked (headless), shown before Execute enters it
// with the current front beside it when there is one, and what Execute would do
function bestHtml(b) {
    if (!b) return '';
    const kb = n => n ? (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB') : '';
    // a click on a cover opens it full screen, the other one a ← / → away (coverViewer)
    let n = 0;
    // `alt`: the full image, for a thumbnail that fails (a cover in an open edit has no CAA thumbnails yet)
    const fig = (src, alt, title, lines) => '<div class="mc-best-c">' + (src ? '<button type="button" class="mc-cov" data-act="cover" data-i="' + (n++) + '" data-tip="Show it full screen\n← →: compare"><img alt="" src="' + esc(src) + '"' + (alt && alt !== src ? ' data-alt="' + esc(alt) + '"' : '') + '></button>' : '<span class="mc-best-no">🖼</span>')
        + '<div class="mc-best-t"><b>' + esc(title) + '</b>' + lines.filter(Boolean).map(l => '<span>' + esc(l) + '</span>').join('') + '</div></div>';
    const c = b.current;
    // the same size to the pixel and the byte: the front already is the best cover (imported earlier), not a comparison
    if (c && c.bytes && c.bytes === b.bytes && c.w === b.w && c.h === b.h)
        return '<div class="mc-best no"><div class="mc-best-row">'
            + fig(c.thumb || b.thumb, c.full || b.full, 'Front cover', [c.w + ' × ' + c.h + ' · ' + kb(c.bytes), 'the same image as the best found (' + (b.provider || '?') + ')'])
            + '</div><div class="mc-best-what">Already the best cover: nothing to do</div></div>';
    // a front still 0×0 couldn't be measured: the Cover Art Archive hasn't processed it yet (#715)
    const unknown = c && !c.w;
    const what = !c ? 'Execute enters it as the front cover'
        : unknown ? "Size unknown: the Cover Art Archive hasn't processed the current front yet; probe again later (select a source to add it anyway)"
        : b.replace ? 'Larger than the current front: Execute enters it and removes the current one'
        : b.larger ? 'Larger than the current fronts: Execute adds it beside them'
        : 'Not larger than the current front: nothing to gain (select a source to add it anyway)';
    return '<div class="mc-best' + (c && !b.larger ? ' no' : '') + '"><div class="mc-best-row">'
        + fig(b.thumb, b.full, 'Best cover', [b.provider || '?', b.w + ' × ' + b.h + (b.bytes ? ' · ' + kb(b.bytes) : ''), b.of > 1 ? 'the largest of ' + b.of + ' found' : 'the only one found'])
        + (c ? '<span class="mc-best-vs">' + (unknown ? '?' : b.larger ? '>' : '≤') + '</span>' + fig(c.thumb, c.full, 'Current front', [(unknown ? '? × ?' : c.w + ' × ' + c.h) + (c.bytes ? ' · ' + kb(c.bytes) : ''), unknown ? 'not processed yet' : '']) : '')
        + '</div><div class="mc-best-what">' + esc(what) + '</div></div>';
}
// The covers of AS's card, full size: the best one found and the current front (one when they are
// the same image). AS sends the best as a data URL (the file lives in its hidden frame) and the
// front as the archive's own image; the previews stand in when an older AS sends neither.
function coverList(b) {
    if (!b) return [];
    const kb = n => n ? (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB') : '';
    const c = b.current, same = c && c.bytes && c.bytes === b.bytes && c.w === b.w && c.h === b.h;
    const one = (src, title, w, h, bytes, from) => src ? { src, title, info: [from, w && h ? w + ' × ' + h : '', kb(bytes)].filter(Boolean).join(' · ') } : null;
    if (same) return [one(c.full || b.full || c.thumb || b.thumb, 'Front cover', c.w, c.h, c.bytes, b.provider)].filter(Boolean);
    return [one(b.full || b.thumb, 'Best cover', b.w, b.h, b.bytes, b.provider || ''), c ? one(c.full || c.thumb, 'Current front', c.w, c.h, c.bytes, 'Cover Art Archive') : null].filter(Boolean);
}
function coverViewer(list, at) {
    if (!list.length) return;
    document.getElementById('mc-cover')?.remove();
    let i = Math.min(at || 0, list.length - 1);
    const v = el('div', ''); v.id = 'mc-cover';
    v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', 'Cover, full screen');
    v.innerHTML = mbuHtml('<div class="mc-cov-top"><span class="mc-cov-t"></span><span class="mc-cov-i"></span><span class="mc-cov-n"></span><button type="button" class="mc-cov-x" data-tip="Close (Esc)">✕</button></div>'
        + '<div class="mc-cov-stage"><img alt=""></div>'
        + (list.length > 1 ? '<button type="button" class="mc-cov-go prev" data-tip="Previous (←)">‹</button><button type="button" class="mc-cov-go next" data-tip="Next (→)">›</button>' : ''));
    const show = () => {
        const x = list[i];
        v.querySelector('img').src = x.src;
        v.querySelector('.mc-cov-t').textContent = x.title;
        v.querySelector('.mc-cov-i').textContent = x.info;
        v.querySelector('.mc-cov-n').textContent = list.length > 1 ? (i + 1) + ' / ' + list.length : '';
    };
    const go = d => { i = (i + d + list.length) % list.length; show(); };
    const done = () => { v.remove(); document.removeEventListener('keydown', key, true); };
    const key = e => {
        if (e.key === 'Escape') done();
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
        else return;
        e.preventDefault(); e.stopPropagation();
    };
    v.addEventListener('click', e => {
        if (e.target.closest('.mc-cov-go')) go(e.target.closest('.prev') ? -1 : 1);
        else if (e.target.closest('.mc-cov-x') || !e.target.closest('img, .mc-cov-top')) done();
    });
    document.addEventListener('keydown', key, true);
    (ui || document.body).appendChild(v);
    show();
}
// #784: Art Station's own gallery, in its frame: Art Station keeps the frame over this slot (#mc-as-slot) and gives
// it the gallery's height (kept across a repaint). Execute enters what the gallery holds; mc:plan says what that is.
let asPlan = { ops: [], more: 0, n: 0, tile: 0, fit: 0 }, asStaged = null;
document.addEventListener('mc:plan', e => {
    let d = null;
    try { d = JSON.parse(e.detail); } catch (x) { return; }
    if (!d || d.id !== 'as' || (d.release && d.release !== RELEASE)) return;
    asPlan = { ops: Array.isArray(d.ops) ? d.ops : [], more: d.more || 0, n: d.n || 0, tile: d.tile || 0, fit: d.fit || 0 };
    Log.cat('UI').debug('#784 gallery plan: ' + (asPlan.ops.map(o => o.label).join(' · ') || 'nothing'));
    if (ui) { paintAll(); paintFoot(); }
});
// the gallery's changes beyond the best front (its upload, the front it replaces)
const asMore = () => providerOff('as') ? 0 : asPlan.more;
// the best front in the gallery as its source rows are taken in
function asStage() {
    const on = !!(picked.as && picked.as.size) && !providerOff('as');
    if (on === asStaged || !(results.as && results.as.best)) return;
    asStaged = on;
    document.dispatchEvent(new CustomEvent('mc:stage', { detail: JSON.stringify({ id: 'as', release: RELEASE, front: on }) }));
}
function asGalleryHtml() {
    const r = results.as;
    if (!r || !r.best || providerOff('as')) return '';
    const old = document.getElementById('mc-as-slot'), h = old ? old.style.height : '';
    const ops = asPlan.ops;
    return '<div class="mc-ax"><div class="mc-ax-h"><span class="mc-ax-t">Gallery</span><span class="mc-ax-hint">Art Station\'s: take the stores\' other images in, drag into order, type, comment; Execute enters it</span></div>'
        + '<div id="mc-as-slot" class="mc-as-slot"' + (h ? ' style="height:' + h + '"' : '') + '></div>'
        + (ops.length ? '<div class="mc-ax-plan"><b>Execute:</b> ' + esc(ops.map(o => o.label).join(' · ')) + '</div>' : '') + '</div>';
}
function falconHtml(f) {
    if (!f || !f.items.length) return '';
    const settled = f.items.filter(i => !['queued', 'active'].includes(i.status)).length;
    const bad = f.items.filter(i => ['failed', 'partial', 'manual'].includes(i.status)).length;
    const head = 'Falcon ' + (settled < f.items.length ? 'is running: ' + settled + ' of ' + f.items.length + ' finished' : bad ? 'finished, ' + bad + ' need' + (bad === 1 ? 's' : '') + ' a look' : 'finished');
    return '<div class="mc-falcon' + (bad ? ' bad' : settled === f.items.length ? ' ok' : '') + '"><div class="mc-falcon-h">' + esc(head)
        + (bad ? ' <button type="button" class="mc-falcon-open" data-act="falcon-open" data-tip="Open Falcon\'s panel\nTo see why, and try again">Open Falcon</button>' : '') + '</div>'
        + f.items.map(i => { const k = FALCON_MARK[i.status] || ['?', i.status]; return '<div class="mc-falcon-i st-' + esc(i.status) + '" data-tip="' + esc(k[1] + (i.error ? ': ' + i.error : '')) + '"><span class="mk">' + k[0] + '</span><span class="ty">' + esc(i.entityType.replace('_', ' ')) + '</span><span class="nm">' + esc(i.name || i.mbid) + '</span><span class="ct">'
            + esc([i.urls ? i.urls + ' link' + (i.urls === 1 ? '' : 's') : '', i.cover ? 'cover' : ''].filter(Boolean).join(' + ')) + '</span>' + (i.error ? '<span class="er">' + esc(i.error) + '</span>' : '') + '</div>'; }).join('') + '</div>';
}
// #680: what a provider applied shows as linked from then on: its rows move to the linked icons,
// a found link joins the track's linked icons, a found ISRC becomes the track's. Not picked any more.
function markApplied(id, keys) {
    const r = results[id];
    if (!r || !r.findings) return;
    const set = new Set(keys);
    if (id === 'is') {
        r.findings = r.findings.filter(x => {
            if (!set.has(x.key)) return true;
            if (x.kind === 'link') {
                const main = r.findings.find(f => f.track === x.track && !f.kind);
                if (main) { main.linkUrls = (main.linkUrls || []).concat(x.url); main.links = main.linkUrls.length; }
                return false;
            }
            if (x.isrc) { x.existing = (x.existing || []).concat(x.isrc); x.state = 'linked'; }
            return true;
        });
    } else r.findings.forEach(x => { if (set.has(x.key) && PICKABLE[x.state]) { x.state = 'linked'; delete x.why; } });
    keys.forEach(k => picked[id] && picked[id].delete(k));
    Log.cat('Execute').info('applied ' + id + ': ' + keys.length + ' item(s) now shown as linked');
}
async function execute(dry) {
    if (executing) return;
    executing = true; paintExec();
    keepLog();   // #811
    let failed = 0, sent = 0;
    try {
        for (const step of STEPS) {
            const ids = (step.lanes || [step]).map(p => p.id)
                .filter(id => ((picked[id] && picked[id].size) || (id === 'as' && asMore()) || (id === 'pc' && pfChanges().length)) && !providerOff(id) && found[id] && (found[id].capabilities || []).includes('apply'));
            if (!ids.length) continue;
            Log.cat('Execute').info('step ' + step.id + ': ' + ids.join(' ∥ '));
            const outs = await Promise.all(ids.map(id => applyOne(id, dry)));
            outs.forEach(o => {
                results[o.id] = Object.assign(results[o.id] || {}, { applied: o });
                // a batch handed to Falcon turns linked item by item, as Falcon reports it done (falcon:status)
                takeApplied(o, dry);
                // #825: the batch is Falcon's now; a reload must wait until Falcon reports it settled
                if (o.via === 'falcon') { results[o.id].falconKeys = o.keys || []; results[o.id].falconWait = true; }
                if (o.ok && !dry && o.id === 'pc') CMP.picks = {};   // #782: the track changes went with it
                if (o.ok) { sent += o.sent || 0; Log.cat('Execute').ok(o.id + ': ' + (o.note || 'done')); } else { failed++; Log.cat('Execute').err(o.id + ': ' + (o.note || 'failed')); }
            });
            paintAll();
        }
    } finally { executing = false; lastRun = { at: Date.now(), sent, failed, dry: !!dry }; Log.cat('Execute').info('run done · ' + sent + ' sent · ' + failed + ' failed' + (dry ? ' · dry' : '')); paintExec(); paintFoot(); }
    mbuToast(failed ? failed + ' step' + (failed === 1 ? '' : 's') + ' failed: see the cards and the log' : (dry ? 'Dry run done: nothing was written' : 'Done: ' + sent + ' change' + (sent === 1 ? '' : 's') + ' applied or handed over'), { kind: failed ? 'error' : 'ok' });
    if (S.reloadAfter && !dry && !failed && sent) { reloadPending = true; reloadWhenClean(); }
}
// #841: Execute, through the review when it's on
function startExecute() { if (S.review) reviewWindow(); else execute(false); }
const reviewLen = ms => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function reviewTrack(gid) {
    const t = rel && rel.tracks.find(t => t.rec === gid);
    return t ? (rel.media > 1 ? t.medium + '.' : '') + t.pos + ' ' + t.title : 'a recording';
}
// the platform's icon beside a link's line
function reviewIco(id, x) {
    if (id === 'is') return x.kind === 'link' ? stIcon(urlIcon(x.url), 16) : '';
    if (id === 'as' || (id === 'pc' && !x.kind)) return stIcon(x.icon || x.key, 16);
    return '';
}
// one selected finding as a line: what it is, and where it goes
function reviewLine(id, x) {
    const k = x.kind;
    if (id === 'is') return k === 'link' ? reviewTrack(x.track) + ': link ' + x.url : reviewTrack(x.track) + ': ISRC ' + (x.isrc || '?') + ((x.existing || []).length ? ' (beside ' + x.existing.join(', ') + ')' : '');
    if (id === 'as') { const b = results.as && results.as.best; return 'Front cover from ' + (x.name || x.key) + (b && b.w ? ', ' + b.w + '×' + b.h : '') + (b && b.replace ? ', replacing the current one' : ''); }
    if (k === 'barcode') return 'Barcode ' + x.code;
    if (k === 'catno') return 'Catalog number ' + x.code + (x.label && x.label.name ? ' on ' + x.label.name : '');
    if (k === 'label') return 'Label ' + ((x.label && x.label.name) || '?') + (x.code ? ', ' + x.code : '');
    if (k === 'event') return 'Release event ' + x.code;
    if (k === 'lengths') return 'Lengths of ' + ((x.lengths || []).length || 'the') + ' tracks without one';
    return (x.name || x.key) + ' link on ' + (x.entity ? x.entity.name : 'the release') + (x.url ? ': ' + x.url : '');
}
function reviewWindow() {
    const groups = [];
    PROVIDERS.forEach(p => {
        if (providerOff(p.id) || !found[p.id] || !(found[p.id].capabilities || []).includes('apply')) return;
        const set = picked[p.id], xs = set && set.size ? ((results[p.id] || {}).findings || []).filter(x => set.has(x.key)) : [];
        let items = xs.map(x => ({ keys: [x.key], text: reviewLine(p.id, x), ico: reviewIco(p.id, x) }));
        // Fusion: the tracks of one group are one merge
        if (p.id === 'fusion') {
            const by = new Map();
            xs.forEach(x => {
                const gids = [x.track, ...(x.matches || []).map(m => m.gid)].sort(), g = gids.join(' ');
                const e = by.get(g) || by.set(g, { keys: [], names: [], n: gids.length }).get(g);
                e.keys.push(x.key); e.names.push(reviewTrack(x.track));
            });
            items = [...by.values()].map(e => ({ keys: e.keys, text: 'One merge of ' + e.n + ' recordings: ' + e.names.join(', ') + (e.n > e.names.length ? ' and ' + (e.n - e.names.length) + ' from elsewhere' : '') }));
        }
        if (p.id === 'as' && asMore()) items.push({ text: asMore() + ' gallery change' + (asMore() === 1 ? '' : 's') });
        if (p.id === 'pc') pfChanges().forEach(c => items.push({ text: 'Track ' + c.position + ': ' + [c.title != null && '“' + (c.was.title || '') + '” → “' + c.title + '”', c.ms && 'length ' + (c.was.ms ? reviewLen(c.was.ms) : 'none') + ' → ' + reviewLen(c.ms)].filter(Boolean).join(', ') }));
        if (items.length) groups.push({ p, items });
    });
    const n = groups.reduce((k, g) => k + g.items.length, 0);   // a line each: one Fusion merge is one
    const ov = el('div', 'mbu-ov');
    const panel = el('div', 'mbu-ov-panel mc-review');
    panel.style.width = 'min(640px, 94vw)';
    panel.innerHTML = mbuHtml('<div class="mbu-ov-body"><h2 class="mc-sec">Execute ' + n + ' change' + (n === 1 ? '' : 's') + '?</h2>'
        + groups.map(g => '<div class="mc-rv-g">' + sIcon(g.p.id) + esc(g.p.name) + ' <span>' + esc(g.p.provider) + '</span></div>'
            + g.items.map(it => '<label class="mc-rv-i"><input type="checkbox" checked' + (it.keys ? ' data-p="' + g.p.id + '" data-key="' + esc(JSON.stringify(it.keys)) + '"' : ' disabled') + '>' + (it.ico ? '<span class="mc-rv-ico">' + it.ico + '</span>' : '') + '<span>' + esc(it.text) + '</span></label>').join('')).join('')
        + '<div class="mc-rv-f"><button type="button" class="mc-btn" data-rv="cancel">Cancel</button><button type="button" class="mc-btn mc-exec" data-rv="go">Execute</button></div></div>');
    ov.appendChild(panel);
    document.body.appendChild(ov);
    const close = () => ov.remove();
    const off = mbuDismissOn(panel, close);
    Log.cat('Execute').info('review: ' + n + ' change(s)');
    panel.querySelector('[data-rv="cancel"]').onclick = () => { off(); close(); Log.cat('Execute').info('review: cancelled'); };
    panel.querySelector('[data-rv="go"]').onclick = () => {
        const dropped = [...panel.querySelectorAll('input[data-key]:not(:checked)')];
        dropped.forEach(i => JSON.parse(i.dataset.key).forEach(k => picked[i.dataset.p] && picked[i.dataset.p].delete(k)));
        if (dropped.length) { Log.cat('Execute').info('review: left out ' + dropped.map(i => i.dataset.p + ':' + i.dataset.key).join(', ')); paintAll(); }
        off(); close();
        if (changeCount()) execute(false);
    };
}
// #741: one provider applied again (its card's Retry), as Execute applies it
async function retryOne(id) {
    if (executing || !((picked[id] && picked[id].size) || (id === 'as' && asMore()) || (id === 'pc' && pfChanges().length))) return;
    executing = true; paintExec(); paintCards();
    Log.cat('Probe').info('retry ' + id + ': ' + (picked[id] ? picked[id].size : 0) + ' item(s)' + (id === 'as' ? ' + ' + asMore() + ' gallery change(s)' : ''));
    try {
        const o = await applyOne(id, false);
        results[id] = Object.assign(results[id] || {}, { applied: o });
        takeApplied(o, false);
        if (o.ok) Log.cat('Probe').ok(id + ': ' + (o.note || 'done')); else Log.cat('Probe').err(id + ': ' + (o.note || 'failed'));
        mbuToast(o.ok ? 'Done: ' + (o.note || id) : 'Failed again: ' + (o.note || id), { kind: o.ok ? 'ok' : 'error' });
    } finally { executing = false; paintAll(); }
}
function discover() {
    Log.cat('Providers').info('discover: asking providers for release ' + RELEASE);
    document.dispatchEvent(new CustomEvent('mc:discover', { detail: JSON.stringify({ release: RELEASE, mc: VERSION }) }));
    setTimeout(() => {
        const missing = PROVIDERS.filter(p => !found[p.id]).map(p => p.provider);
        if (missing.length) Log.cat('Providers').info('no adapter yet: ' + missing.join(', '));
        paintBadges();
    }, 500);
}

/* ── release from the page ─────────────────────────────────────────────────── */

// Read once from the rendered page, no request: the header and the tracklist
// are already there.
// The page MC started on (#847): Event Horizon swaps the body for its own and moves to other pages
// without loading them, so the release is read from MusicBrainz's body, and a release reached inside
// Event Horizon (no MC, Platform Check or the others ran for it) is loaded first.
const MC_HOME = location.pathname;
let mcBody = null;
function mcPage() {
    if (document.querySelector('.releaseheader')) return (mcBody = document.body, document);
    return mcBody || document;
}
mcPage();   // at the start, before Event Horizon can swap the body
function mcElsewhere() { if (location.pathname === MC_HOME) return false; location.reload(); return true; }
function readRelease() {
    const D = mcPage();
    const h = D.querySelector('.releaseheader');
    // the h1's own link: other scripts append to the h1 (ISRC Scout's "ISRC ✓ 12/12")
    const h1 = h && h.querySelector('h1');
    const tl = h1 && (h1.querySelector('a[href*="/release/"] bdi') || h1.querySelector('a[href*="/release/"]'));
    const title = tl ? tl.textContent.trim() : h1 ? h1.textContent.trim() : document.title;
    const artist = h && h.querySelector('.subheader') ? Array.from(h.querySelectorAll('.subheader a[href*="/artist/"]')).map(a => a.textContent.trim()).join(', ') : '';
    // the release group's versions, from the header's own "see all versions" link (as Apollo's zen title)
    const va = h && (h.querySelector('.subheader .small a[href*="/release-group/"]') || Array.from(h.querySelectorAll('.subheader a')).find(x => /version/i.test(x.textContent || '')));   // #722 by its address
    const vn = va && (va.textContent.match(/(\d+)/) || [])[1];
    const versions = va ? { href: va.href, text: vn ? vn + (vn === '1' ? ' version' : ' versions') : 'all versions' } : null;
    const cover = D.querySelector('.cover-art img');
    const fmt = D.querySelector('#sidebar dd.format');
    const format = fmt ? fmt.textContent.trim() : '';
    const tracks = [];
    let medium = 0;
    D.querySelectorAll('#content table.medium').forEach(tbl => {
        medium++;
        tbl.querySelectorAll('tbody tr').forEach(tr => {
            const rec = tr.querySelector('a[href*="/recording/"]');
            if (!rec) return;
            const pos = tr.querySelector('td.pos') || tr.cells[0];
            const len = Array.from(tr.cells).map(c => c.textContent.trim()).reverse().find(t => /^\d+:\d\d(:\d\d)?$/.test(t)) || '';
            tracks.push({
                medium, pos: pos ? pos.textContent.trim() : '', title: rec.textContent.trim(), len,
                rec: (rec.getAttribute('href').match(/[0-9a-f-]{36}/) || [])[0],
            });
        });
    });
    Log.cat('Release').info('release: "' + title + '" by ' + (artist || '?') + ' · ' + location.origin + '/release/' + RELEASE + ' · ' + tracks.length + ' tracks on ' + medium + ' medium(s) · format ' + (format || '?'));
    // #782: the release's events, from the JSON its sidebar embeds after the heading (none: no heading)
    const evh = D.querySelector('#sidebar h2.release-events');
    let events = 0;
    if (evh) { try { events = (JSON.parse((evh.nextElementSibling || {}).textContent || '{}').events || []).length; } catch (e) { events = 1; } }
    // #785: the release's language (ISO 639-3) from its sidebar link's address (a search for lang:"eng"), for guess case
    const la = D.querySelector('#sidebar dd.language a[href*="lang"]');
    let language = null;
    try { language = la ? (decodeURIComponent(la.getAttribute('href')).match(/lang:"?([a-z]{3})\b/) || [])[1] || null : null; } catch (e) { language = null; }
    return { title, artist, cover: cover ? cover.src : '', tracks, media: medium, format, versions, events, language };
}

/* ── UI ────────────────────────────────────────────────────────────────────── */

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = mbuHtml(html); return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// #766: an ISRC as CC-XXX-YY-NNNNN, as ISRC Scout shows it: its shared setting isrcFormat (on unless
// turned off there); the dashes are CSS, so a copy is the plain code
const isrcHtml = code => {
    const c = String(code || '').toUpperCase().replace(/[\s-]/g, '');
    if (mbuShared('isrcFormat') === false || !/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(c)) return esc(code);
    return '<span class="mc-isrcf"><span>' + c.slice(0, 2) + '</span><span>' + c.slice(2, 5) + '</span><span>' + c.slice(5, 7) + '</span><span>' + c.slice(7) + '</span></span>';
};

let ui = null, rel = null, selected = null;

function mcStyle() {
    if (document.getElementById('mc-style')) return;
    const s = document.createElement('style'); s.id = 'mc-style';
    s.textContent = MBU_TOKENS + MBU_UI_CSS
        + '.mc-launch{position:fixed;z-index:2147483000;width:40px;height:40px;border-radius:50%;border:none;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;'
        + 'background:transparent;box-shadow:none;opacity:.85;transition:opacity .15s,transform .1s}.mc-launch img{width:34px;height:34px;display:block;pointer-events:none}'
        + '.mc-launch:hover{opacity:1;transform:scale(1.08)}'
        + '#mc-root{position:fixed;inset:0;z-index:var(--mbu-z-modal);display:flex;flex-direction:column;background:var(--mbu-bg-sunken);color:var(--mbu-text);font:13px/1.4 var(--mbu-font)}'
        + '#mc-root *{box-sizing:border-box}'
        + '#mc-root .mono{font-family:var(--mbu-font-mono)}#mc-root .weak{color:var(--mbu-text-weak)}'
        // header: actions | album (center) | actions — Apollo's layout
        // an opacity pulse on a layer under the header's contents: the compositor runs it, so it stays
        // smooth while the page's thread is busy (a box-shadow pulse froze and jumped: flashing)
        + '.mc-hdr{position:relative;isolation:isolate}.mc-hdr::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:0;background:color-mix(in srgb, var(--mbu-info) 18%, transparent)}'
        + '@keyframes mc-busy-pulse{0%,100%{opacity:0}50%{opacity:1}}.mc-hdr.mc-busy::after{animation:mc-busy-pulse 1.4s ease-in-out infinite;will-change:opacity}'
        + '@media (prefers-reduced-motion: reduce){.mc-hdr.mc-busy::after{animation:none;opacity:.5}}'
        + '.mc-sep{width:1px;height:20px;background:var(--mbu-border);margin:0 4px}'
        + '#mc-root .mc-btn{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--mbu-border);background:var(--mbu-bg);color:var(--mbu-text);padding:4px 10px;border-radius:var(--mbu-radius);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}'
        + '#mc-root .mc-btn:hover:not(:disabled){background:var(--mbu-bg-hover);border-color:var(--mbu-border-strong)}'
        + '#mc-root .mc-btn:disabled{opacity:.5;cursor:default}'
        + '#mc-root .mc-btn.ghost{background:transparent;border-color:transparent;color:var(--mbu-text-dim)}'
        + '#mc-root .mc-btn.primary{background:var(--mbu-accent);border-color:var(--mbu-accent);color:var(--mbu-accent-fg);font-weight:600}'
        + '#mc-root .mc-btn.primary:hover:not(:disabled){background:var(--mbu-accent-hover)}'
        + '#mc-root .mc-btn.tog{color:var(--mbu-text-weak)}#mc-root .mc-btn.tog.on{background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong);color:var(--mbu-accent-text)}'
        + '#mc-root .mc-btn.lg{padding:7px 16px;font-size:13px}'
        // #680: one header row — the release, the steps (C, on one line), Execute (N), ⚙ and ✕
        + '.mc-hdr{display:flex;align-items:center;gap:14px;height:52px;padding:0 10px 0 12px;background:var(--mbu-bg);border-bottom:1px solid var(--mbu-border);box-shadow:var(--mbu-shadow)}'
        + '.mc-fmt{flex:none;display:grid;place-items:center;width:30px;height:30px;color:var(--mbu-text-dim)}.mc-fmt svg{width:28px;height:28px;display:block}'
        + '.mc-rel{display:flex;flex-direction:column;min-width:0;flex:0 1 auto;max-width:40%;padding-right:20px;line-height:1.2}.mc-ttl{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mc-art{font-size:12px;color:var(--mbu-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#mc-root .mc-art .mc-ver{color:var(--mbu-text-weak);text-decoration:none}#mc-root .mc-art .mc-ver:hover{color:var(--mbu-accent-text);text-decoration:underline}'
        + '.mc-hdr .mc-act{display:flex;align-items:center;gap:4px;flex:none}#mc-root .mc-act .mc-exec{justify-content:center;min-width:var(--mc-exec-w,96px);height:28px;padding:0 12px;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong);color:var(--mbu-accent-text)}#mc-root .mc-act .mc-exec:hover:not(:disabled){background:var(--mbu-accent);border-color:var(--mbu-accent);color:var(--mbu-accent-fg)}#mc-root .mc-act .mc-exec:disabled{background:var(--mbu-bg);border-color:var(--mbu-border);color:var(--mbu-text-weak);cursor:default}'
        // the steps: a ring, then the name and the state beside it, all on one centre line; a click switches the step off or on (#753)
        + '.mc-steps{display:flex;align-items:center;justify-content:center;gap:6px;flex:1 1 auto;min-width:0;height:100%}'
        + '#mc-root .mc-re{flex:none;width:26px;height:26px;margin-right:4px;padding:0;border-radius:50%;border:1px solid transparent;background:none;color:var(--mbu-text-dim);font-size:14px;line-height:1;cursor:pointer}#mc-root .mc-re:hover{border-color:var(--mbu-border);background:var(--mbu-bg-hover);color:var(--mbu-accent-text)}'
        + '.mc-step{display:inline-flex;align-items:center;gap:7px;min-width:0;flex:0 1 auto;padding:4px 6px;border-radius:var(--mbu-radius);cursor:pointer}.mc-step:hover{background:var(--mbu-bg-hover)}.mc-hdr .mc-fmt{cursor:pointer;border-radius:var(--mbu-radius)}.mc-hdr .mc-fmt:hover{background:var(--mbu-bg-hover)}'
        // a step's words take a fixed width (cut with …, the whole of it in the tooltip): changing words and
        // ticking seconds must not move the steps; only the window's width does
        + '.mc-step .tx{display:flex;flex-direction:column;flex:0 1 130px;width:130px;min-width:0;line-height:1.2}.mc-step b{font-size:12.5px;color:var(--mbu-text)}.mc-step i{font-style:normal;font-size:11.5px;color:var(--mbu-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}'
        // #680: no ring: the provider's own icon, bigger, so it reads; the state rides on the badge and the text
        + '.mc-ring{position:relative;flex:none;display:grid;place-items:center;width:28px;height:28px}'
        + '.mc-ring img{width:28px;height:28px;object-fit:contain;display:block;margin:0;vertical-align:0}'
        + '.mc-ring sup{position:absolute;right:-7px;top:-6px;min-width:15px;height:15px;padding:0 3px;box-sizing:border-box;border-radius:8px;background:var(--mbu-accent);color:var(--mbu-text-on-accent);font-size:10px;font-weight:700;line-height:15px;text-align:center;box-shadow:0 0 0 2px var(--mbu-bg)}'
        + '.mc-step.ok sup{background:var(--mbu-ok)}'
        + '.mc-step.add i{color:var(--mbu-accent-text);font-weight:600}'
        + '.mc-step.busy .mc-ring::before{content:"";position:absolute;left:2px;right:2px;bottom:-6px;height:2px;border-radius:1px;background:linear-gradient(90deg,transparent,var(--mbu-info),transparent);background-size:200% 100%;animation:mc-sweep 1s linear infinite}@keyframes mc-sweep{from{background-position:100% 0}to{background-position:-100% 0}}.mc-step.busy i{color:var(--mbu-info)}'
        + '.mc-step.stalled sup{background:var(--mbu-warn)}.mc-step.stalled i,.mc-step.stalled b{color:var(--mbu-warn)}'
        + '.mc-step.err sup{background:var(--mbu-error)}.mc-step.err i{color:var(--mbu-error)}'
        + '.mc-step.wait .mc-ring img{filter:grayscale(1);opacity:.5}.mc-step.wait b{color:var(--mbu-text-weak)}.mc-step.off{opacity:.45}.mc-step.off .mc-ring img{filter:grayscale(1)}.mc-step.off b{text-decoration:line-through}'
        + '.mc-steps .mc-arrow{color:var(--mbu-text-weak);flex:none}.mc-steps .mc-par{display:inline-flex;align-items:center;gap:4px;height:40px;margin:0;background:none;padding:0 6px;border:1px dashed var(--mbu-border);border-radius:10px;box-sizing:border-box;min-width:0}'
        + '@media (prefers-reduced-motion: reduce){.mc-step.busy .mc-ring::before{animation:none}}'
        // the corner launchers (Falcon, Fusion, ours) share MC's z-index; hide them while MC is open
        + 'html.mc-open [data-mb-corner]{display:none!important}'
        // three panes
        + '.mc-main{flex:1;display:grid;grid-template-columns:300px 1fr 300px;min-height:0}'
        + '#mc-root.no-left .mc-main{grid-template-columns:1fr 300px}#mc-root.no-right .mc-main{grid-template-columns:300px 1fr}#mc-root.no-left.no-right .mc-main{grid-template-columns:1fr}'
        + '#mc-root.no-left .mc-side.left,#mc-root.no-right .mc-side.right{display:none}'
        + '.mc-side{background:var(--mbu-bg);border-right:1px solid var(--mbu-border);padding:12px;overflow:auto;min-width:0}.mc-side.right{border-right:0;border-left:1px solid var(--mbu-border)}'
        + '.mc-center{overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-width:0}'
        // flex items shrink by default: a long card squeezed the track list down to 3 rows
        + '.mc-center>*{flex:none}'
        + '.mc-sec{font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--mbu-text-weak);margin:0 0 8px;font-weight:700;display:flex;align-items:center;gap:6px}'
        + '.mc-x{margin-left:auto;cursor:pointer;font-size:14px;letter-spacing:0;color:var(--mbu-text-weak);background:none;border:0;padding:0 4px}'
        // B's vertical execution order (#680): the provider's icon on the rail with the step's number, what the
        // step does and its state chip, the script on its own small line, then only data; a footer with the runs
        + '.mc-stage{position:relative;display:grid;grid-template-columns:30px minmax(0,1fr);column-gap:10px;padding-bottom:14px}'
        + '.mc-stage::before{content:"";position:absolute;left:14px;top:36px;bottom:4px;width:2px;border-radius:1px;background:var(--mbu-border)}.mc-stage.last::before{display:none}'
        + '.mc-node{position:relative;width:30px;height:30px;display:grid;place-items:center}.mc-node .mc-sic{width:30px;height:30px;margin:0}.mc-node .par{font-size:18px;color:var(--mbu-accent-text)}'
        + '.mc-sic{width:15px;height:15px;object-fit:contain;vertical-align:-3px;margin-right:4px;flex:0 0 auto}'
        + '.mc-node .num{position:absolute;left:-4px;top:-4px;width:14px;height:14px;display:grid;place-items:center;border-radius:50%;border:1px solid var(--mbu-border);background:var(--mbu-bg);font:700 9px var(--mbu-font-mono);color:var(--mbu-text-dim)}'
        + '.mc-stage .nm{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;line-height:1.25;min-height:18px}'
        + '.mc-pv{font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:var(--mbu-text-weak);font-weight:600;line-height:1.3;margin-top:1px}'
        + '.mc-stage .meta{font-size:11.5px;color:var(--mbu-text-dim);line-height:1.35;margin-top:1px;overflow-wrap:anywhere}'
        + '.mc-stage.off .nm,.mc-stage.off .mc-pv,.mc-stage.off .meta,.mc-stage.off .mc-node{opacity:.45}'
        + '.mc-stage .tag{font:600 9.5px var(--mbu-font);letter-spacing:.5px;text-transform:uppercase;color:var(--mbu-accent-text)}'
        + '.mc-chip{margin-left:auto;flex:none;font:600 10.5px var(--mbu-font);padding:0 7px;border-radius:10px;white-space:nowrap;border:1px solid transparent;line-height:16px;font-variant-numeric:tabular-nums}.mc-chip:empty{display:none}'
        + '.mc-chip.ok{background:var(--mbu-ok-bg);color:var(--mbu-ok);border-color:var(--mbu-ok-border)}.mc-chip.info{background:var(--mbu-info-bg);color:var(--mbu-info);border-color:var(--mbu-info-border)}'
        + '.mc-chip.add{background:var(--mbu-accent-soft);color:var(--mbu-accent-text);border-color:var(--mbu-border-strong)}.mc-chip.busy{color:var(--mbu-info);border-color:var(--mbu-info-border)}'
        + '.mc-chip.err,.mc-chip.stalled{background:var(--mbu-warn-bg);color:var(--mbu-warn);border-color:var(--mbu-warn-border)}'
        // a parallel step's scripts: rows of their own on the same line, a smaller icon, no number
        + '.mc-stage.head{padding-bottom:8px}.mc-stage.sub{padding-bottom:10px}.mc-stage.sub .mc-node .mc-sic{width:24px;height:24px}.mc-stage.sub::before{top:31px}'
        + '.mc-stage.sub .nm{font-weight:500;font-size:12.5px}'
        + '.mc-covbar{height:4px;border-radius:2px;background:var(--mbu-bg-sunken);overflow:hidden;margin-top:5px;display:flex}.mc-covbar:empty{display:none}.mc-covbar i{display:block;height:100%}'
        + '.mc-covbar .linked{background:var(--mbu-ok)}.mc-covbar .new{background:var(--mbu-accent)}.mc-covbar .held{background:var(--mbu-warn)}.mc-covbar .none{background:var(--mbu-border-strong)}'
        + '.mc-hint{font-size:10.5px;color:var(--mbu-text-weak);margin-top:3px}'
        + '.mc-runs{border-top:1px solid var(--mbu-border);margin-top:2px;padding-top:10px;font-size:11.5px;color:var(--mbu-text-dim);display:grid;gap:4px}'
        + '.mc-runs>div{display:flex;justify-content:space-between;gap:8px}.mc-runs b{color:var(--mbu-text);font-weight:600;text-align:right}'
        + '#mc-root .mc-runs .mc-loglink{background:none;border:0;padding:0;font:inherit;color:var(--mbu-accent-text);cursor:pointer}#mc-root .mc-runs .mc-loglink:hover{text-decoration:underline}'
        + '.mc-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none;background:var(--mbu-border-strong)}.mc-dot.ready{background:var(--mbu-accent)}'
        + '.mc-seg{display:inline-flex;border:1px solid var(--mbu-border);border-radius:20px;overflow:hidden;margin-top:4px}'
        + '#mc-root .mc-seg button{font:600 10px var(--mbu-font);padding:2px 9px;color:var(--mbu-text-weak);cursor:pointer;background:none;border:0;border-radius:0}'
        + '#mc-root .mc-seg button.on{background:var(--mbu-accent);color:var(--mbu-accent-fg)}'
        // sections and the track matrix
        + '.mc-sect{border:1px solid var(--mbu-border);border-radius:var(--mbu-radius-lg);background:var(--mbu-bg);box-shadow:var(--mbu-shadow);overflow:hidden}'
        + '.mc-sect-h{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-border-soft)}'
        // a provider card's state, as its step's colour: a 4px stripe on its edge, its header tinted (#680)
        + '.mc-sect[data-st]{--st:transparent;--st-bg:var(--mbu-bg-raised)}.mc-sect[data-st=add]{--st:var(--mbu-accent);--st-bg:var(--mbu-accent-soft)}.mc-sect[data-st=ok]{--st:var(--mbu-ok);--st-bg:var(--mbu-ok-bg)}'
        + '.mc-sect[data-st=busy]{--st:var(--mbu-info);--st-bg:var(--mbu-info-bg)}.mc-sect[data-st=stalled]{--st:var(--mbu-warn);--st-bg:var(--mbu-warn-bg)}.mc-sect[data-st=err]{--st:var(--mbu-error);--st-bg:var(--mbu-error-bg)}.mc-sect[data-st=off]{--st:var(--mbu-text-weak);--st-bg:var(--mbu-bg-sunken)}'
        + '.mc-sect[data-st]{box-shadow:inset 4px 0 0 var(--st),var(--mbu-shadow)}.mc-sect[data-st]>.mc-sect-h{background:var(--st-bg)}'
        + '.mc-st{font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--st)}.mc-st:empty{display:none}.mc-sect[data-st=add] .mc-st{color:var(--mbu-accent-text)}' + BC_CSS
        + '.mc-sect-h .ic{width:22px;height:22px;border-radius:6px;background:var(--mbu-accent-soft);display:grid;place-items:center;font-size:12px;flex:none}'
        + '.mc-sect-h .ic img{width:16px;height:16px;object-fit:contain;display:block}.mc-sect-h .ic.img{width:28px;height:28px;background:none}.mc-sect-h .ic.img img{width:28px;height:28px}.mc-sect-h .t{font-weight:700;font-size:12.5px}.mc-sect-h .p{font-size:10.5px;color:var(--mbu-text-weak)}'
        + '.mc-empty{padding:10px;color:var(--mbu-text-weak);font-size:12px}'
        + '.mc-line{display:grid;grid-template-columns:16px 16px 1fr auto;gap:8px;align-items:center;padding:4px 10px;border-bottom:1px solid var(--mbu-divider)}'
        // #751: Art Station's rows, the cover's size and the pill in columns of fixed width, so the rows line up
        + '.mc-line.mc-hassize{grid-template-columns:16px 16px minmax(0,1fr) 96px 76px}.mc-line.mc-hassize>.mc-pill{justify-self:center}'
        + '#mc-root a.mc-csize{justify-self:end;font:11px/1.4 ui-monospace,Consolas,monospace;font-variant-numeric:tabular-nums;color:var(--mbu-accent-text);text-decoration:none;padding:0 6px;border:1px solid var(--mbu-border);border-radius:5px;white-space:nowrap}'
        + '#mc-root a.mc-csize:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-accent)}#mc-root span.mc-csize{justify-self:end;font:11px/1.4 var(--mbu-font);color:var(--mbu-text-weak);padding:0 7px;white-space:nowrap}'
        + '.mc-bc{display:inline-block;font:600 12px/1.5 ui-monospace,Consolas,monospace;color:var(--bc);background:color-mix(in srgb,var(--bc) 12%,transparent);border:1px solid color-mix(in srgb,var(--bc) 45%,transparent);border-radius:5px;padding:1px 6px;white-space:nowrap}'
        // #740: a lane's catalog number, a toggle of its own
        + '.mc-bcl.mc-hascat{grid-template-columns:10px max-content max-content minmax(0,1fr) auto auto}.mc-cats{display:flex;gap:4px;font:600 12px/1.5 ui-monospace,Consolas,monospace}.mc-cat{display:inline-block;font:inherit;color:var(--mbu-text);border:1px dotted var(--mbu-border-strong);border-radius:5px;padding:1px 6px;white-space:nowrap;cursor:pointer}'
        + '.mc-cat:hover{background:var(--mbu-bg-hover)}.mc-cat.on{border-style:solid;border-color:var(--mbu-accent);color:var(--mbu-accent-text);background:var(--mbu-accent-soft)}'
        + '.mc-bcl{display:grid;grid-template-columns:10px max-content minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:4px 10px;border-bottom:1px solid var(--mbu-divider);cursor:pointer}.mc-bcl:hover{background:var(--mbu-bg-hover)}.mc-bcl.empty{cursor:default;opacity:.75}.mc-bcl.empty:hover{background:none}'
        + '.mc-tri{font-size:9px;color:var(--mbu-text-weak)}.mc-bcl-ic{display:flex;flex-wrap:wrap;gap:3px;min-width:0}.mc-bcl-no{font-size:11px;color:var(--mbu-text-weak)}'
        + '.mc-ti{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;border:1px solid transparent;opacity:.55}.mc-ti.mc-pick{cursor:pointer}.mc-ti.mc-pick:hover{opacity:1;border-color:var(--mbu-border-strong)}.mc-ti.on{opacity:1;border-color:var(--mbu-accent);background:var(--mbu-accent-soft)}.mc-ti.linked{opacity:1;position:relative}.mc-ti.linked::after{content:"✓";position:absolute;right:-1px;bottom:-4px;font-size:10px;font-weight:700;color:var(--mbu-ok)}'
            + '.mc-ti.off{position:relative}.mc-ti.off::before{content:"";position:absolute;right:-2px;top:-2px;width:8px;height:8px;border-radius:50%;background:var(--mbu-warn);border:1.5px solid var(--mbu-bg)}#mc-root .mc-line .s .mc-off{color:var(--mbu-warn);font-weight:600}.mc-bcn{font-family:var(--mbu-font-mono);font-weight:600}'
        + '#mc-root .mc-all{font:600 11px inherit;padding:2px 9px;border-radius:12px;border:1px solid var(--mbu-border-strong);background:var(--mbu-bg);color:var(--mbu-accent-text);cursor:pointer;white-space:nowrap}#mc-root .mc-all:hover{border-color:var(--mbu-accent)}'
        + '.mc-line.mc-in{padding-left:28px}.mc-bchint{padding:6px 10px;font-size:11px;color:var(--mbu-text-dim);background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-divider)}'
        + '#mc-root .mc-sect-h .mc-icsw{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;min-width:0;cursor:pointer;padding:3px 8px 3px 3px;margin:-3px -8px -3px -3px;border-radius:8px;transition:background .12s}#mc-root .mc-icsw .ic{position:relative}'
        + '#mc-root .mc-sect-h .mc-icsw:hover{background:var(--mbu-bg-hover)}#mc-root .mc-sect-h .mc-icsw:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}'
        + '.mc-sect.mc-off .mc-icsw .ic{background:var(--mbu-bg-sunken)}.mc-sect.mc-off .mc-icsw .ic.img{background:none}.mc-sect.mc-off .mc-icsw .ic>*{filter:grayscale(1);opacity:.55}.mc-sect.mc-off .mc-icsw .t{opacity:.45}'
        + '.mc-retry{margin-left:8px;font:600 11px var(--mbu-font);padding:1px 10px;border-radius:999px;border:1px solid var(--mbu-error);background:var(--mbu-bg);color:var(--mbu-error);cursor:pointer}.mc-retry:hover{background:var(--mbu-error-bg)}'
        + '.mc-sect.mc-off>:not(.mc-sect-h){display:none}.mc-sect.mc-off .mc-sect-h{border-bottom:0}.mc-sect.mc-off .mc-sect-h>:not(.mc-icsw){opacity:.45}.mc-bc.none{--bc:var(--mbu-text-weak);border-style:dashed;background:none}.mc-bcl .mc-bc{display:inline-grid;justify-items:center}.mc-bcl .mc-bc>*{grid-area:1/1;font:inherit}.mc-bcl .mc-bc>i{visibility:hidden}.mc-line:last-child{border-bottom:0}'
        + '.mc-sect-h .end{margin-left:auto;display:flex;align-items:center;gap:6px}.mc-tapplied{display:flex;align-items:center;gap:6px}.mc-chlbl{font-size:13px;font-weight:700;color:var(--mbu-text)}'
        // CH's own toolbar look: an icon per source, its box only on hover, then an orange ⚛ All (#680)
        + '.mc-chopen{flex-wrap:wrap;justify-content:flex-end;gap:2px}#mc-root a.mc-chsrc{width:24px;height:24px;padding:0;justify-content:center;color:var(--mbu-text-dim);text-decoration:none;background:none;border-color:transparent}'
        + '#mc-root a.mc-chsrc:hover{background:var(--mbu-bg-raised);border-color:var(--mbu-warn);color:var(--mbu-warn)}'
        + '#mc-root a.mc-chall{width:auto;height:26px;padding:0 9px;gap:5px;margin-left:8px;border-color:var(--mbu-warn);color:var(--mbu-warn);font-size:13.5px;font-weight:600}#mc-root a.mc-chall b{font-size:16px;font-weight:400;line-height:1}'
        + '#mc-root a.mc-chall:hover{background:var(--mbu-warn);color:var(--mbu-text-on-accent)}'
        + '.mc-sect-h .mc-applied{border:0;border-radius:20px;padding:1px 9px}'
        + '#mc-root .mc-linked{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border:1px solid transparent;border-radius:20px;background:none;cursor:pointer;opacity:.75}'
        + '#mc-root .mc-linked:hover,#mc-root .mc-linked.on{opacity:1;border-color:var(--mbu-ok-border);background:var(--mbu-ok-bg)}'
        + '.mc-sub .mc-linked{margin:-2px 0;text-transform:none;letter-spacing:0}.mc-lk{font-size:10.5px;font-weight:700;color:var(--mbu-ok);margin-left:3px}'
        + '#mc-root .mc-fetch{font:600 10px var(--mbu-font);text-transform:none;letter-spacing:0;padding:1px 8px;margin-left:4px;border:1px solid var(--mbu-border-strong);border-radius:20px;background:var(--mbu-accent-soft);color:var(--mbu-accent-text);cursor:pointer}'
        + '.mc-add{color:var(--mbu-accent-text);font-weight:600}.mc-warn{color:var(--mbu-warn);font-weight:600}.mc-err{color:var(--mbu-error);font-weight:600}.mc-why{font-size:11px;color:var(--mbu-warn);margin:2px 0 4px}'
        // #680: no tick boxes; a pickable row/cell is the toggle, tinted with a ✓ once taken in
        + '.mc-line.mc-pick{cursor:pointer}.mc-line.mc-pick:hover{background:var(--mbu-bg-hover)}'
        + '.mc-line.on{background:var(--mbu-accent-soft);box-shadow:inset 3px 0 0 var(--mbu-accent)}.mc-line.on:hover{background:var(--mbu-accent-soft)}'
        + '.mc-tick{display:block;min-height:16px;line-height:16px;color:var(--mbu-accent-text);font-weight:700;text-align:center}'
        + '.mc-tbl .mc-pick{display:inline-block;cursor:pointer;padding:1px 6px;margin:-1px -6px;border-radius:var(--mbu-radius);border:1px dashed transparent}'
        + '.mc-tbl .mc-pick:hover{border-color:var(--mbu-border-strong)}.mc-tbl .mc-pick.on{background:var(--mbu-accent-soft);border:1px solid var(--mbu-border-strong)}'
        + '.mc-tbl .mc-pick:not(.on) .mc-add{opacity:.55;text-decoration:line-through}'
        + '.mc-sub{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px;box-sizing:border-box;font-size:10px;letter-spacing:.6px;text-transform:uppercase;font-weight:700;color:var(--mbu-text-weak);padding:6px 10px 3px;background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-divider)}'
        + '.mc-tbl .mc-lnk{text-decoration:none;display:inline-flex;align-items:center;gap:1px;margin:0;padding:1px 4px;font-weight:700;color:var(--mbu-accent-text)}.mc-tbl .mc-lnk:not(.on){opacity:.45}'
        + '.mc-have{opacity:.8}.mc-isep{width:1px;height:14px;background:var(--mbu-border);margin:0 2px}'
        + '.mc-icons{display:inline-flex;gap:4px;align-items:center}.mc-icons a.mc-pico:hover{transform:scale(1.15)}'
        + '.mc-summary{padding:5px 10px;font-size:11.5px;color:var(--mbu-text-dim);border-bottom:1px solid var(--mbu-divider)}'
        + '.mc-best{padding:8px 10px;border-bottom:1px solid var(--mbu-divider)}.mc-best-row{display:flex;gap:10px;align-items:center}.mc-best-c{flex:1 1 0;min-width:0}.mc-best-c{display:flex;gap:10px;align-items:flex-start}.mc-best-vs{font-size:20px;font-weight:700;color:var(--mbu-text-weak)}'
        + '.mc-best-what{margin-top:6px;font-size:11.5px;font-weight:600;color:var(--mbu-ok)}.mc-best.no .mc-best-what{color:var(--mbu-text-weak)}.mc-cov{all:unset;cursor:zoom-in;display:block;flex:0 0 auto;border-radius:var(--mbu-radius)}.mc-cov:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:2px}'
        + '#mc-cover{position:fixed;inset:0;z-index:1;display:flex;flex-direction:column;background:rgba(10,8,16,.94);color:#fff}'
        + '.mc-cov-top{display:flex;align-items:center;gap:14px;padding:10px 16px;font-size:14px}.mc-cov-t{font-weight:700;font-size:15px}.mc-cov-i{color:rgba(255,255,255,.75)}.mc-cov-n{margin-left:auto;color:rgba(255,255,255,.6);font-variant-numeric:tabular-nums}'
        + '#mc-cover button{all:unset;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.12)}#mc-cover button:hover{background:rgba(255,255,255,.26)}'
        + '.mc-cov-x{width:36px;height:36px;font-size:18px}.mc-cov-stage{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 72px 16px}'
        + '.mc-cov-stage img{max-width:100%;max-height:100%;object-fit:contain;box-shadow:0 6px 40px rgba(0,0,0,.6);cursor:default}'
        + '#mc-cover .mc-cov-go{position:absolute;top:50%;transform:translateY(-50%);width:52px;height:52px;font-size:34px;line-height:1}#mc-cover .mc-cov-go.prev{left:12px}#mc-cover .mc-cov-go.next{right:12px}'
        + '.mc-best img{width:72px;height:72px;object-fit:contain;border-radius:var(--mbu-radius);background:var(--mbu-bg-sunken);border:1px solid var(--mbu-border-soft);flex:0 0 auto}'
        // #772: the stores' other images, cards as in Art Station's gallery
        + '.mc-ax{padding:8px 10px 12px;border-top:1px solid var(--mbu-divider)}.mc-ax-h{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-height:26px;margin-bottom:4px}.mc-ax-t{font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--mbu-text-dim)}'
        + '.mc-ax-hint{font-size:11px;color:var(--mbu-text-weak)}.mc-as-slot{min-height:120px;border:1px solid var(--mbu-border-soft);border-radius:8px}.mc-ax-plan{margin-top:6px;font-size:12px;color:var(--mbu-text-dim)}'
        + '.mc-best-no{width:72px;height:72px;display:flex;align-items:center;justify-content:center;font-size:32px;background:var(--mbu-bg-sunken);border-radius:var(--mbu-radius);flex:0 0 auto}.mc-best-t{display:flex;flex-direction:column;gap:2px;font-size:12px;min-width:0}.mc-best-t .dim{color:var(--mbu-text-weak);font-size:11px}'
        + '.mc-working{display:flex;align-items:center;gap:7px;padding:5px 10px;font-size:11.5px;color:var(--mbu-accent-text);border-bottom:1px solid var(--mbu-divider)}'
        + '.mc-spin{width:10px;height:10px;border:2px solid var(--mbu-accent-soft);border-top-color:var(--mbu-accent);border-radius:50%;animation:mc-spin .8s linear infinite;flex:0 0 auto}@keyframes mc-spin{to{transform:rotate(360deg)}}'
        + '.mc-pico sub{font-size:9px;font-weight:700;margin-left:1px}.mc-pico.mc-ent{width:auto}'
        + '.mc-falcon{border-bottom:1px solid var(--mbu-divider);padding:5px 10px;font-size:11.5px}.mc-falcon-h{display:flex;align-items:center;gap:8px;font-weight:600;color:var(--mbu-text-dim);margin-bottom:3px}.mc-falcon.ok .mc-falcon-h{color:var(--mbu-ok)}.mc-falcon.bad .mc-falcon-h{color:var(--mbu-warn)}'
        + '.mc-falcon-open{margin-left:auto;font:inherit;font-weight:600;padding:1px 8px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);background:var(--mbu-bg-raised);color:var(--mbu-accent-text);cursor:pointer}'
        + '.mc-falcon-i{display:flex;align-items:baseline;gap:7px;padding:1px 0;min-width:0}.mc-falcon-i .mk{flex:0 0 14px;text-align:center;font-weight:700}.mc-falcon-i .ty{flex:0 0 auto;color:var(--mbu-text-weak);text-transform:capitalize}.mc-falcon-i .nm{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mc-falcon-i .ct{flex:0 0 auto;color:var(--mbu-text-weak)}.mc-falcon-i .er{flex:1 1 0;min-width:0;color:var(--mbu-error);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.mc-falcon-i.st-done .mk,.mc-falcon-i.st-skipped .mk{color:var(--mbu-ok)}.mc-falcon-i.st-failed .mk{color:var(--mbu-error)}.mc-falcon-i.st-partial .mk,.mc-falcon-i.st-manual .mk{color:var(--mbu-warn)}.mc-falcon-i.st-active .mk{color:var(--mbu-accent-text)}'
        + '.mc-applied{padding:5px 10px;font-size:11.5px;font-weight:600;border-bottom:1px solid var(--mbu-divider)}.mc-applied.ok{color:var(--mbu-ok);background:var(--mbu-ok-bg)}.mc-applied.err{color:var(--mbu-error);background:var(--mbu-error-bg)}'
        + '.mc-none{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 10px;font-size:11px;color:var(--mbu-text-weak)}.mc-none span:first-child{margin-right:4px}.mc-none .mc-pico{opacity:.6}'
        + '.mc-line.linked,.mc-line.none{opacity:.7}.mc-line .mc-lt{min-width:0}.mc-line .t{font-size:12px}'
        + '#mc-root .mc-line .s{display:block;width:fit-content;max-width:100%;font-size:10.5px;color:var(--mbu-text-weak);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none}#mc-root .mc-line a.s:hover{color:var(--mbu-accent-text);text-decoration:underline}'
        + '.mc-pico{display:inline-flex;width:16px;height:16px;align-items:center;justify-content:center}.mc-pico svg{display:block}'
        + '.mc-pill{font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;white-space:nowrap;border:1px solid var(--mbu-border)}'
        + '.mc-pill.add{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong)}.mc-pill.ok{color:var(--mbu-ok);background:var(--mbu-ok-bg);border-color:var(--mbu-ok-border)}'
        + '.mc-pill.warn{color:var(--mbu-warn);background:var(--mbu-warn-bg);border-color:var(--mbu-warn-border)}.mc-pill.idle{color:var(--mbu-text-weak);border-style:dashed}.mc-pill.err{color:var(--mbu-error);border-color:var(--mbu-error)}'
        + '.mc-dot.busy{background:var(--mbu-info)}.mc-dot.add{background:var(--mbu-accent)}.mc-dot.ok{background:var(--mbu-ok)}'
        + '.mc-row2{display:flex;gap:10px;align-items:flex-start}.mc-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:10px}.mc-span{flex:2 1 0;min-width:0;display:flex;flex-direction:column;gap:10px}.mc-span-top>.mc-sect{margin:0}.mc-span-cols{display:flex;gap:10px;align-items:flex-start}.mc-col>.mc-sect{margin:0}'
        + '.mc-tbl{width:100%;border-collapse:collapse;font-size:12px}'
        // #790: the Tracks table's rules stop at Fusion's card in a slot (its release tables are tables too); :where keeps their specificity
        + '.mc-tbl th:not(:where(.mc-fxslot *)){font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--mbu-text-weak);text-align:left;padding:6px 8px;background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-border);position:sticky;top:0;white-space:nowrap}'
        + '.mc-tbl td:not(:where(.mc-fxslot *)){padding:4px 8px;border-bottom:1px solid var(--mbu-divider);white-space:nowrap}'
        + '.mc-tbl td.n{color:var(--mbu-text-weak);font-family:var(--mbu-font-mono);width:32px}'
        + '.mc-tbl td.ttl{white-space:normal}'
        + '.mc-tbl td.pend{color:var(--mbu-border-strong)}'
        + '.mc-tbl tbody tr:not(:where(.mc-fxslot *)){cursor:pointer}.mc-tbl tbody tr:hover td:not(:where(.mc-fxslot *)){background:var(--mbu-bg-hover)}.mc-tbl tbody tr.sel td:not(:where(.mc-fxslot *)){background:color-mix(in srgb, var(--mbu-accent) 22%, var(--mbu-bg))}.mc-tbl tbody tr.chg td:first-child:not(:where(.mc-fxslot *)){box-shadow:inset 3px 0 0 var(--mbu-accent)}.mc-sect-h .p.mc-tpend.on{color:var(--mbu-accent-text);font-weight:700}'
        + '.mc-tbl tr.med td{background:var(--mbu-bg-raised);font-size:10.5px;font-weight:700;color:var(--mbu-text-weak);cursor:default}'
        + '.mc-mode{font-size:9.5px;font-weight:700;padding:0 6px;border-radius:20px;border:1px dashed var(--mbu-border-strong);color:var(--mbu-text-weak);margin-left:4px;text-transform:none;letter-spacing:0}'
        + '.mc-mini{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:3px 0;border-bottom:1px solid var(--mbu-divider)}.mc-mini:last-child{border-bottom:0}'
        + '.mc-mini .n{margin-left:auto;font-family:var(--mbu-font-mono);font-size:10.5px;color:var(--mbu-text-dim);white-space:nowrap;flex:none;padding-left:6px}.mc-mini a:not(.n){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.mc-insp-block{margin-bottom:12px}'
        + '.mc-fxo{display:inline-flex;align-items:center;gap:4px;font:inherit;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;cursor:pointer;color:var(--mbu-warn);background:var(--mbu-warn-bg);border:1px solid var(--mbu-warn-border)}'
        + '.mc-fxgo{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border-radius:8px;cursor:pointer;background:transparent;border:1px solid transparent}.mc-fxgo:hover,.mc-fxgo:focus-visible{background:var(--mbu-bg);border-color:var(--mbu-accent)}.mc-fxgo img{width:20px;height:20px;display:block}'
        + '.mc-fxo.same{color:var(--mbu-text-weak);background:transparent;border-color:var(--mbu-border)}'
        + '.mc-fxo.case{color:var(--mbu-info);background:var(--mbu-info-bg);border-color:var(--mbu-border)}'
        // #782: the lines under a track are rows of the Tracks table, each value in its column: no box, no background;
        // a box's or a taken value's text starts where the track's own does (padding and border offset by the margin)
        + '.mc-tbl tr.mc-pfr{cursor:default}.mc-tbl tr.mc-pfr>td,.mc-tbl tr.mc-pfr:hover>td{background:none;border-bottom:none;padding-top:2px;padding-bottom:2px;white-space:normal}'
        + '.mc-tbl tr.mc-pfr.last>td{padding-bottom:8px;border-bottom:1px solid var(--mbu-divider)}.mc-tbl tr.mc-pfr>td:first-child{box-shadow:inset 3px 0 0 var(--mbu-accent)}.mc-tbl tbody tr.pfopen>td{border-bottom:none}'
        + '.mc-pft{font:inherit;color:inherit;background:transparent;border:1px solid transparent;border-radius:6px;padding:2px 6px;margin:-3px -7px;cursor:pointer;text-align:left}.mc-pft:hover{border-color:var(--mbu-accent);background:var(--mbu-bg)}'
        + '.mc-pft.on{border-color:var(--mbu-ok);background:var(--mbu-ok-bg,var(--mbu-bg))}.mc-pft.on::after{content:" ✓";color:var(--mbu-ok)}'
        + '.mc-pf-in{font:inherit;width:calc(100% + 8px);margin-left:-8px;box-sizing:border-box;padding:3px 7px;border:1px solid var(--mbu-border);border-radius:6px;background:var(--mbu-bg);color:var(--mbu-text)}'
        + '.mc-pf-in.mono{width:64px;font-family:var(--mbu-font-mono)}.mc-pf-in:focus{outline:none;border-color:var(--mbu-accent)}'
        // #785: guess case beside the title, as Apollo's Aa
        + '.mc-pfti{display:flex;align-items:center;gap:6px}.mc-pfti .mc-pf-in{width:auto;flex:1;min-width:0}'
        + '.mc-pfgc{flex:none;min-width:30px;height:26px;padding:0 7px;border:1px solid var(--mbu-accent);border-radius:4px;background:none;color:var(--mbu-accent-text);font:bold 11px Arial,sans-serif;cursor:pointer}'
        + '.mc-pfgc:hover,.mc-pfgc:focus-visible{background:var(--mbu-bg-hover)}.mc-pfgc.same{border-color:var(--mbu-border);color:var(--mbu-text-weak)}'
        + '.mc-pfa{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;font-size:11.5px}.mc-pfa label{display:inline-flex;align-items:center;gap:4px;cursor:pointer}'
        + '.mc-pfrev{width:30px;height:30px;margin-left:-38px;padding:0;font-size:17px;line-height:1;color:var(--mbu-accent-text);background:none;border:1px solid transparent;border-radius:6px;cursor:pointer}.mc-pfrev:hover,.mc-pfrev:focus-visible{background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong)}.mc-pfrev.void{visibility:hidden}'
        + '.mc-tbl tr.mc-pfr .mcc-icos{gap:4px}.mc-tbl tr.mc-pfr .mono{white-space:nowrap}.mc-tbl td[data-col="plat"]{white-space:normal;min-width:120px}.mc-tbl tbody tr.pfopen td.ttl,.mc-tbl tr.mc-pfr td.ttl{min-width:200px}'
        + '.mc-pfw{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.mc-fxtbl .hl,.mc-fxm .hl,.mc-pfr .hl{background:var(--mbu-warn-bg);color:var(--mbu-warn);border-radius:2px}.mc-fxtbl .hl.gap,.mc-fxm .hl.gap,.mc-pfr .hl.gap{display:inline-block;width:6px;height:1em;vertical-align:-2px;padding:0;border:1px dashed var(--mbu-warn-border)}'
        + '.mc-fxo:hover{border-color:var(--mbu-warn)}.mc-fxp{font-size:11px;font-weight:700;color:var(--mbu-warn);text-decoration:none}.mc-fxp:hover{text-decoration:underline}'
        + '.mc-fxo .car{display:inline-block;transition:transform .15s}.mc-fxo[aria-expanded="true"] .car{transform:rotate(90deg)}'
        + '.mc-tbl tr.mc-fxd{cursor:default}.mc-tbl tr.mc-fxd>td,.mc-tbl tr.mc-fxd:hover>td{background:var(--mbu-bg-sunken);white-space:normal;padding:10px 12px 12px 40px}'
        + '.mc-fxt{font-size:11px;font-weight:700;border-radius:5px;padding:0 7px;border:1px solid var(--mbu-border);color:var(--mbu-text-weak);font-family:var(--mbu-font)}'
        + '.mc-fxt.strict{color:var(--mbu-ok);background:var(--mbu-ok-bg);border-color:var(--mbu-ok-border)}.mc-fxt.normal{color:var(--mbu-info);background:var(--mbu-info-bg);border-color:var(--mbu-info-border)}.mc-fxt.loose{color:var(--mbu-warn);background:var(--mbu-warn-bg);border-color:var(--mbu-warn-border)}'
        + '.mc-fxdiff{background:var(--mbu-warn-bg);color:var(--mbu-warn);border-radius:4px;padding:0 4px}.mc-fxs::after{content:" ✓";color:var(--mbu-ok)}'
        + '.mc-fxslot-old{font-size:11.5px;color:var(--mbu-text-weak)}.mc-isrcf>span:not(:last-child)::after{content:"-";opacity:.45}'
        + '.mc-fxm{border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:2px 8px 6px;margin:6px 0;background:var(--mbu-bg-raised)}'
        + '.mc-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:1px 10px;font-size:11.5px}.mc-kv>span:nth-child(odd){color:var(--mbu-text-weak)}'
        + '@media (prefers-reduced-motion:reduce){.mc-fxo .car{transition:none}}'
        + '.mc-cfg label{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:13px}.mc-cfg label span{min-width:150px}.mc-cfg label.mc-cfg-sub{padding-left:26px;align-items:flex-start}.mc-cfg label.mc-cfg-sub input{margin-top:2px}.mc-cfg label.mc-cfg-dim{color:var(--mbu-text-weak)}.mc-cfg .mc-cfg-hint{display:block;font-size:11.5px;color:var(--mbu-text-weak);margin-top:2px}'
        // #841: the review before Execute
        + '.mc-review .mc-rv-g{display:flex;align-items:center;gap:6px;font-weight:600;margin:12px 0 4px}.mc-review .mc-rv-g img{width:18px;height:18px}.mc-review .mc-rv-g span{font-weight:400;color:var(--mbu-text-weak)}.mc-review .mc-rv-i{display:flex;gap:8px;align-items:flex-start;padding:2px 0 2px 24px;font-size:13px;overflow-wrap:anywhere}.mc-review .mc-rv-ico{display:inline-flex;flex:none;margin-top:1px}.mc-review .mc-rv-ico svg{display:block}.mc-review .mc-rv-f{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.mc-review .mc-rv-f button{height:30px;padding:0 16px;border:1px solid var(--mbu-border);background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius);font:inherit;font-size:13px;cursor:pointer}.mc-review .mc-rv-f button:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border-strong)}.mc-review .mc-rv-f [data-rv=go]{font-weight:600;background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong);color:var(--mbu-accent-text)}.mc-review .mc-rv-f [data-rv=go]:hover{background:var(--mbu-accent);border-color:var(--mbu-accent);color:var(--mbu-accent-fg)}'
        + '#mc-root .mc-act .mc-exec.mc-cd{background:linear-gradient(90deg,color-mix(in srgb,var(--mbu-accent) 35%,var(--mbu-accent-soft)) var(--mc-cd,0%),var(--mbu-accent-soft) 0);border-color:var(--mbu-accent)}'
        // a phone: MusicBrainz's page is wider than the screen, so the browser widens the layout viewport
        // to it and MC (fixed, inset 0) with it, cut off at the sides. Pinning the page's body brings the
        // viewport back to the screen. Then one column: the header wraps (the steps on a row of their own,
        // scrolling sideways), the panes stack under the tracks, and a wide card scrolls inside itself.
        + '@media (max-width: 760px){'
        + 'html.mc-open body{position:fixed;inset:0;overflow:hidden}'
        + '.mc-hdr{flex-wrap:wrap;height:auto;gap:6px 8px;padding:6px 8px}'
        + '.mc-rel{flex:1 1 0;max-width:none;padding-right:0}'
        // the release, ⚙ and ✕ on the first row; the steps, then Execute, on the second
        + '.mc-hdr .mc-act{display:contents}.mc-rel{order:1;flex-basis:calc(100% - 130px)}.mc-act [data-act=cfg]{order:2}.mc-act [data-act=close]{order:3}'
        + '.mc-steps{order:4;flex:1 1 60%;height:46px;justify-content:flex-start;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}'
        + '.mc-steps>*{flex-shrink:0}.mc-step .tx{flex:0 0 auto;width:auto;max-width:110px}'
        + '#mc-root .mc-act .mc-exec{order:5;min-width:0;flex:none}'
        // a barcode's lane: the barcode and its state on the first line, the platforms and "take all" under it
        + '.mc-bcl,.mc-bcl.mc-hascat{grid-template-columns:10px max-content minmax(0,1fr) auto;grid-template-areas:"t c k p" ". i i a";row-gap:4px}'
        + '.mc-bcl>.mc-tri{grid-area:t}.mc-bcl>.mc-bc{grid-area:c}.mc-bcl>.mc-cats{grid-area:k;width:auto!important}.mc-bcl>.mc-bcl-ic{grid-area:i}.mc-bcl>.mc-all{grid-area:a;justify-self:end}.mc-bcl>:last-child{grid-area:p;justify-self:end}.mc-bcl>span:empty:not(.mc-tri):not(:last-child){display:none}'
        + '.mc-main,#mc-root.no-left .mc-main,#mc-root.no-right .mc-main{display:flex;flex-direction:column;overflow:auto}'
        + '.mc-center{order:-1;flex:none;overflow:visible;padding:8px}'
        + '.mc-side{flex:none;overflow:visible;border:0;border-top:1px solid var(--mbu-border)}.mc-side.right{border-left:0}'
        // a card's header wraps rather than squeeze its title (Release credits' import buttons go under it)
        + '.mc-sect-h{flex-wrap:wrap}.mc-sect-h .t{white-space:nowrap}'
        // the settings: less of the screen for the overlay's margin, and the title row wraps rather than cut off Log
        + '.mbu-ov:has(>.mc-cfg){padding:10px}.mc-cfg .mbu-cfg-h{flex-wrap:wrap;row-gap:4px}'
        + '.mc-sect{overflow-x:auto}.mc-tbl td.ttl{min-width:140px}.mc-row2{flex-direction:column;align-items:stretch}'
        + '}';
    document.head.appendChild(s);
}

// a step switched off by a click is off for this page only, not saved
const PAGE_OFF = new Set();
function modeOf(p) { return PAGE_OFF.has(p.id) ? 'off' : p.mode ? S[p.mode] : (S.disabled || []).includes(p.id) ? 'off' : 'auto'; }
// the mode of Fusion, CH or Platforms (a settings key), 'off' while its step is off for this page
const modeNow = key => modeOf(PROVIDERS.find(p => p.mode === key));
// #753: a step in the header switches its provider off (not probed, its column, card and Execute
// left out) and on again. A click switches it off for this page; a right-click (keep) switches it off
// for good, as a setting. Either switches it on again: Fusion and CH back to the mode they had, the others to Auto
const onMode = {};
function toggleProvider(id, keep) {
    const p = PROVIDERS.find(x => x.id === id); if (!p) return;
    if (PAGE_OFF.has(id)) {
        PAGE_OFF.delete(id);
        // a right-click keeps it off, now for good; a click switches it on, and the setting too when that is off
        if (!keep && modeOf(p) !== 'off') { Log.cat('UI').info(id + ' on again'); if (ui) rebuildBody(); return; }
        if (keep && modeOf(p) === 'off') { if (ui) rebuildBody(); return; }
    }
    const on = modeOf(p) === 'off';
    if (!on && !keep) {
        PAGE_OFF.add(id);
        Log.cat('UI').info(id + ' off for this page');
        if (ui) rebuildBody();
        return;
    }
    if (p.mode) {
        if (!on) onMode[id] = S[p.mode];
        setMode(p.mode, on ? onMode[id] || DEFAULTS[p.mode] : 'off');
        return;
    }
    Log.cat('UI').info(id + ' ' + (on ? 'on' : 'off'));
    S.disabled = (S.disabled || []).filter(x => x !== id).concat(on ? [] : [id]); saveSettings();
    if (ui) rebuildBody();
}
function stateOf(p) {
    if (modeOf(p) === 'off') return 'off';
    if (!found[p.id]) return 'idle';
    const r = results[p.id];
    if (!r) return 'ready';
    if (r.state === 'busy') return 'busy';
    return countNew(p.id) ? 'add' : 'ok';
}
// an info-only provider (CH) counts what it found instead of what it would add
function infoCount(id) { const r = results[id]; return r && r.findings ? r.findings.reduce((n, x) => n + (x.credits || 0), 0) : 0; }
// a 'searched' row (AS's sources other than the best cover's) is in the pool, not something entered
function countNew(id) { const r = results[id]; return (r && r.findings ? r.findings.filter(x => x.state === 'new' && x.role !== 'searched').length : 0) + (id === 'as' ? asMore() : 0); }
function stateText(p) {
    const st = stateOf(p), r = results[p.id];
    if (st === 'off') return 'off';
    if (st === 'idle') return 'no adapter yet';
    if (st === 'ready') return 'connected · not probed';
    if (st === 'busy') return 'probing' + (r.note ? ': ' + r.note : '') + '…';
    if (r.summary && !r.findings.some(x => PICKABLE[x.state])) return r.summary;
    const t = r.findings.reduce((a, x) => { const k = x.role === 'searched' ? 'searched' : x.state; a[k] = (a[k] || 0) + 1; return a; }, {});
    return [t.new && t.new + ' new', t.searched && t.searched + ' searched', t.linked && t.linked + ' linked', t.withheld && t.withheld + ' withheld', t.unsure && t.unsure + ' unsure', t.blocked && t.blocked + ' blocked', t.none && t.none + ' not found'].filter(Boolean).join(' · ') || 'nothing';
}
function paintAll() { if (!ui) return; asStage(); paintBadges(); paintCards(); paintReleaseCredits(); fitCards(); paintMatrix(); paintInspector(); paintExec(); }

function header() {
    const h = el('header', 'mc-hdr');
    h.addEventListener('animationiteration', e => { if (e.target === h && e.pseudoElement === '::after' && !isBusy()) h.classList.remove('mc-busy'); });
    // #680: the release where Probe was (the cover is the one in the Cover art card), the steps, then
    // Execute with its count; logo, version and Auto probe live in ⚙
    h.innerHTML = mbuHtml(fmtIcon(rel.format) + '<div class="mc-rel"><div class="mc-ttl" data-tip="' + esc(rel.title) + '">' + esc(rel.title) + '</div>'
        + '<div class="mc-art" data-tip="' + esc(rel.artist) + '">' + esc(rel.artist || '')
        + (rel.versions ? ' <a class="mc-ver" href="' + esc(rel.versions.href) + '" target="_blank" rel="noopener" data-tip="Every version of this release">(' + esc(rel.versions.text) + ')</a>' : '') + '</div></div>'
        + '<div class="mc-act"><button type="button" class="mc-btn mc-exec" data-act="exec" disabled data-tip="Apply the selected changes, step by step">Execute</button>'
        + '<button type="button" class="mc-btn ghost" data-act="cfg" data-tip="Settings">' + MBU_CFG_ICON + '</button>'
        + '<button type="button" class="mc-btn ghost" data-act="close" data-tip="Close (Esc)">✕</button></div>');
    h.insertBefore(steps(), h.querySelector('.mc-act'));
    return h;
}

// #680: the release's format as an icon left of the title, its name in the tooltip. Only the
// first medium counts ("2×CD + DVD" is a CD); a format with no icon of its own is a disc.
const FORMAT_ICONS = {
    digital: '<path d="M8 25h16a6 6 0 0 0 .8-11.95A9 9 0 0 0 7.4 15.2 5 5 0 0 0 8 25z"/>',
    // a record sliding out of its sleeve, so it doesn't read as a CD
    vinyl: '<circle cx="14" cy="17" r="11.5"/><circle cx="14" cy="17" r="7.5" stroke-width="1.5"/><circle cx="14" cy="17" r="3.2" fill="currentColor"/><path d="M28 3v11l-6 6"/><circle cx="28" cy="3.5" r=".6" fill="currentColor"/>',
    cassette: '<rect x="3" y="7" width="26" height="18" rx="2.5"/><circle cx="11" cy="15" r="2.6"/><circle cx="21" cy="15" r="2.6"/><path d="M11 12.4h10M9 25l2-4h10l2 4"/>',
    reel: '<circle cx="9" cy="12" r="6.5"/><circle cx="23" cy="12" r="6.5"/><circle cx="9" cy="12" r="1.6" fill="currentColor"/><circle cx="23" cy="12" r="1.6" fill="currentColor"/><path d="M9 18.5l3 8.5h8l3-8.5"/>',
    video: '<rect x="2.5" y="8" width="27" height="16" rx="1.5"/><rect x="10" y="12" width="12" height="7" rx="1"/><circle cx="13" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><path d="M6 21h20" stroke-width="1.4" opacity=".55"/>',
    usb: '<rect x="10" y="12" width="12" height="17" rx="2.5"/><path d="M12 12V4h8v8"/><path d="M14.5 7.5h0M17.5 7.5h0" stroke-width="2.4"/>',
    card: '<path d="M10 3h12a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7z"/><path d="M12 4v5M15.5 4v5M19 4v5" stroke-width="1.6"/>',
    floppy: '<path d="M5 5h18l4 4v18H5z"/><path d="M10 5v7h11V5"/><path d="M18 7.5v2.5"/><rect x="9" y="17" width="14" height="10"/>',
    other: '<rect x="4" y="4" width="24" height="24" rx="5"/><path d="M11 16h0M16 16h0M21 16h0" stroke-width="3"/>',
    disc: '<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="3.5"/><path d="M16 7a9 9 0 0 1 9 9" opacity=".55"/>',
};
const FORMAT_KINDS = [
    ['digital', /digital|download/i],
    ['vinyl', /vinyl|"|shellac|flexi|acetate|phonograph/i],
    ['reel', /reel/i],
    ['video', /vhs|betamax|video8|u-matic|\bhi8\b|\bvhd\b/i],
    ['cassette', /cassette|tape|cartridge|\bDAT\b|\bDCC\b/i],
    ['usb', /usb/i],
    ['card', /\bcard\b/i],
    ['floppy', /floppy|zip disk/i],
    ['other', /^\s*other\s*$/i],
];
// #753: a click on it shows or hides the execution order, so it is there with no format too
const fmtKind = format => (format && FORMAT_KINDS.find(([, re]) => re.test(format.split('+')[0])) || ['disc'])[0];
const fmtGlyph = (format, size) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' + FORMAT_ICONS[fmtKind(format)] + '</svg>';
function fmtIcon(format) {
    const first = (format || '').split('+')[0];
    const k = (format && FORMAT_KINDS.find(([, re]) => re.test(first)) || ['disc'])[0];
    return '<span class="mc-fmt" data-tip="' + esc((format || 'Format unknown') + '\nClick: show or hide the order of the steps') + '"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' + FORMAT_ICONS[k] + '</svg></span>';
}

function seg(p) {
    return '<div class="mc-seg" data-mode="' + p.mode + '" data-tip="Auto: fetch during Probe · Ask: fetch on a button · Off: skip">'
        + ['auto', 'ask', 'off'].map(m => '<button type="button" data-v="' + m + '"' + (S[p.mode] === m ? ' class="on"' : '') + '>' + m[0].toUpperCase() + m.slice(1) + '</button>').join('') + '</div>';
}

function orderSidebar() {
    const a = el('aside', 'mc-side left');
    let html = '<h2 class="mc-sec">Execution order <button type="button" class="mc-x" data-close="left" data-tip="Hide">×</button></h2>';
    const pv = p => '<div class="mc-pv">' + esc(p.provider) + '</div>';
    STEPS.forEach((s, k) => {
        const node = '<span class="mc-node">' + (s.lanes ? '<span class="par" data-tip="These run side by side">⇶</span>' : sIcon(s.id)) + '<span class="num">' + (k + 1) + '</span></span>';
        const last = k === STEPS.length - 1 ? ' last' : '';
        if (s.lanes) {
            html += '<div class="mc-stage head">' + node + '<div><div class="nm">' + esc(s.name) + ' <span class="tag">parallel</span></div></div></div>'
                + s.lanes.map((l, n) => '<div class="mc-stage sub' + (n === s.lanes.length - 1 ? last : '') + (modeOf(l) === 'off' ? ' off' : '') + '" data-p="' + l.id + '"><span class="mc-node">' + sIcon(l.id) + '</span>'
                    + '<div><div class="nm">' + esc(l.name) + '<span class="mc-chip"></span></div>' + pv(l) + '<div class="meta st"></div></div></div>').join('');
        } else {
            html += '<div class="mc-stage' + last + (modeOf(s) === 'off' ? ' off' : '') + '" data-p="' + s.id + '">' + node
                + '<div><div class="nm">' + esc(s.name) + (s.info ? ' <span class="mc-mode">info</span>' : '') + '<span class="mc-chip"></span></div>' + pv(s)
                + '<div class="meta st"></div>' + (s.id === 'pc' ? '<div class="mc-covbar"></div>' : '') + (s.mode ? seg(s) + '<div class="mc-hint">' + modeHint(s) + '</div>' : '') + '</div></div>';
        }
    });
    html += '<div class="mc-runs"><div><span>Probed</span><b class="f-probe"></b></div><div><span>On Execute</span><b class="f-exec"></b></div>'
        + '<div><span>Last run</span><b><span class="f-run"></span> · <button type="button" class="mc-loglink" data-act="log" data-tip="Mission Control’s log">Log</button></b></div></div>';
    a.innerHTML = mbuHtml(html);
    return a;
}
function modeHint(p) { return { auto: 'fetches during Probe', ask: 'waits for ' + (FETCH_LABEL[p.id] || 'Fetch'), off: 'left out' }[modeOf(p)] || ''; }
// the sidebar's words for a step: only data (the script has its own line)
function sideText(p) {
    const st = stateOf(p), r = results[p.id];
    if (st === 'off') return 'off';
    if (st === 'idle') return 'not installed';
    if (st === 'ready') return modeOf(p) === 'ask' ? 'not fetched yet' : 'not probed yet';
    let t = stateText(p);
    // CH: "Qobuz + Deezer: 99 credits on 18 of 18 tracks" → the count first, the sources after
    const m = p.id === 'ch' && /^([^:]+): (.+)$/.exec(t);
    if (m) t = m[2] + ', from ' + m[1];
    // IS: how many tracks already have an ISRC, before what it found
    if (p.id === 'is' && st !== 'busy' && r.findings) {
        const has = r.findings.filter(x => x.kind !== 'link' && (x.state === 'linked' || (x.existing || []).length)).length;
        t = has + ' of ' + rel.tracks.length + ' tracks have an ISRC · ' + t;
    }
    return t;
}
// [chip class, chip text] from the header's state
function chipOf(p) {
    const [cls, , mark] = stepState(p);
    if (cls === 'add') return ['add', mark];
    if (cls === 'ok') return p.info ? ['info', String(infoCount(p.id))] : ['ok', '✓'];
    if (cls === 'busy') return ['busy', '…'];
    if (cls === 'err' || cls === 'stalled') return [cls, '!'];
    return ['', ''];
}
// PC's links as one bar: linked, to add, held back, not found
function paintCoverage(n) {
    const bar = n.querySelector('.mc-covbar'); if (!bar) return;
    const r = results.pc, xs = r && r.state === 'done' ? r.findings || [] : [];
    const t = { linked: 0, new: 0, held: 0, none: 0 };
    xs.forEach(x => { t[x.state === 'withheld' || x.state === 'unsure' ? 'held' : x.state in t ? x.state : 'none']++; });
    bar.innerHTML = mbuHtml(xs.length ? Object.keys(t).filter(k => t[k]).map(k => '<i class="' + k + '" style="width:' + (100 * t[k] / xs.length).toFixed(2) + '%"></i>').join('') : '');
    bar.dataset.tip = xs.length ? '- ' + t.linked + ' linked\n- ' + t.new + ' to add\n- ' + t.held + ' held back\n- ' + t.none + ' not found' : '';
}
// the footer: when the last probe ran and how long it took, what Execute would send, the last run
let probeAt = 0, probeTook = 0, lastRun = null;
function ago(t) { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? 'just now' : s < 60 ? s + ' s ago' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; }
function isProbing() { return Object.values(results).some(r => r.state === 'busy'); }
function noteProbeDone() { if (probeAt && !probeTook && !isProbing()) { probeTook = Date.now() - probeAt; Log.cat('UI').debug('probe took ' + probeTook + ' ms'); } }
function paintFoot() {
    const f = ui && ui.querySelector('.mc-runs'); if (!f) return;
    f.querySelector('.f-probe').textContent = !probeAt ? 'not yet' : isProbing() ? 'probing · ' + Math.round((Date.now() - probeAt) / 1000) + ' s' : ago(probeAt) + (probeTook ? ' · took ' + Math.max(1, Math.round(probeTook / 1000)) + ' s' : '');
    const n = changeCount();
    f.querySelector('.f-exec').textContent = executing ? 'executing…' : n ? n + ' selected' : 'nothing selected';
    f.querySelector('.f-run').textContent = !lastRun ? 'none' : ago(lastRun.at) + ' · ' + (lastRun.dry ? 'dry run' : lastRun.sent + ' applied') + (lastRun.failed ? ' · ' + lastRun.failed + ' failed' : '');
}

// a provider's own userscript icon (#680: in the execution order, not a glyph)
function sIcon(id) { return PROVIDER_ICONS[id] ? '<img class="mc-sic" alt="" src="' + PROVIDER_ICONS[id] + '">' : ''; }
// C (#680): the execution order as a stepper under the header, a ring per provider and what it
// is doing in words: the step it is on and for how long, amber when no word came for STALL_MS
// (what is stuck), or what it found. ↻ probes again; a click on a step switches it off or on (#753).
let STALL_MS = 20000;
function steps() {
    const d = el('div', 'mc-steps');
    const node = p => '<span class="mc-step" data-step="' + p.id + '"><span class="mc-ring">' + sIcon(p.id) + '<sup hidden></sup></span><span class="tx"><b>' + esc(p.provider) + '</b><i></i></span></span>';
    d.innerHTML = mbuHtml('<button type="button" class="mc-re" data-act="probe" data-tip="Probe\nAsk every provider what is missing. ⚙ can make it run on open.">↻</button>'
        + STEPS.map(s => s.lanes ? '<span class="mc-par" data-tip="These run side by side">' + s.lanes.map(node).join('') + '</span>' : node(s)).join('<span class="mc-arrow">→</span>'));
    return d;
}
function addText(p) {
    const xs = ((results[p.id] || {}).findings || []).filter(x => x.state === 'new' && x.role !== 'searched');
    const n = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
    if (p.id === 'is') { const l = xs.filter(x => x.kind === 'link').length, i = xs.length - l; return [i && n(i, 'ISRC'), l && n(l, 'link')].filter(Boolean).join(' · ') + ' to add'; }
    // #840: what is selected of what was found, as Execute counts it
    if (p.id === 'pc') { const k = xs.filter(x => picked.pc && picked.pc.has(x.key)).length; return k === xs.length ? n(xs.length, 'link') + ' to add' : k + ' of ' + n(xs.length, 'link') + ' selected'; }
    if (p.id === 'as') { const k = xs.some(x => x.role === 'best') ? 1 : 0, m = asMore(); if (k || m) return [k && n(k, 'cover') + ' to enter', m && n(m, 'gallery change')].filter(Boolean).join(' · '); }
    return xs.length + ' new';
}
// [class, words, mark on the ring]
function stepState(p) {
    const st = stateOf(p), r = results[p.id] || {};
    if (st === 'off') return ['off', 'off', ''];
    if (st === 'idle') return ['wait', 'not installed', ''];
    const f = r.falcon, falcon = f && f.running ? 'Falcon: ' + f.items.filter(i => !['queued', 'active'].includes(i.status)).length + ' of ' + f.items.length + ' done' : null;
    const doing = st === 'busy' ? (r.note || 'starting') : (executing && r.working) || falcon;
    if (doing) {
        const s = Math.max(0, Math.round((Date.now() - (r.at || Date.now())) / 1000));
        return Date.now() - (r.at || Date.now()) >= STALL_MS ? ['stalled', 'no word for ' + s + ' s · ' + doing, '!'] : ['busy', doing + (s >= 2 ? ' · ' + s + ' s' : ''), ''];
    }
    if (r.applied && !r.applied.ok) return ['err', r.applied.note || 'failed', '!'];
    if (st === 'ready') return ['wait', modeOf(p) === 'ask' ? 'waits for ' + (FETCH_LABEL[p.id] || 'Fetch') : 'not probed', ''];
    if (st === 'add') return ['add', addText(p), String(countNew(p.id))];
    if (p.info) return ['ok', infoCount(p.id) + ' credit' + (infoCount(p.id) === 1 ? '' : 's') + ' found', '✓'];
    return ['ok', r.summary && !(r.findings || []).some(x => PICKABLE[x.state]) ? r.summary : 'nothing new', '✓'];
}
function paintSteps() {
    if (!ui) return;
    PROVIDERS.forEach(p => {
        const n = ui.querySelector('.mc-step[data-step="' + p.id + '"]'); if (!n) return;
        const [cls, words, mark] = stepState(p);
        n.className = 'mc-step ' + cls;
        n.dataset.tip = p.provider + ' — ' + (cls === 'busy' || cls === 'stalled' ? words : stateText(p)) + (cls === 'off' ? (PAGE_OFF.has(p.id) ? ' (off for this page)' : '') + '\nClick: switch it on' : '\nClick: off for this page\nRight-click: off for good');
        n.querySelector('i').textContent = words;
        const sup = n.querySelector('sup'); sup.hidden = !mark; sup.textContent = mark;
        // the provider's card shows the same state: a stripe on its edge, a tint and a word in its header (#680)
        const sec = ui.querySelector('.mc-sect[data-sect="' + p.id + '"]'); if (!sec) return;
        sec.dataset.st = cls;
        const h = sec.querySelector('.mc-sect-h');
        let tag = h.querySelector('.mc-st');
        if (!tag) { tag = el('span', 'mc-st'); const sw = h.querySelector('.mc-icsw'); sw ? sw.after(tag) : h.prepend(tag); }
        tag.textContent = cls === 'wait' ? '' : cls === 'err' ? 'error' : cls;
    });
}
// the seconds while something works, and the switch to stalled, need a clock
let stepClock = 0;

// One row per track, a column per track-level provider. Values arrive with
// the providers' probe; until then a cell says why it is empty.
// A track-level provider's finding carries the recording MBID in `track`; a column
// renders it. `pick`: the column holds the tick box for that provider's finding.
const COLS = [
    { id: 'isrc', p: 'is', head: 'ISRC · IS', pick: true, cell: x =>
        x.state === 'new' ? '<span class="mc-add mono">+ ' + isrcHtml(x.isrc) + '</span>'
        : x.state === 'unsure' ? '<span class="mc-warn mono" data-tip="' + esc(x.why || '') + '">+ ' + isrcHtml(x.isrc) + ' ⚠</span>'
        // a provider's hard stop (#680: an ISRC on two recordings): shown, never tickable
        : x.state === 'blocked' ? '<span class="mc-err mono" data-tip="' + esc('⚠ Blocked\n' + (x.why || '')) + '">⊘ ' + isrcHtml(x.isrc) + '</span>'
        : x.state === 'linked' ? '<span class="weak mono" data-tip="' + esc((x.existing || []).join(', ')) + '">' + isrcHtml((x.existing || [])[0] || x.isrc || '') + ((x.existing || []).length > 1 ? ' +' + (x.existing.length - 1) : '') + '</span>'
        : '<span class="pend">none found</span>' },
    // rendered by linksCell: IS's linked icons plus the links Find links found (#680)
    { id: 'links', p: 'is', head: 'Rec links · IS', cell: () => '' },
    // the count (fxPill, before the cell) opens Fusion's comparison under the row; the release names are the toggle
    { id: 'fusion', p: 'fusion', head: 'RG duplicates · Fusion', pick: true, cell: x =>
        FX_SHOWN[x.state] ? '<span class="weak">' + esc(fxReleases(x)) + '</span>'
        // as Fusion's pool badge: this recording has an open edit, so Fusion groups it with nothing
        : x.pending ? '<a class="mc-fxp" target="_blank" href="/recording/' + esc(x.key) + '/open_edits" data-tip="This recording has an open edit\nFusion leaves it out of Match until the edit closes.">⏳ pending</a>'
        : '<span class="pend">—</span>' },
    // #782: what the platforms give for the track: a length the track hasn't, a title that differs (shown, never applied)
    // a title or length taken in on the row under the track replaces them
    { id: 'plat', p: 'fc', head: 'Platforms · FC', cell: x => {
        const p = CMP.picks[pfIndex(x)];
        if (p) return pfPill(x) + ' <span class="mc-add" data-tip="Taken in\nPlatform Check sends it with the release.">' + [p.title != null ? '→ ' + esc(p.title) : '', p.ms ? '→ <span class="mono">' + ccLen(p.ms) + '</span>' : ''].filter(Boolean).join(' · ') + '</span>';
        return (x.lenNew ? '<span class="mc-add mono" data-tip="' + esc('The track has no length\n' + ccLen(x.len) + ' from ' + x.lenFrom + '. Platform Check adds it with the release (Track lengths).') + '">+ ' + ccLen(x.len) + '</span> ' : '') + pfPill(x);
    } },
    { id: 'ch', p: 'ch', head: 'Credits · CH', cell: x =>
        x.credits ? '<span data-tip="' + esc((x.list || []).map(c => c.name + ' — ' + c.role).join('\n')) + '">' + x.credits + '</span>' : '<span class="pend">—</span>' },
];
const FETCH_LABEL = { fusion: 'Fetch RG', ch: 'Fetch credits', fc: 'Compare' };
function colHead(c) {
    const p = PROVIDERS.find(x => x.id === c.p);
    if (!p.mode) return esc(c.head);
    const r = results[p.id];
    const ask = modeOf(p) === 'ask' && found[p.id] && (!r || r.state !== 'busy');
    return esc(c.head) + (ask && FETCH_LABEL[p.id] ? ' <button type="button" class="mc-fetch" data-fetch="' + p.id + '" data-tip="Run this slow fetch now">' + (r ? '↻ ' : '') + FETCH_LABEL[p.id] + '</button>'
        : '<span class="mc-mode">' + modeOf(p) + '</span>');
}
function trackFinding(pid, rec) {
    const r = results[pid];
    return r && r.state === 'done' && r.findings ? r.findings.find(x => x.track === rec && !x.kind) || null : null;
}
// IS's recording links to add (#680: Find links runs in the probe): its `kind: 'link'` findings
function trackLinks(rec) {
    const r = results.is;
    return r && r.state === 'done' && r.findings ? r.findings.filter(x => x.track === rec && x.kind === 'link') : [];
}
// the links column: what's linked (plain icons), then what Find links found (each its own toggle)
// both kinds in one fixed order, by icon, so a platform sits in the same place on every track: found links come in
// the order the stores answered, which differs from track to track
const byIcon = (a, b) => a.localeCompare(b);
function linksCell(t) {
    const x = trackFinding('is', t.rec), add = trackLinks(t.rec).slice().sort((a, b) => byIcon(urlIcon(a.url), urlIcon(b.url)));
    const have = (x && x.linkUrls || []).slice().sort((a, b) => byIcon(urlIcon(a), urlIcon(b))).map(u => '<a class="mc-pico mc-have" target="_blank" rel="noopener" href="' + esc(u) + '" data-tip="' + esc('Linked: ' + u) + '">' + stIcon(urlIcon(u), 14) + '</a>');
    const neu = add.map(l => {
        const on = picked.is && picked.is.has(l.key);
        // a found link opens on click like a linked one; right-click takes it in or leaves it out
        const ico = urlIcon(l.url);
        return '<a class="mc-pick mc-lnk' + (on ? ' on' : '') + '" data-prov="is" data-col="links" data-ico="' + ico + '" data-key="' + esc(l.key) + '" target="_blank" rel="noopener" href="' + esc(l.url) + '" data-tip="' + esc(l.name + (on ? ' — taken in' : '') + '\n' + l.url + '\nClick: open' + '\nRight-click: ' + (on ? 'leave it out' : 'take it in')
            + '\nCtrl+right-click: the whole track\nAlt+right-click: ' + l.name + ' on every track\nCtrl+Alt+right-click: everything') + '">+' + stIcon(ico, 14) + '</a>';
    });
    if (!have.length && !neu.length) return '<span class="pend">none</span>';
    return '<span class="mc-icons">' + have.join('') + (have.length && neu.length ? '<span class="mc-isep"></span>' : '') + neu.join('') + '</span>';
}
const PICKABLE = { new: 1, withheld: 1, unsure: 1 };
// what a lane's "take all in" takes: not a link whose track count or format says it is another release (#709)
const laneTakes = x => PICKABLE[x.state] && !x.mismatch && !x.other && !['barcode', 'catno', 'label', 'event', 'lengths'].includes(x.kind);   // #740: never a catalog number or a label
function cellHtml(c, t) {
    const p = PROVIDERS.find(x => x.id === c.p), r = results[c.p];
    if (r && r.state === 'busy') return '<span class="pend">…</span>';
    if (c.id === 'links') return r && r.state === 'done' ? linksCell(t) : '<span class="pend">—</span>';
    const x = trackFinding(c.p, t.rec);
    if (!x) return '<span class="pend">—</span>';
    const lead = c.id === 'fusion' ? fxPill(x) : '';
    // a pickable cell is its own toggle, no tick box (#680): a click takes it in or leaves it out
    if (!c.pick || !PICKABLE[x.state]) return lead + c.cell(x);
    const on = picked[p.id] && picked[p.id].has(x.key);
    return lead + '<span class="mc-pick' + (on ? ' on' : '') + '" data-prov="' + p.id + '" data-col="' + c.id + '" data-key="' + esc(x.key) + '" data-tip="' + (on ? 'Taken in\nClick: leave it out' : 'Click: take it in')
        + '\nCtrl+click: the whole track\nAlt+click: the whole column\nCtrl+Alt+click: everything\nDrag: down the column">' + c.cell(x) + '</span>';
}

// Fusion's comparison (#680) under the track is Fusion's own group card (#790): MC leaves a slot
// ([data-mc-slot="fusion"]) and asks Fusion to fill it (mc:mount), as Art Station fills the cover-art
// card's (#784), so the card never differs from the one on Fusion's board. Fusion looks the ISRCs and
// AcoustIDs up by itself once it answers (fxAutoCheck): they are what a merge stands on.
const FX_SHOWN = { new: 1 };
const fxReleases = x => (x.matches || []).map(m => m.release || '').filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 2).join(', ');
const fxRel = m => (m.release || '?') + (m.pos ? ' · ' + m.pos + (m.of ? '/' + m.of : '') : '') + (m.more ? ' +' + m.more : '');
const fxLenDiff = (me, m) => {
    const d = me && me.ms != null && m.ms != null ? Math.round((m.ms - me.ms) / 1000) : 0;
    return d ? ' <span class="mc-fxdiff">' + (d > 0 ? '+' : '−') + Math.abs(d) + 's</span>' : '';
};
const fxCan = cap => !!(found.fusion && (found.fusion.capabilities || []).includes(cap));
// Fusion's icon, not a labelled button: one sits on every comparison and the label was noise
const fxOpenBtn = x => fxCan('open') ? '<button type="button" class="mc-fxgo" data-act="fx-fusion" data-key="' + esc(x.key) + '" data-tip="Open in Fusion\nFusion\'s window, with this group on the board" aria-label="Open in Fusion"><img alt="" src="' + PROVIDER_ICONS.fusion + '"></button>' : '';
function fxPill(x) {
    if (!FX_SHOWN[x.state]) return '';
    const open = fxOpen.has(x.key), n = (x.matches || []).length;
    return '<button type="button" class="mc-fxo" data-act="fx" data-key="' + esc(x.key) + '" aria-expanded="' + open + '" data-tip="' + (open ? 'Hide' : 'Show') + ' what Fusion compared">'
        + '<span class="car">▸</span>' + n + ' match' + (n === 1 ? '' : 'es') + '</button> ';
}
// #782: a track whose title differs opens, under its row, what each platform gives for it
// the track index of a comparison finding (key fc:<i>), its medium and position, its length in ms
const pfIndex = x => +String(x.key).slice(3);
const pfPos = i => { const t = rel.tracks[i]; return t ? rel.tracks.slice(0, i + 1).filter(x => x.medium === t.medium).length : 0; };
const pfMs = v => { const m = String(v || '').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/); return m ? ((+(m[1] || 0) * 60 + +m[2]) * 60 + +m[3]) * 1000 || null : null; };
const pfSameLen = (a, b) => (!a && !b) || (!!a && !!b && Math.abs(a - b) < 1000);
// each platform's version of the track: [{ k, title, ms, isrc }]
const pfPlats = x => (x.versions || []).flatMap(v => v.keys.map((k, j) => { const tr = v.tracks[j] || {}; return { k, title: tr.title || v.title, ms: tr.lengthMs || null, isrc: tr.isrc ? tr.isrc.toUpperCase() : null }; }));
// what a track differs in from what some platform gives: its title, or its length by a second or more
const pfDiffers = x => { const t = rel.tracks[pfIndex(x)]; return !!t && (x.differs || pfPlats(x).some(p => p.ms && !pfSameLen(p.ms, pfMs(t.len)))); };
// a title or length taken in on the row under the track (#782): kept only while it differs from the track's own;
// `from` names the platforms that give it. Falcon writes it in the release editor, Platform Check sends it.
function pfSet(i, what, val, from) {
    const t = rel.tracks[i], x = t && trackFinding('fc', t.rec);
    if (!x) return;
    const p = Object.assign({}, CMP.picks[i] || {});
    p.from = Object.assign({}, p.from || {});
    if (what === 'title') {
        val = String(val || '').trim();
        if (!val || val === t.title) { delete p.title; delete p.from.title; delete p.recording; }
        else { p.title = val; p.from.title = from || ''; }
    } else {
        if (!val || pfSameLen(val, pfMs(t.len))) { delete p.ms; delete p.from.ms; }
        else { p.ms = val; p.from.ms = from || ''; }
    }
    if (p.title == null && !p.ms) delete CMP.picks[i]; else CMP.picks[i] = p;
    Log.cat('UI').info('track ' + t.pos + ': ' + (CMP.picks[i] ? JSON.stringify(CMP.picks[i]) : 'as it is'));
    paintMatrix(); paintExec();
}
// what Platform Check gets: { medium, position, title?, recording?, ms?, was, from }
function pfChanges() {
    if (modeNow('platforms') === 'off' || !results.fc || results.fc.state !== 'done') return [];
    return Object.entries(CMP.picks).map(([i, p]) => {
        const t = rel.tracks[+i];
        if (!t) return null;
        const o = { medium: t.medium || 1, position: pfPos(+i), was: {} };
        if (p.title != null) { o.title = p.title; o.was.title = t.title; if (p.recording) o.recording = true; }
        if (p.ms) { o.ms = p.ms; o.was.ms = pfMs(t.len); }
        const from = [...new Set([p.from && p.from.title, p.from && p.from.ms].filter(Boolean))].join('; ');
        if (from) o.from = from;
        return o;
    }).filter(Boolean);
}
// #785: guess case for a track's title, the shared one, in the release's language's mode
const pfGuessMode = () => mbuGuessCase.modeFor(rel && rel.language);
function pfGuess(title) {   // the language, not its mode: a Cyrillic title gets Sentence whatever it is
    try { return mbuGuessCase(title || '', { entity: 'track', language: (rel && rel.language) || null }); } catch (e) { Log.cat('UI').warn('guess case failed on "' + title + '": ' + e.message); return title; }
}
// a title the platforms give that differs from the track's only in its capitals: a matter of guess case, not another title
function pfCaseOnly(x) { const t = rel.tracks[pfIndex(x)]; return !!(x.differs && t && x.title.toLowerCase() === String(t.title || '').toLowerCase()); }
// #782: the row under the track: what each platform gives for it, each title and length a click takes in
function pfPill(x) {
    const open = fxOpen.has(x.key), d = x.differs, cs = pfCaseOnly(x);
    const lead = !d ? 'The platforms agree with the title (' + x.titleFrom + ')'
        : cs ? 'Only the capitals differ: the platforms give “' + x.title + '” (' + x.titleFrom + ')\nAa on the track\'s title guesses its case'
        : 'The platforms give “' + x.title + '” (' + x.titleFrom + ')';
    return '<button type="button" class="mc-fxo' + (!d ? ' same' : cs ? ' case' : '') + '" data-act="fx-pf" data-key="' + esc(x.key) + '" aria-expanded="' + open + '" data-tip="' + esc(lead + '\nClick: ' + (open ? 'hide' : 'show') + ' what each platform gives\n\nA click on a title or a length there takes it in.') + '">'
        + '<span class="car">▸</span>' + (!d ? '✓' : cs ? '≠ case' : '≠ title') + '</button>';
}
// the lines under a track, as rows of the Tracks table: the track's own (what it gets, typed in), then one per version
// (the platforms giving the same title, length and ISRC), each value in its column, the platforms under Platforms
function pfRows(x, t, heads) {
    const i = pfIndex(x), p = CMP.picks[i] || {}, own = pfMs(t.len);
    const take = (what, k, inner, val, tip) => {
        const on = what === 'title' ? p.title === val : !!p.ms && pfSameLen(p.ms, val);
        return '<button type="button" class="mc-pft' + (on ? ' on' : '') + '" data-act="fx-take" data-i="' + i + '" data-what="' + what + '" data-k="' + esc(k) + '" data-tip="' + esc(tip) + '">' + inner + '</button>';
    };
    const row = (cells, cls) => '<tr class="mc-pfr' + (cls ? ' ' + cls : '') + '" data-pfr="' + i + '">' + heads.map(h => '<td' + (h === 'ttl' ? ' class="ttl"' : '') + '>' + (cells[h] || '') + '</td>').join('') + '</tr>';
    const cur = p.title != null ? p.title : t.title, guess = pfGuess(cur);
    const mine = row({
        ttl: '<span class="mc-pfti"><input type="text" class="mc-pf-in" data-pf-title="' + i + '" value="' + esc(cur) + '" spellcheck="false" data-tip="The track\'s title\nType another, or click a platform\'s below.\nEnter: keep it\nEsc: put it back">'
            + '<button type="button" class="mc-pfgc' + (guess === cur ? ' same' : '') + '" data-act="fx-gc" data-i="' + i + '" data-tip="' + esc(guess === cur ? 'Guess case (' + pfGuessMode() + ')\nThe title is already as guess case writes it.' : 'Guess case (' + pfGuessMode() + ')\n→ ' + guess) + '">Aa</button></span>',
        len: '<input type="text" class="mc-pf-in mono" data-pf-len="' + i + '" value="' + esc(p.ms ? ccLen(p.ms) : t.len && t.len !== '?:??' ? t.len : '') + '" placeholder="m:ss" spellcheck="false" data-tip="The track\'s length (`m:ss`)\nType another, or click a platform\'s below.">',
        // Apollo's revert-this-track; its slot stays when there's nothing to revert, so nothing beside it moves
        plat: '<span class="mc-pfa"><button type="button" class="mc-pfrev' + (CMP.picks[i] ? '" data-act="fx-untake" data-i="' + i + '" data-tip="Revert this track\nKeep it as it is"' : ' void" tabindex="-1" aria-hidden="true"') + '>↺</button>'
            + (p.title != null ? '<label data-tip="Give the recording this title too\nThe release editor\'s “update the recording title”"><input type="checkbox" data-pf-rec="' + i + '"' + (p.recording ? ' checked' : '') + '>the recording too</label>' : '<span class="weak">this track</span>') + '</span>',
    }, 'own');
    const vs = x.versions || [];
    return mine + vs.map((v, n) => {
        const k = v.keys[0], who = v.keys.map(ccName).join(', ');
        return row({
            ttl: v.title === t.title ? '<span class="weak">' + esc(v.title) + '</span>' : take('title', k, ccTitleDiff(v.title, t.title), v.title, 'Take this title (' + who + ')'),
            len: '<span class="mono">' + (!v.len ? '?' : pfSameLen(v.len, own) ? '<span class="weak">' + ccLen(v.len) + '</span>' : take('ms', k, ccLen(v.len) + (own ? fxLenDiff({ ms: own }, { ms: v.len }) : ''), v.len, 'Take this length (' + who + ')')) + '</span>',
            isrc: '<span class="mono">' + (v.isrc ? isrcHtml(v.isrc) : '<span class="weak">none</span>') + '</span>',
            plat: ccIcons(v.keys),
        }, n === vs.length - 1 ? 'last' : '');
    }).join('');
}
// Once Fusion answers, each group missing ISRCs or AcoustIDs is checked, one group at a time (a few
// requests each), so the comparisons fill in as they come. A track in a group already asked for is
// covered by that check. A newer Fusion answer stops the queue and starts its own.
async function fxAutoCheck() {
    const gen = ++fxCheckGen;
    fxBusy.clear();
    const r = results.fusion;
    if (modeNow('fusion') === 'off' || !fxCan('check') || !r || !r.findings) return;
    const covered = new Set(), queue = [];
    for (const x of r.findings) {
        const ck = x.checked || {};
        if (!FX_SHOWN[x.state] || (ck.isrc && ck.acoustid) || covered.has(x.key)) continue;
        const group = [x.key].concat((x.matches || []).map(m => m.gid));
        group.forEach(k => covered.add(k));
        queue.push(x.key);
        r.findings.forEach(y => { if (group.includes(y.key)) fxBusy.add(y.key); });
    }
    if (!queue.length) return;
    Log.cat('Fusion').info('asking Fusion to check ISRCs and AcoustIDs of ' + queue.length + ' group(s)');
    paintMatrix();
    for (const k of queue) {
        if (gen !== fxCheckGen) return;
        const answered = await new Promise(res => {
            const done = () => { clearTimeout(t); res(true); };
            const t = setTimeout(() => { if (fxWaiters.get(k) === done) fxWaiters.delete(k); res(false); }, 120000);
            fxWaiters.set(k, done);
            document.dispatchEvent(new CustomEvent('mc:check', { detail: JSON.stringify({ id: 'fusion', run, release: RELEASE, key: k }) }));
        });
        if (!answered && gen === fxCheckGen) { Log.cat('Fusion').warn('Fusion did not answer the check of ' + k); fxBusy.delete(k); paintAll(); }
    }
    if (gen !== fxCheckGen) return;
    // what no answer cleared (a track whose group the answer didn't name) isn't being checked any more
    if (fxBusy.size) { fxBusy.clear(); paintAll(); }
}
// the Tracks header's Expand all / Collapse all opens or folds every Fusion comparison
const fxOpenable = () => {
    const r = results.fusion, f = results.fc;
    return (modeNow('fusion') !== 'off' && r && r.findings ? rel.tracks.map(t => trackFinding('fusion', t.rec)).filter(x => x && FX_SHOWN[x.state]).map(x => x.key) : [])
        .concat(modeNow('platforms') !== 'off' && f && f.findings ? rel.tracks.map(t => trackFinding('fc', t.rec)).filter(x => x && (pfDiffers(x) || CMP.picks[pfIndex(x)])).map(x => x.key) : []);
};
function fxAllBtn() {
    const ks = fxOpenable();
    if (!ks.length) return '';
    const all = ks.every(k => fxOpen.has(k));
    return '<button type="button" class="mc-all" data-act="fx-all" data-tip="' + (all ? 'Fold every comparison under the tracks' : 'Open every comparison under the tracks\nFusion\'s, and the platforms\' where a title or a length differs. A click on a title or a length there takes it in: Platform Check sends it with the release, and Falcon writes it in the release editor.') + '">' + (all ? 'Collapse all' : 'Expand all') + '</button>';
}
function fxAct(b) {
    const k = b.dataset.key;
    if (b.dataset.act === 'fx-take') {
        const i = +b.dataset.i, t = rel.tracks[i], x = t && trackFinding('fc', t.rec), q = x && (x.versions || []).find(v => v.keys.includes(b.dataset.k));
        if (!q) return;
        const what = b.dataset.what, val = what === 'title' ? q.title : q.len, cur = CMP.picks[i] || {};
        const on = what === 'title' ? cur.title === val : !!cur.ms && pfSameLen(cur.ms, val);
        // the platforms giving the same, named in the edit note
        const from = pfPlats(x).filter(v => what === 'title' ? v.title === val : pfSameLen(v.ms, val)).map(v => ccName(v.k)).join(', ');
        pfSet(i, what, on ? null : val, from);
        return;
    }
    if (b.dataset.act === 'fx-untake') { delete CMP.picks[+b.dataset.i]; paintMatrix(); paintExec(); return; }
    if (b.dataset.act === 'fx-gc') {
        // the title as typed (taken in or not), guessed; the platforms that gave the guessed title are named in the edit note
        const i = +b.dataset.i, inp = b.parentNode.querySelector('input[data-pf-title]'), t = rel.tracks[i];
        const before = inp ? inp.value : (CMP.picks[i] || {}).title || (t && t.title) || '', g = pfGuess(before);
        Log.cat('Fusion').info('track ' + (t && t.pos) + ': guess case (' + pfGuessMode() + ') "' + before + '" → "' + g + '"');
        const x = t && trackFinding('fc', t.rec), from = x ? pfPlats(x).filter(v => v.title && pfGuess(v.title) === g).map(v => ccName(v.k)).join(', ') : '';
        pfSet(i, 'title', g, from);
        return;
    }
    if (b.dataset.act === 'fx' || b.dataset.act === 'fx-pf') { if (fxOpen.has(k)) fxOpen.delete(k); else fxOpen.add(k); paintMatrix(); return; }
    if (b.dataset.act === 'fx-all') {
        const ks = fxOpenable(), all = ks.every(x => fxOpen.has(x));
        ks.forEach(x => { if (all) fxOpen.delete(x); else fxOpen.add(x); });
        paintMatrix();
        return;
    }
    if (b.dataset.act === 'fx-fusion') {
        Log.cat('Fusion').info('opening the group of ' + k + ' in Fusion');
        document.dispatchEvent(new CustomEvent('mc:open', { detail: JSON.stringify({ id: 'fusion', release: RELEASE, key: k }) }));
    }
}
// the track changes taken in for Execute, per track: a picked ISRC, Fusion group or found link
function trackPicks(t) {
    let n = 0;
    COLS.forEach(c => {
        if (providerOff(c.p) || modeOf(PROVIDERS.find(p => p.id === c.p)) === 'off' || !picked[c.p]) return;
        if (c.id === 'links') { n += trackLinks(t.rec).filter(l => picked.is.has(l.key)).length; return; }
        const x = c.pick && trackFinding(c.p, t.rec);
        if (x && PICKABLE[x.state] && picked[c.p].has(x.key)) n++;
    });
    if (modeNow('platforms') !== 'off' && CMP.picks[rel.tracks.indexOf(t)]) n++;   // #782: a title or length taken in
    return n;
}
function paintMatrix() {
    ui.querySelectorAll('.mc-tbl th[data-colh]').forEach(th => { th.innerHTML = mbuHtml(colHead(COLS.find(c => c.id === th.dataset.colh))); });
    // track-level providers have no card: their apply outcome goes in the Tracks header
    const fa = ui.querySelector('.mc-fxall');
    if (fa) fa.innerHTML = mbuHtml(fxAllBtn());
    const slot = ui.querySelector('.mc-tapplied');
    if (slot) slot.innerHTML = mbuHtml(COLS.map(c => c.p).filter((p, i, a) => a.indexOf(p) === i).map(p => results[p] && results[p].applied)
        .filter(Boolean).map(a => '<span class="mc-applied ' + (a.ok ? 'ok' : 'err') + '" data-tip="' + esc(a.id) + '">' + (a.ok ? '✓ ' : '✕ ') + esc(PROVIDERS.find(x => x.id === a.id).provider + ': ' + (a.note || '')) + '</span>'
            // #748: a per-track provider's failure that can be tried again offers Retry here, as a card's does (#741)
            + (!a.ok && a.retry ? '<button type="button" class="mc-retry" data-act="retry-apply" data-prov="' + esc(a.id) + '" data-tip="Apply ' + esc(PROVIDERS.find(x => x.id === a.id).provider) + ' again, with what is still taken in">Retry</button>' : '')).join(''));
    let pend = 0, rows = 0;
    ui.querySelectorAll('.mc-tbl tbody tr[data-i]').forEach(tr => {
        const t = rel.tracks[+tr.dataset.i], n = trackPicks(t);
        pend += n; if (n) rows++;
        tr.classList.toggle('chg', !!n);
        tr.querySelectorAll('td[data-col]').forEach(td => { td.innerHTML = mbuHtml(cellHtml(COLS.find(c => c.id === td.dataset.col), t)); });
    });
    const tp = ui.querySelector('.mc-tpend');
    if (tp) {
        tp.textContent = pend ? pend + ' pending change' + (pend === 1 ? '' : 's') + ' on ' + rows + ' of ' + rel.tracks.length + ' track' + (rel.tracks.length === 1 ? '' : 's') : 'no pending track changes';
        tp.classList.toggle('on', !!pend);
    }
    // #782: the platforms' lines go in after the track's marker row, as rows of the table; the columns they fill
    // are the header's (#, Title, Len, then each provider's)
    const heads = ['n', 'ttl', 'len'].concat([...ui.querySelectorAll('.mc-tbl th[data-colh]')].map(th => th.dataset.colh));
    ui.querySelectorAll('.mc-tbl tr.mc-fxd[data-pf]').forEach(tr => {
        const n = tr.dataset.pf, t = rel.tracks[+n], x = modeNow('platforms') !== 'off' && t ? trackFinding('fc', t.rec) : null;
        const show = !!(x && fxOpen.has(x.key)), old = [...ui.querySelectorAll('.mc-tbl tr.mc-pfr[data-pfr="' + n + '"]')];
        const trk = ui.querySelector('.mc-tbl tbody tr[data-i="' + n + '"]');
        if (trk) trk.classList.toggle('pfopen', show);
        if (show && old.some(r => r.contains(document.activeElement) && document.activeElement.classList.contains('mc-pf-in'))) return;   // being typed in
        old.forEach(r => r.remove());
        if (show) tr.insertAdjacentHTML('afterend', mbuHtml(pfRows(x, t, heads)));
    });
    // #790: a slot stays while its track's comparison is open, so Fusion's card in it isn't rebuilt on every paint
    let mount = false;
    ui.querySelectorAll('.mc-tbl tr.mc-fxd[data-fx]').forEach(tr => {
        const t = rel.tracks[+tr.dataset.fx], x = modeNow('fusion') !== 'off' && t ? trackFinding('fusion', t.rec) : null;
        const show = !!(x && FX_SHOWN[x.state] && fxOpen.has(x.key)), td = tr.firstElementChild, slot = td.firstElementChild;
        tr.hidden = !show;
        if (!show) { if (slot) td.textContent = ''; return; }
        mount = true;
        if (slot && slot.dataset.key === x.key) return;
        td.innerHTML = mbuHtml(fxCan('embed') ? '<div class="mc-fxslot" data-mc-slot="fusion" data-key="' + esc(x.key) + '"></div>'
            : '<div class="mc-fxslot-old">This Fusion is too old to show its group here: update it, or ' + (fxCan('open') ? 'open the group in Fusion ' + fxOpenBtn(x) : 'open Fusion') + '</div>');
    });
    if (mount && fxCan('embed')) document.dispatchEvent(new CustomEvent('mc:mount', { detail: JSON.stringify({ id: 'fusion', release: RELEASE }) }));
}
function matrix() {
    const sec = el('section', 'mc-sect');
    sec.dataset.sect = 'tracks';
    const cols = COLS.filter(c => modeOf(PROVIDERS.find(p => p.id === c.p)) !== 'off');
    let html = '<div class="mc-sect-h">' + cardTitle('tracks', '≡', 'Tracks') + '<span class="p mc-tpend"></span><span class="end"><span class="mc-tapplied"></span><span class="mc-fxall"></span></span></div>'
        + '<table class="mc-tbl"><thead><tr><th>#</th><th>Title</th><th>Len</th>'
        + cols.map(c => '<th data-colh="' + c.id + '">' + colHead(c) + '</th>').join('')
        + '</tr></thead><tbody>';
    let lastMed = 0;
    rel.tracks.forEach((t, i) => {
        if (rel.media > 1 && t.medium !== lastMed) { lastMed = t.medium; html += '<tr class="med"><td colspan="' + (3 + cols.length) + '">Medium ' + t.medium + '</td></tr>'; }
        html += '<tr data-i="' + i + '"' + (selected === i ? ' class="sel"' : '') + '><td class="n">' + esc(t.pos) + '</td><td class="ttl">' + esc(t.title) + '</td><td class="mono">' + esc(t.len) + '</td>'
            + cols.map(c => '<td data-col="' + c.id + '"></td>').join('') + '</tr>'
            + '<tr class="mc-fxd" data-fx="' + i + '" hidden><td colspan="' + (3 + cols.length) + '"></td></tr>'
            + '<tr class="mc-fxd" data-pf="' + i + '" hidden><td colspan="' + (3 + cols.length) + '"></td></tr>';
    });
    if (!rel.tracks.length) html += '<tr><td colspan="' + (3 + cols.length) + '" class="weak">No tracklist on this page.</td></tr>';
    sec.innerHTML = mbuHtml(html + '</tbody></table>');
    return sec;
}

// The cards go in reading order (release and entity links, cover art, release credits) into as many
// columns as fit at 520 px or more, each card into the column that is shortest when its turn comes
// (#680: fixed columns, and then wrapping, left a hole beside the tall links card). A card is as tall
// as what it holds. A card whose provider isn't on the page is left out, and the rest share the width.
function releaseCards() {
    const row = el('div', 'mc-row2');
    const card = (id, t) => {
        const p = PROVIDERS.find(x => x.id === id);
        return '<section class="mc-sect" data-sect="' + id + '"><div class="mc-sect-h">' + cardTitle(id, '<img alt="" src="' + PROVIDER_ICONS[id] + '">', t) + '<span class="end"></span></div>'
            + '<div class="mc-card-body" data-card="' + id + '"></div></section>';
    };
    row.innerHTML = mbuHtml(card('pc', 'Release and entity links') + card('as', 'Cover art'));
    if (modeNow('ch') !== 'off') row.append(releaseCredits());
    row._cards = [...row.children];
    let w = 0;
    new ResizeObserver(() => { if (row.clientWidth !== w) { w = row.clientWidth; layoutCards(row); } }).observe(row);
    return row;
}
function fitCards() {
    const row = ui && ui.querySelector('.mc-row2'); if (!row) return;
    row._cards.forEach(s => {
        const id = s.querySelector('[data-card]') ? s.querySelector('[data-card]').dataset.card : 'ch';
        s.hidden = ['idle', 'off'].includes(stateOf(PROVIDERS.find(x => x.id === id)));
    });
    paintOnOff();
    row.hidden = row._cards.every(s => s.hidden);
    layoutCards(row);
}
const CARD_MIN = 520, CARD_GAP = 10;
// #784: Art Station's card goes two columns wide when its gallery would take more than two rows in one column (reckoned
// at one column's width, so the wider card, with fewer rows, doesn't flip back)
function asWide(colW) {
    if (providerOff('as') || !asPlan.n || !asPlan.tile) return false;
    const perRow = Math.max(1, Math.floor((colW - 42) / asPlan.tile));   // less the card's and the gallery's padding
    return Math.ceil(asPlan.n / perRow) > 2;
}
function layoutCards(row) {
    if (row.hidden || !row.clientWidth) return;
    const shown = row._cards.filter(s => !s.hidden);
    let n = Math.max(1, Math.min(shown.length, Math.floor((row.clientWidth + CARD_GAP) / (CARD_MIN + CARD_GAP))));
    // the wide card sits over the first two columns, in a span of its own; the other cards flow below and beside it.
    // It is as wide as its gallery needs (Art Station's fit: its toolbar in one row), when what is left beside it
    // still takes a card; under it go as many columns as its width takes (k), beside it the rest (n = k + beside)
    const colW = (row.clientWidth - (n - 1) * CARD_GAP) / n, rowW = row.clientWidth;
    let isWide = n >= 2 && asWide(colW);
    // a flip that undoes the one just before it, within a second, is the gallery reporting back the width the last
    // flip gave it (its card then flips again, and on, the cards blinking up and down): keep the layout as it is
    const now = Date.now(), fl = row._flips || (row._flips = []);
    if (row._isWide !== undefined && isWide !== row._isWide) {
        if (fl.length && now - fl[fl.length - 1] < 1000) { Log.cat('UI').debug('#784 Art Station\'s card kept ' + (row._isWide ? 'wide' : 'narrow') + ': the layout flips back and forth'); isWide = row._isWide; }
        else fl.push(now);
    }
    if (fl.length > 4) fl.shift();
    row._isWide = isWide;
    const wide = isWide ? shown.find(s => s.querySelector('[data-card="as"]')) : null;
    let span = row.querySelector(':scope > .mc-span'), k = 2, spanW = 0;
    if (wide && asPlan.fit) {
        const slot = wide.querySelector('#mc-as-slot'), sb = slot && slot.getBoundingClientRect().width;
        // the card's own padding and borders around the slot, as it is now (the same at any width)
        if (sb && span && wide.parentNode === span.firstChild) row._asPad = span.getBoundingClientRect().width - sb;
        const want = Math.ceil(asPlan.fit + (row._asPad || 22));
        const beside = Math.min(shown.length - 1, Math.floor((rowW - want) / (CARD_MIN + CARD_GAP)));
        if (want > colW && beside >= 1) { spanW = want; k = Math.max(1, Math.floor((want + CARD_GAP) / (CARD_MIN + CARD_GAP))); n = k + beside; }
    }
    let cols = [...row.querySelectorAll('.mc-col')];
    while (cols.length < n) { const c = el('div', 'mc-col'); row.append(c); cols.push(c); }
    if (wide) {
        if (!span) { span = el('div', 'mc-span'); span.innerHTML = '<div class="mc-span-top"></div><div class="mc-span-cols"></div>'; row.prepend(span); }
        span.style.flex = spanW ? '0 0 ' + spanW + 'px' : '';
        if (wide.parentNode !== span.firstChild) span.firstChild.append(wide);
        cols.slice(0, k).forEach(c => { if (c.parentNode !== span.lastChild) span.lastChild.append(c); });
        cols.slice(k).forEach(c => { if (c.parentNode !== row) row.append(c); });
    } else if (span) {
        [...span.lastChild.children].reverse().forEach(c => span.after(c));
        [...span.firstChild.children].forEach(s => cols[0].append(s));
        span.remove();
    }
    // heights as they are now; a card that changes column changes width, and the next paint settles it
    const tall = new Map(shown.map(s => [s, s.offsetHeight])), used = cols.slice(0, n).map((c, i) => wide && i < k ? tall.get(wide) + CARD_GAP : 0);
    shown.forEach(s => {
        if (s === wide) return;
        const k = used.indexOf(Math.min(...used));
        if (s.parentNode !== cols[k]) cols[k].append(s);
        used[k] += tall.get(s) + CARD_GAP;
    });
    // a hidden card stays in a column, out of the way; empty columns go
    row._cards.filter(s => s.hidden && !s.parentNode.classList.contains('mc-col')).forEach(s => cols[0].append(s));
    cols.slice(n).forEach(c => { [...c.children].forEach(s => cols[0].append(s)); c.remove(); });
    // the cards keep their reading order within a column
    cols.slice(0, n).forEach(c => row._cards.forEach(s => { if (s.parentNode === c) c.append(s); }));
    if (wide && row._wideDone !== true) { row._wideDone = true; Log.cat('UI').debug('#784 Art Station\'s card wide (' + asPlan.n + ' images, ' + (spanW ? spanW + ' px, as its toolbar' : 'two columns') + ')'); } else if (!wide) row._wideDone = false;
}

// CH's release-level credits (#680): its finding with no `track`. Info only, like its column.
function releaseCredits() {
    const sec = el('section', 'mc-sect');
    sec.dataset.sect = 'ch';
    sec.innerHTML = mbuHtml('<div class="mc-sect-h">' + cardTitle('ch', '<img alt="" src="' + PROVIDER_ICONS.ch + '">', 'Release credits') + '<span class="mc-mode">info</span><span class="end mc-chopen"></span></div><div class="mc-chrel"></div>');
    return sec;
}
function paintReleaseCredits() {
    const box = ui.querySelector('.mc-chrel'); if (!box) return;
    const p = PROVIDERS.find(x => x.id === 'ch'), r = results.ch;
    // CH's import sources: each opens edit-relationships, where CH presses that source's button
    // and its pre-flight starts (the same choice as CH's toolbar, #680)
    const open = (r && r.open) || (found.ch && found.ch.open) || [], slot = box.parentNode.querySelector('.mc-chopen');
    // drawn as CH's toolbar draws them: an icon per source, All (no icon) as ⚛ All
    const openHtml = open.length ? '<span class="mc-chlbl">Import credits:</span>' + open.map(o => '<a class="mc-btn mc-chsrc' + (o.icon ? '' : ' mc-chall') + '" href="' + esc(o.url) + '" data-tip="' + esc(o.title || o.label) + '" aria-label="' + esc(o.label) + '">'
        + (o.icon ? stIcon(o.icon, 14) : '<b>⚛</b>' + esc(o.label)) + '</a>').join('') : '';
    if (slot && slot._mcHtml !== openHtml) { slot._mcHtml = openHtml; slot.innerHTML = mbuHtml(openHtml); }
    if (!r || r.state !== 'done') { box.innerHTML = mbuHtml('<div class="mc-empty">Credit Hoarder: ' + esc(stateText(p)) + (r ? '' : '. Fetch credits fills this in.') + '</div>'); return; }
    const x = (r.findings || []).find(f => !f.track);
    if (!x) { box.innerHTML = mbuHtml('<div class="mc-empty">' + esc(r.summary ? r.summary + '. ' : '') + 'No release-level credits in the source.</div>'); return; }
    box.innerHTML = mbuHtml('<div class="mc-summary">' + esc(x.source || '') + ': ' + x.list.length + ' credit' + (x.list.length === 1 ? '' : 's') + ' on the release</div>'
        + '<div style="padding:4px 10px 8px">' + x.list.map(c => '<div class="mc-mini">' + esc(c.name) + '<span class="n">' + esc(c.role) + '</span></div>').join('') + '</div>');
}

// A provider's release-level findings: one row each; selected rows go to Execute.
const PILL = { new: ['add', 'new'], linked: ['ok', 'linked'], withheld: ['warn', 'withheld'], unsure: ['warn', 'unsure'], blocked: ['err', 'blocked'], none: ['idle', 'not found'] };
const ORDER = { new: 0, withheld: 1, unsure: 2, blocked: 3, linked: 4, none: 5 };
// a link's platform, as its ST-ICONS key (globe when MC has no icon for it)
const HOST_ICON = [[/discogs\.com$/, 'discogs'], [/spotify\.com$/, 'spotify'], [/apple\.com$/, 'apple'], [/deezer\.com$/, 'deezer'], [/tidal\.com$/, 'tidal'], [/qobuz\.com$/, 'qobuz'],
    [/beatport\.com$/, 'beatport'], [/bandcamp\.com$/, 'bandcamp'], [/volumo\.com$/, 'volumo'], [/hdtracks\.com$/, 'hdtracks'], [/soundcloud\.com$/, 'soundcloud'], [/audiomack\.com$/, 'audiomack'],
    [/7digital\.com$/, 'sevendigital'], [/music\.youtube\.com$/, 'ytmusic'], [/amazon\.[a-z.]+$/, 'amazonmusic'], [/musicbrainz\.org$/, 'musicbrainz']];
function urlIcon(u) {
    let h = '';
    try { h = new URL(u, location.href).hostname; } catch (e) { return 'globe'; }
    const m = HOST_ICON.find(x => x[0].test(h));
    return m ? m[1] : 'globe';
}
function shortUrl(u) { try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, ''); } catch (e) { return u; } }
// the linked icons, one per platform with a count (three Discogs artists are one Discogs ×3, #680),
// as the toggle that lists them as rows: the release's in the card's header, the artists' and
// labels' on their sub-heading
const isEnt = x => x.entity && x.entity.type !== 'release_group';
const linkedOpen = k => Array.isArray(S.linkedOpen) && S.linkedOpen.includes(k);
function linkedBtn(linked, k) {
    if (!linked.length) return '';
    const open = linkedOpen(k);
    const by = new Map();
    linked.forEach(x => { const k = x.icon || x.key; (by.get(k) || by.set(k, []).get(k)).push(x); });
    const nm = x => (isEnt(x) ? (x.entity.name || '') + ' · ' : '') + (x.name || x.key);
    return '<button type="button" class="mc-linked' + (open ? ' on' : '') + '" data-act="linked" data-lk="' + esc(k) + '" data-tip="'
        + esc('Already linked\n' + linked.map(x => '- ' + nm(x)).join('\n') + (open ? '\nClick: fold them back' : '\nClick: list them as rows')) + '">'
        + [...by].map(([k, xs]) => '<span class="mc-pico' + (xs[0].entity ? ' mc-ent' : '') + '" data-tip="' + esc(xs.map(nm).join(', ')) + '">' + stIcon(k, 14) + (xs.length > 1 ? '<sub>' + xs.length + '</sub>' : '') + '</span>').join('')
        + '<span class="mc-lk">✓ ' + linked.length + '</span></button>';
}
// a repaint rebuilds the card, which reloads its images: the cover thumbnails blinked on each
// Falcon or progress tick (#680). Skip an unchanged card and carry the loaded images over.
function setCard(box, html) {
    const s = String(html);
    if (box._mcHtml === s) return;
    box._mcHtml = s;
    // an image that fell back to its full one (data-from) is matched by the src it was given
    const old = new Map([...box.querySelectorAll('img')].map(i => [i.dataset.from || i.getAttribute('src'), i]));
    box.innerHTML = html;
    box.querySelectorAll('img').forEach(i => { const o = old.get(i.getAttribute('src')); if (o) { old.delete(i.getAttribute('src')); i.replaceWith(o); } });
}
function paintCards() {
    ui.querySelectorAll('[data-card]').forEach(box => {
        const id = box.dataset.card, p = PROVIDERS.find(x => x.id === id), r = results[id];
        if (!r || r.state !== 'done') { setCard(box, mbuHtml('<div class="mc-empty">' + esc(p.provider) + ': ' + esc(stateText(p)) + (r ? '' : '. Probe fills this in.') + '</div>')); return; }
        if (!r.findings.length) { setCard(box, mbuHtml((r.summary ? '<div class="mc-summary">' + esc(r.summary) + '</div>' : '') + '<div class="mc-empty">Nothing to report.</div>')); return; }
        const sum = r.summary ? '<div class="mc-summary">' + esc(r.summary) + '</div>' : '';
        const ap = (r.applied ? '<div class="mc-applied ' + (r.applied.ok ? 'ok' : 'err') + '">' + (r.applied.ok ? '✓ ' : '✕ ') + esc(r.applied.note || (r.applied.ok ? 'done' : 'failed'))
            // #741: a provider that says it can try again (retry) gets a button that applies it alone, with what is still taken in
            + (!r.applied.ok && r.applied.retry ? ' <button type="button" class="mc-retry" data-act="retry-apply" data-prov="' + esc(id) + '" data-tip="Apply ' + esc(p.provider) + ' again, with what is taken in">Retry</button>' : '') + '</div>' : '')
            + (r.working ? '<div class="mc-working"><span class="mc-spin"></span>' + esc(r.working) + '</div>' : '') + falconHtml(r.falcon) + bestHtml(r.best);
        // 'not found' is one line of icons, not a row each: it's most of the list and needs no action.
        // 'linked' needs none either: icons on their section's sub-heading (Release, Artists, Labels),
        // so the rows that need a decision lead; clicking them lists them as rows instead, each section on its own (S.linkedOpen).
        // #709: PC's barcodes (kind 'barcode') are rows of their own at the top of Release, linked ones too ('added');
        // so are the catalog numbers and labels a consolidation brings (kinds 'catno' and 'label', #727)
        // #782: and the release event and track lengths a comparison with the platforms brings ('event', 'lengths')
        const isBc = x => ['barcode', 'catno', 'label', 'event', 'lengths'].includes(x.kind);
        const linked = r.findings.filter(x => x.state === 'linked' && !isBc(x));
        // PC's card is in sections, each with its own linked icons; another card's are in its header
        const pc = id === 'pc';
        const lkKey = x => pc ? 'pc:' + (isEnt(x) ? x.entity.type : 'release') : id;
        const rows = r.findings.filter(x => !isBc(x) && x.state !== 'none' && (x.state !== 'linked' || linkedOpen(lkKey(x)))).sort((a, b) => ORDER[a.state] - ORDER[b.state]);
        // #740: a catalog number a platform gives (not a consolidation's) sits beside the barcode of each lane it is
        // in, as a chip of its own; one whose lane isn't shown (no lanes) stays a row
        const isLaneCat = x => x.kind === 'catno' && !x.cons && Array.isArray(x.barcodes);
        const placedCats = new Set();
        const bcRowsOf = () => r.findings.filter(x => isBc(x) && !placedCats.has(x.key));
        const none = r.findings.filter(x => x.state === 'none');
        const slot = box.parentNode.querySelector('.mc-sect-h .end');
        if (slot) slot.innerHTML = mbuHtml(pc ? '' : linkedBtn(linked, id));
        // the row is the toggle, no tick box (#680); a taken-in row is tinted and marked ✓
        // PC's barcodes (#680): the release's links grouped by barcode, a lane each (leading zeros
        // aside, as PC compares them): the release's own first, in green, then the others by size,
        // then the platforms that gave none. A lane is one line: its platforms as icons that toggle
        // one by one, and take all in; ▸ opens it into rows.
        const bcNorm = b => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
        // its reasons, one line: what says it is another release (PC's mismatch: track count, format) in
        // amber (#709); in a barcode's lane, not the barcode, which the lane already shows (the lane without one keeps it: it is why)
        const whyHtml = (x, lane) => {
            const parts = String(x.why || '').split(' · ').filter(w => w && !(lane && lane.k && /barcode/.test(w)));
            const cons = w => Array.isArray(x.consFrom) && x.consFrom.length && /^consolidated by Mission Control from /.test(w);
            const others = w => Array.isArray(x.others) && x.others.length && /^already linked to /.test(w);
            const otherA = o => '<a target="_blank" rel="noopener" href="' + esc(location.origin + '/' + o.type + '/' + o.mbid) + '" data-tip="' + esc('Open this ' + o.type + ' on MusicBrainz') + '">' + esc(o.name || o.mbid) + '</a>' + (o.disambiguation ? ' (' + esc(o.disambiguation) + ')' : '');
            return parts.length ? '<div class="s">' + parts.map(w => others(w) ? 'already linked to ' + x.others.map(o => esc(o.type) + ' ' + otherA(o)).join(', ') : cons(w) ? '<span data-tip="' + esc(w) + '">consolidated from ' + ccIcons(x.consFrom) + '</span>' : (x.mismatch || []).includes(w) ? '<b class="mc-off">' + esc(w) + '</b>' : esc(w)).join(' · ') + '</div>' : '';
        };
        const coverChip = x => {
            const c = x.cover, dims = c.w ? c.w + '×' + c.h : '';
            if (!c.url) return '<span class="mc-csize">' + (dims || 'no cover') + '</span>';
            return '<a class="mc-csize" target="_blank" rel="noopener" href="' + esc(c.url) + '" data-tip="' + esc('Open the cover on ' + (x.name || x.key) + (dims ? ' (' + dims + ')' : '')) + '">' + (dims || 'cover') + ' ↗</a>';
        };
        // an artist or label row: its name, its disambiguation (weak, as MusicBrainz shows it), the platform
        const entName = x => {
            const e = x.entity, n = x.name || x.key;
            if (!e || !e.mbid || !n.startsWith(e.name + ' · ')) return esc(n);
            return '<a target="_blank" rel="noopener" href="' + esc(location.origin + '/' + e.type + '/' + e.mbid) + '" data-tip="' + esc('Open this ' + e.type + ' on MusicBrainz') + '">' + esc(e.name) + '</a>'
                + (e.disambiguation ? ' <span class="weak">(' + esc(e.disambiguation) + ')</span>' : '') + esc(n.slice(e.name.length));
        };
        const line = (x, lane) => {
            const pick = !!PICKABLE[x.state];
            const on = pick && picked[id] && picked[id].has(x.key);
            const pill = x.role === 'searched' ? ['idle', 'searched'] : x.role === 'best' && x.state === 'new' ? ['add', 'enters'] : isBc(x) && x.state === 'linked' ? ['ok', 'added'] : PILL[x.state] || ['idle', x.state];
            // in a lane, the barcode and its reason are on the lane: only a differently written barcode stays
            return '<div class="mc-line ' + esc(x.state) + (x.cover ? ' mc-hassize' : '') + (x.entity ? ' mc-ent' : '') + (lane ? ' mc-in' : '') + (pick ? ' mc-pick' : '') + (on ? ' on' : '') + '"'
                + (pick ? ' data-prov="' + id + '" data-key="' + esc(x.key) + '" data-tip="' + (on ? 'Taken in\nClick: leave it out' : 'Click: take it in') + '"' : '') + '>'
                + '<span class="mc-tick">' + (on ? '✓' : '') + '</span>'
                + '<span class="mc-pico">' + (x.kind === 'catno' || x.kind === 'label' ? CATNO_SVG : x.kind === 'event' || x.kind === 'lengths' ? FIELD_SVG : isBc(x) ? BARCODE_SVG : stIcon(x.icon || x.key, 14)) + '</span>'
                + '<div class="mc-lt"><div class="t">' + (x.kind === 'event' ? 'Release event <b>' + esc(x.code) + '</b>' : x.kind === 'lengths' ? 'Track lengths for <b>' + esc(x.code) + '</b>' : x.kind === 'label' ? 'Label <b>' + esc(x.label && x.label.name || '') + '</b>' + (x.code ? ' · cat. no. <b class="mc-bcn">' + esc(x.code) + '</b>' : '') : x.kind === 'catno' ? 'Cat. no. <b class="mc-bcn">' + esc(x.code) + '</b> · ' + esc(x.label && x.label.name || '') : isBc(x) ? 'Barcode <b class="mc-bcn">' + esc(x.code) + '</b>' : entName(x)) + '</div>'
                + (x.url ? '<a class="s" target="_blank" rel="noopener" href="' + esc(x.url) + '" data-tip="' + esc(x.url) + '">' + esc(shortUrl(x.url)) + '</a>' : '')
                + whyHtml(x, lane) + '</div>'
                // #751: Art Station's row, the size of the platform's own cover in a column of its own, a link to the cover
                + (x.cover ? coverChip(x) : '')
                + (lane && x.state !== 'linked' ? '<span></span>' : '<span class="mc-pill ' + pill[0] + '">' + pill[1] + '</span>') + '</div>';
        };
        // PC's links in sections: the release's, then the artists', then the labels', each under its
        // sub-heading and shown only when it has something (the Discogs master is the release
        // group's, but reads as the release's own and leads)
        const rgRows = rows.filter(x => x.entity && x.entity.type === 'release_group'), relRows = rows.filter(x => !x.entity), entRows = rows.filter(x => x.entity && x.entity.type !== 'release_group');
        const grouped = !!r.barcode || relRows.some(x => x.barcode);
        let relHtml = relRows.map(x => line(x)).join(''), hint = '';
        if (grouped) {
            // a linked link with a barcode joins its lane too (a ✓ icon), so the release's own lane
            // shows what the release already has: its Discogs release, say (#680)
            const laneRows = r.findings.filter(x => !x.entity && !isBc(x) && x.state !== 'none' && (x.state !== 'linked' || x.barcode || linkedOpen('pc:release'))).sort((a, b) => ORDER[a.state] - ORDER[b.state]);
            // one form for a barcode however a platform writes it: 12 digits (UPC) when it fits, else 13 (EAN)
            const bcShow = k => k.length <= 12 ? k.padStart(12, '0') : k;
            const lanes = new Map(), relK = bcNorm(r.barcode);
            if (relK) lanes.set(relK, { k: relK, rows: [], color: 'var(--mbu-ok)', tip: "The release's barcode" });
            laneRows.forEach(x => {
                const k = bcNorm(x.barcode);
                if (!lanes.has(k)) lanes.set(k, k ? { k, rows: [], tip: "Not the release's barcode" } : { k, rows: [], tip: "Empty barcode: the platform doesn't give one" });
                lanes.get(k).rows.push(x);
            });
            const others = [...lanes.values()].filter(l => l.k && l.k !== relK).sort((a, b) => b.rows.length - a.rows.length);
            others.forEach((l, i) => { l.color = BC_COLORS[i % BC_COLORS.length]; });
            const order = [relK && lanes.get(relK), ...others, lanes.get('')].filter(Boolean);   // a release without a barcode has no lane of its own: '' is the empty-barcode lane
            // the catalog numbers are a cell of their own after the barcode, as wide on every lane as the widest, so
            // the platform icons still line up
            const catsOf = l => r.findings.filter(x => isLaneCat(x) && x.barcodes.includes(l.k));
            const catW = Math.max(0, ...order.map(l => catsOf(l).reduce((n, x) => n + String(x.code).length + 4, 0)));
            const catCell = l => catW ? '<span class="mc-cats" style="width:' + catW + 'ch">' + catChips(l) + '</span>' : '';
            const catChips = l => catsOf(l).map(x => {
                placedCats.add(x.key);
                const on = picked[id] && picked[id].has(x.key);
                return '<span class="mc-cat mc-pick ' + esc(x.state) + (on ? ' on' : '') + '" data-prov="' + id + '" data-key="' + esc(x.key) + '" data-tip="'
                    + esc('Catalog number ' + x.code + ' for ' + x.label.name + (x.why ? '\n' + x.why : '') + (on ? '\nTaken in. Click: leave it out' : '\nClick: take it in')) + '">' + (on ? '✓ ' : '') + esc(x.code) + '</span>';
            }).join('');
            relHtml = order.map(l => {
                const open = laneOpen.has(l.k), picks = l.rows.filter(laneTakes), n = picks.filter(x => picked[id] && picked[id].has(x.key)).length;
                const states = [...new Set(l.rows.filter(x => x.state !== 'linked').map(x => x.state))].concat(l.rows.every(x => x.state === 'linked') ? ['linked'] : []), pill = states.length === 1 ? PILL[states[0]] || ['idle', states[0]] : null;
                // every chip as wide as a 13-digit barcode, the digits centred: the icons line up in every lane
                const chip = '<span class="mc-bc' + (l.k ? '' : ' none') + '"' + (l.k ? ' style="--bc:' + l.color + '"' : '') + ' data-tip="' + esc(l.tip) + '"><i>0000000000000</i>' + (l.k ? '<b>' + bcShow(l.k) + '</b>' : '') + '</span>';
                const icons = l.rows.length ? l.rows.map(x => {
                    const pk = !!PICKABLE[x.state], on = pk && picked[id] && picked[id].has(x.key);
                    return '<span class="mc-ti ' + esc(x.state) + (x.mismatch ? ' off' : '') + (pk ? ' mc-pick' : '') + (on ? ' on' : '') + '"' + (pk ? ' data-prov="' + id + '" data-key="' + esc(x.key) + '"' : '')
                        + ' data-tip="' + esc((x.name || x.key) + (x.state === 'linked' ? ' — already linked' : on ? ' — taken in' : '') + (x.url ? '\n' + x.url : '') + (x.why ? '\n' + x.why : '') + (pk ? (on ? '\nClick: leave it out' : '\nClick: take it in') : '')) + '">' + stIcon(x.icon || x.key, 16) + '</span>';
                }).join('') : '<span class="mc-bcl-no">no platform found it</span>';
                const all = picks.length ? '<button type="button" class="mc-all" data-act="lane-all" data-lane="' + esc(l.k) + '" data-tip="' + esc('Take every link in this group in, or leave them all out' + (l.rows.some(x => PICKABLE[x.state] && x.mismatch) ? '\nNot the ones marked amber: their track count or format is not the release\'s.' : '')) + '">'
                    + (n === picks.length ? '✓ all taken in' : n ? n + ' of ' + picks.length + ' · take all' : 'take all in') + '</button>' : '<span></span>';
                return '<div class="mc-bcl' + (open ? ' open' : '') + (catW ? ' mc-hascat' : '') + (l.rows.length ? '' : ' empty') + '" data-act="lane" data-lane="' + esc(l.k) + '"' + (l.rows.length ? ' data-tip="' + (open ? 'Fold into one line' : 'Open into rows') + '"' : '') + '>'
                    + '<span class="mc-tri">' + (l.rows.length ? (open ? '▾' : '▸') : '') + '</span>' + chip + catCell(l)
                    + '<span class="mc-bcl-ic">' + icons + '</span>' + all + (pill ? '<span class="mc-pill ' + pill[0] + '">' + pill[1] + '</span>' : '<span></span>') + '</div>'
                    + (open ? l.rows.map(x => line(x, l)).join('') : '');
            }).join('');
            // what the lanes suggest: most platforms agree on a barcode the release doesn't have
            const top = others[0], total = laneRows.filter(x => x.barcode || x.state === 'withheld').length;
            if (relK && !lanes.get(relK).rows.length && top && top.rows.length > 1)
                hint = '<div class="mc-bchint">ⓘ ' + top.rows.length + ' of ' + total + ' platforms agree on <b>' + bcShow(top.k) + '</b>; none has the release\'s <b>' + bcShow(relK) + '</b>. Likely a different edition.</div>';
        }
        const sect = (sub, title, body, lk) => !pc ? body : body || lk.length ? '<div class="mc-sub" data-sub="' + sub + '"><span>' + title + '</span>' + linkedBtn(lk, 'pc:' + sub) + '</div>' + body : '';
        const entSect = (type, title) => sect(type, title, entRows.filter(x => x.entity.type === type).map(x => line(x)).join(''), linked.filter(x => isEnt(x) && x.entity.type === type));
        setCard(box, mbuHtml(sum + (pc ? cmpHtml() : '') + ap + sect('release', 'Release', bcRowsOf().map(x => line(x)).join('') + rgRows.map(x => line(x)).join('') + relHtml + hint, linked.filter(x => !isEnt(x)))
            + entSect('artist', 'Artists') + entSect('label', 'Labels') + (none.length ? '<div class="mc-none" data-tip="' + esc('Not found\n' + none.map(x => '- ' + (x.name || x.key)).join('\n')) + '"><span>Not found</span>'
            + none.map(x => '<span class="mc-pico" data-tip="' + esc(x.name || x.key) + '">' + stIcon(x.icon || x.key, 14) + '</span>').join('') + '</div>' : '') + (id === 'as' ? asGalleryHtml() : '')));
    });
}
// #727: a catalog number's icon, a tag
const CATNO_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" style="color:var(--mbu-text-dim)"><path d="M1.5 7.6V1.5h6.1l5 5-6.1 6.1z"/><circle cx="4.6" cy="4.6" r="1.1"/></svg>';
// #782: a release field's icon (release event, track lengths), a calendar
const FIELD_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" style="color:var(--mbu-text-dim)"><rect x="1.5" y="2.5" width="11" height="10" rx="1.5"/><path d="M1.5 6h11M4.5 1v3M9.5 1v3"/></svg>';
const BARCODE_SVG = '<svg width="14" height="14" viewBox="0 0 14 10" fill="currentColor" style="color:var(--mbu-text-dim)"><rect x="0" width="1.4" height="10"/><rect x="2.4" width="0.8" height="10"/><rect x="4.2" width="1.8" height="10"/><rect x="7" width="0.8" height="10"/><rect x="8.8" width="1.4" height="10"/><rect x="11.2" width="0.8" height="10"/><rect x="12.6" width="1.4" height="10"/></svg>';
// another barcode lane's colour: a token per lane, lighter on the dark theme (majkinetor: "hardly visible on dark theme")
const BC_LIGHT = ['#2563eb', '#c2410c', '#9333ea', '#0e7490', '#be185d', '#a16207', '#4d7c0f', '#6d28d9'];
const BC_DARK = ['#7ab4ff', '#fb923c', '#d0a2ff', '#3dd6f0', '#f78bc4', '#facc15', '#a3e635', '#b9a5ff'];
const BC_COLORS = BC_LIGHT.map((c, i) => 'var(--mc-bc-' + i + ')');
const BC_CSS = '#mc-root,#mcc-root{' + BC_LIGHT.map((c, i) => '--mc-bc-' + i + ':' + c).join(';') + '}'
    + ':root[data-mbu-theme=dark] #mc-root,:root[data-mbu-theme=dark] #mcc-root{' + BC_DARK.map((c, i) => '--mc-bc-' + i + ':' + c).join(';') + '}';
// AS's selected rows are the pool its one cover comes from, so they count once, not once each
const isPool = id => ((results[id] || {}).findings || []).some(x => x.role === 'searched' || x.role === 'best');
function changeCount() { return Object.entries(picked).reduce((n, [id, set]) => n + (providerOff(id) ? 0 : isPool(id) ? Math.min(1, set.size) : set.size), 0) + asMore() + pfChanges().length; }
// Probe or Execute in flight, or a Falcon batch that Execute handed over still running: the
// header pulses, as Apollo's bar does while an edit saves (#412).
function isBusy() { return executing || Object.values(results).some(r => r.state === 'busy' || (r.falcon && r.falcon.running)); }
function paintExec() {
    // on at once (the pulse starts from nothing); off only where a cycle ends, so it fades out and a
    // gap between two answers doesn't flash (header() ends it on animationiteration)
    const hdr = ui.querySelector('.mc-hdr');
    if (hdr && isBusy()) hdr.classList.add('mc-busy');
    else if (hdr && matchMedia('(prefers-reduced-motion: reduce)').matches) hdr.classList.remove('mc-busy');
    const ex = ui.querySelector('[data-act="exec"]'); if (!ex) return;
    paintSteps();   // #840: a step's words count what is selected
    const n = changeCount();
    ex.disabled = executing || !n;
    ex.textContent = executing ? 'Executing…' : autoTimer ? 'Executing ' + n + ' in ' + Math.max(1, Math.ceil((autoEnd - Date.now()) / 1000)) + '… (click to cancel)' : n ? 'Execute (' + n + ')' : 'Execute';
    execWidth(ex);
    ex.classList.toggle('mc-cd', !!autoTimer);
    ex.style.setProperty('--mc-cd', autoTimer ? Math.min(100, 100 - (autoEnd - Date.now()) / (S.consExecS * 10)).toFixed(1) + '%' : '0%');
    ex.dataset.tip = autoTimer ? 'Mission Control applies the selected changes when the countdown ends\nClick: cancel' : 'Apply the selected changes, step by step';
    autoExecCheck();
}

// Execute is as wide as its longest everyday label, so its count and "Executing…" don't move it.
// Measured in the page's own font, once it shows: a fixed width fit Windows' fonts and not
// Linux's ("Execute (99)" came out 100px of 96).
function execWidth(ex) {
    if (ex.style.getPropertyValue('--mc-exec-w') || !ex.getBoundingClientRect().width) return;
    const was = ex.textContent;
    let w = 0;
    for (const t of ['Execute (999)', 'Executing…']) { ex.textContent = t; w = Math.max(w, ex.getBoundingClientRect().width); }
    ex.textContent = was;
    ex.style.setProperty('--mc-exec-w', Math.ceil(w) + 'px');
    Log.debug('exec width ' + Math.ceil(w) + 'px');
}

function inspector() {
    const a = el('aside', 'mc-side right');
    a.innerHTML = mbuHtml('<h2 class="mc-sec"><span class="mc-insp-t">Inspector</span> <button type="button" class="mc-x" data-close="right" data-tip="Hide">×</button></h2><div class="mc-insp"></div>');
    return a;
}
function paintInspector() {
    if (!ui) return;
    const t = rel.tracks[selected];
    const box = ui.querySelector('.mc-insp'), ttl = ui.querySelector('.mc-insp-t');
    if (!t) { ttl.textContent = 'Inspector'; box.innerHTML = mbuHtml('<div class="weak" style="font-size:12px">Select a track to see what each provider found for it.</div>'); return; }
    ttl.textContent = 'Track ' + t.pos + ' · ' + t.title;
    const blk = (h, p, body) => {
        const x = trackFinding(p, t.rec);
        const inner = x ? body(x) : '<div class="weak" style="font-size:11.5px">' + esc(stateText(PROVIDERS.find(y => y.id === p))) + '</div>';
        return '<div class="mc-insp-block"><h2 class="mc-sec">' + h + '</h2>' + inner + '</div>';
    };
    const mini = (a, b) => '<div class="mc-mini">' + a + '<span class="n">' + (b || '') + '</span></div>';
    const isrcBody = x => (x.existing || []).map(i => mini('<span class="mono">' + isrcHtml(i) + '</span>', 'on MB')).join('')
        + (x.isrc && !(x.existing || []).includes(x.isrc) ? mini('<span class="mono mc-add">+ ' + isrcHtml(x.isrc) + '</span>', esc(x.source || '')) : '')
        + (x.why ? '<div class="mc-why">' + esc(x.why) + '</div>' : '')
        + (!x.isrc && !(x.existing || []).length ? '<div class="weak" style="font-size:11.5px">none found</div>' : '');
    const linksBody = x => (x.linkUrls || []).map(u => mini('<span class="mc-pico">' + stIcon(urlIcon(u), 14) + '</span> <a target="_blank" rel="noopener" href="' + esc(u) + '">' + esc(shortUrl(u)) + '</a>', 'on MB')).join('')
        + trackLinks(t.rec).map(l => mini('<span class="mc-pico">' + stIcon(urlIcon(l.url), 14) + '</span> <a class="mc-add" target="_blank" rel="noopener" href="' + esc(l.url) + '">+ ' + esc(shortUrl(l.url)) + '</a>', esc(l.name))).join('')
        || '<div class="weak" style="font-size:11.5px">none</div>';
    const fusionBody = x => !(x.matches || []).length ? '<div class="weak" style="font-size:11.5px">no duplicates</div>'
        : mini('Fusion group', x.tier ? '<span class="mc-fxt ' + esc(x.tier) + '">' + esc(x.tier) + '</span>' : '')
        + x.matches.map(m => '<div class="mc-fxm">' + mini('<a target="_blank" href="/recording/' + esc(m.gid) + '"><b>' + esc(m.title || m.gid.slice(0, 8)) + '</b></a>', esc(m.gid.slice(0, 8)))
            + '<div class="mc-kv"><span>release</span><span>' + esc(fxRel(m)) + '</span>'
            + '<span>length</span><span>' + esc(m.len || '?') + fxLenDiff(x.self, m) + '</span>'
            + (m.artist ? '<span>artist</span><span>' + esc(m.artist) + '</span>' : '')
            + (m.isrcs ? '<span>ISRCs</span><span class="mono">' + (m.isrcs.map(isrcHtml).join(', ') || 'none') + '</span>' : '')
            + '<span>AcoustIDs</span><span class="mono">' + (m.acoustids == null ? '<span class="weak">' + (fxBusy.has(x.key) ? 'checking…' : 'not checked') + '</span>'
                : m.acoustids.map(v => '<span data-tip="' + esc(v) + '"' + (x.self && (x.self.acoustids || []).includes(v) ? ' class="mc-fxs"' : '') + '>' + esc(v.slice(0, 8)) + '…</span>').join(', ') || 'none') + '</span>'
            + '<span>edits</span><span>' + (m.pending ? '<span class="mc-err">open edit</span>' : 'none') + '</span></div></div>').join('')
        + (x.signals ? '<div class="weak" style="font-size:11px;margin:4px 0">every pair agrees on: ' + esc(x.signals.join(', ') || 'nothing') + '</div>' : '')
        + fxOpenBtn(x);
    // #782: the track's versions on the platforms, the one most give first, what differs from the track's own title marked
    const platBody = x => x.versions.map(v => '<div class="mc-fxm">' + mini('<span data-tip="' + esc(v.title) + '">' + ccTitleDiff(v.title, t.title) + '</span>', ccIcons(v.keys))
        + '<div class="mc-kv"><span>length</span><span>' + (ccLen(v.len) || '?') + '</span>' + (v.isrc ? '<span>ISRC</span><span class="mono">' + isrcHtml(v.isrc) + '</span>' : '') + '</div></div>').join('');
    // each credit names the sources that give it, when more than one source was read (#680)
    const chBody = x => (x.list || []).map(c => mini(esc(c.name), esc(c.role) + (c.sources && /,/.test(x.source || '') ? ' <span class="weak">· ' + esc(c.sources.join(', ')) + '</span>' : ''))).join('') || '<div class="weak" style="font-size:11.5px">no credits</div>';
    box.innerHTML = mbuHtml('<div class="mc-mini">Recording<a class="n" target="_blank" href="/recording/' + esc(t.rec) + '">' + esc((t.rec || '').slice(0, 8)) + '</a></div>'
        + '<div class="mc-mini">Length<span class="n">' + esc(t.len || '?') + '</span></div><div style="height:10px"></div>'
        + blk('ISRCs', 'is', isrcBody) + blk('Recording links', 'is', linksBody)
        + (modeNow('fusion') !== 'off' ? blk('Fusion matches', 'fusion', fusionBody) : '') + (modeNow('ch') !== 'off' ? blk('Credits', 'ch', chBody) : '')
        + (modeNow('platforms') !== 'off' ? blk('Platforms', 'fc', platBody) : ''));
}


function paintBadges() {
    if (!ui) return;
    paintSteps();
    ui.querySelectorAll('[data-p]').forEach(n => {
        const p = PROVIDERS.find(x => x.id === n.dataset.p); if (!p) return;
        const dot = n.querySelector('.mc-dot'); if (dot) dot.className = 'mc-dot ' + stateOf(p);
        const st = n.querySelector('.st'); if (st) { st.textContent = sideText(p); st.dataset.tip = stateText(p); }
        const chip = n.querySelector('.mc-chip'); if (chip) { const [c, t] = chipOf(p); chip.className = 'mc-chip ' + c; chip.textContent = t; }
        if (p.id === 'pc') paintCoverage(n);
    });
    paintFoot();
}

function paintSides() {
    ui.classList.toggle('no-left', !S.left);
    ui.classList.toggle('no-right', !S.right);
}

// Rebuild the body when a setting changes what's on screen (a step turned off
// drops its column); the header and the open/closed state stay.
function rebuildBody() {
    const main = ui.querySelector('.mc-main');
    main.replaceWith(body());
    paintAll(); paintInspector();
}
function body() {
    const m = el('div', 'mc-main');
    const c = el('main', 'mc-center');
    c.append(matrix(), releaseCards());
    m.append(orderSidebar(), c, inspector());
    return m;
}

function open() {
    if (ui) return;
    mcStyle();
    rel = readRelease();
    watchTracks();
    ui = el('div', 'mbu-ui'); ui.id = 'mc-root';
    ui.append(header(), body());
    document.body.appendChild(ui);
    // on a phone mc-open pins the page's body, which scrolls it to the top: put it back on close
    openScroll = [scrollX, scrollY];
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.classList.add('mc-open');
    paintSides(); paintAll(); paintInspector();
    ui.addEventListener('click', onClick);
    ui.addEventListener('contextmenu', onContextMenu);
    ui.addEventListener('mousedown', onPickDown);
    ui.addEventListener('mouseover', onPickOver);
    // #782: a track's title or length typed in the row under it: taken in when it changes; Enter keeps it, Escape puts it back
    ui.addEventListener('change', e => {
        const el = e.target;
        if (el.dataset.pfTitle != null) pfSet(+el.dataset.pfTitle, 'title', el.value, '');
        else if (el.dataset.pfLen != null) {
            const ms = el.value.trim() ? pfMs(el.value) : null;
            if (el.value.trim() && !ms) { Log.cat('UI').warn('"' + el.value + '" isn\'t a length (m:ss): left as it was'); paintMatrix(); return; }
            pfSet(+el.dataset.pfLen, 'ms', ms, '');
        } else if (el.dataset.pfRec != null) { const p = CMP.picks[+el.dataset.pfRec]; if (p) { p.recording = el.checked; Log.cat('UI').info('track ' + rel.tracks[+el.dataset.pfRec].pos + ': the recording\'s title ' + (el.checked ? 'too' : 'kept')); } }
    });
    ui.addEventListener('keydown', e => {
        if (e.target.classList.contains('mc-pf-in')) {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.target.value = e.target.defaultValue; e.target.blur(); }
            return;
        }
    });
    document.addEventListener('mouseup', onPickUp);
    // a cover thumbnail that fails falls back to its full image once (errors don't bubble: capture)
    ui.addEventListener('error', e => { const i = e.target; if (i.tagName === 'IMG' && i.dataset.alt) { const a = i.dataset.alt; delete i.dataset.alt; i.dataset.from = i.getAttribute('src'); i.src = a; } }, true);
    document.addEventListener('keydown', onKey);
    stepClock = setInterval(() => { if (isBusy()) paintSteps(); paintFoot(); }, 1000);
    Log.cat('UI').info('opened · sidebars ' + (S.left ? 'order ' : '') + (S.right ? 'inspector' : '') + ' · fusion ' + S.fusion + ' · ch ' + S.ch + ' · auto probe ' + (S.autoProbe ? 'on' : 'off'));
    discover();
    // Auto: probe once the providers had discover's moment to answer
    if (S.autoProbe) setTimeout(() => { if (ui && !run) { Log.cat('UI').info('auto probe'); probe(); } }, 700);
}
let trackObs = null, trackT = 0, openScroll = null;
function watchTracks() {
    const root = document.querySelector('#content') || document.body;
    trackObs = new MutationObserver(muts => {
        if (!ui || muts.every(m => ui.contains(m.target))) return;
        clearTimeout(trackT);
        trackT = setTimeout(() => {
            const n = document.querySelectorAll('#content table.medium tbody tr a[href*="/recording/"]').length;
            if (n === rel.tracks.length) return;
            Log.cat('Release').info('tracklist changed on the page: ' + rel.tracks.length + ' → ' + n + ' tracks, re-reading');
            rel = readRelease();
            if (selected != null && selected >= rel.tracks.length) selected = null;
            rebuildBody();
        }, 300);
    });
    trackObs.observe(root, { childList: true, subtree: true });
}
function close() {
    if (!ui) return;
    if (trackObs) { trackObs.disconnect(); trackObs = null; }
    ui.remove(); ui = null;
    document.documentElement.style.overflow = '';
    document.documentElement.classList.remove('mc-open');
    if (openScroll) { scrollTo(openScroll[0], openScroll[1]); openScroll = null; }
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mouseup', onPickUp);
    clearInterval(stepClock);
    autoExecCancel('Mission Control was closed');
    Log.cat('UI').info('closed');
}
function onKey(e) {
    if (e.key !== 'Escape' || document.querySelector('.mbu-ov') || document.getElementById('mbu-logpop') || document.getElementById('mc-cover')) return;
    close();
}

// a click on a badge in the row (a count, a pick) selects its track without opening the inspector
function selectTrack(i, open = true) {
    selected = i;
    ui.querySelectorAll('.mc-tbl tr.sel').forEach(r => r.classList.remove('sel'));
    const row = ui.querySelector('.mc-tbl tbody tr[data-i="' + i + '"]');
    if (row) row.classList.add('sel');
    if (open && !S.right) { S.right = true; saveSettings(); paintSides(); }
    paintInspector();
    Log.cat('UI').debug('selected track ' + rel.tracks[selected].pos + ' (' + rel.tracks[selected].rec + ')');
}
const isPicked = pk => !!(picked[pk.dataset.prov] && picked[pk.dataset.prov].has(pk.dataset.key));
// takes every pick in `pks` in (on) or leaves it out, then paints once
function setPicks(pks, on) {
    if (!pks.length) return;
    pks.forEach(pk => {
        const set = picked[pk.dataset.prov] || (picked[pk.dataset.prov] = new Set());
        if (on) set.add(pk.dataset.key); else set.delete(pk.dataset.key);
        // #709: a release has one barcode, so taking one in leaves the others out
        if (on && /^barcode:/.test(pk.dataset.key)) [...set].forEach(k => { if (k !== pk.dataset.key && /^barcode:/.test(k)) set.delete(k); });
        // #740: a label has one catalog number, so taking one in leaves the label's others out
        const cat = on && (pk.dataset.key.match(/^catno:([0-9a-f-]{36}):/) || [])[0];
        if (cat) [...set].forEach(k => { if (k !== pk.dataset.key && k.startsWith(cat)) set.delete(k); });
    });
    Log.cat('UI').debug((on ? 'taken in ' : 'left out ') + pks.map(pk => pk.dataset.prov + ' ' + pk.dataset.key).join(', '));
    if (pks.some(pk => pk.closest('.mc-tbl'))) paintMatrix();
    if (pks.some(pk => !pk.closest('.mc-tbl'))) paintCards();
    paintExec();
    if (pks.some(pk => pk.dataset.prov === 'pc')) syncLinks(700);
    if (pks.some(pk => pk.dataset.prov === 'as')) asStage();   // #784
}
function togglePick(pk) { setPicks([pk], !isPicked(pk)); }
// #714: in the track matrix, as in Apollo and ISRC Scout, Ctrl takes the whole row (the track),
// Alt the whole column (for a found link, that platform on every track), Ctrl+Alt everything in
// the table. All follow the clicked one: taken in when it wasn't, left out when it was.
function bulkPick(pk, e) {
    const ctrl = e.ctrlKey || e.metaKey, alt = e.altKey;
    if (!(ctrl || alt) || !pk.closest('.mc-tbl')) return false;
    const all = [...ui.querySelectorAll('.mc-tbl .mc-pick[data-col]')];
    const pks = ctrl && alt ? all
        : ctrl ? [...pk.closest('tr[data-i]').querySelectorAll('.mc-pick[data-col]')]
        : all.filter(x => x.dataset.col === pk.dataset.col && x.dataset.ico === pk.dataset.ico);
    setPicks(pks, !isPicked(pk));
    return true;
}
// #714: a press on an ISRC or a merge, dragged up or down its column, takes in (or leaves out)
// every one it passes, as the press would have; the click that ends a drag toggles nothing more
let drag = null, dragged = false;
const DRAG_SEL = '.mc-tbl span.mc-pick[data-col]';
function onPickDown(e) {
    dragged = false;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    const pk = e.target.closest(DRAG_SEL);
    if (!pk || e.target.closest('a, button')) return;
    e.preventDefault();   // no text selection while dragging
    drag = { col: pk.dataset.col, key: pk.dataset.key, on: !isPicked(pk), moved: false };
}
function onPickOver(e) {
    if (!drag) return;
    const pk = e.target.closest(DRAG_SEL);
    if (!pk || pk.dataset.col !== drag.col || (!drag.moved && pk.dataset.key === drag.key)) return;
    const pks = [pk];
    // the first move takes the pressed one along (a paint replaces the elements: find it again)
    if (!drag.moved) { drag.moved = true; pks.push(...[...ui.querySelectorAll(DRAG_SEL)].filter(x => x.dataset.col === drag.col && x.dataset.key === drag.key)); }
    setPicks(pks.filter(x => isPicked(x) !== drag.on), drag.on);
}
function onPickUp() {
    if (drag && drag.moved) dragged = true;
    drag = null;
}
// a found track link is an <a> (a click opens it): right-click takes it in or leaves it out
function onContextMenu(e) {
    const stp = e.target.closest('.mc-step');
    if (stp && !e.target.closest('[data-act]')) { e.preventDefault(); toggleProvider(stp.dataset.step, true); return; }
    // #841: a right-click on Execute runs it without the review
    const ex = e.target.closest('[data-act="exec"]');
    if (ex) { e.preventDefault(); if (!ex.disabled && !autoExecCancel('you right-clicked Execute')) execute(false); return; }
    const pk = e.target.closest('a.mc-lnk.mc-pick');
    if (!pk) return;
    e.preventDefault();
    if (!bulkPick(pk, e)) togglePick(pk);
}
function onClick(e) {
    const t = e.target;
    const side = t.closest('[data-side]');
    if (side) { S[side.dataset.side] = true; saveSettings(); paintSides(); return; }
    const x = t.closest('[data-close]');
    if (x) { S[x.dataset.close] = false; saveSettings(); paintSides(); return; }
    const m = t.closest('.mc-seg button');
    if (m) { setMode(m.closest('.mc-seg').dataset.mode, m.dataset.v); return; }
    const fx = t.closest('[data-act^="fx"]');
    if (fx) {
        const row = (fx.dataset.act === 'fx' || fx.dataset.act === 'fx-pf') && fx.closest('.mc-tbl tbody tr[data-i]');
        if (fx.tagName === 'INPUT') return;
        fxAct(fx);
        if (row) selectTrack(Number(row.dataset.i), false);   // the count also selects its track
        return;
    }
    // a pickable row or cell toggles on click (#680); a link inside it still just opens
    const pk = !t.closest('a') && t.closest('.mc-pick');
    if (pk) {
        if (dragged) dragged = false;   // the drag already did it
        else if (!bulkPick(pk, e)) togglePick(pk);
        if (!pk.closest('.mc-tbl')) return;   // in the matrix the click also selects the track
    }
    const row = t.closest('.mc-tbl tbody tr[data-i]');
    if (row && !t.closest('a')) { selectTrack(Number(row.dataset.i), !pk && !t.closest('button')); return; }
    const fetchBtn = t.closest('[data-fetch]');
    if (fetchBtn) { probeOne(fetchBtn.dataset.fetch); return; }
    const act = t.closest('[data-act]');
    // #753: a step switches its provider off and on; the format icon shows or hides the execution order
    const stp = !act && t.closest('.mc-step');
    if (stp) { toggleProvider(stp.dataset.step); return; }
    if (t.closest('.mc-hdr .mc-fmt')) { S.left = !S.left; saveSettings(); paintSides(); return; }
    if (!act) return;
    switch (act.dataset.act) {
        case 'probe': {
            if (!probe()) mbuToast('No provider to ask: none is installed with a Mission Control adapter yet.');
            break;
        }
        case 'linked': {
            // each section's linked icons open that section only
            const k = act.dataset.lk, open = Array.isArray(S.linkedOpen) ? S.linkedOpen.filter(x => x !== k) : [];
            if (!linkedOpen(k)) open.push(k);
            S.linkedOpen = open; saveSettings(); paintCards(); break;
        }
        case 'lane': {
            if (act.classList.contains('empty')) break;
            const k = act.dataset.lane;
            if (laneOpen.has(k)) laneOpen.delete(k); else laneOpen.add(k);
            paintCards();
            break;
        }
        case 'lane-all': {
            const r = results.pc, k = act.dataset.lane, norm = b => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
            if (!r || !r.findings) break;
            const keys = r.findings.filter(x => !x.entity && laneTakes(x) && norm(x.barcode) === k).map(x => x.key);
            const set = picked.pc || (picked.pc = new Set()), all = keys.every(x => set.has(x));
            keys.forEach(x => all ? set.delete(x) : set.add(x));
            Log.cat('UI').debug((all ? 'left out ' : 'taken in ') + 'pc lane ' + (k || '(no barcode)') + ': ' + keys.join(', '));
            paintCards(); paintExec(); syncLinks(700);
            break;
        }
        case 'falcon-open': document.dispatchEvent(new CustomEvent('falcon:show')); break;
        case 'card-onoff': setCardOff(act.dataset.sect, !cardOff(act.dataset.sect)); break;
        case 'cover': coverViewer(coverList(results.as && results.as.best), Number(act.dataset.i) || 0); break;
        case 'exec': if (!autoExecCancel('you clicked Execute')) startExecute(); break;
        case 'retry-apply': retryOne(act.dataset.prov); break;
        case 'log': Log.open(); break;
        case 'cfg': settingsWindow(); break;
        case 'close': close(); break;
    }
}


function setMode(key, v) {
    if (S[key] === v) return;
    Log.cat('UI').info(key + ' mode ' + S[key] + ' → ' + v);
    S[key] = v; saveSettings();
    if (ui) rebuildBody();
}

// A card's icon and title are its On / Off switch, one button: nothing more in the header. Off: the
// icon greyed, the title faded.
function cardTitle(id, icon, title) {
    return '<button type="button" class="mc-icsw" data-act="card-onoff" data-sect="' + id + '" aria-pressed="true"><span class="ic' + (/^<img/.test(icon) ? ' img' : '') + '">' + icon + '</span><span class="t">' + title + '</span></button>';
}
function paintOnOff() {
    ui.querySelectorAll('.mc-sect[data-sect]').forEach(s => {
        const id = s.dataset.sect, off = cardOff(id), b = s.querySelector('.mc-icsw');
        s.classList.toggle('mc-off', off);
        if (!b) return;
        b.setAttribute('aria-pressed', String(!off));
        b.dataset.tip = off ? 'Left out: Execute skips this card\nClick: take it in' : 'Click: leave this card out of Execute';
    });
}
function setCardOff(id, off) {
    if (off) OFF.add(id); else OFF.delete(id);
    Log.cat('UI').info('the ' + id + ' card is ' + (off ? 'off: Execute leaves it out' : 'on'));
    if (ui) { fitCards(); paintExec(); }
}
// #776: the Execute setting under the consolidation one is greyed out while that one is off
function consSub(panel) {
    const i = panel.querySelector('[data-k="consExec"]'); if (!i) return;
    i.disabled = !S.consAfter; i.closest('label').classList.toggle('mc-cfg-dim', !S.consAfter);
    panel.querySelector('[data-k="consExecS"]').disabled = !S.consAfter;
}
// the Execute setting with its countdown's seconds, in both settings windows
const consExecHtml = () => '<label class="mc-cfg-sub' + (S.consAfter ? '' : ' mc-cfg-dim') + '"><input type="checkbox" data-k="consExec"' + (S.consExec ? ' checked' : '') + (S.consAfter ? '' : ' disabled') + '><span>…and Execute once the probe has finished'
    + '<span class="mc-cfg-hint">A countdown of <input type="number" data-k="consExecS" min="5" max="60" step="5" value="' + S.consExecS + '"' + (S.consAfter ? '' : ' disabled') + '> seconds runs on the Execute button first. Click it to cancel.</span></span></label>';
// the countdown's seconds, 5 to 60, from its stepper (mbuControls) or typed
function consStep(panel) {
    mbuControls(panel);
    panel.addEventListener('change', e => {
        if (e.target.dataset.k !== 'consExecS') return;
        e.stopImmediatePropagation();
        S.consExecS = Math.max(5, Math.min(60, Math.round(+e.target.value) || DEFAULTS.consExecS));
        e.target.value = S.consExecS;
        saveSettings();
    }, true);
}
function settingsWindow() {
    const ov = el('div', 'mbu-ov');
    const panel = el('div', 'mbu-ov-panel mc-cfg');
    panel.style.width = 'min(640px, 94vw)';
    const chk = (key, label) => '<label><input type="checkbox" data-k="' + key + '"' + (S[key] ? ' checked' : '') + '>' + label + '</label>';
    panel.innerHTML = mbuHtml('<div class="mbu-ov-body">' + mbuCfgHeader({ script: 'mission_control', name: 'Mission Control', version: VERSION, icon: '<img src="' + ICON_URL + '" alt="">', log: true })
        + chk('autoProbe', 'Probe as soon as Mission Control opens')
        + chk('review', 'Review the changes before Execute (right-click on Execute skips it)')
        + chk('reloadAfter', 'Reload the release page after an Execute without errors')
        + chk('consAfter', 'After saving a consolidated release, open Mission Control on it')
        + consExecHtml()
        + '<label><input type="checkbox" data-k="ccDiffOpen"' + (S.ccDiffOpen ? ' checked' : '') + '>Show track differences by default</label>'
        + '</div>');
    ov.appendChild(panel);
    document.body.appendChild(ov);
    const done = () => { ov.remove(); };
    const off = mbuDismissOn(panel, done);
    consStep(panel);
    // #744: the settings close before the log opens: open under it, they took the log's first ✕ or Esc for themselves
    panel.querySelector('.mbu-cfg-log').onclick = () => { off(); Log.open(); };
    panel.addEventListener('change', e => {
        const k = e.target.dataset.k; if (!k) return;
        S[k] = e.target.checked; saveSettings();
        if (k === 'consAfter') consSub(panel);
    });
}

/* ── consolidation of a new release (#702) ────────────────────────────────── */

// On /release/add#mc=<token>, MusicBrainz has no release yet. First Contact's Consolidate read an
// album on a platform and stored it for this page; Mission Control covers the empty editor and:
//   1. asks Platform Check to find the album on the other platforms (a seed probe: barcode, title,
//      artist, track count), and groups what it finds by barcode into lanes, as on a release page;
//   2. asks First Contact to read each platform of the source's lane (mc:read), and of the lanes
//      ticked by hand: another barcode is another release, so it is read only when ticked;
//   3. lines the platforms' releases up, field by field and track by track, and takes the value
//      most of them give (a tie goes to Platform Check's platform order); a click takes another;
//   4. seeds the release editor with what is taken (fc:seed, in this tab), with every taken
//      platform's link and each artist's links from all of them, for Apollo to match by.
// After saving, the new release page opens Mission Control and probes it (an option, on by
// default): ISRC Scout gets the ISRCs taken here, Art Station the cover, Platform Check the links.
const CC_PC_KEY = { amazon: 'amazonmusic' };   // First Contact's provider ids → Platform Check's keys (the ST-ICONS names)
const ccKey = id => CC_PC_KEY[id] || id;
const CC_NAMES = { discogs: 'Discogs', bandcamp: 'Bandcamp', spotify: 'Spotify', apple: 'Apple Music', deezer: 'Deezer', tidal: 'Tidal', ytmusic: 'YouTube Music', amazonmusic: 'Amazon Music', qobuz: 'Qobuz', beatport: 'Beatport', volumo: 'Volumo', hdtracks: 'HDtracks', sevendigital: '7digital', soundcloud: 'SoundCloud', audiomack: 'Audiomack', ototoy: 'OTOTOY', mora: 'mora', melon: 'Melon', presto: 'Presto Music' };
const ccName = k => CC_NAMES[k] || k;
const CC_UNREAD = { spotify: 'Spotify is read through its web player only: its link is added, its data is not compared' };
const ccIco = (k, size) => stIcon(k, size || 14) || '<span class="mcc-abbr">' + esc(String(k).slice(0, 2).toUpperCase()) + '</span>';
const ccIcons = keys => '<span class="mcc-icos">' + keys.map(k => '<span data-tip="' + esc(ccName(k)) + '">' + ccIco(k, 13) + '</span>').join('') + '</span>';
const ccBc = b => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
const ccNorm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\s.,'’"“”!?()[\]\-–—:;/&+]+/g, ' ').trim();
const ccLen = ms => { if (!ms) return ''; const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const ccCredit = c => (c || []).map(a => (a.name || '') + (a.join || '')).join('');
// Discogs's placeholders say there is none: no value to vote with
const ccNone = s => /^\[?(none|no label)\]?$/i.test(String(s || '').trim());
const ccCount = rel => (rel.mediums || []).reduce((n, m) => n + m.tracks.length, 0);
const CC_AFTER_KEY = 'mc.after';
const CC_AFTER_TTL = 3 * 3600 * 1000;

// #702: the consolidation's MusicBrainz lookups go through the shared request gate (#633)
// <ST-NET> — generated by dev/net/sync-gate.mjs from dev/net/mb-gate.mjs — DO NOT EDIT
const MBN_GAP = 1000;
const MBN_BURST = 3;
const MBN_KEY = "mbu:mb-gate";
const MBN_LOCK = "mbu-mb-gate";
const MBN_MAX_HOLD = 60000;
function mbnGated(url) {
    const s = String(url || '');
    return /^\/ws\/2\//.test(s) || /^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org\/ws\/2\//i.test(s);
}
async function mbnState(fn) {
    const rw = () => {
        let s = null, stored = true;
        try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null'); } catch (e) { stored = false; }
        const g = globalThis.__mbnGate || (globalThis.__mbnGate = { tat: 0, cool: 0, hot: 0 });
        if (!stored) s = g;                                                        // no storage: this page's copy only
        else if (!s || typeof s !== 'object') s = { tat: 0, cool: 0, hot: 0 };   // none yet (or cleared): a fresh schedule
        const out = fn(s);
        Object.assign(g, s);
        try { localStorage.setItem(MBN_KEY, JSON.stringify({ tat: s.tat || 0, cool: s.cool || 0, hot: s.hot || 0 })); } catch (e) {}
        return out;
    };
    // The lock is held only for rw()'s synchronous moment, so a wait of seconds means it is
    // stuck (a frozen or sandboxed holder): give up on it and go unlocked rather than hang
    // every request behind it.
    let timer = 0;
    try {
        if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
            const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
            if (ctrl) timer = setTimeout(() => ctrl.abort(), 3000);
            return await navigator.locks.request(MBN_LOCK, ctrl ? { signal: ctrl.signal } : {}, rw);
        }
    } catch (e) { /* no Web Locks here (an insecure or sandboxed context), or stuck: unlocked, like a lone script */ } finally { clearTimeout(timer); }
    return rw();
}
async function mbnSlot(o) {
    o = o || {};
    const t0 = Date.now(), background = o.background !== false;
    const booked = await mbnState(s => {
        const now = Date.now(), cool = s.cool || 0, tat = s.tat || 0;
        let at = background ? Math.max(now, tat - (MBN_BURST - 1) * MBN_GAP) : now;
        at = Math.max(at, cool);
        s.tat = Math.max(tat, at) + MBN_GAP;
        return { at, why: cool > now && cool >= at ? 'MusicBrainz asked everyone to wait' : 'pacing, one request a second' };
    });
    let told = false;
    for (;;) {
        if (o.cancelled && o.cancelled()) return { ok: false, waited: Date.now() - t0 };
        let cool = 0;
        try { cool = (JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}).cool || 0; } catch (e) { cool = (globalThis.__mbnGate || {}).cool || 0; }
        const until = Math.max(booked.at, cool), left = until - Date.now();   // a hold that appeared while we queued
        if (left <= 0) break;
        if (!told && until - t0 > 1000 && o.log) { told = true; o.log('info', 'MusicBrainz gate: ' + (o.label || 'request') + ' waits ' + Math.round((until - t0) / 100) / 10 + 's (' + (cool > booked.at ? 'MusicBrainz asked everyone to wait' : booked.why) + ')'); }
        await new Promise(r => setTimeout(r, Math.min(left, 250)));   // in slices, so a cancel lands promptly
    }
    return { ok: true, waited: Date.now() - t0 };
}
async function mbnAnswer(status, header, o) {
    o = o || {};
    if (status === 429 || status === 503) {
        const raw = header ? header('Retry-After') : null;
        const secs = Number(raw), date = raw ? Date.parse(raw) : NaN;
        const ra = Number.isFinite(secs) ? secs * 1000 : Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
        const hold = await mbnState(s => {
            const now = Date.now();
            // One throttle, one step: the requests already in flight when it began all answer
            // 503 too, and each must not stretch the hold again. A throttle long gone doesn't
            // count at all: `hot` is shared and persists, and would otherwise slow every later
            // page for good.
            if (now > (s.cool || 0) + 30000) s.hot = 0;
            if (now >= (s.cool || 0)) s.hot = Math.min((s.hot || 0) + 1, 6);
            const ms = Math.min(Math.max(1000, ra) * Math.max(1, s.hot), MBN_MAX_HOLD);
            s.cool = Math.max(s.cool || 0, Date.now() + ms);
            return s.cool - Date.now();
        });
        if (o.log) o.log('warn', 'MusicBrainz gate: HTTP ' + status + (raw != null ? ' (Retry-After: ' + raw + ')' : '') + ' — every script holds ' + Math.round(hold / 100) / 10 + 's');
        return { throttled: true, hold };
    }
    if (status >= 200 && status < 500) await mbnState(s => { if (s.hot) s.hot = Date.now() > (s.cool || 0) + 30000 ? 0 : s.hot - 1; });
    return { throttled: false, hold: 0 };
}
async function mbnFetch(url, init, o) {
    o = o || {};
    if (!mbnGated(url)) {
        const r = await fetch(url, init);
        if (!mbnWebsite(url) || !(await mbnIsCheck(r))) return r;
        // #733: MusicBrainz's browser check answered instead: nothing was done (a POST is safe
        // to repeat), so pass the check and ask again
        return (await mbnReverify(url, init, o)) ? fetch(url, init) : r;
    }
    const tries = o.tries || 4;
    for (let attempt = 1; ; attempt++) {
        const slot = await mbnSlot(o);
        if (!slot.ok) return null;
        const r = await fetch(url, init);
        const a = await mbnAnswer(r.status, n => r.headers.get(n), o);
        if (!a.throttled || attempt >= tries) return r;
    }
}
function mbnHot() {
    let s;
    try { s = JSON.parse(localStorage.getItem(MBN_KEY) || 'null') || {}; } catch (e) { s = globalThis.__mbnGate || {}; }
    return Date.now() > (s.cool || 0) + 30000 ? 0 : (s.hot || 0);   // a throttle long gone is over
}
function mbnRawHeader(raw, name) {
    const want = String(name).toLowerCase();
    for (const line of String(raw || '').split(/\r?\n/)) {
        const i = line.indexOf(':');
        if (i > 0 && line.slice(0, i).trim().toLowerCase() === want) return line.slice(i + 1).trim();
    }
    return null;
}
function mbnWebsite(url) {
    const s = String(url || '');
    if (mbnGated(s)) return false;
    if (/^https?:\/\/([a-z0-9-]+\.)*musicbrainz\.org(\/|$)/i.test(s)) return true;
    return /^\/(?!\/)/.test(s) && typeof location !== 'undefined' && /(^|\.)musicbrainz\.org$/i.test(location.hostname);
}
async function mbnIsCheck(r) {
    try {
        if (!r || !/text\/html/i.test((r.headers && r.headers.get('content-type')) || '')) return false;
        const head = (await r.clone().text()).slice(0, 3000);
        return /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(head);
    } catch (e) { return false; }
}
function mbnReverify(url, init, o) {
    o = o || {};
    const log = (lvl, m) => { try { if (o.log) o.log(lvl, m); else (lvl === 'warn' ? console.warn : console.info)('[MusicBrainz gate] ' + m); } catch (e) {} };
    const g = globalThis.__mbnCheck || (globalThis.__mbnCheck = { busy: null, failedAt: 0 });
    if (g.busy) return g.busy;
    let target;
    try { target = new URL(String(url), location.href); } catch (e) { return Promise.resolve(false); }
    if (target.host !== location.host || typeof document === 'undefined') { log('warn', 'MusicBrainz asked to verify the browser — open any MusicBrainz page, then retry'); return Promise.resolve(false); }
    if (Date.now() - g.failedAt < 60000) return Promise.resolve(false);   // just failed: don't loop
    // a POST's URL can't be loaded: the check is per browser, so any light GET passes it
    const method = String((init && init.method) || 'GET').toUpperCase();
    const src = method === 'GET' ? target.href : location.origin + '/ws/js/entity/89ad4ac3-39f7-470e-963a-56509c546377';
    const t0 = Date.now();
    log('warn', 'MusicBrainz asked to verify the browser again ("Verifying your browser") — passing it in a hidden frame');
    g.busy = new Promise(resolve => {
        const fr = document.createElement('iframe');   // fresh each time, never re-navigated
        fr.setAttribute('aria-hidden', 'true'); fr.setAttribute('data-mbn-check', ''); fr.tabIndex = -1;
        fr.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:0;border:0;opacity:0;pointer-events:none';
        let loads = 0, done = false, timer = 0;
        const finish = ok => {
            if (done) return; done = true; clearTimeout(timer); fr.remove(); g.busy = null;
            if (ok) log('info', 'browser check passed in ' + (Date.now() - t0) + ' ms — retrying');
            else {
                g.failedAt = Date.now();
                const m = 'MusicBrainz wants to verify your browser — open any MusicBrainz page in another tab, then retry';
                log('warn', m + ' (the hidden frame did not clear it in 20 s)');
                try { if (o.notify) o.notify(m); } catch (e) {}
            }
            resolve(ok);
        };
        // the first load is the check; it posts its answer and is redirected to the real URL
        fr.onload = () => {
            loads++;
            let still;
            try { const d = fr.contentDocument; still = !d || /<title>\s*Verifying your browser\s*<\/title>|JavaScript is required to access this page/i.test(d.documentElement ? d.documentElement.outerHTML.slice(0, 3000) : ''); }
            catch (e) { still = loads < 2; }
            if (!still) finish(true);
        };
        timer = setTimeout(() => finish(false), 20000);
        fr.src = src;
        (document.body || document.documentElement).appendChild(fr);
    });
    return g.busy;
}
// </ST-NET>

// <ST-GUESSCASE> — generated by dev/guesscase/sync-guesscase.mjs from dev/guesscase/guess-case.mjs — DO NOT EDIT
const mbuGuessCase = (() => {
    'use strict';

    const empty = v => v === null || v === undefined || v === '';
    const nonEmpty = v => !empty(v);
    const clean = s => String(s || '').trim().replace(/\s+/g, ' ');
    const escapeRegExp = s => s.replace(/([.*+?^=!:${}()|[\]/\\])/g, '\\$1');
    const capitalize = s => s[0].toUpperCase() + s.slice(1).toLowerCase();
    // utils/trim.js
    const trim = w => clean(w).replace(/([([])\s+/, '$1').replace(/\s+([)\]])/, '$1');

    // ── flags.js: the state of one run ──────────────────────────────────────────────────
    const BRACKET_PAIRS = [['(', ')'], ['[', ']'], ['<', '>'], ['（', '）'], ['［', '］'], ['{', '}'], ['【', '】']];
    const bracketChars = new RegExp('^[' + escapeRegExp(BRACKET_PAIRS.flat().join('')) + ']$');
    const bracketPairs = BRACKET_PAIRS.reduce((r, [o, c]) => { r[o] = c; r[c] = o; return r; }, {});

    class Flags {
        constructor() { this.context = {}; this.init(); }
        resetContext() {
            const c = this.context;
            c.acronym_split = false; c.colon = false; c.ellipsis = false; c.hyphen = false;
            c.openingBracket = false; c.singlequote = false; c.whitespace = false;
        }
        isInsideBrackets() { return this.context.openBrackets.length > 0; }
        pushBracket(b) { this.context.openBrackets.push(b); }
        popBracket() { const cb = this.getCurrentCloseBracket(); this.context.openBrackets.pop(); return cb; }
        getCurrentCloseBracket() {
            const ob = this.context.openBrackets[this.context.openBrackets.length - 1];
            return ob ? (bracketChars.test(ob) ? bracketPairs[ob] : '') : null;
        }
        init() {
            const c = this.context;
            c.forceCaps = true;            // the first word is always capitalized
            c.spaceNextWord = false;
            c.openBrackets = [];
            c.slurpExtraTitleInformation = false;
            this.resetContext();
            c.acronym = false;
            c.number = false;
            c.openedSingleQuote = false;
            c.numberSplitChar = null;      // the first split seen is the only one for the string
            c.numberSplitExpect = false;
        }
    }

    // ── utils/wordCheckers.js ────────────────────────────────────────────────────────────
    // turned to lowercase in brackets, but not put in brackets at the end of the title
    const preBracketSingleWordsList = ['acoustic', 'airplay', 'album', 'alternate', 'alternative', 'ambient', 'bit', 'bonus', 'censored', 'chillout', 'clean', 'club', 'composition', 'cut', 'dance', 'dialogue', 'dirty', 'disc', 'disco', 'dub', 'early', 'explicit', 'extended', 'feat', 'featuring', 'ft', 'instrumental', 'live', 'long', 'loop', 'main', 'megamix', 'mix', 'official', 'original', 'piano', 'radio', 'rap', 'rehearsal', 'remixed', 'remode', 'rework', 'reworked', 'session', 'short', 'single', 'studio', 'take', 'takes', 'techno', 'trance', 'uncensored', 'unknown', 'untitled', 'version', 'video', 'vocal', 'with', 'without'];
    const preBracketSingleWords = new RegExp('^(' + preBracketSingleWordsList.join('|') + ')$', 'i');
    const isPrepBracketSingleWord = w => preBracketSingleWords.test(w);
    // turned to lowercase in brackets, and put in brackets at the end of the title
    const lowerCaseBracketWordsList = ['a_cappella', 'clubmix', 'demo', 'edit', 'excerpt', 'interlude', 'intro', 'karaoke', 'maxi', 'mono', 'orchestral', 'outro', 'outtake', 'outtakes', 'quadraphonic', 'reedit', 're_edit', 'refix', 'reinterpreted', 'remake', 'remaster', 'remastered', 'remix', 'rmx', 'reprise', 'skit', 'stereo', 'unplugged', 'vs'].concat(preBracketSingleWordsList);
    const lowerCaseBracketWords = new RegExp('^(' + lowerCaseBracketWordsList.join('|') + ')$', 'i');
    const isLowerCaseBracketWord = w => w != null && lowerCaseBracketWords.test(w);
    const prepBracketWords = /^(?:cd|disk|12["”]|7["”]|a_cappella|re_edit)$/i;
    const isPrepBracketWord = w => w != null && (prepBracketWords.test(w) || isLowerCaseBracketWord(w));
    const isSentenceStopChar = w => w != null && /^[:.;?!/]$/.test(w);
    const isApostrophe = w => w != null && /^['’]$/.test(w);
    const isPunctuationChar = w => w != null && /^[:.;?!,]$/.test(w);

    // ── modes.js ─────────────────────────────────────────────────────────────────────────
    const LOWER_CASE_WORDS = /^(a|an|and|as|at|but|by|da|de|di|fe|fi|for|in|ina|inna|n|nor|o|of|on|or|tha|the|to)$/;
    const LOWER_CASE_WORDS_TURKISH = /^(ve|ile|ya|veya|yahut|ki|mı|mi|mu|mü|mısın|musun|mudur|mıdır|midir|miyim|misin|misiniz|mısınız|müsün|müyüm|müsünüz|mıyım|muyum|musunuz|miyiz|mıyız|muyuz|müyüz|müdür)$/;
    const UPPER_CASE_WORDS = /^(dj|mc|tv|mtv|ep|lp|ymca|nyc|ny|ussr|usa|r&b|bbc|fm|bc|ac|dc|uk|bpm|ok|nba|rza|gza|odb|dmx|2xlc)$/;
    const ROMAN_NUMERALS = /^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
    const EXCLUDED_ROMAN_NUMERALS = /^(?:mi|mix)$/;   // also frequent words

    const PREPROCESS_FIXLIST = [
        [/(^|\s)([({[])\s+($|\b)/i, '$2'],            // spaces after opening brackets
        [/(\b|^)\s+([)}\]])($|\b)/i, '$2'],            // spaces before closing brackets
        [/(\s|^|\()(\d+)''(\s|$)/i, '$2"'],            // 12'' -> 12"
        [/(\s|^|\()(\d+)in(ch)?(\s|$)/i, '$2"'],       // 12in -> 12"
        // combined words, put back together in post-processing
        [/(\b|^)a\s?c+ap+el+a(\b)/ig, 'a_cappella'],
        [/(\b|^)oc\sremix(\b)/ig, 'oc_remix'],
        [/(\b|^)re-edit(\b)/ig, 're_edit'],
        [/(\b|^)a\/k\/a(\b)/ig, 'a_k_a_'],
        [/(\b|^)a\.k\.a\.(\s)/ig, 'a_k_a_'],
    ];
    const POSTPROCESS_FIXLIST = [
        [/(\b|^)a_cappella(\b)/g, 'a cappella'],
        [/(\b|^)A_cappella(\b)/g, 'A Cappella'],
        [/(\b|^)oc_remix(\b)/ig, 'OC ReMix'],
        [/(\b|^)re_edit(\b)/g, 're-edit'],
        [/(\b|^)Re_edit(\b)/g, 'Re-Edit'],
        [/(\b|^)a_k_a_(\b|$)/ig, 'a.k.a.'],
        [/(\b|^)aka(\b|$)/ig, 'aka'],
        [/(\b|^)Santa fe(\b|$)/g, 'Santa Fe'],         // "fe" is a lowercase word
        [/(\b|^)R\s*&\s*B(\b)/ig, 'R&B'],
        [/(\b|^)\[live\](\b)/i, '(live)'],
        [/(\b|^)Djs(\b)/ig, 'DJs'],
        [/(\b|^)imac(\b)/ig, 'iMac'],
        [/(\b|^)ipad(\b)/ig, 'iPad'],
        [/(\b|^)iphone(\b)/ig, 'iPhone'],
        [/(\b|^)ipod(\b)/ig, 'iPod'],
        [/(\b|^)itunes(\b)/ig, 'iTunes'],
        [/(\b|^)tiktok(\b)/ig, 'TikTok'],
        [/(\b|^)youtube(\b)/ig, 'YouTube'],
        [/(\s|^)Rock '?n'? Roll(\s|$)/ig, "Rock 'n' Roll"],
        [/(\b)w([/／])o(\b)/i, 'w$2o'],
        [/(\b)f([.．/／])(\b)/i, 'f$2'],
    ];

    function replaceMatch(matches, inputString, regex, replacement) {
        const a = matches[1] || '';
        const b = matches[matches.length - 1] || '';
        return inputString.replace(regex, [a, replacement, b].join(''));
    }

    function runFixes(inputString, fixes) {
        let output = inputString;
        fixes.forEach(([regex, replacement]) => {
            let matches;
            if (regex.global) {
                let previousOutput;
                while ((matches = regex.exec(output))) {
                    previousOutput = output;
                    output = replaceMatch(matches, output, regex, replacement);
                    if (previousOutput === output) break;
                }
            } else {
                const m = output.match(regex);
                if (m !== null) output = replaceMatch(m, output, regex, replacement);
            }
        });
        return output;
    }

    // A mode is made per run: isRomanNumber reads the run's option where MusicBrainz reads a cookie.
    function makeDefaultMode(opts) {
        return {
            doWord() { return false; },
            fixVinylSizes(s) {
                return s
                    .replace(/(\s+|\()(7|10|12)(?:inch\b|in\b|'|''|")([^s]|$)/ig, '$1$2"$3')
                    .replace(/((?:\s+|\()(?:7|10|12)")([^),\s])/, '$1 $2');
            },
            isLowerCaseWord(w) { return LOWER_CASE_WORDS.test(w); },
            isRomanNumber(w) { return !!opts.romanUpper && ROMAN_NUMERALS.test(w) && !EXCLUDED_ROMAN_NUMERALS.test(w); },
            isSentenceCaps() { return true; },
            isUpperCaseWord(w) { return UPPER_CASE_WORDS.test(w); },
            name: '',
            // My Track Extended Dub remix => My Track (extended dub remix)
            prepExtraTitleInfo(words) {
                let outputWords = words;
                const lastWord = outputWords.length - 1;
                let wordIndex = lastWord;
                let handlePreProcess = false;
                while (wordIndex >= 0 && (
                    (outputWords[wordIndex] === ' ') ||
                    (outputWords[wordIndex] === '"' && (outputWords[wordIndex - 1] === '7' || outputWords[wordIndex - 1] === '12')) ||
                    ((outputWords[wordIndex + 1] || '') === '"' && (outputWords[wordIndex] === '7' || outputWords[wordIndex] === '12')) ||
                    isPrepBracketWord(outputWords[wordIndex])
                )) {
                    handlePreProcess = true;
                    wordIndex--;
                }
                if (wordIndex < lastWord) {
                    wordIndex++;
                    while (outputWords[wordIndex] === ' ' && wordIndex < lastWord) wordIndex++;
                    const probe = outputWords[lastWord];
                    if (wordIndex === lastWord && isPrepBracketSingleWord(probe)) handlePreProcess = false;
                    if (handlePreProcess && wordIndex > 0 && wordIndex <= lastWord) {
                        let newWords = outputWords.slice(0, wordIndex);
                        if (newWords[wordIndex - 1] === '(') newWords.pop();
                        if (newWords[wordIndex - 1] === '-') newWords.pop();
                        newWords.push('(');
                        newWords = newWords.concat(outputWords.slice(wordIndex, outputWords.length));
                        newWords.push(')');
                        outputWords = newWords;
                    }
                }
                return outputWords;
            },
            preProcessTitles(s) { return runFixes(s, PREPROCESS_FIXLIST); },
            runPostProcess(s) { return runFixes(s, POSTPROCESS_FIXLIST); },
            toLowerCase(s) { return s.toLowerCase(); },
            toUpperCase(s) { return s.toUpperCase(); },
        };
    }

    const MODES = {
        English(D) {
            return { ...D, name: 'English', isSentenceCaps() { return false; },
                runPostProcess(s) {
                    // keys as the English classical guidelines write them
                    return D.runPostProcess(s).replace(
                        /\bin ([a-g])(?:[\s-]([Ff]lat|[Ss]harp))?\s(dorian|lydian|major|minor|mixolydian)(?:\b|$)/ig,
                        (m, p1, p2, p3) => 'in ' + p1.toUpperCase() + (p2 ? '-' + p2.toLowerCase() : '') + ' ' + p3.toLowerCase());
                } };
        },
        French(D) {
            return { ...D, name: 'French',
                runPostProcess(s) {
                    return D.runPostProcess(s)
                        .replace(/([!?;:]+)/gi, ' $1')
                        .replace(/([«]+)/gi, '$1 ')
                        .replace(/([»]+)/gi, ' $1')
                        .replace(/^(Le\s|La\s|Les\s|L[’'])(\S+)$/gi, (_, m1, m2) => m1.replace('\'', '’') + capitalize(m2));
                } };
        },
        Sentence(D) { return { ...D, name: 'Sentence' }; },
        // Ours: sentence case under the language's name. Their own lowercase words would change
        // nothing: sentence case lowercases every word but the forced ones, and a forced word
        // skips the lowercase list.
        Spanish(D) { return { ...D, name: 'Spanish' }; },
        Italian(D) { return { ...D, name: 'Italian' }; },
        Portuguese(D) { return { ...D, name: 'Portuguese' }; },
        // Dutch capitalises the IJ digraph as one letter: IJsland, IJzer
        Dutch(D) { return { ...D, name: 'Dutch', runPostProcess(s) { return D.runPostProcess(s).replace(/(^|[^\p{L}\p{N}])Ij/gu, '$1IJ'); } }; },
        Turkish(D) {
            return { ...D, name: 'Turkish', isSentenceCaps() { return false; },
                isLowerCaseWord(w) { return LOWER_CASE_WORDS.test(w) || LOWER_CASE_WORDS_TURKISH.test(w); },
                toLowerCase(w) { return w.replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase(); },
                toUpperCase(w) { return w.replace(/i/g, 'İ').toUpperCase(); } };
        },
    };

    // ── utils/titleString.js ─────────────────────────────────────────────────────────────
    function titleString(input, output, inputString, mode, keepUpper, forceCaps) {
        if (empty(inputString)) return '';
        const flags = input.flags;
        const localForceCaps = forceCaps == null ? flags.context.forceCaps : forceCaps;
        const len = input.getLength();
        let pos = input.getCursorPosition();
        // past the last word: the run is done, we're looking at the last word again
        if (pos === len) { pos = len - 1; input.setCursorPosition(pos); }

        let outputString;
        let lowercase = mode.toLowerCase(inputString);
        let uppercase = mode.toUpperCase(inputString);

        if (inputString === uppercase && inputString.length > 1 && keepUpper) {
            outputString = uppercase;
        } else if (lowercase.length === 1 && isApostrophe(input.getPreviousWord())) {
            outputString = lowercase;                  // 'x
        } else if (mode.name === 'English' && isApostrophe(input.getPreviousWord()) && lowercase.match(/^(?:all|ve|ll|cha|re|mon)$/i)) {
            outputString = lowercase;                  // Y'all, They've, You'll, What'cha, You're, C'mon
        } else if (mode.name === 'English' && isApostrophe(input.getPreviousWord()) && input.getWordAtIndex(pos - 2) === 'Ev') {
            outputString = lowercase;                  // Ev'ry
        } else if (mode.name === 'English' && lowercase.match(/^[coy]$/i) && isApostrophe(input.getNextWord())) {
            outputString = uppercase;                  // O'Titled, Y'All, C'mon
        } else {
            outputString = titleStringByMode(input, output, mode, lowercase, localForceCaps);
            lowercase = mode.toLowerCase(outputString);
            uppercase = mode.toUpperCase(outputString);
            const nextWord = input.getNextWord();
            const followedByPunctuation = nonEmpty(nextWord) && nextWord.length === 1 && isPunctuationChar(nextWord);
            const followedByApostrophe = nonEmpty(nextWord) && nextWord.length === 1 && isApostrophe(nextWord);
            if (!localForceCaps && mode.isLowerCaseWord(lowercase) && !followedByPunctuation) {
                outputString = lowercase;
            } else if (mode.isRomanNumber(lowercase) && !followedByApostrophe && !(flags.isInsideBrackets() && isLowerCaseBracketWord(lowercase))) {
                outputString = uppercase;
            } else if (mode.isUpperCaseWord(lowercase)) {
                outputString = uppercase;
            } else if (flags.isInsideBrackets() && isLowerCaseBracketWord(lowercase)) {
                outputString = lowercase;
            }
        }
        return outputString;
    }

    function titleStringByMode(input, output, mode, inputString, forceCaps) {
        if (empty(inputString)) return '';
        const flags = input.flags;
        let outputString = mode.toLowerCase(inputString);
        const opos = output.getLength();
        let wordBefore = '';
        if (opos > 1) wordBefore = output.getWordAtIndex(opos - 2);
        const doCaps = forceCaps || !mode.isSentenceCaps() ||
            flags.context.slurpExtraTitleInformation || flags.context.openingBracket ||
            input.isFirstWord() || isSentenceStopChar(wordBefore);
        if (doCaps) {
            const chars = outputString.split('');
            chars[0] = mode.toUpperCase(chars[0]);
            if (inputString.length > 2 && inputString.substring(0, 2) === 'mc') chars[2] = mode.toUpperCase(chars[2]);   // McTitled
            outputString = chars.join('');
        }
        return outputString;
    }

    // ── MB/GuessCase/Input.js ────────────────────────────────────────────────────────────
    class Input {
        constructor(inputString, mode, keepUpper, regexes, flags) {
            this.keepUpper = keepUpper; this.mode = mode; this.regexes = regexes; this.flags = flags;
            this.source = inputString || ''; this.wordList = []; this.wordIndex = 0;
        }
        init(wordlist, output) { this.output = output; this.wordList = wordlist || []; }
        getLength() { return this.wordList.length; }
        isEmpty() { return this.getLength() === 0; }
        getCursorPosition() { return this.wordIndex; }
        setCursorPosition(i) { if (i >= 0 && i < this.getLength()) this.wordIndex = i; }
        getWordAtIndex(i) { return this.wordList[i] || null; }
        getNextWord() { return this.getWordAtIndex(this.wordIndex + 1); }
        getCurrentWord() { return this.getWordAtIndex(this.wordIndex); }
        getPreviousWord() { return this.getWordAtIndex(this.wordIndex - 1); }
        isFirstWord() { return this.wordIndex === 0; }
        isLastWord() { return this.getLength() === this.wordIndex - 1; }
        isNextWord(w) { return this.hasMoreWords() && this.getNextWord() === w; }
        isPreviousWord(w) { return !this.isFirstWord() && this.getPreviousWord() === w; }
        matchCurrentWord(re) { return this.matchWordAtIndex(this.getCursorPosition(), re); }
        matchWordAtIndex(i, re) {
            const word = this.getWordAtIndex(i) || '';
            return typeof re === 'string' ? re === word : word.match(re) != null;
        }
        hasMoreWords() { return (this.wordIndex === 0 && this.getLength() > 0) || (this.wordIndex - 1 < this.getLength()); }
        isIndexAtEnd() { return this.wordIndex === this.getLength(); }
        nextIndex() { this.wordIndex++; }
        dropLastWord() {
            if (this.getLength() > 0) { this.wordList.pop(); if (this.isIndexAtEnd()) this.wordIndex--; }
        }
        insertWordsAtIndex(i, newWords) {
            this.wordList = this.wordList.slice(0, i).concat(newWords).concat(this.wordList.slice(i));
        }
        capitalizeCurrentWord() {
            const word = this.getCurrentWord();
            if (word == null) return null;
            const out = titleString(this, this.output, word, this.mode, this.keepUpper);
            if (word !== out) this.updateCurrentWord(out);
            return out;
        }
        updateCurrentWord(w) { if (this.wordIndex < this.wordList.length) this.wordList[this.wordIndex] = w; }
        // words, punctuation and spaces of the input
        splitWordsAndPunctuation(inputString) {
            const input = inputString.replace(/^\s\s*/, '').replace(/\s\s*$/, '').replace(/\s\s*/g, ' ');
            const chars = input.split('');
            const splitwords = [];
            let word = [];
            if (!this.regexes.SPLITWORDSANDPUNCTUATION) this.regexes.SPLITWORDSANDPUNCTUATION = /[^!¿¡"%&'´`‘’‹›“”„“«»()[\]{}*+‐\-,./:;<=>?\s#]/;
            for (let i = 0; i < chars.length; i++) {
                if (chars[i].match(this.regexes.SPLITWORDSANDPUNCTUATION)) {
                    word.push(chars[i]);
                } else {
                    if (word.length > 0) splitwords.push(word.join(''));
                    splitwords.push(chars[i]);
                    word = [];
                }
            }
            if (word.length > 0) splitwords.push(word.join(''));
            return splitwords;
        }
    }

    // ── MB/GuessCase/Output.js ───────────────────────────────────────────────────────────
    class Output {
        constructor(input, mode, keepUpper, flags) {
            this.keepUpper = keepUpper; this.mode = mode; this.input = input; this.flags = flags; this.wordList = [];
        }
        getLength() { return this.wordList.length; }
        isEmpty() { return this.getLength() === 0; }
        appendCurrentWord() { const w = this.input.getCurrentWord(); if (w != null) this.appendWord(w); }
        appendWord(w) { if (w === ' ') this.appendSpace(); else if (w !== '' && w != null) this.wordList.push(w); }
        appendSpace() { this.wordList.push(' '); }
        appendSpaceIfNeeded() { if (this.flags.context.spaceNextWord) this.appendSpace(); }
        getWordAtIndex(i) { return this.wordList[i] ? this.wordList[i] : null; }
        setWordAtIndex(i, w) { if (this.getWordAtIndex(i)) this.wordList[i] = w; }
        getLastWord() { return this.isEmpty() ? null : this.wordList[this.wordList.length - 1]; }
        capitalizeWordAtIndex(index, overrideCaps) {
            const flags = this.flags;
            const forceCaps = overrideCaps == null ? flags.context.forceCaps : overrideCaps;
            if ((!this.mode.isSentenceCaps() || forceCaps) && !this.isEmpty()) {
                const word = this.getWordAtIndex(index);
                if (word != null) {
                    let output = word;
                    if (word.match(/^\w\..*/) == null) {           // not an acronym
                        const probe = trim(word.toLowerCase());
                        if (!forceCaps && flags.isInsideBrackets() && isLowerCaseBracketWord(probe)) {
                            // inside brackets: leave it
                        } else if (!forceCaps && this.mode.isUpperCaseWord(probe)) {
                            // an UPPERCASE word: leave it
                        } else {
                            const originalPosition = this.input.getCursorPosition();
                            let position = originalPosition - 1;
                            while (position >= 0) {
                                const w = this.input.getWordAtIndex(position);
                                if (w == null || trim(w.toLowerCase()) === probe) break;
                                position--;
                            }
                            this.input.setCursorPosition(position);
                            output = titleString(this.input, this, word, this.mode, this.keepUpper, forceCaps);
                            this.input.setCursorPosition(originalPosition);
                            if (word !== output) this.setWordAtIndex(index, output);
                        }
                    }
                }
            }
        }
        capitalizeLastWord(overrideCaps) { this.capitalizeWordAtIndex(this.getLength() - 1, overrideCaps); }
        getOutput() {
            this.flags.context.forceCaps = !this.mode.isSentenceCaps();   // not sentence mode: caps on the last word
            this.capitalizeLastWord();
            this.closeOpenBrackets();
            return trim(this.wordList.join(''));
        }
        closeOpenBrackets() {
            const parts = [];
            while (this.flags.isInsideBrackets()) parts[parts.length] = this.flags.popBracket();
            this.appendWord(parts.join(''));
        }
        appendWordPreserveWhiteSpace(capitalizeLast) {
            const ws = { after: this.input.isNextWord(' '), before: this.input.isPreviousWord(' ') };
            if (capitalizeLast) this.capitalizeLastWord(!this.mode.isSentenceCaps());
            if (ws.before) this.appendSpace();
            this.appendCurrentWord();
            this.flags.context.spaceNextWord = ws.after;
        }
    }

    // ── MB/GuessCase/Handler/Base.js ─────────────────────────────────────────────────────
    const SPECIAL = {
        NOT_A_SPECIALCASE: -1, SPECIALCASE_CROWD_NOISE: 33, SPECIALCASE_DATA_TRACK: 30, SPECIALCASE_DIALOGUE: 35,
        SPECIALCASE_GUITAR_SOLO: 34, SPECIALCASE_SILENCE: 31, SPECIALCASE_UNKNOWN: 10, SPECIALCASE_UNTITLED: 32,
    };

    class Handler {
        constructor(mode, regexes, input, output, flags) {
            this.mode = mode; this.regexes = regexes; this.input = input; this.output = output; this.flags = flags;
            this.specialCaseValues = SPECIAL;
        }
        checkSpecialCase() { return SPECIAL.NOT_A_SPECIALCASE; }
        isSpecialCase(n) { return n !== SPECIAL.NOT_A_SPECIALCASE; }
        getSpecialCaseFormatted(inputString, n) {
            switch (n) {
                case SPECIAL.SPECIALCASE_DATA_TRACK: return '[data track]';
                case SPECIAL.SPECIALCASE_SILENCE: return '[silence]';
                case SPECIAL.SPECIALCASE_UNTITLED: return '[untitled]';
                case SPECIAL.SPECIALCASE_UNKNOWN: return '[unknown]';
                case SPECIAL.SPECIALCASE_CROWD_NOISE: return '[crowd noise]';
                case SPECIAL.SPECIALCASE_GUITAR_SOLO: return '[guitar solo]';
                case SPECIAL.SPECIALCASE_DIALOGUE: return '[dialogue]';
                default: return inputString;
            }
        }
        getWordsForProcessing(s) { return this.input.splitWordsAndPunctuation(s); }
        process(s) {
            this.input.init(this.getWordsForProcessing(s), this.output);
            while (!this.input.isIndexAtEnd()) this.processWord();
            return this.mode.runPostProcess(this.output.getOutput());
        }
        processWord() {
            if (!this.doWhiteSpace()) {
                let handled = false;
                if (!this.regexes.SPECIALCASES) this.regexes.SPECIALCASES = /(&|¿|¡|\?|!|;|:|'|‘|’|‹|›|"|“|”|„|“|«|»|-|‐|\+|,|\*|\.|#|%|\/|\(|\)|\{|\}|\[|\])/;
                if (this.input.matchCurrentWord(this.regexes.SPECIALCASES)) {
                    handled = this.doDoubleQuote() || this.doSingleQuote() || this.doOpeningBracket() ||
                        this.doClosingBracket() || this.doComma() || this.doPeriod() || this.doLineStop() ||
                        this.doAmpersand() || this.doSlash() || this.doColon() || this.doHyphen() ||
                        this.doInvertedMarks() || this.doPlus() || this.doAsterisk() || this.doDiamond() || this.doPercent();
                }
                handled || this.doDigits() || this.doAcronym() || this.doWord();
            }
            this.input.nextIndex();
        }
        doWord() { return true; }
        doNormalWord() {
            const c = this.flags.context;
            this.output.appendSpaceIfNeeded();
            this.input.capitalizeCurrentWord();
            this.output.appendCurrentWord();
            this.flags.resetContext();
            c.forceCaps = false;
            c.spaceNextWord = true;
        }
        doWhiteSpace() {
            if (!this.regexes.WHITESPACE) this.regexes.WHITESPACE = /^ $/;
            if (this.input.matchCurrentWord(this.regexes.WHITESPACE)) {
                const c = this.flags.context;
                c.whitespace = true;
                c.spaceNextWord = true;
                if (c.openingBracket) c.spaceNextWord = false;
                return true;
            }
            return false;
        }
        // a sub-title split, also disc/box name splits
        doColon() {
            if (!this.regexes.COLON) this.regexes.COLON = /^:$/;
            if (this.input.matchCurrentWord(this.regexes.COLON)) {
                const c = this.flags.context;
                const featIndex = this.output.getLength() - 3;
                const role = this.output.getLastWord();
                if (c.slurpExtraTitleInformation && featIndex > 0 && this.output.getWordAtIndex(featIndex) === 'feat.' && nonEmpty(role)) {
                    this.output.setWordAtIndex(this.output.getLength() - 1, role.toLowerCase());
                } else {
                    this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
                }
                let skip = false;
                const cursorPosition = this.input.getCursorPosition();
                const length = this.input.getLength();
                if (cursorPosition < length - 2) {
                    const nextWord = this.input.getWordAtIndex(cursorPosition + 1);
                    const afterNextWord = this.input.getWordAtIndex(cursorPosition + 2);
                    // OPENBRACKET is set: doOpeningBracket ran before doColon for this word
                    if (nextWord != null && nextWord.match(this.regexes.OPENBRACKET)) { skip = true; c.spaceNextWord = true; }
                    if (this.input.isNextWord(' ') && afterNextWord != null && afterNextWord.match(this.regexes.OPENBRACKET)) {
                        c.spaceNextWord = true;
                        skip = true;
                        this.input.nextIndex();
                    }
                }
                if (!skip) {
                    this.output.appendCurrentWord();
                    this.flags.resetContext();
                    c.forceCaps = true;
                    c.colon = true;
                    c.spaceNextWord = this.input.isNextWord(' ');
                }
                return true;
            }
            return false;
        }
        doPreserving(name, re) {
            if (!this.regexes[name]) this.regexes[name] = re;
            if (this.input.matchCurrentWord(this.regexes[name])) {
                this.output.appendWordPreserveWhiteSpace(true);
                this.flags.resetContext();
                return true;
            }
            return false;
        }
        doAsterisk() { return this.doPreserving('ASTERISK', /^\*$/); }
        doDiamond() { return this.doPreserving('DIAMOND', /^#$/); }
        doPercent() { return this.doPreserving('PERCENT', /^%$/); }
        doPlus() { return this.doPreserving('PLUS', /^\+$/); }
        doAmpersand() {
            if (!this.regexes.AMPERSAND) this.regexes.AMPERSAND = /^&$/;
            if (this.input.matchCurrentWord(this.regexes.AMPERSAND)) {
                this.flags.resetContext();
                this.flags.context.forceCaps = true;
                this.output.appendSpace();
                this.flags.context.spaceNextWord = true;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        // ? ! ;
        doLineStop() {
            if (!this.regexes.LINESTOP) this.regexes.LINESTOP = /[?!;]/;
            if (this.input.matchCurrentWord(this.regexes.LINESTOP)) {
                this.flags.resetContext();
                this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
                this.flags.context.forceCaps = true;
                this.flags.context.spaceNextWord = true;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        // a spaced hyphen is a pause, an unspaced one part of a word
        doHyphen() {
            if (!this.regexes.HYPHEN) this.regexes.HYPHEN = /^[-‐]$/;
            if (this.input.matchCurrentWord(this.regexes.HYPHEN)) {
                this.output.appendWordPreserveWhiteSpace(true);
                this.flags.resetContext();
                this.flags.context.forceCaps = !this.mode.isSentenceCaps();
                this.flags.context.hyphen = true;
                return true;
            }
            return false;
        }
        doInvertedMarks() {
            if (!this.regexes.INVERTEDMARKS) this.regexes.INVERTEDMARKS = /(¿|¡)/;
            if (this.input.matchCurrentWord(this.regexes.INVERTEDMARKS)) {
                this.output.appendWordPreserveWhiteSpace(false);
                this.flags.resetContext();
                this.flags.context.forceCaps = true;
                return true;
            }
            return false;
        }
        doSlash() {
            if (!this.regexes.SLASH) this.regexes.SLASH = /[\\/]/;
            if (this.input.matchCurrentWord(this.regexes.SLASH)) {
                this.output.appendWordPreserveWhiteSpace(true);
                this.flags.resetContext();
                this.flags.context.forceCaps = true;
                return true;
            }
            return false;
        }
        doDoubleQuote() {
            if (!this.regexes.DOUBLEQUOTE) this.regexes.DOUBLEQUOTE = /["“”„“«»]/;
            if (this.input.matchCurrentWord(this.regexes.DOUBLEQUOTE)) {
                this.output.appendWordPreserveWhiteSpace(false);
                this.flags.resetContext();
                this.flags.context.forceCaps = !this.input.isNextWord(' ');
                return true;
            }
            return false;
        }
        doSingleQuote() {
            if (!this.regexes.SINGLEQUOTE) this.regexes.SINGLEQUOTE = /['‘’‹›]/;
            if (this.input.matchCurrentWord(this.regexes.SINGLEQUOTE)) {
                const c = this.flags.context;
                c.forceCaps = false;
                const isPreviousSpace = this.input.isPreviousWord(' ');
                const isNextSpace = this.input.isNextWord(' ');
                const state = c.openedSingleQuote;
                if (isPreviousSpace && !isNextSpace) {             // "Asdf 'Text in Quotes'"
                    this.output.appendSpace();
                    c.openedSingleQuote = true;
                    c.forceCaps = true;
                } else if (!isPreviousSpace && isNextSpace) {      // closing
                    if (state) { c.forceCaps = true; c.openedSingleQuote = false; }
                    this.output.capitalizeLastWord();
                }
                c.spaceNextWord = isNextSpace;
                this.output.appendCurrentWord();
                this.flags.resetContext();
                if (state === c.openedSingleQuote) c.forceCaps = false;   // "Rollin' on"
                c.singlequote = true;
                return true;
            }
            return false;
        }
        doOpeningBracket() {
            if (!this.regexes.OPENBRACKET) this.regexes.OPENBRACKET = /[([{<]/;
            const currentWord = this.input.getCurrentWord();
            if (currentWord != null && currentWord.match(this.regexes.OPENBRACKET)) {
                const c = this.flags.context;
                this.output.capitalizeLastWord(!this.mode.isSentenceCaps());
                this.flags.pushBracket(currentWord);
                const closingBracket = this.flags.getCurrentCloseBracket();
                let forcelowercase = false;
                const cursorPosition = this.input.getCursorPosition() + 1;
                for (let i = cursorPosition; i < this.input.getLength(); i++) {
                    const word = this.input.getWordAtIndex(i) || '';
                    if (word !== ' ') {
                        if (isLowerCaseBracketWord(word) || word.match(/^featuring$|^ft$|^feat$/i) != null) {
                            c.slurpExtraTitleInformation = true;
                            if (i === cursorPosition) forcelowercase = true;
                        }
                        if (word === closingBracket) break;
                    }
                }
                this.output.appendSpace();
                this.flags.resetContext();
                c.spaceNextWord = false;
                c.openingBracket = true;
                c.forceCaps = !forcelowercase;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        doClosingBracket() {
            if (!this.regexes.CLOSEBRACKET) this.regexes.CLOSEBRACKET = /[)\]}>]/;
            if (this.input.matchCurrentWord(this.regexes.CLOSEBRACKET)) {
                const c = this.flags.context;
                this.output.capitalizeLastWord();
                if (this.flags.isInsideBrackets()) { this.flags.popBracket(); c.slurpExtraTitleInformation = false; }
                this.flags.resetContext();
                c.forceCaps = !this.mode.isSentenceCaps();
                c.spaceNextWord = true;
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        doComma() {
            if (!this.regexes.COMMA) this.regexes.COMMA = /^,$/;
            if (this.input.matchCurrentWord(this.regexes.COMMA)) {
                if (this.output.getLastWord() !== ',') {           // skip duplicate commas
                    this.flags.resetContext();
                    this.flags.context.spaceNextWord = true;
                    this.flags.context.forceCaps = false;
                    this.output.appendCurrentWord();
                }
                return true;
            }
            return false;
        }
        // a full stop, a number split, an ellipsis or an acronym
        doPeriod() {
            if (!this.regexes.PERIOD) this.regexes.PERIOD = /^\.$/;
            if (this.input.matchCurrentWord(this.regexes.PERIOD)) {
                const c = this.flags.context;
                if (this.output.getLastWord() === '.') {
                    if (!c.ellipsis) {
                        this.output.appendWord('..');
                        while (this.input.isNextWord('.')) this.input.nextIndex();
                        this.flags.resetContext();
                        c.ellipsis = true;
                    }
                    c.forceCaps = true;
                    c.spaceNextWord = true;
                } else {
                    if (!this.input.hasMoreWords() || this.input.getNextWord() !== '.') this.output.capitalizeLastWord();
                    this.output.appendWord('.');
                    this.flags.resetContext();
                    c.forceCaps = true;
                    c.spaceNextWord = this.input.isNextWord(' ');
                }
                return true;
            }
            return false;
        }
        // "A. B. C. I Love You" => "A.B.C. I Love You"
        doAcronym() {
            if (!this.regexes.ACRONYM) this.regexes.ACRONYM = /^\w$/;
            let subIndex = this.input.getCursorPosition() + 1;
            const tmp = [];
            const currentWord = this.input.getCurrentWord();
            if (currentWord != null && currentWord.match(this.regexes.ACRONYM)) {
                tmp.push(currentWord.toUpperCase());
                let expectWord = false;
                let gotPeriod = false;
                for (; subIndex < this.input.getLength();) {
                    const wordAtIndex = this.input.getWordAtIndex(subIndex);
                    if (expectWord && wordAtIndex != null && wordAtIndex.match(this.regexes.ACRONYM)) {
                        tmp.push(wordAtIndex.toUpperCase());
                        expectWord = false;
                        gotPeriod = false;
                    } else {
                        if (wordAtIndex === '.' && !gotPeriod) {
                            tmp[tmp.length] = '.';
                            gotPeriod = true;
                            expectWord = true;
                        } else if (gotPeriod && wordAtIndex === ' ') {
                            expectWord = true;
                        } else if (tmp[tmp.length - 1] !== '.') {
                            tmp.pop();
                            subIndex--;
                        }
                        break;
                    }
                    subIndex++;
                }
            }
            if (tmp.length > 2) {
                const string = tmp.join('').replace(/(\.)*$/, '.');
                const c = this.flags.context;
                this.output.appendSpaceIfNeeded();
                this.output.appendWord(string);
                this.flags.resetContext();
                c.acronym = true;
                c.spaceNextWord = true;
                c.forceCaps = false;
                this.input.setCursorPosition(subIndex - 1);
                return true;
            }
            return false;
        }
        doDigits() {
            if (!this.regexes.DIGITS) {
                this.regexes.DIGITS = /^\d+$/;
                this.regexes.DIGITS_NUMBERSPLIT = /[,.]/;
                this.regexes.DIGITS_DUPLE = /^\d\d$/;
                this.regexes.DIGITS_TRIPLE = /^\d\d\d$/;
                this.regexes.DIGITS_NTUPLE = /^\d\d\d\d+$/;
            }
            const c = this.flags.context;
            let subIndex = this.input.getCursorPosition() + 1;
            const tmp = [];
            if (this.input.matchCurrentWord(this.regexes.DIGITS)) {
                tmp.push(this.input.getCurrentWord());
                c.numberSplitExpect = true;
                for (; subIndex < this.input.getLength();) {
                    if (c.numberSplitExpect) {
                        if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_NUMBERSPLIT)) {
                            tmp.push(this.input.getWordAtIndex(subIndex));
                            c.numberSplitExpect = false;
                        } else {
                            break;
                        }
                    } else if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_TRIPLE)) {
                        if (c.numberSplitChar == null) c.numberSplitChar = tmp[tmp.length - 1];
                        tmp.push(this.input.getWordAtIndex(subIndex));
                        c.numberSplitExpect = true;
                    } else {
                        if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_DUPLE)) {
                            if (tmp.length > 2 && c.numberSplitChar !== tmp[tmp.length - 1]) {
                                tmp.push(this.input.getWordAtIndex(subIndex++));   // 1,000,936.00 or 1.300.402,00
                            } else {
                                tmp.pop();
                                subIndex--;
                            }
                        } else if (this.input.matchWordAtIndex(subIndex, this.regexes.DIGITS_NTUPLE)) {
                            tmp.push(this.input.getWordAtIndex(subIndex++));
                        } else {
                            tmp.pop();
                            subIndex--;
                        }
                        break;
                    }
                    subIndex++;
                }
                this.input.setCursorPosition(subIndex - 1);
                this.output.appendSpaceIfNeeded();
                this.output.appendWord(tmp.join(''));
                this.flags.resetContext();
                c.forceCaps = false;
                c.number = true;
                return true;
            }
            return false;
        }
        doIgnoreWords() {
            if (this.input.getCurrentWord() === 'dB') {        // deciBel
                this.output.appendSpaceIfNeeded();
                this.output.appendCurrentWord();
                return true;
            }
            return false;
        }
        // featuring, f., ft[.], feat[.] → (feat. …)
        doFeaturingArtistStyle() {
            if (!this.regexes.FEAT) {
                this.regexes.FEAT = /^featuring$|^f$|^ft$|^feat$/i;
                this.regexes.FEAT_F = /^f$/i;
                this.regexes.FEAT_FEAT = /^feat$/i;
            }
            const flags = this.flags, c = flags.context;
            const currentWord = this.input.getCurrentWord();
            if (currentWord == null) return false;
            if (currentWord.match(this.regexes.FEAT)) {
                const nextWord = this.input.getNextWord();
                if (currentWord.match(this.regexes.FEAT_F) && nextWord != null && !nextWord.match(/^[/.]$/)) return false;
                if (this.input.getCursorPosition() < this.input.getLength() - 2) {
                    const nw = this.input.getNextWord();
                    const featWord = currentWord + (nw != null && (nw === '.' || nw === '/')
                        ? nw
                        : currentWord.match(this.regexes.FEAT_FEAT) ? '.' : '');
                    if (!c.openingBracket && !flags.isInsideBrackets()) {
                        if (flags.isInsideBrackets()) {
                            while (flags.isInsideBrackets()) {
                                const cb = flags.popBracket();
                                this.output.appendWord(cb);
                                if (this.input.getWordAtIndex(this.input.getLength() - 1) === cb) this.input.dropLastWord();
                            }
                        }
                        // "Blah ft. Erroll Flynn Some Remixname (remix)" → "Blah (feat. Erroll Flynn Some Remixname) (remix)"
                        const cursorPosition = this.input.getCursorPosition();
                        const length = this.input.getLength();
                        let i = cursorPosition;
                        for (; i < length; i++) if (this.input.getWordAtIndex(i) === '(') break;
                        if (i !== cursorPosition && i < length - 1) this.input.insertWordsAtIndex(i, [')', ' ']);
                        this.input.updateCurrentWord('(');
                        this.doOpeningBracket();
                    } else {
                        this.output.appendWord(' ');
                    }
                    this.output.appendWord(featWord);
                    flags.resetContext();
                    c.forceCaps = true;
                    c.openingBracket = false;
                    c.spaceNextWord = true;
                    c.slurpExtraTitleInformation = true;
                    if (this.input.isNextWord('.') || this.input.isNextWord('/')) this.input.nextIndex();
                    return true;
                }
            }
            return false;
        }
        moveArticleToEnd(s) { return trim(s).replace(/^(The|Los) (.+)$/, (m, article, name) => name + ', ' + article); }
        sortCompoundName(s, callback) {
            const t = trim(s);
            let joinPhrase = ' and ';
            joinPhrase = t.indexOf(' + ') === -1 ? joinPhrase : ' + ';
            joinPhrase = t.indexOf(' & ') === -1 ? joinPhrase : ' & ';
            return t.split(joinPhrase).map(x => callback(x, this.regexes)).join(joinPhrase);
        }
        // the word handling the track, release, work and area handlers share
        doTitleWord(ignoreWords, featuring) {
            (ignoreWords && this.doIgnoreWords()) ||
                (featuring && this.doFeaturingArtistStyle()) ||
                this.mode.doWord() ||
                this.doNormalWord();
            this.flags.context.number = false;
            return true;
        }
        doNameWord() {
            const c = this.flags.context;
            this.output.appendSpaceIfNeeded();
            this.input.capitalizeCurrentWord();
            this.output.appendCurrentWord();
            this.flags.resetContext();
            c.number = false;
            c.forceCaps = false;
            c.spaceNextWord = true;
            return true;
        }
    }

    // ── MB/GuessCase/Handler/*.js ────────────────────────────────────────────────────────
    const UNTITLED = /^([([]?\s*untitled\s*[)\]]?)$/i;

    class TrackHandler extends Handler {
        removeBonusInfo(s) {
            return s.replace(/[([]?bonus(\s+track)?s?\s*[)\]]?$/i, '').replace(/[([]?retail(\s+version)?\s*[)\]]?$/i, '');
        }
        process(s) { return this.mode.fixVinylSizes(super.process(s)); }
        getWordsForProcessing(s) {
            return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(this.removeBonusInfo(s))));
        }
        checkSpecialCase(s) {
            if (s != null) {
                if (/^([([]?\s*data(\s+track)?\s*[)\]]?$)/i.test(s)) return SPECIAL.SPECIALCASE_DATA_TRACK;
                if (/^([([]?\s*(silen(t|ce)|blank)(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL.SPECIALCASE_SILENCE;
                if (/^([([]?\s*untitled(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL.SPECIALCASE_UNTITLED;
                if (/^([([]?\s*(unknown|bonus|hidden)(\s+track)?\s*[)\]]?)$/i.test(s)) return SPECIAL.SPECIALCASE_UNKNOWN;
                if (/^\?+$/i.test(s)) return SPECIAL.SPECIALCASE_UNKNOWN;
            }
            return SPECIAL.NOT_A_SPECIALCASE;
        }
        doWord() {
            const c = this.flags.context;
            if (!this.doIgnoreWords() && !this.doFeaturingArtistStyle() && !this.mode.doWord()) {
                if (this.input.matchCurrentWord(/7in/i)) {
                    this.output.appendSpaceIfNeeded();
                    this.output.appendWord('7"');
                    this.flags.resetContext();
                    c.spaceNextWord = false;
                    c.forceCaps = false;
                } else if (this.input.matchCurrentWord(/12in/i)) {
                    this.output.appendSpaceIfNeeded();
                    this.output.appendWord('12"');
                    this.flags.resetContext();
                    c.spaceNextWord = false;
                    c.forceCaps = false;
                } else {
                    this.output.appendSpaceIfNeeded();
                    this.input.capitalizeCurrentWord();
                    this.output.appendCurrentWord();
                    this.flags.resetContext();
                    c.spaceNextWord = true;
                    c.forceCaps = false;
                }
            }
            c.number = false;
            return true;
        }
        guessSortName(s) { return this.moveArticleToEnd(s); }
    }

    class ReleaseHandler extends Handler {
        checkSpecialCase(s) { return s != null && UNTITLED.test(s) ? SPECIAL.SPECIALCASE_UNTITLED : SPECIAL.NOT_A_SPECIALCASE; }
        process(s) { return this.mode.fixVinylSizes(super.process(s)); }
        getWordsForProcessing(s) { return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(s))); }
        doWord() { return this.doTitleWord(false, true); }
        guessSortName(s) { return this.moveArticleToEnd(s); }
    }

    class WorkHandler extends Handler {
        checkSpecialCase(s) { return s != null && UNTITLED.test(s) ? SPECIAL.SPECIALCASE_UNTITLED : SPECIAL.NOT_A_SPECIALCASE; }
        getWordsForProcessing(s) { return this.mode.prepExtraTitleInfo(this.input.splitWordsAndPunctuation(this.mode.preProcessTitles(s))); }
        doWord() { return this.doTitleWord(true, true); }
        guessSortName(s) { return this.moveArticleToEnd(s); }
    }

    // unknown, none, no artist / no label, not applicable, n/a → [unknown]
    function noneCase(s, what) {
        if (s == null) return SPECIAL.NOT_A_SPECIALCASE;
        const res = [/^\s*$/i, /^[([]?\s*Unknown\s*[)\]]?$/i, /^[([]?\s*none\s*[)\]]?$/i,
            new RegExp('^[([]?\\s*no[\\s-]+' + what + '\\s*[)\\]]?$', 'i'),
            /^[([]?\s*not[\s-]+applicable\s*[)\]]?$/i, /^[([]?\s*n\s*[\\/]\s*a\s*[)\]]?$/i];
        return res.some(re => re.test(s)) ? SPECIAL.SPECIALCASE_UNKNOWN : SPECIAL.NOT_A_SPECIALCASE;
    }

    class ArtistHandler extends Handler {
        checkSpecialCase(s) { return noneCase(s, 'artist'); }
        doWord() { return this.doNameWord(); }
        guessSortName(s, isPerson) {
            return this.sortCompoundName(s, artistName => {
                if (!artistName) return '';
                let name = trim(artistName);
                let append = '';
                if (/,\s*Sr\.?$/i.test(name)) { name = name.replace(/,\s*Sr\.?$/i, ''); append = ', Sr.'; }
                else if (/,\s*Jr\.?$/i.test(name)) { name = name.replace(/,\s*Jr\.?$/i, ''); append = ', Jr.'; }
                let names = name.split(' ');
                let reorder = false;
                const firstName = names[0];
                if (/^DJ$/i.test(firstName)) { append = ', DJ' + append; names.shift(); }
                else if (/^The$/i.test(firstName)) { append = ', The' + append; names.shift(); }
                else if (/^Los$/i.test(firstName)) { append = ', Los' + append; names.shift(); }
                else if (/^Dr\.$/i.test(firstName)) { append = ', Dr.' + append; names.shift(); reorder = true; }
                else reorder = true;
                if (!isPerson) reorder = false;       // only persons are reordered
                if (reorder) {
                    const reordered = [];
                    if (names.length > 1) {
                        for (let i = 0; i < names.length - 1; i++) {
                            if (i === names.length - 2 && names[i] === 'St.') names[i + 1] = names[i] + ' ' + names[i + 1];   // St. belongs to the last name
                            else if (names[i]) reordered[i + 1] = names[i];
                        }
                        reordered[0] = names[names.length - 1];
                        if (reordered.length > 1) reordered[0] += ',';
                        names = reordered;
                    }
                }
                return trim(names.filter(Boolean).join(' ') + (append || ''));
            });
        }
    }

    class LabelHandler extends Handler {
        checkSpecialCase(s) { return noneCase(s, 'label'); }
        doWord() { return this.doNameWord(); }
        guessSortName(s) { return this.sortCompoundName(s, x => this.moveArticleToEnd(x)); }
    }

    class AreaHandler extends Handler {
        doWord() { return this.doTitleWord(true, true); }
        guessSortName(s) { return trim(s); }
    }

    class PlaceHandler extends Handler {
        doWord() { return this.doTitleWord(true, false); }
        guessSortName(s) { return this.sortCompoundName(s, x => this.moveArticleToEnd(x)); }
    }

    const HANDLERS = {
        area: AreaHandler, artist: ArtistHandler, event: WorkHandler, label: LabelHandler, place: PlaceHandler,
        recording: TrackHandler, release: ReleaseHandler, release_group: ReleaseHandler, series: WorkHandler,
        track: TrackHandler, work: WorkHandler,
    };

    // ── MB/GuessCase/Main.js, with options in place of cookies ──────────────────────────
    const MODE_NAMES = Object.keys(MODES);
    const LANGUAGE_MODES = { eng: 'English', fra: 'French', tur: 'Turkish', spa: 'Spanish', ita: 'Italian', por: 'Portuguese', nld: 'Dutch' };
    // MusicBrainz's language ids (its language table, the editors' select values) for those
    const LANGUAGE_IDS = { 113: 'nld', 120: 'eng', 134: 'fra', 195: 'ita', 340: 'por', 393: 'spa', 433: 'tur' };

    /** The mode for a language, as ISO 639-3 or MusicBrainz's language id: the language's own
     *  mode when there is one, Sentence for any other (German too: its nouns can't be guessed),
     *  English when none is given, as MusicBrainz's default. */
    function modeFor(language) {
        if (language == null || language === '') return 'English';
        const code = /^\d+$/.test(String(language)) ? LANGUAGE_IDS[language] : String(language).toLowerCase();
        return LANGUAGE_MODES[code] || 'Sentence';
    }

    // ── Ours, on top of MusicBrainz's result (`extras: false` leaves them out) ──────────
    // Version words MusicBrainz misses, lowercased inside brackets (from chaban's Guess Case Improver).
    const VERSION_PHRASES = ['official lyric video', 'official music video', 'official video', 'official visualizer',
        'official visualiser', 'official audio', 'kinetic lyric video', 'lyric video', 'lyrics video', 'music video',
        'backing track', 'animated', 'animation', 'super slowed', 'extra slowed', 'ultra slowed', 'slowed down',
        'slowed', 'super sped up', 'sped up', 'super speed up', 'speed up', 'low pitched', 'reverb', 'nightcore',
        'bootleg', 'mashup', 'flip'];
    // a whole word or phrase: no letter or digit either side
    const wholeWord = (alternatives, flags) => new RegExp(String.raw`(?<![\p{L}\p{N}])(` + alternatives + String.raw`)(?![\p{L}\p{N}])`, flags);
    const VERSION_RE = wholeWord(VERSION_PHRASES.join('|'), 'giu');
    const TITLE_ENTITIES = new Set(['track', 'recording', 'release', 'release_group', 'work']);

    function versionWords(out, keepUpper) {
        return out.replace(/([([［（【])([^()[\]［］（）【】]*)([)\]］）】])/g, (m, open, inner, close) =>
            open + inner.replace(VERSION_RE, w => (keepUpper && w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase()) ? w : w.toLowerCase()) + close);
    }

    // A word written with a capital inside it (KoRn, JoJo, DeBarge, OutKast) keeps it.
    function camelCase(out, source) {
        const words = source.match(/[\p{L}\p{N}]+/gu) || [];
        for (const w of new Set(words.filter(x => /\p{Ll}\p{Lu}/u.test(x)))) out = out.replace(wholeWord(escapeRegExp(w), 'giu'), w);
        return out;
    }

    function run(method, s, o) {
        o = o || {};
        const entity = o.entity || 'track';
        if (entity === 'genre' || entity === 'instrument') return String(s).toLowerCase();   // MusicBrainz lowercases them, sort name too
        const H = HANDLERS[entity];
        if (!H) throw new Error('mbuGuessCase: unknown entity ' + entity);
        const modeName = o.mode && MODES[o.mode] ? o.mode : modeFor(o.language);
        const mode = MODES[modeName](makeDefaultMode(o));
        const keepUpper = o.keepUpperCase !== false;          // MusicBrainz's default: keep
        const flags = new Flags();
        const regexes = { SERIES_NUMBER: /^(\d+|[ivx]+)$/i, SPACES_DOTS: /\s|\./i };
        const input = new Input(s, mode, keepUpper, regexes, flags);
        const output = new Output(input, mode, keepUpper, flags);
        const handler = new H(mode, regexes, input, output, flags);
        const num = handler.checkSpecialCase(s);
        if (handler.isSpecialCase(num)) return handler.getSpecialCaseFormatted(s, num);
        if (method === 'guessSortName') return handler.guessSortName(s, !!o.isPerson);
        let out = handler.process(s);
        if (o.extras !== false && TITLE_ENTITIES.has(entity)) {
            out = versionWords(out, keepUpper);
            if (keepUpper) out = camelCase(out, s);
        }
        return out;
    }

    // Per title, with the mode left to the language (#804). A title written mostly in a cased script other
    // than Latin (Cyrillic, Greek, Armenian) gets Sentence whatever the language (the guidelines' rule for
    // Cyrillic; a release in English, in several languages or in none would capitalise every word). A Latin
    // one gets the mode of the language `detect` names for it, if given and it names one; else the
    // language's. A title whose parts, split by the separator ('/' by default), differ has each part
    // guessed on its own. Scripts without case have nothing to guess.
    const count = (s, re) => (s.match(re) || []).length;
    const isCasedOther = s => count(s, /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}]/gu) > count(s, /\p{Script=Latin}/gu);
    function partMode(p, o) {
        if (isCasedOther(p)) return 'Sentence';
        if (typeof o.detect !== 'function' || !/\p{Script=Latin}/u.test(p)) return null;
        let lang = null;
        try { lang = o.detect(p); } catch (e) { /* no detection: the language's mode */ }
        return lang ? modeFor(lang) : null;
    }
    function byScript(s, o) {
        const sep = o.separator == null ? '/' : String(o.separator);
        const parts = sep.trim() ? s.split(new RegExp(String.raw`(\s*` + escapeRegExp(sep.trim()) + String.raw`\s*)`)) : [s];
        const modes = parts.map((p, i) => (i % 2 ? null : partMode(p, o)));
        const opts = m => (m ? Object.assign({}, o, { mode: m }) : o);
        const texts = modes.filter((m, i) => i % 2 === 0);
        if (texts.every(m => m === texts[0])) return run('process', s, opts(texts[0]));
        return parts.map((p, i) => (i % 2 ? p : run('process', p, opts(modes[i])))).join('');
    }

    /** A title in MusicBrainz's guess case. Options: entity ('track' default, 'release',
     *  'release_group', 'recording', 'work', 'artist', 'label', 'area', 'place', 'event',
     *  'series', 'genre', 'instrument'), mode or language, keepUpperCase (true), romanUpper
     *  (false), extras (true: our rules on top; false gives exactly MusicBrainz's result),
     *  byScript (true: with no mode, Cyrillic, Greek and Armenian get Sentence), detect (a function
     *  giving a Latin title's language, or null, for byScript) and separator ('/': a title's parts). */
    function guessCase(title, opts) {
        const s = String(title == null ? '' : title), o = opts || {};
        if (!(o.mode && MODES[o.mode]) && o.byScript !== false && o.extras !== false && TITLE_ENTITIES.has(o.entity || 'track')) return byScript(s, o);
        return run('process', s, o);
    }
    guessCase.sortName = (name, opts) => run('guessSortName', String(name == null ? '' : name), opts);
    guessCase.modeFor = modeFor;
    guessCase.modes = MODE_NAMES;
    return guessCase;
})();
// </ST-GUESSCASE>
const CC = {
    token: null, src: null, error: null, run: 'c' + Date.now().toString(36),
    pc: { state: 'wait', note: '', findings: [], at: 0 },
    sources: [],          // { key, url, barcode, tracks, format, mismatch, why, role: 'source' | 'found', take, read: { state, rel, provider, error, n, total, ms, at } }
    pick: {},             // field → the value taken by hand
    rowPick: {},          // row id → the platform whose version is taken by hand
    extraTake: {},        // extra row id → taken in
    closed: new Set(['others']),   // the sections closed: same, others, release, tracks (other editions start closed)
    open: new Set(),      // rows opened into their versions
    seen: new Set(),      // rows that differ already shown once: the ccDiffOpen setting opens each only then
    sel: null,            // the row in the inspector
    ticks: { is: true, as: true, pc: true },
    ui: null, seeded: false,
    inMb: { state: 'none', urls: '', releases: [] },   // the releases MusicBrainz links any of these albums to
};

function ccStyle() {
    if (document.getElementById('mcc-style')) return;
    const s = document.createElement('style'); s.id = 'mcc-style';
    s.textContent = '#mcc-root{position:fixed;inset:0;z-index:var(--mbu-z-modal);display:flex;flex-direction:column;background:var(--mbu-bg-sunken);color:var(--mbu-text);font:13px/1.4 var(--mbu-font)}'
        + '#mcc-root *{box-sizing:border-box}#mcc-root .mono{font-family:var(--mbu-font-mono)}#mcc-root .weak{color:var(--mbu-text-weak)}#mcc-root .dim{color:var(--mbu-text-dim)}'
        + '#mcc-root a{color:var(--mbu-accent-text)}'
        + '.mcc-hdr{display:flex;align-items:center;gap:14px;padding:8px 14px;background:var(--mbu-bg);border-bottom:1px solid var(--mbu-border)}'
        + '.mcc-rel{min-width:0;flex:0 1 auto}.mcc-ttl{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mcc-sub{font-size:12px;color:var(--mbu-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.mcc-steps{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;overflow:hidden}'
        + '.mcc-step{display:flex;align-items:center;gap:6px;padding:3px 8px;border:1px solid transparent;border-radius:6px;white-space:nowrap;font-size:12px}'
        + '.mcc-step b{display:block;font-size:12px}.mcc-step span.n{display:block;color:var(--mbu-accent-text)}.mcc-step.busy{border:1px dashed var(--mbu-border-strong)}.mcc-step.err span.n{color:var(--mbu-error)}'
        + '.mcc-arrow{color:var(--mbu-text-weak)}'
        + '.mcc-btn{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;border:1px solid var(--mbu-border);background:var(--mbu-bg);color:var(--mbu-text);font-weight:600;white-space:nowrap}'
        + '.mcc-btn:hover{background:var(--mbu-bg-hover)}.mcc-btn.go{background:var(--mbu-accent);border-color:var(--mbu-accent);color:var(--mbu-text-on-accent)}.mcc-btn.go:hover{background:var(--mbu-accent-hover)}'
        + '.mcc-btn[disabled]{opacity:.5;cursor:default}.mcc-btn.ghost{border-color:transparent;font-weight:400;padding:6px 8px}'
        + '.mcc-main{flex:1;display:flex;min-height:0}'
        + '.mcc-side{width:300px;flex:0 0 300px;overflow:auto;padding:12px 14px;background:var(--mbu-bg);border-right:1px solid var(--mbu-border)}'
        + '.mcc-insp{width:300px;flex:0 0 300px;overflow:auto;padding:12px 14px;background:var(--mbu-bg);border-left:1px solid var(--mbu-border)}'
        + '.mcc-center{flex:1;overflow:auto;padding:12px 14px;min-width:0}'
        + '.mcc-h{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--mbu-text-dim);margin:2px 0 8px}'
        + '.mcc-lane{margin:0 0 14px}.mcc-bc{display:inline-block;font-family:var(--mbu-font-mono);font-size:12px;padding:1px 7px;border-radius:5px;border:1px solid var(--mbu-border);margin-bottom:4px}'
        + '.mcc-bc.own{border-color:var(--mbu-ok-border);background:var(--mbu-ok-bg);color:var(--mbu-ok)}.mcc-lane-note{font-size:12px;color:var(--mbu-text-dim);margin:2px 0 4px}'
        + '.mcc-src{display:flex;align-items:center;gap:7px;padding:3px 4px;border-radius:5px;cursor:pointer}.mcc-src:hover{background:var(--mbu-bg-hover)}'
        + '.mcc-src input{margin:0;cursor:pointer;flex:none}.mcc-src>:not(.nm):not(.meta){flex:none}.mcc-src .nm{flex:1 0 auto;max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mcc-src .meta{flex:0 1 auto;min-width:0;margin-left:auto;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--mbu-text-weak);white-space:nowrap}'
        + '.mcc-src.off .nm{color:var(--mbu-text-weak)}.mcc-src .meta.err{color:var(--mbu-error)}.mcc-src .meta.busy{color:var(--mbu-info)}.mcc-src .meta.warn{color:var(--mbu-warn)}'
        + '.mcc-src.source{cursor:default}'
        + '.mcc-icos{display:inline-flex;gap:2px;align-items:center;vertical-align:middle}.mcc-icos svg{display:block}.mcc-abbr{font-size:9px;font-weight:700;border:1px solid var(--mbu-border);border-radius:3px;padding:0 2px;line-height:12px}'
        + '.mcc-sect{background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius-lg);margin:0 0 14px;overflow:hidden}'
        + '.mcc-sect-h{cursor:pointer;user-select:none;display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--mbu-accent-soft);border-bottom:1px solid var(--mbu-border)}.mcc-sect-h b{font-size:14px}.mcc-sect.closed>:not(.mcc-sect-h){display:none}.mcc-sect.closed .mcc-sect-h{border-bottom:0}.mcc-center svg.chev{flex:none;color:var(--mbu-text-dim);transition:transform .15s}.mcc-center [data-cc="sect"][aria-expanded="true"] svg.chev{transform:rotate(90deg)}.mcc-sect-h .hint{flex:1;font-size:12px;color:var(--mbu-text-dim)}'
        + '.mcc-chip{font-size:11px;padding:1px 8px;border-radius:999px;border:1px solid var(--mbu-border);white-space:nowrap}.mcc-chip.ok{background:var(--mbu-ok-bg);border-color:var(--mbu-ok-border);color:var(--mbu-ok)}'
        + '.mcc-chip-btn{font:inherit;font-size:11px;cursor:pointer}.mcc-chip-btn:hover{filter:brightness(1.15)}.mcc-chip-btn .mcc-caret{display:inline-block;min-width:10px;text-align:center}'
        + '.mcc-chip.warn{background:var(--mbu-warn-bg);border-color:var(--mbu-warn-border);color:var(--mbu-warn)}'
        + '.mcc-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;padding:10px}'
        + '.mcc-f{border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:8px 10px;min-width:0}.mcc-f.differ{background:var(--mbu-warn-bg);border-color:var(--mbu-warn-border)}'
        + '.mcc-f-h{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mbu-text-dim);display:flex;gap:6px;align-items:center}'
        + '.mcc-n{font-size:11px;min-width:18px;text-align:center;padding:0 5px;border-radius:999px;border:1px solid var(--mbu-warn-border);color:var(--mbu-warn);background:var(--mbu-bg)}'
        + '.mcc-win{font-weight:600;margin:3px 0 2px;word-break:break-word}.mcc-alt{display:flex;gap:6px;align-items:flex-start;font-size:12px;color:var(--mbu-text-dim);cursor:pointer;padding:2px 0}.mcc-alt:hover{color:var(--mbu-text)}'
        + '.mcc-alt .r{flex:0 0 auto;width:11px;height:11px;border:1px solid var(--mbu-border-strong);border-radius:50%;margin-top:3px}.mcc-alt .v{word-break:break-word}.mcc-f .d{display:inline-block;margin-right:4px}.mcc-alts.two .d,.mcc-win.lined .d{font-family:var(--mbu-font-mono);font-size:13px;font-weight:600}.mcc-alts.two .d>span{font-weight:400}.mcc-win.lined{display:flex;gap:6px;align-items:center}.mcc-alts.two .mcc-alt{align-items:center}.mcc-alts.two .mcc-alt .r{margin-top:0}.mcc-alts.two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-flow:column;column-gap:10px}'
        + '.mcc-rows{display:grid;grid-template-columns:auto minmax(45%,1fr) auto;column-gap:8px;row-gap:3px;margin-top:4px}.mcc-rows.one{grid-template-columns:minmax(45%,1fr) auto}'
        + '.mcc-rows .mcc-row{display:grid;grid-template-columns:subgrid;grid-column:1/-1;align-items:center;margin:0;padding:1px 0;font-size:inherit}.mcc-rows .v{min-width:0;word-break:break-word}.mcc-rows .mcc-win .v{font-weight:600}.mcc-rows .v.mono{font-family:var(--mbu-font-mono);font-size:13px}'
        + '.mcc-rows .i{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;row-gap:2px}.mcc-f .r{flex:0 0 auto;width:11px;height:11px;border:1px solid var(--mbu-border-strong);border-radius:50%;margin:0;box-sizing:border-box}.mcc-f .r.on{border-color:var(--mbu-accent);background:radial-gradient(var(--mbu-accent) 40%,transparent 46%)}'
        + '.mcc-f .hl{background:color-mix(in srgb, var(--mbu-warn) 28%, transparent);color:var(--mbu-text);border-radius:2px}.mcc-f .hl.gap{display:inline-block;width:6px;height:1em;vertical-align:-2px;background:none;border:1px dashed var(--mbu-warn)}'
        + '.mcc-f .none{font-size:12px;color:var(--mbu-text-weak)}.mcc-none-sep{display:inline-block;width:1px;height:12px;background:var(--mbu-border);margin:0 5px;vertical-align:middle}.mcc-none-icos>span{filter:grayscale(1);opacity:.38;transition:filter .15s,opacity .15s}.mcc-none-icos>span:hover{filter:none;opacity:1}'
        + '.mcc-tbl{width:100%;border-collapse:collapse}.mcc-tbl th{font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--mbu-text-dim);text-align:left;padding:6px 8px;border-bottom:1px solid var(--mbu-border)}'
        + '.mcc-tbl td{padding:5px 8px;border-bottom:1px solid var(--mbu-divider);vertical-align:middle}.mcc-tbl tr.row{cursor:pointer}.mcc-tbl tr.row:hover td{background:var(--mbu-bg-hover)}'
        + '.mcc-tbl tr.sel td{background:var(--mbu-accent-soft)}.mcc-tbl td.pos{color:var(--mbu-text-weak);width:34px}.mcc-tbl td.len,.mcc-tbl td.isrc{font-family:var(--mbu-font-mono);font-size:12px;white-space:nowrap}'
        + '.mcc-tbl tr.ver td{background:var(--mbu-bg-raised);font-size:12px}.mcc-tbl tr.ver td:first-child{border-left:3px solid var(--mbu-accent)}.mcc-tbl tr.ver .r{display:inline-block;width:11px;height:11px;border:1px solid var(--mbu-border-strong);border-radius:50%;margin-right:6px;vertical-align:-1px}'
        + '.mcc-tbl tr.ver.on .r{background:var(--mbu-accent);border-color:var(--mbu-accent);box-shadow:inset 0 0 0 2px var(--mbu-bg)}.mcc-tbl tr.ver{cursor:pointer}'
        + '.mcc-tbl .hl{background:var(--mbu-warn-bg);border-radius:3px;padding:0 3px}.mcc-tbl tr.extra td.ttl{text-decoration:line-through;color:var(--mbu-text-weak)}.mcc-tbl tr.extra.on td.ttl{text-decoration:none;color:var(--mbu-text)}'
        + '.mcc-tbl .why{color:var(--mbu-text-weak)}.mcc-tbl td.vers{width:1%;white-space:nowrap;text-align:right}'
        + '.mcc-inmb{border:1px solid var(--mbu-warn-border);background:var(--mbu-bg);border-radius:var(--mbu-radius-lg);margin:0 0 14px;overflow:hidden;container-type:inline-size}.mcc-inmb.other{border-color:var(--mbu-border)}'
        + '.mcc-inmb-tog.same{background:var(--mbu-warn-bg)}.mcc-inmb-tog.same:hover{background:var(--mbu-warn-bg);filter:brightness(.97)}.mcc-inmb:not(.closed) .mcc-inmb-tog.same{border-bottom-color:var(--mbu-warn-border)}.mcc-inmb-tog.same>svg:not(.chev){color:var(--mbu-warn)}'
        + '.mcc-inmb-tog{all:unset;box-sizing:border-box;cursor:pointer;display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px}.mcc-inmb-tog:hover{background:var(--mbu-bg-hover)}.mcc-inmb-tog .s{font-size:12px;color:var(--mbu-text-dim)}.mcc-inmb-tog svg{flex:none;color:var(--mbu-text-dim);transition:transform .15s}.mcc-inmb:not(.closed) .mcc-inmb-tog{border-bottom:1px solid var(--mbu-divider)}.mcc-inmb.closed>:not(.mcc-inmb-tog){display:none}'
        + '.mcc-inmb .mcc-n{border-color:var(--mbu-border);color:var(--mbu-text-dim)}'
        // one grid per section, its rows on it: the format column is as wide as its widest value, so the date sits by it
        + '.mcc-inmb-rows{display:grid;grid-template-columns:minmax(0,1fr) 84px auto 24px 120px 88px;column-gap:10px}'
        + '.mcc-ing{grid-column:1/-1;display:grid;grid-template-columns:subgrid;column-gap:10px;align-items:center;padding:0 12px}.mcc-ing>*{min-width:0}'
        + '.mcc-ing.ch{font-size:11px;color:var(--mbu-text-dim);padding-block:5px;border-bottom:1px solid var(--mbu-divider)}.mcc-ing.ch>span{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.mcc-ing.ch svg{color:var(--mbu-text-weak)}'
        + '.mcc-ing.alb{padding-block:7px;background:var(--mbu-bg-sunken);border-bottom:1px solid var(--mbu-divider)}.mcc-ing.alb .t>span:first-child{font-weight:600;color:var(--mbu-text-dim);white-space:nowrap}'
        // this album's platforms (a dozen, often) wrap inside the title's column
        + '.mcc-ing.alb .pl{flex:0 1 auto;min-width:0;flex-wrap:wrap;justify-content:flex-end;row-gap:2px}'
        + '.mcc-ing.r{padding-block:7px}.mcc-ing.r+.mcc-ing.r{border-top:1px solid var(--mbu-divider)}'
        + '.mcc-ing .t{display:flex;align-items:baseline;gap:6px;min-width:0}.mcc-ing .t a.ttl{font-weight:600;flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.mcc-ing .dis{font-size:12px;color:var(--mbu-text-dim);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.mcc-ing .pl{display:flex;gap:2px;align-items:center;margin-left:auto;flex:none;align-self:center}.mcc-ing .pl a{display:block;line-height:0;border-radius:3px}.mcc-ing .pl a:hover{filter:brightness(1.15)}.mcc-ing .pl svg{display:block}'
        + '.mcc-ing .c{white-space:nowrap;display:flex;align-items:center;gap:5px}.mcc-ing .c .m{display:none;flex:none;color:var(--mbu-text-weak)}.mcc-ing .num{justify-content:flex-start}.mcc-ing .fmt,.mcc-ing .dt,.mcc-ing.ch>span:nth-child(2),.mcc-ing.ch>span:nth-child(3){justify-content:flex-end;text-align:right}.mcc-ing .fmt{white-space:normal}.mcc-ing .none{color:var(--mbu-text-weak)}'
        + '.mcc-ing .diff{color:var(--mbu-warn);font-weight:600}.mcc-ing .diff .v{background:var(--mbu-warn-bg);border-radius:3px;padding:0 3px}'
        + '.mcc-ing .act{display:flex;gap:4px;align-items:center;justify-content:flex-end}.mcc-ing .mcc-upd{padding:3px 10px;font-size:12px;border-color:var(--mbu-warn-border)}'
        + '@container (max-width:640px){.mcc-ing.ch{display:none}.mcc-ing.r,.mcc-ing.alb{grid-template-columns:96px 120px 40px 136px minmax(0,1fr);row-gap:3px}.mcc-ing .fmt,.mcc-ing .dt{justify-content:flex-start;text-align:left}.mcc-ing .t{grid-column:1/-1}.mcc-ing .num{justify-content:flex-start}.mcc-ing .c .m{display:inline}}'
        + '@container (max-width:440px){.mcc-ing.r,.mcc-ing.alb{grid-template-columns:96px minmax(0,1fr) auto}.mcc-ing>:nth-child(5){grid-column:1/-1}.mcc-ing.r>:nth-child(6){grid-column:1/-1;justify-content:flex-start}}'
        + '.mcc-fmt-slot{display:inline-flex;flex:none}'
        + '.mcc-note{border:1px dashed var(--mbu-border-strong);border-radius:var(--mbu-radius-lg);padding:10px 12px;font-size:12px;color:var(--mbu-text-dim);background:var(--mbu-bg)}'
        + '.mcc-insp dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0 0 12px;font-size:12px}.mcc-insp dt{color:var(--mbu-text-weak)}.mcc-insp dd{margin:0;word-break:break-word}'
        + '.mcc-vh{display:flex;justify-content:space-between;gap:8px}.mcc-vh .weak{text-transform:none;letter-spacing:0;font-weight:400}'
        + '.mcc-vers{margin:0 0 12px;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);overflow:hidden}'
        + '.mcc-ver{display:grid;grid-template-columns:16px 1fr auto;column-gap:6px;row-gap:2px;padding:7px 9px;font-size:12px;border-top:1px solid var(--mbu-divider)}.mcc-ver:first-child{border-top:0}'
        + '.mcc-ver[data-cc]{cursor:pointer}.mcc-ver[data-cc]:hover{background:var(--mbu-bg-hover)}.mcc-ver.on{background:var(--mbu-accent-soft)}'
        + '.mcc-ver .r{grid-row:1;width:11px;height:11px;border:1px solid var(--mbu-border-strong);border-radius:50%;margin-top:3px}.mcc-ver.on .r{background:var(--mbu-accent);border-color:var(--mbu-accent);box-shadow:inset 0 0 0 2px var(--mbu-bg)}'
        + '.mcc-ver .t{font-weight:600;word-break:break-word}.mcc-ver .n{color:var(--mbu-text-weak);white-space:nowrap;text-align:right}'
        + '.mcc-ver .m{grid-column:2/4;display:flex;align-items:center;gap:8px;color:var(--mbu-text-dim);min-width:0}.mcc-ver .m .mono{white-space:nowrap}.mcc-ver .i{margin-left:auto;display:flex;justify-content:flex-end;min-width:0}.mcc-ver .i .mcc-icos{flex-wrap:wrap;justify-content:flex-end}'
        + '.mcc-ver .hl{background:var(--mbu-warn-bg);color:var(--mbu-warn);border-radius:3px;padding:0 2px}.mcc-tbl .hl.in,.mcc-ver .hl.in{padding:0;border-radius:2px}.mcc-ver .hl.gap{display:inline-block;width:6px;height:1em;vertical-align:-2px;padding:0;border:1px dashed var(--mbu-warn-border)}'
        + '.mcc-insp p{font-size:12px;color:var(--mbu-text-dim);margin:0 0 12px}.mcc-tick{display:flex;gap:8px;align-items:flex-start;font-size:12px;margin:0 0 6px;cursor:pointer}.mcc-tick input{margin:2px 0 0}'
        + '.mcc-split{position:relative;display:inline-flex}.mcc-split>.mcc-btn:first-child{border-top-right-radius:0;border-bottom-right-radius:0}'
        + '.mcc-split>.mcc-more{border-top-left-radius:0;border-bottom-left-radius:0;border-left:1px solid var(--mbu-accent-hover);padding:6px 10px;min-width:32px;justify-content:center}'
        + '.mcc-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:2;min-width:180px;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);box-shadow:0 6px 18px rgba(0,0,0,.25);padding:4px}'
        + '.mcc-menu button{all:unset;box-sizing:border-box;display:block;width:100%;padding:7px 10px;border-radius:5px;cursor:pointer;color:var(--mbu-text);white-space:nowrap}.mcc-menu button:hover{background:var(--mbu-bg-hover)}'
        + '.mcc-err{margin:40px auto;max-width:520px;background:var(--mbu-bg);border:1px solid var(--mbu-error-border);border-radius:var(--mbu-radius-lg);padding:16px 18px}'
        + '.mcc-spin{display:inline-block;width:10px;height:10px;border:2px solid var(--mbu-border);border-top-color:var(--mbu-info);border-radius:50%;animation:mcc-spin .8s linear infinite;vertical-align:-1px}@keyframes mcc-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
}

/* the sources and their lanes */

function ccSeed() {
    const r = CC.src.rel;
    return { barcode: r.barcode || null, title: r.title, artist: ccCredit(r.credit), tracks: ccCount(r), format: (r.mediums[0] && r.mediums[0].format) || 'Digital Media', year: r.date && r.date.year, label: r.labels && r.labels[0] && r.labels[0].name };
}
function ccBuildSources() {
    const src = CC.src, sk = ccKey(src.source), was = new Map(CC.sources.map(s => [s.key, s]));
    const out = [{ key: sk, url: src.url, barcode: src.rel.barcode || null, tracks: ccCount(src.rel), role: 'source', take: true, read: { state: 'done', rel: src.rel, provider: src.platform } }];
    for (const f of CC.pc.findings) {
        if (!f.url || out.some(s => s.key === f.key)) continue;   // the source's own platform: the album read stands
        const old = was.get(f.key);
        out.push({ key: f.key, url: f.url, barcode: f.barcode || null, tracks: f.tracks == null ? null : f.tracks, format: f.format || null, links: f.links || null, mismatch: f.mismatch || null, why: f.why || null, state: f.state, role: 'found', take: old ? old.take : null, hand: !!(old && old.hand), read: old && old.url === f.url ? old.read : { state: 'none' } });
    }
    CC.sources = out;
    // the source's lane is taken; a platform with no barcode joins it when it has as many tracks
    const own = ccBc(out[0].barcode), n = out[0].tracks;
    out.forEach(s => {
        if (s.take != null) return;
        const bc = ccBc(s.barcode);
        s.take = !s.mismatch && (bc ? bc === own : (s.tracks === n || s.tracks == null));
    });
    Log.cat('Platforms').info('consolidation sources: ' + out.map(s => s.key + (s.take ? '✓' : '·') + (s.barcode ? ' ' + s.barcode : '') + (s.tracks != null ? ' ' + s.tracks + 't' : '') + (s.mismatch ? ' [' + s.mismatch.join('; ') + ']' : '')).join(' | '));
}
function ccLanes() {
    const own = ccBc(CC.sources[0] && CC.sources[0].barcode);
    const by = new Map();
    CC.sources.forEach(s => { const b = ccBc(s.barcode); if (!by.has(b)) by.set(b, []); by.get(b).push(s); });
    return [...by.entries()].map(([bc, list]) => {
        // one form of the barcode: the one most of them give
        const forms = {};
        list.forEach(s => { if (s.barcode) forms[s.barcode] = (forms[s.barcode] || 0) + 1; });
        const shown = Object.keys(forms).sort((a, b) => forms[b] - forms[a] || b.length - a.length)[0] || '';
        return { bc, list, own: bc === own, shown };
    }).sort((a, b) => (b.own - a.own) || ((a.bc === '') - (b.bc === '')) || (b.list.length - a.list.length));
}

/* reading the platforms (First Contact, headless) */

const CC_READS = 3, CC_READ_WAIT = 90000;
const ccReadable = k => !CC_UNREAD[k];
function ccReadTaken() {
    CC.sources.forEach(s => { if (s.take && s.read.state === 'none' && ccReadable(s.key)) s.read = { state: 'queued' }; });
    ccPump();
}
function ccPump() {
    let active = CC.sources.filter(s => s.read.state === 'reading').length;
    for (const s of CC.sources) {
        if (active >= CC_READS) break;
        if (s.read.state !== 'queued') continue;
        s.read = { state: 'reading', at: Date.now() };
        active++;
        Log.cat('Platforms').info('reading ' + ccName(s.key) + ': ' + s.url);
        document.dispatchEvent(new CustomEvent('mc:read', { detail: JSON.stringify({ url: s.url, run: CC.run }) }));
    }
    ccPaint();
}
document.addEventListener('mc:read-progress', e => {
    let d; try { d = JSON.parse(e.detail); } catch (x) { return; }
    const s = d && d.run === CC.run && CC.sources.find(x => x.url === d.url && x.read.state === 'reading');
    if (!s) return;
    Object.assign(s.read, { n: d.n, total: d.total, at: Date.now() });
    if (!CONS) { cmpProgress(); return; }
    ccPaintSide(); ccPaintSteps();
});
document.addEventListener('mc:read-result', e => {
    let d; try { d = JSON.parse(e.detail); } catch (x) { Log.cat('Platforms').warn('mc:read-result with unreadable detail: ' + x.message); return; }
    const s = d && d.run === CC.run && CC.sources.find(x => x.url === d.url && x.read.state === 'reading');
    if (!s) return;
    if (d.ok && d.rel) {
        s.read = { state: 'done', rel: d.rel, provider: d.provider, ms: d.ms };
        Log.cat('Platforms').ok('read ' + ccName(s.key) + ' in ' + d.ms + ' ms: "' + d.rel.title + '" · ' + ccCount(d.rel) + ' track(s) · barcode ' + (d.rel.barcode || ('—' + (s.barcode ? ', Platform Check found ' + s.barcode : ''))));
        ccTracklistCheck(s);
    } else {
        s.read = { state: 'failed', error: d.error || 'failed' };
        Log.cat('Platforms').warn('read ' + ccName(s.key) + ' failed: ' + s.read.error);
        pcVetFailed(s);
    }
    ccPump();
});

/* consolidation: fields by vote, tracks by version */

function ccRank(k) {
    const order = [CC.sources[0] && CC.sources[0].key].concat(CC.pc.findings.map(f => f.key));
    const i = order.indexOf(k);
    return i < 0 ? 99 : i;
}
const ccRead = () => CC.sources.filter(s => s.take && s.read.state === 'done');
// One field: the values the platforms give, grouped; the group most give wins (a tie: the platform
// order), unless another was taken by hand. A platform that gives nothing doesn't vote.
function ccVote(field, items) {
    // a stray or doubled space (Discogs' "Phenomenon ") is the same value
    const tidy = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v);
    items = items.map(it => Object.assign({}, it, { val: tidy(it.val), show: tidy(it.show) }));
    const groups = [];
    items.forEach(it => {
        if (it.val == null || it.val === '') return;
        let g = groups.find(x => x.val === it.val);
        if (!g) groups.push(g = { val: it.val, show: it.show, data: it.data, keys: [], soft: true });
        g.keys.push(it.key);
        if (!it.soft) g.soft = false;
    });
    groups.forEach(g => g.keys.sort((a, b) => ccRank(a) - ccRank(b)));
    // a guessed value (a type FC guessed) only counts when nobody gives one
    const hard = g => (g.soft ? 0 : 1);
    groups.sort((a, b) => hard(b) - hard(a) || b.keys.length - a.keys.length || ccRank(a.keys[0]) - ccRank(b.keys[0]));
    const byHand = CC.pick[field] != null && groups.find(g => g.val === CC.pick[field]);
    const none = items.filter(it => it.val == null || it.val === '').map(it => it.key);
    return { field, groups, win: byHand || groups[0] || null, hand: !!byHand, none };
}
const CC_FIELDS = [
    ['title', 'Title'], ['artist', 'Artist'], ['date', 'Date'], ['label', 'Label'], ['catno', 'Cat. no.'], ['type', 'Type'], ['barcode', 'Barcode'],
];
function ccFields(reads) {
    const at = (fn) => reads.map(s => Object.assign({ key: s.key }, fn(s.read.rel, s)));
    const date = d => (d && d.year ? [d.year, d.month && String(d.month).padStart(2, '0'), d.day && String(d.day).padStart(2, '0')].filter(Boolean).join('-') : '');
    // #746: a platform whose page has no barcode (Qobuz's newer albums) gives the one Platform Check found for it
    const bcOf = s => s.read.rel.barcode || s.barcode || null;
    const bc = {};
    reads.forEach(s => { const b = bcOf(s); if (b) { const k = ccBc(b); (bc[k] = bc[k] || {})[b] = ((bc[k] || {})[b] || 0) + 1; } });
    const bcShow = k => Object.keys(bc[k] || {}).sort((a, b) => bc[k][b] - bc[k][a] || b.length - a.length)[0] || k;
    return {
        title: ccVote('title', at(r => ({ val: r.title, show: r.title }))),
        artist: ccVote('artist', at(r => ({ val: ccCredit(r.credit), show: ccCredit(r.credit), data: r.credit }))),
        date: ccVote('date', at(r => ({ val: date(r.date), show: date(r.date), data: r.date }))),
        label: ccVote('label', at(r => { const ls = (r.labels || []).filter(l => l.name && !ccNone(l.name)); const v = ls.map(l => l.name).join(' / '); return { val: v, show: v, data: ls }; })),
        catno: ccVote('catno', at(r => { const v = (r.labels || []).map(l => l.catno).filter(c => c && !ccNone(c)).join(' / '); return { val: v, show: v }; })),
        type: ccVote('type', at(r => { const v = (r.types || []).join(' + '); return { val: v, show: r.typeGuessed ? v + ' (guessed)' : v, data: r.types, soft: !!r.typeGuessed }; })),
        barcode: ccVote('barcode', at((r, s) => { const b = bcOf(s); return { val: ccBc(b), show: b ? bcShow(ccBc(b)) : '' }; })),
    };
}
// The tracks: each platform's flattened tracklist, lined up. The track count most platforms give
// (a tie: the source's) is the tracklist; a platform with that count lines up by position, one with
// another count by ISRC, then by a title only one track has. What lines up with nothing is an extra
// row, left out unless taken.
function ccTracks(reads) {
    const flats = reads.map(s => ({ key: s.key, list: s.read.rel.mediums.flatMap((m, mi) => m.tracks.map((t, ti) => ({ mi, ti, t }))) }));
    if (!flats.length) return { rows: [], extras: [], n: 0 };
    const counts = {};
    flats.forEach(f => { counts[f.list.length] = (counts[f.list.length] || 0) + 1; });
    const srcN = flats[0].list.length;
    const n = +Object.keys(counts).sort((a, b) => counts[b] - counts[a] || (+b === srcN) - (+a === srcN))[0];
    const base = flats.find(f => f.list.length === n);
    const rows = base.list.map((x, i) => ({ id: 'r' + i, i, mi: x.mi, ti: x.ti, tracks: [] }));
    const extras = [];
    flats.filter(f => f.list.length === n).forEach(f => f.list.forEach((x, i) => rows[i].tracks.push({ key: f.key, t: x.t })));
    flats.filter(f => f.list.length !== n).forEach(f => {
        const used = new Set();
        f.list.forEach(x => {
            const isrc = x.t.isrc && x.t.isrc.toUpperCase();
            let r = isrc ? rows.find(r => !used.has(r.i) && r.tracks.some(y => y.t.isrc && y.t.isrc.toUpperCase() === isrc)) : null;
            if (!r) {
                const nt = ccNorm(x.t.title);
                const hits = rows.filter(r => !used.has(r.i) && r.tracks.some(y => ccNorm(y.t.title) === nt));
                if (hits.length === 1) r = hits[0];
            }
            if (r) { used.add(r.i); r.tracks.push({ key: f.key, t: x.t }); return; }
            const nt = ccNorm(x.t.title);
            let e = extras.find(e => ccNorm(e.tracks[0].t.title) === nt);
            if (!e) extras.push(e = { id: 'x' + extras.length, tracks: [] });
            e.tracks.push({ key: f.key, t: x.t });
        });
    });
    rows.concat(extras).forEach(r => { r.versions = ccVersions(r); r.win = ccRowWin(r); });
    return { rows, extras, n };
}
// Platforms agree on a track when the title is the same (case and punctuation count: they matter
// for the style guidelines), and so are the ISRC and the length within 1 s where both give one.
// Lengths chain: 4:34, 4:35 and 4:36 are one version, as each is within 1 s of another.
function ccVersions(row) {
    const vs = [];
    row.tracks.slice().sort((a, b) => ccRank(a.key) - ccRank(b.key)).forEach(x => {
        // a platform's stray spaces (a trailing one) make no version of their own
        const t = x.t, title = String(t.title || '').replace(/\s+/g, ' ').trim(), len = t.lengthMs || null, isrc = t.isrc ? t.isrc.toUpperCase() : null;
        let v = vs.find(v => v.title === title && (!isrc || !v.isrc || v.isrc === isrc) && (!len || !v.lens.length || v.lens.some(l => Math.abs(l - len) <= 1000)));
        if (!v) vs.push(v = { title, isrc: null, len: null, lens: [], keys: [], tracks: [] });
        if (len) v.lens.push(len);
        v.keys.push(x.key); v.tracks.push(t);
        v.isrc = v.isrc || isrc; v.len = v.len || len;
    });
    vs.sort((a, b) => b.keys.length - a.keys.length || ccRank(a.keys[0]) - ccRank(b.keys[0]));
    return vs;
}
function ccRowWin(r) {
    const k = CC.rowPick[r.id];
    return (k && r.versions.find(v => v.keys.includes(k))) || r.versions[0];
}
// what sets a version apart from the one taken
// a title against the one taken, the part that differs highlighted: what's left once the
// common start and end are set aside ("Doin[']" · "Doin That Thing[ (LP Version)]")
function ccTitleDiff(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a === b) return esc(a);
    let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
    let q = 0; while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
    const mid = a.slice(p, a.length - q);
    return esc(a.slice(0, p)) + (mid ? '<span class="hl in">' + esc(mid) + '</span>' : '<span class="hl gap" data-tip="Missing here: ' + esc(b.slice(p, b.length - q)) + '"></span>') + esc(a.slice(a.length - q));
}
function ccDiff(v, w) {
    const out = [];
    // only the capitals: a matter of guess case, as the release's tracklist's ≠ case
    if (v.title !== w.title) out.push(String(v.title || '').toLowerCase() === String(w.title || '').toLowerCase() ? 'case' : ccNorm(v.title) === ccNorm(w.title) ? 'spelling' : 'the title');
    if (v.len && w.len && Math.abs(v.len - w.len) > 1000) out.push((v.len > w.len ? '+' : '−') + Math.round(Math.abs(v.len - w.len) / 1000) + ' s');
    if (v.isrc && w.isrc && v.isrc !== w.isrc) out.push('the ISRC');
    return out;
}
// #792: a platform taken on its track count alone (no barcode) may be another album with as many
// tracks. Once read, its tracks are lined up by position with the release's (on a probe) or the
// source's (a consolidation). With lengths to compare (on at least half the tracks), they decide: it is
// another release when fewer than half of them match, whatever the titles say (another version of the
// album: the same titles, other edits); a translated or transliterated tracklist keeps its lengths.
// Without lengths, only when no title matches. A barcode that matches outweighs it.
const ccTitleKey = t => ccNorm(String(t || '').replace(/\s*[([][^)\]]*[)\]]/g, ' '));
const CC_LEN_SLACK = 3000;
function ccTracklistRef() {
    if (CONS) { const s = CC.sources[0]; return s && s.read.state === 'done' ? s.read.rel.mediums.flatMap(m => m.tracks).map(t => ({ title: t.title, ms: t.lengthMs || null })) : null; }
    return rel && rel.tracks ? rel.tracks.map(t => ({ title: t.title, ms: pfMs(t.len) })) : null;
}
// what a read platform's tracklist says: null when it can't be compared (another track count, nothing to
// compare with), else whether it is another release's and why
function ccTracklistVerdict(s) {
    const ref = ccTracklistRef(), list = s.read.rel.mediums.flatMap(m => m.tracks);
    if (!ref || !ref.length || list.length !== ref.length) { Log.cat('Platforms').debug('tracklist ' + ccName(s.key) + ': not compared (' + list.length + ' tracks, ' + (ref ? ref.length : 'no') + ' to compare with)'); return null; }
    let titles = 0, lens = 0, lensOk = 0;
    const off = [];
    list.forEach((t, i) => {
        const a = ccTitleKey(t.title), b = ccTitleKey(ref[i].title);
        const same = !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a));
        if (same) titles++;
        const ms = t.lengthMs || null, rms = ref[i].ms;
        if (ms && rms) { lens++; if (Math.abs(ms - rms) <= CC_LEN_SLACK) lensOk++; }
        if (!same) off.push((i + 1) + ' "' + t.title + '" for "' + ref[i].title + '"' + (ms && rms ? ' (' + ccLen(ms) + ' for ' + ccLen(rms) + ')' : ''));
    });
    const n = list.length;
    let other = lens * 2 >= n ? lensOk * 2 < lens : titles === 0;
    const why = 'another tracklist: ' + titles + ' of ' + n + ' titles' + (lens ? ', ' + lensOk + ' of ' + lens + ' lengths' : '') + ' match';
    Log.cat('Platforms').debug('tracklist ' + ccName(s.key) + ': ' + titles + '/' + n + ' titles, ' + lensOk + '/' + lens + ' lengths match the ' + (CONS ? 'source\'s' : 'release\'s') + ' → ' + (other ? 'another release' : 'this release') + (off.length ? ' · differ: ' + off.slice(0, 5).join('; ') + (off.length > 5 ? '; …' : '') : ''));
    const bc = ccBc(s.read.rel.barcode || s.barcode), own = CONS ? ccBc(CC.sources[0].barcode) : pcOwnBc();
    if (other && bc && own && bc === own) { Log.cat('Platforms').warn(ccName(s.key) + ': ' + why + ', but its barcode is the release\'s, so it stays'); other = false; }
    return { other, why };
}
function ccTracklistCheck(s) {
    if (s.role === 'source' || s.read.state !== 'done') return;
    const v = ccTracklistVerdict(s);
    if (!CONS) { pcVetSet(s.url, v ? (v.other ? { state: 'other', why: v.why } : { state: 'ok' }) : { state: 'ok' }, s.read.rel); }
    if (!v || !v.other) return;
    s.read.other = v.why;
    if (s.hand) { Log.cat('Platforms').warn(ccName(s.key) + ': ' + v.why + ', but it was taken by hand, so it stays'); return; }
    s.take = false;
    Log.cat('Platforms').warn(ccName(s.key) + ' left out: ' + v.why + ' (' + s.url + ')');
}

// #792: on a probe, a platform Platform Check would take on its track count alone is no selected album link
// until First Contact has read it and its tracklist is the release's: Art Station and ISRC Scout aren't asked
// with it, and Execute doesn't add it. Those platforms are read on every probe, whatever the Platforms step's
// mode (the full comparison reads them all); without First Contact they stay unselected. A tracklist checked
// is kept for the page, so a probe or a comparison after doesn't read the platform again.
const VET = new Map();   // album url → { state: 'reading' | 'ok' | 'other' | 'failed' | 'unread', why, rel, at }
const VET_RUN = 'v' + Date.now().toString(36);
function pcOwnBc() {
    const pc = results.pc;
    if (!pc || pc.state !== 'done') return '';
    return ccBc(pc.barcode) || ccBc((pc.findings.find(x => !x.entity && !x.kind && x.state === 'linked' && x.barcode) || {}).barcode);
}
// a link Platform Check is sure of on its track count alone: no barcode, or the release has none to match
function pcDoubtful(x, own) {
    if (x.entity || x.kind || !x.url || x.state !== 'new' || x.mismatch || x.cons) return false;   // a consolidation checked its own
    if (x.tracks != null && rel && x.tracks !== rel.tracks.length) return false;
    return !own || !ccBc(x.barcode);
}
const fcCanRead = () => !!found.fc && !providerOff('fc');
function pcVetSet(url, v, rd) {
    const was = VET.get(url);
    VET.set(url, Object.assign({}, v, { rel: rd || (was && was.rel) || null }));
    pcVet();
}
function pcVet() {
    const r = results.pc, set = picked.pc;
    if (CONS || !r || r.state !== 'done' || !set) return;
    const own = pcOwnBc(), held = [];
    const afterOff = AFTER && ('pc' in AFTER.ticks) && !AFTER.ticks.pc;
    (r.findings || []).forEach(x => {
        if (!pcDoubtful(x, own)) {
            // a link whose tracklist was found another release's says so, whatever else PC says of it: withheld for
            // its barcode, it was taken in by the comparison before, which now leaves it out for its tracklist
            const v = !x.entity && !x.kind && x.url && x.state !== 'linked' && VET.get(x.url);
            if (!v || v.state !== 'other') return;
            if (x.whyPc === undefined) x.whyPc = x.why || '';
            x.other = true;
            x.why = [x.whyPc, v.why].filter(Boolean).join(' · ');
            if (!(x.mismatch || []).includes(v.why)) x.mismatch = (x.mismatch || []).concat(v.why);   // in amber, the lane's icon marked
            return;
        }
        if (x.whyPc === undefined) x.whyPc = x.why || '';
        let v = VET.get(x.url);
        if (!v) {
            v = !ccReadable(x.key) ? { state: 'unread', why: ccName(x.key) + ' can\'t be read, so its tracklist isn\'t checked' }
                : !fcCanRead() ? { state: 'unread', why: 'First Contact isn\'t ' + (found.fc ? 'on' : 'installed') + ', so its tracklist isn\'t checked' }
                : { state: 'reading', why: 'unselected until First Contact has read its tracklist', at: Date.now() };
            if (v.state === 'reading') {
                VET.set(x.url, v);
                // the comparison reads it already: its check gives the answer
                const cs = CC.sources.find(c => c.url === x.url && c.take && ['queued', 'reading', 'done'].includes(c.read.state));
                if (cs) Log.cat('Platforms').debug('tracklist ' + ccName(x.key) + ': the comparison reads it'); else pcVetRead(x);
            }
        } else if (v.state === 'unread' && ccReadable(x.key) && fcCanRead()) {
            VET.delete(x.url); return pcVet();
        }
        const note = v.state === 'ok' ? '' : v.state === 'other' ? v.why : v.state === 'failed' ? 'its tracklist couldn\'t be read (' + v.why + ')' : v.why;
        x.other = v.state === 'other';   // a lane's "take all in" passes it by
        x.held = v.state !== 'ok';
        x.why = [x.whyPc, note].filter(Boolean).join(' · ');
        if (v.state === 'ok') { if (!x.vetted && !afterOff) { x.vetted = true; if (!set.has(x.key)) { set.add(x.key); Log.cat('Platforms').info('Platform Check: ' + ccName(x.key) + ' selected, its tracklist is the release\'s'); } } }
        else if (!x.unpicked) { x.unpicked = true; if (set.delete(x.key)) held.push(ccName(x.key) + ' (' + note + ')'); }
    });
    if (held.length) Log.cat('Platforms').info('Platform Check: unselected ' + held.join(', '));
    if (ui) paintAll();
    syncLinks();
}
function pcVetFailed(s) { const v = !CONS && VET.get(s.url); if (v && v.state === 'reading') pcVetSet(s.url, { state: 'failed', why: s.read.error }); }
function pcVetRead(x) {
    Log.cat('Platforms').info('reading ' + ccName(x.key) + ' to check its tracklist: ' + x.url);
    document.dispatchEvent(new CustomEvent('mc:read', { detail: JSON.stringify({ url: x.url, run: VET_RUN }) }));
    setTimeout(() => { const v = VET.get(x.url); if (v && v.state === 'reading') { Log.cat('Platforms').warn('read ' + ccName(x.key) + ': no answer'); pcVetSet(x.url, { state: 'failed', why: 'no answer in ' + CC_READ_WAIT / 1000 + ' s' }); } }, CC_READ_WAIT);
}
document.addEventListener('mc:read-result', e => {
    let d; try { d = JSON.parse(e.detail); } catch (x) { return; }
    if (!d || d.run !== VET_RUN) return;
    const v = VET.get(d.url), x = results.pc && (results.pc.findings || []).find(f => f.url === d.url);
    if (!v || v.state !== 'reading') return;
    const key = x ? x.key : (d.provider && d.provider.id) || '?';
    if (!d.ok || !d.rel) { Log.cat('Platforms').warn('read ' + ccName(key) + ' failed: ' + (d.error || 'failed')); pcVetSet(d.url, { state: 'failed', why: d.error || 'failed' }); return; }
    Log.cat('Platforms').ok('read ' + ccName(key) + ' in ' + d.ms + ' ms: "' + d.rel.title + '" · ' + ccCount(d.rel) + ' track(s) · barcode ' + (d.rel.barcode || '—'));
    const vd = ccTracklistVerdict({ key, url: d.url, barcode: x ? x.barcode : null, read: { state: 'done', rel: d.rel } });
    if (vd && vd.other) Log.cat('Platforms').warn(ccName(key) + ' left out: ' + vd.why + ' (' + d.url + ')');
    pcVetSet(d.url, vd && vd.other ? { state: 'other', why: vd.why } : { state: 'ok' }, d.rel);
});
function ccModel() {
    const reads = ccRead();
    return { reads, fields: reads.length ? ccFields(reads) : null, tracks: ccTracks(reads) };
}

/* the release the editor is seeded with */

// Each artist of a credit with its links on every platform read: the source's link stays the
// credit's own (url); the others go in alt, with their platform, for Apollo to try.
function ccLinked(credit, credits) {
    const srcKey = CC.sources[0].key;
    return (credit || []).map(a => {
        const links = [];
        credits.forEach(({ key, provider, credit: c }) => (c || []).forEach(b => {
            if (b.url && ccNorm(b.name) === ccNorm(a.name) && !links.some(l => l.url === b.url)) links.push({ key, url: b.url, urlForms: b.urlForms, platform: { abbr: provider.abbr, name: provider.name, artistLinkType: provider.artistLinkType || undefined } });
        }));
        const own = links.find(l => l.key === srcKey);
        const alt = links.filter(l => l !== own).map(l => ({ url: l.url, urlForms: l.urlForms, platform: l.platform }));
        return { name: a.name, artistName: a.artistName || a.name, join: a.join || '', mbid: a.mbid || null, url: own ? own.url : null, urlForms: own ? own.urlForms : undefined, alt: alt.length ? alt : undefined };
    });
}
// the winning labels, each with its catalog number (the first takes them all when the platforms give more catalog numbers than labels)
function ccLabels(f) {
    const labelData = f.label.win ? f.label.win.data : [];
    const catnos = f.catno.win ? f.catno.win.val.split(' / ') : [];
    const labels = (labelData || []).map((l, i) => ({ name: l.name, catno: catnos[i] || (i === 0 ? catnos.join(' / ') : '') || '', url: l.url || null, urlForms: l.urlForms, mbid: l.mbid || null }));
    if (!labels.length && catnos.length) labels.push({ name: '', catno: catnos.join(' / ') });
    return labels;
}
function ccSeedRel(m) {
    const f = m.fields, src = CC.src.rel, srcKey = CC.sources[0].key;
    const provOf = k => { const s = CC.sources.find(x => x.key === k); return (s && s.read.provider) || CC.src.platform; };
    const relOf = k => { const s = CC.sources.find(x => x.key === k); return s && s.read.rel; };
    const releaseCredits = m.reads.map(s => ({ key: s.key, provider: s.read.provider || CC.src.platform, credit: s.read.rel.credit }));
    const winRel = g => (g ? relOf(g.keys[0]) : null) || src;
    const credit = ccLinked(f.artist.win ? f.artist.win.data : src.credit, releaseCredits);
    const dateRel = winRel(f.date.win);
    const labels = ccLabels(f);
    const typeG = f.type.win;
    // the tracklist in the medium layout of the platform the tracklist came from
    const t = m.tracks, mediums = [];
    const baseRel = (() => { const s = m.reads.find(s => ccCount(s.read.rel) === t.n); return (s && s.read.rel) || src; })();
    t.rows.forEach(r => {
        while (mediums.length <= r.mi) mediums.push({ format: (baseRel.mediums[mediums.length] || {}).format || 'Digital Media', name: (baseRel.mediums[mediums.length] || {}).name || '', tracks: [] });
        mediums[r.mi].tracks.push(ccSeedTrack(r));
    });
    t.extras.filter(x => CC.extraTake[x.id]).forEach(x => { if (!mediums.length) mediums.push({ format: 'Digital Media', name: '', tracks: [] }); mediums[mediums.length - 1].tracks.push(ccSeedTrack(x)); });
    mediums.forEach(md => md.tracks.forEach((x, i) => { x.number = i + 1; }));
    // every link of every platform taken, read or not (a platform read gives its own link types)
    const urls = [];
    CC.sources.filter(s => s.take).forEach(s => {
        const own = s.read.state === 'done' && s.read.rel.urls && s.read.rel.urls.length ? s.read.rel.urls : (s.links || [{ url: s.url }]).map(l => ({ url: l.url, linkType: l.linkTypeId || undefined }));   // unread: as Platform Check would add it
        if (s.read.state !== 'done') Log.cat('Consolidation').debug('link of ' + ccName(s.key) + ' (' + s.read.state + '): type ' + (own.map(u => u.linkType || 'MusicBrainz picks').join('+')) + ' · ' + s.url);
        own.forEach(u => { if (!urls.some(x => x.url === u.url && x.linkType === u.linkType)) urls.push({ url: u.url, linkType: u.linkType }); });
    });
    function ccSeedTrack(r) {
        const v = r.win, first = r.tracks.find(x => v.keys.includes(x.key) && x.t.title === v.title) || r.tracks[0];
        const credits = r.tracks.map(x => ({ key: x.key, provider: provOf(x.key), credit: x.t.credit }));
        const srcT = r.tracks.find(x => x.key === srcKey);
        return { title: v.title, lengthMs: v.len, isrc: v.isrc, url: srcT ? srcT.t.url : first.t.url, credit: ccLinked(first.t.credit, credits) };
    }
    return {
        title: f.title.win ? f.title.win.val : src.title,
        credit,
        types: typeG ? typeG.data || [] : src.types || [],
        status: 'official', packaging: 'None',
        date: f.date.win ? f.date.win.data : dateRel.date,
        country: src.country || 'XW',
        barcode: f.barcode.win ? f.barcode.win.show : null,
        labels, urls, mediums,
        annotation: src.annotation || null,
        script: src.script || null,
        url: src.url,
    };
}
function ccEditNote(m) {
    const lines = ['Consolidated by Mission Control from ' + m.reads.length + ' platform' + (m.reads.length === 1 ? '' : 's') + ':'];
    m.reads.forEach(s => lines.push(ccName(s.key) + (s.role === 'source' ? ' (source, read by First Contact)' : '') + ': ' + s.url));
    const unread = CC.sources.filter(s => s.take && s.read.state !== 'done');
    if (unread.length) lines.push('Linked, not read: ' + unread.map(s => ccName(s.key) + ' ' + s.url).join(', '));
    return lines.join('\n') + '\n\n' + ((typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.name) || 'Mission Control') + ' v' + VERSION + ' by majkinetor - https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mission_control/README.md';
}
function ccOpenEditor() {
    if (CC.seeded) return;
    const m = ccModel();
    if (!m.fields) { mbuToast('Nothing read yet', { kind: 'warn' }); return; }
    const rel = ccSeedRel(m);
    const n = ccCount(rel);
    Log.cat('Consolidation').info('open in the release editor: "' + rel.title + '" · ' + ccCredit(rel.credit) + ' · ' + n + ' track(s) · ' + rel.urls.length + ' link(s) · barcode ' + (rel.barcode || '—') + ' · ' + (rel.types || []).join('+'));
    rel.mediums.forEach((md, mi) => md.tracks.forEach((t, ti) => Log.cat('Consolidation').debug('  ' + (mi + 1) + '.' + (ti + 1) + ' "' + t.title + '" ' + ccLen(t.lengthMs) + ' ' + (t.isrc || '—') + ' · ' + ccCredit(t.credit) + ' · ' + t.credit.reduce((k, a) => k + (a.url ? 1 : 0) + (a.alt ? a.alt.length : 0), 0) + ' artist link(s)')));
    if (S.consAfter && (CC.ticks.is || CC.ticks.as || CC.ticks.pc)) {
        const isrcs = rel.mediums.flatMap(md => md.tracks.map(t => (CC.ticks.is && t.isrc) || null));
        try { sessionStorage.setItem(CC_AFTER_KEY, JSON.stringify({ created: Date.now(), title: rel.title, tracks: n, isrcs, ticks: CC.ticks })); } catch (e) { Log.cat('Consolidation').warn('after saving: not noted (' + e.message + ')'); }
        Log.cat('Consolidation').info('after saving: Mission Control opens on the new release · ' + Object.keys(CC.ticks).filter(k => CC.ticks[k]).join(', ') + ' · ' + isrcs.filter(Boolean).length + ' ISRC(s) taken');
    } else { try { sessionStorage.removeItem(CC_AFTER_KEY); } catch (e) { /* storage blocked */ } }
    let got = false;
    const on = e => { let d = null; try { d = JSON.parse(e.detail); } catch (x) { return; } if (d && d.run === CC.run) { got = true; document.removeEventListener('fc:seeded', on); Log.cat('Consolidation').ok('First Contact took the seed (handoff ' + d.token + ')'); } };
    document.addEventListener('fc:seeded', on);
    CC.seeded = true; ccPaintHeader();
    document.dispatchEvent(new CustomEvent('fc:seed', { detail: JSON.stringify({ rel, platform: CC.src.platform, editNote: ccEditNote(m), run: CC.run, dry: !!CC.dry }) }));
    setTimeout(() => { if (!got) { CC.seeded = false; ccPaintHeader(); Log.cat('Consolidation').err('First Contact did not take the seed: is it running on this page?'); mbuToast('First Contact did not answer: it seeds the release editor', { kind: 'error' }); } }, 3000);
    if (mbuTestHooks()) window.__mccLastSeed = { rel, note: ccEditNote(m) };
}

/* Copy as Markdown */

function ccMarkdown() {
    const m = ccModel();
    if (!m.fields) return '';
    const cell = s => String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const who = keys => keys.map(ccName).join(', ');
    const out = ['## ' + cell(m.fields.title.win ? m.fields.title.win.val : CC.src.rel.title) + ': ' + m.reads.length + ' platforms compared', '',
        m.reads.map(s => '[' + ccName(s.key) + '](' + s.url + ')').join(' · '), '', '| Field | Taken | Others |', '| --- | --- | --- |'];
    CC_FIELDS.forEach(([k, label]) => {
        const v = m.fields[k];
        out.push('| ' + label + ' | ' + (v.win ? cell(v.win.show) + ' (' + who(v.win.keys) + ')' : '—') + ' | ' + v.groups.filter(g => g !== v.win).map(g => cell(g.show) + ' (' + who(g.keys) + ')').join('<br>') + ' |');
    });
    out.push('', '| # | Title | Length | ISRC | Platforms | Others |', '| --- | --- | --- | --- | --- | --- |');
    m.tracks.rows.forEach((r, i) => {
        const w = r.win;
        out.push('| ' + (i + 1) + ' | ' + cell(w.title) + ' | ' + ccLen(w.len) + ' | ' + (w.isrc || '') + ' | ' + who(w.keys) + ' | '
            + r.versions.filter(v => v !== w).map(v => cell(v.title) + ' ' + ccLen(v.len) + ' ' + (v.isrc || '') + ' (' + who(v.keys) + ')').join('<br>') + ' |');
    });
    m.tracks.extras.forEach(x => out.push('| + | ' + cell(x.versions[0].title) + ' | ' + ccLen(x.versions[0].len) + ' | ' + (x.versions[0].isrc || '') + ' | ' + who(x.versions[0].keys) + ' | only there' + (CC.extraTake[x.id] ? ', taken' : ', left out') + ' |'));
    return out.join('\n');
}

/* UI */

function ccStepHtml(cls, title, n, ico) {
    return '<div class="mcc-step ' + cls + '">' + (ico || '') + '<div><b>' + esc(title) + '</b><span class="n">' + n + '</span></div></div>';
}
function ccPaintSteps() {
    const box = CC.ui && CC.ui.querySelector('.mcc-steps'); if (!box) return;
    const src = CC.sources[0];
    const lanes = ccLanes().filter(l => l.bc).length;
    const pcN = CC.sources.length - 1;
    const pc = CC.pc.state === 'busy' ? ccStepHtml('busy', 'Platform Check', '<span class="mcc-spin"></span> searching · ' + Math.round((Date.now() - CC.pc.at) / 1000) + ' s', '<img class="mc-sic" alt="" src="' + PROVIDER_ICONS.pc + '">')
        : CC.pc.state === 'none' ? ccStepHtml('err', 'Platform Check', 'not running on this page', '<img class="mc-sic" alt="" src="' + PROVIDER_ICONS.pc + '">')
        : CC.pc.state === 'wait' ? ccStepHtml('', 'Platform Check', 'waiting', '<img class="mc-sic" alt="" src="' + PROVIDER_ICONS.pc + '">')
        : ccStepHtml('', 'Platform Check', pcN + ' found · ' + lanes + ' barcode' + (lanes === 1 ? '' : 's'), '<img class="mc-sic" alt="" src="' + PROVIDER_ICONS.pc + '">');
    const want = CC.sources.filter(s => s.take && ccReadable(s.key)), done = want.filter(s => s.read.state === 'done').length, busy = want.some(s => s.read.state === 'reading' || s.read.state === 'queued');
    const failed = want.filter(s => s.read.state === 'failed').length;
    const fc = ccStepHtml(busy ? 'busy' : failed ? 'err' : '', 'First Contact', (busy ? '<span class="mcc-spin"></span> ' : '') + 'read ' + done + ' of ' + want.length + (failed ? ' · ' + failed + ' failed' : ''));
    box.innerHTML = mbuHtml(ccStepHtml('', 'Source', src ? esc(ccName(src.key)) + ' · ' + src.tracks + ' tracks' : '—', src ? ccIco(src.key, 16) : '') + '<span class="mcc-arrow">→</span>' + pc + '<span class="mcc-arrow">→</span>' + fc);
}
// the format the release would get: the source's media, as the seed gives them
function ccFormat() {
    const md = CC.src && CC.src.rel && Array.isArray(CC.src.rel.mediums) ? CC.src.rel.mediums : [];
    return md.map(m => m.format || 'Digital Media').join(' + ') || 'Digital Media';
}
function ccPaintHeader() {
    if (!CC.ui) return;
    const m = ccModel();
    const t = CC.ui.querySelector('.mcc-ttl'), sub = CC.ui.querySelector('.mcc-sub');
    const title = m.fields && m.fields.title.win ? m.fields.title.win.val : CC.src ? CC.src.rel.title : 'Consolidate';
    const artist = m.fields && m.fields.artist.win ? m.fields.artist.win.val : CC.src ? ccCredit(CC.src.rel.credit) : '';
    if (t) { t.textContent = title; t.dataset.tip = title; }
    const slot = CC.ui.querySelector('.mcc-fmt-slot'), fmt = ccFormat();
    if (slot && slot.dataset.fmt !== fmt) { slot.dataset.fmt = fmt; slot.innerHTML = mbuHtml(fmtIcon(fmt) || '<img src="' + ICON_URL + '" alt="" width="28" height="28">'); }
    if (sub) { sub.textContent = artist; sub.dataset.tip = artist; }   // majkinetor: only the artist; the Source step links the platform
    CC.ui.querySelectorAll('[data-cc="open"]').forEach(b => { b.disabled = !m.fields || CC.seeded; b.textContent = CC.seeded ? 'Opening the release editor…' : 'Add release →'; });
    CC.ui.querySelectorAll('[data-cc="more"]').forEach(b => { b.disabled = !m.fields || CC.seeded; });
    ccPaintSteps();
}
// PC's reasons, short for a source row: "5 tracks, the release has 6" → "5 tracks, not 6",
// "Digital, the release is CD" → "Digital, not CD"
const ccMismatch = list => list.map(x => String(x).replace(/, the release (?:has|is) /, ', not ')).join(' · ');
function ccSideHtml() {
    if (!CC.src) return '';
    const lanes = ccLanes();
    const srcTracks = CC.sources[0].tracks;
    let h = '<div class="mcc-h">Sources</div>';
    lanes.forEach(l => {
        h += '<div class="mcc-lane" data-bc="' + esc(l.bc) + '">' + (l.bc ? '<span class="mcc-bc' + (l.own ? ' own' : '') + '" data-tip="' + (l.own ? 'The source\'s barcode' : 'Another barcode\nAnother release') + '">' + esc(l.shown) + '</span>' : l.own ? '<div class="mcc-lane-note">no barcode</div>' : '');   // the other no-barcode lane's note says it
        if (!l.own && l.bc) h += '<div class="mcc-lane-note">another release</div>';
        else if (!l.bc && !l.own) h += '<div class="mcc-lane-note">no barcode shown: selected when it matches the source\'s track count (' + srcTracks + '), format, track titles and lengths</div>';
        l.list.forEach(s => {
            const r = s.read;
            const meta = s.role === 'source' ? ['', 'source · ' + s.tracks + ' tracks']
                : !s.take ? [r.other ? 'warn' : '', r.other || (s.mismatch && s.mismatch.length ? ccMismatch(s.mismatch) : s.tracks != null ? s.tracks + ' tracks' : '')]
                : !ccReadable(s.key) ? ['warn', 'link only']
                : r.state === 'reading' ? ['busy', 'reading' + (r.total ? ' ' + r.n + '/' + r.total : '…')]
                : r.state === 'queued' ? ['busy', 'waiting']
                : r.state === 'failed' ? ['err', 'failed']
                : r.state === 'done' ? ['', ccCount(r.rel) + ' tracks' + (r.rel.mediums.some(md => md.tracks.some(t => t.isrc)) ? ' · ISRCs' : '')]
                : ['', s.tracks != null ? s.tracks + ' tracks' : ''];
            const tip = s.role === 'source' ? 'The album First Contact read\n' + s.url
                : (meta[1] ? meta[1] + '\n' : '') + (CC_UNREAD[s.key] || (r.state === 'failed' ? 'Reading it failed: ' + r.error : s.why || '')) + '\n' + s.url;   // the note in full: the row may cut it short
            h += '<label class="mcc-src' + (s.take ? '' : ' off') + (s.role === 'source' ? ' source' : '') + '" data-tip="' + esc(tip.trim()) + '">'
                + '<input type="checkbox" data-cc="take" data-k="' + esc(s.key) + '"' + (s.take ? ' checked' : '') + (s.role === 'source' ? ' disabled' : '') + '>'
                + ccIco(s.key, 15) + '<span class="nm"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(ccName(s.key)) + '</a></span><span class="meta ' + meta[0] + '">' + esc(meta[1]) + '</span></label>';
        });
        h += '</div>';
    });
    if (CC.pc.state === 'busy') h += '<div class="mcc-lane-note"><span class="mcc-spin"></span> Platform Check is searching the other platforms…</div>';
    if (CC.pc.state === 'none') h += '<div class="mcc-lane-note">Platform Check isn\'t running on this page, so only the source is compared.</div>';
    h += '<div class="mcc-lane-note">Unselect a platform to leave out its values and its link.</div>';
    return h;
}
function ccPaintSide() { const s = CC.ui && CC.ui.querySelector('.mcc-side'); if (s) s.innerHTML = mbuHtml(ccSideHtml()); }
function ccFieldsHtml(m) {
    const f = m.fields;
    const differ = CC_FIELDS.filter(([k]) => f[k].groups.length > 1).length;
    let h = '<section class="mcc-sect' + (CC.closed.has('release') ? ' closed' : '') + '" data-sect="release"><div class="mcc-sect-h"' + ccSectHead('release') + '>' + ccInSvg('chev', 14, 'chev') + '<b>Release</b><span class="hint">the value most platforms give is taken; click another to take it instead</span>'
        + (differ ? '<span class="mcc-chip warn">' + differ + ' differ</span>' : '<span class="mcc-chip ok">all agree</span>') + '</div><div class="mcc-fields">';
    CC_FIELDS.forEach(([k, label]) => {
        const v = f[k], n = v.groups.length;
        h += '<div class="mcc-f' + (n > 1 ? ' differ' : '') + '" data-field="' + k + '"><div class="mcc-f-h">' + esc(label) + (n > 1 ? '<span class="mcc-n">' + n + '</span>' : '') + (v.hand ? '<span class="weak" style="text-transform:none;letter-spacing:0;font-weight:400">taken by hand</span>' : '') + '</div>';
        if (!v.win) h += '<div class="none">no platform gives one</div>';
        else {
            // majkinetor: the dates earliest first, in two columns (they took a lot of space), the icons on the
            // value's line and lined up: each date takes the longest one's width, so a short one keeps its space
            const alts = v.groups.filter(g => g !== v.win);
            // majkinetor: what an other value has that the taken one hasn't, highlighted
            const show = g => g === v.win ? esc(g.show) : ccTitleDiff(String(g.show), String(v.win.show));
            // majkinetor: the platforms that give none follow on the value's line, greyed like Platform Check's strip
            const none = v.none.length ? '<span class="mcc-none-sep"></span><span class="mcc-icos mcc-none-icos">' + v.none.map(k2 => '<span data-tip="None from ' + esc(ccName(k2)) + '">' + ccIco(k2, 13) + '</span>').join('') + '</span>' : '';
            const take = g => ' data-cc="field" data-f="' + k + '" data-v="' + esc(g.val) + '" data-tip="Take this instead"';
            if (k === 'date') {
                const w = ' style="min-width:' + (Math.max(...v.groups.map(g => String(g.show).length)) + 1) + 'ch"';
                const val = g => '<span class="d"' + w + '><span>' + show(g) + '</span></span>' + ccIcons(g.keys);   // the slot in one font for all, so the taken (larger) date lines up too
                h += '<div class="mcc-win lined">' + (alts.length ? '<span class="r on"></span>' : '') + '<span class="v">' + val(v.win) + none + '</span></div>';
                alts.sort((a, b) => String(a.val).localeCompare(String(b.val)));
                h += '<div class="mcc-alts two" style="grid-template-rows:repeat(' + Math.ceil(alts.length / 2) + ',auto)">';   // down the first column, then the second
                alts.forEach(g => { h += '<div class="mcc-alt"' + take(g) + '><span class="r"></span><span class="v">' + val(g) + '</span></div>'; });
                h += '</div>';
            } else {
                // majkinetor: one row per value, the taken one's radio too, so every value starts at
                // one edge; the icons in a column of their own, at the right
                const mono = k === 'barcode' ? ' mono' : '';
                const row = (g, on) => '<div class="mcc-row ' + (on ? 'mcc-win"' : 'mcc-alt"' + take(g)) + '>' + (alts.length ? '<span class="r' + (on ? ' on' : '') + '"></span>' : '')
                    + '<span class="v' + mono + '">' + show(g) + '</span><span class="i">' + ccIcons(g.keys) + (on ? none : '') + '</span></div>';
                h += '<div class="mcc-rows' + (alts.length ? '' : ' one') + '">' + row(v.win, true) + alts.map(g => row(g, false)).join('') + '</div>';
            }
        }
        h += '</div>';
    });
    return h + '</div></section>';
}
function ccTracksHtml(m) {
    const t = m.tracks;
    // a row that differs, the first time it shows, opens into its versions when the setting says so; closed by hand, it stays closed
    t.rows.forEach(r => { if (r.versions.length > 1 && !CC.seen.has(r.id)) { CC.seen.add(r.id); if (S.ccDiffOpen) CC.open.add(r.id); } });
    const agree = t.rows.filter(r => r.versions.length === 1).length, differ = t.rows.length - agree;
    let h = '<section class="mcc-sect' + (CC.closed.has('tracks') ? ' closed' : '') + '" data-sect="tracks"><div class="mcc-sect-h"' + ccSectHead('tracks') + '>' + ccInSvg('chev', 14, 'chev') + '<b>Tracks</b><span class="hint">one row per track, the version most platforms have · a row that differs opens into its versions</span>'
        + '<span class="mcc-chip ok">' + agree + ' agree</span>' + (differ ? (() => { const all = t.rows.every(r => r.versions.length === 1 || CC.open.has(r.id)); return '<button type="button" class="mcc-chip warn mcc-chip-btn" data-cc="differ" aria-expanded="' + all + '" data-tip="' + (all ? 'Close' : 'Open') + ' every track that differs">' + differ + ' differ <span class="mcc-caret">' + (all ? '▾' : '▸') + '</span></button>'; })() : '') + (t.extras.length ? '<span class="mcc-chip">' + t.extras.length + ' only on one</span>' : '') + '</div>'
        + '<table class="mcc-tbl"><thead><tr><th>#</th><th>Title</th><th>Len</th><th>ISRC</th><th>Agree</th><th></th></tr></thead><tbody>';
    const nM = new Set(t.rows.map(r => r.mi)).size;
    t.rows.forEach((r, i) => {
        const w = r.win, many = r.versions.length > 1, op = CC.open.has(r.id);
        h += '<tr class="row' + (CC.sel === r.id ? ' sel' : '') + '" data-cc="row" data-r="' + r.id + '"><td class="pos">' + (nM > 1 ? (r.mi + 1) + '.' + (r.ti + 1) : i + 1) + '</td><td class="ttl">' + esc(w.title) + '</td><td class="len">' + ccLen(w.len) + '</td><td class="isrc">' + (w.isrc ? isrcHtml(w.isrc) : '—') + '</td>'
            + '<td>' + ccIcons(w.keys) + '</td><td class="vers">' + (many ? '<span class="mcc-chip warn">' + r.versions.length + ' versions</span>' : '') + '</td></tr>';
        if (many && op) r.versions.forEach(v => {
            const d = v === w ? [] : ccDiff(v, w);
            h += '<tr class="ver' + (v === w ? ' on' : '') + '" data-cc="ver" data-r="' + r.id + '" data-k="' + esc(v.keys[0]) + '"><td></td><td><span class="r"></span>' + ccTitleDiff(v.title, w.title) + (d.length ? ' <span class="why">· ' + esc(d.join(', ')) + '</span>' : '') + '</td>'
                + '<td class="len">' + (v.len && w.len && Math.abs(v.len - w.len) > 1000 ? '<span class="hl">' + ccLen(v.len) + '</span>' : ccLen(v.len)) + '</td><td class="isrc">' + (v.isrc && w.isrc && v.isrc !== w.isrc ? '<span class="hl">' + isrcHtml(v.isrc) + '</span>' : v.isrc ? isrcHtml(v.isrc) : 'none') + '</td><td>' + ccIcons(v.keys) + '</td><td></td></tr>';
        });
    });
    t.extras.forEach(x => {
        const v = x.versions[0], on = !!CC.extraTake[x.id];
        h += '<tr class="row extra' + (on ? ' on' : '') + '" data-cc="extra" data-x="' + x.id + '" data-tip="' + (on ? 'Taken in, at the end\nClick: leave it out' : 'Only ' + v.keys.map(ccName).join(', ') + ' has it\nClick: take it in') + '"><td class="pos">+</td><td class="ttl">' + esc(v.title) + '</td><td class="len">' + ccLen(v.len) + '</td><td class="isrc">' + (v.isrc ? isrcHtml(v.isrc) : '—') + '</td><td><span class="mcc-chip">only ' + esc(v.keys.map(ccName).join(', ')) + '</span></td><td></td></tr>';
    });
    return h + '</tbody></table></section>';
}
function ccPaintCenter() {
    const c = CC.ui && CC.ui.querySelector('.mcc-center'); if (!c) return;
    if (CC.error) { c.innerHTML = mbuHtml('<div class="mcc-err"><b>Nothing to consolidate</b><p>' + esc(CC.error) + '</p><p>Use <b>Consolidate</b> on the album\'s page on a platform (First Contact) to start again.</p></div>'); return; }
    if (!CC.src) { c.innerHTML = mbuHtml('<div class="mcc-note"><span class="mcc-spin"></span> Waiting for First Contact to hand over the album…</div>'); return; }
    const m = ccModel();
    if (!m.fields) { c.innerHTML = mbuHtml('<div class="mcc-note">Nothing read yet.</div>'); return; }
    c.innerHTML = mbuHtml(ccInMbHtml() + ccFieldsHtml(m) + ccTracksHtml(m)
        + '<div class="mcc-note"><b>Add release</b> opens MusicBrainz\'s release editor, filled in with the release fields, the tracklist and the links of the selected platforms. Apollo uses the artists\' platform links to find them in MusicBrainz. '
        + (S.consAfter ? 'After you save, Mission Control opens on the new release to add what the editor can\'t: the boxes on the right.' : 'Mission Control doesn\'t open after saving (⚙).') + '</div>');
}
function ccPaintInspector() {
    const box = CC.ui && CC.ui.querySelector('.mcc-insp'); if (!box) return;
    const m = CC.src ? ccModel() : null;
    let h = '';
    const r = m && m.fields && m.tracks.rows.concat(m.tracks.extras).find(x => x.id === CC.sel);
    if (r) {
        const w = r.win;
        // majkinetor: "this report kinda looks messy". A version a card of the same two lines: the title,
        // then length and ISRC; what sets it apart from the one taken highlighted; the platforms as icons
        // (their names in the tooltip) with a count. A click takes it, as in the Tracks table.
        h += '<div class="mcc-h mcc-vh"><span>Track ' + (r.i != null ? r.i + 1 : '+') + ' · ' + esc(w.title) + '</span>' + (r.versions.length > 1 ? '<span class="weak">' + r.versions.length + ' versions</span>' : '') + '</div><div class="mcc-vers">';
        const hl = x => '<span class="hl">' + esc(x) + '</span>';
        r.versions.forEach(v => {
            const on = v === w, title = on ? esc(v.title) : ccTitleDiff(v.title, w.title);
            const len = !on && v.len && w.len && Math.abs(v.len - w.len) > 1000 ? hl(ccLen(v.len)) : esc(ccLen(v.len) || '?:??');
            const isrc = !v.isrc ? (on || !w.isrc ? 'no ISRC' : hl('no ISRC')) : !on && w.isrc && v.isrc !== w.isrc ? '<span class="hl">' + isrcHtml(v.isrc) + '</span>' : isrcHtml(v.isrc);
            h += '<div class="mcc-ver' + (on ? ' on' : '') + '"' + (on || r.versions.length < 2 ? '' : ' data-cc="ver" data-r="' + esc(r.id) + '" data-k="' + esc(v.keys[0]) + '" data-tip="Take this version"') + '>'
                + '<span class="r"></span><div class="t">' + title + '</div><span class="n">' + (on ? 'taken · ' : '') + v.keys.length + '</span>'
                + '<div class="m"><span class="mono">' + len + ' · ' + isrc + '</span><span class="i" data-tip="' + esc(v.keys.map(ccName).join(', ')) + '">' + ccIcons(v.keys) + '</span></div></div>';
        });
        h += '</div>';
        const cr = r.tracks.map(x => x.key + ': ' + ccCredit(x.t.credit)).filter((s, i, a) => a.findIndex(y => y.split(': ')[1] === s.split(': ')[1]) === i);
        h += '<div class="mcc-h">Artist</div><p>' + esc(cr.map(s => { const [k, c] = s.split(': '); return c + ' (' + ccName(k) + ')'; }).join(' · ')) + '</p>';
    } else if (m && m.fields) h += '<div class="mcc-h">Track</div><p>Click a track to see what each platform gives for it.</p>';
    const nIsrc = m && m.fields ? m.tracks.rows.filter(x => x.win.isrc).length : 0;
    h += '<div class="mcc-h">After saving</div>';
    if (!S.consAfter) h += '<p>Off in the settings (⚙): Mission Control doesn\'t open on the new release.</p>';
    else {
        const tick = (k, text) => '<label class="mcc-tick"><input type="checkbox" data-cc="tick" data-t="' + k + '"' + (CC.ticks[k] ? ' checked' : '') + '><span>' + text + '</span></label>';
        h += '<p>Mission Control opens on the new release and probes it; these start taken in:</p>'
            + tick('is', 'ISRCs (' + nIsrc + ' taken here) and recording links, through ISRC Scout')
            + tick('as', 'Cover: the best one of the linked platforms, through Art Station')
            + tick('pc', 'Artist and label links, through Platform Check and Falcon');
    }
    box.innerHTML = mbuHtml(h);
}
function ccPaint() { if (!CONS) { cmpProgress(); return; } ccPaintHeader(); ccPaintSide(); ccPaintCenter(); ccPaintInspector(); }

// Add release's ▾ menu (Copy as Markdown). A mousedown outside closes it and swallows the click it
// starts, so that click doesn't also tick or open what is under it; Escape closes it too.
function ccMenu(open) {
    const menu = CC.ui && CC.ui.querySelector('.mcc-menu'), more = CC.ui && CC.ui.querySelector('[data-cc="more"]');
    if (!menu) return;
    const show = open === undefined ? menu.hidden : open;
    menu.hidden = !show; more.setAttribute('aria-expanded', String(show));
    document.removeEventListener('mousedown', ccMenuOutside, true); document.removeEventListener('keydown', ccMenuKey, true);
    if (show) { document.addEventListener('mousedown', ccMenuOutside, true); document.addEventListener('keydown', ccMenuKey, true); }
}
function ccMenuOutside(e) {
    if (e.target.closest && e.target.closest('.mcc-split')) return;
    ccMenu(false);
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', swallow, true), 400);
}
function ccMenuKey(e) { if (e.key === 'Escape') { e.stopPropagation(); ccMenu(false); } }
// a section's heading opens and closes it; a right-click opens or closes them all (all open when one is closed)
function ccToggleSect(id, all) {
    const ids = [...CC.ui.querySelectorAll('[data-cc="sect"]')].map(x => x.dataset.s);
    if (all) { const open = ids.some(x => CC.closed.has(x)); ids.forEach(x => open ? CC.closed.delete(x) : CC.closed.add(x)); Log.cat('Consolidation').info('every section ' + (open ? 'opened' : 'closed')); }
    else { CC.closed.has(id) ? CC.closed.delete(id) : CC.closed.add(id); Log.cat('Consolidation').info('section ' + id + ' ' + (CC.closed.has(id) ? 'closed' : 'opened')); }
    ccPaintCenter();
}
const ccSectHead = id => ' data-cc="sect" data-s="' + id + '" aria-expanded="' + !CC.closed.has(id) + '" data-tip="Open or close this section\nRight-click: open or close every section"';
function ccOnClick(e) {
    const t = e.target;
    const a = t.closest('[data-cc]');
    if (!a) return;
    switch (a.dataset.cc) {
        case 'take': {
            const s = CC.sources.find(x => x.key === a.dataset.k);
            if (!s || s.role === 'source') return;
            s.take = a.checked; s.hand = true;
            Log.cat('Consolidation').info(ccName(s.key) + (s.take ? ' taken in' : ' left out') + ' by hand');
            if (s.take) ccReadTaken(); else ccPaint();
            return;
        }
        case 'field': CC.pick[a.dataset.f] = a.dataset.v; Log.cat('Consolidation').info('field ' + a.dataset.f + ' taken by hand: ' + a.dataset.v); ccPaint(); return;
        case 'row': {
            const id = a.dataset.r;
            if (t.closest('a')) return;
            CC.sel = id;
            if (CC.open.has(id)) CC.open.delete(id); else CC.open.add(id);
            ccPaintCenter(); ccPaintInspector();
            return;
        }
        case 'differ': {
            const rows = ccModel().tracks.rows.filter(r => r.versions.length > 1), all = rows.every(r => CC.open.has(r.id));
            rows.forEach(r => all ? CC.open.delete(r.id) : CC.open.add(r.id));
            Log.cat('Consolidation').info((all ? 'closed ' : 'opened ') + rows.length + ' track(s) that differ');
            ccPaintCenter();
            return;
        }
        case 'ver': CC.rowPick[a.dataset.r] = a.dataset.k; CC.sel = a.dataset.r; Log.cat('Consolidation').info('track ' + a.dataset.r + ': ' + ccName(a.dataset.k) + '\'s version taken'); ccPaint(); return;
        case 'extra': CC.extraTake[a.dataset.x] = !CC.extraTake[a.dataset.x]; CC.sel = a.dataset.x; ccPaint(); return;
        case 'tick': CC.ticks[a.dataset.t] = a.checked; Log.cat('Consolidation').info('after saving: ' + a.dataset.t + ' ' + (a.checked ? 'on' : 'off')); ccPaintInspector(); return;
        case 'open': ccOpenEditor(); return;
        case 'update': ccUpdateRelease(a.dataset.id); return;
        case 'sect': ccToggleSect(a.dataset.s); return;
        case 'more': ccMenu(); return;
        case 'md': {
            ccMenu(false);
            const md = ccMarkdown();
            if (mbuTestHooks()) window.__mccMarkdown = md;
            navigator.clipboard.writeText(md).then(() => mbuToast('Copied as Markdown', { kind: 'ok' }), x => mbuToast('Copy failed: ' + x.message, { kind: 'error' }));
            return;
        }
        case 'cfg': ccSettings(); return;
        case 'close': ccClose(); return;
        case 'log': Log.open(); return;
    }
}
function ccSettings() {
    const ov = el('div', 'mbu-ov');
    const panel = el('div', 'mbu-ov-panel mc-cfg');
    panel.style.width = 'min(640px, 94vw)';
    panel.innerHTML = mbuHtml('<div class="mbu-ov-body">' + mbuCfgHeader({ script: 'mission_control', name: 'Mission Control', version: VERSION, icon: '<img src="' + ICON_URL + '" alt="">', log: true })
        + '<label><input type="checkbox" data-k="consAfter"' + (S.consAfter ? ' checked' : '') + '>After saving a consolidated release, open Mission Control on it</label>'
        + consExecHtml()
        + '<label><input type="checkbox" data-k="ccDiffOpen"' + (S.ccDiffOpen ? ' checked' : '') + '>Show track differences by default</label>' + '</div>');
    ov.appendChild(panel);
    document.body.appendChild(ov);
    const off = mbuDismissOn(panel, () => ov.remove());
    consStep(panel);
    panel.querySelector('.mbu-cfg-log').onclick = () => { off(); Log.open(); };   // #744, as in settingsWindow
    panel.addEventListener('change', e => { const k = e.target.dataset.k; if (!k) return; S[k] = e.target.checked; saveSettings(); if (k === 'consAfter') consSub(panel); ccPaint(); });
}
function ccClose() {
    if (!CC.ui) return;
    CC.ui.remove(); CC.ui = null;
    ccLeaveQuiet(false);
    document.documentElement.style.overflow = '';
    ccLauncher();
    Log.cat('Consolidation').info('consolidation closed (the launcher opens it again)');
}
function ccLauncher() {
    if (document.getElementById('mc-launch')) return;
    mcStyle();
    const b = el('button', 'mc-launch'); b.id = 'mc-launch'; b.type = 'button';
    const img = document.createElement('img'); img.src = ICON_URL; img.alt = ''; b.appendChild(img); b.dataset.tip = 'Mission Control — the consolidation';
    b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = '5'; b.dataset.mbCornerLabel = 'Mission Control'; b.dataset.mbCornerPaths = '^/release/';   // its @match
    b.onclick = () => { if (mcElsewhere()) return; b.remove(); mbRestackCorner('br'); ccOpen(); };
    document.body.appendChild(b);
    mbRestackCorner('br');
}
let ccClock = 0;
// majkinetor: the browser asked "leave page?" with nothing changed. MB's release editor under the review warns on
// beforeunload once the page has had a click, unless rootField.redirecting (its own flag for leaving on purpose).
// Nothing is typed into the editor while the review covers it, so the flag stays on until the review is closed
// (the editor is then the user's). The editor binds late: tried again for a while if it isn't there yet.
function ccLeaveQuiet(on, tries) {
    try {
        const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        const rf = w.MB && w.MB.releaseEditor && w.MB.releaseEditor.rootField;
        if (rf) { rf.redirecting = on; Log.cat('Consolidation').debug('release editor: leave-page warning ' + (on ? 'off while the review covers it' : 'on again')); return; }
        if (!on) return;
        if ((tries || 0) < 20) { setTimeout(() => { if (CC.ui) ccLeaveQuiet(true, (tries || 0) + 1); }, 500); return; }
        Log.cat('Consolidation').warn('no MB.releaseEditor.rootField here: the browser may ask before leaving');
    } catch (e) { Log.cat('Consolidation').warn('could not turn the release editor\'s leave-page warning ' + (on ? 'off' : 'on') + ': ' + e.message); }
}
function ccOpen() {
    if (CC.ui) return;
    ccLeaveQuiet(true);
    mcStyle(); ccStyle();
    const ui = el('div', 'mbu-ui'); ui.id = 'mcc-root';
    ui.innerHTML = mbuHtml('<header class="mcc-hdr"><span class="mcc-fmt-slot"></span><div class="mcc-rel"><div class="mcc-ttl"></div><div class="mcc-sub"></div></div><div class="mcc-steps"></div>'
        + '<div class="mcc-split"><button type="button" class="mcc-btn go" data-cc="open" disabled data-tip="Open MusicBrainz\'s release editor in this tab\nFilled in with what is taken here">Add release →</button>'
        + '<button type="button" class="mcc-btn go mcc-more" data-cc="more" disabled aria-haspopup="menu" aria-expanded="false" data-tip="More">▾</button>'
        + '<div class="mcc-menu" role="menu" hidden><button type="button" role="menuitem" data-cc="md" data-tip="Copy the whole comparison as Markdown tables\nFor an issue or an edit note">Copy as Markdown</button></div></div>'
        + '<button type="button" class="mcc-btn ghost" data-cc="cfg" data-tip="Settings">' + MBU_CFG_ICON + '</button><button type="button" class="mcc-btn ghost" data-cc="close" data-tip="Close\nThe empty release editor is under it.">✕</button></header>'
        + '<div class="mcc-main"><aside class="mcc-side"></aside><main class="mcc-center"></main><aside class="mcc-insp"></aside></div>');
    document.body.appendChild(ui);
    CC.ui = ui;
    document.documentElement.style.overflow = 'hidden';
    ui.addEventListener('click', ccOnClick);
    ui.addEventListener('contextmenu', e => { const a = e.target.closest('[data-cc="sect"]'); if (!a) return; e.preventDefault(); ccToggleSect(a.dataset.s, true); });
    clearInterval(ccClock);
    ccClock = setInterval(() => {
        if (!CC.ui) return;
        // a read that hasn't been heard from in a while has failed (First Contact gone, or a request that hangs)
        CC.sources.forEach(s => { if (s.read.state === 'reading' && Date.now() - s.read.at > CC_READ_WAIT) { s.read = { state: 'failed', error: 'no answer in ' + CC_READ_WAIT / 1000 + ' s' }; Log.cat('Consolidation').warn('read ' + ccName(s.key) + ': no answer'); pcVetFailed(s); ccPump(); } });
        if (CC.pc.state === 'busy') ccPaintSteps();
    }, 1000);
    ccPaint();
}

// the album First Contact stored for this page
function ccTake(json, from) {
    let h = null;
    try { h = JSON.parse(json || 'null'); } catch (e) { Log.cat('Consolidation').warn('consolidation unreadable: ' + e.message); return; }
    if (!h || h.token !== CC.token || CC.src) return;
    if (h.error) { CC.error = h.error; Log.cat('Consolidation').warn('consolidation ' + CC.token + ': ' + h.error); ccPaint(); return; }
    CC.src = h;
    CC.error = null;
    Log.cat('Consolidation').info('consolidation ' + CC.token + ' (' + from + '): ' + h.sourceName + ' "' + h.rel.title + '" by ' + ccCredit(h.rel.credit) + ' · ' + ccCount(h.rel) + ' track(s) · barcode ' + (h.rel.barcode || '—') + ' · ' + h.url);
    ccBuildSources();
    ccPaint();
    ccAskPc();
}
// Platform Check's seed probe, as soon as both the album and Platform Check are here
function ccAskPc() {
    if (!CC.src || CC.pc.state !== 'wait' || !found.pc) return;
    CC.pc = { state: 'busy', note: '', findings: [], at: Date.now() };
    const seed = ccSeed();
    Log.cat('Platforms').info('asking Platform Check (seed probe ' + CC.run + '): ' + JSON.stringify(seed));
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ run: CC.run, only: ['pc'], seed }) }));
    ccPaint();
}
document.addEventListener('mc:findings', e => {
    if (!CC.token) return;
    let d; try { d = JSON.parse(e.detail); } catch (x) { return; }
    if (!d || d.id !== 'pc' || d.run !== CC.run) return;
    CC.pc = { state: 'done', note: '', findings: Array.isArray(d.findings) ? d.findings : [], at: CC.pc.at };
    Log.cat('Platforms').ok('Platform Check answered in ' + Math.round((Date.now() - CC.pc.at) / 1000) + ' s: ' + CC.pc.findings.filter(f => f.url).length + ' platform(s) found');
    ccBuildSources();
    ccReadTaken();
    ccCheckInMb();
});
// majkinetor approved this request on #702: one /ws/2/url lookup (inc=release-rels) of every album
// link found, 50 to a request, so a release MusicBrainz already has gets a banner, not a second copy.
// Several links answer { urls: [...] } and leave out the ones MB doesn't know; one answers the url itself, or 404.
async function ccCheckInMb() {
    const urls = [...new Set(CC.sources.map(s => s.url).filter(Boolean))];
    const key = urls.join(' ');
    if (!urls.length || CC.inMb.urls === key) return;
    CC.inMb = { state: 'busy', urls: key, releases: [] };
    Log.cat('Consolidation').info('MusicBrainz: does it have this album? looking up ' + urls.length + ' link(s)');
    try {
        const by = new Map();
        for (let i = 0; i < urls.length; i += 50) {
            const part = urls.slice(i, i + 50);
            const r = await mbnFetch('/ws/2/url?' + part.map(u => 'resource=' + encodeURIComponent(u)).join('&') + '&inc=release-rels&fmt=json', { headers: { Accept: 'application/json' } });
            if (!r) throw new Error('the request gate gave up (MusicBrainz is throttling)');
            if (r.status === 404) continue;
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const j = await r.json();
            (Array.isArray(j.urls) ? j.urls : [j]).forEach(u => (u.relations || []).forEach(rel => {
                const x = rel.release; if (!x || !x.id) return;
                const e = by.get(x.id) || { id: x.id, title: x.title || '', disamb: x.disambiguation || '', date: x.date || '', barcode: x.barcode || '', urls: [] };
                if (!e.urls.includes(u.resource)) e.urls.push(u.resource);
                by.set(x.id, e);
            }));
        }
        if (CC.inMb.urls !== key) return;
        // majkinetor: "MB has it, but check format too". The url lookup gives no media, so each release
        // found (one or two, as a rule) is looked up for its format and track count.
        for (const e of by.values()) {
            const r = await mbnFetch('/ws/2/release/' + e.id + '?inc=media&fmt=json', { headers: { Accept: 'application/json' } });
            if (!r || !r.ok) { Log.cat('Consolidation').warn('MusicBrainz: release ' + e.id + ' answered ' + (r ? 'HTTP ' + r.status : 'nothing (throttled)') + ': its format is unknown'); continue; }
            const j = await r.json();
            e.format = (j.media || []).map(m => m.format || '(unknown format)').join(' + ');
            e.tracks = (j.media || []).reduce((n, m) => n + (m['track-count'] || 0), 0);
        }
        if (CC.inMb.urls !== key) return;
        by.forEach(e => { e.same = ccSameRelease(e); });
        CC.inMb = { state: 'done', urls: key, releases: [...by.values()].sort((a, b) => b.same - a.same || b.urls.length - a.urls.length) };
        if (CC.inMb.releases.length) Log.cat('Consolidation')[CC.inMb.releases.some(e => e.same) ? 'warn' : 'info']('MusicBrainz has ' + CC.inMb.releases.length + ' release(s) these links belong to: ' + CC.inMb.releases.map(e => e.id + ' "' + e.title + '" ' + (e.format || '?') + ', ' + (e.tracks == null ? '?' : e.tracks) + ' tracks, barcode ' + (e.barcode || 'none') + ' (' + e.urls.length + ' link(s)) → ' + (e.same ? 'this album' : 'another edition')).join(', '));
        else Log.cat('Consolidation').ok('MusicBrainz has none of the ' + urls.length + ' link(s): a new release');
    } catch (e) {
        if (CC.inMb.urls !== key) return;
        CC.inMb = { state: 'failed', urls: key, releases: [], error: e.message };
        Log.cat('Consolidation').warn('MusicBrainz lookup of the album links failed: ' + e.message);
    }
    ccPaintCenter();
}
// A release is this album when nothing tells it apart from the source: its barcode (leading zeros
// aside), its formats (Digital Media, CD, vinyl, … in kind) and its track count, each where both give one.
const ccFmtKind = f => String(f || '').split('+').map(x => { x = x.trim(); return /digital/i.test(x) ? 'digital' : /\bcd\b|compact disc|hdcd|sacd/i.test(x) ? 'cd' : /vinyl|"|\blp\b/i.test(x) ? 'vinyl' : /cassette/i.test(x) ? 'cassette' : x.toLowerCase(); }).sort().join('+');
function ccSameRelease(e) {
    const src = CC.sources[0] || {};
    const bc = x => String(x || '').replace(/^0+/, '');
    if (e.barcode && src.barcode && bc(e.barcode) !== bc(src.barcode)) return false;
    if (e.format && !/unknown/.test(e.format) && ccFmtKind(e.format) !== ccFmtKind(ccFormat())) return false;
    if (e.tracks && src.tracks && e.tracks !== src.tracks) return false;
    return true;
}
// #727: the consolidation goes to a release MusicBrainz already has. Noted in this tab's sessionStorage
// as for Add release, with the release's MBID: its page opens Mission Control and probes, ISRC Scout
// gets the ISRCs, and Platform Check the barcode, the catalog numbers and the platforms' links (cons),
// each offered only where the release lacks it.
// #782: nothing read here goes with it: the release page compares the release with the platforms itself (its
// Platforms step, run at once), so only the After saving ticks go
function ccUpdateRelease(mbid) {
    const e = CC.inMb.releases.find(x => x.id === mbid);
    const note = { created: Date.now(), mbid, title: (e && e.title) || '', ticks: CC.ticks, compare: true };
    Log.cat('Consolidation').info('update release ' + mbid + ': it opens and compares itself with the platforms · taken in: ' + (Object.keys(CC.ticks).filter(k => CC.ticks[k]).join(', ') || 'none'));
    if (mbuTestHooks()) window.__mccLastUpdate = note;
    try { sessionStorage.setItem(CC_AFTER_KEY, JSON.stringify(note)); } catch (x) { Log.cat('Consolidation').err('the update is not noted (' + x.message + ')'); mbuToast('Could not note the update: ' + x.message, { kind: 'error' }); return; }
    if (CC.dry) { Log.cat('Consolidation').info('dry run: the release is not opened'); return; }
    location.assign('/release/' + mbid);
}
// the panel's own glyphs: the column heads and, in a narrow panel, each value
const CC_INMB_SVG = {
    dup: '<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/><rect x="8" y="8" width="12" height="12" rx="2"/><path d="m11 14 2 2 4-4"/>',
    rel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    date: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    tracks: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    barcode: '<path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    stack: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
};
const ccInSvg = (k, size, cls) => '<svg' + (cls ? ' class="' + cls + '"' : '') + ' width="' + (size || 14) + '" height="' + (size || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + CC_INMB_SVG[k] + '</svg>';
// a release MusicBrainz has, in columns: the title (it opens the release in a new tab) and disambiguation, the
// platforms linked to it on the right, then date, format, tracks and barcode, each in its own column so a missing
// one shifts nothing; in another edition, what sets it apart from this album is highlighted
function ccInMbHtml() {
    const rs = CC.inMb.releases;
    if (CC.inMb.state !== 'done' || !rs.length) return '';
    const src = CC.sources[0] || {}, fmt = ccFormat();
    const keyOf = u => { const x = CC.sources.find(y => y.url === u); return x ? x.key : null; };
    const plat = list => '<span class="pl">' + list.map(([k, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener" data-tip="' + esc(ccName(k)) + '" aria-label="' + esc(ccName(k)) + '">' + ccIco(k, 13) + '</a>').join('') + '</span>';
    const cell = (icon, val, o) => {
        o = o || {};
        return '<span class="c' + (o.cls ? ' ' + o.cls : '') + (val ? '' : ' none') + '"' + (o.tip ? ' data-tip="' + esc(o.tip) + '"' : '') + '>' + icon.replace('<svg', '<svg class="m"')
            + (val ? (o.diff ? '<span class="v">' + esc(val) + '</span>' : esc(val)) : '—') + '</span>';
    };
    const fIco = f => fmtGlyph(f, 14);
    const row = e => {
        const fDiff = !e.same && !!e.format && !/unknown/.test(e.format) && ccFmtKind(e.format) !== ccFmtKind(fmt);
        const tDiff = !e.same && !!e.tracks && !!src.tracks && e.tracks !== src.tracks;
        const bDiff = !e.same && !!e.barcode && !!src.barcode && ccBc(e.barcode) !== ccBc(src.barcode);
        const keys = []; e.urls.forEach(u => { const k = keyOf(u); if (k && !keys.some(x => x[0] === k)) keys.push([k, u]); });
        return '<div class="mcc-ing r" data-id="' + esc(e.id) + '"><div class="t"><a class="ttl" href="/release/' + esc(e.id) + '" target="_blank" rel="noopener" data-tip="Open the release in a new tab">' + esc(e.title) + '</a>'
            + (e.disamb ? '<span class="dis" data-tip="' + esc(e.disamb) + '">' + esc(e.disamb) + '</span>' : '') + plat(keys) + '</div>'
            + cell(ccInSvg('date'), e.date, { cls: 'dt' })
            + cell(fIco(e.format), e.format, { cls: 'fmt' + (fDiff ? ' diff' : ''), diff: fDiff, tip: fDiff ? 'Another format than this album\'s ' + fmt : '' })
            + cell(ccInSvg('tracks'), e.tracks ? String(e.tracks) : '', { cls: 'num mono' + (tDiff ? ' diff' : ''), diff: tDiff, tip: tDiff ? 'This album has ' + src.tracks + ' tracks' : '' })
            + cell(ccInSvg('barcode'), e.barcode, { cls: 'mono' + (bDiff ? ' diff' : ''), diff: bDiff, tip: bDiff ? 'Another barcode than this album\'s ' + src.barcode : '' })
            // #727: Update takes what is consolidated here to it, for what it lacks
            + '<div class="act">' + (e.same ? '<button type="button" class="mcc-btn mcc-upd" data-cc="update" data-id="' + esc(e.id) + '" data-tip="Update this release\nOpen it in this tab: Mission Control probes it, compares it with the platforms and offers what it lacks: the barcode, catalog numbers, labels, ISRCs, links, release event, track lengths.">' + ccInSvg('up') + 'Update</button>' : '')
            + '</div></div>';
    };
    const same = rs.filter(e => e.same), other = rs.filter(e => !e.same);
    const heads = '<div class="mcc-ing ch"><span>' + ccInSvg('rel') + 'Release</span><span>' + ccInSvg('date') + 'Date</span><span data-tip="Format">' + fIco(fmt) + '</span><span data-tip="Tracks">' + ccInSvg('tracks') + '</span><span>' + ccInSvg('barcode') + 'Barcode</span><span></span></div>';
    const took = []; CC.sources.filter(x => x.take && x.url).forEach(x => { if (!took.some(y => y[0] === x.key)) took.push([x.key, x.url]); });
    const album = '<div class="mcc-ing alb" data-tip="What the platforms give for this album: each release is compared with it"><div class="t"><span>This album</span>' + plat(took) + '</div><span></span>'
        + cell(fIco(fmt), fmt, { cls: 'fmt' }) + cell(ccInSvg('tracks'), src.tracks ? String(src.tracks) : '', { cls: 'num mono' }) + cell(ccInSvg('barcode'), src.barcode, { cls: 'mono' }) + '<span></span></div>';
    let h = '';
    if (same.length) h += '<div class="mcc-inmb' + (CC.closed.has('same') ? ' closed' : '') + '"><button type="button" class="mcc-inmb-tog same"' + ccSectHead('same') + '>' + ccInSvg('chev', 14, 'chev') + ccInSvg('dup')
        + '<b>MusicBrainz already has this album</b><span class="mcc-n">' + same.length + '</span><span class="s">update it with what it lacks instead of adding it again</span></button>'
        + '<div class="mcc-inmb-rows">' + heads + album + same.map(row).join('') + '</div></div>';
    if (other.length) h += '<div class="mcc-inmb other' + (CC.closed.has('others') ? ' closed' : '') + '"><button type="button" class="mcc-inmb-tog"' + ccSectHead('others') + '>' + ccInSvg('chev', 14, 'chev') + ccInSvg('stack')
        + '<b>Other editions</b><span class="mcc-n">' + other.length + '</span><span class="s">another barcode, format or track count</span></button>'
        + '<div class="mcc-inmb-rows">' + (same.length ? '' : heads + album) + other.map(row).join('') + '</div></div>';
    return h;
}
function consolidateMain(token) {
    CC.token = token;
    Log.cat('Consolidation').info('consolidation page, token ' + token);
    const start = () => {
        ccOpen();
        document.addEventListener('fc:consolidate', e => ccTake(e.detail, 'event'));
        if (document.documentElement.dataset.fcConsolidate) ccTake(document.documentElement.dataset.fcConsolidate, 'page');
        else document.dispatchEvent(new CustomEvent('fc:consolidate-request'));
        document.addEventListener('mc:provider', () => ccAskPc());
        document.dispatchEvent(new CustomEvent('mc:discover', { detail: JSON.stringify({ release: null, mc: VERSION }) }));
        // nobody handed anything over: First Contact isn't running here
        setTimeout(() => { if (!CC.src && !CC.error) { CC.error = 'First Contact isn\'t running on this page, or it has no album for it.'; Log.cat('Consolidation').warn(CC.error); ccPaint(); } }, 4000);
        // no Platform Check: compare the source alone
        setTimeout(() => { if (CC.src && CC.pc.state === 'wait') { CC.pc.state = 'none'; Log.cat('Consolidation').warn('Platform Check isn\'t running on this page: only the source is compared'); ccPaint(); ccCheckInMb(); } }, 6000);
    };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
}
if (mbuTestHooks()) window.__mccTest = { state: () => CC, model: ccModel, seedRel: () => ccSeedRel(ccModel()), markdown: ccMarkdown, open: ccOpenEditor, setDry: v => { CC.dry = v; }, lanes: ccLanes, versions: ccVersions, inMb: ccCheckInMb, paint: () => ccPaint(), same: ccSameRelease, fmtKind: ccFmtKind };

/* ── the release compared with its platforms (#782) ─────────────────────────── */

// The Platforms step: the album links Platform Check has for this release, linked or found in the release's barcode
// lane, read by First Contact headless and voted on as in a consolidation. CC is the comparison's state here: no
// source, the platforms in Platform Check's order. What the release lacks goes back to Platform Check as a
// consolidation (cons: the barcode, catalog numbers and labels, the links, a release event, track lengths) and to
// ISRC Scout (the ISRCs, by track); a title that differs is shown, never applied.
function cmpReset() {
    clearInterval(CMP.timer);
    Object.assign(CMP, { waiting: false, cons: null, isrcs: null, title: null, timer: 0, picks: {} });
    CC.sources = []; CC.pc = { state: 'wait', note: '', findings: [], at: 0 }; CC.pick = {}; CC.rowPick = {};
    CC.run = 'c' + Date.now().toString(36);   // a read of the comparison before is dropped
}
function cmpDone(summary, findings) {
    clearInterval(CMP.timer);
    results.fc = { state: 'done', findings: findings || [], summary };
    Log.cat('Platforms').info('platforms: ' + summary);
    noteProbeDone();
    paintAll();
}
function cmpStart() {
    if (!found.fc) return;
    cmpReset();
    if (!run) run = Date.now().toString(36);
    results.fc = { state: 'busy', note: 'waiting for Platform Check', at: Date.now() };
    const pc = results.pc;
    if (!pc || pc.state !== 'done') {
        if (!found.pc || providerOff('pc')) { cmpDone('needs Platform Check, which finds the platforms'); return; }
        CMP.waiting = true;
        Log.cat('Platforms').info('platforms: waiting for Platform Check');
        if (!pc) probeOne('pc');
        paintAll();
        return;
    }
    // the release's own lane: its barcode, else the one a linked platform gives; a platform without a barcode
    // joins it when it has as many tracks; one Platform Check marks as another release (mismatch) never
    const own = ccBc(pc.barcode) || ccBc((pc.findings.find(x => !x.entity && !x.kind && x.state === 'linked' && x.barcode) || {}).barcode);
    const n = rel.tracks.length;
    const links = pc.findings.filter(x => !x.entity && !x.kind && x.url && x.state !== 'none');
    CC.pc = { state: 'done', note: '', findings: links, at: 0 };
    CC.sources = links.map(x => {
        const bc = ccBc(x.barcode), count = x.tracks == null || x.tracks === n;
        return { key: x.key, url: x.url, barcode: x.barcode || null, tracks: x.tracks == null ? null : x.tracks, format: x.format || null, mismatch: x.mismatch || null, state: x.state,
            role: 'found', take: !x.mismatch && (own && bc ? bc === own : count), read: VET.get(x.url) && VET.get(x.url).rel ? { state: 'done', rel: VET.get(x.url).rel, provider: { id: x.key }, ms: 0 } : { state: 'none' } };
    });
    // #801: the album First Contact found to be this release, as it read it: taken in, first, in place of what Platform
    // Check found on its platform, unless the release links that platform already
    const src = AFTER && AFTER.compare && AFTER.source;
    if (src && src.url && src.rel && !CC.sources.some(s => s.key === src.key && s.state === 'linked')) {
        const fmt = (src.rel.mediums || []).map(m => m.format || 'Digital Media').join(' + ');
        CC.sources = [{ key: src.key, url: src.url, barcode: src.rel.barcode || null, tracks: ccCount(src.rel), format: fmt, mismatch: null, state: 'new', role: 'source', take: true,
            read: { state: 'done', rel: src.rel, provider: src.provider, ms: 0 } }].concat(CC.sources.filter(s => s.key !== src.key));
        Log.cat('Platforms').info('platforms: ' + ccName(src.key) + ' ' + src.url + ' taken in, as First Contact read it');
    }
    CC.sources.forEach(s => { if (s.read.state === 'done' && s.role !== 'source') { Log.cat('Platforms').debug('platforms: ' + ccName(s.key) + ' read already, for its tracklist'); ccTracklistCheck(s); } });
    const want = CC.sources.filter(s => s.take && ccReadable(s.key));
    Log.cat('Platforms').info('platforms: ' + CC.sources.map(s => s.key + (s.take ? (ccReadable(s.key) ? '✓' : '·unread') : '·') + (s.barcode ? ' ' + s.barcode : '') + (s.tracks != null ? ' ' + s.tracks + 't' : '')).join(' | ') + ' · the release\'s barcode ' + (own || '—'));
    if (!want.length) { cmpDone(CC.sources.length ? 'no platform of this release to read' : 'Platform Check found no platform'); return; }
    results.fc.note = 'read 0 of ' + want.length;
    // a read not heard from in a while has failed (First Contact gone, or a request that hangs)
    CMP.timer = setInterval(() => {
        CC.sources.forEach(s => { if (s.read.state === 'reading' && Date.now() - s.read.at > CC_READ_WAIT) { s.read = { state: 'failed', error: 'no answer in ' + CC_READ_WAIT / 1000 + ' s' }; Log.cat('Platforms').warn('read ' + ccName(s.key) + ': no answer'); pcVetFailed(s); ccPump(); } });
    }, 1000);
    ccReadTaken();
}
// a read came in (or failed): the step says how far it is; once none is left, what it found
function cmpProgress() {
    const r = results.fc;
    if (!r || r.state !== 'busy' || CMP.waiting) return;
    const want = CC.sources.filter(s => s.take && ccReadable(s.key));
    const done = want.filter(s => s.read.state === 'done').length, failed = want.filter(s => s.read.state === 'failed').length;
    if (want.some(s => s.read.state === 'queued' || s.read.state === 'reading')) {
        r.note = 'read ' + done + ' of ' + want.length + (failed ? ' · ' + failed + ' failed' : ''); r.at = Date.now();
        paintAll();
        return;
    }
    cmpFinish();
}
function cmpFinish() {
    const m = ccModel(), f = m.fields, t = m.tracks;
    const failed = CC.sources.filter(s => s.take && s.read.state === 'failed');
    const read = m.reads.length + ' platform' + (m.reads.length === 1 ? '' : 's') + ' read' + (failed.length ? ' · ' + failed.length + ' failed' : '');
    if (!f) { cmpDone(failed.length ? 'no platform could be read' : 'nothing read'); return; }
    const names = keys => keys.map(ccName).join(', ');
    const from = m.reads.map(s => ccName(s.key));
    const cons = {
        barcode: f.barcode.win ? String(f.barcode.win.show).replace(/\D/g, '') : null,
        // a label's platforms: those that gave its catalog number, else those that gave the label
        labels: ccLabels(f).filter(l => l.name || l.mbid).map(l => ({ name: l.name || '', mbid: l.mbid || null, catno: l.catno || '', url: l.url || null, from: (l.catno && f.catno.win ? f.catno.win.keys : f.label.win ? f.label.win.keys : []).slice() })),
        barcodeFrom: f.barcode.win ? f.barcode.win.keys.slice() : [],
        urls: CC.sources.filter(s => s.take && s.url).map(s => ({ key: s.key, url: s.url })),
        from,
    };
    // a release event, for a release that has none: the date most platforms give, the country most give
    if (!rel.events && f.date.win && f.date.win.data && f.date.win.data.year) {
        const c = ccVote('country', m.reads.map(s => ({ key: s.key, val: s.read.rel.country || '', show: s.read.rel.country || '' })));
        const country = c.win ? c.win.val : null;
        cons.event = { date: f.date.win.data, country, countryName: country === 'XW' ? '[Worldwide]' : country, from: [...new Set(f.date.win.keys.concat(c.win ? c.win.keys : []))], why: 'the date from ' + names(f.date.win.keys) + (country ? ', the country from ' + names(c.win.keys) : '') };
    }
    // the tracks line up with the release's when there are as many: by position
    const aligned = t.n === rel.tracks.length && !t.extras.some(x => CC.extraTake[x.id]);
    const findings = [], lengths = [], lenFrom = new Set();
    if (aligned) {
        const inMedium = {};
        rel.tracks.forEach((trk, i) => {
            const row = t.rows[i], v = row.win, position = inMedium[trk.medium] = (inMedium[trk.medium] || 0) + 1;
            const lenNew = !trk.len && !!v.len;
            if (lenNew) { lengths.push({ medium: trk.medium, position, ms: v.len }); v.keys.forEach((k, j) => { if (v.tracks[j] && v.tracks[j].lengthMs) lenFrom.add(k); }); }
            findings.push({ key: 'fc:' + i, track: trk.rec, state: 'info', len: v.len, lenNew, lenFrom: names(v.keys.filter((k, j) => v.tracks[j] && v.tracks[j].lengthMs)), title: v.title, titleFrom: names(v.keys), differs: v.title !== trk.title, versions: row.versions });
        });
        const isrcs = t.rows.map(r => r.win.isrc || null);
        if (isrcs.some(Boolean)) CMP.isrcs = isrcs;
    } else Log.cat('Platforms').warn('platforms: ' + t.n + ' track(s) on the platforms, the release has ' + rel.tracks.length + ': the tracks are not compared');
    if (lengths.length) { cons.lengths = lengths; cons.lengthsFrom = [...lenFrom]; }
    if (f.title.win && f.title.win.val !== rel.title) CMP.title = { val: f.title.win.val, from: names(f.title.win.keys) };
    CMP.cons = cons;
    Log.cat('Platforms').ok('platforms: ' + read + ' · barcode ' + (cons.barcode || '—') + ' · labels ' + (cons.labels.map(l => l.name + (l.catno ? ' ' + l.catno : '')).join(', ') || '—') + ' · event ' + (cons.event ? JSON.stringify(cons.event.date) + ' ' + (cons.event.country || '') : '—')
        + ' · ' + lengths.length + ' length(s) · ' + (CMP.isrcs || []).filter(Boolean).length + ' ISRC(s) · ' + findings.filter(x => x.differs).length + ' title(s) differ' + (CMP.title ? ' · release title "' + CMP.title.val + '"' : ''));
    // a title that differs only in its capitals is counted apart: guess case settles it, not another title
    const caseOnly = findings.filter(pfCaseOnly).length;
    const differ = findings.filter(x => x.differs).length - caseOnly;
    const said = [differ && differ + ' track title' + (differ === 1 ? ' differs' : 's differ'), caseOnly && caseOnly + ' in case only'].filter(Boolean).join(', ');
    cmpDone(read + (aligned ? said ? ' · ' + said : '' : ' · ' + t.n + ' tracks there, not compared'), findings);
    // what the release lacks, offered by those who add it
    if (found.pc && !providerOff('pc')) probeOne('pc');
    if (CMP.isrcs && found.is && !providerOff('is')) probeOne('is');
}
// Platform Check's card: what the comparison shows and doesn't apply (the release's title on the platforms), and
// which platforms it read
function cmpHtml() {
    const r = results.fc;
    if (!r || r.state !== 'done' || !CMP.cons) return '';
    const read = CC.sources.filter(s => s.take && s.read.state === 'done').map(s => s.key);
    return '<div class="mc-summary mc-cmp" data-tip="' + esc('Mission Control compared the release with ' + read.map(ccName).join(', ') + '\nWhat the release lacks is in the rows below.') + '">Compared with ' + ccIcons(read)
        + (CMP.title ? ' · <span class="mc-warn" data-tip="' + esc('Shown only\nMission Control changes no title.') + '">the platforms call it <b>' + esc(CMP.title.val) + '</b> (' + esc(CMP.title.from) + ')</span>' : '') + '</div>';
}

/* after saving: Mission Control on the new release (#702) */

// Add release notes, in this tab's sessionStorage, what Mission Control should do once
// the release is saved: the new release page then opens it, probes, and takes in only what was
// ticked; ISRC Scout gets the ISRCs taken in the consolidation, by track.
let AFTER = null;
function afterSave() {
    let a = null;
    try { a = JSON.parse(sessionStorage.getItem(CC_AFTER_KEY) || 'null'); } catch (e) { return; }
    if (!a) return;
    try { sessionStorage.removeItem(CC_AFTER_KEY); } catch (e) { /* storage blocked */ }
    if (Date.now() - a.created > CC_AFTER_TTL) { Log.cat('After saving').info('a consolidation\'s note for after saving is older than 3 hours: dropped'); return; }
    // #727: an update of a release MusicBrainz already had names it; a new release is known by its title
    if (a.mbid) { if (a.mbid !== RELEASE) { Log.cat('After saving').info('a consolidation\'s update is for release ' + a.mbid + ', not this one: dropped'); return; } }
    else {
        const title = (document.querySelector('.releaseheader h1') || {}).textContent || '';
        if (ccNorm(title).indexOf(ccNorm(a.title)) === -1) { Log.cat('After saving').info('a consolidation\'s note for after saving is for "' + a.title + '", not this release: dropped'); return; }
    }
    AFTER = a;
    Log.cat('After saving').info((a.mbid ? 'a consolidation updates this release: Mission Control opens, probes and compares it with the platforms' : 'the consolidated release is saved: Mission Control opens and probes') + ' · ' + Object.keys(a.ticks).filter(k => a.ticks[k]).join(', ') + (a.mbid ? '' : ' · ' + (a.isrcs || []).filter(Boolean).length + ' ISRC(s) from the consolidation'));
    open();
    // an update (a.mbid) saved nothing: its probe only offers what the release lacks, so Execute waits for a click
    if (a.mbid && S.consExec) Log.cat('Execute').info('auto execute: an update, not a saved consolidation: no Execute');
    setTimeout(() => { if (ui && !run) probe(); if (ui && S.consExec && !a.mbid) autoExecArm(); }, 700);
}
// #801: First Contact found an album on a platform in MusicBrainz, and Update this release opened this release
// (/release/<mbid>#fc-update=<token>): Mission Control opens, probes and compares the release with the platforms,
// that album among them as First Contact read it (AFTER.source, taken in whatever Platform Check finds)
const FC_UPDATE = RELEASE ? (location.hash.match(/[#&]fc-update=([a-z0-9]+)/i) || [])[1] : null;
function fcUpdate(token) {
    let took = false;
    const take = json => {
        if (took) return;
        let h = null;
        try { h = JSON.parse(json); } catch (e) { return; }
        if (!h || h.token !== token) return;
        took = true;
        try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* the address keeps it */ }
        if (h.error) { Log.cat('After saving').warn('First Contact\'s update: ' + h.error); mbuToast('Mission Control: ' + h.error, { kind: 'warn' }); return; }
        if (h.mbid !== RELEASE) { Log.cat('After saving').info('First Contact\'s update is for release ' + h.mbid + ', not this one: dropped'); return; }
        const p = h.platform || {};
        AFTER = { created: h.created, mbid: RELEASE, title: h.rel.title, ticks: { is: true, as: true, pc: true }, compare: true,
            source: { key: ccKey(p.id || h.source), url: h.url, rel: h.rel, provider: p } };
        Log.cat('After saving').info('First Contact found ' + (p.name || h.source) + '\'s album ' + h.url + ' to be this release: Mission Control opens, probes and compares it with the platforms, that album included');
        open();
        // an update, as Mission Control's own: nothing was consolidated, so no Execute by itself
        setTimeout(() => { if (ui && !run) probe(); }, 700);
    };
    document.addEventListener('fc:update', e => take(e.detail));
    if (document.documentElement.dataset.fcUpdate) take(document.documentElement.dataset.fcUpdate);
    else document.dispatchEvent(new CustomEvent('fc:update-request'));
    setTimeout(() => { if (!took) Log.cat('After saving').warn('First Contact\'s update ' + token + ' never came: First Contact isn\'t running on this page'); }, 4000);
}
// what wasn't ticked for after saving starts left out
function afterPicks(id) {
    if (!AFTER || !picked[id] || !(id in AFTER.ticks) || AFTER.ticks[id]) return;
    picked[id].clear();
    Log.cat('After saving').info('after saving: ' + id + ' left out, as selected in the consolidation');
}

// the ISRCs taken in the consolidation, by track, for ISRC Scout (#702); or those the comparison with the platforms found (#782)
function afterIsrcs() { return AFTER && AFTER.ticks.is && Array.isArray(AFTER.isrcs) ? AFTER.isrcs : undefined; }
const isrcsNow = () => afterIsrcs() || CMP.isrcs || undefined;

/* ── launcher ──────────────────────────────────────────────────────────────── */

function launcher() {
    if (document.getElementById('mc-launch')) return;
    mcStyle();
    const b = el('button', 'mc-launch'); b.id = 'mc-launch'; b.type = 'button';
    const img = document.createElement('img'); img.src = ICON_URL; img.alt = ''; b.appendChild(img); b.dataset.tip = 'Mission Control\nRight-click: settings';
    b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = '5'; b.dataset.mbCornerLabel = 'Mission Control'; b.dataset.mbCornerPaths = '^/release/';   // its @match   // highest priority: closest to the corner
    b.onclick = () => { if (!mcElsewhere()) open(); };
    b.oncontextmenu = e => { e.preventDefault(); settingsWindow(); };   // #695: right-click on every corner launcher opens its settings
    document.body.appendChild(b);
    mbRestackCorner('br');
}

if (mbuTestHooks()) window.__mcTest = { open, close, execute, results: () => results, cmp: () => ({ cons: CMP.cons, isrcs: CMP.isrcs, title: CMP.title, picks: CMP.picks, changes: pfChanges(), sources: CC.sources.map(s => ({ key: s.key, take: s.take, read: s.read.state })) }), withCons: c => { CMP.cons = c; probeOne('pc'); }, compare: () => probeOne('fc'), after: () => AFTER, picked: () => Object.fromEntries(Object.entries(picked).map(([k, v]) => [k, Array.from(v)])), settings: () => Object.assign({}, S), off: () => [...OFF], found: () => Object.assign({}, found), release: () => rel, bestHtml, coverList, setStall: ms => { STALL_MS = ms; }, setApplyWait: (silent, max) => { APPLY_SILENT = silent; APPLY_MAX = max; }, fxChecking: () => fxBusy.size };

// <ST-ICONS> — generated by dev/ui/sync-icons.mjs from dev/ui/platform-icons.mjs — DO NOT EDIT
const ST_ICONS = {"musicbrainz":{"color":"#eb743b","svg":"<svg viewBox=\"0.75 0.75 28.5 28.5\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(1.5)\"><path d=\"m13 1-12 7v14l12 7z\" fill=\"#ba478f\"/><path d=\"m14 1 12 7v14l-12 7z\" fill=\"#eb743b\"/></g></svg>"},"discogs":{"color":"#333333","svg":"<svg viewBox=\"71 71 882 882\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(512 512) scale(0.86) translate(-512 -512)\"><circle cx=\"512\" cy=\"512\" r=\"496\" fill=\"#333\" stroke=\"#9a9a9a\" stroke-width=\"32\"/><path fill=\"#fff\" d=\"M439.84 511.58A72.58 72.58 0 0 1 512.41 439 72.54 72.54 0 0 1 585 511.58a72.56 72.56 0 0 1-72.57 72.56 72.56 72.56 0 0 1-72.57-72.56zm3.18 0A69.48 69.48 0 0 0 512.41 581a69.4 69.4 0 0 0 69.4-69.38 69.49 69.49 0 0 0-69.4-69.43A69.44 69.44 0 0 0 443 511.58zm69.42-11.44a11.43 11.43 0 1 0 11.47 11.45 11.45 11.45 0 0 0-11.48-11.45zm-131.08 11.43a130.68 130.68 0 0 0 40.3 94.43l24.68-26.69.33.3a94.59 94.59 0 0 1 113.08-149.95l17.51-31.95a130.23 130.23 0 0 0-64.82-17.22c-72.27.01-131.08 58.81-131.08 131.08zm225.73 0a94.6 94.6 0 0 1-138.64 83.79l-17.83 31.74a130.26 130.26 0 0 0 61.82 15.53c72.28 0 131.08-58.8 131.08-131.08a130.63 130.63 0 0 0-37.73-91.9L581 446.39a94.3 94.3 0 0 1 26.1 65.2zm-267.34 0a172.17 172.17 0 0 0 53.68 125l25-27.07a135.38 135.38 0 0 1-41.82-97.89c0-74.88 60.92-135.8 135.8-135.8a134.92 134.92 0 0 1 67.08 17.8l17.73-32.34a171.57 171.57 0 0 0-84.81-22.35c-95.19-.03-172.66 77.43-172.66 172.65zm308.49 0c0 74.88-60.92 135.8-135.8 135.8a135 135 0 0 1-64.14-16.14l-18.07 32.17a171.62 171.62 0 0 0 82.21 20.86c95.22 0 172.69-77.47 172.69-172.69a172.15 172.15 0 0 0-51-122.4l-25.12 27a135.35 135.35 0 0 1 39.23 95.4zm41.61 0c0 97.83-79.58 177.43-177.41 177.43a176.32 176.32 0 0 1-84.52-21.46l-18.18 32.36a213.21 213.21 0 0 0 102.7 26.23C630.74 726.11 727 629.87 727 511.57a213.87 213.87 0 0 0-64.38-153l-25.26 27.18a176.85 176.85 0 0 1 52.49 125.82zm-392 0A213.9 213.9 0 0 0 365 667.24L390.23 640A176.88 176.88 0 0 1 335 511.57c0-97.82 79.59-177.41 177.41-177.41a176.26 176.26 0 0 1 87.08 22.93l17.84-32.55A213.14 213.14 0 0 0 512.44 297c-118.3 0-214.54 96.28-214.54 214.57zm392.55-183-24.64 26.49a218.57 218.57 0 0 1 65.94 156.51c0 120.9-98.36 219.26-219.26 219.26a217.9 217.9 0 0 1-105-26.84l-18.24 32.47A255.43 255.43 0 0 0 512 768c141.39 0 256-114.64 256-256a255.23 255.23 0 0 0-77.55-183.41zm-397.27 183c0-120.9 98.36-219.26 219.26-219.26a217.84 217.84 0 0 1 107.19 28.09L637 288.65A254.46 254.46 0 0 0 516.12 256H512c-140.54.22-254.42 113.26-256 253.5v2.5a255.69 255.69 0 0 0 80.51 186.08l25.31-27.36a218.61 218.61 0 0 1-68.64-159.15z\"/></g></svg>"},"spotify":{"color":"#1DB954","svg":"<svg viewBox=\"1.25 1.375 21.25 21.25\" fill=\"#1DB954\"><path transform=\"translate(12 12) scale(.875) translate(-12 -12)\" d=\"M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z\"/></svg>"},"apple":{"color":"#FA243C","svg":"<svg viewBox=\"1.625 1.25 20 20\" fill=\"#FA243C\"><path d=\"M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.97-.88-3.24-.86-1.67.03-3.21.97-4.07 2.46-1.73 3.01-.44 7.47 1.24 9.92.82 1.2 1.8 2.54 3.08 2.49 1.24-.05 1.71-.8 3.21-.8 1.5 0 1.92.8 3.23.77 1.33-.02 2.18-1.22 3-2.42.94-1.39 1.33-2.73 1.35-2.8-.03-.01-2.59-.99-2.62-3.93zM14.6 4.59c.68-.83 1.14-1.97 1.01-3.11-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.21-.55 2.89-1.38z\"/></svg>"},"deezer":{"color":"#A238FF","svg":"<svg viewBox=\"3 3 18 18\"><path transform=\"translate(12 12) scale(.74) translate(-12 -12)\" d=\"M4 2h6v2h-6zM14 2h6v2h-6zM2 4h20v2h-20zM0 6h24v2h-24zM0 8h24v2h-24zM0 10h24v2h-24zM2 12h20v2h-20zM4 14h16v2h-16zM6 16h12v2h-12zM8 18h8v2h-8zM10 20h4v2h-4z\" fill=\"#A238FF\"/></svg>"},"tidal":{"color":"#000000","svg":"<svg viewBox=\"3 3 18 18\"><path d=\"M6 6l3 3-3 3-3-3zM12 6l3 3-3 3-3-3zM18 6l3 3-3 3-3-3zM12 12l3 3-3 3-3-3z\" style=\"fill:var(--mbu-text,currentColor)\"/></svg>"},"qobuz":{"color":"#0070ef","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#0070ef\"/><circle cx=\"12\" cy=\"12\" r=\"5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.2\"/><path d=\"M14.5 14.5 19 19\" stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>"},"beatport":{"color":"#01FF95","svg":"<svg viewBox=\"0.75 0.75 22.5 22.5\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"#000\"/><g transform=\"translate(12 12) scale(0.84) translate(-12 -12)\" fill=\"none\" stroke=\"#01FF95\" stroke-width=\"2.5\"><path d=\"M10.9 3V8.3c0 1.2-.4 1.9-1.1 2.6L5.6 15.1\"/><circle cx=\"13.9\" cy=\"15.8\" r=\"4.05\" stroke-width=\"2.35\"/></g></svg>"},"bandcamp":{"color":"#629AA9","svg":"<svg viewBox=\"2.25 2.25 19.5 19.5\" fill=\"#629AA9\"><path transform=\"translate(12 12) scale(.8) translate(-12 -12)\" d=\"M0 18.75l7.437-13.5H24l-7.438 13.5z\"/></svg>"},"volumo":{"color":"#7c4dff","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#7c4dff\"/><path d=\"M7 8h2.2l2.8 6 2.8-6H17l-4 9h-2z\" fill=\"#fff\"/></svg>"},"presto":{"color":"#1f3a5f","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#1f3a5f\"/><path d=\"M8.5 6.5h4.1c2.2 0 3.7 1.4 3.7 3.4s-1.5 3.4-3.7 3.4h-2.2v4.2H8.5zm1.9 1.7v3.4h2c1.1 0 1.9-.7 1.9-1.7s-.8-1.7-1.9-1.7z\" fill=\"#fff\"/></svg>"},"hdtracks":{"color":"#e63329","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#e63329\"/><path d=\"M5 7.5h1.7v3.1h2.6V7.5H11v8H9.3v-3.2H6.7v3.2H5zm7.2 0h2.9c2 0 3.4 1.6 3.4 4s-1.4 4-3.4 4h-2.9zm1.7 1.5v5h1.1c1.1 0 1.8-1 1.8-2.5s-.7-2.5-1.8-2.5z\" fill=\"#fff\"/></svg>"},"soundcloud":{"color":"#FF5500","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FF5500\" d=\"M23.999 14.165c-.052 1.796-1.612 3.169-3.4 3.169h-8.18a.68.68 0 0 1-.675-.683V7.862a.747.747 0 0 1 .452-.724s.75-.513 2.333-.513a5.364 5.364 0 0 1 2.763.755 5.433 5.433 0 0 1 2.57 3.54c.282-.08.574-.121.868-.12.884 0 1.73.358 2.347.992s.948 1.49.922 2.373ZM10.721 8.421c.247 2.98.427 5.697 0 8.672a.264.264 0 0 1-.53 0c-.395-2.946-.22-5.718 0-8.672a.264.264 0 0 1 .53 0ZM9.072 9.448c.285 2.659.37 4.986-.006 7.655a.277.277 0 0 1-.55 0c-.331-2.63-.256-5.02 0-7.655a.277.277 0 0 1 .556 0Zm-1.663-.257c.27 2.726.39 5.171 0 7.904a.266.266 0 0 1-.532 0c-.38-2.69-.257-5.21 0-7.904a.266.266 0 0 1 .532 0Zm-1.647.77a26.108 26.108 0 0 1-.008 7.147.272.272 0 0 1-.542 0 27.955 27.955 0 0 1 0-7.147.275.275 0 0 1 .55 0Zm-1.67 1.769c.421 1.865.228 3.5-.029 5.388a.257.257 0 0 1-.514 0c-.21-1.858-.398-3.549 0-5.389a.272.272 0 0 1 .543 0Zm-1.655-.273c.388 1.897.26 3.508-.01 5.412-.026.28-.514.283-.54 0-.244-1.878-.347-3.54-.01-5.412a.283.283 0 0 1 .56 0Zm-1.668.911c.4 1.268.257 2.292-.026 3.572a.257.257 0 0 1-.514 0c-.241-1.262-.354-2.312-.023-3.572a.283.283 0 0 1 .563 0Z\"/></svg>"},"audiomack":{"color":"#FFA200","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FFA200\" d=\"M.331 11.378s.5418-.089.765.1439c.2234.2332.077.7156-.2195.7237-.2965.01-.5705.063-.765-.1439-.1946-.2066-.1424-.6218.2195-.7237m5.881 3.2925c-.0522.01-.1075-.018-.164-.059-.3884-.5413-.5287-2.3923-.707-2.5025-.185-.1144-.8545 1.0255-2.1862.903-.5569-.051-1.1236-.4121-1.4573-.662.031-.4206.0364-1.4027.8659-1.0833.5038.1939 1.3667.7266 2.1245-.23.8378-1.0579 1.2999-.7506 1.577-.5206.2771.23.0925 1.4259.5058 1.0916.4133-.3343 2.082-2.4103 2.082-2.4103s1.292-1.303 1.4898.067c.1979 1.3698 1.0403 2.8877 1.2635 2.8445.2234-.043 2.8223-5.3253 3.1945-5.666.3722-.3409 1.6252-.2961 1.5657.5781-.0596.8742-.1871 6.308-.1871 6.308s-.147 1.5311.0924.7128c.0992-.3392.206-.6453.3392-1.0024.6414-2.0534 1.734-5.5613 2.2784-7.3688.1252-.4325.233-.8037.3166-1.0891l.0001-.0008a3.5925 3.5925 0 0 1 .0973-.3305c.0455-.1532.0763-.2546.0858-.2813.0243-.068.0925-.1192.1884-.157.0962-.061.1995-.064.3165-.067.3021-.027.6907.012 1.0401.1119.1018 0 .2125.037.3172.1118v.0001s.0063 0 .0151.01c.0023 0 .0048 0 .0073.01.0219.015.0573.045.0983.095.0012 0 .0025 0 .004.01.017.021.0341.045.0515.073.1952.2863.315.814.1948 1.7498-.2996 2.3354-.5316 7.1397-.5316 7.1397s-.0461.2298.4353-.782c.0167-.035.0383-.066.058-.098.026-.017.0552-.042.0913-.085.2974-.3546 1.0968-.5629 1.6512-.5586.2336.028.4293.087.5462.1609.2188.333.0897 1.562.0897 1.562-.4612.043-1.3403.2908-1.6519.3366-.3118.046-.7852 2.0699-1.4433 1.8629-.6581-.2069-2.1246-1.1268-2.1246-1.2533 0-.1102.1152-1.4546.1453-1.8016.0022-.024.004-.046.0058-.068a.152.152 0 0 1 .0014-.014l-.0002.0003c.0213-.2733.0023-.3927-.1239-.1199-.1086.2346-.581 1.7359-1.1078 3.3709-.0556.1429-1.0511 3.1558-1.1818 3.5231-.156.4261-.287.7523-.3776.921-.1378.1867-.3234.3036-.5826.2252-.6465-.1954-1.4654-1.0889-1.473-1.3106-.0155-1.2503.0608-7.973-.2423-7.4127-.311.5744-2.73 4.5608-2.73 4.5608-.0405.01-.0705.01-.1062.01-.1712-.019-.4366-.074-.51-.2384-.004-.01-.0094-.018-.0129-.028-.0035-.01-.0075-.022-.0135-.04-.0329-.1097-.0463-.2289-.0753-.3265-.1082-.3652-.2813-.8886-.463-1.421-.2784-.9079-.5654-1.8366-.6127-1.9391-.0923-.2007-.2268-.116-.3475-.0002-.54.458-1.6868 2.4793-2.7225 2.5898\"/></svg>"},"sevendigital":{"color":"#07606E","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#07606E\"/><path d=\"M7.8 6.8h8.4v1.9l-4.5 8.9H9.4l4.4-8.7h-6z\" fill=\"#fff\"/></svg>"},"melon":{"color":"#00CD3C","svg":"<svg viewBox=\"63 52 175 175\"><circle cx=\"138\" cy=\"162\" r=\"46.5\" fill=\"none\" stroke=\"#00CD3C\" stroke-width=\"37\"/><circle cx=\"202\" cy=\"78\" r=\"26\" fill=\"#00CD3C\"/></svg>"},"bugs":{"color":"#FF3D2E","svg":"<svg viewBox=\"0 0 256 256\"><defs><linearGradient id=\"bugs-g\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#C2009E\"/><stop offset=\".45\" stop-color=\"#FF3A48\"/><stop offset=\".75\" stop-color=\"#FFAA00\"/><stop offset=\"1\" stop-color=\"#FFC94A\"/></linearGradient></defs><rect width=\"256\" height=\"256\" rx=\"30\" fill=\"url(#bugs-g)\"/><path fill=\"#fff\" fill-rule=\"evenodd\" d=\"M77 54H118C152 54 170 72 170 100C170 114 163 124 152 128C170 134 180 148 180 168C180 190 165 199 140 200L113 202L91 106C89 94 84 70 77 54ZM118 87L124 115H132C140 115 144 110 143 101C142 92 136 88 128 87ZM128 141L136 177H145C153 177 157 171 156 162C155 150 148 141 138 141Z\"/></svg>"},"allmusic":{"color":"#27aae1","svg":"<svg viewBox=\"-52.87 0 482.77 482.77\"><g transform=\"translate(-118.18 -150.37)\"><path d=\"M432.47,627.54,310.78,352.16a14.57,14.57,0,1,0-7.81.09L178.83,633.14h67.38l14-40.1h92.41l14.32,40.1h67.65ZM276.91,543.85l30-82,29.31,82Z\" style=\"fill:var(--mbu-text,#131313)\"/><path d=\"M403.28,338.88a96.59,96.59,0,1,0-159.89,72.86l11.51-26.33A69.71,69.71,0,1,1,358.83,385l11.61,26.35A96.55,96.55,0,0,0,403.28,338.88Z\" fill=\"#27aae1\"/><path d=\"M466,439.64a187.71,187.71,0,0,0,29.24-100.76c0-103.95-84.57-188.51-188.52-188.51S118.18,234.93,118.18,338.88a187.67,187.67,0,0,0,29.7,101.48A189.56,189.56,0,0,0,205.69,498l13.08-29.92c-42.16-28.9-68.42-77.44-68.42-129.170c0-86.21,70.13-156.34,156.34-156.34s156.36,70.13,156.36,156.34a155.39,155.39,0,0,1-67.8,128.8l13.13,29.83A189.6,189.6,0,0,0,466,439.64Z\" fill=\"#27aae1\"/></g></svg>"},"mora":{"color":"#0a7fd3","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#0a7fd3\"/><path d=\"M6.8 16V10.2M6.8 11.6c0-1 .8-1.6 1.8-1.6s1.8.6 1.8 1.6V16M10.4 11.6c0-1 .8-1.6 1.8-1.6s1.8.6 1.8 1.6V16\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.6\" stroke-linecap=\"round\" transform=\"translate(1.6 0)\"/></svg>"},"ytmusic":{"color":"#FF0000","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FF0000\" d=\"M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm0 19.104c-3.924 0-7.104-3.18-7.104-7.104S8.076 4.896 12 4.896s7.104 3.18 7.104 7.104-3.18 7.104-7.104 7.104zm0-13.332c-3.432 0-6.228 2.796-6.228 6.228S8.568 18.228 12 18.228s6.228-2.796 6.228-6.228S15.432 5.772 12 5.772zM9.684 15.54V8.46L15.816 12l-6.132 3.54z\"/></svg>"},"amazonmusic":{"color":"#25D1DA","svg":"<svg viewBox=\"2 2 20 20\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#25D1DA\"/><path d=\"M5.8 11.2c3.5 3.2 8.9 3.5 12.4.9\" fill=\"none\" stroke=\"#0F1111\" stroke-width=\"1.9\" stroke-linecap=\"round\"/><path d=\"M15.5 10.7l3 1.3-.9 3.1\" fill=\"none\" stroke=\"#0F1111\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"},"amazon":{"color":"#FF6600","svg":"<svg viewBox=\"2 2 20 20\"><rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4.5\" fill=\"#FF6600\"/><path d=\"M5.6 11.6c3.9 2.6 9 2.7 12.4.4\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.7\" stroke-linecap=\"round\"/><path d=\"M15.6 10.9l2.6 1-.6 2.6\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"},"soundexchange":{"color":"#6f42c1","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#6f42c1\"/><path d=\"M6.5 12h1.3l1-3 1.6 6 1.6-9 1.6 12 1.4-6h1.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/></svg>"},"wikidata":{"color":"#339966","svg":"<svg viewBox=\"120 -110 810 810\"><path d=\"M120 45h30v500h-30zM180 45h90v500h-90zM300 45h90v500h-90z\" fill=\"#990000\"/><path d=\"M420 45h30v500h-30zM480 45h30v500h-30zM840 45h30v500h-30zM900 45h30v500h-30z\" fill=\"#339966\"/><path d=\"M540 45h90v500h-90zM660 45h30v500h-30zM720 45h90v500h-90z\" fill=\"#006699\"/></svg>"},"wikipedia":{"color":"#000000","svg":"<svg viewBox=\"0 0 24 24\"><g fill=\"none\" stroke-linecap=\"butt\" style=\"stroke:var(--mbu-text,currentColor)\"><path d=\"M2.6 5.5 7 18.8M10.3 5.5 14.7 18.8\" stroke-width=\"2.1\"/><path d=\"M7 18.8 11.4 7.2M14.7 18.8 21.2 5.5\" stroke-width=\"1\"/><path d=\"M.8 5.5h4.4M8.6 5.5h3.8M18.9 5.5h4.3\" stroke-width=\"1\"/></g></svg>"},"rateyourmusic":{"color":"#2383C6","svg":"<svg viewBox=\"0 0 143 143\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M85.7921 43.0106C96.6509 47.3959 115.863 46.7695 127.766 45.7254C117.951 24.2165 96.2333 9.18123 71.1744 9.18123C59.0627 9.18123 47.995 12.5224 38.3892 18.5783C59.2715 8.76358 69.295 36.1195 85.7921 43.0106Z\" fill=\"#E6E4E5\"/><path d=\"M142.174 71.4106C142.174 110.669 110.433 142.411 71.1738 142.411C31.915 142.411 0.173828 110.669 0.173828 71.4106C0.173828 32.1518 31.915 0.410645 71.1738 0.410645C110.433 0.410645 142.174 32.3606 142.174 71.4106Z\" fill=\"#E6E4E5\"/><path d=\"M107.717 67.8609C117.323 68.4874 126.093 65.9815 132.776 63.058C131.94 56.7933 130.27 50.9463 127.764 45.5169C115.861 46.561 96.6492 47.1874 85.7904 42.8021C69.2934 35.911 58.4346 8.13754 38.3875 18.3699C20.6375 29.4375 8.94341 48.858 8.94341 71.4109C8.94341 77.258 9.77868 82.8962 11.2404 88.1168C21.0551 79.3462 41.7287 62.8492 60.314 57.8374C85.3728 51.1551 87.0434 66.608 107.717 67.8609Z\" fill=\"url(#rym-g0)\"/><path d=\"M132.777 63.2667C126.095 66.1902 117.324 68.4872 107.718 68.0696C87.0447 66.8167 85.3742 51.1549 60.1065 58.0461C41.73 63.0579 21.0565 79.7637 11.033 88.3255C13.1212 95.4255 16.2536 102.108 20.6389 108.164C27.3212 102.525 35.4653 97.3049 44.4447 95.4255C70.13 89.996 70.13 108.372 91.8477 105.867C103.751 104.405 120.039 92.9196 132.359 82.8961C132.986 79.3461 133.404 75.5873 133.404 71.8284C133.404 68.6961 133.195 65.9814 132.777 63.2667Z\" fill=\"url(#rym-g1)\"/><path d=\"M44.4443 95.2164C35.4649 97.0958 27.3208 102.316 20.6384 107.955C31.9149 123.616 50.2913 133.849 71.1737 133.849C101.871 133.849 127.138 111.713 132.359 82.687C120.038 92.7106 103.75 104.196 91.8472 105.658C70.1296 108.163 70.1296 89.5782 44.4443 95.2164Z\" fill=\"url(#rym-g2)\"/><path d=\"M97.2771 83.1047C99.783 89.3694 97.4859 96.2606 91.6389 98.7665C86.0007 101.064 79.3184 97.9311 76.6037 91.8752C74.0978 85.6105 76.3948 78.7194 82.2419 76.2135C88.0889 73.7076 94.7712 76.84 97.2771 83.1047Z\" fill=\"url(#rym-g3)\"/><defs><linearGradient id=\"rym-g0\" x1=\"70.8335\" y1=\"57.9435\" x2=\"70.8335\" y2=\"17.9123\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#88C6EB\"/><stop offset=\"1\" stop-color=\"#2392CC\"/></linearGradient><linearGradient id=\"rym-g1\" x1=\"76.8285\" y1=\"109.069\" x2=\"70.589\" y2=\"66.1666\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#2383C6\"/><stop offset=\"1\" stop-color=\"#33519F\"/></linearGradient><linearGradient id=\"rym-g2\" x1=\"76.5127\" y1=\"128.007\" x2=\"76.5127\" y2=\"94.94\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#1E4999\"/><stop offset=\"1\" stop-color=\"#1B3B6C\"/></linearGradient><linearGradient id=\"rym-g3\" x1=\"88.7722\" y1=\"102.59\" x2=\"85.7469\" y2=\"75.5277\" gradientUnits=\"userSpaceOnUse\"><stop offset=\"0\" stop-color=\"#1E4999\"/><stop offset=\"1\" stop-color=\"#1B3B6C\"/></linearGradient></defs></svg>"},"review":{"color":"#555555","svg":"<svg viewBox=\"1 1 22 22\"><path d=\"M3 3h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H10l-5 5v-5H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z\" style=\"fill:var(--mbu-text,currentColor)\"/><path d=\"M6 7.5h12M6 10.5h12M6 13.5h8\" stroke=\"var(--mbu-bg,#fff)\" stroke-width=\"1.5\" stroke-linecap=\"round\" style=\"stroke:var(--mbu-bg,#fff)\"/></svg>"},"twitter":{"color":"#000000","svg":"<svg viewBox=\"458.78 184.6 852 852\"><path transform=\"translate(52.39 -25.06)\" d=\"M485.39 356.79l230.07 307.62L483.94 914.52h52.11l202.7-218.98 163.77 218.98h177.32L836.82 589.6l215.5-232.81h-52.11L813.54 558.46 662.71 356.79zM562.02 395.17h81.46l359.72 480.97h-81.46z\" fill-rule=\"evenodd\" style=\"fill:var(--mbu-text,currentColor)\"/></svg>"},"facebook":{"color":"#0866FF","svg":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#0866FF\"/><path d=\"M15.12 7.6h-1.7c-.9 0-1.12.43-1.12 1.1V10h2.8l-.4 2.85h-2.4v11.1a12 12 0 0 1-3 0v-11.1H7.2V10h2.1V8.3c0-2.45 1.5-3.8 3.7-3.8.9 0 1.7.07 2.12.12z\" fill=\"#fff\"/></svg>"},"lastfm":{"color":"#D51007","svg":"<svg viewBox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"12\" fill=\"#D51007\"/><path transform=\"translate(4.2 4.2) scale(.65)\" fill=\"#fff\" d=\"M10.584 17.21l-.88-2.392s-1.43 1.594-3.573 1.594c-1.897 0-3.244-1.649-3.244-4.288 0-3.382 1.704-4.591 3.381-4.591 2.42 0 3.189 1.567 3.849 3.574l.88 2.749c.88 2.666 2.529 4.81 7.285 4.81 3.409 0 5.718-1.044 5.718-3.793 0-2.227-1.265-3.381-3.630-3.931l-1.758-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.934.742-1.484 1.952-1.484 1.32 0 2.034.495 2.144 1.677l2.749-.33c-.22-2.474-1.924-3.492-4.729-3.492-2.474 0-4.893.935-4.893 3.932 0 1.87.907 3.051 3.189 3.601l1.87.44c1.402.33 1.869.907 1.869 1.704 0 1.017-.99 1.43-2.86 1.43-2.776 0-3.930-1.457-4.590-3.464l-.907-2.75c-1.155-3.573-2.997-4.893-6.653-4.893C2.144 5.333 0 7.890 0 12.233c0 4.180 2.144 6.434 5.993 6.434 3.106 0 4.591-1.457 4.591-1.457z\"/></svg>"},"secondhandsongs":{"color":"#0F9DAB","svg":"<svg viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"4\" fill=\"#0F9DAB\"/><path d=\"M12.4 4.6L6.6 9.3C9 11.2 10.5 11.5 12.3 11.9C14.5 12.4 16 12.6 18.4 13.9L12.6 18.2\" fill=\"none\" stroke=\"#fff\" stroke-width=\"5.4\" stroke-linejoin=\"round\"/><path d=\"M11.4 5.4L6.6 9.3C9 11.2 10.5 11.5 12.3 11.9C14.5 12.4 16 12.6 18.4 13.9L13.6 17.4\" fill=\"none\" stroke=\"#0F9DAB\" stroke-width=\"2.6\" stroke-linejoin=\"miter\"/><ellipse cx=\"14.9\" cy=\"4.8\" rx=\"3.4\" ry=\"2.6\" transform=\"rotate(-28 14.9 4.8)\" fill=\"#fff\"/><ellipse cx=\"10.3\" cy=\"18.6\" rx=\"3.7\" ry=\"2.8\" transform=\"rotate(-28 10.3 18.6)\" fill=\"#fff\"/></svg>"},"genius":{"color":"#CC2229","svg":"<svg viewBox=\"1085 490 820 870\"><path fill=\"#CC2229\" d=\"M1840 625C1855 618 1870 620 1865 640C1850 720 1700 950 1670 1005C1630 1075 1550 1180 1515 1225C1450 1305 1380 1360 1375 1345C1380 1335 1392 1325 1395 1315C1400 1295 1430 1270 1430 1255C1425 1240 1410 1270 1398 1275C1395 1265 1420 1225 1422 1210C1425 1195 1450 1140 1470 1060C1480 1010 1490 975 1488 960C1485 920 1450 915 1410 907C1365 898 1350 888 1330 883C1270 868 1180 850 1135 820C1112 805 1120 795 1155 790C1290 772 1430 760 1530 740C1640 718 1740 680 1840 625Z\"/><path style=\"fill:var(--mbu-text,currentColor)\" d=\"M1810 510C1830 505 1855 520 1855 550C1855 570 1848 572 1848 580C1852 595 1830 630 1810 645C1795 657 1775 663 1760 660C1730 654 1720 630 1720 605C1722 560 1765 515 1810 510Z\"/></svg>"},"viaf":{"color":"#2a6ebb","svg":"<svg viewBox=\"0 0 24 24\" fill=\"none\"><circle cx=\"8.6\" cy=\"8.6\" r=\"6.6\" stroke=\"#2a6ebb\" stroke-width=\"2.6\"/><circle cx=\"14\" cy=\"13.4\" r=\"5\" stroke=\"#5a9a2e\" stroke-width=\"2.3\"/><circle cx=\"12.6\" cy=\"18.6\" r=\"3.6\" stroke=\"#e8792b\" stroke-width=\"2\"/></svg>"},"youtube":{"color":"#FF0000","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#FF0000\" d=\"M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z\"/></svg>"},"instagram":{"color":"#FF0069","svg":"<svg viewBox=\"0 0 24 24\"><defs><radialGradient id=\"ig-g\" cx=\".3\" cy=\"1.07\" r=\"1.2\"><stop offset=\"0\" stop-color=\"#FFDD55\"/><stop offset=\".1\" stop-color=\"#FFDD55\"/><stop offset=\".5\" stop-color=\"#FF543E\"/><stop offset=\"1\" stop-color=\"#C837AB\"/></radialGradient></defs><path fill=\"url(#ig-g)\" d=\"M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077\"/></svg>"},"imdb":{"color":"#F5C518","svg":"<svg viewBox=\"0 0 24 24\"><rect x=\"2\" y=\"6\" width=\"20\" height=\"12\" fill=\"#000\"/><path fill=\"#F5C518\" d=\"M22.3781 0H1.6218C.7411.0583.0587.7437.0018 1.5953l-.001 20.783c.0585.8761.7125 1.543 1.5559 1.6191A.337.337 0 0 0 1.6016 24h20.7971a.4579.4579 0 0 0 .0437-.002c.8727-.0768 1.5568-.8271 1.5568-1.7085V1.7098c0-.8914-.696-1.6416-1.584-1.7078A.3294.3294 0 0 0 22.3781 0zm0 .496a1.2144 1.2144 0 0 1 1.1252 1.2139v20.5797c0 .6377-.4875 1.1602-1.1045 1.2145H1.6016c-.5967-.0543-1.0645-.5297-1.1053-1.1258V1.6284C.5371 1.0185 1.0184.5364 1.6217.496h20.7564zM4.7954 8.2603v7.3636H2.8899V8.2603h1.9055zm6.5367 0v7.3636H9.6707v-4.9704l-.6711 4.9704H7.813l-.6986-4.8618-.0066 4.8618h-1.668V8.2603h2.468c.0748.4476.1492.9694.2307 1.5734l.2712 1.8713.4407-3.4447h2.4817zm2.9772 1.3289c.0742.0404.122.108.1417.2034.0279.0953.0345.3118.0345.6442v2.8548c0 .4881-.0345.7867-.0955.8954-.0609.1152-.2304.1695-.5018.1695V9.5211c.204 0 .3457.0205.4211.0681zm-.0211 6.0347c.4543 0 .8006-.0265 1.0245-.0742.2304-.0477.4204-.1357.5694-.2648.1556-.1218.2642-.298.3251-.5219.0611-.2238.1021-.6648.1021-1.3224v-2.5832c0-.6986-.0271-1.1668-.0742-1.4039-.041-.237-.1431-.4543-.3126-.6437-.1695-.1973-.4198-.3324-.7456-.421-.3191-.0808-.8542-.1285-1.7694-.1285h-1.4244v7.3636h2.3051zm5.14-1.7827c0 .3523-.0199.5762-.0544.6708-.033.0947-.1894.1424-.3046.1424-.1086 0-.19-.0477-.2238-.1351-.041-.0887-.0609-.2986-.0609-.6238v-1.9469c0-.3324.0199-.5423.0543-.6237.0338-.0808.1086-.122.2171-.122.1153 0 .2709.0412.3114.1425.041.0947.0609.2986.0609.6032v1.8926zm-2.4747-5.5809v7.3636h1.7157l.1152-.4675c.1556.1894.3251.3324.5152.4271.1828.0881.4608.1357.678.1357.3047 0 .5629-.0748.7802-.237.2165-.1562.3589-.3462.4198-.5628.0543-.2173.0887-.543.0887-.9841v-2.0675c0-.4409-.0139-.7324-.0344-.8681-.0199-.1357-.0742-.2781-.1695-.4204-.1021-.1425-.2437-.251-.4272-.3325-.1834-.0742-.3999-.1152-.6576-.1152-.2172 0-.4952.0477-.6846.1285-.1835.0887-.353.2238-.5086.4007V8.2603h-1.8309z\"/></svg>"},"songkick":{"color":"#F80046","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#F80046\" d=\"M6.55 18.779c-1.855 0-3.372-.339-4.598-1.602l1.92-1.908c.63.631 1.74.853 2.715.853 1.186 0 1.739-.391 1.739-1.089 0-.291-.06-.529-.239-.717-.15-.154-.404-.273-.795-.324l-1.455-.205c-1.064-.152-1.891-.51-2.43-1.072-.555-.578-.84-1.395-.84-2.434C2.536 8.066 4.2 6.45 6.96 6.45c1.74 0 3.048.407 4.086 1.448L9.171 9.77c-.765-.766-1.77-.715-2.295-.715-1.039 0-1.465.597-1.465 1.125 0 .152.051.375.24.561.15.153.404.307.832.359l1.467.203c1.09.153 1.875.495 2.385 1.005.645.63.9 1.53.9 2.655 0 2.47-2.127 3.819-4.68 3.819l-.005-.003zM20.813 2.651C19.178 1.432 17.37.612 15.089.237v10.875l3.261-4.539h3.565l-4.095 5.72s.944 1.51 1.515 2.405c.586.899 1.139 1.14 1.965 1.14h.57v2.806h-.872c-1.812 0-2.9-.33-3.72-1.575-.504-.811-2.175-3.436-2.175-3.436v4.995H12.12V-.001H12c-3.852 0-6.509.931-8.811 2.652C-.132 5.137.001 8.451.001 11.997c0 3.547-.133 6.867 3.188 9.352C5.491 23.074 8.148 24 12 24s6.51-.927 8.812-2.651C24.131 18.865 24 15.544 24 11.997c0-3.546.132-6.859-3.188-9.346h.001z\"/></svg>"},"bandsintown":{"color":"#00CEC8","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#00CEC8\" d=\"M6.399 12.8v4.8H19.2v1.6H4.799V0H0v24h24V12.8H6.399Zm4.801-8H6.399v6.4H11.2V4.8Zm6.4 0h-4.8v6.4h4.8V4.8ZM24 0h-4.8v11.2H24V0Z\"/></svg>"},"napster":{"color":"#2259FF","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#2259FF\" d=\"M20.495 4.543c-.22 0-.438 0-.657.03h-.031l-.032-.03C17.93 2.21 15.02.798 12.015.798c-3.004 0-5.945 1.412-7.76 3.775l-.031.03h-.031c-.22-.03-.439-.03-.658-.03H2.16v2.394l-.032.03A3.628 3.628 0 0 0 0 10.282c0 1.412.844 2.701 2.127 3.284h.063v.062c.031 5.278 4.443 9.575 9.825 9.575s9.794-4.297 9.825-9.575v-.062l.032-.03C23.155 12.92 24 11.632 24 10.25c0-1.412-.845-2.7-2.128-3.284l-.032-.03V4.542zM6.821 5.34a7.443 7.443 0 0 1 5.194-2.117c1.94 0 3.818.767 5.195 2.117l.062.062-.094.061c-.375.215-.72.43-1.064.675l-.03.031-.032-.03c-.908-.461-2.347-.983-4.005-.983s-3.098.522-4.006.982l-.03.031-.032-.03a10.22 10.22 0 0 0-1.064-.676l-.188-.061zm12.329 8.195c0 3.866-3.223 7.027-7.166 7.027-3.942 0-7.134-3.16-7.134-7.027V7.458l.094.03c1.252.308 2.44 1.658 2.722 1.996.313-.338 1.784-1.658 4.35-1.658 2.565 0 4.036 1.35 4.35 1.658.28-.338 1.438-1.688 2.721-1.995l.094-.031v6.077z\"/></svg>"},"myspace":{"color":"#030303","svg":"<svg viewBox=\"0 0 24 24\"><path style=\"fill:var(--mbu-text,currentColor)\" d=\"M19.802 12.274A3.811 3.811 0 0023.62 8.47c0-2.101-1.71-3.795-3.818-3.795a3.816 3.816 0 00-3.818 3.81 3.817 3.817 0 003.818 3.811zm-8.602.705a3.43 3.43 0 003.435-3.424A3.43 3.43 0 0011.2 6.13a3.44 3.44 0 00-3.436 3.436A3.436 3.436 0 0011.2 13zm-7.8.635c1.71 0 3.093-1.38 3.093-3.081 0-1.704-1.395-3.084-3.105-3.084A3.086 3.086 0 00.3 10.539c0 1.7 1.387 3.078 3.095 3.078zm0 .705c-1.96 0-3.4 1.717-3.4 3.495v1.196c0 .17.138.31.31.31h6.18a.31.31 0 00.309-.31v-1.196c0-1.779-1.437-3.5-3.398-3.5zm7.8-.56c-2.18 0-3.78 1.915-3.78 3.891v1.331c0 .188.156.344.345.344h6.87a.344.344 0 00.342-.344V17.65c0-1.976-1.598-3.891-3.777-3.891zm8.602-.617c-2.422 0-4.197 2.126-4.197 4.323v1.477c0 .21.172.381.382.381h7.63c.21 0 .383-.171.383-.381v-1.477c-.001-2.197-1.776-4.323-4.198-4.323z\"/></svg>"},"vk":{"color":"#0077FF","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#0077FF\" d=\"m9.489.004.729-.003h3.564l.73.003.914.01.433.007.418.011.403.014.388.016.374.021.36.025.345.03.333.033c1.74.196 2.933.616 3.833 1.516.9.9 1.32 2.092 1.516 3.833l.034.333.029.346.025.36.02.373.025.588.012.41.013.644.009.915.004.98-.001 3.313-.003.73-.01.914-.007.433-.011.418-.014.403-.016.388-.021.374-.025.36-.03.345-.033.333c-.196 1.74-.616 2.933-1.516 3.833-.9.9-2.092 1.32-3.833 1.516l-.333.034-.346.029-.36.025-.373.02-.588.025-.41.012-.644.013-.915.009-.98.004-3.313-.001-.73-.003-.914-.01-.433-.007-.418-.011-.403-.014-.388-.016-.374-.021-.36-.025-.345-.03-.333-.033c-1.74-.196-2.933-.616-3.833-1.516-.9-.9-1.32-2.092-1.516-3.833l-.034-.333-.029-.346-.025-.36-.02-.373-.025-.588-.012-.41-.013-.644-.009-.915-.004-.98.001-3.313.003-.73.01-.914.007-.433.011-.418.014-.403.016-.388.021-.374.025-.36.03-.345.033-.333c.196-1.74.616-2.933 1.516-3.833.9-.9 2.092-1.32 3.833-1.516l.333-.034.346-.029.36-.025.373-.02.588-.025.41-.012.644-.013.915-.009ZM6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z\"/></svg>"},"weibo":{"color":"#E6162D","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#E6162D\" d=\"M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z\"/></svg>"},"pandora":{"color":"#224099","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#224099\" d=\"M1.882 0v24H8.32a1.085 1.085 0 001.085-1.085v-4.61h1.612c7.88 0 11.103-4.442 11.103-9.636C22.119 2.257 17.247 0 12.662 0H1.882Z\"/></svg>"},"ebay":{"color":"#E53238","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#E53238\" d=\"M6.056 12.132v-4.92h1.2v3.026c.59-.703 1.402-.906 2.202-.906 1.34 0 2.828.904 2.828 2.855 0 .233-.015.457-.06.668.24-.953 1.274-1.305 2.896-1.344.51-.018 1.095-.018 1.56-.018v-.135c0-.885-.556-1.244-1.53-1.244-.72 0-1.245.3-1.305.81h-1.275c.136-1.29 1.5-1.62 2.686-1.62 1.064 0 1.995.27 2.415 1.02l-.436-.84h1.41l2.055 4.125 2.055-4.126H24l-3.72 7.305h-1.346l1.07-2.04-2.33-4.38c.13.255.2.555.2.93v2.46c0 .346.01.69.04 1.005H16.8a6.543 6.543 0 01-.046-.765c-.603.734-1.32.96-2.32.96-1.48 0-2.272-.78-2.272-1.695 0-.15.015-.284.037-.405-.3 1.246-1.36 2.086-2.767 2.086-.87 0-1.694-.315-2.2-.93 0 .24-.015.494-.04.734h-1.18c.02-.39.04-.855.04-1.245v-1.05h-4.83c.065 1.095.818 1.74 1.853 1.74.718 0 1.355-.3 1.568-.93h1.24c-.24 1.29-1.61 1.725-2.79 1.725C.95 15.009 0 13.822 0 12.232c0-1.754.982-2.91 3.116-2.91 1.688 0 2.93.886 2.94 2.806v.005zm9.137.183c-1.095.034-1.77.233-1.77.95 0 .465.36.97 1.305.97 1.26 0 1.935-.69 1.935-1.814v-.13c-.45 0-.99.006-1.484.022h.012zm-6.06 1.875c1.11 0 1.876-.806 1.876-2.02s-.768-2.02-1.893-2.02c-1.11 0-1.89.806-1.89 2.02s.765 2.02 1.875 2.02h.03zm-4.35-2.514c-.044-1.125-.854-1.546-1.725-1.546-.944 0-1.694.474-1.815 1.546z\"/></svg>"},"commons":{"color":"#006699","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#006699\" d=\"M9.048 15.203a2.952 2.952 0 1 1 5.904 0 2.952 2.952 0 0 1-5.904 0zm11.749.064v-.388h-.006a8.726 8.726 0 0 0-.639-2.985 8.745 8.745 0 0 0-1.706-2.677l.004-.004-.186-.185-.044-.045-.026-.026-.204-.204-.006.007c-.848-.756-1.775-1.129-2.603-1.461-1.294-.519-2.138-.857-2.534-2.467.443.033.839.174 1.13.481C15.571 6.996 11.321 0 11.321 0s-1.063 3.985-2.362 5.461c-.654.744.22.273 1.453-.161.279 1.19.77 2.119 1.49 2.821.791.771 1.729 1.148 2.556 1.48.672.27 1.265.508 1.767.916l-.593.594-.668-.668-.668 2.463 2.463-.668-.668-.668.6-.599a6.285 6.285 0 0 1 1.614 3.906h-.844v-.944l-2.214 1.27 2.214 1.269v-.944h.844a6.283 6.283 0 0 1-1.614 3.906l-.6-.599.668-.668-2.463-.668.668 2.463.668-.668.6.6a6.263 6.263 0 0 1-3.907 1.618v-.848h.945L12 18.45l-1.27 2.214h.944v.848a6.266 6.266 0 0 1-3.906-1.618l.599-.6.668.668.668-2.463-2.463.668.668.668-.6.599a6.29 6.29 0 0 1-1.615-3.906h.844v.944l2.214-1.269-2.214-1.27v.944h-.843a6.292 6.292 0 0 1 1.615-3.906l.6.599-.668.668 2.463.668-.668-2.463-.668.668-2.359-2.358-.23.229-.044.045-.185.185.004.004a8.749 8.749 0 0 0-2.345 5.662h-.006v.649h.006a8.749 8.749 0 0 0 2.345 5.662l-.004.004.185.185.045.045.045.045.185.185.004-.004a8.73 8.73 0 0 0 2.677 1.707 8.75 8.75 0 0 0 2.985.639V24h.649v-.006a8.75 8.75 0 0 0 2.985-.639 8.717 8.717 0 0 0 2.677-1.707l.004.004.187-.187.044-.043.043-.044.187-.186-.004-.004a8.733 8.733 0 0 0 1.706-2.677 8.726 8.726 0 0 0 .639-2.985h.006v-.259z\"/></svg>"},"googleplay":{"color":"#414141","svg":"<svg viewBox=\"0 0 24 24\"><path fill=\"#01875F\" d=\"M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z\"/></svg>"},"globe":{"color":"#6f7d75","svg":"<svg viewBox=\"2 2 20 20\" fill=\"none\" stroke=\"#6f7d75\" stroke-width=\"1.8\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18\"/></svg>"}};
function stIcon(name, size) { var i = ST_ICONS[name]; if (!i) return ''; size = size || 16; return i.svg.replace(/<svg\b([^>]*)>/, function (m, a) { a = a.replace(/\s(?:width|height)="[^"]*"/g, ''); var ns = /\bxmlns=/.test(a) ? '' : ' xmlns="http://www.w3.org/2000/svg"'; return '<svg' + a + ns + ' width="' + size + '" height="' + size + '">'; }); }
function stColor(name) { return (ST_ICONS[name] && ST_ICONS[name].color) || ''; }
// </ST-ICONS>

// <ST-TOKENS> — generated by dev/tokens/sync-tokens.mjs from dev/tokens/design-tokens.mjs — DO NOT EDIT
const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001;--mbu-z-tip:2147483647}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
// </ST-TOKENS>

// <ST-UI> — generated by dev/ui/sync-ui.mjs from dev/ui/ui-components.mjs — DO NOT EDIT
const MBU_UI_CSS = '.mbu-help{display:inline-grid;place-items:center;width:26px;height:26px;padding:0;border:0;border-radius:50%;background:none;color:var(--mbu-text-weak);text-decoration:none;line-height:1}.mbu-help svg{width:18px;height:18px;display:block}.mbu-help:hover{color:var(--mbu-accent-text,var(--mbu-accent));background:none;text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-pop);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{width:auto;margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-log{flex:0 0 auto;width:auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(860px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-hclear,.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min,.mbu-logpop-full{width:auto;font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-hclear:hover,.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover,.mbu-logpop-full:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-log-f,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x,#mbu-logpop.min .mbu-logpop-full{display:none}#mbu-logpop.min{max-height:none;width:auto!important;height:auto!important}#mbu-logpop.sized{max-height:none}.mbu-logpop-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;opacity:.6;background:linear-gradient(135deg,transparent 55%,var(--mbu-border-strong) 55%,var(--mbu-border-strong) 62%,transparent 62%,transparent 75%,var(--mbu-border-strong) 75%,var(--mbu-border-strong) 82%,transparent 82%)}.mbu-logpop-grip:hover{opacity:1}#mbu-logpop.min .mbu-logpop-grip,#mbu-logpop.full .mbu-logpop-grip{display:none}#mbu-logpop.full{top:12px!important;left:12px!important;right:12px!important;bottom:12px!important;width:auto!important;height:auto!important;max-height:none;transform:none!important}#mbu-logpop.full .mbu-logpop-h{cursor:default}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-logemb{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--mbu-bg);font:13px var(--mbu-font);color:var(--mbu-text)}.mbu-logemb .mbu-logpop-h{cursor:default;padding:7px 10px}.mbu-logemb .mbu-logpop-h>.mbu-log-q{flex-basis:160px;margin-left:0}.mbu-logemb .mbu-logpop-h>.mbu-log-ses{flex-basis:240px}.mbu-logpop-h{flex-wrap:nowrap}.mbu-logpop-h>*{flex-shrink:0;white-space:nowrap}.mbu-logpop-h>.mbu-log-q{flex-shrink:1;min-width:60px}.mbu-logpop-h>.mbu-log-ses{flex-shrink:1;min-width:90px}.mbu-logpop-h>.mbu-logpop-sp{flex:1 1 0;min-width:0}.mbu-logpop .mbu-log-ses{flex:0 1 260px;min-width:120px;max-width:100%}.mbu-logpop-hclear:disabled{opacity:.5;cursor:default}.mbu-log-dbg{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--mbu-text);cursor:pointer;white-space:nowrap}.mbu-log-dbg input{margin:0}#mbu-logpop.min .mbu-log-dbg{display:none}.mbu-log-past .mbu-logpop-clear{display:none}#mbu-logpop.min .mbu-log-ses,#mbu-logpop.min .mbu-logpop-hclear{display:none}.mbu-logpop .mbu-log-q{flex:0 1 200px;min-width:80px;margin-left:6px;font:12px var(--mbu-font);padding:2px 8px;border:1px solid var(--mbu-border);border-radius:5px;cursor:text}#mbu-logpop.min .mbu-log-q{display:none}.mbu-logpop .mbu-log-li.mbu-log-nq{display:none}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-pre .mbu-log-m{white-space:pre;font:12px/1.35 ui-monospace,Consolas,monospace;word-break:normal}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-c{color:var(--mbu-text-weak);flex:0 0 auto}.mbu-log-list:not(.mbu-log-cats) .mbu-log-c{display:none}.mbu-log-list.mbu-log-cats{display:grid;grid-template-columns:auto auto minmax(0,1fr);gap:3px 9px;align-content:start}.mbu-log-cats .mbu-log-li{display:contents}.mbu-log-cats .mbu-log-empty{grid-column:1/-1}.mbu-log-f{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px;padding:5px 13px;border-bottom:1px solid var(--mbu-border-soft);font-size:11px}.mbu-log-f[hidden]{display:none}.mbu-log-fg{display:contents}.mbu-log-fs{width:1px;height:12px;background:var(--mbu-border);margin:0 6px}.mbu-logpop .mbu-log-fb{width:auto;font:inherit;color:var(--mbu-text-weak);background:none;border:1px solid transparent;border-radius:5px;padding:0 6px;line-height:1.6;cursor:pointer}.mbu-logpop .mbu-log-fb:hover{color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb.on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-border)}.mbu-logpop .mbu-log-fb[data-sev=error]{color:var(--mbu-error)}.mbu-logpop .mbu-log-fb[data-sev=warn]{color:var(--mbu-warn)}.mbu-logpop .mbu-log-fb[data-sev=info]{color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-fb[data-sev].on{background:var(--mbu-bg-hover);border-color:currentColor;font-weight:600}.mbu-logpop .mbu-log-fb[data-cat]{border-color:var(--mbu-border-soft);background:var(--mbu-bg-raised);border-radius:999px;padding:0 8px}.mbu-logpop .mbu-log-fb[data-cat].on{color:var(--mbu-accent-text);background:var(--mbu-accent-soft);border-color:var(--mbu-accent)}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}.mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug>*{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23888%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23fff%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E")}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}select.mbu-select:not(#mbu-0):not(#mbu-1){-webkit-appearance:none;-moz-appearance:none;appearance:none;box-sizing:border-box;height:22px;max-width:100%;margin:0 2px;padding:0 26px 0 12px;border:1px solid var(--mbu-border);border-radius:20px;outline-offset:1px;background-color:transparent;background-image:linear-gradient(45deg,transparent 50%,var(--mbu-text-weak) 50%),linear-gradient(135deg,var(--mbu-text-weak) 50%,transparent 50%);background-position:calc(100% - 13px) 50%,calc(100% - 8px) 50%;background-size:5px 5px;background-repeat:no-repeat;color:var(--mbu-text);font:600 12px var(--mbu-font);line-height:20px;cursor:pointer;vertical-align:middle}select.mbu-select:not(#mbu-0):not(#mbu-1):hover{border-color:var(--mbu-accent)}select.mbu-select:not(#mbu-0):not(#mbu-1):disabled{opacity:.45;cursor:default;border-color:var(--mbu-border)}select.mbu-select:not(#mbu-0):not(#mbu-1) option{background:var(--mbu-bg);color:var(--mbu-text);font-weight:400}.mbu-step:not(#mbu-0):not(#mbu-1){display:inline-flex;align-items:center;box-sizing:border-box;height:22px;margin:0 2px;padding:0;border:1px solid var(--mbu-border);border-radius:20px;background:transparent;vertical-align:middle;white-space:nowrap;flex:0 0 auto}.mbu-step:not(#mbu-0):not(#mbu-1):hover,.mbu-step:not(#mbu-0):not(#mbu-1):focus-within{border-color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>button{all:unset;box-sizing:border-box;width:20px;height:20px;text-align:center;font:600 13px/20px var(--mbu-font);color:var(--mbu-text-weak);cursor:pointer;user-select:none}.mbu-step:not(#mbu-0):not(#mbu-1)>button:hover{color:var(--mbu-accent)}.mbu-step:not(#mbu-0):not(#mbu-1)>input{all:unset;box-sizing:content-box;min-width:2ch;height:20px;padding:0 1px;font:600 12px/20px var(--mbu-font);color:var(--mbu-text);text-align:center;-moz-appearance:textfield;appearance:textfield;cursor:text}.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-inner-spin-button,.mbu-step:not(#mbu-0):not(#mbu-1)>input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled){opacity:.45;border-color:var(--mbu-border)}.mbu-step:not(#mbu-0):not(#mbu-1):has(>input:disabled)>button{cursor:default;color:var(--mbu-text-weak)}';
// Help link markup. Every script's help link is this, pointing at its own README.
// `name` is the userscript folder, e.g. mbuHelpHref('art_station').
function mbuHelpHref(name) {
    return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
}
var MBU_HELP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 17h.01"/></svg>';
// the sort-name guess, A over Z with a down arrow, for every button that guesses a sort name
var MBU_SORT_ICON = '<svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3v18M1 17l4 4 4-4"/><path d="M13 11l3-8 3 8M14.1 8h3.8M13 14h6l-6 7h6"/></svg>';
// the edit pencil, for every button that opens an editor (#849)
var MBU_EDIT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener" aria-label="Help"'
        + ' data-tip="Help: open the README in a new tab">' + (label || MBU_HELP_ICON) + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Help');
    a.dataset.tip = 'Help: open the README in a new tab';
    if (label) a.textContent = label; else a.innerHTML = MBU_HELP_ICON;
    return a;
}

// The config (settings) icon every script's settings button shows: the gear in text
// presentation (U+FE0E), so it takes the button's colour instead of an emoji's. #650
var MBU_CFG_ICON = '\u2699\uFE0E';

// HTML for an innerHTML on a page that enforces Trusted Types (YouTube Music, #650): there a
// plain string is refused ("This document requires 'TrustedHTML' assignment"). The policy
// passes the string through; the markup is the script's own. Elsewhere it is the string.
var _mbuTT;
function mbuHtml(s) {
    if (_mbuTT === undefined) {
        _mbuTT = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) _mbuTT = tt.createPolicy('mbu-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings, as before */ }
    }
    return _mbuTT ? _mbuTT.createHTML(String(s)) : String(s);
}

// The first line of every script's log: the script, its version, and what runs it, so a
// pasted log says which manager and browser it came from (#282 started it in Art Station):
//   Log.info(mbuStartupInfo('Fusion'));
//   -> Fusion v2026.10.1 · Violentmonkey 2.31.0 · firefox 143.0 (win)
// Inside String Theory GM_info describes the bundle, so the line names it:
//   -> Fusion (String Theory v2026.10.1) · Tampermonkey 5.3.3 · chrome 140.0 (win)
// On MusicBrainz it ends with the interface language, which changes what a script reads
// off the page: "· MusicBrainz in de".
function mbuStartupInfo(name) {
    var g = null;
    try { g = (typeof GM_info !== 'undefined' && GM_info) || null; } catch (e) { /* no GM_info */ }
    var s = (g && g.script) || {}, p = (g && g.platform) || {};
    var host = String(s.name || '').replace(/\*$/, ''), ver = s.version || '?';
    var line = !name ? (host || 'Script') + ' v' + ver
        : (host && host !== name) ? name + ' (' + host + ' v' + ver + ')'
        : name + ' v' + ver;
    if (g) line += ' · ' + (g.scriptHandler || 'unknown manager') + (g.version ? ' ' + g.version : '');
    if (p.browserName) line += ' · ' + p.browserName + (p.browserVersion ? ' ' + p.browserVersion : '') + (p.os ? ' (' + p.os + ')' : '');
    else { try { line += ' · ' + navigator.userAgent; } catch (e) { /* no navigator */ } }
    try {
        if (/(^|\.)musicbrainz\.(org|eu)$/i.test(location.hostname)) {
            // <html lang>, or MB's lang cookie when the page isn't parsed yet (document-start)
            var lang = (document.documentElement && document.documentElement.lang) || ((document.cookie.match(/(?:^|;\s*)lang=([^;]+)/) || [])[1]) || 'en';
            line += ' · MusicBrainz in ' + lang;
        }
    } catch (e) { /* no document */ }
    return line;
}

// One copy per page (#653). With String Theory and a standalone install of the same script
// both on, two copies build the same element ids and fight over them: each settings window
// fills in the other's checkboxes, rows flip between two rule sets. So one copy runs, the
// one with the higher version, and the other stays off without a word; only the running
// copy notes it in its log (majkinetor: "disable copy that has lower version without any
// info (except in log of active copy)"):
//   if (!mbuClaim('platform_check', 'Platform Check')) return;   // first line of the script
// The claim is a data- attribute on <html>, which every copy sees whatever its sandbox.
// It is decided at once, so no script starts late. The copy that starts first takes the
// page. When it is the older one, the newer copy stays off for this page and leaves a note
// in localStorage, and from the next page load the older copy finds the note and steps
// aside. A note whose copy has gone (uninstalled) is cleared by the older copy after the
// page loads, so it runs again from the load after.
function mbuClaimVer(v) {
    return String(v || '').split('.').map(function (n) { return parseInt(n, 10) || 0; });
}
function mbuClaimCmp(a, b) {
    var x = mbuClaimVer(a), y = mbuClaimVer(b);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
}
function mbuClaim(key, label) {
    var info = (typeof GM_info !== 'undefined' && GM_info && GM_info.script) || {};
    var name = String(info.name || label || key), ver = String(info.version || '0');
    var mine = (name.slice(-1) === '*' ? 'String Theory' : 'standalone') + ' v' + ver;
    var root = document.documentElement, attr = 'data-mbu-run-' + key, ev = 'mbu-claim-' + key, noteKey = 'mbu-newer-' + key;
    var log = function (msg) { try { if (typeof mbuLog !== 'undefined' && mbuLog.active) mbuLog.active.info(msg); else if (typeof mbuToast !== 'undefined' && typeof mbuToast.log === 'function') mbuToast.log('info', msg); else console.info('[' + (label || key) + '] ' + msg); } catch (e) { /* no log */ } };
    var note = null;
    try { note = JSON.parse(localStorage.getItem(noteKey) || 'null'); } catch (e) { /* storage blocked */ }
    // A note older than this copy is spent. This copy's own note stays: it is what keeps the
    // older copy aside on every later load, not only the next one (#671).
    var noteCmp = note ? mbuClaimCmp(note.ver, ver) : 1;
    if (noteCmp < 0) { try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ } }
    if (noteCmp <= 0) note = null;
    var held = root && root.getAttribute(attr);
    var off = function (why) {
        // tell the running copy (any sandbox hears a DOM event), or the copy that runs after
        // this one (it reads the attribute), and stay quiet
        try { if (root) root.setAttribute(attr + '-off', JSON.stringify({ mine: mine, why: why })); } catch (e) { /* no attribute */ }
        try { document.dispatchEvent(new CustomEvent(ev, { detail: JSON.stringify({ mine: mine, ver: ver, why: why }) })); } catch (e) { /* no event */ }
        return false;
    };
    if (held) {
        var heldVer = (root.getAttribute(attr + '-ver') || '0');
        if (mbuClaimCmp(ver, heldVer) > 0) {
            try { localStorage.setItem(noteKey, JSON.stringify({ ver: ver, mine: mine, at: Date.now() })); } catch (e) { /* storage blocked */ }
            return off('newer, from the next page load');
        }
        return off('older or the same');
    }
    if (note) {
        // a newer copy said it is installed: leave the page to it, unless it never shows up
        var watch = function () {
            setTimeout(function () {
                if (root.getAttribute(attr)) return;
                try { localStorage.removeItem(noteKey); } catch (e) { /* storage blocked */ }
                try { console.info('[' + (label || key) + '] the newer copy (' + note.mine + ') did not start: this copy runs again from the next page load'); } catch (e) { /* no console */ }
            }, 3000);
        };
        if (document.readyState === 'complete') watch(); else window.addEventListener('load', watch, { once: true });
        return off('older: a newer copy runs');
    }
    if (root) { root.setAttribute(attr, mine); root.setAttribute(attr + '-ver', ver); }
    var told = function (o) {
        log((label || key) + ' is installed twice: ' + mine + ' runs, ' + (o.mine || 'another copy') + ' is switched off'
            + (o.why === 'newer, from the next page load' ? ' for this page (it is newer and runs from the next page load)' : '') + '.');
    };
    document.addEventListener(ev, function (e) { var o = {}; try { o = JSON.parse(e.detail); } catch (x) { /* not ours */ } told(o); });
    // a copy that stepped aside before this one started (it found a note): log it once the script's log is up
    var before = root && root.getAttribute(attr + '-off');
    if (before) setTimeout(function () { var o = {}; try { o = JSON.parse(before); } catch (x) { /* not ours */ } told(o); }, 0);
    return true;
}

// Toast. mbuToast(msg) or mbuToast(msg, { ms, kind, at:{x,y}, action:{ label, onClick } }).
//
// An action adds one button to the toast (e.g. "Copy log"): the toast is then clickable,
// stays up longer (12 s unless ms says otherwise), and closes when the button is used.
//
// Severity is inferred from a leading warning/tick glyph when not given — Art
// Station already did that and it is why its toasts reached its log with the
// right level. Set mbuToast.log = function (level, message) {...} once at
// startup and every toast mirrors into that script's own log; leave it unset
// and the toast still shows.
var _mbuToastT = null;
function mbuToast(msg, opts) {
    opts = opts || {};
    var s = String(msg);
    var kind = opts.kind || (/^\s*[⚠✗×]/.test(s) ? 'warn' : /[✓✅]/.test(s) ? 'ok' : 'info');
    try {
        if (typeof mbuToast.log === 'function') mbuToast.log(kind, s.replace(/^\s*[⚠✗×✓✅]\s*/, ''));
    } catch (e) { /* a broken log sink must never swallow the toast */ }
    var el = document.getElementById('mbu-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mbu-toast';
        (document.body || document.documentElement).appendChild(el);
    }
    el.className = 'mbu-toast-on' + (kind !== 'info' ? ' mbu-toast-' + kind : '') + (opts.action ? ' mbu-toast-act' : '');
    el.textContent = s;
    if (opts.action) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'mbu-toast-btn'; b.textContent = opts.action.label || 'OK';
        b.onclick = function () {
            try { if (opts.action.onClick) opts.action.onClick(b); } catch (e) { /* the toast still closes */ }
            clearTimeout(_mbuToastT); _mbuToastT = setTimeout(function () { el.className = ''; }, 900);
        };
        el.appendChild(b);
    }
    // Anchor above a click point when asked, clamped into the viewport; otherwise
    // fall back to the centred default by clearing the inline placement.
    if (opts.at) {
        var w = el.offsetWidth, h = el.offsetHeight;
        el.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, opts.at.x - w / 2)) + 'px';
        el.style.top = Math.max(6, Math.min(window.innerHeight - h - 6, opts.at.y - h - 10)) + 'px';
        el.style.bottom = 'auto';
        el.style.transform = 'none';
    } else {
        el.style.left = ''; el.style.top = ''; el.style.bottom = ''; el.style.transform = '';
    }
    clearTimeout(_mbuToastT);
    _mbuToastT = setTimeout(function () { el.className = ''; }, opts.ms || (opts.action ? 12000 : 2600));
    return el;
}

// Config-window title bar.
//
//   mbuCfgHeader({ script:'art_station', name:'Art Station', version:'2026.9.2',
//                  icon:'<svg…>' | '<img…>', log:true, logClass:'as-setup-logbtn' })
//
// Returns the markup for the whole bar. 'log' adds the Log button; a script with
// no log window leaves it out rather than shipping a dead control. logClass /
// logId are carried through IN ADDITION to the shared class so a script's
// existing click handler keeps working — adopting the component must not mean
// rewiring every listener at the same time.
function mbuCfgHeader(o) {
    o = o || {};
    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    };
    var html = '<div class="mbu-cfg-h">';
    if (o.icon) html += '<span class="mbu-cfg-ic">' + o.icon + '</span>';
    html += '<span class="mbu-cfg-name">' + esc(o.name) + '</span>';
    if (o.version) html += '<span class="mbu-cfg-ver" data-tip="The installed version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' data-tip="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Settings controls: in root, every <select> becomes the pill drop-down and every number field the
// − n + stepper. The field stays the script's own (its value, min, max, step and listeners): − and +
// step it within them and fire input and change, as typing would. Call it once a window's markup is in;
// again after a re-render does no harm. Returns root.
function mbuControls(root) {
    if (!root || !root.querySelectorAll) return root;
    Array.prototype.forEach.call(root.querySelectorAll('select'), function (s) { s.classList.add('mbu-select'); });
    Array.prototype.forEach.call(root.querySelectorAll('input[type=number]'), function (inp) {
        var p = inp.parentNode;
        if (!p || (p.classList && p.classList.contains('mbu-step'))) return;
        var wrap = document.createElement('span');
        wrap.className = 'mbu-step';
        p.insertBefore(wrap, inp);
        var btn = function (down) {
            var b = document.createElement('button');
            b.type = 'button';
            b.tabIndex = -1;
            b.textContent = down ? '−' : '+';
            b.setAttribute('aria-label', down ? 'Less' : 'More');
            b.addEventListener('click', function (e) {
                e.preventDefault();
                if (inp.disabled || inp.readOnly) return;
                var was = inp.value;
                try { if (down) inp.stepDown(); else inp.stepUp(); } catch (x) { return; }
                if (inp.value === was) return;
                inp.dispatchEvent(new Event('input', { bubbles: true }));
                inp.dispatchEvent(new Event('change', { bubbles: true }));
            });
            return b;
        };
        wrap.appendChild(btn(true));
        wrap.appendChild(inp);
        wrap.appendChild(btn(false));
        // as wide as its longest value; a width the script set for the old field would cut it
        inp.style.width = Math.max(2, String(inp.max || inp.value || '').length) + 0.5 + 'ch';
    });
    return root;
}

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Shared settings: the few that belong to all the scripts at once, not to one (the corner
// launchers' layout). GM storage is private to each script, so these live in the page's
// localStorage on MusicBrainz's origin, as JSON under 'mbu.<key>'; every script, bundled or
// standalone, reads the same value. One argument reads (undefined when unset or blocked), two
// write, and null removes. Per-origin: musicbrainz.org, beta and test each keep their own.
// Every key is listed in DEVELOP.md → Shared storage.
function mbuShared(key, value) {
    var k = 'mbu.' + key;
    try {
        if (arguments.length < 2) { var v = localStorage.getItem(k); return v == null ? undefined : JSON.parse(v); }
        if (value == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(value));
    } catch (e) { /* storage blocked */ }
    return value;
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use, all bottom-right: Apollo and Art Station 10 (never on the same page), Scribe 15
// (above Apollo on the edit page), Falcon 20, Fusion 30, Mission Control 40. Scribe is not on the shared block and keeps a copy of this.
// The stack is a column; the shared setting cornerFlow = 'row' (mbuShared, set from String
// Theory's menu) lines it up along the bottom/top edge instead, the lowest order still nearest the corner.
// The shared setting cornerSide = 'left' (also from the menu) mirrors every corner across the screen: a
// launcher tagged 'br' sits bottom-left. Its other side is set to auto, so a CSS left/right can't stretch it.
// On a phone MusicBrainz's page is wider than the screen, so the browser widens the layout
// viewport, which position:fixed measures from, to the page: the corner was off screen, a scroll
// right and down away. Each edge is offset by the gap between it and the visual viewport (what is
// on screen), kept up as that scrolls and resizes; on a desktop the gap is 0.
//
// The dock (#847): while the page sets data-mbu-dock on <html> (Event Horizon, while it shows),
// the bottom-right launchers fold behind one String Theory button. A click unrolls them, each
// with its name (data-mb-corner-label) beside it. data-mb-corner-dock="no" keeps a launcher out
// of the dock (Event Horizon's own switch); "hide" hides it while docked (Art Station and Apollo,
// whose pages Event Horizon replaces). data-mb-corner-paths, a regular expression, names the paths a
// launcher belongs on: Event Horizon moves to another page without loading it, and the dock hides
// a launcher that came along to a page its script doesn't run on.
var MBU_DOCK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"> <path d="M64 10 L66.4 10.2 L68.7 10.6 L70.9 11.4 L73.1 12.4 L75.2 13.7 L77.1 15.2 L78.8 17 L80.4 18.9 L81.8 21 L83.1 23.1 L84.1 25.4 L85 27.6 L85.7 29.9 L86.3 32.1 L86.8 34.3 L87.1 36.4 L87.4 38.4 L87.7 40.3 L87.9 42.1 L88.2 43.7 L88.5 45.2 L88.9 46.6 L89.4 47.8 L90 49 L90.7 50.1 L91.6 51.1 L92.6 52.2 L93.7 53.2 L95 54.2 L96.4 55.3 L97.9 56.5 L99.5 57.7 L101.1 59.1 L102.7 60.6 L104.4 62.2 L106 64 L107.5 65.9 L108.9 67.9 L110.2 70.1 L111.3 72.3 L112.1 74.7 L112.8 77.1 L113.1 79.5 L113.2 81.9 L113 84.3 L112.6 86.6 L111.8 88.9 L110.8 91 L109.5 93 L107.9 94.7 L106.1 96.3 L104.1 97.7 L102 98.8 L99.7 99.7 L97.3 100.4 L94.9 100.8 L92.4 101 L89.9 100.9 L87.4 100.7 L85 100.4 L82.7 99.9 L80.4 99.3 L78.3 98.6 L76.3 97.8 L74.4 97.1 L72.7 96.4 L71 95.7 L69.5 95.1 L68 94.6 L66.7 94.3 L65.3 94.1 L64 94 L62.7 94.1 L61.3 94.3 L60 94.6 L58.5 95.1 L57 95.7 L55.3 96.4 L53.6 97.1 L51.7 97.8 L49.7 98.6 L47.6 99.3 L45.3 99.9 L43 100.4 L40.6 100.7 L38.1 100.9 L35.6 101 L33.1 100.8 L30.7 100.4 L28.3 99.7 L26 98.8 L23.9 97.7 L21.9 96.3 L20.1 94.7 L18.5 93 L17.2 91 L16.2 88.9 L15.4 86.6 L15 84.3 L14.8 81.9 L14.9 79.5 L15.2 77.1 L15.9 74.7 L16.7 72.3 L17.8 70.1 L19.1 67.9 L20.5 65.9 L22 64 L23.6 62.2 L25.3 60.6 L26.9 59.1 L28.5 57.7 L30.1 56.5 L31.6 55.3 L33 54.2 L34.3 53.2 L35.4 52.2 L36.4 51.1 L37.3 50.1 L38 49 L38.6 47.8 L39.1 46.6 L39.5 45.2 L39.8 43.7 L40.1 42.1 L40.3 40.3 L40.6 38.4 L40.9 36.4 L41.2 34.3 L41.7 32.1 L42.3 29.9 L43 27.6 L43.9 25.4 L44.9 23.1 L46.2 21 L47.6 18.9 L49.2 17 L50.9 15.2 L52.8 13.7 L54.9 12.4 L57.1 11.4 L59.3 10.6 L61.6 10.2Z" fill="none" stroke="#9c86ea" stroke-width="10" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#ffffff" stroke-width="20" stroke-linejoin="round"/> <path d="M64 34 L65.3 33.9 L66.7 33.7 L68 33.4 L69.5 32.9 L71 32.3 L72.7 31.6 L74.4 30.9 L76.3 30.2 L78.3 29.4 L80.4 28.7 L82.7 28.1 L85 27.6 L87.4 27.3 L89.9 27.1 L92.4 27 L94.9 27.2 L97.3 27.6 L99.7 28.3 L102 29.2 L104.1 30.3 L106.1 31.7 L107.9 33.3 L109.5 35 L110.8 37 L111.8 39.1 L112.6 41.4 L113 43.7 L113.2 46.1 L113.1 48.5 L112.8 50.9 L112.1 53.3 L111.3 55.7 L110.2 57.9 L108.9 60.1 L107.5 62.1 L106 64 L104.4 65.8 L102.7 67.4 L101.1 68.9 L99.5 70.3 L97.9 71.5 L96.4 72.7 L95 73.8 L93.7 74.8 L92.6 75.8 L91.6 76.9 L90.7 77.9 L90 79 L89.4 80.2 L88.9 81.4 L88.5 82.8 L88.2 84.3 L87.9 85.9 L87.7 87.7 L87.4 89.6 L87.1 91.6 L86.8 93.7 L86.3 95.9 L85.7 98.1 L85 100.4 L84.1 102.6 L83.1 104.9 L81.8 107 L80.4 109.1 L78.8 111 L77.1 112.8 L75.2 114.3 L73.1 115.6 L70.9 116.6 L68.7 117.4 L66.4 117.8 L64 118 L61.6 117.8 L59.3 117.4 L57.1 116.6 L54.9 115.6 L52.8 114.3 L50.9 112.8 L49.2 111 L47.6 109.1 L46.2 107 L44.9 104.9 L43.9 102.6 L43 100.4 L42.3 98.1 L41.7 95.9 L41.2 93.7 L40.9 91.6 L40.6 89.6 L40.3 87.7 L40.1 85.9 L39.8 84.3 L39.5 82.8 L39.1 81.4 L38.6 80.2 L38 79 L37.3 77.9 L36.4 76.9 L35.4 75.8 L34.3 74.8 L33 73.8 L31.6 72.7 L30.1 71.5 L28.5 70.3 L26.9 68.9 L25.3 67.4 L23.6 65.8 L22 64 L20.5 62.1 L19.1 60.1 L17.8 57.9 L16.7 55.7 L15.9 53.3 L15.2 50.9 L14.9 48.5 L14.8 46.1 L15 43.7 L15.4 41.4 L16.2 39.1 L17.2 37 L18.5 35 L20.1 33.3 L21.9 31.7 L23.9 30.3 L26 29.2 L28.3 28.3 L30.7 27.6 L33.1 27.2 L35.6 27 L38.1 27.1 L40.6 27.3 L43 27.6 L45.3 28.1 L47.6 28.7 L49.7 29.4 L51.7 30.2 L53.6 30.9 L55.3 31.6 L57 32.3 L58.5 32.9 L60 33.4 L61.3 33.7 L62.7 33.9Z" fill="none" stroke="#6c47e0" stroke-width="13" stroke-linejoin="round"/> </svg>';   // String Theory's icon.svg
function mbuDock() {
    var root = document.documentElement, on = root.hasAttribute('data-mbu-dock');
    var btn = document.getElementById('mbu-dock');
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="br"]'))
        .filter(function (el) { return el.id !== 'mbu-dock' && el.dataset.mbCornerDock !== 'no'; });
    if (!document.getElementById('mbu-dock-css')) {
        var css = document.createElement('style'); css.id = 'mbu-dock-css';
        css.textContent = '[data-mbu-docked]{z-index:2147482990!important}[data-mbu-docked=hide],[data-mbu-docked=off],:root:not([data-mbu-dock]) [data-mb-corner-dock=only]{display:none!important}'
            + '.mbu-dock-item{position:fixed;z-index:2147482990;width:40px;height:40px;border:0;border-radius:50%;padding:3px;background:none;box-shadow:none;cursor:pointer;opacity:.85;transition:transform .12s,opacity .12s}'
            + '.mbu-dock-item:hover{opacity:1;transform:scale(1.08)}.mbu-dock-item img{width:34px;height:34px;display:block;pointer-events:none}'
            + '.mbu-dock-win{position:fixed;z-index:2147483002;right:70px;bottom:14px;width:max-content;max-width:calc(100vw - 90px);max-height:75vh;overflow:auto;box-sizing:border-box;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35)}'
            + '.mbu-dock-win>*{margin:0!important}:root[data-mbu-flow=row] .mbu-dock-win{right:14px;bottom:68px}:root[data-mbu-side=left] .mbu-dock-win{right:auto;left:70px}:root[data-mbu-side=left][data-mbu-flow=row] .mbu-dock-win{left:14px}'
            + '#mbu-dock{position:fixed;z-index:2147482991;width:40px;height:40px;border-radius:50%;border:0;padding:0;cursor:pointer;background:none;box-shadow:none;opacity:.85;transition:transform .12s,opacity .12s}'
            + '#mbu-dock svg{width:34px;height:34px;display:block;margin:auto;pointer-events:none}'
            + '#mbu-dock:hover{opacity:1;transform:scale(1.08)}:root[data-mbu-dock-open] #mbu-dock{opacity:1}'
            + '#mbu-dock:focus-visible{outline:2px solid #ba478f;outline-offset:2px}'
            + '#mbu-dock b{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center}'
            // no names, only a short state (a count) as a badge on the entry's top-right corner
            // No background, and no dark userstyle's inverting filter on it (kellnerd's inverts every button)
            + '.mbu-dock-item,#mbu-dock{filter:none!important}'
            // folded, an entry with something to do peeks beside the button, smaller
            + '[data-mbu-docked=peek]{transform:scale(.8)}[data-mbu-docked=peek]:hover{transform:scale(.9)}'
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status]::after{content:attr(data-mb-corner-status);position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border:1.5px solid #e05aa5;border-radius:9px;background:#fde6f2;color:#c93d8c;font:700 11px/15px system-ui,sans-serif;text-align:center;white-space:nowrap;text-shadow:none;-webkit-font-smoothing:antialiased;pointer-events:none}'
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek]):hover::after{opacity:1}'
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mb-corner-status^="✓"]::after{content:"";top:0;right:0;min-width:0;width:10px;height:10px;padding:0;border:2px solid #fff;border-radius:50%;background:#4cbf7a}'   // all done: a quiet dot, so a count beside it stands out
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy]::after{background:#f3eff7;border-color:#d6cde2;color:#9a8fae;letter-spacing:1px;animation:mbu-dock-fade 1.2s ease-in-out infinite}'
            + '@keyframes mbu-dock-fade{50%{opacity:.25}}'
            // nothing counted yet: three small dots lighting in turn, no badge
            + ':is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy][data-mb-corner-status="···"]::after{content:none}'
            + '.mbu-dock-dots{display:none;position:absolute;top:0;right:-6px;gap:3px;pointer-events:none}:is([data-mbu-docked=show],[data-mbu-docked=peek])[data-mbu-busy][data-mb-corner-status="···"] .mbu-dock-dots{display:flex}'
            + '.mbu-dock-dots i{width:5px;height:5px;border-radius:50%;background:#e05aa5;animation:mbu-dock-dot 1.2s ease-in-out infinite}.mbu-dock-dots i:nth-child(2){animation-delay:.2s}.mbu-dock-dots i:nth-child(3){animation-delay:.4s}'
            + '@keyframes mbu-dock-dot{0%,80%,100%{opacity:.25}40%{opacity:1}}'
            + '@media (prefers-reduced-motion:reduce){[data-mbu-busy]::after,.mbu-dock-dots i{animation:none!important}}';
        root.appendChild(css);
    }
    if (!on) {
        els.forEach(function (el) { el.removeAttribute('data-mbu-docked'); });
        if (btn) btn.remove();
        return;
    }
    if (!btn) {
        btn = document.createElement('button'); btn.type = 'button'; btn.id = 'mbu-dock';
        btn.setAttribute('aria-label', 'String Theory');
        btn.dataset.mbCorner = 'br'; btn.dataset.mbCornerOrder = '-1';   // nearest the corner
        btn.onclick = function () {
            // unrolled by hovering: the click keeps it open
            var open = root.hasAttribute('data-mbu-dock-hover') || !root.hasAttribute('data-mbu-dock-open');
            root.removeAttribute('data-mbu-dock-hover');
            root.toggleAttribute('data-mbu-dock-open', open);
            mbuShared('dockOpen', open || null);   // remembered for the next page
            mbRestackCorner('br');
        };
        // hovering the folded button unrolls the dock until the pointer leaves it, not remembered
        var leaveT = 0;
        var inDock = function (t) { return !!(t && t.closest && t.closest('#mbu-dock,[data-mbu-docked],.mbu-dock-win,#mbu-tip')); };
        btn.addEventListener('mouseenter', function () {
            clearTimeout(leaveT);
            if (root.hasAttribute('data-mbu-dock-open')) return;
            root.setAttribute('data-mbu-dock-hover', ''); root.setAttribute('data-mbu-dock-open', '');
            mbRestackCorner('br');
        });
        document.addEventListener('mouseover', function (e) {
            if (!root.hasAttribute('data-mbu-dock-hover')) return;
            clearTimeout(leaveT);
            if (inDock(e.target)) return;
            leaveT = setTimeout(function () {
                if (!root.hasAttribute('data-mbu-dock-hover')) return;
                root.removeAttribute('data-mbu-dock-hover'); root.removeAttribute('data-mbu-dock-open');
                mbRestackCorner('br');
            }, 400);
        }, true);
        root.appendChild(btn);   // outside the body, which Event Horizon swaps
        root.toggleAttribute('data-mbu-dock-open', !!mbuShared('dockOpen'));
    }
    var open = root.hasAttribute('data-mbu-dock-open'), n = 0;
    if (mbuShared('cornerFlow') === 'row') root.setAttribute('data-mbu-flow', 'row'); else root.removeAttribute('data-mbu-flow');
    if (mbuShared('cornerSide') === 'left') root.setAttribute('data-mbu-side', 'left'); else root.removeAttribute('data-mbu-side');
    els.forEach(function (el) {
        if (el.dataset.mbCornerDock === 'hide' || (el.dataset.mbCornerPaths && !new RegExp(el.dataset.mbCornerPaths).test(location.pathname))) { el.setAttribute('data-mbu-docked', 'off'); return; }
        var was = el.getAttribute('data-mbu-docked');
        el.removeAttribute('data-mbu-docked');   // measured as its script left it
        var shown = getComputedStyle(el).display !== 'none';
        if (shown) n++;
        el.setAttribute('data-mbu-docked', !shown ? 'hide' : open ? 'show' : /^[+]?[1-9]/.test(el.dataset.mbCornerStatus || '') ? 'peek' : 'hide');
        // fades in only when it starts peeking: this runs on every restack, so a CSS animation would replay
        if (was !== 'peek' && el.getAttribute('data-mbu-docked') === 'peek' && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 350, easing: 'ease-out' });
    });
    btn.innerHTML = MBU_DOCK_ICON + (n ? '<b>' + n + '</b>' : '');
}
// A script's entry that lives in the dock only (#847): for a script whose own controls sit in
// MusicBrainz's page, which Event Horizon replaces. o: id, label, icon (an image URL), order,
// paths (as data-mb-corner-paths), click. Outside the dock it is never shown. Returns the button,
// with .status(text) to show a short state (a count) beside it.
function mbuDockItem(o) {
    var b = document.getElementById(o.id);
    if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.id = o.id; b.className = 'mbu-dock-item';
        b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = String(o.order || 60); b.dataset.mbCornerDock = 'only';
        if (o.paths) b.dataset.mbCornerPaths = o.paths;
        var img = document.createElement('img'); img.src = o.icon; img.alt = ''; b.appendChild(img);
        var dots = document.createElement('span'); dots.className = 'mbu-dock-dots'; dots.innerHTML = '<i></i><i></i><i></i>'; b.appendChild(dots);   // while nothing is counted yet
        b.onclick = o.click;
        document.documentElement.appendChild(b);   // outside the body, which Event Horizon swaps
    }
    b.dataset.mbCornerLabel = o.label;
    // .status(t): the count beside it; .busy(on): while it works, a faint "···" where the count goes,
    // or the count so far, fading; .card(fn): a hover card, fn() → its HTML (mbuTipCard)
    var show = function () { var t = b.mbuSt || (b.hasAttribute('data-mbu-busy') ? '···' : ''); if (t) b.dataset.mbCornerStatus = t; else delete b.dataset.mbCornerStatus;
        var r = document.documentElement; if (r.hasAttribute('data-mbu-dock') && !r.hasAttribute('data-mbu-dock-open') && b.isConnected) mbRestackCorner('br'); };   // folded: it may peek now, or stop
    b.status = function (t) { b.mbuSt = t || ''; show(); };
    b.busy = function (on) { if (on) b.dataset.mbuBusy = ''; else delete b.dataset.mbuBusy; show(); };
    b.card = function (fn) { if (typeof mbuTip === 'function') mbuTip(b, fn || null, { card: true }); };
    if (o.scale) b.querySelector('img').style.transform = 'scale(' + o.scale + ')';
    b.status('');
    mbRestackCorner('br');
    return b;
}
function mbRestackCorner(corner) {
    if (corner === 'br') mbuDock();
    var bottom = corner[0] === 'b', right = (corner[1] === 'r') !== (mbuShared('cornerSide') === 'left');
    var row = mbuShared('cornerFlow') === 'row';
    var vv = window.visualViewport, gapX = 0, gapY = 0;
    if (vv) {
        gapX = Math.max(0, right ? window.innerWidth - vv.offsetLeft - vv.width : vv.offsetLeft);
        gapY = Math.max(0, bottom ? window.innerHeight - vv.offsetTop - vv.height : vv.offsetTop);
        var root = document.documentElement;
        if (!root.hasAttribute('data-mb-corner-vv')) {   // one listener for every script's copy
            root.setAttribute('data-mb-corner-vv', '');
            var queued = false;
            var again = function () {
                if (queued) return;
                queued = true;
                requestAnimationFrame(function () { queued = false; ['br', 'bl', 'tr', 'tl'].forEach(function (c) { if (document.querySelector('[data-mb-corner="' + c + '"]')) mbRestackCorner(c); }); });
            };
            vv.addEventListener('resize', again);
            vv.addEventListener('scroll', again);
            // the layout viewport can change alone, with no event: a full-screen view pins the page's body
            // (780px → the screen's width); the body's size is what moves then
            window.addEventListener('resize', again);
            if (window.ResizeObserver && document.body) new window.ResizeObserver(again).observe(document.body);
        }
    }
    var peeks = [];
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return !el.hidden && getComputedStyle(el).display !== 'none'; })
        .filter(function (el) { if (el.getAttribute('data-mbu-docked') !== 'peek') return true; peeks.push(el); return false; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = 14;
    els.forEach(function (el) {
        var r = el.getBoundingClientRect();
        el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? 14 : pos)) + 'px';
        el.style[right ? 'right' : 'left'] = (gapX + (row ? pos : 14)) + 'px';
        el.style[right ? 'left' : 'right'] = 'auto';
        pos += (row ? r.width : r.height) + 8;
    });
    // the folded dock's peeking entries: in a line from its button, along the stack's flow
    var side = 14 + 40 + 4;
    peeks.sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); }).forEach(function (el) {
        el.style[bottom ? 'bottom' : 'top'] = (gapY + (row ? 14 : side)) + 'px';
        el.style[right ? 'right' : 'left'] = (gapX + (row ? side : 14)) + 'px';
        el.style[right ? 'left' : 'right'] = 'auto';
        side += 36;
    });
}

// Activity log: the session's log lines plus the viewers that show them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//   LOG.cat('Spotify').info(…)        // the same calls, each line tagged with a category
//   LOG.pre(text)                     // a block kept as written: line breaks, spacing, monospace (#705)
//   LOG.mount(el, { tools })          // the viewer inside the script's own panel (#705)
//
// Categories (#697) are optional. A tagged line shows its category before the
// message and in the Markdown ("WARN [Spotify] …"). The viewer grows a row of
// filters only when there is a choice: the levels once two of them have lines
// (ok counts as info), the categories once there are two. Click one to see only
// those lines, click it again to see all; Copy always takes everything.
//
// The floating window (open) and a mounted viewer (mount) are the same viewer;
// mount draws it into an element of the script's, without the title bar's
// window buttons, and o.tools (an element) sits in its toolbar before Clear.
// Every viewer has a debug switch: off, LOG.debug() lines are not recorded at all
// (remembered per script under o.key; LOG.debugOn(), LOG.setDebug(v)).
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
// o.history           opt-in history of past sessions (#705), below
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// viewer appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
//
// History (#705, Falcon's run logs of #512 made shared). Off unless o.history is given:
//
//   o.history = { prefix: 'falcon:session:', lines: 400, head: 140,
//                 parse: s => entry, nameOf: entries => name, store }
//
// A session starts with the page, or with LOG.session(reason) (Falcon: each run).
// Only a session the script marks with LOG.keep() is stored, so a page that did
// nothing worth reading back leaves nothing behind; LOG.name(text) names it (the
// first name stays). It is stored in the page's localStorage under prefix + id,
// within 100 ms of each line and at once on LOG.flush(), so a crashed tab keeps
// its log; a session longer than `lines` keeps its first `head` lines and its
// end, and says how many went between. The newest 10 sessions are kept, not configurable
// (#811); each script's prefix is its own, and Clear history clears only that script's.
// Leaving the page (a script's reload after its operation, #811) flushes at once.
// prefix + 'current' holds the last kept session's id (LOG.last()), so LOG.resume(id)
// can carry on a session across a navigation. The viewer gets a session list and Clear history.
//   LOG.sessionId(); LOG.last(); LOG.isKept(); LOG.refresh(); LOG.sessions(); LOG.load(id); LOG.forget(id); LOG.clearHistory(); LOG.flush()
// parse reads a stored line that is a string (an older format); nameOf names a
// session stored without a name; store ({ get, set, del, keys }) replaces localStorage.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, views = [], bound = {};
    var LEVELS = ['error', 'warn', 'info', 'debug'];
    var group = function (sev) { return sev === 'ok' ? 'info' : sev; };
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return d ? pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3) : '--:--:--.---'; };
    var str = function (v) {
        if (typeof v === 'string') return v;
        if (v instanceof Error) return v.message || String(v);
        if (v && v.nodeType) return '<' + (v.tagName || 'node').toLowerCase() + '>';
        try { return typeof v === 'object' ? JSON.stringify(v) : String(v); } catch (e) { return String(v); }
    };
    var esc = function (s) {
        return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
    };
    // escape, then make http(s) URLs clickable, keeping trailing punctuation out of them
    var linkify = function (s) {
        return esc(s).replace(/(https?:\/\/[^\s<]+)/g, function (m) {
            var t = (m.match(/[.,;:!?)\]]+$/) || [''])[0];
            var url = m.slice(0, m.length - t.length);
            return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + t;
        });
    };
    var load = o.load || function (k) { try { return GM_getValue(k, undefined); } catch (e) { return undefined; } };
    var save = o.save || function (k, v) { try { GM_setValue(k, v); } catch (e) { /* no storage: the window just forgets */ } };
    var state = function () { try { return JSON.parse(load(o.key) || '{}') || {}; } catch (e) { return {}; } };
    var remember = function (patch) { try { save(o.key, JSON.stringify(Object.assign(state(), patch))); } catch (e) { /* see save */ } };
    // debug lines are recorded only while the viewer's debug switch is on (default off: majkinetor, #705), per script
    var dbgOn = null;
    var debugOn = function () { if (dbgOn === null) dbgOn = state().debug === true; return dbgOn; };
    var setDebug = function (v) { dbgOn = !!v; remember({ debug: dbgOn }); views.forEach(function (w) { if (w.dbg) w.dbg.checked = dbgOn; }); };
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + (e.cat ? '[' + e.cat + '] ' : '') + (e.pre ? '\n' : '') + e.msg; };
    var countOf = function (list) {
        var c = { warn: 0, error: 0 };
        list.forEach(function (e) { if (e.sev === 'warn') c.warn++; else if (e.sev === 'error') c.error++; });
        return c;
    };

    // ── history (#705) ──
    var H = o.history || null, hp = H && (H.prefix || ((o.key || 'mbu') + ':session:'));
    var ID_RE = /^\d{14}-\d+$/, sid = '', kept = false, sname = '', savedName = '', seq = 0, pTimer = 0, lastSaved = '';
    var store = H && (H.store || {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* full or blocked: the session just isn't kept */ } },
        del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* nothing to do */ } },
        // one call for all the keys: a userscript reaches localStorage through Firefox's
        // Xray wrapper, where each call costs, and the page may hold hundreds of keys
        keys: function () {
            try { var all = Object.keys(localStorage); if (all.length === localStorage.length) return all; } catch (e) { /* the loop below */ }
            var out = []; try { for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) { /* none */ } return out;
        },
    });
    var keepN = function () { return 10; };   // #811: the last 10 sessions, not configurable
    var newId = function () { return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '-' + (++seq); };
    // the id is the session's start in UTC: YYYYMMDDHHMMSS-n
    var idDate = function (id) {
        var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)/.exec(id || '');
        return m ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
    };
    function ids() {
        if (!H) return [];
        return store.keys().filter(function (k) { return k && k.indexOf(hp) === 0 && ID_RE.test(k.slice(hp.length)); })
            .map(function (k) { return k.slice(hp.length); }).sort();   // the id's own timestamp sorts as a string
    }
    // a stored line: [time ms | null, sev, cat | 0, msg, pre 1/0]; a string is an older format, read by H.parse
    function fromStored(x, id) {
        if (typeof x === 'string') {
            var p = null;
            try { p = H.parse ? H.parse(x, idDate(id)) : null; } catch (e) { /* unreadable: kept as text */ }
            return p ? { t: p.t || null, sev: p.sev || 'info', cat: p.cat || '', msg: String(p.msg == null ? x : p.msg), pre: !!p.pre } : { t: null, sev: 'info', msg: x };
        }
        if (!Array.isArray(x)) return null;
        var e = { t: x[0] != null ? new Date(x[0]) : null, sev: x[1] || 'info', msg: String(x[3] == null ? '' : x[3]) };
        if (x[2]) e.cat = String(x[2]);
        if (x[4]) e.pre = true;
        return e;
    }
    function loadSession(id) {
        if (!H || !id) return null;
        var raw = store.get(hp + id);
        if (raw == null) return null;
        try { return (JSON.parse(raw) || []).map(function (x) { return fromStored(x, id); }).filter(Boolean); } catch (e) { return null; }
    }
    // a past session's name doesn't change, so it is read (or mined from its lines) once
    var names = {};
    function nameOf(id, entries) {
        if (id in names) return names[id];
        var n = store.get(hp + id + ':name');
        if (!n) { try { n = H.nameOf ? H.nameOf(entries || loadSession(id) || []) || '' : ''; } catch (e) { n = ''; } }
        return (names[id] = n || '');
    }
    // the first `head` lines and the end, and a line saying how many went between
    function storedWindow() {
        var cap = H.lines || 400, head = Math.min(H.head || 140, cap - 2);
        var pack = function (e) { return [e.t ? e.t.getTime() : null, e.sev, e.cat || 0, e.msg, e.pre ? 1 : 0]; };
        if (buf.length <= cap) return buf.map(pack);
        var tail = cap - head - 1, cut = buf.length - head - tail;
        return buf.slice(0, head).map(pack)
            .concat([[null, 'info', 0, '——— ' + cut + ' line(s) from the middle of this session were dropped to fit the stored-log budget; its start and end are kept in full ———', 0]])
            .concat(buf.slice(-tail).map(pack));
    }
    function flush() {
        clearTimeout(pTimer); pTimer = 0;
        if (!H || !sid || !kept) return;
        try {
            var payload = JSON.stringify(storedWindow());
            if (payload === lastSaved) return;
            lastSaved = payload;
            store.set(hp + sid, payload);
            if (sname && savedName !== sname) { store.set(hp + sid + ':name', sname); savedName = sname; }
        } catch (e) { /* not stored */ }
    }
    var persist = function () { if (H && kept && !pTimer) pTimer = setTimeout(flush, 100); };
    function forget(id) { if (H && id) { store.del(hp + id); store.del(hp + id + ':name'); delete names[id]; } }
    function prune() {
        var all = ids().filter(function (id) { return id !== sid; });
        var excess = all.length + (kept ? 1 : 0) - keepN();
        if (excess > 0) all.slice(0, excess).forEach(forget);
    }
    // past sessions, newest first, without the current one
    function sessions() {
        return ids().filter(function (id) { return id !== sid; }).reverse()
            .map(function (id) { return { id: id, date: idDate(id), name: nameOf(id) }; });
    }
    var sessionLabel = function (s) {
        var d = s.date, when = d ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) : s.id;
        return when + (s.name ? ' — ' + s.name : '');
    };
    function startSession() {
        flush();
        sid = newId(); kept = false; sname = ''; savedName = ''; lastSaved = '';
        reset();
    }
    function resume(id) {
        var entries = loadSession(id);
        if (!entries) return false;
        flush();
        reset();
        sid = id; kept = true; sname = savedName = store.get(hp + id + ':name') || '';
        lastSaved = store.get(hp + id) || '';
        store.set(hp + 'current', sid);
        entries.forEach(function (e) { push(e); });
        return true;
    }

    // ── the live lines ──
    function reset() {
        buf = []; dropped = 0; warn = 0; error = 0;
        views.forEach(function (v) { if (!v.past) v.show(null); v.sessions(); });
    }
    function push(e) {
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        views = views.filter(function (v) { return v.el.isConnected; });
        views.forEach(function (v) { if (!v.past) v.append(e); });
    }
    function add(sev, args, cat, pre) {
        var msg = Array.prototype.map.call(args, str).join(' ');
        msg = pre ? msg.replace(/\s+$/, '') : msg.replace(/\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        if (e.sev === 'debug' && !debugOn()) return;
        if (cat) e.cat = String(cat);
        if (pre) e.pre = true;
        push(e);
        persist();
    }
    function title(bare) {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = !bare && o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    // past: { id, entries } to copy a stored session instead of this one
    function markdown(past) {
        var list = past ? past.entries : buf, c = past ? countOf(list) : { warn: warn, error: error };
        var body = list.length ? list.map(line).join('\n') : '(no activity logged)';
        if (!past && dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\n' + body;
        var n = (c.warn || c.error) ? ' (' + c.warn + ' warning' + (c.warn === 1 ? '' : 's') + ', ' + c.error + ' error' + (c.error === 1 ? '' : 's') + ')' : '';
        var what = past ? 'log of ' + sessionLabel({ id: past.id, date: idDate(past.id), name: nameOf(past.id, list) }) : 'session log';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title(!!past) + ' — ' + what + n + '</summary>\n\n' + fence + 'log\n' + body + '\n' + fence + '\n\n</details>';
    }
    function copy(btn, past) {
        var md = markdown(past);
        var done = function (ok) {
            if (!btn) return;
            var was = btn.dataset.lbl || btn.textContent; btn.dataset.lbl = was;
            btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
            setTimeout(function () { btn.textContent = was; }, 1500);
        };
        var fallback = function () {
            var ok = false;
            try {
                var ta = document.createElement('textarea'); ta.value = md; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
            } catch (x) { /* nothing left to try */ }
            done(ok);
        };
        try { navigator.clipboard.writeText(md).then(function () { done(true); }, fallback); } catch (e) { fallback(); }
    }

    // ── a viewer: the floating window or one mounted in the script's panel ──
    var vseq = 0;
    function view(root, floating, tools) {
        var vid = String(++vseq);
        root.classList.add('mbu-logpop');
        root.dataset.mbuLv = vid;
        root.innerHTML = mbuHtml('<div class="mbu-logpop-h">' + (floating ? '<b>' + esc(o.header || 'Activity log') + '</b> ' : '') + '<span class="mbu-log-badge"></span>'
            + '<input class="mbu-log-q" type="search" placeholder="Filter" data-tip="Show only the lines with this text\nEsc: empty the box" autocomplete="off">'
            + (H ? '<select class="mbu-log-ses mbu-select" data-tip="The session shown\nThis one, or a past one kept in this browser"></select>' : '')
            + '<span class="mbu-logpop-sp"></span>'
            + (H ? '<button class="mbu-logpop-hclear" type="button" data-tip="Delete every past session\nThis one stays">Clear history</button>' : '')
            + '<label class="mbu-log-dbg" data-tip="Record each step in detail\nLeave it on when reporting a problem"><input type="checkbox"> debug</label>'
            + '<button class="mbu-logpop-clear" type="button" data-tip="Clear the log\nThe lines so far are gone">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" data-tip="Copy the whole log as Markdown\nReady to paste into a GitHub issue">⧉ Copy</button>'
            + (floating ? '<button class="mbu-logpop-full" type="button" data-tip="Full screen\nDouble-click: the title bar does the same">⛶</button>'
                + '<button class="mbu-logpop-min" type="button" data-tip="Minimize">–</button>'
                + '<button class="mbu-logpop-x" type="button" data-tip="Close">✕</button>' : '') + '</div>'
            + '<div class="mbu-log-f" hidden></div><style class="mbu-log-fcss"></style>'
            + '<div class="mbu-log-list"></div>' + (floating ? '<div class="mbu-logpop-grip" data-tip="Resize"></div>' : ''));
        if (tools) root.querySelector('.mbu-logpop-clear').before(tools);
        var list = root.querySelector('.mbu-log-list'), badge = root.querySelector('.mbu-log-badge');
        var qEl = root.querySelector('.mbu-log-q'), q = '', sel = root.querySelector('.mbu-log-ses');
        var fRow = root.querySelector('.mbu-log-f'), fCss = root.querySelector('.mbu-log-fcss');
        // what this viewer shows: the live lines, or a past session (read-only)
        var past = null, src = buf, cats = [], catIx = {}, sevs = {}, fSev = null, fCat = null;
        var scope = '.mbu-logpop[data-mbu-lv="' + vid + '"] ';
        var miss = function (e) { return !!q && ((e.cat || '') + ' ' + e.msg).toLowerCase().indexOf(q) < 0; };
        // note a line's level and category; true when the filter row must change
        var note = function (e) {
            var grew = false;
            if (e.cat && !(e.cat in catIx)) { catIx[e.cat] = cats.length; cats.push(e.cat); grew = true; }
            if (!sevs[group(e.sev)]) { sevs[group(e.sev)] = true; grew = true; }
            return grew;
        };
        var row = function (e) {
            var d = document.createElement('div');
            d._e = e;
            d.className = 'mbu-log-li mbu-log-' + e.sev + (e.pre ? ' mbu-log-pre' : '');
            if (miss(e)) d.classList.add('mbu-log-nq');
            d.dataset.s = group(e.sev);
            if (e.cat) d.dataset.c = catIx[e.cat];
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span>'
                + '<span class="mbu-log-c">' + esc(e.cat || '') + '</span>'
                + '<span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        // the filter row, redrawn when a level or category first appears; hiding is one
        // rule in the viewer's own <style>, not a walk over the rows
        var filters = function () {
            var lv = LEVELS.filter(function (l) { return sevs[l]; });
            var showL = lv.length > 1, showC = cats.length > 1;
            if (fSev && !sevs[fSev]) fSev = null;
            if (fCat != null && !(fCat in catIx)) fCat = null;
            var b = function (kind, v, on) {
                return '<button type="button" class="mbu-log-fb' + (on ? ' on' : '') + '" data-' + kind + '="' + esc(v) + '">' + esc(v) + '</button>';
            };
            fRow.innerHTML = mbuHtml((showL ? '<span class="mbu-log-fg">' + lv.map(function (l) { return b('sev', l, fSev === l); }).join('') + '</span>' : '')
                + (showL && showC ? '<span class="mbu-log-fs"></span>' : '')
                + (showC ? '<span class="mbu-log-fg">' + cats.map(function (c) { return b('cat', c, fCat === c); }).join('') + '</span>' : ''));
            fRow.hidden = !showL && !showC;
            list.classList.toggle('mbu-log-cats', cats.length > 0);
            fCss.textContent = (fSev ? scope + '.mbu-log-li:not([data-s="' + fSev + '"]){display:none}' : '')
                + (fCat != null ? scope + '.mbu-log-li:not([data-c="' + catIx[fCat] + '"]){display:none}' : '');
        };
        var showBadge = function () {
            var c = past ? countOf(src) : { warn: warn, error: error };
            badge.textContent = '(' + src.length + ')' + (c.warn || c.error ? ' · ' + c.warn + '⚠ ' + c.error + '✖' : '');
        };
        var empty = function () { return '<div class="mbu-log-empty">' + (past ? 'Nothing was kept of this session.' : 'No activity yet.') + '</div>'; };
        var queued = false, follow = true;
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        // all rows at once: on opening, and when the session shown changes
        var draw = function () {
            cats = []; catIx = {}; sevs = {};
            src.forEach(note);
            var frag = document.createDocumentFragment();
            src.forEach(function (e) { frag.appendChild(row(e)); });
            list.innerHTML = mbuHtml(src.length ? '' : empty());
            if (src.length) list.appendChild(frag);
            filters(); showBadge();
            follow = true; list.scrollTop = list.scrollHeight;
            root.classList.toggle('mbu-log-past', !!past);
        };
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var qTimer = 0;
        var refilter = function () {
            q = qEl.value.trim().toLowerCase();
            for (var d = list.firstElementChild; d; d = d.nextElementSibling) if (d._e) d.classList.toggle('mbu-log-nq', miss(d._e));
            follow = true; list.scrollTop = list.scrollHeight;
        };
        qEl.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(refilter, 120); });
        fRow.addEventListener('click', function (ev) {
            var t = ev.target.closest('.mbu-log-fb'); if (!t) return;
            if (t.dataset.sev) fSev = fSev === t.dataset.sev ? null : t.dataset.sev;
            else fCat = fCat === t.dataset.cat ? null : t.dataset.cat;
            filters();
            follow = true; list.scrollTop = list.scrollHeight;
        });
        var v = {
            el: root, floating: floating, past: null, q: qEl,
            append: function (e) {
                var em = list.querySelector('.mbu-log-empty'); if (em) em.remove();
                if (note(e)) filters();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            // null: the live lines; an id: that past session
            show: function (id) {
                var entries = id ? loadSession(id) : null;
                if (id && !entries) entries = [{ t: null, sev: 'warn', msg: 'This session could not be read (it may have been deleted in another tab).' }];
                past = id && entries ? id : null; v.past = past;
                src = past ? entries : buf;
                if (sel && sel.value !== (past || '')) sel.value = past || '';
                draw();
            },
            // the session list, refreshed when it is opened and when a session starts
            sessions: function () {
                if (!sel) return;
                var all = sessions(), sig = all.map(function (x) { return x.id + '=' + x.name; }).join('|');
                if (sig === v.sig && !(past && !all.some(function (x) { return x.id === past; }))) return;
                v.sig = sig;
                if (past && !all.some(function (s) { return s.id === past; })) { past = null; v.past = null; src = buf; draw(); }
                sel.innerHTML = mbuHtml('<option value="">Current session</option>' + all.map(function (s) {
                    return '<option value="' + esc(s.id) + '">' + esc(sessionLabel(s)) + '</option>';
                }).join(''));
                sel.value = past || '';
                var hc = root.querySelector('.mbu-logpop-hclear'); if (hc) hc.disabled = !all.length;
            },
            filters: filters,
        };
        if (sel) {
            sel.addEventListener('change', function () { v.show(sel.value || null); });
            root.querySelector('.mbu-logpop-hclear').onclick = function () { clearHistory(); };
        }
        root.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        v.dbg = root.querySelector('.mbu-log-dbg input');
        v.dbg.checked = debugOn();
        v.dbg.onchange = function () { setDebug(v.dbg.checked); };
        root.querySelector('.mbu-logpop-copy').onclick = function () {
            copy(root.querySelector('.mbu-logpop-copy'), past ? { id: past, entries: src } : null);
        };
        v.sessions();
        draw();
        views.push(v);
        return v;
    }

    var win = null;
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop';
        document.body.appendChild(pop);
        var v = view(pop, true);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        // Escape in a filled filter empties it; anywhere else it closes the window. Only the log:
        // it listens first (capture, on window) and keeps the key, so the script's own window under
        // it (ISRC Scout's closes on Escape too) stays open
        var onKey = function (e) {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            if (e.target === v.q && v.q.value) { v.q.value = ''; v.q.dispatchEvent(new Event('input')); return; }
            close();
        };
        win = { el: pop, v: v, off: function () { window.removeEventListener('keydown', onKey, true); } };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.dataset.tip = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        var fullBtn = pop.querySelector('.mbu-logpop-full');
        var setFull = function (f) {
            pop.classList.toggle('full', f);
            fullBtn.textContent = f ? '❐' : '⛶'; fullBtn.dataset.tip = (f ? 'Restore the size' : 'Full screen') + '\nDouble-click: the title bar does the same';
        };
        minBtn.onclick = function () {
            var m = pop.classList.toggle('min');
            if (m && pop.classList.contains('full')) { setFull(false); remember({ full: false }); }   // minimising leaves full screen
            setMin(m); remember({ min: m });
        };
        fullBtn.onclick = function () { var f = !pop.classList.contains('full'); setFull(f); remember({ full: f }); };
        pop.querySelector('.mbu-logpop-h').addEventListener('dblclick', function (e) {
            if (!e.target.closest('button, input, select') && !pop.classList.contains('min')) fullBtn.click();
        });
        // a size the user gave it, from the corner grip
        if (st.w && st.h) { pop.style.width = st.w; pop.style.height = st.h; pop.classList.add('sized'); }
        if (st.min) { pop.classList.add('min'); setMin(true); }
        else if (st.full) setFull(true);
        pop.querySelector('.mbu-logpop-grip').addEventListener('mousedown', function (e) {
            e.preventDefault(); e.stopPropagation();
            var r = pop.getBoundingClientRect();
            // pin the top-left corner, so only the right and bottom edges move
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.bottom = ''; pop.style.transform = 'none';
            pop.classList.add('sized');
            var x0 = e.clientX, y0 = e.clientY;
            var mv = function (ev) {
                pop.style.width = Math.max(320, Math.min(window.innerWidth - r.left, r.width + ev.clientX - x0)) + 'px';
                pop.style.height = Math.max(120, Math.min(window.innerHeight - r.top, r.height + ev.clientY - y0)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                remember({ left: pop.style.left, top: pop.style.top, w: pop.style.width, h: pop.style.height });
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button, input, select') || pop.classList.contains('full')) return;
            e.preventDefault();
            var r = pop.getBoundingClientRect();
            pop.style.left = r.left + 'px'; pop.style.top = r.top + 'px'; pop.style.right = 'auto'; pop.style.transform = 'none';
            var ox = e.clientX - r.left, oy = e.clientY - r.top;
            var mv = function (ev) {
                pop.style.left = Math.max(0, Math.min(window.innerWidth - pop.offsetWidth, ev.clientX - ox)) + 'px';
                pop.style.top = Math.max(0, Math.min(window.innerHeight - 36, ev.clientY - oy)) + 'px';
            };
            var up = function () {
                document.removeEventListener('mousemove', mv); document.removeEventListener('mouseup', up);
                if (!pop.classList.contains('min')) {
                    restore = { left: pop.style.left, top: pop.style.top, right: 'auto', bottom: '', transform: 'none' };
                    remember({ left: pop.style.left, top: pop.style.top });
                }
            };
            document.addEventListener('mousemove', mv); document.addEventListener('mouseup', up);
        });
        window.addEventListener('keydown', onKey, true);
        return pop;
    }
    // the viewer inside an element of the script's; a second mount there replaces the first
    function mount(host, opts) {
        if (!host) return null;
        views = views.filter(function (v) { if (v.el.parentNode === host) { v.el.remove(); return false; } return true; });
        var el = document.createElement('div'); el.className = 'mbu-logemb';
        host.appendChild(el);
        return view(el, false, opts && opts.tools).el;
    }
    // empty the live log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (H && sid) { store.del(hp + sid); lastSaved = ''; }
        views.forEach(function (v) { if (!v.past) v.show(null); });
    }
    function clearHistory() {
        if (!H) return;
        ids().forEach(function (id) { if (id !== sid) forget(id); });
        views.forEach(function (v) { v.sessions(); });
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) {
            win.off(); win.el.remove();
            views = views.filter(function (v) { return v !== win.v; });
            win = null; if (!quiet) remember({ open: false });
        }
        if (stray) stray.remove();   // another script's window: one log window at a time
    }
    var api = {
        info: function () { add('info', arguments); },
        warn: function () { add('warn', arguments); },
        err: function () { add('error', arguments); },
        error: function () { add('error', arguments); },
        ok: function () { add('ok', arguments); },
        debug: function () { add('debug', arguments); },
        add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1)); },
        // the debug switch: are debug lines recorded?
        debugOn: function () { return debugOn(); },
        setDebug: setDebug,
        pre: function () { add('info', arguments, null, true); },
        // a logger whose lines carry this category; the same object for the same name
        cat: function (name) {
            if (!name) return api;
            if (!bound[name]) bound[name] = {
                info: function () { add('info', arguments, name); },
                warn: function () { add('warn', arguments, name); },
                err: function () { add('error', arguments, name); },
                error: function () { add('error', arguments, name); },
                ok: function () { add('ok', arguments, name); },
                debug: function () { add('debug', arguments, name); },
                add: function (sev) { add(sev, Array.prototype.slice.call(arguments, 1), name); },
                pre: function () { add('info', arguments, name, true); },
            };
            return bound[name];
        },
        open: open,
        mount: mount,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: function () { return markdown(); },
        copy: function (btn) { copy(btn); },
        clear: clear,
        lines: function () { return buf.map(line); },
        entries: function () { return buf.slice(); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
        // history (#705); harmless without o.history
        session: function () { if (H) startSession(); return sid; },
        resume: function (id) { return H ? resume(id) : false; },
        keep: function () { if (H && sid && !kept) { kept = true; store.set(hp + 'current', sid); flush(); prune(); views.forEach(function (v) { v.sessions(); }); } },
        name: function (text) { if (H && text && !sname) { sname = String(text); if (kept) store.set(hp + sid + ':name', sname); } },
        sessionId: function () { return sid; },
        last: function () { return H ? store.get(hp + 'current') : null; },
        isKept: function () { return kept; },
        sessions: function () { return H ? sessions() : []; },
        load: function (id) { return loadSession(id); },
        forget: function (id) { forget(id); views.forEach(function (v) { v.sessions(); }); },
        clearHistory: clearHistory,
        // redraw the session lists (a script showing its mounted viewer again); only a changed list is redrawn
        refresh: function () { views.forEach(function (v) { v.sessions(); }); },
        flush: flush,
    };
    if (H) {
        sid = newId();
        // #811: a script reloads the page right after its operation; write the kept session
        // now rather than trusting the 100 ms timer to beat the unload
        try { window.addEventListener('pagehide', flush); } catch (e) { /* no window */ }
    }
    mbuLog.active = api;   // the script's own log, for helpers that note things in it (mbuClaim)
    return api;
}

// Dismiss-on-outside-click, with the trailing click SWALLOWED.
//
//   var off = mbuDismissOn(popoverEl, close);   // off() to detach early
//
// #305: a popover torn down on mousedown removes what was under the cursor, so
// the click that follows lands on whatever the page reflowed into that spot and
// activates it. Tearing down on click instead just moves the problem. So: close
// on outside mousedown, then eat exactly one click in the capture phase. This is
// the single most repeated interaction bug in these scripts and it belongs in
// one place — it is why #563 says interaction is part of the contract.
//
// Esc closes too, innermost first: the handler is registered in capture and stops
// propagation, so a popover inside a modal does not close the modal as well.
function mbuDismissOn(el, close, opts) {
    opts = opts || {};
    var closed = false;
    var onDown = function (e) {
        if (closed || !el || el.contains(e.target)) return;
        if (opts.ignore && e.target.closest && e.target.closest(opts.ignore)) return;
        finish();
        // swallow the click this mousedown will produce, once
        var eat = function (ev) { ev.stopPropagation(); ev.preventDefault(); document.removeEventListener('click', eat, true); };
        document.addEventListener('click', eat, true);
        setTimeout(function () { document.removeEventListener('click', eat, true); }, 400);
    };
    var onKey = function (e) {
        if (closed || e.key !== 'Escape') return;
        e.stopPropagation();
        finish();
    };
    function finish() {
        if (closed) return;
        closed = true;
        document.removeEventListener('mousedown', onDown, true);
        document.removeEventListener('keydown', onKey, true);
        try { close(); } catch (err) { /* a throwing closer must not leave listeners behind */ }
    }
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return finish;
}

// Collapse a toolbar to icon-only when its buttons would wrap.
//
//   mbuFitToolbar(barEl)            // call on build, and on resize
//
// Measured by SUMMING child widths rather than reading scrollWidth or comparing
// offsetTop: a bar with flex:1 spacers never overflows its own scroll box, so
// both of those report "fits" right up until it visibly wraps. Art Station
// learned that the hard way (#234) and it is the only reason this is a helper
// rather than one CSS rule.
//
// opts.gap    inter-item gap in px (default 11)
// opts.pad    horizontal padding to leave (default 24)
// opts.spacer selector for flexible spacers, which must not count (default .mbu-sp)
function mbuFitToolbar(bar, opts) {
    if (!bar) return false;
    opts = opts || {};
    var gap = opts.gap == null ? 11 : opts.gap;
    var pad = opts.pad == null ? 24 : opts.pad;
    var spacer = opts.spacer || '.mbu-sp';
    bar.classList.remove('mbu-compact');            // measure at full labels
    var kids = [].slice.call(bar.children);
    var need = gap * Math.max(0, kids.length - 1);
    for (var i = 0; i < kids.length; i++) {
        if (kids[i].matches && kids[i].matches(spacer)) continue;
        need += kids[i].offsetWidth;
    }
    var compact = need > bar.clientWidth - pad;
    bar.classList.toggle('mbu-compact', compact);
    return compact;
}

// Publish the components on a shared namespace. Three reasons, in order:
//
//  1. it is the cross-userscript contract #563 is about — another script (or a
//     future one) gets the standard widgets without copying them, the same way
//     Mammoth already exposes its field-memory through a documented convention;
//  2. it makes the components testable from outside, which is the only way to
//     assert the *behaviour* half of the contract rather than just the markup;
//  3. it costs nothing when several scripts do it — the definitions are
//     byte-identical, so first writer wins and the rest are no-ops.
//
// Guarded per key, never clobbering: a script that loaded first keeps its copy,
// and a page that defines an unrelated window.MBU is left alone.
// Theme recognition. #564: "we don't have to conform to Stylus vars, we could
// probably use them as a recognition signal to enable our own dark theme."
//
// That is the right way round. Reading --background/--text and hoping every
// derived colour lands somewhere readable is guesswork that fails one token at a
// time; knowing WHICH theme we are in lets the token set say so outright, and
// lets us hand the browser the one thing CSS variables cannot express —
// color-scheme, which is what actually paints a checkbox dark instead of leaving
// a white (Firefox: black) box on a dark panel.
//
// The signal is the rendered page, not a particular userstyle's variable names:
// whatever painted the body, we measure its luminance. So this works for Stylus,
// for a browser extension, for MusicBrainz shipping its own dark mode one day,
// and for a user who just set --background by hand.
//
//   · an explicit --mbu-theme (light|dark) always wins — the escape hatch;
//   · otherwise the page background decides;
//   · re-checked when stylesheets arrive, because Stylus often lands after us.
function mbuThemeOf(bg) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(bg || '');
    if (!m) return null;
    if (m[4] !== undefined && +m[4] < 0.5) return null;      // transparent tells us nothing
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * f(+m[1]) + 0.7152 * f(+m[2]) + 0.0722 * f(+m[3]);
    return L < 0.35 ? 'dark' : 'light';
}
// #569 (chaban-mb) — write only when the value actually changes.
//
// The DOM does not do this for you. classList.add of a token already present,
// classList.toggle to the state it is already in, setAttribute with the value it
// already has: each one re-sets the attribute and dispatches a mutation record.
// Harmless once; these run from 2Hz heartbeats and from observers that react to
// each other, and the measured idle cost on the release editor was 66 records a
// second, of which 93% came from writes that changed nothing (see
// dev/ui/measure-569-idle-mutations.mjs).
//
// Semantically these are exact no-ops: they skip a write ONLY when the value is
// already the one being written, so nothing that reads the DOM afterwards can
// tell the difference. That is the whole reason they are safe to sprinkle around
// a 2Hz loop.
function mbuCls(el, token, on) {
    if (!el || !el.classList) return;
    if (el.classList.contains(token) !== !!on) el.classList.toggle(token, !!on);
}
function mbuAttr(el, name, value) {
    if (!el) return;
    if (value === null || value === undefined || value === false) {
        if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== String(value)) {
        el.setAttribute(name, String(value));
    }
}
// For IDL properties (disabled, title, textContent, style.display …). Reading
// them is cheap; writing them is not, and textContent in particular replaces
// every child node.
//
// ⚠ textContent is the one to think twice about: its getter concatenates the
// text of ALL descendants, so on an element with child ELEMENTS the comparison
// can match while the DOM shape is wrong, and the guard then skips a write that
// would have flattened it. Only use it where the target holds text and nothing
// else.
function mbuProp(obj, prop, value) {
    if (!obj) return;
    if (obj[prop] !== value) obj[prop] = value;
}

// #569: the one element mbuTheme resolves --background through. Looked up by id
// rather than kept in a variable, so the seven scripts of a bundle share ONE
// probe instead of adding seven, and so it heals itself if anything removes it.
// It lives in <body>: a permanent stray node under <html>, outside head and
// body, is the sort of thing another script's document scan trips over.
function mbuProbe() {
    var p = document.getElementById('mbu-theme-probe');
    if (p) return p;
    if (!document.body) return null;
    p = document.createElement('span');
    p.id = 'mbu-theme-probe';
    p.setAttribute('aria-hidden', 'true');
    p.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;pointer-events:none;background:var(--background)';
    document.body.appendChild(p);
    return p;
}
function mbuTheme() {
    var root = document.documentElement;
    try {
        var cs = getComputedStyle(root);
        var forced = (cs.getPropertyValue('--mbu-theme') || '').trim();
        var t = (forced === 'dark' || forced === 'light') ? forced
            : (mbuThemeOf(getComputedStyle(document.body).backgroundColor)
                || mbuThemeOf(cs.backgroundColor)
                || mbuThemeOf(cs.getPropertyValue('--mbu-bg'))
                || 'light');
        if (root.getAttribute('data-mbu-theme') !== t) root.setAttribute('data-mbu-theme', t);

        // Should we adopt the userstyle's OWN shades, or use our own palette?
        // Only if its --background actually agrees with the theme we detected.
        // A userstyle can paint the page dark with ordinary rules and still leave
        // --background at a light value for its own purposes; taking that on
        // trust hands us a light surface under a correct dark theme, which is
        // indistinguishable from the bug it looks like. Measured, not assumed.
        var seed = null;
        var raw = (cs.getPropertyValue('--background') || '').trim();
        if (raw) {
            // Resolved through a real element, because --background may itself be
            // a var(), a named colour, or anything else CSS accepts.
            //
            // #569 (chaban-mb): this used to CREATE and REMOVE that element on
            // every call, as a direct child of <html>. mbuTheme re-runs whenever
            // the root or body class changes, Mammoth watches the whole document
            // for childList changes and reacts by toggling classes on <html>, and
            // those class changes wake mbuTheme again — a self-feeding loop,
            // measured at 12 root-node mutations a second on an idle page, which
            // is what makes DevTools blink.
            //
            // One element, created once and left in place, breaks it: the value
            // is still resolved LIVE on every call (a cached reading would freeze
            // the theme at whatever it was before Stylus injected, which is the
            // bug this whole function exists to avoid) but nothing is added to or
            // removed from the DOM to read it.
            var probe = mbuProbe();
            var got = null;
            if (probe) {
                got = mbuThemeOf(getComputedStyle(probe).backgroundColor);
            } else {
                // No <body> yet — document-start. Fall back to the transient
                // element for these first one or two calls; the idle loop this
                // avoids cannot exist before the page has a body anyway.
                var tmp = document.createElement('span');
                tmp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;background:var(--background)';
                document.documentElement.appendChild(tmp);
                got = mbuThemeOf(getComputedStyle(tmp).backgroundColor);
                tmp.remove();
            }
            if (got === t) seed = 'theme';
        }
        // guarded: setAttribute dispatches a mutation record even when the value
        // is unchanged, and this runs several times a second
        if (seed) { if (root.getAttribute('data-mbu-seed') !== seed) root.setAttribute('data-mbu-seed', seed); }
        else if (root.hasAttribute('data-mbu-seed')) root.removeAttribute('data-mbu-seed');
        return t;
    } catch (e) { return 'light'; }
}
// A document-start script runs before the document is parsed: documentElement can
// still be null, and <head> and <body> don't exist. Observing a null root threw, the
// catch below swallowed it, and nothing (the watches, the re-checks) was ever set up,
// so such a script never read the theme at all (#625). It starts on the parsed page.
function mbuThemeStart() { try {
    mbuTheme();
    // Stylus and friends inject after us often enough that a one-shot read is
    // wrong about half the time. Watch for stylesheets ARRIVING — head childList
    // plus the root's own attributes — and never the whole subtree: this runs on
    // the release editor, where a subtree observer calling getComputedStyle is a
    // layout thrash on every keystroke.
    var _mbuThemeT = 0;
    var _mbuThemeSoon = function () {
        clearTimeout(_mbuThemeT);
        _mbuThemeT = setTimeout(mbuTheme, 150);
    };
    var _mbuThemeObs = new MutationObserver(_mbuThemeSoon);
    _mbuThemeObs.observe(document.documentElement, { attributeFilter: ['style', 'class'] });
    // ⚠ #569: characterData, not just childList. Until the idle thrash was fixed
    // this function ran several times a second whether or not anything had
    // changed — Apollo re-added a body class at 2Hz, which woke this observer,
    // which is how a theme change was ever noticed. That accidental polling was
    // LOAD-BEARING: with the thrash gone and only head-childList watched, a
    // userstyle that REWRITES ITSELF (Stylus editing it live, or one switching
    // palette) adds and removes no nodes, so nothing woke us and the theme went
    // stale. Caught by verify-569-theme-still-tracks.mjs, which passes on the
    // pre-fix build and failed on the first version of this one.
    if (document.head) _mbuThemeObs.observe(document.head, { childList: true, subtree: true, characterData: true });
    if (document.body) _mbuThemeObs.observe(document.body, { attributeFilter: ['style', 'class'] });
    // …and the case that produces no DOM mutation at all: the OS flipping to dark
    // under a userstyle with a prefers-color-scheme query. Nothing above can see
    // that, and nothing did before either — it was simply never noticed while the
    // page was re-checking itself several times a second.
    try {
        var _mbuMq = matchMedia('(prefers-color-scheme: dark)');
        if (_mbuMq.addEventListener) _mbuMq.addEventListener('change', _mbuThemeSoon);
        else if (_mbuMq.addListener) _mbuMq.addListener(_mbuThemeSoon);
    } catch (e) {}
    setTimeout(mbuTheme, 400);
    setTimeout(mbuTheme, 2000);
} catch (e) { /* no observer, no theme switching — the light defaults still apply */ } }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mbuThemeStart, { once: true });
else mbuThemeStart();

try {
    var _mbuNs = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window);
    if (!_mbuNs.MBU) _mbuNs.MBU = {};
    if (!_mbuNs.MBU.theme) _mbuNs.MBU.theme = mbuTheme;
    if (!_mbuNs.MBU.helpHref) _mbuNs.MBU.helpHref = mbuHelpHref;
    if (!_mbuNs.MBU.helpHtml) _mbuNs.MBU.helpHtml = mbuHelpHtml;
    if (!_mbuNs.MBU.helpEl) _mbuNs.MBU.helpEl = mbuHelpEl;
    if (!_mbuNs.MBU.toast) _mbuNs.MBU.toast = mbuToast;
    if (!_mbuNs.MBU.cfgHeader) _mbuNs.MBU.cfgHeader = mbuCfgHeader;
    if (!_mbuNs.MBU.dismissOn) _mbuNs.MBU.dismissOn = mbuDismissOn;
    if (!_mbuNs.MBU.fitToolbar) _mbuNs.MBU.fitToolbar = mbuFitToolbar;
    if (!_mbuNs.MBU.tip) _mbuNs.MBU.tip = mbuTip;
} catch (e) { /* a locked-down page must not stop the script loading */ }

// Tooltips: our own, never the browser's title (dev/ui/tooltip.mjs, STANDARDS → Standard 14).
function mbuTipV() { return 13; }
function mbuTipCssText() { return "#mbu-tip{position:fixed;left:0;top:0;z-index:var(--mbu-z-tip,2147483647);box-sizing:border-box;max-width:min(330px,calc(100vw - 16px));padding:7px 11px 8px;background:var(--mbu-bg,#fff);color:var(--mbu-text,#222);border:1px solid var(--mbu-border,#cfc6e6);border-radius:9px;box-shadow:0 6px 24px rgba(40,20,80,.2),0 1px 3px rgba(40,20,80,.12);font:12.5px/1.45 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);text-align:left;white-space:normal;overflow-wrap:break-word;letter-spacing:normal;text-transform:none;pointer-events:none;visibility:hidden;opacity:0;transform:translateY(-3px);transition:opacity .12s ease,transform .12s ease,visibility 0s linear .12s}#mbu-tip.mbu-tip-up{transform:translateY(3px)}#mbu-tip.mbu-tip-on{visibility:visible;opacity:1;transform:none;transition:opacity .12s ease,transform .12s ease}#mbu-tip.mbu-tip-act.mbu-tip-on{pointer-events:auto}#mbu-tip.mbu-tip-wide{max-width:min(460px,calc(100vw - 16px))}#mbu-tip:has(.mbu-tip-dl){max-width:min(480px,calc(100vw - 16px))}#mbu-tip::before{content:\"\";position:absolute;left:calc(var(--mbu-tip-ax,50%) - 5px);top:-5px;width:8px;height:8px;background:inherit;border:1px solid var(--mbu-border,#cfc6e6);border-right:0;border-bottom:0;transform:rotate(45deg)}#mbu-tip.mbu-tip-up::before{top:auto;bottom:-5px;border:1px solid var(--mbu-border,#cfc6e6);border-left:0;border-top:0}#mbu-tip.mbu-tip-card:not(.mbu-tip-up)::before{background:var(--mbu-bg-raised,#faf9fe)}#mbu-tip .mbu-tip-lead{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-p{margin:0;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-lead+*,#mbu-tip .mbu-tip-p+*,#mbu-tip .mbu-tip-ul+*,#mbu-tip .mbu-tip-rows+*{margin-top:5px}#mbu-tip>.mbu-tip-p:first-child:last-child{color:var(--mbu-text,#222)}#mbu-tip .mbu-tip-warn{color:var(--mbu-warn,#a05a00)}#mbu-tip .mbu-tip-rows{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 8px;align-items:start;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-rows>.mbu-tip-kk,#mbu-tip .mbu-tip-rows>.mbu-tip-dl{min-height:18px}#mbu-tip .mbu-tip-rows>.mbu-tip-k{line-height:18px}#mbu-tip .mbu-tip-rows>:nth-child(odd){justify-self:start}#mbu-tip .mbu-tip-rows>.mbu-tip-span{grid-column:2;justify-self:stretch;margin:-2px 0 0}#mbu-tip .mbu-tip-k{display:inline-block;padding:0;border:0;background:none;color:var(--mbu-text-weak,#888);font:600 11.5px/1.5 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-kk{display:inline-flex;align-items:center;gap:3px;color:var(--mbu-accent-text,#5f3ec0);white-space:nowrap}#mbu-tip .mbu-tip-dl{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--mbu-text,#222);white-space:nowrap}#mbu-tip .mbu-tip-dl i{flex:none;width:10px;height:10px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.22)}#mbu-tip .mbu-tip-on{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip .mbu-tip-dl.mbu-tip-on::after{content:\"◂\";margin-left:-2px;font-size:11px}#mbu-tip .mbu-tip-off{opacity:.45}#mbu-tip .mbu-tip-sym{letter-spacing:.2px}#mbu-tip .mbu-tip-mouse{display:block;flex:none;position:relative}#mbu-tip .mbu-tip-mouse rect[fill=none],#mbu-tip .mbu-tip-mouse path[stroke]{stroke:var(--mbu-text-weak,#888);stroke-width:1}#mbu-tip .mbu-tip-kx{font:600 10px/1 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);color:var(--mbu-text-weak,#888)}#mbu-tip .mbu-tip-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}#mbu-tip .mbu-tip-o{display:inline-block;padding:0 7px;border-radius:999px;background:var(--mbu-accent-soft,#ece4ff);color:var(--mbu-accent-text,#5f3ec0);font:600 11px/1.6 var(--mbu-font,-apple-system,Segoe UI,Roboto,Arial,sans-serif);white-space:nowrap}#mbu-tip .mbu-tip-ul{margin:0;padding:0 0 0 15px;color:var(--mbu-text-dim,#555)}#mbu-tip .mbu-tip-ul li{margin:1px 0;padding:0}#mbu-tip code{font:11.5px var(--mbu-font-mono,ui-monospace,Consolas,monospace);padding:0 4px;border-radius:4px;background:var(--mbu-bg-sunken,#f4f2f9)}#mbu-tip b{font-weight:600;color:var(--mbu-text,#222)}#mbu-tip a{color:var(--mbu-accent-text,#5f3ec0)}#mbu-tip.mbu-tip-card{padding:0;width:380px;max-width:min(380px,calc(100vw - 16px));overflow:visible}#mbu-tip .mbu-tip-ch{display:flex;align-items:center;gap:8px;padding:8px 11px;border-bottom:1px solid var(--mbu-border-soft,#e2dcef);background:var(--mbu-bg-raised,#faf9fe);border-radius:9px 9px 0 0}#mbu-tip .mbu-tip-ca{margin-left:auto;font-size:11px;color:var(--mbu-text-weak,#999);white-space:nowrap}#mbu-tip .mbu-tip-cb{padding:8px 11px;display:flex;flex-direction:column;gap:6px}#mbu-tip .mbu-tip-cf{display:flex;gap:10px;padding:6px 11px;border-top:1px solid var(--mbu-border-soft,#e2dcef);font-size:11px;color:var(--mbu-text-weak,#999)}#mbu-tip .mbu-tip-cf>:last-child:not(:first-child){margin-left:auto}@media (prefers-reduced-motion:reduce){#mbu-tip,#mbu-tip.mbu-tip-on{transition:none;transform:none}}"; }
function mbuTipRoots() { return ".mbu-ov,.mbu-ui,#mbu-logpop,.mbu-logemb,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu"; }
function mbuTipEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
}
function mbuTipLabel(line) {
    var m = /^([^\s:.,;!?()][^:.,;!?()]{0,40}?): (\S[\s\S]*)$/.exec(line);
    if (!m || m[1].split(/\s+/).length > 3 || /https?$/i.test(m[1])) return null;
    return { label: m[1], text: m[2], key: mbuTipIsKey(m[1]) };
}
function mbuTipIsKey(label) {
    return /click|drag|wheel|scroll|hover|double|press|paste|\bkey\b|^(esc|escape|enter|return|tab|space|ctrl|shift|alt|cmd|meta|del|delete|backspace|f\d{1,2})\b|\+|^[↑↓←→]/i.test(label);
}
function mbuTipInline(s) {
    return mbuTipEsc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
        .replace(/\(((?:(?:Ctrl|Alt|Shift|Cmd|Meta)\+)+[^\s()]+)\)/g, function (m, k) { return mbuTipKbd(k); })
        .replace(/\s\((Esc|Enter|Space|Tab|[A-Z0-9]|[↑↓←→])\)(?=$|[\s.,;])/g, ' <kbd class="mbu-tip-k">$1</kbd>');
}
function mbuTipCap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function mbuTipMod(k) { return { ctrl: 'C', alt: 'A', shift: '⇧', cmd: '⌘', meta: '⌘' }[String(k).toLowerCase()] || k; }
function mbuTipKbd(combo) {
    var parts = String(combo).split(/\s*\+\s*/);
    var key = parts.pop();
    return '<kbd class="mbu-tip-k mbu-tip-sym"><span class="mbu-tip-sr">' + mbuTipEsc(combo) + '</span><span aria-hidden="true">'
        + parts.concat('').map(mbuTipMod).join('+') + mbuTipEsc(key.length === 1 ? key.toUpperCase() : mbuTipCap(key)) + '</span></kbd>';
}
function mbuTipKey(label) {
    // two ways to do the same, "Middle-click / Alt+click": each drawn, a grey slash between
    var alts = String(label).split(/\s+\/\s+/);
    if (alts.length > 1) return '<span class="mbu-tip-kk">' + alts.map(mbuTipKey).join('<span class="mbu-tip-kx">/</span>') + '</span>';
    // two mouse actions at once, "Right-click + wheel": each drawn, a grey plus between
    var both = /^(.*?(?:click|drag|wheel|scroll))\s+\+\s+(.+)$/i.exec(String(label).trim());
    if (both) return '<span class="mbu-tip-kk">' + mbuTipKey(both[1]) + '<span class="mbu-tip-kx">+</span>' + mbuTipKey(both[2]) + '</span>';
    var m = /^((?:(?:ctrl|alt|shift|cmd|meta)\s*[+-]\s*)*)(left|right|middle|double)?[- ]?(click|drag|wheel|scroll)$/i.exec(String(label).trim());
    if (!m) return /^(?:(?:ctrl|alt|shift|cmd|meta)\s*\+\s*)+\S/i.test(label) ? mbuTipKbd(label) : '<span class="mbu-tip-k">' + mbuTipEsc(mbuTipCap(label)) + '</span>';
    var mods = m[1] ? m[1].split(/\s*[+-]\s*/).filter(Boolean) : [];
    var btn = (m[2] || '').toLowerCase(), act = m[3].toLowerCase();
    var wheel = btn === 'middle' || act === 'wheel' || act === 'scroll';
    // the wheel a filled strip down the middle, as bold as a filled button (a thin wheel vanished at 10px)
    var fill = wheel ? 'M4 1.4h4V7H4z' : btn === 'right' ? 'M6 1C8.8 1 11 3.2 11 6v1H6z' : 'M6 1C3.2 1 1 3.2 1 6v1h5z';
    var svg = '<svg class="mbu-tip-mouse" viewBox="0 0 12 16" width="10" height="13" aria-hidden="true">'
        + '<path d="' + fill + '" fill="currentColor"/>'
        + '<rect x="1" y="1" width="10" height="14" rx="5" fill="none" stroke="currentColor" stroke-width="1.3"/>'
        + '<path d="M1 7h10' + (wheel ? '' : 'M6 1v6') + '" stroke="currentColor" stroke-width="1.1"/>'        + '</svg>';
    var extra = btn === 'double' ? '×2' : act === 'drag' ? 'drag' : (act === 'wheel' || act === 'scroll') ? '↕' : '';
    return '<span class="mbu-tip-kk"><span class="mbu-tip-sr">' + mbuTipEsc(mbuTipCap(label)) + '</span>'
        + (mods.length ? '<kbd class="mbu-tip-k mbu-tip-sym" aria-hidden="true">' + mods.map(mbuTipMod).join('+') + '</kbd>' : '')
        + svg + (extra ? '<span class="mbu-tip-kx" aria-hidden="true">' + extra + '</span>' : '') + '</span>';
}
function mbuTipText(src) {
    var raw = String(src == null ? '' : src).replace(/\r/g, '').replace(/^\s+|\s+$/g, '');
    if (!raw) return '';
    var lines = [];
    // the shapes the old title texts took, read as the rows they mean:
    //   "… — click to open it"              → "…" + "Click: open it"
    //   "… (right-click: guess case all)"   → "…" + "Right-click: guess case all"
    //   "Ctrl-click", "Alt-click"           → "Ctrl+click", "Alt+click"
    raw = raw.replace(/\b(Ctrl|Alt|Shift|Cmd)-(click|drag)/gi, '$1+$2')
        .replace(/\s*\(((?:(?:right|middle|double|ctrl|alt|shift|cmd)[-+ ]?)+click|(?:ctrl|alt|shift|cmd)\+\w+):\s*([^()\n]+)\)(?=\s*(?:$|\n))/gim, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/\s+[—–-]\s+((?:(?:right|middle|double|ctrl|alt|shift)[-+ ]?)?click) to ([^\n·]+)/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; })
        .replace(/[.;]\s+((?:right|middle|double|ctrl|alt|shift)[-+ ]?click|click) to ([^\n·.]+)\.?(?=\s*(?:$|\n))/gi, function (m, k, t) { return '\n' + mbuTipCap(k) + ': ' + t; });
    raw.split('\n').forEach(function (line) {
        line = line.replace(/\s+$/, '');
        // ' · Label: ' starts a new line; so does '. Label: ' once the line itself opened with a label
        var parts = line.split(/\s+·\s+/), out = [parts[0]];
        for (var i = 1; i < parts.length; i++) {
            if (mbuTipLabel(parts[i])) out.push(parts[i]); else out[out.length - 1] += ' · ' + parts[i];
        }
        out.forEach(function (seg) {
            if (!mbuTipLabel(seg)) { lines.push(seg); return; }
            var bits = seg.split(/(?<=\.)\s+(?=[A-Z][\w+-]*(?:\s[\w+-]+)?:\s)/);
            bits.forEach(function (b) { lines.push(b); });
        });
    });
    // blocks: lead / paragraph / rows / bullets
    var blocks = [], rowRun = [];
    var flushRows = function () {
        if (!rowRun.length) return;
        var keyed = rowRun.filter(function (r) { return r.key; }).length;
        if (rowRun.length >= 2 || keyed) blocks.push({ t: 'rows', rows: rowRun });
        else blocks.push({ t: 'p', s: rowRun[0].line });
        rowRun = [];
    };
    lines.forEach(function (line, n) {
        if (!line.trim()) { flushRows(); return; }
        var b = /^\s*[-•]\s+(.*)$/.exec(line);
        if (b) {
            flushRows();
            var last = blocks[blocks.length - 1];
            if (last && last.t === 'ul') last.items.push(b[1]); else blocks.push({ t: 'ul', items: [b[1]] });
            return;
        }
        // a level row, "{#2f6fd6} Exact: …": a dot in the colour before the label; "{#… on}" marks the
        // chosen level, "{#… off}" dims one past it (a cutoff's table)
        var lv = /^\{(#[0-9a-f]{3,8})(?: (on|off))?\}\s*(\S[\s\S]*)$/i.exec(line);
        if (lv) {
            var ll = mbuTipLabel(lv[3]) || { label: lv[3], text: '' };
            rowRun.push({ label: ll.label, text: ll.text, dot: lv[1], st: lv[2] ? lv[2].toLowerCase() : '', line: line });
            return;
        }
        var l = mbuTipLabel(line);
        // the first line is a row only as a key or when a label follows: alone, "Release group: when…" is a sentence
        if (l && (l.key || blocks.length || rowRun.length || (lines[n + 1] && mbuTipLabel(lines[n + 1])))) { l.line = line; rowRun.push(l); return; }
        flushRows();
        blocks.push({ t: 'p', s: line });
    });
    flushRows();
    // one long paragraph: its first sentence becomes the lead
    if (blocks.length === 1 && blocks[0].t === 'p' && blocks[0].s.length > 110) {
        var m = /^(.{12,110}?[.!?])\s+(?=[A-Z(“"'])([\s\S]+)$/.exec(blocks[0].s);
        if (m) blocks = [{ t: 'p', s: m[1].replace(/\.$/, '') }, { t: 'p', s: m[2] }];
    }
    var lead = blocks.length > 1 && blocks[0].t === 'p';
    var rowsHtml = function (bl) {
        return bl.rows.map(function (r) {
            if (r.dot) {
                var c = r.st ? ' mbu-tip-' + r.st : '';
                return '<span class="mbu-tip-dl' + c + '"><i style="background:' + r.dot + '"></i>' + mbuTipEsc(mbuTipCap(r.label)) + '</span>'
                    + '<span class="mbu-tip-dt' + c + '">' + mbuTipInline(r.text) + '</span>';
            }
            return (r.key ? mbuTipKey(r.label) : '<span class="mbu-tip-o">' + mbuTipEsc(mbuTipCap(r.label)) + '</span>') + '<span>' + mbuTipInline(r.text) + '</span>';
        }).join('');
    };
    var html = function (bl, i, span) {
        var sp = span ? ' mbu-tip-span' : '';
        if (bl.t === 'ul') return '<ul class="mbu-tip-ul' + sp + '">' + bl.items.map(function (x) { return '<li>' + mbuTipInline(x) + '</li>'; }).join('') + '</ul>';
        if (bl.t === 'rows') return span ? rowsHtml(bl) : '<div class="mbu-tip-rows">' + rowsHtml(bl) + '</div>';
        var warn = /^⚠/.test(bl.s);
        return '<div class="' + (lead && i === 0 ? 'mbu-tip-lead' : 'mbu-tip-p') + (warn ? ' mbu-tip-warn' : '') + sp + '">' + mbuTipInline(bl.s) + '</div>';
    };
    // rows with a note between them stay one grid, the note under the row before it, so their labels line up
    var first = -1, last = -1;
    blocks.forEach(function (bl, i) { if (bl.t === 'rows') { if (first < 0) first = i; last = i; } });
    var out = '';
    for (var i = 0; i < blocks.length; i++) {
        if (i === first && last > first) {
            out += '<div class="mbu-tip-rows">';
            for (; i <= last; i++) out += html(blocks[i], i, true);
            out += '</div>';
            i = last;
        } else out += html(blocks[i], i, false);
    }
    return out;
}
function mbuTipCard(o) {
    o = o || {};
    var h = '';
    if (o.head || o.title || o.aside) {
        h += '<div class="mbu-tip-ch">' + (o.head || '') + (o.title ? '<b>' + mbuTipEsc(o.title) + '</b>' : '')
            + (o.aside ? '<span class="mbu-tip-ca">' + mbuTipEsc(o.aside) + '</span>' : '') + '</div>';
    }
    if (o.body) h += '<div class="mbu-tip-cb">' + o.body + '</div>';
    if (o.foot || o.footAside) h += '<div class="mbu-tip-cf"><span>' + (o.foot || '') + '</span>' + (o.footAside ? '<span>' + o.footAside + '</span>' : '') + '</div>';
    return h;
}
function mbuTipS() {
    return mbuTipS.s || (mbuTipS.s = {
        me: Math.random().toString(36).slice(2, 10), lead: false, els: typeof WeakMap === 'function' ? new WeakMap() : null, prov: [],
        cur: null, curOpts: null, pend: null, showT: 0, hideT: 0, liveT: 0, warm: 0, quiet: null, tab: false, mx: -1, my: -1, obs: null,
    });
}
function mbuTip(el, content, opts) {
    if (!el) return el;
    var _mbuTip = mbuTipS();
    mbuTipStart();
    opts = opts || {};
    if (typeof content === 'function') {
        if (_mbuTip.els) _mbuTip.els.set(el, { fn: content, opts: opts });
        el.setAttribute('data-mbu-tip-own', '');
        el.removeAttribute('title');
        return el;
    }
    if (content == null || content === '') el.removeAttribute('data-tip'); else el.setAttribute('data-tip', String(content));
    if (opts.place) el.setAttribute('data-tip-place', opts.place);
    if (opts.wide) el.setAttribute('data-tip-wide', '');
    el.removeAttribute('title');
    if (_mbuTip.cur === el) mbuTipRender();
    return el;
}
function mbuTipOn(selector, fn, opts) {
    mbuTipS().prov.push({ sel: selector, fn: fn, opts: opts || {} });
    mbuTipStart();
}
function mbuTipShowFor(el, content, opts) {
    if (!el || content == null || content === '') { mbuTipHide(true); return; }
    mbuTipStart();
    var o = opts || {};
    var fn = typeof content === 'function' ? content : function () { return content; };
    var S = mbuTipS();
    if (S.cur === el) { S.curOpts.fn = fn; if (!mbuTipRender()) mbuTipHide(true); return; }
    mbuTipShow({ el: el, fn: fn, opts: o });
}
function mbuTipHtml(s) {
    if (mbuTipHtml.tt === undefined) {
        mbuTipHtml.tt = null;
        try {
            var tt = (typeof window !== 'undefined' && window.trustedTypes) || null;
            if (tt && tt.createPolicy) mbuTipHtml.tt = tt.createPolicy('mbu-tip-' + Math.random().toString(36).slice(2, 8), { createHTML: function (x) { return x; } });
        } catch (e) { /* the page allows no new policy: plain strings */ }
    }
    return mbuTipHtml.tt ? mbuTipHtml.tt.createHTML(String(s)) : String(s);
}
function mbuTipCss() {
    var s = document.getElementById('mbu-tip-css');
    if (s && +s.getAttribute('data-v') >= mbuTipV()) return;
    if (!s) { s = document.createElement('style'); s.id = 'mbu-tip-css'; (document.head || document.documentElement).appendChild(s); }
    s.setAttribute('data-v', String(mbuTipV()));
    s.textContent = mbuTipCssText();
}
function mbuTipEl() {
    var t = document.getElementById('mbu-tip');
    if (!t) {
        t = document.createElement('div');
        t.id = 'mbu-tip';
        t.setAttribute('role', 'tooltip');
    }
    // Falcon's panel, Group Therapy's menus and others sit at the top z-index too; at an equal one
    // the later element is drawn over, so the tip moves to the end of the page when it is not there
    // (majkinetor, with a screenshot: Falcon's panel over a tip). It hangs on <html>, not <body>:
    // Event Horizon isolates <body>, which kept a tip there under the dock's icons (#847)
    var host = document.documentElement;
    if (t.parentNode !== host || host.lastElementChild !== t) host.appendChild(t);
    return t;
}
function mbuTipFind(node) {
    var _mbuTip = mbuTipS();
    var tip = document.getElementById('mbu-tip');
    for (var el = node && node.nodeType === 1 ? node : node && node.parentElement; el && el !== document.documentElement; el = el.parentElement) {
        if (el === tip) return null;
        var reg = _mbuTip.els && _mbuTip.els.get(el);
        if (reg) return { el: el, fn: reg.fn, opts: reg.opts };
        for (var i = 0; i < _mbuTip.prov.length; i++) {
            var p = _mbuTip.prov[i];
            try { if (el.matches(p.sel)) return { el: el, fn: p.fn, opts: p.opts }; } catch (e) { /* a bad selector matches nothing */ }
        }
        if (!_mbuTip.lead) continue;
        if (el.hasAttribute('data-mbu-tip-own')) return null;   // another copy's rich tip
        if (el.hasAttribute('data-tip')) return { el: el, opts: { place: el.getAttribute('data-tip-place'), wide: el.hasAttribute('data-tip-wide') } };
        // an <option> keeps its title: the browser draws a dropdown's list, where no page tooltip reaches
        if (el.hasAttribute('title') && el.getAttribute('title') && el.namespaceURI === 'http://www.w3.org/1999/xhtml' && !/^(OPTION|OPTGROUP)$/.test(el.tagName)) {
            var root = null;
            try { root = el.closest(mbuTipRoots()); } catch (e) { /* no roots */ }
            if (root) {
                el.setAttribute('data-tip', el.getAttribute('title'));
                el.removeAttribute('title');
                return { el: el, opts: {} };
            }
        }
    }
    return null;
}
function mbuTipRender() {
    var _mbuTip = mbuTipS();
    var a = _mbuTip.cur, o = _mbuTip.curOpts || {}, t = mbuTipEl(), c;
    if (!a) return false;
    if (o.fn) {
        try { c = o.fn(a); } catch (e) { c = null; }
        if (c == null || c === '') return false;
        if (typeof c === 'string') t.innerHTML = mbuTipHtml(c);
        else { t.textContent = ''; t.appendChild(c); }
    } else {
        var s = a.getAttribute('data-tip');
        if (!s) return false;
        var h = mbuTipText(s);
        t.innerHTML = mbuTipHtml(h);
        // an element with nothing to read of its own is named by its tip
        if (!a.getAttribute('aria-label') && !/[\p{L}\p{N}]/u.test(a.textContent || '') && !a.querySelector('img[alt]:not([alt=""])')) {
            a.setAttribute('aria-label', s.split('\n')[0]);
        }
    }
    t.className = 'mbu-ui' + (o.card ? ' mbu-tip-card' : '') + (o.interactive ? ' mbu-tip-act' : '') + (o.wide ? ' mbu-tip-wide' : '');
    t.setAttribute('data-owner', _mbuTip.me);
    mbuTipPlace(t, a, o.place);
    return true;
}
function mbuTipPlace(t, a, place) {
    var _mbuTip = mbuTipS();
    var r = a.getBoundingClientRect();
    if (!r.width && !r.height && a.firstElementChild) r = a.firstElementChild.getBoundingClientRect();
    t.style.left = '0px'; t.style.top = '0px';
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth || window.innerWidth, vh = window.innerHeight, gap = 8, m = 6;
    var below = place !== 'above';
    if (below && r.bottom + gap + h > vh - m && r.top - gap - h >= m) below = false;
    else if (!below && r.top - gap - h < m && r.bottom + gap + h <= vh - m) below = true;
    var top = below ? r.bottom + gap : r.top - gap - h;
    // a wide element (a row, a long field): the arrow points where the pointer is
    var cx = r.left + r.width / 2;
    if (r.width > 220 && _mbuTip.mx >= r.left && _mbuTip.mx <= r.right) cx = _mbuTip.mx;
    var left = Math.max(m, Math.min(vw - w - m, Math.round(cx - w / 2)));
    t.style.left = left + 'px';
    t.style.top = Math.max(m, Math.round(top)) + 'px';
    t.style.setProperty('--mbu-tip-ax', Math.max(12, Math.min(w - 12, Math.round(cx - left))) + 'px');
    t.classList.toggle('mbu-tip-up', !below);
}
function mbuTipShow(found) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.hideT); clearTimeout(_mbuTip.showT);
    if (_mbuTip.cur && _mbuTip.cur !== found.el) mbuTipHide(true);
    mbuTipCss();
    _mbuTip.cur = found.el;
    _mbuTip.curOpts = { fn: found.fn, interactive: !!found.opts.interactive, card: !!found.opts.card, wide: !!found.opts.wide, place: found.opts.place };
    if (!mbuTipRender()) { _mbuTip.cur = null; return; }
    var t = mbuTipEl();
    found.el.setAttribute('aria-describedby', 'mbu-tip');
    // next frame, so the transition runs from the hidden state
    requestAnimationFrame(function () { if (_mbuTip.cur === found.el) t.classList.add('mbu-tip-on'); });
    // the element can go (a re-render) or change its text while the tip is up
    clearInterval(_mbuTip.liveT);
    _mbuTip.liveT = setInterval(function () { if (!_mbuTip.cur || !_mbuTip.cur.isConnected) mbuTipHide(true); }, 300);
    try {
        if (!_mbuTip.obs) _mbuTip.obs = new MutationObserver(function () { if (_mbuTip.cur && !mbuTipRender()) mbuTipHide(true); });
        _mbuTip.obs.disconnect();
        if (!found.fn) _mbuTip.obs.observe(found.el, { attributes: true, attributeFilter: ['data-tip'] });
    } catch (e) { /* no observer: the text is read again on the next hover */ }
}
function mbuTipHide(now) {
    var _mbuTip = mbuTipS();
    clearTimeout(_mbuTip.showT); clearTimeout(_mbuTip.hideT);
    _mbuTip.pend = null;
    var hide = function () {
        var a = _mbuTip.cur;
        if (!a) return;
        _mbuTip.cur = null;
        clearInterval(_mbuTip.liveT);
        try { if (_mbuTip.obs) _mbuTip.obs.disconnect(); } catch (e) { /* gone */ }
        if (a.getAttribute('aria-describedby') === 'mbu-tip') a.removeAttribute('aria-describedby');
        var t = document.getElementById('mbu-tip');
        if (t && t.getAttribute('data-owner') === _mbuTip.me) t.classList.remove('mbu-tip-on');
        _mbuTip.warm = Date.now();
    };
    if (now) hide();
    else _mbuTip.hideT = setTimeout(hide, _mbuTip.curOpts && _mbuTip.curOpts.interactive ? 220 : 70);
}
function mbuTipStart() {
    if (mbuTipStart.done || typeof document === 'undefined') return;
    var _mbuTip = mbuTipS();
    var root = document.documentElement;
    if (!root) { document.addEventListener('DOMContentLoaded', mbuTipStart, { once: true }); return; }
    mbuTipStart.done = true;
    if (!root.hasAttribute('data-mbu-tip')) { root.setAttribute('data-mbu-tip', _mbuTip.me); _mbuTip.lead = true; }
    var inTip = function (n) { var t = document.getElementById('mbu-tip'); return !!(t && n && t.contains(n)); };
    window.addEventListener('mousemove', function (e) { _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; }, { passive: true, capture: true });
    window.addEventListener('mouseover', function (e) {
        _mbuTip.mx = e.clientX; _mbuTip.my = e.clientY; _mbuTip.over = e.target;   // :hover can read false in a page that has not seen a real move
        if (inTip(e.target)) { if (_mbuTip.cur) clearTimeout(_mbuTip.hideT); return; }
        var f = mbuTipFind(e.target);
        if (!f) { if (_mbuTip.cur && !_mbuTip.cur.contains(e.target)) mbuTipHide(); return; }
        if (f.el === _mbuTip.cur) { clearTimeout(_mbuTip.hideT); return; }
        if (f.el === _mbuTip.quiet || (_mbuTip.pend && _mbuTip.pend.el === f.el)) return;
        clearTimeout(_mbuTip.showT);
        _mbuTip.pend = f;
        var warm = _mbuTip.cur || Date.now() - _mbuTip.warm < 450;
        _mbuTip.showT = setTimeout(function () {
            _mbuTip.pend = null;
            if (f.el.isConnected && f.el.contains(_mbuTip.over)) mbuTipShow(f);
        }, warm ? 40 : (f.opts.delay != null ? f.opts.delay : 350));
    }, true);
    window.addEventListener('mouseout', function (e) {
        var to = e.relatedTarget;
        var q = _mbuTip.quiet;
        if (q && q.contains(e.target) && !(to && q.contains(to))) _mbuTip.quiet = null;
        var p = _mbuTip.pend;
        if (p && p.el.contains(e.target) && !(to && p.el.contains(to))) { clearTimeout(_mbuTip.showT); _mbuTip.pend = null; }
        var a = _mbuTip.cur;
        if (!a) return;
        if (to && (a.contains(to) || (_mbuTip.curOpts.interactive && inTip(to)))) return;
        if (a.contains(e.target) || inTip(e.target)) mbuTipHide();
    }, true);
    window.addEventListener('mousedown', function (e) {
        if (inTip(e.target)) return;
        clearTimeout(_mbuTip.showT); _mbuTip.pend = null;
        var f = mbuTipFind(e.target);
        _mbuTip.quiet = f ? f.el : null;   // no tip again on the element just clicked until the pointer leaves it
        _mbuTip.tab = false;
        if (_mbuTip.cur) mbuTipHide(true);
    }, true);
    document.addEventListener('keydown', function (e) {
        if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) _mbuTip.tab = e.key === 'Tab';
        if (!_mbuTip.cur) return;
        var interactive = _mbuTip.curOpts && _mbuTip.curOpts.interactive;
        // typing closes a plain tip, as it does the browser's; modifiers alone don't
        if (e.key !== 'Escape') { if (!interactive && !/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) mbuTipHide(true); return; }
        mbuTipHide(true);
        if (interactive) e.stopPropagation();   // a card is a popover: Esc closes it and nothing else
    }, true);
    window.addEventListener('scroll', function (e) { if (_mbuTip.cur && !inTip(e.target)) mbuTipHide(true); }, true);
    window.addEventListener('blur', function () { if (_mbuTip.cur) mbuTipHide(true); });
    document.addEventListener('focusin', function (e) {
        var el = e.target, vis = false;
        try { vis = el.matches(':focus-visible'); } catch (x) { /* old browser */ }
        // a text box is :focus-visible even when a script focuses it (a picker opening), so only Tab's focus shows the tip
        if (!vis || !_mbuTip.tab) return;
        var f = mbuTipFind(el);
        if (f && f.el === el) { clearTimeout(_mbuTip.showT); _mbuTip.showT = setTimeout(function () { if (document.activeElement === el) mbuTipShow(f); }, 150); }
    }, true);
    document.addEventListener('focusout', function (e) {
        if (_mbuTip.cur && _mbuTip.cur === e.target && !(e.relatedTarget && inTip(e.relatedTarget))) mbuTipHide();
    }, true);
}
mbuTipStart();
// </ST-UI>

if (CONS) consolidateMain(CONS);
else { launcher(); if (FC_UPDATE) fcUpdate(FC_UPDATE); else afterSave(); }
})();
