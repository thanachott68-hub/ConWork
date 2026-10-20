/* ConWork — reset buttons in app.html
 *  • "Reset / รีเซ็ต" floating at the bottom-right of every work tab: clears that tab's work.
 *    Seen and usable by หัวหน้า (Owner) and รองหัวหน้า (Admin). Confirm by typing RESET.
 *  • "Finish / จบงาน" in the top bar of every tab (Owner only): every tab back to 0, the team stays. Confirm with password.
 *  • ทีมงาน → Remove สมาชิกทั้งหมด (Owner only). Confirm with password.
 * Labels follow the language in Settings. The database checks the same rules again (conwork-reset.sql). */
(function () {
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var app = function () { return typeof App !== 'undefined' ? App : window.App; };
    var sbClient = function () { var s = window.conworkSupabase; return s && s.isAvailable && s.isAvailable() ? s.client : null; };
    var readLS = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    var NOFN = /PGRST202|Could not find the function|function .* does not exist/i;
    var NEED_SQL = 'ฐานข้อมูลยังไม่มีคำสั่งนี้ · รัน conwork-reset.sql ใน Supabase (SQL Editor) แล้วลองใหม่';

    /* pages that have their own data → what to reset */
    var FROM_PROJECTS = 'ตัวเลขในหน้านี้คำนวณจากงานทั้งหมด จึงจะลบโปรเจกต์ งาน หัวข้องาน ผู้รับผิดชอบ และงบของโปรเจกต์ทั้งหมดของทีมนี้';
    var PAGES = {
        projects: { scope: 'projects', name: 'งานทั้งหมด', what: 'โปรเจกต์ งาน หัวข้องาน ผู้รับผิดชอบ และงบของโปรเจกต์ทั้งหมดของทีมนี้' },
        tasks: { scope: 'projects', name: 'งานทั้งหมด', what: 'โปรเจกต์ งาน หัวข้องาน ผู้รับผิดชอบ และงบของโปรเจกต์ทั้งหมดของทีมนี้' },
        dashboard: { scope: 'projects', name: 'แดชบอร์ด', what: FROM_PROJECTS, derived: true },
        'work-report': { scope: 'projects', name: 'สร้างรายงาน', what: FROM_PROJECTS, derived: true },
        calendar: { scope: 'calendar', name: 'ปฏิทิน', what: 'กิจกรรมและนัดหมายทั้งหมดในปฏิทินของทีมนี้' },
        messages: { scope: 'messages', name: 'ข้อความ', what: 'ห้องแชทและข้อความทั้งหมดของทีมนี้' },
        accounting: { scope: 'finance', name: 'บัญชี', what: 'รายการรับ-จ่ายและหมวดงบประมาณทั้งหมดของทีมนี้' }
    };

    var me = {}, team = { id: null, name: '' }, tier = 0;   /* tier 1 = หัวหน้า, 2 = รองหัวหน้า, 0 = others */

    /* language from Settings (ไทย / English) */
    function isEn() {
        var A = app(), l = A && A.settings && A.settings.language;
        if (!l) { var st = readLS('conwork_user_settings', {}); l = st.language; }
        return l === 'en' || document.body.classList.contains('lang-en');
    }
    var L = function (en, th) { return isEn() ? en : th; };

    function currentUser() {
        var A = app(), u = (A && A.state && A.state.currentUser) || null;
        if (!u) try { u = JSON.parse(sessionStorage.getItem('conwork_user') || 'null'); } catch (e) { }
        return u || {};
    }

    /* work out my tier in the team I am in */
    function loadTier() {
        me = currentUser();
        var uid = String(me.user_id || me.id || ''); team.id = me.workspaceId || null; team.name = me.workspaceName || '';
        var sb = sbClient();
        if (!team.id) return Promise.resolve(0);
        if (sb) {
            return sb.auth.getUser().then(function (r) {
                if (r.data && r.data.user) { uid = String(r.data.user.id); me.email = r.data.user.email || me.email; }
                if (!uid) return [{}, {}];
                return Promise.all([
                sb.from('company_members').select('company_role').eq('company_id', team.id).eq('user_id', uid).maybeSingle(),
                sb.from('companies').select('name, created_by').eq('id', team.id).maybeSingle()
                ]);
            }).then(function (r) {
                var role = r[0].data && r[0].data.company_role, c = r[1].data;
                if (c && c.name) team.name = c.name;
                return (c && String(c.created_by) === uid) || role === 'super_admin' ? 1 : role === 'company_admin' ? 2 : 0;
            }).catch(function () { return 0; });
        }
        var ws = readLS('workspaces', []).find(function (w) { return String(w.workspace_id) === String(team.id); }) || {};
        var m = readLS('workspace_members', []).find(function (x) { return String(x.workspace_id) === String(team.id) && String(x.user_id) === uid; }) || {};
        if (!uid) return Promise.resolve(0);
        if (ws.name) team.name = ws.name;
        return Promise.resolve(String(ws.created_by) === uid || m.role === 'super_admin' ? 1 : /admin/.test(m.role || '') ? 2 : 0);
    }

    // ---------- UI pieces ----------
    function injectUI() {
        /* Reset: floating at the bottom-right corner of the page */
        if (!$('ta-reset')) {
            var b = document.createElement('button');
            b.id = 'ta-reset'; b.type = 'button';
            b.className = 'hidden items-center gap-2 pl-4 pr-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-lg transition-colors';
            b.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:300;';
            b.innerHTML = '<i class="fa-solid fa-rotate-left"></i><span data-ta-label></span>';
            b.addEventListener('click', function () { var A = app(); openPageReset(A && A.state && A.state.currentView); });
            document.body.appendChild(b);
        }
        /* Finish: top bar, left of the bell */
        var bell = $('notification-container');
        if (bell && !$('ta-finish')) {
            var f = document.createElement('button');
            f.id = 'ta-finish'; f.type = 'button';
            f.className = 'hidden items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors';
            f.innerHTML = '<i class="fa-solid fa-flag-checkered"></i><span data-ta-label></span>';
            f.addEventListener('click', function () { if (tier === 1) confirmWithPassword('reset'); });
            bell.parentNode.insertBefore(f, bell);
        }
        /* Remove all members: under ทีมงาน (Owner) */
        var sub = $('team-submenu');
        if (sub && !$('subnav-team-data')) {
            var a = document.createElement('a');
            a.href = '#'; a.id = 'subnav-team-data';
            a.className = 'subnav-item hidden text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors px-3 py-2 rounded-lg items-center gap-2';
            a.innerHTML = '<i class="fa-solid fa-user-xmark text-[10px] w-4"></i> <span data-ta-label></span>';
            a.addEventListener('click', function (e) { e.preventDefault(); if (tier === 1) confirmWithPassword('remove'); });
            sub.appendChild(a);
        }
        if (!$('ta-modal')) {
            var d = document.createElement('div');
            d.id = 'ta-modal';
            d.className = 'hidden fixed inset-0 z-[500] bg-gray-900/60 backdrop-blur-sm items-center justify-center p-4';
            d.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" id="ta-box"></div>';
            d.addEventListener('click', function (e) { if (e.target === d) closeModal(); });
            document.body.appendChild(d);
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !d.classList.contains('hidden')) closeModal(); });
        }
    }
    function refreshButtons(view) {
        var A = app(); view = view || (A && A.state && A.state.currentView);
        var r = $('ta-reset'), f = $('ta-finish'), a = $('subnav-team-data');
        var showReset = (tier === 1 || tier === 2) && !!PAGES[view];
        /* in ข้อความ the message box and send button sit at the bottom-right: lift the button above them */
        if (r) r.style.bottom = view === 'messages' ? '96px' : '20px';
        if (r) { r.classList.toggle('hidden', !showReset); r.classList.toggle('inline-flex', showReset); r.querySelector('[data-ta-label]').textContent = L('Reset', 'รีเซ็ต'); r.title = showReset ? L('Reset this tab', 'ล้างงานในแท็บ ') + (isEn() ? '' : PAGES[view].name) : ''; }
        if (f) { f.classList.toggle('hidden', tier !== 1); f.classList.toggle('inline-flex', tier === 1); f.querySelector('[data-ta-label]').textContent = L('Finish', 'จบงาน'); f.title = L('Finish: clear every tab, keep the team', 'จบงาน: เคลียร์งานทุกแท็บ ทีมงานยังอยู่'); }
        if (a) { a.classList.toggle('hidden', tier !== 1); a.classList.toggle('flex', tier === 1); a.querySelector('[data-ta-label]').textContent = L('Remove all members', 'Remove สมาชิกทั้งหมด'); }
    }

    function openModal(html) { $('ta-box').innerHTML = html; var m = $('ta-modal'); m.classList.remove('hidden'); m.classList.add('flex'); }
    function closeModal() { var m = $('ta-modal'); m.classList.add('hidden'); m.classList.remove('flex'); }
    function head(icon, title, sub) {
        return '<div class="p-6 pb-4 flex gap-4"><div class="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xl shrink-0"><i class="fa-solid ' + icon + '"></i></div>'
            + '<div class="min-w-0"><h3 class="text-lg font-bold text-gray-800">' + title + '</h3><p class="text-sm text-gray-500 mt-1">' + sub + '</p></div></div>';
    }
    var foot = function (btnId, label) {
        return '<p id="ta-err" class="hidden mx-6 -mt-1 mb-3 text-sm text-red-600"></p>'
            + '<div class="flex gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100"><button type="button" data-ta-close class="ml-auto px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-white">ยกเลิก</button>'
            + '<button type="submit" id="' + btnId + '" class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm disabled:opacity-50">' + label + '</button></div>';
    };
    function err(t) { var e = $('ta-err'); if (!e) return; e.textContent = t; e.classList.toggle('hidden', !t); }
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-ta-close]')) closeModal(); });

    // ---------- page reset (หัวหน้า, รองหัวหน้า) ----------
    function openPageReset(view) {
        var pg = PAGES[view]; if (!pg || !(tier === 1 || tier === 2)) return;
        openModal('<form id="ta-form">' + head('fa-rotate-left', L('Reset', 'รีเซ็ต') + ' · ' + pg.name, (pg.derived ? '' : 'ลบ') + pg.what + ' <b class="text-gray-700">ย้อนกลับไม่ได้</b> · สมาชิกในทีมยังอยู่ครบ')
            + '<div class="px-6 pb-4"><label class="block text-sm text-gray-600 mb-1">พิมพ์ <b class="text-red-600 tracking-wider">RESET</b> เพื่อยืนยัน</label>'
            + '<input id="ta-word" autocomplete="off" class="w-full px-3 py-2.5 rounded-lg border border-gray-200 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"></div>'
            + foot('ta-go', L('Reset', 'รีเซ็ต')) + '</form>');
        var go = $('ta-go'); go.disabled = true;
        $('ta-word').addEventListener('input', function () { go.disabled = this.value.trim().toUpperCase() !== 'RESET'; });
        setTimeout(function () { $('ta-word').focus(); }, 50);
        $('ta-form').addEventListener('submit', function (e) {
            e.preventDefault(); if (go.disabled) return;
            busy(go, true);
            runReset(pg.scope).then(function () { done(L('Reset done', 'รีเซ็ตเรียบร้อย') + ' · ' + pg.name); })
                .catch(function (x) { busy(go, false, L('Reset', 'รีเซ็ต')); err(msgOf(x)); });
        });
    }

    // ---------- owner panel ----------
    function openOwnerPanel() {
        if (tier !== 1) return;
        var A = app(); if (A && A.handleSubnavClick) A.handleSubnavClick('subnav-team-data');
        openModal(head('fa-triangle-exclamation', 'จัดการข้อมูลทีม' + (team.name ? ' “' + esc(team.name) + '”' : ''), 'เฉพาะหัวหน้าทีม (Owner) · ทุกคำสั่งต้องยืนยันด้วยรหัสผ่าน และย้อนกลับไม่ได้')
            + '<div class="px-6 pb-6 space-y-3">'
            + '<button type="button" data-ta-act="reset" class="w-full text-left flex gap-3 p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-colors">'
            + '<i class="fa-solid fa-flag-checkered text-red-500 mt-1 w-5"></i><span><span class="block font-semibold text-gray-800">จบงาน</span><span class="block text-xs text-gray-500 mt-0.5">เคลียร์งานทุกแท็บให้เป็น 0 (โปรเจกต์ งาน ปฏิทิน ข้อความ บัญชี) · ทีมงาน รหัสเชิญ และข้อมูลส่วนตัวยังอยู่ครบ</span></span></button>'
            + '<button type="button" data-ta-act="remove" class="w-full text-left flex gap-3 p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50/50 transition-colors">'
            + '<i class="fa-solid fa-user-xmark text-red-500 mt-1 w-5"></i><span><span class="block font-semibold text-gray-800">Remove สมาชิกทั้งหมด</span><span class="block text-xs text-gray-500 mt-0.5">ทุกคนยกเว้นคุณจะออกจากทีม · งานยังอยู่ · คนที่ออกต้องขอเข้าร่วมใหม่ด้วยรหัสเชิญ</span></span></button>'
            + '</div>');
        $('ta-box').querySelectorAll('[data-ta-act]').forEach(function (b) {
            b.addEventListener('click', function () { confirmWithPassword(b.getAttribute('data-ta-act')); });
        });
    }
    function confirmWithPassword(act) {
        var reset = act === 'reset';
        passwordMode().then(function (mode) {
            var label = mode === 'name' ? 'พิมพ์ชื่อทีม <b class="text-red-600">' + esc(team.name) + '</b> เพื่อยืนยัน <span class="text-xs text-gray-400">(บัญชีนี้เข้าสู่ระบบด้วย Google จึงไม่มีรหัสผ่าน)</span>' : 'รหัสผ่านของคุณ';
            var okLabel = reset ? L('Finish', 'จบงาน') : L('Remove all', 'Remove ทั้งหมด');
            openModal('<form id="ta-form">' + head(reset ? 'fa-flag-checkered' : 'fa-user-xmark', reset ? L('Finish', 'จบงาน') : L('Remove all members', 'Remove สมาชิกทั้งหมด'),
                reset ? 'งานทุกแท็บของทีมนี้จะกลับเป็น 0 — โปรเจกต์ งาน ปฏิทิน ข้อความ และบัญชีจะถูกลบ <b class="text-gray-700">ย้อนกลับไม่ได้</b> · ทีมงานยังอยู่ครบ'
                    : 'สมาชิกทุกคนยกเว้นคุณจะถูกนำออกจากทีมและโปรเจกต์ของทีม <b class="text-gray-700">ย้อนกลับไม่ได้</b> · งานยังอยู่')
                + '<div class="px-6 pb-4"><label class="block text-sm text-gray-600 mb-1">' + label + '</label>'
                + '<input id="ta-pass" ' + (mode === 'name' ? 'autocomplete="off"' : 'type="password" autocomplete="current-password"') + ' class="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"></div>'
                + foot('ta-go', okLabel) + '</form>');
            setTimeout(function () { $('ta-pass').focus(); }, 50);
            $('ta-form').addEventListener('submit', function (e) {
                e.preventDefault();
                var go = $('ta-go'), v = $('ta-pass').value; if (!v) return;
                busy(go, true); err('');
                checkSecret(mode, v).then(function (ok) {
                    if (!ok) { busy(go, false, okLabel); err(mode === 'name' ? 'ชื่อทีมไม่ตรง' : 'รหัสผ่านไม่ถูกต้อง'); return; }
                    return (reset ? runReset('all') : runRemoveAll()).then(function (n) {
                        done(reset ? L('Finished · every tab is back to 0, the team stays', 'จบงานเรียบร้อย · งานทุกแท็บเป็น 0 แล้ว ทีมงานยังอยู่ครบ') : 'นำสมาชิกออกแล้ว' + (typeof n === 'number' ? ' ' + n + ' คน' : ''));
                    });
                }).catch(function (x) { busy(go, false, okLabel); err(msgOf(x)); });
            });
        });
    }
    /* accounts made with Google have no password → confirm by typing the team name instead */
    function passwordMode() {
        var sb = sbClient();
        if (!sb) return Promise.resolve('password');
        return sb.auth.getUser().then(function (r) {
            var u = r.data && r.data.user, prov = (u && u.app_metadata && u.app_metadata.providers) || [];
            return !prov.length || prov.indexOf('email') >= 0 ? 'password' : 'name';
        }).catch(function () { return 'password'; });
    }
    function checkSecret(mode, v) {
        if (mode === 'name') return Promise.resolve(v.trim() === String(team.name).trim());
        var sb = sbClient(), email = me.email;
        if (sb) return verifyPassword(email, v);
        var u = readLS('users', []).find(function (x) { return String(x.user_id) === String(me.id || me.user_id) || x.email === email; });
        return Promise.resolve(!!u && u.password === v);
    }

    /* check a password with a separate, throw-away client so the page's own sign-in is not touched
       (signing in again on the main client would make login-flow.js re-route the user) */
    function verifyPassword(email, pw) {
        var cfg = window.CONWORK_CONFIG || {}, lib = window.supabase;
        if (!lib || !lib.createClient || !cfg.SUPABASE_URL) return Promise.reject(new Error('ตรวจรหัสผ่านไม่ได้ในตอนนี้'));
        var c = lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'conwork-verify' } });
        return c.auth.signInWithPassword({ email: email, password: pw }).then(function (r) { return !r.error; });
    }

    // ---------- doing it ----------
    function rpc(name, args) {
        return sbClient().rpc(name, args).then(function (r) {
            if (r.error) { var t = (r.error.code || '') + ' ' + (r.error.message || ''); throw new Error(NOFN.test(t) ? NEED_SQL : r.error.message); }
            return r.data;
        });
    }
    function clearLocal(scope) {
        /* the app keeps a copy of the data in these lists (js/mockData.js); empty them so nothing old shows before the reload */
        var all = scope === 'all';
        try { if (all || scope === 'projects') { if (typeof mockProjects !== 'undefined') mockProjects.length = 0; if (typeof mockTasks !== 'undefined') mockTasks.length = 0; if (typeof mockTaskSections !== 'undefined') mockTaskSections.length = 0; } } catch (e) { }
        try { if ((all || scope === 'calendar') && typeof mockEvents !== 'undefined') mockEvents.length = 0; } catch (e) { }
        try { if ((all || scope === 'messages') && typeof mockMessages !== 'undefined') mockMessages.length = 0; } catch (e) { }
        if (all || scope === 'messages') try { localStorage.removeItem('conwork_chats'); } catch (e) { }
        if (all) try { localStorage.removeItem('conwork_notifications_' + team.id); } catch (e) { }
    }
    function runReset(scope) {
        var sb = sbClient();
        var job = sb ? rpc('reset_team_work', { p_company: team.id, p_scope: scope }) : Promise.resolve();
        return job.then(function (res) { clearLocal(scope); return res; });
    }
    function runRemoveAll() {
        var sb = sbClient(), uid = String(me.user_id || me.id);
        if (sb) return rpc('remove_all_team_members', { p_company: team.id });
        var mem = readLS('workspace_members', []), before = mem.length;
        mem = mem.filter(function (m) { return String(m.workspace_id) !== String(team.id) || String(m.user_id) === uid; });
        try { localStorage.setItem('workspace_members', JSON.stringify(mem)); } catch (e) { }
        return Promise.resolve(before - mem.length);
    }
    function busy(b, on, label) { b.disabled = on; b.innerHTML = on ? '<i class="fa-solid fa-spinner fa-spin mr-1"></i>กำลังทำ…' : label; }
    function msgOf(x) { var m = (x && x.message) || String(x); return /row-level security|permission denied/i.test(m) ? NEED_SQL : /Only the team/i.test(m) ? 'คุณไม่มีสิทธิ์ทำรายการนี้' : m; }
    function done(text) {
        closeModal();
        var A = app();
        if (A && A._showToast) A._showToast(text, 'success');
        try { sessionStorage.setItem('conwork_after_reset', text); } catch (e) { }
        setTimeout(function () { location.reload(); }, 700);   /* reload so every page shows the fresh data */
    }

    // ---------- start ----------
    function start() {
        injectUI();
        var A = app();
        if (A && A.switchView && !A.switchView._ta) {
            var orig = A.switchView;
            A.switchView = function (v) { var r = orig.apply(this, arguments); refreshButtons(v); return r; };
            A.switchView._ta = true;
        }
        loadTier().then(function (t) { tier = t; refreshButtons(); announce(); });
        /* relabel when the language is switched in Settings */
        try { new MutationObserver(function () { refreshButtons(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] }); } catch (e) { }
        ['toggleLanguage', 'saveSettings', 'applySettings', 'setLanguage'].forEach(function (fn) {
            if (A && typeof A[fn] === 'function' && !A[fn]._ta) { var o = A[fn]; A[fn] = function () { var r = o.apply(this, arguments); setTimeout(function () { refreshButtons(); }, 0); return r; }; A[fn]._ta = true; }
        });
        try { var t = sessionStorage.getItem('conwork_after_reset'); if (t) { sessionStorage.removeItem('conwork_after_reset'); setTimeout(function () { var B = app(); if (B && B._showToast) B._showToast(t, 'success'); }, 800); } } catch (e) { }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
    /* the user may arrive before App finished signing in: look again once it has */
    var tries = 0, again = setInterval(function () {
        var u = currentUser(); tries++;
        if ((u.workspaceId && (u.id || u.user_id)) || tries > 20) { clearInterval(again); loadTier().then(function (t) { tier = t; refreshButtons(); announce(); }); }
    }, 500);

    /* other scripts (memberActions.js) wait for this to know who is the owner */
    var known = false;
    function announce() { known = true; try { document.dispatchEvent(new CustomEvent('conwork:tier', { detail: { tier: tier, team: team } })); } catch (e) { } }

    window.TeamAdmin = { known: function () { return known; }, team: function () { return team; }, openPageReset: openPageReset, openOwnerPanel: openOwnerPanel, tier: function () { return tier; } };
})();
