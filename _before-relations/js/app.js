const App = {
    /** @type {Record<string, any>} */
    state: {
        currentUser: null,
        currentView: 'dashboard',
        currentProject: null,
        currentChat: 'note',
        chatFilter: 'all',
        chatSearchQuery: '',
        supervisorTaskFilter: 'assign',
        calendarFilter: 'all',
        editingTaskId: null,
        ctRelatedUsers: [],
        creatingTaskSectionId: null,
        teamFilterCard: 'all', // all, online, offline
        teamSearchQuery: '',
        teamFilterDept: '',
        teamFilterRole: '',
        teamFilterStatus: '',
        teamViewMode: 'grid',
        showNotificationDropdown: false,
        workspaces: [],
        members: []
    },

    async init() {
        this._loadSettings();
        this._initMobileSidebar();
        this.checkAuth();
        await this._loadData();
        this.bindEvents();
        this._initRichTextEditor();
        this.renderNotifications();
        this.initRoleSettingsDragDrop();
        this.checkProfileLinkHash();
    },

    initRoleSettingsDragDrop() {
        this.loadRoleSettings();
        this._setupDraggableList('position-list-container', '.position-item');
        this._setupDraggableList('dept-list-container', '.dept-item');
    },

    _setupDraggableList(containerId, itemSelector) {
        const container = document.getElementById(containerId);
        if (!container) return;

        let draggedItem = null;

        container.addEventListener('dragstart', (e) => {
            const item = e.target.closest(itemSelector);
            if (!item) return;
            draggedItem = item;
            // Add slight opacity to the original dragged item
            setTimeout(() => item.classList.add('opacity-50', 'ring-2', 'ring-blue-400'), 0);
        });

        container.addEventListener('dragend', (e) => {
            const item = e.target.closest(itemSelector);
            if (!item) return;
            draggedItem = null;
            item.classList.remove('opacity-50', 'ring-2', 'ring-blue-400');
            App.saveRoleSettings();
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessary to allow dropping
            const item = e.target.closest(itemSelector);
            if (!item || item === draggedItem) return;

            const rect = item.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;

            if (e.clientY < midpoint) {
                container.insertBefore(draggedItem, item);
            } else {
                container.insertBefore(draggedItem, item.nextSibling);
            }
        });
    },

    addRolePosition() {
        const input = document.getElementById('new-position-input');
        if (!input || !input.value.trim()) return;

        const container = document.getElementById('position-list-container');
        if (!container) return;

        const posName = input.value.trim();

        // Prevent duplicate
        const existingSpans = Array.from(container.querySelectorAll('.position-item span')).map(s => s.textContent.trim());
        if (existingSpans.includes(posName)) {
            if (typeof App._showToast === 'function') App._showToast('ตำแหน่งนี้มีอยู่แล้ว', 'error');
            else alert('ตำแหน่งนี้มีอยู่แล้ว');
            return;
        }

        // Random color for the dot
        const colors = ['bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-yellow-500', 'bg-rose-500', 'bg-sky-500'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const div = document.createElement('div');
        div.draggable = true;
        div.className = "position-item flex items-center justify-between p-2.5 bg-white border border-gray-200 shadow-sm rounded-lg group cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors";
        div.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full ${randomColor}"></div>
                <span class="text-sm font-medium text-gray-700 pointer-events-none">${posName}</span>
            </div>
            <div class="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" class="text-red-400 hover:text-red-600 transition-colors" onclick="App.deleteRolePosition(this)"><i class="fa-regular fa-trash-can"></i></button>
                <i class="fa-solid fa-grip-vertical text-gray-300"></i>
            </div>
        `;

        container.appendChild(div); // Add to bottom

        // Update count
        const countEl = document.getElementById('position-total-count');
        if (countEl) {
            const count = container.querySelectorAll('.position-item').length;
            const isEn = App.settings?.language === 'en';
            countEl.textContent = isEn ? `Total ${count} positions` : `รวม ${count} ตำแหน่ง`;
        }

        input.value = '';
        App.saveRoleSettings();
    },

    deleteRolePosition(btn) {
        const item = btn.closest('.position-item');
        if (!item) return;

        const container = document.getElementById('position-list-container');
        item.remove();

        // Update count
        const countEl = document.getElementById('position-total-count');
        if (countEl && container) {
            const count = container.querySelectorAll('.position-item').length;
            const isEn = App.settings?.language === 'en';
            countEl.textContent = isEn ? `Total ${count} positions` : `รวม ${count} ตำแหน่ง`;
        }
        App.saveRoleSettings();
    },

    addRoleDepartment() {
        const input = document.getElementById('new-dept-input');
        if (!input || !input.value.trim()) return;

        const container = document.getElementById('dept-list-container');
        if (!container) return;

        const deptName = input.value.trim();

        // Prevent duplicate
        const existingSpans = Array.from(container.querySelectorAll('.dept-item span')).map(s => s.textContent.trim());
        if (existingSpans.includes(deptName)) {
            if (typeof App._showToast === 'function') App._showToast('แผนกนี้มีอยู่แล้ว', 'error');
            else alert('แผนกนี้มีอยู่แล้ว');
            return;
        }

        // Random style for the icon box
        const styles = [
            { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'fa-brands fa-figma' },
            { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'fa-solid fa-code' },
            { bg: 'bg-green-100', text: 'text-green-600', icon: 'fa-solid fa-bullhorn' },
            { bg: 'bg-orange-100', text: 'text-orange-600', icon: 'fa-solid fa-chart-line' },
            { bg: 'bg-pink-100', text: 'text-pink-600', icon: 'fa-solid fa-users' },
            { bg: 'bg-yellow-100', text: 'text-yellow-600', icon: 'fa-solid fa-calculator' }
        ];
        const s = styles[Math.floor(Math.random() * styles.length)];

        const div = document.createElement('div');
        div.draggable = true;
        div.className = "dept-item flex items-center justify-between p-2.5 bg-white border border-gray-200 shadow-sm rounded-lg group cursor-grab active:cursor-grabbing hover:border-gray-300 transition-colors";
        div.innerHTML = `
            <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded ${s.bg} ${s.text} flex items-center justify-center text-[10px] shrink-0"><i class="${s.icon}"></i></div>
                <span class="text-sm font-medium text-gray-700 pointer-events-none truncate">${deptName}</span>
            </div>
            <div class="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" class="text-red-400 hover:text-red-600 transition-colors" onclick="App.deleteRoleDepartment(this)"><i class="fa-regular fa-trash-can"></i></button>
                <i class="fa-solid fa-grip-vertical text-gray-300"></i>
            </div>
        `;

        container.appendChild(div); // Add to bottom

        // Update count
        const countEl = document.getElementById('dept-total-count');
        if (countEl) {
            const count = container.querySelectorAll('.dept-item').length;
            const isEn = App.settings?.language === 'en';
            countEl.textContent = isEn ? `Total ${count} departments` : `รวม ${count} แผนก`;
        }

        input.value = '';
        App.saveRoleSettings();
    },

    deleteRoleDepartment(btn) {
        const item = btn.closest('.dept-item');
        if (!item) return;

        const container = document.getElementById('dept-list-container');
        item.remove();

        // Update count
        const countEl = document.getElementById('dept-total-count');
        if (countEl && container) {
            const count = container.querySelectorAll('.dept-item').length;
            const isEn = App.settings?.language === 'en';
            countEl.textContent = isEn ? `Total ${count} departments` : `รวม ${count} แผนก`;
        }
        App.saveRoleSettings();
    },

    updateRoleDropdown() {
        const select = document.getElementById('role-filter-select');
        const container = document.getElementById('position-list-container');
        if (!select || !container) return;

        const currentVal = select.value;

        select.innerHTML = '<option value="all">ทั้งหมด</option>';

        const positions = container.querySelectorAll('.position-item span');
        positions.forEach(span => {
            const name = span.textContent.trim();
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });

        if (Array.from(select.options).some(opt => opt.value === currentVal)) {
            select.value = currentVal;
        } else {
            select.value = 'all';
        }

        this.filterRoleColumns();
    },

    filterRoleColumns() {
        const select = document.getElementById('role-filter-select');
        const table = document.getElementById('permissions-table');
        if (!select || !table) return;

        const selectedRole = select.value;
        const theadTr = table.querySelector('thead tr');
        const ths = theadTr.querySelectorAll('th');

        const showIndices = new Set();
        showIndices.add(0); // Always show the first column (ฟีเจอร์ / สิทธิ์)

        ths.forEach((th, index) => {
            if (index === 0) return;
            const roleName = th.textContent.trim();
            if (selectedRole === 'all' || roleName === selectedRole) {
                showIndices.add(index);
                th.style.display = '';
            } else {
                th.style.display = 'none';
            }
        });

        const tbodyTrs = table.querySelectorAll('tbody tr');
        tbodyTrs.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            tds.forEach((td, index) => {
                if (showIndices.has(index)) {
                    td.style.display = '';
                } else {
                    td.style.display = 'none';
                }
            });
        });
    },

    syncPermissionsTable() {
        const table = document.getElementById('permissions-table');
        const posContainer = document.getElementById('position-list-container');
        if (!table || !posContainer) return;

        const positions = Array.from(posContainer.querySelectorAll('.position-item span')).map(s => s.textContent.trim());

        const theadTr = table.querySelector('thead tr');
        if (!theadTr) return;
        const firstTh = theadTr.querySelector('th');
        theadTr.innerHTML = '';
        if (firstTh) theadTr.appendChild(firstTh);

        positions.forEach(pos => {
            const th = document.createElement('th');
            if (pos === 'Admin') {
                th.className = 'py-3 px-2 font-bold text-center w-20 text-blue-600 bg-blue-50/50 rounded-t-lg border-b-2 border-blue-500';
            } else {
                th.className = 'py-3 px-2 font-medium text-center w-20';
            }
            th.textContent = pos;
            theadTr.appendChild(th);
        });

        const tbodyTrs = table.querySelectorAll('tbody tr');
        tbodyTrs.forEach((tr, rowIndex) => {
            const firstTd = tr.querySelector('td');
            tr.innerHTML = '';
            if (firstTd) tr.appendChild(firstTd);

            const featureName = tr.getAttribute('data-feature');
            const isSection = tr.hasAttribute('data-section');

            positions.forEach(pos => {
                const td = document.createElement('td');
                if (isSection) {
                    if (pos === 'Admin') {
                        td.className = rowIndex === tbodyTrs.length - 1 
                            ? 'bg-blue-50/30 rounded-b-lg'
                            : 'bg-blue-50/30';
                    }
                } else if (featureName) {
                    td.className = 'text-center' + (pos === 'Admin' ? (rowIndex === tbodyTrs.length - 1 
                        ? ' bg-blue-50/30 rounded-b-lg'
                        : ' bg-blue-50/30') : '');
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer';
                    cb.setAttribute('data-role', pos);

                    if (this.permissionsState && this.permissionsState[featureName] && this.permissionsState[featureName][pos]) {
                        cb.checked = true;
                    }
                    td.appendChild(cb);
                }
                tr.appendChild(td);
            });
        });

        this.filterRoleColumns();
    },

    saveRoleSettings(showNotification = false) {
        const posContainer = document.getElementById('position-list-container');
        const deptContainer = document.getElementById('dept-list-container');

        const revertToOriginal = (container) => {
            if (!container) return;
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node._originalTh !== undefined) {
                    node._tempCurrent = node.nodeValue;
                    node.nodeValue = node._originalTh;
                }
            }
        };

        const restoreCurrent = (container) => {
            if (!container) return;
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walker.nextNode()) {
                if (node._tempCurrent !== undefined) {
                    node.nodeValue = node._tempCurrent;
                    delete node._tempCurrent;
                }
            }
        };

        revertToOriginal(posContainer);
        revertToOriginal(deptContainer);

        let posHtml = '';
        if (posContainer) posHtml = posContainer.innerHTML;

        let deptHtml = '';
        if (deptContainer) deptHtml = deptContainer.innerHTML;

        restoreCurrent(posContainer);
        restoreCurrent(deptContainer);

        const permissionData = {};
        const table = document.getElementById('permissions-table');
        if (table) {
            const rows = table.querySelectorAll('tbody tr[data-feature]');
            rows.forEach(row => {
                const featureName = row.getAttribute('data-feature');
                if (featureName) {
                    permissionData[featureName] = {};
                    const checkboxes = row.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => {
                        const role = cb.getAttribute('data-role');
                        if (role) {
                            permissionData[featureName][role] = cb.checked;
                        }
                    });
                }
            });
        }

        this.permissionsState = permissionData;

        const data = {
            positionsHtml: posHtml,
            deptHtml: deptHtml,
            permissionsState: this.permissionsState
        };
        localStorage.setItem('conwork_role_settings', JSON.stringify(data));

        if (showNotification) {
            if (typeof this._showToast === 'function') {
                this._showToast('บันทึกสำเร็จ', 'success');
            } else {
                alert('บันทึกสำเร็จ');
            }
        }
        this.syncPermissionsTable();
        this.updateRoleDropdown();
    },

    loadRoleSettings() {
        const data = localStorage.getItem('conwork_role_settings');
        if (!data) return;
        try {
            const parsed = JSON.parse(data);
            const posContainer = document.getElementById('position-list-container');
            const deptContainer = document.getElementById('dept-list-container');

            let posHtml = parsed.positionsHtml;
            let deptHtml = parsed.deptHtml;

            // One-time cleanup to fix previously saved English strings in cache
            const en2th = {
                "Design Team": "ทีมออกแบบ",
                "Design": "ออกแบบ",
                "System Development": "พัฒนาระบบ",
                "Development": "พัฒนาระบบ",
                "Marketing": "การตลาด",
                "Sales": "ฝ่ายขาย",
                "HR": "ฝ่ายบุคคล",
                "Accounting": "บัญชี",
                "Chief Executive Officer": "ผู้บริหาร",
                "CEO": "ผู้บริหาร",
                "Admin": "ผู้ดูแลระบบ",
                "Manager": "หัวหน้า",
                "Employee": "พนักงาน",
                "Full-time Employee Executive": "พนักงานประจำ ผู้บริหาร",
                "Full-time Employee Design": "พนักงานประจำ ออกแบบ",
                "Full-time Employee Marketing": "พนักงานประจำ การตลาด",
                "Department Manager System Development": "ผู้จัดการแผนก พัฒนาระบบ",
                "Department Manager": "ผู้จัดการแผนก",
                "Full-time Employee": "พนักงานประจำ"
            };

            const sortedEntries = Object.entries(en2th).sort((a, b) => b[0].length - a[0].length);

            for (const [en, th] of sortedEntries) {
                if (posHtml) posHtml = posHtml.split(en).join(th);
                if (deptHtml) deptHtml = deptHtml.split(en).join(th);
            }

            // Remove duplicates that might have been created by merging different English terms into the same Thai term
            const cleanDuplicates = (htmlString, itemSelector) => {
                if (!htmlString) return htmlString;
                const doc = new DOMParser().parseFromString(htmlString, 'text/html');
                const items = doc.body.querySelectorAll(itemSelector);
                const seen = new Set();
                items.forEach(item => {
                    const span = item.querySelector('span');
                    if (span) {
                        const name = span.textContent.trim();
                        if (seen.has(name)) {
                            item.remove();
                        } else {
                            seen.add(name);
                        }
                    }
                });
                return doc.body.innerHTML;
            };

            posHtml = cleanDuplicates(posHtml, '.position-item');
            deptHtml = cleanDuplicates(deptHtml, '.dept-item');

            /* the six sample departments that used to come with the app: drop them when the saved list is still exactly those, untouched */
            if (deptHtml) {
                const sample = ['ทีมออกแบบ', 'พัฒนาระบบ', 'การตลาด', 'ฝ่ายขาย', 'ฝ่ายบุคคล', 'บัญชี'];
                const names = [...new DOMParser().parseFromString(deptHtml, 'text/html').querySelectorAll('.dept-item span')].map(s => s.textContent.trim());
                if (names.length === sample.length && sample.every(n => names.includes(n))) {
                    deptHtml = '';
                    if (deptContainer) deptContainer.innerHTML = '';
                    try { localStorage.setItem('conwork_role_settings', JSON.stringify(Object.assign({}, parsed, { deptHtml: '' }))); } catch (e) { }
                }
            }

            if (posContainer && posHtml) {
                posContainer.innerHTML = posHtml;
                // update count
                const countEl = document.getElementById('position-total-count');
                if (countEl) {
                    const count = posContainer.querySelectorAll('.position-item').length;
                    const isEn = this.settings?.language === 'en';
                    countEl.textContent = isEn ? `Total ${count} positions` : `รวม ${count} ตำแหน่ง`;
                }
            }
            if (deptContainer && deptHtml) {
                deptContainer.innerHTML = deptHtml;
                // update count
                const countEl = document.getElementById('dept-total-count');
                if (countEl) {
                    const count = deptContainer.querySelectorAll('.dept-item').length;
                    const isEn = this.settings?.language === 'en';
                    countEl.textContent = isEn ? `Total ${count} departments` : `รวม ${count} แผนก`;
                }
            }
            if (parsed.permissionsState) {
                this.permissionsState = parsed.permissionsState;
            } else {
                this.permissionsState = {};
            }
            this.syncPermissionsTable();
            this.updateRoleDropdown();
        } catch (e) {
            console.error('Failed to load role settings', e);
        }
    },

    _loadSettings() {
        try {
            const saved = localStorage.getItem('conwork_user_settings');
            if (saved) {
                this.settings = JSON.parse(saved);
                if (!this.settings.fontSize) this.settings.fontSize = 'medium';
            } else {
                this.settings = {
                    language: 'th',
                    darkMode: false,
                    appNotifications: true,
                    emailNotifications: false,
                    fontSize: 'medium'
                };
            }
        } catch (e) {
            this.settings = { language: 'th', darkMode: false, appNotifications: true, emailNotifications: false, fontSize: 'medium' };
        }
        this._applySettings();
    },

    _saveSettings() {
        try {
            localStorage.setItem('conwork_user_settings', JSON.stringify(this.settings));
        } catch (e) { }
        this._applySettings();
    },

    _applySettings() {
        if (this.settings.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }

        const darkToggle = document.getElementById('setting-dark-mode');
        if (darkToggle) darkToggle.checked = this.settings.darkMode;

        const langSelect = document.getElementById('setting-language');
        if (langSelect) langSelect.value = this.settings.language;

        const appNotif = document.getElementById('setting-app-notif');
        if (appNotif) appNotif.checked = this.settings.appNotifications;

        const emailNotif = document.getElementById('setting-email-notif');
        if (emailNotif) emailNotif.checked = this.settings.emailNotifications;

        const profileLangText = document.getElementById('profile-lang-text');
        if (profileLangText) profileLangText.innerText = this.settings.language === 'en' ? 'English' : 'ไทย';

        const profileThemeText = document.getElementById('profile-theme-text');
        if (profileThemeText) profileThemeText.innerText = this.settings.darkMode ? 'มืด' : 'สว่าง';

        // Font size application
        const zoomMap = {
            'small': '0.9',
            'medium': '1',
            'large': '1.1'
        };
        const zoomLevel = zoomMap[this.settings.fontSize || 'medium'];
        document.body.style.zoom = zoomLevel;
        document.documentElement.style.fontSize = '16px'; // Reset base to prevent double scaling

        // Fix sidebar/layout bug: Adjust height to counteract zoom scaling on vh units
        document.body.style.height = `${100 / parseFloat(zoomLevel)}vh`;

        // Font size button active states
        const btnSmall = document.getElementById('btn-font-small');
        const btnMedium = document.getElementById('btn-font-medium');
        const btnLarge = document.getElementById('btn-font-large');

        const setActive = (btn, isActive) => {
            if (!btn) return;
            if (isActive) {
                btn.className = "px-3 py-1 text-xs font-medium rounded-md bg-white shadow-sm text-gray-800 transition-all";
            } else {
                btn.className = "px-3 py-1 text-xs font-medium rounded-md hover:bg-white hover:shadow-sm text-gray-500 transition-all";
            }
        };

        setActive(btnSmall, this.settings.fontSize === 'small');
        setActive(btnMedium, this.settings.fontSize === 'medium' || !this.settings.fontSize);
        setActive(btnLarge, this.settings.fontSize === 'large');
    },

    _saveData() {
        try {
            const wid = this.state.currentUser && this.state.currentUser.workspaceId ? this.state.currentUser.workspaceId : 'W-1';
            // Only save non-database data like notifications or local messages if needed.
            // Core data (Projects, Tasks, Events, etc.) are now strictly managed by Supabase.
            localStorage.setItem(`conwork_notifications_${wid}`, JSON.stringify(mockNotifications));
        } catch (e) {
            console.warn('Cannot save to localStorage:', e);
        }
    },

    async _syncSubtasksToDB(taskId, subtasks) {
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !String(taskId).startsWith('mock_')) {
            try {
                await window.conworkSupabase.client.from('tasks').update({
                    subtasks: subtasks || []
                }).eq('id', taskId);
            } catch(e) { console.error('Error syncing subtasks', e); }
        }
    },

    /* reviewers' approvals and the other extra task fields live in tasks.details */
    async _syncTaskDetailsToDB(task) {
        if (!task || !window.conworkSupabase || !window.conworkSupabase.isAvailable() || String(task.id).startsWith('mock_')) return;
        try {
            await this._sbSaveSkippingMissing({ details: this._taskDetailsForDb(task) },
                d => Object.keys(d).length ? window.conworkSupabase.client.from('tasks').update(d).eq('id', task.id) : Promise.resolve({}));
        } catch (e) { console.error('Error syncing task details', e); }
    },

    async _syncTaskStatusToDB(taskId, status) {
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !String(taskId).startsWith('mock_')) {
            try {
                const dbStatus = status === 'in-progress' ? 'in_progress' : (status === 'pending-review' ? 'in_review' : status);
                /* a task that is done gets its completion time (kept in details too, for databases without the column) */
                const task = mockTasks.find(t => String(t.id) === String(taskId));
                if (task) task.completedAt = status === 'done' ? (task.completedAt || new Date().toISOString()) : null;
                const upd = { status: dbStatus, completed_at: task ? task.completedAt : null };
                if (task) upd.details = this._taskDetailsForDb(task);
                await this._sbSaveSkippingMissing(upd, d => window.conworkSupabase.client.from('tasks').update(d).eq('id', taskId));
            } catch(e) { console.error('Error syncing status', e); }
        }
    },

    async _loadData() {
        if (this._isLoadingData) {
            this._pendingLoadData = true;
            return;
        }
        this._isLoadingData = true;
        try {
            const wid = this.state.currentUser && this.state.currentUser.workspaceId ? this.state.currentUser.workspaceId : 'W-1';

            // --- Real Data from Supabase (Companies & Members) ---
            if (window.conworkSupabase && window.conworkSupabase.isAvailable() && this.state.currentUser) {
                try {
                    // Fetch user's company memberships
                    const { data: membersData, error: memErr } = await window.conworkSupabase.client
                        .from('company_members')
                        .select('*')
                        .eq('user_id', this.state.currentUser.id);
                    
                    if (memErr) console.error("Error loading members:", memErr);

                    this.state.members = (membersData || []).map(m => ({
                        id: m.id,
                        workspace_id: m.company_id,
                        user_id: m.user_id,
                        role: m.company_role === 'company_admin' || m.company_role === 'super_admin' ? 'admin' : 'worker',
                        joined_at: m.joined_at
                    }));

                    if (this.state.members.length > 0) {
                        // Only the team chosen on the Team page (team.html → Enter); before, every team the user was in got mixed together
                        const chosenTeam = this.state.currentUser && this.state.currentUser.workspaceId;
                        const allTeamIds = this.state.members.map(m => m.workspace_id);
                        const companyIds = chosenTeam && allTeamIds.some(id => String(id) === String(chosenTeam)) ? [chosenTeam] : allTeamIds.slice(0, 1);
                        
                        // Fetch companies
                        const { data: companiesData, error: compErr } = await window.conworkSupabase.client
                            .from('companies')
                            .select('*')
                            .in('id', companyIds);
                            
                        if (compErr) console.error("Error loading companies:", compErr);

                        this.state.workspaces = (companiesData || []).map(c => ({
                            workspace_id: c.id,
                            name: c.name,
                            code: c.code,
                            type: c.is_personal ? 'personal' : 'corporate',
                            domain: c.domain,
                            logo: c.logo_url,
                            created_by: c.created_by
                        }));

                        // --- FETCH PROFILES (mockUsers) ---
                        const { data: teamMembersData } = await window.conworkSupabase.client
                            .from('company_members')
                            .select('user_id, company_role, department')
                            .in('company_id', companyIds);
                        
                        if (teamMembersData && teamMembersData.length > 0) {
                            const userIds = [...new Set(teamMembersData.map(m => m.user_id))];
                            const { data: profilesData } = await window.conworkSupabase.client
                                .from('profiles')
                                .select('*')
                                .in('id', userIds);
                            
                            const profileMap = new Map();
                            if (profilesData) {
                                profilesData.forEach(p => profileMap.set(p.id, p));
                            }

                            mockUsers.length = 0; // Clear mock
                            userIds.forEach(uid => {
                                const p = profileMap.get(uid);
                                const memberObj = teamMembersData.find(m => m.user_id === uid);
                                const mRole = memberObj?.company_role;
                                
                                // Check if user is company creator or first user registered in company
                                const isCompanyCreator = (companiesData || []).some(c => String(c.created_by) === String(uid));
                                const isFirstUserInCompany = teamMembersData.length > 0 && String(teamMembersData[0].user_id) === String(uid);
                                
                                const defaultDept = (isCompanyCreator || isFirstUserInCompany) ? 'บริหาร' : 'พนักงานทั่วไป';
                                const mDept = memberObj?.department || p?.department || defaultDept;
                                
                                const isCurrentUser = this.state.currentUser && String(uid) === String(this.state.currentUser.id);
                                const defaultName = isCurrentUser ? (this.state.currentUser.name || this.state.currentUser.username) : `พนักงาน (${uid.substring(0, 5)})`;
                                const defaultEmail = isCurrentUser ? this.state.currentUser.email : '';
                                const name = (p && p.full_name) ? p.full_name : (isCurrentUser && this.state.currentUser?.name ? this.state.currentUser.name : defaultName);
                                const email = (p && p.email) ? p.email : defaultEmail;
                                const avatar = (p && p.avatar_url) ? p.avatar_url : (isCurrentUser && this.state.currentUser?.avatar ? this.state.currentUser.avatar : null);

                                let mappedRole = 'worker';
                                if (mRole === 'reviewer2' || mRole === 'ceo') {
                                    mappedRole = 'reviewer2';
                                } else if (mRole === 'reviewer1' || mRole === 'manager') {
                                    mappedRole = 'reviewer1';
                                } else if (mRole === 'admin' || mRole === 'company_admin' || mRole === 'super_admin') {
                                    mappedRole = 'admin';
                                } else if (mRole === 'worker' || mRole === 'employee') {
                                    mappedRole = 'worker';
                                } else if (isCompanyCreator || isFirstUserInCompany) {
                                    mappedRole = 'admin';
                                }

                                const jobTitle = p?.job_title || (mappedRole === 'reviewer2' ? 'ประธานเจ้าหน้าที่บริหาร' : (mappedRole === 'admin' ? 'แอดมิน' : (mappedRole === 'reviewer1' ? 'หัวหน้า' : 'พนักงาน')));

                                mockUsers.push({
                                    id: uid,
                                    email: email || `${uid.substring(0, 8)}@company.com`,
                                    username: name,
                                    name: name,
                                    role: mappedRole,
                                    jobTitle: jobTitle,
                                    department: mDept,
                                    avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                                    status: 'online'
                                });

                                if (isCurrentUser) {
                                    this.state.currentUser.name = name;
                                    this.state.currentUser.avatar = avatar || this.state.currentUser.avatar;
                                    this.state.currentUser.department = mDept;
                                    this.state.currentUser.role = mappedRole;
                                    this.state.currentUser.jobTitle = jobTitle;
                                }
                            });
                            /* names: the Thai name from ข้อมูลส่วนตัว (same as the Team page) wherever it has been filled in */
                            if (window.PersonalInfo) {
                                try {
                                    const infos = await window.PersonalInfo.loadMany(userIds);
                                    const mineInfo = this.state.currentUser ? await window.PersonalInfo.load(this.state.currentUser.id) : null;
                                    if (mineInfo && this.state.currentUser) infos[String(this.state.currentUser.id)] = mineInfo;
                                    mockUsers.forEach(u => {
                                        const x = infos[String(u.id)];
                                        const th = x ? [x.first_name_th, x.last_name_th].filter(Boolean).join(' ').trim() : '';
                                        if (!th) return;
                                        u.name = th; u.username = th;
                                        if (/ui-avatars\.com/.test(u.avatar || '')) u.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(th)}&background=random`;
                                        if (this.state.currentUser && String(u.id) === String(this.state.currentUser.id)) this.state.currentUser.name = th;
                                    });
                                } catch (e) { console.warn('[App] personal info names', e); }
                            }
                            this.updateProfile();
                            await this.loadUserChats();
                        }

                        // --- REALTIME SUBSCRIPTION FOR COMPANY DATA ---
                        const activeCompanyId = companyIds[0];
                        if (activeCompanyId && (!this.companyRealtimeSub || this.companyRealtimeCompId !== activeCompanyId)) {
                            if (this.companyRealtimeSub) {
                                window.conworkSupabase.client.removeChannel(this.companyRealtimeSub);
                            }
                            this.companyRealtimeCompId = activeCompanyId;
                            this.companyRealtimeSub = window.conworkSupabase.client
                                .channel(`company_realtime_${activeCompanyId}`)
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'company_members' }, () => {
                                    console.log('⚡ Realtime Update: company_members changed');
                                    this._loadData().then(() => {
                                        if (typeof this.renderTeam === 'function') this.renderTeam();
                                        if (typeof this.renderProjects === 'function') this.renderProjects();
                                    });
                                })
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                                    console.log('⚡ Realtime Update: profiles changed');
                                    this._loadData().then(() => {
                                        if (typeof this.renderTeam === 'function') this.renderTeam();
                                        if (typeof this.updateProfile === 'function') this.updateProfile();
                                        if (typeof this.renderChatList === 'function') this.renderChatList();
                                    });
                                })
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
                                    console.log('⚡ Realtime Update: projects changed');
                                    this._loadData().then(() => {
                                        if (typeof this.renderProjects === 'function') this.renderProjects();
                                    });
                                })
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'project_members' }, () => {
                                    console.log('⚡ Realtime Update: project_members changed');
                                    this._loadData().then(() => {
                                        if (typeof this.renderProjects === 'function') this.renderProjects();
                                        if (typeof this.renderTasks === 'function') this.renderTasks();
                                    });
                                })
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                                    console.log('⚡ Realtime Update: tasks changed');
                                    this._loadData().then(() => {
                                        if (typeof this.renderTasks === 'function') this.renderTasks();
                                        if (typeof this.renderProjects === 'function') this.renderProjects();
                                    });
                                })
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'task_sections' }, () => {
                                    console.log('⚡ Realtime Update: task_sections changed');
                                    this._loadData().then(() => {
                                        if (typeof this.renderTasks === 'function') this.renderTasks();
                                        if (typeof this.renderProjects === 'function') this.renderProjects();
                                    });
                                })
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, () => {
                                    console.log('⚡ Realtime Update: task_assignees changed');
                                    this._loadData().then(() => {
                                        if (typeof this.renderTasks === 'function') this.renderTasks();
                                        if (typeof this.renderProjects === 'function') this.renderProjects();
                                    });
                                })
                                .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                                    console.log('⚡ Realtime Update: notifications changed');
                                    this.fetchNotificationsFromSupabase();
                                })
                                .subscribe();
                        }

                        // --- FETCH PROJECTS (mockProjects) ---
                        const { data: projectsData, error: projErr } = await window.conworkSupabase.client
                            .from('projects')
                            .select('*, project_members(user_id, project_role)')
                            .in('company_id', companyIds);
                            
                        if (!projErr) {
                            mockProjects.length = 0; // ALWAYS Clear mock if fetch succeeds
                            if (projectsData && projectsData.length > 0) {
                                projectsData.forEach(p => {
                                    const memberUserIds = [];
                                    const managerIds = [];
                                    const comanagerIds = [];

                                    if (p.project_members) {
                                        p.project_members.forEach(pm => {
                                            memberUserIds.push(pm.user_id);
                                            if (pm.project_role === 'manager' || pm.project_role === 'owner') managerIds.push(pm.user_id);
                                            if (pm.project_role === 'comanager' || pm.project_role === 'admin' || pm.project_role === 'editor') comanagerIds.push(pm.user_id);
                                        });
                                    }
                                    
                                    if (p.owner_id && !memberUserIds.includes(p.owner_id)) {
                                        memberUserIds.push(p.owner_id);
                                        managerIds.push(p.owner_id);
                                    }

                                    /* repeat settings saved only in this browser (before the schedule column existed): copy them to the database once */
                                    const sched = App._loadProjectSchedule(p.id, p.schedule);
                                    if (sched && 'schedule' in p && !(p.schedule && p.schedule.mode === 'repeat')) {
                                        window.conworkSupabase.client.from('projects').update({ schedule: sched }).eq('id', p.id)
                                            .then(r => { if (r && r.error) console.warn('[projects] could not copy schedule to the database', r.error.message); });
                                    }
                                    const meta = App._loadProjectMeta(p.id);
                                    const projectType = p.project_type || meta.projectType || 'project';
                                    /* a Single (personal) project is visible only to the person who created it */
                                    if (projectType === 'single' && p.owner_id && App.state.currentUser && String(p.owner_id) !== String(App.state.currentUser.id)) return;
                                    mockProjects.push({
                                        projectType,
                                        ownerId: p.owner_id || null,
                                        budgetEnabled: p.budget_enabled != null ? !!p.budget_enabled : !!meta.budgetEnabled,
                                        budgetAmount: p.budget_amount != null ? Number(p.budget_amount) : (meta.budgetAmount != null ? meta.budgetAmount : null),
                                        closedAt: p.closed_at || meta.closedAt || null,
                                        id: p.id,
                                        name: p.name,
                                        description: p.description || '',
                                        startDate: p.start_date ? p.start_date.split('T')[0] : '',
                                        dueDate: p.due_date ? p.due_date.split('T')[0] : '',
                                        progress: p.progress_pct || 0,
                                        status: p.status === 'in_progress' ? 'active' : (p.status || 'active'),
                                        team: memberUserIds,
                                        managers: managerIds,
                                        comanagers: comanagerIds,
                                        manager: managerIds.length > 0 ? managerIds[0] : null,
                                        color: p.color || 'bg-blue-500',
                                        teams: Array.isArray(p.departments) ? p.departments : [],
                                        teamDept: Array.isArray(p.departments) ? p.departments.join(', ') : '',
                                        schedule: sched,
                                        tags: []
                                    });
                                });
                            }
                        }

                        // --- FETCH TASKS (mockTasks) ---
                        // Get project ids to fetch tasks
                        if (!projErr) {
                            if (projectsData) {
                                const projectIds = projectsData.length > 0 ? projectsData.map(p => p.id) : [];
                                
                                if (projectIds.length > 0) {
                                    const { data: tasksData } = await window.conworkSupabase.client
                                    .from('tasks')
                                    .select('*, task_assignees(user_id)')
                                    .in('project_id', projectIds);
                                    
                                if (tasksData) {
                                    mockTasks.length = 0; // Clear mock
                                    tasksData.forEach(t => {
                                        const details = (t.details && typeof t.details === 'object') ? t.details : {};
                                        mockTasks.push({
                                            id: t.id,
                                            projectId: t.project_id,
                                            sectionId: t.section_id,
                                            title: t.title,
                                            description: t.description || '',
                                            dueDate: t.due_date ? t.due_date.split('T')[0] : '',
                                            dueTime: details.dueTime || (t.due_date && t.due_date.includes('T') ? t.due_date.split('T')[1].substring(0,5) : ''),
                                            status: t.status === 'in_progress' ? 'in-progress' : (t.status === 'in_review' ? 'pending-review' : t.status),
                                            priority: t.priority || 'medium',
                                            subtasks: t.subtasks || [],
                                            assignees: t.task_assignees ? t.task_assignees.map(ta => ta.user_id) : [],
                                            creatorId: t.creator_id || null,
                                            tag: details.tag || '',
                                            visibility: details.visibility || 'all',
                                            repeat: !!details.repeat,
                                            notifications: details.notifications || undefined,
                                            reviewers: details.reviewers || [],
                                            departments: details.departments || [],
                                            relatedUsers: details.relatedUsers || [],
                                            isDraft: !!details.isDraft,
                                            estimateMinutes: t.estimate_minutes != null ? t.estimate_minutes : (details.estimateMinutes != null ? details.estimateMinutes : null),
                                            budgetAmount: t.budget_amount != null ? Number(t.budget_amount) : (details.budgetAmount != null ? details.budgetAmount : null),
                                            completedAt: t.completed_at || details.completedAt || null,
                                            timeLogs: Array.isArray(details.timeLogs) ? details.timeLogs : []
                                        });
                                    });
                                }

                                await App._loadTimeLogs(mockTasks.map(t => t.id));

                                // --- FETCH TASK SECTIONS (mockTaskSections) ---
                                const { data: sectionsData } = await window.conworkSupabase.client
                                    .from('task_sections')
                                    .select('*')
                                    .in('project_id', projectIds);
                                    
                                if (sectionsData) {
                                    mockTaskSections.length = 0; // Clear mock
                                    sectionsData.forEach(s => {
                                        mockTaskSections.push({
                                            id: s.id,
                                            projectId: s.project_id,
                                            title: s.title || s.name || 'ไม่มีชื่อ',
                                            color: s.color || App._loadTopicColor(s.id) || 'bg-emerald-500',
                                            order: s.display_order || 0
                                        });
                                    });
                                }
                                
                                // --- FETCH EVENTS (mockEvents) ---
                                const { data: eventsData } = await window.conworkSupabase.fetchCalendarEvents(companyIds);
                                if (eventsData) {
                                    mockEvents.length = 0; // Clear mock
                                    eventsData.forEach(ev => {
                                        const startDay = ev.start_time ? ev.start_time.split('T')[0] : '';
                                        const endDay = ev.end_time ? ev.end_time.split('T')[0] : '';
                                        mockEvents.push({
                                            id: ev.id,
                                            title: ev.title,
                                            date: startDay,
                                            endDate: endDay > startDay ? endDay : '',
                                            time: (ev.start_time && ev.start_time.includes('T')) ? ev.start_time.split('T')[1].substring(0,5) : '',
                                            projectId: ev.project_id || '',
                                            note: ev.description || '',
                                            type: ev.event_type || 'event',
                                            userIds: [ev.organizer_id], // Simplified for UI
                                            createdInTab: 'all',
                                            color: ev.color || 'bg-blue-500',
                                            files: []
                                        });
                                    });
                                }
                                await this.fetchNotificationsFromSupabase();
                            }
                        }
                    }

                    } else {
                        this.state.workspaces = [];
                        
                        // Clear mockup data since user has no real company
                        mockProjects.length = 0;
                        mockTasks.length = 0;
                        mockUsers.length = 0;
                        
                        // Add only themselves
                        if (this.state.currentUser) {
                            mockUsers.push({
                                id: this.state.currentUser.id,
                                email: this.state.currentUser.email,
                                username: this.state.currentUser.name || this.state.currentUser.email.split('@')[0],
                                name: this.state.currentUser.name || this.state.currentUser.email.split('@')[0],
                                role: this.state.currentUser.role || 'worker',
                                department: '',
                                avatar: this.state.currentUser.avatar || this._initialsAvatar(this.state.currentUser.name || this.state.currentUser.email),
                                status: 'online'
                            });
                        }
                    }
                } catch (err) {
                    console.error("Error loading data from Supabase:", err);
                    this.state.workspaces = JSON.parse(localStorage.getItem('workspaces')) || [];
                    this.state.members = JSON.parse(localStorage.getItem('workspace_members')) || [];
                }
            } else {
                this.state.workspaces = JSON.parse(localStorage.getItem('workspaces')) || [];
                this.state.members = JSON.parse(localStorage.getItem('workspace_members')) || [];
            }
            // ----------------------------------------------------
            const isSupabaseActive = window.conworkSupabase && window.conworkSupabase.isAvailable() && this.state.currentUser && this.state.workspaces.length > 0;
            
            const savedNotifs = localStorage.getItem(`conwork_notifications_${wid}`);

            if (!isSupabaseActive) {
                // If Supabase is not active, we clear the core data so it doesn't show ghost data
                mockProjects.splice(0, mockProjects.length);
                mockTasks.splice(0, mockTasks.length);
                mockUsers.length = 0;
                mockEvents.splice(0, mockEvents.length);
                mockTaskSections.splice(0, mockTaskSections.length);
            }

            if (savedNotifs) {
                const parsed = JSON.parse(savedNotifs);
                const validNotifs = parsed.filter(n => {
                    if (n.type === 'meeting' && n.linkData && n.linkData.eventId) {
                        const ev = mockEvents.find(e => e.id === n.linkData.eventId);
                        if (!ev || ev.type !== 'meeting') return false;
                    }
                    return true;
                });
                mockNotifications.splice(0, mockNotifications.length, ...validNotifs);
            } else if (wid !== 'W-1' && !isSupabaseActive) {
                mockNotifications.splice(0, mockNotifications.length);
            }
            
            if (savedMessages) {
                const parsed = JSON.parse(savedMessages);
                mockMessages.length = 0;
                parsed.forEach(m => mockMessages.push(m));
            } else if (wid !== 'W-1') {
                mockMessages.splice(0, mockMessages.length);
            }
        } catch (e) {
            console.warn('Cannot load from localStorage:', e);
        } finally {
            this._isLoadingData = false;
            if (this._pendingLoadData) {
                this._pendingLoadData = false;
                setTimeout(() => this._loadData(), 100);
            }
        }
    },

    checkAuth() {
        try {
            const userStr = sessionStorage.getItem('conwork_user') || localStorage.getItem('conwork_user');
            if (userStr) {
                this.state.currentUser = JSON.parse(userStr);
                this.showApp();
                return;
            }
        } catch (e) { }

        this.showLogin();
    },

    showLogin() {
        const landing = document.getElementById('landing-screen');
        if (landing) landing.style.display = 'flex';
        
        const login = document.getElementById('login-screen');
        if (login) login.style.display = 'none';

        const app = document.getElementById('app-screen');
        if (app) app.classList.add('hidden');
    },

    showApp() {
        const landing = document.getElementById('landing-screen');
        if (landing) landing.style.display = 'none';
        
        const login = document.getElementById('login-screen');
        if (login) login.style.display = 'none';
        
        const app = document.getElementById('app-screen');
        if (app) app.classList.remove('hidden');
        
        this.updateProfile();
        this.switchView(this.state.currentView);
        if (typeof updateLandingAuthState === 'function') {
            updateLandingAuthState();
        }
    },

    goToLandingPage() {
        if (typeof goToLandingPage === 'function') {
            goToLandingPage();
        }
    },

    updateProfile() {
        if (!this.state.currentUser) return;

        // Keep mockUsers and state.currentUser 100% in sync
        const matchingUser = mockUsers.find(u => String(u.id) === String(this.state.currentUser.id) || u.email === this.state.currentUser.email);
        if (matchingUser) {
            if (matchingUser.name) this.state.currentUser.name = matchingUser.name;
            if (matchingUser.avatar) this.state.currentUser.avatar = matchingUser.avatar;
            if (matchingUser.department) this.state.currentUser.department = matchingUser.department;
            if (matchingUser.role) this.state.currentUser.role = matchingUser.role;
        }

        const nameEl = document.getElementById('current-user-name');
        if (nameEl) nameEl.innerText = this.state.currentUser.name || 'User';

        const rawRole = this.state.currentUser.role || 'worker';
        let roleLabel = 'พนักงานทั่วไป';
        if (rawRole === 'admin' || rawRole === 'Company_admin' || rawRole === 'super_admin') roleLabel = 'แอดมิน';
        else if (rawRole === 'reviewer2' || rawRole === 'ceo') roleLabel = 'ผู้บริหาร (CEO)';
        else if (rawRole === 'reviewer1' || rawRole === 'manager') roleLabel = 'ผู้จัดการ';

        const deptStr = this.state.currentUser.department ? ` - ${this.state.currentUser.department}` : '';

        const deptEl = document.getElementById('current-user-dept');
        if (deptEl) {
            deptEl.innerHTML = `<span>${roleLabel}${deptStr}</span>`;
        }

        const avatarEl = document.getElementById('current-user-avatar');
        if (avatarEl && this.state.currentUser.avatar) {
            avatarEl.src = this.state.currentUser.avatar;
        }

        // Persist currentUser to sessionStorage and localStorage
        try {
            sessionStorage.setItem('conwork_user', JSON.stringify(this.state.currentUser));
            localStorage.setItem('conwork_user', JSON.stringify(this.state.currentUser));
        } catch (e) {}

        // RBAC: Adjust UI based on role
        this.applyRBAC();
    },

    applyRBAC() {
        const role = this.state.currentUser.role || 'worker';
        const lowerRole = role.toLowerCase();
        const isAdmin = role === 'admin' || role === 'reviewer2' || lowerRole.includes('admin') || lowerRole.includes('ceo');

        // Set "Create Project" button visibility is now handled by applyGlobalPermissions

        // Toggle Admin Only Elements
        document.querySelectorAll('.admin-only-element').forEach(el => {
            if (isAdmin) {
                if (el.id !== 'team-submenu') {
                    el.classList.remove('hidden');
                }
            } else {
                el.classList.add('hidden');
            }
        });
    },

    bindEvents() {
        // Login
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                try {
                    const u = document.getElementById('login-email')?.value?.trim() || '';
                    const p = document.getElementById('password')?.value?.trim() || '';
                    this.handleLogin(u, p);
                } catch (err) {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'bg-red-500 text-white p-2 rounded';
                    errDiv.innerText = 'JS Error: ' + err.message;
                    loginForm.prepend(errDiv);
                }
            });
        }

        // Register
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                try {
                    const name = document.getElementById('reg-name')?.value?.trim() || '';
                    const email = document.getElementById('reg-email')?.value?.trim() || '';
                    const password = document.getElementById('reg-password')?.value?.trim() || '';
                    const role = document.getElementById('reg-role')?.value || 'worker';
                    this.handleRegister(name, email, password, role);
                } catch (err) {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'bg-red-500 text-white p-2 rounded';
                    errDiv.innerText = 'JS Error: ' + err.message;
                    registerForm.prepend(errDiv);
                }
            });
        }



        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.getAttribute('data-view');
                this.switchView(view);
            });
        });

        // Close context menus on outside click
        document.addEventListener('click', (e) => {
            const tscm = document.getElementById('task-section-context-menu');
            if (tscm && !tscm.classList.contains('hidden')) tscm.classList.add('hidden');
            const pcm = document.getElementById('project-context-menu');
            if (pcm && !pcm.classList.contains('hidden')) pcm.classList.add('hidden');

            // Close profile menu dropdown
            const pmd = document.getElementById('profile-menu-dropdown');
            const pSec = document.getElementById('sidebar-profile-section');
            if (pmd && !pmd.classList.contains('hidden') && pSec && !pSec.contains(e.target)) {
                pmd.classList.add('hidden');
            }

            // Close team view dropdown
            const tvm = document.getElementById('team-view-dropdown');
            const tvBtn = document.getElementById('team-view-menu-container');
            if (tvm && !tvm.classList.contains('hidden') && tvBtn && !tvBtn.contains(e.target)) {
                tvm.classList.add('hidden');
            }

            // Close user profile context menu
            const upcm = document.getElementById('up-context-menu');
            if (upcm && !upcm.classList.contains('hidden')) {
                upcm.classList.add('hidden');
            }
        });

        // Team View Events
        const teamSearchInput = document.getElementById('team-search-input');
        if (teamSearchInput) {
            teamSearchInput.addEventListener('input', (e) => {
                this.state.teamSearchQuery = e.target.value;
                this.renderTeam();
            });
        }
        ['team-filter-dept', 'team-filter-role', 'team-filter-status'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    if (id === 'team-filter-dept') this.state.teamFilterDept = e.target.value;
                    if (id === 'team-filter-role') this.state.teamFilterRole = e.target.value;
                    if (id === 'team-filter-status') this.state.teamFilterStatus = e.target.value;
                    this.renderTeam();
                });
            }
        });
        const teamResetBtn = document.getElementById('team-reset-btn');
        if (teamResetBtn) {
            teamResetBtn.addEventListener('click', () => {
                this.state.teamSearchQuery = '';
                this.state.teamFilterDept = '';
                this.state.teamFilterRole = '';
                this.state.teamFilterStatus = '';
                if (teamSearchInput) teamSearchInput.value = '';
                document.getElementById('team-filter-dept').value = '';
                document.getElementById('team-filter-role').value = '';
                document.getElementById('team-filter-status').value = '';
                this.filterTeam('all'); // This will also call renderTeam()
            });
        }
    },

    async handleLogin(email, password) {
        try {
            // เรียกใช้งาน ApiService แทนการเช็ค mock data โดยตรง
            const user = await ApiService.login(email, password);
            this.state.currentUser = user;
            try { sessionStorage.setItem('conwork_user', JSON.stringify(user)); } catch (e) { }
            this.showApp();
        } catch (error) {
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                let errDiv = document.getElementById('login-error-msg');
                if (!errDiv) {
                    errDiv = document.createElement('div');
                    errDiv.id = 'login-error-msg';
                    errDiv.className = 'bg-red-500/20 border border-red-500 text-red-100 p-3 rounded-lg text-sm text-left mb-4';
                    loginForm.prepend(errDiv);
                }
                errDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation mr-2"></i>อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือเชื่อมต่อระบบไม่ได้';
            }
        }
    },

    toggleAuthMode(mode) {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        const tabLogin = document.getElementById('tab-login');
        const tabRegister = document.getElementById('tab-register');

        if (mode === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            tabLogin.className = 'flex-1 py-2 rounded-md bg-blue-600 text-white text-sm font-medium transition-colors';
            tabRegister.className = 'flex-1 py-2 rounded-md text-blue-200 hover:text-white text-sm font-medium transition-colors';
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            tabRegister.className = 'flex-1 py-2 rounded-md bg-blue-600 text-white text-sm font-medium transition-colors';
            tabLogin.className = 'flex-1 py-2 rounded-md text-blue-200 hover:text-white text-sm font-medium transition-colors';
        }
    },

    togglePasswordVisibility(inputId, iconEl) {
        const input = document.getElementById(inputId);
        if (!input || !iconEl) return;
        if (input.type === 'password') {
            input.type = 'text';
            iconEl.classList.remove('fa-eye');
            iconEl.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            iconEl.classList.remove('fa-eye-slash');
            iconEl.classList.add('fa-eye');
        }
    },

    async handleRegister(name, email, password, role) {
        const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:'",.<>/?`~\\-]).{8,}$/;
        if (!pwRegex.test(password)) {
            alert('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร, พิมพ์ใหญ่, พิมพ์เล็ก, ตัวเลข และอักขระพิเศษ');
            return;
        }

        try {
            // เรียกใช้งาน ApiService สำหรับสมัตรสมาชิก
            const user = await ApiService.register(name, email, password, role);
            
            this.state.currentUser = user;
            try { sessionStorage.setItem('conwork_user', JSON.stringify(user)); } catch (e) { }
            this.showApp();
            
        } catch (error) {
            alert(error.message || 'ไม่สามารถสมัครสมาชิกได้ เกิดข้อผิดพลาด');
        }
    },

    hasPermission(featureName) {
        if (!this.state.currentUser) return false;

        // First check for custom user-level permissions
        if (this.state.currentUser.customPermissions && typeof this.state.currentUser.customPermissions[featureName] === 'boolean') {
            return this.state.currentUser.customPermissions[featureName];
        }

        // Project Manager / Co-manager Bypass
        if (this.state.currentProject) {
            const currentProj = mockProjects.find(p => p.id === this.state.currentProject);
            if (currentProj) {
                const curUserId = parseInt(this.state.currentUser.id);
                const isProjectManager = (currentProj.managers && currentProj.managers.some(id => parseInt(id) === curUserId)) || 
                                         (currentProj.comanagers && currentProj.comanagers.some(id => parseInt(id) === curUserId));
                
                if (isProjectManager) {
                    const systemFeatures = ['สร้างโปรเจกต์', 'เพิ่มพนักงาน', 'แก้ไขพนักงาน', 'ลบพนักงาน', 'ตั้งค่าระบบ', 'จัดการสิทธิ์'];
                    if (!systemFeatures.includes(featureName)) {
                        return true;
                    }
                }
            }
        }

        let role = this.state.currentUser.role || 'worker';

        // Map legacy internal roles to custom positions for permission lookup
        const roleMap = {
            'admin': 'Admin',
            'reviewer2': 'CEO',
            'reviewer1': 'หัวหน้า',
            'worker': 'พนักงาน',
            'requester': 'พนักงาน'
        };
        if (roleMap[role]) {
            role = roleMap[role];
        }

        if (!this.permissionsState) {
            try {
                const data = localStorage.getItem('conwork_role_settings');
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed.permissionsState) {
                        this.permissionsState = parsed.permissionsState;
                    }
                }
            } catch (e) {
                console.warn('Cannot access localStorage in hasPermission:', e);
            }
        }

        const lowerRole = role.toLowerCase();

        // 1. Super Admin Bypass: Admins and CEOs always have full access, preventing accidental lockouts
        if (role === 'Admin' || role === 'CEO' || lowerRole.includes('admin') || lowerRole.includes('ceo')) {
            return true;
        }

        // 2. Check explicit permission state from admin settings
        if (this.permissionsState && this.permissionsState[featureName]) {
            if (this.permissionsState[featureName][role] !== undefined) {
                return !!this.permissionsState[featureName][role];
            }
        }

        // 3. Fallback default permissions for other roles if not explicitly configured yet
        if (role === 'หัวหน้า' || lowerRole.includes('หัวหน้า') || lowerRole.includes('manager') || lowerRole.includes('supervisor')) {
            const headPerms = ['สร้างโปรเจกต์', 'แก้ไขโปรเจกต์', 'ลบโปรเจกต์', 'สร้างหัวข้องาน', 'แก้ไขงาน', 'ลบงาน', 'ดูงานทั้งหมด', 'เพิ่มพนักงาน', 'แก้ไขพนักงาน', 'มอบหมายงาน'];
            if (headPerms.includes(featureName)) return true;
        }

        if (role === 'พนักงาน' || lowerRole.includes('พนักงาน') || lowerRole.includes('worker')) {
            const workerPerms = ['ดูงานทั้งหมด'];
            if (workerPerms.includes(featureName)) return true;
        }

        return false;
    },

    applyGlobalPermissions() {
        if (!this.state.currentUser) return;

        const elements = document.querySelectorAll('[data-require-perm]');
        elements.forEach(el => {
            const feature = el.getAttribute('data-require-perm');
            if (this.hasPermission(feature)) {
                el.style.display = ''; // Show
            } else {
                el.style.display = 'none'; // Hide
            }
        });
    },

    // --- Core Navigation ---
    switchView(viewName) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.remove('hidden');

        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            el.classList.add('text-gray-400', 'hover:bg-gray-800');
            el.querySelector('i').classList.remove('text-white');
        });

        // Clear subnav active states
        document.querySelectorAll('.subnav-item').forEach(el => {
            el.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            el.classList.add('text-gray-400', 'hover:bg-gray-800');
            const icon = el.querySelector('i');
            if (icon) icon.classList.remove('text-white');
        });

        const activeLink = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (activeLink) {
            activeLink.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            activeLink.classList.remove('text-gray-400', 'hover:bg-gray-800');
            activeLink.querySelector('i').classList.add('text-white');
        }

        // Update header title
        const titleMap = { dashboard: 'แดชบอร์ดส่วนตัว', projects: 'งานทั้งหมด', calendar: 'ปฏิทิน', messages: 'ข้อความ', team: 'ทีมงาน', 'work-report': 'รายงาน', accounting: 'บัญชีและงบประมาณ', 'add-member': 'เพิ่มพนักงานใหม่', 'role-settings': 'ตั้งค่าพนักงาน' };
        const titleEl = document.getElementById('main-header-title');
        if (titleEl && titleMap[viewName]) titleEl.textContent = titleMap[viewName];

        const subtitleEl = document.getElementById('main-header-subtitle');
        if (subtitleEl) {
            if (viewName === 'team') {
                subtitleEl.textContent = 'รายชื่อพนักงานทั้งหมดในบริษัท';
                subtitleEl.classList.remove('hidden');
            } else if (viewName === 'work-report') {
                subtitleEl.textContent = 'สรุปความคืบหน้า เวลา และงบประมาณ ตามโปรเจกต์ บุคคล หรือแผนก';
                subtitleEl.classList.remove('hidden');
            } else if (viewName === 'accounting') {
                subtitleEl.textContent = 'บันทึกรายรับรายจ่าย สมุดบัญชี และงบเทียบใช้จริง';
                subtitleEl.classList.remove('hidden');
            } else if (viewName === 'dashboard') {
                subtitleEl.textContent = 'สรุปข้อมูลกิจกรรมและงานส่วนตัวของคุณ';
                subtitleEl.classList.remove('hidden');
            } else {
                subtitleEl.textContent = '';
                subtitleEl.classList.add('hidden');
            }
        }

        this.state.currentView = viewName;
        this.applyGlobalPermissions();

        if (viewName === 'dashboard') this.renderDashboard();
        if (viewName === 'projects') this.renderProjects();
        if (viewName === 'team') this.renderTeam();
        if (viewName === 'calendar') {
            this._calInit();
            this.renderCalendar();
        }
        if (viewName === 'messages') {
            this.loadUserChats().then(() => {
                this.renderChatList();
                this.renderMessages();
            });
        }
        if (viewName === 'work-report' && typeof WorkReport !== 'undefined') {
            WorkReport.init();
        }
        if (viewName === 'accounting' && typeof Accounting !== 'undefined') {
            Accounting.init();
        }
    },

    handleTeamNavClick(e) {
        e.preventDefault();
        const role = (this.state.currentUser && this.state.currentUser.role) ? this.state.currentUser.role : 'worker';
        const lowerRole = role.toLowerCase();
        const isAdmin = role === 'admin' || role === 'reviewer2' || lowerRole.includes('admin') || lowerRole.includes('ceo');

        if (isAdmin) {
            const submenu = document.getElementById('team-submenu');
            const icon = document.getElementById('team-submenu-icon');
            if (submenu.classList.contains('hidden')) {
                submenu.classList.remove('hidden');
                submenu.classList.add('flex');
                if (icon) icon.classList.add('rotate-180');
            } else {
                submenu.classList.add('hidden');
                submenu.classList.remove('flex');
                if (icon) icon.classList.remove('rotate-180');
            }
            this.switchView('team');
        } else {
            this.switchView('team');
        }
    },

    closeTeamSubmenuOnMobile() {
        if (window.innerWidth < 1024) { // Tailwind lg breakpoint
            this.toggleSidebar(); // Close sidebar on mobile after clicking
        }
    },

    handleSubnavClick(id) {
        document.querySelectorAll('.subnav-item').forEach(el => {
            el.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            el.classList.add('text-gray-400', 'hover:bg-gray-800');
            const icon = el.querySelector('i');
            if (icon) icon.classList.remove('text-white');
        });

        const activeItem = document.getElementById(id);
        if (activeItem) {
            activeItem.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            activeItem.classList.remove('text-gray-400', 'hover:bg-gray-800');
            const icon = activeItem.querySelector('i');
            if (icon) icon.classList.add('text-white');
        }
    },

    openRoleModal() {
        this.switchView('role-settings');
    },

    // Phones: start with the menu closed, and close it again when the page behind it is tapped
    _initMobileSidebar() {
        const sidebar = document.getElementById('app-sidebar');
        if (!sidebar || window.innerWidth > 640) return;
        if (sidebar.classList.contains('w-64')) this.toggleSidebar();
        document.addEventListener('click', (e) => {
            if (window.innerWidth > 640 || !sidebar.classList.contains('w-64')) return;
            if (sidebar.contains(e.target) || e.target.closest('#sidebar-toggle')) return;
            this.toggleSidebar();
        }, true);
    },

    toggleSidebar() {
        const sidebar = document.getElementById('app-sidebar');
        if (!sidebar) return;
        const isCollapsed = sidebar.classList.contains('w-20');
        const texts = sidebar.querySelectorAll('.sidebar-text');

        if (isCollapsed) {
            // Expand
            sidebar.classList.remove('w-20');
            sidebar.classList.add('w-64');
            texts.forEach(t => {
                t.classList.remove('opacity-0', 'pointer-events-none', 'w-0');
            });
        } else {
            // Collapse
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-20');
            texts.forEach(t => {
                t.classList.add('opacity-0', 'pointer-events-none', 'w-0');
            });
        }
    },
    clearGlobalDateFilter() {
        const now = new Date();
        const fDate = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth()+1).padStart(2, '0');
            const dt = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${dt}`;
        };
        const startEl = document.getElementById('dash-global-start');
        const endEl = document.getElementById('dash-global-end');
        if (startEl) startEl.value = fDate(new Date(now.getFullYear(), now.getMonth(), 1));
        if (endEl) endEl.value = fDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        this.renderDashboard();
    },

    renderDashboard() {
        if (!this.state.currentUser) return;
        
        const u = this.state.currentUser;
        const nameEl = document.getElementById('dash-user-name');
        if (nameEl) nameEl.textContent = u.name || u.username || 'ผู้ใช้';
        const currentUserId = String(u.id);
        let myTasks = mockTasks.filter(t => t.assignees && t.assignees.some(id => String(id) === currentUserId || id == currentUserId));
        
        // Populate Project Filter
        const projFilterEl = document.getElementById('dash-project-filter');
        if (projFilterEl) {
            if (projFilterEl.options.length <= 1) {
                const userProjects = [...new Set(myTasks.map(t => t.projectId).filter(p => p))];
                userProjects.forEach(pid => {
                    const p = mockProjects.find(pr => String(pr.id) === String(pid));
                    if (p) {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.name;
                        projFilterEl.appendChild(opt);
                    }
                });
            }
            
            const selectedProj = projFilterEl.value;
            if (selectedProj) {
                myTasks = myTasks.filter(t => String(t.projectId) === String(selectedProj));
            }
        }
        
        const startEl = document.getElementById('dash-global-start');
        const endEl = document.getElementById('dash-global-end');
        if (startEl && !startEl.value && endEl && !endEl.value) {
            const now = new Date();
            const fDate = (d) => {
                const y = d.getFullYear();
                const m = String(d.getMonth()+1).padStart(2, '0');
                const dt = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${dt}`;
            };
            startEl.value = fDate(new Date(now.getFullYear(), now.getMonth(), 1));
            endEl.value = fDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        }
        
        // Global Date Filter
        const globalStart = startEl?.value;
        const globalEnd = endEl?.value;
        
        if (globalStart || globalEnd) {
            myTasks = myTasks.filter(t => {
                const d = t.dueDate ? new Date(t.dueDate) : (t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt || new Date()));
                let isValid = true;
                if (globalStart) {
                    const start = new Date(globalStart);
                    start.setHours(0,0,0,0);
                    if (d < start) isValid = false;
                }
                if (globalEnd) {
                    const end = new Date(globalEnd);
                    end.setHours(23,59,59,999);
                    if (d > end) isValid = false;
                }
                return isValid;
            });
        }
        
        const total = myTasks.length;
        const completed = myTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
        const inProgress = myTasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress' || t.status === 'pending-review' || t.status === 'pending_review' || t.status === 'active').length;
        const pending = myTasks.filter(t => t.status === 'pending' || t.status === 'todo' || t.status === 'plan').length;
        
        // Stalled or due soon - let's check due dates
        const now = new Date();
        const threeDaysLater = new Date();
        threeDaysLater.setDate(now.getDate() + 3);
        
        let dueSoonCount = 0;
        myTasks.forEach(t => {
            if (t.status !== 'completed' && t.status !== 'done' && t.dueDate) {
                const due = new Date(t.dueDate);
                if (due <= threeDaysLater) {
                    dueSoonCount++;
                }
            }
        });
        
        // Calculate Previous Period for trends
        let hasPrevPeriod = false;
        let prevTotal = 0;
        let prevCompleted = 0;
        let prevInProgress = 0;
        let prevPending = 0;
        
        if (globalStart && globalEnd) {
            hasPrevPeriod = true;
            const start = new Date(globalStart);
            start.setHours(0,0,0,0);
            const end = new Date(globalEnd);
            end.setHours(23,59,59,999);
            const diffTime = end - start;
            
            const prevStart = new Date(start.getTime() - diffTime - (24*60*60*1000));
            const prevEnd = new Date(start.getTime() - (24*60*60*1000));
            prevEnd.setHours(23,59,59,999);
            
            let prevTasksRaw = mockTasks.filter(t => t.assignees && t.assignees.some(id => String(id) === currentUserId || id == currentUserId));
            const projFilterEl = document.getElementById('dash-project-filter');
            if (projFilterEl && projFilterEl.value) {
                prevTasksRaw = prevTasksRaw.filter(t => String(t.projectId) === String(projFilterEl.value));
            }
            
            const prevTasks = prevTasksRaw.filter(t => {
                const d = t.dueDate ? new Date(t.dueDate) : (t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt || new Date()));
                return d >= prevStart && d <= prevEnd;
            });
            
            prevTotal = prevTasks.length;
            prevCompleted = prevTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
            prevInProgress = prevTasks.filter(t => t.status === 'in-progress' || t.status === 'in_progress' || t.status === 'pending-review' || t.status === 'pending_review' || t.status === 'active').length;
            prevPending = prevTasks.filter(t => t.status === 'pending' || t.status === 'todo' || t.status === 'plan').length;
        }

        // Update cards
        const safeSetText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        
        safeSetText('dash-total-tasks', total);
        safeSetText('dash-completed-tasks', completed);
        safeSetText('dash-in-progress-tasks', inProgress);
        safeSetText('dash-pending-tasks', pending);
        safeSetText('dash-due-soon-tasks', dueSoonCount);
        
        const renderTrend = (id, current, prev, hasPrev, isPending = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            if (!hasPrev) {
                el.innerHTML = `<span class="text-gray-400"><i class="fa-solid fa-minus"></i> ไม่มีข้อมูลเทียบ</span>`;
                return;
            }
            
            const diff = current - prev;
            if (diff > 0) {
                const color = isPending ? "text-red-500" : "text-green-500";
                el.innerHTML = `<span class="${color} flex items-center gap-1"><i class="fa-solid fa-arrow-trend-up"></i> +${diff} จากงวดที่แล้ว</span>`;
            } else if (diff < 0) {
                const color = isPending ? "text-green-500" : "text-red-500";
                el.innerHTML = `<span class="${color} flex items-center gap-1"><i class="fa-solid fa-arrow-trend-down"></i> ${diff} จากงวดที่แล้ว</span>`;
            } else {
                el.innerHTML = `<span class="text-gray-400 flex items-center gap-1"><i class="fa-solid fa-minus"></i> เท่าเดิม</span>`;
            }
        };
        
        renderTrend('dash-trend-total', total, prevTotal, hasPrevPeriod);
        renderTrend('dash-trend-in-progress', inProgress, prevInProgress, hasPrevPeriod);
        renderTrend('dash-trend-completed', completed, prevCompleted, hasPrevPeriod);
        renderTrend('dash-trend-pending', pending, prevPending, hasPrevPeriod, true);
        
        // Update Chart
        let compPct = total ? Math.round((completed / total) * 100) : 0;
        let inProgPct = total ? Math.round((inProgress / total) * 100) : 0;
        let pendPct = total ? Math.round((pending / total) * 100) : 0;
        let stallPct = 100 - compPct - inProgPct - pendPct; // Fill the rest to be safe visually
        if (stallPct < 0) stallPct = 0;
        
        safeSetText('dash-donut-percent', `${compPct}%`);
        safeSetText('dash-legend-completed-count', completed);
        safeSetText('dash-legend-completed-pct', `(${compPct}%)`);
        
        safeSetText('dash-legend-inprogress-count', inProgress);
        safeSetText('dash-legend-inprogress-pct', `(${inProgPct}%)`);
        
        safeSetText('dash-legend-pending-count', pending);
        safeSetText('dash-legend-pending-pct', `(${pendPct}%)`);
        
        safeSetText('dash-legend-stalled-count', dueSoonCount);
        let stallRealPct = total ? Math.round((dueSoonCount / total) * 100) : 0;
        safeSetText('dash-legend-stalled-pct', `(${stallRealPct}%)`);
        
        // Update conic gradient
        const chartEl = document.getElementById('dash-donut-chart');
        if (chartEl) {
            if (total === 0) {
                chartEl.style.background = 'conic-gradient(#e5e7eb 0% 100%)';
            } else {
                let compEnd = compPct;
                let inProgEnd = compEnd + inProgPct;
                let pendEnd = inProgEnd + pendPct;
                
                chartEl.style.background = `conic-gradient(
                    #4285F4 0% ${compEnd}%, 
                    #34A853 ${compEnd}% ${inProgEnd}%, 
                    #FBBC05 ${inProgEnd}% ${pendEnd}%, 
                    #EA4335 ${pendEnd}% 100%
                )`;
            }
        }

        // Render Recent Projects
        const recentProjectsContainer = document.getElementById('dash-recent-projects');
        if (recentProjectsContainer) {
            // Sort projects by newest first, take top 3
            const recentProjects = [...mockProjects]
                .filter(p => p.status !== 'deleted' && p.status !== 'hidden')
                .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                .slice(0, 3);
            
            if (recentProjects.length === 0) {
                recentProjectsContainer.innerHTML = '<div class="text-center text-gray-500 py-4">ไม่มีโปรเจกต์ในขณะนี้</div>';
            } else {
                let projectsHtml = '';
                recentProjects.forEach((p, idx) => {
                    const colors = [
                        { bg: 'bg-indigo-100', text: 'text-indigo-600', icon: 'fa-code' },
                        { bg: 'bg-teal-100', text: 'text-teal-600', icon: 'fa-laptop-code' },
                        { bg: 'bg-orange-100', text: 'text-orange-600', icon: 'fa-book-open-reader' },
                        { bg: 'bg-pink-100', text: 'text-pink-600', icon: 'fa-palette' }
                    ];
                    const color = colors[idx % colors.length];
                    
                    let progress = 0;
                    if (p.tasksTotal > 0) {
                        progress = Math.round((p.tasksDone / p.tasksTotal) * 100);
                    } else if (p.progress) {
                        progress = p.progress;
                    }

                    projectsHtml += `
                        <div onclick="App.state.currentProject='${p.id}'; App.switchView('tasks')" class="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors border border-transparent hover:border-gray-100">
                            <div class="w-12 h-12 rounded-xl ${color.bg} ${color.text} flex items-center justify-center text-xl shrink-0"><i class="fa-solid ${color.icon}"></i></div>
                            <div class="flex-1 min-w-0">
                                <h4 class="font-bold text-gray-800 truncate" data-no-i18n>${p.name || 'ไม่มีชื่อ'}</h4>
                                <div class="flex items-center gap-4 mt-1">
                                    <div class="text-xs text-gray-500 font-medium">${progress}%</div>
                                    <div class="text-xs text-gray-400"><i class="fa-regular fa-clock"></i> Due: ${p.endDate || 'ไม่มีกำหนด'}</div>
                                </div>
                            </div>
                            <div class="w-full md:w-64 h-6 rounded-full bg-red-100 relative shrink-0 overflow-hidden">
                                <div class="absolute top-0 left-0 h-full bg-green-500 flex items-center justify-center rounded-full" style="width: ${progress}%;">
                                    <span class="text-[10px] font-bold text-white ${progress < 10 ? 'hidden' : ''}">${progress}%</span>
                                </div>
                                <div class="absolute top-0 right-0 h-full w-[${100 - progress}%] flex items-center justify-center">
                                    <span class="text-[10px] font-bold text-gray-600 ${100 - progress < 10 ? 'hidden' : ''}">${100 - progress}%</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
                recentProjectsContainer.innerHTML = projectsHtml;
            }
        }
        
        // Render the dynamic bar chart
        this.renderDashboardChart('yearly');
    },

    clearChartFilter() {
        document.getElementById('chart-date-start').value = '';
        document.getElementById('chart-date-end').value = '';
        this.renderDashboardChart('yearly');
    },

    renderDashboardChart(timeframe = 'yearly', payload = null) {
        const u = this.state.currentUser;
        if (!u) return;
        const currentUserId = String(u.id);
        let myTasks = mockTasks.filter(t => t.assignees && t.assignees.some(id => String(id) === currentUserId || id == currentUserId));
        
        // Apply Global Project Filter
        const projFilterEl = document.getElementById('dash-project-filter');
        if (projFilterEl && projFilterEl.value) {
            myTasks = myTasks.filter(t => String(t.projectId) === String(projFilterEl.value));
        }
        
        // Apply Global Date Filter if exists, ONLY IF timeframe is not custom
        if (timeframe !== 'custom') {
            const globalStart = document.getElementById('dash-global-start')?.value;
            const globalEnd = document.getElementById('dash-global-end')?.value;
            
            if (globalStart || globalEnd) {
                myTasks = myTasks.filter(t => {
                    const d = t.dueDate ? new Date(t.dueDate) : (t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt || new Date()));
                    let isValid = true;
                    if (globalStart) {
                        const start = new Date(globalStart);
                        start.setHours(0,0,0,0);
                        if (d < start) isValid = false;
                    }
                    if (globalEnd) {
                        const end = new Date(globalEnd);
                        end.setHours(23,59,59,999);
                        if (d > end) isValid = false;
                    }
                    return isValid;
                });
            }
        }
        
        // Find unique projects involved
        const projectMap = {};
        myTasks.forEach(t => {
            if (t.projectId && !projectMap[t.projectId]) {
                const proj = mockProjects.find(p => String(p.id) === String(t.projectId));
                if (proj) {
                    projectMap[t.projectId] = proj.name || `Project ${t.projectId}`;
                }
            }
        });
        
        const projectIds = Object.keys(projectMap);
        const colors = ['#4285F4', '#8E24AA', '#FFCA28', '#FF9800', '#00BFA5', '#EF5350', '#2E7D32', '#C2185B'];
        
        // Generate Legend
        const legendContainer = document.getElementById('dash-chart-legend');
        if (legendContainer) {
            let legendHtml = '';
            projectIds.forEach((pid, idx) => {
                const color = colors[idx % colors.length];
                legendHtml += `<div class="flex items-center gap-2 text-xs text-gray-600"><div class="w-2.5 h-2.5 rounded-full" style="background-color: ${color}"></div> <span class="truncate max-w-[120px]" title="${projectMap[pid]}">${projectMap[pid]}</span></div>`;
            });
            if (projectIds.length === 0) {
                legendHtml = '<div class="text-xs text-gray-400">ยังไม่มีข้อมูลโปรเจกต์</div>';
            }
            legendContainer.innerHTML = legendHtml;
        }

        // Setup Bins
        let labels = [];
        let bins = [];
        const now = new Date();
        
        if (timeframe === 'yearly') {
            labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for(let i=0; i<12; i++) {
                let bin = { total: 0, projects: {} };
                projectIds.forEach(pid => bin.projects[pid] = 0);
                bins.push(bin);
            }
            
            myTasks.forEach(t => {
                const d = t.dueDate ? new Date(t.dueDate) : (t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt || new Date()));
                if (d.getFullYear() === now.getFullYear()) {
                    const month = d.getMonth(); 
                    if (t.projectId && projectMap[t.projectId]) {
                        bins[month].projects[t.projectId] = (bins[month].projects[t.projectId] || 0) + 1;
                        bins[month].total += 1;
                    }
                }
            });
            const titleEl = document.getElementById('dash-chart-title');
            if(titleEl) titleEl.textContent = `รายละเอียดผลงานตลอดปี ค.ศ. ${now.getFullYear()}`;
            
            const btnY = document.getElementById('chart-filter-yearly');
            if(btnY) {
                btnY.className = "px-3 py-1.5 text-sm font-medium rounded-md bg-white shadow-sm border border-gray-200 text-gray-800 transition-colors hover:bg-gray-50";
            }
            
            const btnBack = document.getElementById('chart-btn-back');
            if (btnBack) btnBack.classList.add('hidden');
            
            const btnClear = document.getElementById('chart-btn-clear');
            if (btnClear) btnClear.classList.add('hidden');
            
        } else if (timeframe === 'monthly_drilldown') {
            const monthIdx = payload; // 0-11
            const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
            const daysInMonth = new Date(now.getFullYear(), monthIdx + 1, 0).getDate();
            
            for(let i=1; i<=daysInMonth; i++) {
                labels.push(i.toString());
                let bin = { total: 0, projects: {} };
                projectIds.forEach(pid => bin.projects[pid] = 0);
                bins.push(bin);
            }
            
            myTasks.forEach(t => {
                const d = t.dueDate ? new Date(t.dueDate) : (t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt || new Date()));
                if (d.getFullYear() === now.getFullYear() && d.getMonth() === monthIdx) {
                    const date = d.getDate();
                    const binIdx = date - 1;
                    if (t.projectId && projectMap[t.projectId]) {
                        bins[binIdx].projects[t.projectId] = (bins[binIdx].projects[t.projectId] || 0) + 1;
                        bins[binIdx].total += 1;
                    }
                }
            });
            const titleEl = document.getElementById('dash-chart-title');
            if(titleEl) titleEl.textContent = `รายละเอียดผลงานรายวัน (${monthNames[monthIdx]} ${now.getFullYear()})`;
            
            const btnY = document.getElementById('chart-filter-yearly');
            if(btnY) {
                btnY.className = "px-3 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors";
            }
            
            const btnBack = document.getElementById('chart-btn-back');
            if (btnBack) btnBack.classList.remove('hidden');
            
            const btnClear = document.getElementById('chart-btn-clear');
            if (btnClear) btnClear.classList.add('hidden');
            
        } else if (timeframe === 'custom') {
            const startInput = document.getElementById('chart-date-start').value;
            const endInput = document.getElementById('chart-date-end').value;
            
            if (!startInput || !endInput) {
                alert("กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด");
                return;
            }
            
            const startDate = new Date(startInput);
            startDate.setHours(0,0,0,0);
            const endDate = new Date(endInput);
            endDate.setHours(23,59,59,999);
            
            if (startDate > endDate) {
                alert("วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด");
                return;
            }
            
            // Calculate days diff
            const diffTime = Math.abs(endDate - startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 60) {
                alert("ช่วงเวลาที่เลือกยาวเกินไป (สูงสุด 60 วัน)");
                return;
            }
            
            for(let i=0; i<diffDays; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                labels.push(`${d.getDate()}/${d.getMonth()+1}`);
                
                let bin = { total: 0, projects: {} };
                projectIds.forEach(pid => bin.projects[pid] = 0);
                bins.push(bin);
            }
            
            myTasks.forEach(t => {
                const d = t.dueDate ? new Date(t.dueDate) : (t.updatedAt ? new Date(t.updatedAt) : new Date(t.createdAt || new Date()));
                if (d >= startDate && d <= endDate) {
                    const dayDiff = Math.floor((d - startDate) / (1000 * 60 * 60 * 24));
                    if (dayDiff >= 0 && dayDiff < diffDays) {
                        if (t.projectId && projectMap[t.projectId]) {
                            bins[dayDiff].projects[t.projectId] = (bins[dayDiff].projects[t.projectId] || 0) + 1;
                            bins[dayDiff].total += 1;
                        }
                    }
                }
            });
            
            const titleEl = document.getElementById('dash-chart-title');
            if(titleEl) titleEl.textContent = `รายละเอียดผลงานช่วงเวลา (${startDate.toLocaleDateString('th-TH')} - ${endDate.toLocaleDateString('th-TH')})`;
            
            const btnY = document.getElementById('chart-filter-yearly');
            if(btnY) {
                btnY.className = "px-3 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors";
            }
            
            const btnBack = document.getElementById('chart-btn-back');
            if (btnBack) btnBack.classList.remove('hidden');
            
            const btnClear = document.getElementById('chart-btn-clear');
            if (btnClear) btnClear.classList.remove('hidden');
        }

        const chartContainer = document.getElementById('dash-chart-container');
        if (!chartContainer) return;
        
        let maxVal = Math.max(...bins.map(b => b.total));
        maxVal = Math.max(4, Math.ceil(maxVal * 1.2));
        const step = Math.ceil(maxVal / 4);
        maxVal = step * 4; 

        // 1. Grid Lines HTML
        let html = `
            <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">${maxVal}</span></div>
                <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">${maxVal - step}</span></div>
                <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">${maxVal - step*2}</span></div>
                <div class="w-full border-t border-gray-100 h-0 relative"><span class="absolute -top-2.5 -left-8 text-xs text-gray-400">${step}</span></div>
                <div class="w-full border-t border-gray-200 h-0 relative"><span class="absolute -top-2.5 -left-4 text-xs text-gray-400">0</span></div>
            </div>
        `;
        
        // 2. Line Graph Overlay SVG
        let points = [];
        const xStep = 100 / (bins.length - 1 || 1);
        bins.forEach((bin, idx) => {
            const x = timeframe === 'yearly' ? (idx * xStep) : (idx * xStep * 0.95 + 2.5); // Center lines a bit
            const y = 100 - ((bin.total / maxVal) * 100);
            points.push(`${x},${y}`);
        });
        
        html += `
            <svg class="absolute inset-0 w-full h-full pointer-events-none drop-shadow-md z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                <polyline points="${points.join(' ')}" fill="none" stroke="#E65100" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            </svg>
        `;
        
        // 3. Bars HTML
        bins.forEach((bin, idx) => {
            let totalHeightPct = (bin.total / maxVal) * 100;
            
            const clickAction = timeframe === 'yearly' ? `onclick="App.renderDashboardChart('monthly_drilldown', ${idx})"` : '';
            const cursorClass = timeframe === 'yearly' ? 'cursor-pointer hover:-translate-y-1 transition-transform' : '';
            
            let barHtml = `<div class="w-8 flex flex-col justify-end group min-h-[1px] relative z-20 ${cursorClass}" ${clickAction} style="height: ${totalHeightPct}%">`;
            
            if (bin.total > 0) {
                let runningPct = 0;
                projectIds.forEach((pid, pidx) => {
                    const count = bin.projects[pid];
                    if (count > 0) {
                        const hPct = (count / bin.total) * 100;
                        const color = colors[pidx % colors.length];
                        const roundedClass = runningPct === 0 ? 'rounded-t-sm' : ''; 
                        barHtml += `<div class="w-full ${roundedClass} group-hover:opacity-80 transition-opacity relative" style="height: ${hPct}%; background-color: ${color}" title="${projectMap[pid]}: ${count} งาน">
                                        <div class="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded pointer-events-none z-30 whitespace-nowrap transition-opacity">
                                            ${projectMap[pid]}: ${count} งาน
                                        </div>
                                    </div>`;
                        runningPct += hPct;
                    }
                });
            } else {
                barHtml += `<div class="w-full h-full bg-transparent"></div>`;
            }
            
            barHtml += `<div class="text-center text-[10px] text-gray-400 mt-2 absolute -bottom-6 w-full">${labels[idx]}</div></div>`;
            html += barHtml;
        });

        chartContainer.innerHTML = html;
    },

    renderProjects() {
        const container = document.getElementById('projects-container');
        if (!container) return;

        let html = '';

        const addSecBtn = document.getElementById('add-task-section-btn');
        if (addSecBtn) { const isManager = this.state.currentUser && ['admin', 'reviewer2', 'reviewer1', 'manager', 'supervisor'].includes(this.state.currentUser.role); addSecBtn.style.display = (this.hasPermission('สร้างหัวข้องาน')) ? '' : 'none'; }
        // Show project filter toggle only for admin/ceo
        const toggleContainer = document.getElementById('proj-filter-toggle-container');
        const role = this.state.currentUser?.role || 'worker';
        const lowerRole = role.toLowerCase();
        const isAdmin = role === 'admin' || role === 'reviewer2' || lowerRole.includes('admin') || lowerRole.includes('ceo');
        if (toggleContainer) {
            if (isAdmin) {
                toggleContainer.classList.remove('hidden');
                toggleContainer.classList.add('flex');
            } else {
                toggleContainer.classList.remove('flex');
                toggleContainer.classList.add('hidden');
            }
        }

        let filteredProjects = mockProjects;
        let filter = this.state.projectFilter || 'all';

        // Filter to 'related' only if selected
        if (filter === 'related' && this.state.currentUser) {
            const currentUserId = String(this.state.currentUser.id);
            filteredProjects = mockProjects.filter(p => p.team && p.team.some(id => String(id) === currentUserId || id == currentUserId));
        }

        // Pre-process and update statuses dynamically before filtering
        filteredProjects.forEach(p => {
            // Calculate progress based on Task Sections (หัวข้อ)
            const sections = this._getTaskSectionsForProject(p.id);
            const sectionsTotal = sections.length;
            let sectionsDone = 0;

            sections.forEach(sec => {
                const secTasks = mockTasks.filter(t => t.projectId === p.id && (t.sectionId === sec.id || (!t.sectionId && sec.id === sections[0].id)));
                if (secTasks.length > 0) {
                    // Section is done if ALL its tasks are 'done' or 'pending-review'
                    const allTasksDone = secTasks.every(t => t.status === 'done' || t.status === 'pending-review');
                    if (allTasksDone) {
                        sectionsDone++;
                    }
                }
            });

            // Calculate progress percentage
            const calculatedProgress = sectionsTotal > 0 ? Math.round((sectionsDone / sectionsTotal) * 100) : 0;
            p.progress = calculatedProgress; // Update project object state

            if (p.status !== 'cancelled' && p.status !== 'paused' && p.status !== 'hidden' && p.status !== 'deleted') {
                // Normalize legacy 'planned' to 'plan'
                if (p.status === 'planned') p.status = 'plan';

                const allTasks = mockTasks.filter(t => t.projectId === p.id);
                const hasTasksOrSections = sectionsTotal > 0 || allTasks.length > 0;

                let hasSubtasks = false;
                let anyTaskDone = false;
                allTasks.forEach(t => {
                    if (t.subtasks && t.subtasks.length > 0) hasSubtasks = true;
                    if (t.status === 'done' || t.status === 'pending-review') anyTaskDone = true;
                });

                if (calculatedProgress === 100 && p.status !== 'completed') {
                    p.status = 'completed';
                } else if (calculatedProgress > 0 && calculatedProgress < 100) {
                    p.status = 'in-progress';
                } else if (calculatedProgress === 0) {
                    if (anyTaskDone || hasSubtasks) {
                        p.status = 'in-progress';
                    } else if (hasTasksOrSections) {
                        p.status = 'todo';
                    } else {
                        p.status = 'plan';
                    }
                }
            }
        });

        // Apply text search
        const searchInput = document.getElementById('project-search-input');
        if (searchInput && searchInput.value.trim()) {
            const query = searchInput.value.toLowerCase().trim();
            filteredProjects = filteredProjects.filter(p => p.name.toLowerCase().includes(query));
        }

        // Apply status filter
        const statusFilter = document.getElementById('project-status-filter');
        if (statusFilter && statusFilter.value !== 'all') {
            filteredProjects = filteredProjects.filter(p => {
                const effectiveStatus = p.status || 'plan';
                return effectiveStatus === statusFilter.value || (statusFilter.value === 'plan' && effectiveStatus === 'planned');
            });
        } else {
            // If filter is "all", do NOT show hidden or deleted projects
            filteredProjects = filteredProjects.filter(p => p.status !== 'hidden' && p.status !== 'deleted');
        }

        if (filteredProjects.length === 0) {
            container.innerHTML = '<div class="col-span-full py-10 text-center text-gray-500">ไม่พบโปรเจกต์</div>';
            return;
        }

        filteredProjects.sort((a, b) => {
            const aPinned = a.pinned ? 1 : 0;
            const bPinned = b.pinned ? 1 : 0;
            return bPinned - aPinned;
        });

        filteredProjects.forEach(p => {
            const sections = this._getTaskSectionsForProject(p.id);
            const sectionsTotal = sections.length;
            const sectionsDone = sectionsTotal > 0 ? Math.round((p.progress / 100) * sectionsTotal) : 0;

            const statusLabel = p.status === 'completed' ? 'เสร็จสิ้น'
                : p.status === 'in-progress' ? 'กำลังดำเนินการ'
                    : p.status === 'todo' ? 'รอดำเนินการ'
                        : p.status === 'cancelled' ? 'ถูกยกเลิก'
                            : p.status === 'paused' ? 'พักชั่วคราว'
                                : p.status === 'hidden' ? 'ซ่อนงาน'
                                    : p.status === 'deleted' ? 'ลบโครงการ'
                                        : 'วางแผน';

            const badgeColor = p.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                : p.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                    : p.status === 'todo' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                        : p.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                            : p.status === 'paused' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                                : p.status === 'hidden' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300'
                                    : p.status === 'deleted' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-500/30 dark:text-gray-300';

            const projectColorClass = p.color || 'bg-blue-600';
            const progressBarColor = projectColorClass;
            const projectLightBgClass = projectColorClass.replace(/-\d{3,4}$/, '-50');

            const statusBorder = p.status === 'completed' ? 'border-t-green-500 dark:border-t-green-400'
                : p.status === 'in-progress' ? 'border-t-blue-500 dark:border-t-blue-400'
                    : p.status === 'todo' ? 'border-t-yellow-500 dark:border-t-yellow-400'
                        : p.status === 'cancelled' ? 'border-t-red-500 dark:border-t-red-400'
                            : p.status === 'paused' ? 'border-t-orange-500 dark:border-t-orange-400'
                                : p.status === 'hidden' ? 'border-t-gray-700 dark:border-t-gray-500'
                                    : p.status === 'deleted' ? 'border-t-red-500 dark:border-t-red-400'
                                        : 'border-t-gray-400 dark:border-t-gray-400';

            html += `
                <div class="relative ${projectLightBgClass} rounded-xl shadow p-5 border border-gray-100 hover:shadow-lg transition-shadow cursor-pointer flex flex-col min-h-[160px] overflow-hidden" onclick="App.openProject('${p.id}')">
                    <div class="absolute top-0 left-0 right-0 h-1.5 ${projectColorClass}"></div>
                    <div class="flex justify-between items-start mb-3 shrink-0">
                        <div class="flex items-center gap-2">
                            ${p.pinned ? '<i class="fa-solid fa-thumbtack text-blue-500 transform -rotate-45" title="ปักหมุดแล้ว"></i>' : ''}
                            <span class="px-2 py-1 text-xs font-semibold rounded-full ${badgeColor} shrink-0">${statusLabel}</span>
                            ${p.closedAt ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-800 text-white shrink-0"><i class="fa-solid fa-lock mr-1"></i>ปิดแล้ว</span>' : ''}
                            ${p.projectType === 'single' ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-white/80 text-gray-600 border border-gray-200 shrink-0"><i class="fa-solid fa-user mr-1"></i>ส่วนตัว</span>' : ''}
                            ${p.projectType === 'division' ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-white/80 text-gray-600 border border-gray-200 shrink-0"><i class="fa-solid fa-sitemap mr-1"></i>แผนก</span>' : ''}
                        </div>
                        <button class="text-gray-400 hover:text-gray-600 p-1 shrink-0" onclick="App.projectOptions(event, '${p.id}')"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                    </div>
                    <h3 class="font-bold text-gray-800 mb-2 line-clamp-2 project-name-display" title="${p.name}" data-no-i18n>${p.name}</h3>
                    <div class="flex items-center space-x-2 mb-auto shrink-0">
                        <div class="flex -space-x-2">
                            ${p.team.slice(0, 3).map(id => {
                const u = mockUsers.find(user => String(user.id) === String(id));
                return u ? `<img class="w-8 h-8 rounded-full border-2 border-white bg-white" src="${u.avatar}" title="${u.name}" data-no-i18n>` : '';
            }).join('')}
                            ${p.team.length > 3 ? `<div class="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">+${p.team.length - 3}</div>` : ''}
                        </div>
                    </div>
                    <div class="mt-4 shrink-0">
                        <div class="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
                            <span>${p.progress}% เสร็จสิ้น</span>
                            <span>${sectionsDone}/${sectionsTotal} หัวข้อ</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-1.5">
                            <div class="${progressBarColor} h-1.5 rounded-full transition-all duration-300" style="width: ${p.progress}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    openProject(id) {
        this.state.currentProject = id;
        this.state.viewedSupervisorFilters = {}; // Reset viewed state when opening a new project
        document.getElementById('view-projects').classList.add('hidden');
        document.getElementById('view-tasks').classList.remove('hidden');

        const proj = mockProjects.find(p => p.id === id);
        if (proj) {
            document.getElementById('task-project-name').innerText = proj.name;
            
            const pmContainer = document.getElementById('task-project-managers');
            if (pmContainer) {
                const managers = proj.managers || [];
                const comanagers = proj.comanagers || [];
                const allLeaders = [...new Set([...managers, ...comanagers])];
                
                let html = '';
                if (allLeaders.length > 0) {
                    html = allLeaders.map(uid => {
                        const u = mockUsers.find(user => user.id == uid);
                        if (u) {
                            const isManager = managers.includes(uid);
                            const roleText = isManager ? 'ผู้ดูแลโครงการ' : 'ผู้ดูแลโครงการร่วม';
                            const ringClass = isManager ? 'ring-2 ring-blue-500 ring-offset-1' : 'ring-1 ring-gray-300';
                            return `<img src="${u.avatar}" class="w-6 h-6 rounded-full ${ringClass} cursor-help hover:scale-110 transition-transform bg-white object-cover" title="${u.name} (${roleText})" alt="${u.name}">`;
                        }
                        return '';
                    }).join('');
                }
                pmContainer.innerHTML = html;
            }
        }
        this.renderTasks();
    },

    closeProject() {
        this.state.currentProject = null;
        document.getElementById('view-tasks').classList.add('hidden');

        if (this.state.previousViewForProject && this.state.previousViewForProject !== 'projects') {
            const prev = this.state.previousViewForProject;
            this.state.previousViewForProject = null;
            this.switchView(prev);
        } else {
            document.getElementById('view-projects').classList.remove('hidden');
        }
    },

    _taskSectionColors: ['#1e3a5f', '#1e40af', '#312e81', '#4c1d95', '#065f46', '#0e7490', '#9a3412', '#b45309'],

    _getTaskSectionsForProject(projectId) {
        return mockTaskSections
            .filter(s => s.projectId === projectId)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },

    addTaskSection() {
        if (this._projectIsClosed(this.state.currentProject)) return;
        const isManager = this.state.currentUser && ['admin', 'reviewer2', 'reviewer1', 'manager', 'supervisor'].includes(this.state.currentUser.role);
        if (!this.hasPermission('สร้างหัวข้องาน')) {
            App._showToast('คุณไม่มีสิทธิ์สร้างหัวข้องาน', 'error');
            return;
        }
        if (!this.state.currentProject) {
            this._showToast('กรุณาเลือกโปรเจกต์ก่อน', 'error');
            return;
        }
        const existing = this._getTaskSectionsForProject(this.state.currentProject);
        const defaultTitle = `KR1.${existing.length + 1}`;
        const defaultColor = this._taskSectionColors[existing.length % this._taskSectionColors.length];

        const modal = document.getElementById('add-task-section-modal');
        const titleInput = document.getElementById('ats-title');
        const colorInput = document.getElementById('ats-color');
        const preview = document.getElementById('ats-color-preview');
        if (!modal || !titleInput || !colorInput || !preview) return;

        titleInput.value = defaultTitle;
        titleInput.classList.remove('border-red-500');
        this.setAtsColor(defaultColor);
        modal.classList.remove('hidden');
        setTimeout(() => {
            titleInput.focus();
            titleInput.select();
        }, 50);
    },

    closeAddTaskSectionModal() {
        const modal = document.getElementById('add-task-section-modal');
        const titleInput = document.getElementById('ats-title');
        if (modal) modal.classList.add('hidden');
        if (titleInput) {
            titleInput.value = '';
            titleInput.classList.remove('border-red-500');
        }
        this.state.editingTaskSectionId = null;
        const titleEl = document.querySelector('#add-task-section-modal h2');
        if (titleEl) titleEl.textContent = 'เพิ่มหัวข้อ Task';
    },

    async submitAddTaskSection() {
        if (!this.state.currentProject) return;
        const titleInput = document.getElementById('ats-title');
        const colorInput = document.getElementById('ats-color');
        if (!titleInput || !colorInput) return;

        const title = titleInput.value.trim();
        if (!title) {
            titleInput.classList.add('border-red-500');
            titleInput.focus();
            return;
        }
        titleInput.classList.remove('border-red-500');

        if (this.state.editingTaskSectionId) {
            const sec = mockTaskSections.find(s => s.id === this.state.editingTaskSectionId);
            if (sec) {
                sec.title = title;
                sec.color = colorInput.value;
                
                // --- Supabase DB Sync ---
                if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !['p1', 'p2', 'p3', 'p4'].includes(String(this.state.currentProject))) {
                    try {
                        const { error } = await this._sbSaveSkippingMissing({ title: title, color: colorInput.value },
                            d => window.conworkSupabase.client.from('task_sections').update(d).eq('id', sec.id));
                        this._saveTopicColor(sec.id, colorInput.value);
                        if (error) console.error("Error updating task_section", error);
                    } catch (e) { console.error(e); }
                }

                this._saveData();
                this.renderTasks();
                this.closeAddTaskSectionModal();
                this._showToast(`แก้ไขหัวข้อ "${title}" แล้ว`, 'success');
            }
        } else {
            const existing = this._getTaskSectionsForProject(this.state.currentProject);
            let newId = 'sec-' + Date.now();
            let finalTitle = title;
            let finalColor = colorInput.value;

            // --- Supabase DB Sync ---
            if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !['p1', 'p2', 'p3', 'p4'].includes(String(this.state.currentProject))) {
                try {
                    /* a column this database lacks (e.g. color) is left out instead of stopping the topic from being created */
                    const { data, error } = await this._sbSaveSkippingMissing({
                        project_id: this.state.currentProject,
                        title: title,
                        color: finalColor,
                        display_order: existing.length
                    }, d => window.conworkSupabase.client.from('task_sections').insert(d).select().single());
                    if (data && !data.color) this._saveTopicColor(data.id, finalColor);
                    
                    if (error) {
                        console.error("Error inserting task_section", error);
                        alert(`เกิดข้อผิดพลาดในการสร้างหัวข้องาน:\n${error.message}`);
                        return;
                    } else if (data) {
                        newId = data.id; // Use UUID from Supabase
                    }
                } catch (e) { 
                    console.error(e); 
                    alert(`เกิดข้อผิดพลาด:\n${e.message}`);
                    return;
                }
            }

            const section = {
                id: newId,
                projectId: this.state.currentProject,
                title: finalTitle,
                color: finalColor,
                order: existing.length
            };
            mockTaskSections.push(section);
            this._saveData();
            this.renderTasks();
            this.closeAddTaskSectionModal();
            this._showToast(`เพิ่มหัวข้อ "${section.title}" แล้ว`, 'success');
        }
    },

    taskSectionOptions(event, sectionId) {
        this.state.contextTaskSectionId = sectionId;
        const menu = document.getElementById('task-section-context-menu');
        if (!menu) return;

        const sec = mockTaskSections.find(s => s.id === sectionId);
        const hideBtn = document.getElementById('tscm-hide-btn');
        if (sec && hideBtn) {
            hideBtn.innerHTML = sec.collapsed
                ? '<i class="fa-solid fa-eye text-gray-500 w-4"></i> แสดงงาน'
                : '<i class="fa-solid fa-eye-slash text-gray-500 w-4"></i> ซ่อนงาน';
        }

        menu.classList.remove('hidden');
        const rect = event.currentTarget.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY + 5}px`;
        menu.style.left = `${rect.right + window.scrollX - menu.offsetWidth}px`;
    },

    editTaskSectionFromMenu() {
        const sectionId = this.state.contextTaskSectionId;
        if (!sectionId) return;
        const sec = mockTaskSections.find(s => s.id === sectionId);
        if (!sec) return;

        const modal = document.getElementById('add-task-section-modal');
        const titleInput = document.getElementById('ats-title');
        const colorInput = document.getElementById('ats-color');
        const preview = document.getElementById('ats-color-preview');

        if (!modal || !titleInput || !colorInput || !preview) return;

        this.state.editingTaskSectionId = sectionId;
        const titleEl = document.querySelector('#add-task-section-modal h2');
        if (titleEl) titleEl.textContent = 'แก้ไขหัวข้อ Task';

        titleInput.value = sec.title;
        this.setAtsColor(sec.color || '#1e3a5f');

        modal.classList.remove('hidden');
        document.getElementById('task-section-context-menu').classList.add('hidden');
    },

    toggleHideTaskSectionFromMenu() {
        const sectionId = this.state.contextTaskSectionId;
        if (!sectionId) return;
        const sec = mockTaskSections.find(s => s.id === sectionId);
        if (!sec) return;

        sec.collapsed = !sec.collapsed;
        this._saveData();
        this.renderTasks();
        document.getElementById('task-section-context-menu').classList.add('hidden');
    },

    setAtsColor(color) {
        document.getElementById('ats-color').value = color;
        const preview = document.getElementById('ats-color-preview');
        if (preview) preview.style.backgroundColor = color;

        // Update rings on the buttons
        document.querySelectorAll('.ats-color-btn').forEach(btn => {
            if (btn.getAttribute('data-color') === color) {
                btn.classList.add('ring-2', 'ring-offset-2', 'ring-gray-400');
            } else {
                btn.classList.remove('ring-2', 'ring-offset-2', 'ring-gray-400');
            }
        });
    },


    deleteTaskSectionFromMenu() {
        const sectionId = this.state.contextTaskSectionId;
        if (!sectionId) return;
        const sec = mockTaskSections.find(s => s.id === sectionId);
        if (sec) {
            this.state.sectionToDelete = sectionId;
            document.getElementById('delete-task-section-name').textContent = sec.title;
            document.getElementById('confirm-delete-task-section-modal').classList.remove('hidden');
        }
        document.getElementById('task-section-context-menu').classList.add('hidden');
    },

    cancelDeleteTaskSection() {
        this.state.sectionToDelete = null;
        document.getElementById('confirm-delete-task-section-modal').classList.add('hidden');
    },

    async confirmDeleteTaskSection() {
        const sectionId = this.state.sectionToDelete;
        if (!sectionId) return;

        // --- Supabase DB Sync ---
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !String(sectionId).startsWith('mock_')) {
            try {
                // Since tasks have ON DELETE SET NULL, we should delete the section first
                // Or if we want to delete tasks, we can just delete the section and let the DB cascade
                // Wait, tasks have ON DELETE SET NULL for section_id in schema, meaning they become orphaned, not deleted!
                // But locally we delete the tasks! Let's delete the tasks from DB first if we want them deleted.
                const tasksToDelete = mockTasks.filter(t => t.sectionId === sectionId).map(t => t.id);
                if (tasksToDelete.length > 0) {
                    await window.conworkSupabase.client.from('tasks').delete().in('id', tasksToDelete);
                }
                const { error } = await window.conworkSupabase.client.from('task_sections').delete().eq('id', sectionId);
                if (error) {
                    console.error('Error deleting task section from Supabase:', error);
                    alert(`เกิดข้อผิดพลาดในการลบหัวข้องาน: ${error.message}`);
                    return;
                }
            } catch (e) {
                console.error('Exception deleting task section', e);
            }
        }

        for (let i = mockTasks.length - 1; i >= 0; i--) {
            if (mockTasks[i].sectionId === sectionId) {
                mockTasks.splice(i, 1);
            }
        }
        const secIdx = mockTaskSections.findIndex(s => s.id === sectionId);
        if (secIdx > -1) {
            mockTaskSections.splice(secIdx, 1);
        }

        if (this.state.currentProject) {
            const remainingTasks = mockTasks.filter(t => t.projectId === this.state.currentProject);
            const proj = mockProjects.find(p => p.id === this.state.currentProject);
            if (proj) {
                proj.tasksTotal = remainingTasks.length;
                proj.tasksDone = remainingTasks.filter(t => t.status === 'done').length;
                proj.progress = proj.tasksTotal > 0 ? (proj.tasksDone / proj.tasksTotal) * 100 : 0;

                if (remainingTasks.length === 0) {
                    if (proj.status !== 'cancelled' && proj.status !== 'paused' && proj.status !== 'hidden' && proj.status !== 'deleted') {
                        proj.status = 'planned';
                    }
                } else if (proj.tasksTotal > 0 && proj.tasksDone === proj.tasksTotal) {
                    proj.status = 'completed';
                }
            }
        }

        this._saveData();
        this.renderTasks();
        this.renderProjects();
        this.cancelDeleteTaskSection();
    },

    createTaskInSection(sectionId) {
        if (this.state.currentProject && this._projectIsClosed(this.state.currentProject)) return;
        if (!this.state.currentProject) {
            this._showToast('กรุณาเลือกโปรเจกต์ก่อน', 'error');
            return;
        }
        this.state.creatingTaskSectionId = sectionId;
        this.state.editingTaskId = null;
        this.createTask();
    },

    openDatePicker(inputId) {
        const el = document.getElementById(inputId);
        if (!el) return;
        if (typeof el.showPicker === 'function') {
            try { el.showPicker(); return; } catch (e) { /* fallback */ }
        }
        el.focus();
        el.click();
    },

    _getActiveReviewer(task) {
        if (!task.reviewers || task.reviewers.length === 0) return null;
        const unapproved = task.reviewers.filter(r => !r.approved);
        if (unapproved.length === 0) return null;
        // highest order goes first
        return unapproved.sort((a, b) => b.order - a.order)[0];
    },

    _canUserReviewTask(task, userId, role) {
        if (!userId) return false;
        const uIdStr = String(userId);

        // Creator of task can review work
        if (task.creatorId && String(task.creatorId) === uIdStr) return true;
        if (task.createdBy && String(task.createdBy) === uIdStr) return true;

        if (task.status === 'pending-review' || task.status === 'in_review') {
            const activeRev = this._getActiveReviewer(task);
            if (activeRev) {
                return String(activeRev.userId) === uIdStr;
            } else {
                return (role === 'reviewer1' || role === 'reviewer2' || role === 'admin' || role === 'super_admin' || role === 'Company_admin');
            }
        }

        return (role === 'reviewer1' || role === 'reviewer2' || role === 'admin' || role === 'super_admin' || role === 'Company_admin');
    },

    _buildTaskCardHtml(t) {
        const assignees = Array.from(new Set([...(t.assignees || []), ...(t.relatedUsers || [])]));
        const curUserId = this.state.currentUser ? String(this.state.currentUser.id) : null;
        const isUserAssigned = curUserId && assignees.some(id => String(id) === curUserId);
        const isCreator = curUserId && (String(t.creatorId) === curUserId || String(t.creator) === curUserId);
        const isSupervisor = this.state.currentUser && this._canUserReviewTask(t, this.state.currentUser.id, this.state.currentUser.role);
        const canEditSubtask = isUserAssigned || isCreator || isSupervisor;
        let assigneesHtml = '<div></div>';
        if (assignees.length > 0) {
            const users = assignees.map(id => mockUsers.find(user => user.id == id)).filter(Boolean);
            const maxToShow = 3;
            const shownUsers = users.slice(0, maxToShow);
            const remaining = users.length - maxToShow;

            assigneesHtml = `<div class="flex items-center -space-x-1.5 relative z-30">`;
            shownUsers.forEach((u, idx) => {
                assigneesHtml += `<img src="${u.avatar}" class="w-6 h-6 rounded-full border border-white relative z-[${10 - idx}] shadow-sm" title="${u.name}" data-no-i18n>`;
            });
            if (remaining > 0) {
                assigneesHtml += `<div class="w-6 h-6 rounded-full border border-white bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-600 relative z-0 shadow-sm">+${remaining}</div>`;
            }
            assigneesHtml += `</div>`;
        }

        const _fmtDate = (dateStr) => {
            if (!dateStr) return '-';
            const d = new Date(dateStr + 'T00:00:00');
            const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
        };
        const _daysLeft = (dateStr) => {
            if (!dateStr) return null;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const due = new Date(dateStr + 'T00:00:00');
            return Math.ceil((due - today) / 86400000);
        };

        let dateInfoHtml = '';
        const proj = mockProjects.find(p => p.id === this.state.currentProject);
        const hasDate = (proj && proj.startDate) || t.dueDate;
        if (hasDate) {
            const days = _daysLeft(t.dueDate);
            let badgeClass = 'text-green-600 bg-green-50 border-green-200';
            let badgeIcon = 'fa-circle-check';
            if (days !== null) {
                if (days < 0) { badgeClass = 'text-red-600 bg-red-50 border-red-200'; badgeIcon = 'fa-circle-exclamation'; }
                else if (days <= 3) { badgeClass = 'text-orange-500 bg-orange-50 border-orange-200'; badgeIcon = 'fa-triangle-exclamation'; }
                else if (days <= 7) { badgeClass = 'text-yellow-600 bg-yellow-50 border-yellow-200'; badgeIcon = 'fa-clock'; }
            }
            const daysLabel = days === null ? ''
                : days < 0 ? `เกินกำหนด ${Math.abs(days)} วัน`
                    : days === 0 ? 'ครบกำหนดวันนี้!'
                        : `เหลือ ${days} วัน`;

            dateInfoHtml = `
                <div class="mt-2 mb-2 px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-100 text-[10px] space-y-1" onclick="event.stopPropagation()">
                    ${proj && proj.startDate ? `
                    <div class="flex items-center gap-1.5 text-gray-500 leading-tight">
                        <i class="fa-solid fa-circle-play text-emerald-400 w-3"></i>
                        <span>เริ่มต้น : </span>
                        <span class="text-gray-700 font-semibold">${_fmtDate(proj.startDate)}</span>
                    </div>` : ''}
                    ${t.dueDate ? `
                    <div class="flex items-center gap-1.5 text-gray-500 leading-tight">
                        <i class="fa-solid fa-flag-checkered text-blue-400 w-3"></i>
                        <span>กำหนด : </span>
                        <span class="text-gray-700 font-semibold">${_fmtDate(t.dueDate)}${t.dueTime ? ' เวลา ' + t.dueTime + ' น.' : ''}</span>
                    </div>` : ''}
                    ${t.submittedAt ? `
                    <div class="flex items-center gap-1.5 text-gray-500 leading-tight">
                        <i class="fa-solid fa-paper-plane text-purple-400 w-3"></i>
                        <span>ส่งเมื่อ : </span>
                        <span class="text-gray-700 font-semibold">${new Date(t.submittedAt).toLocaleDateString('th-TH', {day: 'numeric', month: 'short', year: 'numeric'})} ${new Date(t.submittedAt).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.</span>
                    </div>` : ''}
                    ${daysLabel ? `
                    <div class="flex items-center gap-1 font-bold ${badgeClass} border px-1.5 py-0.5 rounded-md w-fit mt-0.5">
                        <i class="fa-solid ${badgeIcon}"></i>
                        <span>${daysLabel}</span>
                    </div>` : ''}
                </div>
            `;
        }

        let subtasksHtml = '';
        const subtasks = t.subtasks || [];
        const doneCnt = subtasks.filter(st => st.done).length;
        const progressPct = subtasks.length > 0 ? Math.round((doneCnt / subtasks.length) * 100) : 0;
        const allReviewed = subtasks.length === 0 || subtasks.every(st => st.approved || st.rejected);
        const allPassed = subtasks.length === 0 || subtasks.every(st => st.approved);

        subtasksHtml = `
            <div class="mt-3 pt-3 border-t border-gray-100" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-1.5">
                        <span class="text-xs font-semibold text-gray-500">คำสั่งย่อย</span>
                        ${t.status !== 'done' ? `
                        <button type="button" class="w-5 h-5 rounded bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors shadow-sm" title="เพิ่มคำสั่งย่อย" onclick="event.stopPropagation(); App.quickAddSubtask('${t.id}')">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>` : ''}
                    </div>
                    <span class="text-xs text-gray-400">${doneCnt}/${subtasks.length}</span>
                </div>
                ${subtasks.length > 0 ? `
                <div class="w-full bg-gray-100 rounded-full h-1.5 mb-2.5">
                    <div class="bg-blue-500 h-1.5 rounded-full transition-all" style="width:${progressPct}%"></div>
                </div>
                ` : ''}
                <div class="space-y-2 mt-3">
                    ${subtasks.map((st, idx) => `
                        <div onclick="event.stopPropagation(); App.openTaskDetailView('${t.id}', ${idx})" 
                             class="flex items-center gap-2 ${st.approved ? 'bg-green-100 border-green-300' : (st.rejected ? 'bg-red-100 border-red-300' : 'bg-white border-gray-100')} p-2 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all group/st ${t.status === 'done' ? 'opacity-90' : ''}">
                            <input type="checkbox" ${st.done ? 'checked' : ''}
                                ${(!canEditSubtask || t.status === 'done') ? 'disabled' : ''}
                                onclick="event.stopPropagation()"
                                onchange="App.toggleCardSubtask('${t.id}', ${idx})"
                                class="w-4 h-4 text-blue-600 border-gray-300 rounded shrink-0 ${(!canEditSubtask || t.status === 'done') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
                            <span class="text-xs truncate flex-1 ${st.done ? 'line-through text-gray-400' : 'text-gray-700'}" data-no-i18n>${st.text}</span>
                            ${st.files && st.files.length > 0 ? `<i class="fa-solid fa-paperclip text-[10px] text-gray-400"></i>` : ''}
                            ${st.description ? `<i class="fa-solid fa-align-left text-[10px] text-gray-400"></i>` : ''}
                            ${st.completedBy || st.lastModifiedBy ? (() => {
                                const actorId = st.completedBy || st.lastModifiedBy;
                                const actor = mockUsers.find(u => u.id == actorId);
                                return actor ? `<img src="${actor.avatar}" class="w-4 h-4 rounded-full border border-gray-200 ml-1 shrink-0 shadow-sm" title="ทำโดย: ${actor.name}" data-no-i18n>` : '';
                            })() : ''}
                            ${(canEditSubtask && t.status !== 'done' && t.status !== 'pending-review') ? `
                                <button type="button" onclick="event.stopPropagation(); App.deleteSubtaskDirect('${t.id}', ${idx})" class="text-gray-400 hover:text-red-500 w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 opacity-0 group-hover/st:opacity-100 transition-all shrink-0" title="ลบคำสั่งย่อย">
                                    <i class="fa-solid fa-trash-can text-[10px]"></i>
                                </button>
                            ` : ''}
                            ${(isSupervisor && (t.status === 'pending-review' || t.status === 'done')) ? `
                                <div class="flex gap-1 shrink-0">
                                    <button type="button" ${t.status === 'done' ? 'disabled' : `onclick="event.stopPropagation(); App.toggleSubtaskApprove('${t.id}', ${idx})"`} class="w-14 text-[10px] font-bold py-1 px-2 rounded border ${st.approved ? 'bg-green-500 border-green-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-500'} ${t.status === 'done' ? 'opacity-80 cursor-default' : 'hover:bg-green-50 hover:text-green-600 hover:border-green-300'} transition-colors">
                                        ${st.approved ? 'ผ่านแล้ว' : 'ผ่าน'}
                                    </button>
                                    <button type="button" ${t.status === 'done' ? 'disabled' : `onclick="event.stopPropagation(); App.toggleSubtaskReject('${t.id}', ${idx})"`} class="w-14 text-[10px] font-bold py-1 px-2 rounded border ${st.rejected ? 'bg-red-500 border-red-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-500'} ${t.status === 'done' ? 'opacity-80 cursor-default' : 'hover:bg-red-50 hover:text-red-600 hover:border-red-300'} transition-colors">
                                        ไม่ผ่าน
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        const isPending = t.status === 'pending-review';
        const isRevealed = this.state.revealedTasks && this.state.revealedTasks[t.id];
        const canCancel = isUserAssigned;

        const isDone = t.status === 'done';
        const pendingOverlay = (isPending && !isRevealed) ? `
            <div class="absolute inset-0 bg-gray-200/40 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center pointer-events-none gap-2">
                <button type="button" onclick="event.stopPropagation(); ${isSupervisor ? `App.revealTask('${t.id}')` : ''}" class="pointer-events-auto bg-gray-800 text-white ${isSupervisor ? 'hover:bg-gray-700 cursor-pointer' : 'cursor-default'} px-4 py-2 rounded-full text-xs font-bold shadow-lg transition-colors flex items-center gap-2">
                    <i class="fa-solid fa-magnifying-glass text-[10px]"></i> รอตรวจสอบ
                </button>
                ${isSupervisor ? `
                <div class="flex gap-2 pointer-events-auto">
                    <button type="button" class="${allReviewed ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-gray-400 cursor-not-allowed opacity-70'} px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5" title="${allReviewed ? 'ส่งกลับแก้ไข' : 'ตรวจคำสั่งย่อยให้ครบก่อน'}" onclick="event.stopPropagation(); ${allReviewed ? `App.revealTask('${t.id}'); App.rejectTask('${t.id}')` : `App._showToast('กรุณาตรวจคำสั่งย่อยให้ครบทุกข้อก่อน', 'error')`}">
                        <i class="fa-solid fa-rotate-left text-[10px]"></i> ส่งกลับ
                    </button>
                    <button type="button" class="${allPassed ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-white text-gray-400 cursor-not-allowed opacity-70'} px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5" title="${allPassed ? 'อนุมัติงาน' : (allReviewed ? 'ไม่สามารถอนุมัติ มีคำสั่งย่อยที่ไม่ผ่าน' : 'ตรวจคำสั่งย่อยให้ครบก่อน')}" onclick="event.stopPropagation(); ${allPassed ? `App.approveTask('${t.id}')` : (allReviewed ? `App._showToast('ไม่สามารถอนุมัติได้เนื่องจากมีคำสั่งย่อยที่ไม่ผ่าน','error')` : `App._showToast('กรุณาตรวจคำสั่งย่อยให้ครบทุกข้อก่อน','error')`)}">
                        <i class="fa-solid fa-check-double text-[10px]"></i> อนุมัติ
                    </button>
                </div>
                ` : ''}
                ${canCancel ? `
                <button type="button" onclick="event.stopPropagation(); App.cancelTaskSubmission('${t.id}')" class="pointer-events-auto bg-white border border-gray-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5">
                    <i class="fa-solid fa-xmark text-[10px]"></i> ยกเลิกการส่งงาน
                </button>
                ` : ''}
            </div>
        ` : '';

        const doneOverlay = (isDone && !isRevealed) ? `
            <div class="absolute inset-0 bg-green-50/60 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center pointer-events-none gap-2">
                <div class="bg-green-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 shadow-green-500/30">
                    <i class="fa-solid fa-circle-check text-[10px]"></i> เสร็จสิ้น
                </div>
                <button type="button" onclick="event.stopPropagation(); App.revealTask('${t.id}')" class="pointer-events-auto mt-1 bg-white border border-green-200 text-green-600 hover:bg-green-50 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5">
                    <i class="fa-solid fa-eye text-[10px]"></i> ดูงาน
                </button>
            </div>
        ` : '';

        const rejectedOverlay = (t.isRejected && !isRevealed && (t.status === 'in-progress' || t.status === 'todo')) ? `
            <div class="absolute inset-0 bg-red-50/70 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center pointer-events-none gap-2">
                <button type="button" onclick="event.stopPropagation(); App.revealTask('${t.id}')" class="pointer-events-auto bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-full text-xs font-bold shadow-lg shadow-red-500/30 transition-colors cursor-pointer flex items-center gap-2 animate-pulse">
                    <i class="fa-solid fa-rotate-left text-[10px]"></i> งานถูกส่งกลับแก้ไข
                </button>
                <span class="text-[10px] text-red-500 font-bold bg-white px-2 py-0.5 rounded shadow-sm">คลิกเพื่อดูรายละเอียดและแก้ไข</span>
            </div>
        ` : '';

        const cardBgClass = isPending ? 'bg-gray-100 border-gray-200' : (isDone ? 'bg-green-50/30 border-green-200' : (t.isRejected && !isRevealed ? 'bg-red-50/30 border-red-200' : 'bg-white border-gray-100'));

        return `
        <div data-task-id="${t.id}" class="relative ${cardBgClass} p-3 rounded-xl shadow-sm border mb-2 cursor-pointer hover:shadow-md transition-shadow group overflow-hidden" onclick="App.openTaskDetailView('${t.id}')">
            ${pendingOverlay}
            ${doneOverlay}
            ${rejectedOverlay}
            <p class="font-medium text-sm text-gray-800 mb-1 group-hover:text-blue-600 transition-colors" data-no-i18n>${t.title}</p>
            ${t.isDraft ? '<div class="mb-2"><span class="text-xs text-blue-500 font-bold bg-blue-50 px-2 py-1 rounded border border-blue-200 inline-flex items-center"><i class="fa-solid fa-pen-ruler mr-1.5"></i> บันทึกแบบร่าง</span></div>' : ''}
            ${(t.isRejected && (t.status === 'in-progress' || t.status === 'todo')) ? '<div class="mb-2"><span class="text-xs text-red-600 font-bold bg-red-50 px-2 py-1 rounded border border-red-200 inline-flex items-center"><i class="fa-solid fa-rotate-left mr-1.5"></i> ส่งกลับแก้ไข</span></div>' : ''}
            ${(isDone && isRevealed) ? '<div class="mb-2"><span class="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded border border-green-200 inline-flex items-center"><i class="fa-solid fa-circle-check mr-1.5"></i> เสร็จสิ้น</span></div>' : ''}
            ${(() => {
                if (isPending) {
                    const activeRev = this._getActiveReviewer(t);
                    if (activeRev) {
                        const au = mockUsers.find(mu => mu.id === activeRev.userId);
                        if (au) return `<div class="mb-2"><span class="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-1 rounded border border-purple-200 inline-flex items-center"><i class="fa-solid fa-user-clock mr-1.5"></i> รอตรวจโดย : ${au.name}</span></div>`;
                    }
                }
                return '';
            })()}
            ${dateInfoHtml}
            ${subtasksHtml}
                <div class="flex justify-between items-center mt-3 relative z-30">
                    ${assigneesHtml}
                    <div class="flex items-center gap-2 relative z-30">
                    ${t.files && t.files.length > 0 ? `<span class="text-xs text-gray-400 font-medium"><i class="fa-solid fa-paperclip mr-1"></i>${t.files.length}</span>` : ''}
                    
                    ${(isSupervisor && isPending && isRevealed) ? `
                    <button type="button" class="${allReviewed ? 'text-red-600 bg-red-50 border-red-200 hover:bg-red-600 hover:text-white cursor-pointer' : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-80'} border px-2.5 py-1 rounded text-[10px] font-bold transition-colors shadow-sm" onclick="event.stopPropagation(); ${allReviewed ? `App.rejectTask('${t.id}')` : `App._showToast('กรุณาตรวจคำสั่งย่อยให้ครบทุกข้อก่อน', 'error')`}">
                        <i class="fa-solid fa-rotate-left mr-1"></i>ส่งกลับแก้ไข
                    </button>
                    <button type="button" class="${allPassed ? 'text-green-600 bg-green-50 border-green-200 hover:bg-green-600 hover:text-white cursor-pointer' : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-80'} border px-2.5 py-1 rounded text-[10px] font-bold transition-colors shadow-sm" onclick="event.stopPropagation(); ${allPassed ? `App.approveTask('${t.id}')` : (allReviewed ? `App._showToast('ไม่สามารถอนุมัติได้เนื่องจากมีคำสั่งย่อยที่ไม่ผ่าน', 'error')` : `App._showToast('กรุณาตรวจคำสั่งย่อยให้ครบทุกข้อก่อน', 'error')`)}">
                        <i class="fa-solid fa-check-double mr-1"></i>อนุมัติงาน
                    </button>
                    ` : ''}
                    
                    ${(t.status !== 'done' || isSupervisor) ? `
                    <button type="button" class="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="ลบ" onclick="event.stopPropagation(); App.deleteTaskDirect('${t.id}')">
                        <i class="fa-solid fa-trash text-sm"></i>
                    </button>
                    ` : ''}
                    
                    ${t.status !== 'done' ? `
                    <button type="button" class="text-gray-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100" title="แก้ไข" onclick="event.stopPropagation(); App.editTask('${t.id}')">
                        <i class="fa-solid fa-pen-to-square text-sm"></i>
                    </button>
                    ` : ''}

                    ${t.status !== 'done' && !(t.isRejected && !isRevealed) ? `
                    <button type="button" class="${(subtasks.length === 0 || doneCnt === subtasks.length) && (t.status === 'todo' || t.status === 'in-progress' || t.status === 'pending') ? 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-600 hover:text-white cursor-pointer' : 'text-gray-400 bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'} border px-2.5 py-1 rounded text-[10px] font-bold transition-colors shadow-sm animate-fade-in" title="ส่งงาน" onclick="event.stopPropagation(); ${(subtasks.length === 0 || doneCnt === subtasks.length) && (t.status === 'todo' || t.status === 'in-progress' || t.status === 'pending') ? `App.submitTask('${t.id}')` : `App._showToast('กรุณาทำเครื่องหมายถูกในคำสั่งย่อยให้ครบทุกข้อก่อนส่งงาน', 'error')`}">
                        <i class="fa-solid fa-paper-plane mr-1"></i>ส่งงาน
                    </button>
                    ` : ''}
                </div>
            </div>
        </div>`;
    },

    setSupervisorFilter(filter) {
        if (this.state.supervisorTaskFilter === filter) return;
        this.state.supervisorTaskFilter = filter;

        // Update button styles
        ['my', 'assign', 'review'].forEach(f => {
            const btn = document.getElementById(`sup-filter-${f}`);
            if (!btn) return;
            if (f === filter) {
                btn.className = 'flex items-center justify-center gap-1.5 px-6 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white shadow-sm transition-colors';
            } else {
                btn.className = 'flex items-center justify-center gap-1.5 px-6 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors';
            }
        });

        this.renderTasks();
    },

    renderTasks() {
        if (typeof this.syncSystemNotificationsFromData === 'function') {
            this.syncSystemNotificationsFromData();
        }
        // Sync open modal if any
        if (this.state && this.state.viewingTaskId && !document.getElementById('task-detail-view-modal').classList.contains('hidden')) {
            this.openTaskDetailView(this.state.viewingTaskId, this.state.viewingSubtaskIdx);
        }

        const board = document.getElementById('task-sections-board');
        if (!board || !this.state.currentProject) return;

        // Save scroll positions before re-render
        const boardScrollLeft = board.scrollLeft;
        const columnScrolls = {};
        board.querySelectorAll('.column-body').forEach(col => {
            const secId = col.getAttribute('data-section-id');
            if (secId) columnScrolls[secId] = col.scrollTop;
        });

        const role = this.state.currentUser ? this.state.currentUser.role : '';
        const addTaskBtn = document.getElementById('add-task-section-btn');
        if (addTaskBtn) {
            addTaskBtn.style.display = this.hasPermission('สร้างหัวข้องาน') ? '' : 'none';
        }

        const isManagerRole = role === 'admin' || role === 'reviewer2' || role === 'reviewer1' || role === 'manager' || role === 'supervisor';
        const canReviewAll = this.hasPermission('ตรวจงาน');
        const isReviewerForAny = mockTasks.some(t => t.projectId === this.state.currentProject && t.reviewers && t.reviewers.some(r => r.userId == this.state.currentUser.id));
        const canManage = isManagerRole || canReviewAll || isReviewerForAny;

        const supervisorFilters = document.getElementById('supervisor-task-filters');
        if (supervisorFilters) {
            if (canManage) {
                supervisorFilters.classList.remove('hidden');
                supervisorFilters.classList.add('flex');

                const projectId = this.state.currentProject;
                const activeFilter = this.state.supervisorTaskFilter || 'assign';
                if (!this.state.viewedSupervisorFilters) this.state.viewedSupervisorFilters = {};
                this.state.viewedSupervisorFilters[activeFilter] = true;

                const curUserId = String(this.state.currentUser.id);
                const isUserAssigned = (t) => {
                    const inAssignees = t.assignees && t.assignees.some(id => String(id) === curUserId || id == curUserId);
                    const inRelated = t.relatedUsers && t.relatedUsers.some(id => String(id) === curUserId || id == curUserId);
                    return inAssignees || inRelated;
                };

                const myCount = mockTasks.filter(t => t.projectId === projectId && isUserAssigned(t) && t.status !== 'done' && t.status !== 'pending-review').length;
                const reviewCount = mockTasks.filter(t => t.projectId === projectId && t.status === 'pending-review' && (this._canUserReviewTask(t, curUserId, role) || isUserAssigned(t))).length;
                const assignCount = mockTasks.filter(t => t.projectId === projectId && ((String(t.creatorId) === curUserId || String(t.creator) === curUserId) || !isUserAssigned(t)) && t.status !== 'done' && t.status !== 'pending-review').length;

                const myBadge = document.getElementById('badge-sup-my');
                if (myBadge) {
                    myBadge.textContent = myCount;
                    if (myCount > 0 && !this.state.viewedSupervisorFilters['my']) myBadge.classList.remove('hidden');
                    else myBadge.classList.add('hidden');
                }

                const assignBadge = document.getElementById('badge-sup-assign');
                if (assignBadge) {
                    assignBadge.textContent = assignCount;
                    if (assignCount > 0 && !this.state.viewedSupervisorFilters['assign']) assignBadge.classList.remove('hidden');
                    else assignBadge.classList.add('hidden');
                }

                const reviewBadge = document.getElementById('badge-sup-review');
                if (reviewBadge) {
                    reviewBadge.textContent = reviewCount;
                    if (reviewCount > 0 && !this.state.viewedSupervisorFilters['review']) reviewBadge.classList.remove('hidden');
                    else reviewBadge.classList.add('hidden');
                }
            } else {
                supervisorFilters.classList.add('hidden');
                supervisorFilters.classList.remove('flex');
            }
        }

        const projectId = this.state.currentProject;
        const sections = this._getTaskSectionsForProject(projectId);
        let allProjectTasks = mockTasks.filter(t => t.projectId === projectId && t.status !== 'deleted');
        const canViewAll = this.hasPermission('ดูงานทั้งหมด');

        // Apply baseline visibility for users who cannot see everything
        if (!isManagerRole && !canViewAll) {
            allProjectTasks = allProjectTasks.filter(t => {
                const curId = String(this.state.currentUser.id);
                const isAssignee = t.assignees && t.assignees.some(id => String(id) === curId || id == curId);
                const isCreator = (String(t.creatorId) === curId || String(t.creator) === curId);
                const isReviewer = t.reviewers && t.reviewers.some(r => String(r.userId) === curId || r.userId == curId);
                const isRelated = t.relatedUsers && t.relatedUsers.some(id => String(id) === curId || id == curId);

                return isAssignee || isCreator || isReviewer || isRelated;
            });
        }

        if (canManage) {
            const sFilter = this.state.supervisorTaskFilter || 'assign';
            const curUserId = String(this.state.currentUser.id);
            const isUserAssigned = (t) => {
                const inAssignees = t.assignees && t.assignees.some(id => String(id) === curUserId || id == curUserId);
                const inRelated = t.relatedUsers && t.relatedUsers.some(id => String(id) === curUserId || id == curUserId);
                return inAssignees || inRelated;
            };

            if (sFilter === 'my') {
                allProjectTasks = allProjectTasks.filter(t => isUserAssigned(t));
            } else if (sFilter === 'review') {
                allProjectTasks = allProjectTasks.filter(t => t.status === 'pending-review' && (this._canUserReviewTask(t, curUserId, role) || isUserAssigned(t)));
            } else {
                // assign: show all tasks (within baseline) created by me OR NOT assigned to me
                allProjectTasks = allProjectTasks.filter(t => ((String(t.creatorId) === curUserId || String(t.creator) === curUserId) || !isUserAssigned(t)));
            }
        }

        let incompleteCount = allProjectTasks.filter(t => t.status !== 'done').length;

        let html = '';
        sections.forEach((sec, secIdx) => {
            const tasks = allProjectTasks.filter(t => {
                if (t.sectionId === sec.id) return true;
                if (!t.sectionId && secIdx === 0) return true;
                return false;
            }).sort((a, b) => (a.order || 0) - (b.order || 0));

            // Hide empty columns unless on 'assign' tab for managers or single section
            const sFilter = this.state.supervisorTaskFilter || 'assign';
            const isAssignTab = (canManage && sFilter === 'assign');
            if (!isAssignTab && tasks.length === 0 && sections.length > 1) return;

            const doneCnt = tasks.filter(t => t.status === 'done' || t.status === 'pending-review').length;

            let totalSubtasks = 0;
            let doneSubtasks = 0;
            tasks.forEach(t => {
                if (t.subtasks && t.subtasks.length > 0) {
                    totalSubtasks += t.subtasks.length;
                    doneSubtasks += t.subtasks.filter(st => st.done).length;
                }
            });

            const activeTasks = tasks.filter(t => t.status !== 'pending-review' && t.status !== 'done');
            const reviewTasks = tasks.filter(t => t.status === 'pending-review');
            const doneTasks = tasks.filter(t => t.status === 'done');

            let columnContentHtml = activeTasks.map(t => this._buildTaskCardHtml(t)).join('');

            if (reviewTasks.length > 0) {
                columnContentHtml += `
                    <div class="relative flex items-center py-2 mt-4 mb-2">
                        <div class="flex-grow border-t border-black/10"></div>
                        <span class="flex-shrink-0 mx-3 text-[11px] font-bold text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-gray-200/50">
                            รอตรวจสอบ <span class="text-gray-400 font-normal ml-1">${reviewTasks.length}</span>
                        </span>
                        <div class="flex-grow border-t border-black/10"></div>
                    </div>
                ` + reviewTasks.map(t => this._buildTaskCardHtml(t)).join('');
            }

            if (doneTasks.length > 0) {
                const isExpanded = this.state.expandedDoneSections && this.state.expandedDoneSections[sec.id];
                columnContentHtml += `
                    <div class="relative flex items-center py-2 mt-4 mb-2 cursor-pointer hover:opacity-80 transition-opacity" onclick="App.toggleDoneTasks('${sec.id}')">
                        <div class="flex-grow border-t border-black/10"></div>
                        <span class="flex-shrink-0 mx-3 text-[11px] font-bold text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm border border-gray-200/50 flex items-center gap-1.5">
                            สำเร็จ <span class="text-gray-400 font-normal">${doneTasks.length}</span>
                            <i class="fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-gray-400 text-[10px]"></i>
                        </span>
                        <div class="flex-grow border-t border-black/10"></div>
                    </div>
                    <div id="done-tasks-${sec.id}" class="${isExpanded ? 'space-y-2' : 'hidden'}">
                        ${doneTasks.map(t => this._buildTaskCardHtml(t)).join('')}
                    </div>
                `;
            }

            html += `
                <div data-section-id="${sec.id}" class="w-[min(100%,22rem)] flex-shrink-0 flex flex-col min-h-0">
                    <div class="task-section-header rounded-2xl px-4 py-3 mb-3 flex items-center justify-between text-white shadow-md cursor-grab active:cursor-grabbing"
                         style="background-color: ${sec.color}">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="font-bold text-sm truncate" data-no-i18n>${sec.title}</span>
                            ${this.hasPermission('สร้างหัวข้องาน') ? `
                            <button type="button"
                                class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors shrink-0 relative z-50"
                                title="เพิ่ม Task ในหัวข้อนี้"
                                onmousedown="event.stopPropagation()"
                                onpointerdown="event.stopPropagation()"
                                ontouchstart="event.stopPropagation()"
                                onclick="event.stopPropagation(); App.createTaskInSection('${sec.id}')">
                                <i class="fa-solid fa-plus text-sm pointer-events-none"></i>
                            </button>
                            <button type="button"
                                class="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/20 transition-colors shrink-0 text-white/90 relative z-50"
                                title="ตัวเลือก"
                                onmousedown="event.stopPropagation()"
                                onpointerdown="event.stopPropagation()"
                                ontouchstart="event.stopPropagation()"
                                onclick="event.stopPropagation(); App.taskSectionOptions(event, '${sec.id}')">
                                <i class="fa-solid fa-ellipsis text-sm pointer-events-none"></i>
                            </button>
                            ` : ''}
                        </div>
                        <span class="text-xs font-semibold whitespace-nowrap ml-2">${doneCnt}/${tasks.length} ทาสก์</span>
                    </div>
                    <div data-section-id="${sec.id}" class="column-body flex-1 overflow-y-auto space-y-3 min-h-0 pr-1 pl-1 pt-1 pb-2 rounded-xl scrollbar-hide ${sec.collapsed ? 'hidden' : ''}" style="background-color: ${sec.color}1A;">
                        ${columnContentHtml}
                    </div>
                </div>
            `;
        });

        board.innerHTML = html;

        // Restore scroll positions after re-render
        board.scrollLeft = boardScrollLeft;
        board.querySelectorAll('.column-body').forEach(col => {
            const secId = col.getAttribute('data-section-id');
            if (secId && columnScrolls[secId] !== undefined) {
                col.scrollTop = columnScrolls[secId];
            }
        });

        if (window.Sortable) {
            new Sortable(board, {
                animation: 150,
                handle: '.task-section-header',
                onEnd: (evt) => {
                    const { oldIndex, newIndex } = evt;
                    if (newIndex !== oldIndex) {
                        const projSections = this._getTaskSectionsForProject(projectId);
                        const movedSec = projSections.splice(oldIndex, 1)[0];
                        projSections.splice(newIndex, 0, movedSec);

                        projSections.forEach((s, idx) => { s.order = idx; });
                        this._saveData();
                    }
                }
            });

            const columns = board.querySelectorAll('.column-body');
            columns.forEach(col => {
                new Sortable(col, {
                    group: 'shared',
                    animation: 150,
                    draggable: '.task-card', // Only allow dragging actual tasks, not dividers
                    onEnd: (evt) => {
                        const taskId = evt.item.getAttribute('data-task-id');
                        const newSectionId = evt.to.getAttribute('data-section-id');
                        const task = mockTasks.find(t => t.id === taskId);

                        if (task) {
                            task.sectionId = newSectionId;

                            const newColumnTasks = Array.from(evt.to.children).map(child => child.getAttribute('data-task-id'));
                            newColumnTasks.forEach((tid, idx) => {
                                const t = mockTasks.find(x => x.id === tid);
                                if (t) t.order = idx;
                            });

                            this._saveData();
                            this.renderTasks();
                        }
                    }
                });
            });
        }

        const countEl = document.getElementById('incomplete-tasks-count');
        if (countEl) countEl.innerText = incompleteCount;
    },

    toggleDoneTasks(sectionId) {
        if (!this.state.expandedDoneSections) {
            this.state.expandedDoneSections = {};
        }
        this.state.expandedDoneSections[sectionId] = !this.state.expandedDoneSections[sectionId];
        this.renderTasks();
    },

    toggleCardSubtask(taskId, subtaskIdx) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task || !task.subtasks || !task.subtasks[subtaskIdx]) return;
        task.subtasks[subtaskIdx].done = !task.subtasks[subtaskIdx].done;
        
        if (task.subtasks[subtaskIdx].done && this.state.currentUser) {
            task.subtasks[subtaskIdx].completedBy = this.state.currentUser.id;
        } else {
            task.subtasks[subtaskIdx].completedBy = null;
        }

        this._saveData();
        this._syncSubtasksToDB(taskId, task.subtasks);
        this.renderTasks();
    },

    deleteSubtaskDirect(taskId, subtaskIdx) {
        if (!confirm('ยืนยันการลบคำสั่งย่อยนี้?')) return;
        const task = mockTasks.find(t => t.id === taskId);
        if (task && task.subtasks && task.subtasks[subtaskIdx]) {
            task.subtasks.splice(subtaskIdx, 1);
            this._saveData();
            this._syncSubtasksToDB(taskId, task.subtasks);
            this.renderTasks();
            this._showToast('ลบคำสั่งย่อยเรียบร้อยแล้ว', 'success');
        }
    },

    toggleSubtaskApprove(taskId, subtaskIdx) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task || !task.subtasks || !task.subtasks[subtaskIdx]) return;
        task.subtasks[subtaskIdx].approved = !task.subtasks[subtaskIdx].approved;
        if (task.subtasks[subtaskIdx].approved) {
            task.subtasks[subtaskIdx].rejected = false;
        }
        this._saveData();
        this._syncSubtasksToDB(taskId, task.subtasks);
        this.renderTasks();
    },

    toggleSubtaskReject(taskId, subtaskIdx) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task || !task.subtasks || !task.subtasks[subtaskIdx]) return;
        task.subtasks[subtaskIdx].rejected = !task.subtasks[subtaskIdx].rejected;
        if (task.subtasks[subtaskIdx].rejected) {
            task.subtasks[subtaskIdx].approved = false;
        }
        this._saveData();
        this._syncSubtasksToDB(taskId, task.subtasks);
        this.renderTasks();
    },

    quickAddSubtask(taskId) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task) return;

        this.state.quickAddTaskId = taskId;
        this.state.tempSubtasks = task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : [];

        document.getElementById('quick-subtask-input').value = '';
        this.renderQuickSubtaskList();

        document.getElementById('quick-add-subtask-modal').classList.remove('hidden');
    },

    renderQuickSubtaskList() {
        const container = document.getElementById('quick-subtask-list');
        if (!container) return;

        if (this.state.tempSubtasks.length === 0) {
            container.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">ยังไม่มีคำสั่งย่อย</div>';
            return;
        }

        container.innerHTML = this.state.tempSubtasks.map((st, idx) => `
            <div class="flex items-center gap-3 bg-white p-2 rounded-lg border border-transparent hover:border-gray-100 transition-colors">
                <input type="checkbox" ${st.done ? 'checked' : ''} onchange="App.toggleTempSubtask(${idx})" class="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-pointer">
                <input type="text" value="${st.text}" onchange="App.updateTempSubtask(${idx}, this.value)" class="flex-1 bg-transparent border-none focus:outline-none text-sm text-gray-700 ${st.done ? 'line-through text-gray-400' : ''}">
                <button type="button" onclick="App.removeTempSubtask(${idx})" class="text-gray-400 hover:text-red-500 w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors" title="ลบคำสั่งย่อย">
                    <i class="fa-solid fa-trash-can text-[10px]"></i>
                </button>
            </div>
        `).join('');
    },

    quickSubtaskAddTemp() {
        const input = document.getElementById('quick-subtask-input');
        const text = input.value.trim();
        if (text) {
            this.state.tempSubtasks.push({ text: text, done: false });
            input.value = '';
            this.renderQuickSubtaskList();
        }
    },

    toggleTempSubtask(idx) {
        if (this.state.tempSubtasks[idx]) {
            this.state.tempSubtasks[idx].done = !this.state.tempSubtasks[idx].done;
            this.renderQuickSubtaskList();
        }
    },

    updateTempSubtask(idx, value) {
        if (this.state.tempSubtasks[idx]) {
            this.state.tempSubtasks[idx].text = value;
        }
    },

    removeTempSubtask(idx) {
        this.state.tempSubtasks.splice(idx, 1);
        this.renderQuickSubtaskList();
    },

    openSubtaskDetailModal(taskId, subtaskIdx) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task || !task.subtasks || !task.subtasks[subtaskIdx]) return;

        this.state.currentSubtaskContext = { taskId, subtaskIdx };
        const st = task.subtasks[subtaskIdx];

        const isDone = task.status === 'done';
        const isSupervisor = this.state.currentUser && (this.state.currentUser.role === 'reviewer1' || this.state.currentUser.role === 'reviewer2' || this.state.currentUser.role === 'admin');
        // Read-only if the task is completed, OR if the user is an employee and the task is under review/done
        const isReadOnly = isDone || (!isSupervisor && task.status !== 'todo' && task.status !== 'in-progress' && task.status !== 'draft');
        this.state.currentSubtaskIsReadOnly = isReadOnly;

        const titleEl = document.getElementById('sd-title');
        titleEl.value = st.text || '';
        titleEl.readOnly = isReadOnly;
        titleEl.className = isReadOnly ? "w-full border border-gray-200 rounded-xl py-2.5 px-4 text-sm shadow-sm bg-gray-50 text-gray-500 outline-none" : "w-full border border-gray-200 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm bg-white";

        const descEl = document.getElementById('sd-desc');
        descEl.innerHTML = st.description || '';
        if (isReadOnly) {
            descEl.setAttribute('contenteditable', 'false');
            descEl.className = "w-full py-3 px-4 focus:outline-none text-sm min-h-[100px] max-h-[300px] overflow-y-auto bg-gray-50 text-gray-500";
        } else {
            descEl.setAttribute('contenteditable', 'true');
            descEl.className = "w-full py-3 px-4 focus:outline-none text-sm min-h-[100px] max-h-[300px] overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400";
        }

        const formatToolbar = document.getElementById('sd-format-toolbar');
        if (formatToolbar) formatToolbar.style.display = isReadOnly ? 'none' : 'flex';

        const uploadBtn = document.getElementById('sd-upload-btn');
        if (uploadBtn) uploadBtn.style.display = isReadOnly ? 'none' : 'flex';

        const saveBtn = document.querySelector('#subtask-detail-modal button[onclick="App.saveSubtaskDetail()"]');
        if (saveBtn) saveBtn.style.display = isReadOnly ? 'none' : 'block';

        this.state.tempSubtaskFiles = st.files ? [...st.files] : [];
        this._renderSubtaskDetailFiles();

        document.getElementById('subtask-detail-modal').classList.remove('hidden');
        setTimeout(() => this._updateFormatToolbar('sd-format-toolbar', descEl, 'sd-desc'), 0);
    },

    closeSubtaskDetailModal() {
        document.getElementById('subtask-detail-modal').classList.add('hidden');
        this.state.currentSubtaskContext = null;
        this.state.tempSubtaskFiles = [];
    },

    saveSubtaskDetail() {
        if (!this.state.currentSubtaskContext) return;
        const { taskId, subtaskIdx } = this.state.currentSubtaskContext;

        const task = mockTasks.find(t => t.id === taskId);
        if (task && task.subtasks && task.subtasks[subtaskIdx]) {
            const st = task.subtasks[subtaskIdx];
            st.text = document.getElementById('sd-title').value.trim() || st.text;
            st.description = document.getElementById('sd-desc').innerHTML.trim();
            st.files = [...this.state.tempSubtaskFiles];
            
            if (this.state.currentUser) {
                st.lastModifiedBy = this.state.currentUser.id;
            }

            this._saveData();
            this._syncSubtasksToDB(taskId, task.subtasks);
            this.renderTasks();
            this._showToast('อัปเดตรายละเอียดคำสั่งย่อยแล้ว', 'success');
        }

        this.closeSubtaskDetailModal();
    },

    handleSubtaskFileUpload(event) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.state.tempSubtaskFiles.push({
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    url: e.target.result // Base64 data URL for preview
                });
                this._renderSubtaskDetailFiles();
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        event.target.value = '';
    },

    removeSubtaskFile(idx) {
        this.state.tempSubtaskFiles.splice(idx, 1);
        this._renderSubtaskDetailFiles();
    },

    _renderSubtaskDetailFiles() {
        const container = document.getElementById('sd-file-list');
        if (!container) return;

        if (!this.state.tempSubtaskFiles || this.state.tempSubtaskFiles.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400 italic">ยังไม่มีไฟล์แนบ</p>';
            return;
        }

        container.innerHTML = this.state.tempSubtaskFiles.map((f, idx) => {
            const isImage = f.type.startsWith('image/');
            const sizeKB = Math.round(f.size / 1024);
            const fileUrl = f.url || '#';
            return `
                <div class="flex items-center justify-between p-3 border border-gray-100 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow group">
                    <a href="${fileUrl}" download="${f.name}" data-no-i18n target="_blank" class="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer hover:opacity-80 transition-opacity" title="คลิกเพื่อดาวน์โหลด/เปิดไฟล์">
                        ${isImage ?
                    `<img src="${f.url}" class="w-10 h-10 object-cover rounded-md border border-gray-200 shrink-0 shadow-sm">` :
                    `<div class="w-10 h-10 bg-blue-50 text-blue-500 rounded-md flex items-center justify-center shrink-0 border border-gray-200"><i class="fa-solid fa-file-lines text-lg"></i></div>`
                }
                        <div class="flex flex-col min-w-0">
                            <span class="text-sm font-semibold text-blue-600 hover:underline truncate" data-no-i18n>${f.name}</span>
                            <span class="text-[10px] text-gray-400 mt-0.5">${sizeKB} KB</span>
                        </div>
                    </a>
                    <div class="flex items-center gap-1 shrink-0 ml-2">
                        <a href="${fileUrl}" download="${f.name}" data-no-i18n target="_blank" class="text-gray-400 hover:text-blue-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors" title="ดาวน์โหลด">
                            <i class="fa-solid fa-download text-sm"></i>
                        </a>
                        ${!this.state.currentSubtaskIsReadOnly ? `
                        <button type="button" onclick="App.removeSubtaskFile(${idx})" class="text-gray-400 hover:text-red-500 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" title="ลบไฟล์">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    closeQuickAddSubtaskModal() {
        document.getElementById('quick-add-subtask-modal').classList.add('hidden');
        this.state.quickAddTaskId = null;
        this.state.tempSubtasks = [];
    },

    confirmQuickAddSubtasks() {
        if (!this.state.quickAddTaskId) return;
        const task = mockTasks.find(t => t.id === this.state.quickAddTaskId);
        if (task) {
            task.subtasks = this.state.tempSubtasks;
            this._saveData();
            this._syncSubtasksToDB(task.id, task.subtasks);
            this.renderTasks();
            this._showToast('อัปเดตคำสั่งย่อยเรียบร้อยแล้ว', 'success');
            
            // Re-render TDV if open for the same task
            if (this.state.viewingTaskId === task.id) {
                this.openTaskDetailView(task.id, this.state.viewingSubtaskIdx);
            }
        }
        this.closeQuickAddSubtaskModal();
    },

    submitTask(taskId) {
        const task = mockTasks.find(t => t.id === taskId);
        if (task) {
            const st = task.subtasks || [];
            const doneCnt = st.filter(s => s.done).length;
            if (st.length > 0 && doneCnt < st.length) {
                this._showToast('กรุณาทำเครื่องหมายถูกในคำสั่งย่อยให้ครบทุกข้อก่อนส่งงาน', 'error');
                return;
            }
            this.state.taskToSubmit = taskId;
            document.getElementById('submit-task-name').textContent = task.title || 'ไม่มีชื่อ';
            document.getElementById('confirm-submit-modal').classList.remove('hidden');
        }
    },

    approveTask(taskId) {
        const task = mockTasks.find(t => t.id === taskId);
        if (task) {
            const st = task.subtasks || [];
            const allPassed = st.length === 0 || st.every(s => s.approved && !s.rejected);
            const allReviewed = st.length === 0 || st.every(s => s.approved || s.rejected);
            if (!allPassed) {
                if (!allReviewed) this._showToast('กรุณาตรวจคำสั่งย่อยให้ครบทุกข้อก่อน', 'error');
                else this._showToast('ไม่สามารถอนุมัติได้เนื่องจากมีคำสั่งย่อยที่ไม่ผ่าน', 'error');
                return;
            }
            this.closeCreateTaskModal();
            if (typeof this.closeTaskDetailViewModal === 'function') this.closeTaskDetailViewModal();
            const activeRev = this._getActiveReviewer(task);
            if (activeRev) {
                activeRev.approved = true;
                this._syncTaskDetailsToDB(task);

                // Check if there are still more unapproved reviewers
                const nextRev = this._getActiveReviewer(task);
                if (nextRev) {
                    this._saveData();
                    this.renderTasks();
                    this.renderProjects();
                    this._showToast(`อนุมัติงานแล้ว! รอตรวจลำดับต่อไป : ${nextRev.order}`, 'success');
                    return; // Stop here, task is still pending-review
                }
            }

            task.status = 'done';

            // Auto-reveal the task so "เสร็จสิ้น" badge shows immediately after approval
            if (!this.state.revealedTasks) this.state.revealedTasks = {};
            this.state.revealedTasks[taskId] = true;

            // Check project progress
            if (this.state.currentProject) {
                const proj = mockProjects.find(p => p.id === this.state.currentProject);
                if (proj) {
                    const remainingTasks = mockTasks.filter(t => t.projectId === this.state.currentProject);
                    proj.tasksTotal = remainingTasks.length;
                    proj.tasksDone = remainingTasks.filter(t => t.status === 'done').length;
                    proj.progress = proj.tasksTotal > 0 ? Math.round((proj.tasksDone / proj.tasksTotal) * 100) : 0;

                    if (proj.tasksTotal > 0 && proj.tasksDone === proj.tasksTotal) {
                        proj.status = 'completed';
                    }
                }
            }

            this._syncTaskStatusToDB(task.id, task.status);
            this._saveData();
            this.renderTasks();
            this.renderProjects();
            this._showToast('อนุมัติงานเรียบร้อยแล้ว! สถานะเปลี่ยนเป็น "เสร็จสิ้น" แล้ว', 'success');
        }
    },

    cancelTaskSubmission(taskId) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task) return;

        this.state.taskToCancelSubmit = taskId;
        document.getElementById('cancel-submission-task-name').textContent = task.title || 'ไม่มีชื่อ';
        document.getElementById('confirm-cancel-submission-modal').classList.remove('hidden');
    },

    closeCancelTaskSubmissionModal() {
        this.state.taskToCancelSubmit = null;
        document.getElementById('confirm-cancel-submission-modal').classList.add('hidden');
    },

    confirmCancelTaskSubmission() {
        const taskId = this.state.taskToCancelSubmit;
        if (!taskId) return;

        const task = mockTasks.find(t => t.id === taskId);
        if (task) {
            task.status = 'in-progress';
            if (this.state.revealedTasks && this.state.revealedTasks[taskId]) {
                delete this.state.revealedTasks[taskId];
            }
            this._syncTaskStatusToDB(task.id, task.status);
            this._saveData();
            this.renderTasks();
            this._showToast('ยกเลิกการส่งงานสำเร็จ', 'info');
        }

        this.closeCancelTaskSubmissionModal();
    },

    rejectTask(taskId) {
        const task = mockTasks.find(t => t.id === taskId);
        if (task) {
            const st = task.subtasks || [];
            const allReviewed = st.length === 0 || st.every(s => s.approved || s.rejected);
            if (!allReviewed) {
                this._showToast('กรุณาตรวจคำสั่งย่อยให้ครบทุกข้อก่อน', 'error');
                return;
            }
            this.closeCreateTaskModal();
            if (typeof this.closeTaskDetailViewModal === 'function') this.closeTaskDetailViewModal();
            task.status = 'in-progress';
            task.isRejected = true;

            if (task.reviewers && task.reviewers.length > 0) {
                task.reviewers.forEach(r => r.approved = false);
                this._syncTaskDetailsToDB(task);
            }

            if (this.state.revealedTasks && this.state.revealedTasks[taskId]) {
                delete this.state.revealedTasks[taskId];
            }

            this._syncTaskStatusToDB(task.id, task.status);
            this._saveData();
            this.renderTasks();
            this._showToast('ส่งกลับแก้ไขเรียบร้อยแล้ว', 'info');
        }
    },

    revealTask(taskId) {
        if (!this.state.revealedTasks) {
            this.state.revealedTasks = {};
        }
        this.state.revealedTasks[taskId] = true;
        this.renderTasks();
    },


    cancelSubmit() {
        this.state.taskToSubmit = null;
        document.getElementById('confirm-submit-modal').classList.add('hidden');
    },

    confirmSubmit() {
        if (!this.state.taskToSubmit) return;
        const task = mockTasks.find(t => t.id === this.state.taskToSubmit);
        if (task) {
            let hasReviewers = task.reviewers && task.reviewers.length > 0;
            const proj = mockProjects.find(p => p.id === task.projectId);

            if (!hasReviewers) {
                // If no specific reviewers set, automatically assign task creator and task assigner / project manager
                let defaultReviewers = [];
                if (proj && proj.managers && proj.managers.length > 0) {
                    defaultReviewers.push(...proj.managers);
                }
                if (proj && proj.manager) {
                    defaultReviewers.push(proj.manager);
                }
                if (proj && proj.createdBy) {
                    defaultReviewers.push(proj.createdBy);
                }
                if (task.creatorId) {
                    defaultReviewers.push(task.creatorId);
                }
                if (task.createdBy) {
                    defaultReviewers.push(task.createdBy);
                }
                if (task.assignedBy) {
                    defaultReviewers.push(task.assignedBy);
                }
                
                // Deduplicate reviewers
                const uniqueReviewerIds = [...new Set(defaultReviewers.filter(Boolean).map(id => String(id)))];
                
                if (uniqueReviewerIds.length > 0) {
                    task.reviewers = uniqueReviewerIds.map((mId, index) => ({
                        userId: mId,
                        order: index + 1,
                        approved: false
                    }));
                } else {
                    // Fallback to admin/manager role if no creator/manager found
                    const adminUser = mockUsers.find(u => u.role === 'admin' || u.role === 'reviewer1' || u.role === 'reviewer2');
                    if (adminUser) {
                        task.reviewers = [{ userId: String(adminUser.id), order: 1, approved: false }];
                    }
                }
                hasReviewers = task.reviewers && task.reviewers.length > 0;
            }

            // Always move to pending-review for verification
            task.status = 'pending-review';
            task.isRejected = false;
            task.submittedAt = new Date().toISOString();
            if (this.state.revealedTasks && this.state.revealedTasks[task.id]) {
                delete this.state.revealedTasks[task.id];
            }

            // Add notification to reviewers
            if (task.reviewers && task.reviewers.length > 0) {
                task.reviewers.forEach(rev => {
                    const msg = `งาน: ${task.title || 'ไม่มีชื่อ'}`;
                    if (typeof App.addNotification === 'function') {
                        App.addNotification('task', 'มีการส่งงานให้ตรวจ', msg, { view: 'tasks', projectId: task.projectId, taskId: task.id, targetUserId: rev.userId });
                    }
                });
            }

            this._syncTaskStatusToDB(task.id, task.status);
            this._saveData();
            this.renderTasks();
            this.showSubmitNotification();
        }
        this.cancelSubmit();
        this.closeCreateTaskModal();
        if (typeof this.closeTaskDetailViewModal === 'function') this.closeTaskDetailViewModal();
    },

    showSubmitNotification() {
        const el = document.createElement('div');
        el.className = 'fixed right-[-350px] top-24 bg-white shadow-xl rounded-2xl p-4 flex items-center gap-4 z-[1000] transition-all duration-500 ease-out border border-green-100';
        el.innerHTML = `
            <div class="text-4xl animate-bounce">🎉</div>
            <div>
                <p class="font-bold text-green-600 text-sm">ส่งงานเรียบร้อยแล้วครับ!</p>
                <p class="text-xs text-gray-500">รอการตรวจสอบจากหัวหน้า</p>
            </div>
        `;
        document.body.appendChild(el);

        // Slide in
        setTimeout(() => { el.style.right = '24px'; }, 50);

        // Slide out after 3 seconds
        setTimeout(() => {
            el.style.right = '-350px';
            setTimeout(() => el.remove(), 500);
        }, 3000);
    },

    filterTeam(cardType) {
        this.state.teamFilterCard = cardType;

        // Update active card styling
        document.querySelectorAll('.team-filter-card').forEach(el => {
            el.classList.remove('border-blue-400', 'border-green-400', 'border-purple-400', 'shadow-md');
            el.classList.add('border-gray-200');
        });

        const activeCard = document.getElementById(`team-filter-${cardType}`);
        if (activeCard) {
            activeCard.classList.remove('border-gray-200');
            if (cardType === 'all') activeCard.classList.add('border-blue-400', 'shadow-md');
            else if (cardType === 'online') activeCard.classList.add('border-green-400', 'shadow-md');
            else if (cardType === 'offline') activeCard.classList.add('border-purple-400', 'shadow-md');
        }

        this.renderTeam();
    },

    toggleTeamViewMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('team-view-dropdown');
        if (menu) menu.classList.toggle('hidden');
    },

    setTeamViewMode(mode) {
        this.state.teamViewMode = mode;
        this.toggleTeamViewMenu();

        // Update styling of buttons
        const btnGrid = document.getElementById('team-view-btn-grid');
        const btnList = document.getElementById('team-view-btn-list');
        const iconGrid = document.getElementById('team-view-icon-grid');
        const iconList = document.getElementById('team-view-icon-list');
        const mainIcon = document.getElementById('team-view-icon');

        if (btnGrid && btnList && iconGrid && iconList && mainIcon) {
            if (mode === 'grid') {
                btnGrid.classList.add('bg-blue-50/50', 'text-blue-600', 'font-medium');
                btnGrid.classList.remove('text-gray-700');
                iconGrid.classList.add('text-blue-500');
                iconGrid.classList.remove('text-gray-400');

                btnList.classList.remove('bg-blue-50/50', 'text-blue-600', 'font-medium');
                btnList.classList.add('text-gray-700');
                iconList.classList.remove('text-blue-500');
                iconList.classList.add('text-gray-400');

                mainIcon.className = 'fa-solid fa-table-cells-large';
            } else {
                btnList.classList.add('bg-blue-50/50', 'text-blue-600', 'font-medium');
                btnList.classList.remove('text-gray-700');
                iconList.classList.add('text-blue-500');
                iconList.classList.remove('text-gray-400');

                btnGrid.classList.remove('bg-blue-50/50', 'text-blue-600', 'font-medium');
                btnGrid.classList.add('text-gray-700');
                iconGrid.classList.remove('text-blue-500');
                iconGrid.classList.add('text-gray-400');

                mainIcon.className = 'fa-solid fa-list';
            }
        }

        this.renderTeam();
    },

    renderTeam() {
        const isManager = this.state.currentUser && ['admin', 'reviewer2', 'reviewer1', 'manager', 'supervisor'].includes(this.state.currentUser.role);
        const addMemberBtn = document.getElementById('btn-add-member');
        if (addMemberBtn) {
            addMemberBtn.style.display = (this.hasPermission('เพิ่มพนักงาน')) ? '' : 'none';
        }
        const container = document.getElementById('team-list-container');
        if (!container) return;

        // Show UI elements based on permission
        const canAddMember = this.hasPermission('เพิ่มพนักงาน');
        const role = (this.state.currentUser && this.state.currentUser.role) ? this.state.currentUser.role : 'worker';
        const lowerRole = role.toLowerCase();
        const isAdmin = role === 'admin' || role === 'reviewer2' || lowerRole.includes('admin') || lowerRole.includes('ceo');
        const teamHeader = document.getElementById('team-header-container');
        const btnAddMember = document.getElementById('btn-add-member');

        if (teamHeader) teamHeader.classList.toggle('hidden', !canAddMember);
        if (btnAddMember) btnAddMember.classList.toggle('hidden', !canAddMember);

        // 1. Populate Department Dropdown
        const deptSelect = document.getElementById('team-filter-dept');
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">ทุกแผนก</option>';
            const deptContainer = document.getElementById('dept-list-container');
            const depts = deptContainer
                ? Array.from(deptContainer.querySelectorAll('.dept-item span')).map(el => el.textContent.trim())
                : [...new Set(mockUsers.map(u => u.department))].filter(Boolean);

            depts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d;
                opt.textContent = d;
                deptSelect.appendChild(opt);
            });
            if (this.state.teamFilterDept) deptSelect.value = this.state.teamFilterDept;
        }

        // 1.5 Populate Role Dropdown
        const roleSelect = document.getElementById('team-filter-role');
        if (roleSelect) {
            roleSelect.innerHTML = '<option value="">ทุกตำแหน่ง</option>';
            const posContainer = document.getElementById('position-list-container');
            if (posContainer) {
                const positions = Array.from(posContainer.querySelectorAll('.position-item span')).map(el => el.textContent.trim());
                positions.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p;
                    opt.textContent = p;
                    roleSelect.appendChild(opt);
                });
            } else {
                roleSelect.innerHTML += `
                    <option value="admin">แอดมิน</option>
                    <option value="reviewer2">ผู้บริหาร</option>
                    <option value="reviewer1">หัวหน้าแผนก</option>
                    <option value="requester">ผู้มอบหมายงาน</option>
                    <option value="worker">พนักงาน</option>
                `;
            }
            if (this.state.teamFilterRole) roleSelect.value = this.state.teamFilterRole;
        }

        // 2. Filter Users
        let filteredUsers = mockUsers.filter(u => {
            // Card Filter
            if (this.state.teamFilterCard === 'online' && u.status !== 'online') return false;
            if (this.state.teamFilterCard === 'offline' && u.status !== 'offline') return false;

            // Dropdown Filters
            if (this.state.teamFilterDept && u.department !== this.state.teamFilterDept) return false;

            if (this.state.teamFilterRole) {
                const filterRole = this.state.teamFilterRole.toLowerCase();
                const uJobTitle = (u.jobTitle || '').toLowerCase();
                const uRole = (u.role || '').toLowerCase();

                let roleMatch = false;
                if (uJobTitle === filterRole) roleMatch = true;
                else if (uRole === filterRole) roleMatch = true;
                else if (filterRole.includes('ceo') && uRole === 'reviewer2') roleMatch = true;
                else if (filterRole.includes('admin') && uRole === 'admin') roleMatch = true;
                else if (filterRole.includes('หัวหน้า') && uRole === 'reviewer1') roleMatch = true;
                else if (filterRole.includes('พนักงาน') && uRole === 'worker') roleMatch = true;

                if (!roleMatch) return false;
            }
            if (this.state.teamFilterStatus && u.status !== this.state.teamFilterStatus) return false;

            // Search Query
            if (this.state.teamSearchQuery) {
                const q = this.state.teamSearchQuery.toLowerCase();
                const roleLabel = u.role === 'admin' ? 'แอดมิน' : u.role === 'reviewer2' ? 'ผู้บริหาร' : u.role === 'reviewer1' ? 'ผู้ตรวจสอบ' : u.role === 'worker' ? 'ผู้ปฏิบัติงาน' : 'ผู้มอบหมาย';
                return (u.name && u.name.toLowerCase().includes(q)) ||
                    (u.department && u.department.toLowerCase().includes(q)) ||
                    (roleLabel.toLowerCase().includes(q));
            }

            return true;
        });

        // 3. Update Statistics Cards
        const totalCount = mockUsers.length;
        const onlineCount = mockUsers.filter(u => u.status === 'online').length;
        const offlineCount = mockUsers.filter(u => u.status === 'offline').length;
        const deptsCount = new Set(mockUsers.map(u => u.department)).size;

        document.getElementById('stat-team-all').textContent = totalCount;
        document.getElementById('stat-team-online').textContent = onlineCount;
        document.getElementById('stat-team-offline').textContent = offlineCount;
        document.getElementById('stat-team-depts').textContent = deptsCount;

        // 4. Group Users
        // CEO -> Admin -> Departments (Head -> members)
        const ceoGroup = [];
        const adminGroup = [];
        const deptGroups = {};

        filteredUsers.forEach(u => {
            if (u.role === 'reviewer2') { // CEO
                ceoGroup.push(u);
            } else if (u.role === 'admin') {
                adminGroup.push(u);
            } else {
                if (!deptGroups[u.department]) deptGroups[u.department] = [];
                deptGroups[u.department].push(u);
            }
        });

        // Sort departments internally (Head = reviewer1 first, then others)
        for (let dept in deptGroups) {
            deptGroups[dept].sort((a, b) => {
                if (a.role === 'reviewer1' && b.role !== 'reviewer1') return -1;
                if (a.role !== 'reviewer1' && b.role === 'reviewer1') return 1;
                return a.name.localeCompare(b.name);
            });
        }

        // 5. Generate HTML
        let html = '';

        const buildMemberHtml = (u) => {
            const isOnline = u.status === 'online';
            const roleLabel = u.jobTitle || (u.role === 'admin' ? 'แอดมิน' : u.role === 'reviewer2' ? 'ผู้บริหาร' : u.role === 'reviewer1' ? 'หัวหน้าแผนก' : u.role === 'worker' ? 'พนักงาน' : 'ผู้มอบหมาย');

            if (this.state.teamViewMode === 'grid') {
                return `
                    <div onclick="App.openUserProfileModal('${u.id}')" class="flex flex-col items-center justify-center p-4 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group text-center relative h-full">
                        <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors" title="ส่งข้อความ" onclick="event.stopPropagation(); App.startDirectChat('${u.id}')">
                                <i class="fa-solid fa-comment-dots text-[11px]"></i>
                            </button>
                        </div>
                        <div class="relative mb-3">
                            <img src="${u.avatar}" class="w-16 h-16 rounded-full object-cover border border-gray-200 shadow-sm">
                            <span class="absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}"></span>
                        </div>
                        <h4 class="font-bold text-gray-800 text-sm mb-1 line-clamp-1 w-full px-2" title="${u.name}" data-no-i18n>${u.name}</h4>
                        <span class="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">${roleLabel}</span>
                        <p class="text-xs text-gray-500 truncate w-full px-2 mt-1" data-no-i18n>${u.department}</p>
                    </div>
                `;
            }

            return `
                <div onclick="App.openUserProfileModal('${u.id}')" class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm hover:border-gray-200 transition-all cursor-pointer group">
                    <div class="flex items-center gap-4">
                        <div class="relative">
                            <img src="${u.avatar}" class="w-10 h-10 rounded-full object-cover border border-gray-200">
                            <span class="absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}"></span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-bold text-gray-800 text-sm" data-no-i18n>${u.name}</h4>
                                <span class="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">${roleLabel}</span>
                            </div>
                            <p class="text-xs text-gray-500 mt-0.5" data-no-i18n>${u.department} ${u.username ? `• @${u.username}` : ''}</p>
                        </div>
                    </div>
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors" title="ส่งข้อความ" onclick="event.stopPropagation(); App.startDirectChat('${u.id}')">
                            <i class="fa-solid fa-comment-dots"></i>
                        </button>
                        <button class="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors" title="ดูโปรไฟล์">
                            <i class="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        };

        const containerClass = this.state.teamViewMode === 'grid'
            ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 relative z-10'
            : 'relative z-10 space-y-2';

        const deptContainerClass = this.state.teamViewMode === 'grid'
            ? 'bg-white rounded-2xl p-4 border border-gray-100 shadow-sm grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4'
            : 'bg-white rounded-2xl p-3 border border-gray-100 shadow-sm space-y-2';

        // Render CEO Group
        if (ceoGroup.length > 0) {
            html += `
                <div class="mb-6">
                    <h3 class="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <i class="fa-solid fa-crown text-yellow-500"></i> <span>ผู้บริหาร ( CEO )</span> - (${ceoGroup.length})
                    </h3>
                    <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100/50 relative overflow-hidden ${this.state.teamViewMode !== 'grid' ? 'space-y-2' : ''}">
                        <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                            <i class="fa-solid fa-chess-king text-8xl text-purple-600"></i>
                        </div>
                        <div class="${containerClass}">
                            ${ceoGroup.map(buildMemberHtml).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Render Admin Group
        if (adminGroup.length > 0) {
            html += `
                <div class="mb-6">
                    <h3 class="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
                        <i class="fa-solid fa-shield-halved text-blue-500"></i> <span>แอดมิน</span> - (${adminGroup.length})
                    </h3>
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50 relative overflow-hidden ${this.state.teamViewMode !== 'grid' ? 'space-y-2' : ''}">
                        <div class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                            <i class="fa-solid fa-gears text-8xl text-blue-600"></i>
                        </div>
                        <div class="${containerClass}">
                            ${adminGroup.map(buildMemberHtml).join('')}
                        </div>
                    </div>
                </div>
            `;
        }

        // Render Departments
        const sortedDepts = Object.keys(deptGroups).sort();
        sortedDepts.forEach(dept => {
            const members = deptGroups[dept];
            html += `
                <div class="mb-6">
                    <h3 class="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2 tracking-wider">
                        <i class="fa-solid fa-users text-gray-400"></i> <span class="dept-name-translatable">${dept}</span> - (${members.length})
                    </h3>
                    <div class="${deptContainerClass}">
                        ${members.map(buildMemberHtml).join('')}
                    </div>
                </div>
            `;
        });

        if (filteredUsers.length === 0) {
            html = `
                <div class="flex flex-col items-center justify-center py-20 text-gray-400">
                    <i class="fa-solid fa-users-slash text-4xl mb-4 opacity-50"></i>
                    <p class="font-medium text-sm">ไม่พบพนักงานที่ตรงกับเงื่อนไข</p>
                    <button class="mt-4 text-blue-600 text-sm hover:underline" onclick="document.getElementById('team-reset-btn').click()">ล้างตัวกรอง</button>
                </div>
            `;
        }

        container.innerHTML = html;
    },

    // --- NEW CALENDAR LOGIC ---
    _calInit() {
        if (!this.state.calendarYear || this.state.calendarMonth === undefined || this.state.calendarMonth === null) {
            const now = new Date();
            this.state.calendarYear = now.getFullYear();
            this.state.calendarMonth = now.getMonth();
            this.state.calendarDate = now.getDate();
        }
        this.state.calTab = this.state.calTab || 'personal'; // all, group, personal
        this.state.calView = this.state.calView || 'month'; // month, week, day
        this.state.calGroup = this.state.calGroup || '';
        this.state.selectedDate = this.state.selectedDate || `${this.state.calendarYear}-${String(this.state.calendarMonth + 1).padStart(2, '0')}-${String(this.state.calendarDate).padStart(2, '0')}`;

        // Mini calendar state
        this.state.miniCalYear = this.state.miniCalYear || this.state.calendarYear;
        if (this.state.miniCalMonth === undefined || this.state.miniCalMonth === null) {
            this.state.miniCalMonth = this.state.calendarMonth;
        }

        this._syncCalViewButtons();
    },

    switchCalTab(tab) {
        this.state.calTab = tab;
        this.renderCalendar();
    },

    _syncCalViewButtons() {
        const view = this.state.calView || 'month';
        document.querySelectorAll('.cal-view-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow', 'bg-white', 'text-blue-600', 'shadow-sm');
            btn.classList.add('text-gray-500', 'hover:text-gray-700');
        });
        const activeBtn = document.getElementById(`cal-view-${view}`);
        if (activeBtn) {
            activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow');
            activeBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
        }
    },

    switchCalView(view) {
        this.state.calView = view;
        this._syncCalViewButtons();
        this.renderCalendar();
    },

    toggleCalFilter() {
        const panel = document.getElementById('cal-filter-panel');
        if (panel) panel.classList.toggle('hidden');
    },

    goToToday() {
        const now = new Date();
        this.state.calendarYear = now.getFullYear();
        this.state.calendarMonth = now.getMonth();
        this.state.calendarDate = now.getDate();
        this.state.selectedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        this.state.miniCalYear = now.getFullYear();
        this.state.miniCalMonth = now.getMonth();
        this.renderCalendar();
    },

    prevMonth() {
        this._calInit();
        if (this.state.calView === 'month') {
            this.state.calendarMonth--;
            if (this.state.calendarMonth < 0) { this.state.calendarMonth = 11; this.state.calendarYear--; }
        } else if (this.state.calView === 'week') {
            const d = new Date(this.state.selectedDate);
            d.setDate(d.getDate() - 7);
            this._updateStateFromDate(d);
        } else if (this.state.calView === 'day') {
            const d = new Date(this.state.selectedDate);
            d.setDate(d.getDate() - 1);
            this._updateStateFromDate(d);
        }
        this.renderCalendar();
    },

    nextMonth() {
        this._calInit();
        if (this.state.calView === 'month') {
            this.state.calendarMonth++;
            if (this.state.calendarMonth > 11) { this.state.calendarMonth = 0; this.state.calendarYear++; }
        } else if (this.state.calView === 'week') {
            const d = new Date(this.state.selectedDate);
            d.setDate(d.getDate() + 7);
            this._updateStateFromDate(d);
        } else if (this.state.calView === 'day') {
            const d = new Date(this.state.selectedDate);
            d.setDate(d.getDate() + 1);
            this._updateStateFromDate(d);
        }
        this.renderCalendar();
    },

    setCalendarMonth(monthIndex) {
        this._calInit();
        this.state.calendarMonth = parseInt(monthIndex, 10);
        this.renderCalendar();
    },

    setCalendarYear(yearInput) {
        this._calInit();
        const y = parseInt(yearInput, 10);
        if (!isNaN(y)) {
            const isEn = this.settings?.language === 'en';
            this.state.calendarYear = isEn ? y : y - 543;
            this.renderCalendar();
        }
    },

    _updateStateFromDate(d) {
        this.state.calendarYear = d.getFullYear();
        this.state.calendarMonth = d.getMonth();
        this.state.calendarDate = d.getDate();
        this.state.selectedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        this.state.miniCalYear = d.getFullYear();
        this.state.miniCalMonth = d.getMonth();
    },

    _populateCalGroups() {
        // Obsolete function since group dropdown now controls calTab directly.
        // We can just update the member count here based on the selected calTab if needed,
        // but it's handled in renderCalendar.
    },

    renderCalendar() {
        this._calInit();
        const container = document.getElementById('cal-days-container');
        const weekContainer = document.getElementById('cal-week-container');
        const monthLabel = document.getElementById('cal-month-label');
        if (!container || !weekContainer) return;

        const year = this.state.calendarYear;
        const month = this.state.calendarMonth;
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        const isEn = this.settings?.language === 'en';
        const displayMonths = isEn ? enMonths : thaiMonths;
        const displayYear = isEn ? year : year + 543;

        // --- Filter checks ---
        const chkMeetings = document.getElementById('cal-filter-meetings')?.checked ?? true;
        const chkEvents = document.getElementById('cal-filter-events')?.checked ?? true;
        const chkDeadlines = document.getElementById('cal-filter-deadlines')?.checked ?? true;
        const chkRecur = true; // Always true for now unless added to UI

        // Set select value based on state
        const sel = document.getElementById('cal-group-select');
        if (sel) {
            let opt = sel.querySelector('option[value="dept"]');
            if (!opt) { opt = document.createElement('option'); opt.value = 'dept'; sel.appendChild(opt); }
            const d = this._myDept();
            opt.textContent = (isEn ? 'My department' : 'แผนกของฉัน') + (d ? ` (${d})` : '');
            if (sel.value !== this.state.calTab) sel.value = this.state.calTab;
        }

        // Count members roughly based on tab
        const countSpan = document.getElementById('cal-group-member-count');
        if (countSpan) {
            let count = mockUsers.length;
            if (this.state.calTab === 'personal') {
                count = 1;
            } else if (this.state.calTab === 'group') {
                count = mockUsers.filter(u => mockProjects.some(p => p.team && p.team.includes(u.id))).length || mockUsers.length;
            } else if (this.state.calTab === 'dept') {
                const d = this._myDept();
                count = d ? mockUsers.filter(u => String(u.department || '').trim() === d).length : 0;
            }
            countSpan.textContent = isEn ? `${count} Members` : `สมาชิก ${count} คน`;
        }

        const allEvents = this._getAllFilteredEvents(year, month, chkDeadlines, chkDeadlines, chkEvents, chkMeetings, chkRecur);

        // Update Main Calendar Day Headers
        const calDayHeaders = document.getElementById('cal-day-headers');
        if (calDayHeaders) {
            const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
            const enDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const displayDays = isEn ? enDays : thaiDays;
            Array.from(calDayHeaders.children).forEach((el, idx) => {
                if (idx < 7) el.textContent = displayDays[idx];
            });
        }

        // --- Render Views ---
        if (this.state.calView === 'month') {
            if (monthLabel) {
                const monthOptions = displayMonths.map((m, i) => `<option value="${i}" ${i === month ? 'selected' : ''}>${m}</option>`).join('');
                monthLabel.innerHTML = `
                    <div class="flex items-center gap-2">
                        <div class="relative flex items-center group cursor-pointer px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            <select onchange="App.setCalendarMonth(this.value)" class="appearance-none bg-transparent font-bold text-lg text-gray-800 cursor-pointer focus:outline-none pr-6 z-10 w-full min-w-[90px] text-left">
                                ${monthOptions}
                            </select>
                            <i class="fa-solid fa-chevron-down absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-blue-600 z-20 pointer-events-none"></i>
                        </div>
                        <div class="relative flex items-center px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            <input type="number" value="${displayYear}" onchange="App.setCalendarYear(this.value)" class="bg-transparent font-bold text-lg text-gray-800 focus:outline-none w-[65px] text-center" min="2000" max="2700" />
                        </div>
                    </div>
                `;
            }
            container.style.display = 'grid';
            weekContainer.style.display = 'none';
            if (calDayHeaders) calDayHeaders.style.display = 'grid';
            this._renderMonthGrid(container, year, month, allEvents);
        } else if (this.state.calView === 'week') {
            container.style.display = 'none';
            weekContainer.style.display = 'flex';
            if (calDayHeaders) calDayHeaders.style.display = 'none';
            this._renderWeekGrid(weekContainer, year, month, this.state.calendarDate, allEvents, thaiMonths);
        } else if (this.state.calView === 'day') {
            container.style.display = 'none';
            weekContainer.style.display = 'flex';
            document.getElementById('cal-day-headers').style.display = 'none';
            this._renderDayGrid(weekContainer, year, month, this.state.calendarDate, allEvents, thaiMonths);
        }

        this.renderMiniCalendar();
        this.renderDayEventsPanel();
        this.updateCalendarStats();
    },

    updateCalendarStats() {
        const todayD = new Date();
        const todayStr = `${todayD.getFullYear()}-${String(todayD.getMonth() + 1).padStart(2, '0')}-${String(todayD.getDate()).padStart(2, '0')}`;

        // Get start and end of current week (Sun-Sat)
        const day = todayD.getDay();
        const startWeek = new Date(todayD);
        startWeek.setDate(todayD.getDate() - day);
        const endWeek = new Date(startWeek);
        endWeek.setDate(startWeek.getDate() + 6);

        const startWeekStr = `${startWeek.getFullYear()}-${String(startWeek.getMonth() + 1).padStart(2, '0')}-${String(startWeek.getDate()).padStart(2, '0')}`;
        const endWeekStr = `${endWeek.getFullYear()}-${String(endWeek.getMonth() + 1).padStart(2, '0')}-${String(endWeek.getDate()).padStart(2, '0')}`;

        let totalTasks = 0;
        let todayTasks = 0;
        let weekTasks = 0;

        // 1. Regular Tasks
        mockTasks.forEach(t => {
            if (!t.isDraft && this._isVisibleByTab(t.projectId, t.assignees || [])) {
                totalTasks++;
                if (t.dueDate === todayStr) todayTasks++;
                if (t.dueDate >= startWeekStr && t.dueDate <= endWeekStr) weekTasks++;
            }
        });

        // 2. Manual Events
        mockEvents.forEach(e => {
            if (e.type !== 'project' && this._isEventVisibleByTab(e)) {
                const evEnd = e.endDate && e.endDate > e.date ? e.endDate : e.date;
                totalTasks++;
                if (e.date <= todayStr && evEnd >= todayStr) todayTasks++;
                if (e.date <= endWeekStr && evEnd >= startWeekStr) weekTasks++;
            }
        });

        // 3. Project Starts/Ends
        mockProjects.forEach(p => {
            if (this._isVisibleByTab(p.id)) {
                if (p.startDate) {
                    totalTasks++;
                    if (p.startDate === todayStr) todayTasks++;
                    if (p.startDate >= startWeekStr && p.startDate <= endWeekStr) weekTasks++;
                }
                if (p.dueDate) {
                    totalTasks++;
                    if (p.dueDate === todayStr) todayTasks++;
                    if (p.dueDate >= startWeekStr && p.dueDate <= endWeekStr) weekTasks++;
                }
            }
        });

        // 4. Recurring Schedules
        mockProjects.forEach(p => {
            if (this._isVisibleByTab(p.id) && p.schedule && p.schedule.mode === 'repeat') {
                /* repeating project: count its rounds today and this week */
                const rounds = this._projectOccurrences(p, startWeekStr, endWeekStr);
                if (rounds.includes(todayStr)) todayTasks++;
                weekTasks += rounds.length;
            } else if (this._isVisibleByTab(p.id) && p.schedule && p.schedule.days && p.schedule.days.length > 0) {
                totalTasks++; // Count the recurring schedule itself as 1 total task entity

                // Check if it happens today
                const todayDow = String(todayD.getDay());
                if (p.schedule.days.includes(todayDow) && (!p.schedule.recurStart || todayStr >= p.schedule.recurStart)) {
                    todayTasks++;
                }

                // Check how many times it happens this week
                for (let w = new Date(startWeek); w <= endWeek; w.setDate(w.getDate() + 1)) {
                    const wStr = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
                    const wDow = String(w.getDay());
                    if (p.schedule.days.includes(wDow) && (!p.schedule.recurStart || wStr >= p.schedule.recurStart)) {
                        weekTasks++;
                    }
                }
            }
        });

        // Project Progress
        let totalProgress = 0;
        let projCount = 0;
        mockProjects.forEach(p => {
            if (this._isVisibleByTab(p.id)) {
                totalProgress += p.progress || 0;
                projCount++;
            }
        });
        const avgProgress = projCount > 0 ? Math.round(totalProgress / projCount) : 0;

        const elTotal = document.getElementById('stat-total-tasks');
        const elToday = document.getElementById('stat-today-tasks');
        const elWeek = document.getElementById('stat-week-tasks');
        const elProgress = document.getElementById('stat-avg-progress');

        if (elTotal) elTotal.textContent = totalTasks;
        if (elToday) elToday.textContent = todayTasks;
        if (elWeek) elWeek.textContent = weekTasks;
        if (elProgress) elProgress.textContent = `${avgProgress}%`;
    },

    _renderMonthGrid(container, year, month, events) {
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        /* project bars: each project gets its own row ("lane") so a bar stays at the same height from start to end */
        const lanes = {}, laneEnds = [];
        const spanProjects = [];
        events.filter(e => e.span).forEach(e => { if (!spanProjects.some(x => x.projectId === e.projectId)) spanProjects.push(e); });
        spanProjects.sort((a, b) => a.spanFrom.localeCompare(b.spanFrom) || String(a.projectId).localeCompare(String(b.projectId)));
        spanProjects.forEach(e => {
            let l = laneEnds.findIndex(end => end < e.spanFrom);
            if (l === -1) { l = laneEnds.length; laneEnds.push(''); }
            laneEnds[l] = e.spanTo; lanes[e.projectId] = l;
        });
        const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const barsFor = (dateStr, weekday, dayNum) => {
            const mine = events.filter(e => e.span && e.date === dateStr);
            if (!mine.length) return '';
            const top = Math.max(...mine.map(e => lanes[e.projectId]));
            let out = '';
            for (let l = 0; l <= top; l++) {
                const e = mine.find(x => lanes[x.projectId] === l);
                if (!e) { out += '<div class="h-[15px]"></div>'; continue; }
                const showName = e.spanStart || weekday === 0 || dayNum === 1;
                const round = (e.spanStart ? ' rounded-l ml-0.5' : ' -ml-1') + (e.spanEnd ? ' rounded-r mr-0.5' : ' -mr-1');
                const range = `${e.spanFrom.slice(5, 7)}/${e.spanFrom.slice(8)}/${e.spanFrom.slice(0, 4)} – ${e.spanTo.slice(5, 7)}/${e.spanTo.slice(8)}/${e.spanTo.slice(0, 4)}`;
                out += `<div class="h-[15px] text-[9px] leading-[15px] px-1 font-semibold truncate ${e.colorClass}${round} cursor-pointer"
                            onclick="event.stopPropagation(); App.calendarEventClick('${e.projectId}', '${e.id}');"
                            title="${esc(e.title)} (${range})">${showName ? esc(e.title) : '&nbsp;'}</div>`;
            }
            return `<div class="mt-1 space-y-0.5">${out}</div>`;
        };

        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += `<div class="min-h-0 border-b border-r border-gray-100 bg-gray-50/40 p-1 flex flex-col"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this.state.selectedDate;
            const dayEvents = events.filter(e => e.date === dateStr && !e.span);
            const bars = barsFor(dateStr, (firstDay + d - 1) % 7, d);

            // Sort events by time loosely
            dayEvents.sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

            let bgClass = 'bg-white hover:bg-gray-50';
            if (isSelected) bgClass = 'bg-blue-50 ring-1 ring-blue-300 ring-inset z-10';

            html += `
                <div class="min-h-0 border-b border-r border-gray-100 p-1 flex flex-col ${bgClass} transition-colors cursor-pointer"
                    onclick="App.calendarDayClick('${dateStr}')">
                    <span class="text-sm font-medium ml-1 mt-0.5 ${isToday ? 'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-sm' : 'text-gray-600 h-6 leading-6'}">${d}</span>
                    ${bars}
                    <div class="flex-1 min-h-0 overflow-y-auto mt-1 px-0.5 space-y-0.5 custom-scrollbar">
                        ${dayEvents.map(e => `
                            <div class="group relative text-[9px] truncate px-1 py-[1px] rounded-sm font-medium ${e.colorClass} cursor-pointer shadow-sm border ${e.borderClass || 'border-transparent'} leading-tight"
                                onclick="event.stopPropagation(); App.calendarEventClick('${e.projectId || ''}', '${e.id}');"
                                title="${e.title}">
                                ${e.time ? `<span class="opacity-75 mr-0.5">${e.time}</span>` : ''}<span class="project-name-display" data-no-i18n>${e.title}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        const totalCells = firstDay + daysInMonth;
        const remainder = totalCells % 7;
        if (remainder !== 0) {
            for (let i = 0; i < 7 - remainder; i++) {
                html += `<div class="min-h-0 border-b border-r border-gray-100 bg-gray-50/40 p-1 flex flex-col"></div>`;
            }
        }
        container.innerHTML = html;
        container.className = "grid grid-cols-7 auto-rows-fr h-full overflow-y-auto"; // Stretch cells evenly to fit screen
    },

    _renderWeekGrid(container, year, month, date, events, thaiMonths) {
        const d = new Date(year, month, date);
        const day = d.getDay();
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - day);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const monthLabel = document.getElementById('cal-month-label');
        if (monthLabel) {
            if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
                monthLabel.textContent = `${startOfWeek.getDate()} - ${endOfWeek.getDate()} ${thaiMonths[startOfWeek.getMonth()]} ${startOfWeek.getFullYear() + 543}`;
            } else {
                monthLabel.textContent = `${startOfWeek.getDate()} ${thaiMonths[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${thaiMonths[endOfWeek.getMonth()]} ${endOfWeek.getFullYear() + 543}`;
            }
        }

        const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        let html = '<div class="flex flex-col flex-1 min-h-0 w-full h-full">';

        // Header row — equal columns, full width
        html += '<div class="grid grid-cols-7 shrink-0 border-b-2 border-gray-200 bg-gray-50/80">';
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const curr = new Date(startOfWeek);
            curr.setDate(startOfWeek.getDate() + i);
            const dateStr = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
            weekDates.push(dateStr);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this.state.selectedDate;
            const isWeekend = i === 0 || i === 6;

            let nameColor = 'text-gray-600';
            if (i === 0) nameColor = 'text-red-500';
            if (i === 6) nameColor = 'text-blue-600';

            let headerBg = '';
            if (isSelected) headerBg = 'bg-blue-100 ring-1 ring-inset ring-blue-300';
            else if (isWeekend) headerBg = 'bg-gray-100/60';
            else headerBg = 'hover:bg-gray-100';

            html += `
                <div class="py-3 px-1 text-center border-r border-gray-200 last:border-r-0 cursor-pointer transition-colors ${headerBg}"
                     onclick="App.calendarDayClick('${dateStr}')">
                    <div class="text-xs font-semibold ${nameColor} tracking-wide">${dayNames[i]}</div>
                    <div class="mt-1.5 text-lg font-bold ${isToday ? 'bg-blue-600 text-white w-9 h-9 rounded-full mx-auto flex items-center justify-center shadow-md' : 'text-gray-800 h-9 flex items-center justify-center'}">${curr.getDate()}</div>
                </div>
            `;
        }
        html += '</div>';

        // Body — 7 equal columns filling remaining height
        html += '<div class="flex-1 min-h-0 grid grid-cols-7 grid-rows-1 h-full bg-white">';
        for (let i = 0; i < 7; i++) {
            const dateStr = weekDates[i];
            const dayEvents = events.filter(e => e.date === dateStr);
            dayEvents.sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

            const isSelected = dateStr === this.state.selectedDate;
            const isWeekend = i === 0 || i === 6;
            let colBg = 'bg-white hover:bg-gray-50/80';
            if (isSelected) colBg = 'bg-blue-50/50 ring-1 ring-inset ring-blue-200 z-[1]';
            else if (isWeekend) colBg = 'bg-gray-50/40 hover:bg-gray-50/70';

            html += `
                <div class="flex flex-col min-h-0 h-full border-r border-gray-200 last:border-r-0 cursor-pointer transition-colors ${colBg}"
                     onclick="App.calendarDayClick('${dateStr}')">
                    <div class="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">`;

            if (dayEvents.length === 0) {
                html += `<div class="h-full min-h-[120px] flex items-center justify-center text-gray-300 pointer-events-none">
                    <span class="text-[10px] font-medium opacity-60">—</span>
                </div>`;
            } else {
                dayEvents.forEach(e => {
                    html += `
                        <div class="group relative p-2 rounded-lg border shadow-sm ${e.colorClass} ${e.borderClass || 'border-transparent'} cursor-pointer hover:shadow-md transition-shadow"
                            onclick="event.stopPropagation(); App.calendarEventClick('${e.projectId || ''}', '${e.id}')">
                            <div class="flex justify-between items-start">
                                <div class="font-bold text-xs leading-tight line-clamp-2 pr-2 project-name-display" data-no-i18n>${e.title}</div>
                            </div>
                            ${e.time ? `<div class="text-[10px] opacity-80 mt-1"><i class="fa-regular fa-clock mr-0.5"></i>${e.time}</div>` : ''}
                        </div>
                    `;
                });
            }

            html += `</div></div>`;
        }
        html += '</div></div>';
        container.innerHTML = html;
        container.className = 'flex flex-col flex-1 min-h-0 w-full h-full';
    },

    _renderDayGrid(container, year, month, date, events, thaiMonths) {
        const d = new Date(year, month, date);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayNamesFull = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

        const monthLabel = document.getElementById('cal-month-label');
        if (monthLabel) {
            monthLabel.textContent = `วัน${dayNamesFull[d.getDay()]}ที่ ${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
        }

        const dayEvents = events.filter(e => e.date === dateStr);
        dayEvents.sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

        let html = `
            <div class="flex-1 bg-white p-6 overflow-y-auto">
                <div class="max-w-2xl mx-auto space-y-4">
        `;

        if (dayEvents.length === 0) {
            html += `
                <div class="text-center py-20 text-gray-400">
                    <i class="fa-regular fa-calendar-xmark text-4xl mb-3 opacity-50"></i>
                    <p class="text-sm font-medium">ไม่มีกิจกรรมในวันนี้</p>
                </div>
            `;
        } else {
            dayEvents.forEach(e => {
                html += `
                    <div class="group flex gap-4 p-4 rounded-xl border ${e.colorClass} ${e.borderClass || 'border-transparent'} shadow-sm cursor-pointer hover:shadow-md transition-shadow relative"
                        onclick="App.calendarEventClick('${e.projectId || ''}', '${e.id}')">
                        <div class="w-16 shrink-0 text-center border-r border-black/10 pr-4">
                            <div class="font-bold text-sm">${e.time || 'ทั้งวัน'}</div>
                        </div>
                        <div class="flex-1 flex justify-between items-start">
                            <div>
                                <h4 class="font-bold text-base mb-1 project-name-display" data-no-i18n>${e.title}</h4>
                                ${e.projectId ? `<div class="text-xs opacity-75 mt-1"><i class="fa-solid fa-briefcase mr-1"></i> เชื่อมโยงโปรเจกต์</div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        html += `</div></div>`;
        container.innerHTML = html;
    },

    _getAllFilteredEvents(year, month, chkProj, chkTasks, chkEvents, chkMeetings, chkRecur) {
        let events = [];

        const _getProjColors = (projectId, defCl, defBr) => {
            if (!projectId) return { cl: defCl, br: defBr };
            const p = mockProjects.find(pr => pr.id === projectId);
            if (!p || !p.color) return { cl: defCl, br: defBr };
            const m = p.color.match(/^bg-([a-z]+)-\d+$/);
            if (m) return { cl: `bg-${m[1]}-50 text-${m[1]}-700`, br: `border-${m[1]}-200` };
            return { cl: defCl, br: defBr };
        };

        // Scan a window of months (prev, current, next) to populate mini cal fully too
        for (let m = month - 1; m <= month + 1; m++) {
            let y = year;
            let mm = m;
            if (mm < 0) { mm = 11; y--; }
            if (mm > 11) { mm = 0; y++; }
            const mStr = `${y}-${String(mm + 1).padStart(2, '0')}`;
            const daysInM = new Date(y, mm + 1, 0).getDate();

            // 1. Regular Events (manual)
            if (chkEvents || chkMeetings) {
                const monthFirst = `${mStr}-01`, monthLast = `${mStr}-${String(daysInM).padStart(2, '0')}`;
                mockEvents.forEach(e => {
                    /* an event with an end date shows on every day from its date to the end date */
                    const evEnd = e.endDate && e.endDate > e.date ? e.endDate : e.date;
                    if (e.date && e.date <= monthLast && evEnd >= monthFirst && e.type !== 'project') {
                        // Skip based on specific filters
                        if (e.type === 'meeting' && !chkMeetings) return;
                        if (e.type !== 'meeting' && e.type !== 'deadline' && !chkEvents) return;
                        if (e.type === 'deadline' && !chkTasks) return; // if tasks/deadlines are unselected

                        // Filter by tab with strict creation rules
                        if (this._isEventVisibleByTab(e)) {
                            let cl = 'bg-indigo-50 text-indigo-700', br = 'border-indigo-200';
                            if (e.type === 'meeting') { cl = 'bg-fuchsia-50 text-fuchsia-700'; br = 'border-fuchsia-200'; }
                            if (e.type === 'deadline') { cl = 'bg-rose-50 text-rose-700'; br = 'border-rose-200'; }

                            if (e.color) {
                                const match = e.color.match(/^bg-([a-z]+)-\d+$/);
                                if (match) {
                                    cl = `bg-${match[1]}-200 text-${match[1]}-800`;
                                    br = `border-${match[1]}-300`;
                                }
                            }
                            if (evEnd === e.date) {
                                events.push({ ...e, colorClass: cl, borderClass: br });
                            } else {
                                for (let d = 1; d <= daysInM; d++) {
                                    const ds = `${mStr}-${String(d).padStart(2, '0')}`;
                                    if (ds < e.date || ds > evEnd) continue;
                                    events.push({ ...e, date: ds, time: ds === e.date ? e.time : '', title: ds === e.date ? e.title : `↳ ${e.title}`, colorClass: cl, borderClass: br });
                                }
                            }
                        }
                    }
                });
            }

            // 2. Project starts/ends
            if (chkProj) {
                mockProjects.forEach(p => {
                    if (this._isVisibleByTab(p.id)) {
                        const colors = _getProjColors(p.id, 'bg-emerald-50 text-emerald-700', 'border-emerald-200');
                        /* one colored bar from the start date to the end date: an entry on every day in between */
                        const s0 = p.startDate || p.dueDate, e0 = p.dueDate || p.startDate;
                        if (p.schedule && p.schedule.mode === 'repeat') {
                            const solid = /^bg-[a-z]+-\d+$/.test(p.color || '') ? p.color : 'bg-blue-500';
                            const from = `${mStr}-01`, to = `${mStr}-${String(daysInM).padStart(2, '0')}`;
                            this._projectOccurrences(p, from, to).forEach(ds => {
                                events.push({
                                    id: 'proj-rep-' + p.id + '-' + ds, date: ds, title: `🔄 ${p.name}`, time: '', projectId: p.id,
                                    colorClass: `${solid} text-white`, borderClass: 'border-transparent'
                                });
                            });
                        } else if (s0 && e0 && s0 <= e0) {
                            const solid = /^bg-[a-z]+-\d+$/.test(p.color || '') ? p.color : 'bg-blue-500';
                            for (let d = 1; d <= daysInM; d++) {
                                const ds = `${mStr}-${String(d).padStart(2, '0')}`;
                                if (ds < s0 || ds > e0) continue;
                                events.push({
                                    id: 'proj-span-' + p.id + '-' + ds, date: ds, title: p.name, time: '', projectId: p.id,
                                    span: true, spanStart: ds === s0, spanEnd: ds === e0, spanFrom: s0, spanTo: e0,
                                    colorClass: `${solid} text-white`, borderClass: 'border-transparent'
                                });
                            }
                        }
                    }
                });
            }

            // 3. Tasks
            if (chkTasks) {
                mockTasks.forEach(t => {
                    if (t.dueDate && t.dueDate.startsWith(mStr) && !t.isDraft) {
                        if (this._isVisibleByTab(t.projectId, t.assignees || [])) {
                            const colors = _getProjColors(t.projectId, 'bg-amber-50 text-amber-700', 'border-amber-200');
                            events.push({
                                id: 'task-due-' + t.id, date: t.dueDate, title: `📋 ${t.title}`, time: t.dueTime || '', projectId: t.projectId,
                                colorClass: colors.cl, borderClass: colors.br
                            });
                        }
                    }
                });
            }

            // 4. Recurring
            if (chkRecur) {
                mockProjects.forEach(p => {
                    if (this._isVisibleByTab(p.id)) {
                        const colors = _getProjColors(p.id, 'bg-purple-50 text-purple-700', 'border-purple-200');
                        if (p.schedule && p.schedule.mode !== 'repeat' && p.schedule.days && p.schedule.days.length > 0) {
                            for (let d = 1; d <= daysInM; d++) {
                                const date = new Date(y, mm, d);
                                const dayOfWeek = String(date.getDay());
                                if (p.schedule.days.includes(dayOfWeek)) {
                                    const dateStr = `${y}-${String(mm + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    if (p.schedule.recurStart && dateStr < p.schedule.recurStart) continue;
                                    if (p.dueDate && dateStr > p.dueDate) continue;
                                    if (p.schedule.recurEndType === 'date' && p.schedule.recurEndDate && dateStr > p.schedule.recurEndDate) continue;
                                    events.push({
                                        id: `proj-recur-${p.id}-${dateStr}`, date: dateStr, title: `🔄 ${p.name}`, time: p.schedule.timeStart || '', projectId: p.id,
                                        colorClass: colors.cl, borderClass: colors.br
                                    });
                                }
                            }
                        }
                    }
                });
            }
        }
        return events;
    },

    _isEventVisibleByTab(e) {
        const createdTab = e.createdInTab || 'all';
        let visible = false;

        if (this.state.calTab === 'all') {
            visible = true;
        } else if (this.state.calTab === 'group') {
            visible = (createdTab === 'all' || createdTab === 'group');
        } else if (this.state.calTab === 'personal') {
            visible = (createdTab === 'personal' || createdTab === 'all');
        } else if (this.state.calTab === 'dept') {
            visible = (createdTab === 'all' || createdTab === 'group');
        }

        if (visible) {
            return this._isVisibleByTab(e.projectId, e.userIds);
        }
        return false;
    },

    _myDept() {
        const cu = this.state.currentUser || {};
        const me = mockUsers.find(u => String(u.id) === String(cu.id));
        return String((me && me.department) || cu.department || '').trim();
    },
    _projectInMyDept(p) {
        const d = this._myDept();
        if (!p || !d) return false;
        const list = Array.isArray(p.teams) && p.teams.length ? p.teams : String(p.teamDept || '').split(',').map(x => x.trim());
        if (list.includes(App.ALL_DEPTS)) return true;
        return list.includes(d);
    },

    _isVisibleByTab(projectId, userIds = []) {
        if (projectId) {
            const p = mockProjects.find(pr => pr.id === projectId);
            if (!p || p.status === 'deleted') return false;
        }

        if (this.state.calTab === 'all') return true;

        const curUser = this.state.currentUser;
        if (!curUser) return true;

        if (this.state.calTab === 'personal') {
            // Must be related to current user
            if (userIds && userIds.includes(curUser.id)) return true;
            if (projectId) {
                const p = mockProjects.find(pr => pr.id === projectId);
                if (p && p.team && p.team.includes(curUser.id)) return true;
                if (this._projectInMyDept(p)) return true;
            }
            return false;
        }

        if (this.state.calTab === 'dept') {
            // my department's calendar: projects that list my department
            if (!projectId) return false;
            return this._projectInMyDept(mockProjects.find(pr => pr.id === projectId));
        }

        if (this.state.calTab === 'group') {
            // Must match selected project
            if (!this.state.calGroup) return true; // all projects

            if (projectId) {
                if (projectId === this.state.calGroup) return true;
            }
            // Check if any user in userIds belongs to the project team
            if (userIds) {
                const proj = mockProjects.find(p => p.id === this.state.calGroup);
                if (proj && proj.team) {
                    for (let uid of userIds) {
                        if (proj.team.includes(uid)) return true;
                    }
                }
            }
            return false;
        }

        return true;
    },

    calendarDayClick(dateStr) {
        this.state.selectedDate = dateStr;
        const d = new Date(dateStr);
        this._updateStateFromDate(d);
        this.renderCalendar();
    },

    calendarEventClick(projectId, eventId) {
        /* events saved in the database have their own ids, not 'ev-...' */
        if (eventId && (eventId.startsWith('ev-') || mockEvents.some(e => e.id === eventId))) {
            this.openCreateEventModal(eventId);
        } else if (eventId && eventId.startsWith('task-due-')) {
            const taskId = eventId.replace('task-due-', '');
            this.openTaskDetailView(taskId);
        } else if (projectId) {
            this.state.previousViewForProject = this.state.currentView;
            this.switchView('projects');
            setTimeout(() => this.openProject(projectId), 100);
        }
    },

    // --- Mini Calendar ---
    miniPrev() {
        this.state.miniCalMonth--;
        if (this.state.miniCalMonth < 0) { this.state.miniCalMonth = 11; this.state.miniCalYear--; }
        this.renderMiniCalendar();
    },

    miniNext() {
        this.state.miniCalMonth++;
        if (this.state.miniCalMonth > 11) { this.state.miniCalMonth = 0; this.state.miniCalYear++; }
        this.renderMiniCalendar();
    },

    renderMiniCalendar() {
        const grid = document.getElementById('mini-cal-grid');
        const label = document.getElementById('mini-cal-label');
        if (!grid || !label) return;

        const isEn = this.settings?.language === 'en';
        const y = this.state.miniCalYear;
        const m = this.state.miniCalMonth;
        const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label.textContent = isEn ? `${enMonths[m]} ${y}` : `${thaiMonths[m]} ${y + 543}`;

        // Update Mini Calendar Day Headers
        const miniCalHeaders = grid.previousElementSibling;
        if (miniCalHeaders && miniCalHeaders.classList.contains('grid-cols-7')) {
            const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
            const enDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
            const displayDays = isEn ? enDays : thaiDays;
            Array.from(miniCalHeaders.children).forEach((el, idx) => {
                if (idx < 7) el.textContent = displayDays[idx];
            });
        }

        const firstDay = new Date(y, m, 1).getDay();
        const daysInM = new Date(y, m + 1, 0).getDate();
        const todayStr = new Date().toISOString().split('T')[0];

        // Fetch events for dot indicators
        const chkMeetings = document.getElementById('cal-filter-meetings')?.checked ?? true;
        const chkEvents = document.getElementById('cal-filter-events')?.checked ?? true;
        const chkDeadlines = document.getElementById('cal-filter-deadlines')?.checked ?? true;
        const chkRecur = true;
        const allEvents = this._getAllFilteredEvents(y, m, chkDeadlines, chkDeadlines, chkEvents, chkMeetings, chkRecur);

        let html = '';
        for (let i = 0; i < firstDay; i++) {
            html += `<div></div>`;
        }
        for (let d = 1; d <= daysInM; d++) {
            const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this.state.selectedDate;
            const hasEvents = allEvents.some(e => e.date === dateStr);

            let cls = 'relative w-5 h-5 mx-auto flex items-center justify-center text-[10px] rounded-full cursor-pointer transition-colors font-medium ';
            if (isSelected) {
                cls += 'bg-blue-600 text-white shadow-sm';
            } else if (isToday) {
                cls += 'bg-blue-100 text-blue-600';
            } else {
                cls += 'text-gray-700 hover:bg-gray-100';
            }

            const dotHtml = hasEvents ? `<div class="absolute bottom-[-1px] left-1/2 -translate-x-1/2 translate-y-[2px] w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'}"></div>` : '';

            html += `<div><div class="${cls}" onclick="App.calendarDayClick('${dateStr}')">${d}${dotHtml}</div></div>`;
        }
        grid.innerHTML = html;
    },

    // --- Right Panel Events ---
    renderDayEventsPanel() {
        const label = document.getElementById('panel-date-label');
        const countSpan = document.getElementById('panel-event-count');
        const list = document.getElementById('panel-events-list');
        if (!label || !list) return;

        const isEn = this.settings?.language === 'en';
        const d = new Date(this.state.selectedDate);
        const dayNamesFull = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
        const enDayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const enMonths = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        if (isEn) {
            label.textContent = `${enDayNamesFull[d.getDay()]}, ${d.getDate()} ${enMonths[d.getMonth()]} ${d.getFullYear()}`;
        } else {
            label.textContent = `${dayNamesFull[d.getDay()]}ที่ ${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
        }

        const chkMeetings = document.getElementById('cal-filter-meetings')?.checked ?? true;
        const chkEvents = document.getElementById('cal-filter-events')?.checked ?? true;
        const chkDeadlines = document.getElementById('cal-filter-deadlines')?.checked ?? true;
        const chkRecur = true;

        const allEvents = this._getAllFilteredEvents(d.getFullYear(), d.getMonth(), chkDeadlines, chkDeadlines, chkEvents, chkMeetings, chkRecur);
        const dayEvents = allEvents.filter(e => e.date === this.state.selectedDate);
        dayEvents.sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

        if (countSpan) countSpan.textContent = dayEvents.length;

        if (dayEvents.length === 0) {
            list.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <i class="fa-regular fa-calendar-xmark text-3xl mb-2 opacity-40"></i>
                    <p class="text-xs font-medium">ไม่มีกิจกรรม</p>
                </div>
            `;
            return;
        }

        list.innerHTML = dayEvents.map(e => {
            // Generate avatars for team if project related
            let avatarsHtml = '';
            if (e.projectId) {
                const proj = mockProjects.find(p => p.id === e.projectId);
                if (proj && proj.team) {
                    avatarsHtml = `<div class="flex -space-x-1 mt-1.5">` +
                        proj.team.slice(0, 3).map(uid => {
                            const u = mockUsers.find(user => user.id === uid);
                            return u ? `<img src="${u.avatar}" class="w-4 h-4 rounded-full border border-white">` : '';
                        }).join('') +
                        (proj.team.length > 3 ? `<div class="w-4 h-4 rounded-full bg-gray-100 border border-white text-[7px] font-bold text-gray-500 flex items-center justify-center">+${proj.team.length - 3}</div>` : '') +
                        `</div>`;
                }
            } else if (e.userIds && e.userIds.length > 0) {
                avatarsHtml = `<div class="flex -space-x-1 mt-1.5">` +
                    e.userIds.map(uid => {
                        const u = mockUsers.find(user => user.id === uid);
                        return u ? `<img src="${u.avatar}" class="w-4 h-4 rounded-full border border-white">` : '';
                    }).join('') + `</div>`;
            }

            return `
                <div class="bg-white p-2 px-2.5 rounded-lg border border-gray-100 shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                     onclick="App.calendarEventClick('${e.projectId || ''}', '${e.id}')">
                    <!-- Color strip -->
                    <div class="absolute left-0 top-0 bottom-0 w-1 ${e.colorClass.split(' ')[0].replace('bg-', 'bg-').replace('-50', '-400')} opacity-80"></div>
                    
                    <div class="pl-2">
                        <div class="flex justify-between items-start">
                            <h5 class="text-xs font-bold text-gray-800 pr-2 project-name-display" data-no-i18n>${e.title}</h5>
                        </div>
                        ${e.time ? `<div class="text-[10px] text-gray-500 mt-0.5 font-medium"><i class="fa-regular fa-clock mr-1"></i>${e.time}</div>` : ''}
                        ${avatarsHtml}
                    </div>
                </div>
            `;
        }).join('');
    },

    showNotification() {
        alert("คุณมี 1 การแจ้งเตือนใหม่");
    },

    filterProjects(type) {
        this.state.projectFilter = type;

        const btns = document.querySelectorAll('button[onclick^="App.filterProjects"]');
        btns.forEach(btn => {
            const isSelected = btn.getAttribute('onclick').includes("'" + type + "'");
            if (isSelected) {
                btn.className = "px-4 py-1.5 bg-blue-600 text-white dark:bg-blue-500/15 dark:text-[#93c5fd] rounded-lg text-sm font-bold shadow-md dark:shadow-none transition-all duration-300 border border-transparent dark:border-blue-500/30";
            } else {
                btn.className = "px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 shadow-sm transition-all duration-300 border-none dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600";
            }
        });

        this.renderProjects();
        if (window.I18n) window.I18n.applyTranslations();
    },

    projectOptions(event, id) {
        event.stopPropagation();

        // Track which project this menu is for
        this._contextProjectId = id;

        const menu = document.getElementById('project-context-menu');
        if (!menu) return;

        const proj = mockProjects.find(p => p.id === id);
        if (proj) {
            const closeBtn = document.getElementById('pcm-close-btn');
            if (closeBtn) {
                closeBtn.innerHTML = proj.closedAt
                    ? '<i class="fa-solid fa-lock-open text-blue-500 w-4"></i> <span>เปิดโปรเจกต์อีกครั้ง</span>'
                    : '<i class="fa-solid fa-lock text-green-600 w-4"></i> <span>ปิดโปรเจกต์</span>';
                closeBtn.style.display = this.hasPermission('แก้ไขโปรเจกต์') ? '' : 'none';
            }
            const pinBtn = document.getElementById('pcm-pin-btn');
            if (pinBtn) {
                if (proj.pinned) {
                    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack text-gray-400 w-4"></i> <span>เลิกปักหมุด</span>';
                } else {
                    pinBtn.innerHTML = '<i class="fa-solid fa-thumbtack text-blue-500 w-4"></i> <span>ปักหมุด</span>';
                }
            }
        }

        // Hide delete and edit buttons for employees
        const deleteBtn = document.getElementById('pcm-delete-btn');
        const editBtn = document.getElementById('pcm-edit-btn');
        if (this.state.currentUser) {
            const role = this.state.currentUser.role;
            const canManage = role === 'admin' || role === 'reviewer2' || role === 'reviewer1' || role === 'manager' || role === 'supervisor';

            if (deleteBtn) {
                if (this.hasPermission('ลบโปรเจกต์')) {
                    deleteBtn.style.display = '';
                    if (deleteBtn.previousElementSibling) deleteBtn.previousElementSibling.style.display = '';
                } else {
                    deleteBtn.style.display = 'none';
                    if (deleteBtn.previousElementSibling) deleteBtn.previousElementSibling.style.display = 'none';
                }
            }

            if (editBtn) {
                if (this.hasPermission('แก้ไขโปรเจกต์')) {
                    editBtn.style.display = '';
                } else {
                    editBtn.style.display = 'none';
                }
            }
        }

        // Position menu near the clicked button
        const rect = event.currentTarget.getBoundingClientRect();
        const menuWidth = 208; // w-52
        let left = rect.left;
        let top = rect.bottom + 4;

        // Prevent overflow on right side
        if (left + menuWidth > window.innerWidth) {
            left = window.innerWidth - menuWidth - 8;
        }
        // Prevent overflow on bottom
        const menuHeight = 160;
        if (top + menuHeight > window.innerHeight) {
            top = rect.top - menuHeight - 4;
        }

        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        menu.classList.remove('hidden');

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', this._closeContextMenu, { once: true });
        }, 10);
    },

    _closeContextMenu() {
        const menu = document.getElementById('project-context-menu');
        if (menu) menu.classList.add('hidden');
    },

    async deleteProject(id) {
        if (!id) return;

        const idx = mockProjects.findIndex(p => p.id === id);
        if (idx === -1) return;

        const name = mockProjects[idx].name;
        
        // --- Supabase DB Sync ---
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !['p1', 'p2', 'p3', 'p4'].includes(String(id))) {
            try {
                // Delete project from DB
                const { data: deleteData, error: delErr } = await window.conworkSupabase.client.from('projects').delete().eq('id', id).select();
                
                if (delErr) {
                    console.error('Error deleting project from Supabase:', delErr);
                    // หากเป็น invalid uuid (22P02) อนุญาตให้ลบ local ได้
                    if (delErr.code !== '22P02') {
                        alert(`เกิดข้อผิดพลาดในการลบโปรเจกต์: ${delErr.message}`);
                        return;
                    }
                } else if (!deleteData || deleteData.length === 0) {
                    console.warn('Project not found in Supabase (or RLS blocked). Deleting locally anyway.');
                }
                
                mockProjects[idx].status = 'deleted'; // Update local state

                // Clean up related notifications
                const originalLength = mockNotifications.length;
                for (let i = mockNotifications.length - 1; i >= 0; i--) {
                    if (mockNotifications[i].linkData && mockNotifications[i].linkData.projectId === id) {
                        mockNotifications.splice(i, 1);
                    }
                }
                if (mockNotifications.length !== originalLength) {
                    this.renderNotifications();
                }
            } catch (e) { 
                console.error('Exception soft-deleting project from Supabase', e);
                alert(`Exception: ${e.message}`);
                return;
            }
        } else {
            mockProjects[idx].status = 'deleted';
        }

        document.getElementById('confirm-delete-modal').classList.add('hidden');
        this._contextProjectId = null;
        this._saveData();
        this.renderProjects();
        this._showToast(`ลบโปรเจกต์ "${name}" เรียบร้อยแล้ว`, 'success');
    },

    openProjectFromMenu() {
        document.getElementById('project-context-menu').classList.add('hidden');
        if (this._contextProjectId) this.openProject(this._contextProjectId);
    },

    togglePinProjectFromMenu() {
        const projectId = this._contextProjectId;
        if (!projectId) return;
        const proj = mockProjects.find(p => p.id === projectId);
        if (proj) {
            proj.pinned = !proj.pinned;
            this._saveData();
            this.renderProjects();
        }
        document.getElementById('project-context-menu').classList.add('hidden');
    },

    setProjectStatusFromMenu(status) {
        const projectId = this._contextProjectId;
        if (!projectId) return;
        const proj = mockProjects.find(p => p.id === projectId);
        if (proj) {
            proj.status = status;

            // Note: If set to 'in-progress', if progress is 0, it might get weird but let's allow it.
            // But if it was cancelled/paused, setting to in-progress will let the auto-status take over next render.
            if (status === 'in-progress') {
                if (proj.progress === 0) proj.status = 'todo';
            }

            this._saveData();
            this.renderProjects();
        }
        document.getElementById('project-context-menu').classList.add('hidden');
    },

    /* close a project (it becomes read-only: no new topics or tasks) or open it again */
    async toggleCloseProjectFromMenu() {
        document.getElementById('project-context-menu').classList.add('hidden');
        const proj = mockProjects.find(p => p.id === this._contextProjectId);
        if (!proj) return;
        if (!this.hasPermission('แก้ไขโปรเจกต์')) { App._showToast('คุณไม่มีสิทธิ์แก้ไขโปรเจกต์', 'error'); return; }
        const closing = !proj.closedAt;
        if (closing) {
            const open = mockTasks.filter(t => t.projectId === proj.id && !t.isDraft && t.status !== 'done').length;
            if (open > 0 && !confirm(`ยังมีงานที่ยังไม่เสร็จ ${open} งาน ต้องการปิดโปรเจกต์เลยหรือไม่?`)) return;
        }
        proj.closedAt = closing ? new Date().toISOString() : null;
        if (closing) proj.status = 'completed';
        this._saveProjectMeta(proj.id, { closedAt: proj.closedAt });
        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            try {
                const { error } = await this._sbSaveSkippingMissing({ closed_at: proj.closedAt },
                    d => Object.keys(d).length ? window.conworkSupabase.client.from('projects').update(d).eq('id', proj.id) : Promise.resolve({}));
                if (error) console.warn('Could not save project closing', error.message);
            } catch (e) { console.warn(e); }
        }
        this._saveData();
        this.renderProjects();
        App._showToast(closing ? 'ปิดโปรเจกต์แล้ว (ดูได้อย่างเดียว)' : 'เปิดโปรเจกต์อีกครั้งแล้ว', 'success');
    },

    /* a closed project only allows viewing; returns true (and says so) when it is closed */
    _projectIsClosed(projectId) {
        const proj = mockProjects.find(p => String(p.id) === String(projectId));
        if (proj && proj.closedAt) {
            App._showToast('โปรเจกต์นี้ปิดแล้ว เปิดโปรเจกต์อีกครั้งก่อนแก้ไข', 'error');
            return true;
        }
        return false;
    },

    editProjectFromMenu() {
        document.getElementById('project-context-menu').classList.add('hidden');
        const proj = mockProjects.find(p => p.id === this._contextProjectId);
        if (!proj) return;

        this.state.editingProjectId = this._contextProjectId;

        const titleEl = document.querySelector('#create-project-modal h2');
        if (titleEl) titleEl.textContent = "แก้ไขโปรเจกต์";

        const btnEl = document.querySelector('#create-project-modal button[onclick="App.submitCreateProject()"]');
        if (btnEl) btnEl.textContent = "บันทึกการแก้ไข";

        this._initCreateProjectModal();

        // Override modal with project data
        document.getElementById('cp-name').value = proj.name;
        document.getElementById('cp-desc').value = proj.description || '';
        if (proj.startDate) document.getElementById('cp-start-date').value = proj.startDate;
        if (proj.dueDate) document.getElementById('cp-end-date').value = proj.dueDate;

        // Restore color
        if (proj.color) {
            const btn = document.querySelector(`.cp-color-btn:not(.cev-color-btn)[data-color="${proj.color}"]`)
                || document.querySelector(`.cp-color-btn:not(.cev-color-btn)[data-color="${this._oldProjectColors[proj.color] || ''}"]`);
            if (btn) this.selectProjectColor(btn);
        }

        // Restore the schedule (fixed dates or repeat)
        this._fillCpSchedule(proj.schedule && proj.schedule.mode === 'repeat' ? proj.schedule : null);

        // Restore type and budget
        this.setProjectType(proj.projectType || 'project');
        const budgetOn = document.getElementById('cp-budget-enabled');
        if (budgetOn) budgetOn.checked = !!proj.budgetEnabled;
        const budgetAmt = document.getElementById('cp-budget-amount');
        if (budgetAmt) budgetAmt.value = proj.budgetAmount != null ? proj.budgetAmount : '';
        this._cpBudgetToggle();

        // Restore manager
        if (proj.managers && proj.managers.length > 0) {
            proj.managers.forEach(id => this._dropdownSelectUser('manager-dropdown', id));
        } else if (proj.manager) {
            this._dropdownSelectUser('manager-dropdown', proj.manager);
        }

        // Restore comanagers
        if (proj.comanagers && proj.comanagers.length > 0) {
            proj.comanagers.forEach(id => this._dropdownSelectUser('co-manager-dropdown', id));
        }

        // Restore team
        if (proj.teams && proj.teams.length > 0) {
            proj.teams.forEach(t => this._selectTeam(t));
        } else if (proj.teamDept) {
            this._selectTeam(proj.teamDept);
        }

        // Restore members
        if (proj.team) {
            App._cpSelectedMembers = proj.team.filter(id => {
                const isManager = proj.managers ? proj.managers.includes(id) : id === proj.manager;
                const isComanager = proj.comanagers ? proj.comanagers.includes(id) : false;
                return !isManager && !isComanager && id !== this.state.currentUser.id;
            });
        } else {
            App._cpSelectedMembers = [];
        }
        this._renderCpSelectedMembers();

        // Restore the retired weekly appointment settings (older projects only)
        if (proj.schedule && Array.isArray(proj.schedule.days)) {
            if (proj.schedule.timeStart) document.getElementById('cp-time-start').value = proj.schedule.timeStart;
            if (proj.schedule.timeEnd) document.getElementById('cp-time-end').value = proj.schedule.timeEnd;

            // Restore days
            document.querySelectorAll('.day-btn').forEach(btn => {
                const d = btn.getAttribute('data-day');
                if (proj.schedule.days.includes(d)) {
                    btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600', 'day-active');
                    btn.classList.remove('border-gray-200', 'text-gray-600', 'hover:bg-gray-50');
                } else {
                    btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600', 'day-active');
                    btn.classList.add('border-gray-200', 'text-gray-600', 'hover:bg-gray-50');
                }
            });

            // Restore recur end options
            const endType = proj.schedule.recurEndType || 'never';
            const radio = document.querySelector(`input[name="end_type"][value="${endType}"]`);
            if (radio) radio.checked = true;
            
            const dateInput = document.getElementById('cp-end-recur-date');
            if (dateInput) {
                dateInput.value = proj.schedule.recurEndDate || '';
                dateInput.disabled = endType !== 'date';
            }
            
            const countInput = document.getElementById('cp-recur-count');
            if (countInput) {
                countInput.value = proj.schedule.recurEndCount || '';
                countInput.disabled = endType !== 'count';
            }
        }

        document.getElementById('create-project-modal').classList.remove('hidden');
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler);
        }, 50);
    },

    deleteProjectFromMenu() {
        const isManager = this.state.currentUser && ['admin', 'reviewer2', 'reviewer1', 'manager', 'supervisor'].includes(this.state.currentUser.role);
        if (!this.hasPermission('ลบโปรเจกต์')) {
            App._showToast('คุณไม่มีสิทธิ์ลบโปรเจกต์', 'error');
            return;
        }
        document.getElementById('project-context-menu').classList.add('hidden');
        const proj = mockProjects.find(p => p.id === this._contextProjectId);
        if (!proj) return;

        // Show confirm modal
        const nameEl = document.getElementById('delete-project-name');
        if (nameEl) nameEl.textContent = `"${proj.name}"`;
        document.getElementById('confirm-delete-modal').classList.remove('hidden');
    },

    cancelDelete() {
        document.getElementById('confirm-delete-modal').classList.add('hidden');
        this._contextProjectId = null;
    },

    async confirmDelete() {
        const id = this._contextProjectId;
        if (!id) return;

        const idx = mockProjects.findIndex(p => p.id === id);
        if (idx === -1) return;

        const name = mockProjects[idx].name;
        mockProjects.splice(idx, 1); // Remove from local mock list

        document.getElementById('confirm-delete-modal').classList.add('hidden');
        this._contextProjectId = null;

        // Sync project deletion to Supabase so Realtime notifies all logged-in clients!
        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            try {
                // Delete project from Supabase DB
                const { error } = await window.conworkSupabase.client
                    .from('projects')
                    .delete()
                    .eq('id', id);

                if (error) {
                    console.error("Error deleting project in Supabase:", error);
                    alert(`เกิดข้อผิดพลาดในการลบโปรเจกต์: ${error.message}`);
                    return; // Stop deletion
                }
            } catch (e) {
                console.error("Error in project delete sync:", e);
            }
        }

        this._saveData();
        this.renderProjects();
        this._showToast(`ลบโปรเจกต์ "${name}" เรียบร้อยแล้ว`, 'success');
    },

    createProject() {
        this.state.editingProjectId = null;

        const titleEl = document.querySelector('#create-project-modal h2');
        if (titleEl) titleEl.textContent = "สร้างโปรเจกต์ใหม่";

        const btnEl = document.querySelector('#create-project-modal button[onclick="App.submitCreateProject()"]');
        if (btnEl) btnEl.textContent = "สร้างโปรเจกต์";

        this._initCreateProjectModal();
        document.getElementById('create-project-modal').classList.remove('hidden');
        // Close dropdowns when clicking outside
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler);
        }, 50);
    },

    /* project type: 'project' (team work), 'single' (personal, only I can see it), 'division' (a whole department) */
    setProjectType(type) {
        const t = ['project', 'single', 'division'].includes(type) ? type : 'project';
        const input = document.getElementById('cp-project-type');
        if (input) input.value = t;
        ['project', 'single', 'division'].forEach(k => {
            const b = document.getElementById('cp-type-' + k);
            if (b) { b.classList.toggle('is-active', k === t); b.setAttribute('aria-pressed', String(k === t)); }
        });
        const show = (id, on) => document.getElementById(id)?.classList.toggle('hidden', !on);
        show('cp-managers-field', t !== 'single');
        show('cp-comanagers-field', t === 'project');
        show('cp-members-field', t === 'project');
        show('cp-teams-field', t !== 'single');
        const hint = document.getElementById('cp-type-hint');
        if (hint) hint.textContent = t === 'single' ? 'โปรเจกต์ส่วนตัว เห็นได้เฉพาะคุณคนเดียว'
            : t === 'division' ? 'งานของทั้งแผนก เลือกแผนกที่รับผิดชอบอย่างน้อย 1 แผนก'
            : 'ทำงานร่วมกับทีม กำหนดผู้ดูแลและผู้เข้าร่วมได้';
    },

    _cpBudgetToggle() {
        const on = !!document.getElementById('cp-budget-enabled')?.checked;
        document.getElementById('cp-budget-amount-row')?.classList.toggle('hidden', !on);
    },

    /* project type, budget and closing date are also kept in this browser, so they work before the database has those columns */
    _saveProjectMeta(id, meta) {
        try {
            const map = JSON.parse(localStorage.getItem('conwork_project_meta') || '{}');
            map[id] = Object.assign({}, map[id] || {}, meta);
            localStorage.setItem('conwork_project_meta', JSON.stringify(map));
        } catch (e) { }
    },
    _loadProjectMeta(id) {
        try { return JSON.parse(localStorage.getItem('conwork_project_meta') || '{}')[id] || {}; } catch (e) { return {}; }
    },

    _outsideClickHandler(e) {
        const pairs = [
            { drop: 'manager-dropdown', trigger: 'manager-dropdown' },
            { drop: 'co-manager-dropdown', trigger: 'co-manager-dropdown' },
            { drop: 'team-dropdown', trigger: 'team-dropdown' },
            { drop: 'div-dropdown', trigger: 'div-dropdown' },
            { drop: 'cp-members-dropdown', trigger: 'cp-members-dropdown' },
            { drop: 'ct-assignee-dropdown', trigger: null },
            { drop: 'ct-related-dropdown', trigger: null },
            { drop: 'ct-dept-dropdown', trigger: null },
            { drop: 'ct-div-dropdown', trigger: null },
            { drop: 'ct-reviewer-dropdown', trigger: null }
        ];
        pairs.forEach(({ drop }) => {
            const el = document.getElementById(drop);
            if (!el) return;
            const wrap = el.parentElement;
            if (wrap && !wrap.contains(e.target)) {
                el.classList.add('hidden');
            }
        });
    },

    _initCreateProjectModal() {
        if (!this.state.editingProjectId) {
            App._cpSelectedMembers = [];
        }
        this._renderCpSelectedMembers();

        // Set default dates
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 3);
        const endStr = endDate.toISOString().split('T')[0];

        const startInput = document.getElementById('cp-start-date');
        const endInput = document.getElementById('cp-end-date');
        const recurStart = document.getElementById('cp-recur-start');
        /* a new project starts with empty dates (the boxes show mm/dd/yyyy); editing fills them in afterwards */
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        if (recurStart) recurStart.value = todayStr;
        this._fillCpSchedule(null);
        this.setProjectType('project');
        const budgetOn = document.getElementById('cp-budget-enabled');
        if (budgetOn) budgetOn.checked = false;
        const budgetAmt = document.getElementById('cp-budget-amount');
        if (budgetAmt) budgetAmt.value = '';
        this._cpBudgetToggle();

        // Populate time dropdowns
        const timeStartSel = document.getElementById('cp-time-start');
        const timeEndSel = document.getElementById('cp-time-end');
        if (timeStartSel && timeEndSel) {
            timeStartSel.innerHTML = '';
            timeEndSel.innerHTML = '';
            for (let h = 0; h < 24; h++) {
                for (let m = 0; m < 60; m += 30) {
                    const hh = String(h).padStart(2, '0');
                    const mm = String(m).padStart(2, '0');
                    const t = `${hh}:${mm}`;
                    timeStartSel.innerHTML += `<option value="${t}">${t}</option>`;
                    timeEndSel.innerHTML += `<option value="${t}">${t}</option>`;
                }
            }
            timeStartSel.value = '10:00';
            timeEndSel.value = '11:00';
        }

        // Populate manager & co-manager dropdowns
        this._populateUserDropdown('manager-dropdown', (user) => {
            if (!App._cpSelectedManagers) App._cpSelectedManagers = [];
            if (!App._cpSelectedManagers.includes(user.id)) {
                App._cpSelectedManagers.push(user.id);
                App._renderCpSelectedManagers();
            }
            document.getElementById('manager-dropdown').classList.add('hidden');
        });
        this._populateUserDropdown('co-manager-dropdown', (user) => {
            if (!App._cpSelectedCoManagers) App._cpSelectedCoManagers = [];
            if (!App._cpSelectedCoManagers.includes(user.id)) {
                App._cpSelectedCoManagers.push(user.id);
                App._renderCpSelectedCoManagers();
            }
            document.getElementById('co-manager-dropdown').classList.add('hidden');
        });

        // Populate team dropdown with departments
        const teamDrop = document.getElementById('team-dropdown');
        if (teamDrop) {
            const fromSettings = [...document.querySelectorAll('#dept-list-container .dept-item span')].map(x => x.textContent.trim());
            const teams = [...new Set([...mockUsers.map(u => u.department), ...fromSettings])].filter(t => t && t !== App.ALL_DEPTS);
            teamDrop.innerHTML = `
                <div class="flex items-center px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm font-semibold text-blue-700 border-b border-gray-100 transition-colors"
                    onclick="App._selectTeam(App.ALL_DEPTS)">
                    <i class="fa-solid fa-building mr-2 text-blue-500 text-xs"></i>${App.ALL_DEPTS}
                </div>` + (teams.length ? '' : '<div class="px-4 py-2 text-sm text-gray-400">ยังไม่มีฝ่าย/แผนก</div>') + teams.map(t => `
                <div class="flex items-center px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 transition-colors"
                    onclick="App._selectTeam('${t}')">
                    <i class="fa-solid fa-users mr-2 text-blue-400 text-xs"></i>${t}
                </div>
            `).join('');
        }

        // Populate members dropdown
        this._populateUserDropdown('cp-members-dropdown', (user) => {
            if (!App._cpSelectedMembers) App._cpSelectedMembers = [];
            if (!App._cpSelectedMembers.includes(user.id)) {
                App._cpSelectedMembers.push(user.id);
                App._renderCpSelectedMembers();
            }
            document.getElementById('cp-members-dropdown').classList.add('hidden');
        });

        // Reset end type
        const endNever = document.getElementById('end-never');
        if (endNever) { endNever.checked = true; this.onEndTypeChange(); }

        // Reset day buttons
        document.querySelectorAll('.day-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600', 'day-active');
            btn.classList.add('border-gray-200', 'text-gray-600', 'hover:bg-gray-50');
        });
        // Default Wed(3) and Fri(5) active
        document.querySelectorAll('.day-btn').forEach(btn => {
            const d = btn.getAttribute('data-day');
            if (d === '3' || d === '5') {
                btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600', 'day-active');
                btn.classList.remove('border-gray-200', 'text-gray-600', 'hover:bg-gray-50');
            }
        });
    },

    _populateUserDropdown(dropdownId, onSelect) {
        const drop = document.getElementById(dropdownId);
        if (!drop) return;
        drop.innerHTML = mockUsers.map(u => `
            <div class="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors"
                onclick="App._dropdownSelectUser('${dropdownId}', '${u.id}')">
                <img src="${u.avatar}" class="w-7 h-7 rounded-full mr-2">
                <div>
                    <div class="text-sm font-medium text-gray-800" data-no-i18n>${u.name}</div>
                    <div class="text-xs text-gray-400" data-no-i18n>${u.department}</div>
                </div>
            </div>
        `).join('');
        // Store callback
        App[`_cb_${dropdownId}`] = onSelect;
    },

    _dropdownSelectUser(dropdownId, userId) {
        const user = mockUsers.find(u => u.id == userId);
        if (!user) return;
        const cb = App[`_cb_${dropdownId}`];
        if (cb) cb(user);
    },

    _selectTeam(teamName) {
        if (!App._cpSelectedTeams) App._cpSelectedTeams = [];
        if (teamName === App.ALL_DEPTS) App._cpSelectedTeams = [];
        else App._cpSelectedTeams = App._cpSelectedTeams.filter(t => t !== App.ALL_DEPTS);
        if (!App._cpSelectedTeams.includes(teamName)) {
            App._cpSelectedTeams.push(teamName);
            App._renderCpSelectedTeams();
        }
        document.getElementById('team-dropdown').classList.add('hidden');
    },

    _renderCpSelectedManagers() {
        const container = document.getElementById('cp-selected-managers');
        if (!container) return;
        if (!App._cpSelectedManagers || App._cpSelectedManagers.length === 0) {
            container.innerHTML = '<span class="text-gray-400 text-sm">ค้นหาหรือเลือกผู้ดูแลโครงการ</span>';
            return;
        }

        let html = '';
        App._cpSelectedManagers.forEach(id => {
            const user = mockUsers.find(u => u.id == id);
            if (!user) return;
            html += `
                <div class="flex items-center bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700 border border-gray-200">
                    <img src="${user.avatar}" class="w-5 h-5 rounded-full mr-1.5 object-cover">
                    ${user.name.split(' ')[0]} 
                    <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600" onclick="event.stopPropagation(); App._removeCpManager(${id})"></i>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    _removeCpManager(id) {
        if (!App._cpSelectedManagers) return;
        App._cpSelectedManagers = App._cpSelectedManagers.filter(mId => mId !== id);
        this._renderCpSelectedManagers();
    },

    _renderCpSelectedCoManagers() {
        const container = document.getElementById('cp-selected-comanagers');
        if (!container) return;
        if (!App._cpSelectedCoManagers || App._cpSelectedCoManagers.length === 0) {
            container.innerHTML = '<span class="text-gray-400 text-sm">ค้นหาหรือเลือกผู้ดูแลโครงการร่วม</span>';
            return;
        }

        let html = '';
        App._cpSelectedCoManagers.forEach(id => {
            const user = mockUsers.find(u => u.id == id);
            if (!user) return;
            html += `
                <div class="flex items-center bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700 border border-gray-200">
                    <img src="${user.avatar}" class="w-5 h-5 rounded-full mr-1.5 object-cover">
                    ${user.name.split(' ')[0]} 
                    <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600" onclick="event.stopPropagation(); App._removeCpCoManager(${id})"></i>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    _removeCpCoManager(id) {
        if (!App._cpSelectedCoManagers) return;
        App._cpSelectedCoManagers = App._cpSelectedCoManagers.filter(mId => mId !== id);
        this._renderCpSelectedCoManagers();
    },

    _renderCpSelectedTeams() {
        const container = document.getElementById('cp-selected-teams');
        if (!container) return;
        if (!App._cpSelectedTeams || App._cpSelectedTeams.length === 0) {
            container.innerHTML = '<span class="text-gray-400 text-sm">ค้นหาหรือเลือกฝ่าย/แผนก</span>';
            return;
        }

        let html = '';
        App._cpSelectedTeams.forEach(team => {
            html += `
                <div class="flex items-center bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-700 border border-gray-200">
                    <i class="fa-solid fa-users mr-1.5 text-gray-500"></i> ${team}
                    <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600" onclick="event.stopPropagation(); App._removeCpTeam('${team}')"></i>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    _removeCpTeam(team) {
        if (!App._cpSelectedTeams) return;
        App._cpSelectedTeams = App._cpSelectedTeams.filter(t => t !== team);
        this._renderCpSelectedTeams();
    },

    _renderCpSelectedMembers() {
        const container = document.getElementById('cp-selected-members');
        if (!container) return;
        if (!App._cpSelectedMembers || App._cpSelectedMembers.length === 0) {
            container.innerHTML = '<span class="text-gray-400 text-sm">ค้นหาหรือเลือกผู้เข้าร่วม</span>';
            return;
        }

        let html = '';
        App._cpSelectedMembers.forEach(id => {
            const user = mockUsers.find(u => u.id == id);
            if (!user) return;
            html += `
                <div class="flex items-center bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700 border border-gray-200">
                    <img src="${user.avatar}" class="w-5 h-5 rounded-full mr-1.5 object-cover">
                    ${user.name.split(' ')[0]} 
                    <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600" onclick="event.stopPropagation(); App._removeCpMember(${id})"></i>
                </div>
            `;
        });
        container.innerHTML = html;
    },

    _removeCpMember(id) {
        if (!App._cpSelectedMembers) return;
        App._cpSelectedMembers = App._cpSelectedMembers.filter(mId => mId !== id);
        this._renderCpSelectedMembers();
    },

    toggleDropdown(dropdownId, forceShow = false) {
        const drop = document.getElementById(dropdownId);
        if (!drop) return;
        // Close all others
        ['manager-dropdown', 'co-manager-dropdown', 'team-dropdown', 'div-dropdown', 'cp-members-dropdown', 'ct-assignee-dropdown', 'ct-related-dropdown', 'ct-dept-dropdown', 'ct-div-dropdown'].forEach(id => {
            if (id !== dropdownId) {
                document.getElementById(id)?.classList.add('hidden');
            }
        });
        if (forceShow) {
            drop.classList.remove('hidden');
        } else {
            drop.classList.toggle('hidden');
        }
    },

    toggleDay(btn) {
        const isActive = btn.classList.contains('day-active');
        if (isActive) {
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600', 'day-active');
            btn.classList.add('border-gray-200', 'text-gray-600', 'hover:bg-gray-50');
        } else {
            btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600', 'day-active');
            btn.classList.remove('border-gray-200', 'text-gray-600', 'hover:bg-gray-50');
        }
    },

    onEndTypeChange() {
        const val = document.querySelector('input[name="end_type"]:checked')?.value;
        const endDateInput = document.getElementById('cp-end-recur-date');
        const endCountInput = document.getElementById('cp-recur-count');
        if (endDateInput) endDateInput.disabled = (val !== 'date');
        if (endCountInput) endCountInput.disabled = (val !== 'count');
        // Visual feedback
        if (endDateInput) endDateInput.classList.toggle('bg-white', val === 'date');
        if (endCountInput) endCountInput.classList.toggle('bg-white', val === 'count');
    },

    /* the "every division" choice in a project's divisions list */
    ALL_DEPTS: 'ทุกฝ่าย',

    /* colors from the earlier palette, so editing an older project still highlights its swatch */
    _oldProjectColors: {
        'bg-red-500': 'bg-red-600', 'bg-amber-400': 'bg-amber-500', 'bg-green-500': 'bg-green-600', 'bg-emerald-400': 'bg-teal-500',
        'bg-cyan-500': 'bg-sky-500', 'bg-blue-500': 'bg-blue-600', 'bg-purple-500': 'bg-violet-600', 'bg-pink-500': 'bg-pink-600',
        'bg-rose-500': 'bg-pink-600', 'bg-slate-500': 'bg-slate-600'
    },

    setProjectScheduleMode(mode) {
        const repeat = mode === 'repeat';
        const modeInput = document.getElementById('cp-schedule-mode');
        if (modeInput) modeInput.value = repeat ? 'repeat' : 'range';
        [['cp-mode-range', !repeat], ['cp-mode-repeat', repeat]].forEach(([id, on]) => {
            const b = document.getElementById(id);
            if (b) { b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); }
        });
        document.getElementById('cp-repeat-panel')?.classList.toggle('hidden', !repeat);
        document.getElementById('cp-end-wrap')?.classList.toggle('hidden', repeat);
        document.getElementById('cp-range-dash')?.classList.toggle('hidden', repeat);
        const lbl = document.getElementById('cp-start-label');
        if (lbl) lbl.textContent = repeat ? 'เริ่มรอบแรกตั้งแต่วันที่' : 'เริ่มต้น';
        /* nothing picked yet: start from the first date's weekday and day of the month */
        const start = document.getElementById('cp-start-date')?.value;
        if (repeat && start) {
            const pick = (sel, val) => {
                if (document.querySelector(sel + '.is-on')) return;
                const b = document.querySelector(`${sel}[data-d="${val}"]`);
                if (b) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
            };
            pick('.cp-wd', new Date(start + 'T00:00:00').getDay());
            pick('.cp-md', +start.slice(8, 10));
        }
        this._cpRepeatUpdate();
    },

    _cpChip(btn) {
        btn.classList.toggle('is-on');
        btn.setAttribute('aria-pressed', String(btn.classList.contains('is-on')));
        this._cpRepeatUpdate();
    },

    /* monthly repeat: on dates of the month (1-31), or on a weekday of a given week (e.g. Wednesday of the last week) */
    _cpMonthMode(mode) {
        const byWeekday = mode === 'weekday';
        const input = document.getElementById('cp-rep-month-mode');
        if (input) input.value = byWeekday ? 'weekday' : 'date';
        [['cp-mmode-date', !byWeekday], ['cp-mmode-weekday', byWeekday]].forEach(([id, on]) => {
            const b = document.getElementById(id);
            if (b) { b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); }
        });
        document.getElementById('cp-rep-mdate')?.classList.toggle('hidden', byWeekday);
        document.getElementById('cp-rep-mweekday')?.classList.toggle('hidden', !byWeekday);
        this._cpRepeatUpdate();
    },

    /* put a schedule into the form; null means a fixed start/end project */
    _fillCpSchedule(sch) {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        const r = sch || {};
        set('cp-rep-every', r.every || 1);
        set('cp-rep-unit', r.unit || 'week');
        set('cp-rep-count', r.count || 12);
        set('cp-rep-until', r.until || '');
        const endRadio = document.getElementById(r.endType === 'date' ? 'cp-rep-end-date' : 'cp-rep-end-count');
        if (endRadio) endRadio.checked = true;
        document.querySelectorAll('.cp-wd').forEach(b => {
            const on = sch ? (r.weekdays || []).map(String).includes(b.dataset.d) : false;
            b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
        });
        document.querySelectorAll('.cp-md').forEach(b => {
            const on = sch ? (r.monthDays || []).map(String).includes(b.dataset.d) : false;
            b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
        });
        set('cp-rep-nth', r.nth != null ? String(r.nth) : '-1');
        set('cp-rep-nthday', r.nthDay != null ? String(r.nthDay) : '3');
        this._cpMonthMode(r.monthMode === 'weekday' ? 'weekday' : 'date');
        this.setProjectScheduleMode(sch ? 'repeat' : 'range');
    },

    /* read the repeat settings from the form: null for a fixed-date project, {error} when something is missing */
    _readCpSchedule() {
        if (document.getElementById('cp-schedule-mode')?.value !== 'repeat') return null;
        const start = document.getElementById('cp-start-date')?.value;
        const unit = document.getElementById('cp-rep-unit')?.value || 'week';
        const every = Math.max(1, Math.min(99, parseInt(document.getElementById('cp-rep-every')?.value, 10) || 1));
        const endType = document.querySelector('input[name="cp-rep-end"]:checked')?.value || 'count';
        const count = Math.max(1, Math.min(500, parseInt(document.getElementById('cp-rep-count')?.value, 10) || 0));
        const until = document.getElementById('cp-rep-until')?.value || '';
        const weekdays = [...document.querySelectorAll('.cp-wd.is-on')].map(b => b.dataset.d);
        const monthDays = [...document.querySelectorAll('.cp-md.is-on')].map(b => +b.dataset.d).sort((a, b) => a - b);
        const monthMode = document.getElementById('cp-rep-month-mode')?.value === 'weekday' ? 'weekday' : 'date';
        const nth = parseInt(document.getElementById('cp-rep-nth')?.value, 10) || -1;
        const nthDay = parseInt(document.getElementById('cp-rep-nthday')?.value, 10) || 0;
        if (!start) return { error: 'กรุณาเลือกวันเริ่มรอบแรก' };
        if (unit === 'week' && !weekdays.length) return { error: 'กรุณาเลือกวันในสัปดาห์ที่ต้องทำซ้ำ' };
        if (unit === 'month' && monthMode === 'date' && !monthDays.length) return { error: 'กรุณาเลือกวันที่ของเดือนที่ต้องทำซ้ำ' };
        if (endType === 'count' && !(parseInt(document.getElementById('cp-rep-count')?.value, 10) > 0)) return { error: 'กรุณาใส่จำนวนรอบ' };
        if (endType === 'date' && !until) return { error: 'กรุณาเลือกวันสิ้นสุดการทำซ้ำ' };
        if (endType === 'date' && until < start) return { error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' };
        const sch = { mode: 'repeat', every, unit, weekdays: unit === 'week' ? weekdays : [], monthDays: unit === 'month' && monthMode === 'date' ? monthDays : [], endType, count: endType === 'count' ? count : null, until: endType === 'date' ? until : null };
        if (unit === 'month' && monthMode === 'weekday') Object.assign(sch, { monthMode, nth, nthDay });
        const all = this._projectOccurrences({ startDate: start, schedule: sch });
        if (!all.length) return { error: 'ไม่มีวันไหนตรงกับรูปแบบที่ตั้งไว้' };
        sch.lastDate = all[all.length - 1];
        return sch;
    },

    /* every date (YYYY-MM-DD) a repeating project runs on, optionally only those between from and to */
    _projectOccurrences(p, from, to) {
        const sch = p && p.schedule;
        if (!sch || sch.mode !== 'repeat' || !p.startDate) return [];
        const pad = n => String(n).padStart(2, '0');
        const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const start = new Date(p.startDate + 'T00:00:00');
        const every = Math.max(1, sch.every || 1);
        const limitCount = sch.endType === 'count' ? Math.max(1, sch.count || 1) : Infinity;
        const until = sch.endType === 'date' && sch.until ? sch.until : null;
        const hardStop = new Date(start); hardStop.setFullYear(hardStop.getFullYear() + 10);
        const weekdays = (sch.weekdays || []).map(String);
        const monthDays = (sch.monthDays || []).map(Number);
        const startWeek = new Date(start); startWeek.setDate(start.getDate() - start.getDay());
        const out = [];
        let n = 0;
        for (const d = new Date(start); d <= hardStop; d.setDate(d.getDate() + 1)) {
            const ds = iso(d);
            if (until && ds > until) break;
            if (to && ds > to) break;
            let hit = false;
            if (sch.unit === 'day') {
                hit = Math.round((d - start) / 86400000) % every === 0;
            } else if (sch.unit === 'week') {
                const weeks = Math.floor(Math.round((d - startWeek) / 86400000) / 7);
                hit = weeks % every === 0 && weekdays.includes(String(d.getDay()));
            } else {
                const months = (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth();
                const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                const day = d.getDate();
                if (sch.monthMode === 'weekday') {
                    /* nth = 1..4 for the first..fourth such weekday of the month, -1 for the last one */
                    const week = sch.nth === -1 ? (day + 7 > last ? -1 : 0) : Math.ceil(day / 7);
                    hit = months % every === 0 && d.getDay() === Number(sch.nthDay) && week === Number(sch.nth);
                } else {
                    hit = months % every === 0 && (monthDays.includes(day) || (day === last && monthDays.some(m => m > last)));
                }
            }
            if (!hit) continue;
            n++;
            if (!from || ds >= from) out.push(ds);
            if (n >= limitCount) break;
        }
        return out;
    },

    /* show or hide the weekday / day-of-month pickers and write the summary line under the repeat settings */
    _cpRepeatUpdate() {
        const unit = document.getElementById('cp-rep-unit')?.value || 'week';
        document.getElementById('cp-rep-week-row')?.classList.toggle('hidden', unit !== 'week');
        document.getElementById('cp-rep-month-row')?.classList.toggle('hidden', unit !== 'month');
        const endType = document.querySelector('input[name="cp-rep-end"]:checked')?.value || 'count';
        const cnt = document.getElementById('cp-rep-count'), until = document.getElementById('cp-rep-until');
        if (cnt) cnt.disabled = endType !== 'count';
        if (until) until.disabled = endType !== 'date';
        const box = document.getElementById('cp-rep-summary');
        if (!box || document.getElementById('cp-schedule-mode')?.value !== 'repeat') return;
        const en = typeof i18nIsEnglish === 'function' && i18nIsEnglish();
        const start = document.getElementById('cp-start-date')?.value;
        const sch = this._readCpSchedule();
        if (!start || !sch || sch.error) {
            box.className = 'cp-rep-summary is-empty';
            box.textContent = en ? 'Pick a first date and the days to repeat on to see the rounds.' : 'เลือกวันเริ่มและวันที่ต้องทำซ้ำ แล้วจะเห็นรอบทั้งหมดตรงนี้';
            return;
        }
        const all = this._projectOccurrences({ startDate: start, schedule: sch });
        const fmt = ds => new Date(ds + 'T00:00:00').toLocaleDateString(en ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
        const unitTxt = en ? { day: 'day', week: 'week', month: 'month' }[sch.unit] + (sch.every > 1 ? 's' : '') : { day: 'วัน', week: 'สัปดาห์', month: 'เดือน' }[sch.unit];
        const dayNames = en ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
        let rule = en ? `Every ${sch.every > 1 ? sch.every + ' ' : ''}${unitTxt}` : `ทุก ${sch.every > 1 ? sch.every + ' ' : ''}${unitTxt}`;
        if (sch.unit === 'week') rule += (en ? ' on ' : ' วัน ') + ['1', '2', '3', '4', '5', '6', '0'].filter(d => sch.weekdays.includes(d)).map(d => dayNames[+d]).join(', ');
        if (sch.unit === 'month' && sch.monthMode === 'weekday') {
            const nthTxt = en ? { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last' }[sch.nth] : { 1: 'สัปดาห์แรก', 2: 'สัปดาห์ที่ 2', 3: 'สัปดาห์ที่ 3', 4: 'สัปดาห์ที่ 4', '-1': 'สัปดาห์สุดท้าย' }[sch.nth];
            const fullDays = en ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
            rule += en ? ` on the ${nthTxt} ${fullDays[sch.nthDay]}` : ` ${fullDays[sch.nthDay]}ของ${nthTxt}`;
        } else if (sch.unit === 'month') rule += (en ? ' on day ' : ' วันที่ ') + sch.monthDays.join(', ');
        const preview = all.slice(0, 4).map(fmt).join(' · ') + (all.length > 4 ? ' …' : '');
        box.className = 'cp-rep-summary';
        box.innerHTML = `<b>${rule}</b><span>${en ? `${all.length} rounds · ${fmt(all[0])} to ${fmt(all[all.length - 1])}` : `${all.length} รอบ · ${fmt(all[0])} ถึง ${fmt(all[all.length - 1])}`}</span><span class="cp-rep-dates">${preview}</span>`;
    },

    /* chat safety: text written by people is always shown as text, never run as HTML */
    _esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    /* a message's text: escaped, with web links made clickable (line breaks are kept by whitespace-pre-wrap) */
    _richText(t) {
        return this._esc(t).replace(/\bhttps?:\/\/[^\s<]+/g, url => {
            const clean = url.replace(/[.,!?)]+$/, '');
            return `<a href="${clean}" target="_blank" rel="noopener noreferrer" class="underline break-all">${clean}</a>` + url.slice(clean.length);
        });
    },
    /* only picture/file addresses that are safe to put in src/href */
    _safeUrl(u) {
        const s = String(u || '').trim();
        return /^(https?:|blob:|data:(image|application|text|audio|video)\/)/i.test(s) ? this._esc(s) : '';
    },

    /* a plain picture with a person's initials, for people without a profile picture (instead of a stock photo of someone else) */
    _initialsAvatar(name) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(String(name || 'U').trim() || 'U')}&background=DBEAFE&color=1D4ED8`;
    },

    /* topic colors also live in this browser, so they survive when the task_sections table has no color column yet */
    _saveTopicColor(id, color) {
        try {
            const map = JSON.parse(localStorage.getItem('conwork_topic_colors') || '{}');
            map[id] = color;
            localStorage.setItem('conwork_topic_colors', JSON.stringify(map));
        } catch (e) { }
    },
    _loadTopicColor(id) {
        try { return JSON.parse(localStorage.getItem('conwork_topic_colors') || '{}')[id] || null; } catch (e) { return null; }
    },

    /* repeat settings also live in this browser, so they survive when the projects table has no schedule column yet */
    _saveProjectSchedule(id, sch) {
        try {
            const map = JSON.parse(localStorage.getItem('conwork_project_schedules') || '{}');
            if (sch) map[id] = sch; else delete map[id];
            localStorage.setItem('conwork_project_schedules', JSON.stringify(map));
        } catch (e) { }
    },
    _loadProjectSchedule(id, fromDb) {
        if (fromDb && typeof fromDb === 'object' && fromDb.mode === 'repeat') return fromDb;
        try {
            const map = JSON.parse(localStorage.getItem('conwork_project_schedules') || '{}');
            return map[id] || null;
        } catch (e) { return null; }
    },

    selectProjectColor(btn) {
        document.querySelectorAll('.cp-color-btn:not(.cev-color-btn)').forEach(b => {
            b.classList.remove('ring-2', 'ring-offset-2', 'ring-gray-400', 'scale-110');
        });
        btn.classList.add('ring-2', 'ring-offset-2', 'ring-gray-400', 'scale-110');
        const colorInput = document.getElementById('cp-color');
        if (colorInput) colorInput.value = btn.getAttribute('data-color');
    },

    closeCreateProjectModal() {
        document.getElementById('create-project-modal').classList.add('hidden');
        document.removeEventListener('click', this._outsideClickHandler);
        // Reset fields
        const fields = ['cp-name', 'cp-desc', 'cp-manager', 'cp-co-manager', 'cp-team'];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Reset color
        const colorInput = document.getElementById('cp-color');
        if (colorInput) {
            colorInput.value = 'bg-blue-600';
            document.querySelectorAll('.cp-color-btn:not(.cev-color-btn)').forEach(b => {
                b.classList.remove('ring-2', 'ring-offset-2', 'ring-gray-400', 'scale-110');
                if (b.getAttribute('data-color') === 'bg-blue-600') {
                    b.classList.add('ring-2', 'ring-offset-2', 'ring-gray-400', 'scale-110');
                }
            });
        }
        ['cp-manager-avatar', 'cp-co-manager-avatar'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.src = ''; el.classList.add('hidden'); }
        });
        App._cpSelectedManagers = [];
        App._cpSelectedCoManagers = [];
        App._cpSelectedTeams = [];
        App._cpSelectedMembers = [];
        this._renderCpSelectedManagers();
        this._renderCpSelectedCoManagers();
        this._renderCpSelectedTeams();
        this._renderCpSelectedMembers();
    },

    /* run a Supabase insert/update; if the table lacks a column ("Could not find the 'x' column"), drop that field and try again */
    async _sbSaveSkippingMissing(data, run) {
        const d = Object.assign({}, data);
        let res = await run(d);
        for (let i = 0; i < 12 && res && res.error; i++) {
            const m = /Could not find the '([^']+)' column/i.exec(res.error.message || '') || /column "?([a-z_]+)"? of relation .* does not exist/i.exec(res.error.message || '');
            if (!m || !(m[1] in d)) break;
            console.warn('[projects] column missing in the database, saving without it:', m[1]);
            delete d[m[1]];
            res = await run(d);
        }
        return res;
    },

    /* project_members has a check on project_role; databases set up differently allow different names.
       Try the app's names first (manager / comanager / contributor), then common alternatives. */
    async _insertProjectMembers(rows) {
        const sb = window.conworkSupabase.client;
        const tries = [
            null,
            { manager: 'owner', comanager: 'admin', contributor: 'member' },
            { manager: 'manager', comanager: 'manager', contributor: 'member' },
            { manager: 'owner', comanager: 'editor', contributor: 'viewer' },
            { manager: 'admin', comanager: 'admin', contributor: 'member' },
            { manager: 'member', comanager: 'member', contributor: 'member' }
        ];
        let res;
        for (const map of tries) {
            const data = map ? rows.map(r => Object.assign({}, r, { project_role: map[r.project_role] || r.project_role })) : rows;
            res = await sb.from('project_members').insert(data);
            if (!res.error || !/project_role/.test(res.error.message || '')) return res;
            console.warn('[projects] project_role not accepted, trying other names', map);
        }
        return res;
    },

    async submitCreateProject() {
        const isManager = this.state.currentUser && ['admin', 'reviewer2', 'reviewer1', 'manager', 'supervisor'].includes(this.state.currentUser.role);
        if (this.state.editingProjectId) {
            if (!this.hasPermission('แก้ไขโปรเจกต์')) {
                App._showToast('คุณไม่มีสิทธิ์แก้ไขโปรเจกต์', 'error');
                return;
            }
        } else {
            if (!this.hasPermission('สร้างโปรเจกต์')) {
                App._showToast('คุณไม่มีสิทธิ์สร้างโปรเจกต์', 'error');
                return;
            }
        }
        const name = document.getElementById('cp-name')?.value?.trim();
        if (!name) {
            document.getElementById('cp-name').classList.add('border-red-500');
            document.getElementById('cp-name').focus();
            return;
        }
        document.getElementById('cp-name').classList.remove('border-red-500');

        const startDate = document.getElementById('cp-start-date')?.value;
        const schedule = this._readCpSchedule();
        if (schedule && schedule.error) { App._showToast(schedule.error, 'error'); return; }
        /* a repeating project ends on its last round, so lists, status and the database keep working with one end date */
        const endDate = schedule ? schedule.lastDate : document.getElementById('cp-end-date')?.value;
        if (!startDate || !endDate) { App._showToast('กรุณาเลือกวันเริ่มต้นและวันสิ้นสุดของโครงการ', 'error'); return; }
        if (endDate < startDate) { App._showToast('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', 'error'); return; }
        if (schedule) delete schedule.lastDate;
        const desc = document.getElementById('cp-desc')?.value?.trim();
        const color = document.getElementById('cp-color')?.value || 'bg-blue-500';
        /* type decides who is in the project: Single = only me, Division = a department (+ its managers), Project = chosen people */
        const projectType = document.getElementById('cp-project-type')?.value || 'project';
        const budgetEnabled = !!document.getElementById('cp-budget-enabled')?.checked;
        const budgetRaw = document.getElementById('cp-budget-amount')?.value;
        const budgetAmount = budgetEnabled && budgetRaw !== '' ? Math.max(0, parseFloat(budgetRaw) || 0) : null;
        if (projectType === 'division' && !(App._cpSelectedTeams || []).length) {
            App._showToast('กรุณาเลือกแผนกที่รับผิดชอบอย่างน้อย 1 แผนก', 'error');
            return;
        }
        if (projectType === 'single') {
            App._cpSelectedManagers = [this.state.currentUser.id];
            App._cpSelectedCoManagers = [];
            App._cpSelectedMembers = [];
            App._cpSelectedTeams = [];
        } else if (projectType === 'division') {
            App._cpSelectedCoManagers = [];
            App._cpSelectedMembers = [];
        }
        const managers = App._cpSelectedManagers || [];
        const comanagers = App._cpSelectedCoManagers || [];
        const teams = App._cpSelectedTeams || [];
        const metaFields = { projectType, budgetEnabled, budgetAmount };
        const metaDb = { project_type: projectType, budget_enabled: budgetEnabled, budget_amount: budgetAmount };

        // Collect selected days
        const selectedDays = [];
        document.querySelectorAll('.day-btn.day-active').forEach(btn => selectedDays.push(btn.getAttribute('data-day')));

        const timeStart = document.getElementById('cp-time-start')?.value;
        const timeEnd = document.getElementById('cp-time-end')?.value;

        // Recurrence end logic
        const recurEndType = document.querySelector('input[name="end_type"]:checked')?.value || 'never';
        const recurEndDate = document.getElementById('cp-end-recur-date')?.value;
        const recurEndCount = document.getElementById('cp-recur-count')?.value;

        // Build team array
        const teamMembers = [this.state.currentUser.id];
        managers.forEach(m => { if (!teamMembers.includes(m)) teamMembers.push(m); });
        comanagers.forEach(m => { if (!teamMembers.includes(m)) teamMembers.push(m); });
        if (App._cpSelectedMembers) {
            App._cpSelectedMembers.forEach(id => {
                if (!teamMembers.includes(id)) teamMembers.push(id);
            });
        }

        if (this.state.editingProjectId) {
            const proj = mockProjects.find(p => p.id === this.state.editingProjectId);
            if (proj) {
                proj.name = name;
                proj.description = desc;
                proj.color = color;
                proj.startDate = startDate;
                proj.dueDate = endDate;
                proj.manager = managers[0] || null; // Backward compatibility for single manager access
                proj.managers = managers;
                proj.comanagers = comanagers;
                proj.teamDept = teams.join(', ');
                proj.teams = teams;
                proj.team = teamMembers;
                proj.schedule = schedule;
                this._saveProjectSchedule(proj.id, schedule);
                Object.assign(proj, metaFields);
                this._saveProjectMeta(proj.id, metaFields);

                // --- Update Supabase Project ---
                if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !['p1', 'p2', 'p3', 'p4'].includes(String(proj.id))) {
                    try {
                        const upd = { name: name, description: desc, color: color, start_date: startDate || null, due_date: endDate || null, departments: teams, schedule: schedule, ...metaDb };
                        const { error: upErr } = await this._sbSaveSkippingMissing(upd, d => window.conworkSupabase.client.from('projects').update(d).eq('id', proj.id));
                        if (upErr) console.error('Error updating project', upErr);

                        // Sync members
                        if (teamMembers.length > 0) {
                            // Delete old members
                            await window.conworkSupabase.client.from('project_members').delete().eq('project_id', proj.id);
                            // Insert new members
                            const membersToInsert = teamMembers.map(uid => {
                                let role = 'contributor';
                                if (uid === this.state.currentUser.id || (managers && managers.includes(uid))) {
                                    role = 'manager';
                                } else if (comanagers && comanagers.includes(uid)) {
                                    role = 'comanager';
                                }
                                return {
                                    project_id: proj.id,
                                    user_id: uid,
                                    project_role: role 
                                };
                            });
                            const { error: pmErr } = await this._insertProjectMembers(membersToInsert);
                            if (pmErr) {
                                console.error("Error updating project_members in Supabase:", pmErr);
                                alert(`เกิดข้อผิดพลาดในการบันทึกรายชื่อคนเข้าโปรเจกต์:\n${pmErr.message}`);
                            }
                        }
                    } catch (e) { console.error('Error updating project on Supabase', e); }
                }

                // Update calendar events
                for (let i = mockEvents.length - 1; i >= 0; i--) {
                    if (mockEvents[i].id === 'e-start-' + proj.id || mockEvents[i].id === 'e-end-' + proj.id) {
                        mockEvents.splice(i, 1);
                    }
                }

                if (startDate) {
                    mockEvents.push({
                        id: 'e-start-' + proj.id,
                        title: `▶ ${name} (เริ่ม)`,
                        date: startDate,
                        type: 'project',
                        time: '',
                        projectId: proj.id
                    });
                }
                if (endDate) {
                    mockEvents.push({
                        id: 'e-end-' + proj.id,
                        title: `■ ${name} (สิ้นสุด)`,
                        date: endDate,
                        type: 'project',
                        time: '',
                        projectId: proj.id
                    });
                }
            }
            this._showToast(`บันทึกการแก้ไขโปรเจกต์ "${name}" เรียบร้อยแล้ว!`, 'success');
        } else {
            let newId = 'p' + Date.now();
            let finalStatus = 'plan';
            let progressPct = 0;

            // --- Supabase DB Sync ---
            if (window.conworkSupabase && window.conworkSupabase.isAvailable() && this.state.currentUser) {
                try {
                    let companyId = this.state.currentUser.workspaceId;
                    if (!companyId && this.state.workspaces && this.state.workspaces.length > 0) {
                        companyId = this.state.workspaces[0].workspace_id;
                    }
                    if (!companyId) companyId = 'W-1';

                    const dbProjData = {
                        company_id: companyId,
                        owner_id: this.state.currentUser.id,
                        name: name,
                        description: desc,
                        color: color,
                        status: 'planning',
                        progress_pct: 0,
                        start_date: startDate || null,
                        due_date: endDate || null,
                        departments: teams,
                        schedule: schedule,
                        ...metaDb
                    };

                    /* columns this database does not have yet (conwork-projects.sql adds them) are left out instead of failing */
                    const { data: insertedProj, error: insErr } = await this._sbSaveSkippingMissing(dbProjData,
                        d => window.conworkSupabase.client.from('projects').insert(d).select().single());
                        
                    if (insErr) {
                        console.error("Error creating project:", insErr);
                        alert(`เกิดข้อผิดพลาดในการสร้างโปรเจกต์:\n${insErr.message}`);
                        return;
                    } else if (insertedProj) {
                        newId = insertedProj.id;
                        finalStatus = 'active'; 
                        progressPct = insertedProj.progress_pct || 0;

                        const allProjectUserIds = [...new Set([
                            this.state.currentUser.id,
                            ...(managers || []),
                            ...(comanagers || []),
                            ...(teamMembers || [])
                        ])].filter(Boolean);

                        if (allProjectUserIds.length > 0) {
                            const membersToInsert = allProjectUserIds.map(uid => {
                                let role = 'contributor';
                                if (uid === this.state.currentUser.id || (managers && managers.includes(uid))) {
                                    role = 'manager';
                                } else if (comanagers && comanagers.includes(uid)) {
                                    role = 'comanager';
                                }
                                return {
                                    project_id: newId,
                                    user_id: uid,
                                    project_role: role 
                                };
                            });
                            const { error: pmErr } = await this._insertProjectMembers(membersToInsert);
                            if (pmErr) {
                                console.error("Error inserting project_members in Supabase:", pmErr);
                                alert(`เกิดข้อผิดพลาดในการบันทึกรายชื่อคนเข้าโปรเจกต์ใหม่:\n${pmErr.message}`);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error saving project to Supabase:", e);
                    alert(`เกิดข้อผิดพลาด:\n${e.message}`);
                    return;
                }
            }

            // Calculate progress from dates
            const newProject = {
                id: newId,
                name: name,
                description: desc,
                color: color,
                status: finalStatus,
                tasksTotal: 0,
                tasksDone: 0,
                progress: progressPct,
                team: teamMembers,
                startDate: startDate,
                dueDate: endDate,
                manager: managers[0] || null, // Backward compatibility
                managers: managers,
                comanagers: comanagers,
                teamDept: teams.join(', '),
                teams: teams,
                schedule: schedule,
                ownerId: this.state.currentUser.id,
                ...metaFields
            };

            mockProjects.push(newProject);
            this._saveProjectSchedule(newProject.id, schedule);
            this._saveProjectMeta(newProject.id, metaFields);

            // --- Link to calendar: add start & end events + recurring schedule ---
            if (startDate) {
                mockEvents.push({
                    id: 'e-start-' + newProject.id,
                    title: `▶ ${name} (เริ่ม)`,
                    date: startDate,
                    type: 'project',
                    time: '',
                    projectId: newProject.id
                });
            }
            if (endDate) {
                mockEvents.push({
                    id: 'e-end-' + newProject.id,
                    title: `■ ${name} (สิ้นสุด)`,
                    date: endDate,
                    type: 'project',
                    time: '',
                    projectId: newProject.id
                });
            }

            this.addNotification('project', 'โปรเจกต์ใหม่ถูกสร้าง', `เริ่มต้นโปรเจกต์ "${name}" สำเร็จ! ขอให้ทีมทำงานอย่างราบรื่นนะครับ 🎉`, { view: 'tasks', projectId: newProject.id });

            this._showToast(`สร้างโปรเจกต์ "${name}" และเพิ่มลงปฏิทินเรียบร้อยแล้ว!`, 'success');
        }

        this._saveData();
        this.renderProjects();
        this.closeCreateProjectModal();
    },

    _showToast(message, type = 'info', userText = '') {
        const existing = document.getElementById('app-toast');
        if (existing) existing.remove();
        const color = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
        const toast = document.createElement('div');
        toast.id = 'app-toast';
        toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 ${color} text-white px-6 py-3 rounded-xl shadow-xl text-sm font-medium z-[9999] flex items-center space-x-2 transition-all`;
        toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-info'}"></i><span></span>`;
        toast.querySelector('span').textContent = message; // messages can contain what people typed: never run it as HTML
        /* optional part written by a person (e.g. a chat message): shown as typed, never translated */
        if (userText) {
            const quoted = document.createElement('span');
            quoted.setAttribute('data-no-i18n', '');
            quoted.textContent = userText;
            toast.appendChild(quoted);
        }
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    scheduleMeeting() {
        alert("ระบบนัดประชุมกำลังอยู่ในระหว่างการพัฒนา!");
    },

    // --- Create Event Modal Logic ---
    openCreateEventModal(eventId = null) {
        const modal = document.getElementById('create-event-modal');
        if (!modal) return;

        this.state.editingEventId = eventId;
        const titleEl = document.getElementById('cev-modal-title');
        const deleteBtn = document.getElementById('cev-delete-btn');

        // Reset form
        document.getElementById('cev-title').value = '';
        document.getElementById('cev-date').value = this.state.selectedDate || '';
        document.getElementById('cev-time').value = '';
        if (document.getElementById('cev-end-date')) document.getElementById('cev-end-date').value = '';
        document.getElementById('cev-note').innerHTML = '';
        
        this.state.cevFiles = [];
        this.renderCevFiles();

        const initCalType = (this.state.calTab === 'group' || this.state.calTab === 'personal' || this.state.calTab === 'all') ? this.state.calTab : 'all';
        if (document.getElementById('cev-cal-type')) document.getElementById('cev-cal-type').value = initCalType;
        this.setEventCalType(initCalType);
        this.setEventType('event');

        this._markEventColor('bg-blue-600');

        // Populate project select
        const projSelect = document.getElementById('cev-project');
        if (projSelect) {
            let html = '<option value="">— ไม่เชื่อมโยง —</option>';
            mockProjects.forEach(p => {
                if (p.status !== 'deleted') {
                    html += `<option value="${p.id}" data-no-i18n>${p.name}</option>`;
                }
            });
            projSelect.innerHTML = html;
        }

        if (eventId) {
            if (titleEl) titleEl.innerText = 'แก้ไขกิจกรรม';
            if (deleteBtn) deleteBtn.classList.remove('hidden');

            const ev = mockEvents.find(e => e.id === eventId);
            if (ev) {
                document.getElementById('cev-title').value = ev.title;
                document.getElementById('cev-date').value = ev.date;
                if (ev.time) document.getElementById('cev-time').value = ev.time;
                if (ev.endDate && document.getElementById('cev-end-date')) document.getElementById('cev-end-date').value = ev.endDate;
                if (ev.note) document.getElementById('cev-note').innerHTML = ev.note;
                
                this.state.cevFiles = [...(ev.files || [])];
                this.renderCevFiles();
                if (ev.projectId && projSelect) projSelect.value = ev.projectId;
                if (ev.createdInTab && document.getElementById('cev-cal-type')) {
                    document.getElementById('cev-cal-type').value = ev.createdInTab;
                    this.setEventCalType(ev.createdInTab);
                }
                this._markEventColor(ev.color || 'bg-blue-600');
                this.setEventType(ev.type || 'event');
            }
        } else {
            if (titleEl) titleEl.innerText = 'สร้างกิจกรรมใหม่';
            if (deleteBtn) deleteBtn.classList.add('hidden');
        }

        modal.classList.remove('hidden');
    },

    closeCreateEventModal() {
        const modal = document.getElementById('create-event-modal');
        if (modal) modal.classList.add('hidden');
        this.state.editingEventId = null;
        this.state.cevFiles = [];
    },

    handleCevFileUpload(event) {
        const files = Array.from(event.target.files);
        if (!files.length) return;
        
        if (!this.state.cevFiles) this.state.cevFiles = [];
        
        files.forEach(file => {
            const isImage = file.type.startsWith('image/');
            const reader = new FileReader();
            reader.onload = (e) => {
                this.state.cevFiles.push({
                    name: file.name,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    type: isImage ? 'image' : 'file',
                    url: e.target.result
                });
                this.renderCevFiles();
            };
            reader.readAsDataURL(file);
        });
        
        event.target.value = ''; // Reset
    },

    renderCevFiles() {
        const list = document.getElementById('cev-files-list');
        const count = document.getElementById('cev-file-count');
        if (!list || !count) return;

        if (!this.state.cevFiles || this.state.cevFiles.length === 0) {
            list.innerHTML = '';
            count.textContent = 'ยังไม่มีไฟล์แนบ';
            return;
        }

        count.textContent = `แนบแล้ว ${this.state.cevFiles.length} ไฟล์`;
        
        let html = '';
        this.state.cevFiles.forEach((file, index) => {
            const icon = file.type === 'image' ? '<i class="fa-regular fa-image text-blue-500"></i>' : '<i class="fa-solid fa-file-lines text-gray-500"></i>';
            const fileUrl = file.url || '#';
            html += `
                <div class="flex items-center justify-between p-2 bg-gray-50 border border-gray-100 rounded-lg group">
                    <a href="${fileUrl}" download="${file.name}" data-no-i18n target="_blank" class="flex items-center gap-3 overflow-hidden flex-1 hover:opacity-80 transition-opacity cursor-pointer" title="คลิกเพื่อดาวน์โหลด/เปิดไฟล์">
                        <div class="w-8 h-8 rounded bg-white flex items-center justify-center shrink-0 border border-gray-200 shadow-sm">
                            ${icon}
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-sm font-medium text-blue-600 hover:underline truncate" data-no-i18n>${file.name}</span>
                            <span class="text-[10px] text-gray-400">${file.size}</span>
                        </div>
                    </a>
                    <div class="flex items-center gap-1 shrink-0 ml-2">
                        <a href="${fileUrl}" download="${file.name}" data-no-i18n target="_blank" class="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="ดาวน์โหลด">
                            <i class="fa-solid fa-download"></i>
                        </a>
                        <button type="button" onclick="App.removeCevFile(${index})" class="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors cev-delete-file-btn" title="ลบไฟล์">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;

        // Apply read-only mode for files if the user is a worker viewing an existing event
        const isWorker = this.state.currentUser && this.state.currentUser.role === 'worker';
        const isEditing = !!this.state.editingEventId;
        const uploadBtn = document.getElementById('cev-file-upload');
        const fileChooseBtn = uploadBtn ? uploadBtn.nextElementSibling : null;

        if (isWorker && isEditing) {
            // Hide delete buttons and upload button for subordinates
            document.querySelectorAll('.cev-delete-file-btn').forEach(btn => btn.style.display = 'none');
            if (fileChooseBtn) fileChooseBtn.style.display = 'none';
        } else {
            // Show for managers or when creating new events
            document.querySelectorAll('.cev-delete-file-btn').forEach(btn => btn.style.display = '');
            if (fileChooseBtn) fileChooseBtn.style.display = '';
        }
    },

    removeCevFile(index) {
        if (!this.state.cevFiles) return;
        this.state.cevFiles.splice(index, 1);
        this.renderCevFiles();
    },

    selectEventColor(btn) {
        this._markEventColor(btn.getAttribute('data-color'));
    },

    /* highlight an event color; colors from the older palette map to the nearest one in the project palette */
    _markEventColor(color) {
        const known = c => !!document.querySelector(`.cev-color-btn[data-color="${c}"]`);
        const value = known(color) ? color : (known(this._oldProjectColors[color]) ? this._oldProjectColors[color] : 'bg-blue-600');
        const colorInput = document.getElementById('cev-color');
        if (colorInput) colorInput.value = value;
        document.querySelectorAll('.cev-color-btn').forEach(b => {
            b.classList.toggle('ring-2', b.getAttribute('data-color') === value);
            b.classList.remove('ring-offset-2', 'ring-gray-400', 'scale-110');
        });
    },

    setEventCalType(type) {
        const input = document.getElementById('cev-cal-type');
        if (input) input.value = type;

        document.querySelectorAll('.cev-ctype-btn').forEach(btn => {
            if (btn.dataset.ctype === type) {
                btn.className = "cev-ctype-btn flex-1 py-2 rounded-xl text-xs font-semibold border-2 border-blue-600 bg-blue-600 text-white transition-all";
            } else {
                btn.className = "cev-ctype-btn flex-1 py-2 rounded-xl text-xs font-semibold border-2 border-gray-200 text-gray-600 hover:border-blue-300 transition-all";
            }
        });
    },

    setEventType(type) {
        this.state.cevType = type;
        document.querySelectorAll('.cev-type-btn').forEach(btn => {
            if (btn.dataset.etype === type) {
                // Set active style based on type
                if (type === 'event') {
                    btn.className = "cev-type-btn flex-1 py-2 rounded-xl text-xs font-semibold border-2 border-blue-600 bg-blue-600 text-white transition-all";
                } else if (type === 'meeting') {
                    btn.className = "cev-type-btn flex-1 py-2 rounded-xl text-xs font-semibold border-2 border-fuchsia-600 bg-fuchsia-600 text-white transition-all";
                } else if (type === 'deadline') {
                    btn.className = "cev-type-btn flex-1 py-2 rounded-xl text-xs font-semibold border-2 border-rose-600 bg-rose-600 text-white transition-all";
                }
            } else {
                btn.className = "cev-type-btn flex-1 py-2 rounded-xl text-xs font-semibold border-2 border-gray-200 text-gray-600 hover:border-blue-300 transition-all";
            }
        });
    },

    async submitCreateEvent() {
        const title = document.getElementById('cev-title').value.trim();
        const date = document.getElementById('cev-date').value;
        const time = document.getElementById('cev-time').value;
        const projId = document.getElementById('cev-project').value;
        const note = document.getElementById('cev-note').innerHTML;
        const calType = document.getElementById('cev-cal-type') ? document.getElementById('cev-cal-type').value : (this.state.calTab || 'all');
        const color = document.getElementById('cev-color') ? document.getElementById('cev-color').value : 'bg-blue-500';

        if (!title || !date) {
            this._showToast("กรุณากรอกชื่อกิจกรรมและวันที่ให้ครบถ้วน", "error");
            return;
        }
        /* optional end date: blank or the same day means a one-day event */
        let endDate = document.getElementById('cev-end-date') ? document.getElementById('cev-end-date').value : '';
        if (endDate && endDate < date) {
            this._showToast('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น', 'error');
            return;
        }
        if (endDate === date) endDate = '';

        const isUpdate = !!this.state.editingEventId;
        const isSupabaseId = isUpdate && !this.state.editingEventId.startsWith('ev-');
        
        let savedDbEvent = null;
        
        const compId = this.state.workspaces && this.state.workspaces.length > 0 ? this.state.workspaces[0].workspace_id : 'W-1';
        
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && compId) {
            try {
                let startTime = date;
                let endTime = date;
                if (time) {
                    const dt = new Date(`${date}T${time}`);
                    if (!isNaN(dt.getTime())) {
                        startTime = dt.toISOString();
                        endTime = new Date(dt.getTime() + 60*60*1000).toISOString();
                    }
                } else {
                     const dt = new Date(date);
                     startTime = dt.toISOString();
                     endTime = dt.toISOString();
                }
                if (endDate) endTime = new Date(endDate).toISOString();
                
                const dbEvent = {
                    company_id: compId,
                    organizer_id: this.state.currentUser.id,
                    title: title,
                    description: note,
                    event_type: this.state.cevType || 'event',
                    color: color,
                    start_time: startTime,
                    end_time: endTime,
                    project_id: projId || null,
                    attendee_ids: [this.state.currentUser.id]
                };
                
                if (isSupabaseId) {
                     savedDbEvent = await window.conworkSupabase.updateCalendarEvent(this.state.editingEventId, dbEvent);
                } else if (!isUpdate) {
                     savedDbEvent = await window.conworkSupabase.createCalendarEvent(dbEvent);
                }
            } catch(e) {
                console.error("Failed to sync event to Supabase:", e);
                this._showToast("เกิดข้อผิดพลาดในการบันทึกลงฐานข้อมูล", "error");
            }
        }

        if (isUpdate) {
            const ev = mockEvents.find(e => e.id === this.state.editingEventId);
            if (ev) {
                ev.title = title;
                ev.date = date;
                ev.endDate = endDate;
                ev.time = time;
                ev.projectId = projId;
                ev.note = note;
                ev.type = this.state.cevType || 'event';
                ev.createdInTab = calType;
                ev.color = color;
                ev.files = [...(this.state.cevFiles || [])];
            }
            this._showToast("แก้ไขกิจกรรมเรียบร้อยแล้ว", "success");
        } else {
            const newEv = {
                id: (savedDbEvent && savedDbEvent.id) ? savedDbEvent.id : 'ev-' + Date.now(),
                title: title,
                date: date,
                endDate: endDate,
                time: time,
                projectId: projId,
                note: note,
                type: this.state.cevType || 'event',
                userIds: [this.state.currentUser.id],
                createdInTab: calType,
                color: color,
                files: [...(this.state.cevFiles || [])]
            };
            mockEvents.push(newEv);
            this._showToast("สร้างกิจกรรมเรียบร้อยแล้ว", "success");
        }

        this._saveData();
        if (this.state.currentView === 'calendar') {
            this.renderCalendar();
        }
        this.closeCreateEventModal();
    },

    deleteCalEvent() {
        if (!this.state.editingEventId) return;
        const ev = mockEvents.find(e => e.id === this.state.editingEventId);
        if (!ev) return;

        const nameEl = document.getElementById('delete-event-name');
        if (nameEl) nameEl.textContent = `"${ev.title}"`;

        const modal = document.getElementById('confirm-delete-event-modal');
        if (modal) modal.classList.remove('hidden');
    },

    cancelDeleteEvent() {
        const modal = document.getElementById('confirm-delete-event-modal');
        if (modal) modal.classList.add('hidden');
    },

    async confirmDeleteEvent() {
        if (!this.state.editingEventId) return;

        const isSupabaseId = !this.state.editingEventId.startsWith('ev-');
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && isSupabaseId) {
             try {
                  await window.conworkSupabase.deleteCalendarEvent(this.state.editingEventId);
             } catch(e) {
                  console.error("Failed to delete event from Supabase:", e);
                  this._showToast("เกิดข้อผิดพลาดในการลบออกจากฐานข้อมูล", "error");
                  this.cancelDeleteEvent();
                  return;
             }
        }

        const idx = mockEvents.findIndex(e => e.id === this.state.editingEventId);
        if (idx > -1) {
            mockEvents.splice(idx, 1);
            this._saveData();
            this._showToast("ลบกิจกรรมเรียบร้อยแล้ว", "success");
            if (this.state.currentView === 'calendar') {
                this.renderCalendar();
            }
            this.closeCreateEventModal();
        }
        this.cancelDeleteEvent();
    },

    createTask() {
        if (this.state.currentProject && this._projectIsClosed(this.state.currentProject)) return;
        if (!this.state.currentProject) {
            this._showToast("กรุณาเลือกโปรเจกต์ก่อนสร้าง Task", "error");
            return;
        }
        this.state.editingTaskId = null;
        this._openCreateTaskModal();
    },

    _openCreateTaskModal() {
        const titleEl = document.getElementById('ct-modal-title');
        if (titleEl) titleEl.innerText = 'สร้าง Task ใหม่';

        const deleteBtn = document.getElementById('ct-delete-btn');
        if (deleteBtn) deleteBtn.classList.add('hidden');

        const submitBtn = document.getElementById('ct-submit-btn');
        if (submitBtn) {
            submitBtn.innerText = "สร้างและเผยแพร่";
            submitBtn.classList.remove('hidden');
        }

        const draftBtn = document.getElementById('ct-draft-btn');
        if (draftBtn) draftBtn.classList.remove('hidden');

        const draftTime = document.getElementById('ct-draft-time');
        if (draftTime) {
            draftTime.innerText = '';
            draftTime.classList.add('hidden');
        }

        this._initCreateTaskModal();
        document.getElementById('create-task-modal').classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('ct-title')?.focus();
            document.addEventListener('click', this._outsideClickHandler);
            const ctDesc = document.getElementById('ct-desc');
            if (ctDesc) this._updateFormatToolbar('ct-format-toolbar', ctDesc, 'ct-desc');
        }, 50);
    },

    closeTaskDetailViewModal() {
        this.state.viewingTaskId = null;
        document.getElementById('task-detail-view-modal').classList.add('hidden');
    },

    /* a task's budget is asked only when its project uses a budget */
    _toggleTaskBudgetField(projectId) {
        const proj = mockProjects.find(p => String(p.id) === String(projectId));
        document.getElementById('ct-budget-field')?.classList.toggle('hidden', !(proj && proj.budgetEnabled));
    },

    /* ===== Time spent on tasks =====
       Each entry: { id, taskId, projectId, userId, startedAt, endedAt, minutes, note }.
       Saved in the time_logs table; until that table exists, inside the task's details (task.timeLogs). */
    _fmtMinutes(min) {
        const m = Math.max(0, Math.round(min || 0));
        const h = Math.floor(m / 60), r = m % 60;
        const en = typeof i18nIsEnglish === 'function' && i18nIsEnglish();
        if (en) return h ? `${h}h ${String(r).padStart(2, '0')}m` : `${r}m`;
        return h ? `${h} ชม. ${r} นาที` : `${r} นาที`;
    },
    _taskTimeLogs(task) { return Array.isArray(task && task.timeLogs) ? task.timeLogs : []; },
    _taskMinutesSpent(task) { return this._taskTimeLogs(task).reduce((s, l) => s + (Number(l.minutes) || 0), 0); },
    _runningTimer() {
        try { return JSON.parse(localStorage.getItem('conwork_running_timer') || 'null'); } catch (e) { return null; }
    },

    async toggleTaskTimer(taskId) {
        const task = mockTasks.find(t => String(t.id) === String(taskId));
        if (!task) return;
        const running = this._runningTimer();
        if (running && String(running.taskId) === String(taskId)) {
            const ended = new Date();
            const minutes = Math.max(1, Math.round((ended - new Date(running.startedAt)) / 60000));
            try { localStorage.removeItem('conwork_running_timer'); } catch (e) { }
            await this._saveTimeLog(task, { startedAt: running.startedAt, endedAt: ended.toISOString(), minutes, note: '' });
            App._showToast(`บันทึกเวลา ${this._fmtMinutes(minutes)} แล้ว`, 'success');
        } else {
            if (running) {
                const other = mockTasks.find(t => String(t.id) === String(running.taskId));
                if (!confirm(`กำลังจับเวลางาน "${other ? other.title : ''}" อยู่ หยุดงานนั้นแล้วเริ่มงานนี้แทนหรือไม่?`)) return;
                if (other) await this.toggleTaskTimer(other.id);
            }
            if (task.status === 'done') { App._showToast('งานนี้เสร็จแล้ว', 'error'); return; }
            try { localStorage.setItem('conwork_running_timer', JSON.stringify({ taskId: task.id, startedAt: new Date().toISOString() })); } catch (e) { }
        }
        this._renderTaskTime(task);
    },

    async addManualTime(taskId) {
        const task = mockTasks.find(t => String(t.id) === String(taskId));
        if (!task) return;
        const hoursEl = document.getElementById('tdv-time-manual');
        const noteEl = document.getElementById('tdv-time-note');
        const hours = parseFloat(hoursEl ? hoursEl.value : '');
        if (!(hours > 0) || hours > 24) { App._showToast('ใส่จำนวนชั่วโมง 0.25 – 24', 'error'); return; }
        const minutes = Math.round(hours * 60);
        const ended = new Date();
        await this._saveTimeLog(task, { startedAt: new Date(ended - minutes * 60000).toISOString(), endedAt: ended.toISOString(), minutes, note: noteEl ? noteEl.value.trim() : '' });
        if (hoursEl) hoursEl.value = '';
        if (noteEl) noteEl.value = '';
        App._showToast(`บันทึกเวลา ${this._fmtMinutes(minutes)} แล้ว`, 'success');
        this._renderTaskTime(task);
    },

    async _saveTimeLog(task, entry) {
        const me = this.state.currentUser || {};
        const log = Object.assign({ id: 'tl-' + Date.now(), taskId: task.id, projectId: task.projectId, userId: me.id }, entry);
        let savedToTable = false;
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !String(task.id).startsWith('t')) {
            const { data, error } = await window.conworkSupabase.client.from('time_logs').insert({
                task_id: task.id, project_id: task.projectId || null, user_id: me.id,
                started_at: log.startedAt, ended_at: log.endedAt, minutes: log.minutes, note: log.note || null
            }).select().single();
            if (!error && data) { log.id = data.id; savedToTable = true; }
            else if (error && !/PGRST205|42P01|Could not find the table|does not exist/i.test((error.code || '') + ' ' + (error.message || ''))) console.warn('time_logs:', error.message);
        }
        task.timeLogs = [...this._taskTimeLogs(task), log];
        if (!savedToTable) this._syncTaskDetailsToDB(task); // no time_logs table yet: keep the log with the task
        this._saveData();
    },

    async deleteTimeLog(taskId, logId) {
        const task = mockTasks.find(t => String(t.id) === String(taskId));
        if (!task) return;
        const log = this._taskTimeLogs(task).find(l => String(l.id) === String(logId));
        if (!log || String(log.userId) !== String(this.state.currentUser?.id)) return;
        if (!confirm('ลบรายการเวลานี้?')) return;
        task.timeLogs = this._taskTimeLogs(task).filter(l => l !== log);
        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !String(log.id).startsWith('tl-')) {
            try { await window.conworkSupabase.client.from('time_logs').delete().eq('id', log.id); } catch (e) { }
        } else {
            this._syncTaskDetailsToDB(task);
        }
        this._renderTaskTime(task);
    },

    /* the "time actually spent" box in the task detail view */
    _renderTaskTime(task) {
        const box = document.getElementById('tdv-time-box');
        if (!box || !task) return;
        const spent = this._taskMinutesSpent(task);
        const est = Number(task.estimateMinutes) || 0;
        const totalEl = document.getElementById('tdv-time-total');
        if (totalEl) totalEl.textContent = est ? `${this._fmtMinutes(spent)} / ${this._fmtMinutes(est)}` : this._fmtMinutes(spent);
        const bar = document.getElementById('tdv-time-bar');
        if (bar) {
            bar.classList.toggle('hidden', !est);
            const pct = est ? Math.min(100, Math.round(spent / est * 100)) : 0;
            const fill = bar.firstElementChild;
            if (fill) { fill.style.width = pct + '%'; fill.className = 'h-full ' + (spent > est ? 'bg-red-500' : spent > est * 0.8 ? 'bg-amber-500' : 'bg-blue-600'); }
        }
        const running = this._runningTimer();
        const isMine = running && String(running.taskId) === String(task.id);
        const btn = document.getElementById('tdv-timer-btn');
        if (btn) {
            btn.innerHTML = isMine
                ? `<i class="fa-solid fa-stop"></i> <span>หยุดจับเวลา</span> <span class="tabular-nums" id="tdv-timer-live"></span>`
                : '<i class="fa-solid fa-play"></i> <span>เริ่มจับเวลา</span>';
            btn.className = 'w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2 border transition-colors '
                + (isMine ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100' : 'border-blue-600 text-blue-700 hover:bg-blue-50');
            btn.disabled = task.status === 'done' && !isMine;
        }
        clearInterval(this._timerTick);
        if (isMine) {
            const tick = () => {
                const el = document.getElementById('tdv-timer-live');
                if (!el) { clearInterval(this._timerTick); return; }
                const s = Math.floor((Date.now() - new Date(running.startedAt)) / 1000);
                el.textContent = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
            };
            tick();
            this._timerTick = setInterval(tick, 1000);
        }
        const list = document.getElementById('tdv-time-list');
        if (list) {
            const logs = [...this._taskTimeLogs(task)].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
            const myId = String(this.state.currentUser?.id || '');
            list.innerHTML = logs.length ? logs.map(l => {
                const u = mockUsers.find(x => String(x.id) === String(l.userId)) || (String(l.userId) === myId ? this.state.currentUser : null);
                const when = l.startedAt ? new Date(l.startedAt).toLocaleDateString(typeof i18nIsEnglish === 'function' && i18nIsEnglish() ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short' }) : '';
                const del = String(l.userId) === myId ? `<button type="button" class="text-gray-300 hover:text-red-500 shrink-0" title="ลบ" onclick="App.deleteTimeLog('${this._esc(task.id)}','${this._esc(l.id)}')"><i class="fa-solid fa-xmark"></i></button>` : '';
                return `<div class="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                    <span class="font-semibold text-gray-800 tabular-nums shrink-0">${this._fmtMinutes(l.minutes)}</span>
                    <span class="text-gray-500 shrink-0">${this._esc(when)}</span>
                    <span class="text-gray-600 truncate flex-1" data-no-i18n>${this._esc((u && u.name) || '')}${l.note ? ' · ' + this._esc(l.note) : ''}</span>
                    ${del}
                </div>`;
            }).join('') : '<p class="text-xs text-gray-400">ยังไม่มีการบันทึกเวลา</p>';
        }
    },

    /* load time entries from the time_logs table (if it exists) into the tasks */
    async _loadTimeLogs(taskIds) {
        if (!taskIds.length || !window.conworkSupabase || !window.conworkSupabase.isAvailable()) return;
        try {
            const { data, error } = await window.conworkSupabase.client.from('time_logs').select('*').in('task_id', taskIds);
            if (error || !Array.isArray(data)) return; // table not there yet: entries stay in task details
            const byTask = {};
            data.forEach(r => { (byTask[r.task_id] = byTask[r.task_id] || []).push({ id: r.id, taskId: r.task_id, projectId: r.project_id, userId: r.user_id, startedAt: r.started_at, endedAt: r.ended_at, minutes: r.minutes || 0, note: r.note || '' }); });
            mockTasks.forEach(t => {
                const fromTable = byTask[t.id] || [];
                const local = this._taskTimeLogs(t).filter(l => String(l.id).startsWith('tl-')); // made before the table existed
                t.timeLogs = [...fromTable, ...local];
            });
        } catch (e) { }
    },

    openTaskDetailView(taskId, subtaskIdx = null) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task) return;

        this.state.viewingTaskId = taskId;
        setTimeout(() => this._renderTaskTime(task), 0);
        
        if (subtaskIdx === null && task.subtasks && task.subtasks.length > 0) {
            subtaskIdx = 0;
        }
        this.state.viewingSubtaskIdx = subtaskIdx;
        
        const currentData = (subtaskIdx !== null && task.subtasks && task.subtasks[subtaskIdx]) ? task.subtasks[subtaskIdx] : task;
        
        /* the person who created the task; when unknown say so instead of showing someone else */
        const creator = mockUsers.find(u => String(u.id) === String(task.creatorId)) || { name: 'ไม่ระบุ' };
        if (document.getElementById('tdv-creator-avatar')) {
            document.getElementById('tdv-creator-avatar').src = creator.avatar || this._initialsAvatar(creator.name);
            document.getElementById('tdv-creator-name').textContent = `สั่งโดย: ${creator.name} ${creator.role ? '('+creator.role+')' : ''}`;
        }
        
        const createDate = new Date(task.createdAt || Date.now());
        if (document.getElementById('tdv-created-date')) {
            document.getElementById('tdv-created-date').textContent = `สั่งเมื่อ: ${createDate.toLocaleDateString('th-TH')} ${createDate.toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}`;
        }
        
        const statusBadge = document.getElementById('tdv-status-badge');
        if (statusBadge) {
            if (task.status === 'done') {
                statusBadge.innerHTML = `<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">สถานะ: เสร็จสิ้น (Done)</span>`;
            } else if (task.status === 'pending-review') {
                statusBadge.innerHTML = `<span class="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold">สถานะ: รอตรวจงาน</span>`;
            } else if (task.status === 'in-progress') {
                statusBadge.innerHTML = `<span class="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">สถานะ: กำลังดำเนินการ</span>`;
            } else {
                statusBadge.innerHTML = `<span class="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold">สถานะ: ${task.status}</span>`;
            }
        }

        if (document.getElementById('tdv-project-name')) {
            document.getElementById('tdv-project-name').textContent = task.title || 'ไม่มีชื่องาน';
        }
        
        if (document.getElementById('tdv-title')) document.getElementById('tdv-title').value = currentData.text || currentData.title || '';
        if (document.getElementById('tdv-desc')) document.getElementById('tdv-desc').innerHTML = currentData.description || '';

        const fileList = document.getElementById('tdv-file-list');
        if (fileList) {
            if (currentData.files && currentData.files.length > 0) {
                fileList.innerHTML = currentData.files.map(f => `
                    <div class="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                        <div class="flex items-center gap-3 overflow-hidden">
                            <div class="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-file-lines text-gray-400 text-lg group-hover:text-blue-500 transition-colors"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors" data-no-i18n>${f.name}</div>
                                <div class="text-[10px] text-gray-400 font-medium">${f.size ? (f.size / 1024).toFixed(1) + ' KB' : 'Unknown Size'}</div>
                            </div>
                        </div>
                        <button class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors shrink-0" title="ดาวน์โหลด">
                            <i class="fa-solid fa-download"></i>
                        </button>
                    </div>
                `).join('');
            } else {
                fileList.innerHTML = `<div class="text-sm text-gray-400 italic">ไม่มีไฟล์แนบ</div>`;
            }
        }

        const dueDateEl = document.getElementById('tdv-due-date');
        const dueTimeEl = document.getElementById('tdv-due-time');
        const dueStatusEl = document.getElementById('tdv-due-status');
        if (dueDateEl) {
            if (task.dueDate) {
                const dateObj = new Date(task.dueDate);
                dueDateEl.textContent = dateObj.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
                dueTimeEl.textContent = task.dueTime ? `เวลา ${task.dueTime}` : '';
                if (dueStatusEl) dueStatusEl.innerHTML = '';
            } else {
                dueDateEl.textContent = 'ไม่ระบุ';
                dueTimeEl.textContent = '';
                if (dueStatusEl) dueStatusEl.innerHTML = '';
            }
        }

        const priorityEl = document.getElementById('tdv-priority');
        if (priorityEl) {
            if (task.priority === 'high') {
                priorityEl.innerHTML = `<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 text-red-600 border border-red-100 text-xs font-bold"><div class="w-2 h-2 rounded-full bg-red-500"></div>ความสำคัญ: สูง</div>`;
            } else if (task.priority === 'medium') {
                priorityEl.innerHTML = `<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-50 text-yellow-600 border border-yellow-100 text-xs font-bold"><div class="w-2 h-2 rounded-full bg-yellow-500"></div>ความสำคัญ: ปานกลาง</div>`;
            } else {
                priorityEl.innerHTML = `<div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 text-green-600 border border-green-100 text-xs font-bold"><div class="w-2 h-2 rounded-full bg-green-500"></div>ความสำคัญ: ต่ำ</div>`;
            }
        }

        const assigneesEl = document.getElementById('tdv-assignees');
        if (assigneesEl) {
            if (task.assignees && task.assignees.length > 0) {
                assigneesEl.innerHTML = task.assignees.map(uid => {
                    const u = mockUsers.find(mu => mu.id === uid);
                    if (!u) return '';
                    return `
                        <div class="flex items-center gap-2">
                            <img src="${u.avatar}" class="w-6 h-6 rounded-full border border-gray-200 object-cover">
                            <span class="text-xs text-gray-700 font-medium" data-no-i18n>${u.name} ${u.role ? `(${u.role})` : ''}</span>
                        </div>
                    `;
                }).join('');
            } else {
                assigneesEl.innerHTML = `<div class="text-xs text-gray-400 italic">ไม่มีผู้รับผิดชอบ</div>`;
            }
        }

        const subtasksEl = document.getElementById('tdv-subtasks');
        if (subtasksEl) {
            if (task.subtasks && task.subtasks.length > 0) {
                subtasksEl.innerHTML = task.subtasks.map((st, idx) => `
                    <div class="flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${this.state.viewingSubtaskIdx === idx ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'hover:bg-gray-50 border border-transparent'}" onclick="App.openTaskDetailView('${task.id}', ${idx})">
                        <input type="checkbox" ${st.done ? 'checked' : ''} onchange="event.stopPropagation(); App.toggleCardSubtask('${task.id}', ${idx}); setTimeout(() => App.openTaskDetailView('${task.id}', ${idx}), 50)" class="mt-0.5 rounded text-blue-600 border-gray-300 focus:ring-blue-500 w-4 h-4 shrink-0">
                        <span class="text-xs ${st.done ? 'text-gray-400 line-through' : 'text-gray-700 font-medium'}" data-no-i18n>${idx+1}. ${st.text}</span>
                    </div>
                `).join('');
            } else {
                subtasksEl.innerHTML = `<div class="text-xs text-gray-400 italic">ไม่มีงานย่อย</div>`;
            }
        }

        const curUserId = this.state.currentUser ? String(this.state.currentUser.id) : null;
        const assignees = Array.from(new Set([...(task.assignees || []), ...(task.relatedUsers || [])]));
        const isUserAssigned = curUserId && assignees.some(id => String(id) === curUserId);
        const isCreator = curUserId && (String(task.creatorId) === curUserId || String(task.creator) === curUserId);
        const isSupervisor = this.state.currentUser && this._canUserReviewTask(task, this.state.currentUser.id, this.state.currentUser.role);
        const canEditSubtask = isUserAssigned || isCreator || isSupervisor;
        
        const myActionsBox = document.getElementById('tdv-my-actions-box');
        const titleEl = document.getElementById('tdv-title');
        const descEl = document.getElementById('tdv-desc');
        const uploadSec = document.getElementById('tdv-upload-section');

        if (canEditSubtask) {
            if (myActionsBox) myActionsBox.classList.remove('hidden');
            if (titleEl) { titleEl.disabled = false; titleEl.classList.remove('bg-gray-50', 'pointer-events-none'); }
            if (descEl) { descEl.setAttribute('contenteditable', 'true'); descEl.classList.remove('bg-gray-50', 'pointer-events-none'); }
            if (uploadSec) uploadSec.classList.remove('hidden');
        } else {
            if (myActionsBox) myActionsBox.classList.add('hidden');
            if (titleEl) { titleEl.disabled = true; titleEl.classList.add('bg-gray-50', 'pointer-events-none'); }
            if (descEl) { descEl.setAttribute('contenteditable', 'false'); descEl.classList.add('bg-gray-50', 'pointer-events-none'); }
            if (uploadSec) uploadSec.classList.add('hidden');
        }

        const submitBtn = document.getElementById('tdv-submit-work-btn');
        const rejectBtn = document.getElementById('tdv-reject-work-btn');
        const approveBtn = document.getElementById('tdv-approve-work-btn');
        const deleteBtn = document.getElementById('tdv-delete-btn');

        if (submitBtn) submitBtn.classList.add('hidden');
        if (rejectBtn) rejectBtn.classList.add('hidden');
        if (approveBtn) approveBtn.classList.add('hidden');
        if (deleteBtn) deleteBtn.classList.add('hidden');

        const isPendingState = task.status === 'todo' || task.status === 'in-progress' || task.status === 'pending';
        const isPendingReviewState = task.status === 'pending-review';

        const subtasks = task.subtasks || [];
        const doneCnt = subtasks.filter(st => st.done).length;
        const allDone = (subtasks.length === 0 || doneCnt === subtasks.length);

        if (isPendingState && !(task.isRejected && !this.state.revealedTasks?.[task.id])) {
            if (submitBtn) {
                submitBtn.classList.remove('hidden');
                if (allDone) {
                    submitBtn.className = "px-8 py-2.5 text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2";
                    submitBtn.onclick = () => App.saveAndSubmitTask(task.id);
                } else {
                    submitBtn.className = "px-8 py-2.5 text-sm font-bold bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed opacity-80 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2";
                    submitBtn.onclick = () => App._showToast('กรุณาทำเครื่องหมายถูกในคำสั่งย่อยให้ครบทุกข้อก่อนส่งงาน', 'error');
                }
            }
        }

        if (isSupervisor && isPendingReviewState && this.state.revealedTasks?.[task.id]) {
            if (rejectBtn) rejectBtn.classList.remove('hidden');
            if (approveBtn) approveBtn.classList.remove('hidden');
        }
        
        if (isSupervisor && deleteBtn) {
            deleteBtn.classList.remove('hidden');
        }

        document.getElementById('task-detail-view-modal').classList.remove('hidden');
    },

    handleTdvFileUpload(e) {
        if (!e.target.files || e.target.files.length === 0) return;
        const task = mockTasks.find(t => t.id === this.state.viewingTaskId);
        if (!task) return;
        
        const currentData = (this.state.viewingSubtaskIdx !== null && task.subtasks && task.subtasks[this.state.viewingSubtaskIdx]) 
            ? task.subtasks[this.state.viewingSubtaskIdx] 
            : task;

        if (!currentData.files) currentData.files = [];
        
        for (let file of e.target.files) {
            currentData.files.push({
                name: file.name,
                size: (file.size / 1024).toFixed(1) + ' KB',
                type: file.type.includes('image') ? 'image' : 'document',
                url: URL.createObjectURL(file) // Temporary URL
            });
        }
        
        // Re-render the file list in TDV
        const fileList = document.getElementById('tdv-file-list');
        if (fileList) {
            fileList.innerHTML = currentData.files.map(f => `
                <div class="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all group">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                            <i class="fa-solid ${f.type === 'image' ? 'fa-image text-blue-500' : 'fa-file-lines text-gray-400'} text-lg group-hover:text-blue-500 transition-colors"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-sm font-semibold text-gray-800 truncate group-hover:text-blue-600 transition-colors" data-no-i18n>${f.name}</div>
                            <div class="text-[10px] text-gray-400 font-medium">${f.size}</div>
                        </div>
                    </div>
                    <a href="${f.url}" download="${f.name}" data-no-i18n target="_blank" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors shrink-0" title="ดาวน์โหลด">
                        <i class="fa-solid fa-download"></i>
                    </a>
                </div>
            `).join('');
        }
    },

    async saveTdvChanges(closeModal = true) {
        if (!this.state.viewingTaskId) return;
        const task = mockTasks.find(t => t.id === this.state.viewingTaskId);
        if (!task) return;

        const currentData = (this.state.viewingSubtaskIdx !== null && task.subtasks && task.subtasks[this.state.viewingSubtaskIdx]) 
            ? task.subtasks[this.state.viewingSubtaskIdx] 
            : task;

        const titleEl = document.getElementById('tdv-title');
        const descEl = document.getElementById('tdv-desc');

        if (titleEl) {
            if (currentData.text !== undefined) currentData.text = titleEl.value.trim() || currentData.text;
            else currentData.title = titleEl.value.trim() || currentData.title;
        }
        if (descEl) {
            const newDesc = descEl.innerHTML.trim();
            if (newDesc !== '' && newDesc !== '<br>') {
                currentData.description = newDesc;
            }
        }

        try {
            if (window.ApiService) {
                // Determine if we need to update just the subtasks or the whole task
                if (currentData.text !== undefined) {
                    await ApiService.updateTask(task.id, { subtasks: task.subtasks });
                } else {
                    await ApiService.updateTask(task.id, {
                        title: task.title,
                        description: task.description
                    });
                }
            }
            this._showToast('บันทึกการเปลี่ยนแปลงเสร็จสิ้น', 'success');
        } catch (e) {
            console.error("Failed to save TDV changes to DB", e);
            this._showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        }

        this.renderTasks();
        if (closeModal) this.closeTaskDetailViewModal();
    },

    async saveAndSubmitTask(taskId) {
        await this.saveTdvChanges(false);
        this.submitTask(taskId);
    },

    editTask(taskId) {
        const task = mockTasks.find(t => t.id === taskId);
        if (!task) return;

        this.state.creatingTaskSectionId = task.sectionId || null;
        this.state.editingTaskId = taskId; // Edit mode

        // Change texts and buttons
        const titleEl = document.getElementById('ct-modal-title');
        if (titleEl) titleEl.innerText = "แก้ไข Task";

        const deleteBtn = document.getElementById('ct-delete-btn');
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        const submitBtn = document.getElementById('ct-submit-btn');
        if (submitBtn) submitBtn.innerText = "บันทึกการแก้ไข";

        const draftTime = document.getElementById('ct-draft-time');
        if (draftTime) {
            draftTime.innerText = '';
            draftTime.classList.add('hidden');
        }

        this._initCreateTaskModal(); // Setup defaults

        // Override with task data
        document.getElementById('ct-title').value = task.title;
        if (task.dueDate && document.getElementById('ct-due-date')) document.getElementById('ct-due-date').value = task.dueDate;
        if (task.dueTime && document.getElementById('ct-due-time')) document.getElementById('ct-due-time').value = task.dueTime;
        if (task.description && document.getElementById('ct-desc')) document.getElementById('ct-desc').innerHTML = task.description;
        const tagInput = document.getElementById('ct-tag');
        if (tagInput && task.tag) tagInput.value = task.tag;
        if (task.priority) {
            document.getElementById('ct-priority').value = task.priority;
            const dot = document.getElementById('ct-priority-dot');
            if (dot) {
                dot.className = 'absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none ' +
                    (task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-500');
            }
        }
        if (task.visibility) document.getElementById('ct-visibility').value = task.visibility;
        const repeatEl = document.getElementById('ct-repeat');
        if (repeatEl) repeatEl.checked = !!task.repeat;
        if (task.notifications) {
            const n = task.notifications;
            const na = document.getElementById('ct-notif-assignee');
            const nd = document.getElementById('ct-notif-due');
            const nc = document.getElementById('ct-notif-chat');
            if (na) na.checked = n.assignee !== false;
            if (nd) nd.checked = n.due !== false;
            if (nc) nc.checked = n.chat !== false;
            const ndays = document.getElementById('ct-notif-days');
            if (ndays && n.daysBefore) ndays.value = String(n.daysBefore);
        }

        // Load files
        this.state.ctFiles = [...(task.files || [])];
        if (typeof this.renderTaskFiles === 'function') this.renderTaskFiles();

        // Load reviewers
        if (task.reviewers) {
            this.state.ctReviewers = JSON.parse(JSON.stringify(task.reviewers));
        } else {
            this.state.ctReviewers = [];
        }
        if (typeof this.renderTaskReviewers === 'function') this.renderTaskReviewers();

        // Apply read-only mode for workers or if task is done
        const isSupervisor = this.state.currentUser && (this.state.currentUser.role === 'reviewer1' || this.state.currentUser.role === 'reviewer2' || this.state.currentUser.role === 'admin');
        const isWorker = !isSupervisor;
        const isDone = task.status === 'done';
        const isReadOnly = isWorker || isDone;

        this.state.currentTaskModalIsReadOnly = isReadOnly;

        // Load subtasks
        this.state.ctSubtasks = JSON.parse(JSON.stringify(task.subtasks || []));
        if (typeof this.renderSubtasks === 'function') this.renderSubtasks();

        // Load related users
        this.state.ctRelatedUsers = [...(task.relatedUsers || [])];
        this.renderRelatedUsers();

        // Load divisions / departments
        this.state.ctDepartments = [...(task.departments || [])];
        this.renderDepartments();

        // Planned time and budget
        const estEl = document.getElementById('ct-estimate-hours');
        if (estEl) estEl.value = task.estimateMinutes ? +(task.estimateMinutes / 60).toFixed(2) : '';
        const budEl = document.getElementById('ct-budget-amount');
        if (budEl) budEl.value = task.budgetAmount != null ? task.budgetAmount : '';
        this._toggleTaskBudgetField(task.projectId);

        // Assignees pre-fill
        this.state.ctAssignees = [...(task.assignees || [])];
        this.renderAssignees();

        const fieldsToDisable = [
            'ct-title', 'ct-due-date', 'ct-due-time',
            'ct-tag', 'ct-priority', 'ct-visibility', 'ct-notif-days', 'ct-subtask-input'
        ];

        fieldsToDisable.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (isReadOnly) {
                    el.setAttribute('disabled', 'true');
                    el.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
                } else {
                    el.removeAttribute('disabled');
                    el.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
                }
            }
        });

        const descEditor = document.getElementById('ct-desc');
        if (descEditor) {
            if (isReadOnly) {
                descEditor.setAttribute('contenteditable', 'false');
                descEditor.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
            } else {
                descEditor.setAttribute('contenteditable', 'true');
                descEditor.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-70');
            }
        }

        // Also disable pointer events for some interactive areas and inputs
        const disableClickAreas = [
            document.querySelector('#ct-desc')?.previousElementSibling, // Rich text toolbar
            document.getElementById('ct-file-upload')?.nextElementSibling, // Upload button
            document.getElementById('ct-assignee-display')?.parentElement, // Assignee dropdown
            document.getElementById('ct-repeat'), // Repeat toggle
            document.getElementById('ct-notif-assignee'),
            document.getElementById('ct-notif-due'),
            document.getElementById('ct-notif-chat'),
            document.getElementById('ct-subtask-input')?.nextElementSibling // Add subtask button
        ];

        disableClickAreas.forEach(el => {
            if (el) {
                if (isReadOnly) {
                    el.style.pointerEvents = 'none';
                    el.style.opacity = '0.5';
                    if (el.tagName === 'INPUT') el.disabled = true;
                } else {
                    el.style.pointerEvents = 'auto';
                    el.style.opacity = '1';
                    if (el.tagName === 'INPUT') el.disabled = false;
                }
            }
        });

        // Hide delete and submit buttons for read-only mode
        const draftBtn = document.getElementById('ct-draft-btn');
        if (isReadOnly) {
            if (deleteBtn) {
                if (isSupervisor) {
                    deleteBtn.classList.remove('hidden');
                } else {
                    deleteBtn.classList.add('hidden');
                }
            }
            if (submitBtn) submitBtn.classList.add('hidden');
            if (draftBtn) draftBtn.classList.add('hidden');
        } else {
            if (deleteBtn) deleteBtn.classList.remove('hidden');
            if (submitBtn) submitBtn.classList.remove('hidden');
            if (draftBtn) draftBtn.classList.remove('hidden');
        }

        const submitWorkBtn = document.getElementById('ct-submit-work-btn');
        const rejectWorkBtn = document.getElementById('ct-reject-work-btn');
        const approveWorkBtn = document.getElementById('ct-approve-work-btn');

        if (submitWorkBtn) submitWorkBtn.classList.add('hidden');
        if (rejectWorkBtn) rejectWorkBtn.classList.add('hidden');
        if (approveWorkBtn) approveWorkBtn.classList.add('hidden');

        const isPendingState = task.status === 'todo' || task.status === 'in-progress' || task.status === 'pending';
        const isPendingReviewState = task.status === 'pending-review';
        
        let isUserAssignedState = false;
        if (task.assignees && task.assignees.length > 0 && this.state.currentUser) {
            isUserAssignedState = task.assignees.includes(this.state.currentUser.id);
        }

        if (isPendingState && isUserAssignedState && !(task.isRejected && !this.state.revealedTasks?.[task.id])) {
            if (submitWorkBtn) submitWorkBtn.classList.remove('hidden');
        }

        if (isSupervisor && isPendingReviewState && this.state.revealedTasks?.[task.id]) {
            if (rejectWorkBtn) rejectWorkBtn.classList.remove('hidden');
            if (approveWorkBtn) approveWorkBtn.classList.remove('hidden');
        }

        document.getElementById('create-task-modal').classList.remove('hidden');
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler);
            const ctDesc = document.getElementById('ct-desc');
            if (ctDesc) this._updateFormatToolbar('ct-format-toolbar', ctDesc, 'ct-desc');
        }, 50);
    },

    deleteTask() {
        const taskId = this.state.editingTaskId;
        this.deleteTaskDirect(taskId);
    },

    deleteTaskDirect(taskId) {
        if (!taskId) return;
        const task = mockTasks.find(t => t.id === taskId);
        if (task) {
            this.state.taskToDelete = taskId;
            document.getElementById('delete-task-name').textContent = task.title || 'ไม่มีชื่อ';
            document.getElementById('confirm-delete-task-modal').classList.remove('hidden');
        }
    },

    cancelDeleteTask() {
        this.state.taskToDelete = null;
        document.getElementById('confirm-delete-task-modal').classList.add('hidden');
    },

    async confirmDeleteTask() {
        const taskId = this.state.taskToDelete;
        if (!taskId) return;

        const idx = mockTasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            // --- Supabase DB Sync ---
            if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !String(taskId).startsWith('mock_')) {
                try {
                    // Delete task from DB
                    const { data: deleteData, error: delErr } = await window.conworkSupabase.client.from('tasks').delete().eq('id', taskId).select();
                    
                    if (delErr) {
                        console.error('Error deleting task from Supabase:', delErr);
                        // หาก error เป็น 22P02 (invalid input syntax for type uuid) แปลว่าเป็น local task ที่ไม่มีในระบบ
                        if (delErr.code !== '22P02') {
                            alert(`ไม่สามารถลบงานได้: ${delErr.message}`);
                            return; // Stop deletion locally if DB fails
                        }
                    } else if (!deleteData || deleteData.length === 0) {
                        console.warn('Task not found in Supabase (or RLS blocked). Deleting locally anyway.');
                        // อนุญาตให้ลบใน Local ได้แม้จะไม่พบใน Database เพื่อล้างข้อมูลที่ค้าง
                    }
                } catch (e) {
                    console.error('Exception soft-deleting task from Supabase', e);
                    alert(`Exception: ${e.message}`);
                    return;
                }
            }
            
            mockTasks[idx].status = 'deleted'; // Update local state instead of splicing

            // Clean up related notifications
            const originalLength = mockNotifications.length;
            for (let i = mockNotifications.length - 1; i >= 0; i--) {
                if (mockNotifications[i].linkData && mockNotifications[i].linkData.taskId === taskId) {
                    mockNotifications.splice(i, 1);
                }
            }
            if (mockNotifications.length !== originalLength) {
                this.renderNotifications();
            }

            // Decrease project task count
            const proj = mockProjects.find(p => p.id === this.state.currentProject);
            if (proj) {
                const remainingTasks = mockTasks.filter(t => t.projectId === this.state.currentProject && t.status !== 'deleted');
                proj.tasksTotal = remainingTasks.length;
                proj.tasksDone = remainingTasks.filter(t => t.status === 'done').length;
                proj.progress = proj.tasksTotal > 0 ? (proj.tasksDone / proj.tasksTotal) * 100 : 0;

                if (remainingTasks.length === 0) {
                    if (proj.status !== 'cancelled' && proj.status !== 'paused' && proj.status !== 'hidden') {
                        proj.status = 'planned';
                    }
                } else if (proj.tasksTotal > 0 && proj.tasksDone === proj.tasksTotal) {
                    proj.status = 'completed';
                }
            }

            this._saveData();
            this.renderTasks();
            this.renderProjects();
            this.closeCreateTaskModal();
            this._showToast("ลบ Task เรียบร้อยแล้ว", "success");
        }
        this.cancelDeleteTask();
    },

    _collectTaskFormData() {
        return {
            description: document.getElementById('ct-desc')?.innerHTML || '',
            tag: document.getElementById('ct-tag')?.value || '',
            priority: document.getElementById('ct-priority')?.value || 'medium',
            visibility: document.getElementById('ct-visibility')?.value || 'all',
            repeat: !!document.getElementById('ct-repeat')?.checked,
            notifications: {
                assignee: !!document.getElementById('ct-notif-assignee')?.checked,
                due: !!document.getElementById('ct-notif-due')?.checked,
                chat: !!document.getElementById('ct-notif-chat')?.checked,
                daysBefore: document.getElementById('ct-notif-days')?.value || '1'
            },
            reviewers: JSON.parse(JSON.stringify(this.state.ctReviewers || [])),
            departments: [...(this.state.ctDepartments || [])],
            estimateMinutes: (() => { const v = parseFloat(document.getElementById('ct-estimate-hours')?.value); return v > 0 ? Math.round(v * 60) : null; })(),
            budgetAmount: (() => { const v = parseFloat(document.getElementById('ct-budget-amount')?.value); return v >= 0 ? v : null; })()
        };
    },

    /* task fields the tasks table has no column of its own for; kept together in tasks.details */
    _taskDetailsForDb(task) {
        return {
            tag: task.tag || '', visibility: task.visibility || 'all', repeat: !!task.repeat,
            notifications: task.notifications || null, reviewers: task.reviewers || [],
            departments: task.departments || [], relatedUsers: task.relatedUsers || [],
            dueTime: task.dueTime || '', isDraft: !!task.isDraft,
            estimateMinutes: task.estimateMinutes != null ? task.estimateMinutes : null,
            budgetAmount: task.budgetAmount != null ? task.budgetAmount : null,
            completedAt: task.completedAt || null,
            timeLogs: task.timeLogs || []
        };
    },

    _initCreateTaskModal() {
        this.state.ctReviewers = [];
        if (typeof this.renderTaskReviewers === 'function') this.renderTaskReviewers();

        const titleLabel = document.getElementById('ct-title-label');
        const titleInput = document.getElementById('ct-title');
        if (titleLabel) {
            titleLabel.innerHTML = 'ชื่องาน <span class="text-red-500">*</span>';
        }
        if (titleInput) {
            titleInput.placeholder = 'ใส่ชื่องาน';
            titleInput.value = '';
            titleInput.classList.remove('border-red-500');
        }

        // Reset inputs
        const ctDesc = document.getElementById('ct-desc');
        if (ctDesc) ctDesc.innerHTML = '';
        const ctTag = document.getElementById('ct-tag');
        if (ctTag) ctTag.value = '';
        const ctVis = document.getElementById('ct-visibility');
        if (ctVis) ctVis.value = 'all';
        const repeatEl = document.getElementById('ct-repeat');
        if (repeatEl) repeatEl.checked = false;
        ['ct-notif-assignee', 'ct-notif-due', 'ct-notif-chat'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = true;
        });
        const notifDays = document.getElementById('ct-notif-days');
        if (notifDays) notifDays.value = '1';
        document.getElementById('ct-priority').value = 'medium';
        const dot = document.getElementById('ct-priority-dot');
        if (dot) dot.className = 'absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none bg-yellow-400';

        // Priority change listener
        const prioSel = document.getElementById('ct-priority');
        if (prioSel && !prioSel.hasAttribute('data-bound')) {
            prioSel.setAttribute('data-bound', 'true');
            prioSel.addEventListener('change', (e) => {
                if (dot) {
                    dot.className = 'absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none ' +
                        (e.target.value === 'high' ? 'bg-red-500' : e.target.value === 'medium' ? 'bg-yellow-400' : 'bg-green-500');
                }
            });
        }

        // Setup dates
        const todayStr = new Date().toISOString().split('T')[0];
        document.getElementById('ct-due-date').value = todayStr;
        document.getElementById('ct-due-time').value = '17:00';

        // Reset Assignees
        this.state.ctAssignees = [];
        this.renderAssignees();
        document.getElementById('ct-assignee-search').value = '';

        // Reset files
        this.state.ctFiles = [];
        if (typeof this.renderTaskFiles === 'function') this.renderTaskFiles();
        const fileInput = document.getElementById('ct-file-upload');
        if (fileInput) fileInput.value = '';

        // Reset subtasks
        this.state.ctSubtasks = [];
        if (typeof this.renderSubtasks === 'function') this.renderSubtasks();
        const stInput = document.getElementById('ct-subtask-input');
        if (stInput) stInput.value = '';

        // Reset reviewers
        this.state.ctReviewers = [];
        if (typeof this.renderTaskReviewers === 'function') this.renderTaskReviewers();
        const rvInput = document.getElementById('ct-reviewer-search');
        if (rvInput) rvInput.value = '';

        // Reset related users
        this.state.ctRelatedUsers = [];
        this.renderRelatedUsers();
        document.getElementById('ct-related-search').value = '';

        // Reset planned time and budget
        const estReset = document.getElementById('ct-estimate-hours');
        if (estReset) estReset.value = '';
        const budReset = document.getElementById('ct-budget-amount');
        if (budReset) budReset.value = '';
        this._toggleTaskBudgetField(this.state.currentProject);

        // Reset divisions / departments
        this.state.ctDepartments = [];
        this.renderDepartments();
        const deptInput = document.getElementById('ct-dept-search');
        if (deptInput) deptInput.value = '';

        // Set current user as default assignee ONLY if not on "assign" tab
        if (this.state.supervisorTaskFilter !== 'assign') {
            const curUser = this.state.currentUser;
            if (curUser && !this.state.ctAssignees.includes(curUser.id)) {
                this.state.ctAssignees.push(curUser.id);
                this.renderAssignees();
            }
        }
    },

    closeCreateTaskModal() {
        document.getElementById('create-task-modal').classList.add('hidden');
        document.removeEventListener('click', this._outsideClickHandler);
        this.state.creatingTaskSectionId = null;
    },

    async submitCreateTask(saveType) {
        const titleInput = document.getElementById('ct-title');
        const title = titleInput.value.trim();
        if (!title) {
            titleInput.classList.add('border-red-500');
            titleInput.focus();
            return;
        }
        titleInput.classList.remove('border-red-500');

        const assignees = [...this.state.ctAssignees];

        const dueDate = document.getElementById('ct-due-date').value;
        const dueTime = document.getElementById('ct-due-time').value;
        const extra = this._collectTaskFormData();

        if (this.state.editingTaskId) {
            // Update existing task
            const task = mockTasks.find(t => t.id === this.state.editingTaskId);
            if (task) {
                const combinedAssignees = Array.from(new Set([...assignees, ...this.state.ctRelatedUsers]));
                Object.assign(task, {
                    title,
                    assignees: combinedAssignees,
                    relatedUsers: [...this.state.ctRelatedUsers],
                    isDraft: saveType === 'draft',
                    dueDate,
                    dueTime,
                    files: [...(this.state.ctFiles || [])],
                    subtasks: JSON.parse(JSON.stringify(this.state.ctSubtasks || [])),
                    ...extra
                });

                // --- Update Supabase Task ---
                if (window.conworkSupabase && window.conworkSupabase.isAvailable() && !String(task.id).startsWith('mock_')) {
                    try {
                        let combinedDateTime = null;
                        if (dueDate) {
                            combinedDateTime = dueDate + (dueTime ? 'T' + dueTime + ':00' : 'T00:00:00');
                        }
                        const { error: upErr } = await this._sbSaveSkippingMissing({
                            title: title,
                            description: extra.description || null,
                            priority: extra.priority || 'medium',
                            due_date: combinedDateTime,
                            subtasks: this.state.ctSubtasks || [],
                            estimate_minutes: extra.estimateMinutes,
                            budget_amount: extra.budgetAmount,
                            details: this._taskDetailsForDb(task)
                        }, d => window.conworkSupabase.client.from('tasks').update(d).eq('id', task.id));
                        if (upErr) alert(`เกิดข้อผิดพลาดในการอัปเดตงาน:\n${upErr.message}`);

                        // Also update assignees for existing tasks
                        if (combinedAssignees.length > 0) {
                            await window.conworkSupabase.client.from('task_assignees').delete().eq('task_id', task.id);
                            const taskAssigneesToInsert = combinedAssignees.map(uid => ({
                                task_id: task.id,
                                user_id: uid
                            }));
                            const { error: taErr } = await window.conworkSupabase.client.from('task_assignees').insert(taskAssigneesToInsert);
                            if (taErr) alert(`เกิดข้อผิดพลาดในการอัปเดตผู้รับผิดชอบงาน:\n${taErr.message}`);
                        }
                    } catch (e) { 
                        console.error('Error updating task on Supabase', e); 
                        alert(`เกิดข้อผิดพลาด:\n${e.message}`);
                    }
                }
            }
            this._showToast(saveType === 'draft' ? `อัปเดตแบบร่าง "${title}" แล้ว` : `บันทึกการแก้ไข "${title}" แล้ว`, 'success');
        } else {
            let targetSectionId = this.state.creatingTaskSectionId;

            if (!targetSectionId) {
                const sections = this._getTaskSectionsForProject(this.state.currentProject);
                targetSectionId = sections[0]?.id;
            }

            let newTaskId = 't' + Date.now();
            const combinedAssignees = Array.from(new Set([...assignees, ...this.state.ctRelatedUsers]));

            // --- Supabase DB Sync ---
            if (window.conworkSupabase && window.conworkSupabase.isAvailable() && this.state.currentUser && !['p1', 'p2', 'p3', 'p4'].includes(String(this.state.currentProject))) {
                try {
                    let combinedDateTime = null;
                    if (dueDate) {
                        combinedDateTime = dueDate + (dueTime ? 'T' + dueTime + ':00' : 'T00:00:00');
                    }
                    const dbTaskData = {
                        project_id: this.state.currentProject,
                        section_id: targetSectionId || null,
                        creator_id: this.state.currentUser.id,
                        title: title,
                        description: extra.description || null,
                        status: 'todo',
                        priority: extra.priority || 'medium',
                        due_date: combinedDateTime,
                        subtasks: this.state.ctSubtasks || [],
                        estimate_minutes: extra.estimateMinutes,
                        budget_amount: extra.budgetAmount,
                        details: this._taskDetailsForDb({ ...extra, relatedUsers: [...this.state.ctRelatedUsers], dueTime, isDraft: saveType === 'draft' })
                    };

                    /* columns this database does not have yet (subtasks, details) are left out instead of failing */
                    const { data: insertedTask, error: insErr } = await this._sbSaveSkippingMissing(dbTaskData,
                        d => window.conworkSupabase.client.from('tasks').insert(d).select().single());

                    if (insErr) {
                        console.error('Error creating task on Supabase', insErr);
                        alert(`เกิดข้อผิดพลาดในการสร้างงานบนฐานข้อมูล:\n${insErr.message}`);
                        return;
                    } else if (insertedTask) {
                        newTaskId = insertedTask.id;
                        
                        // assignees
                        if (combinedAssignees.length > 0) {
                            const taskAssigneesToInsert = combinedAssignees.map(uid => ({
                                task_id: newTaskId,
                                user_id: uid
                            }));
                            const { error: taErr } = await window.conworkSupabase.client.from('task_assignees').insert(taskAssigneesToInsert);
                            if (taErr) {
                                console.error('Error inserting task_assignees', taErr);
                                alert(`เกิดข้อผิดพลาดในการมอบหมายงาน:\n${taErr.message}`);
                            }
                        }
                    }
                } catch(e) { 
                    console.error('Error saving task to Supabase:', e); 
                    alert(`ระบบฐานข้อมูลขัดข้อง:\n${e.message}`);
                    return;
                }
            }
            
            mockTasks.push({
                id: newTaskId,
                projectId: this.state.currentProject,
                title,
                status: 'todo',
                sectionId: targetSectionId,
                isDraft: saveType === 'draft',
                assignees: combinedAssignees,
                relatedUsers: [...this.state.ctRelatedUsers],
                dueDate,
                dueTime,
                creatorId: this.state.currentUser.id,
                files: [...(this.state.ctFiles || [])],
                subtasks: JSON.parse(JSON.stringify(this.state.ctSubtasks || [])),
                ...extra
            });
            this.state.editingTaskId = newTaskId;

            if (saveType !== 'draft') {
                if (combinedAssignees && combinedAssignees.length > 0) {
                    combinedAssignees.forEach(uid => {
                        this.addNotification('task', 'คุณได้รับมอบหมายงานใหม่', `งาน: ${title}`, { view: 'tasks', projectId: this.state.currentProject, taskId: newTaskId, targetUserId: String(uid) });
                    });
                } else {
                    this.addNotification('task', 'งานใหม่ถูกเพิ่ม', `มีงานใหม่ : ${title}`, { view: 'tasks', projectId: this.state.currentProject, taskId: newTaskId });
                }
            }

            const proj = mockProjects.find(p => p.id === this.state.currentProject);
            if (proj) proj.tasksTotal += 1;
            this._showToast(saveType === 'draft' ? `บันทึกร่าง "${title}" แล้ว` : `สร้างและเผยแพร่ "${title}" แล้ว`, 'success');
        }

        const projRef = mockProjects.find(p => p.id === this.state.currentProject);
        if (projRef) {
            // Auto-add all task participants to the project's team to ensure visibility
            const allInvolvedUsers = new Set([
                ...assignees,
                ...this.state.ctRelatedUsers,
                ...(this.state.ctReviewers || []).map(r => r.userId)
            ]);

            allInvolvedUsers.forEach(userId => {
                if (userId && !projRef.team.includes(userId)) {
                    projRef.team.push(userId);
                }
            });
        }

        this._saveData();

        // Auto-switch supervisor filter based on assignee
        if (saveType !== 'draft') {
            const role = this.state.currentUser ? this.state.currentUser.role : '';
            const canManage = role === 'admin' || role === 'reviewer2' || role === 'reviewer1' || role === 'manager' || role === 'supervisor';
            if (canManage) {
                let currentStatus = 'todo';
                if (this.state.editingTaskId) {
                    const existingTask = mockTasks.find(t => t.id === this.state.editingTaskId);
                    if (existingTask) currentStatus = existingTask.status;
                }

                if (currentStatus === 'pending-review') {
                    this.setSupervisorFilter('review');
                } else if (!assignees.includes(this.state.currentUser.id)) {
                    this.setSupervisorFilter('assign');
                } else {
                    this.setSupervisorFilter('my');
                }
            }
        }

        this.renderTasks();
        this.renderProjects();

        if (saveType === 'draft') {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const timeEl = document.getElementById('ct-draft-time');
            if (timeEl) {
                timeEl.innerText = `บันทึกร่างล่าสุดเมื่อ ${timeStr}`;
                timeEl.classList.remove('hidden');
            }
        } else {
            this.closeCreateTaskModal();
        }
    },

    // --- Related Users Logic ---
    // --- Task Reviewers Logic ---
    filterReviewers(query) {
        const dropdown = document.getElementById('ct-reviewer-dropdown');
        if (!dropdown) return;

        query = (query || '').toLowerCase().trim();

        let matches = mockUsers.filter(u =>
            u.id !== (this.state.currentUser ? this.state.currentUser.id : null) &&
            (u.name.toLowerCase().includes(query) || (u.department || '').toLowerCase().includes(query))
        );

        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">ไม่พบรายชื่อ</div>';
        } else {
            let html = '';
            matches.forEach(u => {
                // Check if already added
                const isAdded = (this.state.ctReviewers || []).some(r => r.userId === u.id);
                if (!isAdded) {
                    html += `
                        <div class="p-2 hover:bg-gray-50 cursor-pointer flex items-center gap-3 transition-colors" onclick="App.addReviewer('${u.id}')">
                            <img src="${u.avatar}" class="w-8 h-8 rounded-full border border-gray-200">
                            <div>
                                <p class="text-sm font-semibold text-gray-800" data-no-i18n>${u.name}</p>
                                <p class="text-[10px] text-gray-500" data-no-i18n>${u.department || 'ไม่มีแผนก'}</p>
                            </div>
                        </div>
                    `;
                }
            });
            dropdown.innerHTML = html || '<div class="p-3 text-sm text-gray-500 text-center">เพิ่มทั้งหมดแล้ว</div>';
        }
        dropdown.classList.remove('hidden');
    },

    addReviewer(userId) {
        if (!this.state.ctReviewers) this.state.ctReviewers = [];
        const uId = String(userId);
        if (!this.state.ctReviewers.some(r => String(r.userId) === uId)) {
            // Default order is length + 1 (can be edited by user)
            this.state.ctReviewers.push({ userId: uId, order: this.state.ctReviewers.length + 1, approved: false });
            this.renderTaskReviewers();
        }
        document.getElementById('ct-reviewer-search').value = '';
        document.getElementById('ct-reviewer-dropdown').classList.add('hidden');
    },

    removeReviewer(userId) {
        if (!this.state.ctReviewers) return;
        const uId = String(userId);
        this.state.ctReviewers = this.state.ctReviewers.filter(r => String(r.userId) !== uId);
        this.renderTaskReviewers();
    },

    updateReviewerOrder(userId, orderVal) {
        const order = parseInt(orderVal) || 1;
        const rev = this.state.ctReviewers.find(r => String(r.userId) === String(userId));
        if (rev) {
            rev.order = order;
        }
        this.renderTaskReviewers(); // Re-render to sort visually
    },

    renderTaskReviewers() {
        const list = document.getElementById('ct-reviewer-list');
        if (!list) return;

        if (!this.state.ctReviewers || this.state.ctReviewers.length === 0) {
            list.innerHTML = '';
            return;
        }

        // Sort by order descending (highest number first)
        const sorted = [...this.state.ctReviewers].sort((a, b) => b.order - a.order);

        let html = '';
        sorted.forEach(r => {
            const user = mockUsers.find(u => String(u.id) === String(r.userId));
            if (!user) return;
            html += `
                <div class="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-lg p-2">
                    <div class="flex items-center gap-2">
                        <img src="${user.avatar}" class="w-6 h-6 rounded-full border border-gray-200">
                        <span class="text-sm font-medium text-gray-700" data-no-i18n>${user.name}</span>
                        ${r.approved ? '<i class="fa-solid fa-check-circle text-green-500 text-xs ml-1" title="ตรวจผ่านแล้ว"></i>' : ''}
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-gray-500 font-medium">ลำดับ : </label>
                        <input type="number" min="1" value="${r.order}" 
                            class="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500" 
                            onchange="App.updateReviewerOrder('${r.userId}', this.value)">
                        <button type="button" class="text-red-400 hover:text-red-600 p-1 transition-colors" onclick="App.removeReviewer('${r.userId}')">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        list.innerHTML = html;
    },

    // --- Assignees Logic ---
    filterAssignees(query) {
        const drop = document.getElementById('ct-assignee-dropdown');
        if (!drop) return;

        query = (query || '').toLowerCase().trim();
        const availableUsers = mockUsers.filter(u => !this.state.ctAssignees.map(id => String(id)).includes(String(u.id)) && u.name.toLowerCase().includes(query));

        if (availableUsers.length === 0) {
            drop.innerHTML = `<div class="p-3 text-sm text-gray-500 text-center">ไม่พบผู้ใช้</div>`;
        } else {
            drop.innerHTML = availableUsers.map(u => `
                <div class="flex items-center space-x-3 p-2 hover:bg-blue-50 cursor-pointer transition-colors" onclick="App.addAssignee('${u.id}')">
                    <img src="${u.avatar}" class="w-8 h-8 rounded-full border border-gray-200">
                    <div>
                        <p class="text-sm font-semibold text-gray-800" data-no-i18n>${u.name}</p>
                        <p class="text-[10px] text-gray-500">${u.role}</p>
                    </div>
                </div>
            `).join('');
        }

        drop.classList.remove('hidden');
    },

    addAssignee(userId) {
        const uId = String(userId);
        if (!this.state.ctAssignees.map(id => String(id)).includes(uId)) {
            this.state.ctAssignees.push(uId);
            this.renderAssignees();
        }
        document.getElementById('ct-assignee-search').value = '';
        document.getElementById('ct-assignee-dropdown').classList.add('hidden');
    },

    removeAssignee(userId) {
        const uId = String(userId);
        this.state.ctAssignees = this.state.ctAssignees.filter(id => String(id) !== uId);
        this.renderAssignees();
    },

    renderAssignees() {
        const container = document.getElementById('ct-assignees-tags');
        if (!container) return;

        container.innerHTML = this.state.ctAssignees.map(id => {
            const u = mockUsers.find(user => String(user.id) === String(id));
            if (!u) return '';
            return `
                <div class="flex items-center bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700 border border-gray-200">
                    <img src="${u.avatar}" class="w-5 h-5 rounded-full mr-1.5 border border-gray-200">
                    ${u.name} 
                    <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600 p-0.5" onclick="event.stopPropagation(); App.removeAssignee('${u.id}')"></i>
                </div>
            `;
        }).join('');
    },

    // --- Division Logic (Mocked) ---
    filterDivisions(query) {
        const drop = document.getElementById('ct-div-dropdown');
        if (!drop) return;
        if (!this.state.ctDivisions) this.state.ctDivisions = [];
        
        const mockDivs = [...document.querySelectorAll('#dept-list-container .dept-item span')].map(x => x.textContent.trim()).filter(Boolean);
        query = (query || '').toLowerCase().trim();
        const availableDivs = mockDivs.filter(d => !this.state.ctDivisions.includes(d) && d.toLowerCase().includes(query));

        if (availableDivs.length === 0) {
            drop.innerHTML = `<div class="p-3 text-sm text-gray-500 text-center">ไม่พบฝ่าย</div>`;
        } else {
            drop.innerHTML = availableDivs.map(d => `
                <div class="flex items-center space-x-3 p-2 hover:bg-blue-50 cursor-pointer transition-colors" onclick="App.addDivision('${d}')">
                    <i class="fa-solid fa-building text-blue-400"></i>
                    <div>
                        <p class="text-sm font-semibold text-gray-800">${d}</p>
                    </div>
                </div>
            `).join('');
        }
        drop.classList.remove('hidden');
    },

    addDivision(divName) {
        if (!this.state.ctDivisions) this.state.ctDivisions = [];
        if (!this.state.ctDivisions.includes(divName)) {
            this.state.ctDivisions.push(divName);
            this.renderDivisions();
        }
        const searchInput = document.getElementById('ct-div-search');
        if (searchInput) searchInput.value = '';
        const drop = document.getElementById('ct-div-dropdown');
        if (drop) drop.classList.add('hidden');
    },

    removeDivision(divName) {
        this.state.ctDivisions = this.state.ctDivisions.filter(d => d !== divName);
        this.renderDivisions();
    },

    renderDivisions() {
        const container = document.getElementById('ct-div-tags');
        if (!container) return;
        container.innerHTML = this.state.ctDivisions.map(d => `
            <div class="flex items-center bg-gray-100 rounded-full pl-3 pr-2 py-1 text-xs text-gray-700 border border-gray-200">
                <i class="fa-solid fa-building mr-1.5 text-gray-500"></i> ${d}
                <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600 p-0.5" onclick="event.stopPropagation(); App.removeDivision('${d}')"></i>
            </div>
        `).join('');
    },

    // --- Department Logic (Mocked) ---
    filterDepartments(query) {
        const drop = document.getElementById('ct-dept-dropdown');
        if (!drop) return;
        if (!this.state.ctDepartments) this.state.ctDepartments = [];
        
        /* same list as the project form: members' departments, the departments from Settings, and "ทุกฝ่าย" */
        const fromSettings = [...document.querySelectorAll('#dept-list-container .dept-item span')].map(x => x.textContent.trim());
        const mockDepts = [...new Set([...mockUsers.map(u => u.department), ...fromSettings])].filter(d => d && d !== App.ALL_DEPTS);
        const raw = (query || '').trim();
        query = raw.toLowerCase();
        const chosen = this.state.ctDepartments;
        const availableDepts = mockDepts.filter(d => !chosen.includes(d) && d.toLowerCase().includes(query));
        const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const pick = d => `App.addDepartment(decodeURIComponent('${encodeURIComponent(d).replace(/'/g, '%27')}'))`;
        const row = (d, icon, cls) => `
                <div class="flex items-center space-x-3 p-2 hover:bg-blue-50 cursor-pointer transition-colors ${cls || ''}" onclick="${pick(d)}">
                    <i class="fa-solid ${icon} text-blue-400"></i>
                    <div>
                        <p class="text-sm font-semibold text-gray-800">${esc(d)}</p>
                    </div>
                </div>`;

        let html = '';
        if (!chosen.includes(App.ALL_DEPTS) && App.ALL_DEPTS.toLowerCase().includes(query)) html += row(App.ALL_DEPTS, 'fa-building', 'border-b border-gray-100');
        html += availableDepts.map(d => row(d, 'fa-users')).join('');
        /* a name that is not in the list yet can be added as a new department */
        if (raw && raw !== App.ALL_DEPTS && !mockDepts.some(d => d.toLowerCase() === query) && !chosen.includes(raw)) {
            html += `
                <div class="flex items-center space-x-3 p-2 hover:bg-blue-50 cursor-pointer transition-colors border-t border-gray-100" onclick="${pick(raw)}">
                    <i class="fa-solid fa-plus text-blue-500"></i>
                    <p class="text-sm font-semibold text-blue-700">เพิ่มแผนก "${esc(raw)}"</p>
                </div>`;
        }
        drop.innerHTML = html || `<div class="p-3 text-sm text-gray-500 text-center">ไม่พบแผนก</div>`;
        drop.classList.remove('hidden');
    },

    addDepartment(deptName) {
        if (!this.state.ctDepartments) this.state.ctDepartments = [];
        deptName = String(deptName || '').trim();
        if (!deptName) return;
        if (!this.state.ctDepartments.includes(deptName)) {
            /* "ทุกฝ่าย" replaces single departments, and picking a department replaces "ทุกฝ่าย" */
            if (deptName === App.ALL_DEPTS) this.state.ctDepartments = [];
            else this.state.ctDepartments = this.state.ctDepartments.filter(d => d !== App.ALL_DEPTS);
            this.state.ctDepartments.push(deptName);
            this.renderDepartments();

            // Auto-assign users in this department
            const usersInDept = mockUsers.filter(u => u.department === deptName);
            if (!this.state.ctRelatedUsers) this.state.ctRelatedUsers = [];
            usersInDept.forEach(u => {
                if (!this.state.ctRelatedUsers.includes(u.id)) {
                    this.state.ctRelatedUsers.push(u.id);
                }
            });
            this.renderRelatedUsers();
        }
        document.getElementById('ct-dept-search').value = '';
        document.getElementById('ct-dept-dropdown').classList.add('hidden');
    },

    removeDepartment(deptName) {
        this.state.ctDepartments = this.state.ctDepartments.filter(d => d !== deptName);
        this.renderDepartments();
    },

    renderDepartments() {
        const container = document.getElementById('ct-dept-tags');
        if (!container) return;
        const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        container.innerHTML = (this.state.ctDepartments || []).map(d => `
            <div class="flex items-center bg-gray-100 rounded-full pl-3 pr-2 py-1 text-xs text-gray-700 border border-gray-200">
                <i class="fa-solid ${d === App.ALL_DEPTS ? 'fa-building' : 'fa-users'} mr-1.5 text-gray-500"></i> ${esc(d)}
                <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600 p-0.5" onclick="event.stopPropagation(); App.removeDepartment(decodeURIComponent('${encodeURIComponent(d).replace(/'/g, '%27')}'))"></i>
            </div>
        `).join('');
    },

    filterRelatedUsers(query) {
        const drop = document.getElementById('ct-related-dropdown');
        if (!drop) return;

        query = (query || '').toLowerCase().trim();
        const availableUsers = mockUsers.filter(u => !this.state.ctRelatedUsers.map(id => String(id)).includes(String(u.id)) && u.name.toLowerCase().includes(query));

        if (availableUsers.length === 0) {
            drop.innerHTML = `<div class="p-3 text-sm text-gray-500 text-center">ไม่พบผู้ใช้</div>`;
        } else {
            drop.innerHTML = availableUsers.map(u => `
                <div class="flex items-center space-x-3 p-2 hover:bg-blue-50 cursor-pointer transition-colors" onclick="App.addRelatedUser('${u.id}')">
                    <img src="${u.avatar}" class="w-8 h-8 rounded-full border border-gray-200">
                    <div>
                        <p class="text-sm font-semibold text-gray-800" data-no-i18n>${u.name}</p>
                        <p class="text-[10px] text-gray-500">${u.role}</p>
                    </div>
                </div>
            `).join('');
        }

        drop.classList.remove('hidden');
    },

    addRelatedUser(userId) {
        const uId = String(userId);
        if (!this.state.ctRelatedUsers.map(id => String(id)).includes(uId)) {
            this.state.ctRelatedUsers.push(uId);
            this.renderRelatedUsers();
        }
        document.getElementById('ct-related-search').value = '';
        document.getElementById('ct-related-dropdown').classList.add('hidden');
    },

    removeRelatedUser(userId) {
        const uId = String(userId);
        this.state.ctRelatedUsers = this.state.ctRelatedUsers.filter(id => String(id) !== uId);
        this.renderRelatedUsers();
    },

    renderRelatedUsers() {
        const container = document.getElementById('ct-related-tags');
        if (!container) return;

        container.innerHTML = this.state.ctRelatedUsers.map(id => {
            const u = mockUsers.find(user => String(user.id) === String(id));
            if (!u) return '';
            return `
                <div class="flex items-center bg-gray-100 rounded-full pl-1 pr-2 py-1 text-xs text-gray-700 border border-gray-200">
                    <img src="${u.avatar}" class="w-5 h-5 rounded-full mr-1.5 border border-gray-200">
                    ${u.name} 
                    <i class="fa-solid fa-xmark ml-2 text-gray-400 cursor-pointer hover:text-gray-600 p-0.5" onclick="event.stopPropagation(); App.removeRelatedUser('${u.id}')"></i>
                </div>
            `;
        }).join('');
    },

    async loadUserChats() {
        try {
            const saved = localStorage.getItem('conwork_chats');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        parsed.forEach(savedChat => {
                            if (!mockChats.some(c => c.id === savedChat.id)) {
                                mockChats.push(savedChat);
                            }
                        });
                    }
                } catch (e) {}
            }

            if (!mockChats.some(c => c.id === 'note')) {
                mockChats.unshift({
                    id: 'note',
                    name: 'พื้นที่ส่วนตัว (Note)',
                    subtitle: 'จดบันทึกและฝากงานตัวเอง',
                    type: 'personal',
                    icon: 'fa-bookmark',
                    color: 'bg-blue-600',
                    status: 'online',
                    unreadCount: 0
                });
            }

            if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
                await this._ensureTeamRoom(); // the team's own room, kept in sync with the team's members
                const dbChannels = await window.conworkSupabase.fetchUserDirectChannels();
                if (dbChannels && dbChannels.length > 0) {
                    dbChannels.forEach(c => {
                        const existingIdx = mockChats.findIndex(mc => mc.id === c.id || (c.supabaseChannelId && mc.supabaseChannelId === c.supabaseChannelId) || (c.userId && mc.userId === c.userId));
                        if (existingIdx !== -1 && String(c.id).startsWith('chan-') && mockChats[existingIdx].id !== c.id) {
                            /* a group room saved earlier as a chat with one person: replace it with the room */
                            const old = mockChats[existingIdx];
                            mockMessages.forEach(m => { if (m.chatId === old.id) m.chatId = c.id; });
                            if (this.state.currentChat === old.id) this.state.currentChat = c.id;
                            mockChats[existingIdx] = c;
                        } else if (existingIdx !== -1) {
                            mockChats[existingIdx].name = c.name || mockChats[existingIdx].name;
                            mockChats[existingIdx].subtitle = c.subtitle || mockChats[existingIdx].subtitle;
                            if (c.avatar) mockChats[existingIdx].avatar = c.avatar;
                            if (c.supabaseChannelId) mockChats[existingIdx].supabaseChannelId = c.supabaseChannelId;
                        } else {
                            mockChats.push(c);
                        }
                    });
                }
            }

            mockChats.forEach(c => {
                if (c.userId) c.status = 'offline'; // a saved "online" is old news; live presence sets it again
                if (c.userId) {
                    const u = mockUsers.find(mu => String(mu.id) === String(c.userId));
                    if (u) {
                        c.name = u.name;
                        if (u.avatar) c.avatar = u.avatar;
                        if (u.department) c.subtitle = `${u.department} (${u.role === 'admin' ? 'แอดมิน' : u.role === 'reviewer2' ? 'ผู้บริหาร' : u.role === 'reviewer1' ? 'ผู้จัดการ' : 'พนักงาน'})`;
                    }
                }
            });

            localStorage.setItem('conwork_chats', JSON.stringify(mockChats));
            this.initGlobalChatRealtime();
        } catch (err) {
            console.warn('loadUserChats error:', err);
        }
    },

    initGlobalChatRealtime() {
        if (!window.conworkSupabase || !window.conworkSupabase.isAvailable()) return;
        if (this._globalChatSubscribed) return;
        this._globalChatSubscribed = true;

        window.conworkSupabase.subscribeGlobalUserMessages((newMsg) => {
            this.handleIncomingGlobalMessage(newMsg);
        });
        /* a new chat someone started with me shows up in the list without reloading the page */
        window.conworkSupabase.subscribeMyNewChats(() => {
            this.loadUserChats().then(() => { if (this.state.currentView === 'messages') this.renderChatList(); });
        });
    },

    handleIncomingGlobalMessage(newMsg) {
        if (!newMsg || !newMsg.channel_id) return;
        const myId = this.state.currentUser?.id;
        if (myId && String(newMsg.sender_id) === String(myId)) return;

        const d = new Date(newMsg.created_at || Date.now());
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const timeStr = `${day}/${month}/${year} ${hours}:${minutes}`;

        let targetChat = mockChats.find(c => c.supabaseChannelId === newMsg.channel_id || c.id === newMsg.channel_id);

        /* a room we have not listed yet (e.g. a new group): reload the list once, then try again */
        if (!targetChat && !newMsg._afterReload && typeof this.loadUserChats === 'function') {
            this.loadUserChats().then(() => this.handleIncomingGlobalMessage(Object.assign({}, newMsg, { _afterReload: true })));
            return;
        }

        if (!targetChat) {
            const senderUser = mockUsers.find(u => String(u.id) === String(newMsg.sender_id));
            const senderId = senderUser ? senderUser.id : newMsg.sender_id;
            targetChat = this.getOrCreateChat(senderId, senderUser);
            if (targetChat) targetChat.supabaseChannelId = newMsg.channel_id;
        }

        const isContentImage = newMsg.content && (newMsg.content.startsWith('data:image/') || newMsg.content.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i));
        const isContentFile = newMsg.content && (newMsg.content.startsWith('data:application/') || newMsg.content.match(/\.(pdf|docx|xlsx|zip)(\?.*)?$/i));
        const msgType = isContentImage ? 'image' : (isContentFile ? 'file' : 'text');

        if (!this._acceptIncomingMessage(newMsg, targetChat ? targetChat.id : newMsg.channel_id, msgType, timeStr)) return;

        const isCurrentlyViewingThisChat = this.state.currentView === 'messages' && this.state.currentChat === targetChat?.id;

        if (isCurrentlyViewingThisChat) {
            this.renderMessages();
            this.renderChatList();
            const msgContainer = document.getElementById('chat-messages-container');
            if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
        } else {
            if (targetChat) {
                targetChat.unreadCount = (targetChat.unreadCount || 0) + 1;
            }
            this.updateUnreadBadge();
            if (this.state.currentView === 'messages') {
                this.renderChatList();
            }

            const senderName = mockUsers.find(u => String(u.id) === String(newMsg.sender_id))?.name || 'ผู้ใช้';
            const displayPreview = msgType === 'image' ? '[ส่งรูปภาพ]' : (msgType === 'file' ? '[ส่งไฟล์แนบ]' : newMsg.content);
            if (typeof this._showToast === 'function') {
                const isEn = typeof i18nIsEnglish === 'function' && i18nIsEnglish();
                this._showToast(isEn ? '💬 New message from' : '💬 ข้อความใหม่จาก', 'info', ` ${senderName}: ${String(displayPreview).substring(0, 35)}`);
            }
        }
    },

    getOrCreateChat(chatIdOrUserId, userObj = null) {
        let chatId = String(chatIdOrUserId);
        /* group / project rooms are listed as 'chan-<id>' and are never turned into a chat with one person */
        if (chatId.startsWith('chan-')) {
            const room = mockChats.find(c => c.id === chatId);
            if (room) return room;
            const placeholder = { id: chatId, supabaseChannelId: chatId.slice(5), name: 'กลุ่มสนทนา', subtitle: 'กรุ๊ป', type: 'group', icon: 'fa-users', color: 'bg-green-600', status: 'online', unreadCount: 0 };
            mockChats.push(placeholder);
            return placeholder;
        }
        if (!chatId.startsWith('user-') && chatId !== 'note') {
            chatId = 'user-' + chatId;
        }

        let chat = mockChats.find(c => c.id === chatId || (c.userId && 'user-' + c.userId === chatId));
        if (chat) {
            if (chat.userId) {
                const liveU = mockUsers.find(u => String(u.id) === String(chat.userId));
                if (liveU) {
                    chat.name = liveU.name;
                    if (liveU.avatar) chat.avatar = liveU.avatar;
                }
            }
            return chat;
        }

        let user = userObj;
        if (!user) {
            const rawId = chatId.replace('user-', '');
            user = mockUsers.find(u => String(u.id) === rawId || u.name === rawId || u.email === rawId);
        }

        if (!user && this.state.currentUser && (String(this.state.currentUser.id) === chatId.replace('user-', '') || this.state.currentUser.name === chatId.replace('user-', ''))) {
            user = this.state.currentUser;
        }

        const name = user ? user.name : chatId.replace('user-', '');
        const dept = user ? (user.department ? `${user.department} (${user.role === 'admin' ? 'แอดมิน' : user.role === 'reviewer2' ? 'ผู้บริหาร' : user.role === 'reviewer1' ? 'ผู้จัดการ' : 'พนักงาน'})` : (user.role || 'ส่วนตัว')) : 'พนักงาน';
        const status = 'offline'; // becomes "online" only when the other person has the chat open (realtime presence)
        const color = user ? (user.color || 'bg-blue-500') : 'bg-blue-500';
        const icon = user ? (user.icon || 'fa-user') : 'fa-user';

        chat = {
            id: chatId,
            userId: user ? user.id : chatId.replace('user-', ''),
            name: name,
            subtitle: dept,
            avatar: user ? user.avatar : null,
            type: 'personal',
            icon: icon,
            color: color,
            status: status,
            unreadCount: 0
        };

        mockChats.unshift(chat);
        try {
            localStorage.setItem('conwork_chats', JSON.stringify(mockChats));
        } catch (e) {}
        return chat;
    },

    /* ===== Group rooms ===== */
    /* a simple modal for the chat screens; content is built by the caller (text already escaped) */
    _chatModal(innerHtml) {
        this._closeChatModal();
        const wrap = document.createElement('div');
        wrap.id = 'chat-dyn-modal';
        wrap.className = 'fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4';
        wrap.innerHTML = `<div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" role="dialog" aria-modal="true">${innerHtml}</div>`;
        wrap.addEventListener('click', e => { if (e.target === wrap) this._closeChatModal(); });
        document.body.appendChild(wrap);
        return wrap;
    },
    _closeChatModal() { document.getElementById('chat-dyn-modal')?.remove(); },

    openCreateGroupChat() {
        const myId = String(this.state.currentUser?.id || '');
        const people = mockUsers.filter(u => String(u.id) !== myId);
        const rows = people.length ? people.map(u => `
            <label class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" class="cg-member w-4 h-4 accent-blue-600" value="${this._esc(u.id)}">
                <img src="${this._safeUrl(u.avatar) || this._esc(this._initialsAvatar(u.name))}" class="w-8 h-8 rounded-full object-cover" alt="">
                <span class="min-w-0"><span class="block text-sm font-medium text-gray-800 truncate" data-no-i18n>${this._esc(u.name)}</span>
                <span class="block text-xs text-gray-500 truncate" data-no-i18n>${this._esc(u.department || '')}</span></span>
            </label>`).join('') : '<p class="text-sm text-gray-500 px-3 py-4">ยังไม่มีสมาชิกคนอื่นในทีม</p>';
        this._chatModal(`
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 class="text-lg font-bold text-gray-800">สร้างกลุ่มแชท</h3>
                <button type="button" class="text-gray-400 hover:text-gray-600" onclick="App._closeChatModal()" aria-label="ปิด"><i class="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div class="px-5 pt-4">
                <label class="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อกลุ่ม</label>
                <input type="text" id="cg-name" maxlength="80" placeholder="เช่น ทีมออกแบบ" class="w-full border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <label class="block text-sm font-semibold text-gray-700 mt-4 mb-1.5">สมาชิก</label>
            </div>
            <div class="px-2 pb-2 overflow-y-auto flex-1 min-h-0">${rows}</div>
            <div class="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                <button type="button" class="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50" onclick="App._closeChatModal()">ยกเลิก</button>
                <button type="button" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700" onclick="App.createGroupChat()">สร้างกลุ่ม</button>
            </div>`);
        setTimeout(() => document.getElementById('cg-name')?.focus(), 50);
    },

    async createGroupChat() {
        const name = (document.getElementById('cg-name')?.value || '').trim();
        const members = [...document.querySelectorAll('#chat-dyn-modal .cg-member:checked')].map(x => x.value);
        if (!name) { App._showToast('กรุณาตั้งชื่อกลุ่ม', 'error'); return; }
        if (!members.length) { App._showToast('เลือกสมาชิกอย่างน้อย 1 คน', 'error'); return; }
        const sb = window.conworkSupabase;
        if (!sb || !sb.isAvailable()) { App._showToast('ยังสร้างกลุ่มไม่ได้ (ไม่ได้เชื่อมต่อฐานข้อมูล)', 'error'); return; }
        const res = await sb._chatRpc('create_group_chat', { p_name: name, p_members: members, p_project: null });
        if (res.missing) { App._showToast('ยังสร้างกลุ่มไม่ได้: ผู้ดูแลระบบต้องติดตั้งฐานข้อมูลแชทก่อน', 'error'); return; }
        if (!res.data) { App._showToast('สร้างกลุ่มไม่สำเร็จ: ' + ((res.error && res.error.message) || ''), 'error'); return; }
        this._closeChatModal();
        await this._openRoom(res.data);
        App._showToast('สร้างกลุ่มแล้ว', 'success');
    },

    /* reload the chat list and open the room with this database id */
    async _openRoom(roomId) {
        await this.loadUserChats();
        if (this.state.currentView !== 'messages') this.switchView('messages');
        const chat = mockChats.find(c => c.supabaseChannelId === roomId);
        this.renderChatList();
        await this.switchChat(chat ? chat.id : 'chan-' + roomId);
    },

    /* the project's own chat room (everyone in the project is in it) */
    async openProjectChatFromMenu() {
        document.getElementById('project-context-menu')?.classList.add('hidden');
        const projectId = this._contextProjectId;
        const sb = window.conworkSupabase;
        if (!projectId || !sb || !sb.isAvailable()) return;
        const res = await sb._chatRpc('ensure_project_chat', { p_project: projectId });
        if (res.missing) { App._showToast('ยังเปิดแชทโปรเจกต์ไม่ได้: ผู้ดูแลระบบต้องติดตั้งฐานข้อมูลแชทก่อน', 'error'); return; }
        if (!res.data) { App._showToast('เปิดแชทโปรเจกต์ไม่สำเร็จ', 'error'); return; }
        await this._openRoom(res.data);
    },

    /* the team's room (everyone in my current team), created and kept in sync once per visit */
    async _ensureTeamRoom() {
        const sb = window.conworkSupabase;
        const company = this.state.currentUser?.workspaceId;
        if (this._teamRoomChecked || !sb || !sb.isAvailable() || !/^[0-9a-f-]{36}$/i.test(String(company || ''))) return false;
        this._teamRoomChecked = true;
        const res = await sb._chatRpc('ensure_team_chat', { p_company: company });
        return !!res.data;
    },

    /* ===== Files & media of a chat, by period ===== */
    openChatFiles() {
        const chat = mockChats.find(c => c.id === this.state.currentChat);
        if (!chat) { App._showToast('เลือกแชทก่อน', 'error'); return; }
        this.state.chatFilesPeriod = this.state.chatFilesPeriod || { kind: 'all', ref: new Date().toISOString() };
        this._chatModal(`
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div class="min-w-0"><h3 class="text-lg font-bold text-gray-800">ไฟล์และสื่อ</h3>
                <p class="text-xs text-gray-500 truncate" data-no-i18n>${this._esc(chat.name)}</p></div>
                <button type="button" class="text-gray-400 hover:text-gray-600" onclick="App._closeChatModal()" aria-label="ปิด"><i class="fa-solid fa-xmark text-xl"></i></button>
            </div>
            <div class="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
                <select id="cf-kind" class="border border-gray-200 rounded-lg py-1.5 px-2 text-sm" onchange="App._chatFilesSetKind(this.value)">
                    <option value="all">ทั้งหมด</option><option value="week">สัปดาห์</option><option value="month">เดือน</option>
                    <option value="quarter">ไตรมาส</option><option value="year">ปี</option>
                </select>
                <button type="button" id="cf-prev" class="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50" onclick="App._chatFilesStep(-1)" aria-label="ก่อนหน้า"><i class="fa-solid fa-chevron-left text-xs"></i></button>
                <span id="cf-label" class="text-sm font-semibold text-gray-700 min-w-[8rem] text-center" data-no-i18n></span>
                <button type="button" id="cf-next" class="w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50" onclick="App._chatFilesStep(1)" aria-label="ถัดไป"><i class="fa-solid fa-chevron-right text-xs"></i></button>
            </div>
            <div id="cf-list" class="px-3 py-3 overflow-y-auto flex-1 min-h-0"></div>`);
        document.getElementById('cf-kind').value = this.state.chatFilesPeriod.kind;
        this._renderChatFiles();
    },
    _chatFilesSetKind(kind) {
        this.state.chatFilesPeriod = { kind, ref: new Date().toISOString() };
        this._renderChatFiles();
    },
    _chatFilesStep(steps) {
        const p = this.state.chatFilesPeriod;
        if (!p || p.kind === 'all' || !window.ConworkPeriods) return;
        const next = ConworkPeriods.shift(p.kind, new Date(p.ref), steps);
        this.state.chatFilesPeriod = { kind: p.kind, ref: next.start + 'T00:00:00' };
        this._renderChatFiles();
    },
    _msgDate(m) {
        if (m.createdAt) return String(m.createdAt).slice(0, 10);
        const p = String(m.timestamp || '').split(' ')[0].split('/');
        if (p.length !== 3) return '';
        const y = +p[2] > 2400 ? +p[2] - 543 : +p[2];
        return `${y}-${p[1]}-${p[0]}`;
    },
    _renderChatFiles() {
        const list = document.getElementById('cf-list');
        if (!list) return;
        const p = this.state.chatFilesPeriod || { kind: 'all' };
        const period = p.kind !== 'all' && window.ConworkPeriods ? ConworkPeriods.range(p.kind, new Date(p.ref)) : null;
        const label = document.getElementById('cf-label');
        if (label) label.textContent = period ? period.label : (typeof i18nIsEnglish === 'function' && i18nIsEnglish() ? 'All time' : 'ทุกช่วงเวลา');
        ['cf-prev', 'cf-next'].forEach(id => { const b = document.getElementById(id); if (b) b.disabled = !period; });
        const files = mockMessages
            .filter(m => m.chatId === this.state.currentChat && (m.filePath || m.type === 'image' || m.type === 'file'))
            .filter(m => !period || ConworkPeriods.contains(period, this._msgDate(m)))
            .sort((a, b) => this._msgDate(b).localeCompare(this._msgDate(a)));
        if (!files.length) {
            list.innerHTML = `<div class="text-center text-sm text-gray-400 py-10"><i class="fa-regular fa-folder-open text-3xl mb-2 block"></i>ไม่มีไฟล์ในช่วงเวลานี้</div>`;
            return;
        }
        const images = files.filter(m => m.type === 'image');
        const docs = files.filter(m => m.type !== 'image');
        const imgHtml = images.map(m => {
            const src = m.filePath ? '' : this._safeUrl(m.text);
            const attr = m.filePath ? `data-file-path="${this._esc(m.filePath)}"` : `src="${src}"`;
            return `<img ${attr} alt="" class="w-full aspect-square object-cover rounded-lg bg-gray-100 cursor-pointer hover:opacity-90" onclick="this.src && window.open(this.src, '_blank')">`;
        }).join('');
        const docHtml = docs.map(m => {
            const href = m.filePath ? '#' : this._safeUrl(m.text);
            const attr = m.filePath ? `data-file-path="${this._esc(m.filePath)}"` : '';
            return `<a ${attr} href="${href}" target="_blank" rel="noopener" download="${this._esc(m.fileName || 'file')}" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50">
                <span class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-file-lines"></i></span>
                <span class="min-w-0 flex-1"><span class="block text-sm font-medium text-gray-800 truncate" data-no-i18n>${this._esc(m.fileName || 'file')}</span>
                <span class="block text-xs text-gray-500">${this._esc(this._msgDate(m))}${m.fileSize ? ' · ' + this._fmtBytes(m.fileSize) : ''}</span></span>
                <i class="fa-solid fa-download text-gray-400"></i></a>`;
        }).join('');
        list.innerHTML = (images.length ? `<p class="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 mb-2">รูปภาพ (${images.length})</p><div class="grid grid-cols-3 gap-2 px-2 mb-4">${imgHtml}</div>` : '')
            + (docs.length ? `<p class="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 mb-1">ไฟล์ (${docs.length})</p>${docHtml}` : '');
        this._hydrateStoredFiles(list);
    },

    /* phones show the chat list or one conversation; this goes back to the list */
    closeChatOnPhone() {
        document.getElementById('view-messages')?.classList.remove('chat-open');
    },

    async switchChat(chatId) {
        if (!chatId) return;
        const chat = this.getOrCreateChat(chatId);
        this.state.currentChat = chat.id;
        document.getElementById('view-messages')?.classList.add('chat-open');
        const sendErr = document.getElementById('chat-send-error');
        if (sendErr) sendErr.classList.add('hidden');
        this.state.chatSearchQuery = '';

        // Clear search input text field if active
        const searchInputs = document.querySelectorAll('input[placeholder*="ค้นหา"]');
        searchInputs.forEach(input => {
            if (input && input.getAttribute('onkeyup') && input.getAttribute('onkeyup').includes('quickSearchChats')) {
                input.value = '';
            }
        });

        if (chat && chat.unreadCount) {
            chat.unreadCount = 0;
        }

        this.renderChatList();

        // Setup Realtime with Supabase
        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            if (this.chatSubscription) {
                try {
                    window.conworkSupabase.client.removeChannel(this.chatSubscription);
                } catch (e) {}
                this.chatSubscription = null;
            }

            let realChannelId = chat.supabaseChannelId;
            if (!realChannelId) {
                if (chat.id === 'note') {
                    realChannelId = await window.conworkSupabase.getOrCreatePersonalNoteChannel();
                } else if (chat.userId || chat.id.startsWith('user-')) {
                    const targetId = chat.userId || chat.id.replace('user-', '');
                    realChannelId = await window.conworkSupabase.getOrCreateDirectChannel(targetId);
                } else {
                    realChannelId = chat.id;
                }
                if (realChannelId) chat.supabaseChannelId = realChannelId;
            }

            const targetChanId = chat.supabaseChannelId || chat.id;

            let messages = null;
            try {
                messages = await window.conworkSupabase.fetchMessages(targetChanId);
            } catch (e) {
                console.warn('Could not load messages for this chat:', e && e.message);
            }
            if (messages && Array.isArray(messages)) {
                // Clear existing messages for this chat
                let i = mockMessages.length;
                while (i--) {
                    if (mockMessages[i].chatId === chat.id || mockMessages[i].chatId === targetChanId) {
                        mockMessages.splice(i, 1);
                    }
                }
                messages.forEach(msg => {
                    const d = new Date(msg.created_at || Date.now());
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const timeStr = `${day}/${month}/${year} ${hours}:${minutes}`;

                    const isContentImage = msg.content && (msg.content.startsWith('data:image/') || msg.content.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i));
                    const isContentFile = msg.content && (msg.content.startsWith('data:application/') || msg.content.match(/\.(pdf|docx|xlsx|zip)(\?.*)?$/i));
                    const msgType = isContentImage ? 'image' : (isContentFile ? 'file' : 'text');

                    mockMessages.push(this._msgFromRow(msg, chat.id, msgType, timeStr));
                });
                this.renderMessages();
            }

            this.chatSubscription = window.conworkSupabase.subscribeToChannelMessages(
                targetChanId,
                (newMsg) => {
                    const d = new Date(newMsg.created_at || Date.now());
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const timeStr = `${day}/${month}/${year} ${hours}:${minutes}`;

                    const isContentImage = newMsg.content && (newMsg.content.startsWith('data:image/') || newMsg.content.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i));
                    const isContentFile = newMsg.content && (newMsg.content.startsWith('data:application/') || newMsg.content.match(/\.(pdf|docx|xlsx|zip)(\?.*)?$/i));
                    const msgType = isContentImage ? 'image' : (isContentFile ? 'file' : 'text');

                    if (this._acceptIncomingMessage(newMsg, chat.id, msgType, timeStr)) {
                        if (this.state.currentChat === chat.id) {
                            this.renderMessages();
                            this.renderChatList();
                            const msgContainer = document.getElementById('chat-messages-container');
                            if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
                        }
                    }
                },
                (isOnline) => {
                    chat.status = isOnline ? 'online' : 'offline';
                    if (this.state.currentChat === chat.id) {
                        const statusEl = document.getElementById('chat-header-status');
                        if (statusEl) {
                            if (isOnline) {
                                statusEl.innerHTML = `<span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span> ออนไลน์`;
                                statusEl.className = 'text-xs text-green-500 flex items-center';
                            } else {
                                statusEl.innerHTML = `<span class="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span> ออฟไลน์`;
                                statusEl.className = 'text-xs text-gray-400 flex items-center';
                            }
                        }
                    }
                }
            );
        }

        this.renderMessages();

        // Auto-scroll messages container to bottom when switching chat
        setTimeout(() => {
            const msgContainer = document.getElementById('chat-messages-container');
            if (msgContainer) msgContainer.scrollTop = msgContainer.scrollHeight;
        }, 50);
    },

    updateUnreadBadge() {
        const totalUnread = mockChats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
        const badge = document.getElementById('sidebar-msg-badge');
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
        const topBadge = document.getElementById('top-nav-notification-badge');
        if (topBadge) {
            if (totalUnread > 0) {
                topBadge.textContent = totalUnread > 99 ? '99+' : totalUnread;
                topBadge.classList.remove('hidden');
            } else {
                topBadge.classList.add('hidden');
            }
        }
    },

    filterChats(filter) {
        this.state.chatFilter = filter;

        const tabs = ['all', 'personal', 'group'];
        tabs.forEach(t => {
            const btn = document.getElementById(`chat-filter-${t}`);
            if (!btn) return;
            if (t === filter) {
                btn.className = 'flex-1 py-1.5 text-sm font-medium rounded-md bg-blue-600 shadow-sm text-white transition-colors';
            } else {
                btn.className = 'flex-1 py-1.5 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors';
            }
        });

        this.renderChatList();
    },

    calculateSearchScore(item, query) {
        if (!query) return 0;
        const q = query.trim().toLowerCase();
        if (!q) return 0;

        const name = (item.name || '').toLowerCase();
        const subtitle = (item.subtitle || item.department || item.role || '').toLowerCase();

        // 1. Exact match on name
        if (name === q) return 1000;

        // 2. Name starts with query
        if (name.startsWith(q)) {
            return 800 + (q.length / Math.max(name.length, 1)) * 100;
        }

        // 3. Word in name starts with query
        const words = name.split(/[\s()_.-]+/);
        for (let i = 0; i < words.length; i++) {
            if (words[i].startsWith(q)) {
                return 600 - (i * 20) + (q.length / Math.max(name.length, 1)) * 50;
            }
        }

        // 4. Substring match in name
        const pos = name.indexOf(q);
        if (pos !== -1) {
            return 400 - (pos * 10);
        }

        // 5. Subtitle/department starts with or contains query
        if (subtitle.startsWith(q)) {
            return 300;
        }
        if (subtitle.includes(q)) {
            return 200;
        }

        // 6. Character sequence similarity / Fuzzy match (letters appear in sequence)
        let qIdx = 0;
        let consec = 0;
        let fuzzyScore = 0;
        let firstMatchIdx = -1;

        for (let i = 0; i < name.length && qIdx < q.length; i++) {
            if (name[i] === q[qIdx]) {
                if (firstMatchIdx === -1) firstMatchIdx = i;
                qIdx++;
                consec++;
                fuzzyScore += (15 * consec);
            } else {
                consec = 0;
            }
        }

        if (qIdx === q.length) {
            return 100 + fuzzyScore - (firstMatchIdx * 5);
        }

        return 0;
    },

    quickSearchChats(inputElement, event) {
        this.state.chatSearchQuery = inputElement.value.trim().toLowerCase();
        this.renderChatList();
    },

    renderChatList() {
        const container = document.getElementById('chat-list-container');
        if (!container) return;

        this.updateUnreadBadge();

        const filter = this.state.chatFilter || 'all';
        const query = (this.state.chatSearchQuery || '').trim().toLowerCase();

        const myId = this.state.currentUser?.id;

        // Combine existing chats + company employees from mockUsers
        const candidates = [...mockChats];

        mockUsers.forEach(u => {
            if (String(u.id) === String(myId)) return;
            const chatId = 'user-' + u.id;
            const exists = candidates.some(c => c.id === chatId || c.userId === u.id);
            if (!exists) {
                candidates.push({
                    id: chatId,
                    userId: u.id,
                    name: u.name,
                    subtitle: u.department ? `${u.department} (${u.role === 'admin' ? 'แอดมิน' : u.role === 'reviewer2' ? 'ผู้บริหาร' : u.role === 'reviewer1' ? 'ผู้จัดการ' : 'พนักงาน'})` : (u.role || 'พนักงานในบริษัท'),
                    type: 'personal',
                    icon: 'fa-user',
                    color: 'bg-blue-500',
                    status: u.status || 'online',
                    unreadCount: 0,
                    isUserContact: true
                });
            }
        });

        let filteredItems = [];

        if (query) {
            filteredItems = candidates
                .map(item => {
                    const score = this.calculateSearchScore(item, query);
                    return { item, score };
                })
                .filter(res => {
                    if (filter !== 'all' && res.item.type !== filter) return false;
                    return res.score > 0;
                })
                .sort((a, b) => b.score - a.score)
                .map(res => res.item);
        } else {
            filteredItems = mockChats.filter(c => {
                if (filter !== 'all' && c.type !== filter) return false;
                return true;
            });
        }

        if (filteredItems.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-sm text-gray-500">ไม่พบแชตหรือพนักงานที่ค้นหา</div>`;
            return;
        }

        container.innerHTML = filteredItems.map(c => {
            const isActive = this.state.currentChat === c.id;
            const activeClasses = isActive ? 'bg-gray-200 border-l-4 border-blue-600' : 'hover:bg-gray-100';
            const badgeHtml = c.type === 'personal'
                ? `<span class="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">ส่วนตัว</span>`
                : `<span class="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-600">กรุ๊ป</span>`;

            const liveUser = c.userId ? mockUsers.find(u => String(u.id) === String(c.userId)) : null;
            const displayName = liveUser ? liveUser.name : c.name;
            const displayAvatar = (liveUser && liveUser.avatar) ? liveUser.avatar : c.avatar;

            const chatMsgs = mockMessages.filter(m => m.chatId === c.id && (c.id !== 'note' || m.senderId == myId));
            const lastMsg = chatMsgs[chatMsgs.length - 1];
            let subtitleText = liveUser ? (liveUser.department ? `${liveUser.department}` : c.subtitle) : c.subtitle;
            if (lastMsg) {
                if (lastMsg.type === 'image') {
                    subtitleText = '[รูปภาพ]';
                } else {
                    subtitleText = lastMsg.text;
                }
            }

            if (lastMsg && lastMsg.type === 'file') subtitleText = '[ไฟล์แนบ]';

            const unreadBadgeHtml = (c.unreadCount && c.unreadCount > 0)
                ? `<span class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] h-[16px] flex items-center justify-center ml-auto">${c.unreadCount > 99 ? '99+' : c.unreadCount}</span>`
                : '';

            /* ids go into onclick as encoded strings so a quote in an id cannot break out */
            const enc = v => this._esc(encodeURIComponent(String(v)).replace(/'/g, '%27'));
            const clickHandler = c.isUserContact
                ? `App.startDirectChat(decodeURIComponent('${enc(c.userId || c.id)}'))`
                : `App.switchChat(decodeURIComponent('${enc(c.id)}'))`;

            const safeAvatar = this._safeUrl(displayAvatar);
            const avatarHtml = (safeAvatar && c.id !== 'note')
                ? `<img src="${safeAvatar}" class="w-12 h-12 rounded-full object-cover shrink-0 border border-gray-200">`
                : `<div class="w-12 h-12 rounded-full flex items-center justify-center text-white shrink-0 ${this._esc(c.color || 'bg-blue-500')}">
                       <i class="fa-solid ${this._esc(c.icon || 'fa-user')}"></i>
                   </div>`;

            return `
                <div class="p-4 cursor-pointer flex items-center space-x-3 transition-colors ${activeClasses}"
                    onclick="${clickHandler}">
                    ${avatarHtml}
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center">
                            <h4 class="text-sm font-bold text-gray-900 truncate flex items-center"><span data-no-i18n>${this._esc(displayName)}</span> ${badgeHtml}</h4>
                            ${unreadBadgeHtml}
                        </div>
                        <p class="text-xs text-gray-500 truncate mt-0.5"${lastMsg && lastMsg.type !== 'image' && lastMsg.type !== 'file' ? ' data-no-i18n' : ''}>${this._esc(subtitleText)}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderMessages() {
        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        const currentChat = mockChats.find(c => c.id === this.state.currentChat);
        if (!currentChat) {
            container.innerHTML = '';
            return;
        }

        let chatName = currentChat.name;
        let chatAvatar = currentChat.avatar;
        if (currentChat.userId) {
            const liveUser = mockUsers.find(u => String(u.id) === String(currentChat.userId));
            if (liveUser) {
                chatName = liveUser.name;
                if (liveUser.avatar) chatAvatar = liveUser.avatar;
            }
        }

        const titleEl = document.getElementById('chat-header-title');
        if (titleEl) titleEl.innerText = chatName;

        const iconContainer = document.getElementById('chat-header-icon-container');
        if (iconContainer) {
            const safeChatAvatar = this._safeUrl(chatAvatar);
            if (safeChatAvatar && currentChat.id !== 'note') {
                iconContainer.innerHTML = `<img src="${safeChatAvatar}" class="w-full h-full rounded-full object-cover border border-gray-200">`;
                iconContainer.className = 'w-10 h-10 rounded-full flex items-center justify-center shrink-0';
            } else {
                iconContainer.innerHTML = `<i id="chat-header-icon" class="fa-solid ${this._esc(currentChat.icon || 'fa-user')}"></i>`;
                iconContainer.className = `w-10 h-10 rounded-full flex items-center justify-center text-white ${this._esc(currentChat.color || 'bg-blue-500')}`;
            }
        }

        const statusEl = document.getElementById('chat-header-status');
        if (statusEl) {
            if (currentChat.status === 'online') {
                statusEl.innerHTML = `<span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span> ออนไลน์`;
                statusEl.className = 'text-xs text-green-500 flex items-center';
            } else {
                statusEl.innerHTML = `<span class="w-1.5 h-1.5 bg-gray-400 rounded-full mr-1.5"></span> ออฟไลน์`;
                statusEl.className = 'text-xs text-gray-400 flex items-center';
            }
        }

        const myId = this.state.currentUser?.id;
        const msgs = mockMessages.filter(m => m.chatId === this.state.currentChat && (this.state.currentChat !== 'note' || String(m.senderId) === String(myId)));

        if (msgs.length === 0) {
            container.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-gray-400">
                <i class="fa-regular fa-comments text-4xl mb-3"></i>
                <p>เริ่มการสนทนา</p>
            </div>`;
            return;
        }

        container.innerHTML = msgs.map((m, index) => {
            const isMe = String(m.senderId) === String(myId);
            const sender = mockUsers.find(u => String(u.id) === String(m.senderId)) ||
                           (this.state.currentUser && String(this.state.currentUser.id) === String(m.senderId) ? this.state.currentUser : null);
            const senderName = sender ? sender.name : (m.senderName || 'ผู้ใช้');
            const senderAvatar = this._safeUrl(sender?.avatar || m.senderAvatar) || this._esc(this._initialsAvatar(senderName));

            const isEn = this.settings?.language === 'en' || document.body.classList.contains('lang-en');

            let dateStr = 'วันนี้';
            let timeStr = m.timestamp;
            let rawDateStr = 'วันนี้';

            if (m.timestamp && m.timestamp.includes(' ')) {
                const parts = m.timestamp.split(' ');
                if (parts[0].includes('/')) {
                    rawDateStr = parts[0];
                    dateStr = parts[0];
                    let rawTimeStr = parts.slice(1).join(' ');

                    if (rawTimeStr.includes(':')) {
                        let hStr = rawTimeStr.split(':')[0];
                        let mStr = rawTimeStr.split(':')[1].split(' ')[0];
                        let h = parseInt(hStr, 10);

                        if (rawTimeStr.toLowerCase().includes('pm') && h < 12) {
                            h += 12;
                        } else if (rawTimeStr.toLowerCase().includes('am') && h === 12) {
                            h = 0;
                        }

                        if (isEn) {
                            const ampm = h >= 12 ? 'PM' : 'AM';
                            let displayH = h % 12;
                            displayH = displayH ? displayH : 12;
                            timeStr = `${String(displayH).padStart(2, '0')}:${mStr} ${ampm}`;
                        } else {
                            timeStr = `${String(h).padStart(2, '0')}:${mStr} น.`;
                        }
                    }

                    const [d, mo, yStr] = dateStr.split('/');
                    const y = parseInt(yStr, 10);
                    let shortYear = '';
                    if (y > 2500) {
                        shortYear = isEn ? String(y - 543).slice(-2) : String(y).slice(-2);
                    } else if (y > 2000) {
                        shortYear = isEn ? String(y).slice(-2) : String(y + 543).slice(-2);
                    } else {
                        shortYear = yStr.slice(-2);
                    }
                    dateStr = `${d}/${mo}/${shortYear}`;
                } else {
                    if (m.timestamp.includes(':')) {
                        let hStr = m.timestamp.split(':')[0];
                        let mStr = m.timestamp.split(':')[1].split(' ')[0];
                        let h = parseInt(hStr, 10);

                        if (m.timestamp.toLowerCase().includes('pm') && h < 12) {
                            h += 12;
                        } else if (m.timestamp.toLowerCase().includes('am') && h === 12) {
                            h = 0;
                        }

                        if (isEn) {
                            const ampm = h >= 12 ? 'PM' : 'AM';
                            let displayH = h % 12;
                            displayH = displayH ? displayH : 12;
                            timeStr = `${String(displayH).padStart(2, '0')}:${mStr} ${ampm}`;
                        } else {
                            timeStr = `${String(h).padStart(2, '0')}:${mStr} น.`;
                        }
                    }
                }
            }
            if (dateStr === 'วันนี้') dateStr = isEn ? 'Today' : 'วันนี้';

            const prevM = index > 0 ? msgs[index - 1] : null;
            let prevRawDateStr = null;
            if (prevM) {
                if (prevM.timestamp && prevM.timestamp.includes(' ')) {
                    const pParts = prevM.timestamp.split(' ');
                    if (pParts[0].includes('/')) {
                        prevRawDateStr = pParts[0];
                    } else {
                        prevRawDateStr = 'วันนี้';
                    }
                } else {
                    prevRawDateStr = 'วันนี้';
                }
            }

            let timeDividerHtml = '';
            if (!prevM || prevRawDateStr !== rawDateStr) {
                timeDividerHtml = `
                    <div class="flex justify-center my-6 w-full">
                        <span class="text-xs text-gray-500 font-medium">${dateStr}</span>
                    </div>
                `;
            }
            /* period separator: a month heading whenever the month changes */
            const monthKey = msg => { const s = String(msg && msg.timestamp || ''); const p = s.split(' ')[0].split('/'); return p.length === 3 ? `${p[2]}-${p[1]}` : ''; };
            const mk = monthKey(m);
            if (mk && mk !== monthKey(prevM) && window.ConworkPeriods) {
                const per = ConworkPeriods.range('month', new Date(+mk.slice(0, 4) > 2400 ? +mk.slice(0, 4) - 543 : +mk.slice(0, 4), +mk.slice(5) - 1, 1));
                timeDividerHtml = `
                    <div class="flex items-center gap-3 mt-8 mb-2 w-full" aria-label="${this._esc(per.label)}">
                        <span class="h-px flex-1 bg-gray-200"></span>
                        <span class="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1" data-no-i18n>${this._esc(per.label)}</span>
                        <span class="h-px flex-1 bg-gray-200"></span>
                    </div>` + timeDividerHtml;
            }

            let contentHtml = '';
            const isImg = m.type === 'image' || (m.text && (m.text.startsWith('data:image/') || m.text.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i)));
            const isFile = m.type === 'file' || (m.text && (m.text.startsWith('data:application/') || m.text.match(/\.(pdf|docx|xlsx|zip)(\?.*)?$/i)));
            const safeSrc = (isImg || isFile) ? this._safeUrl(m.text) : '';
            const sizeTxt = m.fileSize ? ` · ${this._fmtBytes(m.fileSize)}` : '';
            if (m.filePath && !safeSrc) {
                /* a file kept in Storage: the link is fetched after drawing (data-file-path) */
                const fp = this._esc(m.filePath);
                contentHtml = m.type === 'image'
                    ? `<img data-file-path="${fp}" alt="" class="max-w-xs max-h-80 min-w-[120px] min-h-[80px] bg-gray-100 rounded-lg mt-1 cursor-pointer hover:opacity-90 object-cover shadow-sm" onclick="this.src && window.open(this.src, '_blank')">`
                    : `<a data-file-path="${fp}" href="#" target="_blank" rel="noopener" download="${this._esc(m.fileName || 'file')}" class="flex items-center gap-2 text-sm text-blue-600 hover:underline mt-1 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100"><i class="fa-solid fa-file-arrow-down text-lg"></i> <span data-no-i18n>${this._esc(m.fileName || 'file')}</span><span class="text-xs text-gray-500">${sizeTxt}</span></a>`;
            } else if (isImg && safeSrc) {
                contentHtml = `<img src="${safeSrc}" class="max-w-xs max-h-80 rounded-lg mt-1 cursor-pointer hover:opacity-90 object-cover shadow-sm" onclick="window.open(this.src, '_blank')">`;
            } else if (isFile && safeSrc) {
                contentHtml = `<a href="${safeSrc}" download="${this._esc(m.fileName || 'file')}" class="flex items-center gap-2 text-sm text-blue-600 hover:underline mt-1 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100"><i class="fa-solid fa-file-arrow-down text-lg"></i> ดาวน์โหลดไฟล์แนบ (<span data-no-i18n>${this._esc(m.fileName || 'เอกสาร')}</span>)</a>`;
            } else {
                /* data-no-i18n: a message is shown exactly as it was written, never translated */
                contentHtml = `<p class="text-sm whitespace-pre-wrap break-words" data-no-i18n>${this._richText(m.text)}</p>`;
            }

            let forwardedHtml = '';
            let forwardedHtmlOther = '';
            if (m.isForwarded) {
                forwardedHtml = `
                    <div class="text-[10px] text-blue-200/80 italic mb-0.5 flex items-center gap-1">
                        <i class="fa-solid fa-share"></i> ส่งต่อข้อความ
                    </div>
                `;
                forwardedHtmlOther = `
                    <div class="text-[10px] text-gray-400 italic mb-0.5 flex items-center gap-1">
                        <i class="fa-solid fa-share"></i> ส่งต่อข้อความ
                    </div>
                `;
            }

            let replyHtml = '';
            let replyHtmlOther = '';
            if (m.replyTo) {
                const originalMsg = mockMessages.find(orig => orig.id === m.replyTo);
                if (originalMsg) {
                    const originalSender = this._esc(mockUsers.find(u => String(u.id) === String(originalMsg.senderId))?.name
                        || (this.state.currentUser && String(this.state.currentUser.id) === String(originalMsg.senderId) ? this.state.currentUser.name : '') || 'ผู้ใช้');
                    const originalText = this._esc(originalMsg.type === 'image' ? '[รูปภาพ]' : (originalMsg.type === 'file' ? '[ไฟล์แนบ]' : originalMsg.text));
                    replyHtml = `
                        <div class="bg-blue-700/30 text-blue-100 text-[10px] px-2 py-1 rounded-t-lg mb-1 border-l-2 border-blue-300 truncate max-w-full" data-no-i18n>
                            <span class="font-semibold block">${originalSender}</span>
                            <span class="opacity-90 truncate block">${originalText}</span>
                        </div>
                    `;
                    replyHtmlOther = `
                        <div class="bg-gray-100 text-gray-500 text-[10px] px-2 py-1 rounded-t-lg mb-1 border-l-2 border-gray-300 truncate max-w-full" data-no-i18n>
                            <span class="font-semibold block">${originalSender}</span>
                            <span class="opacity-90 truncate block">${originalText}</span>
                        </div>
                    `;
                }
            }

            const editedHtmlMe = (m.isEdited ? `<span class="text-[10px] text-gray-400 mt-1">(แก้ไขแล้ว)</span>` : '')
                + (m.failed ? `<span class="text-[10px] text-red-500 mt-1"><i class="fa-solid fa-circle-exclamation"></i> ส่งไม่สำเร็จ</span>` : '');
            if (isMe) {
                return `
                    ${timeDividerHtml}
                    <div class="flex flex-col items-end mb-4 group">
                        <div class="flex items-end gap-2 justify-end w-full">
                            <span class="text-[10px] text-gray-400 mb-1">${timeStr}</span>
                            <!-- Menu Container -->
                            <div class="relative mb-1">
                                <!-- Menu Button -->
                                <button class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-1.5 rounded-full transition-opacity shrink-0 bg-white border border-gray-100 shadow-sm" onclick="App.toggleMessageMenu('${m.id}', event)" title="ตัวเลือก">
                                    <i class="fa-solid fa-bars text-[10px]"></i>
                                </button>
                                <!-- Dropdown Menu -->
                                <div id="msg-menu-${m.id}" class="hidden absolute right-0 top-full mt-1 w-max min-w-[9rem] bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-[60] text-left">
                                    <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 whitespace-nowrap" onclick="event.preventDefault(); App.replyMessage('${m.id}')"><i class="fa-solid fa-reply mr-2 w-4 text-center"></i>ตอบกลับ</a>
                                    <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 whitespace-nowrap" onclick="event.preventDefault(); App.editMessage('${m.id}')"><i class="fa-solid fa-pen mr-2 w-4 text-center"></i>แก้ไขข้อความ</a>
                                    <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 whitespace-nowrap" onclick="event.preventDefault(); App.copyMessage('${m.id}')"><i class="fa-solid fa-copy mr-2 w-4 text-center"></i>คัดลอก</a>
                                    <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 whitespace-nowrap" onclick="event.preventDefault(); App.forwardMessage('${m.id}')"><i class="fa-solid fa-share mr-2 w-4 text-center"></i>ส่งต่อ</a>
                                    <a href="#" class="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 whitespace-nowrap" onclick="event.preventDefault(); App.deleteMessage('${m.id}')"><i class="fa-solid fa-trash mr-2 w-4 text-center"></i>ลบข้อความ</a>
                                </div>
                            </div>
                            <!-- Message Content -->
                            <div class="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] shadow-sm flex flex-col">
                                ${forwardedHtml}
                                ${replyHtml}
                                ${contentHtml}
                            </div>
                        </div>
                        ${editedHtmlMe}
                    </div>
                `;
            } else {
                const editedHtmlOther = m.isEdited ? `<span class="text-[10px] text-gray-400 mt-1 ml-1">(แก้ไขแล้ว)</span>` : '';
                return `
                    ${timeDividerHtml}
                    <div class="flex items-end space-x-2 mb-4 group">
                        <img src="${senderAvatar}" class="w-8 h-8 rounded-full shrink-0 object-cover border border-gray-200">
                        <div class="flex flex-col items-start min-w-0 w-full">
                            <span class="text-[10px] text-gray-500 mb-1 ml-1" data-no-i18n>${this._esc(senderName)}</span>
                            <div class="flex items-end gap-2 w-full">
                                <div class="bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[75%] shadow-sm flex flex-col">
                                    ${forwardedHtmlOther}
                                    ${replyHtmlOther}
                                    ${contentHtml}
                                </div>
                                <!-- Menu Container -->
                                <div class="relative mb-1">
                                    <!-- Menu Button -->
                                    <button class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 p-1.5 rounded-full transition-opacity shrink-0 bg-white border border-gray-100 shadow-sm" onclick="App.toggleMessageMenu('${m.id}', event)" title="ตัวเลือก">
                                        <i class="fa-solid fa-bars text-[10px]"></i>
                                    </button>
                                    <!-- Dropdown Menu -->
                                    <div id="msg-menu-${m.id}" class="hidden absolute left-0 top-full mt-1 w-max min-w-[9rem] bg-white border border-gray-100 rounded-lg shadow-lg py-1 z-[60] text-left">
                                        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 whitespace-nowrap" onclick="event.preventDefault(); App.replyMessage('${m.id}')"><i class="fa-solid fa-reply mr-2 w-4 text-center"></i>ตอบกลับ</a>
                                        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 whitespace-nowrap" onclick="event.preventDefault(); App.copyMessage('${m.id}')"><i class="fa-solid fa-copy mr-2 w-4 text-center"></i>คัดลอก</a>
                                        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 whitespace-nowrap" onclick="event.preventDefault(); App.forwardMessage('${m.id}')"><i class="fa-solid fa-share mr-2 w-4 text-center"></i>ส่งต่อ</a>
                                    </div>
                                </div>
                                <span class="text-[10px] text-gray-400 mb-1">${timeStr}</span>
                            </div>
                            ${editedHtmlOther}
                        </div>
                    </div>
                `;
            }
        }).join('');

        container.scrollTop = container.scrollHeight;
        this._hydrateStoredFiles(container);
    },

    /* fill in short-lived links for files kept in Storage (images show, file cards open/download) */
    async _hydrateStoredFiles(root) {
        const sb = window.conworkSupabase;
        if (!root || !sb || !sb.isAvailable()) return;
        for (const el of root.querySelectorAll('[data-file-path]')) {
            const url = await sb.signedFileUrl(el.getAttribute('data-file-path'));
            if (!url) continue;
            if (el.tagName === 'IMG') {
                el.onload = () => { const c = document.getElementById('chat-messages-container'); if (c && c.contains(el)) c.scrollTop = c.scrollHeight; };
                el.src = url;
            } else {
                el.href = url;
            }
            el.removeAttribute('data-file-path');
        }
    },

    toggleMessageMenu(msgId, event) {
        if (event) event.stopPropagation();

        // Close other menus
        const allMenus = document.querySelectorAll('[id^="msg-menu-"]');
        allMenus.forEach(menu => {
            if (menu.id !== `msg-menu-${msgId}`) {
                menu.classList.add('hidden');
            }
        });

        const menu = document.getElementById(`msg-menu-${msgId}`);
        if (menu) {
            const isHidden = menu.classList.contains('hidden');
            menu.classList.toggle('hidden');

            if (isHidden) {
                // Add listener to close on outside click
                setTimeout(() => {
                    document.addEventListener('click', App._closeMessageMenus);
                }, 10);
            }
        }
    },

    _closeMessageMenus(e) {
        const allMenus = document.querySelectorAll('[id^="msg-menu-"]');
        let clickedInside = false;
        allMenus.forEach(menu => {
            if (menu.contains(e.target)) {
                clickedInside = true;
            }
        });

        if (!clickedInside) {
            allMenus.forEach(menu => menu.classList.add('hidden'));
            document.removeEventListener('click', App._closeMessageMenus);
        }
    },

    editMessage(msgId) {
        this.toggleMessageMenu(msgId);
        const msg = mockMessages.find(m => m.id === msgId);
        if (!msg) return;

        if (msg.type === 'image') {
            alert("ไม่สามารถแก้ไขรูปภาพได้");
            return;
        }

        this.state.editingMsgId = msgId;

        const preview = document.getElementById('chat-edit-preview');
        const text = document.getElementById('chat-edit-text');
        const input = document.getElementById('chat-input');

        if (preview && text) {
            text.textContent = msg.text;
            preview.classList.remove('hidden');
        }

        if (input) {
            input.value = msg.text;
            input.focus();
        }
    },

    cancelEdit() {
        this.state.editingMsgId = null;
        const preview = document.getElementById('chat-edit-preview');
        if (preview) preview.classList.add('hidden');
        const input = document.getElementById('chat-input');
        if (input) input.value = '';
    },

    replyMessage(msgId) {
        this.toggleMessageMenu(msgId);
        const msg = mockMessages.find(m => m.id === msgId);
        if (!msg) return;
        this.state.replyingToMsgId = msgId;

        const preview = document.getElementById('chat-reply-preview');
        const sender = document.getElementById('chat-reply-sender');
        const text = document.getElementById('chat-reply-text');

        if (preview && sender && text) {
            const user = mockUsers.find(u => u.id == msg.senderId);
            sender.textContent = user ? user.name : 'กำลังตอบกลับ';
            text.textContent = msg.type === 'image' ? '[รูปภาพ]' : msg.text;
            preview.classList.remove('hidden');
        }
        document.getElementById('chat-input')?.focus();
    },

    cancelReply() {
        this.state.replyingToMsgId = null;
        const preview = document.getElementById('chat-reply-preview');
        if (preview) preview.classList.add('hidden');
    },

    copyMessage(msgId) {
        this.toggleMessageMenu(msgId);
        const msg = mockMessages.find(m => m.id === msgId);
        if (!msg) return;
        navigator.clipboard.writeText(msg.text).then(() => {
            this._showToast("คัดลอกข้อความแล้ว", "success");
        }).catch(() => {
            alert("ไม่สามารถคัดลอกข้อความได้");
        });
    },

    forwardMessage(msgId) {
        this.toggleMessageMenu(msgId);
        const msg = mockMessages.find(m => m.id === msgId);
        if (!msg) return;
        this.state.forwardingMsgId = msgId;

        const modal = document.getElementById('forward-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const searchInput = document.getElementById('forward-search-input');
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
            }
            this.renderForwardChats();
        }
    },

    closeForwardModal() {
        this.state.forwardingMsgId = null;
        const modal = document.getElementById('forward-modal');
        if (modal) modal.classList.add('hidden');
    },

    renderForwardChats() {
        const container = document.getElementById('forward-chat-list');
        const searchInput = document.getElementById('forward-search-input');
        if (!container) return;

        const query = searchInput ? searchInput.value.toLowerCase() : '';
        const filtered = mockChats.filter(chat =>
            String(chat.name || '').toLowerCase().includes(query) ||
            String(chat.subtitle || '').toLowerCase().includes(query)
        );

        if (filtered.length === 0) {
            container.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">ไม่พบแชตที่ค้นหา</div>';
            return;
        }

        container.innerHTML = filtered.map(chat => `
            <button class="w-full text-left flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-200" onclick="App.confirmForward(decodeURIComponent('${this._esc(encodeURIComponent(String(chat.id)).replace(/'/g, '%27'))}'))">
                <div class="w-10 h-10 ${this._esc(chat.color || 'bg-gray-400')} rounded-full flex items-center justify-center text-white shrink-0">
                    <i class="fa-solid ${this._esc(chat.icon || 'fa-comments')}"></i>
                </div>
                <div class="flex flex-col min-w-0">
                    <span class="text-sm font-semibold text-gray-800 truncate">${this._esc(chat.name)}</span>
                    <span class="text-xs text-gray-500 truncate">${this._esc(chat.subtitle)}</span>
                </div>
            </button>
        `).join('');
    },

    filterForwardChats() {
        this.renderForwardChats();
    },

    confirmForward(targetChatId) {
        this.state.forwardingTargetChatId = targetChatId;
        const modal = document.getElementById('forward-confirm-modal');
        const noteInput = document.getElementById('forward-note-input');
        if (noteInput) noteInput.value = '';
        if (modal) {
            modal.classList.remove('hidden');
            if (noteInput) noteInput.focus();
        }
    },

    closeForwardConfirmModal() {
        this.state.forwardingTargetChatId = null;
        const modal = document.getElementById('forward-confirm-modal');
        if (modal) modal.classList.add('hidden');
    },

    executeForwardMessage() {
        const msgId = this.state.forwardingMsgId;
        const targetChatId = this.state.forwardingTargetChatId;
        if (!msgId || !targetChatId) return;
        const msg = mockMessages.find(m => m.id === msgId);
        if (!msg) return;

        const noteInput = document.getElementById('forward-note-input');
        const noteText = noteInput ? noteInput.value.trim() : '';

        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${day}/${month}/${year} ${hours}:${minutes}`;

        mockMessages.push({
            id: 'm' + Date.now() + '_1',
            chatId: targetChatId,
            senderId: this.state.currentUser?.id,
            text: msg.text,
            type: msg.type || 'text',
            timestamp: timeStr,
            isForwarded: true
        });

        if (noteText) {
            mockMessages.push({
                id: 'm' + Date.now() + '_2',
                chatId: targetChatId,
                senderId: this.state.currentUser?.id,
                text: noteText,
                type: 'text',
                timestamp: timeStr,
                isForwarded: false
            });
        }

        this.closeForwardConfirmModal();
        this.closeForwardModal();
        this._showToast("ส่งต่อข้อความเรียบร้อยแล้ว", "success");
        if (this.state.currentChat === targetChatId) {
            this.renderMessages();
        }
        this.renderChatList();
        this._saveData();
    },

    deleteMessage(msgId) {
        this.toggleMessageMenu(msgId);
        this.state.deletingMsgId = msgId;
        const modal = document.getElementById('delete-msg-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeDeleteModal() {
        this.state.deletingMsgId = null;
        const modal = document.getElementById('delete-msg-modal');
        if (modal) modal.classList.add('hidden');
    },

    confirmDeleteMessage() {
        if (!this.state.deletingMsgId) return;
        const idx = mockMessages.findIndex(m => m.id === this.state.deletingMsgId);
        if (idx !== -1) {
            mockMessages.splice(idx, 1);
            this.renderMessages();
            this.renderChatList();
            this._saveData();
            this._showToast("ลบข้อความเรียบร้อยแล้ว", "success");
        }
        this.closeDeleteModal();
    },

    async sendMessage() {
        const input = document.getElementById('chat-input');
        if (!input || !input.value.trim() || !this.state.currentChat) return;

        if (this.state.editingMsgId) {
            const msg = mockMessages.find(m => m.id === this.state.editingMsgId);
            if (msg) {
                msg.text = input.value.trim();
                msg.isEdited = true;
            }
            this.cancelEdit();
            this.renderMessages();
            this.renderChatList();
            this._saveData();
            return;
        }

        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${day}/${month}/${year} ${hours}:${minutes}`;

        const msgText = input.value.trim();
        const myId = this.state.currentUser?.id;

        // If not using real-time, generate a local ID
        const tempMsgId = 'm' + Date.now();

        mockMessages.push({
            id: tempMsgId,
            pending: true, // shown right away; gets its database id once saved
            chatId: this.state.currentChat,
            senderId: myId,
            text: msgText,
            timestamp: timeStr,
            replyTo: this.state.replyingToMsgId || null
        });

        input.value = '';
        this.cancelReply();
        this.renderMessages();
        this.renderChatList();
        this._saveData();

        const chat = mockChats.find(c => c.id === this.state.currentChat);
        await this._deliverChatMessage(chat, msgText, tempMsgId);
    },

    /* save a message that is already on screen (id = tempId) to its chat room, then give it the database id */
    /* the database room for a chat on screen (created for a 1:1 chat or the Note when needed) */
    async _ensureChatRoom(chat) {
        if (!chat || !window.conworkSupabase || !window.conworkSupabase.isAvailable()) return null;
        let target = chat.supabaseChannelId || null;
        if (!target) {
            if (chat.id === 'note') target = await window.conworkSupabase.getOrCreatePersonalNoteChannel();
            else if (chat.userId || String(chat.id).startsWith('user-')) target = await window.conworkSupabase.getOrCreateDirectChannel(chat.userId || String(chat.id).replace('user-', ''));
            if (target) chat.supabaseChannelId = target;
        }
        return target;
    },

    async _deliverChatMessage(chat, content, tempId, file) {
        if (!chat || !window.conworkSupabase || !window.conworkSupabase.isAvailable()) return;
        const target = await this._ensureChatRoom(chat);
        const showSendError = (text) => {
            const el = document.getElementById('chat-send-error');
            if (el && this.state.currentChat === chat.id) { el.textContent = text; el.classList.remove('hidden'); }
        };
        if (!target) {
            const local = mockMessages.find(m => m.id === tempId);
            if (local) { delete local.pending; local.failed = true; }
            showSendError('ส่งไม่ได้: ยังเปิดห้องแชทกับคนนี้ไม่ได้ ลองใหม่อีกครั้ง หรือแจ้งผู้ดูแลระบบ');
            this.renderMessages();
            return;
        }
        const saved = await window.conworkSupabase.sendMessage(target, content, { clientId: tempId, file });
        const local = mockMessages.find(m => m.id === tempId);
        if (!local) return; // the realtime echo already matched it and gave it the database id
        delete local.pending;
        if (saved && saved.id) {
            if (mockMessages.some(m => m !== local && m.id === saved.id)) mockMessages.splice(mockMessages.indexOf(local), 1);
            else local.id = saved.id;
        } else {
            local.failed = true;
            showSendError('ส่งข้อความไม่สำเร็จ ลองใหม่อีกครั้ง');
            this.renderMessages();
        }
    },

    /* one incoming message (from the database feed or a room broadcast): add it once, matched by id.
       Our own message coming back is matched to the copy already on screen instead of being added twice. */
    _acceptIncomingMessage(newMsg, chatId, msgType, timeStr) {
        const byId = mockMessages.find(m => (newMsg.id && m.id === newMsg.id) || (newMsg.client_id && m.id === newMsg.client_id));
        if (byId) {
            if (newMsg.id && byId.id !== newMsg.id) { byId.id = newMsg.id; delete byId.pending; }
            return false;
        }
        const myId = this.state.currentUser?.id;
        if (myId && String(newMsg.sender_id) === String(myId)) {
            const mine = mockMessages.find(m => m.pending && m.chatId === chatId &&
                (newMsg.file_url ? m.filePath === newMsg.file_url : m.text === newMsg.content));
            if (mine) { if (newMsg.id) mine.id = newMsg.id; delete mine.pending; return false; }
        }
        mockMessages.push(this._msgFromRow(newMsg, chatId, msgType, timeStr));
        return true;
    },

    /* one database / realtime message row -> a message on screen. A file kept in Storage has file_url (its path). */
    _msgFromRow(row, chatId, msgType, timeStr) {
        const m = {
            id: row.id || row.client_id || 'm-' + Date.now() + Math.random(),
            chatId: chatId,
            senderId: row.sender_id,
            text: row.content,
            type: msgType,
            timestamp: timeStr,
            createdAt: row.created_at || null,
            replyTo: null
        };
        if (row.file_url) {
            m.filePath = row.file_url;
            m.fileName = row.file_name || row.content || 'file';
            m.fileSize = row.file_size || null;
            m.fileType = row.file_type || '';
            m.type = row.message_type === 'image' || /^image\//.test(m.fileType) ? 'image' : 'file';
            m.text = '';
        }
        return m;
    },

    _fmtBytes(n) {
        const b = Number(n) || 0;
        if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
        if (b >= 1024) return Math.round(b / 1024) + ' KB';
        return b ? b + ' B' : '';
    },

    handleAttachment(event) {
        const file = event.target.files[0];
        if (!file || !this.state.currentChat) return;

        if (file.size > 10 * 1024 * 1024) {
            if (typeof this._showToast === 'function') this._showToast('ขนาดไฟล์ต้องไม่เกิน 10MB', 'error');
            else alert('ขนาดไฟล์ต้องไม่เกิน 10MB');
            event.target.value = '';
            return;
        }

        const isImage = file.type.startsWith('image/');

        const processAndSend = async (dataUrl, msgType, blob) => {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const timeStr = `${day}/${month}/${year} ${hours}:${minutes}`;

            const tempMsgId = 'm' + Date.now();
            const chat = mockChats.find(c => c.id === this.state.currentChat);

            mockMessages.push({
                id: tempMsgId,
                pending: true,
                chatId: this.state.currentChat,
                senderId: this.state.currentUser?.id,
                text: dataUrl, // shown right away; replaced by the stored file's link once uploaded
                type: msgType,
                fileName: file.name,
                fileSize: blob ? blob.size : file.size,
                fileType: blob ? blob.type : file.type,
                timestamp: timeStr,
                createdAt: now.toISOString(),
                replyTo: this.state.replyingToMsgId || null
            });
            this.cancelReply();
            this.renderMessages();
            this.renderChatList();
            this._saveData();

            /* kept for good in Storage when the chat database is ready; otherwise the file travels inside the message as before */
            const sb = window.conworkSupabase;
            if (sb && sb.isAvailable() && blob && await sb.chatFilesReady()) {
                const roomId = await this._ensureChatRoom(chat);
                const companyId = (chat && chat.companyId) || (/^[0-9a-f-]{36}$/i.test(String(this.state.currentUser?.workspaceId || '')) ? this.state.currentUser.workspaceId : null);
                const path = roomId ? await sb.uploadChatFile(companyId, roomId, blob, file.name) : null;
                if (path) {
                    const local = mockMessages.find(m => m.id === tempMsgId);
                    if (local) Object.assign(local, { filePath: path });
                    await this._deliverChatMessage(chat, file.name, tempMsgId, { path, name: file.name, size: blob.size, type: blob.type || file.type, messageType: msgType });
                    return;
                }
            }
            this._deliverChatMessage(chat, dataUrl, tempMsgId);
        };

        if (isImage) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxDim = 800;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > maxDim) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        }
                    } else {
                        if (height > maxDim) {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    canvas.toBlob(b => processAndSend(compressedDataUrl, 'image', b), 'image/jpeg', 0.85);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                processAndSend(e.target.result, 'file', file);
            };
            reader.readAsDataURL(file);
        }

        event.target.value = '';
    },

    createEvent() {
        const title = prompt('กรอกชื่อกิจกรรมใหม่ : ');
        if (!title) return;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        mockEvents.push({
            id: 'e' + Date.now(),
            title: title,
            date: dateStr,
            type: 'manual',
            time: ''
        });
        this.renderCalendar();
        this._showToast(`เพิ่มกิจกรรม "${title}" เรียบร้อยแล้ว`, 'success');
    },

    addEmployee() {
        alert("ระบบเพิ่มพนักงานกำลังอยู่ในระหว่างการพัฒนา!");
    },

    quickSearch(inputElement, event) {
        if (event && event.key !== 'Enter') return;
        if (inputElement.value.trim()) {
            alert("กำลังค้นหา : " + inputElement.value);
            inputElement.value = '';
        }
    },

    // --- Rich Text Editor ---

    _richTextSavedRanges: {},

    _richTextToolbarMap: {
        'ct-desc': 'ct-format-toolbar',
        'sd-desc': 'sd-format-toolbar'
    },

    _getRichTextEditor(editorId = 'ct-desc') {
        return document.getElementById(editorId);
    },

    saveRichTextSelection(editorId = 'ct-desc') {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        const editor = this._getRichTextEditor(editorId);
        if (!editor || !editor.contains(range.commonAncestorContainer)) return;
        this._richTextSavedRanges[editorId] = range.cloneRange();
    },

    _restoreRichTextSelection(editor, editorId) {
        const saved = this._richTextSavedRanges[editorId];
        if (!saved || !editor) return false;
        try {
            if (!editor.contains(saved.commonAncestorContainer)) return false;
            const sel = window.getSelection();
            if (!sel) return false;
            sel.removeAllRanges();
            sel.addRange(saved);
            return true;
        } catch (_) {
            return false;
        }
    },

    _getActiveEditorRange(editor, editorId) {
        editor.focus();
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const live = sel.getRangeAt(0);
            if (editor.contains(live.commonAncestorContainer)) return live;
        }
        this._restoreRichTextSelection(editor, editorId);
        if (sel && sel.rangeCount > 0) {
            const restored = sel.getRangeAt(0);
            if (editor.contains(restored.commonAncestorContainer)) return restored;
        }
        const fallback = document.createRange();
        fallback.selectNodeContents(editor);
        fallback.collapse(false);
        sel.removeAllRanges();
        sel.addRange(fallback);
        this._richTextSavedRanges[editorId] = fallback.cloneRange();
        return fallback;
    },

    _selectRange(range, editorId) {
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(range);
        this._richTextSavedRanges[editorId] = range.cloneRange();
    },

    _findFormatAncestor(node, tags, editor) {
        let current = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        while (current && current !== editor) {
            if (tags.includes(current.tagName)) return current;
            current = current.parentElement;
        }
        return null;
    },

    _unwrapElement(el) {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
    },

    _wrapRangeWithTag(range, tagName, editorId) {
        const contents = range.extractContents();
        const wrapper = document.createElement(tagName);
        wrapper.appendChild(contents);
        range.insertNode(wrapper);
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        this._selectRange(newRange, editorId);
    },

    _getAlignmentTarget(editor, range) {
        let node = range.commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

        let walk = node;
        while (walk && walk !== editor) {
            if (walk.classList?.contains('rt-align-block') || walk.style?.textAlign) return walk;
            walk = walk.parentElement;
        }

        walk = node;
        while (walk && walk.parentElement && walk.parentElement !== editor) {
            walk = walk.parentElement;
        }
        if (walk && walk.parentElement === editor && walk.tagName === 'DIV') return walk;

        return editor;
    },

    _getBlockAlignment(editor, range) {
        const target = this._getAlignmentTarget(editor, range);
        const align = target.style?.textAlign || editor.style.textAlign || '';
        return align || 'left';
    },

    _isInlineOnlyContent(editor) {
        const inlineTags = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'A', 'BR']);
        return Array.from(editor.childNodes).every(child =>
            child.nodeType === Node.TEXT_NODE ||
            (child.nodeType === Node.ELEMENT_NODE && inlineTags.has(child.tagName))
        );
    },

    _ensureAlignBlock(editor, range) {
        const existing = editor.querySelector(':scope > .rt-align-block');
        if (existing) return existing;

        if (this._isInlineOnlyContent(editor) && editor.textContent.length > 0) {
            const block = document.createElement('div');
            block.className = 'rt-align-block';
            while (editor.firstChild) block.appendChild(editor.firstChild);
            editor.appendChild(block);
            const sel = window.getSelection();
            if (sel) {
                const newRange = document.createRange();
                newRange.selectNodeContents(block);
                newRange.collapse(false);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
            return block;
        }

        return this._getAlignmentTarget(editor, range);
    },

    _stripAlignWrappers(editor) {
        editor.style.textAlign = '';
        editor.querySelectorAll('.rt-align-block').forEach(block => {
            block.style.textAlign = '';
            this._unwrapElement(block);
        });
        editor.querySelectorAll('div[style*="text-align"]').forEach(div => {
            div.style.textAlign = '';
        });
    },

    _setBlockAlignment(editor, range, align) {
        if (align === 'left') {
            this._stripAlignWrappers(editor);
            return;
        }

        const block = this._ensureAlignBlock(editor, range);
        block.style.textAlign = align;
        if (block === editor) {
            editor.style.textAlign = align;
        }
    },

    _isFormatActive(command, editor) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || !editor) return false;
        const range = sel.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return false;

        if (command.startsWith('align-')) {
            const alignValue = { 'align-left': 'left', 'align-center': 'center', 'align-right': 'right' }[command];
            return this._getBlockAlignment(editor, range) === alignValue;
        }

        const execMap = {
            bold: 'bold',
            italic: 'italic',
            underline: 'underline',
            ul: 'insertUnorderedList',
            ol: 'insertOrderedList'
        };
        const execCmd = execMap[command];
        if (!execCmd) return false;

        try {
            if (document.queryCommandState(execCmd)) return true;
        } catch (_) { /* ignore */ }

        if (command === 'bold') {
            return !!this._findFormatAncestor(range.commonAncestorContainer, ['B', 'STRONG'], editor);
        }
        if (command === 'italic') {
            return !!this._findFormatAncestor(range.commonAncestorContainer, ['I', 'EM'], editor);
        }
        if (command === 'underline') {
            return !!this._findFormatAncestor(range.commonAncestorContainer, ['U'], editor);
        }
        return false;
    },

    _toggleInlineFormat(editor, command, editorId) {
        const range = this._getActiveEditorRange(editor, editorId);
        if (!range) return false;

        const tagMap = { bold: 'b', italic: 'i', underline: 'u' };
        const wrapperTag = tagMap[command];
        if (!wrapperTag) return false;

        if (this._isFormatActive(command, editor)) {
            document.execCommand(command, false, null);
            return true;
        }

        if (!range.collapsed) {
            this._wrapRangeWithTag(range, wrapperTag, editorId);
            return true;
        }

        document.execCommand(command, false, null);
        return true;
    },

    _toggleBlockAlignment(editor, command, editorId) {
        const range = this._getActiveEditorRange(editor, editorId);
        if (!range) return false;

        const alignMap = {
            'align-left': 'left',
            'align-center': 'center',
            'align-right': 'right'
        };
        const align = alignMap[command];
        if (!align) return false;

        const currentAlign = this._getBlockAlignment(editor, range);

        if (align === 'left') {
            this._setBlockAlignment(editor, range, 'left');
            return true;
        }

        if (currentAlign === align) {
            this._setBlockAlignment(editor, range, 'left');
            return true;
        }

        this._setBlockAlignment(editor, range, align);
        return true;
    },

    _updateFormatToolbar(toolbarId, editor, editorId) {
        const toolbar = document.getElementById(toolbarId);
        if (!toolbar || !editor) return;

        toolbar.querySelectorAll('[data-format]').forEach(btn => {
            const cmd = btn.getAttribute('data-format');
            const isActive = cmd && cmd !== 'link' ? this._isFormatActive(cmd, editor) : false;
            btn.classList.toggle('is-active', isActive);
        });
    },

    _bindRichTextEditor(editorId, toolbarId) {
        const editor = this._getRichTextEditor(editorId);
        if (!editor || editor.hasAttribute('data-rich-text-bound')) return;
        editor.setAttribute('data-rich-text-bound', 'true');

        const refresh = () => {
            this.saveRichTextSelection(editorId);
            this._updateFormatToolbar(toolbarId, editor, editorId);
        };

        ['mouseup', 'keyup', 'focus'].forEach(evt => editor.addEventListener(evt, refresh));

        document.addEventListener('selectionchange', () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (editor.contains(range.commonAncestorContainer)) {
                this._richTextSavedRanges[editorId] = range.cloneRange();
                this._updateFormatToolbar(toolbarId, editor, editorId);
            }
        });

        const toolbar = document.getElementById(toolbarId);
        if (toolbar) {
            toolbar.addEventListener('mousedown', () => {
                this.saveRichTextSelection(editorId);
            }, true);

            toolbar.querySelectorAll('[data-format]').forEach(btn => {
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    this.saveRichTextSelection(editorId);
                    const cmd = btn.getAttribute('data-format');
                    if (cmd) this.formatText(cmd, editorId);
                });
            });
        }
    },

    _initRichTextEditor() {
        this._bindRichTextEditor('ct-desc', 'ct-format-toolbar');
        this._bindRichTextEditor('sd-desc', 'sd-format-toolbar');
        this._bindRichTextEditor('cev-note', 'cev-format-toolbar');
    },

    formatText(command, editorId = 'ct-desc') {
        const editor = this._getRichTextEditor(editorId);
        const toolbarId = this._richTextToolbarMap[editorId];
        if (!editor || editor.getAttribute('contenteditable') === 'false') return;

        if (command === 'link') {
            const url = prompt('ใส่ URL ที่ต้องการ : ');
            if (!url) return;
            this._getActiveEditorRange(editor, editorId);
            document.execCommand('createLink', false, url);
        } else if (['bold', 'italic', 'underline'].includes(command)) {
            this._toggleInlineFormat(editor, command, editorId);
        } else if (['align-left', 'align-center', 'align-right'].includes(command)) {
            this._toggleBlockAlignment(editor, command, editorId);
        } else if (command === 'ul' || command === 'ol') {
            this._getActiveEditorRange(editor, editorId);
            const execCmd = command === 'ul' ? 'insertUnorderedList' : 'insertOrderedList';
            document.execCommand(execCmd, false, null);
        }

        this.saveRichTextSelection(editorId);
        this._updateFormatToolbar(toolbarId, editor, editorId);
    },

    // --- File Upload Logic ---

    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;

        if (!this.state.ctFiles) {
            this.state.ctFiles = [];
        }

        files.forEach(file => {
            const isImage = file.type.startsWith('image/');
            const reader = new FileReader();
            reader.onload = (e) => {
                this.state.ctFiles.push({
                    name: file.name,
                    size: (file.size / 1024).toFixed(1) + ' KB',
                    type: isImage ? 'image' : 'file',
                    url: e.target.result
                });
                this.renderTaskFiles();
            };
            reader.readAsDataURL(file);
        });

        event.target.value = '';
    },

    removeTaskFile(index) {
        if (this.state.ctFiles && this.state.ctFiles.length > index) {
            this.state.ctFiles.splice(index, 1);
            this.renderTaskFiles();
        }
    },

    renderTaskFiles() {
        const container = document.getElementById('ct-file-list');
        if (!container) return;

        if (!this.state.ctFiles || this.state.ctFiles.length === 0) {
            container.innerHTML = '';
            return;
        }

        const isReadOnly = this.state.currentTaskModalIsReadOnly;

        container.innerHTML = this.state.ctFiles.map((file, idx) => {
            const fileUrl = file.url || '#';
            const icon = file.type === 'image' ? '<i class="fa-regular fa-image text-blue-500 text-lg"></i>' : '<i class="fa-solid fa-file-lines text-lg text-gray-500"></i>';
            return `
            <div class="flex items-center justify-between bg-white border border-gray-100 rounded-xl p-2.5 text-sm shadow-sm hover:shadow-md transition-shadow group">
                <a href="${fileUrl}" download="${file.name}" data-no-i18n target="_blank" class="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer hover:opacity-80 transition-opacity" title="คลิกเพื่อดาวน์โหลด/เปิดไฟล์">
                    <div class="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-200">
                        ${icon}
                    </div>
                    <div class="flex flex-col truncate min-w-0">
                        <span class="truncate text-blue-600 font-semibold text-xs hover:underline" data-no-i18n>${file.name}</span>
                        <span class="text-[10px] text-gray-400 mt-0.5">${file.size}</span>
                    </div>
                </a>
                <div class="flex items-center gap-1 shrink-0 ml-2">
                    <a href="${fileUrl}" download="${file.name}" data-no-i18n target="_blank" class="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="ดาวน์โหลด">
                        <i class="fa-solid fa-download"></i>
                    </a>
                    ${!isReadOnly ? `
                    <button type="button" class="text-gray-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100" onclick="App.removeTaskFile(${idx})" title="ลบไฟล์">
                        <i class="fa-solid fa-trash text-sm"></i>
                    </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');
    },

    // --- Subtasks Logic ---
    addSubtask() {
        const input = document.getElementById('ct-subtask-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        if (!this.state.ctSubtasks) {
            this.state.ctSubtasks = [];
        }

        this.state.ctSubtasks.push({
            text: text,
            done: false
        });

        input.value = '';
        this.renderSubtasks();
    },

    toggleSubtask(index) {
        if (this.state.ctSubtasks && this.state.ctSubtasks[index]) {
            this.state.ctSubtasks[index].done = !this.state.ctSubtasks[index].done;
            this.renderSubtasks();

            // If editing an existing task, immediately update the underlying task and save
            if (this.state.editingTaskId) {
                const task = mockTasks.find(t => t.id === this.state.editingTaskId);
                if (task && task.subtasks && task.subtasks[index]) {
                    task.subtasks[index].done = this.state.ctSubtasks[index].done;
                    this._saveData();
                    this._syncSubtasksToDB(task.id, task.subtasks);
                    this.renderTasks();
                }
            }
        }
    },

    askDeleteSubtask(index) {
        if (this.state.ctSubtasks && this.state.ctSubtasks.length > index) {
            this.state.subtaskToDelete = index;
            const text = this.state.ctSubtasks[index].text;
            document.getElementById('delete-subtask-name').textContent = text || 'ไม่มีชื่อ';
            document.getElementById('confirm-delete-subtask-modal').classList.remove('hidden');
        }
    },

    cancelDeleteSubtask() {
        this.state.subtaskToDelete = null;
        document.getElementById('confirm-delete-subtask-modal').classList.add('hidden');
    },

    confirmDeleteSubtask() {
        if (this.state.subtaskToDelete !== null) {
            this.state.ctSubtasks.splice(this.state.subtaskToDelete, 1);
            this.renderSubtasks();
            this.cancelDeleteSubtask();
        }
    },

    renderSubtasks() {
        const container = document.getElementById('ct-subtasks-list');
        if (!container) return;

        if (!this.state.ctSubtasks || this.state.ctSubtasks.length === 0) {
            container.innerHTML = '';
            return;
        }

        const task = mockTasks.find(t => t.id === this.state.editingTaskId);
        const isDone = task ? task.status === 'done' : false;
        const isAssignee = this.state.currentUser && this.state.ctAssignees && this.state.ctAssignees.includes(this.state.currentUser.id);
        const isSubtaskDisabled = this.state.currentTaskModalIsReadOnly ? (!isAssignee || isDone) : false;

        container.innerHTML = this.state.ctSubtasks.map((st, idx) => `
            <div class="flex items-center justify-between group p-1.5 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-100 transition-colors">
                <label class="flex items-center gap-3 ${isSubtaskDisabled ? 'cursor-default' : 'cursor-pointer'} flex-1 min-w-0">
                    <input type="checkbox" ${st.done ? 'checked' : ''} onchange="App.toggleSubtask(${idx})"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 shrink-0 mt-0.5 ${isSubtaskDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}" ${isSubtaskDisabled ? 'disabled' : ''}>
                    <span class="text-sm truncate ${st.done ? 'text-gray-400 line-through' : 'text-gray-700'}" data-no-i18n>${st.text}</span>
                </label>
                ${!this.state.currentTaskModalIsReadOnly ? `
                <button type="button" class="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity" onclick="App.askDeleteSubtask(${idx})">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                ` : ''}
            </div>
            </div>
        `).join('');
    },

    // --- Invite Company Modal Logic ---
    openInviteModal() {
        const modal = document.getElementById('invite-company-modal');
        if (!modal) return;
        
        const companyId = this.state.currentUser?.workspaceId || 'W-1';
        const inviteLink = `${window.location.origin}${window.location.pathname}?code=${companyId}`;
        
        const qrImg = document.getElementById('invite-qr-code');
        if (qrImg) {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(inviteLink)}`;
        }
        
        const linkInput = document.getElementById('invite-link-input');
        if (linkInput) {
            linkInput.value = inviteLink;
        }
        
        modal.classList.remove('hidden');
    },

    closeInviteModal() {
        const modal = document.getElementById('invite-company-modal');
        if (modal) modal.classList.add('hidden');
    },

    copyInviteLink() {
        const linkInput = document.getElementById('invite-link-input');
        if (linkInput && linkInput.value) {
            navigator.clipboard.writeText(linkInput.value).then(() => {
                this._showToast('คัดลอกลิงก์เชิญเรียบร้อยแล้ว', 'success');
            }).catch(err => {
                console.error('Failed to copy: ', err);
                this._showToast('ไม่สามารถคัดลอกลิงก์ได้', 'error');
            });
        }
    },

    // --- Add Member Modal Logic (Now redirects to Add Member View) ---
    openAddMemberModal() {
        this.switchView('add-member');

        // Reset state and texts for Add mode
        this.state.editingMemberId = null;
        const title = document.getElementById('am-view-title');
        const subtitle = document.getElementById('am-view-subtitle');
        const submitBtn = document.getElementById('am-submit-btn');
        if (title) title.textContent = 'เพิ่มพนักงานใหม่';
        if (subtitle) subtitle.textContent = 'สร้างบัญชีพนักงานและเพิ่มเข้าบริษัท';
        if (submitBtn) submitBtn.textContent = 'บันทึกและเพิ่มพนักงาน';

        // Clear all form inputs
        ['am-firstname', 'am-lastname', 'am-email', 'am-phone', 'am-password'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['am-role', 'am-dept'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        // Reset avatar preview
        const input = document.getElementById('am-avatar-input');
        const preview = document.getElementById('am-avatar-preview');
        const placeholder = document.getElementById('am-avatar-placeholder');
        const summaryImg = document.getElementById('am-summary-avatar-img');
        const summaryIcon = document.getElementById('am-summary-avatar-icon');

        if (input) input.value = '';
        if (preview && placeholder) {
            preview.classList.add('hidden');
            preview.src = '';
            placeholder.classList.remove('hidden');
        }
        if (summaryImg && summaryIcon) {
            summaryImg.classList.add('hidden');
            summaryImg.src = '';
            summaryIcon.classList.remove('hidden');
        }
        // Populate departments
        const deptList = document.getElementById('am-dept');
        const deptContainer = document.getElementById('dept-list-container');
        if (deptList && deptContainer) {
            deptList.innerHTML = '<option value="" disabled selected>เลือกแผนก</option>';
            deptContainer.querySelectorAll('.dept-item span:not(.text-xs)').forEach(span => {
                const name = span.textContent.trim();
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                deptList.appendChild(option);
            });
        }

        // Populate roles (positions)
        const roleList = document.getElementById('am-role');
        const posContainer = document.getElementById('position-list-container');
        if (roleList && posContainer) {
            roleList.innerHTML = '<option value="" disabled selected>เลือกตำแหน่ง</option>';
            posContainer.querySelectorAll('.position-item span').forEach(span => {
                const name = span.textContent.trim();
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                roleList.appendChild(option);
            });
        }

        const roleInput = document.getElementById('am-role');
        if (roleInput) {

            // Bind change event to update custom permissions based on role default
            if (!roleInput.hasAttribute('data-bound')) {
                roleInput.addEventListener('change', (e) => {
                    this.renderCustomPermissionsChecklist(e.target.value);
                });
                roleInput.setAttribute('data-bound', 'true');
            }
        }

        // Bind realtime updates to summary card
        if (!this._amRealtimeBound) {
            const bindInput = (id, targetId, formatter) => {
                const el = document.getElementById(id);
                const target = document.getElementById(targetId);
                if (el && target) {
                    const update = () => {
                        target.textContent = formatter ? formatter() : (el.value.trim() || '-');
                    };
                    el.addEventListener('input', update);
                    el.addEventListener('change', (e) => {
                        update();
                        if (App && App.autoSaveEmployee) App.autoSaveEmployee();
                    });
                }
            };

            const updateName = () => {
                const fname = (document.getElementById('am-firstname')?.value || '').trim();
                const lname = (document.getElementById('am-lastname')?.value || '').trim();
                if (fname || lname) return `${fname} ${lname}`.trim();
                return '-';
            };

            bindInput('am-firstname', 'sum-name', updateName);
            bindInput('am-lastname', 'sum-name', updateName);
            bindInput('am-role', 'sum-role');
            bindInput('am-dept', 'sum-dept');
            bindInput('am-email', 'sum-email');
            bindInput('am-phone', 'sum-phone');

            this._amRealtimeBound = true;
        }

        // Reset summary text on open
        ['sum-name', 'sum-role', 'sum-dept', 'sum-email', 'sum-phone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });

        this.renderCustomPermissionsChecklist('');
    },

    renderCustomPermissionsChecklist(role) {
        const container = document.getElementById('am-custom-permissions');
        if (!container) return;

        if (!this.permissionsState) {
            const data = localStorage.getItem('conwork_role_settings');
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.permissionsState) this.permissionsState = parsed.permissionsState;
                } catch (e) { }
            }
        }

        const sections = [
            {
                name: 'โปรเจกต์',
                icon: 'fa-diagram-project',
                color: 'text-purple-600',
                bg: 'bg-purple-100',
                features: ['สร้างโปรเจกต์', 'แก้ไขโปรเจกต์', 'ลบโปรเจกต์']
            },
            {
                name: 'งาน ( Task )',
                icon: 'fa-list-check',
                color: 'text-blue-600',
                bg: 'bg-blue-100',
                features: ['ดูงานทั้งหมด', 'สร้างหัวข้องาน', 'มอบหมายงาน', 'แก้ไขงาน', 'ลบงาน', 'ตรวจงาน']
            },
            {
                name: 'พนักงาน',
                icon: 'fa-user',
                color: 'text-green-600',
                bg: 'bg-green-100',
                features: ['เพิ่มพนักงาน', 'แก้ไขพนักงาน', 'ลบพนักงาน', 'รีเซ็ตรหัสผ่าน']
            }
        ];

        let html = '';
        sections.forEach(section => {
            html += `
                <div class="mt-4 first:mt-0">
                    <div class="font-bold flex items-center gap-2 mb-2 ${section.color}">
                        <div class="w-6 h-6 rounded ${section.bg} flex items-center justify-center shrink-0">
                            <i class="fa-solid ${section.icon} text-[10px]"></i>
                        </div>
                        ${section.name}
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
            `;

            section.features.forEach(feature => {
                let isChecked = false;

                // Determine default internal role based on string
                let internalRole = 'worker';
                const roleStr = (role || '').toLowerCase();
                if (roleStr.includes('admin') || roleStr.includes('แอดมิน')) {
                    internalRole = 'admin';
                } else if (roleStr.includes('ceo') || roleStr.includes('ประธาน') || roleStr.includes('ผู้บริหาร')) {
                    internalRole = 'reviewer2';
                } else if (roleStr.includes('หัวหน้า') || roleStr.includes('manager') || roleStr.includes('ผู้อำนวยการ')) {
                    internalRole = 'reviewer1';
                }

                // 1. Super Admin Bypass (Always checked by default)
                if (internalRole === 'admin' || internalRole === 'reviewer2') {
                    isChecked = true;
                } else {
                    // 2. Check explicit permission state from admin settings
                    if (role && this.permissionsState && this.permissionsState[feature] && this.permissionsState[feature][role]) {
                        isChecked = true;
                    } else {
                        // 3. Fallback default permissions
                        if (internalRole === 'reviewer1') {
                            const headPerms = ['สร้างโปรเจกต์', 'แก้ไขโปรเจกต์', 'ลบโปรเจกต์', 'สร้างหัวข้องาน', 'แก้ไขงาน', 'ลบงาน', 'ดูงานทั้งหมด', 'เพิ่มพนักงาน', 'แก้ไขพนักงาน', 'มอบหมายงาน'];
                            if (headPerms.includes(feature)) isChecked = true;
                        } else if (internalRole === 'worker') {
                            const workerPerms = ['ดูงานทั้งหมด'];
                            if (workerPerms.includes(feature)) isChecked = true;
                        }
                    }
                }

                // If editing a specific user, use their customized permissions if set
                if (this.state.editingMemberId) {
                    const user = mockUsers.find(u => u.id == this.state.editingMemberId);
                    const isSameRole = user && user.jobTitle === role;

                    if (isSameRole && user && user.customPermissions && typeof user.customPermissions[feature] === 'boolean') {
                        isChecked = user.customPermissions[feature];
                    }
                }

                html += `
                    <label class="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1.5 rounded-lg transition-colors border border-transparent hover:border-gray-200">
                        <input type="checkbox" class="am-perm-cb w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" value="${feature}" ${isChecked ? 'checked' : ''}>
                        <span class="text-sm text-gray-700">${feature}</span>
                    </label>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        container.className = "flex flex-col gap-1 bg-gray-50 p-4 rounded-xl border border-gray-100";
        container.innerHTML = html;

        // Bind auto-save to checkboxes
        const checkboxes = container.querySelectorAll('.am-perm-cb');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (App && App.autoSaveEmployee) App.autoSaveEmployee();
            });
        });
    },

    autoSaveEmployee() {
        if (!this.state.editingMemberId) return;
        const user = mockUsers.find(u => u.id == this.state.editingMemberId);
        if (!user) return;

        const email = document.getElementById('am-email')?.value.trim();
        const dept = document.getElementById('am-dept')?.value.trim();
        const role = document.getElementById('am-role')?.value || '';
        const phone = document.getElementById('am-phone')?.value.trim();
        
        let internalRole = 'worker';
        const roleStr = role.toLowerCase();
        if (roleStr.includes('admin') || roleStr.includes('แอดมิน')) {
            internalRole = 'admin';
        } else if (roleStr.includes('ceo') || roleStr.includes('ประธาน') || roleStr.includes('ผู้บริหาร')) {
            internalRole = 'reviewer2';
        } else if (roleStr.includes('หัวหน้า') || roleStr.includes('manager') || roleStr.includes('ผู้อำนวยการ')) {
            internalRole = 'reviewer1';
        }

        const fname = document.getElementById('am-firstname')?.value.trim() || '';
        const lname = document.getElementById('am-lastname')?.value.trim() || '';
        const namePart = email ? email.split('@')[0] : '';
        const fullName = (fname || lname) ? `${fname} ${lname}`.trim() : (namePart.charAt(0).toUpperCase() + namePart.slice(1));

        const customPermissions = {};
        document.querySelectorAll('.am-perm-cb').forEach(cb => {
            customPermissions[cb.value] = cb.checked;
        });

        if (email) user.email = email;
        if (fullName) user.name = fullName;
        if (phone) user.phone = phone;

        if (this.hasPermission('แก้ไขพนักงาน')) {
            if (dept) {
                user.department = dept;
                // Auto-save new department to settings if it doesn't exist
                const deptContainer = document.getElementById('dept-list-container');
                if (deptContainer) {
                    const existingDepts = Array.from(deptContainer.querySelectorAll('.dept-item span:not(.text-xs)')).map(el => el.textContent.trim());
                    if (!existingDepts.includes(dept)) {
                        let tempInput = document.getElementById('new-dept-input');
                        if (tempInput) {
                            const oldVal = tempInput.value;
                            tempInput.value = dept;
                            this.addRoleDepartment();
                            tempInput.value = oldVal;
                        }
                    }
                }
            }
            if (role) {
                user.role = internalRole;
                user.jobTitle = role;
                // Auto-save new position to settings if it doesn't exist
                const posContainer = document.getElementById('position-list-container');
                if (posContainer) {
                    const existingPos = Array.from(posContainer.querySelectorAll('.position-item span')).map(el => el.textContent.trim());
                    if (!existingPos.includes(role)) {
                        let tempInput = document.getElementById('new-position-input');
                        if (tempInput) {
                            const oldVal = tempInput.value;
                            tempInput.value = role;
                            this.addRolePosition();
                            tempInput.value = oldVal;
                            
                            // Also update the datalist options so it appears immediately
                            const roleList = document.getElementById('role-options');
                            if (roleList) {
                                const option = document.createElement('option');
                                option.value = role;
                                roleList.appendChild(option);
                            }
                        }
                    }
                }
            }
            user.customPermissions = customPermissions;
        }

        this._saveData();
    },

    closeAddMemberModal() {
        const modal = document.getElementById('add-member-modal');
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('hidden');
        } else if (this.state.currentView === 'add-member') {
            this.switchView('team');
        }
    },

    handleAvatarUpload(input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];

            if (file.size > 5 * 1024 * 1024) {
                App._showToast('ขนาดไฟล์เกิน 5MB', 'error');
                input.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const maxDim = 300;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) {
                        if (width > maxDim) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        }
                    } else {
                        if (height > maxDim) {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);

                    const preview = document.getElementById('am-avatar-preview');
                    const placeholder = document.getElementById('am-avatar-placeholder');
                    const summaryImg = document.getElementById('am-summary-avatar-img');
                    const summaryIcon = document.getElementById('am-summary-avatar-icon');

                    if (preview && placeholder) {
                        preview.src = compressedDataUrl;
                        preview.classList.remove('hidden');
                        placeholder.classList.add('hidden');
                    }

                    if (summaryImg && summaryIcon) {
                        summaryImg.src = compressedDataUrl;
                        summaryImg.classList.remove('hidden');
                        summaryIcon.classList.add('hidden');
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    },

    submitAddMemberForm() {
        const isManager = this.state.currentUser && ['admin', 'reviewer2', 'reviewer1', 'manager', 'supervisor'].includes(this.state.currentUser.role);
        const isEditingSelf = this.state.editingMemberId == this.state.currentUser.id;

        if (this.state.editingMemberId) {
            if (!this.hasPermission('แก้ไขพนักงาน') && !isEditingSelf) {
                if (typeof this._showToast === 'function') this._showToast('คุณไม่มีสิทธิ์แก้ไขพนักงาน', 'error');
                return;
            }
        } else {
            if (!this.hasPermission('เพิ่มพนักงาน')) {
                if (typeof this._showToast === 'function') this._showToast('คุณไม่มีสิทธิ์เพิ่มพนักงาน', 'error');
                return;
            }
        }
        const email = document.getElementById('am-email').value.trim();
        const dept = document.getElementById('am-dept').value.trim();
        const roleSelect = document.getElementById('am-role');
        const role = roleSelect ? roleSelect.value : '';

        if (!email || !dept || !role) {
            if (typeof this._showToast === 'function') {
                this._showToast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
            } else {
                alert('กรุณากรอกข้อมูลให้ครบถ้วน');
            }
            return;
        }

        // Auto-save new department if it doesn't exist
        const deptContainer = document.getElementById('dept-list-container');
        if (deptContainer) {
            const existingDepts = Array.from(deptContainer.querySelectorAll('.dept-item span')).map(el => el.textContent.trim());
            if (!existingDepts.includes(dept)) {
                let tempInput = document.getElementById('new-dept-input');
                if (tempInput) {
                    const oldVal = tempInput.value;
                    tempInput.value = dept;
                    this.addRoleDepartment();
                    tempInput.value = oldVal;
                }
            }
        }

        // Auto-save new position if it doesn't exist
        const posContainer = document.getElementById('position-list-container');
        if (posContainer) {
            const existingPos = Array.from(posContainer.querySelectorAll('.position-item span')).map(el => el.textContent.trim());
            if (!existingPos.includes(role)) {
                let tempInput = document.getElementById('new-position-input');
                if (tempInput) {
                    const oldVal = tempInput.value;
                    tempInput.value = role;
                    this.addRolePosition();
                    tempInput.value = oldVal;
                }
            }
        }

        // Map Thai job title back to internal role
        let internalRole = 'worker';
        const roleStr = role.toLowerCase();
        if (roleStr.includes('admin') || roleStr.includes('แอดมิน')) {
            internalRole = 'admin';
        } else if (roleStr.includes('ceo') || roleStr.includes('ประธาน') || roleStr.includes('ผู้บริหาร')) {
            internalRole = 'reviewer2';
        } else if (roleStr.includes('หัวหน้า') || roleStr.includes('manager') || roleStr.includes('ผู้อำนวยการ')) {
            internalRole = 'reviewer1';
        }

        const namePart = email.split('@')[0];
        const newName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

        const fname = document.getElementById('am-firstname')?.value.trim();
        const lname = document.getElementById('am-lastname')?.value.trim();
        const fullName = (fname || lname) ? `${fname} ${lname}`.trim() : newName;

        // Read custom permissions
        const customPermissions = {};
        document.querySelectorAll('.am-perm-cb').forEach(cb => {
            customPermissions[cb.value] = cb.checked;
        });

        const preview = document.getElementById('am-avatar-preview');
        let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`;
        if (preview && !preview.classList.contains('hidden') && preview.src && !preview.src.includes('about:blank')) {
            avatarUrl = preview.src;
        }

        const passwordField = document.getElementById('am-password');
        const passwordValue = passwordField ? passwordField.value : '';

        const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\[\]{}|;:'",.<>/?`~\\-]).{8,}$/;

        if (this.state.editingMemberId) {
            // EDIT EXISTING USER
            const user = mockUsers.find(u => u.id == this.state.editingMemberId);
            if (user) {
                user.email = email;
                user.name = fullName;

                // Update password if provided
                if (passwordValue.trim() !== '') {
                    if (!pwRegex.test(passwordValue)) {
                        if (typeof this._showToast === 'function') this._showToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร, พิมพ์ใหญ่, พิมพ์เล็ก, ตัวเลข และอักขระพิเศษ', 'error');
                        else alert('รหัสผ่านไม่ถูกต้อง');
                        return;
                    }
                    user.password = passwordValue;
                }

                // Only update work info if the user has permission
                if (this.hasPermission('แก้ไขพนักงาน')) {
                    user.department = dept;
                    user.role = internalRole;
                    user.jobTitle = role; // Use dropdown value as job title as well
                    user.customPermissions = customPermissions;
                }

                // Only update avatar if a new one was uploaded, otherwise keep existing
                if (preview && !preview.classList.contains('hidden') && preview.src && !preview.src.includes('about:blank')) {
                    user.avatar = preview.src;
                }

                const phone = document.getElementById('am-phone')?.value.trim();
                if (phone) user.phone = phone;

                if (typeof this._showToast === 'function') {
                    this._showToast('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว', 'success');
                } else {
                    alert('บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว');
                }

                // If the user edited themselves, sync current state and sidebar
                if (this.state.currentUser && String(user.id) === String(this.state.currentUser.id)) {
                    this.state.currentUser.name = user.name;
                    this.state.currentUser.avatar = user.avatar;
                    this.state.currentUser.department = user.department;
                    this.state.currentUser.role = user.role;
                }

                mockChats.forEach(c => {
                    if (String(c.userId) === String(user.id) || c.id === 'user-' + user.id) {
                        c.name = user.name;
                        if (user.avatar) c.avatar = user.avatar;
                        if (user.department) c.subtitle = `${user.department} (${user.role === 'admin' ? 'แอดมิน' : user.role === 'reviewer2' ? 'ผู้บริหาร' : user.role === 'reviewer1' ? 'ผู้จัดการ' : 'พนักงาน'})`;
                    }
                });

                if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
                    window.conworkSupabase.updateUserProfile({
                        userId: user.id,
                        fullName: user.name,
                        avatarUrl: user.avatar,
                        department: user.department,
                        role: user.role,
                        jobTitle: user.jobTitle
                    });
                }
                this._saveData();
                this.updateProfile();
                this.renderChatList();
                this.renderTeam();
                this.renderMessages();
                try {
                    localStorage.setItem('conwork_chats', JSON.stringify(mockChats));
                } catch (e) {}
            }
            this.state.editingMemberId = null;
        } else {
            // ADD NEW USER
            const finalPassword = passwordValue.trim();
            if (!finalPassword || !pwRegex.test(finalPassword)) {
                if (typeof this._showToast === 'function') this._showToast('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร, พิมพ์ใหญ่, พิมพ์เล็ก, ตัวเลข และอักขระพิเศษ', 'error');
                else alert('กรุณาระบุรหัสผ่านที่ถูกต้อง');
                return;
            }

            const maxId = mockUsers.reduce((max, u) => {
                const idNum = parseInt(u.id, 10);
                return (!isNaN(idNum) && idNum > max) ? idNum : max;
            }, 0);
            const newId = maxId + 1;

            mockUsers.push({
                id: newId,
                username: namePart,
                password: finalPassword,
                name: fullName,
                email: email,
                role: internalRole,
                jobTitle: role,
                customPermissions: customPermissions,
                department: dept,
                avatar: avatarUrl,
                status: 'offline'
            });

            if (typeof this._showToast === 'function') {
                this._showToast('เพิ่มพนักงานเรียบร้อย', 'success');
            } else {
                alert('เพิ่มพนักงานเรียบร้อย');
            }
        }

        this._saveData();

        // Clear inputs
        document.getElementById('am-email').value = '';
        document.getElementById('am-dept').value = '';
        if (roleSelect) roleSelect.value = '';
        if (document.getElementById('am-firstname')) document.getElementById('am-firstname').value = '';
        if (document.getElementById('am-lastname')) document.getElementById('am-lastname').value = '';
        if (document.getElementById('am-phone')) document.getElementById('am-phone').value = '';
        if (document.getElementById('am-password')) document.getElementById('am-password').value = '';

        // Reset avatar preview
        if (preview) {
            preview.src = '';
            preview.classList.add('hidden');
        }
        const placeholder = document.getElementById('am-avatar-placeholder');
        if (placeholder) placeholder.classList.remove('hidden');
        const fileInput = document.getElementById('am-avatar-input');
        if (fileInput) fileInput.value = '';

        this.closeAddMemberModal();
        this.renderTeam(); // Re-render team view to show updates
    },

    // --- User Profile Modal Logic ---
    openUserProfileModal(userId) {
        let user = mockUsers.find(u => u.id == userId);
        
        // Fallback to currentUser if not in mockUsers (for dynamically registered users)
        if (!user && this.state.currentUser && this.state.currentUser.id === userId) {
            const curUser = this.state.currentUser;
            let displayName = curUser.name;
            if (!displayName && curUser.first_name) {
                displayName = curUser.first_name + (curUser.last_name ? ' ' + curUser.last_name : '');
            }
            if (!displayName && curUser.email) {
                displayName = curUser.email.split('@')[0];
            }
            
            user = {
                id: curUser.id,
                name: displayName || 'User',
                username: displayName || 'User',
                email: curUser.email || '',
                role: curUser.role || 'worker',
                status: 'online',
                jobTitle: 'Member',
                department: '',
                avatar: curUser.avatar || App._initialsAvatar(curUser.name || curUser.email)
            };
        }

        if (!user) {
            console.error('User not found for profile modal:', userId);
            return;
        }

        const modal = document.getElementById('user-profile-modal');
        if (!modal) return;

        const isOnline = user.status === 'online';
        const roleLabel = user.role === 'admin' ? 'แอดมิน' : user.role === 'reviewer2' ? 'ผู้บริหาร' : user.role === 'reviewer1' ? 'หัวหน้าแผนก' : user.role === 'worker' ? 'พนักงาน' : 'ผู้มอบหมาย';

        let jobTitle = user.jobTitle;
        let jobTitleHtml = '';
        if (jobTitle) {
            jobTitleHtml = `<span>${jobTitle}</span>`;
        } else {
            if (user.role === 'reviewer2') {
                jobTitleHtml = '<span>ประธานเจ้าหน้าที่บริหาร</span>';
                jobTitle = 'ประธานเจ้าหน้าที่บริหาร';
            } else if (user.role === 'reviewer1') {
                jobTitleHtml = '<span>ผู้จัดการแผนก</span> <span>' + user.department + '</span>';
                jobTitle = 'ผู้จัดการแผนก ' + user.department;
            } else if (user.role === 'admin') {
                jobTitleHtml = '<span>ผู้ดูแลระบบ</span>';
                jobTitle = 'ผู้ดูแลระบบ';
            } else {
                jobTitleHtml = '<span>เจ้าหน้าที่แผนก</span> <span>' + user.department + '</span>';
                jobTitle = 'เจ้าหน้าที่แผนก ' + user.department;
            }
        }

        // 1. Header
        document.getElementById('up-avatar').src = user.avatar || this._initialsAvatar(user.name || user.email);
        document.getElementById('up-status-dot').className = `absolute bottom-2 right-2 w-6 h-6 border-4 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`;
        document.getElementById('up-name').textContent = user.name;
        document.getElementById('up-job-title').innerHTML = jobTitleHtml;
        document.getElementById('up-role-badge').textContent = roleLabel;

        this.state.currentViewingUserId = userId;

        // Bind Send Message Button
        const msgBtn = document.getElementById('up-msg-btn');
        if (msgBtn) {
            if (this.state.currentUser && this.state.currentUser.id === userId) {
                msgBtn.classList.add('hidden');
                msgBtn.classList.remove('flex');
            } else {
                msgBtn.classList.remove('hidden');
                msgBtn.classList.add('flex');
                msgBtn.onclick = () => {
                    App.closeUserProfileModal();
                    App.startDirectChat(user.id);
                };
            }
        }

        // Handle Edit Button Visibility
        const editBtn = document.getElementById('up-edit-btn');
        if (editBtn) {
            if (this.state.currentUser && (this.state.currentUser.id === userId || this.state.currentUser.role === 'admin')) {
                editBtn.classList.remove('hidden');
                editBtn.classList.add('flex');
            } else {
                editBtn.classList.add('hidden');
                editBtn.classList.remove('flex');
            }
        }

        // 2. Personal Info — the same record as Team → Profile (member_details), never made-up values
        const isEn = App.settings && App.settings.language === 'en';
        const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = (v === undefined || v === null || v === '') ? '-' : v; };
        /* คำนำหน้า and ชื่อเล่น are not collected, so those boxes are hidden */
        ['up-title', 'up-nickname'].forEach(id => { const el = document.getElementById(id); if (el && el.parentElement) el.parentElement.classList.add('hidden'); });
        setTxt('up-firstname', '…'); setTxt('up-lastname', '…'); setTxt('up-birthday', '…'); setTxt('up-gender', '…'); setTxt('up-phone', '…'); setTxt('up-personal-email', '…');
        const PI = window.PersonalInfo;
        const isMe = this.state.currentUser && String(this.state.currentUser.id) === String(userId);
        const fill = (info) => {
            if (String(this.state.currentViewingUserId) !== String(userId)) return;   // another profile was opened meanwhile
            info = info || {};
            setTxt('up-firstname', info.first_name_th || '');
            setTxt('up-lastname', info.last_name_th || '');
            const thName = [info.first_name_th, info.last_name_th].filter(Boolean).join(' ');
            if (thName) setTxt('up-name', thName);
            let bday = '';
            if (info.birth_date) {
                const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(info.birth_date);
                const age = PI ? PI.age(info.birth_date) : '';
                bday = (m ? `${m[2]}/${m[3]}/${m[1]}` : info.birth_date) + (age !== '' ? (isEn ? ` (${age} years)` : ` (${age} ปี)`) : '');
            }
            setTxt('up-birthday', bday);
            const G = isEn ? { male: 'Male', female: 'Female', unspecified: 'Not specified' } : ((PI && PI.GENDER) || {});
            setTxt('up-gender', G[info.gender] || '');
            setTxt('up-phone', info.phone ? (PI ? PI.phone(info.phone) : info.phone) : '');
            setTxt('up-personal-email', info.personal_email || '');
        };
        this.state.currentViewingUserId = userId;
        if (PI) {
            (isMe ? PI.load(userId) : PI.loadMany([userId]).then(o => o[String(userId)] || null))
                .then(fill).catch(() => fill(null));
        } else fill(null);

        // 3. Account Access
        setTxt('up-email', user.email && !/@company\.com$/.test(user.email) ? user.email : (isMe && this.state.currentUser.email) || user.email || '');

        // 4. Work Info
        document.getElementById('up-work-position').textContent = jobTitle;
        const centralStr = isEn ? 'Central' : 'ส่วนกลาง';
        document.getElementById('up-work-dept').textContent = user.department || centralStr;

        // --- Company Info Logic ---
        const userMemberships = this.state.members.filter(m => m.user_id === userId);
        const corporateMembership = userMemberships.find(m => {
            const w = this.state.workspaces.find(ws => ws.workspace_id === m.workspace_id);
            return w && w.type !== 'personal';
        });
        const userWorkspace = corporateMembership ? this.state.workspaces.find(w => w.workspace_id === corporateMembership.workspace_id) : null;

        const companyInfoDiv = document.getElementById('up-company-info');
        const companyJoinDiv = document.getElementById('up-company-join');
        const companySection = document.getElementById('up-company-section');
        
        if (companySection) {
            if (userWorkspace) {
                companyInfoDiv.classList.remove('hidden');
                companyJoinDiv.classList.add('hidden');
                document.getElementById('up-company-name').textContent = userWorkspace.name;
                document.getElementById('up-company-code').textContent = userWorkspace.code || userWorkspace.workspace_id;
            } else {
                companyInfoDiv.classList.add('hidden');
                if (this.state.currentUser && this.state.currentUser.id === userId) {
                    companyJoinDiv.classList.remove('hidden');
                    document.getElementById('up-join-code-input').value = '';
                } else {
                    companyJoinDiv.classList.add('hidden');
                }
            }
        }

        // Load Custom Permissions into modal
        const permsContainer = document.getElementById('up-work-custom-perms');
        if (permsContainer) {
            permsContainer.innerHTML = ''; // clear
            /* this person's own extra permissions, if any were given */
            const extraPerms = Array.isArray(user.customPermissions) ? user.customPermissions : (Array.isArray(user.permissions) ? user.permissions : []);
            if (extraPerms.length > 0) {
                extraPerms.forEach(p => {
                    const span = document.createElement('span');
                    span.className = 'inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-md font-medium mr-2 mb-2 border border-blue-100';
                    span.innerHTML = `<i class="fa-solid fa-check text-blue-500 mr-1"></i> ${p}`;
                    permsContainer.appendChild(span);
                });
            } else {
                permsContainer.innerHTML = '<span class="text-sm text-gray-500">-</span>';
            }
        }

        modal.classList.remove('hidden');
    },

    closeUserProfileModal(redirectToProjects = false) {
        const modal = document.getElementById('user-profile-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        if (redirectToProjects) {
            this.switchView('projects');
        }
    },

    joinCompanyFromProfile() {
        const inputCode = document.getElementById('up-join-code-input').value.trim().toUpperCase();
        if (!inputCode) {
            this._showToast('กรุณากรอกรหัสบริษัท', 'error');
            return;
        }
        
        const targetWorkspace = this.state.workspaces.find(w => w.code === inputCode && w.type === 'corporate');
        if (!targetWorkspace) {
            this._showToast('ไม่พบรหัสบริษัทนี้ (หรือรูปแบบไม่ถูกต้อง)', 'error');
            return;
        }
        
        // Add member
        const existingMember = this.state.members.find(m => m.user_id === this.state.currentUser.id && m.workspace_id === targetWorkspace.workspace_id);
        if (existingMember) {
            this._showToast('คุณอยู่ในบริษัทนี้แล้ว', 'error');
            return;
        }

        const newMember = {
            id: 'M-' + Date.now(),
            user_id: this.state.currentUser.id,
            workspace_id: targetWorkspace.workspace_id,
            role: 'worker', // default
            joined_at: new Date().toISOString()
        };
        this.state.members.push(newMember);
        this._saveData(); // Save to localStorage / database if configured

        this._showToast('เข้าร่วมบริษัท ' + targetWorkspace.name + ' สำเร็จ!', 'success');
        
        // Switch context to the new workspace immediately
        this.switchWorkspaceContext(targetWorkspace.workspace_id);
        
        // Update user profile modal dynamically
        this.openUserProfileModal(this.state.currentUser.id);
    },

    editUserProfile() {
        if (!this.state.currentUser) return;

        const targetUserId = this.state.currentViewingUserId || this.state.currentUser.id;

        // Final permission check before opening
        if (this.state.currentUser.id !== targetUserId && !this.hasPermission('แก้ไขพนักงาน')) {
            this._showToast('คุณไม่มีสิทธิ์แก้ไขข้อมูลของผู้อื่น', 'error');
            return;
        }

        // Hide the main user profile modal first
        const userModal = document.getElementById('user-profile-modal');
        if (userModal) userModal.classList.add('hidden');

        let user = mockUsers.find(u => u.id == targetUserId);
        
        // Fallback for current user
        if (!user && this.state.currentUser && this.state.currentUser.id === targetUserId) {
            const curUser = this.state.currentUser;
            let displayName = curUser.name;
            if (!displayName && curUser.first_name) {
                displayName = curUser.first_name + (curUser.last_name ? ' ' + curUser.last_name : '');
            }
            if (!displayName && curUser.email) {
                displayName = curUser.email.split('@')[0];
            }
            user = {
                id: curUser.id,
                name: displayName || 'User',
                email: curUser.email || '',
                role: curUser.role || 'worker',
                avatar: curUser.avatar || App._initialsAvatar(curUser.name || curUser.email)
            };
        }

        if (!user) return;

        // Open Add Member View (initializes selects and bindings)
        this.openAddMemberModal();

        // Setup editing state AFTER opening so it doesn't get reset
        this.state.editingMemberId = targetUserId;

        // Change UI text to "Edit Employee"
        const title = document.getElementById('am-view-title');
        const subtitle = document.getElementById('am-view-subtitle');
        const submitBtn = document.getElementById('am-submit-btn');
        const mainTitle = document.getElementById('main-header-title');

        if (title) title.textContent = 'แก้ไขข้อมูลพนักงาน';
        if (subtitle) subtitle.textContent = 'แก้ไขข้อมูลส่วนตัวและการทำงานของพนักงาน';
        if (submitBtn) submitBtn.textContent = 'บันทึกการเปลี่ยนแปลง';
        if (mainTitle) mainTitle.textContent = 'แก้ไขข้อมูลพนักงาน';


        // Pre-fill fields
        const nameParts = (user.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        document.getElementById('am-firstname').value = firstName;
        document.getElementById('am-lastname').value = lastName;
        document.getElementById('am-email').value = user.email || '';
        if (document.getElementById('am-password')) {
            document.getElementById('am-password').value = user.password || '';
        }

        document.getElementById('am-phone').value = user.phone || '';

        // Compute jobTitle based on user's saved job title, or fallback to role logic
        let jobTitle = user.jobTitle;
        if (!jobTitle) {
            if (user.role === 'reviewer2') {
                jobTitle = 'ประธานเจ้าหน้าที่บริหาร';
            } else if (user.role === 'reviewer1') {
                jobTitle = 'ผู้จัดการแผนก ' + (user.department || '');
            } else if (user.role === 'admin') {
                jobTitle = 'ผู้ดูแลระบบ';
            } else {
                jobTitle = 'พนักงานประจำ ' + (user.department || '');
            }
        }

        // Set Role & Dept
        const deptInput = document.getElementById('am-dept');
        if (deptInput && user.department) {
            if (!Array.from(deptInput.options).some(opt => opt.value === user.department)) {
                const newOpt = document.createElement('option');
                newOpt.value = user.department;
                newOpt.textContent = user.department;
                deptInput.appendChild(newOpt);
            }
            deptInput.value = user.department;
        }

        const roleInput = document.getElementById('am-role');
        if (roleInput && jobTitle) {
            if (!Array.from(roleInput.options).some(opt => opt.value === jobTitle)) {
                const newOpt = document.createElement('option');
                newOpt.value = jobTitle;
                newOpt.textContent = jobTitle;
                roleInput.appendChild(newOpt);
            }
            roleInput.value = jobTitle;
        }

        // Trigger input events to update the summary card
        ['am-firstname', 'am-lastname', 'am-email', 'am-phone'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.dispatchEvent(new Event('input'));
        });
        ['am-role', 'am-dept'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.dispatchEvent(new Event('change'));
        });

        // Update avatar previews
        if (user.avatar) {
            const preview = document.getElementById('am-avatar-preview');
            const placeholder = document.getElementById('am-avatar-placeholder');
            const summaryImg = document.getElementById('am-summary-avatar-img');
            const summaryIcon = document.getElementById('am-summary-avatar-icon');

            if (preview && placeholder) {
                preview.src = user.avatar;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            }
            if (summaryImg && summaryIcon) {
                summaryImg.src = user.avatar;
                summaryImg.classList.remove('hidden');
                summaryIcon.classList.add('hidden');
            }
        }

        // Disable Work Information fields if editing self without permission
        const hasPerm = this.hasPermission('แก้ไขพนักงาน');
        const deptEl = document.getElementById('am-dept');
        const roleEl = document.getElementById('am-role');
        const permCbs = document.querySelectorAll('.am-perm-cb');

        if (!hasPerm && this.state.currentUser.role !== 'admin') {
            if (deptEl) {
                deptEl.disabled = true;
                deptEl.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
                deptEl.classList.remove('bg-white');
            }
            if (roleEl) {
                roleEl.disabled = true;
                roleEl.classList.add('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
                roleEl.classList.remove('bg-white');
            }
            permCbs.forEach(cb => {
                cb.disabled = true;
                cb.classList.add('cursor-not-allowed', 'opacity-60');
                cb.parentElement.classList.add('cursor-not-allowed', 'opacity-60');
            });
        } else {
            if (deptEl) {
                deptEl.disabled = false;
                deptEl.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
                deptEl.classList.add('bg-white');
            }
            if (roleEl) {
                roleEl.disabled = false;
                roleEl.classList.remove('bg-gray-100', 'cursor-not-allowed', 'text-gray-500');
                roleEl.classList.add('bg-white');
            }
            permCbs.forEach(cb => {
                cb.disabled = false;
                cb.classList.remove('cursor-not-allowed', 'opacity-60');
                cb.parentElement.classList.remove('cursor-not-allowed', 'opacity-60');
            });
        }
    },

    closeEditProfileModal() {
        const editModal = document.getElementById('edit-profile-modal');
        if (editModal) editModal.classList.add('hidden');

        // Show main profile modal again
        if (this.state.currentViewingUserId) {
            this.openUserProfileModal(this.state.currentViewingUserId);
        } else if (this.state.currentUser) {
            this.openUserProfileModal(this.state.currentUser.id);
        }
    },

    async saveEditProfile() {
        if (!this.state.currentUser) return;

        const targetUserId = this.state.currentViewingUserId || this.state.currentUser.id;
        if (this.state.currentUser.id !== targetUserId && this.state.currentUser.role !== 'admin') {
            return;
        }

        const user = mockUsers.find(u => String(u.id) === String(targetUserId));
        if (!user) return;

        const fullName = document.getElementById('ep-full-name').value.trim();
        const nickname = document.getElementById('ep-nickname').value.trim();
        const birthday = document.getElementById('ep-birthday').value.trim();
        const gender = document.getElementById('ep-gender').value;
        const nationality = document.getElementById('ep-nationality').value.trim();
        const email = document.getElementById('ep-email').value.trim();
        const phone = document.getElementById('ep-phone').value.trim();

        let addr = document.getElementById('ep-address').value.trim();
        addr = addr.replace(/\n/g, '<br>');

        user.fullName = fullName;
        user.nickname = nickname;
        user.birthday = birthday;
        user.gender = gender;
        user.nationality = nationality;
        user.email = email;
        user.phone = phone;
        user.address = addr;

        if (fullName) {
            user.name = fullName;
        }

        // If editing self, update state.currentUser
        if (String(this.state.currentUser.id) === String(targetUserId)) {
            this.state.currentUser.name = user.name;
            this.state.currentUser.email = user.email;
            this.state.currentUser.avatar = user.avatar;
            this.state.currentUser.department = user.department;
            this.state.currentUser.role = user.role;
        }

        mockChats.forEach(c => {
            if (String(c.userId) === String(user.id) || c.id === 'user-' + user.id) {
                c.name = user.name;
                if (user.avatar) c.avatar = user.avatar;
                if (user.department) c.subtitle = `${user.department} (${user.role === 'admin' ? 'แอดมิน' : user.role === 'reviewer2' ? 'ผู้บริหาร' : user.role === 'reviewer1' ? 'ผู้จัดการ' : 'พนักงาน'})`;
            }
        });

        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            await window.conworkSupabase.updateUserProfile({
                userId: user.id,
                fullName: user.name,
                avatarUrl: user.avatar,
                department: user.department,
                role: user.role
            });
        }

        this._saveData();
        this.updateProfile();
        this.renderTeam();
        this.renderChatList();
        this.renderMessages();
        try {
            localStorage.setItem('conwork_chats', JSON.stringify(mockChats));
        } catch (e) {}
        this.closeEditProfileModal();
        this._showToast('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว', 'success');
    },

    toggleUserProfileContextMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById('up-context-menu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    },

    copyUserLink() {
        const linkInput = document.getElementById('share-profile-link');
        if (linkInput && !document.getElementById('share-profile-modal').classList.contains('hidden')) {
            linkInput.select();
        }
        this._showToast('คัดลอกลิงก์โปรไฟล์เรียบร้อยแล้ว', 'success');
        const menu = document.getElementById('up-context-menu');
        if (menu) menu.classList.add('hidden');
    },

    shareUserProfile() {
        const menu = document.getElementById('up-context-menu');
        if (menu) menu.classList.add('hidden');

        const linkInput = document.getElementById('share-profile-link');
        if (linkInput && this.state.currentUser) {
            const targetId = this.state.currentViewingUserId || this.state.currentUser.id;
            const baseUrl = window.location.origin + window.location.pathname;
            linkInput.value = `${baseUrl}#user=${targetId}`;
        }

        const modal = document.getElementById('share-profile-modal');
        if (modal) modal.classList.remove('hidden');
    },

    checkProfileLinkHash() {
        const hash = window.location.hash;
        if (hash && hash.includes('user=')) {
            const userId = hash.split('user=')[1]?.split('&')[0];
            if (userId) {
                setTimeout(() => {
                    this.openUserProfileModal(userId);
                }, 300);
            }
        }
    },

    closeShareProfileModal() {
        const modal = document.getElementById('share-profile-modal');
        if (modal) modal.classList.add('hidden');
    },

    reportUserProfile() {
        const menu = document.getElementById('up-context-menu');
        if (menu) menu.classList.add('hidden');

        const textArea = document.getElementById('report-profile-text');
        if (textArea) textArea.value = '';

        const modal = document.getElementById('report-profile-modal');
        if (modal) modal.classList.remove('hidden');
    },

    openReportProfileModal() {
        this.reportUserProfile();
    },

    closeReportProfileModal() {
        const modal = document.getElementById('report-profile-modal');
        if (modal) modal.classList.add('hidden');
    },

    submitReportProfile() {
        const textArea = document.getElementById('report-profile-text');
        if (textArea && !textArea.value.trim()) {
            this._showToast('โปรดระบุรายละเอียดปัญหาที่พบ', 'error');
            return;
        }

        this.closeReportProfileModal();
        this._showToast('ส่งรายงานปัญหาเรียบร้อยแล้ว ทีมงานจะดำเนินการตรวจสอบ', 'success');
    },

    submitAddMember() {
        const emailInput = document.getElementById('old-am-email');
        const deptSelect = document.getElementById('old-am-dept');
        const roleSelect = document.getElementById('old-am-role');
        
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email) {
            if (typeof this._showToast === 'function') {
                this._showToast('กรุณาระบุอีเมลพนักงาน', 'error');
            } else {
                alert('กรุณาระบุอีเมลพนักงาน');
            }
            return;
        }

        this.closeAddMemberModal();
        if (emailInput) emailInput.value = '';
        if (typeof this._showToast === 'function') {
            this._showToast(`ส่งคำเชิญไปยัง ${email} เรียบร้อยแล้ว`, 'success');
        } else {
            alert(`ส่งคำเชิญไปยัง ${email} เรียบร้อยแล้ว`);
        }
    },

    // --- End Employee Profile Modal ---

    startDirectChat(userId, userObj = null) {
        const chat = this.getOrCreateChat(userId, userObj);
        this.switchView('messages');
        this.switchChat(chat.id);
    },

    generateDailyNotifications() {
        const todayStr = new Date().toISOString().split('T')[0];

        // Meetings today
        const todayMeetings = mockEvents.filter(e => e.date === todayStr && e.type === 'meeting');
        todayMeetings.forEach(m => {
            const exists = mockNotifications.find(n => n.type === 'meeting' && n.linkData && n.linkData.eventId === m.id);
            if (!exists) {
                this.addNotification('meeting', 'การประชุมวันนี้', `กิจกรรม : ${m.title} ${m.time ? 'เวลา ' + m.time : ''}`, { view: 'calendar', date: todayStr, eventId: m.id });
            }
        });

        // Tasks due today
        const todayTasks = mockTasks.filter(t => t.dueDate === todayStr && t.status !== 'completed' && t.status !== 'done');
        todayTasks.forEach(t => {
            const exists = mockNotifications.find(n => n.type === 'task-due' && n.linkData && n.linkData.taskId === t.id);
            if (!exists) {
                this.addNotification('task-due', 'งานที่ต้องทำวันนี้', `งาน : ${t.title}`, { view: 'tasks', projectId: t.projectId, taskId: t.id });
            }
        });
    },

    toggleNotificationDropdown() {
        this.state.showNotificationDropdown = !this.state.showNotificationDropdown;
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            if (this.state.showNotificationDropdown) {
                dropdown.classList.remove('hidden');
                this.renderNotifications();
            } else {
                dropdown.classList.add('hidden');
            }
        }
    },

    async markAllNotificationsRead() {
        const curUserId = this.state.currentUser ? String(this.state.currentUser.id) : null;
        mockNotifications.forEach(n => {
            if (!n.linkData?.targetUserId || String(n.linkData.targetUserId) === curUserId) {
                n.read = true;
            }
        });
        this._saveData();
        this.renderNotifications();

        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && curUserId) {
            try {
                await window.conworkSupabase.client
                    .from('notifications')
                    .update({ read_at: new Date().toISOString() })
                    .eq('user_id', curUserId)
                    .is('read_at', null);
            } catch (e) {
                console.warn('Error marking notifications read in Supabase:', e);
            }
        }
    },

    async deleteAllNotifications() {
        const curUserId = this.state.currentUser ? String(this.state.currentUser.id) : null;
        for (let i = mockNotifications.length - 1; i >= 0; i--) {
            const n = mockNotifications[i];
            if (!n.linkData?.targetUserId || String(n.linkData.targetUserId) === curUserId) {
                mockNotifications.splice(i, 1);
            }
        }
        this._saveData();
        this.renderNotifications();

        if (window.conworkSupabase && window.conworkSupabase.isAvailable() && curUserId) {
            try {
                await window.conworkSupabase.client
                    .from('notifications')
                    .delete()
                    .eq('user_id', curUserId);
            } catch (e) {
                console.warn('Error deleting notifications in Supabase:', e);
            }
        }
    },

    async deleteNotification(id) {
        const index = mockNotifications.findIndex(n => n.id === id);
        if (index !== -1) {
            const notif = mockNotifications[index];
            mockNotifications.splice(index, 1);
            this._saveData();
            this.renderNotifications();

            if (window.conworkSupabase && window.conworkSupabase.isAvailable() && notif && !String(notif.id).startsWith('notif-')) {
                try {
                    await window.conworkSupabase.client.from('notifications').delete().eq('id', notif.id);
                } catch (e) {
                    console.warn('Error deleting notification in Supabase:', e);
                }
            }
        }
    },

    async addNotification(type, title, message, linkData) {
        const notifItem = {
            id: 'notif-' + Date.now() + Math.floor(Math.random() * 1000),
            type, // 'task', 'meeting', 'task-due'
            title,
            message,
            linkData,
            read: false,
            timestamp: new Date().toISOString()
        };
        mockNotifications.unshift(notifItem);
        this._saveData();
        this.renderNotifications();

        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            try {
                /* notifications table: one row per person (user_id), text in body, extra data in link */
                const targetUserId = linkData?.targetUserId || this.state.currentUser?.id || null;
                const ws = this.state.workspaces && this.state.workspaces[0];
                const companyId = (ws && (ws.workspace_id || ws.id)) || null;
                if (!targetUserId) return;
                const { data, error } = await window.conworkSupabase.client
                    .from('notifications')
                    .insert([{
                        type,
                        title,
                        body: message,
                        link: linkData || {},
                        user_id: targetUserId,
                        company_id: /^[0-9a-f-]{36}$/i.test(String(companyId || '')) ? companyId : null
                    }])
                    .select()
                    .single();

                if (!error && data) {
                    notifItem.id = data.id;
                    this._saveData();
                    this.renderNotifications();
                }
            } catch (err) {
                console.warn('Supabase notification insert warning:', err);
            }
        }
    },

    async fetchNotificationsFromSupabase() {
        if (!window.conworkSupabase || !window.conworkSupabase.isAvailable() || !this.state.currentUser) return;
        try {
            const curUserId = String(this.state.currentUser.id);
            const { data, error } = await window.conworkSupabase.client
                .from('notifications')
                .select('*')
                .eq('user_id', curUserId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (!error && data) {
                const formatted = data.map(n => ({
                    id: n.id,
                    type: n.type,
                    title: n.title,
                    message: n.body != null ? n.body : (n.message || ''),
                    linkData: n.link || n.link_data || {},
                    read: !!(n.read_at || n.is_read),
                    timestamp: n.created_at
                }));

                formatted.forEach(item => {
                    const idx = mockNotifications.findIndex(m => String(m.id) === String(item.id));
                    if (idx === -1) {
                        mockNotifications.push(item);
                    } else {
                        mockNotifications[idx] = item;
                    }
                });

                mockNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                this.renderNotifications();
            }
        } catch (err) {
            console.warn('Error fetching notifications from Supabase:', err);
        }
    },

    syncSystemNotificationsFromData() {
        if (!this.state.currentUser) return;
        const curUserId = String(this.state.currentUser.id);
        let changed = false;

        // 1. Task Assignments
        mockTasks.forEach(t => {
            if (!t.assignees || !Array.isArray(t.assignees)) return;
            const isAssigned = t.assignees.some(uid => String(uid) === curUserId);
            const isCreator = t.creatorId && String(t.creatorId) === curUserId;

            if (isAssigned && !isCreator) {
                const notifIdKey = `notif-assigned-${t.id}-${curUserId}`;
                const exists = mockNotifications.some(n => 
                    (n.id === notifIdKey) || 
                    (n.type === 'task' && n.linkData && String(n.linkData.taskId) === String(t.id) && String(n.linkData.targetUserId) === curUserId && n.title && n.title.includes('มอบหมาย'))
                );

                if (!exists) {
                    mockNotifications.unshift({
                        id: notifIdKey,
                        type: 'task',
                        title: 'คุณได้รับมอบหมายงานใหม่',
                        message: `งาน: ${t.title || 'ไม่มีชื่อ'}`,
                        linkData: { view: 'tasks', projectId: t.projectId, taskId: t.id, targetUserId: curUserId },
                        read: false,
                        timestamp: t.createdAt || new Date().toISOString()
                    });
                    changed = true;
                }
            }

            // 2. Pending Reviews
            if (t.status === 'pending-review' || t.status === 'in_review') {
                let isReviewer = false;
                if (t.reviewers && Array.isArray(t.reviewers) && t.reviewers.length > 0) {
                    isReviewer = t.reviewers.some(r => String(r.userId || r) === curUserId);
                } else {
                    const role = this.state.currentUser ? this.state.currentUser.role : null;
                    const isCreator = (t.creatorId && String(t.creatorId) === curUserId) || (t.createdBy && String(t.createdBy) === curUserId);
                    const isManagerOrAdmin = role === 'admin' || role === 'reviewer1' || role === 'reviewer2' || role === 'super_admin' || role === 'Company_admin';
                    isReviewer = isCreator || isManagerOrAdmin || this._canUserReviewTask(t, curUserId, role);
                }

                const isSoleAssignee = t.assignees && Array.isArray(t.assignees) && t.assignees.length === 1 && String(t.assignees[0]) === curUserId;

                if (isReviewer && (!isSoleAssignee || (t.creatorId && String(t.creatorId) === curUserId))) {
                    const notifIdKey = `notif-review-${t.id}-${curUserId}`;
                    const exists = mockNotifications.some(n => 
                        (n.id === notifIdKey) || 
                        (n.type === 'task' && n.title === 'มีการส่งงานให้ตรวจ' && n.linkData && String(n.linkData.taskId) === String(t.id) && String(n.linkData.targetUserId) === curUserId)
                    );

                    if (!exists) {
                        mockNotifications.unshift({
                            id: notifIdKey,
                            type: 'task',
                            title: 'มีการส่งงานให้ตรวจ',
                            message: `งาน: ${t.title || 'ไม่มีชื่อ'} (รอการตรวจสอบ)`,
                            linkData: { view: 'tasks', projectId: t.projectId, taskId: t.id, targetUserId: curUserId },
                            read: false,
                            timestamp: t.submittedAt || new Date().toISOString()
                        });
                        changed = true;
                    }
                }
            }
        });

        // 3. Project Membership
        mockProjects.forEach(p => {
            if (!p.team || !Array.isArray(p.team)) return;
            const isMember = p.team.some(m => String(m.userId || m.id || m) === curUserId);
            const isCreator = p.createdBy && String(p.createdBy) === curUserId;

            if (isMember && !isCreator) {
                const notifIdKey = `notif-proj-${p.id}-${curUserId}`;
                const exists = mockNotifications.some(n => 
                    (n.id === notifIdKey) || 
                    (n.type === 'project' && n.linkData && String(n.linkData.projectId) === String(p.id))
                );

                if (!exists) {
                    mockNotifications.unshift({
                        id: notifIdKey,
                        type: 'project',
                        title: 'โปรเจกต์ใหม่ถูกสร้าง',
                        message: `เริ่มต้นโปรเจกต์ "${p.name}" สำเร็จ! ขอให้ทีมทำงานอย่างราบรื่นนะครับ 🎉`,
                        linkData: { view: 'tasks', projectId: p.id, targetUserId: curUserId },
                        read: false,
                        timestamp: p.createdAt || new Date().toISOString()
                    });
                    changed = true;
                }
            }
        });

        if (changed) {
            this._saveData();
            this.renderNotifications();
        }
    },

    renderNotifications() {
        const badge = document.getElementById('notification-badge');
        const list = document.getElementById('notification-list');
        if (!badge || !list) return;

        const curUserId = this.state.currentUser ? String(this.state.currentUser.id) : null;

        const userNotifs = mockNotifications.filter(n => {
            if (n.linkData && n.linkData.targetUserId) {
                return String(n.linkData.targetUserId) === curUserId;
            }
            return true;
        });

        const unreadCount = userNotifs.filter(n => !n.read).length;
        if (unreadCount > 0) {
            badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (userNotifs.length === 0) {
            list.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">ไม่มีการแจ้งเตือนใหม่</div>';
            return;
        }

        list.innerHTML = userNotifs.map(n => {
            let iconHtml = '';
            if (n.type === 'meeting') {
                iconHtml = '<div class="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><i class="fa-regular fa-calendar"></i></div>';
            } else if (n.type === 'task' || n.type === 'task-due') {
                iconHtml = '<div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-list-check"></i></div>';
            } else if (n.type === 'project') {
                iconHtml = '<div class="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-briefcase"></i></div>';
            } else {
                iconHtml = '<div class="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><i class="fa-solid fa-bell"></i></div>';
            }

            const d = new Date(n.timestamp);
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
                <div class="p-3 hover:bg-gray-50 cursor-pointer flex gap-3 transition-colors group relative ${n.read ? 'bg-transparent' : 'bg-blue-50/30'}" onclick="App.handleNotificationClick('${n.id}')">
                    ${iconHtml}
                    <div class="flex-1 min-w-0 pr-6">
                        <div class="flex justify-between items-start mb-0.5">
                            <h4 class="text-sm font-bold ${n.read ? 'text-gray-600' : 'text-gray-800'} truncate">${n.title}</h4>
                            <span class="text-[10px] text-gray-400 shrink-0 ml-2">${timeStr}</span>
                        </div>
                        <p class="text-xs text-gray-500 line-clamp-2">${n.message}</p>
                    </div>
                    ${!n.read ? '<div class="absolute right-3 top-3 w-2 h-2 rounded-full bg-blue-500"></div>' : ''}
                    <button class="absolute right-2 bottom-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1" onclick="event.stopPropagation(); App.deleteNotification('${n.id}')" title="ลบการแจ้งเตือน">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');
    },

    handleNotificationClick(notifId) {
        const notif = mockNotifications.find(n => n.id === notifId);
        if (!notif) return;

        notif.read = true;
        this._saveData();
        this.renderNotifications();
        this.toggleNotificationDropdown(); // Close dropdown

        if (notif.linkData) {
            if (notif.linkData.view === 'tasks' && notif.linkData.projectId) {
                this.switchView('projects');
                setTimeout(() => this.openProject(notif.linkData.projectId), 50);
            } else if (notif.linkData.view === 'calendar') {
                this.switchView('calendar');
                if (notif.linkData.date) {
                    const [y, m, d] = notif.linkData.date.split('-');
                    this.state.calendarYear = parseInt(y);
                    this.state.calendarMonth = parseInt(m) - 1;
                    this.state.calendarDate = parseInt(d);
                    this.state.selectedDate = notif.linkData.date;
                    if (this.renderCalendar) this.renderCalendar();
                }
            }
        }
    },

    // --- Profile Menu Actions ---
    toggleProfileMenu(e) {
        if (e) {
            e.stopPropagation();
        }
        const dropdown = document.getElementById('profile-menu-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    },

    openUserProfile() {
        if (this.state.currentUser) {
            this.openUserProfileModal(this.state.currentUser.id);
        }
        this.toggleProfileMenu();
    },

    openSettingsModal() {
        const pd = document.getElementById('profile-menu-dropdown');
        if (pd && !pd.classList.contains('hidden')) {
            pd.classList.add('hidden');
        }

        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.remove('hidden');
    },

    closeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.add('hidden');
    },

    openEditProfileFromSettings() {
        this.closeSettingsModal();
        if (this.state.currentUser) {
            this.editUserProfile();
        }
    },

    showPasswordReset() {
        const modal = document.getElementById('change-password-modal');
        if (modal) {
            document.getElementById('cp-new-password').value = '';
            document.getElementById('cp-confirm-password').value = '';
            modal.classList.remove('hidden');
        } else {
            this._showToast('ระบบได้ส่งลิงก์เปลี่ยนรหัสผ่านไปยังอีเมลของคุณแล้ว', 'success');
        }
    },

    closePasswordReset() {
        const modal = document.getElementById('change-password-modal');
        if (modal) modal.classList.add('hidden');
    },

    submitPasswordReset() {
        const newPass = document.getElementById('cp-new-password').value;
        const confirmPass = document.getElementById('cp-confirm-password').value;
        
        if (!newPass || !confirmPass) {
            this._showToast('กรุณากรอกรหัสผ่านใหม่และยืนยันรหัสผ่าน', 'error');
            return;
        }
        
        if (newPass !== confirmPass) {
            this._showToast('รหัสผ่านไม่ตรงกัน', 'error');
            return;
        }
        
        if (newPass.length < 6) {
            this._showToast('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'error');
            return;
        }
        
        // Mock success
        this.closePasswordReset();
        this._showToast('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
    },

    toggleLanguage() {
        const newLang = this.settings.language === 'th' ? 'en' : 'th';
        this.changeLanguage(newLang);
    },

    toggleTheme() {
        this.toggleDarkMode(!this.settings.darkMode);
    },

    setFontSize(size) {
        this.settings.fontSize = size;
        this._saveSettings();
    },

    changeLanguage(lang) {
        this.settings.language = lang;
        this.settings.languageChosen = true; // a language picked in Settings wins over the device language
        this._saveSettings();
        this._applySettings();

        if (window.applyTranslations) {
            window.applyTranslations();
        }
        
        if (window.I18n) {
            window.I18n.applyTranslations();
        }

        if (this.state.currentChat) {
            this.renderMessages();
        }

        if (typeof this.updateRoleCounts === 'function') {
            this.updateRoleCounts();
        }

        if (document.getElementById('permissions-table')) {
            if (typeof this.syncPermissionsTable === 'function') this.syncPermissionsTable();
            if (typeof this.updateRoleDropdown === 'function') this.updateRoleDropdown();
        }

        // Re-render calendars
        this.renderCalendar();
        this.renderMiniCalendar();
        this.renderDayEventsPanel();

        if (lang === 'en') {
            this._showToast('Language preference saved.', 'success');
        } else {
            this._showToast('บันทึกภาษาไทยเป็นภาษาหลักแล้ว', 'success');
        }
    },

    toggleDarkMode(enabled) {
        this.settings.darkMode = enabled;
        this._saveSettings();
        if (enabled) {
            this._showToast('เปลี่ยนเป็นโหมดมืดแล้ว', 'success');
        } else {
            this._showToast('กลับสู่โหมดสว่าง', 'success');
        }
    },

    toggleAppNotifications(enabled) {
        this.settings.appNotifications = enabled;
        this._saveSettings();
        this._showToast(enabled ? 'เปิดการแจ้งเตือนในแอปแล้ว' : 'ปิดการแจ้งเตือนในแอปแล้ว', 'success');
    },

    toggleEmailNotifications(enabled) {
        this.settings.emailNotifications = enabled;
        this._saveSettings();
        this._showToast(enabled ? 'เปิดรับการแจ้งเตือนทางอีเมลแล้ว' : 'ปิดรับการแจ้งเตือนทางอีเมลแล้ว', 'success');
    },

    openHelp() {
        this.toggleProfileMenu(); // Close profile menu if open
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    },

    openHelpContent(type) {
        this.closeHelp();
        const modal = document.getElementById('help-content-modal');
        if (!modal) return;

        const titleEl = document.getElementById('hc-title');
        const iconEl = document.getElementById('hc-icon');
        const contentEl = document.getElementById('hc-content');

        if (type === 'guide') {
            titleEl.textContent = 'คู่มือการใช้งาน';
            iconEl.className = 'fa-solid fa-book text-blue-500';
            contentEl.innerHTML = `
                <div class="space-y-4">
                    <p class="text-sm text-gray-600">ยินดีต้อนรับสู่ระบบบริหารจัดการโครงการ (ConWork) นี่คือคำแนะนำการใช้งานเบื้องต้น : </p>
                    <ul class="list-disc pl-5 text-sm text-gray-600 space-y-2">
                        <li><strong>การสร้างโปรเจกต์ : </strong> คลิกที่ปุ่ม "สร้างโปรเจกต์" มุมซ้ายบนเพื่อเริ่มต้นโปรเจกต์ใหม่</li>
                        <li><strong>การมอบหมายงาน : </strong> ภายในโปรเจกต์ คุณสามารถสร้าง "ทาสก์" และเลือก "ผู้รับผิดชอบ" ได้</li>
                        <li><strong>การสร้างรายงาน : </strong> ไปที่เมนู "สร้างรายงาน" เพื่อเลือกโปรเจกต์และดาวน์โหลดสรุปผลการดำเนินงานในรูปแบบ PDF หรือ Excel</li>
                        <li><strong>ปฏิทิน : </strong> ดูตารางงานทั้งหมดของคุณและทีมได้ในหน้าปฏิทิน</li>
                        <li><strong>ทีมงาน : </strong> จัดการรายชื่อพนักงาน แผนก และสิทธิ์การใช้งาน</li>
                        <li><strong>การตั้งค่า : </strong> เปลี่ยนภาษา ธีมสว่าง/มืด ได้ที่เมนูโปรไฟล์มุมขวาบน</li>
                    </ul>
                </div>
            `;
        } else if (type === 'faq') {
            titleEl.textContent = 'คำถามที่พบบ่อย';
            iconEl.className = 'fa-solid fa-clipboard-question text-green-500';
            contentEl.innerHTML = `
                <div class="space-y-4">
                    <div class="border-b border-gray-100 pb-3">
                        <h4 class="font-bold text-gray-800 text-sm mb-1">ลบโปรเจกต์แล้วกู้คืนได้ไหม?</h4>
                        <p class="text-xs text-gray-500">ปัจจุบันระบบยังไม่รองรับการกู้คืน การลบโปรเจกต์จะเป็นการลบถาวร กรุณาตรวจสอบให้แน่ใจก่อนทำการลบ</p>
                    </div>
                    <div class="border-b border-gray-100 pb-3">
                        <h4 class="font-bold text-gray-800 text-sm mb-1">เปลี่ยนอีเมลบัญชีผู้ใช้ได้อย่างไร?</h4>
                        <p class="text-xs text-gray-500">กรุณาติดต่อผู้ดูแลระบบเพื่อทำการแก้ไขข้อมูลสำคัญเช่นอีเมลของบัญชี</p>
                    </div>
                    <div class="pb-3">
                        <h4 class="font-bold text-gray-800 text-sm mb-1">รองรับไฟล์แนบขนาดสูงสุดเท่าไหร่?</h4>
                        <p class="text-xs text-gray-500">ระบบรองรับไฟล์ทุกประเภท โดยมีขนาดสูงสุดไม่เกิน 50MB ต่อ 1 ไฟล์</p>
                    </div>
                </div>
            `;
        } else if (type === 'contact') {
            titleEl.textContent = 'ติดต่อทีมสนับสนุน';
            iconEl.className = 'fa-solid fa-headset text-orange-500';
            contentEl.innerHTML = `
                <div class="text-center space-y-4 py-4">
                    <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 mx-auto text-2xl">
                        <i class="fa-solid fa-headset"></i>
                    </div>
                    <h4 class="font-bold text-gray-800">ศูนย์บริการลูกค้าสัมพันธ์</h4>
                    <p class="text-sm text-gray-500">เราพร้อมช่วยเหลือคุณตลอด 24 ชั่วโมง</p>
                    <div class="flex flex-col gap-2 max-w-xs mx-auto mt-4">
                        <a href="mailto:support@conwork.app" class="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-sm text-gray-700">
                            <i class="fa-regular fa-envelope text-gray-400"></i> support@conwork.app
                        </a>
                        <a href="tel:021234567" class="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-sm text-gray-700">
                            <i class="fa-solid fa-phone text-gray-400"></i> 02-123-4567
                        </a>
                    </div>
                </div>
            `;
        }

        modal.classList.remove('hidden');
        if (window.I18n) window.I18n.applyTranslations();
    },

    closeHelpContent() {
        const modal = document.getElementById('help-content-modal');
        if (modal) modal.classList.add('hidden');
    },

    closeHelp() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },

    logout() {
        this.state.currentUser = null;
        try {
            sessionStorage.removeItem('conwork_user');
            localStorage.removeItem('conwork_user');
            localStorage.removeItem('currentUser');
        } catch (e) { }
        
        const dropdown = document.getElementById('profile-menu-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
        
        if (typeof window.logout === 'function') {
            window.logout();
        } else {
            this.showLogin();
        }

        if (typeof updateLandingAuthState === 'function') {
            updateLandingAuthState();
        }
    },

    simulateRole(userId) {
        const user = mockUsers.find(u => u.id == userId);
        if (user) {
            try { sessionStorage.setItem('conwork_user', JSON.stringify(user)); } catch (e) { }
            location.reload();
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Auto-sync data across tabs
window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('conwork_')) {
        // Reload mock data into memory
        App._loadData();

        // Re-render the current view if user is logged in
        if (App.state && App.state.currentUser && App.state.currentView) {
            // Update currentUser reference to reflect role/permission changes instantly across tabs
            const freshUser = mockUsers.find(u => u.id == App.state.currentUser.id);
            if (freshUser) {
                App.state.currentUser = freshUser;
                App.renderSidebar();
            }

            // Check if team view is active to re-render the list
            if (App.state.currentView === 'team') {
                App.renderTeam();
            } else if (App.state.currentView === 'projects') {
                App.renderProjects();
            }
        }
    }
});









