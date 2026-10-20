/* ConWork — every date box on the site shows and takes dates as mm/dd/yyyy, whatever the computer's language.
 *
 * Each <input type="date"> stays in the page (its id, value "yyyy-mm-dd" and change events work exactly as before),
 * but it is kept out of sight; a text box in its place shows mm/dd/yyyy. Typing a date or picking one from the
 * calendar (click the calendar icon at the right) updates the real date box and fires its change event.
 * Date boxes added later (pop-ups, reports) are handled too.
 */
(function () {
    if (window.__cwDateFormat) return;
    window.__cwDateFormat = true;

    var proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    function toShow(iso) {   // "2026-10-16" → "10/16/2026"
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
        return m ? m[2] + '/' + m[3] + '/' + m[1] : '';
    }
    function toIso(text) {   // "10/16/2026" → "2026-10-16" (or '' when not a real date)
        var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((text || '').trim());
        if (!m) return '';
        var mo = +m[1], d = +m[2], y = +m[3];
        var dt = new Date(y, mo - 1, d);
        if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
        return y + '-' + pad(mo) + '-' + pad(d);
    }

    var css = document.createElement('style');
    css.textContent = 'input.cw-date-native{position:fixed!important;left:0;top:0;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important;border:0!important;padding:0!important;margin:0!important}'
        + 'input.cw-date-text{cursor:text;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%239ca3af%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Crect x=%273%27 y=%274%27 width=%2718%27 height=%2718%27 rx=%272%27/%3E%3Cpath d=%27M16 2v4M8 2v4M3 10h18%27/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-size:16px 16px;padding-right:34px!important}'
        + 'input.cw-date-text.cw-date-bad{border-color:#ef4444!important}';
    (document.head || document.documentElement).appendChild(css);

    function enhance(nat) {
        if (nat._cwDate || nat.type !== 'date') return;
        nat._cwDate = true;
        var txt = document.createElement('input');
        txt.type = 'text';
        txt.inputMode = 'numeric';
        txt.autocomplete = 'off';
        txt.placeholder = 'mm/dd/yyyy';
        txt.maxLength = 10;
        var copy = function () {
            txt.className = (nat.className || '').replace(/\bcw-date-native\b/g, '') + ' cw-date-text';
            txt.disabled = nat.disabled; txt.readOnly = nat.readOnly; txt.required = nat.required;
            if (nat.title) txt.title = nat.title;
        };
        copy();
        nat.parentNode.insertBefore(txt, nat);
        /* the box draws its own calendar icon; hide the old icon-font one next to it */
        nat.parentNode.querySelectorAll('i.fa-calendar, i.fa-calendar-days').forEach(function (i) { i.style.display = 'none'; });
        nat.classList.add('cw-date-native');
        nat.tabIndex = -1;
        nat.setAttribute('aria-hidden', 'true');

        var show = function () { txt.value = toShow(proto.get.call(nat)); txt.classList.remove('cw-date-bad'); };
        show();

        /* code that sets nat.value = '2026-10-16' also updates the text box */
        Object.defineProperty(nat, 'value', {
            configurable: true,
            get: function () { return proto.get.call(nat); },
            set: function (v) { proto.set.call(nat, v); show(); }
        });
        nat.addEventListener('input', show);
        nat.addEventListener('change', show);
        new MutationObserver(function () {
            if (!nat.classList.contains('cw-date-native')) nat.classList.add('cw-date-native');
            copy();
        }).observe(nat, { attributes: true, attributeFilter: ['class', 'disabled', 'readonly'] });

        var commit = function (v) {
            if (proto.get.call(nat) === v) return;
            proto.set.call(nat, v);
            nat.dispatchEvent(new Event('input', { bubbles: true }));
            nat.dispatchEvent(new Event('change', { bubbles: true }));
        };
        /* typing: digits only, slashes added for you */
        txt.addEventListener('input', function () {
            var d = txt.value.replace(/\D/g, '').slice(0, 8);
            var out = d.slice(0, 2) + (d.length > 2 ? '/' + d.slice(2, 4) : '') + (d.length > 4 ? '/' + d.slice(4) : '');
            if (out !== txt.value) txt.value = out;
            var iso = toIso(out);
            txt.classList.toggle('cw-date-bad', out.length === 10 && !iso);
            if (iso) commit(iso);
            else if (!out) commit('');
        });
        txt.addEventListener('blur', function () {
            var iso = toIso(txt.value);
            if (!txt.value) { commit(''); show(); return; }
            if (!iso) { show(); return; }   // not a real date: put back the last good one
            commit(iso); show();
        });
        txt.addEventListener('keydown', function (e) { if (e.key === 'Enter') txt.blur(); });

        /* the calendar: click the right-hand part (where the calendar icon is), or press Alt+↓ */
        var openPicker = function () {
            if (nat.disabled || nat.readOnly) return;
            var r = txt.getBoundingClientRect();
            nat.style.setProperty('left', r.left + 'px', 'important');
            nat.style.setProperty('top', r.bottom - 1 + 'px', 'important');
            try { if (nat.showPicker) { nat.showPicker(); return; } } catch (e) { }
            try { nat.focus(); nat.click(); } catch (e) { }
        };
        txt.addEventListener('click', function (e) {
            var r = txt.getBoundingClientRect();
            if (e.clientX >= r.right - 40 || !txt.value) openPicker();
        });
        txt.addEventListener('keydown', function (e) { if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); openPicker(); } });
    }

    function scan(root) {
        if (!root || !root.querySelectorAll) return;
        if (root.matches && root.matches('input[type="date"]')) enhance(root);
        root.querySelectorAll('input[type="date"]').forEach(enhance);
    }
    function start() {
        scan(document);
        new MutationObserver(function (list) {
            list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); });
        }).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.CwDate = { toShow: toShow, toIso: toIso };
})();

