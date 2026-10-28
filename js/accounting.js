/**
 * ConWork — Accounting and budget
 * Income/expense entries (with receipts / tax invoices), double-entry journal, ledger per account,
 * budget vs actual per project, statements (trial balance, profit & loss, balance sheet) and period closing.
 * Everything is stored in Supabase (accounts, journal_entries, journal_lines, fiscal_periods) and changed only
 * through the database functions, which also enforce that only the company owner/admins record or approve money.
 * Before those tables exist the page shows a short "not set up yet" notice instead.
 */
const Accounting = {
    state: {
        tab: 'overview',          // overview | entries | ledger | statements | periods | chart
        status: 'idle',           // idle | loading | ready | setup | offline | error
        error: '',
        accounts: [],
        entries: [],
        periods: [],
        budget: [],
        entryFilter: 'all',       // all | income | expense | journal | pending | void
        periodKind: 'month',
        periodRef: null,
        ledgerAccount: '',
        ledgerRows: null,
        statements: null,         // { key, tb, pl, bs }
        overview: null,           // { key, tb, pl }
        periodsYear: new Date().getFullYear()
    },
    MAX_FILE: 10 * 1024 * 1024,
    VAT_RATE: 0.07,

    /* ---------- helpers ---------- */
    _en() { return typeof i18nIsEnglish === 'function' && i18nIsEnglish(); },
    L(th, en) { return this._en() ? en : th; },
    _esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    _num(v) { const n = Number(v); return isFinite(n) ? n : 0; },
    _r2(v) { return Math.round(this._num(v) * 100) / 100; },
    _money(v, sign) {
        const n = this._num(v);
        const s = Math.abs(n).toLocaleString(this._en() ? 'en-US' : 'th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return (n < 0 ? '-' : (sign && n > 0 ? '+' : '')) + '฿' + s;
    },
    _today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
    _fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
        return isNaN(d) ? '—' : d.toLocaleDateString(this._en() ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    _sb() { return window.conworkSupabase && window.conworkSupabase.isAvailable() ? window.conworkSupabase.client : null; },
    _me() { return (typeof App !== 'undefined' && App.state && App.state.currentUser) || {}; },
    /* the team the app is open in (not just the first one loaded) */
    _workspace() {
        const ws = (typeof App !== 'undefined' && App.state && App.state.workspaces) || [];
        const chosen = this._me().workspaceId;
        return ws.find(w => String(w.workspace_id) === String(chosen)) || ws[0] || null;
    },
    companyId() {
        const ws = this._workspace();
        const id = ws ? (ws.workspace_id || ws.id) : (this._me().workspaceId || '');
        return /^[0-9a-f-]{36}$/i.test(String(id || '')) ? String(id) : null;
    },
    /* the company owner (creator) and admins handle money; the database checks the same rule */
    isAdmin() {
        const me = this._me(), ws = this._workspace();
        return me.role === 'admin' || !!(ws && ws.created_by && String(ws.created_by) === String(me.id));
    },
    /* the chairman (ประธาน = the team's creator / หัวหน้า) confirms every income and expense;
       everyone else's entries, admins included, wait for that confirmation. The database checks the same rule. */
    isChair() {
        const me = this._me(), ws = this._workspace();
        if (me.companyRole === 'super_admin') return true;
        if (window.TeamAdmin && TeamAdmin.tier && TeamAdmin.tier() === 1) return true;
        return !!(ws && ws.created_by && String(ws.created_by) === String(me.id));
    },
    _toast(th, en, type) { if (typeof App !== 'undefined' && App._showToast) App._showToast(this.L(th, en), type || 'success'); },
    _missing(error) { return !!error && /PGRST205|PGRST202|42P01|42883|Could not find the (table|function)|does not exist/i.test(`${error.code || ''} ${error.message || ''}`); },
    /* database messages in the person's language */
    _errText(error) {
        const m = String((error && (error.message || error)) || '');
        const map = [
            [/must be equal/i, 'ยอดเดบิตและเครดิตต้องเท่ากัน', 'Debit and credit must be equal'],
            [/period is closed/i, 'งวดบัญชีนี้ปิดแล้ว แก้ไขรายการในงวดนี้ไม่ได้', 'This period is closed, so its entries cannot change'],
            [/already closed/i, 'งวดนี้ปิดไปแล้ว', 'This period is already closed'],
            [/Budget is switched off/i, 'โปรเจกต์นี้ปิดการใช้งบประมาณอยู่', 'Budget is switched off for this project'],
            [/owner or an admin/i, 'เฉพาะเจ้าของบริษัทหรือแอดมินเท่านั้น', 'Only the company owner or an admin can do this'],
            [/waiting requests/i, 'ยังมีคำขอรออนุมัติในงวดนี้ กรุณาอนุมัติหรือปฏิเสธก่อน', 'Approve or reject the waiting requests in this period first'],
            [/later closed periods/i, 'ต้องเปิดงวดที่ปิดหลังจากนี้ก่อน', 'Reopen the later closed periods first'],
            [/at least two lines/i, 'รายการต้องมีอย่างน้อย 2 บรรทัด', 'An entry needs at least two lines'],
            [/either a debit or a credit/i, 'แต่ละบรรทัดต้องมีเดบิตหรือเครดิตอย่างใดอย่างหนึ่ง', 'Each line needs either a debit or a credit'],
            [/Built-in accounts/i, 'บัญชีมาตรฐานปิดการใช้งานไม่ได้', 'Built-in accounts cannot be switched off'],
            [/duplicate key|already exists/i, 'รหัสบัญชีนี้มีอยู่แล้ว', 'This account code already exists'],
            [/3-6 digits/i, 'รหัสบัญชีต้องเป็นตัวเลข 3–6 หลัก', 'Account code must be 3–6 digits'],
            [/not waiting/i, 'รายการนี้ไม่ได้รออนุมัติแล้ว', 'This entry is no longer waiting for approval']
        ];
        const hit = map.find(([re]) => re.test(m));
        return hit ? this.L(hit[1], hit[2]) : (m || this.L('เกิดข้อผิดพลาด', 'Something went wrong'));
    },
    _accName(a) { return a ? (this._en() ? (a.name_en || a.name_th) : (a.name_th || a.name_en)) : '—'; },
    _acc(id) { return this.state.accounts.find(a => String(a.id) === String(id)); },
    _accByRole(role) { return this.state.accounts.find(a => a.role === role && a.is_active !== false); },
    _accByCode(code) { return this.state.accounts.find(a => a.code === code); },
    _typeLabel(t) {
        return ({ asset: this.L('สินทรัพย์', 'Assets'), liability: this.L('หนี้สิน', 'Liabilities'), equity: this.L('ส่วนของเจ้าของ', 'Equity'),
            income: this.L('รายได้', 'Income'), expense: this.L('ค่าใช้จ่าย', 'Expenses') })[t] || t;
    },
    _kindLabel(k) {
        return ({ income: this.L('รายรับ', 'Income'), expense: this.L('รายจ่าย', 'Expense'), journal: this.L('รายการทั่วไป', 'Journal'), closing: this.L('ปิดบัญชี', 'Closing') })[k] || k;
    },
    _statusBadge(s) {
        const m = {
            posted: ['bg-green-50 text-green-700', this.L('บันทึกแล้ว', 'Posted')],
            pending: ['bg-amber-50 text-amber-700', this.L('รอประธานยืนยัน', 'Waiting for chairman')],
            rejected: ['bg-red-50 text-red-600', this.L('ไม่อนุมัติ', 'Rejected')],
            void: ['bg-gray-100 text-gray-500', this.L('ยกเลิก', 'Cancelled')]
        }[s] || ['bg-gray-100 text-gray-500', s];
        return `<span class="inline-block text-[11px] font-semibold rounded-md px-2 py-0.5 ${m[0]}">${m[1]}</span>`;
    },
    _period() {
        return window.ConworkPeriods ? ConworkPeriods.range(this.state.periodKind, this.state.periodRef ? new Date(this.state.periodRef) : new Date())
            : { kind: 'month', start: this._today().slice(0, 8) + '01', end: this._today(), label: '' };
    },
    _personName(id) {
        const u = (typeof mockUsers !== 'undefined' ? mockUsers : []).find(x => String(x.id) === String(id));
        if (u) return u.name || u.email;
        return String(id) === String(this._me().id) ? (this._me().name || '') : '—';
    },
    /* projects that use money: budget switched on (off = time tracking only) */
    _budgetProjects() {
        const me = String(this._me().id || '');
        return (typeof mockProjects !== 'undefined' ? mockProjects : [])
            .filter(p => p.budgetEnabled && p.status !== 'deleted')
            .filter(p => p.projectType !== 'single' || !p.ownerId || String(p.ownerId) === me);
    },
    _projectName(id) { const p = (typeof mockProjects !== 'undefined' ? mockProjects : []).find(x => String(x.id) === String(id)); return p ? p.name : ''; },

    /* ---------- loading ---------- */
    async load() {
        const sb = this._sb(), co = this.companyId();
        if (!sb || !co) { this.state.status = 'offline'; return; }
        this.state.status = 'loading';
        try {
            let { data: accounts, error } = await sb.from('accounts').select('*').eq('company_id', co).order('code');
            if (error) { this.state.status = this._missing(error) ? 'setup' : 'error'; this.state.error = error.message; return; }
            if (!accounts.length && this.isAdmin()) {
                const seeded = await sb.rpc('seed_chart_of_accounts', { p_company: co });
                if (!seeded.error) ({ data: accounts } = await sb.from('accounts').select('*').eq('company_id', co).order('code'));
            }
            this.state.accounts = accounts || [];
            const [ent, per, bud] = await Promise.all([
                sb.from('journal_entries').select('*, journal_lines(*)').eq('company_id', co).order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(500),
                sb.from('fiscal_periods').select('*').eq('company_id', co).order('start_date'),
                sb.rpc('project_budget_status', { p_company: co })
            ]);
            const list = r => (!r.error && Array.isArray(r.data)) ? r.data : [];
            this.state.entries = list(ent);
            this.state.periods = list(per);
            this.state.budget = list(bud);
            this.state.overview = null;
            this.state.inventory = null;   // read again when its tab is opened
            this.state.statements = null;
            this.state.ledgerRows = null;
            this.state.status = 'ready';
        } catch (e) {
            this.state.status = 'error';
            this.state.error = e.message || String(e);
        }
    },

    async init() {
        this.render();
        await this.load();
        this.render();
    },

    async refresh() { await this.load(); this.render(); },

    /* ---------- page ---------- */
    render() {
        const root = document.getElementById('accounting-root');
        if (!root) return;
        const s = this.state;
        const admin = this.isAdmin();
        const tabs = [
            ['overview', 'ภาพรวม', 'Overview', 'fa-chart-pie', true],
            ['entries', 'รายการ', 'Entries', 'fa-list-ul', true],
            ['requests', 'ขอเบิก', 'Requests', 'fa-hand-holding-dollar', true],
            ['inventory', 'ทะเบียนพัสดุ', 'Inventory', 'fa-boxes-stacked', true],
            ['ledger', 'สมุดบัญชี', 'Ledger', 'fa-book', admin],
            ['statements', 'งบการเงิน', 'Statements', 'fa-scale-balanced', admin],
            ['periods', 'งวดบัญชี', 'Periods', 'fa-calendar-check', admin],
            ['chart', 'ผังบัญชี', 'Chart of accounts', 'fa-sitemap', true]
        ].filter(t => t[4]);
        if (!tabs.some(t => t[0] === s.tab)) s.tab = 'overview';
        const actions = s.status === 'ready' ? `
            <div class="flex flex-wrap gap-2">
                ${admin ? `
                <button type="button" onclick="Accounting.openEntryForm('income')" class="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold flex items-center gap-2"><i class="fa-solid fa-arrow-down"></i>${this.L('บันทึกรายรับ', 'Record income')}</button>
                <button type="button" onclick="Accounting.openEntryForm('expense')" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2"><i class="fa-solid fa-arrow-up"></i>${this.L('บันทึกรายจ่าย', 'Record expense')}</button>
                <button type="button" onclick="Accounting.openJournalForm()" class="px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold flex items-center gap-2"><i class="fa-solid fa-pen-to-square"></i>${this.L('รายการทั่วไป', 'Journal entry')}</button>`
                : `<button type="button" onclick="Accounting.openEntryForm('expense')" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2"><i class="fa-regular fa-paper-plane"></i>${this.L('ขอเบิก / แจ้งค่าใช้จ่าย', 'Request an expense')}</button>`}
            </div>` : '';
        root.innerHTML = `
        <div class="space-y-4" data-no-i18n>
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="flex bg-gray-100 p-1 rounded-2xl gap-1 overflow-x-auto max-w-full">
                    ${tabs.map(([k, th, en, icon]) => `<button type="button" onclick="Accounting.setTab('${k}')"
                        class="px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap flex items-center gap-2 ${s.tab === k ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}">
                        <i class="fa-solid ${icon} text-xs"></i>${this.L(th, en)}</button>`).join('')}
                </div>
                ${actions}
            </div>
            <div id="accounting-body">${this._bodyHtml()}</div>
        </div>`;
        if (s.status === 'ready') this._afterRender();
    },

    _bodyHtml() {
        const s = this.state;
        if (s.status === 'loading' || s.status === 'idle') return `<div class="py-16 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>${this.L('กำลังโหลด…', 'Loading…')}</div>`;
        if (s.status === 'offline') return this._notice('fa-plug-circle-xmark', this.L('ยังไม่ได้เชื่อมต่อฐานข้อมูล', 'Not connected to the database'),
            this.L('เข้าสู่ระบบและเลือกทีมก่อน จึงจะใช้งานระบบบัญชีได้', 'Sign in and choose a team to use accounting.'));
        if (s.status === 'setup') return this._notice('fa-screwdriver-wrench', this.L('ระบบบัญชียังไม่ได้ติดตั้งในฐานข้อมูล', 'Accounting is not set up in the database yet'),
            this.L('ผู้ดูแลระบบต้องรันคำสั่ง SQL ชุดบัญชี (P4) ใน Supabase ก่อน ส่วนอื่นของแอปใช้งานได้ตามปกติ', 'An administrator needs to run the accounting SQL (P4) in Supabase. The rest of the app works as usual.'));
        if (s.status === 'error') return this._notice('fa-triangle-exclamation', this.L('โหลดข้อมูลบัญชีไม่สำเร็จ', 'Could not load accounting'), this._esc(s.error),
            `<button type="button" onclick="Accounting.refresh()" class="mt-3 px-4 py-2 rounded-xl border border-gray-200 text-sm">${this.L('ลองใหม่', 'Try again')}</button>`);
        switch (s.tab) {
            case 'entries': return this._entriesHtml();
            case 'requests': return this._requestsHtml();
            case 'inventory': return this._inventoryHtml();
            case 'ledger': return this._ledgerHtml();
            case 'statements': return this._statementsHtml();
            case 'periods': return this._periodsHtml();
            case 'chart': return this._chartHtml();
            default: return this._overviewHtml();
        }
    },

    _notice(icon, title, text, extra) {
        return `<div class="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
            <i class="fa-solid ${icon} text-3xl text-gray-300"></i>
            <h3 class="mt-3 text-lg font-bold text-gray-800">${title}</h3>
            <p class="mt-1 text-sm text-gray-500 max-w-md mx-auto">${text}</p>${extra || ''}</div>`;
    },
    _card(title, body, right) {
        return `<section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3 mb-3"><h3 class="text-base font-bold text-gray-800">${title}</h3>${right || ''}</div>${body}</section>`;
    },
    _kpi(label, value, sub, color) {
        return `<div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div class="text-xs font-semibold text-gray-500">${label}</div>
            <div class="mt-1 text-xl font-bold tabular-nums ${color || 'text-gray-900'}">${value}</div>
            ${sub ? `<div class="mt-0.5 text-xs text-gray-500">${sub}</div>` : ''}</div>`;
    },
    _periodBar() {
        const s = this.state, p = this._period();
        const kinds = [['month', 'เดือน', 'Month'], ['quarter', 'ไตรมาส', 'Quarter'], ['year', 'ปี', 'Year']];
        return `<div class="flex flex-wrap items-center gap-2">
            <div class="flex bg-gray-100 p-1 rounded-xl gap-1">${kinds.map(([k, th, en]) => `<button type="button" onclick="Accounting.setPeriodKind('${k}')" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${s.periodKind === k ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}">${this.L(th, en)}</button>`).join('')}</div>
            <button type="button" onclick="Accounting.stepPeriod(-1)" class="w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" aria-label="${this.L('ช่วงก่อนหน้า', 'Previous period')}"><i class="fa-solid fa-chevron-left text-xs"></i></button>
            <span class="text-sm font-semibold text-gray-800 min-w-[9rem] text-center">${this._esc(p.label)}</span>
            <button type="button" onclick="Accounting.stepPeriod(1)" class="w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50" aria-label="${this.L('ช่วงถัดไป', 'Next period')}"><i class="fa-solid fa-chevron-right text-xs"></i></button>
        </div>`;
    },
    _table(headers, rows, empty, alignRightFrom) {
        if (!rows.length) return `<p class="text-sm text-gray-400 py-4 text-center">${empty}</p>`;
        const from = alignRightFrom == null ? 1 : alignRightFrom;
        return `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100">${headers.map((h, i) => `<th class="py-2 pr-3 font-semibold whitespace-nowrap ${i >= from ? 'text-right' : ''}">${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr class="border-b border-gray-50 ${r.cls || ''}">${r.cells.map((c, i) => `<td class="py-2 pr-3 align-top ${i >= from ? 'text-right tabular-nums whitespace-nowrap' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },

    /* ---------- overview ---------- */
    _budgetHtml() {
        const rows = this.state.budget.map(b => {
            const pct = b.pct == null ? null : Number(b.pct);
            const color = pct == null ? 'bg-gray-300' : pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500';
            const left = b.budget_amount != null ? this._num(b.budget_amount) - this._num(b.actual) : null;
            return `<div class="py-3 border-b border-gray-50 last:border-0">
                <div class="flex items-center justify-between gap-3 text-sm">
                    <span class="font-semibold text-gray-800 truncate">${this._esc(b.name)}</span>
                    <span class="tabular-nums text-gray-600 whitespace-nowrap">${this._money(b.actual)} / ${b.budget_amount != null ? this._money(b.budget_amount) : '—'}</span>
                </div>
                <div class="mt-2 h-2.5 rounded-full bg-gray-100 overflow-hidden"><div class="h-full ${color}" style="width:${Math.min(100, pct || 0)}%"></div></div>
                <div class="mt-1 flex justify-between text-xs ${pct >= 100 ? 'text-red-600 font-semibold' : pct >= 80 ? 'text-amber-600 font-semibold' : 'text-gray-500'}">
                    <span>${pct == null ? this.L('ยังไม่ได้กำหนดวงเงิน', 'No budget amount set') : pct + '%'}${pct >= 100 ? ' · ' + this.L('เกินงบ', 'Over budget') : pct >= 80 ? ' · ' + this.L('ใกล้เต็มงบ', 'Nearly used up') : ''}</span>
                    <span>${left != null ? this.L('คงเหลือ ', 'Left ') + this._money(left) : ''}</span>
                </div></div>`;
        }).join('');
        return this._card(this.L('งบประมาณเทียบใช้จริงรายโปรเจกต์', 'Budget vs actual by project'),
            rows || `<p class="text-sm text-gray-400 py-4 text-center">${this.L('ยังไม่มีโปรเจกต์ที่เปิดใช้งบประมาณ (เปิดได้ในหน้าสร้าง/แก้ไขโปรเจกต์)', 'No projects with a budget yet (switch it on when creating or editing a project)')}</p>`);
    },

    _overviewHtml() {
        const s = this.state, admin = this.isAdmin();
        const mine = s.entries.filter(e => String(e.created_by) === String(this._me().id));
        const pending = s.entries.filter(e => e.status === 'pending');
        if (!admin) {
            const rows = mine.slice(0, 20).map(e => ({ cells: [this._esc(this._fmtDate(e.entry_date)), this._esc(e.description || '—'), this._statusBadge(e.status), this._money(e.amount)] }));
            return `<div class="space-y-4">${this._budgetHtml()}
                ${this._card(this.L('คำขอของฉัน', 'My requests'), this._table([this.L('วันที่', 'Date'), this.L('รายการ', 'Description'), this.L('สถานะ', 'Status'), this.L('จำนวนเงิน', 'Amount')], rows, this.L('ยังไม่มีคำขอ', 'No requests yet'), 3))}</div>`;
        }
        const o = s.overview, p = this._period();
        let kpis = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">${[1, 2, 3, 4].map(() => this._kpi('&nbsp;', '<span class="text-gray-300">…</span>')).join('')}</div>`;
        if (o && o.key === p.start + p.end) {
            const bal = role => { const a = this._accByRole(role); const r = a && o.tb.find(x => String(x.account_id) === String(a.id)); return r ? this._num(r.closing) : 0; };
            const income = o.pl.filter(r => r.type === 'income').reduce((a, r) => a + this._num(r.amount), 0);
            const expense = o.pl.filter(r => r.type === 'expense').reduce((a, r) => a + this._num(r.amount), 0);
            kpis = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
                ${this._kpi(this.L('เงินสด + เงินฝาก', 'Cash + bank'), this._money(bal('cash') + bal('bank')), this.L('ณ สิ้นช่วง', 'at period end'))}
                ${this._kpi(this.L('รายได้', 'Income'), this._money(income), this._esc(p.label), 'text-green-700')}
                ${this._kpi(this.L('ค่าใช้จ่าย', 'Expenses'), this._money(expense), this._esc(p.label), 'text-red-600')}
                ${this._kpi(this.L('กำไร (ขาดทุน)', 'Profit (loss)'), this._money(income - expense), this.L(`รออนุมัติ ${pending.length} รายการ`, `${pending.length} waiting for approval`), income - expense >= 0 ? 'text-blue-700' : 'text-red-600')}
            </div>`;
        }
        const pendRows = pending.map(e => ({ cells: [
            this._esc(this._fmtDate(e.entry_date)),
            `<div class="font-medium text-gray-800">${this._esc(e.description || '—')}</div><div class="text-xs text-gray-400">${this._esc(this._personName(e.created_by))}${e.project_id ? ' · ' + this._esc(this._projectName(e.project_id)) : ''}</div>`,
            this._money(e.amount),
            `<div class="flex gap-2 justify-end">
                ${e.attachment_path ? `<button type="button" onclick="Accounting.openAttachment('${e.id}')" class="px-2 py-1 rounded-lg border border-gray-200 text-xs" title="${this.L('ดูเอกสาร', 'View document')}"><i class="fa-solid fa-paperclip"></i></button>` : ''}
                ${this.isChair() ? `<button type="button" onclick="Accounting.review('${e.id}', false)" class="px-3 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">${this.L('ไม่ยืนยัน', 'Reject')}</button>
                <button type="button" onclick="Accounting.review('${e.id}', true)" class="px-3 py-1 rounded-lg bg-green-600 text-white text-xs font-semibold">${this.L('ยืนยัน', 'Confirm')}</button>` : `<span class="text-xs text-amber-700">${this.L('รอประธานยืนยัน', 'Waiting for chairman')}</span>`}
            </div>`] }));
        return `<div class="space-y-4">
            <div class="flex justify-end">${this._periodBar()}</div>
            ${kpis}
            <div class="grid lg:grid-cols-2 gap-4">
                ${this._budgetHtml()}
                ${this._card(this.L('รอประธานยืนยัน', 'Waiting for the chairman'), this._table([this.L('วันที่', 'Date'), this.L('รายการ', 'Description'), this.L('จำนวนเงิน', 'Amount'), ''], pendRows, this.L('ไม่มีรายการรออนุมัติ', 'Nothing waiting'), 2))}
            </div></div>`;
    },

    /* ---------- entries ---------- */
    _entriesHtml() {
        const s = this.state;
        const filters = [['all', 'ทั้งหมด', 'All'], ['income', 'รายรับ', 'Income'], ['expense', 'รายจ่าย', 'Expense'], ['journal', 'รายการทั่วไป', 'Journal'], ['pending', 'รออนุมัติ', 'Pending'], ['void', 'ยกเลิก/ไม่อนุมัติ', 'Cancelled']];
        const list = s.entries.filter(e => {
            switch (s.entryFilter) {
                case 'all': return true;
                case 'pending': return e.status === 'pending';
                case 'void': return e.status === 'void' || e.status === 'rejected';
                default: return e.kind === s.entryFilter;
            }
        });
        const admin = this.isAdmin();
        const rows = list.map(e => ({
            cls: e.status === 'void' || e.status === 'rejected' ? 'opacity-60' : '',
            cells: [
                this._esc(this._fmtDate(e.entry_date)),
                `<button type="button" onclick="Accounting.openEntry('${e.id}')" class="text-left hover:text-blue-700"><div class="font-medium text-gray-800">${this._esc(e.description || this._kindLabel(e.kind))}</div>
                 <div class="text-xs text-gray-400">${this._kindLabel(e.kind)}${e.party ? ' · ' + this._esc(e.party) : ''}${e.doc_no ? ' · ' + this._esc(e.doc_no) : ''}${e.project_id ? ' · ' + this._esc(this._projectName(e.project_id)) : ''}</div></button>`,
                this._statusBadge(e.status),
                e.attachment_path ? `<button type="button" onclick="Accounting.openAttachment('${e.id}')" class="text-blue-600" title="${this.L('ดูเอกสาร', 'View document')}"><i class="fa-solid fa-paperclip"></i></button>` : '',
                `<span class="${e.kind === 'income' ? 'text-green-700' : e.kind === 'expense' ? 'text-red-600' : ''}">${this._money(this._entryTotal(e))}</span>`
            ]
        }));
        return this._card(this.L('รายการบัญชี', 'Entries'),
            `<div class="flex flex-wrap gap-1 mb-3">${filters.map(([k, th, en]) => `<button type="button" onclick="Accounting.setFilter('${k}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${s.entryFilter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}">${this.L(th, en)}${k === 'pending' && admin ? ` (${s.entries.filter(x => x.status === 'pending').length})` : ''}</button>`).join('')}</div>` +
            this._table([this.L('วันที่', 'Date'), this.L('รายการ', 'Description'), this.L('สถานะ', 'Status'), '', this.L('จำนวนเงิน', 'Amount')], rows, this.L('ยังไม่มีรายการ', 'No entries yet'), 4),
            `<button type="button" onclick="Accounting.refresh()" class="text-xs text-gray-500 hover:text-gray-800"><i class="fa-solid fa-rotate"></i></button>`);
    },
    _entryTotal(e) {
        if (e.amount != null) return this._num(e.amount);
        return (e.journal_lines || []).reduce((a, l) => a + this._num(l.debit), 0);
    },

    /* one entry with its lines */
    openEntry(id) {
        const e = this.state.entries.find(x => String(x.id) === String(id));
        if (!e) return;
        const admin = this.isAdmin();
        const lines = (e.journal_lines || []).slice().sort((a, b) => a.line_no - b.line_no);
        const dr = lines.reduce((a, l) => a + this._num(l.debit), 0), cr = lines.reduce((a, l) => a + this._num(l.credit), 0);
        const rows = lines.map(l => { const a = this._acc(l.account_id); return { cells: [`<span class="text-gray-400 tabular-nums mr-2">${this._esc(a ? a.code : '')}</span>${this._esc(this._accName(a))}${l.memo ? `<div class="text-xs text-gray-400">${this._esc(l.memo)}</div>` : ''}`, this._num(l.debit) ? this._money(l.debit) : '', this._num(l.credit) ? this._money(l.credit) : ''] }; });
        rows.push({ cls: 'font-bold', cells: [this.L('รวม', 'Total'), this._money(dr), this._money(cr)] });
        const info = [
            [this.L('วันที่', 'Date'), this._fmtDate(e.entry_date)],
            [this.L('ประเภท', 'Type'), this._kindLabel(e.kind)],
            [this.L('คู่ค้า', 'Customer / vendor'), e.party],
            [this.L('เลขที่เอกสาร', 'Document no.'), e.doc_no],
            [this.L('โปรเจกต์', 'Project'), e.project_id ? this._projectName(e.project_id) : ''],
            [this.L('ภาษีมูลค่าเพิ่ม', 'VAT'), this._num(e.vat_amount) ? this._money(e.vat_amount) : ''],
            [this.L('ภาษีหัก ณ ที่จ่าย', 'Withholding tax'), this._num(e.wht_amount) ? this._money(e.wht_amount) : ''],
            [e.kind === 'income' ? this.L('รับเงินจริง', 'Amount received') : this.L('จ่ายเงินจริง', 'Amount paid'), this._num(e.wht_amount) ? this._money(this._num(e.amount) - this._num(e.wht_amount)) : ''],
            [this.L('ผู้บันทึก', 'Recorded by'), this._personName(e.created_by)],
            [this.L('หมายเหตุการตรวจ', 'Review note'), e.review_note]
        ].filter(r => r[1]);
        const body = `
            <div class="flex items-center gap-2 mb-3">${this._statusBadge(e.status)}<span class="text-sm text-gray-500">${this._esc(e.description || '')}</span></div>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">${info.map(([k, v]) => `<dt class="text-gray-500">${k}</dt><dd class="text-gray-800 text-right">${this._esc(v)}</dd>`).join('')}</dl>
            ${this._table([this.L('บัญชี', 'Account'), this.L('เดบิต', 'Debit'), this.L('เครดิต', 'Credit')], rows, '')}
            <div class="flex flex-wrap gap-2 justify-end mt-4">
                ${e.attachment_path ? `<button type="button" onclick="Accounting.openAttachment('${e.id}')" class="px-4 py-2 rounded-xl border border-gray-200 text-sm"><i class="fa-solid fa-paperclip mr-1"></i>${this.L('ดูเอกสารแนบ', 'View attachment')}</button>` : ''}
                ${this.isChair() && e.status === 'pending' ? `<button type="button" onclick="Accounting.review('${e.id}', false)" class="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold">${this.L('ไม่อนุมัติ', 'Reject')}</button>
                    <button type="button" onclick="Accounting.review('${e.id}', true)" class="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold">${this.L('อนุมัติ', 'Approve')}</button>` : ''}
                ${this.isChair() && e.status === 'posted' && e.kind !== 'closing' ? `<button type="button" onclick="Accounting.voidEntry('${e.id}')" class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm">${this.L('ยกเลิกรายการ', 'Cancel entry')}</button>` : ''}
            </div>`;
        this._modal(this.L('รายละเอียดรายการ', 'Entry details'), body);
    },

    /* ---------- ledger ---------- */
    _ledgerHtml() {
        const s = this.state;
        if (!s.ledgerAccount) { const c = this._accByRole('bank') || s.accounts[0]; s.ledgerAccount = c ? String(c.id) : ''; }
        const opts = s.accounts.map(a => `<option value="${a.id}" ${String(a.id) === s.ledgerAccount ? 'selected' : ''}>${this._esc(a.code + ' ' + this._accName(a))}</option>`).join('');
        let body = `<div class="py-10 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i></div>`;
        const p = this._period();
        if (s.ledgerRows && s.ledgerRows.key === s.ledgerAccount + p.start + p.end) {
            const acc = this._acc(s.ledgerAccount);
            const credit = acc && acc.normal_side === 'credit';
            const sign = v => credit ? -v : v; // balance shown on the account's normal side
            let bal = s.ledgerRows.opening;
            const rows = [{ cls: 'bg-gray-50', cells: [this._esc(this._fmtDate(p.start)), this.L('ยอดยกมา', 'Opening balance'), '', '', this._money(sign(bal))] }];
            s.ledgerRows.rows.forEach(r => {
                bal += this._num(r.debit) - this._num(r.credit);
                rows.push({ cells: [this._esc(this._fmtDate(r.date)),
                    `<button type="button" onclick="Accounting.openEntry('${r.entryId}')" class="text-left hover:text-blue-700">${this._esc(r.description || this._kindLabel(r.kind))}${r.memo ? `<div class="text-xs text-gray-400">${this._esc(r.memo)}</div>` : ''}</button>`,
                    this._num(r.debit) ? this._money(r.debit) : '', this._num(r.credit) ? this._money(r.credit) : '', this._money(sign(bal))] });
            });
            rows.push({ cls: 'font-bold', cells: [this._esc(this._fmtDate(p.end)), this.L('ยอดยกไป', 'Closing balance'), '', '', this._money(sign(bal))] });
            body = this._table([this.L('วันที่', 'Date'), this.L('รายการ', 'Description'), this.L('เดบิต', 'Debit'), this.L('เครดิต', 'Credit'), this.L('คงเหลือ', 'Balance')], rows, '', 2);
        }
        return this._card(this.L('สมุดบัญชีแยกประเภท', 'General ledger'),
            `<div class="flex flex-wrap items-center gap-2 mb-4"><select onchange="Accounting.setLedgerAccount(this.value)" class="border border-gray-200 rounded-xl py-2 px-3 text-sm min-w-[240px] flex-1">${opts}</select>${this._periodBar()}</div>${body}`);
    },

    async _loadLedger() {
        const s = this.state, sb = this._sb(), p = this._period(), key = s.ledgerAccount + p.start + p.end;
        if (!sb || !s.ledgerAccount || (s.ledgerRows && s.ledgerRows.key === key)) return;
        const { data, error } = await sb.from('journal_lines')
            .select('debit, credit, memo, entry_id, journal_entries!inner(id, entry_date, description, kind, status)')
            .eq('account_id', s.ledgerAccount).eq('journal_entries.status', 'posted').lte('journal_entries.entry_date', p.end);
        if (error) { this._toast('โหลดสมุดบัญชีไม่สำเร็จ', 'Could not load the ledger', 'error'); return; }
        let opening = 0;
        const rows = [];
        (data || []).forEach(l => {
            const e = l.journal_entries || {};
            if (e.entry_date < p.start) opening += this._num(l.debit) - this._num(l.credit);
            else rows.push({ date: e.entry_date, description: e.description, kind: e.kind, entryId: e.id, memo: l.memo, debit: l.debit, credit: l.credit });
        });
        rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
        s.ledgerRows = { key, opening, rows };
        if (s.tab === 'ledger') this._renderBody();
    },

    /* ---------- statements ---------- */
    async fetchStatements(start, end, projectId) {
        const sb = this._sb(), co = this.companyId();
        if (!sb || !co) return null;
        const [tb, pl, bs] = await Promise.all([
            sb.rpc('trial_balance', { p_company: co, p_from: start, p_to: end }),
            sb.rpc('income_statement', { p_company: co, p_from: start, p_to: end, p_project: projectId || null }),
            sb.rpc('balance_sheet', { p_company: co, p_as_of: end })
        ]);
        if (tb.error || pl.error || bs.error) return { error: (tb.error || pl.error || bs.error) };
        return { tb: tb.data || [], pl: pl.data || [], bs: bs.data || [] };
    },

    _plRows(pl) {
        const inc = pl.filter(r => r.type === 'income'), exp = pl.filter(r => r.type === 'expense');
        const ti = inc.reduce((a, r) => a + this._num(r.amount), 0), te = exp.reduce((a, r) => a + this._num(r.amount), 0);
        return { inc, exp, ti, te, net: ti - te };
    },
    _bsRows(bs) {
        const sec = t => bs.filter(r => r.section === t);
        const sum = t => sec(t).reduce((a, r) => a + this._num(r.amount), 0);
        return { asset: sec('asset'), liability: sec('liability'), equity: sec('equity'), ta: sum('asset'), tl: sum('liability'), te: sum('equity') };
    },
    _statementName(r) { return this._en() ? (r.name_en || r.name_th) : (r.name_th || r.name_en); },

    plHtml(pl) {
        const x = this._plRows(pl);
        const line = r => ({ cells: [`<span class="text-gray-400 tabular-nums mr-2">${this._esc(r.code)}</span>${this._esc(this._statementName(r))}`, this._money(r.amount)] });
        const rows = [
            { cls: 'font-semibold bg-gray-50', cells: [this.L('รายได้', 'Income'), ''] }, ...x.inc.map(line),
            { cls: 'font-semibold', cells: [this.L('รวมรายได้', 'Total income'), this._money(x.ti)] },
            { cls: 'font-semibold bg-gray-50', cells: [this.L('ค่าใช้จ่าย', 'Expenses'), ''] }, ...x.exp.map(line),
            { cls: 'font-semibold', cells: [this.L('รวมค่าใช้จ่าย', 'Total expenses'), this._money(x.te)] },
            { cls: `font-bold ${x.net >= 0 ? 'text-green-700' : 'text-red-600'}`, cells: [this.L('กำไร (ขาดทุน) สุทธิ', 'Net profit (loss)'), this._money(x.net)] }
        ];
        return this._table([this.L('รายการ', 'Item'), this.L('จำนวนเงิน', 'Amount')], rows, '');
    },
    bsHtml(bs) {
        const x = this._bsRows(bs);
        const line = r => ({ cells: [`<span class="text-gray-400 tabular-nums mr-2">${this._esc(r.code)}</span>${this._esc(this._statementName(r))}`, this._money(r.amount)] });
        const ok = Math.abs(x.ta - (x.tl + x.te)) < 0.005;
        const rows = [
            { cls: 'font-semibold bg-gray-50', cells: [this.L('สินทรัพย์', 'Assets'), ''] }, ...x.asset.map(line),
            { cls: 'font-bold', cells: [this.L('รวมสินทรัพย์', 'Total assets'), this._money(x.ta)] },
            { cls: 'font-semibold bg-gray-50', cells: [this.L('หนี้สิน', 'Liabilities'), ''] }, ...x.liability.map(line),
            { cls: 'font-semibold', cells: [this.L('รวมหนี้สิน', 'Total liabilities'), this._money(x.tl)] },
            { cls: 'font-semibold bg-gray-50', cells: [this.L('ส่วนของเจ้าของ', 'Equity'), ''] }, ...x.equity.map(line),
            { cls: 'font-semibold', cells: [this.L('รวมส่วนของเจ้าของ', 'Total equity'), this._money(x.te)] },
            { cls: `font-bold ${ok ? '' : 'text-red-600'}`, cells: [this.L('รวมหนี้สินและส่วนของเจ้าของ', 'Total liabilities and equity'), this._money(x.tl + x.te)] }
        ];
        return this._table([this.L('รายการ', 'Item'), this.L('จำนวนเงิน', 'Amount')], rows, '');
    },

    _statementsHtml() {
        const s = this.state, p = this._period();
        if (!s.statements || s.statements.key !== p.start + p.end) {
            return `<div class="space-y-4"><div class="flex justify-end">${this._periodBar()}</div><div class="py-10 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin"></i></div></div>`;
        }
        if (s.statements.error) return `<div class="space-y-4"><div class="flex justify-end">${this._periodBar()}</div>${this._notice('fa-triangle-exclamation', this.L('โหลดงบการเงินไม่สำเร็จ', 'Could not load statements'), this._esc(this._errText(s.statements.error)))}</div>`;
        const tbRows = s.statements.tb.filter(r => this._num(r.opening) || this._num(r.debit) || this._num(r.credit) || this._num(r.closing)).map(r => {
            const dr = v => v > 0 ? this._money(v) : '', cr = v => v < 0 ? this._money(-v) : '';
            return { cells: [`<span class="text-gray-400 tabular-nums mr-2">${this._esc(r.code)}</span>${this._esc(this._statementName(r))}`,
                dr(this._num(r.opening)), cr(this._num(r.opening)), this._num(r.debit) ? this._money(r.debit) : '', this._num(r.credit) ? this._money(r.credit) : '', dr(this._num(r.closing)), cr(this._num(r.closing))] };
        });
        const t = k => s.statements.tb.reduce((a, r) => a + this._num(r[k]), 0);
        const pos = k => s.statements.tb.reduce((a, r) => a + Math.max(0, this._num(r[k])), 0), neg = k => s.statements.tb.reduce((a, r) => a + Math.max(0, -this._num(r[k])), 0);
        if (tbRows.length) tbRows.push({ cls: 'font-bold', cells: [this.L('รวม', 'Total'), this._money(pos('opening')), this._money(neg('opening')), this._money(t('debit')), this._money(t('credit')), this._money(pos('closing')), this._money(neg('closing'))] });
        return `<div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm text-gray-500">${this._esc(this._fmtDate(p.start))} – ${this._esc(this._fmtDate(p.end))}</p>
                <div class="flex flex-wrap gap-2 items-center">${this._periodBar()}
                    <button type="button" onclick="Accounting.exportStatements()" class="px-3 py-2 rounded-xl border border-green-600 text-green-700 hover:bg-green-50 text-sm font-semibold"><i class="fa-solid fa-file-excel mr-1"></i>Excel</button></div>
            </div>
            <div class="grid lg:grid-cols-2 gap-4">
                ${this._card(this.L('งบกำไรขาดทุน', 'Profit and loss'), this.plHtml(s.statements.pl))}
                ${this._card(this.L('งบดุล ณ วันสิ้นงวด', 'Balance sheet at period end'), this.bsHtml(s.statements.bs))}
            </div>
            ${this._card(this.L('งบทดลอง', 'Trial balance'), this._table([this.L('บัญชี', 'Account'), this.L('ยกมา Dr', 'Opening Dr'), this.L('ยกมา Cr', 'Opening Cr'), this.L('เดบิต', 'Debit'), this.L('เครดิต', 'Credit'), this.L('ยกไป Dr', 'Closing Dr'), this.L('ยกไป Cr', 'Closing Cr')], tbRows, this.L('ยังไม่มีรายการในช่วงนี้', 'No entries in this period')))}
        </div>`;
    },

    async exportStatements() {
        const s = this.state, p = this._period();
        if (!s.statements || s.statements.error || typeof WorkReport === 'undefined') return;
        try {
            const XLSX = await WorkReport._loadXlsx();
            const wb = XLSX.utils.book_new();
            this.addStatementSheets(XLSX, wb, s.statements, p, true);
            const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            WorkReport._download(new File([out], `ConWork_Statements_${p.start}_${p.end}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        } catch (e) { this._toast('สร้างไฟล์ Excel ไม่สำเร็จ', 'Could not create the Excel file', 'error'); }
    },

    /* sheets for P&L, balance sheet (and the trial balance) — also used by the Report page */
    addStatementSheets(XLSX, wb, st, p, withTb) {
        const L = (th, en) => this.L(th, en);
        const x = this._plRows(st.pl);
        const pl = [[L('งบกำไรขาดทุน', 'Profit and loss'), p.label], [L('ตั้งแต่', 'From'), p.start, L('ถึง', 'To'), p.end], [],
            [L('รหัส', 'Code'), L('รายการ', 'Item'), L('จำนวนเงิน', 'Amount')], [L('รายได้', 'Income')],
            ...x.inc.map(r => [r.code, this._statementName(r), this._r2(r.amount)]), ['', L('รวมรายได้', 'Total income'), this._r2(x.ti)],
            [L('ค่าใช้จ่าย', 'Expenses')], ...x.exp.map(r => [r.code, this._statementName(r), this._r2(r.amount)]), ['', L('รวมค่าใช้จ่าย', 'Total expenses'), this._r2(x.te)],
            ['', L('กำไร (ขาดทุน) สุทธิ', 'Net profit (loss)'), this._r2(x.net)]];
        const ws1 = XLSX.utils.aoa_to_sheet(pl); ws1['!cols'] = [{ wch: 10 }, { wch: 36 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws1, L('งบกำไรขาดทุน', 'Profit and loss'));
        const b = this._bsRows(st.bs);
        const bs = [[L('งบดุล', 'Balance sheet'), p.end], [], [L('รหัส', 'Code'), L('รายการ', 'Item'), L('จำนวนเงิน', 'Amount')],
            [L('สินทรัพย์', 'Assets')], ...b.asset.map(r => [r.code, this._statementName(r), this._r2(r.amount)]), ['', L('รวมสินทรัพย์', 'Total assets'), this._r2(b.ta)],
            [L('หนี้สิน', 'Liabilities')], ...b.liability.map(r => [r.code, this._statementName(r), this._r2(r.amount)]), ['', L('รวมหนี้สิน', 'Total liabilities'), this._r2(b.tl)],
            [L('ส่วนของเจ้าของ', 'Equity')], ...b.equity.map(r => [r.code, this._statementName(r), this._r2(r.amount)]), ['', L('รวมส่วนของเจ้าของ', 'Total equity'), this._r2(b.te)],
            ['', L('รวมหนี้สินและส่วนของเจ้าของ', 'Total liabilities and equity'), this._r2(b.tl + b.te)]];
        if (st.bs && st.bs.length) { // no balance sheet for a single project
            const ws2 = XLSX.utils.aoa_to_sheet(bs); ws2['!cols'] = [{ wch: 10 }, { wch: 36 }, { wch: 16 }];
            XLSX.utils.book_append_sheet(wb, ws2, L('งบดุล', 'Balance sheet'));
        }
        if (withTb && st.tb) {
            const tb = [[L('รหัส', 'Code'), L('บัญชี', 'Account'), L('ยกมา (Dr+/Cr-)', 'Opening (Dr+/Cr-)'), L('เดบิต', 'Debit'), L('เครดิต', 'Credit'), L('ยกไป (Dr+/Cr-)', 'Closing (Dr+/Cr-)')],
                ...st.tb.map(r => [r.code, this._statementName(r), this._r2(r.opening), this._r2(r.debit), this._r2(r.credit), this._r2(r.closing)])];
            const ws3 = XLSX.utils.aoa_to_sheet(tb); ws3['!cols'] = [{ wch: 10 }, { wch: 36 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
            XLSX.utils.book_append_sheet(wb, ws3, L('งบทดลอง', 'Trial balance'));
        }
    },

    /* ---------- periods ---------- */
    _periodsHtml() {
        const s = this.state, y = s.periodsYear;
        const list = s.periods.filter(p => String(p.start_date).slice(0, 4) === String(y));
        const rows = list.map(p => ({ cells: [
            `<span class="font-medium">${this._esc(p.name)}</span>`,
            `${this._esc(this._fmtDate(p.start_date))} – ${this._esc(this._fmtDate(p.end_date))}`,
            p.status === 'closed' ? `<span class="text-xs font-semibold text-gray-600 bg-gray-100 rounded px-2 py-0.5"><i class="fa-solid fa-lock mr-1"></i>${this.L('ปิดแล้ว', 'Closed')}</span>` : `<span class="text-xs font-semibold text-green-700 bg-green-50 rounded px-2 py-0.5">${this.L('เปิดอยู่', 'Open')}</span>`,
            p.status === 'closed'
                ? `<button type="button" onclick="Accounting.reopenPeriod('${p.id}')" class="px-3 py-1 rounded-lg border border-gray-200 text-xs">${this.L('เปิดงวดอีกครั้ง', 'Reopen')}</button>`
                : `<button type="button" onclick="Accounting.closePeriod('${p.id}')" class="px-3 py-1 rounded-lg bg-gray-800 text-white text-xs font-semibold">${this.L('ปิดงวด', 'Close period')}</button>`
        ] }));
        return this._card(this.L('งวดบัญชี', 'Accounting periods'),
            `<p class="text-sm text-gray-500 mb-3">${this.L('การปิดงวดจะโอนรายได้และค่าใช้จ่ายของงวดไปที่กำไรสะสม และล็อกไม่ให้แก้ไขรายการในงวดนั้น', 'Closing a period moves its income and expenses into retained earnings and locks its entries.')}</p>
             <div class="flex items-center gap-2 mb-3">
                <button type="button" onclick="Accounting.setPeriodsYear(-1)" class="w-8 h-8 rounded-lg border border-gray-200"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                <span class="font-semibold">${this._en() ? y : y + 543}</span>
                <button type="button" onclick="Accounting.setPeriodsYear(1)" class="w-8 h-8 rounded-lg border border-gray-200"><i class="fa-solid fa-chevron-right text-xs"></i></button>
                ${list.length < 12 ? `<button type="button" onclick="Accounting.createPeriods()" class="ml-auto px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">${this.L('สร้างงวดรายเดือนของปีนี้', 'Create monthly periods for this year')}</button>` : ''}
             </div>` +
            this._table([this.L('งวด', 'Period'), this.L('ช่วงวันที่', 'Dates'), this.L('สถานะ', 'Status'), ''], rows, this.L('ยังไม่มีงวดบัญชีของปีนี้', 'No periods for this year yet'), 3));
    },

    /* ---------- chart of accounts ---------- */
    _chartHtml() {
        const admin = this.isAdmin();
        const groups = ['asset', 'liability', 'equity', 'income', 'expense'].map(t => {
            const accs = this.state.accounts.filter(a => a.type === t);
            if (!accs.length) return '';
            return `<div class="mb-4"><h4 class="text-sm font-bold text-gray-700 mb-1">${this._typeLabel(t)}</h4>` +
                accs.map(a => `<div class="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 text-sm ${a.is_active === false ? 'opacity-50' : ''}">
                    <span><span class="tabular-nums text-gray-400 mr-2">${this._esc(a.code)}</span>${this._esc(this._accName(a))}</span>
                    <span class="flex items-center gap-2 text-xs text-gray-400">${a.normal_side === 'debit' ? this.L('ด้านเดบิต', 'Debit side') : this.L('ด้านเครดิต', 'Credit side')}
                    ${admin ? `<button type="button" onclick="Accounting.openAccountEdit('${a.id}')" class="px-2 py-0.5 rounded border border-gray-200">${this.L('แก้ไข', 'Edit')}</button>` : ''}
                    ${admin && !a.role ? `<button type="button" onclick="Accounting.toggleAccount('${a.id}', ${a.is_active === false})" class="px-2 py-0.5 rounded border border-gray-200">${a.is_active === false ? this.L('เปิดใช้', 'Switch on') : this.L('ปิดใช้', 'Switch off')}</button>` : ''}</span>
                </div>`).join('') + '</div>';
        }).join('');
        const form = admin ? `<form onsubmit="event.preventDefault(); Accounting.addAccount(this)" class="grid sm:grid-cols-5 gap-2 mt-2 p-3 rounded-xl bg-gray-50">
            <input name="code" required maxlength="5" pattern="[0-9]{5}" inputmode="numeric" title="${this.L('ตัวเลข 5 หลัก เช่น 52010', '5 digits, e.g. 52010')}" placeholder="${this.L('รหัส 5 หลัก เช่น 52010', '5-digit code e.g. 52010')}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <input name="name_th" required maxlength="120" placeholder="${this.L('ชื่อบัญชี (ไทย)', 'Name (Thai)')}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-1">
            <input name="name_en" maxlength="120" placeholder="${this.L('ชื่อบัญชี (อังกฤษ)', 'Name (English)')}" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <select name="type" class="border border-gray-200 rounded-lg px-3 py-2 text-sm">${['asset', 'liability', 'equity', 'income', 'expense'].map(t => `<option value="${t}" ${t === 'expense' ? 'selected' : ''}>${this._typeLabel(t)}</option>`).join('')}</select>
            <button class="rounded-lg bg-blue-600 text-white text-sm font-semibold px-3 py-2">${this.L('เพิ่มบัญชี', 'Add account')}</button>
        </form>` : '';
        const note = `<p class="text-xs text-gray-500 mb-3">${this.L('รหัสบัญชีเป็นตัวเลข 5 หลัก (เช่น 11001) ตั้งรหัสและชื่อได้ตามแบบของบริษัท ·รายการที่บันทึกแล้ว รายงาน และ Dashboard ผูกกับบัญชีเอง ไม่ได้ผูกกับเลข เปลี่ยนเลข/ชื่อแล้วข้อมูลยังอยู่ครบ · บัญชีที่ระบบใช้บันทึกอัตโนมัติ (เงินสด ธนาคาร ลูกหนี้ เจ้าหนี้ VAT ภาษีหัก ณ ที่จ่าย กำไรสะสม) แก้เลข/ชื่อได้แต่ปิดไม่ได้', 'Set codes and names your own way · entries, reports and the dashboard follow the account itself, not its number, so nothing is lost when you renumber · accounts the system posts to automatically can be renamed but not switched off')}</p>`;
        return this._card(this.L('ผังบัญชี', 'Chart of accounts'), note + groups + form);
    },

    /* ---------- after render: fetch what the tab needs ---------- */
    _renderBody() {
        const body = document.getElementById('accounting-body');
        if (body) body.innerHTML = this._bodyHtml();
    },
    async _afterRender() {
        const s = this.state, p = this._period();
        if (s.tab === 'overview' && this.isAdmin() && (!s.overview || s.overview.key !== p.start + p.end)) {
            const key = p.start + p.end;
            const st = await this.fetchStatements(p.start, p.end);
            if (st && !st.error) { s.overview = { key, tb: st.tb, pl: st.pl }; if (s.tab === 'overview') this._renderBody(); }
        }
        if (s.tab === 'statements' && (!s.statements || s.statements.key !== p.start + p.end)) {
            const key = p.start + p.end;
            const st = await this.fetchStatements(p.start, p.end);
            s.statements = Object.assign({ key }, st || { error: 'offline' });
            if (s.tab === 'statements') this._renderBody();
        }
        if (s.tab === 'ledger') await this._loadLedger();
        if (s.tab === 'inventory' && s.inventory == null) { await this._loadInventory(); if (s.tab === 'inventory') this._renderBody(); }
    },

    /* ---------- ขอเบิก: every expense request and where it stands ---------- */
    _requestsHtml() {
        const s = this.state, admin = this.isAdmin(), me = String(this._me().id || '');
        /* a request = an entry that went through approval (waiting, rejected, or approved by someone) */
        let reqs = s.entries.filter(e => e.status === 'pending' || e.status === 'rejected' || (e.status === 'posted' && e.approved_by));
        if (!admin) reqs = reqs.filter(e => String(e.created_by) === me);
        const f = s.reqFilter || 'all';
        const st = e => e.status === 'posted' ? 'approved' : e.status;
        const n = k => reqs.filter(e => k === 'all' || st(e) === k).length;
        const filters = [['all', 'ทั้งหมด', 'All'], ['pending', 'รออนุมัติ', 'Waiting'], ['approved', 'อนุมัติแล้ว', 'Approved'], ['rejected', 'ไม่อนุมัติ', 'Rejected']];
        const badge = e => {
            const m = { pending: ['bg-amber-50 text-amber-700', this.L('รออนุมัติ', 'Waiting')], approved: ['bg-green-50 text-green-700', this.L('อนุมัติแล้ว', 'Approved')], rejected: ['bg-red-50 text-red-600', this.L('ไม่อนุมัติ', 'Rejected')] }[st(e)] || ['bg-gray-100 text-gray-500', e.status];
            return `<span class="inline-block text-[11px] font-semibold rounded-md px-2 py-0.5 ${m[0]}">${m[1]}</span>`;
        };
        const rows = reqs.filter(e => f === 'all' || st(e) === f).map(e => ({ cells: [
            this._esc(this._fmtDate(e.entry_date)),
            `<div class="font-medium text-gray-800">${this._esc(e.description || '—')}</div><div class="text-xs text-gray-400">${this._esc(this._personName(e.created_by))}${e.project_id ? ' · ' + this._esc(this._projectName(e.project_id)) : ''}</div>`
                + (e.review_note ? `<div class="text-xs text-gray-500 mt-0.5"><i class="fa-regular fa-comment mr-1"></i>${this._esc(e.review_note)}</div>` : ''),
            `${badge(e)}${e.approved_at ? `<div class="text-[11px] text-gray-400 mt-0.5">${this._esc(this._personName(e.approved_by))} · ${this._esc(this._fmtDate(e.approved_at))}</div>` : ''}`,
            this._money(e.amount),
            `<div class="flex gap-2 justify-end">
                ${e.attachment_path ? `<button type="button" onclick="Accounting.openAttachment('${e.id}')" class="px-2 py-1 rounded-lg border border-gray-200 text-xs" title="${this.L('ดูเอกสาร', 'View document')}"><i class="fa-solid fa-paperclip"></i></button>` : ''}
                ${this.isChair() && e.status === 'pending' ? `<button type="button" onclick="Accounting.review('${e.id}', false)" class="px-3 py-1 rounded-lg border border-red-200 text-red-600 text-xs font-semibold">${this.L('ไม่อนุมัติ', 'Reject')}</button>
                <button type="button" onclick="Accounting.review('${e.id}', true)" class="px-3 py-1 rounded-lg bg-green-600 text-white text-xs font-semibold">${this.L('อนุมัติ', 'Approve')}</button>` : ''}
            </div>`] }));
        const total = k => reqs.filter(e => st(e) === k).reduce((a, e) => a + this._num(e.amount), 0);
        return `<div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                ${this._kpi(this.L('รออนุมัติ', 'Waiting'), this._money(total('pending')), this.L(`${n('pending')} รายการ`, `${n('pending')} requests`), 'text-amber-600')}
                ${this._kpi(this.L('อนุมัติแล้ว', 'Approved'), this._money(total('approved')), this.L(`${n('approved')} รายการ`, `${n('approved')} requests`), 'text-green-700')}
                ${this._kpi(this.L('ไม่อนุมัติ', 'Rejected'), this._money(total('rejected')), this.L(`${n('rejected')} รายการ`, `${n('rejected')} requests`), 'text-red-600')}
            </div>
            ${this._card(admin ? this.L('คำขอเบิกทั้งหมด', 'All expense requests') : this.L('คำขอเบิกของฉัน', 'My expense requests'),
                `<div class="flex flex-wrap gap-1 mb-3">${filters.map(([k, th, en]) => `<button type="button" onclick="Accounting.setReqFilter('${k}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${f === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}">${this.L(th, en)} (${n(k)})</button>`).join('')}</div>`
                + this._table([this.L('วันที่', 'Date'), this.L('รายการ', 'Description'), this.L('สถานะ', 'Status'), this.L('จำนวนเงิน', 'Amount'), ''], rows, this.L('ยังไม่มีคำขอเบิก', 'No requests yet'), 3),
                admin ? '' : `<button type="button" onclick="Accounting.openEntryForm('expense')" class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"><i class="fa-regular fa-paper-plane mr-1"></i>${this.L('ขอเบิกใหม่', 'New request')}</button>`)}
        </div>`;
    },
    setReqFilter(f) { this.state.reqFilter = f; this._renderBody(); },

    /* ---------- ทะเบียนพัสดุ (inventory register): table inventory_items ---------- */
    INV_STATUS: { in_use: ['ใช้งาน', 'In use', 'bg-green-50 text-green-700'], in_stock: ['คงคลัง', 'In stock', 'bg-blue-50 text-blue-700'], lent: ['ยืม', 'Lent out', 'bg-amber-50 text-amber-700'], damaged: ['ชำรุด', 'Damaged', 'bg-red-50 text-red-600'], disposed: ['จำหน่ายแล้ว', 'Disposed', 'bg-gray-100 text-gray-500'] },
    async _loadInventory() {
        const sb = this._sb(), co = this.companyId();
        if (!sb || !co) { this.state.inventory = []; return; }
        const { data, error } = await sb.from('inventory_items').select('*').eq('company_id', co).order('created_at', { ascending: false });
        this.state.inventory = error ? (this._missing(error) ? 'setup' : []) : (data || []);
        if (error && !this._missing(error)) this._toast('โหลดทะเบียนพัสดุไม่สำเร็จ: ' + error.message, 'Could not load the inventory: ' + error.message);
    },
    _inventoryHtml() {
        const s = this.state, admin = this.isAdmin();
        if (s.inventory == null) return `<div class="py-16 text-center text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>${this.L('กำลังโหลด…', 'Loading…')}</div>`;
        if (s.inventory === 'setup') return this._notice('fa-screwdriver-wrench', this.L('ทะเบียนพัสดุยังไม่ได้ติดตั้งในฐานข้อมูล', 'The inventory register is not set up in the database yet'),
            this.L('ผู้ดูแลระบบต้องรันคำสั่ง SQL ชุดทะเบียนพัสดุใน Neon ก่อน', 'An administrator needs to run the inventory SQL in Neon first.'));
        const q = String(s.invQuery || '').trim().toLowerCase();
        const items = s.inventory.filter(i => !q || [i.code, i.name, i.category, i.location, i.holder, i.note].join(' ').toLowerCase().includes(q));
        const stBadge = k => { const m = this.INV_STATUS[k] || [k, k, 'bg-gray-100 text-gray-500']; return `<span class="inline-block text-[11px] font-semibold rounded-md px-2 py-0.5 ${m[2]}">${this.L(m[0], m[1])}</span>`; };
        const rows = items.map(i => ({ cells: [
            `<div class="font-medium text-gray-800">${this._esc(i.name)}</div><div class="text-xs text-gray-400">${this._esc([i.code, i.category].filter(Boolean).join(' · ') || '—')}</div>`,
            `${this._esc(i.location || '—')}${i.holder ? `<div class="text-xs text-gray-400">${this._esc(i.holder)}</div>` : ''}`,
            stBadge(i.status),
            `${this._esc(String(this._num(i.quantity)))} ${this._esc(i.unit || '')}`,
            i.unit_price != null ? this._money(this._num(i.unit_price) * this._num(i.quantity || 1)) : '—',
            admin ? `<div class="flex gap-2 justify-end"><button type="button" onclick="Accounting.openInventoryForm('${i.id}')" class="px-2 py-1 rounded-lg border border-gray-200 text-xs">${this.L('แก้ไข', 'Edit')}</button>
                <button type="button" onclick="Accounting.deleteInventory('${i.id}')" class="px-2 py-1 rounded-lg border border-red-200 text-red-600 text-xs">${this.L('ลบ', 'Delete')}</button></div>` : ''] }));
        const value = s.inventory.filter(i => i.status !== 'disposed').reduce((a, i) => a + this._num(i.unit_price) * this._num(i.quantity || 1), 0);
        return `<div class="space-y-4">
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                ${this._kpi(this.L('รายการพัสดุ', 'Items'), String(s.inventory.length))}
                ${this._kpi(this.L('ชำรุด', 'Damaged'), String(s.inventory.filter(i => i.status === 'damaged').length), '', 'text-red-600')}
                ${this._kpi(this.L('มูลค่ารวม (ที่ยังใช้งาน)', 'Total value (not disposed)'), this._money(value))}
            </div>
            ${this._card(this.L('ทะเบียนพัสดุ', 'Inventory register'),
                `<input type="search" value="${this._esc(s.invQuery || '')}" oninput="Accounting.setInvQuery(this.value)" placeholder="${this.L('ค้นหา รหัส ชื่อ หมวด ที่เก็บ ผู้รับผิดชอบ…', 'Search code, name, category, place, person…')}" class="w-full sm:w-80 border border-gray-200 rounded-xl px-3 py-2 text-sm mb-3">`
                + `<div id="acc-inv-table">${this._table([this.L('พัสดุ', 'Item'), this.L('ที่เก็บ / ผู้รับผิดชอบ', 'Place / person'), this.L('สถานะ', 'Status'), this.L('จำนวน', 'Qty'), this.L('มูลค่า', 'Value'), ''], rows, this.L('ยังไม่มีพัสดุในทะเบียน', 'No items yet'), 3)}</div>`,
                admin ? `<button type="button" onclick="Accounting.openInventoryForm()" class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"><i class="fa-solid fa-plus mr-1"></i>${this.L('เพิ่มพัสดุ', 'Add item')}</button>` : '')}
        </div>`;
    },
    setInvQuery(v) {
        this.state.invQuery = v;
        const body = document.getElementById('accounting-body'); if (!body) return;
        /* redraw only the table, so the search box keeps focus */
        const tmp = document.createElement('div'); tmp.innerHTML = this._inventoryHtml();
        const fresh = tmp.querySelector('#acc-inv-table'), cur = document.getElementById('acc-inv-table');
        if (fresh && cur) cur.innerHTML = fresh.innerHTML;
    },
    openInventoryForm(id) {
        if (!this.isAdmin()) return;
        const it = (Array.isArray(this.state.inventory) ? this.state.inventory : []).find(x => String(x.id) === String(id)) || {};
        const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm';
        const field = (label, html, cls) => `<label class="block ${cls || ''}"><span class="block text-xs font-semibold text-gray-600 mb-1">${label}</span>${html}</label>`;
        const v = k => this._esc(it[k] == null ? '' : it[k]);
        this._modal(id ? this.L('แก้ไขพัสดุ', 'Edit item') : this.L('เพิ่มพัสดุ', 'Add item'), `<form id="acc-inv-form" class="grid sm:grid-cols-2 gap-3" onsubmit="event.preventDefault(); Accounting.saveInventory(${id ? `'${this._esc(id)}'` : ''})">
            ${field(this.L('ชื่อพัสดุ *', 'Name *'), `<input name="name" required maxlength="200" value="${v('name')}" class="${input}">`, 'sm:col-span-2')}
            ${field(this.L('รหัส / เลขครุภัณฑ์', 'Code / asset no.'), `<input name="code" maxlength="60" value="${v('code')}" class="${input}">`)}
            ${field(this.L('หมวด', 'Category'), `<input name="category" maxlength="100" value="${v('category')}" class="${input}" placeholder="${this.L('เช่น อุปกรณ์ไอที', 'e.g. IT equipment')}">`)}
            ${field(this.L('จำนวน', 'Quantity'), `<input name="quantity" type="number" min="0" step="any" value="${it.quantity == null ? 1 : v('quantity')}" class="${input}">`)}
            ${field(this.L('หน่วย', 'Unit'), `<input name="unit" maxlength="30" value="${v('unit')}" class="${input}" placeholder="${this.L('เช่น เครื่อง, ชิ้น', 'e.g. pcs')}">`)}
            ${field(this.L('ราคาต่อหน่วย (บาท)', 'Unit price (THB)'), `<input name="unit_price" type="number" min="0" step="0.01" value="${v('unit_price')}" class="${input}">`)}
            ${field(this.L('วันที่ได้รับ', 'Received on'), `<input name="acquired_on" type="date" value="${v('acquired_on')}" class="${input}">`)}
            ${field(this.L('ที่เก็บ', 'Place'), `<input name="location" maxlength="200" value="${v('location')}" class="${input}">`)}
            ${field(this.L('ผู้รับผิดชอบ / ผู้ยืม', 'Person in charge / borrower'), `<input name="holder" maxlength="200" value="${v('holder')}" class="${input}">`)}
            ${field(this.L('สถานะ', 'Status'), `<select name="status" class="${input}">${Object.keys(this.INV_STATUS).map(k => `<option value="${k}" ${(it.status || 'in_use') === k ? 'selected' : ''}>${this.L(this.INV_STATUS[k][0], this.INV_STATUS[k][1])}</option>`).join('')}</select>`)}
            ${field(this.L('หมายเหตุ', 'Note'), `<textarea name="note" maxlength="1000" rows="2" class="${input}">${v('note')}</textarea>`, 'sm:col-span-2')}
            <p id="acc-inv-error" class="sm:col-span-2 text-sm text-red-600 hidden"></p>
            <div class="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button type="button" onclick="Accounting._closeModal()" class="px-4 py-2 rounded-xl border border-gray-200 text-sm">${this.L('ยกเลิก', 'Cancel')}</button>
                <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">${this.L('บันทึก', 'Save')}</button>
            </div></form>`);
    },
    async saveInventory(id) {
        const f = document.getElementById('acc-inv-form'); if (!f) return;
        const val = n => f.elements[n].value.trim();
        const num = n => val(n) === '' ? null : Number(val(n));
        const row = { name: val('name'), code: val('code') || null, category: val('category') || null, quantity: num('quantity') == null ? 1 : num('quantity'), unit: val('unit') || null,
            unit_price: num('unit_price'), acquired_on: val('acquired_on') || null, location: val('location') || null, holder: val('holder') || null, status: val('status'), note: val('note') || null };
        const sb = this._sb(), co = this.companyId();
        const q = id ? sb.from('inventory_items').update(Object.assign(row, { updated_at: new Date().toISOString() })).eq('id', id)
            : sb.from('inventory_items').insert(Object.assign(row, { company_id: co }));
        const { error } = await q;
        if (error) { const p = document.getElementById('acc-inv-error'); p.textContent = error.message; p.classList.remove('hidden'); return; }
        this._closeModal(); this._toast('บันทึกพัสดุแล้ว', 'Item saved');
        await this._loadInventory(); this._renderBody();
    },
    async deleteInventory(id) {
        if (!confirm(this.L('ลบพัสดุรายการนี้ออกจากทะเบียน?', 'Delete this item from the register?'))) return;
        const { error } = await this._sb().from('inventory_items').delete().eq('id', id);
        if (error) { alert(error.message); return; }
        await this._loadInventory(); this._renderBody();
    },

    /* ---------- controls ---------- */
    setTab(t) { this.state.tab = t; this.render(); },
    setFilter(f) { this.state.entryFilter = f; this.render(); },
    setPeriodKind(k) { this.state.periodKind = k; this.render(); },
    stepPeriod(n) {
        if (!window.ConworkPeriods) return;
        const next = ConworkPeriods.shift(this.state.periodKind, this.state.periodRef ? new Date(this.state.periodRef) : new Date(), n);
        this.state.periodRef = next.start + 'T00:00:00';
        this.render();
    },
    setLedgerAccount(id) { this.state.ledgerAccount = String(id); this.render(); },
    setPeriodsYear(n) { this.state.periodsYear += n; this.render(); },

    /* ---------- modal ---------- */
    _modal(title, body) {
        this._closeModal();
        const wrap = document.createElement('div');
        wrap.id = 'acc-modal';
        wrap.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3';
        wrap.setAttribute('data-no-i18n', '');
        wrap.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col" role="dialog" aria-modal="true">
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 class="text-lg font-bold text-gray-800">${title}</h3>
                <button type="button" onclick="Accounting._closeModal()" class="w-8 h-8 rounded-lg hover:bg-gray-100" aria-label="${this.L('ปิด', 'Close')}"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-5 overflow-y-auto">${body}</div></div>`;
        wrap.addEventListener('click', ev => { if (ev.target === wrap) this._closeModal(); });
        document.body.appendChild(wrap);
        return wrap;
    },
    _closeModal() { const m = document.getElementById('acc-modal'); if (m) m.remove(); },

    _accountOptions(types, selectedId) {
        return this.state.accounts.filter(a => types.includes(a.type) && a.is_active !== false)
            .map(a => `<option value="${a.id}" ${String(a.id) === String(selectedId) ? 'selected' : ''}>${this._esc(a.code + ' ' + this._accName(a))}</option>`).join('');
    },

    /* simple income / expense form: the double entry is built for you */
    openEntryForm(kind) {
        const admin = this.isAdmin();
        const isIncome = kind === 'income';
        const catTypes = isIncome ? ['income'] : ['expense', 'asset'];
        const firstCat = this.state.accounts.find(a => a.type === (isIncome ? 'income' : 'expense') && a.is_active !== false);
        const payRoles = isIncome ? [['bank', 'เงินฝากธนาคาร', 'Bank'], ['cash', 'เงินสด', 'Cash'], ['ar', 'ยังไม่ได้รับเงิน (ลูกหนี้)', 'Not yet received (receivable)']]
            : [['bank', 'เงินฝากธนาคาร', 'Bank'], ['cash', 'เงินสด', 'Cash'], ['ap', 'ยังไม่ได้จ่าย (เจ้าหนี้)', 'Not yet paid (payable)']];
        const projects = this._budgetProjects();
        const title = isIncome ? this.L('บันทึกรายรับ', 'Record income') : admin ? this.L('บันทึกรายจ่าย', 'Record expense') : this.L('ขอเบิก / แจ้งค่าใช้จ่าย', 'Request an expense');
        const field = (label, html, cls) => `<label class="block ${cls || ''}"><span class="block text-xs font-semibold text-gray-600 mb-1">${label}</span>${html}</label>`;
        const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm';
        const body = `<form id="acc-entry-form" class="grid sm:grid-cols-2 gap-3" onsubmit="event.preventDefault(); Accounting.saveEntryForm('${kind}')">
            ${field(this.L('วันที่', 'Date'), `<input type="date" name="date" required value="${this._today()}" class="${input}">`)}
            ${field(this.L('จำนวนเงิน (บาท)', 'Amount (THB)'), `<input type="number" name="amount" required min="0.01" step="0.01" inputmode="decimal" class="${input}" oninput="Accounting._entryPreview()">`)}
            ${field(this.L('รายละเอียด', 'Description'), `<input name="description" required maxlength="500" class="${input}" placeholder="${isIncome ? this.L('เช่น ค่าบริการออกแบบเว็บไซต์', 'e.g. Website design service') : this.L('เช่น ค่าวัสดุสำนักงาน', 'e.g. Office supplies')}">`, 'sm:col-span-2')}
            ${field(isIncome ? this.L('หมวดรายได้', 'Income category') : this.L('หมวดค่าใช้จ่าย', 'Expense category'), `<select name="account" class="${input}">${this._accountOptions(catTypes, firstCat && firstCat.id)}</select>`)}
            ${field(isIncome ? this.L('รับเงินเข้าทาง', 'Received into') : this.L('จ่ายเงินจาก', 'Paid from'), `<select name="pay" class="${input}">${payRoles.filter(([r]) => this._accByRole(r)).map(([r, th, en]) => `<option value="${r}">${this.L(th, en)}</option>`).join('')}</select>`)}
            ${field(this.L('ภาษีมูลค่าเพิ่ม', 'VAT'), `<select name="vat" class="${input}" onchange="Accounting._entryPreview()">
                <option value="none">${this.L('ไม่มี VAT', 'No VAT')}</option>
                <option value="included">${this.L('รวม VAT 7% แล้ว', 'Includes 7% VAT')}</option>
                <option value="excluded">${this.L('ยังไม่รวม VAT 7% (บวกเพิ่ม)', 'Plus 7% VAT')}</option></select>`)}
            ${field(isIncome ? this.L('ภาษีหัก ณ ที่จ่าย (ลูกค้าหักเรา)', 'Withholding tax (deducted by the customer)') : this.L('ภาษีหัก ณ ที่จ่าย (เราหักผู้ขาย)', 'Withholding tax (we deduct)'), `<div class="flex gap-2">
                <select name="wht" class="${input}" onchange="Accounting._whtModeChanged()">
                <option value="0">${this.L('ไม่มี', 'None')}</option>
                ${[1, 2, 3, 5].map(r => `<option value="${r}">${r}%</option>`).join('')}
                <option value="custom">${this.L('ระบุจำนวนเงินเอง', 'Enter an amount')}</option></select>
                <input type="number" name="wht_amount" min="0" step="0.01" inputmode="decimal" placeholder="${this.L('บาท', 'THB')}" class="${input} hidden" oninput="Accounting._entryPreview()"></div>`)}
            ${field(isIncome ? this.L('ลูกค้า', 'Customer') : this.L('ผู้ขาย / ร้านค้า', 'Vendor'), `<input name="party" maxlength="200" class="${input}">`)}
            ${field(this.L('เลขที่ใบกำกับภาษี / ใบเสร็จ', 'Tax invoice / receipt no.'), `<input name="doc_no" maxlength="100" class="${input}">`)}
            ${field(this.L('โปรเจกต์ (เฉพาะที่เปิดใช้งบ)', 'Project (budget on only)'), `<select name="project" class="${input}"><option value="">${this.L('— ไม่ระบุ —', '— None —')}</option>${projects.map(p => `<option value="${this._esc(p.id)}">${this._esc(p.name)}</option>`).join('')}</select>`)}
            ${field(this.L('ใบเสร็จ / ใบกำกับภาษี (รูปหรือ PDF ไม่เกิน 10 MB)', 'Receipt / tax invoice (image or PDF, max 10 MB)'), `<input type="file" name="file" accept="image/*,.pdf" class="block w-full text-sm">`, 'sm:col-span-2')}
            <div id="acc-entry-preview" class="sm:col-span-2 text-sm text-gray-600 bg-gray-50 rounded-xl p-3 hidden"></div>
            <p id="acc-entry-error" class="sm:col-span-2 text-sm text-red-600 hidden"></p>
            <div class="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button type="button" onclick="Accounting._closeModal()" class="px-4 py-2 rounded-xl border border-gray-200 text-sm">${this.L('ยกเลิก', 'Cancel')}</button>
                <button type="submit" id="acc-entry-save" class="px-5 py-2 rounded-xl ${isIncome ? 'bg-green-600' : 'bg-blue-600'} text-white text-sm font-semibold">${this.isChair() ? this.L('บันทึก', 'Save') : admin ? this.L('ส่งให้ประธานยืนยัน', 'Send to the chairman') : this.L('ส่งคำขอ', 'Send request')}</button>
            </div></form>`;
        this._modal(title, body);
    },

    /* amount split into net + VAT */
    _vatSplit(amount, mode) {
        const a = this._r2(amount);
        if (mode === 'included') { const net = this._r2(a / (1 + this.VAT_RATE)); return { net, vat: this._r2(a - net), total: a }; }
        if (mode === 'excluded') { const vat = this._r2(a * this.VAT_RATE); return { net: a, vat, total: this._r2(a + vat) }; }
        return { net: a, vat: 0, total: a };
    },
    /* withholding tax: a rate of the amount before VAT, or an amount typed in */
    _whtAmount(f, x) {
        if (!f.wht || f.wht.value === '0') return 0;
        if (f.wht.value === 'custom') return Math.max(0, this._r2(parseFloat(f.wht_amount.value) || 0));
        return this._r2(x.net * Number(f.wht.value) / 100);
    },
    _whtModeChanged() {
        const f = document.getElementById('acc-entry-form'); if (!f) return;
        f.wht_amount.classList.toggle('hidden', f.wht.value !== 'custom');
        this._entryPreview();
    },
    _entryPreview() {
        const f = document.getElementById('acc-entry-form'), box = document.getElementById('acc-entry-preview');
        if (!f || !box) return;
        const amt = parseFloat(f.amount.value);
        const x = amt > 0 ? this._vatSplit(amt, f.vat.value) : null;
        const wht = x ? this._whtAmount(f, x) : 0;
        if (!x || (f.vat.value === 'none' && !wht)) { box.classList.add('hidden'); return; }
        const income = f.closest('form').getAttribute('onsubmit').includes("'income'");
        const parts = [this.L(`ก่อน VAT ${this._money(x.net)}`, `Before VAT ${this._money(x.net)}`)];
        if (x.vat) parts.push(`VAT 7% ${this._money(x.vat)}`);
        parts.push(this.L(`รวม ${this._money(x.total)}`, `Total ${this._money(x.total)}`));
        if (wht) parts.push(this.L(`หัก ณ ที่จ่าย ${this._money(wht)}`, `Withholding ${this._money(wht)}`),
            income ? this.L(`รับจริง ${this._money(x.total - wht)}`, `Received ${this._money(x.total - wht)}`) : this.L(`จ่ายจริง ${this._money(x.total - wht)}`, `Paid ${this._money(x.total - wht)}`));
        box.classList.remove('hidden');
        box.textContent = parts.join(' · ');
    },

    _buildSimpleLines(kind, f) {
        const x = this._vatSplit(parseFloat(f.amount.value), f.vat.value);
        const pay = this._accByRole(f.pay.value);
        const vatAcc = this._accByRole(kind === 'income' ? 'vat_output' : 'vat_input');
        /* withholding: the customer keeps it (we can claim it back) / we keep it (we pay it to the Revenue Department) */
        const wht = this._whtAmount(f, x);
        const whtAcc = this._accByRole(kind === 'income' ? 'wht_receivable' : 'wht_payable');
        if (!pay || (x.vat && !vatAcc) || (wht && !whtAcc)) throw new Error(this.L('ไม่พบบัญชีที่ต้องใช้ในผังบัญชี', 'A required account is missing from the chart'));
        if (wht >= x.total) throw new Error(this.L('ภาษีหัก ณ ที่จ่ายต้องน้อยกว่ายอดรวม', 'Withholding tax must be less than the total'));
        const lines = [];
        if (kind === 'income') {
            lines.push({ account_id: pay.id, debit: this._r2(x.total - wht), credit: 0 });
            if (wht) lines.push({ account_id: whtAcc.id, debit: wht, credit: 0, memo: this.L('ภาษีหัก ณ ที่จ่าย', 'Withholding tax') });
            lines.push({ account_id: f.account.value, debit: 0, credit: x.net });
            if (x.vat) lines.push({ account_id: vatAcc.id, debit: 0, credit: x.vat, memo: 'VAT 7%' });
        } else {
            lines.push({ account_id: f.account.value, debit: x.net, credit: 0 });
            if (x.vat) lines.push({ account_id: vatAcc.id, debit: x.vat, credit: 0, memo: 'VAT 7%' });
            lines.push({ account_id: pay.id, debit: 0, credit: this._r2(x.total - wht) });
            if (wht) lines.push({ account_id: whtAcc.id, debit: 0, credit: wht, memo: this.L('ภาษีหัก ณ ที่จ่าย', 'Withholding tax') });
        }
        x.wht = wht;
        return { lines, x };
    },

    async _uploadAttachment(file) {
        if (!file) return null;
        if (file.size > this.MAX_FILE) throw new Error(this.L('ไฟล์ใหญ่เกิน 10 MB', 'The file is larger than 10 MB'));
        if (!/^image\/|application\/pdf/.test(file.type || '')) throw new Error(this.L('รองรับเฉพาะรูปภาพหรือ PDF', 'Only images or PDF files'));
        const sb = this._sb(), co = this.companyId();
        const safe = String(file.name || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
        const path = `${co}/finance/${new Date().getFullYear()}/${Date.now()}-${safe}`;
        const { error } = await sb.storage.from('conwork-files').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (error) throw new Error(this.L('อัปโหลดเอกสารไม่สำเร็จ: ', 'Could not upload the document: ') + error.message);
        return { path, name: file.name };
    },

    async saveEntryForm(kind) {
        const f = document.getElementById('acc-entry-form');
        const errEl = document.getElementById('acc-entry-error'), btn = document.getElementById('acc-entry-save');
        if (!f) return;
        const showErr = m => { errEl.textContent = m; errEl.classList.remove('hidden'); };
        errEl.classList.add('hidden');
        const amt = parseFloat(f.amount.value);
        if (!(amt > 0)) return showErr(this.L('กรุณากรอกจำนวนเงิน', 'Please enter an amount'));
        btn.disabled = true;
        try {
            const { lines, x } = this._buildSimpleLines(kind, f);
            const file = f.file.files && f.file.files[0];
            const att = await this._uploadAttachment(file);
            const entry = {
                kind, entry_date: f.date.value, description: f.description.value.trim(), party: f.party.value.trim(), doc_no: f.doc_no.value.trim(),
                project_id: f.project.value || null, amount: x.total, vat_amount: x.vat, wht_amount: x.wht || 0,
                attachment_path: att ? att.path : null, attachment_name: att ? att.name : null
            };
            await this._post(entry, lines);
            this._closeModal();
            this._toast(this.isChair() ? 'บันทึกรายการแล้ว' : 'ส่งแล้ว · รอประธานยืนยัน', this.isChair() ? 'Entry saved' : 'Sent · waiting for the chairman to confirm');
            await this.refresh();
            if (typeof App !== 'undefined' && App.fetchNotificationsFromSupabase) App.fetchNotificationsFromSupabase();
        } catch (e) {
            showErr(this._errText(e));
        } finally { btn.disabled = false; }
    },

    /* owner/admin posts; everyone else sends a request */
    async _post(entry, lines) {
        const sb = this._sb(), co = this.companyId();
        const fn = this.isChair() ? 'post_journal_entry' : 'submit_journal_request';
        const { data, error } = await sb.rpc(fn, { p_company: co, p_entry: entry, p_lines: lines });
        if (error) throw error;
        return data;
    },

    /* manual journal entry (owner/admin) */
    openJournalForm() {
        const input = 'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm';
        const body = `<form id="acc-journal-form" onsubmit="event.preventDefault(); Accounting.saveJournalForm()" class="space-y-3">
            <div class="grid sm:grid-cols-3 gap-3">
                <label class="block"><span class="block text-xs font-semibold text-gray-600 mb-1">${this.L('วันที่', 'Date')}</span><input type="date" name="date" required value="${this._today()}" class="${input}"></label>
                <label class="block sm:col-span-2"><span class="block text-xs font-semibold text-gray-600 mb-1">${this.L('คำอธิบาย', 'Description')}</span><input name="description" required maxlength="500" class="${input}"></label>
            </div>
            <div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-xs text-gray-500 text-left"><th class="py-1">${this.L('บัญชี', 'Account')}</th><th class="py-1 w-32">${this.L('เดบิต', 'Debit')}</th><th class="py-1 w-32">${this.L('เครดิต', 'Credit')}</th><th class="w-8"></th></tr></thead>
            <tbody id="acc-journal-lines"></tbody>
            <tfoot><tr class="font-semibold"><td class="py-2"><button type="button" onclick="Accounting._addJournalLine()" class="text-blue-600 text-sm"><i class="fa-solid fa-plus mr-1"></i>${this.L('เพิ่มบรรทัด', 'Add line')}</button></td>
                <td id="acc-j-dr" class="tabular-nums"></td><td id="acc-j-cr" class="tabular-nums"></td><td></td></tr></tfoot></table></div>
            <p id="acc-journal-error" class="text-sm text-red-600 hidden"></p>
            <div class="flex justify-end gap-2"><button type="button" onclick="Accounting._closeModal()" class="px-4 py-2 rounded-xl border border-gray-200 text-sm">${this.L('ยกเลิก', 'Cancel')}</button>
                <button type="submit" id="acc-journal-save" class="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">${this.L('บันทึก', 'Save')}</button></div>
        </form>`;
        this._modal(this.L('รายการทั่วไป (สมุดรายวัน)', 'Journal entry'), body);
        this._addJournalLine(); this._addJournalLine();
    },
    _addJournalLine() {
        const tb = document.getElementById('acc-journal-lines');
        if (!tb) return;
        const input = 'w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm';
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="py-1 pr-2"><select class="${input} acc-j-acc">${this._accountOptions(['asset', 'liability', 'equity', 'income', 'expense'])}</select></td>
            <td class="py-1 pr-2"><input type="number" min="0" step="0.01" class="${input} acc-j-dr" oninput="Accounting._journalTotals(this)"></td>
            <td class="py-1 pr-2"><input type="number" min="0" step="0.01" class="${input} acc-j-cr" oninput="Accounting._journalTotals(this)"></td>
            <td><button type="button" onclick="this.closest('tr').remove(); Accounting._journalTotals()" class="text-gray-400 hover:text-red-600" aria-label="${this.L('ลบบรรทัด', 'Remove line')}"><i class="fa-solid fa-xmark"></i></button></td>`;
        tb.appendChild(tr);
    },
    _journalTotals(changed) {
        if (changed) { // a line is either debit or credit
            const tr = changed.closest('tr');
            const other = tr.querySelector(changed.classList.contains('acc-j-dr') ? '.acc-j-cr' : '.acc-j-dr');
            if (parseFloat(changed.value) > 0) other.value = '';
        }
        const sum = cls => [...document.querySelectorAll('#acc-journal-lines .' + cls)].reduce((a, i) => a + (parseFloat(i.value) || 0), 0);
        const dr = this._r2(sum('acc-j-dr')), cr = this._r2(sum('acc-j-cr'));
        const d = document.getElementById('acc-j-dr'), c = document.getElementById('acc-j-cr');
        if (d) d.textContent = this._money(dr);
        if (c) { c.textContent = this._money(cr); c.className = 'tabular-nums ' + (dr === cr ? 'text-green-700' : 'text-red-600'); }
        return { dr, cr };
    },
    async saveJournalForm() {
        const f = document.getElementById('acc-journal-form'), errEl = document.getElementById('acc-journal-error'), btn = document.getElementById('acc-journal-save');
        const showErr = m => { errEl.textContent = m; errEl.classList.remove('hidden'); };
        errEl.classList.add('hidden');
        const lines = [...document.querySelectorAll('#acc-journal-lines tr')].map(tr => ({
            account_id: tr.querySelector('.acc-j-acc').value,
            debit: this._r2(parseFloat(tr.querySelector('.acc-j-dr').value) || 0),
            credit: this._r2(parseFloat(tr.querySelector('.acc-j-cr').value) || 0)
        })).filter(l => l.debit || l.credit);
        const { dr, cr } = this._journalTotals();
        if (lines.length < 2) return showErr(this.L('รายการต้องมีอย่างน้อย 2 บรรทัด', 'An entry needs at least two lines'));
        if (dr !== cr) return showErr(this.L(`ยอดเดบิต (${this._money(dr)}) และเครดิต (${this._money(cr)}) ต้องเท่ากัน`, `Debit (${this._money(dr)}) and credit (${this._money(cr)}) must be equal`));
        btn.disabled = true;
        try {
            await this._post({ kind: 'journal', entry_date: f.date.value, description: f.description.value.trim(), amount: dr }, lines);
            this._closeModal();
            this._toast('บันทึกรายการแล้ว', 'Entry saved');
            await this.refresh();
        } catch (e) { showErr(this._errText(e)); } finally { btn.disabled = false; }
    },

    /* ---------- actions ---------- */
    async review(id, approve) {
        let note = null;
        if (!approve) {
            note = window.prompt(this.L('เหตุผลที่ไม่อนุมัติ (ไม่บังคับ)', 'Reason for rejecting (optional)'), '');
            if (note === null) return;
        }
        const { error } = await this._sb().rpc('review_journal_entry', { p_entry: id, p_approve: !!approve, p_note: note || null });
        if (error) return this._toast(this._errText(error), this._errText(error), 'error');
        this._closeModal();
        this._toast(approve ? 'อนุมัติแล้ว' : 'ไม่อนุมัติแล้ว', approve ? 'Approved' : 'Rejected');
        await this.refresh();
        if (typeof App !== 'undefined' && App.fetchNotificationsFromSupabase) App.fetchNotificationsFromSupabase();
    },
    async voidEntry(id) {
        const reason = window.prompt(this.L('เหตุผลที่ยกเลิกรายการนี้', 'Why is this entry being cancelled?'), '');
        if (reason === null) return;
        const { error } = await this._sb().rpc('void_journal_entry', { p_entry: id, p_reason: reason || null });
        if (error) return this._toast(this._errText(error), this._errText(error), 'error');
        this._closeModal();
        this._toast('ยกเลิกรายการแล้ว', 'Entry cancelled');
        await this.refresh();
    },
    async openAttachment(id) {
        const e = this.state.entries.find(x => String(x.id) === String(id));
        if (!e || !e.attachment_path) return;
        const win = window.open('', '_blank');
        const { data, error } = await this._sb().storage.from('conwork-files').createSignedUrl(e.attachment_path, 3600);
        if (error || !data) { if (win) win.close(); return this._toast('เปิดเอกสารไม่สำเร็จ', 'Could not open the document', 'error'); }
        if (win) win.location.href = data.signedUrl; else window.location.assign(data.signedUrl);
    },
    async createPeriods() {
        const { error } = await this._sb().rpc('create_fiscal_periods', { p_company: this.companyId(), p_year: this.state.periodsYear });
        if (error) return this._toast(this._errText(error), this._errText(error), 'error');
        await this.refresh();
    },
    async closePeriod(id) {
        const p = this.state.periods.find(x => String(x.id) === String(id));
        if (!p || !window.confirm(this.L(`ปิดงวด ${p.name}? รายการในงวดนี้จะถูกล็อก และรายได้/ค่าใช้จ่ายจะโอนไปกำไรสะสม`, `Close ${p.name}? Its entries will be locked and its income/expenses moved to retained earnings.`))) return;
        const { error } = await this._sb().rpc('close_period', { p_period: id });
        if (error) return this._toast(this._errText(error), this._errText(error), 'error');
        this._toast('ปิดงวดแล้ว', 'Period closed');
        await this.refresh();
    },
    async reopenPeriod(id) {
        const p = this.state.periods.find(x => String(x.id) === String(id));
        if (!p || !window.confirm(this.L(`เปิดงวด ${p.name} อีกครั้ง? รายการปิดบัญชีของงวดนี้จะถูกลบ`, `Reopen ${p.name}? Its closing entry will be removed.`))) return;
        const { error } = await this._sb().rpc('reopen_period', { p_period: id });
        if (error) return this._toast(this._errText(error), this._errText(error), 'error');
        await this.refresh();
    },
    async addAccount(form) {
        const { error } = await this._sb().rpc('add_account', { p_company: this.companyId(), p_code: form.code.value.trim(), p_name_th: form.name_th.value.trim(), p_name_en: form.name_en.value.trim(), p_type: form.type.value });
        if (error) return this._toast(this._errText(error), this._errText(error), 'error');
        this._toast('เพิ่มบัญชีแล้ว', 'Account added');
        await this.refresh();
    },
    /* rename / renumber an account; the type can change only while nothing is recorded on it */
    openAccountEdit(id) {
        const a = this._acc(id); if (!a) return;
        const input = 'w-full border border-gray-200 rounded-xl px-3 py-2 text-sm';
        const used = this.state.entries && this.state.entries.some(e => (e.journal_lines || []).some(l => String(l.account_id) === String(a.id)));
        const lockType = !!a.role || used;
        const body = `<form id="acc-account-form" class="grid sm:grid-cols-2 gap-3" onsubmit="event.preventDefault(); Accounting.saveAccountEdit('${a.id}')">
            <label class="block"><span class="block text-xs font-semibold text-gray-600 mb-1">${this.L('รหัสบัญชี', 'Account code')}</span><input name="code" required maxlength="5" pattern="[0-9]{5}" inputmode="numeric" title="${this.L('ตัวเลข 5 หลัก เช่น 11001', '5 digits, e.g. 11001')}" value="${this._esc(a.code)}" class="${input}"></label>
            <label class="block"><span class="block text-xs font-semibold text-gray-600 mb-1">${this.L('หมวด', 'Type')}</span><select name="type" class="${input}" ${lockType ? 'disabled' : ''}>${['asset', 'liability', 'equity', 'income', 'expense'].map(t => `<option value="${t}" ${t === a.type ? 'selected' : ''}>${this._typeLabel(t)}</option>`).join('')}</select>
                ${lockType ? `<span class="block text-[11px] text-gray-400 mt-1">${a.role ? this.L('บัญชีที่ระบบใช้ เปลี่ยนหมวดไม่ได้', 'Used by the system: type is fixed') : this.L('มีรายการบันทึกแล้ว เปลี่ยนหมวดไม่ได้', 'Has entries: type is fixed')}</span>` : ''}</label>
            <label class="block sm:col-span-2"><span class="block text-xs font-semibold text-gray-600 mb-1">${this.L('ชื่อบัญชี (ไทย)', 'Name (Thai)')}</span><input name="name_th" required maxlength="120" value="${this._esc(a.name_th || '')}" class="${input}"></label>
            <label class="block sm:col-span-2"><span class="block text-xs font-semibold text-gray-600 mb-1">${this.L('ชื่อบัญชี (อังกฤษ)', 'Name (English)')}</span><input name="name_en" maxlength="120" value="${this._esc(a.name_en || '')}" class="${input}"></label>
            <p id="acc-account-error" class="sm:col-span-2 text-sm text-red-600 hidden"></p>
            <div class="sm:col-span-2 flex justify-end gap-2 pt-1">
                <button type="button" onclick="Accounting._closeModal()" class="px-4 py-2 rounded-xl border border-gray-200 text-sm">${this.L('ยกเลิก', 'Cancel')}</button>
                <button type="submit" class="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">${this.L('บันทึก', 'Save')}</button>
            </div></form>`;
        this._modal(this.L('แก้ไขบัญชี', 'Edit account'), body);
    },
    async saveAccountEdit(id) {
        const f = document.getElementById('acc-account-form'), err = document.getElementById('acc-account-error'); if (!f) return;
        err.classList.add('hidden');
        const { error } = await this._sb().rpc('update_account', { p_account: id, p_code: f.code.value.trim(), p_name_th: f.name_th.value.trim(), p_name_en: f.name_en.value.trim(), p_type: f.type.disabled ? null : f.type.value });
        if (error) { err.textContent = this._errText(error); err.classList.remove('hidden'); return; }
        this._closeModal();
        this._toast('บันทึกบัญชีแล้ว', 'Account saved');
        await this.refresh();
    },
    async toggleAccount(id, active) {
        const { error } = await this._sb().rpc('set_account_active', { p_account: id, p_active: !!active });
        if (error) return this._toast(this._errText(error), this._errText(error), 'error');
        await this.refresh();
    },

    /* ---------- for the Report page ---------- */
    /* budget vs actual for the given projects, and (owner/admin) P&L + balance sheet for the period */
    async reportData(projectIds, period, projectId) {
        const sb = this._sb(), co = this.companyId();
        if (!sb || !co) return { status: 'offline' };
        const bud = await sb.rpc('project_budget_status', { p_company: co });
        if (bud.error) return { status: this._missing(bud.error) ? 'setup' : 'error' };
        const ids = new Set((projectIds || []).map(String));
        const out = { status: 'ready', admin: this.isAdmin(), budget: (bud.data || []).filter(b => ids.has(String(b.project_id))) };
        if (out.admin) {
            const st = await this.fetchStatements(period.start, period.end, projectId);
            if (st && !st.error) { out.pl = st.pl; out.bs = st.bs; }
        }
        return out;
    }
};
window.Accounting = Accounting;
