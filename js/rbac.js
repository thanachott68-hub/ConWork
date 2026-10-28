/**
 * ConWork — Departments & permissions (ผู้บริหาร → รองผู้บริหาร → หัวหน้า (of a department) → พนักงาน)
 * The rules live in the database (cw_can_edit, row level security and the cw_* functions):
 * this page only shows them and sends changes; hiding a button here is a convenience, never the guard.
 * "ตั้งค่าพนักงาน" (view-role-settings): the แผนก box on the left now holds the team's real departments,
 * and the right column is the permission table (ดูอย่างเดียว / ✓ แก้ไขได้) plus who is in which department.
 * Needs js/app.js.
 */
(function () {
    if (typeof App === 'undefined') return;

    const MODULES = [
        ['projects', 'โปรเจกต์'], ['tasks', 'งาน'], ['reports', 'รายงาน'],
        ['accounting', 'บัญชี & งบ'], ['employees', 'พนักงาน'], ['settings', 'ตั้งค่าทีม']
    ];
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
    const live = () => !!(team() && sb());
    const errText = e => (e && (e.message || e.error_description || e.details)) || String(e || 'เกิดข้อผิดพลาด');
    async function rpc(name, args) {
        const c = sb(); if (!c) throw new Error('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
        const { data, error } = await c.rpc(name, args);
        if (error) throw error;
        return data;
    }
    /* edit = ✓ (everyone in the department may edit that section); anything else = ดูอย่างเดียว */
    const canEditLevel = lv => lv === 'edit_dept';

    const R = { data: null, access: null, draft: {}, error: '' };

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
    /* the right column of ตั้งค่าพนักงาน; its old table was kept in this browser only and never checked */
    function mount() {
        let box = document.getElementById('cw-rbac');
        if (box) return box;
        const view = document.getElementById('view-role-settings'); if (!view) return null;
        const old = view.querySelector('#role-filter-select');
        const col = old && old.closest('.flex-1.bg-white');
        if (!col) return null;
        col.innerHTML = '';
        col.classList.remove('overflow-hidden');
        box = document.createElement('div');
        box.id = 'cw-rbac'; box.className = 'flex flex-col gap-8 min-w-0'; box.setAttribute('data-no-i18n', '');
        col.appendChild(box);
        box.addEventListener('click', onClick);
        box.addEventListener('change', onChange);
        return box;
    }
    const btn = (attr, label, kind) => `<button type="button" ${attr} class="${kind === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">${label}</button>`;
    const tick = on => on
        ? '<span class="inline-flex w-6 h-6 rounded-md bg-emerald-500 text-white items-center justify-center text-xs"><i class="fa-solid fa-check"></i></span>'
        : '<span class="inline-flex w-6 h-6 rounded-md bg-gray-100 text-gray-300 items-center justify-center text-xs"><i class="fa-solid fa-minus"></i></span>';

    async function render() {
        const box = mount(); if (!box) return;
        if (!live()) { box.innerHTML = '<p class="text-sm text-gray-500">เลือกทีมและเชื่อมต่อฐานข้อมูลก่อน จึงจะตั้งค่าแผนกและสิทธิ์ได้</p>'; return; }
        box.innerHTML = '<p class="text-sm text-gray-400 py-6"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังโหลด…</p>';
        try {
            const [ov] = await Promise.all([rpc('cw_rbac_overview', { p_company: team() }), loadAccess()]);
            R.data = ov; R.error = ''; R.draft = {};
        } catch (e) { R.data = null; R.error = errText(e); }
        paint();
    }

    /* the แผนก box on the left: the team's real departments, in the box's own look (other pages read the names from it) */
    function paintDepartments() {
        const list = document.getElementById('dept-list-container'); if (!list || !R.data) return;
        const can = !!R.data.can_manage, depts = R.data.departments || [];
        const inputRow = document.getElementById('new-dept-input');
        if (inputRow && inputRow.parentElement) inputRow.parentElement.style.display = can ? '' : 'none';
        list.innerHTML = depts.map(x => `<div class="dept-item flex items-center justify-between p-2.5 bg-white border border-gray-200 shadow-sm rounded-lg group hover:border-gray-300 transition-colors ${x.status === 'inactive' ? 'opacity-60' : ''}" data-dept-id="${esc(x.id)}">
                <div class="flex items-center gap-2 min-w-0">
                    <div class="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] shrink-0"><i class="fa-solid fa-users"></i></div>
                    <span class="text-sm font-medium text-gray-700 pointer-events-none truncate">${esc(x.name)}</span>
                    <em class="not-italic text-[11px] text-gray-400 shrink-0">${x.member_count || 0} คน</em>
                </div>
                ${can ? '<div class="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity"><button type="button" class="text-red-400 hover:text-red-600 transition-colors" title="ลบแผนก" onclick="App.deleteRoleDepartment(this)"><i class="fa-regular fa-trash-can"></i></button></div>' : ''}
            </div>`).join('') || '<p class="text-xs text-gray-400 px-1 py-2">ยังไม่มีแผนก</p>';
        const countEl = document.getElementById('dept-total-count');
        if (countEl) countEl.textContent = `รวม ${depts.length} แผนก`;
    }

    function paint() {
        const box = mount(); if (!box) return;
        if (R.error) {
            box.innerHTML = `<div class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">โหลดไม่สำเร็จ: ${esc(R.error)}</div><div>${btn('data-rb="reload"', 'ลองอีกครั้ง')}</div>`;
            return;
        }
        paintDepartments();
        const d = R.data, can = !!d.can_manage, depts = d.departments || [], members = d.members || [];
        const me = String(App.state.currentUser && App.state.currentUser.id);

        /* permission table: rows = ตำแหน่ง/แผนก, columns = sections; ✓ = may edit, empty = ดูอย่างเดียว */
        const lockRow = label => `<tr class="border-t border-gray-100 bg-blue-50/40"><td class="py-2.5 pr-3 text-sm font-semibold text-gray-800 whitespace-nowrap">${label}<div class="text-[11px] font-normal text-gray-400">ตามตำแหน่ง · ล็อก</div></td>${MODULES.map(() => `<td class="py-2.5 px-1 text-center">${tick(true)}</td>`).join('')}</tr>`;
        const deptRow = x => {
            const perms = Object.assign({}, x.permissions || {}, R.draft[x.id] || {});
            const off = x.status === 'inactive';
            return `<tr class="border-t border-gray-100 ${off ? 'opacity-60' : ''}"><td class="py-2.5 pr-3 text-sm font-semibold text-gray-800 whitespace-nowrap">${esc(x.name)}${off ? '<div class="text-[11px] font-normal text-gray-400">ปิดใช้งาน</div>' : ''}</td>${MODULES.map(([k]) => {
                if (k === 'settings') return `<td class="py-2.5 px-1 text-center" title="เฉพาะผู้บริหาร/รองผู้บริหาร">${tick(false)}</td>`;
                const on = canEditLevel(perms[k]);
                const changed = R.draft[x.id] && (k in R.draft[x.id]);
                return `<td class="py-2.5 px-1 text-center">${can
                    ? `<label class="inline-flex items-center justify-center w-9 h-9 rounded-lg cursor-pointer hover:bg-gray-50 ${changed ? 'ring-2 ring-blue-400' : ''}"><input type="checkbox" data-rb-perm="${esc(x.id)}" data-mod="${k}" class="w-5 h-5 accent-emerald-600 cursor-pointer"${on ? ' checked' : ''}></label>`
                    : tick(on)}</td>`;
            }).join('')}</tr>`;
        };
        const nDraft = Object.values(R.draft).reduce((n, o) => n + Object.keys(o).length, 0);
        const matrix = `<div>
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-gray-100 pb-4">
                <h3 class="font-bold text-gray-800 text-lg">สิทธิ์การใช้งาน ( Permission )</h3>
                ${can ? btn('data-rb="audit"', '<i class="fa-solid fa-clock-rotate-left mr-1"></i>ประวัติการเปลี่ยนแปลง') : ''}
            </div>
            ${can ? '' : '<p class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3"><i class="fa-solid fa-lock mr-1"></i>ดูได้อย่างเดียว: เฉพาะผู้บริหารและรองผู้บริหารที่แก้ไขสิทธิ์ได้</p>'}
            <div class="overflow-x-auto"><table class="min-w-[640px] w-full"><thead><tr class="text-xs text-gray-500"><th class="text-left font-semibold pb-2 pr-3">ตำแหน่ง / แผนก</th>${MODULES.map(([, t], i) => `<th class="font-semibold pb-2 px-1">${i + 1}. ${t}</th>`).join('')}</tr></thead>
            <tbody>${lockRow('ผู้บริหาร')}${lockRow('รองผู้บริหาร')}${depts.map(deptRow).join('') || `<tr><td colspan="7" class="py-5 text-center text-sm text-gray-400 border-t border-gray-100">ยังไม่มีแผนก — เพิ่มแผนกในกล่อง "แผนก" ทางซ้าย</td></tr>`}</tbody></table></div>
            <p class="mt-3 text-xs text-gray-500"><span class="inline-flex align-middle mr-1">${tick(true)}</span> = แก้ไขได้ (สร้าง/แก้/ลบ) · ไม่ติ๊ก = ดูอย่างเดียว · ทุกคนดูข้อมูลได้ทุกหมวด · ทุกคนอัปเดตงานที่ตัวเองได้รับมอบหมายได้ · ตั้งค่าทีมเฉพาะผู้บริหาร/รองผู้บริหาร</p>
            ${can ? `<div class="mt-4 flex flex-wrap items-center gap-2">${btn(`data-rb="preview"${nDraft ? '' : ' disabled'}`, `บันทึกสิทธิ์${nDraft ? ` (${nDraft})` : ''}`, 'primary')}${nDraft ? btn('data-rb="discard"', 'ยกเลิก') : ''}</div><div id="cw-rb-preview"></div>` : ''}
        </div>`;

        /* who is in which department, and their ตำแหน่ง */
        const deptOpts = sel => '<option value="">— ไม่มีแผนก —</option>' + depts.filter(x => x.status === 'active' || String(x.id) === String(sel)).map(x => `<option value="${esc(x.id)}"${String(sel) === String(x.id) ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
        const memRows = members.map(m => {
            const self = String(m.user_id) === me;
            const headOf = depts.find(x => String(x.head_user_id) === String(m.user_id));
            const rank = m.rank === 'member' ? (headOf ? 'dept_head' : 'member') : m.rank;
            const label = { head: 'ผู้บริหาร', deputy: 'รองผู้บริหาร', dept_head: 'หัวหน้า', member: 'พนักงาน' }[rank];
            let rankCell;
            if (can && !self && !m.is_creator && (d.is_head || m.rank === 'member')) {
                const opts = [['member', 'พนักงาน'], ['dept_head', 'หัวหน้า']].concat(d.is_head ? [['deputy', 'รองผู้บริหาร'], ['head', 'ผู้บริหาร']] : []);
                rankCell = `<select data-rb-rank="${esc(m.user_id)}" class="border border-gray-200 rounded-lg px-2 py-1 text-sm">${opts.map(([v, t]) => `<option value="${v}"${v === rank ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
            } else {
                rankCell = `<span class="text-sm font-semibold ${rank === 'head' ? 'text-blue-700' : rank === 'deputy' ? 'text-blue-600' : 'text-gray-700'}">${label}${m.is_creator ? ' · ผู้สร้างทีม' : ''}</span>`;
            }
            const deptCell = m.rank !== 'member' ? '<span class="text-xs text-gray-400">ดูแลทุกแผนก</span>'
                : (can && !self ? `<select data-rb-dept="${esc(m.user_id)}" class="border border-gray-200 rounded-lg px-2 py-1 text-sm max-w-[12rem]">${deptOpts(m.department_id)}</select>`
                    : `<span class="text-sm text-gray-700">${esc((depts.find(x => String(x.id) === String(m.department_id)) || {}).name || '—')}</span>`);
            return `<tr class="border-t border-gray-100"><td class="py-2 pr-3"><div class="text-sm font-medium text-gray-800">${esc(m.name)}${self ? ' <span class="text-xs text-gray-400">(คุณ)</span>' : ''}</div><div class="text-xs text-gray-400">${esc(m.email || '')}</div></td><td class="py-2 pr-3">${rankCell}</td><td class="py-2">${deptCell}</td></tr>`;
        }).join('');
        const people = `<div>
            <div class="mb-3"><h3 class="font-bold text-gray-800">ตำแหน่งและแผนกของสมาชิก</h3>
            <p class="text-xs text-gray-500 mt-0.5">เลือกแผนกให้แต่ละคน · หัวหน้า = หัวหน้าของแผนกนั้น (แผนกละ 1 คน) · ผู้บริหารแต่งตั้ง/ปลดผู้บริหารและรองผู้บริหารได้ (ผู้สร้างทีมเป็นผู้บริหารเสมอ)</p></div>
            <div class="overflow-x-auto"><table class="w-full min-w-[480px]"><thead><tr class="text-xs text-gray-500 text-left"><th class="font-semibold pb-2">สมาชิก</th><th class="font-semibold pb-2">ตำแหน่ง</th><th class="font-semibold pb-2">แผนก</th></tr></thead><tbody>${memRows || '<tr><td colspan="3" class="py-4 text-center text-sm text-gray-400">ยังไม่มีสมาชิก</td></tr>'}</tbody></table></div>
        </div>`;

        box.innerHTML = matrix + people + '<div id="cw-rb-audit"></div>';
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
        catch (e) { toast(errText(e), false); if (button) button.disabled = false; paint(); }
    }

    /* ---------- the แผนก box: add / delete go to the database ---------- */
    const origAddDept = App.addRoleDepartment && App.addRoleDepartment.bind(App);
    App.addRoleDepartment = function () {
        if (!live() || !R.data) return origAddDept && origAddDept();
        const input = document.getElementById('new-dept-input');
        const name = input ? input.value.trim() : '';
        if (!name) return;
        if ((R.data.departments || []).some(x => x.name.trim().toLowerCase() === name.toLowerCase())) { toast('แผนกนี้มีอยู่แล้ว', false); return; }
        act(null, async () => { await rpc('cw_save_department', { p_company: team(), p_id: null, p_name: name, p_description: null, p_head: null }); if (input) input.value = ''; }, 'เพิ่มแผนกแล้ว — ติ๊กสิทธิ์ในตารางทางขวาได้เลย');
    };
    const origDelDept = App.deleteRoleDepartment && App.deleteRoleDepartment.bind(App);
    App.deleteRoleDepartment = function (b) {
        const item = b && b.closest('.dept-item'), id = item && item.getAttribute('data-dept-id');
        if (!live() || !R.data || !id) return origDelDept && origDelDept(b);
        const depts = R.data.departments || [], x = depts.find(y => String(y.id) === id); if (!x) return;
        let moveTo = null;
        if (x.member_count > 0) {
            const others = depts.filter(y => y.id !== x.id && y.status === 'active');
            if (!others.length) { toast(`แผนก "${x.name}" ยังมีสมาชิก ${x.member_count} คน ย้ายสมาชิกออกหรือเพิ่มแผนกอื่นก่อน`, false); return; }
            const pick = prompt(`แผนก "${x.name}" มีสมาชิก ${x.member_count} คน\nพิมพ์เลขแผนกที่จะย้ายสมาชิกไป:\n` + others.map((y, i) => `${i + 1}. ${y.name}`).join('\n'));
            if (pick == null) return;
            const o = others[parseInt(pick, 10) - 1]; if (!o) { toast('เลือกแผนกไม่ถูกต้อง', false); return; }
            moveTo = o.id;
        }
        if (!confirm(`ลบแผนก "${x.name}" และสิทธิ์ของแผนกนี้?`)) return;
        act(null, () => rpc('cw_delete_department', { p_id: id, p_move_to: moveTo }), 'ลบแผนกแล้ว');
    };

    function onChange(e) {
        const p = e.target.closest('[data-rb-perm]');
        if (p) {
            const id = p.getAttribute('data-rb-perm'), mod = p.getAttribute('data-mod');
            const dept = (R.data.departments || []).find(x => String(x.id) === id);
            const orig = canEditLevel(dept && dept.permissions && dept.permissions[mod]);
            R.draft[id] = R.draft[id] || {};
            if (p.checked === orig) delete R.draft[id][mod]; else R.draft[id][mod] = p.checked ? 'edit_dept' : 'view';
            if (!Object.keys(R.draft[id]).length) delete R.draft[id];
            paint(); return;
        }
        const dsel = e.target.closest('[data-rb-dept]');
        if (dsel) {
            act(null, () => rpc('cw_assign_member', { p_company: team(), p_user: dsel.getAttribute('data-rb-dept'), p_department: dsel.value || null }), 'เปลี่ยนแผนกแล้ว');
            return;
        }
        const rsel = e.target.closest('[data-rb-rank]');
        if (rsel) changeRank(rsel.getAttribute('data-rb-rank'), rsel.value);
    }

    /* ตำแหน่ง: ผู้บริหาร / รองผู้บริหาร are team roles; หัวหน้า is the head of the person's department */
    function changeRank(uid, to) {
        const d = R.data, m = (d.members || []).find(x => String(x.user_id) === String(uid)); if (!m) return;
        const depts = d.departments || [];
        const myDept = depts.find(x => String(x.id) === String(m.department_id));
        const headOf = depts.find(x => String(x.head_user_id) === String(uid));
        const setHead = (dept, user) => rpc('cw_save_department', { p_company: team(), p_id: dept.id, p_name: dept.name, p_description: dept.description || null, p_head: user });
        if (to === 'dept_head') {
            if (!myDept) { toast('เลือกแผนกให้คนนี้ก่อน แล้วค่อยตั้งเป็นหัวหน้า', false); paint(); return; }
            const before = myDept.head_user_id && myDept.head_user_id !== uid ? `\n(หัวหน้าเดิมของแผนกนี้จะกลับเป็นพนักงาน)` : '';
            if (!confirm(`ตั้ง ${m.name} เป็นหัวหน้าแผนก "${myDept.name}"?${before}`)) { paint(); return; }
            act(null, async () => { if (m.rank !== 'member') await rpc('set_member_role', { p_company: team(), p_user: uid, p_role: 'employee' }); await setHead(myDept, uid); }, 'ตั้งหัวหน้าแผนกแล้ว');
            return;
        }
        if (to === 'member') {
            if (!confirm(`เปลี่ยน ${m.name} เป็นพนักงาน?`)) { paint(); return; }
            act(null, async () => {
                if (m.rank !== 'member') await rpc('set_member_role', { p_company: team(), p_user: uid, p_role: 'employee' });
                else if (headOf) await setHead(headOf, null);
            }, 'เปลี่ยนตำแหน่งแล้ว');
            return;
        }
        const role = to === 'head' ? 'super_admin' : 'company_admin';
        const msg = to === 'head' ? `แต่งตั้ง ${m.name} เป็นผู้บริหาร? ผู้บริหารแก้ไขได้ทุกหมวด จัดการแผนก/สิทธิ์ และแต่งตั้ง/ปลดผู้บริหารคนอื่นได้`
            : `ตั้ง ${m.name} เป็นรองผู้บริหาร? รองผู้บริหารแก้ไขได้ทุกหมวดและจัดการแผนก/สิทธิ์ได้`;
        if (!confirm(msg)) { paint(); return; }
        act(null, () => rpc('set_member_role', { p_company: team(), p_user: uid, p_role: role }), 'เปลี่ยนตำแหน่งแล้ว');
    }

    function onClick(e) {
        const b = e.target.closest('[data-rb]'); if (!b) return;
        const what = b.getAttribute('data-rb');
        if (what === 'reload') return render();
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
            const x = depts.find(y => String(y.id) === id) || { name: '?', member_count: 0 };
            return Object.entries(perms).map(([mod, lv]) => {
                const label = (MODULES.find(m => m[0] === mod) || [mod, mod])[1];
                if (canEditLevel(lv) && (mod === 'accounting' || mod === 'employees')) wide.push(`${x.name} → ${label}`);
                return `<li><b>${esc(x.name)}</b> · ${esc(label)}: ${canEditLevel(lv) ? '<span class="text-emerald-700 font-semibold">แก้ไขได้</span>' : '<span class="text-gray-600 font-semibold">ดูอย่างเดียว</span>'} <span class="text-gray-400">(มีผลกับ ${x.member_count || 0} คน)</span></li>`;
            }).join('');
        }).join('');
        box.innerHTML = `<div class="mt-4 border border-blue-200 bg-blue-50 rounded-lg p-4"><div class="font-semibold text-gray-800 mb-2">สรุปการเปลี่ยนแปลง</div><ul class="text-sm text-gray-700 space-y-1 list-disc pl-5">${lines}</ul>
            ${wide.length ? `<div class="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i>สิทธิ์กว้างกว่าปกติ: ทุกคนในแผนกจะแก้ไขได้ — ${esc(wide.join(', '))}</div>` : ''}
            <div class="mt-3 flex gap-2">${btn('data-rb="apply"', 'ยืนยันบันทึก', 'primary')}${btn('data-rb="discard"', 'ยกเลิก')}</div></div>`;
    }

    async function audit() {
        const box = document.getElementById('cw-rb-audit'); if (!box) return;
        const wrap = body => `<div><h3 class="font-bold text-gray-800 mb-3">ประวัติการเปลี่ยนแปลง <span class="text-xs font-normal text-gray-400">ล่าสุด 30 รายการ</span></h3>${body}</div>`;
        box.innerHTML = wrap('<p class="text-sm text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>กำลังโหลด…</p>');
        try {
            const { data, error } = await sb().from('cw_audit_log').select('action, actor_id, target_type, target_id, before, after, created_at').eq('company_id', team()).order('created_at', { ascending: false }).limit(30);
            if (error) throw error;
            const members = R.data.members || [], name = id => { const m = members.find(x => String(x.user_id) === String(id)); return m ? m.name : (id ? 'ผู้ใช้' : 'ระบบ'); };
            const deptName = id => { const d = (R.data.departments || []).find(x => String(x.id) === String(id)); return d ? d.name : (id ? '(แผนกที่ลบแล้ว)' : '—'); };
            const roleTxt = r => RANK_TXT[{ super_admin: 'head', company_admin: 'deputy' }[r] || 'member'];
            const ACT = { 'department.create': 'เพิ่มแผนก', 'department.update': 'แก้ไขแผนก', 'department.status': 'เปลี่ยนสถานะแผนก', 'department.delete': 'ลบแผนก', 'department.permissions': 'เปลี่ยนสิทธิ์แผนก', 'member.assignment': 'เปลี่ยนตำแหน่ง/แผนกสมาชิก', 'migration.rbac_demote': 'ปรับเป็นพนักงาน (ระบบ)' };
            const what = r => {
                if (r.target_type === 'member') {
                    const b = r.before || {}, a = r.after || {}, parts = [];
                    if (b.role !== a.role) parts.push(`ตำแหน่ง ${roleTxt(b.role)} → ${roleTxt(a.role)}`);
                    if (b.department_id !== a.department_id && ('department_id' in a)) parts.push(`แผนก ${deptName(b.department_id)} → ${deptName(a.department_id)}`);
                    return `${esc(name(r.target_id))}: ${esc(parts.join(', '))}`;
                }
                const n = (r.after && r.after.name) || (r.before && r.before.name) || '';
                if (r.action === 'department.permissions') {
                    const b = (r.before && r.before.permissions) || {}, a = (r.after && r.after.permissions) || {};
                    return `${esc(n)}: ` + Object.keys(a).filter(k => canEditLevel(a[k]) !== canEditLevel(b[k])).map(k => `${esc((MODULES.find(m => m[0] === k) || [k, k])[1])} ${canEditLevel(a[k]) ? '→ แก้ไขได้' : '→ ดูอย่างเดียว'}`).join(', ');
                }
                if (r.action === 'department.update' && (r.before || {}).head_user_id !== (r.after || {}).head_user_id) return `${esc(n)}: หัวหน้า ${esc(name((r.before || {}).head_user_id) === 'ระบบ' ? '—' : name(r.before.head_user_id))} → ${esc(r.after.head_user_id ? name(r.after.head_user_id) : '—')}`;
                if (r.action === 'department.status') return `${esc(n)}: ${r.after && r.after.status === 'inactive' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}`;
                return esc(n);
            };
            const rows = (data || []).map(r => `<tr class="border-t border-gray-100 align-top"><td class="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">${new Date(r.created_at).toLocaleString('th-TH')}</td><td class="py-2 pr-3 text-sm text-gray-700 whitespace-nowrap">${esc(name(r.actor_id))}</td><td class="py-2 pr-3 text-sm font-semibold text-gray-800 whitespace-nowrap">${ACT[r.action] || esc(r.action)}</td><td class="py-2 text-sm text-gray-600">${what(r)}</td></tr>`).join('');
            box.innerHTML = wrap(rows ? `<div class="overflow-x-auto"><table class="w-full min-w-[560px]"><tbody>${rows}</tbody></table></div>` : '<p class="text-sm text-gray-400">ยังไม่มีประวัติ</p>');
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) { box.innerHTML = wrap(`<p class="text-sm text-red-600">โหลดไม่สำเร็จ: ${esc(errText(e))}</p>`); }
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
        /* other pages read the department names from the แผนก box: keep it the real list */
        if (live()) { try { R.data = await rpc('cw_rbac_overview', { p_company: team() }); paintDepartments(); } catch (e) { } }
        if (App.applyGlobalPermissions) try { App.applyGlobalPermissions(); } catch (e) { }
        return r;
    };
    window.CwRbac = { render, loadAccess };
})();