/* ===== Periods (week / month / quarter / year) =====
   One place that turns "this week", "last month", "Q3 2026"… into a date range. Used by time tracking, reports and budgets.
   ConworkPeriods.range('month', new Date(2026, 9, 20)) -> { kind, start: '2026-10-01', end: '2026-10-31', label } */
(function () {
    const pad = n => String(n).padStart(2, '0');
    const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const en = () => typeof i18nIsEnglish === 'function' && i18nIsEnglish();
    const monthName = (d, long) => d.toLocaleDateString(en() ? 'en-GB' : 'th-TH', { month: long ? 'long' : 'short' });
    const year = d => en() ? d.getFullYear() : d.getFullYear() + 543;

    function range(kind, ref) {
        const r = ref ? new Date(ref) : new Date();
        r.setHours(0, 0, 0, 0);
        let start, end, label;
        if (kind === 'week') {
            const dow = (r.getDay() + 6) % 7; // Monday first
            start = new Date(r); start.setDate(r.getDate() - dow);
            end = new Date(start); end.setDate(start.getDate() + 6);
            label = `${start.getDate()} ${monthName(start)} – ${end.getDate()} ${monthName(end)} ${year(end)}`;
        } else if (kind === 'quarter') {
            const q = Math.floor(r.getMonth() / 3);
            start = new Date(r.getFullYear(), q * 3, 1);
            end = new Date(r.getFullYear(), q * 3 + 3, 0);
            label = `${en() ? 'Q' : 'ไตรมาส '}${q + 1} ${year(start)}`;
        } else if (kind === 'year') {
            start = new Date(r.getFullYear(), 0, 1);
            end = new Date(r.getFullYear(), 11, 31);
            label = String(year(start));
        } else { // month
            start = new Date(r.getFullYear(), r.getMonth(), 1);
            end = new Date(r.getFullYear(), r.getMonth() + 1, 0);
            label = `${monthName(start, true)} ${year(start)}`;
            kind = 'month';
        }
        return { kind, start: iso(start), end: iso(end), label };
    }

    /* the period `steps` periods before (negative) or after (positive) the one containing ref */
    function shift(kind, ref, steps) {
        const d = ref ? new Date(ref) : new Date();
        if (kind === 'week') d.setDate(d.getDate() + 7 * steps);
        else if (kind === 'quarter') d.setMonth(d.getMonth() + 3 * steps, 1);
        else if (kind === 'year') d.setFullYear(d.getFullYear() + steps, 0, 1);
        else d.setMonth(d.getMonth() + steps, 1);
        return range(kind, d);
    }

    /* the last `count` periods, newest first */
    function list(kind, count, ref) {
        const out = [];
        for (let i = 0; i < (count || 6); i++) out.push(shift(kind, ref, -i));
        return out;
    }

    /* is a date / ISO timestamp inside the period? */
    function contains(period, value) {
        if (!value) return false;
        const d = String(value).slice(0, 10);
        return d >= period.start && d <= period.end;
    }

    window.ConworkPeriods = { range, shift, list, contains };
})();