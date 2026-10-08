// ==UserScript==
// @name         Mission Control
// @namespace    https://musicbrainz.org/
// @version      2026.10.8.222453
// @description  One window on the release page that asks the other scripts (Platform Check, ISRC Scout, Art Station, Fusion, Credit Hoarder) what is missing, shows it all in one review, and applies the ticked changes in order.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5NaXNzaW9uIENvbnRyb2w8L3RpdGxlPgo8ZGVmcz48ZmlsdGVyIGlkPSJtY28xMy1oIiB4PSItMTAlIiB5PSItMTAlIiB3aWR0aD0iMTIwJSIgaGVpZ2h0PSIxMjAlIj48ZmVNb3JwaG9sb2d5IGluPSJTb3VyY2VBbHBoYSIgb3BlcmF0b3I9ImRpbGF0ZSIgcmFkaXVzPSIxLjUiIHJlc3VsdD0iZCIvPjxmZUZsb29kIGZsb29kLWNvbG9yPSIjZmZmIiBmbG9vZC1vcGFjaXR5PSIuNyIvPjxmZUNvbXBvc2l0ZSBpbjI9ImQiIG9wZXJhdG9yPSJpbiIvPjxmZU1lcmdlPjxmZU1lcmdlTm9kZS8+PGZlTWVyZ2VOb2RlIGluPSJTb3VyY2VHcmFwaGljIi8+PC9mZU1lcmdlPjwvZmlsdGVyPjwvZGVmcz48ZyBmaWx0ZXI9InVybCgjbWNvMTMtaCkiPjxwYXRoIGQ9Ik03NyAzNS41IEw2NCA0MyBMNTEgMzUuNSBMNTEgMjAuNSBMNjQgMTMgTDc3IDIwLjVaIiBmaWxsPSIjN2E1N2U4IiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik01OS43IDc3LjUgTDQ2LjcgODUgTDMzLjcgNzcuNSBMMzMuNyA2Mi41IEw0Ni43IDU1IEw1OS43IDYyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik05NC4zIDc3LjUgTDgxLjMgODUgTDY4LjMgNzcuNSBMNjguMyA2Mi41IEw4MS4zIDU1IEw5NC4zIDYyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik00Mi4zIDEwNy41IEwyOS40IDExNSBMMTYuNCAxMDcuNSBMMTYuNCA5Mi41IEwyOS40IDg1IEw0Mi4zIDkyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik03NyAxMDcuNSBMNjQgMTE1IEw1MSAxMDcuNSBMNTEgOTIuNSBMNjQgODUgTDc3IDkyLjVaIiBmaWxsPSIjZmZjOTRhIiBzdHJva2U9IiMyMjIyM2IiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xMTEuNiAxMDcuNSBMOTguNiAxMTUgTDg1LjcgMTA3LjUgTDg1LjcgOTIuNSBMOTguNiA4NSBMMTExLjYgOTIuNVoiIGZpbGw9IiNmZmM5NGEiIHN0cm9rZT0iIzIyMjIzYiIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9nPgo8L3N2Zz4K
// @homepageURL  https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/mission_control/README.md
// @match        https://*.musicbrainz.org/release/*
// @grant        GM_setValue
// @grant        GM_getValue
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
if (!RELEASE) return;

const Log = mbuLog({ name: 'Mission Control', version: VERSION, header: 'Mission Control — activity log', key: 'mc.logwin', before: () => mcStyle() });
Log.info(mbuStartupInfo('Mission Control'));

/* ── settings (GM storage, #501) ───────────────────────────────────────────── */

// fusion / ch: 'auto' fetches during Probe, 'ask' waits for the card's Fetch
// button, 'off' drops the step. Both fetches can take minutes (#680).
// linkedOpen: the sections whose already-linked are listed as rows (else: icons on its heading), one
// key each: a card's id, or PC's 'pc:release' / 'pc:artist' / 'pc:label'
// reloadAfter: reload the release page after an Execute without errors
const DEFAULTS = { fusion: 'ask', ch: 'ask', left: true, right: true, linkedOpen: [], autoProbe: false, reloadAfter: false };
// a card and the providers whose ticks it holds (Tracks: the per-track ones without a card of their own)
const CARDS = [['tracks', ['is', 'fusion']], ['pc', ['pc']], ['as', ['as']], ['ch', ['ch']]];
// The cards switched off with the switch in their header: folded, and Execute leaves out what is ticked
// in them. For this page only, never saved: the next release starts with every card on.
const OFF = new Set();
const cardOff = id => OFF.has(id);
const providerOff = id => CARDS.some(([c, ps]) => cardOff(c) && ps.includes(id));
function loadSettings() {
    let s = {};
    try { s = JSON.parse(GM_getValue('mc.settings', '{}')) || {}; } catch (e) { Log.warn('settings unreadable, using defaults: ' + e.message); }
    return Object.assign({}, DEFAULTS, s);
}
const S = loadSettings();
function saveSettings() {
    try { GM_setValue('mc.settings', JSON.stringify(S)); } catch (e) { Log.warn('settings not saved: ' + e.message); }
    Log.debug('settings ' + JSON.stringify(S));
}

/* ── execution order ───────────────────────────────────────────────────────── */

// Each step is a provider; a step with `lanes` runs them in parallel (they hit
// different APIs with their own rate limits). `mode` names the setting that can
// switch an optional step to auto / ask / off.
const STEPS = [
    { id: 'pc', name: 'Release and entity links', short: 'PC', provider: 'Platform Check', glyph: '🔗' },
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
    "pc": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5NQiBQbGF0Zm9ybSBDaGVjazwvdGl0bGU+CjxnIHN0cm9rZT0iIzk0YTNiOCIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik02NCA2NCBMODggMjIuNCIvPjxwYXRoIGQ9Ik02NCA2NCBMMTEyIDY0Ii8+PHBhdGggZD0iTTY0IDY0IEw4OCAxMDUuNiIvPjxwYXRoIGQ9Ik02NCA2NCBMNDAgMTA1LjYiLz48cGF0aCBkPSJNNjQgNjQgTDE2IDY0Ii8+PHBhdGggZD0iTTY0IDY0IEw0MCAyMi40Ii8+PC9nPjxjaXJjbGUgY3g9Ijg4IiBjeT0iMjIuNCIgcj0iMTIiIGZpbGw9IiNmNDcyYjYiLz48Y2lyY2xlIGN4PSIxMTIiIGN5PSI2NCIgcj0iMTIiIGZpbGw9IiNmYWNjMTUiLz48Y2lyY2xlIGN4PSI4OCIgY3k9IjEwNS42IiByPSIxMiIgZmlsbD0iIzRhZGU4MCIvPjxjaXJjbGUgY3g9IjQwIiBjeT0iMTA1LjYiIHI9IjEyIiBmaWxsPSIjMzhiZGY4Ii8+PGNpcmNsZSBjeD0iMTYiIGN5PSI2NCIgcj0iMTIiIGZpbGw9IiNhNzhiZmEiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjIyLjQiIHI9IjEyIiBmaWxsPSIjZmI5MjNjIi8+PGNpcmNsZSBjeD0iNjQiIGN5PSI2NCIgcj0iMjQiIGZpbGw9IiMwZjE3MmEiLz48cGF0aCBkPSJNNTQuMjIyMjIyMjIyMjIyMjIgNjQgTDYxLjMzMzMzMzMzMzMzMzMzNiA3MS4xMTExMTExMTExMTExMSBMNzQuNjY2NjY2NjY2NjY2NjcgNTYuODg4ODg4ODg4ODg4ODg2IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iNiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPgo=",
    "is": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+DQogIDx0aXRsZT5JU1JDIFNjb3V0PC90aXRsZT4NCiAgICA8cGF0aCBkPSJNNjQgNjQgTDY0IDI0IEE0MCA0MCAwIDAgMSA5OSA4NCBaIiBmaWxsPSIjZTNkOGY3Ii8+DQogIDxnIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZmNDJjMSIgc3Ryb2tlLXdpZHRoPSI2Ij4NCiAgICA8Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSI0MCIvPg0KICAgIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjI2IiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZT0iI2I5YTNlOCIvPg0KICAgIDxjaXJjbGUgY3g9IjY0IiBjeT0iNjQiIHI9IjEzIiBzdHJva2Utd2lkdGg9IjQiIHN0cm9rZT0iI2I5YTNlOCIvPg0KICA8L2c+DQogIDxsaW5lIHgxPSI2NCIgeTE9IjY0IiB4Mj0iNjQiIHkyPSIyNCIgc3Ryb2tlPSIjNmY0MmMxIiBzdHJva2Utd2lkdGg9IjYiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPg0KICA8Y2lyY2xlIGN4PSI4NiIgY3k9IjUwIiByPSI3IiBmaWxsPSIjNGIyZTgzIi8+DQo8L3N2Zz4NCg==",
    "as": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5BcnQgU3RhdGlvbjwvdGl0bGU+CjxjaXJjbGUgY3g9Ijg2IiBjeT0iNjQiIHI9IjM4IiBmaWxsPSIjMWIwZjNiIiBzdHJva2U9IiNiOTY3ZmYiIHN0cm9rZS13aWR0aD0iMyIvPgo8Y2lyY2xlIGN4PSI4NiIgY3k9IjY0IiByPSIyOC44OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNGEzNDgwIiBzdHJva2Utd2lkdGg9IjEuNSIvPjxjaXJjbGUgY3g9Ijg2IiBjeT0iNjQiIHI9IjIwLjkwMDAwMDAwMDAwMDAwMiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNGEzNDgwIiBzdHJva2Utd2lkdGg9IjEuNSIvPgo8Y2lyY2xlIGN4PSI4NiIgY3k9IjY0IiByPSIxMS4wMiIgZmlsbD0iI2ZmNzFjZSIvPjxjaXJjbGUgY3g9Ijg2IiBjeT0iNjQiIHI9IjIuNTA4IiBmaWxsPSIjMWIwZjNiIi8+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhcy1za3ljIiB4MT0iMCIgeTE9IjAiIHgyPSIwIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwLjAwIiBzdG9wLWNvbG9yPSIjN2ZlN2ZmIi8+PHN0b3Agb2Zmc2V0PSIwLjUwIiBzdG9wLWNvbG9yPSIjZDlhNmZmIi8+PHN0b3Agb2Zmc2V0PSIxLjAwIiBzdG9wLWNvbG9yPSIjZmY3MWNlIi8+PC9saW5lYXJHcmFkaWVudD48Y2xpcFBhdGggaWQ9ImFzLWNjIj48cmVjdCB4PSIxMCIgeT0iMjIiIHdpZHRoPSI3OCIgaGVpZ2h0PSI4NCIgcng9IjgiLz48L2NsaXBQYXRoPjwvZGVmcz4KPGcgY2xpcC1wYXRoPSJ1cmwoI2FzLWNjKSI+PHJlY3QgeD0iMTAiIHk9IjIyIiB3aWR0aD0iNzgiIGhlaWdodD0iODQiIGZpbGw9InVybCgjYXMtc2t5YykiLz4KPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJhcy1nczIiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNmZmY2YTgiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNmZjhhNWMiLz48L2xpbmVhckdyYWRpZW50Pgo8bWFzayBpZD0iYXMtbXMyIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iI2ZmZiIvPjxyZWN0IHg9IjI1LjYiIHk9IjY3LjIiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjEuMiIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9IjY5LjgiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjEuNSIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9IjczLjAiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjEuOCIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9Ijc3LjAiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjIuMyIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9IjgyLjAiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjIuOSIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9Ijg4LjMiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjMuNiIgZmlsbD0iIzAwMCIvPjxyZWN0IHg9IjI1LjYiIHk9Ijk2LjIiIHdpZHRoPSI0Ni44IiBoZWlnaHQ9IjQuNSIgZmlsbD0iIzAwMCIvPjwvbWFzaz48L2RlZnM+CjxjaXJjbGUgY3g9IjQ5IiBjeT0iNzYuMDgiIHI9IjIzLjQiIGZpbGw9InVybCgjYXMtZ3MyKSIgbWFzaz0idXJsKCNhcy1tczIpIi8+PHJlY3QgeD0iMTAiIHk9Ijc0LjA4IiB3aWR0aD0iNzgiIGhlaWdodD0iMzEuOTIiIGZpbGw9IiNiOTY3ZmYiLz48cGF0aCBkPSJNMTAgNzQuMDhIODhNMTAgNzcuOUg4OE0xMCA4My4ySDg4TTEwIDkxLjRIODhNMTAgMTA0LjJIODhNMzQuOCA3NC4wOEwtNDguNSAxMDZNMzguNCA3NC4wOEwtMjQuMSAxMDZNNDEuOSA3NC4wOEwwLjMgMTA2TTQ1LjUgNzQuMDhMMjQuNiAxMDZNNDkuMCA3NC4wOEw0OS4wIDEwNk01Mi41IDc0LjA4TDczLjQgMTA2TTU2LjEgNzQuMDhMOTcuOCAxMDZNNTkuNiA3NC4wOEwxMjIuMSAxMDZNNjMuMiA3NC4wOEwxNDYuNSAxMDYiIHN0cm9rZT0iI2ZmZmI5NiIgc3Ryb2tlLXdpZHRoPSIxLjMiIGZpbGw9Im5vbmUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvZz48cmVjdCB4PSIxMCIgeT0iMjIiIHdpZHRoPSI3OCIgaGVpZ2h0PSI4NCIgcng9IjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzJhMTQ1OCIgc3Ryb2tlLXdpZHRoPSIzIi8+Cjwvc3ZnPgo=",
    "fusion": "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+DQogIDx0aXRsZT5GdXNpb248L3RpdGxlPg0KICA8ZyBmaWxsPSJub25lIiBzdHJva2U9IiM4YTVjZjYiIHN0cm9rZS13aWR0aD0iNyI+DQogICAgPGVsbGlwc2UgY3g9IjY0IiBjeT0iNjQiIHJ4PSI1MiIgcnk9IjIyIi8+DQogICAgPGVsbGlwc2UgY3g9IjY0IiBjeT0iNjQiIHJ4PSI1MiIgcnk9IjIyIiB0cmFuc2Zvcm09InJvdGF0ZSg2MCA2NCA2NCkiLz4NCiAgICA8ZWxsaXBzZSBjeD0iNjQiIGN5PSI2NCIgcng9IjUyIiByeT0iMjIiIHRyYW5zZm9ybT0icm90YXRlKDEyMCA2NCA2NCkiLz4NCiAgPC9nPg0KICA8Y2lyY2xlIGN4PSI2NCIgY3k9IjY0IiByPSIxNCIgZmlsbD0iIzZkM2ZmMCIvPg0KPC9zdmc+DQo=",
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
    try { d = JSON.parse(e.detail); } catch (x) { Log.warn('mc:provider with unreadable detail: ' + x.message); return; }
    if (!d || !d.id) { Log.warn('mc:provider without an id'); return; }
    found[d.id] = d;
    Log.info('provider ' + d.id + ' answered: ' + (d.name || '?') + ' v' + (d.version || '?') + ' · ' + JSON.stringify(d.capabilities || []));
    if (ui) { paintBadges(); paintReleaseCredits(); fitCards(); }
});

