// ConWork Application Logic
const app = {
    data: null,
    currentView: 'projects',
    currentProject: null,
    
    // Initialize App
    async init() {
        this.bindLogin();
        await this.loadData();
    },

    // Mock Load JSON Data
    async loadData() {
        try {
            const res = await fetch('data.json');
            this.data = await res.json();
            console.log("Data loaded", this.data);
        } catch (error) {
            console.error("Failed to load mock data:", error);
        }
    },

    // Authentication Logic
    bindLogin() {
        const loginForm = document.getElementById('login-form');
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            // Mock authentication
            this.loginSuccess();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            document.getElementById('app-screen').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        });
    },

    loginSuccess() {
        // Setup User Info
        document.getElementById('current-user-name').innerText = this.data.currentUser.name;
        document.getElementById('current-user-dept').innerText = this.data.currentUser.role;
        document.getElementById('current-user-avatar').src = this.data.currentUser.avatar;

        // Switch screen
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');

        // Setup Navigation
        this.setupNavigation();
        
        // Initial render
        this.switchView('projects');
    },

    // Navigation Logic
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                // Remove active class
                navItems.forEach(nav => nav.classList.remove('active'));
                // Add active class
                item.classList.add('active');
                
                const view = item.getAttribute('data-view');
                this.switchView(view);
            });
        });
    },

    switchView(viewName) {
        this.currentView = viewName;
        
        // Hide all views
        document.querySelectorAll('.view-section').forEach(v => v.classList.add('hidden'));
        
        // Update Title
        const titleMap = {
            'projects': { title: 'งานทั้งหมด', sub: '' },
            'tasks': { title: 'จัดการงาน (Tasks)', sub: '' },
            'messages': { title: 'ข้อความ', sub: '' },
            'calendar': { title: 'ปฏิทิน', sub: '' },
            'team': { title: 'ทีมงาน', sub: 'รายชื่อพนักงานทั้งหมดในบริษัท' }
        };
        const titleEl = document.getElementById('main-header-title');
        const subtitleEl = document.getElementById('main-header-subtitle');
        if (titleEl) titleEl.innerText = titleMap[viewName].title;
        if (subtitleEl) subtitleEl.innerText = titleMap[viewName].sub;

        // Show specific view & render content
        const viewEl = document.getElementById(`view-${viewName}`);
        if(viewEl) viewEl.classList.remove('hidden');

        switch(viewName) {
            case 'projects': this.renderProjects(); break;
            case 'tasks': this.renderTasks(); break;
            case 'messages': this.renderMessages(); break;
            case 'calendar': this.initCalendar(); break;
            case 'team': this.renderTeam(); break;
        }
    },

    // 1. Projects View
    renderProjects() {
        const container = document.getElementById('projects-container');
        container.innerHTML = '';
        
        this.data.projects.forEach(proj => {
            const memAvatars = proj.members.map(mId => {
                const user = this.data.users.find(u => u.id === mId);
                return user ? `<img src="${user.avatar}" title="${user.name}">` : '';
            }).join('');

            const card = document.createElement('div');
            card.className = 'project-card glass-panel';
            card.innerHTML = `
                <div class="project-header">
                    <div>
                        <div class="project-title">${proj.name}</div>
                        <div class="project-desc">${proj.description}</div>
                    </div>
                    <i class="fa-solid fa-ellipsis-vertical text-muted"></i>
                </div>
                <div class="progress-container">
                    <div class="progress-header">
                        <span>ความคืบหน้า</span>
                        <span>${proj.progress}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${proj.progress}%"></div>
                    </div>
                </div>
                <div class="project-footer">
                    <div class="member-avatars">${memAvatars}</div>
                    <div class="due-date"><i class="fa-regular fa-clock"></i> ${proj.dueDate}</div>
                </div>
            `;
            
            card.onclick = () => {
                this.currentProject = proj;
                this.switchView('tasks');
            };
            
            container.appendChild(card);
        });
    },

    // 1.1 Tasks View
    renderTasks() {
        if(!this.currentProject) return;
        document.getElementById('task-project-name').innerText = this.currentProject.name;
        
        const tasks = this.data.tasks.filter(t => t.projectId === this.currentProject.id);
        
        const cols = {
            'todo': document.querySelector('#col-todo .column-body'),
            'in-progress': document.querySelector('#col-in-progress .column-body'),
            'done': document.querySelector('#col-done .column-body')
        };
        
        // Clear columns
        Object.values(cols).forEach(col => col.innerHTML = '');
        
        tasks.forEach(task => {
            const assignee = this.data.users.find(u => u.id === task.assigneeId);
            const card = document.createElement('div');
            card.className = 'task-card';
            card.innerHTML = `
                <h5>${task.title}</h5>
                <div class="task-meta">
                    <div class="task-icons">
                        <span title="Due Date"><i class="fa-regular fa-calendar"></i> ${task.dueDate.split('-')[2]}</span>
                        <span title="Comments"><i class="fa-regular fa-comment"></i> ${task.comments.length}</span>
                    </div>
                    <img src="${assignee ? assignee.avatar : ''}" title="${assignee ? assignee.name : 'Unassigned'}">
                </div>
            `;
            if(cols[task.status]) {
                cols[task.status].appendChild(card);
            }
        });

        // Update counts
        document.querySelector('#col-todo .count').innerText = cols['todo'].children.length;
        document.querySelector('#col-in-progress .count').innerText = cols['in-progress'].children.length;
        document.querySelector('#col-done .count').innerText = cols['done'].children.length;
    },

    // 2. Messages View
    selectChat(chatId) {
        document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
        event.currentTarget.classList.add('active');
        
        // Update header based on mock logic
        let title = "แชท";
        if(chatId === 'personal') title = "พื้นที่ส่วนตัว (Note)";
        if(chatId === 'group-sales') title = "ทีมเซลล์ (Sales)";
        
        document.querySelector('#active-chat-title h3').innerText = title;
        this.renderChatMessages(chatId);
    },

    renderChatMessages(chatId) {
        const container = document.getElementById('chat-messages-container');
        container.innerHTML = '';
        
        const msgs = this.data.messages.filter(m => m.chatId === chatId || (chatId === 'personal' && m.chatId === 'personal'));
        
        msgs.forEach(msg => {
            const isMe = msg.from === this.data.currentUser.id;
            const div = document.createElement('div');
            div.className = `msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;
            div.innerHTML = `
                ${msg.text}
                <span class="msg-time">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            `;
            container.appendChild(div);
        });
    },

    sendMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if(!text) return;
        
        const container = document.getElementById('chat-messages-container');
        const div = document.createElement('div');
        div.className = `msg-bubble msg-sent`;
        div.innerHTML = `
            ${text}
            <span class="msg-time">ตอนนี้</span>
        `;
        container.appendChild(div);
        input.value = '';
        container.scrollTop = container.scrollHeight;
    },

    // 3. Calendar View
    initCalendar() {
        // Setup project dropdown
        const select = document.getElementById('cal-project-select');
        select.innerHTML = '<option value="">เลือกโครงการ...</option>';
        this.data.projects.forEach(p => {
            select.innerHTML += `<option value="${p.id}">${p.name}</option>`;
        });
        
        document.querySelectorAll('input[name="cal-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if(e.target.value === 'project') {
                    select.classList.remove('hidden');
                } else {
                    select.classList.add('hidden');
                }
            });
        });
        
        this.renderCalendar();
    },

    renderCalendar() {
        const type = document.querySelector('input[name="cal-type"]:checked').value;
        const selectedProj = document.getElementById('cal-project-select').value;
        
        const container = document.getElementById('cal-days-container');
        container.innerHTML = '';
        
        // Mock a month grid (start on Friday to match May 2026 roughly)
        for(let i = 0; i < 5; i++) {
            container.innerHTML += `<div class="cal-day opacity-50"></div>`; // Empty slots
        }
        
        for(let d = 1; d <= 31; d++) {
            const dateStr = `2026-05-${d.toString().padStart(2, '0')}`;
            let eventsHtml = '';
            
            this.data.events.forEach(ev => {
                if(ev.date === dateStr) {
                    let show = false;
                    if(type === 'all') show = true;
                    if(type === 'personal' && ev.type === 'personal') show = true;
                    if(type === 'project' && ev.type === 'project') {
                        if(!selectedProj || selectedProj == ev.projectId) show = true;
                    }
                    
                    if(show) {
                        eventsHtml += `<div class="cal-event event-${ev.type}">${ev.time ? ev.time+' ' : ''}${ev.title}</div>`;
                    }
                }
            });
            
            const isToday = d === 27 ? 'today' : '';
            container.innerHTML += `
                <div class="cal-day ${isToday}">
                    <span class="date-num">${d}</span>
                    ${eventsHtml}
                </div>
            `;
        }
    },

    // 4. Team View
    renderTeam() {
        const container = document.getElementById('org-chart-container');
        container.innerHTML = '';
        
        const departments = this.data.departments;
        departments.forEach(dept => {
            const members = this.data.users.filter(u => u.department === dept.name);
            if(members.length === 0) return;
            
            const deptHtml = document.createElement('div');
            deptHtml.className = 'dept-section';
            
            let membersHtml = members.map(m => `
                <div class="team-member-card">
                    <img src="${m.avatar}" alt="${m.name}">
                    <div class="member-info">
                        <h4>${m.name}</h4>
                        <p>${m.role}</p>
                    </div>
                </div>
            `).join('');

            deptHtml.innerHTML = `
                <h3 class="dept-title"><i class="fa-solid fa-sitemap"></i> ${dept.name}</h3>
                <div class="dept-grid">
                    ${membersHtml}
                </div>
            `;
            container.appendChild(deptHtml);
        });
    }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
