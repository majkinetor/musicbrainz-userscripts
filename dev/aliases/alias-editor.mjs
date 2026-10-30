// The bulk alias editor (#849): an entity's aliases as rows to edit or remove, plus new rows typed
// in, sent as one edit each through MusicBrainz's own alias forms. Apollo Editor shows it on the
// Aliases page; Event Horizon in a popup.
//
// Inlined between `// <ST-ALIASES>` markers by dev/aliases/sync-aliases.mjs: the block is this
// file's text up to the END-OF-BLOCK line. Edit HERE, never in a generated block.
//
//   const box = await mbuAliasEditor.open({
//     ent: 'artist', gid,              // the entity
//     origin: location.origin,
//     fetch: mbWebFetch,               // MusicBrainz's website requests, through the gate (ST-NET)
//     mount: box => host.append(box),  // where the editor goes, called once it is built
//     form,                            // the add-alias form, when the page has one; else it is fetched
//     guess: name => sortName,         // the sort-name guess (ST-GUESSCASE); without it the sort name is the name
//     seed: 'name',                    // a first new row
//     log: { debug, info, warn, err }, toast: (msg, kind) => {}, onSubmit: (ok, failed) => {},
//   });
//
// Needs ST-TOKENS (the --mbu- colours) and ST-UI (mbuProp).