// Probe: MC sends 'mc:probe' { release, run, only }; a provider answers with
// 'mc:progress' { id, run, state, note } while it works and 'mc:findings'
// { id, run, findings } when done. Events from an older run are ignored.
const results = {};   // provider id -> { state: 'busy' | 'done', note, findings }
const picked = {};    // provider id -> Set of finding keys ticked for Execute
const fxOpen = new Set();   // tracks (recording MBIDs) whose Fusion comparison is open under their row
const fxBusy = new Set();   // tracks whose group Fusion is checking for ISRCs and AcoustIDs
let run = null;
function busEvent(e, kind) {
    let d;
    try { d = JSON.parse(e.detail); } catch (x) { Log.warn(kind + ' with unreadable detail: ' + x.message); return null; }
    if (!d || !d.id) { Log.warn(kind + ' without an id'); return null; }
    if (d.run !== run) { Log.debug(kind + ' from ' + d.id + ' for run ' + d.run + ', not the current ' + run + ' — ignored'); return null; }
    return d;
}
document.addEventListener('mc:progress', e => {
    const d = busEvent(e, 'mc:progress'); if (!d) return;
    const r = results[d.id];
    // during Execute a provider that already answered keeps its findings: the note goes beside them
    // (a late tick from the probe, after its findings, is dropped: no stuck spinner)
    if (r && r.state === 'done') { if (executing) { r.working = d.note || 'working'; r.at = Date.now(); if (d.best) r.best = d.best; } }
    else results[d.id] = Object.assign(r || {}, { state: 'busy', note: d.note || '', at: Date.now() });
    Log.debug('progress ' + d.id + ': ' + (d.note || d.state));
    paintAll();
});
document.addEventListener('mc:findings', e => {
    const d = busEvent(e, 'mc:findings'); if (!d) return;
    const findings = Array.isArray(d.findings) ? d.findings : [];
    results[d.id] = { state: 'done', findings, summary: d.summary || '', best: d.best || null, open: Array.isArray(d.open) ? d.open : null, barcode: d.barcode || null };
    // ticked by default: only what the provider is sure of
    picked[d.id] = new Set(findings.filter(x => x.state === 'new').map(x => x.key));
    const tally = findings.reduce((t, x) => (t[x.state] = (t[x.state] || 0) + 1, t), {});
    Log.ok('findings ' + d.id + ': ' + findings.length + ' ' + JSON.stringify(tally));
    findings.forEach(x => Log.debug('  ' + d.id + ' ' + x.key + ' ' + x.state + (x.why ? ' (' + x.why + ')' : '') + (x.url ? ' ' + x.url : '')));
    paintAll();
    syncIsLinks();
});
// a provider sends some findings again (Fusion, after checking one group's ISRCs and AcoustIDs):
// each replaces the one with its key and keeps its tick, unless it can't be ticked any more
document.addEventListener('mc:update', e => {
    const d = busEvent(e, 'mc:update'); if (!d) return;
    (d.keys || []).forEach(k => fxBusy.delete(k));
    if (d.error) mbuToast(((PROVIDERS.find(p => p.id === d.id) || {}).short || d.id) + ': ' + d.error);
    const r = results[d.id];
    if (r && r.state === 'done' && r.findings) {
        for (const x of Array.isArray(d.findings) ? d.findings : []) {
            const i = r.findings.findIndex(y => y.key === x.key);
            if (i === -1) r.findings.push(x); else r.findings[i] = x;
            if (!PICKABLE[x.state] && picked[d.id]) picked[d.id].delete(x.key);
            fxBusy.delete(x.key);
        }
        Log.ok('update ' + d.id + ': ' + (d.findings || []).length + ' finding(s)');
    }
    paintAll();
});
// ISRC Scout reads the release's album links (Bandcamp, Spotify, Apple…) for its ISRCs and
// recording links. The album links ticked in Platform Check's card are not on the release yet
// (Execute adds them first), so IS is probed with them too: again whenever the ticked set
// changes, once the probe out is answered. Nothing is asked of IS before the first Probe.
const laneOpen = new Set();   // PC barcode lanes opened into rows (#680), by barcode digits
let isLinksAsked = null;   // the album links IS's current findings were probed with (JSON)
function pcAlbumLinks() {
    const r = results.pc, set = picked.pc;
    if (!r || r.state !== 'done' || !set) return [];
    return (r.findings || []).filter(x => !x.entity && x.url && x.state !== 'linked' && x.state !== 'none' && set.has(x.key)).map(x => x.url).sort();
}
let _isLinksTimer = 0;
function syncIsLinks(delay) {
    clearTimeout(_isLinksTimer);
    if (delay) { _isLinksTimer = setTimeout(syncIsLinks, delay); return; }
    const r = results.is;
    if (!found.is || !r || r.state === 'busy' || executing) return;
    if (JSON.stringify(pcAlbumLinks()) === isLinksAsked) return;
    Log.info('the ticked album links changed: asking ISRC Scout again');
    probeOne('is');
}
function probe() {
    run = Date.now().toString(36);
    for (const k in results) delete results[k];
    for (const k in picked) delete picked[k];
    const ask = PROVIDERS.filter(p => found[p.id] && modeOf(p) === 'auto').map(p => p.id);
    ask.forEach(id => { results[id] = { state: 'busy', note: '', at: Date.now() }; });
    isLinksAsked = '[]';   // nothing is ticked yet
    Log.info('probe run ' + run + ' · asking ' + (ask.join(', ') || 'nobody') + '');
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ release: RELEASE, run, only: ask, links: [] }) }));
    paintAll();
    return ask.length;
}
// An Ask-mode provider is probed on its own Fetch button, inside the current run
// (a run is started if there is none), leaving the others' results alone.
function probeOne(id) {
    if (!found[id]) return;
    if (!run) run = Date.now().toString(36);
    delete picked[id];
    results[id] = { state: 'busy', note: '', at: Date.now() };
    const links = pcAlbumLinks();
    if (id === 'is') isLinksAsked = JSON.stringify(links);
    Log.info('probe ' + id + ' on request · run ' + run + (links.length ? ' · ticked album links ' + links.join(' ') : ''));
    document.dispatchEvent(new CustomEvent('mc:probe', { detail: JSON.stringify({ release: RELEASE, run, only: [id], links }) }));
    paintAll();
}
// Execute: the steps in order, the lanes of a parallel step together. Each
// provider with ticked findings gets 'mc:apply' { id, run, release, keys, dry }
// and answers 'mc:applied' { id, run, ok, sent, note }. A provider that doesn't
// answer within APPLY_WAIT counts as failed, and the next step still runs.
const APPLY_WAIT = 15000;
let executing = false;
function applyOne(id, dry) {
    const keys = Array.from(picked[id] || []);
    return new Promise(resolve => {
        // a provider still working says so with mc:progress, and each one restarts the wait (#680: a cover upload takes minutes)
        const done = o => { document.removeEventListener('mc:applied', on); document.removeEventListener('mc:progress', alive); clearTimeout(t); if (results[id]) delete results[id].working; resolve(o); };
        const on = e => { const d = busEvent(e, 'mc:applied'); if (d && d.id === id) done(Object.assign({ keys }, d)); };
        const timeout = () => setTimeout(() => done({ id, ok: false, sent: 0, note: 'no answer in ' + APPLY_WAIT / 1000 + ' s' }), APPLY_WAIT);
        let t = timeout();
        const alive = e => { let d = null; try { d = JSON.parse(e.detail); } catch (x) { return; } if (d && d.id === id && d.run === run) { clearTimeout(t); t = timeout(); } };
        document.addEventListener('mc:applied', on);
        document.addEventListener('mc:progress', alive);
        if (results[id]) Object.assign(results[id], { working: dry ? 'queueing' : 'applying', at: Date.now() });
        Log.info((dry ? 'dry run' : 'apply') + ' ' + id + ': ' + keys.length + ' item(s) ' + JSON.stringify(keys));
        document.dispatchEvent(new CustomEvent('mc:apply', { detail: JSON.stringify({ id, run, release: RELEASE, keys, dry: !!dry, mc: VERSION }) }));
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
    // the findings of each item Falcon finished (done, or skipped as already there) are linked now
    const fin = (d.items || []).filter(i => i.status === 'done' || i.status === 'skipped');
    const keys = (r.falconKeys || []).filter(k => { const x = (r.findings || []).find(f => f.key === k); return x && fin.some(i => x.entity ? i.mbid === x.entity.mbid : i.entityType === 'release'); });
    if (keys.length) { markApplied(m[1], keys); r.falconKeys = r.falconKeys.filter(k => !keys.includes(k)); }
    Log.info('falcon ' + m[1] + ': ' + (d.items || []).map(i => i.entityType + ' ' + (i.name || i.mbid) + ' ' + i.status + (i.error ? ' (' + i.error + ')' : '')).join(' · '));
    paintAll();
    if (reloadPending) reloadWhenClean();
});
// reloadAfter: an Execute with no errors reloads the release page so it shows the new data. A batch
// handed to Falcon runs in this page, so the reload waits for it and drops if an item went wrong.
let reloadPending = false;
function reloadWhenClean() {
    const fs = Object.values(results).map(r => r.falcon).filter(Boolean);
    if (fs.some(f => f.running)) return;
    reloadPending = false;
    if (fs.some(f => f.items.some(i => !['done', 'skipped'].includes(i.status)))) { Log.warn('reload after Execute dropped: Falcon reported a problem'); return; }
    Log.info('Execute done without errors: reloading the release page');
    setTimeout(() => location.reload(), 1200);
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
    const fig = (src, alt, title, lines) => '<div class="mc-best-c">' + (src ? '<button type="button" class="mc-cov" data-act="cover" data-i="' + (n++) + '" title="Show full screen (← → to compare)"><img alt="" src="' + esc(src) + '"' + (alt && alt !== src ? ' data-alt="' + esc(alt) + '"' : '') + '></button>' : '<span class="mc-best-no">🖼</span>')
        + '<div class="mc-best-t"><b>' + esc(title) + '</b>' + lines.filter(Boolean).map(l => '<span>' + esc(l) + '</span>').join('') + '</div></div>';
    const c = b.current;
    // the same size to the pixel and the byte: the front already is the best cover (imported earlier), not a comparison
    if (c && c.bytes && c.bytes === b.bytes && c.w === b.w && c.h === b.h)
        return '<div class="mc-best no"><div class="mc-best-row">'
            + fig(c.thumb || b.thumb, c.full || b.full, 'Front cover', [c.w + ' × ' + c.h + ' · ' + kb(c.bytes), 'the same image as the best found (' + (b.provider || '?') + ')'])
            + '</div><div class="mc-best-what">Already the best cover: nothing to do</div></div>';
    const what = !c ? 'Execute enters it as the front cover'
        : b.replace ? 'Larger than the current front: Execute enters it and removes the current one'
        : b.larger ? 'Larger than the current fronts: Execute adds it beside them'
        : 'Not larger than the current front: nothing to gain (tick a source to add it anyway)';
    return '<div class="mc-best' + (c && !b.larger ? ' no' : '') + '"><div class="mc-best-row">'
        + fig(b.thumb, b.full, 'Best cover', [b.provider || '?', b.w + ' × ' + b.h + (b.bytes ? ' · ' + kb(b.bytes) : ''), b.of > 1 ? 'the largest of ' + b.of + ' found' : 'the only one found'])
        + (c ? '<span class="mc-best-vs">' + (b.larger ? '>' : '≤') + '</span>' + fig(c.thumb, c.full, 'Current front', [c.w + ' × ' + c.h + (c.bytes ? ' · ' + kb(c.bytes) : '')]) : '')
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
    v.innerHTML = mbuHtml('<div class="mc-cov-top"><span class="mc-cov-t"></span><span class="mc-cov-i"></span><span class="mc-cov-n"></span><button type="button" class="mc-cov-x" title="Close (Esc)">✕</button></div>'
        + '<div class="mc-cov-stage"><img alt=""></div>'
        + (list.length > 1 ? '<button type="button" class="mc-cov-go prev" title="Previous (←)">‹</button><button type="button" class="mc-cov-go next" title="Next (→)">›</button>' : ''));
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
function falconHtml(f) {
    if (!f || !f.items.length) return '';
    const settled = f.items.filter(i => !['queued', 'active'].includes(i.status)).length;
    const bad = f.items.filter(i => ['failed', 'partial', 'manual'].includes(i.status)).length;
    const head = 'Falcon ' + (settled < f.items.length ? 'is running: ' + settled + ' of ' + f.items.length + ' finished' : bad ? 'finished, ' + bad + ' need' + (bad === 1 ? 's' : '') + ' a look' : 'finished');
    return '<div class="mc-falcon' + (bad ? ' bad' : settled === f.items.length ? ' ok' : '') + '"><div class="mc-falcon-h">' + esc(head)
        + (bad ? ' <button type="button" class="mc-falcon-open" data-act="falcon-open" title="Open Falcon\'s panel to see why and retry">Open Falcon</button>' : '') + '</div>'
        + f.items.map(i => { const k = FALCON_MARK[i.status] || ['?', i.status]; return '<div class="mc-falcon-i st-' + esc(i.status) + '" title="' + esc(k[1] + (i.error ? ': ' + i.error : '')) + '"><span class="mk">' + k[0] + '</span><span class="ty">' + esc(i.entityType.replace('_', ' ')) + '</span><span class="nm">' + esc(i.name || i.mbid) + '</span><span class="ct">'
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
    Log.info('applied ' + id + ': ' + keys.length + ' item(s) now shown as linked');
}
async function execute(dry) {
    if (executing) return;
    executing = true; paintExec();
    let failed = 0, sent = 0;
    try {
        for (const step of STEPS) {
            const ids = (step.lanes || [step]).map(p => p.id)
                .filter(id => picked[id] && picked[id].size && !providerOff(id) && found[id] && (found[id].capabilities || []).includes('apply'));
            if (!ids.length) continue;
            Log.info('step ' + step.id + ': ' + ids.join(' ∥ '));
            const outs = await Promise.all(ids.map(id => applyOne(id, dry)));
            outs.forEach(o => {
                results[o.id] = Object.assign(results[o.id] || {}, { applied: o });
                // a batch handed to Falcon turns linked item by item, as Falcon reports it done (falcon:status)
                if (o.ok && !dry && o.sent && o.via !== 'falcon') markApplied(o.id, o.keys || []);
                if (o.via === 'falcon') results[o.id].falconKeys = o.keys || [];
                if (o.ok) { sent += o.sent || 0; Log.ok(o.id + ': ' + (o.note || 'done')); } else { failed++; Log.err(o.id + ': ' + (o.note || 'failed')); }
            });
            paintAll();
        }
    } finally { executing = false; paintExec(); }
    mbuToast(failed ? failed + ' step' + (failed === 1 ? '' : 's') + ' failed: see the cards and the log' : (dry ? 'Dry run done: nothing was written' : 'Done: ' + sent + ' change' + (sent === 1 ? '' : 's') + ' applied or handed over'), { kind: failed ? 'error' : 'ok' });
    if (S.reloadAfter && !dry && !failed && sent) { reloadPending = true; reloadWhenClean(); }
}
function discover() {
    Log.info('discover: asking providers for release ' + RELEASE);
    document.dispatchEvent(new CustomEvent('mc:discover', { detail: JSON.stringify({ release: RELEASE, mc: VERSION }) }));
    setTimeout(() => {
        const missing = PROVIDERS.filter(p => !found[p.id]).map(p => p.provider);
        if (missing.length) Log.info('no adapter yet: ' + missing.join(', '));
        paintBadges();
    }, 500);
}

/* ── release from the page ─────────────────────────────────────────────────── */

// Read once from the rendered page, no request: the header and the tracklist
// are already there.
function readRelease() {
    const h = document.querySelector('.releaseheader');
    // the h1's own link: other scripts append to the h1 (ISRC Scout's "ISRC ✓ 12/12")
    const h1 = h && h.querySelector('h1');
    const tl = h1 && (h1.querySelector('a[href*="/release/"] bdi') || h1.querySelector('a[href*="/release/"]'));
    const title = tl ? tl.textContent.trim() : h1 ? h1.textContent.trim() : document.title;
    const artist = h && h.querySelector('.subheader') ? Array.from(h.querySelectorAll('.subheader a[href*="/artist/"]')).map(a => a.textContent.trim()).join(', ') : '';
    const cover = document.querySelector('.cover-art img');
    const tracks = [];
    let medium = 0;
    document.querySelectorAll('#content table.medium').forEach(tbl => {
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
    Log.info('release: "' + title + '" by ' + (artist || '?') + ' · ' + tracks.length + ' tracks on ' + medium + ' medium(s)');
    return { title, artist, cover: cover ? cover.src : '', tracks, media: medium };
}

/* ── UI ────────────────────────────────────────────────────────────────────── */

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = mbuHtml(html); return e; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
        + '.mc-hdr{display:flex;align-items:center;gap:14px;height:52px;padding:0 10px 0 16px;background:var(--mbu-bg);border-bottom:1px solid var(--mbu-border);box-shadow:var(--mbu-shadow)}'
        + '.mc-rel{display:flex;flex-direction:column;min-width:0;flex:0 1 230px;line-height:1.2}.mc-ttl{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mc-art{font-size:12px;color:var(--mbu-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        + '.mc-hdr .mc-act{display:flex;align-items:center;gap:4px;flex:none}#mc-root .mc-act .mc-exec{justify-content:center;min-width:96px;height:28px;padding:0 12px;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;background:var(--mbu-accent-soft);border-color:var(--mbu-border-strong);color:var(--mbu-accent-text)}#mc-root .mc-act .mc-exec:hover:not(:disabled){background:var(--mbu-accent);border-color:var(--mbu-accent);color:var(--mbu-accent-fg)}#mc-root .mc-act .mc-exec:disabled{background:var(--mbu-bg);border-color:var(--mbu-border);color:var(--mbu-text-weak);cursor:default}'
        // the steps: a ring, then the name and the state beside it, all on one centre line; a click shows or hides the order sidebar
        + '.mc-steps{display:flex;align-items:center;justify-content:center;gap:6px;flex:1 1 auto;min-width:0;height:100%;cursor:pointer}'
        + '#mc-root .mc-re{flex:none;width:26px;height:26px;margin-right:4px;padding:0;border-radius:50%;border:1px solid var(--mbu-border);background:var(--mbu-bg);color:var(--mbu-text-dim);font-size:14px;line-height:1;cursor:pointer}#mc-root .mc-re:hover{background:var(--mbu-bg-hover);color:var(--mbu-accent-text)}'
        + '.mc-step{display:inline-flex;align-items:center;gap:7px;min-width:0;flex:0 1 auto;padding:0 4px}'
        // a step's words take a fixed width (cut with …, the whole of it in the tooltip): changing words and
        // ticking seconds must not move the steps; only the window's width does
        + '.mc-step .tx{display:flex;flex-direction:column;flex:0 1 130px;width:130px;min-width:0;line-height:1.2}.mc-step b{font-size:12.5px;color:var(--mbu-text)}.mc-step i{font-style:normal;font-size:11.5px;color:var(--mbu-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}'
        + '.mc-ring{position:relative;flex:none;display:grid;place-items:center;width:28px;height:28px;border-radius:50%;border:2px solid var(--mbu-border);background:var(--mbu-bg);box-sizing:border-box}'
        + '.mc-ring img{width:16px;height:16px;object-fit:contain;display:block;margin:0;vertical-align:0}'
        + '.mc-ring sup{position:absolute;right:-8px;top:-6px;min-width:15px;height:15px;padding:0 3px;box-sizing:border-box;border-radius:8px;background:var(--mbu-accent);color:var(--mbu-text-on-accent);font-size:10px;font-weight:700;line-height:15px;text-align:center}'
        + '.mc-step.ok .mc-ring{border-color:var(--mbu-ok)}.mc-step.ok sup{background:var(--mbu-ok)}'
        + '.mc-step.add .mc-ring{border-color:var(--mbu-accent)}.mc-step.add i{color:var(--mbu-accent-text);font-weight:600}'
        + '.mc-step.busy .mc-ring{border-color:var(--mbu-info-border)}.mc-step.busy .mc-ring::before{content:"";position:absolute;inset:-2px;border-radius:50%;border:2px solid transparent;border-top-color:var(--mbu-info);border-left-color:var(--mbu-info);animation:mc-spin .9s linear infinite}.mc-step.busy i{color:var(--mbu-info)}'
        + '.mc-step.stalled .mc-ring{border-color:var(--mbu-warn);background:var(--mbu-warn-bg)}.mc-step.stalled sup{background:var(--mbu-warn)}.mc-step.stalled i,.mc-step.stalled b{color:var(--mbu-warn)}'
        + '.mc-step.err .mc-ring{border-color:var(--mbu-error);background:var(--mbu-error-bg)}.mc-step.err sup{background:var(--mbu-error)}.mc-step.err i{color:var(--mbu-error)}'
        + '.mc-step.wait .mc-ring{border-style:dashed}.mc-step.wait b{color:var(--mbu-text-weak)}.mc-step.off{opacity:.45}.mc-step.off b{text-decoration:line-through}'
        + '.mc-steps .mc-arrow{color:var(--mbu-text-weak);flex:none}.mc-steps .mc-par{display:inline-flex;align-items:center;gap:4px;height:40px;margin:0;background:none;padding:0 6px;border:1px dashed var(--mbu-border);border-radius:10px;box-sizing:border-box;min-width:0}'
        + '@media (prefers-reduced-motion: reduce){.mc-step.busy .mc-ring::before{animation:none}}'
        // the corner launchers (Falcon, Fusion, ours) share MC's z-index; hide them while MC is open
        + 'html.mc-open [data-mb-corner]{display:none!important}'
        // three panes
        + '.mc-main{flex:1;display:grid;grid-template-columns:220px 1fr 300px;min-height:0}'
        + '#mc-root.no-left .mc-main{grid-template-columns:1fr 300px}#mc-root.no-right .mc-main{grid-template-columns:220px 1fr}#mc-root.no-left.no-right .mc-main{grid-template-columns:1fr}'
        + '#mc-root.no-left .mc-side.left,#mc-root.no-right .mc-side.right{display:none}'
        + '.mc-side{background:var(--mbu-bg);border-right:1px solid var(--mbu-border);padding:12px;overflow:auto;min-width:0}.mc-side.right{border-right:0;border-left:1px solid var(--mbu-border)}'
        + '.mc-center{overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;min-width:0}'
        // flex items shrink by default: a long card squeezed the track list down to 3 rows
        + '.mc-center>*{flex:none}'
        + '.mc-sec{font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:var(--mbu-text-weak);margin:0 0 8px;font-weight:700;display:flex;align-items:center;gap:6px}'
        + '.mc-x{margin-left:auto;cursor:pointer;font-size:14px;letter-spacing:0;color:var(--mbu-text-weak);background:none;border:0;padding:0 4px}'
        // B's vertical execution order
        + '.mc-stage{position:relative;padding-left:26px;padding-bottom:12px}'
        + '.mc-stage::before{content:"";position:absolute;left:8px;top:20px;bottom:-2px;width:2px;background:var(--mbu-border)}.mc-stage:last-child::before{display:none}'
        + '.mc-node{position:absolute;left:0;top:2px;width:18px;height:18px;border-radius:50%;border:2px solid var(--mbu-border-strong);background:var(--mbu-bg);display:flex;align-items:center;justify-content:center}.mc-node .mc-sic{width:12px;height:12px;margin:0}.mc-sic{width:15px;height:15px;object-fit:contain;vertical-align:-3px;margin-right:4px;flex:0 0 auto}.mc-node.opt{border-style:dashed}'
        + '.mc-stage .nm{font-weight:600;font-size:12.5px;display:flex;align-items:center;gap:6px}.mc-stage .meta{font-size:11px;color:var(--mbu-text-dim)}'
        + '.mc-stage.off .nm,.mc-stage.off .meta{opacity:.45}'
        + '.mc-par{margin-top:6px;padding:6px 8px;border:1px dashed var(--mbu-border-strong);border-radius:var(--mbu-radius);background:var(--mbu-bg-sunken)}'
        + '.mc-par .lbl{font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--mbu-accent-text);font-weight:700;margin-bottom:3px}'
        + '.mc-lane{display:flex;align-items:center;gap:7px;font-size:12px;padding:2px 0}'
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
        + '.mc-st{font-size:10.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--st)}.mc-st:empty{display:none}'
        + '.mc-sect-h .ic{width:22px;height:22px;border-radius:6px;background:var(--mbu-accent-soft);display:grid;place-items:center;font-size:12px;flex:none}'
        + '.mc-sect-h .ic img{width:16px;height:16px;object-fit:contain;display:block}.mc-sect-h .ic.img{width:28px;height:28px;background:none}.mc-sect-h .ic.img img{width:28px;height:28px}.mc-sect-h .t{font-weight:700;font-size:12.5px}.mc-sect-h .p{font-size:10.5px;color:var(--mbu-text-weak)}'
        + '.mc-empty{padding:10px;color:var(--mbu-text-weak);font-size:12px}'
        + '.mc-line{display:grid;grid-template-columns:16px 16px 1fr auto;gap:8px;align-items:center;padding:4px 10px;border-bottom:1px solid var(--mbu-divider)}'
        + '.mc-bc{display:inline-block;font:600 12px/1.5 ui-monospace,Consolas,monospace;color:var(--bc);background:color-mix(in srgb,var(--bc) 12%,transparent);border:1px solid color-mix(in srgb,var(--bc) 45%,transparent);border-radius:5px;padding:1px 6px;white-space:nowrap}'
        + '.mc-bcl{display:grid;grid-template-columns:10px max-content minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:4px 10px;border-bottom:1px solid var(--mbu-divider);cursor:pointer}.mc-bcl:hover{background:var(--mbu-bg-hover)}.mc-bcl.empty{cursor:default;opacity:.75}.mc-bcl.empty:hover{background:none}'
        + '.mc-tri{font-size:9px;color:var(--mbu-text-weak)}.mc-bcl-ic{display:flex;flex-wrap:wrap;gap:3px;min-width:0}.mc-bcl-no{font-size:11px;color:var(--mbu-text-weak)}'
        + '.mc-ti{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;border:1px solid transparent;opacity:.55}.mc-ti.mc-pick{cursor:pointer}.mc-ti.mc-pick:hover{opacity:1;border-color:var(--mbu-border-strong)}.mc-ti.on{opacity:1;border-color:var(--mbu-accent);background:var(--mbu-accent-soft)}.mc-ti.linked{opacity:1;position:relative}.mc-ti.linked::after{content:"✓";position:absolute;right:-1px;bottom:-4px;font-size:10px;font-weight:700;color:var(--mbu-ok)}'
        + '#mc-root .mc-all{font:600 11px inherit;padding:2px 9px;border-radius:12px;border:1px solid var(--mbu-border-strong);background:var(--mbu-bg);color:var(--mbu-accent-text);cursor:pointer;white-space:nowrap}#mc-root .mc-all:hover{border-color:var(--mbu-accent)}'
        + '.mc-line.mc-in{padding-left:28px}.mc-bchint{padding:6px 10px;font-size:11px;color:var(--mbu-text-dim);background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-divider)}'
        + '#mc-root .mc-sect-h .mc-icsw{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;min-width:0;cursor:pointer;padding:3px 8px 3px 3px;margin:-3px -8px -3px -3px;border-radius:8px;transition:background .12s}#mc-root .mc-icsw .ic{position:relative}'
        + '#mc-root .mc-sect-h .mc-icsw:hover{background:var(--mbu-bg-hover)}#mc-root .mc-sect-h .mc-icsw:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}'
        + '.mc-sect.mc-off .mc-icsw .ic{background:var(--mbu-bg-sunken)}.mc-sect.mc-off .mc-icsw .ic.img{background:none}.mc-sect.mc-off .mc-icsw .ic>*{filter:grayscale(1);opacity:.55}.mc-sect.mc-off .mc-icsw .t{opacity:.45}'
        + '.mc-sect.mc-off>:not(.mc-sect-h){display:none}.mc-sect.mc-off .mc-sect-h{border-bottom:0}.mc-sect.mc-off .mc-sect-h>:not(.mc-icsw){opacity:.45}.mc-bc.none{--bc:var(--mbu-text-weak);border-style:dashed;background:none}.mc-bcl .mc-bc{display:inline-grid;justify-items:center}.mc-bcl .mc-bc>*{grid-area:1/1;font:inherit}.mc-bcl .mc-bc>i{visibility:hidden}.mc-line:last-child{border-bottom:0}'
        + '.mc-sect-h .end{margin-left:auto;display:flex;align-items:center;gap:6px}.mc-chlbl{font-size:13px;font-weight:700;color:var(--mbu-text)}'
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
        + '.mc-tbl .mc-lnk{display:inline-flex;align-items:center;gap:1px;margin:0;padding:1px 4px;font-weight:700;color:var(--mbu-accent-text)}.mc-tbl .mc-lnk:not(.on){opacity:.45}'
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
        + '.mc-row2{display:flex;gap:10px;align-items:flex-start}.mc-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:10px}.mc-col>.mc-sect{margin:0}'
        + '.mc-tbl{width:100%;border-collapse:collapse;font-size:12px}'
        + '.mc-tbl th{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--mbu-text-weak);text-align:left;padding:6px 8px;background:var(--mbu-bg-raised);border-bottom:1px solid var(--mbu-border);position:sticky;top:0;white-space:nowrap}'
        + '.mc-tbl td{padding:4px 8px;border-bottom:1px solid var(--mbu-divider);white-space:nowrap}'
        + '.mc-tbl td.n{color:var(--mbu-text-weak);font-family:var(--mbu-font-mono);width:32px}'
        + '.mc-tbl td.ttl{white-space:normal}'
        + '.mc-tbl td.pend{color:var(--mbu-border-strong)}'
        + '.mc-tbl tbody tr{cursor:pointer}.mc-tbl tbody tr:hover td{background:var(--mbu-bg-hover)}.mc-tbl tbody tr.sel td{background:color-mix(in srgb, var(--mbu-accent) 22%, var(--mbu-bg))}.mc-tbl tbody tr.sel td:first-child{box-shadow:inset 3px 0 0 var(--mbu-accent)}'
        + '.mc-tbl tr.med td{background:var(--mbu-bg-raised);font-size:10.5px;font-weight:700;color:var(--mbu-text-weak);cursor:default}'
        + '.mc-mode{font-size:9.5px;font-weight:700;padding:0 6px;border-radius:20px;border:1px dashed var(--mbu-border-strong);color:var(--mbu-text-weak);margin-left:4px;text-transform:none;letter-spacing:0}'
        + '.mc-mini{display:flex;align-items:center;gap:6px;font-size:11.5px;padding:3px 0;border-bottom:1px solid var(--mbu-divider)}.mc-mini:last-child{border-bottom:0}'
        + '.mc-mini .n{margin-left:auto;font-family:var(--mbu-font-mono);font-size:10.5px;color:var(--mbu-text-dim);white-space:nowrap;flex:none;padding-left:6px}.mc-mini a:not(.n){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
        + '.mc-insp-block{margin-bottom:12px}'
        + '.mc-fxo{display:inline-flex;align-items:center;gap:4px;font:inherit;font-size:11px;font-weight:700;padding:1px 8px;border-radius:20px;cursor:pointer;color:var(--mbu-warn);background:var(--mbu-warn-bg);border:1px solid var(--mbu-warn-border)}'
        + '.mc-fxo:hover{border-color:var(--mbu-warn)}.mc-fxp{font-size:11px;font-weight:700;color:var(--mbu-warn);text-decoration:none}.mc-fxp:hover{text-decoration:underline}'
        + '.mc-fxo .car{display:inline-block;transition:transform .15s}.mc-fxo[aria-expanded="true"] .car{transform:rotate(90deg)}'
        + '.mc-tbl tr.mc-fxd{cursor:default}.mc-tbl tr.mc-fxd>td,.mc-tbl tr.mc-fxd:hover>td{background:var(--mbu-bg-sunken);white-space:normal;padding:10px 12px 12px 40px}'
        + '.mc-fxh{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:8px;font-size:11.5px}.mc-fxh .sp{flex:1}'
        + '.mc-fxc{font-size:11px;border-radius:5px;padding:1px 7px;border:1px solid var(--mbu-border);color:var(--mbu-text-weak);background:var(--mbu-bg)}'
        + '.mc-fxc.on{background:var(--mbu-ok-bg);color:var(--mbu-ok);border-color:var(--mbu-ok-border);font-weight:700}.mc-fxc.some{color:var(--mbu-ok);border-color:var(--mbu-ok-border)}.mc-fxc.unk{border-style:dashed}'
        + '.mc-fxt{font-size:11px;font-weight:700;border-radius:5px;padding:0 7px;border:1px solid var(--mbu-border);color:var(--mbu-text-weak);font-family:var(--mbu-font)}'
        + '.mc-fxt.strict{color:var(--mbu-ok);background:var(--mbu-ok-bg);border-color:var(--mbu-ok-border)}.mc-fxt.normal{color:var(--mbu-info);background:var(--mbu-info-bg);border-color:var(--mbu-info-border)}.mc-fxt.loose{color:var(--mbu-warn);background:var(--mbu-warn-bg);border-color:var(--mbu-warn-border)}'
        + '.mc-fxwrap{overflow-x:auto}.mc-fxtbl{border-collapse:collapse;background:var(--mbu-bg);border:1px solid var(--mbu-border);font-size:12px}'
        + '.mc-tbl .mc-fxtbl th{position:static;background:var(--mbu-bg-raised)}.mc-tbl .mc-fxtbl tr,.mc-tbl .mc-fxtbl tr:hover td{cursor:default;background:var(--mbu-bg)}'
        + '.mc-tbl .mc-fxtbl td{padding:5px 8px;vertical-align:top;background:var(--mbu-bg)}.mc-tbl .mc-fxtbl tr:last-child td{border-bottom:0}'
        + '.mc-fxtbl .who{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--mbu-text-weak)}'
        + '.mc-fxdiff{background:var(--mbu-warn-bg);color:var(--mbu-warn);border-radius:4px;padding:0 4px}.mc-fxs::after{content:" ✓";color:var(--mbu-ok)}'
        + '.mc-fxn{margin-top:6px;font-size:11.5px;color:var(--mbu-text-weak)}'
        + '.mc-fxm{border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:2px 8px 6px;margin:6px 0;background:var(--mbu-bg-raised)}'
        + '.mc-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:1px 10px;font-size:11.5px}.mc-kv>span:nth-child(odd){color:var(--mbu-text-weak)}'
        + '@media (prefers-reduced-motion:reduce){.mc-fxo .car{transition:none}}'
        + '.mc-cfg label{display:flex;align-items:center;gap:10px;margin:8px 0;font-size:13px}.mc-cfg label span{min-width:150px}';
    document.head.appendChild(s);
}

function modeOf(p) { return p.mode ? S[p.mode] : 'auto'; }
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
function countNew(id) { const r = results[id]; return r && r.findings ? r.findings.filter(x => x.state === 'new' && x.role !== 'searched').length : 0; }
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
function paintAll() { if (!ui) return; paintBadges(); paintCards(); paintReleaseCredits(); fitCards(); paintMatrix(); paintInspector(); paintExec(); }

function header() {
    const h = el('header', 'mc-hdr');
    h.addEventListener('animationiteration', e => { if (e.target === h && e.pseudoElement === '::after' && !isBusy()) h.classList.remove('mc-busy'); });
    // #680: the release where Probe was (the cover is the one in the Cover art card), the steps, then
    // Execute with its count; logo, version and Auto probe live in ⚙
    h.innerHTML = mbuHtml('<div class="mc-rel"><div class="mc-ttl" title="' + esc(rel.title) + '">' + esc(rel.title) + '</div>'
        + '<div class="mc-art" title="' + esc(rel.artist) + '">' + esc(rel.artist || '') + '</div></div>'
        + '<div class="mc-act"><button type="button" class="mc-btn mc-exec" data-act="exec" disabled title="Apply the ticked changes, step by step">Execute</button>'
        + '<button type="button" class="mc-btn ghost" data-act="cfg" title="Settings">' + MBU_CFG_ICON + '</button>'
        + '<button type="button" class="mc-btn ghost" data-act="close" title="Close (Esc)">✕</button></div>');
    h.insertBefore(steps(), h.querySelector('.mc-act'));
    return h;
}

function seg(p) {
    return '<div class="mc-seg" data-mode="' + p.mode + '" title="Auto: fetch during Probe · Ask: fetch on a button · Off: skip">'
        + ['auto', 'ask', 'off'].map(m => '<button type="button" data-v="' + m + '"' + (S[p.mode] === m ? ' class="on"' : '') + '>' + m[0].toUpperCase() + m.slice(1) + '</button>').join('') + '</div>';
}

function orderSidebar() {
    const a = el('aside', 'mc-side left');
    let html = '<h2 class="mc-sec">Execution order <button type="button" class="mc-x" data-close="left" title="Hide">×</button></h2>';
    for (const s of STEPS) {
        if (s.lanes) {
            html += '<div class="mc-stage"><span class="mc-node"></span><div class="nm">' + esc(s.name) + '</div><div class="mc-par"><div class="lbl">⇶ parallel</div>'
                + s.lanes.map(l => '<div class="mc-lane" data-p="' + l.id + '"><span class="mc-dot"></span>' + sIcon(l.id) + esc(l.provider) + '</div>').join('') + '</div></div>';
        } else {
            html += '<div class="mc-stage' + (modeOf(s) === 'off' ? ' off' : '') + '" data-p="' + s.id + '"><span class="mc-node' + (s.mode ? ' opt' : '') + '">' + sIcon(s.id) + '</span>'
                + '<div class="nm">' + esc(s.name) + (s.info ? ' <span class="mc-mode">info</span>' : '') + '</div>'
                + '<div class="meta">' + esc(s.provider) + ' · <span class="st"></span></div>' + (s.mode ? seg(s) : '') + '</div>';
        }
    }
    a.innerHTML = mbuHtml(html);
    return a;
}

// a provider's own userscript icon (#680: in the execution order, not a glyph)
function sIcon(id) { return PROVIDER_ICONS[id] ? '<img class="mc-sic" alt="" src="' + PROVIDER_ICONS[id] + '">' : ''; }
// C (#680): the execution order as a stepper under the header, a ring per provider and what it
// is doing in words: the step it is on and for how long, amber when no word came for STALL_MS
// (what is stuck), or what it found. ↻ probes again; a click elsewhere on them shows or hides the
// order sidebar.
let STALL_MS = 20000;
function steps() {
    const d = el('div', 'mc-steps');
    d.title = 'Click to show or hide the execution order and its switches';
    const node = p => '<span class="mc-step" data-step="' + p.id + '"><span class="mc-ring">' + sIcon(p.id) + '<sup hidden></sup></span><span class="tx"><b>' + esc(p.short) + '</b><i></i></span></span>';
    d.innerHTML = mbuHtml('<button type="button" class="mc-re" data-act="probe" title="Probe: ask every provider what is missing (⚙: probe on open)">↻</button>'
        + STEPS.map(s => s.lanes ? '<span class="mc-par" title="run in parallel">' + s.lanes.map(node).join('') + '</span>' : node(s)).join('<span class="mc-arrow">→</span>'));
    return d;
}
function addText(p) {
    const xs = ((results[p.id] || {}).findings || []).filter(x => x.state === 'new' && x.role !== 'searched');
    const n = (k, w) => k + ' ' + w + (k === 1 ? '' : 's');
    if (p.id === 'is') { const l = xs.filter(x => x.kind === 'link').length, i = xs.length - l; return [i && n(i, 'ISRC'), l && n(l, 'link')].filter(Boolean).join(' · ') + ' to add'; }
    if (p.id === 'pc') return n(xs.length, 'link') + ' to add';
    if (p.id === 'as' && xs.some(x => x.role === 'best')) return '1 cover to enter';
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
        n.title = p.provider + ' — ' + (cls === 'busy' || cls === 'stalled' ? words : stateText(p));
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
        x.state === 'new' ? '<span class="mc-add mono">+ ' + esc(x.isrc) + '</span>'
        : x.state === 'unsure' ? '<span class="mc-warn mono" title="' + esc(x.why || '') + '">+ ' + esc(x.isrc) + ' ⚠</span>'
        // a provider's hard stop (#680: an ISRC on two recordings): shown, never tickable
        : x.state === 'blocked' ? '<span class="mc-err mono" title="' + esc('Blocked: ' + (x.why || '')) + '">⊘ ' + esc(x.isrc) + '</span>'
        : x.state === 'linked' ? '<span class="weak mono" title="' + esc((x.existing || []).join(', ')) + '">' + esc((x.existing || [])[0] || x.isrc || '') + ((x.existing || []).length > 1 ? ' +' + (x.existing.length - 1) : '') + '</span>'
        : '<span class="pend">none found</span>' },
    // rendered by linksCell: IS's linked icons plus the links Find links found (#680)
    { id: 'links', p: 'is', head: 'Rec links · IS', cell: () => '' },
    // the count (fxPill, before the cell) opens Fusion's comparison under the row; the release names are the tick
    { id: 'fusion', p: 'fusion', head: 'RG duplicates · Fusion', pick: true, cell: x =>
        FX_SHOWN[x.state] ? '<span class="weak">' + esc(fxReleases(x)) + '</span>'
        // as Fusion's pool badge: this recording has an open edit, so Fusion groups it with nothing
        : x.pending ? '<a class="mc-fxp" target="_blank" href="/recording/' + esc(x.key) + '/open_edits" title="This recording has an open edit: Fusion leaves it out of auto-match until the edit closes">⏳ pending</a>'
        : '<span class="pend">—</span>' },
    { id: 'ch', p: 'ch', head: 'Credits · CH', cell: x =>
        x.credits ? '<span title="' + esc((x.list || []).map(c => c.name + ' — ' + c.role).join('\n')) + '">' + x.credits + '</span>' : '<span class="pend">—</span>' },
];
const FETCH_LABEL = { fusion: 'Fetch RG', ch: 'Fetch credits' };
function colHead(c) {
    const p = PROVIDERS.find(x => x.id === c.p);
    if (!p.mode) return esc(c.head);
    const r = results[p.id];
    const ask = S[p.mode] === 'ask' && found[p.id] && (!r || r.state !== 'busy');
    return esc(c.head) + (ask && FETCH_LABEL[p.id] ? ' <button type="button" class="mc-fetch" data-fetch="' + p.id + '" title="Run this slow fetch now">' + (r ? '↻ ' : '') + FETCH_LABEL[p.id] + '</button>'
        : '<span class="mc-mode">' + S[p.mode] + '</span>');
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
function linksCell(t) {
    const x = trackFinding('is', t.rec), add = trackLinks(t.rec);
    const have = (x && x.linkUrls || []).map(u => '<a class="mc-pico mc-have" target="_blank" rel="noopener" href="' + esc(u) + '" title="' + esc('Linked: ' + u) + '">' + stIcon(urlIcon(u), 14) + '</a>');
    const neu = add.map(l => {
        const on = picked.is && picked.is.has(l.key);
        return '<span class="mc-pick mc-lnk' + (on ? ' on' : '') + '" data-prov="is" data-key="' + esc(l.key) + '" title="' + esc(l.name + ': ' + l.url + (on ? '\nTaken in: click to leave out' : '\nClick to take in')) + '">+' + stIcon(urlIcon(l.url), 14) + '</span>';
    });
    if (!have.length && !neu.length) return '<span class="pend">none</span>';
    return '<span class="mc-icons">' + have.join('') + (have.length && neu.length ? '<span class="mc-isep"></span>' : '') + neu.join('') + '</span>';
}
const PICKABLE = { new: 1, withheld: 1, unsure: 1 };
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
    return lead + '<span class="mc-pick' + (on ? ' on' : '') + '" data-prov="' + p.id + '" data-key="' + esc(x.key) + '" title="' + (on ? 'Taken in: click to leave out' : 'Click to take in') + '">' + c.cell(x) + '</span>';
}

// Fusion's comparison (#680), the way a Fusion group shows it: the track's recording and each
// match, with artist, release and track, length, ISRCs, AcoustIDs and open edits, what differs
// marked, and the signal chips. A chip is lit when every pair agrees (Fusion's signalsAll), half
// lit when some do, dashed when it wasn't looked up; Check asks Fusion to look up the group's.
const FX_SHOWN = { new: 1 };
const FX_SIGNALS = [['isrc', 'ISRC'], ['acoustid', 'AcoustID'], ['length', 'Length'], ['title', 'Title'], ['artist', 'Artist']];
const FX_TIER = { strict: 'holds at the strict cutoff: ISRC or AcoustID', normal: 'holds at the normal cutoff: title and artist, with the length', loose: 'holds only at the loose cutoff: title with the artist or the length', manual: 'no cutoff forms it' };
const fxReleases = x => (x.matches || []).map(m => m.release || '').filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 2).join(', ');
const fxRel = m => (m.release || '?') + (m.pos ? ' · ' + m.pos + (m.of ? '/' + m.of : '') : '') + (m.more ? ' +' + m.more : '');
const fxLenDiff = (me, m) => {
    const d = me && me.ms != null && m.ms != null ? Math.round((m.ms - me.ms) / 1000) : 0;
    return d ? ' <span class="mc-fxdiff">' + (d > 0 ? '+' : '−') + Math.abs(d) + 's</span>' : '';
};
const fxCan = cap => !!(found.fusion && (found.fusion.capabilities || []).includes(cap));
const fxOpenBtn = x => fxCan('open') ? '<button type="button" class="mc-btn primary" data-act="fx-fusion" data-key="' + esc(x.key) + '" title="Open Fusion\'s window with this group on the board">Open in Fusion</button>' : '';
function fxPill(x) {
    if (!FX_SHOWN[x.state]) return '';
    const open = fxOpen.has(x.key), n = (x.matches || []).length;
    return '<button type="button" class="mc-fxo" data-act="fx" data-key="' + esc(x.key) + '" aria-expanded="' + open + '" title="' + (open ? 'Hide' : 'Show') + ' what Fusion compared">'
        + '<span class="car">▸</span>' + n + ' match' + (n === 1 ? '' : 'es') + '</button> ';
}
function fxDetail(x) {
    const me = x.self || null, ck = x.checked || {}, all = x.signals || [], any = x.any || [];
    const need = [!ck.isrc && 'ISRC', !ck.acoustid && 'AcoustID'].filter(Boolean);
    const chips = FX_SIGNALS.map(([k, label]) => {
        const lit = all.includes(k), some = !lit && any.includes(k), unk = !lit && !some && ((k === 'isrc' && !ck.isrc) || (k === 'acoustid' && !ck.acoustid));
        const tip = lit ? 'Every pair in the group agrees' : some ? 'Some pairs agree, not every one' : unk ? 'Not looked up yet: Check does' : 'No pair agrees';
        return '<span class="mc-fxc' + (lit ? ' on' : some ? ' some' : unk ? ' unk' : '') + '" title="' + tip + '">' + label + (unk ? ' ?' : '') + '</span>';
    }).join('');
    const ids = (list, mine, known, short) => list == null || (!known && !list.length) ? '<span class="weak">not checked</span>'
        : list.map(v => '<span' + (mine && mine.includes(v) ? ' class="mc-fxs"' : '') + ' title="' + esc(v) + '">' + esc(short ? v.slice(0, 8) + '…' : v) + '</span>').join('<br>') || '<span class="weak">none</span>';
    const row = (who, m, other) => {
        const diff = (a, b, v) => other && a !== b ? '<span class="mc-fxdiff">' + v + '</span>' : v;
        return '<tr><td class="who">' + who + '</td>'
            + '<td><a target="_blank" href="/recording/' + esc(m.gid) + '">' + diff(m.title, me && me.title, esc(m.title || '?')) + '</a> <span class="mono weak">' + esc((m.gid || '').slice(0, 8)) + '</span></td>'
            + '<td>' + diff(m.artist, me && me.artist, esc(m.artist || '?')) + '</td>'
            + '<td>' + esc(fxRel(m)) + '</td>'
            + '<td class="mono">' + esc(m.len || '?') + (other ? fxLenDiff(me, m) : '') + '</td>'
            + '<td class="mono">' + ids(m.isrcs, other && me && me.isrcs, ck.isrc) + '</td>'
            + '<td class="mono">' + ids(m.acoustids, other && me && me.acoustids, ck.acoustid, true) + '</td>'
            + '<td>' + (m.pending ? '<a class="mc-err" target="_blank" href="/recording/' + esc(m.gid) + '/open_edits">open edit</a>' : '<span class="weak">none</span>') + '</td></tr>';
    };
    const busy = fxBusy.has(x.key);
    return '<div class="mc-fxh">' + (x.tier ? '<span class="mc-fxt ' + esc(x.tier) + '" title="' + esc('Fusion\'s tier: the group ' + (FX_TIER[x.tier] || '')) + '">' + esc(x.tier) + '</span>' : '')
        + '<span class="weak">matched on</span>' + chips + '<span class="sp"></span>'
        + (need.length && fxCan('check') ? '<button type="button" class="mc-btn" data-act="fx-check" data-key="' + esc(x.key) + '"' + (busy ? ' disabled' : '') + ' title="Look these up for this group\'s recordings only">' + (busy ? 'Checking…' : 'Check ' + need.join(' & ')) + '</button>' : '')
        + fxOpenBtn(x) + '</div>'
        + '<div class="mc-fxwrap"><table class="mc-fxtbl"><thead><tr><th></th><th>Recording</th><th>Artist</th><th>Release · track</th><th>Length</th><th>ISRCs</th><th>AcoustID</th><th>Edits</th></tr></thead><tbody>'
        + (me ? row('this', me, false) : '') + (x.matches || []).map(m => row('match', m, !!me)).join('') + '</tbody></table></div>'
        + (x.cutoff ? '<div class="mc-fxn">Matched at Fusion\'s <b>' + esc(x.cutoff) + '</b> cutoff, the one set in Fusion\'s window.</div>' : '');
}
function fxAct(b) {
    const k = b.dataset.key;
    if (b.dataset.act === 'fx') { if (fxOpen.has(k)) fxOpen.delete(k); else fxOpen.add(k); paintMatrix(); return; }
    if (b.dataset.act === 'fx-check') {
        fxBusy.add(k); paintMatrix();
        Log.info('asking Fusion to check the group of ' + k);
        document.dispatchEvent(new CustomEvent('mc:check', { detail: JSON.stringify({ id: 'fusion', run, release: RELEASE, key: k }) }));
        setTimeout(() => { if (fxBusy.delete(k)) { mbuToast('Fusion did not answer the check'); paintMatrix(); } }, 120000);
        return;
    }
    if (b.dataset.act === 'fx-fusion') {
        Log.info('opening the group of ' + k + ' in Fusion');
        document.dispatchEvent(new CustomEvent('mc:open', { detail: JSON.stringify({ id: 'fusion', release: RELEASE, key: k }) }));
    }
}
function paintMatrix() {
    ui.querySelectorAll('.mc-tbl th[data-colh]').forEach(th => { th.innerHTML = mbuHtml(colHead(COLS.find(c => c.id === th.dataset.colh))); });
    // track-level providers have no card: their apply outcome goes in the Tracks header
    const slot = ui.querySelector('.mc-tapplied');
    if (slot) slot.innerHTML = mbuHtml(COLS.map(c => c.p).filter((p, i, a) => a.indexOf(p) === i).map(p => results[p] && results[p].applied)
        .filter(Boolean).map(a => '<span class="mc-applied ' + (a.ok ? 'ok' : 'err') + '" title="' + esc(a.id) + '">' + (a.ok ? '✓ ' : '✕ ') + esc(PROVIDERS.find(x => x.id === a.id).short + ': ' + (a.note || '')) + '</span>').join(''));
    ui.querySelectorAll('.mc-tbl tbody tr[data-i]').forEach(tr => {
        const t = rel.tracks[+tr.dataset.i];
        tr.querySelectorAll('td[data-col]').forEach(td => { td.innerHTML = mbuHtml(cellHtml(COLS.find(c => c.id === td.dataset.col), t)); });
    });
    ui.querySelectorAll('.mc-tbl tr.mc-fxd').forEach(tr => {
        const t = rel.tracks[+tr.dataset.fx], x = S.fusion !== 'off' && t ? trackFinding('fusion', t.rec) : null;
        const show = !!(x && FX_SHOWN[x.state] && fxOpen.has(x.key));
        tr.hidden = !show;
        tr.firstElementChild.innerHTML = mbuHtml(show ? fxDetail(x) : '');
    });
}
function matrix() {
    const sec = el('section', 'mc-sect');
    sec.dataset.sect = 'tracks';
    const cols = COLS.filter(c => modeOf(PROVIDERS.find(p => p.id === c.p)) !== 'off');
    let html = '<div class="mc-sect-h">' + cardTitle('tracks', '≡', 'Tracks') + '<span class="p">one row per track · a column per provider</span><span class="end mc-tapplied"></span></div>'
        + '<table class="mc-tbl"><thead><tr><th>#</th><th>Title</th><th>Len</th>'
        + cols.map(c => '<th data-colh="' + c.id + '">' + colHead(c) + '</th>').join('')
        + '</tr></thead><tbody>';
    let lastMed = 0;
    rel.tracks.forEach((t, i) => {
        if (rel.media > 1 && t.medium !== lastMed) { lastMed = t.medium; html += '<tr class="med"><td colspan="' + (3 + cols.length) + '">Medium ' + t.medium + '</td></tr>'; }
        html += '<tr data-i="' + i + '"' + (selected === i ? ' class="sel"' : '') + '><td class="n">' + esc(t.pos) + '</td><td class="ttl">' + esc(t.title) + '</td><td class="mono">' + esc(t.len) + '</td>'
            + cols.map(c => '<td data-col="' + c.id + '"></td>').join('') + '</tr>'
            + '<tr class="mc-fxd" data-fx="' + i + '" hidden><td colspan="' + (3 + cols.length) + '"></td></tr>';
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
    if (S.ch !== 'off') row.append(releaseCredits());
    row._cards = [...row.children];
    let w = 0;
    new ResizeObserver(() => { if (row.clientWidth !== w) { w = row.clientWidth; layoutCards(row); } }).observe(row);
    return row;
}
function fitCards() {
    const row = ui && ui.querySelector('.mc-row2'); if (!row) return;
    row._cards.forEach(s => {
        const id = s.querySelector('[data-card]') ? s.querySelector('[data-card]').dataset.card : 'ch';
        s.hidden = stateOf(PROVIDERS.find(x => x.id === id)) === 'idle';
    });
    paintOnOff();
    row.hidden = row._cards.every(s => s.hidden);
    layoutCards(row);
}
const CARD_MIN = 520, CARD_GAP = 10;
function layoutCards(row) {
    if (row.hidden || !row.clientWidth) return;
    const shown = row._cards.filter(s => !s.hidden);
    const n = Math.max(1, Math.min(shown.length, Math.floor((row.clientWidth + CARD_GAP) / (CARD_MIN + CARD_GAP))));
    let cols = [...row.children].filter(c => c.classList.contains('mc-col'));
    while (cols.length < n) { const c = el('div', 'mc-col'); row.append(c); cols.push(c); }
    // heights as they are now; a card that changes column changes width, and the next paint settles it
    const tall = new Map(shown.map(s => [s, s.offsetHeight])), used = cols.slice(0, n).map(() => 0);
    shown.forEach(s => {
        const k = used.indexOf(Math.min(...used));
        if (s.parentNode !== cols[k]) cols[k].append(s);
        used[k] += tall.get(s) + CARD_GAP;
    });
    // a hidden card stays in a column, out of the way; empty columns go
    row._cards.filter(s => s.hidden && !s.parentNode.classList.contains('mc-col')).forEach(s => cols[0].append(s));
    cols.slice(n).forEach(c => { [...c.children].forEach(s => cols[0].append(s)); c.remove(); });
    // the cards keep their reading order within a column
    cols.slice(0, n).forEach(c => row._cards.forEach(s => { if (s.parentNode === c) c.append(s); }));
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
    const openHtml = open.length ? '<span class="mc-chlbl">Import credits:</span>' + open.map(o => '<a class="mc-btn mc-chsrc' + (o.icon ? '' : ' mc-chall') + '" href="' + esc(o.url) + '" title="' + esc(o.title || o.label) + '" aria-label="' + esc(o.label) + '">'
        + (o.icon ? stIcon(o.icon, 14) : '<b>⚛</b>' + esc(o.label)) + '</a>').join('') : '';
    if (slot && slot._mcHtml !== openHtml) { slot._mcHtml = openHtml; slot.innerHTML = mbuHtml(openHtml); }
    if (!r || r.state !== 'done') { box.innerHTML = mbuHtml('<div class="mc-empty">Credit Hoarder: ' + esc(stateText(p)) + (r ? '' : '. Fetch credits fills this in.') + '</div>'); return; }
    const x = (r.findings || []).find(f => !f.track);
    if (!x) { box.innerHTML = mbuHtml('<div class="mc-empty">' + esc(r.summary ? r.summary + '. ' : '') + 'No release-level credits in the source.</div>'); return; }
    box.innerHTML = mbuHtml('<div class="mc-summary">' + esc(x.source || '') + ': ' + x.list.length + ' credit' + (x.list.length === 1 ? '' : 's') + ' on the release</div>'
        + '<div style="padding:4px 10px 8px">' + x.list.map(c => '<div class="mc-mini">' + esc(c.name) + '<span class="n">' + esc(c.role) + '</span></div>').join('') + '</div>');
}

// A provider's release-level findings: one row each; ticked rows go to Execute.
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
    return '<button type="button" class="mc-linked' + (open ? ' on' : '') + '" data-act="linked" data-lk="' + esc(k) + '" title="'
        + esc('Already linked: ' + linked.map(nm).join(', ') + (open ? '. Click to fold them back.' : '. Click to list them as rows.')) + '">'
        + [...by].map(([k, xs]) => '<span class="mc-pico' + (xs[0].entity ? ' mc-ent' : '') + '" title="' + esc(xs.map(nm).join(', ')) + '">' + stIcon(k, 14) + (xs.length > 1 ? '<sub>' + xs.length + '</sub>' : '') + '</span>').join('')
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
        const ap = (r.applied ? '<div class="mc-applied ' + (r.applied.ok ? 'ok' : 'err') + '">' + (r.applied.ok ? '✓ ' : '✕ ') + esc(r.applied.note || (r.applied.ok ? 'done' : 'failed')) + '</div>' : '')
            + (r.working ? '<div class="mc-working"><span class="mc-spin"></span>' + esc(r.working) + '</div>' : '') + falconHtml(r.falcon) + bestHtml(r.best);
        // 'not found' is one line of icons, not a row each: it's most of the list and needs no action.
        // 'linked' needs none either: icons on their section's sub-heading (Release, Artists, Labels),
        // so the rows that need a decision lead; clicking them lists them as rows instead, each section on its own (S.linkedOpen).
        const linked = r.findings.filter(x => x.state === 'linked');
        // PC's card is in sections, each with its own linked icons; another card's are in its header
        const pc = id === 'pc';
        const lkKey = x => pc ? 'pc:' + (isEnt(x) ? x.entity.type : 'release') : id;
        const rows = r.findings.filter(x => x.state !== 'none' && (x.state !== 'linked' || linkedOpen(lkKey(x)))).sort((a, b) => ORDER[a.state] - ORDER[b.state]);
        const none = r.findings.filter(x => x.state === 'none');
        const slot = box.parentNode.querySelector('.mc-sect-h .end');
        if (slot) slot.innerHTML = mbuHtml(pc ? '' : linkedBtn(linked, id));
        // the row is the toggle, no tick box (#680); a taken-in row is tinted and marked ✓
        // PC's barcodes (#680): the release's links grouped by barcode, a lane each (leading zeros
        // aside, as PC compares them): the release's own first, in green, then the others by size,
        // then the platforms that gave none. A lane is one line: its platforms as icons that toggle
        // one by one, and take all in; ▸ opens it into rows.
        const bcNorm = b => String(b || '').replace(/\D/g, '').replace(/^0+/, '');
        const line = (x, lane) => {
            const pick = !!PICKABLE[x.state];
            const on = pick && picked[id] && picked[id].has(x.key);
            const pill = x.role === 'searched' ? ['idle', 'searched'] : x.role === 'best' && x.state === 'new' ? ['add', 'enters'] : PILL[x.state] || ['idle', x.state];
            // in a lane, the barcode and its reason are on the lane: only a differently written barcode stays
            return '<div class="mc-line ' + esc(x.state) + (x.entity ? ' mc-ent' : '') + (lane ? ' mc-in' : '') + (pick ? ' mc-pick' : '') + (on ? ' on' : '') + '"'
                + (pick ? ' data-prov="' + id + '" data-key="' + esc(x.key) + '" title="' + (on ? 'Taken in: click to leave out' : 'Click to take in') + '"' : '') + '>'
                + '<span class="mc-tick">' + (on ? '✓' : '') + '</span>'
                + '<span class="mc-pico">' + stIcon(x.icon || x.key, 14) + '</span>'
                + '<div class="mc-lt"><div class="t">' + esc(x.name || x.key) + '</div>'
                + (x.url ? '<a class="s" target="_blank" rel="noopener" href="' + esc(x.url) + '" title="' + esc(x.url) + '">' + esc(shortUrl(x.url)) + '</a>' : '')
                + (x.why && !(lane && /barcode/.test(x.why)) ? '<div class="s">' + esc(x.why) + '</div>' : '') + '</div>'
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
            const laneRows = r.findings.filter(x => !x.entity && x.state !== 'none' && (x.state !== 'linked' || x.barcode || linkedOpen('pc:release'))).sort((a, b) => ORDER[a.state] - ORDER[b.state]);
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
            relHtml = order.map(l => {
                const open = laneOpen.has(l.k), picks = l.rows.filter(x => PICKABLE[x.state]), n = picks.filter(x => picked[id] && picked[id].has(x.key)).length;
                const states = [...new Set(l.rows.filter(x => x.state !== 'linked').map(x => x.state))].concat(l.rows.every(x => x.state === 'linked') ? ['linked'] : []), pill = states.length === 1 ? PILL[states[0]] || ['idle', states[0]] : null;
                // every chip as wide as a 13-digit barcode, the digits centred: the icons line up in every lane
                const chip = '<span class="mc-bc' + (l.k ? '' : ' none') + '"' + (l.k ? ' style="--bc:' + l.color + '"' : '') + ' title="' + esc(l.tip) + '"><i>0000000000000</i>' + (l.k ? '<b>' + bcShow(l.k) + '</b>' : '') + '</span>';
                const icons = l.rows.length ? l.rows.map(x => {
                    const pk = !!PICKABLE[x.state], on = pk && picked[id] && picked[id].has(x.key);
                    return '<span class="mc-ti ' + esc(x.state) + (pk ? ' mc-pick' : '') + (on ? ' on' : '') + '"' + (pk ? ' data-prov="' + id + '" data-key="' + esc(x.key) + '"' : '')
                        + ' title="' + esc((x.name || x.key) + (x.url ? ' — ' + x.url : '') + (x.why ? ' (' + x.why + ')' : '') + (x.state === 'linked' ? '. Already linked' : '') + (pk ? (on ? '. Taken in: click to leave out' : '. Click to take in') : '')) + '">' + stIcon(x.icon || x.key, 16) + '</span>';
                }).join('') : '<span class="mc-bcl-no">no platform found it</span>';
                const all = picks.length ? '<button type="button" class="mc-all" data-act="lane-all" data-lane="' + esc(l.k) + '" title="Take every link in this group in, or leave them all out">'
                    + (n === picks.length ? '✓ all taken in' : n ? n + ' of ' + picks.length + ' · take all' : 'take all in') + '</button>' : '<span></span>';
                return '<div class="mc-bcl' + (open ? ' open' : '') + (l.rows.length ? '' : ' empty') + '" data-act="lane" data-lane="' + esc(l.k) + '"' + (l.rows.length ? ' title="' + (open ? 'Fold into one line' : 'Open into rows') + '"' : '') + '>'
                    + '<span class="mc-tri">' + (l.rows.length ? (open ? '▾' : '▸') : '') + '</span>' + chip
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
        setCard(box, mbuHtml(sum + ap + sect('release', 'Release', rgRows.map(x => line(x)).join('') + relHtml + hint, linked.filter(x => !isEnt(x)))
            + entSect('artist', 'Artists') + entSect('label', 'Labels') + (none.length ? '<div class="mc-none" title="' + esc('Not found: ' + none.map(x => x.name || x.key).join(', ')) + '"><span>Not found</span>'
            + none.map(x => '<span class="mc-pico" title="' + esc(x.name || x.key) + '">' + stIcon(x.icon || x.key, 14) + '</span>').join('') + '</div>' : '')));
    });
}
const BC_COLORS = ['#2563eb', '#c2410c', '#9333ea', '#0e7490', '#be185d', '#a16207', '#4d7c0f', '#6d28d9'];
// AS's ticked rows are the pool its one cover comes from, so they count once, not once each
const isPool = id => ((results[id] || {}).findings || []).some(x => x.role === 'searched' || x.role === 'best');
function changeCount() { return Object.entries(picked).reduce((n, [id, set]) => n + (providerOff(id) ? 0 : isPool(id) ? Math.min(1, set.size) : set.size), 0); }
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
    const n = changeCount();
    ex.disabled = executing || !n;
    ex.textContent = executing ? 'Executing…' : n ? 'Execute (' + n + ')' : 'Execute';
}

function inspector() {
    const a = el('aside', 'mc-side right');
    a.innerHTML = mbuHtml('<h2 class="mc-sec"><span class="mc-insp-t">Inspector</span> <button type="button" class="mc-x" data-close="right" title="Hide">×</button></h2><div class="mc-insp"></div>');
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
    const isrcBody = x => (x.existing || []).map(i => mini('<span class="mono">' + esc(i) + '</span>', 'on MB')).join('')
        + (x.isrc && !(x.existing || []).includes(x.isrc) ? mini('<span class="mono mc-add">+ ' + esc(x.isrc) + '</span>', esc(x.source || '')) : '')
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
            + (m.isrcs ? '<span>ISRCs</span><span class="mono">' + (esc(m.isrcs.join(', ')) || 'none') + '</span>' : '')
            + '<span>edits</span><span>' + (m.pending ? '<span class="mc-err">open edit</span>' : 'none') + '</span></div></div>').join('')
        + (x.signals ? '<div class="weak" style="font-size:11px;margin:4px 0">every pair agrees on: ' + esc(x.signals.join(', ') || 'nothing') + '</div>' : '')
        + fxOpenBtn(x);
    // each credit names the sources that give it, when more than one source was read (#680)
    const chBody = x => (x.list || []).map(c => mini(esc(c.name), esc(c.role) + (c.sources && /,/.test(x.source || '') ? ' <span class="weak">· ' + esc(c.sources.join(', ')) + '</span>' : ''))).join('') || '<div class="weak" style="font-size:11.5px">no credits</div>';
    box.innerHTML = mbuHtml('<div class="mc-mini">Recording<a class="n" target="_blank" href="/recording/' + esc(t.rec) + '">' + esc((t.rec || '').slice(0, 8)) + '</a></div>'
        + '<div class="mc-mini">Length<span class="n">' + esc(t.len || '?') + '</span></div><div style="height:10px"></div>'
        + blk('ISRCs', 'is', isrcBody) + blk('Recording links', 'is', linksBody)
        + (S.fusion !== 'off' ? blk('Fusion matches', 'fusion', fusionBody) : '') + (S.ch !== 'off' ? blk('Credits', 'ch', chBody) : ''));
}


function paintBadges() {
    if (!ui) return;
    paintSteps();
    ui.querySelectorAll('[data-p]').forEach(n => {
        const p = PROVIDERS.find(x => x.id === n.dataset.p); if (!p) return;
        const dot = n.querySelector('.mc-dot'); if (dot) dot.className = 'mc-dot ' + stateOf(p);
        const st = n.querySelector('.st'); if (st) st.textContent = stateText(p);
    });
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
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.classList.add('mc-open');
    paintSides(); paintAll(); paintInspector();
    ui.addEventListener('click', onClick);
    // a cover thumbnail that fails falls back to its full image once (errors don't bubble: capture)
    ui.addEventListener('error', e => { const i = e.target; if (i.tagName === 'IMG' && i.dataset.alt) { const a = i.dataset.alt; delete i.dataset.alt; i.dataset.from = i.getAttribute('src'); i.src = a; } }, true);
    document.addEventListener('keydown', onKey);
    stepClock = setInterval(() => { if (isBusy()) paintSteps(); }, 1000);
    Log.info('opened · sidebars ' + (S.left ? 'order ' : '') + (S.right ? 'inspector' : '') + ' · fusion ' + S.fusion + ' · ch ' + S.ch + ' · auto probe ' + (S.autoProbe ? 'on' : 'off'));
    discover();
    // Auto: probe once the providers had discover's moment to answer
    if (S.autoProbe) setTimeout(() => { if (ui && !run) { Log.info('auto probe'); probe(); } }, 700);
}
let trackObs = null, trackT = 0;
function watchTracks() {
    const root = document.querySelector('#content') || document.body;
    trackObs = new MutationObserver(muts => {
        if (!ui || muts.every(m => ui.contains(m.target))) return;
        clearTimeout(trackT);
        trackT = setTimeout(() => {
            const n = document.querySelectorAll('#content table.medium tbody tr a[href*="/recording/"]').length;
            if (n === rel.tracks.length) return;
            Log.info('tracklist changed on the page: ' + rel.tracks.length + ' → ' + n + ' tracks, re-reading');
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
    document.removeEventListener('keydown', onKey);
    clearInterval(stepClock);
    Log.info('closed');
}
function onKey(e) {
    if (e.key !== 'Escape' || document.querySelector('.mbu-ov') || document.getElementById('mbu-logpop') || document.getElementById('mc-cover')) return;
    close();
}

function selectTrack(i) {
    selected = i;
    ui.querySelectorAll('.mc-tbl tr.sel').forEach(r => r.classList.remove('sel'));
    const row = ui.querySelector('.mc-tbl tbody tr[data-i="' + i + '"]');
    if (row) row.classList.add('sel');
    if (!S.right) { S.right = true; saveSettings(); paintSides(); }
    paintInspector();
    Log.debug('selected track ' + rel.tracks[selected].pos + ' (' + rel.tracks[selected].rec + ')');
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
        const row = fx.dataset.act === 'fx' && fx.closest('.mc-tbl tbody tr[data-i]');
        fxAct(fx);
        if (row) selectTrack(Number(row.dataset.i));   // the count also selects its track
        return;
    }
    // a pickable row or cell toggles on click (#680); a link inside it still just opens
    const pk = !t.closest('a') && t.closest('.mc-pick');
    if (pk) {
        const set = picked[pk.dataset.prov] || (picked[pk.dataset.prov] = new Set());
        const on = !set.has(pk.dataset.key);
        if (on) set.add(pk.dataset.key); else set.delete(pk.dataset.key);
        Log.debug((on ? 'taken in ' : 'left out ') + pk.dataset.prov + ' ' + pk.dataset.key);
        if (pk.closest('.mc-tbl')) paintMatrix(); else paintCards();
        paintExec();
        if (pk.dataset.prov === 'pc') syncIsLinks(700);
        if (!pk.closest('.mc-tbl')) return;   // in the matrix the click also selects the track
    }
    const row = t.closest('.mc-tbl tbody tr[data-i]');
    if (row && !t.closest('a')) { selectTrack(Number(row.dataset.i)); return; }
    const fetchBtn = t.closest('[data-fetch]');
    if (fetchBtn) { probeOne(fetchBtn.dataset.fetch); return; }
    const act = t.closest('[data-act]');
    if (!act && t.closest('.mc-steps')) { S.left = !S.left; saveSettings(); paintSides(); return; }
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
            const keys = r.findings.filter(x => !x.entity && PICKABLE[x.state] && norm(x.barcode) === k).map(x => x.key);
            const set = picked.pc || (picked.pc = new Set()), all = keys.every(x => set.has(x));
            keys.forEach(x => all ? set.delete(x) : set.add(x));
            Log.debug((all ? 'left out ' : 'taken in ') + 'pc lane ' + (k || '(no barcode)') + ': ' + keys.join(', '));
            paintCards(); paintExec(); syncIsLinks(700);
            break;
        }
        case 'falcon-open': document.dispatchEvent(new CustomEvent('falcon:show')); break;
        case 'card-onoff': setCardOff(act.dataset.sect, !cardOff(act.dataset.sect)); break;
        case 'cover': coverViewer(coverList(results.as && results.as.best), Number(act.dataset.i) || 0); break;
        case 'exec': execute(false); break;
        case 'cfg': settingsWindow(); break;
        case 'close': close(); break;
    }
}


function setMode(key, v) {
    if (S[key] === v) return;
    Log.info(key + ' mode ' + S[key] + ' → ' + v);
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
        b.title = off ? 'Left out: Execute skips this card. Click to take it in' : 'Click to leave this card out of Execute';
    });
}
function setCardOff(id, off) {
    if (off) OFF.add(id); else OFF.delete(id);
    Log.info('the ' + id + ' card is ' + (off ? 'off: Execute leaves it out' : 'on'));
    if (ui) { fitCards(); paintExec(); }
}
function settingsWindow() {
    const ov = el('div', 'mbu-ov');
    const panel = el('div', 'mbu-ov-panel mc-cfg');
    panel.style.width = 'min(460px, 94vw)';
    const chk = (key, label) => '<label><input type="checkbox" data-k="' + key + '"' + (S[key] ? ' checked' : '') + '>' + label + '</label>';
    panel.innerHTML = mbuHtml('<div class="mbu-ov-body">' + mbuCfgHeader({ script: 'mission_control', name: 'Mission Control', version: VERSION, icon: '<img src="' + ICON_URL + '" alt="">', log: true })
        + chk('autoProbe', 'Probe as soon as Mission Control opens')
        + chk('reloadAfter', 'Reload the release page after an Execute without errors')
        + '</div>');
    ov.appendChild(panel);
    document.body.appendChild(ov);
    const done = () => { ov.remove(); };
    mbuDismissOn(panel, done);
    panel.querySelector('.mbu-cfg-log').onclick = () => Log.open();
    panel.addEventListener('change', e => {
        const k = e.target.dataset.k; if (!k) return;
        S[k] = e.target.checked; saveSettings();
    });
}

/* ── launcher ──────────────────────────────────────────────────────────────── */

function launcher() {
    if (document.getElementById('mc-launch')) return;
    mcStyle();
    const b = el('button', 'mc-launch'); b.id = 'mc-launch'; b.type = 'button';
    const img = document.createElement('img'); img.src = ICON_URL; img.alt = ''; b.appendChild(img); b.title = 'Mission Control';
    b.dataset.mbCorner = 'br'; b.dataset.mbCornerOrder = '40';   // above Fusion
    b.onclick = () => open();
    document.body.appendChild(b);
    mbRestackCorner('br');
}

if (mbuTestHooks()) window.__mcTest = { open, close, execute, picked: () => Object.fromEntries(Object.entries(picked).map(([k, v]) => [k, Array.from(v)])), settings: () => Object.assign({}, S), off: () => [...OFF], found: () => Object.assign({}, found), release: () => rel, bestHtml, coverList, setStall: ms => { STALL_MS = ms; } };

// <ST-ICONS> — generated by dev/ui/sync-icons.mjs from dev/ui/platform-icons.mjs — DO NOT EDIT
const ST_ICONS = {"musicbrainz":{"color":"#eb743b","svg":"<svg viewBox=\"0.75 0.75 28.5 28.5\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(1.5)\"><path d=\"m13 1-12 7v14l12 7z\" fill=\"#ba478f\"/><path d=\"m14 1 12 7v14l-12 7z\" fill=\"#eb743b\"/></g></svg>"},"discogs":{"color":"#333333","svg":"<svg viewBox=\"71 71 882 882\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"translate(512 512) scale(0.86) translate(-512 -512)\"><circle cx=\"512\" cy=\"512\" r=\"496\" fill=\"#333\" stroke=\"#9a9a9a\" stroke-width=\"32\"/><path fill=\"#fff\" d=\"M439.84 511.58A72.58 72.58 0 0 1 512.41 439 72.54 72.54 0 0 1 585 511.58a72.56 72.56 0 0 1-72.57 72.56 72.56 72.56 0 0 1-72.57-72.56zm3.18 0A69.48 69.48 0 0 0 512.41 581a69.4 69.4 0 0 0 69.4-69.38 69.49 69.49 0 0 0-69.4-69.43A69.44 69.44 0 0 0 443 511.58zm69.42-11.44a11.43 11.43 0 1 0 11.47 11.45 11.45 11.45 0 0 0-11.48-11.45zm-131.08 11.43a130.68 130.68 0 0 0 40.3 94.43l24.68-26.69.33.3a94.59 94.59 0 0 1 113.08-149.95l17.51-31.95a130.23 130.23 0 0 0-64.82-17.22c-72.27.01-131.08 58.81-131.08 131.08zm225.73 0a94.6 94.6 0 0 1-138.64 83.79l-17.83 31.74a130.26 130.26 0 0 0 61.82 15.53c72.28 0 131.08-58.8 131.08-131.08a130.63 130.63 0 0 0-37.73-91.9L581 446.39a94.3 94.3 0 0 1 26.1 65.2zm-267.34 0a172.17 172.17 0 0 0 53.68 125l25-27.07a135.38 135.38 0 0 1-41.82-97.89c0-74.88 60.92-135.8 135.8-135.8a134.92 134.92 0 0 1 67.08 17.8l17.73-32.34a171.57 171.57 0 0 0-84.81-22.35c-95.19-.03-172.66 77.43-172.66 172.65zm308.49 0c0 74.88-60.92 135.8-135.8 135.8a135 135 0 0 1-64.14-16.14l-18.07 32.17a171.62 171.62 0 0 0 82.21 20.86c95.22 0 172.69-77.47 172.69-172.69a172.15 172.15 0 0 0-51-122.4l-25.12 27a135.35 135.35 0 0 1 39.23 95.4zm41.61 0c0 97.83-79.58 177.43-177.41 177.43a176.32 176.32 0 0 1-84.52-21.46l-18.18 32.36a213.21 213.21 0 0 0 102.7 26.23C630.74 726.11 727 629.87 727 511.57a213.87 213.87 0 0 0-64.38-153l-25.26 27.18a176.85 176.85 0 0 1 52.49 125.82zm-392 0A213.9 213.9 0 0 0 365 667.24L390.23 640A176.88 176.88 0 0 1 335 511.57c0-97.82 79.59-177.41 177.41-177.41a176.26 176.26 0 0 1 87.08 22.93l17.84-32.55A213.14 213.14 0 0 0 512.44 297c-118.3 0-214.54 96.28-214.54 214.57zm392.55-183-24.64 26.49a218.57 218.57 0 0 1 65.94 156.51c0 120.9-98.36 219.26-219.26 219.26a217.9 217.9 0 0 1-105-26.84l-18.24 32.47A255.43 255.43 0 0 0 512 768c141.39 0 256-114.64 256-256a255.23 255.23 0 0 0-77.55-183.41zm-397.27 183c0-120.9 98.36-219.26 219.26-219.26a217.84 217.84 0 0 1 107.19 28.09L637 288.65A254.46 254.46 0 0 0 516.12 256H512c-140.54.22-254.42 113.26-256 253.5v2.5a255.69 255.69 0 0 0 80.51 186.08l25.31-27.36a218.61 218.61 0 0 1-68.64-159.15z\"/></g></svg>"},"spotify":{"color":"#1DB954","svg":"<svg viewBox=\"1.25 1.375 21.25 21.25\" fill=\"#1DB954\"><path transform=\"translate(12 12) scale(.875) translate(-12 -12)\" d=\"M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z\"/></svg>"},"apple":{"color":"#FA243C","svg":"<svg viewBox=\"1.625 1.25 20 20\" fill=\"#FA243C\"><path d=\"M17.05 12.04c-.03-2.5 2.04-3.7 2.13-3.76-1.16-1.7-2.97-1.93-3.61-1.96-1.54-.16-3 .9-3.78.9-.78 0-1.97-.88-3.24-.86-1.67.03-3.21.97-4.07 2.46-1.73 3.01-.44 7.47 1.24 9.92.82 1.2 1.8 2.54 3.08 2.49 1.24-.05 1.71-.8 3.21-.8 1.5 0 1.92.8 3.23.77 1.33-.02 2.18-1.22 3-2.42.94-1.39 1.33-2.73 1.35-2.8-.03-.01-2.59-.99-2.62-3.93zM14.6 4.59c.68-.83 1.14-1.97 1.01-3.11-.98.04-2.17.65-2.87 1.47-.63.73-1.18 1.9-1.03 3.02 1.09.08 2.21-.55 2.89-1.38z\"/></svg>"},"deezer":{"color":"#A238FF","svg":"<svg viewBox=\"3 3 18 18\"><path transform=\"translate(12 12) scale(.74) translate(-12 -12)\" d=\"M4 2h6v2h-6zM14 2h6v2h-6zM2 4h20v2h-20zM0 6h24v2h-24zM0 8h24v2h-24zM0 10h24v2h-24zM2 12h20v2h-20zM4 14h16v2h-16zM6 16h12v2h-12zM8 18h8v2h-8zM10 20h4v2h-4z\" fill=\"#A238FF\"/></svg>"},"tidal":{"color":"#000000","svg":"<svg viewBox=\"3 3 18 18\"><path d=\"M6 6l3 3-3 3-3-3zM12 6l3 3-3 3-3-3zM18 6l3 3-3 3-3-3zM12 12l3 3-3 3-3-3z\" style=\"fill:var(--mbu-text,currentColor)\"/></svg>"},"qobuz":{"color":"#0070ef","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#0070ef\"/><circle cx=\"12\" cy=\"12\" r=\"5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.2\"/><path d=\"M14.5 14.5 19 19\" stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>"},"beatport":{"color":"#01FF95","svg":"<svg viewBox=\"0.75 0.75 22.5 22.5\"><circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"#000\"/><g transform=\"translate(12 12) scale(0.84) translate(-12 -12)\" fill=\"none\" stroke=\"#01FF95\" stroke-width=\"2.5\"><path d=\"M10.9 3V8.3c0 1.2-.4 1.9-1.1 2.6L5.6 15.1\"/><circle cx=\"13.9\" cy=\"15.8\" r=\"4.05\" stroke-width=\"2.35\"/></g></svg>"},"bandcamp":{"color":"#629AA9","svg":"<svg viewBox=\"2.25 2.25 19.5 19.5\" fill=\"#629AA9\"><path transform=\"translate(12 12) scale(.8) translate(-12 -12)\" d=\"M0 18.75l7.437-13.5H24l-7.438 13.5z\"/></svg>"},"volumo":{"color":"#7c4dff","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#7c4dff\"/><path d=\"M7 8h2.2l2.8 6 2.8-6H17l-4 9h-2z\" fill=\"#fff\"/></svg>"},"hdtracks":{"color":"#e63329","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#e63329\"/><path d=\"M5 7.5h1.7v3.1h2.6V7.5H11v8H9.3v-3.2H6.7v3.2H5zm7.2 0h2.9c2 0 3.4 1.6 3.4 4s-1.4 4-3.4 4h-2.9zm1.7 1.5v5h1.1c1.1 0 1.8-1 1.8-2.5s-.7-2.5-1.8-2.5z\" fill=\"#fff\"/></svg>"},"soundcloud":{"color":"#ff5500","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#ff5500\"/><g fill=\"#fff\"><rect x=\"6\" y=\"12\" width=\"1.4\" height=\"4\" rx=\".6\"/><rect x=\"8.5\" y=\"10\" width=\"1.4\" height=\"6\" rx=\".6\"/><rect x=\"11\" y=\"8.5\" width=\"1.4\" height=\"7.5\" rx=\".6\"/><rect x=\"13.5\" y=\"10.5\" width=\"1.4\" height=\"5.5\" rx=\".6\"/><rect x=\"16\" y=\"11.5\" width=\"1.4\" height=\"4.5\" rx=\".6\"/></g></svg>"},"audiomack":{"color":"#FFA200","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#FFA200\"/><path d=\"M5 13.5l2-2 1.6 2.4 2.2-5.4 2.4 6.6 2.2-4 1.6 2.4H19\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.6\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/></svg>"},"sevendigital":{"color":"#07606E","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#07606E\"/><path d=\"M7.8 6.8h8.4v1.9l-4.5 8.9H9.4l4.4-8.7h-6z\" fill=\"#fff\"/></svg>"},"ytmusic":{"color":"#FF0000","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#FF0000\"/><circle cx=\"12\" cy=\"12\" r=\"5.6\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.4\"/><path d=\"M10.4 9.5v5l4.2-2.5z\" fill=\"#fff\"/></svg>"},"amazonmusic":{"color":"#25D1DA","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#25D1DA\"/><path d=\"M5.8 11.2c3.5 3.2 8.9 3.5 12.4.9\" fill=\"none\" stroke=\"#0F1111\" stroke-width=\"1.9\" stroke-linecap=\"round\"/><path d=\"M15.5 10.7l3 1.3-.9 3.1\" fill=\"none\" stroke=\"#0F1111\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>"},"soundexchange":{"color":"#6f42c1","svg":"<svg viewBox=\"1.75 1.75 20.5 20.5\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#6f42c1\"/><path d=\"M6.5 12h1.3l1-3 1.6 6 1.6-9 1.6 12 1.4-6h1.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\"1.4\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/></svg>"},"globe":{"color":"#6f7d75","svg":"<svg viewBox=\"2 2 20 20\" fill=\"none\" stroke=\"#6f7d75\" stroke-width=\"1.8\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18\"/></svg>"}};
function stIcon(name, size) { var i = ST_ICONS[name]; if (!i) return ''; size = size || 16; return i.svg.replace(/<svg\b([^>]*)>/, function (m, a) { a = a.replace(/\s(?:width|height)="[^"]*"/g, ''); var ns = /\bxmlns=/.test(a) ? '' : ' xmlns="http://www.w3.org/2000/svg"'; return '<svg' + a + ns + ' width="' + size + '" height="' + size + '">'; }); }
function stColor(name) { return (ST_ICONS[name] && ST_ICONS[name].color) || ''; }
// </ST-ICONS>

// <ST-TOKENS> — generated by dev/tokens/sync-tokens.mjs from dev/tokens/design-tokens.mjs — DO NOT EDIT
const MBU_TOKENS = ':root{--mbu-bg:var(--background, #fff);--mbu-bg-raised:#faf9fe;--mbu-bg-raised:color-mix(in srgb, var(--mbu-bg) 96%, var(--mbu-accent));--mbu-bg-sunken:#f4f2f9;--mbu-bg-sunken:color-mix(in srgb, var(--mbu-bg) 94%, var(--mbu-text));--mbu-bg-hover:#f3eefe;--mbu-bg-hover:color-mix(in srgb, var(--mbu-bg) 91%, var(--mbu-accent));--mbu-text:var(--text, #222);--mbu-text-dim:#555;--mbu-text-dim:color-mix(in srgb, var(--mbu-text) 78%, var(--mbu-bg));--mbu-text-weak:#999;--mbu-text-weak:color-mix(in srgb, var(--mbu-text) 52%, var(--mbu-bg));--mbu-text-on-accent:#fff;--mbu-border:var(--border, #cfc6e6);--mbu-border-soft:#e2dcef;--mbu-border-strong:#9a8ccb;--mbu-border-strong:color-mix(in srgb, var(--mbu-border) 70%, var(--mbu-text));--mbu-divider:#eee;--mbu-divider:color-mix(in srgb, var(--mbu-bg) 92%, var(--mbu-text));--mbu-accent:#5f3ec0;--mbu-accent-hover:#4e329f;--mbu-accent-deep:#3b2c70;--mbu-accent-soft:#ece4ff;--mbu-accent-soft:color-mix(in srgb, var(--mbu-bg) 86%, var(--mbu-accent));--mbu-accent-fg:#fff;--mbu-accent-text:#5f3ec0;--mbu-accent-deep-text:#3b2c70;--mbu-ok:#1f9d6b;--mbu-ok:color-mix(in srgb, #1f9d6b 78%, var(--mbu-text));--mbu-ok-bg:#eef7f1;--mbu-ok-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-ok));--mbu-ok-border:#9bd3b6;--mbu-warn:#a05a00;--mbu-warn:color-mix(in srgb, #b4791f 78%, var(--mbu-text));--mbu-warn-bg:#fff7e6;--mbu-warn-bg:color-mix(in srgb, var(--mbu-bg) 88%, var(--mbu-warn));--mbu-warn-border:#f0c877;--mbu-error:#c0392b;--mbu-error:color-mix(in srgb, #d0473a 78%, var(--mbu-text));--mbu-error-bg:#fdecec;--mbu-error-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-error));--mbu-error-border:#e2a1a1;--mbu-info:#2f7fbf;--mbu-info:color-mix(in srgb, #3f8fd0 78%, var(--mbu-text));--mbu-info-bg:#eef4fb;--mbu-info-bg:color-mix(in srgb, var(--mbu-bg) 90%, var(--mbu-info));--mbu-info-border:#a9c8e6;--mbu-font:-apple-system,Segoe UI,Roboto,Arial,sans-serif;--mbu-font-mono:ui-monospace,SFMono-Regular,Consolas,Menlo,monospace;--mbu-fs:14px;--mbu-fs-sm:12px;--mbu-fs-xs:11px;--mbu-radius:6px;--mbu-radius-lg:10px;--mbu-shadow:0 1px 5px rgba(60,40,110,.07);--mbu-shadow-lg:0 8px 30px rgba(40,20,80,.3);--mbu-z-panel:30;--mbu-z-pop:99998;--mbu-z-modal:2147483000;--mbu-z-modal-panel:2147483001}:root[data-mbu-theme="dark"]{--mbu-bg:#1e1b24;--mbu-text:#e9e5f2;--mbu-border:#3b3548;--mbu-accent-text:#b9a7f0;--mbu-accent-deep-text:#a493e0}:root[data-mbu-theme="dark"][data-mbu-seed="theme"]{--mbu-bg:var(--background, #1e1b24);--mbu-text:var(--text, #e9e5f2);--mbu-border:var(--border, #3b3548)}';
// </ST-TOKENS>

// <ST-UI> — generated by dev/ui/sync-ui.mjs from dev/ui/ui-components.mjs — DO NOT EDIT
const MBU_UI_CSS = '.mbu-help{font-size:12px;color:var(--mbu-accent-text);text-decoration:none;border:1px solid var(--mbu-border);border-radius:var(--mbu-radius);padding:1px 8px;white-space:nowrap;line-height:1.6;background:none}.mbu-help:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-accent);text-decoration:none}h4>.mbu-help,.mbu-cfg-h>.mbu-help{margin-left:8px;flex:0 0 auto;font-weight:normal}#mbu-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:var(--mbu-z-pop);background:var(--mbu-accent-deep);color:var(--mbu-text-on-accent);padding:10px 16px;border-radius:9px;font:13px/1.35 var(--mbu-font);box-shadow:var(--mbu-shadow-lg);opacity:0;transition:opacity .2s;pointer-events:none;max-width:80vw;text-align:center;white-space:pre-wrap}#mbu-toast.mbu-toast-on{opacity:1}#mbu-toast.mbu-toast-act{pointer-events:auto}#mbu-toast .mbu-toast-btn{margin-left:10px;padding:2px 9px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;font:inherit;cursor:pointer}#mbu-toast .mbu-toast-btn:hover{background:rgba(255,255,255,.18)}#mbu-toast.mbu-toast-ok{background:var(--mbu-ok)}#mbu-toast.mbu-toast-warn{background:var(--mbu-warn)}#mbu-toast.mbu-toast-error{background:var(--mbu-error)}.mbu-cfg-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:0 0 9px;border-bottom:1px solid var(--mbu-border-soft);font:600 15px/1.3 var(--mbu-font);color:var(--mbu-text)}.mbu-cfg-ic{flex:0 0 auto;display:inline-flex;align-items:center;width:22px;height:22px}.mbu-cfg-ic img,.mbu-cfg-ic svg{width:22px;height:22px;object-fit:contain;display:block}.mbu-cfg-name{flex:0 0 auto;font-weight:700;color:var(--mbu-accent-text)}.mbu-cfg-ver{flex:0 0 auto;font:400 11px var(--mbu-font);color:var(--mbu-text-weak);white-space:nowrap}.mbu-cfg-sp{flex:1 1 auto;min-width:8px}.mbu-cfg-log{flex:0 0 auto;font:400 12px var(--mbu-font);color:var(--mbu-accent-text);cursor:pointer;background:none;border:1px solid transparent;border-radius:var(--mbu-radius);padding:1px 8px;line-height:1.6}.mbu-cfg-log:hover{background:var(--mbu-bg-hover);border-color:var(--mbu-border)}#mbu-logpop{position:fixed;top:74px;left:50%;transform:translateX(-50%);z-index:var(--mbu-z-modal);display:flex;flex-direction:column;width:min(720px,94vw);max-height:72vh;background:var(--mbu-bg);border:1px solid var(--mbu-border);border-radius:11px;box-shadow:var(--mbu-shadow-lg);font:13px var(--mbu-font);color:var(--mbu-text);overflow:hidden}.mbu-logpop-h{display:flex;align-items:center;gap:8px;padding:10px 13px;border-bottom:1px solid var(--mbu-border-soft);color:var(--mbu-accent-text);cursor:move;user-select:none}.mbu-logpop-sp{margin-left:auto}.mbu-logpop-clear,.mbu-logpop-copy,.mbu-logpop-x,.mbu-logpop-min{font-size:12px;color:var(--mbu-accent-text);background:var(--mbu-bg-hover);border:1px solid var(--mbu-border);border-radius:5px;padding:2px 9px;cursor:pointer;font-family:inherit}.mbu-logpop-clear:hover,.mbu-logpop-copy:hover,.mbu-logpop-x:hover,.mbu-logpop-min:hover{background:var(--mbu-accent-soft)}#mbu-logpop.min .mbu-log-list,#mbu-logpop.min .mbu-logpop-clear,#mbu-logpop.min .mbu-logpop-copy,#mbu-logpop.min .mbu-logpop-x{display:none}#mbu-logpop.min{max-height:none;width:auto}#mbu-logpop.min .mbu-logpop-sp{display:none}.mbu-log-badge{color:var(--mbu-border-strong);font-size:11px}.mbu-log-list{flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:9px 13px;display:flex;flex-direction:column;gap:3px}.mbu-log-li{display:flex;gap:9px;white-space:pre-wrap;word-break:break-word}.mbu-log-t{color:var(--mbu-text-weak);flex:0 0 auto;font-variant-numeric:tabular-nums}.mbu-log-m{flex:1 1 auto;color:var(--mbu-text-dim)}#mbu-logpop .mbu-log-m a{color:var(--mbu-accent-text)}.mbu-log-ok .mbu-log-m{color:var(--mbu-ok)}.mbu-log-warn .mbu-log-m{color:var(--mbu-warn)}.mbu-log-error .mbu-log-m{color:var(--mbu-error)}.mbu-log-debug{opacity:.85}.mbu-log-debug .mbu-log-m{color:var(--mbu-text-weak)}.mbu-log-empty{color:var(--mbu-text-weak)}.mbu-ov{position:fixed;inset:0;z-index:var(--mbu-z-modal);background:rgba(15,12,28,.45);display:flex;align-items:center;justify-content:center;padding:24px}.mbu-ov-panel{background:var(--mbu-bg);color:var(--mbu-text);border-radius:var(--mbu-radius-lg);box-shadow:var(--mbu-shadow-lg);max-width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden}.mbu-ov-h{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--mbu-border-soft);font-weight:700}.mbu-ov-h .mbu-ov-title{flex:1 1 auto;min-width:0}.mbu-ov-x{flex:0 0 auto;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;color:var(--mbu-text-dim);background:none;border:none;border-radius:var(--mbu-radius)}.mbu-ov-x:hover{background:var(--mbu-bg-hover);color:var(--mbu-text)}.mbu-ov-body{flex:1 1 auto;overflow:auto;padding:14px 16px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) ::placeholder{color:var(--mbu-text-weak);opacity:1;font-style:italic}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :is(table,td,th,div,span,label)[style*=background]{color:var(--mbu-text)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:not(:where([type=checkbox],[type=radio],[type=range],[type=color],[type=file])),:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select{background:var(--mbu-bg-sunken);color:var(--mbu-text);border-color:var(--mbu-border)}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) input:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) textarea:focus-visible,:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) select:focus-visible{outline:2px solid var(--mbu-accent);outline-offset:1px}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) :where(input[type=checkbox],input[type=radio],input[type=range]){accent-color:var(--mbu-accent)}:root[data-mbu-theme=dark] :where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu){color-scheme:dark;--invert-value:none;--invert:none}:where(.mbu-ov,.mbu-ui,#mbu-logpop,.discogs-bar,.discogs-review-panel-li,#as-root,#as-setup,.as-pop,#as-switch-wrap,#ii-btn,.fs-launch,#tc-bar,#tc-nav-bar,#tc-settings,#tc-anno-wrap,.tc-panel,.tc-toolcfg,.tc-acpop,.tc-recpop,.tc-lppop,.tc-tpppop,.tc-tpp-mpop,.tc-anno-help-pop,.tc-mirror,.tc-addrow,.tc-medopts,.tc-tools,#tc-recwrap,#tc-ri-toolbar,.tc-fmt-flat,.gt-toolbar,.gt-cons,.gt-menu,.gt-pop,.gt-cfg-pop,.gt-wm-pop,#ii-modal,#ii-sxpanel,#mb-pc-panel,#mb-provider-modal-card,.fs-cons,#fs-settings,.fs-overlay,.mmth-pop,.mmth-cfg,.mmth-side,.mmth-pinbar,.mmthf-pop,.mmthf-bar,#falcon-panel,#falcon-launcher,#falcon-item-popup,#falcon-add-page,.falcon-bar,.falcon-addmenu) button{background-color:var(--mbu-bg-raised);color:var(--mbu-text);border-color:var(--mbu-border)}.mbu-compact .mbu-bt{display:none}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input){-webkit-appearance:none;-moz-appearance:none;appearance:none;width:18px;height:18px;margin:0;border:none;border-radius:3px;cursor:pointer;background:transparent url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23888%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E") center/13px no-repeat;opacity:.45;box-shadow:none;flex:0 0 auto;vertical-align:middle}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):hover{opacity:1}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):checked{opacity:1;background-color:var(--mbu-accent);background-image:url("data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2016%2016%27%20fill=%27%23fff%27%3E%3Crect%20x=%271%27%20y=%273.5%27%20width=%2710%27%20height=%279%27%20rx=%271.5%27/%3E%3Cpath%20d=%27M11.5%207L15%204.8v6.4L11.5%209z%27/%3E%3C/svg%3E")}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):focus-visible{outline:1px solid var(--mbu-accent);outline-offset:1px}:is(.mbu-video,body.tc-ri-on #external-links-editor tr.relationship-item .attribute-container input):disabled{cursor:default;opacity:.3}';
// Help link markup. Every script's help link is this, pointing at its own README.
// `name` is the userscript folder, e.g. mbuHelpHref('art_station').
function mbuHelpHref(name) {
    return 'https://github.com/majkinetor/musicbrainz-userscripts/blob/main/userscripts/' + name + '/README.md';
}
function mbuHelpHtml(name, label) {
    return '<a class="mbu-help" href="' + mbuHelpHref(name) + '" target="_blank" rel="noopener"'
        + ' title="open the README in a new tab">' + (label || '? Help') + '</a>';
}
function mbuHelpEl(name, label) {
    var a = document.createElement('a');
    a.className = 'mbu-help';
    a.href = mbuHelpHref(name);
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'open the README in a new tab';
    a.textContent = label || '? Help';
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
    if (o.version) html += '<span class="mbu-cfg-ver" title="installed script version">v' + esc(o.version) + '</span>';
    html += '<span class="mbu-cfg-sp"></span>';
    if (o.log) {
        html += '<button type="button" class="mbu-cfg-log' + (o.logClass ? ' ' + esc(o.logClass) : '') + '"'
            + (o.logId ? ' id="' + esc(o.logId) + '"' : '')
            + ' title="Open the activity log">Log</button>';
    }
    html += mbuHelpHtml(o.script);
    return html + '</div>';
}

// Test hooks. A script puts its test hook on window only when the test harness has
// marked the page (dev/test/harness.mjs sets window.__mbuTest before any script runs):
//   if (mbuTestHooks()) window.__fooTest = { … };
// On a user's page the hooks are never built. (#623)
function mbuTestHooks() {
    try { return typeof window !== 'undefined' && window.__mbuTest === true; } catch (e) { return false; }
}

// Corner slots (#468). Every floating launcher (Apollo Editor, Art Station, Falcon,
// Fusion, Scribe) tags its element with data-mb-corner (which screen corner: 'br',
// 'bl', 'tr', 'tl') and data-mb-corner-order (lower sits closer to the corner), and
// calls mbRestackCorner(corner) right after it shows, hides, creates or removes it.
// That recomputes every element in the corner, whichever script owns it and
// whatever order they loaded in, so two launchers never land on the same pixel.
// Orders in use: Apollo and Art Station 10 (never on the same page), Falcon 20,
// Fusion above Falcon. Scribe is not on the shared block and keeps a copy of this.
function mbRestackCorner(corner) {
    var bottom = corner[0] === 'b', right = corner[1] === 'r';
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-mb-corner="' + corner + '"]'))
        // offsetParent is always null for position:fixed, so it can't tell visibility here
        .filter(function (el) { return getComputedStyle(el).display !== 'none'; })
        .sort(function (a, b) { return (Number(a.dataset.mbCornerOrder) || 0) - (Number(b.dataset.mbCornerOrder) || 0); });
    var pos = 14;
    els.forEach(function (el) {
        el.style[bottom ? 'bottom' : 'top'] = pos + 'px';
        el.style[right ? 'right' : 'left'] = '14px';
        pos += el.getBoundingClientRect().height + 8;
    });
}

// Activity log: the session's log lines plus the floating window that shows them
// (#283's viewer, shared since X12 of #623). A script makes its log once:
//
//   var LOG = mbuLog({ name: 'Fusion', version: VERSION, key: 'fusion.logwin' });
//   LOG.info('…'); LOG.warn(…); LOG.err(…) (or .error); LOG.ok(…); LOG.debug(…)
//   LOG.open(); LOG.close(); LOG.reopen()   // reopen: only if it was left open
//   LOG.markdown(); LOG.copy(btn); LOG.clear(); LOG.lines(); LOG.messages(); LOG.counts()
//
// o.name / o.version  the Markdown summary's title (version may be a function)
// o.subtitle          optional function; its text follows the title (e.g. the release)
// o.header            the window's title (default 'Activity log')
// o.key               storage key for the window's open/minimised/position state
// o.load / o.save     that storage (default GM_getValue / GM_setValue)
// o.before            called before the window opens (e.g. to inject the script's CSS)
// o.max               lines kept (default 20000: about 4 MB; 2000 dropped a long session's start)
//
// A long run keeps only the last o.max lines, and the Markdown says how many went
// before them; the copies this replaced grew for the whole session. An open
// window appends each new line and drops the oldest row past the cap; the copies
// rebuilt the whole list with innerHTML on every line, which is quadratic over a
// long matching run.
function mbuLog(o) {
    o = o || {};
    var max = o.max || 20000, buf = [], dropped = 0, warn = 0, error = 0, win = null;
    var pad = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var ts = function (d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' + pad(d.getMilliseconds(), 3); };
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
    var tally = function (e, d) { if (e.sev === 'warn') warn += d; else if (e.sev === 'error') error += d; };
    var PRE = { info: '', ok: 'OK   ', warn: 'WARN ', error: 'ERR  ', debug: 'DBG  ' };
    var line = function (e) { return ts(e.t) + '  ' + (PRE[e.sev] || '') + e.msg; };

    function add(sev, args) {
        var msg = Array.prototype.map.call(args, str).join(' ').replace(/\s+/g, ' ').trim();
        if (!msg) return;
        var e = { t: new Date(), sev: sev === 'err' ? 'error' : sev, msg: msg };
        buf.push(e); tally(e, 1);
        // trim in chunks, not one shift per line
        if (buf.length > max + Math.ceil(max / 10)) {
            var gone = buf.splice(0, buf.length - max);
            gone.forEach(function (g) { tally(g, -1); });
            dropped += gone.length;
        }
        if (win) win.append(e);
    }
    function title() {
        var v = typeof o.version === 'function' ? (function () { try { return o.version(); } catch (e) { return ''; } })() : o.version;
        var t = (o.name || 'Log') + (v ? ' v' + v : '');
        try { var s = o.subtitle && o.subtitle(); if (s) t += ' — ' + s; } catch (e) { /* no subtitle */ }
        return t;
    }
    function markdown() {
        var body = buf.length ? buf.map(line).join('\n') : '(no activity logged)';
        if (dropped) body = '(' + dropped + ' earlier line' + (dropped === 1 ? '' : 's') + ' not kept)\n' + body;
        var n = (warn || error) ? ' (' + warn + ' warning' + (warn === 1 ? '' : 's') + ', ' + error + ' error' + (error === 1 ? '' : 's') + ')' : '';
        var fence = String.fromCharCode(96, 96, 96);
        return '<details><summary>' + title() + ' — session log' + n + '</summary>\n\n' + fence + 'log\n' + body + '\n' + fence + '\n\n</details>';
    }
    function copy(btn) {
        var md = markdown();
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
    function open() {
        close(true);
        if (typeof o.before === 'function') { try { o.before(); } catch (e) { /* the window still opens */ } }
        remember({ open: true });
        var st = state();
        var pop = document.createElement('div'); pop.id = 'mbu-logpop'; pop.className = 'mbu-logpop';
        pop.innerHTML = mbuHtml('<div class="mbu-logpop-h"><b>' + esc(o.header || 'Activity log') + '</b> <span class="mbu-log-badge"></span><span class="mbu-logpop-sp"></span>'
            + '<button class="mbu-logpop-clear" type="button" title="Clear the log (the lines so far are gone)">Clear</button>'
            + '<button class="mbu-logpop-copy" type="button" title="Copy as Markdown (paste into a GitHub issue)">⧉ Copy</button>'
            + '<button class="mbu-logpop-min" type="button" title="Minimize">–</button>'
            + '<button class="mbu-logpop-x" type="button" title="Close">✕</button></div>'
            + '<div class="mbu-log-list"></div>');
        document.body.appendChild(pop);
        if (st.left != null) { pop.style.left = st.left; pop.style.top = st.top; pop.style.right = 'auto'; pop.style.transform = 'none'; }
        var restore = { left: pop.style.left, top: pop.style.top, right: pop.style.right, bottom: pop.style.bottom, transform: pop.style.transform };
        var list = pop.querySelector('.mbu-log-list'), badge = pop.querySelector('.mbu-log-badge');
        var row = function (e) {
            var d = document.createElement('div');
            d.className = 'mbu-log-li mbu-log-' + e.sev;
            d.innerHTML = mbuHtml('<span class="mbu-log-t">' + ts(e.t) + '</span><span class="mbu-log-m">' + linkify(e.msg) + '</span>');
            return d;
        };
        var showBadge = function () { badge.textContent = '(' + buf.length + ')' + (warn || error ? ' · ' + warn + '⚠ ' + error + '✖' : ''); };
        // the rows, once; later lines are appended one by one
        var frag = document.createDocumentFragment();
        buf.forEach(function (e) { frag.appendChild(row(e)); });
        if (buf.length) list.appendChild(frag);
        else list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>');
        showBadge();
        list.scrollTop = list.scrollHeight;
        // badge and scroll once per frame, however many lines arrive in it
        var queued = false, follow = true;
        list.addEventListener('scroll', function () { follow = list.scrollHeight - list.scrollTop - list.clientHeight < 40; });
        var paint = function () { queued = false; showBadge(); if (follow) list.scrollTop = list.scrollHeight; };
        var onKey = function (e) { if (e.key === 'Escape') close(); };
        win = {
            el: pop,
            append: function (e) {
                var empty = list.querySelector('.mbu-log-empty'); if (empty) empty.remove();
                list.appendChild(row(e));
                while (list.childElementCount > buf.length) list.firstElementChild.remove();
                if (!queued) { queued = true; requestAnimationFrame(paint); }
            },
            off: function () { document.removeEventListener('keydown', onKey); },
            cleared: function () { list.innerHTML = mbuHtml('<div class="mbu-log-empty">No activity yet.</div>'); showBadge(); },
        };
        pop.querySelector('.mbu-logpop-clear').onclick = function () { clear(); };
        pop.querySelector('.mbu-logpop-copy').onclick = function () { copy(pop.querySelector('.mbu-logpop-copy')); };
        var minBtn = pop.querySelector('.mbu-logpop-min');
        var setMin = function (m) {
            minBtn.textContent = m ? '▢' : '–'; minBtn.title = m ? 'Restore' : 'Minimize';
            if (m) { pop.style.left = '14px'; pop.style.bottom = '14px'; pop.style.top = 'auto'; pop.style.right = 'auto'; pop.style.transform = 'none'; }   // dock to the bottom
            else Object.assign(pop.style, restore);
        };
        minBtn.onclick = function () { var m = pop.classList.toggle('min'); setMin(m); remember({ min: m }); };
        if (st.min) { pop.classList.add('min'); setMin(true); }
        pop.querySelector('.mbu-logpop-x').onclick = function () { close(); };
        // floating and non-modal: dragged by its header
        pop.querySelector('.mbu-logpop-h').addEventListener('mousedown', function (e) {
            if (e.target.closest('button')) return;
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
        document.addEventListener('keydown', onKey);
        return pop;
    }
    // empty the log: the lines, the counts and the "earlier lines not kept" note
    function clear() {
        buf = []; dropped = 0; warn = 0; error = 0;
        if (win) win.cleared();
    }
    // quiet: closing to reopen, so the remembered "open" stays as it is
    function close(quiet) {
        var stray = document.getElementById('mbu-logpop');
        if (win) { win.off(); win.el.remove(); win = null; if (!quiet) remember({ open: false }); }
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
        open: open,
        close: function () { close(); },
        reopen: function () { if (state().open) open(); },
        isOpen: function () { return !!win; },
        markdown: markdown,
        copy: copy,
        clear: clear,
        lines: function () { return buf.map(line); },
        messages: function () { return buf.map(function (e) { return e.msg; }); },
        counts: function () { return { warn: warn, error: error }; },
    };
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
} catch (e) { /* a locked-down page must not stop the script loading */ }
// </ST-UI>

launcher();
})();
