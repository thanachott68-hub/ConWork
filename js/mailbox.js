/* ConWork — Mailbox (team invitations now, ordinary messages later) + invite by email
 * Used by team.html and app.html. Database: conwork-mailbox.sql (table mail_messages + functions).
 * Without Supabase it keeps everything in this browser (localStorage "conwork_mail") so the pages still work. */
(function () {
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var LKEY = 'conwork_mail';
    var readLS = function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
    var writeLS = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
    var client = function () { var s = window.conworkSupabase; return s && s.isAvailable && s.isAvailable() ? s.client : null; };
    var NOFN = /PGRST202|PGRST205|Could not find the (function|table)|does not exist|schema cache/i;
    var NEED_SQL = 'ฐานข้อมูลยังไม่มี Mailbox · รัน conwork-mailbox.sql ใน Supabase (SQL Editor) แล้วลองใหม่';

    var ROLE = { sys_admin: 'Admin', company_admin: 'รองหัวหน้า', manager: 'หัวหน้างาน', employee: 'พนักงาน', guest: 'ผู้เยี่ยมชม', super_admin: 'หัวหน้า' };
    /* the Admin role is never handed out: only the 3 system Admin emails are Admins, added to every team by the database */
    var ROLES = [['company_admin', 'รองหัวหน้า'], ['manager', 'หัวหน้างาน'], ['employee', 'พนักงาน']];
    var ADMIN_ONLY = 'Admin ให้ได้เฉพาะอีเมล Admin ของระบบ (3 อีเมลที่กำหนดไว้) เท่านั้น';
    var isAdminEmail = function (e) { return !!(window.cwIsAdminEmail && cwIsAdminEmail(e)); };
    /* the role saved in the database for a role picked on screen */
    var dbRole = function (role) { return role === 'sys_admin' ? 'company_admin' : role; };
    /* approving someone as Admin: their account email must be one of the Admin emails */
    function checkAdminFor(userId, role) {
        if (role !== 'sys_admin') return Promise.resolve();
        var sb = client();
        if (!sb) return Promise.reject(new Error(ADMIN_ONLY));
        return sb.from('profiles').select('email').eq('id', userId).maybeSingle().then(function (r) {
            if (!(r.data && isAdminEmail(r.data.email))) throw new Error(ADMIN_ONLY);
        });
    }

    /* small drawn icons (no icon font needed) */
    var ICON = {
        mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
        team: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.6c2.6.2 4.4 1.9 5 5.4"/></svg>',
        check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
        x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
        copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
        link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>',
        send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/></svg>',
        clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
        key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14.5 8.5l2 2"/></svg>'
    };
    var ic = function (name, cls) { return '<span class="mb-ic ' + (cls || '') + '">' + ICON[name] + '</span>'; };
    (function css() {
        if (document.getElementById('mb-style')) return;
        var st = document.createElement('style'); st.id = 'mb-style';
        st.textContent = '.mb-ic{display:inline-flex;width:18px;height:18px;flex:none}.mb-ic svg{width:100%;height:100%}.mb-ic.sm{width:14px;height:14px}.mb-ic.lg{width:22px;height:22px}'
            + '.mb-badge{min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#EF4444;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}'
            + '.mb-badge.hidden{display:none}';
        document.head.appendChild(st);
    })();

    // ---------- who am I ----------
    function sessionUser() { try { return JSON.parse(sessionStorage.getItem('conwork_user') || localStorage.getItem('conwork_user') || 'null') || {}; } catch (e) { return {}; } }
    function me() {
        var u = sessionUser(), sb = client();
        var base = { id: String(u.user_id || u.id || ''), email: String(u.email || '').toLowerCase(), name: u.name || u.email || '' };
        if (!sb) return Promise.resolve(base);
        return sb.auth.getUser().then(function (r) {
            var a = r && r.data && r.data.user;
            if (a) { base.id = String(a.id); base.email = String(a.email || base.email).toLowerCase(); }
            return base;
        }).catch(function () { return base; });
    }

    // ---------- data ----------
    function rpc(name, args) {
        return client().rpc(name, args).then(function (r) {
            if (r.error) { var t = (r.error.code || '') + ' ' + r.error.message; throw new Error(NOFN.test(t) ? NEED_SQL : r.error.message); }
            return r.data;
        });
    }
    /* mail sent to me, newest first */
    function inbox() {
        return me().then(function (m) {
            var sb = client();
            if (!sb) return readLS(LKEY, []).filter(function (x) { return x.to_email === m.email || String(x.to_user) === m.id; }).sort(byNew);
            return sb.from('mail_messages').select('*').order('created_at', { ascending: false }).then(function (r) {
                if (r.error) { if (NOFN.test((r.error.code || '') + ' ' + r.error.message)) return []; throw r.error; }
                return (r.data || []).filter(function (x) { return String(x.to_email).toLowerCase() === m.email || String(x.to_user) === m.id; });
            });
        });
    }
    /* invitations a team has sent (leaders) */
    function sentFor(teamId) {
        var sb = client();
        if (!sb) return Promise.resolve(readLS(LKEY, []).filter(function (x) { return x.kind === 'invite' && String(x.company_id) === String(teamId); }).sort(byNew));
        return sb.from('mail_messages').select('*').eq('kind', 'invite').eq('company_id', teamId).order('created_at', { ascending: false }).then(function (r) {
            if (r.error) { if (NOFN.test((r.error.code || '') + ' ' + r.error.message)) return []; throw r.error; }
            return r.data || [];
        });
    }
    var byNew = function (a, b) { return String(b.created_at).localeCompare(String(a.created_at)); };
    var open = function (x) { return x.status === 'unread' || x.status === 'read'; };
    function unreadCount() { return inbox().then(function (l) { return l.filter(function (x) { return x.status === 'unread' || (x.kind === 'invite' && open(x)); }).length; }).catch(function () { return 0; }); }

    /* join / leave requests still waiting that I can see: my own, and those for teams I lead (database rules decide) */
    function requests() {
        return me().then(function (m) {
            var sb = client();
            var mark = function (l) { l.forEach(function (r) { r.mine = String(r.user_id) === m.id; }); return l; };
            if (sb) return sb.from('team_requests').select('id, company_id, user_id, user_name, team_name, type, status, created_at').eq('status', 'waiting').order('created_at', { ascending: false })
                .then(function (r) { if (r.error) return []; return mark(r.data || []); });
            /* this browser only: teams I lead = created by me, or where I am owner/admin */
            var ws = readLS('workspaces', []), mem = readLS('workspace_members', []);
            var leads = function (tid) {
                var w = ws.find(function (x) { return String(x.workspace_id) === String(tid); }) || {};
                var mm = mem.find(function (x) { return String(x.workspace_id) === String(tid) && String(x.user_id) === m.id; }) || {};
                return String(w.created_by) === m.id || /admin/.test(mm.role || '');
            };
            return mark(readLS('conwork_team_requests', []).filter(function (r) { return r.status === 'waiting' && (String(r.user_id) === m.id || leads(r.workspace_id)); })
                .map(function (r) { return Object.assign({ company_id: r.workspace_id, created_at: r.created_at || r.at || '' }, r); }).sort(byNew));
        }).catch(function () { return []; });
    }
    function decide(id, approve, role) {
        var sb = client();
        /* approving as Admin: only when the person's account email is one of the Admin emails */
        if (sb && approve && role === 'sys_admin') {
            return sb.from('team_requests').select('user_id').eq('id', id).maybeSingle().then(function (r) {
                return checkAdminFor(r.data && r.data.user_id, role);
            }).then(function () { return decide(id, approve, 'company_admin'); });
        }
        if (role === 'sys_admin') { if (approve) return Promise.reject(new Error(ADMIN_ONLY)); role = 'employee'; }
        if (sb) return sb.rpc('decide_request', { p_id: id, p_approve: approve, p_role: role || 'employee' }).then(function (r) {
            if (r.error && NOFN.test((r.error.code || '') + ' ' + r.error.message)) return sb.rpc('decide_request', { p_id: id, p_approve: approve }).then(function (r2) { if (r2.error) throw r2.error; });
            if (r.error) throw r.error;
        });
        return Promise.resolve().then(function () {
            var all = readLS('conwork_team_requests', []), x = all.find(function (y) { return String(y.id) === String(id); });
            if (!x) throw new Error('Request not found');
            if (approve) {
                var mem = readLS('workspace_members', []);
                if (x.type === 'leave') mem = mem.filter(function (m) { return !(String(m.workspace_id) === String(x.workspace_id) && String(m.user_id) === String(x.user_id)); });
                else if (!mem.some(function (m) { return String(m.workspace_id) === String(x.workspace_id) && String(m.user_id) === String(x.user_id); })) mem.push({ user_id: x.user_id, workspace_id: x.workspace_id, role: role || 'employee' });
                writeLS('workspace_members', mem);
            }
            x.status = approve ? 'approved' : 'declined'; writeLS('conwork_team_requests', all);
        });
    }
    /* what the bell shows, the same on the Team page and in the App; every item opens the Mailbox */
    /* ---------- "seen": opening the bell (or the Mailbox) marks everything up to now as read ----------
       kept in the database (profiles.notif_seen_at) so App, Team page and other devices agree; this browser keeps a copy */
    var seenKey = function (m) { return 'conwork_notif_seen:' + (m.id || m.email || 'me'); };
    var later = function (a, b) { return String(a || '') > String(b || '') ? a : b; };
    var toIso = function (t) { try { return t ? new Date(t).toISOString() : ''; } catch (e) { return ''; } };
    var seenRpc = true;
    function seenAt(m) {
        var local = toIso(readLS(seenKey(m), ''));
        var sb = client();
        if (!sb || !seenRpc) return Promise.resolve(local);
        return sb.rpc('my_notif_seen_at').then(function (r) {
            if (r.error) { if (NOFN.test((r.error.code || '') + ' ' + r.error.message)) seenRpc = false; return local; }
            return later(toIso(r.data), local);
        }).catch(function () { return local; });
    }
    function markSeen() {
        return me().then(function (m) {
            writeLS(seenKey(m), new Date().toISOString());
            var sb = client(), done = function () { try { window.dispatchEvent(new CustomEvent('conwork:notif-seen')); } catch (e) { } };
            if (!sb) {
                var all = readLS(LKEY, []), ch = false;
                all.forEach(function (x) { if (x.status === 'unread' && (x.to_email === m.email || String(x.to_user) === m.id)) { x.status = 'read'; ch = true; } });
                if (ch) writeLS(LKEY, all);
                return done();
            }
            if (!seenRpc) return inbox().then(function (l) { return Promise.all(l.filter(function (x) { return x.status === 'unread'; }).map(function (x) { return markRead(x.id); })); }).then(done, done);
            return sb.rpc('mark_notifications_seen').then(function (r) {
                if (r.error) {
                    if (NOFN.test((r.error.code || '') + ' ' + r.error.message)) { seenRpc = false; return inbox().then(function (l) { return Promise.all(l.filter(function (x) { return x.status === 'unread'; }).map(function (x) { return markRead(x.id); })); }); }
                    return;
                }
                if (r.data) writeLS(seenKey(m), toIso(r.data));
            }).then(done, done);
        });
    }

    /* the bell list (App and Team page show the same one): only what is new since the bell was last opened.
       Once seen it leaves the bell and stays in the Mailbox.
       new mail / invitations · join requests and leave requests for teams I lead */
    function feed() {
        return me().then(function (m) {
            return Promise.all([inbox().catch(function () { return []; }), requests(), seenAt(m)]).then(function (v) {
                var items = [], seen = v[2];
                var isNew = function (t) { return !seen || (t && toIso(t) > seen); };
                v[0].filter(function (x) { return x.status === 'unread'; }).forEach(function (x) {
                    items.push({ type: 'mail', icon: 'mail', tone: 'blue', text: x.kind === 'invite' ? 'คำเชิญเข้าร่วมทีม ' + (x.team_name || '') : (x.subject || 'ข้อความใหม่'), sub: (x.from_name || 'ConWork') + ' · เปิดใน Mailbox', count: true });
                });
                v[1].forEach(function (r) {
                    if (r.mine || !isNew(r.created_at)) return;
                    items.push({ type: 'request', icon: 'team', tone: r.type === 'leave' ? 'red' : 'amber', text: (r.user_name || 'สมาชิก') + (r.type === 'leave' ? ' ขอออกจากทีม' : ' ขอเข้าร่วมทีม'), sub: (r.team_name || '') + ' · ดูใน Mailbox', count: true });
                });
                return { items: items, count: items.length, requests: v[1], mail: v[0], seen: seen };
            });
        });
    }

    function invite(team, email, role) {
        email = String(email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new Error('รูปแบบอีเมลไม่ถูกต้อง'));
        if (role === 'sys_admin' && !isAdminEmail(email)) return Promise.reject(new Error(ADMIN_ONLY));
        role = dbRole(role);
        if (client()) return rpc('send_team_invite', { p_company: team.id, p_email: email, p_role: role });
        return me().then(function (m) {
            var all = readLS(LKEY, []);
            var users = readLS('users', []), to = users.find(function (u) { return String(u.email || '').toLowerCase() === email; });
            var mem = readLS('workspace_members', []);
            if (to && mem.some(function (x) { return String(x.workspace_id) === String(team.id) && String(x.user_id) === String(to.user_id); })) throw new Error('Already a member');
            if (all.some(function (x) { return x.kind === 'invite' && String(x.company_id) === String(team.id) && x.to_email === email && open(x); })) throw new Error('Already invited');
            var row = { id: 'M-' + Date.now(), kind: 'invite', to_email: email, to_user: to ? to.user_id : null, from_user: m.id, from_name: m.name, company_id: team.id, team_name: team.name, role: role,
                subject: 'คำเชิญเข้าร่วมทีม ' + team.name, body: (m.name || 'หัวหน้าทีม') + ' เชิญคุณเข้าร่วมทีม ' + team.name, status: 'unread', created_at: new Date().toISOString() };
            all.push(row); writeLS(LKEY, all);
            return { id: row.id, registered: !!to };
        });
    }
    function respond(id, accept) {
        if (client()) return rpc('respond_invite', { p_id: id, p_accept: accept });
        return me().then(function (m) {
            var all = readLS(LKEY, []), x = all.find(function (y) { return y.id === id; });
            if (!x || !open(x)) throw new Error('This invitation is no longer open');
            if (accept) {
                var mem = readLS('workspace_members', []);
                if (!mem.some(function (y) { return String(y.workspace_id) === String(x.company_id) && String(y.user_id) === m.id; }))
                    mem.push({ user_id: m.id, workspace_id: x.company_id, role: x.role || 'employee' });
                writeLS('workspace_members', mem);
            }
            x.status = accept ? 'accepted' : 'declined'; x.decided_at = new Date().toISOString(); writeLS(LKEY, all);
            return { company_id: x.company_id, team_name: x.team_name, role: x.role };
        });
    }
    function markRead(id) {
        if (client()) return rpc('mark_mail_read', { p_id: id }).catch(function () { });
        var all = readLS(LKEY, []), x = all.find(function (y) { return y.id === id; });
        if (x && x.status === 'unread') { x.status = 'read'; writeLS(LKEY, all); }
        return Promise.resolve();
    }
    function cancel(id) {
        if (client()) return rpc('cancel_invite', { p_id: id });
        var all = readLS(LKEY, []), x = all.find(function (y) { return y.id === id; });
        if (x && open(x)) { x.status = 'cancelled'; writeLS(LKEY, all); }
        return Promise.resolve();
    }
    var ERR = function (e) {
        var m = (e && e.message) || String(e);
        return /Already a member/i.test(m) ? 'คนนี้อยู่ในทีมแล้ว' : /Already invited/i.test(m) ? 'เชิญอีเมลนี้ไปแล้ว รอเขาตอบรับ'
            : /Invalid email/i.test(m) ? 'รูปแบบอีเมลไม่ถูกต้อง' : /owner can invite an admin/i.test(m) ? 'เฉพาะหัวหน้าทีมที่เชิญรองหัวหน้าได้'
                : /Only the team owner or admin/i.test(m) ? 'คุณไม่มีสิทธิ์เชิญคนเข้าทีมนี้' : /no longer open/i.test(m) ? 'คำเชิญนี้ถูกตอบหรือยกเลิกไปแล้ว'
                    : /no longer exists/i.test(m) ? 'ทีมนี้ถูกลบไปแล้ว' : m;
    };

    // ---------- drawing ----------
    var when = function (t) {
        var d = new Date(t); if (isNaN(d)) return '';
        var s = (Date.now() - d) / 1000;
        return s < 60 ? 'เมื่อสักครู่' : s < 3600 ? Math.floor(s / 60) + ' นาทีที่แล้ว' : s < 86400 ? Math.floor(s / 3600) + ' ชั่วโมงที่แล้ว'
            : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    };
    var CHIP = {
        accepted: '<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">' + ic('check', 'sm') + 'ตอบรับแล้ว</span>',
        declined: '<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">ปฏิเสธแล้ว</span>',
        cancelled: '<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">ยกเลิกแล้ว</span>',
        unread: '<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">' + ic('clock', 'sm') + 'รอตอบรับ</span>',
        read: '<span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">' + ic('clock', 'sm') + 'รอตอบรับ</span>'
    };

    /* the inbox, drawn into `box`. opts.onJoined(result) runs after an invitation is accepted */
    function renderInbox(box, opts) {
        opts = opts || {};
        if (!box) return Promise.resolve();
        box.innerHTML = '<p class="text-sm text-gray-400 py-6 text-center">กำลังโหลด Mailbox…</p>';
        return Promise.all([inbox(), requests()]).then(function (v) {
            var list = v[0], reqs = v[1];
            /* opening the Mailbox counts as reading everything: the red counts go away (bell too) */
            markSeen().catch(function () { });
            var toDecide = reqs.filter(function (r) { return !r.mine; }), mine = reqs.filter(function (r) { return r.mine; });
            var head = '';
            if (toDecide.length) {
                head += '<div class="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">รออนุมัติ · ' + toDecide.length + '</div><div class="divide-y divide-gray-100 border-b border-gray-100">'
                    + toDecide.map(function (r) {
                        var join = r.type !== 'leave';
                        return '<div class="flex flex-wrap items-center gap-2 px-4 py-3" data-rq-row="' + esc(r.id) + '">'
                            + '<span class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ' + (join ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-500') + '">' + ic('team') + '</span>'
                            + '<div class="min-w-0 flex-1"><div class="font-semibold text-gray-800 truncate">' + esc(r.user_name || 'สมาชิก') + '</div>'
                            + '<div class="text-xs ' + (join ? 'text-amber-700' : 'text-red-600') + '">' + (join ? 'ขอเข้าร่วมทีม ' : 'ขอออกจากทีม ') + esc(r.team_name || '') + ' · ' + esc(when(r.created_at)) + '</div></div>'
                            + (join ? '<select data-rq-role="' + esc(r.id) + '" class="bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs font-semibold text-gray-700"><option value="" selected disabled>เลือกตำแหน่ง…</option>'
                                + ROLES.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>' : '')
                            + '<button type="button" data-rq-ok="' + esc(r.id) + '"' + (join ? ' disabled title="เลือกตำแหน่งก่อน"' : '') + ' class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed">อนุมัติ</button>'
                            + '<button type="button" data-rq-no="' + esc(r.id) + '" class="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50">ปฏิเสธ</button>'
                            + '<p class="w-full text-xs text-red-600 hidden" data-rq-err></p></div>';
                    }).join('') + '</div>';
            }
            if (mine.length) {
                head += '<div class="px-4 pt-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">คำขอของคุณ</div><div class="divide-y divide-gray-100 border-b border-gray-100">'
                    + mine.map(function (r) {
                        return '<div class="flex items-center gap-3 px-4 py-3"><span class="w-10 h-10 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">' + ic('clock') + '</span>'
                            + '<div class="min-w-0 flex-1"><div class="text-sm font-semibold text-gray-800">' + (r.type === 'leave' ? 'ขอออกจากทีม ' : 'ขอเข้าร่วมทีม ') + esc(r.team_name || '') + '</div>'
                            + '<div class="text-xs text-gray-500">รอหัวหน้าทีมอนุมัติ · ' + esc(when(r.created_at)) + '</div></div>' + CHIP.unread + '</div>';
                    }).join('') + '</div>';
            }
            if (head && list.length) head += '<div class="px-4 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">ข้อความ</div>';
            if (!list.length && head) { box.innerHTML = head; bindRequests(box, opts); return; }
            if (!list.length) {
                box.innerHTML = '<div class="text-center py-12 text-gray-500">' + '<span class="mb-ic lg text-gray-300" style="width:40px;height:40px">' + ICON.mail + '</span>'
                    + '<p class="font-semibold text-gray-700 mt-3">ยังไม่มีข้อความ</p><p class="text-sm mt-1">คำเชิญเข้าทีมและข้อความถึงคุณจะอยู่ที่นี่</p></div>';
                return;
            }
            box.innerHTML = head + '<div class="divide-y divide-gray-100">' + list.map(function (x) {
                var inv = x.kind === 'invite', unread = x.status === 'unread';
                var who = esc(x.from_name || 'ConWork');
                var line = inv ? who + ' เชิญคุณเข้าร่วมทีม <b class="text-gray-800">' + esc(x.team_name || '') + '</b> ในตำแหน่ง <b class="text-gray-800">' + esc(ROLE[x.role] || x.role || 'พนักงาน') + '</b>'
                    : esc(x.body || '');
                var actions = inv && open(x)
                    ? '<div class="flex gap-2 mt-3"><button type="button" data-mb-accept="' + esc(x.id) + '" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">' + ic('check', 'sm') + 'ตอบรับ เข้าทีม</button>'
                    + '<button type="button" data-mb-decline="' + esc(x.id) + '" class="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">ปฏิเสธ</button></div>'
                    : '';
                return '<div class="flex gap-3 p-4 ' + (unread ? 'bg-blue-50/40' : '') + '" data-mb-row="' + esc(x.id) + '">'
                    + '<span class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ' + (inv ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500') + '">' + ic(inv ? 'team' : 'mail') + '</span>'
                    + '<div class="min-w-0 flex-1"><div class="flex items-center gap-2 flex-wrap"><span class="font-semibold text-gray-800">' + esc(x.subject || (inv ? 'คำเชิญเข้าร่วมทีม' : 'ข้อความ')) + '</span>'
                    + (unread ? '<span class="w-2 h-2 rounded-full bg-blue-600" title="ยังไม่ได้อ่าน"></span>' : '')
                    + (inv ? CHIP[x.status] || '' : '') + '<span class="ml-auto text-xs text-gray-400">' + esc(when(x.created_at)) + '</span></div>'
                    + '<p class="text-sm text-gray-600 mt-1">' + line + '</p>' + actions + '<p class="text-sm text-red-600 mt-2 hidden" data-mb-err></p></div></div>';
            }).join('') + '</div>';
            bindRequests(box, opts);
            box.onclick = function (e) {
                if (e.target.closest('[data-rq-ok],[data-rq-no]')) return;   /* handled by bindRequests */
                var a = e.target.closest('[data-mb-accept]'), d = e.target.closest('[data-mb-decline]'); if (!a && !d) return;
                var id = (a || d).getAttribute(a ? 'data-mb-accept' : 'data-mb-decline'), row = box.querySelector('[data-mb-row="' + id + '"]');
                row.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
                respond(id, !!a).then(function (res) {
                    if (a && opts.onJoined) opts.onJoined(res);
                    if (!a && opts.onDeclined) opts.onDeclined(res);
                    return renderInbox(box, opts);
                }).catch(function (err) {
                    row.querySelectorAll('button').forEach(function (b) { b.disabled = false; });
                    var p = row.querySelector('[data-mb-err]'); p.textContent = ERR(err); p.classList.remove('hidden');
                });
            };
        }).catch(function (e) { box.innerHTML = '<p class="text-sm text-red-600 py-6 text-center">' + esc(ERR(e)) + '</p>'; });
    }

    /* approve (with the chosen role) / decline requests inside the mailbox */
    function bindRequests(box, opts) {
        box.onchange = function (e) {
            var s = e.target.closest('[data-rq-role]'); if (!s) return;
            var b = box.querySelector('[data-rq-ok="' + s.getAttribute('data-rq-role') + '"]'); if (b) { b.disabled = !s.value; b.removeAttribute('title'); }
        };
        box._rqOpts = opts;
        if (box._rqBound) return;   /* one listener per box, even after redrawing */
        box._rqBound = true;
        box.addEventListener('click', function (e) {
            var ok = e.target.closest('[data-rq-ok]'), no = e.target.closest('[data-rq-no]'); if (!ok && !no) return;
            opts = box._rqOpts || {};
            var id = (ok || no).getAttribute(ok ? 'data-rq-ok' : 'data-rq-no'), row = box.querySelector('[data-rq-row="' + id + '"]');
            var sel = box.querySelector('[data-rq-role="' + id + '"]'), role = sel ? sel.value : 'employee';
            if (ok && sel && !role) { sel.focus(); return; }
            row.querySelectorAll('button,select').forEach(function (b) { b.disabled = true; });
            decide(id, !!ok, role).then(function () {
                if (opts.onDecided) opts.onDecided();
                return renderInbox(box, opts);
            }).catch(function (err) {
                row.querySelectorAll('button,select').forEach(function (b) { b.disabled = false; });
                var p = row.querySelector('[data-rq-err]'); p.textContent = 'ทำรายการไม่สำเร็จ: ' + ((err && err.message) || err); p.classList.remove('hidden');
            });
        });
    }

    window.Mailbox = {
        requests: requests, decide: decide, feed: feed, markSeen: markSeen,
        inbox: inbox, sentFor: sentFor, invite: invite, respond: respond, markRead: markRead, cancel: cancel, unreadCount: unreadCount,
        renderInbox: renderInbox, ERR: ERR, ROLE: ROLE, ROLES: ROLES, ICON: ICON, ic: ic, when: when, CHIP: CHIP, me: me,
        checkAdminFor: checkAdminFor, dbRole: dbRole
    };
})();
