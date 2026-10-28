// js/apiService.js
/**
 * Service Layer สำหรับจัดการการสื่อสารระหว่าง Frontend กับ Database (ผ่าน API)
 * ระบบถูกออกแบบให้อยู่ในรูปแบบ Asynchronous (async/await) เพื่อเตรียมพร้อมรับการเปลี่ยน
 * จาก Mock Data เป็นการเชื่อมต่อฐานข้อมูลจริงผ่าน Fetch API หรือ Axios
 */

const ApiService = {
    // -----------------------------------------
    // Helper จำลองเวลาตอบสนองจาก Database (ลบออกเมื่อเชื่อม API จริง)
    // -----------------------------------------
    _delay(ms = 300) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // -----------------------------------------
    // ตั้งค่า HTTP Headers สำหรับการเรียก API
    // -----------------------------------------
    _getHeaders() {
        const token = localStorage.getItem(`${CONFIG.STORAGE_PREFIX}auth_token`);
        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        };
    },

    // ==========================================
    // 1. Projects API
    // ==========================================
    
    async getProjects() {
        // [โค้ดเมื่อต่อ Database จริง]
        // const response = await fetch(`${CONFIG.API_BASE_URL}/projects`, { headers: this._getHeaders() });
        // return await response.json();
        
        await this._delay();
        return mockProjects; // ดึงข้อมูล Mock 
    },

    async getProjectById(projectId) {
        await this._delay();
        return mockProjects.find(p => p.id === projectId);
    },

    async createProject(projectData) {
        // [โค้ดเมื่อต่อ Database จริง]
        // const response = await fetch(`${CONFIG.API_BASE_URL}/projects`, {
        //     method: 'POST',
        //     headers: this._getHeaders(),
        //     body: JSON.stringify(projectData)
        // });
        // return await response.json();
        
        await this._delay();
        mockProjects.push(projectData);
        return projectData;
    },

    async updateProject(projectId, updateData) {
        await this._delay();
        const index = mockProjects.findIndex(p => p.id === projectId);
        if (index > -1) {
            mockProjects[index] = { ...mockProjects[index], ...updateData };
            return mockProjects[index];
        }
        throw new Error('Project not found');
    },

    async deleteProject(projectId) {
        await this._delay();
        const index = mockProjects.findIndex(p => p.id === projectId);
        if (index > -1) {
            // Soft delete เพื่อให้กู้คืนได้ หรือเป็น Hard delete ตามฐานข้อมูล
            mockProjects[index].status = 'deleted';
            return true;
        }
        throw new Error('Project not found');
    },

    // ==========================================
    // 2. Tasks API
    // ==========================================
    
    async getTasks(projectId = null) {
        await this._delay();
        if (projectId) {
            return mockTasks.filter(t => t.projectId === projectId);
        }
        return mockTasks;
    },

    async createTask(taskData) {
        await this._delay();
        mockTasks.push(taskData);
        return taskData;
    },

    async updateTaskStatus(taskId, status) {
        await this._delay();
        const task = mockTasks.find(t => t.id === taskId);
        if (task) {
            task.status = status;
            return task;
        }
        throw new Error('Task not found');
    },

    // ==========================================
    // 3. Auth & Users API
    // ==========================================
    
    // Supabase Authentication Integration
    async login(email, password) {
        try {
            if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
                const data = await window.conworkSupabase.signIn({ email, password });
                if (data && data.user) {
                    const user = data.user;
                    localStorage.setItem(`conwork_auth_token`, data.session?.access_token || 'supabase_token');
                    
                    // Fetch profile info from Supabase if needed, or build a mock user object based on auth
                    return {
                        id: user.id,
                        email: user.email,
                        username: user.email.split('@')[0],
                        name: user.user_metadata?.full_name || user.email.split('@')[0],
                        role: 'worker',
                        department: '',
                        avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.user_metadata?.full_name || 'User') + '&background=random'
                    };
                }
            }
            throw new Error("Supabase is not initialized. Please check your js/config.js setup.");
        } catch (error) {
            console.warn("Supabase Login Failed:", error);
            throw new Error(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        }
    },

    async register(name, email, password, role) {
        try {
            if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
                const data = await window.conworkSupabase.signUp({ 
                    email, 
                    password, 
                    fullName: name,
                    accountType: 'personal'
                });
                
                if (data && data.user) {
                    const user = data.user;
                    // Note: In a real app, you might want to insert the user role into a 'profiles' table here.
                    return {
                        id: user.id,
                        email: user.email,
                        username: user.email.split('@')[0],
                        name: user.user_metadata?.full_name || name,
                        role: role || 'worker',
                        department: '',
                        avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random'
                    };
                }
            }
            throw new Error("Supabase is not initialized. Please check your js/config.js setup.");
        } catch (error) {
            console.error("Supabase Register Error:", error);
            throw new Error(error.message || 'ไม่สามารถสมัครสมาชิกได้ เกิดข้อผิดพลาดกับ Supabase');
        }
    },

    async getUsers() {
        await this._delay();
        return mockUsers;
    }
};
