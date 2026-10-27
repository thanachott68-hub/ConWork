/**
 * ConWork — Departments & permissions (ผู้บริหาร → รองผู้บริหาร → หัวหน้า (of a department) → พนักงาน)
 * The rules live in the database (cw_can_edit, row level security and the cw_* functions):
 * this page only shows them and sends changes; hiding a button here is a convenience, never the guard.
 * Shown at the top of "ตั้งค่าพนักงาน" (view-role-settings). Needs js/app.js.
 */
(function () {
    if (typeof App === 'undefined') return;

    const MODULES = [
        ['projects', 'โปรเจกต์'], ['tasks', 'งาน'], ['reports', 'รายงาน'],
        ['accounting', 'บัญชี & งบ'], ['employees', 'พนักงาน'], ['settings', 'ตั้งค่าทีม']
    ];
    const LEVELS = [['view', 'ดูอย่างเดียว'], ['head_only', 'เฉพาะหัวหน้าแผนก'], ['edit_dept', 'แก้ไขได้ทั้งแผนก']];
    const LEVEL_CLS = {
        edit: 'bg-emerald-100 text-emerald-800 border-emerald-300', edit_dept: 'bg-teal-50 text-teal-800 border-teal-200',
        head_only: 'bg-amber-50 text-amber-800 border-amber-200', view: 'bg-gray-50 text-gray-600 border-gray-200',
        own: 'bg-gray-50 text-gray-600 border-gray-200'
    };
    const LEVEL_TXT = { edit: 'แก้ไขได้', edit_dept: 'แก้ไขได้ทั้งแผนก', head_only: 'เฉพาะหัวหน้าแผนก', view: 'ดูอย่างเดียว', own: 'เฉพาะของตัวเอง' };
    const RANK_TXT = { head: 'ผู้บริหาร', deputy: 'รองผู้บริหาร', member: 'พนักงาน' };
    /* the features the app already checks (App.hasPermission) and the module each belongs to */
    const FEATURE_MODULE = {
        'สร้างโปรเจกต์': 'projects', 'แก้ไขโปรเจกต์': 'projects', 'ลบโปรเจกต์': 'projects',
        'สร้างหัวข้องาน': 'tasks', 'แก้ไขงาน': 'tasks', 'ลบงาน': 'tasks', 'มอบหมายงาน': 'tasks', 'ตรวจงาน': 'tasks',
        'เพิ่มพนักงาน': 'employees', 'แก้ไขพนักงาน': 'employees', 'ลบพนักงาน': 'employees', 'รีเซ็ตรหัสผ่าน': 'employees',
        'ตั้งค่าระบบ': 'settings', 'จัดการสิทธิ์': 'settings'
    };

    const esc = t => App._esc(t);
    const sb = () => { const s = window.conworkSupabase; return s && s.isAvailable && s.isAvailable() ? s.client : null; };
    const team = () => { const id = App.state.currentUser && App.state.currentUser.workspaceId; return id && !/^W-/.test(String(id)) ? String(id) : null; };
    const errText = e => (e && (e.message || e.error_description || e.details)) || String(e || 'เกิดข้อผิดพลาด');
    async function rpc(name, args) {
        const c = sb(); if (!c) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
        const { data, error } = await c.rpc(name, args);
        if (error) throw error;
        return data;
    }

    const R = { data: null, access: null, draft: {}, loading: false, error: '' };

    /* ---------- what I may do (from the server) ---------- */
    async function loadAccess() {
        const id = team(); if (!id || !sb()) { R.access = null; return null; }
        try { R.access = await rpc('cw_my_access', { p_company: id }); } catch (e) { R.access = null; }
        return R.access;
    }
    const origHas = App.hasPermission.bind(App);
    App.hasPermission = function (feature) {
        const a = R.access, mod = FEATURE_MODULE[feature];
        if (!a || !a.rank || !mod) return origHas(feature);
        if (a.rank === 'head' || a.rank === 'deputy') return true;
        if (mod === 'settings') return false;
        const m = a.modules && a.modules[mod];
        if (m && m.can_edit) return true;
        /* work the person created or was given still opens; the database checks the item itself */
        if (mod === 'tasks' || mod === 'projects') {
            const list = typeof mockProjects !== 'undefined' ? mockProjects : [];
            const p = App.state.currentProject && list.find(x => x.id === App.state.currentProject);
            if (p && String(p.ownerId) === String(App.state.currentUser.id)) return true;
            return feature === 'แก้ไขงาน';
        }
        return false;
    };
    App.cwAccess = () => R.access;

    /* ---------- page ---------- */
    function mount() {
        let box = document.getElementById('cw-rbac');
        if (box) return box;
        const view = document.getElementById('view-role-settings'); if (!view) return null;
        box = document.createElement('div');
        box.id = 'cw-rbac'; box.className = 'mb-6 shrink-0 space-y-6'; box.setAttribute('data-no-i18n', '');
        const anchor = document.getElementById('plan-usage-card');
        if (anchor) anchor.after(box); else view.prepend(box);
        /* the old permission table was kept in this browser only and never checked: the matrix below replaces it */
        const old = view.querySelector('#role-filter-select');
        const oldCol = old && old.closest('.flex-1.bg-white');
        if (oldCol) oldCol.style.display = 'none';
        box.addEventListener('click', onClick);
        box.addEventListener('change', onChange);
        return box;
    }
    const card = (title, sub, body, extra) => `<section class="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h3 class="font-bold text-gray-800">${title}</h3>${sub ? `<p class="text-xs text-gray-500 mt-0.5">${sub}</p>` : ''}</div>${extra || ''}</div>${body}</section>`;
    const btn = (attr, label, kind) => `<button type="button" ${attr} class="${kind === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' : kind === 'danger' ? 'text-red-600 hover:bg-red-50 border border-red-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">${label}</button>`;
    const chip = lv => `<span class="inline-block text-xs font-semibold px-2.5 py-1 rounded-full border ${LEVEL_CLS[lv] || LEVEL_CLS.view}">${LEVEL_TXT[lv] || lv}</span>`;

    async function render() {
        const box = mount(); if (!box) return;
        if (!team() || !sb()) { box.innerHTML = card('แผนกและสิทธิ์', '', '<p class="text-sm text-gray-500">เลือกทีมและเชื่อมต่อฐานข้อมูลก่อน จึงจะตั้งค่าแผนกและสิทธิ์ได้</p>'); return; }
        R.loading = true; box.innerHTML = card('แผนกและสิทธิ์', '', '<p class="text-sm text-gray-400 py-4"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังโหลด…</p>');
        try {
            const [ov] = await Promise.all([rpc('cw_rbac_overview', { p_company: team() }), loadAccess()]);
            R.data = ov; R.error = ''; R.draft = {};
        } catch (e) { R.data = null; R.error = errText(e); }
        R.loading = false;
        paint();
    }

    function paint() {
        const box = mount(); if (!box) return;
        if (R.error) {
            box.innerHTML = card('แผนกและสิทธิ์', '', `<div class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">โหลดไม่สำเร็จ: ${esc(R.error)}</div><div class="mt-3">${btn('data-rb="reload"', 'ลองอีกครั้ง')}</div>`);
            return;
        }
        const d = R.data, can = !!d.can_manage, depts = d.departments || [], members = d.members || [];
        const nameOf = id => { const m = members.find(x => String(x.user_id) === String(id)); return m ? m.name : '—'; };
        const reason = can ? '' : '<p class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3"><i class="fa-solid fa-lock mr-1"></i>ดูได้อย่างเดียว: เฉพาะผู้บริหารและรองผู้บริหารที่แก้ไขแผนกและสิทธิ์ได้</p>';

        /* my access */
        const a = R.access || {};
        const mine = `<div class="flex flex-wrap items-center gap-2 text-sm"><span class="text-gray-500">สิทธิ์ของฉัน:</span><span class="font-semibold text-gray-800">${esc(RANK_TXT[a.rank] || '—')}</span>${a.department ? `<span class="text-gray-400">·</span><span class="text-gray-700">แผนก ${esc(a.department.name)}${a.department.is_head ? ' (หัวหน้า)' : ''}</span>` : (a.rank === 'member' ? '<span class="text-gray-400">· ยังไม่ได้รับมอบแผนก (ดูได้ทุกหมวด แก้ได้เฉพาะงานที่ได้รับมอบหมาย)</span>' : '')}</div>`;

        /* 1. departments */
        const memberOpts = sel => '<option value="">— ไม่มีหัวหน้า —</option>' + members.filter(m => m.rank === 'member').map(m => `<option value="${esc(m.user_id)}"${String(sel) === String(m.user_id) ? ' selected' : ''}>${esc(m.name)}</option>`).join('');
        const deptRows = depts.length ? depts.map(x => `<div class="border border-gray-200 rounded-lg p-3 ${x.status === 'inactive' ? 'bg-gray-50 opacity-75' : ''}">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0"><div class="font-semibold text-gray-800 truncate">${esc(x.name)} ${x.status === 'inactive' ? '<span class="text-xs font-semibold text-gray-500 bg-gray-200 rounded-full px-2 py-0.5 ml-1">ปิดใช้งาน</span>' : ''}</div>
                <div class="text-xs text-gray-500">หัวหน้า: ${x.head_user_id ? esc(nameOf(x.head_user_id)) : '—'} · สมาชิก ${x.member_count || 0} คน${x.description ? ' · ' + esc(x.description) : ''}</div></div>
              ${can ? `<div class="flex flex-wrap gap-2">${btn(`data-rb="edit" data-id="${esc(x.id)}"`, 'แก้ไข')}${btn(`data-rb="status" data-id="${esc(x.id)}"`, x.status === 'inactive' ? 'เปิดใช้งาน' : 'ปิดใช้งาน')}${btn(`data-rb="delete" data-id="${esc(x.id)}"`, 'ลบ', 'danger')}</div>` : ''}
            </div>
            <div data-rb-form="${esc(x.id)}" class="hidden mt-3 grid gap-2 sm:grid-cols-3">
              <input data-f="name" value="${esc(x.name)}" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" placeholder="ชื่อแผนก">
              <input data-f="description" value="${esc(x.description || '')}" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" placeholder="คำอธิบาย (ไม่บังคับ)">
              <select data-f="head" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">${memberOpts(x.head_user_id)}</select>
              <div class="sm:col-span-3 flex gap-2">${btn(`data-rb="save" data-id="${esc(x.id)}"`, 'บันทึก', 'primary')}${btn(`data-rb="cancel" data-id="${esc(x.id)}"`, 'ยกเลิก')}</div>
            </div></div>`).join('')
            : '<p class="text-sm text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-lg">ยังไม่มีแผนก' + (can ? ' — เพิ่มแผนกแรกด้านบน' : '') + '</p>';
        const legacy = (() => { try { return [...document.querySelectorAll('#dept-list-container .dept-item span')].map(s => s.textContent.trim()).filter(n => n && !depts.some(x => x.name.toLowerCase() === n.toLowerCase())); } catch (e) { return []; } })();
        const addForm = can ? `<div class="grid gap-2 sm:grid-cols-4 mb-4" data-rb-form="new">
              <input data-f="name" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" placeholder="ชื่อแผนกใหม่">
              <input data-f="description" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" placeholder="คำอธิบาย (ไม่บังคับ)">
              <select data-f="head" class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">${memberOpts('')}</select>
              ${btn('data-rb="save" data-id="new"', '<i class="fa-solid fa-plus mr-1"></i>เพิ่มแผนก', 'primary')}</div>
              ${legacy.length ? `<p class="text-xs text-gray-500 mb-3">มีแผนกในรายการเดิม (เก็บในเบราว์เซอร์นี้) ${legacy.length} รายการ: ${esc(legacy.join(', '))} ${btn('data-rb="import"', 'นำเข้าเป็นแผนกจริง')}</p>` : ''}
              <p class="text-xs text-gray-500 mb-3">แผนกใหม่เริ่มต้นเป็น "ดูอย่างเดียว" ทุกหมวด แล้วค่อยกำหนดสิทธิ์ในตารางด้านล่าง</p>` : '';

        /* 2. members */
        const deptOpts = sel => '<option value="">— ไม่มีแผนก —</option>' + depts.filter(x => x.status === 'active' || String(x.id) === String(sel)).map(x => `<option value="${esc(x.id)}"${String(sel) === String(x.id) ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
        const me = String(App.state.currentUser && App.state.currentUser.id);
        const memRows = members.map(m => {
            const self = String(m.user_id) === me;
            const isDeptHead = depts.some(x => String(x.head_user_id) === String(m.user_id));
            const rankCell = (d.is_head && !self && !m.is_creator)
                ? `<select data-rb-rank="${esc(m.user_id)}" class="border border-gray-200 rounded-lg px-2 py-1 text-sm"><option value="employee"${m.rank === 'member' ? ' selected' : ''}>พนักงาน</option><option value="company_admin"${m.rank === 'deputy' ? ' selected' : ''}>รองผู้บริหาร</option><option value="super_admin"${m.rank === 'head' ? ' selected' : ''}>ผู้บริหาร</option></select>${isDeptHead && m.rank === 'member' ? '<div class="text-[11px] text-gray-500 mt-0.5">หัวหน้าแผนก</div>' : ''}`
                : `<span class="text-sm font-semibold ${m.rank === 'head' ? 'text-blue-700' : m.rank === 'deputy' ? 'text-blue-600' : 'text-gray-700'}">${m.rank === 'member' && isDeptHead ? 'หัวหน้า' : (RANK_TXT[m.rank] || m.rank)}${m.is_creator ? ' · ผู้สร้างทีม' : ''}</span>`;
            const deptCell = m.rank !== 'member' ? '<span class="text-xs text-gray-400">ดูแลทุกแผนก</span>'
                : (can && !self ? `<select data-rb-dept="${esc(m.user_id)}" class="border border-gray-200 rounded-lg px-2 py-1 text-sm max-w-[12rem]">${deptOpts(m.department_id)}</select>`
                    : `<span class="text-sm text-gray-700">${esc((depts.find(x => String(x.id) === String(m.department_id)) || {}).name || '—')}</span>`);
            return `<tr class="border-t border-gray-100"><td class="py-2 pr-3"><div class="text-sm font-medium text-gray-800">${esc(m.name)}${self ? ' <span class="text-xs text-gray-400">(คุณ)</span>' : ''}</div><div class="text-xs text-gray-400">${esc(m.email || '')}</div></td><td class="py-2 pr-3">${rankCell}</td><td class="py-2">${deptCell}</td></tr>`;
        }).join('');

        /* 3. matrix */
        const lockRow = label => `<tr class="border-t border-gray-100 bg-blue-50/40"><td class="py-2 pr-3 text-sm font-semibold text-gray-800 whitespace-nowrap">${label}<div class="text-[11px] font-normal text-gray-400">ตามตำแหน่ง · ล็อก</div></td>${MODULES.map(() => `<td class="py-2 px-1 text-center">${chip('edit')}</td>`).join('')}</tr>`;
        const deptRow = x => {
            const perms = Object.assign({}, x.permissions || {}, R.draft[x.id] || {});
            return `<tr class="border-t border-gray-100"><td class="py-2 pr-3 text-sm font-semibold text-gray-800 whitespace-nowrap">${esc(x.name)}${x.status === 'inactive' ? '<div class="text-[11px] font-normal text-gray-400">ปิดใช้งาน (ไม่มีสิทธิ์แก้ไข)</div>' : ''}</td>${MODULES.map(([k]) => {
                if (k === 'settings') return `<td class="py-2 px-1 text-center">${chip('view')}</td>`;
                const lv = perms[k] || 'view', changed = R.draft[x.id] && R.draft[x.id][k] && R.draft[x.id][k] !== ((x.permissions || {})[k] || 'view');
                return `<td class="py-2 px-1 text-center">${can ? `<select data-rb-perm="${esc(x.id)}" data-mod="${k}" class="text-xs font-semibold rounded-full border px-2 py-1 ${LEVEL_CLS[lv]} ${changed ? 'ring-2 ring-blue-400' : ''}">${LEVELS.map(([v, t]) => `<option value="${v}"${v === lv ? ' selected' : ''}>${t}</option>`).join('')}</select>` : chip(lv)}</td>`;
            }).join('')}</tr>`;
        };
        const nDraft = Object.values(R.draft).reduce((n, o) => n + Object.keys(o).length, 0);
        const matrix = `<div class="overflow-x-auto -mx-1"><table class="min-w-[720px] w-full"><thead><tr class="text-xs text-gray-500"><th class="text-left font-semibold pb-2 pr-3">แผนก / ตำแหน่ง</th>${MODULES.map(([, t], i) => `<th class="font-semibold pb-2 px-1">${i + 1}. ${t}</th>`).join('')}</tr></thead>
            <tbody>${lockRow('ผู้บริหาร')}${lockRow('รองผู้บริหาร')}${depts.map(deptRow).join('') || `<tr><td colspan="7" class="py-4 text-center text-sm text-gray-400">ยังไม่มีแผนก</td></tr>`}</tbody></table></div>
            <ul class="mt-3 text-xs text-gray-500 list-disc pl-5 space-y-0.5"><li>ทุกคนดูข้อมูลทุกหมวดได้ สิทธิ์ในตารางคือสิทธิ์ "แก้ไข" (สร้าง/แก้/ลบ) ของแต่ละแผนก</li><li>ทุกคนอัปเดตงานที่ตัวเองได้รับมอบหมายได้เสมอ · พนักงานที่ยังไม่มีแผนกดูได้ทุกหมวดแต่แก้ไม่ได้</li><li>"เฉพาะหัวหน้าแผนก" = หัวหน้าของแผนกนั้นแก้ได้คนเดียว · ตั้งค่าทีม (แผนก ตำแหน่ง สิทธิ์ แพ็กเกจ) เฉพาะผู้บริหาร/รองผู้บริหาร · รายงาน: Export/แชร์ ตามสิทธิ์หมวดรายงาน</li></ul>
            ${can ? `<div class="mt-4 flex flex-wrap items-center gap-2">${btn(`data-rb="preview"${nDraft ? '' : ' disabled'}`, `ตรวจทานและบันทึก${nDraft ? ` (${nDraft})` : ''}`, 'primary')}${nDraft ? btn('data-rb="discard"', 'ยกเลิกการเปลี่ยน') : ''}</div><div id="cw-rb-preview"></div>` : ''}`;

        box.innerHTML = card('แผนกและสิทธิ์', 'ตำแหน่ง → แผนก → สิทธิ์ · ตรวจสิทธิ์จริงที่ฐานข้อมูลทุกครั้ง', `${reason}${mine}`, can ? btn('data-rb="audit"', '<i class="fa-solid fa-clock-rotate-left mr-1"></i>ประวัติการเปลี่ยนแปลง') : '')
            + card('1. แผนก', 'ผู้บริหาร/รองผู้บริหารเพิ่ม แก้ไข ปิดใช้งาน หรือลบแผนก และเลือกหัวหน้าของแผนก',addForm + `<div class="space-y-2">${deptRows}</div>`)
            + card('2. กำหนดแผนกและตำแหน่งให้สมาชิก', 'เลือกแผนกให้สมาชิกแต่ละคนในคอลัมน์ "แผนก" · ผู้บริหารแต่งตั้ง/ปลดผู้บริหารและรองผู้บริหารได้ (ผู้สร้างทีมเป็นผู้บริหารเสมอ) · ผู้บริหาร/รองผู้บริหารไม่ต้องสังกัดแผนก',`<div class="overflow-x-auto"><table class="w-full min-w-[520px]"><thead><tr class="text-xs text-gray-500 text-left"><th class="font-semibold pb-2">สมาชิก</th><th class="font-semibold pb-2">ตำแหน่ง</th><th class="font-semibold pb-2">แผนก</th></tr></thead><tbody>${memRows || '<tr><td colspan="3" class="py-4 text-center text-sm text-gray-400">ยังไม่มีสมาชิก</td></tr>'}</tbody></table></div>`)
            + card('3. ตารางสิทธิ์ (Permission Matrix)', 'แถว = แผนก/ตำแหน่ง · คอลัมน์ = หมวดงาน', matrix)
            + '<div id="cw-rb-audit"></div>';
    }

    function toast(msg, ok) {
        const t = document.createElement('div');
        t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[700] px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold ${ok === false ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'}`;
        t.setAttribute('data-no-i18n', '');
        t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3200);
    }
    async function act(button, job, okMsg) {
        if (button) button.disabled = true;
        try { await job(); toast(okMsg || 'บันทึกแล้ว'); await render(); App._loadData && App._loadData(); }
        catch (e) { toast(errText(e), false); if (button) button.disabled = false; }
    }

    function onChange(e) {
        const p = e.target.closest('[data-rb-perm]');
        if (p) {
            const id = p.getAttribute('data-rb-perm'), mod = p.getAttribute('data-mod');
            const dept = (R.data.departments || []).find(x => String(x.id) === id);
            const orig = (dept && dept.permissions && dept.permissions[mod]) || 'view';
            R.draft[id] = R.draft[id] || {};
            if (p.value === orig) delete R.draft[id][mod]; else R.draft[id][mod] = p.value;
            if (!Object.keys(R.draft[id]).length) delete R.draft[id];
            paint(); return;
        }
        const dsel = e.target.closest('[data-rb-dept]');
        if (dsel) {
            const uid = dsel.getAttribute('data-rb-dept');
            act(null, () => rpc('cw_assign_member', { p_company: team(), p_user: uid, p_department: dsel.value || null }), 'เปลี่ยนแผนกแล้ว');
            return;
        }
        const rsel = e.target.closest('[data-rb-rank]');
        if (rsel) {
            const uid = rsel.getAttribute('data-rb-rank');
            const msg = rsel.value === 'super_admin' ? 'แต่งตั้งเป็นผู้บริหาร? ผู้บริหารแก้ไขได้ทุกหมวด จัดการแผนก/สิทธิ์ และแต่งตั้ง/ปลดผู้บริหารคนอื่นได้'
                : rsel.value === 'company_admin' ? 'ตั้งเป็นรองผู้บริหาร? รองผู้บริหารแก้ไขได้ทุกหมวดและจัดการแผนก/สิทธิ์ได้' : 'เปลี่ยนเป็นพนักงาน?';
            if (!confirm(msg)) { paint(); return; }
            act(null, () => rpc('set_member_role', { p_company: team(), p_user: uid, p_role: rsel.value }), 'เปลี่ยนตำแหน่งแล้ว');
        }
    }

    function onClick(e) {
        const b = e.target.closest('[data-rb]'); if (!b) return;
        const what = b.getAttribute('data-rb'), id = b.getAttribute('data-id');
        const depts = (R.data && R.data.departments) || [];
        const form = id ? document.querySelector(`#cw-rbac [data-rb-form="${id}"]`) : null;
        if (what === 'reload') return render();
        if (what === 'edit' || what === 'cancel') { if (form) form.classList.toggle('hidden', what === 'cancel'); return; }
        if (what === 'save' && form) {
            const v = f => (form.querySelector(`[data-f="${f}"]`) || {}).value || '';
            if (!v('name').trim()) { toast('กรุณาตั้งชื่อแผนก', false); return; }
            act(b, () => rpc('cw_save_department', { p_company: team(), p_id: id === 'new' ? null : id, p_name: v('name'), p_description: v('description') || null, p_head: v('head') || null }), id === 'new' ? 'เพิ่มแผนกแล้ว' : 'บันทึกแผนกแล้ว');
            return;
        }
        if (what === 'status') {
            const x = depts.find(y => String(y.id) === id); if (!x) return;
            const off = x.status !== 'inactive';
            if (off && !confirm(`ปิดใช้งานแผนก "${x.name}"? สมาชิกในแผนกจะเหลือสิทธิ์แก้ไขเฉพาะงานของตัวเองจนกว่าจะเปิดใช้งานอีกครั้ง`)) return;
            act(b, () => rpc('cw_set_department_status', { p_id: id, p_status: off ? 'inactive' : 'active' }), off ? 'ปิดใช้งานแล้ว' : 'เปิดใช้งานแล้ว');
            return;
        }
        if (what === 'delete') {
            const x = depts.find(y => String(y.id) === id); if (!x) return;
            let moveTo = null;
            if (x.member_count > 0) {
                const others = depts.filter(y => y.id !== x.id && y.status === 'active');
                if (!others.length) { toast('แผนกนี้ยังมีสมาชิก ต้องมีแผนกอื่นให้ย้ายไปก่อน', false); return; }
                const pick = prompt(`แผนก "${x.name}" มีสมาชิก ${x.member_count} คน\nพิมพ์เลขแผนกที่จะย้ายสมาชิกไป:\n` + others.map((y, i) => `${i + 1}. ${y.name}`).join('\n'));
                if (pick == null) return;
                const o = others[parseInt(pick, 10) - 1]; if (!o) { toast('เลือกแผนกไม่ถูกต้อง', false); return; }
                moveTo = o.id;
            }
            if (!confirm(`ลบแผนก "${x.name}" และสิทธิ์ของแผนกนี้? ย้อนกลับไม่ได้`)) return;
            act(b, () => rpc('cw_delete_department', { p_id: id, p_move_to: moveTo }), 'ลบแผนกแล้ว');
            return;
        }
        if (what === 'import') {
            const names = [...document.querySelectorAll('#dept-list-container .dept-item span')].map(s => s.textContent.trim()).filter(n => n && !depts.some(x => x.name.toLowerCase() === n.toLowerCase()));
            if (!names.length || !confirm(`นำเข้า ${names.length} แผนก (${names.join(', ')}) เป็นแผนกจริง? ทุกแผนกเริ่มต้นเป็น "ดูอย่างเดียว"`)) return;
            act(b, async () => { for (const n of names) await rpc('cw_save_department', { p_company: team(), p_id: null, p_name: n, p_description: null, p_head: null }); }, 'นำเข้าแผนกแล้ว');
            return;
        }
        if (what === 'discard') { R.draft = {}; paint(); return; }
        if (what === 'preview') return preview();
        if (what === 'apply') {
            const jobs = Object.entries(R.draft);
            act(b, async () => { for (const [dept, perms] of jobs) await rpc('cw_set_department_permissions', { p_id: dept, p_perms: perms }); }, 'บันทึกสิทธิ์แล้ว มีผลทันที');
            return;
        }
        if (what === 'audit') return audit();
    }

    /* summary of the changes before saving, with a warning for wide rights */
    function preview() {
        const box = document.getElementById('cw-rb-preview'); if (!box) return;
        const depts = R.data.departments || [], wide = [];
        const lines = Object.entries(R.draft).map(([id, perms]) => {
            const x = depts.find(y => String(y.id) === id) || { name: '?', permissions: {}, member_count: 0 };
            return Object.entries(perms).map(([mod, lv]) => {
                const label = (MODULES.find(m => m[0] === mod) || [mod, mod])[1];
                if (lv === 'edit_dept' && (mod === 'accounting' || mod === 'employees')) wide.push(`${x.name} → ${label}`);
                return `<li><b>${esc(x.name)}</b> · ${esc(label)}: ${LEVEL_TXT[(x.permissions || {})[mod] || 'view']} → <b>${LEVEL_TXT[lv]}</b> <span class="text-gray-400">(มีผลกับ ${x.member_count || 0} คน)</span></li>`;
            }).join('');
        }).join('');
        box.innerHTML = `<div class="mt-4 border border-blue-200 bg-blue-50 rounded-lg p-4"><div class="font-semibold text-gray-800 mb-2">สรุปการเปลี่ยนแปลง</div><ul class="text-sm text-gray-700 space-y-1 list-disc pl-5">${lines}</ul>
            ${wide.length ? `<div class="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i>สิทธิ์กว้างกว่าปกติ: ทุกคนในแผนกจะแก้ไขได้ — ${esc(wide.join(', '))}</div>` : ''}
            <div class="mt-3 flex gap-2">${btn('data-rb="apply"', 'ยืนยันบันทึก', 'primary')}${btn('data-rb="discard"', 'ยกเลิก')}</div></div>`;
    }

    async function audit() {
        const box = document.getElementById('cw-rb-audit'); if (!box) return;
        box.innerHTML = card('ประวัติการเปลี่ยนแปลง', '', '<p class="text-sm text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังโหลด…</p>');
        try {
            const { data, error } = await sb().from('cw_audit_log').select('action, actor_id, target_type, target_id, before, after, created_at').eq('company_id', team()).order('created_at', { ascending: false }).limit(30);
            if (error) throw error;
            const members = R.data.members || [], name = id => { const m = members.find(x => String(x.user_id) === String(id)); return m ? m.name : (id ? 'ผู้ใช้' : 'ระบบ'); };
            const deptName = id => { const d = (R.data.departments || []).find(x => String(x.id) === String(id)); return d ? d.name : (id ? '(แผนกที่ลบแล้ว)' : '—'); };
            const ACT = { 'department.create': 'เพิ่มแผนก', 'department.update': 'แก้ไขแผนก', 'department.status': 'เปลี่ยนสถานะแผนก', 'department.delete': 'ลบแผนก', 'department.permissions': 'เปลี่ยนสิทธิ์แผนก', 'member.assignment': 'เปลี่ยนตำแหน่ง/แผนกสมาชิก', 'migration.rbac_demote': 'ปรับเป็น Member (ระบบ)' };
            const what = r => {
                if (r.target_type === 'member') {
                    const b = r.before || {}, a = r.after || {};
                    const parts = [];
                    if (b.role !== a.role) parts.push(`ตำแหน่ง ${RANK_TXT[{ super_admin: 'head', company_admin: 'deputy' }[b.role] || 'member']} → ${RANK_TXT[{ super_admin: 'head', company_admin: 'deputy' }[a.role] || 'member']}`);
                    if (b.department_id !== a.department_id && ('department_id' in a)) parts.push(`แผนก ${deptName(b.department_id)} → ${deptName(a.department_id)}`);
                    return `${esc(name(r.target_id))}: ${esc(parts.join(', '))}`;
                }
                const n = (r.after && r.after.name) || (r.before && r.before.name) || '';
                if (r.action === 'department.permissions') {
                    const b = (r.before && r.before.permissions) || {}, a = (r.after && r.after.permissions) || {};
                    return `${esc(n)}: ` + Object.keys(a).filter(k => a[k] !== b[k]).map(k => `${esc((MODULES.find(m => m[0] === k) || [k, k])[1])} ${LEVEL_TXT[b[k] || 'view']} → ${LEVEL_TXT[a[k]]}`).join(', ');
                }
                if (r.action === 'department.status') return `${esc(n)}: ${r.after && r.after.status === 'inactive' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}`;
                return esc(n);
            };
            const rows = (data || []).map(r => `<tr class="border-t border-gray-100 align-top"><td class="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">${new Date(r.created_at).toLocaleString('th-TH')}</td><td class="py-2 pr-3 text-sm text-gray-700 whitespace-nowrap">${esc(name(r.actor_id))}</td><td class="py-2 pr-3 text-sm font-semibold text-gray-800 whitespace-nowrap">${ACT[r.action] || esc(r.action)}</td><td class="py-2 text-sm text-gray-600">${what(r)}</td></tr>`).join('');
            box.innerHTML = card('ประวัติการเปลี่ยนแปลง', 'ล่าสุด 30 รายการ · ใคร เมื่อไร เปลี่ยนอะไร', rows ? `<div class="overflow-x-auto"><table class="w-full min-w-[560px]"><tbody>${rows}</tbody></table></div>` : '<p class="text-sm text-gray-400">ยังไม่มีประวัติ</p>');
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) { box.innerHTML = card('ประวัติการเปลี่ยนแปลง', '', `<p class="text-sm text-red-600">โหลดไม่สำเร็จ: ${esc(errText(e))}</p>`); }
    }

    /* open with the page; refresh what I may do whenever the team's data is loaded */
    const origSwitch = App.switchView.bind(App);
    App.switchView = function (view) {
        const r = origSwitch.apply(App, arguments);
        if (view === 'role-settings') render();
        return r;
    };
    const origLoad = App._loadData.bind(App);
    App._loadData = async function () {
        const r = await origLoad.apply(App, arguments);
        await loadAccess();
        if (App.applyGlobalPermissions) try { App.applyGlobalPermissions(); } catch (e) { }
        return r;
    };
    window.CwRbac = { render, loadAccess };
})();
