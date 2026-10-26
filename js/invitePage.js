/* ConWork — "เพิ่มพนักงาน" page in app.html (replaces the old add-employee form for new members)
 *   • invite by email + choose the role → the invitation goes to that person's Mailbox; accepting joins at once
 *   • the team's invite code (joining with it waits for approval)
 *   • รออนุมัติ: people who used the code / asked to leave → approve with a role or decline
 *   • Mailbox: your own invitations and messages
 * Plus: an envelope button in the top bar (everyone) → Mailbox page, and mail items in the bell.
 * Needs js/mailbox.js. The old add/edit form (view-add-member) is kept for editing existing employees. */
(function () {
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var app = function () { return typeof App !== 'undefined' ? App : window.App; };
    var client = function () { var s = window.conworkSupabase; return s && s.isAvailable && s.isAvailable() ? s.client : null; };
    var readLS = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    var writeLS = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
    var MB = function () { return window.Mailbox; };
    var NOFN = /PGRST202|Could not find the function|function .* does not exist/i;

    function currentUser() {
        var A = app(), u = (A && A.state && A.state.currentUser) || null;
        if (!u) try { u = JSON.parse(sessionStorage.getItem('conwork_user') || 'null'); } catch (e) { }
        return u || {};
    }
    function tier() { return window.TeamAdmin && TeamAdmin.tier ? TeamAdmin.tier() : 0; }

    /* the team the app is open in: id, name, invite code */
    function team() {
        var u = currentUser(), t = { id: u.workspaceId || null, name: u.workspaceName || '', code: '' };
        /* use the team the app actually loaded (App._loadData falls back to the first team when the saved choice is not one of mine),
           so this page never shows another team's code */
        var A = app(), ws = (A && A.state && A.state.workspaces) || [];
        var loaded = ws.find(function (w) { return String(w.workspace_id) === String(t.id); }) || ws[0];
        if (loaded && loaded.workspace_id) { t.id = loaded.workspace_id; t.name = loaded.name || t.name; t.code = loaded.code || ''; }
        if (!t.id) return Promise.resolve(t);
        var sb = client();
        if (sb) return sb.from('companies').select('name, code').eq('id', t.id).maybeSingle().then(function (r) {
            if (r.data) { t.name = r.data.name || t.name; t.code = r.data.code || ''; } return t;
        }).catch(function () { return t; });
        var w = readLS('workspaces', []).find(function (x) { return String(x.workspace_id) === String(t.id); }) || {};
        t.name = w.name || t.name; t.code = w.code || '';
        return Promise.resolve(t);
    }

    // ---------- page markup ----------
    var card = function (title, sub, inner, id) {
        return '<section ' + (id ? 'id="' + id + '" ' : '') + 'class="bg-white border border-gray-200 rounded-2xl shadow-sm">'
            + '<div class="px-5 pt-5 pb-3"><h3 class="font-bold text-gray-800">' + title + '</h3>' + (sub ? '<p class="text-xs text-gray-500 mt-0.5">' + sub + '</p>' : '') + '</div>'
            + '<div class="px-5 pb-5">' + inner + '</div></section>';
    };
    function inject() {
        var host = $('view-add-member'); if (!host || $('view-invite')) return;
        var ic = MB().ic;
        var v = document.createElement('div');
        v.id = 'view-invite'; v.className = 'view-section hidden h-full overflow-y-auto custom-scrollbar p-6';
        v.innerHTML = '<div id="iv-denied" class="hidden max-w-xl mx-auto mt-16 text-center text-gray-500"><p class="font-semibold text-gray-700">เฉพาะหัวหน้าและรองหัวหน้าทีม</p><p class="text-sm mt-1">ที่เชิญคนเข้าทีมและอนุมัติคำขอได้</p></div>'
            + '<div id="iv-body" class="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-6xl">'
            + '<div class="space-y-6">'
            + card(ic('send') + ' <span class="align-middle">เชิญด้วยอีเมล</span>', 'คนที่ถูกเชิญจะได้คำเชิญใน Mailbox · กดตอบรับแล้วเข้าทีมได้ทันทีตามตำแหน่งที่เลือก',
                '<form id="iv-form" class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">'
                + '<input id="iv-email" type="email" autocomplete="off" placeholder="name@company.com" class="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">'
                + '<select id="iv-role" class="bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"></select>'
                + '<button class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">' + ic('send', 'sm') + 'ส่งคำเชิญ</button>'
                + '</form><p id="iv-note" class="hidden text-sm mt-2"></p>'
                + '<div class="mt-5"><div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">คำเชิญที่ส่งแล้ว</div><div id="iv-sent" class="divide-y divide-gray-100"></div></div>')
            + card(ic('key') + ' <span class="align-middle">รหัสเชิญ (Invite Code)</span>', 'คนที่เข้าร่วมด้วยรหัสนี้ต้องรอหัวหน้าทีมอนุมัติ (ดูที่ “รออนุมัติ”)',
                '<div class="flex flex-wrap items-center gap-2"><span id="iv-code" class="px-4 py-2.5 rounded-lg bg-gray-100 font-mono text-lg font-bold tracking-widest text-gray-800">—</span>'
                + '<button type="button" id="iv-copy" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">' + ic('copy', 'sm') + 'คัดลอกรหัส</button>'
                + '<button type="button" id="iv-copy-link" class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">' + ic('link', 'sm') + 'คัดลอกลิงก์สมัคร</button>'
                + '<span id="iv-copied" class="text-xs text-emerald-600"></span></div>')
            + '</div><div class="space-y-6">'
            + card('รออนุมัติ <span id="iv-pending-n" class="mb-badge hidden align-middle ml-1">0</span>', 'คำขอเข้าร่วมด้วยรหัสเชิญ · เฉพาะหัวหน้าทีม (Owner) · คำขอออกจากทีมอยู่ใน Mailbox', '<div id="iv-pending" class="divide-y divide-gray-100"></div>', 'iv-pending-card')
            + '</div></div>';
        host.parentNode.insertBefore(v, host);

        var m = document.createElement('div');
        m.id = 'view-mailbox'; m.className = 'view-section hidden h-full overflow-y-auto custom-scrollbar p-6';
        m.innerHTML = '<div class="max-w-3xl"><div id="mb-page" class="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"></div>'
            + '<p class="text-xs text-gray-400 mt-3">คำเชิญทางอีเมล: กดตอบรับแล้วเข้าทีมได้ทันที · ทีมใหม่จะอยู่ในหน้า “ทีมของฉัน (สลับทีม)”</p></div>';
        host.parentNode.insertBefore(m, host);

        /* Mailbox lives in the profile menu (bottom-left); new mail also shows in the bell */
        var menu = document.querySelector('#profile-menu-dropdown .p-2');
        if (menu && !$('iv-mail-btn')) {
            var b = document.createElement('button');
            b.id = 'iv-mail-btn'; b.type = 'button';
            b.className = 'w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors text-sm text-left';
            b.innerHTML = '<span class="w-5 flex justify-center text-gray-500"><span class="mb-ic">' + MB().ICON.mail + '</span></span>Mailbox<span id="iv-mail-badge" class="mb-badge hidden ml-auto">0</span>';
            b.addEventListener('click', function (e) { e.stopPropagation(); var dd = $('profile-menu-dropdown'); if (dd) dd.classList.add('hidden'); openMailbox(); });
            var first = menu.querySelector('button');
            if (first && first.nextSibling) menu.insertBefore(b, first.nextSibling); else menu.appendChild(b);
        }

        $('iv-form').addEventListener('submit', sendInvite);
        $('iv-copy').addEventListener('click', function () { if (cur.code) copy(cur.code, 'คัดลอกรหัสแล้ว'); });
        $('iv-copy-link').addEventListener('click', function () { if (cur.code) copy(location.origin + location.pathname.replace(/[^/]*$/, '') + 'login.html?mode=signup&code=' + encodeURIComponent(cur.code), 'คัดลอกลิงก์แล้ว'); });
        $('iv-sent').addEventListener('click', function (e) {
            var b = e.target.closest('[data-iv-cancel]'); if (!b) return;
            b.disabled = true;
            MB().cancel(b.getAttribute('data-iv-cancel')).then(loadSent).catch(function (er) { b.disabled = false; note(MB().ERR(er), false); });
        });
        $('iv-pending').addEventListener('click', decide);
        $('iv-pending').addEventListener('change', function (e) {
            var s = e.target.closest('[data-iv-role]'); if (!s) return;
            var ok = $('iv-pending').querySelector('[data-iv-ok="' + s.getAttribute('data-iv-role') + '"]'); if (ok) { ok.disabled = !s.value; ok.removeAttribute('title'); }
        });
    }

    var cur = { id: null, name: '', code: '' };
    function copy(text, ok) {
        var done = function () { var c = $('iv-copied'); c.textContent = ok; clearTimeout(copy.t); copy.t = setTimeout(function () { c.textContent = ''; }, 2500); };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { prompt('คัดลอก:', text); });
        else { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { } t.remove(); }
    }
    function note(text, ok) { var n = $('iv-note'); n.textContent = text; n.className = 'text-sm mt-2 ' + (ok ? 'text-emerald-600' : 'text-red-600'); }

    function show(viewName, title, sub) {
        var A = app();
        if (A && A.switchView) A.switchView(viewName);
        var t = $('main-header-title'), s = $('main-header-subtitle');
        if (t) t.textContent = title;
        if (s) { s.textContent = sub; s.classList.remove('hidden'); }
    }

    // ---------- เพิ่มพนักงาน ----------
    function openInvite() {
        inject();
        show('invite', 'เพิ่มพนักงาน', 'เชิญด้วยอีเมล · รหัสเชิญ · รออนุมัติ');
        var A = app(); if (A && A.handleSubnavClick) A.handleSubnavClick('subnav-add-member');
        if (A && A.closeTeamSubmenuOnMobile) A.closeTeamSubmenuOnMobile();
        var lead = tier() === 1 || tier() === 2;
        $('iv-denied').classList.toggle('hidden', lead); $('iv-body').classList.toggle('hidden', !lead);
        /* only the owner may invite a รองหัวหน้า */
        $('iv-role').innerHTML = MB().ROLES.map(function (r) { return '<option value="' + r[0] + '"' + (r[0] === 'employee' ? ' selected' : '') + (r[0] === 'company_admin' && tier() !== 1 ? ' disabled' : '') + '>' + r[1] + '</option>'; }).join('');
        team().then(function (t) {
            cur = t;
            $('iv-code').textContent = t.code || '—';
            $('iv-pending-card').classList.toggle('hidden', tier() !== 1);
            if (lead) { loadSent(); if (tier() === 1) loadPending(); }
        });
    }
    function sendInvite(e) {
        e.preventDefault();
        var email = $('iv-email').value.trim(), role = $('iv-role').value, btn = e.target.querySelector('button');
        if (!email) { $('iv-email').focus(); return; }
        btn.disabled = true;
        MB().invite(cur, email, role).then(function (r) {
            btn.disabled = false; $('iv-email').value = '';
            note('ส่งคำเชิญถึง ' + email + ' แล้ว (' + MB().ROLE[role] + ')' + (r && r.registered === false ? ' · อีเมลนี้ยังไม่ได้สมัคร คำเชิญจะรอใน Mailbox เมื่อสมัครด้วยอีเมลนี้' : ''), true);
            loadSent();
        }).catch(function (er) { btn.disabled = false; note(MB().ERR(er), false); });
    }
    function loadSent() {
        var box = $('iv-sent');
        return MB().sentFor(cur.id).then(function (l) {
            box.innerHTML = l.length ? l.slice(0, 30).map(function (x) {
                var openNow = x.status === 'unread' || x.status === 'read';
                return '<div class="flex items-center gap-3 py-2.5"><div class="min-w-0 flex-1"><div class="text-sm font-medium text-gray-800 truncate">' + esc(x.to_email) + '</div>'
                    + '<div class="text-xs text-gray-400">' + esc(MB().ROLE[x.role] || x.role) + ' · ' + esc(MB().when(x.created_at)) + '</div></div>'
                    + (MB().CHIP[x.status] || '')
                    + (openNow ? '<button type="button" data-iv-cancel="' + esc(x.id) + '" class="text-xs font-semibold text-gray-400 hover:text-red-600">ยกเลิก</button>' : '') + '</div>';
            }).join('') : '<p class="text-sm text-gray-400 py-2">ยังไม่ได้เชิญใคร</p>';
        }).catch(function (er) { box.innerHTML = '<p class="text-sm text-red-600 py-2">' + esc(MB().ERR(er)) + '</p>'; });
    }

    // ---------- รออนุมัติ (team_requests) ----------
    var pending = [];
    function loadPending() {
        var box = $('iv-pending'), sb = client();
        var get = sb ? sb.from('team_requests').select('id, user_id, user_name, type, status, created_at').eq('company_id', cur.id).eq('status', 'waiting').eq('type', 'join').order('created_at').then(function (r) { if (r.error) throw r.error; return r.data || []; })
            : Promise.resolve(readLS('conwork_team_requests', []).filter(function (x) { return String(x.workspace_id) === String(cur.id) && x.status === 'waiting' && x.type !== 'leave'; }));
        return get.then(function (l) {
            pending = l;
            var n = $('iv-pending-n'); n.textContent = l.length; n.classList.toggle('hidden', !l.length);
            box.innerHTML = l.length ? l.map(function (r) {
                var join = r.type !== 'leave';
                return '<div class="flex flex-wrap items-center gap-2 py-3"><div class="min-w-0 flex-1"><div class="font-semibold text-gray-800 truncate">' + esc(r.user_name || 'สมาชิก') + '</div>'
                    + '<div class="text-xs ' + (join ? 'text-amber-700' : 'text-red-600') + '">' + (join ? 'ขอเข้าร่วมด้วยรหัสเชิญ' : 'ขอออกจากทีม') + '</div></div>'
                    + (join ? '<select data-iv-role="' + esc(r.id) + '" class="bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-semibold text-gray-700"><option value="" selected disabled>เลือกตำแหน่ง…</option>'
                        + MB().ROLES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === 'company_admin' && tier() !== 1 ? ' disabled' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' : '')
                    + '<button type="button" data-iv-ok="' + esc(r.id) + '"' + (join ? ' disabled title="เลือกตำแหน่งก่อน"' : '') + ' class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">อนุมัติ</button>'
                    + '<button type="button" data-iv-no="' + esc(r.id) + '" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">ปฏิเสธ</button></div>';
            }).join('') : '<p class="text-sm text-gray-400 py-2">ไม่มีคำขอที่รออยู่</p>';
        }).catch(function (er) { box.innerHTML = '<p class="text-sm text-red-600 py-2">โหลดคำขอไม่สำเร็จ: ' + esc(er.message || er) + '</p>'; });
    }
    function decide(e) {
        var ok = e.target.closest('[data-iv-ok]'), no = e.target.closest('[data-iv-no]'); if (!ok && !no) return;
        var id = (ok || no).getAttribute(ok ? 'data-iv-ok' : 'data-iv-no'), q = pending.find(function (x) { return String(x.id) === id; }); if (!q) return;
        var sel = $('iv-pending').querySelector('[data-iv-role="' + id + '"]'), role = sel ? sel.value : 'employee';
        if (ok && sel && !role) { sel.focus(); return; }
        (ok || no).disabled = true;
        var sb = client();
        var job = sb ? sb.rpc('decide_request', { p_id: id, p_approve: !!ok, p_role: role }).then(function (r) {
            if (r.error && NOFN.test((r.error.code || '') + ' ' + r.error.message)) return sb.rpc('decide_request', { p_id: id, p_approve: !!ok }).then(function (r2) { if (r2.error) throw r2.error; });
            if (r.error) throw r.error;
        }) : Promise.resolve().then(function () {
            var all = readLS('conwork_team_requests', []), x = all.find(function (y) { return String(y.id) === id; });
            if (ok) {
                var mem = readLS('workspace_members', []);
                if (q.type === 'leave') mem = mem.filter(function (m) { return !(String(m.workspace_id) === String(cur.id) && String(m.user_id) === String(q.user_id)); });
                else if (!mem.some(function (m) { return String(m.workspace_id) === String(cur.id) && String(m.user_id) === String(q.user_id); })) mem.push({ user_id: q.user_id, workspace_id: cur.id, role: role });
                writeLS('workspace_members', mem);
            }
            if (x) { x.status = ok ? 'approved' : 'declined'; writeLS('conwork_team_requests', all); }
        });
        job.then(function () { loadPending(); refreshCount(); var A = app(); if (A && A.loadPlanUsage) A.loadPlanUsage(); }).catch(function (er) {
            (ok || no).disabled = false;
            var A = app(), plan = A && A.planLimitMessage ? A.planLimitMessage(er) : null; // the team's package is full
            if (plan && A._showToast) A._showToast(plan, 'error'); else alert('ทำรายการไม่สำเร็จ: ' + (er.message || er));
        });
    }

    // ---------- Mailbox page ----------
    function openMailbox() {
        inject();
        show('mailbox', 'Mailbox', 'คำเชิญเข้าทีมและข้อความถึงคุณ');
        MB().renderInbox($('mb-page'), { onJoined: joined, onDeclined: refreshCount, onDecided: decided }).then(refreshCount);
    }
    function decided() {
        refreshCount();
        if ($('iv-pending') && cur.id && tier() === 1) loadPending();
        var A = app(); if (A && A._loadData) try { A._loadData(); } catch (e) { }
    }
    function joined(r) {
        var A = app();
        if (A && A._showToast) A._showToast('เข้าร่วมทีม “' + (r && r.team_name || '') + '” แล้ว · สลับทีมได้ที่ “ทีมของฉัน”', 'success');
        refreshCount();
    }

    // ---------- counts: envelope badge + bell ----------
    /* the same list as the Team page bell: invitations, messages, join/leave requests (Mailbox.feed) */
    var feedItems = [], feedCount = 0, feedStale = false;
    function refreshCount() {
        if (!MB()) return Promise.resolve();
        return MB().feed().then(function (f) {
            feedItems = f.items; feedCount = f.count; feedStale = false;
            var b = $('iv-mail-badge'); if (b) { b.textContent = f.count > 9 ? '9+' : f.count; b.classList.toggle('hidden', !f.count); }
            var A = app(); if (A && A.renderNotifications) A.renderNotifications();
        }).catch(function () { });
    }
    var TONE = { blue: 'bg-blue-100 text-blue-600', amber: 'bg-amber-100 text-amber-600', red: 'bg-red-100 text-red-500', gray: 'bg-gray-100 text-gray-500' };
    /* mail items at the top of the bell list; clicking one opens the Mailbox */
    function hookBell() {
        var A = app(); if (!A || !A.renderNotifications || A.renderNotifications._mb) return;
        var orig = A.renderNotifications;
        A.renderNotifications = function () {
            var r = orig.apply(this, arguments);
            var list = $('notification-list'), badge = $('notification-badge');
            if (!list || !feedItems.length) return r;
            if (/ไม่มีการแจ้งเตือนใหม่/.test(list.textContent) && list.children.length <= 1) list.innerHTML = '';
            var html = feedItems.map(function (x) {
                return '<button type="button" data-mb-open class="w-full p-3 flex items-start gap-3 text-left hover:bg-blue-50' + (x.count ? ' bg-blue-50/40' : '') + '">'
                    + '<span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ' + (TONE[x.tone] || TONE.gray) + '">' + MB().ic(x.icon, 'sm') + '</span>'
                    + '<span class="min-w-0"><span class="block text-sm font-semibold text-gray-800">' + esc(x.text) + '</span>'
                    + '<span class="block text-xs text-gray-500">' + esc(x.sub) + '</span></span></button>';
            }).join('');
            list.insertAdjacentHTML('afterbegin', html);
            if (badge) {
                var n = (parseInt(badge.classList.contains('hidden') ? '0' : badge.innerText, 10) || 0) + feedCount;
                if (n) { badge.innerText = n > 9 ? '9+' : n; badge.classList.remove('hidden'); }
            }
            return r;
        };
        A.renderNotifications._mb = true;
        /* pressing the bell = read: the red count goes away here, on the Team page and on the Mailbox;
           what was new stays in the list while it is open, then lives on in the Mailbox */
        var toggle = A.toggleNotificationDropdown;
        if (toggle && !toggle._mb) {
            A.toggleNotificationDropdown = function () {
                if (feedStale) { feedItems = []; feedStale = false; }
                var r = toggle.apply(this, arguments);
                var dd = $('notification-dropdown');
                if (dd && !dd.classList.contains('hidden')) {
                    var self = this;
                    try { if (self.markAllNotificationsRead) self.markAllNotificationsRead(); } catch (e) { }
                    MB().markSeen().catch(function () { });
                    seenNow();
                } else refreshCount();
                return r;
            };
            A.toggleNotificationDropdown._mb = true;
        }
        window.addEventListener('conwork:notif-seen', seenNow);
        document.addEventListener('click', function (e) {
            if (!e.target.closest || !e.target.closest('[data-mb-open]')) return;
            var dd = $('notification-dropdown'); if (dd) dd.classList.add('hidden');
            openMailbox();
        });
    }

    function seenNow() {
        feedCount = 0; feedStale = true;
        var b = $('iv-mail-badge'); if (b) b.classList.add('hidden');
        var badge = $('notification-badge'), A = app();
        if (A && A.renderNotifications) A.renderNotifications();
        else if (badge) badge.classList.add('hidden');
    }

    // ---------- start ----------
    function start() {
        if (!MB()) return;
        inject();
        /* "เพิ่มพนักงาน" (menu + button on ทีมงาน) opens the new page; editing an employee still uses the old form */
        var sub = $('subnav-add-member');
        if (sub) sub.setAttribute('onclick', 'event.preventDefault(); InvitePage.open()');
        var btn = $('btn-add-member');
        if (btn) btn.setAttribute('onclick', 'InvitePage.open()');
        hookBell();
        refreshCount();
        /* the old "เชิญผ่านลิงก์" window used the team's internal id as the code; show the real invite code instead */
        var A = app();
        if (A && A.openInviteModal && !A.openInviteModal._iv) {
            A.openInviteModal = function () {
                var modal = $('invite-company-modal'); if (!modal) return;
                team().then(function (t) {
                    var code = t.code || '';
                    var link = location.origin + location.pathname.replace(/[^/]*$/, '') + 'login.html?mode=signup&code=' + encodeURIComponent(code);
                    var qr = $('invite-qr-code'); if (qr) qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=' + encodeURIComponent(link);
                    var input = $('invite-link-input'); if (input) input.value = code ? link : '';
                    var tag = $('iv-modal-code');
                    if (!tag && input) { tag = document.createElement('div'); tag.id = 'iv-modal-code'; tag.className = 'mt-3 text-sm text-gray-600 text-center'; input.parentNode.parentNode.appendChild(tag); }
                    if (tag) tag.innerHTML = 'รหัสเชิญ: <b class="font-mono tracking-widest text-gray-800">' + esc(code || '—') + '</b> · คนที่เข้าด้วยรหัสนี้ต้องรอหัวหน้าทีมอนุมัติ';
                    modal.classList.remove('hidden');
                });
            };
            A.openInviteModal._iv = true;
        }
        setInterval(refreshCount, 60000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.InvitePage = { open: openInvite, openMailbox: openMailbox, refresh: refreshCount };
})();
