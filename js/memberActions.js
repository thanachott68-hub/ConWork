/* ConWork — member actions in app.html
 *  • Employee profile window: the only action left is "ลบออกจากทีม" (หัวหน้า only; never the owner or yourself).
 *    The person leaves the team at once and disappears from the list.
 *  • Profile menu: everyone except the owner gets "ออกจากทีม" instead of "ออกจากระบบ".
 *    It sends a leave request; the owner approves it (เพิ่มพนักงาน → รออนุมัติ, or the Team page) and the person is out.
 * Database: conwork-members.sql (remove_team_member + clean-up) and conwork-teams.sql (request_leave / decide_request). */
(function () {
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var app = function () { return typeof App !== 'undefined' ? App : window.App; };
    var client = function () { var s = window.conworkSupabase; return s && s.isAvailable && s.isAvailable() ? s.client : null; };
    var readLS = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    var writeLS = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
    var NOFN = /PGRST202|Could not find the function|function .* does not exist/i;
    var tier = 0, team = { id: null, name: '' }, viewing = null;

    function me() {
        var A = app(), u = (A && A.state && A.state.currentUser) || null;
        if (!u) try { u = JSON.parse(sessionStorage.getItem('conwork_user') || 'null'); } catch (e) { }
        return u || {};
    }
    function myId() {
        var sb = client(), u = me();
        if (!sb) return Promise.resolve(String(u.user_id || u.id || ''));
        return sb.auth.getUser().then(function (r) { return r.data && r.data.user ? String(r.data.user.id) : String(u.user_id || u.id || ''); }).catch(function () { return String(u.user_id || u.id || ''); });
    }
    function toast(t, ok) { var A = app(); if (A && A._showToast) A._showToast(t, ok === false ? 'error' : 'success'); else alert(t); }

    /* the owner of the team (so their profile has no remove button) */
    function ownerId() {
        var sb = client();
        if (!team.id) return Promise.resolve(null);
        if (sb) return sb.from('companies').select('created_by').eq('id', team.id).maybeSingle().then(function (r) { return r.data ? String(r.data.created_by) : null; }).catch(function () { return null; });
        var w = readLS('workspaces', []).find(function (x) { return String(x.workspace_id) === String(team.id); }) || {};
        return Promise.resolve(w.created_by ? String(w.created_by) : null);
    }

    // ---------- small confirm window ----------
    function confirmBox(title, text, okLabel, danger) {
        return new Promise(function (resolve) {
            var d = document.createElement('div');
            d.className = 'fixed inset-0 z-[600] bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4';
            d.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">'
                + '<div class="p-6"><h3 class="text-lg font-bold text-gray-800">' + title + '</h3><p class="text-sm text-gray-500 mt-2">' + text + '</p></div>'
                + '<div class="flex gap-2 px-6 py-4 bg-gray-50 border-t border-gray-100"><button type="button" data-no class="ml-auto px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-white">ยกเลิก</button>'
                + '<button type="button" data-yes class="px-4 py-2 rounded-xl ' + (danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700') + ' text-white font-semibold text-sm">' + okLabel + '</button></div></div>';
            var done = function (v) { d.remove(); resolve(v); };
            d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-no]')) done(false); if (e.target.closest('[data-yes]')) done(true); });
            document.body.appendChild(d);
        });
    }

    // ---------- profile window: only "remove from team" ----------
    function trimProfileWindow() {
        var edit = $('up-edit-btn'); if (edit) edit.style.display = 'none';
        var menu = $('up-context-menu'); if (!menu) return;
        /* keep one item: remove from team */
        Array.prototype.forEach.call(menu.children, function (el) { if (!el.hasAttribute('data-ma-remove')) el.style.display = 'none'; });
        if (!menu.querySelector('[data-ma-remove]')) {
            var b = document.createElement('button');
            b.type = 'button'; b.setAttribute('data-ma-remove', '');
            b.className = 'w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 transition-colors';
            b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg> ลบออกจากทีม';
            b.addEventListener('click', removeViewed);
            menu.appendChild(b);
        }
    }
    /* the ⋮ button shows only when the person may be removed by you */
    function updateProfileActions() {
        var menuBtn = $('up-context-menu') && $('up-context-menu').previousElementSibling;
        if (!menuBtn) return;
        var uid = String(viewing || '');
        myId().then(function (mine) {
            return ownerId().then(function (owner) {
                var can = tier === 1 && uid && uid !== mine && uid !== owner;
                menuBtn.style.display = can ? '' : 'none';
                if (!can) $('up-context-menu').classList.add('hidden');
            });
        });
    }
    function removeViewed() {
        $('up-context-menu').classList.add('hidden');
        var A = app(), uid = String(viewing || ''); if (!uid) return;
        var u = (typeof mockUsers !== 'undefined' ? mockUsers : []).find(function (x) { return String(x.id) === uid; }) || {};
        confirmBox('ลบออกจากทีม', '<b>' + esc(u.name || 'พนักงานคนนี้') + '</b> จะถูกนำออกจากทีม' + (team.name ? ' “' + esc(team.name) + '”' : '') + ' และโปรเจกต์ของทีมทันที · ข้อมูลงานที่ทำไว้ยังอยู่', 'ลบออกจากทีม', true).then(function (yes) {
            if (!yes) return;
            var sb = client();
            var job = sb ? sb.rpc('remove_team_member', { p_company: team.id, p_user: uid }).then(function (r) {
                if (r.error) throw new Error(NOFN.test((r.error.code || '') + ' ' + r.error.message) ? 'ฐานข้อมูลยังไม่พร้อม · รัน conwork-members.sql ใน Supabase แล้วลองใหม่' : r.error.message);
            }) : Promise.resolve().then(function () {
                writeLS('workspace_members', readLS('workspace_members', []).filter(function (m) { return !(String(m.workspace_id) === String(team.id) && String(m.user_id) === uid); }));
            });
            job.then(function () {
                /* gone from the list straight away */
                if (typeof mockUsers !== 'undefined') { var i = mockUsers.findIndex(function (x) { return String(x.id) === uid; }); if (i >= 0) mockUsers.splice(i, 1); }
                if (A && A.closeUserProfileModal) A.closeUserProfileModal();
                if (A && A.renderTeam) try { A.renderTeam(); } catch (e) { }
                toast('นำ ' + (u.name || 'พนักงาน') + ' ออกจากทีมแล้ว');
            }).catch(function (e) {
                var m = e.message || String(e);
                toast(/owner cannot be removed/i.test(m) ? 'นำหัวหน้าทีมออกไม่ได้' : /Only the team leader/i.test(m) ? 'คุณไม่มีสิทธิ์นำคนออกจากทีม' : 'ลบไม่สำเร็จ: ' + m, false);
            });
        });
    }

    // ---------- profile menu: "ออกจากทีม" (everyone but the owner) ----------
    var logoutBtn = null, leaveBtn = null;
    function setupLeave() {
        var menu = document.querySelector('#profile-menu-dropdown .p-2'); if (!menu) return;
        if (!logoutBtn) logoutBtn = Array.prototype.find.call(menu.querySelectorAll('button'), function (b) { return /logout\(\)/.test(b.getAttribute('onclick') || ''); });
        if (!leaveBtn) {
            leaveBtn = document.createElement('button');
            leaveBtn.type = 'button'; leaveBtn.id = 'ma-leave-btn';
            leaveBtn.className = 'hidden w-full flex items-center gap-3 px-3 py-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors text-sm text-left';
            leaveBtn.innerHTML = '<span class="w-5 flex justify-center"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/></svg></span><span data-ma-label>ออกจากทีม</span>';
            leaveBtn.addEventListener('click', function (e) { e.stopPropagation(); askToLeave(); });
            if (logoutBtn) logoutBtn.parentNode.insertBefore(leaveBtn, logoutBtn); else menu.appendChild(leaveBtn);
        }
        var owner = tier === 1;
        if (logoutBtn) logoutBtn.style.display = owner ? '' : 'none';
        leaveBtn.classList.toggle('hidden', owner || !team.id);
        if (!owner) markWaiting();
    }
    function leaveWaiting() {
        var sb = client();
        return myId().then(function (uid) {
            if (!team.id) return false; // team not known yet
            if (sb) return sb.from('team_requests').select('id').eq('company_id', team.id).eq('user_id', uid).eq('type', 'leave').eq('status', 'waiting').then(function (r) { return !!(r.data && r.data.length); }).catch(function () { return false; });
            return readLS('conwork_team_requests', []).some(function (x) { return String(x.workspace_id) === String(team.id) && String(x.user_id) === uid && x.type === 'leave' && x.status === 'waiting'; });
        });
    }
    function markWaiting() {
        return Promise.resolve(leaveWaiting()).then(function (w) {
            if (leaveBtn) leaveBtn.querySelector('[data-ma-label]').textContent = w ? 'ออกจากทีม (รอหัวหน้าอนุมัติ)' : 'ออกจากทีม';
            return w;
        });
    }
    function askToLeave() {
        var dd = $('profile-menu-dropdown'); if (dd) dd.classList.add('hidden');
        markWaiting().then(function (w) {
            if (w) { toast('ส่งคำขอออกจากทีมไปแล้ว · รอหัวหน้าทีมอนุมัติ'); return; }
            return confirmBox('ขอออกจากทีม', 'คำขอจะส่งไปให้หัวหน้าทีม' + (team.name ? ' “' + esc(team.name) + '”' : '') + ' อนุมัติก่อน · ระหว่างนี้คุณยังใช้งานทีมได้ตามปกติ', 'ส่งคำขอ', true).then(function (yes) {
                if (!yes) return;
                var sb = client();
                var job = sb ? sb.rpc('request_leave', { p_company: team.id }).then(function (r) { if (r.error) throw r.error; })
                    : myId().then(function (uid) {
                        var all = readLS('conwork_team_requests', []), u = me();
                        all.push({ id: 'R-' + Date.now(), type: 'leave', status: 'waiting', workspace_id: team.id, team_name: team.name, user_id: uid, user_name: u.name || u.email, created_at: new Date().toISOString() });
                        writeLS('conwork_team_requests', all);
                    });
                return job.then(function () { toast('ส่งคำขอออกจากทีมแล้ว · รอหัวหน้าทีมอนุมัติ'); markWaiting(); })
                    .catch(function (e) { toast('ส่งคำขอไม่สำเร็จ: ' + (e.message || e), false); });
            });
        });
    }

    // ---------- removed from the team? leave the app at once ----------
    /* Checked every 10 seconds and whenever the window comes back into view. When the person is no longer a member
       (their leave request was approved, or the leader removed them) they are taken to the Team page. */
    var kicked = false;
    function stillMember() {
        if (!team.id) return Promise.resolve(true);
        var sb = client();
        return myId().then(function (uid) {
            if (!uid) return true;
            if (sb) return sb.from('company_members').select('user_id').eq('company_id', team.id).eq('user_id', uid).maybeSingle()
                .then(function (r) { return r.error ? true : !!r.data; })   /* a network hiccup is not a removal */
                .catch(function () { return true; });
            var w = readLS('workspaces', []).find(function (x) { return String(x.workspace_id) === String(team.id); });
            if (!w) return true;   /* team not known in this browser: nothing to compare against */
            return String(w.created_by) === uid || readLS('workspace_members', []).some(function (m) { return String(m.workspace_id) === String(team.id) && String(m.user_id) === uid; });
        });
    }
    function checkMembership() {
        if (kicked || document.hidden) return;
        stillMember().then(function (ok) {
            if (ok || kicked) return;
            kicked = true;
            try {
                var u = JSON.parse(sessionStorage.getItem('conwork_user') || '{}');
                delete u.workspaceId; delete u.workspaceName;
                sessionStorage.setItem('conwork_user', JSON.stringify(u));
            } catch (e) { }
            var d = document.createElement('div');
            d.className = 'fixed inset-0 z-[700] bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-4';
            d.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">'
                + '<h3 class="text-lg font-bold text-gray-800">คุณออกจากทีมแล้ว</h3>'
                + '<p class="text-sm text-gray-500 mt-2">คุณไม่ได้อยู่ในทีม' + (team.name ? ' “' + esc(team.name) + '”' : '') + ' แล้ว · กำลังพากลับไปหน้าทีมของคุณ…</p></div>';
            document.body.appendChild(d);
            setTimeout(function () { location.replace('team.html'); }, 1800);
        });
    }

    // ---------- start ----------
    function start() {
        var A = app();
        if (A && A.openUserProfileModal && !A.openUserProfileModal._ma) {
            var orig = A.openUserProfileModal;
            A.openUserProfileModal = function (userId) { viewing = userId; var r = orig.apply(this, arguments); trimProfileWindow(); updateProfileActions(); return r; };
            A.openUserProfileModal._ma = true;
        }
        trimProfileWindow();
        document.addEventListener('conwork:tier', function (e) { tier = e.detail.tier; team = e.detail.team || team; setupLeave(); checkMembership(); });
        setInterval(checkMembership, 10000);
        document.addEventListener('visibilitychange', function () { if (!document.hidden) checkMembership(); });
        window.addEventListener('focus', checkMembership);
        if (window.TeamAdmin && TeamAdmin.known && TeamAdmin.known()) { tier = TeamAdmin.tier(); team = TeamAdmin.team(); setupLeave(); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