const mbuAliasEditor = (() => {
    'use strict';
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    let Log = { debug() {}, info() {}, warn() {}, err() {} }, fetchMb = (u, i) => fetch(u, i), ORIGIN = typeof location !== 'undefined' ? location.origin : '';

    function aliasOpts(sel) { return sel ? [...sel.options].map(o => ({ v: o.value, t: o.textContent.trim() })) : []; }

    // the /aliases page carries each alias's id (ws/2 doesn't); its locale and type cells are the names
    // MusicBrainz shows, mapped back to codes through the add form's own selects; on the aliases page
    // itself the caller passes that page, which saves fetching it again
    async function aliasLoad(ent, gid, locales, types, page) {
      const doc = page || new DOMParser().parseFromString(await (await fetchMb(ORIGIN + '/' + ent + '/' + gid + '/aliases', { credentials: 'include' })).text(), 'text/html');
      const rows = [];
      for (const tr of doc.querySelectorAll('table.tbl tbody tr')) {
        const a = tr.querySelector('a[href*="/alias/"][href$="/edit"]'); if (!a) continue;
        const id = (a.getAttribute('href').match(/\/alias\/(\d+)\/edit/) || [])[1]; if (!id) continue;
        const td = [...tr.children].map(c => c.textContent.trim());
        const nameCell = tr.children[0], same = nameCell && nameCell.colSpan === 2;
        const name = td[0], sort = same ? td[0] : td[1], rest = same ? td.slice(1) : td.slice(2);
        const [begin, end, typeT, locT] = rest;
        const primary = /\(primary\)/i.test(locT || ''), locName = (locT || '').replace(/\s*\(primary\)\s*$/i, '');
        const loc = locales.find(o => o.t === locName), typ = types.find(o => o.t === typeT);
        // an alias ended without a date has "[unknown]" (translated) for its end: any end that isn't a date
        const dt = s => /^\d{4}(-\d\d){0,2}$/.test((s || '').trim()) ? s.trim() : '';
        rows.push({ id, name, sort, locale: loc ? loc.v : '', primary, type: typ ? typ.v : '', begin: dt(begin), end: dt(end), ended: !!(end || '').trim() });
      }
      // MusicBrainz lists them by locale; the editor keeps the order they were added in
      rows.sort((a, b) => a.id - b.id);
      Log.info('loaded', rows.length, 'aliases of', ent, gid);
      return rows;
    }

    function aliasForm(row, note) {
      const p = new URLSearchParams(), d = (k, s) => { const [y, m, dd] = (s || '').split('-'); p.set(k + '.year', y || ''); p.set(k + '.month', m || ''); p.set(k + '.day', dd || ''); };
      p.set('edit-alias.name', row.name); p.set('edit-alias.sort_name', row.sort || row.name);
      p.set('edit-alias.locale', row.locale || ''); if (row.locale && row.primary) p.set('edit-alias.primary_for_locale', '1');
      p.set('edit-alias.type_id', row.type || '');
      d('edit-alias.period.begin_date', row.begin); d('edit-alias.period.end_date', row.end);
      if (row.end || row.ended) p.set('edit-alias.period.ended', '1');
      p.set('edit-alias.edit_note', note);
      return p;
    }

    // MusicBrainz answers a good alias form by redirecting to the aliases page; a bad one comes back
    // as the form with its errors
    async function aliasPost(url, body) {
      const r = await fetchMb(url, { method: 'POST', credentials: 'include', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (/\/aliases\/?$/.test(new URL(r.url).pathname)) return null;
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      return [...doc.querySelectorAll('.error, ul.errors li')].map(e => e.textContent.trim()).filter(Boolean).join('; ') || 'HTTP ' + r.status;
    }

    async function readOnly(o) {
      const doc = new DOMParser().parseFromString(await (await fetchMb(ORIGIN + '/' + o.ent + '/' + o.gid + '/aliases', { credentials: 'include' })).text(), 'text/html');
      const tb = doc.querySelector('table.tbl');
      if (!tb) throw new Error('no add-alias form');
      tb.querySelectorAll('a[href*="/alias/"]').forEach(a => a.closest('td')?.remove());
      tb.querySelectorAll('th').forEach(th => { if (!th.textContent.trim()) th.remove(); });
      tb.querySelectorAll('a[href^="/"]').forEach(a => { a.href = ORIGIN + a.getAttribute('href'); a.target = '_blank'; });
      const n = tb.querySelectorAll('tbody tr').length;
      Log.info('add-alias form missing: listing', n, 'aliases read-only');
      style();
      const box = document.createElement('div'); box.id = 'tc-alias';
      box.innerHTML = '<p class="tc-al-ro">You can\'t edit these aliases.</p>';
      tb.className = 'tc-al-tbl'; box.append(tb);
      o.mount(box);
      if (o.onCount) o.onCount(n);
    }

    async function editor(o) {
      const ent = o.ent, gid = o.gid;
      let form = o.form;
      if (!form) {
        form = new DOMParser().parseFromString(await (await fetchMb(ORIGIN + '/' + ent + '/' + gid + '/add-alias')).text(), 'text/html').querySelector('input[name="edit-alias.name"]')?.closest('form');
        Log.info('add-alias form', form ? 'read' : 'missing');
      }
      // no add form: this user may not edit the entity's aliases (a country's need a location editor), so they're listed read-only
      if (!form) return readOnly(o);
      const locales = aliasOpts(form.querySelector('select[name="edit-alias.locale"]')), types = aliasOpts(form.querySelector('select[name="edit-alias.type_id"]'));
      const guess = n => o.guess ? o.guess(n) : n;
      style();
      const box = document.createElement('div'); box.id = 'tc-alias';
      // B layout: one line per alias (name, sort name with its guess, primary, a pill for type and dates, locale last);
      // type and dates fold under the row's ⋯; the last line is always empty, typing in it starts the next alias
      box.innerHTML = '<div class="tc-al-bar"><b>Aliases</b><span class="tc-al-sum"></span></div>'
        + '<div class="tc-al-head"><span>Alias</span><span>Sort name</span><span>Locale</span><span>Type</span><span>Dates</span><span></span></div><div class="tc-al-list"></div><div class="tc-al-pop" hidden></div>'
        + '<div class="tc-al-nw" hidden><b>Edit note</b> <span class="tc-al-nh">Added to every edit this makes: say why, so a voter can see it.</span><textarea class="tc-al-note" rows="3" placeholder="e.g. Aliases from the artist\'s official site"></textarea></div>'
        + '<div class="tc-al-foot"><span class="tc-al-msg"></span><span style="flex:1"></span><button type="button" class="tc-al-nb" title="Add an edit note">' + (typeof MBU_EDIT_ICON === 'string' ? MBU_EDIT_ICON : '') + ' Note</button><button type="button" class="tc-al-go" id="tc-al-enter" disabled></button></div>';
      if (o.onCount) box.querySelector('.tc-al-bar').hidden = true;
      o.mount(box);
      const tb = box.querySelector('.tc-al-list'), go = box.querySelector('.tc-al-go'), msg = box.querySelector('.tc-al-msg');
      const nw = box.querySelector('.tc-al-nw'), nb = box.querySelector('.tc-al-nb'), noteIn = box.querySelector('.tc-al-note');
      const noteMark = () => nb.classList.toggle('tc-al-on', !nw.hidden || !!noteIn.value.trim());
      nb.onclick = () => { nw.hidden = !nw.hidden; noteMark(); if (!nw.hidden) noteIn.focus(); };
      noteIn.addEventListener('input', noteMark);
      const optHtml = (list, v, none) => list.map(o => '<option value="' + esc(o.v) + '"' + (o.v === v ? ' selected' : '') + '>' + esc(o.v ? o.t : none) + '</option>').join('');
      const typeName = v => (types.find(o => o.v === v) || {}).t || '';
      // a search hint has only a name, as on MusicBrainz's form: its id is in the form's props, else found by name, else MusicBrainz's own
      const hintType = (() => {
        const m = /"searchHintType"\s*:\s*"?(\d+)/.exec([...form.ownerDocument.querySelectorAll('script')].map(x => x.textContent).find(t => t.includes('searchHintType')) || '');
        return m ? m[1] : (types.find(o => /search hint/i.test(o.t)) || {}).v || (ent === 'artist' ? '3' : '2');
      })();
      Log.debug('search hint type', hintType);
      // a filterable list under a locale or type field, in place of the browser's datalist and select popups
      const pop = box.querySelector('.tc-al-pop');
      let popIn = null, popHit = [], popAt = 0;
      const popDraw = () => {
        pop.innerHTML = popHit.map((o, i) => '<div class="tc-al-opt' + (i === popAt ? ' on' : '') + '" data-i="' + i + '">' + esc(o.t || '\u2014') + '</div>').join('') || '<div class="tc-al-none">No match</div>';
        pop.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
      };
      const popOpen = (inp, list, all) => {
        popIn = inp; const t = all ? '' : inp.value.trim().toLowerCase();
        popHit = list.filter(o => !t || (o.t || '').toLowerCase().includes(t) || o.v.toLowerCase() === t);
        popHit.sort((a, b) => t ? ((a.t || '').toLowerCase().startsWith(t) ? 0 : 1) - ((b.t || '').toLowerCase().startsWith(t) ? 0 : 1) : 0);
        popAt = Math.max(0, popHit.findIndex(o => o.v === inp.dataset.v)); popDraw();
        const br = box.getBoundingClientRect(), ir = inp.getBoundingClientRect();
        pop.style.left = (ir.left - br.left) + 'px'; pop.style.top = (ir.bottom - br.top) + 'px'; pop.style.minWidth = ir.width + 'px';
        pop.hidden = false;
      };
      const popClose = () => { pop.hidden = true; popIn = null; };
      const popPick = o => { const inp = popIn; popClose(); if (!inp || !o) return; inp.value = o.v ? o.t : ''; inp.dataset.v = o.v; inp.dispatchEvent(new Event('change', { bubbles: true })); };
      // Up and Down move to the same column of the row above or below
      box.addEventListener('keydown', ev => {
        if (ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey || (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown')) return;
        const el = ev.target, tr = el.closest && el.closest('.tc-al-row'), col = el.classList && [...el.classList].find(c => /^tc-al-[a-z]$/.test(c));
        if (!tr || !col) return;
        let to = ev.key === 'ArrowUp' ? tr.previousElementSibling : tr.nextElementSibling;
        while (to && !to.classList.contains('tc-al-row')) to = ev.key === 'ArrowUp' ? to.previousElementSibling : to.nextElementSibling;
        const t = to && to.querySelector('.' + col); if (!t) return;
        ev.preventDefault(); popClose(); if (t.closest('.tc-al-dt')) { to.classList.add('tc-al-dopen'); to.querySelector('.tc-al-c').setAttribute('aria-expanded', 'true'); } t.focus();
        if (t.tagName === 'INPUT') { const n = t.value.length; try { t.setSelectionRange(n, n); } catch {} }
      });
      pop.addEventListener('mousedown', ev => { ev.preventDefault(); const d = ev.target.closest('.tc-al-opt'); if (d) popPick(popHit[+d.dataset.i]); });
      const combo = (inp, list) => {
        inp.autocomplete = 'off';
        inp.addEventListener('click', () => { if (popIn !== inp) popOpen(inp, list, true); });
        inp.addEventListener('input', () => popOpen(inp, list));
        inp.addEventListener('blur', () => { if (popIn === inp) popClose(); });
        inp.addEventListener('keydown', ev => {
          if (popIn !== inp) { if (ev.key === 'ArrowDown' && ev.altKey) { popOpen(inp, list, true); ev.preventDefault(); } return; }
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { popAt = Math.min(popHit.length - 1, Math.max(0, popAt + (ev.key === 'ArrowDown' ? 1 : -1))); popDraw(); ev.preventDefault(); }
          else if (ev.key === 'Enter' || (ev.key === 'Tab' && inp.value.trim())) { if (popHit[popAt]) popPick(popHit[popAt]); if (ev.key === 'Enter') ev.preventDefault(); }
          else if (ev.key === 'Escape') popClose();
        });
      };
      // a date as MusicBrainz takes it: YYYY, YYYY-MM or YYYY-MM-DD; dots, slashes and spaces work as dashes, and
      // a day-first date (31.12.2020) is turned round; null when it isn't a date
      const normDate = t => {
        t = t.trim(); if (!t) return '';
        let p = t.split(/[-./\s]+/).filter(Boolean);
        if (p.length > 1 && p[p.length - 1].length === 4 && p[0].length <= 2) p.reverse();
        if (p.length > 3 || !/^\d{4}$/.test(p[0]) || p.slice(1).some(x => !/^\d{1,2}$/.test(x))) return null;
        const [y, m, d] = p.map(Number);
        if (m !== undefined && (m < 1 || m > 12)) return null;
        if (d !== undefined && (d < 1 || d > new Date(y, m, 0).getDate())) return null;
        return [p[0], ...p.slice(1).map(x => x.padStart(2, '0'))].join('-');
      };
      const rows = [];
      const key = r => JSON.stringify([r.name, r.sort, r.locale, !!r.primary, r.type, r.begin, r.end, !!(r.ended || r.end)]);
      const state = r => r.removed ? 'del' : !r.id ? (r.name.trim() ? 'new' : '') : key(r) !== r.orig ? 'chg' : '';
      const sync = () => {
        let n = 0;
        for (const r of rows) {
          const s = state(r); r.tr.className = 'tc-al-row' + (s ? ' tc-al-' + s : '') + (r.type && r.type === hintType ? ' tc-al-hint' : '') + (r.tr.classList.contains('tc-al-dopen') ? ' tc-al-dopen' : '');
          if (s && (s === 'del' || r.name.trim())) n++;
          const x = r.tr.querySelector('.tc-al-x'); const back = r.removed || s === 'chg'; x.textContent = back ? '↺' : '✕'; x.title = r.removed ? 'Keep this alias' : s === 'chg' ? 'Undo the changes to this alias' : r.id ? 'Remove this alias' : 'Drop this row';
          mbuProp(x.style, 'visibility', !r.id && !r.name.trim() ? 'hidden' : '');
          // primary needs a locale, and an ended alias or a search hint can't be one, as on MusicBrainz's form
          const p = r.tr.querySelector('.tc-al-p'); p.disabled = !r.locale || !!r.end || !!r.ended || (!!r.type && r.type === hintType); if (p.disabled) r.primary = false; p.hidden = p.disabled; r.tr.querySelector('.tc-al-l').classList.toggle('tc-al-lp', !p.disabled);
          p.textContent = r.primary ? '★' : '☆'; p.classList.toggle('on', !!r.primary);
        }
        const invalid = rows.some(r => state(r) && state(r) !== 'del' && r.tr.querySelector('.tc-al-bad'));
        if (invalid) n = 0;
        // the footer says what is wrong, not only where
        const why = invalid ? (rows.map(r => state(r) && state(r) !== 'del' && r.tr.querySelector('.tc-al-bad')).find(Boolean)?.title || 'Fix the fields marked in red') : '';
        if (invalid || msg.classList.contains('tc-al-err')) msg.textContent = why;
        msg.classList.toggle('tc-al-err', invalid);
        go.textContent = '\u2713 Enter ' + (n > 1 ? n + ' edits' : 'edit'); go.disabled = !n;
        mbuProp(go.style, 'display', n ? '' : 'none');
        const cnt = rows.filter(r => r.id).length;
        box.querySelector('.tc-al-sum').textContent = cnt + ' existing'; if (o.onCount) o.onCount(cnt);
      };
      const ghost = () => rows.find(r => !r.id && !r.name.trim() && r.tr === tb.lastElementChild);
      const addRow = r => {
        const tr = document.createElement('div'); r.tr = tr;
        tr.innerHTML = '<input class="tc-al-n" placeholder="Alias"><span class="tc-al-sw"><input class="tc-al-s" placeholder="Sort name"><button type="button" class="tc-al-g" title="Guess the sort name">' + (typeof MBU_SORT_ICON === 'string' ? MBU_SORT_ICON : 'Aa') + '</button></span>'
          + '<span class="tc-al-lw"><input class="tc-al-l" placeholder="Locale" title="Type to filter the locales"><button type="button" class="tc-al-p" title="Primary for its locale"></button></span>'
          + '<input class="tc-al-t" placeholder="Type" title="Type to filter the types">'
          + '<button type="button" class="tc-al-c" title="Begin and end dates"></button><button type="button" class="tc-al-x"></button>'
          + '<span class="tc-al-dt"><label>Begin <input class="tc-al-b" maxlength="10" inputmode="numeric" title="YYYY, YYYY-MM or YYYY-MM-DD"></label><button type="button" class="tc-al-cp" title="Copy the begin date to the end">\u2192</button><label>End <input class="tc-al-e" maxlength="10" inputmode="numeric" title="YYYY, YYYY-MM or YYYY-MM-DD"></label>'
          + '<label class="tc-al-ew"><input type="checkbox" class="tc-al-ed"> This alias is no longer current</label></span>';
        const $ = c => tr.querySelector(c);
        const HINT_OFF = ['.tc-al-s', '.tc-al-g', '.tc-al-l', '.tc-al-b', '.tc-al-e', '.tc-al-c', '.tc-al-cp', '.tc-al-ed'];
        // the calendar shows the dates it holds; a row with a bad date stays open
        const dates = () => {
          const c = $('.tc-al-c'), has = !!(r.begin || r.end);
          c.innerHTML = CAL + (has ? '<span>' + esc(r.begin || '\u2026') + '\u2013' + esc(r.end || '') + '</span>' : r.ended ? '<span>ended</span>' : '');
          c.classList.toggle('tc-al-has', has || !!r.ended);
          const ed = $('.tc-al-ed'); ed.checked = !!(r.ended || r.end); ed.disabled = !!r.end || (!!r.type && r.type === hintType);
          if (tr.querySelector('.tc-al-dt .tc-al-bad')) tr.classList.add('tc-al-dopen');
          c.setAttribute('aria-expanded', String(tr.classList.contains('tc-al-dopen')));
        };
        // a search hint keeps only its name: the rest is emptied (the sort name is the name) and shut, and comes back when the type changes
        const hint = () => {
          const on = !!r.type && r.type === hintType;
          if (on && !r.hintPrev) { r.hintPrev = { sort: r.sort, locale: r.locale, primary: r.primary, begin: r.begin, end: r.end, ended: r.ended, auto: r.autoSort }; }
          else if (!on && r.hintPrev) {
            const p = r.hintPrev; r.hintPrev = null; Object.assign(r, { sort: p.sort, locale: p.locale, primary: p.primary, begin: p.begin, end: p.end, ended: p.ended, autoSort: p.auto });
            if (r.autoSort) r.sort = r.name.trim() ? guess(r.name.trim()) : '';
            $('.tc-al-s').value = r.sort; locIn.value = locName(r.locale); locIn.dataset.v = r.locale; $('.tc-al-b').value = r.begin; $('.tc-al-e').value = r.end;
          }
          if (on) {
            Object.assign(r, { sort: r.name, locale: '', primary: false, begin: '', end: '', ended: false });
            $('.tc-al-s').value = r.name; locIn.value = ''; locIn.dataset.v = ''; $('.tc-al-b').value = ''; $('.tc-al-e').value = '';
            for (const c of ['.tc-al-l', '.tc-al-b', '.tc-al-e']) { $(c).classList.remove('tc-al-bad'); $(c).title = ''; }
          }
          for (const c of HINT_OFF) { $(c).disabled = on; }
          tr.classList.toggle('tc-al-hint', on);
        };
        const locIn = $('.tc-al-l'), locName = v => (locales.find(o => o.v === v) || {}).t || '';
        locIn.value = locName(r.locale); locIn.dataset.v = r.locale;
        const tyIn = $('.tc-al-t'); tyIn.value = typeName(r.type); tyIn.dataset.v = r.type || '';
        combo(locIn, locales); combo(tyIn, types);
        $('.tc-al-n').value = r.name; $('.tc-al-s').value = r.sort; $('.tc-al-b').value = r.begin; $('.tc-al-e').value = r.end;
        // a new alias's sort name follows its name until it is typed by hand
        r.autoSort = !r.id && (!r.sort || r.sort === guess(r.name));
        const read = ev => {
          r.name = $('.tc-al-n').value;
          if (ev && ev.target === $('.tc-al-s')) r.autoSort = !$('.tc-al-s').value;
          if (ev && ev.target === $('.tc-al-n') && r.autoSort) $('.tc-al-s').value = r.name.trim() ? guess(r.name.trim()) : '';
          r.sort = $('.tc-al-s').value;
          { const t = locIn.value.trim().toLowerCase(), o = t ? locales.find(x => x.v && (x.t.toLowerCase() === t || x.v.toLowerCase() === t)) : { v: '' };
            locIn.classList.toggle('tc-al-bad', !o); if (o) { r.locale = o.v; locIn.dataset.v = o.v; if (ev && ev.type === 'change' && ev.target === locIn) locIn.value = locName(o.v); } } 
          { const t = tyIn.value.trim().toLowerCase(), o = t ? types.find(x => x.v && x.t.toLowerCase() === t) : { v: '' };
            tyIn.classList.toggle('tc-al-bad', !o); if (o) { r.type = o.v; tyIn.dataset.v = o.v; } }
          for (const [c, k] of [['.tc-al-b', 'begin'], ['.tc-al-e', 'end']]) {
            const inp = $(c);
            // a date field takes digits and separators only
            if (ev && ev.target === inp && /[^\d./\- ]/.test(inp.value)) inp.value = inp.value.replace(/[^\d./\- ]/g, '');
            // a date half typed isn't flagged until the field is left; a bad one clears as soon as it is right
            const d = normDate(inp.value), typing = ev && ev.type === 'input' && ev.target === inp;
            if (d !== null || !typing) inp.classList.toggle('tc-al-bad', d === null);
            inp.title = d === null && !typing ? 'Not a date: type a year, year-month or a full date, e.g. 1998, 1998-05 or 1998-05-21' : '';
            if (d !== null) { r[k] = d; if (ev && ev.type === 'change' && ev.target === inp) inp.value = d; } else r[k] = inp.value.trim();
          }
          { // the end can't come before the begin
            const b = $('.tc-al-b'), e = $('.tc-al-e');
            if (r.begin && r.end && !b.classList.contains('tc-al-bad') && !e.classList.contains('tc-al-bad') && r.end < r.begin.slice(0, r.end.length)) {
              e.classList.add('tc-al-bad'); e.title = 'The end comes before the begin';
            }
          }
          if (ev && ev.target === $('.tc-al-ed')) r.ended = $('.tc-al-ed').checked;
          if (r.end) r.ended = true;
          hint(); dates();
          if (!r.id && r.name.trim() && tb.lastElementChild === tr) addRow(blank());
          sync();
        };
        tr.addEventListener('input', read); tr.addEventListener('change', read);
        $('.tc-al-g').onclick = () => { if (!r.name.trim()) return; $('.tc-al-s').value = guess(r.name.trim()); r.autoSort = true; read(); };
        $('.tc-al-p').onclick = () => { r.primary = !r.primary; sync(); };
        $('.tc-al-cp').onclick = () => { const e = $('.tc-al-e'); e.value = $('.tc-al-b').value; e.dispatchEvent(new Event('change', { bubbles: true })); e.focus(); };
        $('.tc-al-c').onclick = () => { const on = tr.classList.toggle('tc-al-dopen'); dates(); if (on) $('.tc-al-b').focus(); };
        $('.tc-al-x').onclick = () => {
          if (r.id && !r.removed && state(r) === 'chg') {
            [r.name, r.sort, r.locale, r.primary, r.type, r.begin, r.end, r.ended] = JSON.parse(r.orig);
            $('.tc-al-n').value = r.name; $('.tc-al-s').value = r.sort; $('.tc-al-b').value = r.begin; $('.tc-al-e').value = r.end;
            locIn.value = locName(r.locale); locIn.dataset.v = r.locale; tyIn.value = typeName(r.type); tyIn.dataset.v = r.type || '';
            tr.querySelectorAll('.tc-al-bad').forEach(e => e.classList.remove('tc-al-bad'));
            r.hintPrev = null; hint(); dates();
            Log.info('reverted "' + r.name + '"'); sync(); return;
          }
          if (r.id) { r.removed = !r.removed; sync(); } else { tr.remove(); rows.splice(rows.indexOf(r), 1); if (!ghost()) addRow(blank()); sync(); } };
        hint(); dates();
        rows.push(r);
        const g = ghost(); if (g && g !== r) tb.insertBefore(tr, g.tr); else tb.appendChild(tr);
        return r;
      };
      const blank = (name, sort, loc, typ) => ({ id: '', name: name || '', sort: sort || '', locale: loc || '', primary: false, type: typ || '', begin: '', end: '', ended: false });
      const filled = (name, sort, loc, typ) => blank(name, sort || guess(name), loc, typ);
      go.onclick = async () => {
        const note = noteIn.value.trim();
        const todo = rows.filter(r => { const s = state(r); return s === 'del' || (s && r.name.trim()); });
        go.disabled = true; let ok = 0, bad = 0;
        for (const r of todo) {
          const s = state(r), base = ORIGIN + '/' + ent + '/' + gid;
          msg.textContent = 'Submitting ' + (ok + bad + 1) + ' of ' + todo.length + '…';
          let err;
          try {
            if (s === 'del') { const p = new URLSearchParams(); p.set('confirm.edit_note', note); err = await aliasPost(base + '/alias/' + r.id + '/delete', p); }
            else err = await aliasPost(s === 'new' ? base + '/add-alias' : base + '/alias/' + r.id + '/edit', aliasForm(r, note));
          } catch (e) { err = e.message; }
          Log[err ? 'warn' : 'info']((s === 'del' ? 'remove' : s === 'new' ? 'add' : 'edit') + ' "' + r.name + '"', err || 'ok');
          if (err) { bad++; r.tr.title = err; r.tr.classList.add('tc-al-err'); continue; }
          ok++;
          if (s === 'del') { r.tr.remove(); rows.splice(rows.indexOf(r), 1); } else { r.orig = key(r); r.tr.title = ''; if (s === 'new') r.id = 'done'; }
          sync();
        }
        msg.textContent = ok + ' edit' + (ok === 1 ? '' : 's') + ' entered' + (bad ? ', ' + bad + ' failed (hover the red rows)' : '');
        if (o.toast) o.toast(msg.textContent, bad ? 'warn' : 'ok');
        if (o.onSubmit) o.onSubmit(ok, bad);
        sync();
      };
      try {
        for (const r of await aliasLoad(ent, gid, locales, types, o.doc)) { r.orig = key(r); addRow(r); }
      } catch (e) { Log.warn('could not load the aliases', e.message); msg.textContent = 'Could not load the existing aliases'; }
      // a seed in the URL fills the first row; MusicBrainz's own form arrives with the entity's name typed in, which isn't one
      if (o.seed) addRow(filled(o.seed, form.querySelector('input[name="edit-alias.sort_name"]')?.value || ''));
      addRow(blank());
      sync();
      return box;
    }

    function style() {
      if (document.getElementById('tc-alias-style')) return;
      const s = document.createElement('style'); s.id = 'tc-alias-style';
      s.textContent = `
      #tc-alias{font:13px var(--mbu-font, inherit);color:var(--mbu-text);margin:8px 0 16px}
      #tc-alias .tc-al-bar,#tc-alias .tc-al-foot{display:flex;gap:8px;align-items:center;margin:6px 0}
      #tc-alias .tc-al-sum,#tc-alias .tc-al-msg{color:var(--mbu-text-weak)}
      #tc-alias .tc-al-ro{margin:0 0 8px;color:var(--mbu-text-weak)}#tc-alias .tc-al-tbl{width:100%;border-collapse:collapse}#tc-alias .tc-al-tbl th,#tc-alias .tc-al-tbl td{text-align:left;padding:4px 8px;border-bottom:1px solid color-mix(in srgb, currentColor 12%, transparent)}
      #tc-alias{max-width:860px}
      #tc-alias .tc-al-dt{grid-column:1/-1;display:none;gap:16px;align-items:center;padding:2px 0 5px 10px;font-size:12px;color:var(--mbu-text-weak)}
      #tc-alias .tc-al-dopen .tc-al-dt{display:flex}
      #tc-alias .tc-al-dt label{display:inline-flex;align-items:center;gap:6px}
      #tc-alias .tc-al-nw{margin:10px 0 4px}
      #tc-alias .tc-al-nw:not([hidden]){display:block}
      #tc-alias .tc-al-nh{color:var(--mbu-text-weak);font-size:12px;margin-left:6px}
      #tc-alias .tc-al-note{display:block;box-sizing:border-box;width:100%;margin-top:6px;padding:6px 8px;font:inherit;font-size:13px;resize:vertical;border:1px solid var(--mbu-border);border-radius:6px;background:transparent;color:inherit}
      #tc-alias .tc-al-nb{display:inline-flex;align-items:center;gap:5px;background:none;border:0;color:var(--mbu-text-weak);cursor:pointer;font:inherit;font-size:13px;padding:4px 8px;border-radius:4px}
      #tc-alias .tc-al-nb svg{width:14px;height:14px}
      #tc-alias .tc-al-nb:hover{background:var(--mbu-border);color:var(--mbu-text)}
      #tc-alias .tc-al-nb.tc-al-on{color:var(--mbu-accent-text, var(--mbu-accent))}
      #tc-alias .tc-al-dt .tc-al-ew{margin-left:6px;cursor:pointer}
      #tc-alias .tc-al-dt .tc-al-ed{margin:0;accent-color:var(--mbu-accent)}
      #tc-alias .tc-al-cp{background:none;border:0;color:var(--mbu-text-weak);cursor:pointer;padding:2px 6px;border-radius:4px;font-size:14px;margin:0 -10px}
      #tc-alias .tc-al-cp:hover{background:var(--mbu-border);color:var(--mbu-text)}
      #tc-alias .tc-al-dt input:not([type=checkbox]){width:110px;border-bottom:1px solid var(--mbu-border);font-size:13px}
      #tc-alias .tc-al-c{display:inline-flex;align-items:center;gap:4px;justify-content:flex-start;height:24px;padding:0 4px;font:inherit;font-size:12px;white-space:nowrap;overflow:hidden}
      #tc-alias .tc-al-c svg{width:15px;height:15px;flex:0 0 auto}
      #tc-alias .tc-al-c.tc-al-has{color:var(--mbu-accent-text, var(--mbu-accent));font-weight:600}
      #tc-alias .tc-al-dopen .tc-al-c{background:var(--mbu-border)!important}
      #tc-alias input:not([type=checkbox]),#tc-alias select{box-sizing:border-box;width:100%;min-width:0;background:transparent !important;color:var(--mbu-text) !important;border:0;border-bottom:1px solid transparent;border-radius:0;padding:3px 4px;font:inherit;outline:0;filter:none!important}
      #tc-alias .tc-al-head,#tc-alias .tc-al-row{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,3fr) minmax(0,2fr) minmax(0,1.6fr) 92px 26px;gap:4px;align-items:center;padding:1px 4px}
      #tc-alias .tc-al-head{font-weight:600;font-size:12px;color:var(--mbu-text-weak);border-bottom:1px solid var(--mbu-border);padding-bottom:3px}
      @media (max-width:600px){#tc-alias .tc-al-head{display:none}#tc-alias .tc-al-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:2px 6px;padding:6px 2px}#tc-alias .tc-al-n{grid-area:1/1/2/3;font-weight:600}#tc-alias .tc-al-x{grid-area:1/3}#tc-alias .tc-al-sw{grid-area:2/1/3/3}#tc-alias .tc-al-c{grid-area:2/3;justify-content:center}#tc-alias .tc-al-row input:not([type=checkbox]){border-bottom-color:var(--mbu-border-soft, var(--mbu-border))}#tc-alias .tc-al-dt{flex-wrap:wrap;gap:8px 16px;padding-left:0}}
      #tc-alias .tc-al-row{border-bottom:1px solid var(--mbu-border-soft, var(--mbu-border))}
      #tc-alias .tc-al-sw{position:relative;display:flex;min-width:0}
      #tc-alias .tc-al-sw .tc-al-s{padding-right:26px}
      #tc-alias .tc-al-g{position:absolute;right:0;top:50%;transform:translateY(-50%);padding:1px 4px;font:600 11px var(--mbu-font, inherit);line-height:0}#tc-alias .tc-al-g svg{width:16px;height:14px}
      #tc-alias .tc-al-lw{position:relative;display:flex;min-width:0}
      #tc-alias .tc-al-lw .tc-al-l.tc-al-lp{padding-right:22px}
      #tc-alias .tc-al-p{position:absolute;right:0;top:50%;transform:translateY(-50%);width:20px;font-size:15px;line-height:1;color:var(--mbu-text-weak)}
      #tc-alias .tc-al-p[hidden]{display:none}
      #tc-alias .tc-al-p.on{color:#e0a800}
      #tc-alias .tc-al-row :disabled{opacity:.35;cursor:not-allowed}
      #tc-alias input.tc-al-bad:not([type=checkbox]){border-bottom:2px solid #e53935!important;background:rgba(229,57,53,.18)!important;color:#e53935!important;border-radius:3px 3px 0 0}
      #tc-alias .tc-al-msg.tc-al-err{color:#e53935;font-weight:600}
      #tc-alias{position:relative}
      #tc-alias .tc-al-pop{position:absolute;z-index:50;max-height:240px;overflow-y:auto;overflow-x:hidden;background:var(--mbu-bg, #fff);color:var(--mbu-text);border:1px solid var(--mbu-border);border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.18);padding:2px 0;scrollbar-gutter:stable}
      #tc-alias .tc-al-pop[hidden]{display:none}
      #tc-alias .tc-al-opt,#tc-alias .tc-al-none{padding:3px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
      #tc-alias .tc-al-none{color:var(--mbu-text-weak);cursor:default}
      #tc-alias .tc-al-opt:hover{background:var(--mbu-border)}
      #tc-alias .tc-al-opt.on{background:var(--mbu-accent);color:#fff}
      #tc-alias .tc-al-p,#tc-alias .tc-al-g,#tc-alias .tc-al-x,#tc-alias .tc-al-c{background:none!important;border:0;color:var(--mbu-text-weak);cursor:pointer;border-radius:4px;filter:none!important;padding:0}
      #tc-alias .tc-al-x{width:26px;height:24px;font-size:14px}
      #tc-alias :is(.tc-al-g,.tc-al-x,.tc-al-p,.tc-al-c):hover{background:var(--mbu-border)!important;color:var(--mbu-text)}
      #content:has(#tc-alias) > p:has(> a[href$="/add-alias"]){display:none}
      #tc-alias .tc-al-row.tc-al-new{background:rgba(60,170,80,.14)}
      #tc-alias .tc-al-row.tc-al-chg{background:rgba(230,190,40,.18)}
      #tc-alias .tc-al-row.tc-al-del{background:rgba(220,60,60,.16)}
      #tc-alias .tc-al-row.tc-al-del input{text-decoration:line-through}
      #tc-alias .tc-al-row.tc-al-err{box-shadow:inset 0 -2px 0 #d33}
      #tc-alias .tc-al-go{background:transparent !important;color:var(--mbu-ok, #2a8a3a) !important;border:0;border-radius:3px;padding:3px 8px;font:inherit;font-weight:600;cursor:pointer;filter:none!important}
      #tc-alias .tc-al-go:not(:disabled):hover{background:var(--mbu-border)!important}
      #tc-alias .tc-al-go:disabled{opacity:.5}
      .tc-al-pill{display:inline-block;margin-left:4px;padding:0 6px;border-radius:8px;background:var(--mbu-border);color:var(--mbu-text);font-size:11px;font-weight:600;line-height:16px;text-decoration:none}`;
      document.head.appendChild(s);
    }


    // mbuAliasEditor(o) builds the editor and resolves to its element; see the head of this file
    async function open(o) {
      if (o.log) Log = o.log;
      if (o.fetch) fetchMb = o.fetch;
      if (o.origin) ORIGIN = o.origin;
      return editor(o);
    }
    return { open, style, load: aliasLoad };
})();
// END-OF-BLOCK — the sync copies everything above this line.

export default mbuAliasEditor;
export { mbuAliasEditor };
