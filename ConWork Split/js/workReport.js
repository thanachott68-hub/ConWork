/**
 * ConWork — Generate Work Report Module
 * Pulls data from tasks/projects the current user is responsible for.
 */
const WorkReport = {
    state: {
        currentStep: 1,
        selectedPeriod: 'this-month',
        selectedReportType: 'progress',
        startDate: '',
        endDate: '',
        exportFormat: 'pdf',
        reportPreviewData: null,
        isLoading: false
    },

    PERIODS: [
        { id: 'today', label: 'Today', labelTh: 'วันนี้', icon: 'fa-sun' },
        { id: 'this-week', label: 'This Week', labelTh: 'สัปดาห์นี้', icon: 'fa-calendar-week' },
        { id: 'this-month', label: 'This Month', labelTh: 'เดือนนี้', icon: 'fa-calendar' },
        { id: 'this-quarter', label: 'This Quarter', labelTh: 'ไตรมาสนี้', icon: 'fa-chart-pie' },
        { id: 'custom', label: 'Custom Date Range', labelTh: 'กำหนดช่วงวันที่เอง', icon: 'fa-calendar-days' }
    ],

    REPORT_TYPES: [
        {
            id: 'progress',
            title: 'Progress Report',
            titleTh: 'รายงานความคืบหน้า',
            icon: 'fa-chart-bar',
            items: ['ความคืบหน้าโครงการ', 'งานที่เสร็จสมบูรณ์', 'งานที่รอดำเนินการ', 'เป้าหมายหลัก']
        },
        {
            id: 'work-summary',
            title: 'Work Summary Report',
            titleTh: 'รายงานสรุปงาน',
            icon: 'fa-clipboard-list',
            items: ['กิจกรรม', 'การประชุม', 'ผลงานที่สำเร็จ']
        },
        {
            id: 'official',
            title: 'Official Report',
            titleTh: 'รายงานทางการ',
            icon: 'fa-landmark',
            items: ['วัตถุประสงค์', 'การดำเนินงาน', 'ผลลัพธ์', 'ปัญหาและอุปสรรค', 'ข้อเสนอแนะ', 'บทสรุป']
        }
    ],

    /* ── Date Helpers ── */
    _today() {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    },

    _formatDate(d) {
        return d.toISOString().slice(0, 10);
    },

    _getPeriodRange(periodId, startDate, endDate) {
        const now = this._today();
        let start, end;

        switch (periodId) {
            case 'today':
                start = new Date(now);
                end = new Date(now);
                end.setHours(23, 59, 59, 999);
                break;
            case 'this-week': {
                const day = now.getDay();
                const diff = day === 0 ? 6 : day - 1;
                start = new Date(now);
                start.setDate(now.getDate() - diff);
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            }
            case 'this-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                break;
            case 'this-quarter': {
                const q = Math.floor(now.getMonth() / 3);
                start = new Date(now.getFullYear(), q * 3, 1);
                end = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
                break;
            }
            case 'custom':
                start = startDate ? new Date(startDate) : now;
                end = endDate ? new Date(endDate) : now;
                end.setHours(23, 59, 59, 999);
                break;
            default:
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = now;
        }
        return { start, end };
    },

    _formatPeriodLabel(periodId, startDate, endDate) {
        const { start, end } = this._getPeriodRange(periodId, startDate, endDate);
        const fmt = (d) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const p = this.PERIODS.find(x => x.id === periodId);
        if (periodId === 'custom') return `${fmt(start)} – ${fmt(end)}`;
        return p ? p.labelTh : fmt(start);
    },

    _inRange(dateStr, start, end) {
        if (!dateStr) return true;
        const d = new Date(dateStr);
        return d >= start && d <= end;
    },

    /* ── Data Aggregation (user's assigned work) ── */
    _getUserData() {
        const user = App.state.currentUser;
        if (!user) return null;

        const userId = user.id;
        const { start, end } = this._getPeriodRange(
            this.state.selectedPeriod,
            this.state.startDate,
            this.state.endDate
        );

        const projects = (typeof mockProjects !== 'undefined' ? mockProjects : [])
            .filter(p => {
                const uid = parseInt(userId);
                const isTeam = Array.isArray(p.team) && p.team.some(id => parseInt(id) === uid);
                const isManager = Array.isArray(p.managers) && p.managers.some(id => parseInt(id) === uid);
                const isComanager = Array.isArray(p.comanagers) && p.comanagers.some(id => parseInt(id) === uid);
                return isTeam || isManager || isComanager;
            });

        const myProjectIds = new Set(projects.map(p => p.id));
        const allTasks = typeof mockTasks !== 'undefined' ? mockTasks : [];
        const isLeader = user.role.includes('manager') || user.role.includes('admin') || user.role.includes('reviewer') || user.role === 'CEO';
        
        const myTasks = allTasks.filter(t => {
            const uid = parseInt(userId);
            const isAssigned = Array.isArray(t.assignees) && t.assignees.some(id => parseInt(id) === uid);
            const isProjectTaskAndLeader = isLeader && myProjectIds.has(t.projectId);
            return isAssigned || isProjectTaskAndLeader;
        });
        
        const periodTasks = myTasks.filter(t => this._inRange(t.submittedAt || t.dueDate, start, end));

        const completedTasks = periodTasks.filter(t => t.status === 'done');
        const pendingTasks = periodTasks.filter(t => t.status !== 'done');

        const allEvents = typeof mockEvents !== 'undefined' ? mockEvents : [];
        const meetings = allEvents.filter(e => {
            if (!this._inRange(e.date, start, end)) return false;
            if (e.type === 'group') return true;
            return e.projectId && myProjectIds.has(e.projectId);
        });

        const documents = periodTasks.reduce((sum, t) => sum + (t.files ? t.files.length : 0), 0);

        const projectSummaries = projects.map(p => {
            const projTasks = myTasks.filter(t => t.projectId === p.id);
            const projDone = projTasks.filter(t => t.status === 'done').length;
            const myCompletion = projTasks.length
                ? Math.round((projDone / projTasks.length) * 100)
                : 0;
            return {
                name: p.name,
                myCompletion,
                projectProgress: Math.round(p.progress || 0)
            };
        });

        const assignedTotal = periodTasks.length;
        const completionRate = assignedTotal
            ? Math.round((completedTasks.length / assignedTotal) * 100)
            : 0;

        return {
            employee: {
                name: user.name,
                department: user.department || '—',
                role: user.role
            },
            period: this._formatPeriodLabel(
                this.state.selectedPeriod,
                this.state.startDate,
                this.state.endDate
            ),
            periodRange: { start, end },
            stats: {
                projectsJoined: projects.length,
                completedTasks: completedTasks.length,
                pendingTasks: pendingTasks.length,
                meetings: meetings.length,
                documents,
                tasksAssigned: assignedTotal,
                completionRate
            },
            projectSummaries,
            meetings,
            completedTasks,
            pendingTasks
        };
    },

    _generateAISummary(data, reportType) {
        const s = data.stats;
        const typeLabels = {
            progress: 'รายงานความคืบหน้า',
            'work-summary': 'รายงานสรุปงาน',
            official: 'รายงานทางการ'
        };
        const typeName = typeLabels[reportType] || 'รายงาน';

        let text = `พนักงาน ${data.employee.name} จากแผนก${data.employee.department} `;
        text += `ได้เข้าร่วม ${s.projectsJoined} โครงการและทำงานที่ได้รับมอบหมายเสร็จสิ้น ${s.completedTasks} รายการ `;
        text += `ในช่วง${data.period} `;
        text += `อัตราการปิดงานอยู่ที่ ${s.completionRate}% `;

        if (s.pendingTasks > 0) {
            text += `ยังมีงานค้าง ${s.pendingTasks} รายการที่ต้องดำเนินการต่อ `;
        } else {
            text += `งานที่ได้รับมอบหมายในช่วงเวลานี้ดำเนินการครบถ้วน `;
        }

        text += `เข้าร่วมการประชุม ${s.meetings} ครั้ง และส่งมอบเอกสาร/งาน ${s.documents} ชิ้น `;

        if (reportType === 'official') {
            text += `\n\nวัตถุประสงค์ : ดำเนินงานตามแผนโครงการที่ได้รับมอบหมายให้แล้วเสร็จตามกำหนด `;
            text += `ผลการดำเนินงาน : ความคืบหน้าโดยรวมอยู่ในเกณฑ์${s.completionRate >= 80 ? 'ดี' : 'ที่ต้องติดตาม'} `;
            if (s.pendingTasks > 0) {
                text += `ปัญหา/อุปสรรค : มีงานค้าง ${s.pendingTasks} รายการ `;
                text += `ข้อเสนอแนะ : จัดสรรเวลาเพิ่มเติมสำหรับงานที่ยังไม่แล้วเสร็จ `;
            }
            text += `สรุป : พนักงานแสดงความรับผิดชอบต่อหน้าที่ได้รับมอบหมายอย่างเหมาะสม`;
        } else if (reportType === 'work-summary') {
            text += `\n\nไฮไลท์ : การประชุมทีมและโครงการ ${s.meetings} ครั้ง ช่วยสร้างความก้าวหน้าในงานที่รับผิดชอบ`;
        }

        return { text, typeName, status: 'Generated' };
    },

    /* ── Navigation ── */
    goToStep(step) {
        if (step < 1 || step > 3) return;
        const panel = document.getElementById('wr-step-content');
        if (panel) {
            panel.classList.add('leaving');
            setTimeout(() => {
                this.state.currentStep = step;
                this.render();
                panel.classList.remove('leaving');
            }, 220);
        } else {
            this.state.currentStep = step;
            this.render();
        }
    },

    nextStep() {
        if (this.state.currentStep === 1) {
            if (this.state.selectedPeriod === 'custom') {
                if (!this.state.startDate || !this.state.endDate) {
                    App._showToast('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด', 'error');
                    return;
                }
                if (this.state.startDate > this.state.endDate) {
                    App._showToast('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด', 'error');
                    return;
                }
            }
            this.goToStep(2);
        }
    },

    prevStep() {
        if (this.state.currentStep > 1) this.goToStep(this.state.currentStep - 1);
    },

    async generatePreview() {
        if (!this.state.selectedReportType) {
            App._showToast('กรุณาเลือกประเภทรายงาน', 'error');
            return;
        }

        this.state.isLoading = true;
        this.render();

        await new Promise(r => setTimeout(r, 1200));

        const userData = this._getUserData();
        const aiSummary = this._generateAISummary(userData, this.state.selectedReportType);

        this.state.reportPreviewData = {
            ...userData,
            reportType: this.state.selectedReportType,
            reportTypeLabel: this.REPORT_TYPES.find(r => r.id === this.state.selectedReportType)?.titleTh || '',
            aiSummary,
            generatedAt: new Date().toISOString()
        };

        this.state.isLoading = false;
        this.goToStep(3);
    },

    async generateReport() {
        if (!this.state.reportPreviewData) return;

        this.state.isLoading = true;
        this.render();

        await new Promise(r => setTimeout(r, 1500));

        const data = this.state.reportPreviewData;
        const format = this.state.exportFormat;

        if (format === 'pdf') {
            this._exportPDF(data);
        } else if (format === 'docx') {
            this._exportDocx(data);
        } else if (format === 'excel') {
            this._exportExcel(data);
        }

        this.state.isLoading = false;
        this.render();
        App._showToast('สร้างรายงานสำเร็จ! ไฟล์กำลังดาวน์โหลด', 'success');
    },

    _buildReportHTML(data) {
        const s = data.stats;
        const rows = data.projectSummaries.map(p =>
            `<tr><td><span class="project-name-display">${p.name}</span></td><td>${p.myCompletion}%</td><td>${p.projectProgress}%</td></tr>`
        ).join('');

        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Work Report - ${data.employee.name}</title>
<style>body{font-family:'Segoe UI',sans-serif;padding:40px;color:#111}h1{color:#2563eb}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f3f4f6}.kpi{display:inline-block;margin:8px 16px 8px 0;padding:12px 20px;background:#eff6ff;border-radius:8px}.summary{background:#f0fdf4;padding:16px;border-left:4px solid #2563eb;margin:16px 0}</style></head>
<body>
<h1>${data.reportTypeLabel}</h1>
<p><strong>พนักงาน : </strong> ${data.employee.name} | <strong>แผนก : </strong> ${data.employee.department} | <strong>ช่วงเวลา : </strong> ${data.period}</p>
<div class="kpi"><strong>${s.projectsJoined}</strong><br>โครงการ</div>
<div class="kpi"><strong>${s.tasksAssigned}</strong><br>งานที่ได้รับ</div>
<div class="kpi"><strong>${s.completedTasks}</strong><br>งานเสร็จ</div>
<div class="kpi"><strong>${s.completionRate}%</strong><br>อัตราสำเร็จ</div>
<div class="kpi"><strong>${s.meetings}</strong><br>การประชุม</div>
<div class="kpi"><strong>${s.documents}</strong><br>เอกสาร</div>
<h2>สรุปโครงการ</h2>
<table><thead><tr><th>ชื่อโครงการ</th><th>ความสำเร็จของฉัน</th><th>ความคืบหน้าโครงการ</th></tr></thead><tbody>${rows}</tbody></table>
<div class="summary"><h3>สรุป AI</h3><p>${data.aiSummary.text.replace(/\n/g, '<br>')}</p></div>
<p style="color:#888;font-size:12px;margin-top:32px">Generated by ConWork Reporting System — ${new Date().toLocaleString('th-TH')}</p>
</body></html>`;
    },

    _exportPDF(data) {
        const html = this._buildReportHTML(data);
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            setTimeout(() => win.print(), 500);
        }
    },

    _exportDocx(data) {
        const html = this._buildReportHTML(data);
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WorkReport_${data.employee.name.replace(/\s/g, '_')}_${this._formatDate(new Date())}.doc`;
        a.click();
        URL.revokeObjectURL(url);
    },

    _exportExcel(data) {
        const html = this._buildReportHTML(data);
        const blob = new Blob(['\ufeff', html], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `WorkReport_${data.employee.name.replace(/\s/g, '_')}_${this._formatDate(new Date())}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    },

    /* ── Event Handlers ── */
    selectPeriod(id) {
        this.state.selectedPeriod = id;
        if (id !== 'custom') {
            this.state.startDate = '';
            this.state.endDate = '';
        } else {
            const now = this._today();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            this.state.startDate = this.state.startDate || this._formatDate(monthStart);
            this.state.endDate = this.state.endDate || this._formatDate(now);
        }
        this.render();
    },

    selectReportType(id) {
        this.state.selectedReportType = id;
        this.render();
    },

    selectExportFormat(fmt) {
        this.state.exportFormat = fmt;
        this.render();
    },

    onDateChange(field, value) {
        this.state[field] = value;
        this.render();
    },

    /* ── Render Components ── */
    _renderStepWizard() {
        const steps = [
            { n: 1, label: 'Select Period', labelTh: 'เลือกช่วงเวลา' },
            { n: 2, label: 'Select Report Type', labelTh: 'เลือกประเภทรายงาน' },
            { n: 3, label: 'Review & Generate', labelTh: 'ตรวจสอบและสร้าง' }
        ];
        const cur = this.state.currentStep;

        return steps.map(s => {
            const cls = s.n < cur ? 'completed' : s.n === cur ? 'active' : '';
            const badge = s.n < cur ? '<i class="fa-solid fa-check text-xs"></i>' : s.n;
            return `<div class="wr-wizard-step ${cls}">
                <div class="wr-wizard-badge">${badge}</div>
                <span class="wr-wizard-label">ขั้นตอนที่ ${s.n} : ${s.labelTh}</span>
            </div>`;
        }).join('');
    },

    _renderPeriodSelector() {
        const cards = this.PERIODS.map(p => {
            const sel = this.state.selectedPeriod === p.id ? 'selected' : '';
            return `<button type="button" class="wr-select-card ${sel}" onclick="WorkReport.selectPeriod('${p.id}')">
                <div class="wr-card-icon"><i class="fa-solid ${p.icon}"></i></div>
                <div class="wr-card-title">${p.labelTh}</div>
            </button>`;
        }).join('');

        let dateRange = '';
        if (this.state.selectedPeriod === 'custom') {
            dateRange = `<div class="wr-date-range">
                <div><label>วันที่เริ่มต้น</label>
                    <input type="date" value="${this.state.startDate}" onchange="WorkReport.onDateChange('startDate', this.value)"></div>
                <div><label>วันที่สิ้นสุด</label>
                    <input type="date" value="${this.state.endDate}" onchange="WorkReport.onDateChange('endDate', this.value)"></div>
            </div>`;
        }

        return `<div class="wr-section-title">เลือกช่วงเวลารายงาน</div>
            <div class="wr-card-grid">${cards}</div>${dateRange}`;
    },

    _renderReportTypeSelector() {
        return `<div class="wr-section-title">เลือกประเภทรายงาน</div>
            <div class="wr-report-grid">${this.REPORT_TYPES.map(r => {
                const sel = this.state.selectedReportType === r.id ? 'selected' : '';
                const items = r.items.map(i => `<li>${i}</li>`).join('');
                return `<button type="button" class="wr-report-card ${sel}" onclick="WorkReport.selectReportType('${r.id}')">
                    <div class="wr-report-icon"><i class="fa-solid ${r.icon}"></i></div>
                    <div class="wr-card-title">${r.titleTh}</div>
                    <ul>${items}</ul>
                </button>`;
            }).join('')}</div>`;
    },

    _renderSummarySidebar(step) {
        const data = this._getUserData();
        if (!data) return '';

        if (step === 1) {
            return `<div class="wr-summary-card">
                <h3><i class="fa-solid fa-chart-simple mr-2 wr-summary-icon"></i>สถิติ</h3>
                ${this._statRow('โครงการ', data.stats.projectsJoined)}
                ${this._statRow('งานเสร็จ', data.stats.completedTasks, true)}
                ${this._statRow('การประชุม', data.stats.meetings)}
                ${this._statRow('เอกสาร', data.stats.documents)}
            </div>`;
        }

        if (step === 2) {
            const rt = this.REPORT_TYPES.find(r => r.id === this.state.selectedReportType);
            return `<div class="wr-summary-card">
                <h3><i class="fa-solid fa-file-lines mr-2 wr-summary-icon"></i>รายงานที่เลือก</h3>
                <div class="wr-stat-row"><span class="wr-stat-label">ประเภท</span><span class="wr-stat-value text-sm">${rt ? rt.titleTh : '—'}</span></div>
                ${this._statRow('งานเสร็จ', data.stats.completedTasks, true)}
                <div class="wr-stat-row mt-3 pt-3 border-t border-gray-100">
                    <span class="wr-stat-label">สรุป AI</span>
                    <span class="text-xs font-semibold wr-ready-badge px-2 py-1 rounded-full">พร้อม</span>
                </div>
            </div>`;
        }

        return '';
    },

    _statRow(label, value, highlight) {
        return `<div class="wr-stat-row">
            <span class="wr-stat-label">${label}</span>
            <span class="wr-stat-value${highlight ? ' blue' : ''}">${value}</span>
        </div>`;
    },

    _renderReportPreview() {
        const d = this.state.reportPreviewData;
        if (!d) return '<p class="wr-muted-text">No preview data</p>';

        const kpiItems = [
            { label: 'Projects Participated', labelTh: 'โครงการที่เข้าร่วม', value: d.stats.projectsJoined },
            { label: 'Tasks Assigned', labelTh: 'งานที่ได้รับ', value: d.stats.tasksAssigned },
            { label: 'Tasks Completed', labelTh: 'งานเสร็จ', value: d.stats.completedTasks },
            { label: 'Completion Rate', labelTh: 'อัตราสำเร็จ', value: d.stats.completionRate + '%' },
            { label: 'Meetings', labelTh: 'การประชุม', value: d.stats.meetings },
            { label: 'Documents Submitted', labelTh: 'เอกสารที่ส่ง', value: d.stats.documents }
        ];

        const tableRows = d.projectSummaries.map(p => `<tr>
            <td><span class="project-name-display">${p.name}</span></td>
            <td>${p.myCompletion}%
                <div class="wr-progress-bar"><div class="wr-progress-fill" style="width:${p.myCompletion}%"></div></div>
            </td>
            <td>${p.projectProgress}%
                <div class="wr-progress-bar"><div class="wr-progress-fill" style="width:${p.projectProgress}%"></div></div>
            </td>
        </tr>`).join('');

        return `
            <div class="wr-section-title">ตัวอย่างรายงาน</div>

            <div class="wr-preview-section">
                <h3>ข้อมูลพนักงาน</h3>
                <div class="wr-employee-grid">
                    <div class="wr-info-field"><label>ชื่อพนักงาน</label><span>${d.employee.name}</span></div>
                    <div class="wr-info-field"><label>แผนก</label><span>${d.employee.department}</span></div>
                    <div class="wr-info-field"><label>ช่วงเวลา</label><span>${d.period}</span></div>
                </div>
            </div>

            <div class="wr-preview-section">
                <h3>ภาพรวม KPI</h3>
                <div class="wr-kpi-grid">${kpiItems.map(k =>
                    `<div class="wr-kpi-card"><div class="wr-kpi-value">${k.value}</div><div class="wr-kpi-label">${k.labelTh}</div></div>`
                ).join('')}</div>
            </div>

            <div class="wr-preview-section">
                <h3>สรุปโครงการ</h3>
                <div class="wr-table-wrap">
                    <table class="wr-table">
                        <thead><tr><th>ชื่อโครงการ</th><th>ความสำเร็จของฉัน</th><th>ความคืบหน้าโครงการ</th></tr></thead>
                        <tbody>${tableRows || '<tr><td colspan="3" class="wr-muted-text text-center">ไม่มีข้อมูลโครงการ</td></tr>'}</tbody>
                    </table>
                </div>
            </div>

            <div class="wr-preview-section">
                <div class="wr-ai-card">
                    <div class="wr-ai-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> สรุปโดย AI</div>
                    <p class="wr-ai-text">${d.aiSummary.text.replace(/\n/g, '<br>')}</p>
                </div>
            </div>

            ${this._renderExportSelector()}`;
    },

    _renderExportSelector() {
        const fmt = this.state.exportFormat;
        return `<div class="wr-preview-section">
            <h3>รูปแบบไฟล์</h3>
            <div class="wr-export-options">
                <label class="wr-export-option ${fmt === 'pdf' ? 'selected' : ''}" onclick="WorkReport.selectExportFormat('pdf')">
                    <input type="radio" name="export-fmt" value="pdf" ${fmt === 'pdf' ? 'checked' : ''}>
                    <i class="fa-solid fa-file-pdf wr-export-icon"></i>
                    <div><div class="font-semibold text-sm">PDF</div><div class="text-xs wr-muted-text">เอกสารที่ส่งออก</div></div>
                </label>
                <label class="wr-export-option ${fmt === 'docx' ? 'selected' : ''}" onclick="WorkReport.selectExportFormat('docx')">
                    <input type="radio" name="export-fmt" value="docx" ${fmt === 'docx' ? 'checked' : ''}>
                    <i class="fa-solid fa-file-word wr-export-icon"></i>
                    <div><div class="font-semibold text-sm">Microsoft Word (.docx)</div><div class="text-xs wr-muted-text">เอกสารที่แก้ไขได้</div></div>
                </label>
                <label class="wr-export-option ${fmt === 'excel' ? 'selected' : ''}" onclick="WorkReport.selectExportFormat('excel')">
                    <input type="radio" name="export-fmt" value="excel" ${fmt === 'excel' ? 'checked' : ''}>
                    <i class="fa-solid fa-file-excel wr-export-icon" style="color: #107c41;"></i>
                    <div><div class="font-semibold text-sm">Microsoft Excel (.xlsx)</div><div class="text-xs wr-muted-text">เอกสารสเปรดชีต</div></div>
                </label>
            </div>
        </div>`;
    },

    _renderNavButtons() {
        const step = this.state.currentStep;

        if (step === 1) {
            return `<div class="wr-nav-bar">
                <button class="wr-btn wr-btn-secondary" disabled><i class="fa-solid fa-arrow-left"></i> ย้อนกลับ</button>
                <button class="wr-btn wr-btn-primary" onclick="WorkReport.nextStep()">ถัดไป <i class="fa-solid fa-arrow-right"></i></button>
            </div>`;
        }

        if (step === 2) {
            return `<div class="wr-nav-bar">
                <button class="wr-btn wr-btn-secondary" onclick="WorkReport.prevStep()"><i class="fa-solid fa-arrow-left"></i> ย้อนกลับ</button>
                <button class="wr-btn wr-btn-primary" onclick="WorkReport.generatePreview()"><i class="fa-solid fa-eye"></i> สร้างตัวอย่างรายงาน</button>
            </div>`;
        }

        return `<div class="wr-nav-bar">
            <button class="wr-btn wr-btn-secondary" onclick="WorkReport.prevStep()"><i class="fa-solid fa-arrow-left"></i> ย้อนกลับ</button>
            <button class="wr-btn wr-btn-success" onclick="WorkReport.generateReport()"><i class="fa-solid fa-file-export"></i> ดาวน์โหลดรายงาน</button>
        </div>`;
    },

    _renderStepContent() {
        const step = this.state.currentStep;
        if (step === 1) return this._renderPeriodSelector();
        if (step === 2) return this._renderReportTypeSelector();
        return this._renderReportPreview();
    },

    /* ── Main Render ── */
    render() {
        const root = document.getElementById('view-work-report');
        if (!root) return;

        const step = this.state.currentStep;
        const loading = this.state.isLoading
            ? `<div class="wr-loading-overlay"><div class="wr-spinner"></div><div class="wr-loading-text">${step === 2 ? 'กำลังสร้างตัวอย่างรายงาน...' : 'กำลังสร้างไฟล์รายงาน...'}</div></div>`
            : '';

        root.innerHTML = `
            <div class="wr-page relative">
                ${loading}
                <div class="wr-page-header">
                    <h1>สร้างรายงานการทำงาน</h1>
                    <p>สร้างรายงานจากกิจกรรมโครงการที่คุณรับผิดชอบ</p>
                </div>

                <div class="wr-wizard">${this._renderStepWizard()}</div>

                <div class="wr-body">
                    <div class="wr-main">
                        <div class="wr-content">
                            <div id="wr-step-content" class="wr-step-panel">${this._renderStepContent()}</div>
                        </div>
                        ${this._renderNavButtons()}
                    </div>
                    ${step < 3 ? `<aside class="wr-sidebar">${this._renderSummarySidebar(step)}</aside>` : ''}
                </div>
            </div>`;
    },

    init() {
        this.state.currentStep = 1;
        this.state.selectedPeriod = 'this-month';
        this.state.selectedReportType = 'progress';
        this.state.startDate = '';
        this.state.endDate = '';
        this.state.exportFormat = 'pdf';
        this.state.reportPreviewData = null;
        this.state.isLoading = false;
        this.render();
    }
};
