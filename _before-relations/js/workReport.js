/**
 * ConWork — Reports
 * Pick what to report on (a project, a person or a division) and a period (week / month / quarter / year),
 * see the report on screen, then export it as Excel (.xlsx), print it as PDF, or share the file.
 * Data comes from the app's loaded projects, tasks and time entries (time_logs, or task details before that table exists).
 */
const WorkReport = {
    state: {
        scope: 'personal',        // 'project' | 'personal' | 'division'
        targetId: '',             // project id / person id / division name
        periodKind: 'month',      // 'week' | 'month' | 'quarter' | 'year'
        periodRef: null,          // any date inside the chosen period (ISO)
        busy: false
    },

    XLSX_URL: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    XLSX_SRI: 'sha512-r22gChDnGvBylk90+2e/ycr3RVrDi8DIOkIGNhJlKfuyQM4tIRAI062MaV8sfjQKYVGjOBaZBOA87z+IhZE9DA==',

    /* ---------- small helpers ---------- */
    _en() { return typeof i18nIsEnglish === 'function' && i18nIsEnglish(); },
    L(th, en) { return this._en() ? en : th; },
    _esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    _today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
    _hours(min) { return Math.round((Number(min) || 0) / 6) / 10; },               // minutes -> hours with 1 decimal
    _fmtMin(min) { return App && App._fmtMinutes ? App._fmtMinutes(min) : `${this._hours(min)} h`; },
    _money(n) { return n == null || n === '' ? '—' : '฿' + Number(n).toLocaleString(this._en() ? 'en-US' : 'th-TH', { maximumFractionDigits: 2 }); },
    _fmtDate(iso) {
        if (!iso) return '—';
        const d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00' : iso);
        return isNaN(d) ? '—' : d.toLocaleDateString(this._en() ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    _me() { return (typeof App !== 'undefined' && App.state && App.state.currentUser) || {}; },
    _people() {
        const list = [...(typeof mockUsers !== 'undefined' ? mockUsers : [])];
        const me = this._me();
        if (me.id && !list.some(u => String(u.id) === String(me.id))) list.unshift({ id: me.id, name: me.name || me.email || 'Me', department: me.department || '' });
        return list;
    },
    _personName(id) { const u = this._people().find(x => String(x.id) === String(id)); return u ? (u.name || u.email || '—') : '—'; },
    /* projects I may see (a personal "single" project only for its creator) */
    _projects() {
        const me = String(this._me().id || '');
        return (typeof mockProjects !== 'undefined' ? mockProjects : [])
            .filter(p => p.status !== 'deleted')
            .filter(p => p.projectType !== 'single' || !p.ownerId || String(p.ownerId) === me);
    },
    _divisions() {
        const fromSettings = [...document.querySelectorAll('#dept-list-container .dept-item span')].map(x => x.textContent.trim());
        const fromPeople = this._people().map(u => u.department);
        const fromProjects = this._projects().flatMap(p => p.teams || []);
        const all = typeof App !== 'undefined' ? App.ALL_DEPTS : 'ทุกฝ่าย';
        return [...new Set([...fromSettings, ...fromPeople, ...fromProjects])].filter(d => d && d !== all).sort((a, b) => a.localeCompare(b, 'th'));
    },
    _period() {
        return window.ConworkPeriods ? ConworkPeriods.range(this.state.periodKind, this.state.periodRef ? new Date(this.state.periodRef) : new Date())
            : { kind: 'month', start: this._today().slice(0, 8) + '01', end: this._today(), label: '' };
    },

    /* ---------- the numbers ---------- */
    _collect() {
        const s = this.state, period = this._period(), today = this._today();
        const projects = this._projects();
        const visibleIds = new Set(projects.map(p => String(p.id)));
        let tasks = (typeof mockTasks !== 'undefined' ? mockTasks : []).filter(t => !t.isDraft && visibleIds.has(String(t.projectId)));
        let scopeProjects = projects, title = '', subtitle = '', people = null;
        const all = typeof App !== 'undefined' ? App.ALL_DEPTS : 'ทุกฝ่าย';

        if (s.scope === 'project') {
            const p = projects.find(x => String(x.id) === String(s.targetId));
            scopeProjects = p ? [p] : [];
            tasks = p ? tasks.filter(t => String(t.projectId) === String(p.id)) : [];
            title = p ? p.name : this.L('ยังไม่ได้เลือกโปรเจกต์', 'No project selected');
            subtitle = this.L('รายงานโปรเจกต์', 'Project report');
        } else if (s.scope === 'division') {
            const div = s.targetId;
            people = this._people().filter(u => u.department === div).map(u => String(u.id));
            scopeProjects = projects.filter(p => (p.teams || []).includes(div) || (p.teams || []).includes(all));
            const projIds = new Set(scopeProjects.map(p => String(p.id)));
            tasks = tasks.filter(t => projIds.has(String(t.projectId)) || (t.departments || []).includes(div)
                || (t.assignees || []).some(a => people.includes(String(a))));
            title = div || this.L('ยังไม่ได้เลือกแผนก', 'No division selected');
            subtitle = this.L('รายงานแผนก', 'Division report');
        } else {
            const who = String(s.targetId || this._me().id || '');
            people = [who];
            tasks = tasks.filter(t => (t.assignees || []).map(String).includes(who) || (t.relatedUsers || []).map(String).includes(who));
            scopeProjects = projects.filter(p => tasks.some(t => String(t.projectId) === String(p.id)));
            title = this._personName(who);
            subtitle = this.L('รายงานส่วนบุคคล', 'Personal report');
        }

        const isDone = t => t.status === 'done';
        const completedDate = t => (t.completedAt || (isDone(t) ? t.dueDate : '') || '').slice(0, 10);
        const inPeriod = d => d && d >= period.start && d <= period.end;
        const done = tasks.filter(isDone);
        const open = tasks.filter(t => !isDone(t));
        const overdue = open.filter(t => t.dueDate && t.dueDate < today);
        const completedInPeriod = done.filter(t => inPeriod(completedDate(t)));
        const dueInPeriod = tasks.filter(t => inPeriod(t.dueDate));

        /* time entries in the period (only the chosen people for personal/division reports) */
        const logs = [];
        tasks.forEach(t => (Array.isArray(t.timeLogs) ? t.timeLogs : []).forEach(l => {
            const at = new Date(l.startedAt);
            if (isNaN(at) || !inPeriod(`${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`)) return;
            if (people && s.scope === 'personal' && !people.includes(String(l.userId))) return;
            logs.push({ task: t, userId: l.userId, minutes: Number(l.minutes) || 0 });
        }));
        const byPerson = {}, byTask = {};
        logs.forEach(l => {
            byPerson[l.userId] = (byPerson[l.userId] || 0) + l.minutes;
            byTask[l.task.id] = (byTask[l.task.id] || 0) + l.minutes;
        });
        const timePeople = Object.entries(byPerson).map(([id, min]) => ({ id, name: this._personName(id), minutes: min })).sort((a, b) => b.minutes - a.minutes);
        const timeTasks = Object.entries(byTask).map(([id, min]) => {
            const t = tasks.find(x => String(x.id) === String(id));
            const totalAll = (Array.isArray(t.timeLogs) ? t.timeLogs : []).reduce((a, l) => a + (Number(l.minutes) || 0), 0);
            return { id, title: t.title, project: (projects.find(p => String(p.id) === String(t.projectId)) || {}).name || '', minutes: min, totalMinutes: totalAll, estimate: Number(t.estimateMinutes) || 0 };
        }).sort((a, b) => b.minutes - a.minutes);
        const totalMinutes = logs.reduce((a, l) => a + l.minutes, 0);
        const estimateOpen = tasks.reduce((a, t) => a + (Number(t.estimateMinutes) || 0), 0);

        /* budgets: project budget vs the sum of its task budgets */
        const budgets = scopeProjects.filter(p => p.budgetEnabled).map(p => {
            const pt = (typeof mockTasks !== 'undefined' ? mockTasks : []).filter(t => String(t.projectId) === String(p.id) && !t.isDraft);
            const planned = pt.reduce((a, t) => a + (Number(t.budgetAmount) || 0), 0);
            return { name: p.name, budget: p.budgetAmount, planned, left: p.budgetAmount != null ? p.budgetAmount - planned : null };
        });

        return {
            scope: s.scope, title, subtitle, period, generatedAt: new Date().toISOString(),
            projects: scopeProjects,
            counts: { total: tasks.length, done: done.length, open: open.length, overdue: overdue.length, completedInPeriod: completedInPeriod.length, dueInPeriod: dueInPeriod.length },
            progress: tasks.length ? Math.round(done.length / tasks.length * 100) : 0,
            completedInPeriod, overdue, open,
            timePeople, timeTasks, totalMinutes, estimateOpen,
            budgets, financeOn: scopeProjects.some(p => p.budgetEnabled),
            projectName: id => (projects.find(p => String(p.id) === String(id)) || {}).name || ''
        };
    },

    /* ---------- on screen ---------- */
    _targetOptions() {
        const s = this.state;
        if (s.scope === 'project') {
            const list = this._projects();
            if (!s.targetId && list[0]) s.targetId = String(list[0].id);
            return list.length ? list.map(p => `<option value="${this._esc(p.id)}" ${String(p.id) === String(s.targetId) ? 'selected' : ''}>${this._esc(p.name)}</option>`).join('')
                : `<option value="">${this.L('ยังไม่มีโปรเจกต์', 'No projects yet')}</option>`;
        }
        if (s.scope === 'division') {
            const list = this._divisions();
            if (!s.targetId && list[0]) s.targetId = list[0];
            return list.length ? list.map(d => `<option value="${this._esc(d)}" ${d === s.targetId ? 'selected' : ''}>${this._esc(d)}</option>`).join('')
                : `<option value="">${this.L('ยังไม่มีแผนก', 'No divisions yet')}</option>`;
        }
        const me = String(this._me().id || '');
        if (!s.targetId) s.targetId = me;
        return this._people().map(u => `<option value="${this._esc(u.id)}" ${String(u.id) === String(s.targetId) ? 'selected' : ''}>${this._esc(u.name || u.email)}${String(u.id) === me ? this.L(' (ฉัน)', ' (me)') : ''}</option>`).join('');
    },

    _kpi(label, value, sub, tone) {
        const tones = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', gray: 'bg-gray-50 text-gray-700' };
        return `<div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div class="text-xs font-semibold text-gray-500">${label}</div>
            <div class="mt-1 text-2xl font-bold tabular-nums ${(tones[tone] || '').split(' ')[1] || 'text-gray-900'}">${value}</div>
            ${sub ? `<div class="mt-0.5 text-xs text-gray-500">${sub}</div>` : ''}</div>`;
    },

    _table(headers, rows, empty) {
        if (!rows.length) return `<p class="text-sm text-gray-400 py-3">${empty}</p>`;
        return `<div class="overflow-x-auto"><table class="w-full text-sm">
            <thead><tr class="text-left text-xs text-gray-500 border-b border-gray-100">${headers.map((h, i) => `<th class="py-2 pr-3 font-semibold ${i ? 'text-right' : ''}">${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(r => `<tr class="border-b border-gray-50">${r.map((c, i) => `<td class="py-2 pr-3 ${i ? 'text-right tabular-nums' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    },

    _section(title, body) {
        return `<section class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h3 class="text-base font-bold text-gray-800 mb-3">${title}</h3>${body}</section>`;
    },

    _reportHtml(d) {
        const e = v => this._esc(v);
        const c = d.counts;
        const kpis = `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
            ${this._kpi(this.L('ความคืบหน้า', 'Progress'), d.progress + '%', this.L(`เสร็จ ${c.done} จาก ${c.total} งาน`, `${c.done} of ${c.total} tasks done`), 'blue')}
            ${this._kpi(this.L('เสร็จในช่วงนี้', 'Done this period'), c.completedInPeriod, this.L(`ครบกำหนดในช่วงนี้ ${c.dueInPeriod} งาน`, `${c.dueInPeriod} due this period`), 'green')}
            ${this._kpi(this.L('งานค้าง', 'Open tasks'), c.open, this.L(`เลยกำหนด ${c.overdue} งาน`, `${c.overdue} overdue`), c.overdue ? 'red' : 'amber')}
            ${this._kpi(this.L('เวลาที่ใช้จริง', 'Time spent'), e(this._fmtMin(d.totalMinutes)), this.L(`ประมาณการรวม ${this._fmtMin(d.estimateOpen)}`, `estimates total ${this._fmtMin(d.estimateOpen)}`), 'gray')}
        </div>`;

        const progressBar = `<div class="h-3 rounded-full bg-gray-100 overflow-hidden"><div class="h-full bg-blue-600" style="width:${d.progress}%"></div></div>`;

        /* a task name that opens the task (the click is handled in render) */
        const link = (id, title) => `<button type="button" data-task-id="${e(id)}" class="text-left text-gray-800 hover:text-blue-700 hover:underline">${e(title)}</button>`;
        const doneRows = d.completedInPeriod.map(t => [link(t.id, t.title), e(d.projectName(t.projectId)), e(this._fmtDate(t.completedAt || t.dueDate))]);
        const openRows = [...d.overdue, ...d.open.filter(t => !d.overdue.includes(t))].slice(0, 50).map(t => [
            link(t.id, t.title) + (d.overdue.includes(t) ? ` <span class="ml-1 text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5">${this.L('เลยกำหนด', 'Overdue')}</span>` : ''),
            e(d.projectName(t.projectId)), e(this._fmtDate(t.dueDate))]);
        const personRows = d.timePeople.map(p => [e(p.name), e(this._fmtMin(p.minutes)), String(this._hours(p.minutes))]);
        const taskRows = d.timeTasks.map(t => {
            const over = t.estimate && t.totalMinutes > t.estimate;
            return [link(t.id, t.title) + `<div class="text-xs text-gray-400">${e(t.project)}</div>`, e(this._fmtMin(t.minutes)),
                t.estimate ? `<span class="${over ? 'text-red-600 font-semibold' : ''}">${e(this._fmtMin(t.totalMinutes))} / ${e(this._fmtMin(t.estimate))}</span>` : '—'];
        });
        const budgetRows = d.budgets.map(b => [e(b.name), e(this._money(b.budget)), e(this._money(b.planned)),
            `<span class="${b.left != null && b.left < 0 ? 'text-red-600 font-semibold' : ''}">${e(this._money(b.left))}</span>`]);

        return `
        <div class="space-y-4" id="wr-report" data-no-i18n>
            <div class="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 shadow-sm">
                <div class="text-xs font-semibold uppercase tracking-wider opacity-80">${e(d.subtitle)}</div>
                <h2 class="text-2xl font-bold mt-1">${e(d.title)}</h2>
                <div class="text-sm opacity-90 mt-1">${e(d.period.label)} · ${e(this._fmtDate(d.period.start))} – ${e(this._fmtDate(d.period.end))}</div>
            </div>
            ${kpis}
            ${this._section(this.L('ความคืบหน้ารวม', 'Overall progress'), progressBar + `<p class="text-xs text-gray-500 mt-2">${this.L(`งานทั้งหมด ${c.total} · เสร็จ ${c.done} · ค้าง ${c.open} · เลยกำหนด ${c.overdue}`, `${c.total} tasks · ${c.done} done · ${c.open} open · ${c.overdue} overdue`)}</p>`)}
            <div class="grid lg:grid-cols-2 gap-4">
                ${this._section(this.L('เวลาที่ใช้ต่อคน', 'Time per person'), this._table([this.L('ชื่อ', 'Name'), this.L('เวลา', 'Time'), this.L('ชั่วโมง', 'Hours')], personRows, this.L('ยังไม่มีการบันทึกเวลาในช่วงนี้', 'No time logged in this period')))}
                ${this._section(this.L('เวลาที่ใช้ต่องาน', 'Time per task'), this._table([this.L('งาน', 'Task'), this.L('ในช่วงนี้', 'This period'), this.L('รวม / ประมาณการ', 'Total / estimate')], taskRows, this.L('ยังไม่มีการบันทึกเวลาในช่วงนี้', 'No time logged in this period')))}
            </div>
            ${this._section(this.L('งานที่เสร็จในช่วงนี้', 'Tasks completed this period'), this._table([this.L('งาน', 'Task'), this.L('โปรเจกต์', 'Project'), this.L('เสร็จเมื่อ', 'Completed')], doneRows, this.L('ไม่มีงานที่เสร็จในช่วงนี้', 'No tasks completed in this period')))}
            ${this._section(this.L('งานค้างและงานเลยกำหนด', 'Open and overdue tasks'), this._table([this.L('งาน', 'Task'), this.L('โปรเจกต์', 'Project'), this.L('กำหนดส่ง', 'Due')], openRows, this.L('ไม่มีงานค้าง', 'No open tasks')))}
            ${d.budgets.length ? this._section(this.L('งบประมาณ', 'Budget'), this._table([this.L('โปรเจกต์', 'Project'), this.L('งบโปรเจกต์', 'Project budget'), this.L('งบที่วางให้งาน', 'Allocated to tasks'), this.L('คงเหลือ', 'Remaining')], budgetRows, '')) : ''}
            ${this._financeHtml(d)}
            <p class="text-xs text-gray-400">${this.L('สร้างเมื่อ', 'Generated')} ${e(new Date(d.generatedAt).toLocaleString(this._en() ? 'en-GB' : 'th-TH'))} · ConWork</p>
        </div>`;
    },

    render() {
        const root = document.getElementById('view-work-report');
        if (!root) return;
        const s = this.state;
        const period = this._period();
        const seg = (key, val, th, en, icon) => `<button type="button" onclick="WorkReport.setScope('${val}')"
            class="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold transition-colors ${s.scope === val ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}">
            <i class="fa-solid ${icon}"></i>${this.L(th, en)}</button>`;
        const kinds = [['week', 'สัปดาห์', 'Week'], ['month', 'เดือน', 'Month'], ['quarter', 'ไตรมาส', 'Quarter'], ['year', 'ปี', 'Year']];
        const targetOptions = this._targetOptions(); // also picks a default target
        const data = this._collect();
        root.innerHTML = `
        <div class="flex flex-col h-full min-h-0 gap-4" data-no-i18n>
            <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 shrink-0 wr-controls">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex bg-gray-100 p-1 rounded-2xl gap-1 flex-1 min-w-[280px]">
                        ${seg('scope', 'project', 'โปรเจกต์', 'Project', 'fa-diagram-project')}
                        ${seg('scope', 'personal', 'ส่วนตัว', 'Personal', 'fa-user')}
                        ${seg('scope', 'division', 'แผนก', 'Division', 'fa-sitemap')}
                    </div>
                    <select id="wr-target" onchange="WorkReport.setTarget(this.value)" class="border border-gray-200 rounded-xl py-2 px-3 text-sm min-w-[200px] flex-1">${targetOptions}</select>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <div class="flex bg-gray-100 p-1 rounded-xl gap-1">
                        ${kinds.map(([k, th, en]) => `<button type="button" onclick="WorkReport.setPeriodKind('${k}')" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${s.periodKind === k ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}">${this.L(th, en)}</button>`).join('')}
                    </div>
                    <button type="button" onclick="WorkReport.stepPeriod(-1)" class="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="${this.L('ช่วงก่อนหน้า', 'Previous period')}"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                    <span class="text-sm font-semibold text-gray-800 min-w-[10rem] text-center">${this._esc(period.label)}</span>
                    <button type="button" onclick="WorkReport.stepPeriod(1)" class="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50" aria-label="${this.L('ช่วงถัดไป', 'Next period')}"><i class="fa-solid fa-chevron-right text-xs"></i></button>
                    <button type="button" onclick="WorkReport.thisPeriod()" class="px-3 py-1.5 rounded-lg text-sm text-blue-700 hover:bg-blue-50">${this.L('ช่วงปัจจุบัน', 'Current')}</button>
                    <div class="flex gap-2 ml-auto">
                        <button type="button" onclick="WorkReport.exportExcel()" ${s.busy ? 'disabled' : ''} class="px-3 py-2 rounded-xl border border-green-600 text-green-700 hover:bg-green-50 text-sm font-semibold flex items-center gap-2"><i class="fa-solid fa-file-excel"></i>Excel</button>
                        <button type="button" onclick="WorkReport.exportPDF()" class="px-3 py-2 rounded-xl border border-red-500 text-red-600 hover:bg-red-50 text-sm font-semibold flex items-center gap-2"><i class="fa-solid fa-file-pdf"></i>PDF</button>
                        <button type="button" onclick="WorkReport.share()" ${s.busy ? 'disabled' : ''} class="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold flex items-center gap-2"><i class="fa-solid fa-share-nodes"></i>${this.L('แชร์', 'Share')}</button>
                    </div>
                </div>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto pb-6">${this._reportHtml(data)}</div>
        </div>`;
        /* task names open the task */
        root.onclick = ev => {
            const b = ev.target.closest('[data-task-id]');
            if (!b || typeof App === 'undefined') return;
            const task = (typeof mockTasks !== 'undefined' ? mockTasks : []).find(t => String(t.id) === b.dataset.taskId);
            if (task) App.openTaskDetailView(task.id);
        };
        /* finance comes from the database: draw again once it arrives */
        if (this._wantsFinance(data) && !(this.state.finance && this.state.finance.key === this._financeKey(data) && (this.state.finance.data || this.state.finance.promise))) {
            const key = this._financeKey(data);
            this._ensureFinance(data).then(() => {
                const view = document.getElementById('view-work-report');
                if (this.state.finance && this.state.finance.key === key && view && !view.classList.contains('hidden')) this.render();
            });
        }
    },

    /* ---------- controls ---------- */
    setScope(scope) { this.state.scope = scope; this.state.targetId = ''; this.render(); },
    setTarget(id) { this.state.targetId = id; this.render(); },
    setPeriodKind(kind) { this.state.periodKind = kind; this.render(); },
    stepPeriod(steps) {
        if (!window.ConworkPeriods) return;
        const next = ConworkPeriods.shift(this.state.periodKind, this.state.periodRef ? new Date(this.state.periodRef) : new Date(), steps);
        this.state.periodRef = next.start + 'T00:00:00';
        this.render();
    },
    thisPeriod() { this.state.periodRef = null; this.render(); },

    /* ---------- exports ---------- */
    _fileBase(d) {
        const clean = String(d.title || 'report').replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'report';
        return `ConWork_${clean}_${d.period.start}_${d.period.end}`;
    },

    _loadXlsx() {
        if (window.XLSX) return Promise.resolve(window.XLSX);
        if (this._xlsxLoading) return this._xlsxLoading;
        this._xlsxLoading = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = this.XLSX_URL;
            s.integrity = this.XLSX_SRI;
            s.crossOrigin = 'anonymous';
            s.referrerPolicy = 'no-referrer';
            s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX not loaded'));
            s.onerror = () => { this._xlsxLoading = null; reject(new Error('Could not load the Excel library')); };
            document.head.appendChild(s);
        });
        return this._xlsxLoading;
    },

    /* a real .xlsx workbook: Summary, Tasks, Time per person, Time per task (and Budget) */
    async _buildWorkbook(d) {
        const XLSX = await this._loadXlsx();
        const wb = XLSX.utils.book_new();
        const L = (th, en) => this.L(th, en);
        const c = d.counts;
        const summary = [
            [d.subtitle, d.title],
            [L('ช่วงเวลา', 'Period'), d.period.label],
            [L('ตั้งแต่', 'From'), d.period.start], [L('ถึง', 'To'), d.period.end],
            [],
            [L('ความคืบหน้า (%)', 'Progress (%)'), d.progress],
            [L('งานทั้งหมด', 'Total tasks'), c.total], [L('เสร็จแล้ว', 'Done'), c.done], [L('งานค้าง', 'Open'), c.open],
            [L('เลยกำหนด', 'Overdue'), c.overdue], [L('เสร็จในช่วงนี้', 'Completed this period'), c.completedInPeriod],
            [L('ครบกำหนดในช่วงนี้', 'Due this period'), c.dueInPeriod],
            [L('เวลาที่ใช้จริง (ชั่วโมง)', 'Time spent (hours)'), this._hours(d.totalMinutes)],
            [L('เวลาประมาณการรวม (ชั่วโมง)', 'Estimated time (hours)'), this._hours(d.estimateOpen)],
            [L('สร้างเมื่อ', 'Generated'), new Date(d.generatedAt).toLocaleString(this._en() ? 'en-GB' : 'th-TH')]
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(summary); ws1['!cols'] = [{ wch: 28 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws1, L('สรุป', 'Summary'));

        const taskRows = [[L('งาน', 'Task'), L('โปรเจกต์', 'Project'), L('สถานะ', 'Status'), L('กำหนดส่ง', 'Due'), L('เสร็จเมื่อ', 'Completed'), L('เลยกำหนด', 'Overdue')]];
        [...d.completedInPeriod, ...d.open].forEach(t => taskRows.push([t.title, d.projectName(t.projectId), t.status === 'done' ? L('เสร็จ', 'Done') : L('ค้าง', 'Open'),
            t.dueDate || '', (t.completedAt || '').slice(0, 10), d.overdue.includes(t) ? L('ใช่', 'Yes') : '']));
        const ws2 = XLSX.utils.aoa_to_sheet(taskRows); ws2['!cols'] = [{ wch: 40 }, { wch: 28 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws2, L('งาน', 'Tasks'));

        const pRows = [[L('ชื่อ', 'Name'), L('ชั่วโมง', 'Hours'), L('นาที', 'Minutes')], ...d.timePeople.map(p => [p.name, this._hours(p.minutes), p.minutes])];
        const ws3 = XLSX.utils.aoa_to_sheet(pRows); ws3['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws3, L('เวลาต่อคน', 'Time per person'));

        const tRows = [[L('งาน', 'Task'), L('โปรเจกต์', 'Project'), L('ชั่วโมงในช่วงนี้', 'Hours this period'), L('ชั่วโมงรวม', 'Hours total'), L('ชั่วโมงประมาณการ', 'Estimated hours')],
            ...d.timeTasks.map(t => [t.title, t.project, this._hours(t.minutes), this._hours(t.totalMinutes), t.estimate ? this._hours(t.estimate) : ''])];
        const ws4 = XLSX.utils.aoa_to_sheet(tRows); ws4['!cols'] = [{ wch: 40 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, ws4, L('เวลาต่องาน', 'Time per task'));

        if (d.budgets.length) {
            const bRows = [[L('โปรเจกต์', 'Project'), L('งบโปรเจกต์', 'Project budget'), L('งบที่วางให้งาน', 'Allocated to tasks'), L('คงเหลือ', 'Remaining')],
                ...d.budgets.map(b => [b.name, b.budget, b.planned, b.left])];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bRows), L('งบประมาณ', 'Budget'));
        }

        /* finance from the accounting system: budget vs actual, and P&L / balance sheet for owner/admins */
        const f = this.state.finance && this.state.finance.key === this._financeKey(d) ? this.state.finance.data : null;
        if (f && f.status === 'ready') {
            if (f.budget.length) {
                const rows = [[L('โปรเจกต์', 'Project'), L('งบประมาณ', 'Budget'), L('ใช้จริง', 'Actual'), L('ใช้ไป (%)', 'Used (%)'), L('คงเหลือ', 'Remaining')],
                    ...f.budget.map(b => [b.name, b.budget_amount != null ? Number(b.budget_amount) : '', Number(b.actual) || 0, b.pct != null ? Number(b.pct) : '',
                        b.budget_amount != null ? Number(b.budget_amount) - (Number(b.actual) || 0) : ''])];
                const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }];
                XLSX.utils.book_append_sheet(wb, ws, L('งบเทียบใช้จริง', 'Budget vs actual'));
            }
            if (f.pl && typeof Accounting !== 'undefined') Accounting.addStatementSheets(XLSX, wb, { pl: f.pl, bs: f.scopeIsProject ? [] : (f.bs || []) }, d.period, false);
        }
        return wb;
    },

    /* ---------- finance (from the accounting system) ---------- */
    _financeKey(d) { return [d.scope, this.state.targetId, d.period.start, d.period.end].join('|'); },
    _wantsFinance(d) { return typeof Accounting !== 'undefined' && (d.financeOn || Accounting.isAdmin()); },
    async _ensureFinance(d) {
        if (!this._wantsFinance(d)) return null;
        const key = this._financeKey(d);
        if (this.state.finance && this.state.finance.key === key && this.state.finance.data) return this.state.finance.data;
        if (this.state.finance && this.state.finance.key === key && this.state.finance.promise) return this.state.finance.promise;
        const projectId = d.scope === 'project' && d.projects[0] ? d.projects[0].id : null;
        const promise = Accounting.reportData(d.projects.map(p => p.id), d.period, projectId)
            .catch(() => ({ status: 'error' }))
            .then(data => {
                data.scopeIsProject = !!projectId;
                if (this.state.finance && this.state.finance.key === key) this.state.finance.data = data;
                return data;
            });
        this.state.finance = { key, promise, data: null };
        return promise;
    },
    _financeHtml(d) {
        if (!this._wantsFinance(d)) return '';
        const title = this.L('การเงิน', 'Finance');
        const f = this.state.finance && this.state.finance.key === this._financeKey(d) ? this.state.finance.data : null;
        if (!f) return this._section(title, `<p class="text-sm text-gray-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i>${this.L('กำลังโหลดข้อมูลการเงิน…', 'Loading finance…')}</p>`);
        if (f.status === 'setup') return this._section(title, `<p class="text-sm text-gray-500">${this.L('ระบบบัญชียังไม่ได้ติดตั้งในฐานข้อมูล', 'Accounting is not set up in the database yet')}</p>`);
        if (f.status !== 'ready') return this._section(title, `<p class="text-sm text-gray-500">${this.L('ยังดึงข้อมูลการเงินไม่ได้ (ต้องเชื่อมต่อฐานข้อมูล)', 'Finance is not available (needs the database connection)')}</p>`);
        const e = v => this._esc(v);
        const budgetRows = f.budget.map(b => {
            const pct = b.pct != null ? Number(b.pct) : null;
            const left = b.budget_amount != null ? Number(b.budget_amount) - (Number(b.actual) || 0) : null;
            const cls = pct >= 100 ? 'text-red-600 font-semibold' : pct >= 80 ? 'text-amber-600 font-semibold' : '';
            return [e(b.name), e(this._money(b.budget_amount)), e(this._money(b.actual)), `<span class="${cls}">${pct != null ? pct + '%' : '—'}</span>`,
                `<span class="${left != null && left < 0 ? 'text-red-600 font-semibold' : ''}">${e(this._money(left))}</span>`];
        });
        let html = `<h4 class="text-sm font-bold text-gray-700 mb-1">${this.L('งบประมาณเทียบใช้จริง', 'Budget vs actual')}</h4>` +
            this._table([this.L('โปรเจกต์', 'Project'), this.L('งบประมาณ', 'Budget'), this.L('ใช้จริง', 'Actual'), this.L('ใช้ไป', 'Used'), this.L('คงเหลือ', 'Remaining')], budgetRows,
                this.L('ไม่มีโปรเจกต์ที่เปิดใช้งบประมาณในรายงานนี้', 'No projects with a budget in this report'));
        if (f.pl) {
            html += `<div class="grid lg:grid-cols-2 gap-4 mt-4">
                <div><h4 class="text-sm font-bold text-gray-700 mb-1">${f.scopeIsProject ? this.L('กำไรขาดทุนของโปรเจกต์', 'Project profit and loss') : this.L('งบกำไรขาดทุน (ทั้งบริษัท)', 'Profit and loss (whole company)')}</h4>${Accounting.plHtml(f.pl)}</div>
                ${!f.scopeIsProject && f.bs ? `<div><h4 class="text-sm font-bold text-gray-700 mb-1">${this.L('งบดุล ณ วันสิ้นงวด (ทั้งบริษัท)', 'Balance sheet at period end (whole company)')}</h4>${Accounting.bsHtml(f.bs)}</div>` : ''}
            </div>`;
        }
        return this._section(title, html);
    },

    async _xlsxFile(d) {
        await this._ensureFinance(d);
        const XLSX = await this._loadXlsx();
        const wb = await this._buildWorkbook(d);
        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return new File([out], this._fileBase(d) + '.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    },

    _download(file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    },

    async exportExcel() {
        try {
            this.state.busy = true;
            const file = await this._xlsxFile(this._collect());
            this._download(file);
            App._showToast(this.L('ดาวน์โหลดไฟล์ Excel แล้ว', 'Excel file downloaded'), 'success');
        } catch (e) {
            console.error(e);
            App._showToast(this.L('สร้างไฟล์ Excel ไม่สำเร็จ', 'Could not create the Excel file'), 'error');
        } finally { this.state.busy = false; }
    },

    /* print-ready copy in a hidden frame (no pop-up needed); the browser's "Save as PDF" makes the PDF */
    async exportPDF() {
        const d = this._collect();
        await this._ensureFinance(d);
        const old = document.getElementById('wr-print-frame');
        if (old) old.remove();
        const frame = document.createElement('iframe');
        frame.id = 'wr-print-frame';
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(frame);
        const win = frame.contentWindow;
        const css = `
            @page { size: A4; margin: 14mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Atkinson Hyperlegible Next', 'IBM Plex Sans Thai', 'Sarabun', system-ui, sans-serif; color: #0F172A; font-size: 12px; margin: 0; }
            h2 { font-size: 20px; margin: 4px 0; } h3 { font-size: 14px; margin: 0 0 8px; }
            section, .rounded-2xl { border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px; margin: 0 0 10px; break-inside: avoid; background: #fff; }
            .grid { display: grid; gap: 8px; } .lg\\:grid-cols-4 { grid-template-columns: repeat(4, 1fr); } .lg\\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
            .bg-gradient-to-r { background: #1D4ED8 !important; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table { width: 100%; border-collapse: collapse; } th, td { padding: 5px 6px; border-bottom: 1px solid #F1F5F9; text-align: left; }
            th { font-size: 10px; color: #475569; text-transform: uppercase; } .text-right { text-align: right; }
            .h-3 { height: 10px; background: #F1F5F9; border-radius: 99px; overflow: hidden; } .h-3 > div { height: 100%; background: #2563EB; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .text-xs { font-size: 10px; } .text-gray-500, .text-gray-400 { color: #64748B; } .text-red-600 { color: #DC2626; } .text-2xl { font-size: 18px; font-weight: 700; }
            .fa-solid { display: none; }`;
        win.document.open();
        win.document.write(`<!DOCTYPE html><html lang="${this._en() ? 'en' : 'th'}"><head><meta charset="utf-8"><title>${this._esc(this._fileBase(d))}</title>
            <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;700&family=IBM+Plex+Sans+Thai:wght@400;700&display=swap" rel="stylesheet">
            <style>${css}</style></head><body>${this._reportHtml(d)}</body></html>`);
        win.document.close();
        let printed = false;
        const go = () => { if (printed) return; printed = true; win.focus(); win.print(); };
        frame.onload = () => setTimeout(go, 300);
        setTimeout(go, 1500); // fonts slow or onload missed
    },

    /* share the Excel file with the device's share sheet when possible; otherwise download it */
    async share() {
        try {
            this.state.busy = true;
            const d = this._collect();
            const file = await this._xlsxFile(d);
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: d.title, text: `${d.subtitle}: ${d.title} (${d.period.label})` });
            } else {
                this._download(file);
                App._showToast(this.L('อุปกรณ์นี้แชร์ไฟล์โดยตรงไม่ได้ จึงดาวน์โหลดไฟล์ให้แทน', 'This device cannot share files directly, so the file was downloaded'), 'info');
            }
        } catch (e) {
            if (e && e.name === 'AbortError') return; // the person closed the share sheet
            console.error(e);
            App._showToast(this.L('แชร์รายงานไม่สำเร็จ', 'Could not share the report'), 'error');
        } finally { this.state.busy = false; }
    },

    init() {
        if (!this.state.targetId && this.state.scope === 'personal') this.state.targetId = String(this._me().id || '');
        this.render();
    }
};
