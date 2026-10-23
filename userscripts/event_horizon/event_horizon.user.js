// ==UserScript==
// @name         Event Horizon
// @namespace    https://github.com/majkinetor/musicbrainz-userscripts
// @version      2026.10.23
// @description  An alternative MusicBrainz viewer.
// @author       majkinetor
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4IiB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCI+Cjx0aXRsZT5FdmVudCBIb3Jpem9uPC90aXRsZT4KPHBhdGggZD0iTTQgNjQgQTYwIDE2IDAgMCAxIDEyNCA2NCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZWI3NDNiIiBzdHJva2Utd2lkdGg9IjciIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgdHJhbnNmb3JtPSJyb3RhdGUoLTE1IDY0IDY0KSIvPgo8cG9seWdvbiBwb2ludHM9IjYyLjMsMTYuNCAyMS41LDQwLjIgMjEuNSw4Ny44IDYyLjMsMTExLjYiIGZpbGw9IiNiYTQ3OGYiLz48cG9seWdvbiBwb2ludHM9IjY1LjcsMTYuNCAxMDYuNSw0MC4yIDEwNi41LDg3LjggNjUuNywxMTEuNiIgZmlsbD0iI2ViNzQzYiIvPgo8cGF0aCBkPSJNNCA2NCBBNjAgMTYgMCAwIDAgMTI0IDY0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmM5NGEiIHN0cm9rZS13aWR0aD0iNyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiB0cmFuc2Zvcm09InJvdGF0ZSgtMTUgNjQgNjQpIi8+Cjwvc3ZnPgo=
// @match        https://*.musicbrainz.org/robots.txt*
// @run-at       document-start
// @grant        none
// ==/UserScript==

// The viewer lives on /robots.txt: MusicBrainz's web server answers it on its own, so opening the viewer costs MusicBrainz nothing.
(function () {
'use strict';

document.documentElement.innerHTML = '<head><title>Event Horizon</title></head><body><h1>Event Horizon</h1></body>';
})();
