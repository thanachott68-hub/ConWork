/* ConWork — "ข้อมูลทีมงาน": members of the current team in rank order; click a name to show the personal
 * information that is otherwise hidden. Opened from ทีมงาน → ข้อมูลทีมงาน in app.html.
 * Needs js/personalInfo.js. With Supabase the database decides who may see the details
 * (หัวหน้า / รองหัวหน้า of the team, see conwork-personal-info.sql). */
(function () {
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var PI = window.PersonalInfo;
    var list = [], open = {}, iLead = false, query = '';
    var GROUP = [['super_admin', 'หัวหน้า'], ['company_admin', 'รองหัวหน้า'], ['manager', 'หัวหน้างาน'], ['employee', 'พนักงาน'], ['guest', 'ผู้เยี่ยมชม']];
    var norm = function (r) { r = String(r || 'employee'); return /super/.test(r) ? 'super_admin' : /admin/.test(r) ? 'company_admin' : /manager|reviewer1|supervisor/.test(r) ? 'manager' : r === 'guest' ? 'guest' : 'employee'; };

    /* app.js declares App with const, so it is not on window */
    var app = function () { return typeof App !== 'undefined' ? App : window.App; };
    function me() {
        var A = app(), u = (A && A.state && A.state.currentUser) || null;
        if (!u) try { u = JSON.parse(sessionStorage.getItem('conwork_user') || 'null'); } catch (e) { }
        return u || {};
    }
    function client() { var s = window.conworkSupabase; return s && s.isAvailable && s.isAvailable() ? s.client : null; }

    function loadMembers(teamId) {
        var sb = client();
        if (sb && teamId) {
            return sb.from('company_members').select('user_id, company_role, department, joined_at, profiles ( full_name, email, avatar_url )').eq('company_id', teamId).then(function (r) {
                if (r.error) throw r.error;
                return (r.data || []).map(function (m) {
                    var p = m.profiles || {};
                    return { id: String(m.user_id), name: p.full_name || p.email || 'สมาชิก', email: p.email || '', avatar: p.avatar_url, role: norm(m.company_role), dept: m.department || '', joined: m.joined_at };
                });
            });
        }
        var read = function (k) { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
        var users = read('users'), ws = read('workspaces').find(function (w) { return String(w.workspace_id) === String(teamId); }) || {};
        return Promise.resolve(read('workspace_members').filter(function (m) { return String(m.workspace_id) === String(teamId); }).map(function (m) {
            var u = users.find(function (x) { return String(x.user_id) === String(m.user_id); }) || {};
            return {
                id: String(m.user_id), name: ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || u.name || u.email || 'สมาชิก', email: u.email || '', avatar: u.avatar,
                role: String(ws.created_by) === String(m.user_id) ? 'super_admin' : norm(m.role), dept: u.department || '', joined: m.joined_at
            };
        }));
    }

    function field(label, val, icon) {
        return '<div class="flex items-start gap-3 py-2"><i class="fa-solid ' + icon + ' w-4 text-gray-400 mt-1"></i><div class="min-w-0"><div class="text-xs text-gray-400">' + label + '</div>'
            + '<div class="text-sm font-medium text-gray-800 break-words">' + (val || '<span class="text-gray-300 font-normal">—</span>') + '</div></div></div>';
    }

    function render() {
        var box = $('mi-list'); if (!box) return;
        var q = query.trim().toLowerCase();
        var shown = list.filter(function (m) {
            if (!q) return true;
            var d = m.info || {};
            return [m.name, m.email, d.first_name_th, d.last_name_th, d.phone, m.dept, PI.ROLE_TH[m.role]].join(' ').toLowerCase().indexOf(q) >= 0;
        });
        $('mi-count').textContent = list.length;
        $('mi-filled').textContent = list.filter(function (m) { return PI.isComplete(m.info); }).length;
        if (!shown.length) { box.innerHTML = '<div class="text-center text-sm text-gray-500 py-16">' + (list.length ? 'ไม่พบสมาชิกที่ค้นหา' : 'ยังไม่มีสมาชิกในทีมนี้') + '</div>'; return; }
        box.innerHTML = GROUP.map(function (g) {
            var rows = shown.filter(function (m) { return m.role === g[0]; });
            if (!rows.length) return '';
            return '<section class="mb-6"><div class="flex items-center gap-2 mb-2 px-1"><span class="text-xs font-bold text-gray-500 uppercase tracking-wider">' + g[1] + '</span><span class="text-xs text-gray-400">' + rows.length + ' คน</span></div>'
                + '<div class="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-sm">' + rows.map(row).join('') + '</div></section>';
        }).join('');
    }
    function row(m) {
        var d = m.info, done = PI.isComplete(d), isOpen = !!open[m.id];
        var av = m.avatar || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(m.name) + '&background=random');
        var th = d ? [d.first_name_th, d.last_name_th].filter(Boolean).join(' ') : '';
        var chip = done ? '<span class="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><i class="fa-solid fa-check text-[9px]"></i>ข้อมูลครบ</span>'
            : '<span class="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">ยังไม่กรอก</span>';
        var detail = '';
        if (isOpen) {
            if (!d) {
                detail = '<div class="px-5 pb-4 pl-[4.5rem] text-sm text-gray-500">' + (iLead || m.self ? 'ยังไม่ได้กรอกข้อมูลส่วนตัว' : 'เฉพาะหัวหน้าและรองหัวหน้าทีมที่ดูข้อมูลส่วนตัวได้') + '</div>';
            } else {
                var tel = d.phone ? '<a href="tel:' + esc(d.phone) + '" class="text-blue-600 hover:underline">' + esc(PI.phone(d.phone)) + '</a>' : '';
                var mail = d.personal_email ? '<a href="mailto:' + esc(d.personal_email) + '" class="text-blue-600 hover:underline">' + esc(d.personal_email) + '</a>' : '';
                detail = '<div class="px-5 pb-4 sm:pl-[4.5rem] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 bg-gray-50 border-t border-gray-100 pt-2">'
                    + field('ชื่อ-สกุล (ไทย)', esc(th), 'fa-id-card')
                    + field('วันเกิด', d.birth_date ? esc(PI.thaiDate(d.birth_date)) + ' <span class="text-gray-400 font-normal">· อายุ ' + PI.age(d.birth_date) + ' ปี</span>' : '', 'fa-cake-candles')
                    + field('เพศ', esc(PI.GENDER[d.gender] || ''), 'fa-venus-mars')
                    + field('เบอร์โทร', tel, 'fa-phone')
                    + field('อีเมลส่วนตัว', mail, 'fa-envelope')
                    + field('อีเมลบัญชี', esc(m.email), 'fa-at')
                    + (m.dept ? field('แผนก', esc(m.dept), 'fa-building') : '')
                    + (m.joined ? field('เข้าร่วมทีม', esc(PI.thaiDate(String(m.joined).slice(0, 10))), 'fa-calendar-check') : '')
                    + '</div>';
            }
        }
        return '<div><button type="button" data-mi="' + esc(m.id) + '" aria-expanded="' + isOpen + '" class="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors">'
            + '<img src="' + esc(av) + '" alt="" class="w-10 h-10 rounded-full border border-gray-200 object-cover shrink-0">'
            + '<span class="min-w-0 flex-1"><span class="block font-semibold text-gray-800 truncate">' + esc(m.name) + (m.self ? ' <span class="text-xs font-normal text-gray-400">(คุณ)</span>' : '') + '</span>'
            + '<span class="block text-xs text-gray-500 truncate">' + esc(th || m.email) + '</span></span>'
            + chip
            + '<span class="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full shrink-0">' + esc(PI.ROLE_TH[m.role] || m.role) + '</span>'
            + '<i class="fa-solid fa-chevron-down text-gray-300 text-xs transition-transform shrink-0" style="' + (isOpen ? 'transform:rotate(180deg)' : '') + '"></i>'
            + '</button>' + detail + '</div>';
    }

    function load() {
        var u = me(), uid = String(u.id || u.user_id || ''), teamId = u.workspaceId;
        $('mi-team').textContent = u.workspaceName || '';
        $('mi-list').innerHTML = '<div class="text-sm text-gray-400 py-10 text-center"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังโหลดรายชื่อ…</div>';
        if (!teamId) { $('mi-list').innerHTML = '<div class="text-center text-sm text-gray-500 py-16">ยังไม่ได้เลือกทีม · กลับไปเลือกทีมที่ <a href="team.html" class="text-blue-600 hover:underline">หน้าทีมของฉัน</a></div>'; return; }
        loadMembers(teamId).then(function (ms) {
            ms.forEach(function (m) { m.self = m.id === uid; });
            var mine = ms.find(function (m) { return m.self; });
            iLead = !!mine && (mine.role === 'super_admin' || mine.role === 'company_admin');
            return PI.loadMany(ms.map(function (m) { return m.id; })).then(function (info) {
                ms.forEach(function (m) { m.info = info[m.id] || null; });
                ms.sort(function (a, b) { return (PI.RANK[a.role] - PI.RANK[b.role]) || a.name.localeCompare(b.name, 'th'); });
                list = ms; render();
            });
        }).catch(function (e) {
            $('mi-list').innerHTML = '<div class="text-center text-sm text-red-600 py-16">โหลดรายชื่อไม่สำเร็จ: ' + esc(e.message || e) + '</div>';
        });
    }

    function show() {
        var A = app();
        if (A && A.switchView) A.switchView('member-info');
        if (A && A.handleSubnavClick) A.handleSubnavClick('subnav-member-info');
        var t = $('main-header-title'), s = $('main-header-subtitle');
        if (t) t.textContent = 'ข้อมูลทีมงาน';
        if (s) { s.textContent = 'รายชื่อตามลำดับขั้น · คลิกที่ชื่อเพื่อดูข้อมูลส่วนตัว'; s.classList.remove('hidden'); }
        if (A && A.closeTeamSubmenuOnMobile) A.closeTeamSubmenuOnMobile();
        open = {}; load();
    }

    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-mi]'); if (!b) return;
        var id = b.getAttribute('data-mi'); open[id] = !open[id]; render();
    });
    document.addEventListener('input', function (e) { if (e.target && e.target.id === 'mi-search') { query = e.target.value; render(); } });
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('#mi-expand')) { var all = list.every(function (m) { return open[m.id]; }); open = {}; if (!all) list.forEach(function (m) { open[m.id] = true; }); render(); }
    });

    window.MemberInfo = { open: show, reload: load };
})();
