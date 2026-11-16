/* ConWork — ลงเวลา / ลางาน (app.html → เมนู "ลงเวลา / ลางาน")
 *   • เลือกประเภท: เข้า–ออกงาน (วันที่ + เวลาเข้า + เวลาออก) · ลากิจ · ลาป่วย (ช่วงวันที่ ทั้งวัน/ครึ่งเช้า/ครึ่งบ่าย + เหตุผล)
 *   • กดบันทึก → เก็บลงตาราง attendance_records (sql/conwork-attendance.sql) แล้วเปิด Google Calendar
 *     พร้อมวันเวลา และใส่อีเมลสมาชิกทุกคนในทีมเป็นแขก (Guests) → กด "บันทึก" แล้ว "ส่ง" ใน Google Calendar = ทุกคนได้อีเมลเชิญ
 *   • รายการของทีม: ทุกคนในทีมเห็น · ลบได้เฉพาะของตัวเอง · เปิด Google Calendar ซ้ำได้
 * ไม่มีตาราง/ไม่มี Supabase: เก็บในเบราว์เซอร์นี้ (localStorage "conwork_attendance") หน้าใช้ได้ตามปกติ */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var app = function () { return typeof App !== 'undefined' ? App : window.App; };
    var client = function () { var s = window.conworkSupabase; return s && s.isAvailable && s.isAvailable() ? s.client : null; };
    var readLS = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    var writeLS = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
    var LKEY = 'conwork_attendance';
    var NOTABLE = /PGRST205|42P01|Could not find the table|does not exist|schema cache/i;
    var NEED_SQL = 'ฐานข้อมูลยังไม่มีตารางลงเวลา · รัน conwork-attendance.sql ใน Neon SQL Editor แล้วลองใหม่ (ตอนนี้เก็บไว้ในเครื่องนี้ก่อน)';

    /* English when the app is set to English (js/i18n.js). This page translates itself (the view is marked data-no-i18n),
       so sentences are never translated word by word. */
    var EN = {
        'เข้า–ออกงาน': 'Work hours', 'ลากิจ': 'Personal leave', 'ลาป่วย': 'Sick leave',
        'ทั้งวัน': 'Full day', 'ครึ่งวันเช้า': 'Morning (half day)', 'ครึ่งวันบ่าย': 'Afternoon (half day)',
        'ลงเวลา / ลางาน': 'Time & Leave', 'เข้า–ออกงาน ลากิจ ลาป่วย': 'Work hours, personal & sick leave',
        'เวลาเข้า–ออกงาน ลากิจ ลาป่วย · แชร์ให้ทีมผ่าน Google Calendar': 'Work hours, personal and sick leave · shared with the team through Google Calendar',
        'บันทึกเวลา / ลางาน': 'Log time / Request leave',
        'บันทึกแล้วจะเปิด Google Calendar พร้อมวันเวลา และเชิญอีเมลสมาชิกทุกคนในทีม': 'Saving opens Google Calendar with the date and time, inviting every team member by email',
        'ประเภท': 'Type', 'วันที่': 'Date', 'เวลาเข้างาน': 'Start time', 'เวลาออกงาน': 'End time',
        'ตั้งแต่วันที่': 'From', 'ถึงวันที่': 'To', 'ช่วงเวลา': 'Period', 'ครึ่งวันเลือกได้เมื่อลาวันเดียว': 'Half days are for one-day leave only',
        'หมายเหตุ (ถ้ามี)': 'Note (optional)', 'เหตุผลการลา': 'Reason for leave',
        'เช่น ทำงานที่ไซต์งาน / WFH': 'e.g. on site / WFH', 'เช่น มีไข้ ไปพบแพทย์': 'e.g. fever, seeing a doctor', 'เช่น ติดต่อราชการ': 'e.g. government errand',
        'แชร์ให้สมาชิกในทีม': 'Share with team members', 'เลือกทั้งหมด': 'Select all', 'ไม่เลือก': 'None',
        'ไม่มีอีเมลในโปรไฟล์': 'No email in profile', 'ยังไม่มีสมาชิกคนอื่นในทีมนี้': 'No other members in this team yet',
        'ยังไม่ได้เลือก': 'none selected', 'บันทึกและเปิด Google Calendar': 'Save and open Google Calendar',
        'HINT': 'In the Google Calendar tab, press <b>Save</b>, then <b>Send</b> to email the invitation to everyone · you need to be signed in to Google in this browser',
        'บันทึกแล้ว': 'Saved', 'เปิด Google Calendar อีกครั้ง': 'Open Google Calendar again', 'คัดลอกอีเมลทั้งหมด': 'Copy all emails',
        'บันทึกรายการใหม่': 'New entry', 'คัดลอกแล้ว': 'Copied', 'คัดลอก:': 'Copy:',
        'รายการของทีม': 'Team entries', 'ทั้งหมด': 'All', 'ของฉัน': 'Mine', 'เฉพาะลา': 'Leave only',
        'ย้อนหลัง 120 วัน และที่จะถึง': 'last 120 days and upcoming', 'ทีม': 'Team', 'วัน': 'days', 'คุณ': 'you', 'สมาชิก': 'Member',
        'ยังไม่มีรายการ': 'No entries yet', 'กำลังโหลด…': 'Loading…', 'เปิดใน Google Calendar': 'Open in Google Calendar', 'ลบ': 'Delete',
        'เลือกวันที่': 'Pick a date', 'เลือกเวลาเข้างานและออกงาน': 'Pick the start and end time',
        'เวลาออกงานต้องหลังเวลาเข้างาน': 'The end time must be after the start time', 'เวลาออกต้องหลังเวลาเข้า': 'End must be after start',
        'เลือกวันที่ลา': 'Pick the leave date', 'วันสุดท้ายต้องไม่ก่อนวันแรก': 'The last day cannot be before the first day', 'ใส่เหตุผลการลา': 'Enter the reason for leave',
        'บันทึกไม่สำเร็จ: ': 'Could not save: ', 'โหลดรายการไม่สำเร็จ: ': 'Could not load entries: ', 'ลบไม่สำเร็จ: ': 'Could not delete: ',
        'ลบรายการนี้? (นัดใน Google Calendar ต้องลบเองในปฏิทิน)': 'Delete this entry? (The Google Calendar event has to be deleted in the calendar.)',
        'ไม่ได้เลือกใครให้แชร์': 'not shared with anyone',
        'เบราว์เซอร์บล็อกแท็บใหม่ กดปุ่มด้านล่างเพื่อเปิด': 'the browser blocked the new tab, use the button below',
        'ชื่อ': 'Name', 'วันเวลา': 'When', 'หมายเหตุ': 'Note', 'บันทึกจาก ConWork': 'Saved from ConWork',
        'เข้างาน': 'In', 'ออกงาน': 'Out', 'น.': '', 'รวม': 'Total', 'ชม.': 'h', 'นาที': 'min'
    };
    EN[NEED_SQL] = 'The database has no time & leave table yet · run conwork-attendance.sql in the Neon SQL Editor (saved on this device for now)';
    var isEn = function () { try { return typeof i18nIsEnglish === 'function' && i18nIsEnglish(); } catch (e) { return false; } };
    var T = function (th) { return isEn() && EN[th] != null ? EN[th] : th; };
    /* the menu label and the phone tile are translated by js/i18n.js itself */
    try { if (typeof th2en !== 'undefined') { th2en['ลงเวลา / ลางาน'] = EN['ลงเวลา / ลางาน']; th2en['เข้า–ออกงาน ลากิจ ลาป่วย'] = EN['เข้า–ออกงาน ลากิจ ลาป่วย']; } } catch (e) { }

    var KIND = {
        work: { get label() { return T('เข้า–ออกงาน'); }, icon: 'fa-solid fa-business-time', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
        personal_leave: { get label() { return T('ลากิจ'); }, icon: 'fa-solid fa-suitcase', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
        sick_leave: { get label() { return T('ลาป่วย'); }, icon: 'fa-solid fa-briefcase-medical', chip: 'bg-rose-50 text-rose-700 border-rose-200' }
    };
    var PERIOD_TH = { full: 'ทั้งวัน', morning: 'ครึ่งวันเช้า', afternoon: 'ครึ่งวันบ่าย' };
    var PERIOD = { get full() { return T(PERIOD_TH.full); }, get morning() { return T(PERIOD_TH.morning); }, get afternoon() { return T(PERIOD_TH.afternoon); } };
    /* half-day leave hours (shown in Google Calendar) */
    var HALF = { morning: ['09:00', '12:00'], afternoon: ['13:00', '18:00'] };
    var TH_MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    var TH_DAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    var EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var EN_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // ---------- who / which team ----------
    function me() {
        var A = app(), u = (A && A.state && A.state.currentUser) || null;
        if (!u) try { u = JSON.parse(sessionStorage.getItem('conwork_user') || localStorage.getItem('conwork_user') || 'null'); } catch (e) { }
        u = u || {};
        return { id: String(u.id || u.user_id || ''), name: u.name || u.username || u.email || '', email: String(u.email || '').toLowerCase() };
    }
    function team() {
        var A = app(), u = (A && A.state && A.state.currentUser) || {};
        var id = A && A._teamId ? A._teamId() : String(u.workspaceId || 'none');
        var ws = ((A && A.state && A.state.workspaces) || []).find(function (w) { return String(w.workspace_id) === String(id); }) || {};
        var nameEl = $('header-team-name');
        return { id: id, name: ws.name || u.workspaceName || (nameEl ? nameEl.textContent.trim() : '') };
    }
    /* everyone in the team the app is open in (js/app.js fills mockUsers from company_members + profiles) */
    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function members() {
        var list = typeof mockUsers !== 'undefined' ? mockUsers : [];
        var seen = {};
        return list.map(function (u) {
            var email = String(u.email || '').trim().toLowerCase();
            /* js/app.js puts "<id>@company.com" when a profile has no email: not a real address */
            if (u.id && email === String(u.id).substring(0, 8).toLowerCase() + '@company.com') email = '';
            return { id: String(u.id), name: u.name || u.username || email, email: EMAIL_RE.test(email) ? email : '' };
        }).filter(function (m) { if (seen[m.id]) return false; seen[m.id] = 1; return true; });
    }

    // ---------- dates ----------
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var ymd = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var parseYmd = function (s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
    var addDays = function (s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
    var hm = function (t) { return String(t || '').slice(0, 5); };
    function thDate(s, withDay) {
        var d = parseYmd(s);
        if (isEn()) return (withDay ? EN_DAY[d.getDay()] + ' ' : '') + d.getDate() + ' ' + EN_MON[d.getMonth()] + ' ' + d.getFullYear();
        return (withDay ? TH_DAY[d.getDay()] + ' ' : '') + d.getDate() + ' ' + TH_MON[d.getMonth()] + ' ' + (d.getFullYear() + 543);
    }
    function dayCount(r) {
        if (r.kind === 'work') return 1;
        if (r.period !== 'full') return 0.5;
        return Math.round((parseYmd(r.end_date) - parseYmd(r.start_date)) / 864e5) + 1;
    }
    function whenText(r) {
        if (r.kind === 'work') return thDate(r.start_date, true) + ' · ' + hm(r.time_in) + '–' + hm(r.time_out) + (isEn() ? '' : ' น.');
        var range = r.start_date === r.end_date ? thDate(r.start_date, true) : thDate(r.start_date, true) + ' – ' + thDate(r.end_date, true);
        return range + ' · ' + PERIOD[r.period || 'full'] + (r.period === 'full' ? ' (' + dayCount(r) + ' ' + T('วัน') + ')' : '');
    }

    // ---------- Google Calendar ----------
    /* Google Calendar's "add event" page, filled in: title, date/time, details and every guest's email.
       Saving it there asks "ส่งอีเมลเชิญถึงแขก?" → ส่ง = every member gets the invitation in Gmail. No Google setup needed. */
    function gcalUrl(r, teamName) {
        var who = r.user_name || T('สมาชิก');
        var k = KIND[r.kind];
        var title = r.kind === 'work'
            ? who + ' · ' + T('เข้างาน') + ' ' + hm(r.time_in) + ' – ' + T('ออกงาน') + ' ' + hm(r.time_out)
            : who + ' · ' + k.label + (r.period !== 'full' ? ' (' + PERIOD[r.period] + ')' : '');
        var compact = function (s) { return String(s).replace(/-/g, ''); };
        var t = function (s) { return hm(s).replace(':', '') + '00'; };
        var dates;
        if (r.kind === 'work') dates = compact(r.start_date) + 'T' + t(r.time_in) + '/' + compact(r.start_date) + 'T' + t(r.time_out);
        else if (r.period !== 'full') dates = compact(r.start_date) + 'T' + t(HALF[r.period][0]) + '/' + compact(r.start_date) + 'T' + t(HALF[r.period][1]);
        else dates = compact(r.start_date) + '/' + compact(addDays(r.end_date, 1)); // all-day: the end date is the day after
        var details = [
            T('ประเภท') + ': ' + k.label,
            T('ชื่อ') + ': ' + who,
            T('วันเวลา') + ': ' + whenText(r),
            r.note ? T('หมายเหตุ') + ': ' + r.note : '',
            teamName ? T('ทีม') + ': ' + teamName : '',
            '',
            T('บันทึกจาก ConWork') + ' · ' + location.origin + location.pathname
        ].filter(function (x, i) { return x !== '' || i === 5; }).join('\n');
        var tz = 'Asia/Bangkok';
        try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { }
        var q = [
            'action=TEMPLATE',
            'text=' + encodeURIComponent(title),
            'dates=' + dates,
            'ctz=' + encodeURIComponent(tz),
            'details=' + encodeURIComponent(details)
        ];
        var guests = (r.guest_emails || []).filter(Boolean);
        if (guests.length) q.push('add=' + guests.map(encodeURIComponent).join(','));
        return 'https://calendar.google.com/calendar/render?' + q.join('&');
    }

    // ---------- data ----------
    var usingLocal = false;
    function load(teamId) {
        var sb = client();
        var local = function () { return readLS(LKEY, []).filter(function (x) { return String(x.company_id) === String(teamId); }); };
        if (!sb || teamId === 'none') { usingLocal = true; return Promise.resolve(local()); }
        var since = addDays(ymd(new Date()), -120);
        return sb.from('attendance_records').select('*').eq('company_id', teamId).gte('end_date', since)
            .order('start_date', { ascending: false }).order('created_at', { ascending: false }).limit(300)
            .then(function (r) {
                if (r.error) {
                    if (NOTABLE.test((r.error.code || '') + ' ' + r.error.message)) { usingLocal = true; return local(); }
                    throw r.error;
                }
                usingLocal = false;
                return r.data || [];
            });
    }
    function save(rec) {
        var sb = client();
        var saveLocal = function () {
            var all = readLS(LKEY, []);
            rec.id = 'local_' + Date.now(); rec.created_at = new Date().toISOString();
            all.unshift(rec); writeLS(LKEY, all);
            return rec;
        };
        if (!sb || rec.company_id === 'none' || usingLocal) return Promise.resolve(saveLocal());
        var row = {};
        ['company_id', 'user_id', 'user_name', 'kind', 'start_date', 'end_date', 'time_in', 'time_out', 'period', 'note', 'guest_emails'].forEach(function (k) { row[k] = rec[k]; });
        return sb.from('attendance_records').insert(row).select().single().then(function (r) {
            if (r.error) {
                if (NOTABLE.test((r.error.code || '') + ' ' + r.error.message)) { usingLocal = true; return saveLocal(); }
                throw r.error;
            }
            return r.data;
        });
    }
    function remove(id) {
        if (String(id).indexOf('local_') === 0 || !client()) {
            writeLS(LKEY, readLS(LKEY, []).filter(function (x) { return String(x.id) !== String(id); }));
            return Promise.resolve();
        }
        return client().from('attendance_records').delete().eq('id', id).then(function (r) { if (r.error) throw r.error; });
    }

    // ---------- page ----------
    var state = { kind: 'work', rows: [], filter: 'all', guests: null, last: null };
    var inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
    var labelCls = 'block text-xs font-semibold text-gray-500 mb-1';

    function inject() {
        if ($('view-attendance')) return;
        var cal = $('view-calendar'); if (!cal) return;
        var v = document.createElement('div');
        v.id = 'view-attendance';
        v.className = 'view-section hidden h-full overflow-y-auto custom-scrollbar p-4 sm:p-6';
        v.setAttribute('data-no-i18n', '');
        v.setAttribute('data-lang', isEn() ? 'en' : 'th');
        var kindBtn = function (k) {
            return '<button type="button" data-at-kind="' + k + '" class="at-kind">'
                + '<i class="' + KIND[k].icon + '"></i><span class="leading-tight">' + KIND[k].label + '</span></button>';
        };
        v.innerHTML = '<div class="grid grid-cols-1 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-6 max-w-6xl">'
            /* ---- form ---- */
            + '<section class="bg-white border border-gray-200 rounded-2xl shadow-sm self-start">'
            + '<div class="px-5 pt-5 pb-3"><h3 class="font-bold text-gray-800">' + T('บันทึกเวลา / ลางาน') + '</h3>'
            + '<p class="text-xs text-gray-500 mt-0.5">' + T('บันทึกแล้วจะเปิด Google Calendar พร้อมวันเวลา และเชิญอีเมลสมาชิกทุกคนในทีม') + '</p></div>'
            + '<form id="at-form" class="px-5 pb-5 space-y-4" novalidate>'
            + '<div class="grid grid-cols-3 gap-2" role="radiogroup" aria-label="' + T('ประเภท') + '">' + kindBtn('work') + kindBtn('personal_leave') + kindBtn('sick_leave') + '</div>'
            /* work */
            + '<div id="at-work" class="grid grid-cols-1 sm:grid-cols-3 gap-3">'
            + '<label class="sm:col-span-3"><span class="' + labelCls + '">' + T('วันที่') + '</span><input id="at-wdate" type="date" class="' + inputCls + '"></label>'
            + '<label class="sm:col-span-1"><span class="' + labelCls + '">' + T('เวลาเข้างาน') + '</span><input id="at-tin" type="time" value="09:00" class="' + inputCls + '"></label>'
            + '<label class="sm:col-span-1"><span class="' + labelCls + '">' + T('เวลาออกงาน') + '</span><input id="at-tout" type="time" value="18:00" class="' + inputCls + '"></label>'
            + '<div class="sm:col-span-1 flex items-end"><span id="at-hours" class="text-xs text-gray-500 pb-3"></span></div>'
            + '</div>'
            /* leave */
            + '<div id="at-leave" class="hidden space-y-3">'
            + '<div class="grid grid-cols-2 gap-3">'
            + '<label><span class="' + labelCls + '">' + T('ตั้งแต่วันที่') + '</span><input id="at-from" type="date" class="' + inputCls + '"></label>'
            + '<label><span class="' + labelCls + '">' + T('ถึงวันที่') + '</span><input id="at-to" type="date" class="' + inputCls + '"></label>'
            + '</div>'
            + '<div><span class="' + labelCls + '">' + T('ช่วงเวลา') + '</span><div class="flex gap-2" id="at-period">'
            + ['full', 'morning', 'afternoon'].map(function (p) {
                return '<label class="flex-1"><input type="radio" name="at-period" value="' + p + '" class="peer sr-only"' + (p === 'full' ? ' checked' : '') + '>'
                    + '<span class="block text-center px-2 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 cursor-pointer peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 peer-disabled:opacity-40 peer-disabled:cursor-not-allowed">' + PERIOD[p] + '</span></label>';
            }).join('') + '</div><p id="at-period-note" class="hidden text-[11px] text-gray-400 mt-1">' + T('ครึ่งวันเลือกได้เมื่อลาวันเดียว') + '</p></div>'
            + '<p id="at-days" class="text-xs text-gray-500"></p>'
            + '</div>'
            + '<label class="block"><span class="' + labelCls + '" id="at-note-label"></span><textarea id="at-note" rows="2" maxlength="1000" class="' + inputCls + ' resize-y" placeholder=""></textarea></label>'
            /* guests */
            + '<div class="rounded-xl border border-gray-200 bg-gray-50/60">'
            + '<button type="button" id="at-guests-toggle" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left">'
            + '<span class="flex items-center gap-2 min-w-0"><i class="fa-regular fa-envelope text-blue-600"></i><span class="font-semibold text-gray-700">' + T('แชร์ให้สมาชิกในทีม') + '</span><span id="at-guests-count" class="text-xs text-gray-500 truncate"></span></span>'
            + '<i id="at-guests-chev" class="fa-solid fa-chevron-down text-xs text-gray-400 transition-transform"></i></button>'
            + '<div id="at-guests" class="hidden border-t border-gray-200 px-3 py-2 max-h-56 overflow-y-auto custom-scrollbar"></div>'
            + '</div>'
            + '<p id="at-msg" class="hidden text-sm"></p>'
            + '<button type="submit" id="at-submit" class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">'
            + '<i class="fa-regular fa-calendar-plus"></i><span>' + T('บันทึกและเปิด Google Calendar') + '</span></button>'
            + '<p class="text-[11px] leading-relaxed text-gray-400">' + (isEn() ? EN.HINT : 'ในหน้า Google Calendar ที่เปิดขึ้น กด <b>บันทึก (Save)</b> แล้วเลือก <b>ส่ง (Send)</b> เพื่อส่งอีเมลเชิญถึงทุกคน · ต้องล็อกอิน Google ในเบราว์เซอร์นี้') + '</p>'
            + '</form>'
            /* after saving */
            + '<div id="at-done" class="hidden px-5 pb-5"><div class="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">'
            + '<div class="font-semibold flex items-center gap-2"><i class="fa-solid fa-circle-check"></i> ' + T('บันทึกแล้ว') + '</div>'
            + '<p id="at-done-text" class="mt-1 text-emerald-700"></p>'
            + '<div class="flex flex-wrap gap-2 mt-3">'
            + '<a id="at-done-open" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"><i class="fa-regular fa-calendar"></i> ' + T('เปิด Google Calendar อีกครั้ง') + '</a>'
            + '<button type="button" id="at-done-copy" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-700 text-xs font-semibold hover:bg-emerald-100"><i class="fa-regular fa-copy"></i> ' + T('คัดลอกอีเมลทั้งหมด') + '</button>'
            + '<button type="button" id="at-done-new" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-emerald-700 text-xs font-semibold hover:underline">' + T('บันทึกรายการใหม่') + '</button>'
            + '</div></div></div>'
            + '</section>'
            /* ---- list ---- */
            + '<section class="bg-white border border-gray-200 rounded-2xl shadow-sm min-w-0">'
            + '<div class="px-5 pt-5 pb-3 flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-bold text-gray-800">' + T('รายการของทีม') + '</h3>'
            + '<p id="at-team" class="text-xs text-gray-500 mt-0.5"></p></div>'
            + '<div class="flex rounded-lg border border-gray-200 p-0.5 text-xs font-semibold" id="at-filter">'
            + '<button type="button" data-at-f="all" class="px-3 py-1.5 rounded-md">' + T('ทั้งหมด') + '</button>'
            + '<button type="button" data-at-f="mine" class="px-3 py-1.5 rounded-md">' + T('ของฉัน') + '</button>'
            + '<button type="button" data-at-f="leave" class="px-3 py-1.5 rounded-md">' + T('เฉพาะลา') + '</button></div></div>'
            + '<div id="at-stats" class="px-5 pb-3 grid grid-cols-3 gap-2"></div>'
            + '<p id="at-local" class="hidden mx-5 mb-3 text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2"></p>'
            + '<div id="at-list" class="px-5 pb-5 divide-y divide-gray-100"></div>'
            + '</section>'
            + '</div>';
        cal.parentNode.insertBefore(v, cal);
        bind();
    }

    function setKind(k) {
        state.kind = k;
        document.querySelectorAll('#view-attendance .at-kind').forEach(function (b) {
            var on = b.getAttribute('data-at-kind') === k;
            b.setAttribute('aria-checked', on);
            b.className = 'at-kind min-w-0 flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-semibold text-center border transition-colors '
                + (on ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50');
            b.setAttribute('role', 'radio');
        });
        $('at-work').classList.toggle('hidden', k !== 'work');
        $('at-leave').classList.toggle('hidden', k === 'work');
        $('at-note-label').textContent = T(k === 'work' ? 'หมายเหตุ (ถ้ามี)' : 'เหตุผลการลา');
        $('at-note').placeholder = T(k === 'work' ? 'เช่น ทำงานที่ไซต์งาน / WFH' : (k === 'sick_leave' ? 'เช่น มีไข้ ไปพบแพทย์' : 'เช่น ติดต่อราชการ'));
        msg('');
        syncLeave(); syncHours();
    }
    function syncHours() {
        var a = $('at-tin').value, b = $('at-tout').value, el = $('at-hours');
        if (!a || !b) { el.textContent = ''; return; }
        var m = (+b.slice(0, 2) * 60 + +b.slice(3, 5)) - (+a.slice(0, 2) * 60 + +a.slice(3, 5));
        el.textContent = m > 0 ? T('รวม') + ' ' + Math.floor(m / 60) + ' ' + T('ชม.') + (m % 60 ? ' ' + (m % 60) + ' ' + T('นาที') : '') : '';
        el.className = 'text-xs pb-3 ' + (m > 0 ? 'text-gray-500' : 'text-red-600');
        if (m <= 0) el.textContent = T('เวลาออกต้องหลังเวลาเข้า');
    }
    function syncLeave() {
        var f = $('at-from'), t = $('at-to');
        if (f.value && (!t.value || t.value < f.value)) t.value = f.value;
        t.min = f.value || '';
        var one = f.value && t.value && f.value === t.value;
        document.querySelectorAll('#at-period input').forEach(function (r) { if (r.value !== 'full') r.disabled = !one; });
        if (!one) document.querySelector('#at-period input[value="full"]').checked = true;
        $('at-period-note').classList.toggle('hidden', !!one);
        var p = (document.querySelector('#at-period input:checked') || {}).value || 'full';
        $('at-days').textContent = f.value && t.value ? T('รวม') + ' ' + dayCount({ kind: state.kind, period: p, start_date: f.value, end_date: t.value }) + ' ' + T('วัน') : '';
    }

    function drawGuests() {
        var you = me();
        var list = members().filter(function (m) { return m.id !== you.id && (!you.email || m.email !== you.email); });
        if (!state.guests) state.guests = {};
        list.forEach(function (m) { if (m.email && !(m.email in state.guests)) state.guests[m.email] = true; });
        var box = $('at-guests');
        box.innerHTML = list.length ? '<div class="flex items-center justify-between py-1.5 text-xs"><span class="text-gray-500">' + (isEn() ? list.length + ' team members' : 'สมาชิกในทีม ' + list.length + ' คน') + '</span>'
            + '<span class="flex gap-3"><button type="button" data-at-all="1" class="font-semibold text-blue-600 hover:underline">' + T('เลือกทั้งหมด') + '</button><button type="button" data-at-all="0" class="font-semibold text-gray-500 hover:underline">' + T('ไม่เลือก') + '</button></span></div>'
            + list.map(function (m) {
                return '<label class="flex items-center gap-3 py-1.5 ' + (m.email ? 'cursor-pointer' : 'opacity-50') + '">'
                    + '<input type="checkbox" class="w-4 h-4 accent-blue-600" data-at-guest="' + esc(m.email) + '"' + (m.email ? (state.guests[m.email] ? ' checked' : '') : ' disabled') + '>'
                    + '<span class="min-w-0 flex-1"><span class="block text-sm text-gray-800 truncate" data-no-i18n>' + esc(m.name) + '</span>'
                    + '<span class="block text-xs text-gray-400 truncate" data-no-i18n>' + (m.email ? esc(m.email) : T('ไม่มีอีเมลในโปรไฟล์')) + '</span></span></label>';
            }).join('')
            : '<p class="text-sm text-gray-400 py-2">' + T('ยังไม่มีสมาชิกคนอื่นในทีมนี้') + '</p>';
        countGuests();
    }
    function chosenGuests() {
        var you = me();
        return members().filter(function (m) { return m.email && m.id !== you.id && m.email !== you.email && state.guests && state.guests[m.email]; }).map(function (m) { return m.email; });
    }
    function countGuests() {
        var n = chosenGuests().length;
        $('at-guests-count').textContent = '· ' + (n ? n + (isEn() ? (n === 1 ? ' email' : ' emails') : ' อีเมล') : T('ยังไม่ได้เลือก'));
    }
    function msg(text, ok) {
        var n = $('at-msg'); if (!n) return;
        n.textContent = text || '';
        n.className = text ? 'text-sm ' + (ok ? 'text-emerald-600' : 'text-red-600') : 'hidden';
    }

    function bind() {
        var v = $('view-attendance');
        v.addEventListener('click', function (e) {
            var k = e.target.closest('[data-at-kind]'); if (k) { setKind(k.getAttribute('data-at-kind')); return; }
            var f = e.target.closest('[data-at-f]'); if (f) { state.filter = f.getAttribute('data-at-f'); drawList(); return; }
            var all = e.target.closest('[data-at-all]');
            if (all) { var on = all.getAttribute('data-at-all') === '1'; members().forEach(function (m) { if (m.email) state.guests[m.email] = on; }); drawGuests(); return; }
            var del = e.target.closest('[data-at-del]'); if (del) { delRow(del); return; }
        });
        $('at-guests-toggle').addEventListener('click', function () {
            var open = $('at-guests').classList.toggle('hidden') === false;
            $('at-guests-chev').classList.toggle('rotate-180', open);
        });
        $('at-guests').addEventListener('change', function (e) {
            var c = e.target.closest('[data-at-guest]'); if (!c) return;
            state.guests[c.getAttribute('data-at-guest')] = c.checked; countGuests();
        });
        ['at-tin', 'at-tout'].forEach(function (id) { $(id).addEventListener('input', syncHours); });
        ['at-from', 'at-to'].forEach(function (id) { $(id).addEventListener('change', syncLeave); });
        $('at-period').addEventListener('change', syncLeave);
        $('at-form').addEventListener('submit', submit);
        $('at-done-new').addEventListener('click', function () { $('at-done').classList.add('hidden'); $('at-form').classList.remove('hidden'); $('at-note').value = ''; });
        $('at-done-copy').addEventListener('click', function () {
            var list = (state.last && state.last.guest_emails) || [];
            copy(list.join(', '), this);
        });
    }
    function copy(text, btn) {
        var done = function () { var o = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-check"></i> ' + T('คัดลอกแล้ว'); setTimeout(function () { btn.innerHTML = o; }, 2000); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { window.prompt(T('คัดลอก:'), text); });
        else window.prompt(T('คัดลอก:'), text);
    }

    function submit(e) {
        e.preventDefault();
        var you = me(), t = team(), k = state.kind;
        var rec = { company_id: t.id, user_id: you.id || null, user_name: you.name, kind: k, note: $('at-note').value.trim() || null, guest_emails: chosenGuests(), period: 'full', time_in: null, time_out: null };
        if (k === 'work') {
            rec.start_date = rec.end_date = $('at-wdate').value;
            rec.time_in = $('at-tin').value; rec.time_out = $('at-tout').value;
            if (!rec.start_date) { msg(T('เลือกวันที่')); $('at-wdate').focus(); return; }
            if (!rec.time_in || !rec.time_out) { msg(T('เลือกเวลาเข้างานและออกงาน')); return; }
            if (rec.time_out <= rec.time_in) { msg(T('เวลาออกงานต้องหลังเวลาเข้างาน')); $('at-tout').focus(); return; }
        } else {
            rec.start_date = $('at-from').value; rec.end_date = $('at-to').value || rec.start_date;
            rec.period = (document.querySelector('#at-period input:checked') || {}).value || 'full';
            if (!rec.start_date) { msg(T('เลือกวันที่ลา')); $('at-from').focus(); return; }
            if (rec.end_date < rec.start_date) { msg(T('วันสุดท้ายต้องไม่ก่อนวันแรก')); return; }
            if (!rec.note) { msg(T('ใส่เหตุผลการลา')); $('at-note').focus(); return; }
        }
        /* open Google Calendar right away (still inside the click, so the browser does not block the new tab) */
        var url = gcalUrl(rec, t.name);
        var win = null;
        try { win = window.open(url, '_blank'); if (win) win.opener = null; } catch (er) { }
        var btn = $('at-submit'); btn.disabled = true; msg('');
        save(rec).then(function (saved) {
            btn.disabled = false;
            state.last = Object.assign({}, rec, saved || {});
            $('at-form').classList.add('hidden');
            $('at-done').classList.remove('hidden');
            $('at-done-open').href = url;
            var n = rec.guest_emails.length;
            $('at-done-text').textContent = KIND[k].label + ' · ' + whenText(rec) + ' · '
                + (n ? (isEn() ? n + ' email(s) added as guests in Google Calendar. Press "Save" and then "Send" there to email everyone.' : 'เชิญ ' + n + ' อีเมลใน Google Calendar แล้ว กด "บันทึก" และ "ส่ง" ในหน้านั้นเพื่อส่งอีเมลถึงทุกคน') : T('ไม่ได้เลือกใครให้แชร์'))
                + (win === null ? ' (' + T('เบราว์เซอร์บล็อกแท็บใหม่ กดปุ่มด้านล่างเพื่อเปิด') + ')' : '');
            var A = app(); if (A && A._showToast) A._showToast(isEn() ? KIND[k].label + ' saved' : 'บันทึก' + KIND[k].label + 'แล้ว', 'success');
            refresh();
        }).catch(function (er) {
            btn.disabled = false;
            msg(T('บันทึกไม่สำเร็จ: ') + (er && er.message || er));
        });
    }

    function delRow(b) {
        var id = b.getAttribute('data-at-del');
        if (!window.confirm(T('ลบรายการนี้? (นัดใน Google Calendar ต้องลบเองในปฏิทิน)'))) return;
        b.disabled = true;
        remove(id).then(refresh).catch(function (er) { b.disabled = false; alert(T('ลบไม่สำเร็จ: ') + (er.message || er)); });
    }

    function drawStats() {
        var you = me(), now = new Date(), y = now.getFullYear(), mo = now.getMonth();
        var mine = state.rows.filter(function (r) { var d = parseYmd(r.start_date); return String(r.user_id) === you.id && d.getFullYear() === y && d.getMonth() === mo; });
        var sum = function (k) { return mine.filter(function (r) { return r.kind === k; }).reduce(function (a, r) { return a + dayCount(r); }, 0); };
        var tile = function (k, n, unit) {
            return '<div class="rounded-xl border px-3 py-2 ' + KIND[k].chip + '"><div class="text-[11px] font-semibold opacity-80 truncate"><i class="' + KIND[k].icon + ' mr-1"></i>' + KIND[k].label + '</div>'
                + '<div class="text-lg font-bold leading-tight">' + n + ' <span class="text-xs font-semibold">' + T(unit) + '</span></div></div>';
        };
        $('at-stats').innerHTML = tile('work', sum('work'), 'วัน') + tile('personal_leave', sum('personal_leave'), 'วัน') + tile('sick_leave', sum('sick_leave'), 'วัน');
        $('at-stats').title = isEn() ? 'Mine, ' + EN_MON[mo] : 'ของฉัน เดือน' + TH_MON[mo];
    }
    function drawList() {
        var you = me(), box = $('at-list');
        document.querySelectorAll('#at-filter [data-at-f]').forEach(function (b) {
            var on = b.getAttribute('data-at-f') === state.filter;
            b.className = 'px-3 py-1.5 rounded-md ' + (on ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50');
        });
        var rows = state.rows.filter(function (r) {
            if (state.filter === 'mine') return String(r.user_id) === you.id;
            if (state.filter === 'leave') return r.kind !== 'work';
            return true;
        });
        var t = team();
        box.innerHTML = rows.length ? rows.map(function (r) {
            var k = KIND[r.kind] || KIND.work, own = String(r.user_id) === you.id;
            var initial = String(r.user_name || '?').trim().charAt(0).toUpperCase();
            var n = (r.guest_emails || []).length;
            return '<div class="flex items-start gap-3 py-3">'
                + '<span class="w-9 h-9 rounded-full bg-gray-100 text-gray-600 font-bold text-sm flex items-center justify-center flex-none" data-no-i18n>' + esc(initial) + '</span>'
                + '<div class="min-w-0 flex-1">'
                + '<div class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="font-semibold text-gray-800 text-sm truncate" data-no-i18n>' + esc(r.user_name || T('สมาชิก')) + (own ? ' <span class="text-xs font-normal text-gray-400">(' + T('คุณ') + ')</span>' : '') + '</span>'
                + '<span class="inline-flex items-center gap-1 text-[11px] font-semibold border rounded-full px-2 py-0.5 ' + k.chip + '"><i class="' + k.icon + '"></i>' + k.label + '</span></div>'
                + '<div class="text-xs text-gray-600 mt-0.5">' + esc(whenText(r)) + '</div>'
                + (r.note ? '<div class="text-xs text-gray-400 mt-0.5 break-words" data-no-i18n>' + esc(r.note) + '</div>' : '')
                + '</div>'
                + '<div class="flex items-center gap-1 flex-none">'
                + '<a href="' + esc(gcalUrl(r, t.name)) + '" target="_blank" rel="noopener" title="' + T('เปิดใน Google Calendar') + (n ? ' (' + n + ')' : '') + '" class="w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50"><i class="fa-regular fa-calendar-plus"></i></a>'
                + (own ? '<button type="button" data-at-del="' + esc(r.id) + '" title="' + T('ลบ') + '" class="w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><i class="fa-regular fa-trash-can"></i></button>' : '')
                + '</div></div>';
        }).join('') : '<p class="text-sm text-gray-400 py-6 text-center">' + T('ยังไม่มีรายการ') + '</p>';
    }
    function refresh() {
        var t = team();
        $('at-team').innerHTML = (t.name ? T('ทีม') + ' <b class="text-gray-700">' + esc(t.name) + '</b> · ' : '') + T('ย้อนหลัง 120 วัน และที่จะถึง');
        $('at-list').innerHTML = '<p class="text-sm text-gray-400 py-6 text-center"><i class="fa-solid fa-spinner fa-spin mr-1"></i> ' + T('กำลังโหลด…') + '</p>';
        return load(t.id).then(function (rows) {
            state.rows = rows.slice().sort(function (a, b) { return a.start_date < b.start_date ? 1 : a.start_date > b.start_date ? -1 : String(b.created_at || '').localeCompare(String(a.created_at || '')); });
            var loc = $('at-local');
            loc.textContent = T(NEED_SQL);
            loc.classList.toggle('hidden', !(usingLocal && client() && t.id !== 'none'));
            drawStats(); drawList();
        }).catch(function (er) {
            $('at-list').innerHTML = '<p class="text-sm text-red-600 py-4">' + T('โหลดรายการไม่สำเร็จ: ') + esc(er && er.message || er) + '</p>';
        });
    }

    function onShow() {
        /* built in the app's language: rebuild after the language was switched */
        var old = $('view-attendance');
        if (old && old.getAttribute('data-lang') !== (isEn() ? 'en' : 'th')) old.parentNode.removeChild(old);
        inject();
        if (!$('view-attendance')) return;
        $('view-attendance').classList.remove('hidden');
        var today = ymd(new Date());
        if (!$('at-wdate').value) $('at-wdate').value = today;
        if (!$('at-from').value) { $('at-from').value = today; $('at-to').value = today; }
        setKind(state.kind);
        drawGuests();
        refresh();
    }

    function open() {
        var A = app(); if (A && A.switchView) A.switchView('attendance');
    }

    /* hook into the app's page switching: title, subtitle and drawing this page */
    function hook() {
        var A = app();
        if (!A || !A.switchView || A.switchView._attendance) return false;
        var go = A.switchView;
        A.switchView = function (view) {
            var r = go.apply(this, arguments);
            if (view === 'attendance') {
                var t = $('main-header-title'), s = $('main-header-subtitle');
                if (t) t.textContent = T('ลงเวลา / ลางาน');
                if (s) { s.textContent = T('เวลาเข้า–ออกงาน ลากิจ ลาป่วย · แชร์ให้ทีมผ่าน Google Calendar'); s.classList.remove('hidden'); }
                onShow();
            }
            return r;
        };
        A.switchView._attendance = true;
        return true;
    }
    if (!hook()) document.addEventListener('DOMContentLoaded', hook);

    window.Attendance = { open: open, gcalUrl: gcalUrl, refresh: function () { if ($('view-attendance')) refresh(); } };
})();
