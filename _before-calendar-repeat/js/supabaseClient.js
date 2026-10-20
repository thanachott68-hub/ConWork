/**
 * ConWork Supabase Integration Client Service
 * Encapsulates Supabase Auth, Multi-tenant Workspaces, Projects, Tasks, Realtime Chat, and Calendar Events.
 */

class ConWorkSupabaseService {
    constructor() {
        this.client = null;
        this.initialized = false;
        this.init();
    }

    init() {
        if (typeof supabase !== 'undefined' && window.CONWORK_CONFIG && window.CONWORK_CONFIG.USE_SUPABASE) {
            const url = window.CONWORK_CONFIG.SUPABASE_URL;
            const anonKey = window.CONWORK_CONFIG.SUPABASE_ANON_KEY;
            
            if (url && anonKey && url !== 'YOUR_SUPABASE_URL') {
                this.client = supabase.createClient(url, anonKey);
                this.initialized = true;
                console.log('✅ Supabase Client initialized successfully.');
            } else {
                console.warn('⚠️ Supabase URL or Anon Key not configured in js/config.js. Falling back to LocalStorage.');
            }
        } else {
            console.log('ℹ️ LocalStorage mode active. Supabase disabled or SDK not loaded.');
        }
    }

    isAvailable() {
        return this.initialized && this.client !== null;
    }

    // ==========================================
    // 1. AUTHENTICATION & ONBOARDING
    // ==========================================

    async signUp({ email, password, fullName, accountType = 'personal' }) {
        if (!this.isAvailable()) return null;

        const { data, error } = await this.client.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    account_type: accountType
                }
            }
        });

        if (error) throw error;
        return data;
    }

    async signIn({ email, password }) {
        if (!this.isAvailable()) return null;

        const { data, error } = await this.client.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        return data;
    }

    async signOut() {
        if (!this.isAvailable()) return null;
        const { error } = await this.client.auth.signOut();
        if (error) throw error;
    }

    async getCurrentUser() {
        if (!this.isAvailable()) return null;
        const { data: { user } } = await this.client.auth.getUser();
        return user;
    }

    async updateUserProfile({ userId, fullName, avatarUrl, department, role, jobTitle, companyId }) {
        if (!this.isAvailable() || !userId) return null;

        try {
            const profileUpdates = { id: userId, updated_at: new Date().toISOString() };
            if (fullName !== undefined) profileUpdates.full_name = fullName;
            if (avatarUrl !== undefined) profileUpdates.avatar_url = avatarUrl;
            if (department !== undefined) profileUpdates.department = department;
            if (jobTitle !== undefined) profileUpdates.job_title = jobTitle;

            if (Object.keys(profileUpdates).length > 1) {
                const { error: profErr } = await this.client
                    .from('profiles')
                    .upsert(profileUpdates);

                if (profErr) {
                    console.error('Supabase profile upsert error:', profErr);
                }
            }

            const memberUpdates = {};
            if (role !== undefined) {
                memberUpdates.company_role = role;
            }
            if (department !== undefined) {
                memberUpdates.department = department;
            }
            if (Object.keys(memberUpdates).length > 0) {
                let query = this.client.from('company_members').update(memberUpdates).eq('user_id', userId);
                if (companyId) {
                    query = query.eq('company_id', companyId);
                }
                await query;
            }
            return { userId, fullName, avatarUrl, department, role, jobTitle };
        } catch (err) {
            console.warn('Supabase profile update warning:', err);
            return null;
        }
    }

    // ==========================================
    // 2. COMPANY & SUBSCRIPTIONS
    // ==========================================

    async createCompany({ name, domain, isPersonal = false, planName = 'Free Tier' }) {
        if (!this.isAvailable()) return null;

        const user = await this.getCurrentUser();
        if (!user) throw new Error('User must be logged in to create a company.');

        const inviteCode = 'COMP-' + Math.random().toString(36).substring(2, 6).toUpperCase();

        // Insert Company
        const { data: company, error: compError } = await this.client
            .from('companies')
            .insert([{
                name: name,
                code: inviteCode,
                domain: domain,
                is_personal: isPersonal,
                created_by: user.id
            }])
            .select()
            .single();

        if (compError) throw compError;

        // Add creator as Super Admin
        const { error: memError } = await this.client
            .from('company_members')
            .upsert([{
                company_id: company.id,
                user_id: user.id,
                company_role: 'super_admin',
                department: 'Management'
            }], { onConflict: 'company_id,user_id' });

        if (memError && memError.code !== '23505') throw memError;

        // Assign Subscription Plan
        const { data: plan } = await this.client
            .from('subscription_plans')
            .select('id')
            .eq('name', planName)
            .single();

        if (plan) {
            await this.client
                .from('company_subscriptions')
                .insert([{
                    company_id: company.id,
                    plan_id: plan.id,
                    status: 'active'
                }]);
        }

        return company;
    }

    async joinCompanyByCode(inviteCode) {
        if (!this.isAvailable()) return null;

        const user = await this.getCurrentUser();
        if (!user) throw new Error('User must be logged in.');

        const { data: company, error: compErr } = await this.client
            .from('companies')
            .select('id, name')
            .eq('code', inviteCode.trim().toUpperCase())
            .single();

        if (compErr || !company) throw new Error('Invalid company invite code.');

        const { data: member, error: memErr } = await this.client
            .from('company_members')
            .upsert([{
                company_id: company.id,
                user_id: user.id,
                company_role: 'employee'
            }], { onConflict: 'company_id,user_id' })
            .select()
            .single();

        if (memErr && memErr.code !== '23505') throw memErr;
        return { company, member };
    }

    // ==========================================
    // 3. PROJECTS & TASKS
    // ==========================================

    async fetchProjects(companyId) {
        if (!this.isAvailable()) return [];

        const { data, error } = await this.client
            .from('projects')
            .select(`
                *,
                project_members ( user_id, project_role )
            `)
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    async createProject({ companyId, name, description, dueDate }) {
        if (!this.isAvailable()) return null;

        const user = await this.getCurrentUser();
        const { data: project, error } = await this.client
            .from('projects')
            .insert([{
                company_id: companyId,
                owner_id: user.id,
                name: name,
                description: description,
                due_date: dueDate
            }])
            .select()
            .single();

        if (error) throw error;
        return project;
    }

    async fetchTasks(projectId) {
        if (!this.isAvailable()) return [];

        const { data, error } = await this.client
            .from('tasks')
            .select(`
                *,
                task_assignees ( user_id )
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    }

    async createTask({ projectId, sectionId, title, description, priority, dueDate, assigneeIds = [] }) {
        if (!this.isAvailable()) return null;

        const user = await this.getCurrentUser();
        const { data: task, error: taskErr } = await this.client
            .from('tasks')
            .insert([{
                project_id: projectId,
                section_id: sectionId,
                creator_id: user.id,
                title: title,
                description: description,
                priority: priority || 'medium',
                due_date: dueDate
            }])
            .select()
            .single();

        if (taskErr) throw taskErr;

        if (assigneeIds.length > 0) {
            const assignees = assigneeIds.map(uid => ({
                task_id: task.id,
                user_id: uid
            }));
            await this.client.from('task_assignees').insert(assignees);
        }

        // Auto-create Deadline event in Calendar if due_date set
        if (dueDate) {
            const { data: project } = await this.client.from('projects').select('company_id').eq('id', projectId).single();
            if (project) {
                await this.client.from('events').insert([{
                    company_id: project.company_id,
                    project_id: projectId,
                    task_id: task.id,
                    organizer_id: user.id,
                    title: `Deadline: ${title}`,
                    event_type: 'task_deadline',
                    start_time: dueDate,
                    end_time: dueDate
                }]);
            }
        }

        return task;
    }

    // ==========================================
    // 4. REAL-TIME CHAT
    // ==========================================

    async getOrCreateDirectChannel(targetUserId) {
        if (!this.isAvailable() || !targetUserId) return null;
        const user = await this.getCurrentUser();
        if (!user) return null;

        if (targetUserId === 'note' || String(targetUserId) === String(user.id)) {
            return this.getOrCreatePersonalNoteChannel();
        }

        try {
            const { data: myMemberships } = await this.client
                .from('chat_channel_members')
                .select('channel_id')
                .eq('user_id', user.id);

            if (myMemberships && myMemberships.length > 0) {
                const cIds = myMemberships.map(m => m.channel_id);
                const { data: shared } = await this.client
                    .from('chat_channel_members')
                    .select('channel_id, chat_channels!inner(type)')
                    .eq('user_id', targetUserId)
                    .in('channel_id', cIds)
                    .eq('chat_channels.type', 'direct');

                if (shared && shared.length > 0) {
                    return shared[0].channel_id;
                }
            }

            const { data: newChan, error: chanErr } = await this.client
                .from('chat_channels')
                .insert([{
                    name: 'Direct Chat',
                    type: 'direct'
                }])
                .select()
                .single();

            if (chanErr || !newChan) {
                console.error('Error creating direct chat channel:', chanErr);
                return null;
            }

            await this.client.from('chat_channel_members').insert([
                { channel_id: newChan.id, user_id: user.id },
                { channel_id: newChan.id, user_id: targetUserId }
            ]);

            return newChan.id;
        } catch (e) {
            console.error('getOrCreateDirectChannel error:', e);
            return null;
        }
    }

    async fetchUserDirectChannels() {
        if (!this.isAvailable()) return [];
        const user = await this.getCurrentUser();
        if (!user) return [];

        try {
            const { data: memberships, error: memErr } = await this.client
                .from('chat_channel_members')
                .select('channel_id, chat_channels!inner(id, name, type, company_id, project_id)')
                .eq('user_id', user.id);

            if (memErr || !memberships) return [];

            const channels = [];
            for (const m of memberships) {
                const chan = m.chat_channels;
                if (!chan) continue;

                if (chan.name === 'พื้นที่ส่วนตัว (Note)') {
                    channels.push({
                        id: 'note',
                        supabaseChannelId: chan.id,
                        name: 'พื้นที่ส่วนตัว (Note)',
                        subtitle: 'จดบันทึกและฝากงานตัวเอง',
                        type: 'personal',
                        icon: 'fa-bookmark',
                        color: 'bg-blue-600',
                        status: 'online',
                        unreadCount: 0
                    });
                    continue;
                }

                const { data: otherMembers } = await this.client
                    .from('chat_channel_members')
                    .select('user_id, profiles(id, full_name, avatar_url, department, email)')
                    .eq('channel_id', chan.id)
                    .neq('user_id', user.id);

                let otherUser = null;
                if (otherMembers && otherMembers.length > 0 && otherMembers[0].profiles) {
                    otherUser = otherMembers[0].profiles;
                }

                const targetUserId = otherUser ? otherUser.id : (otherMembers && otherMembers[0] ? otherMembers[0].user_id : chan.id);
                const targetName = otherUser ? (otherUser.full_name || (otherUser.email ? otherUser.email.split('@')[0] : 'ผู้ใช้')) : (chan.name || 'การสนทนา');
                const targetSubtitle = otherUser ? (otherUser.department ? `${otherUser.department}` : 'พนักงาน') : (chan.type === 'direct' ? 'ส่วนตัว' : 'กรุ๊ป');

                channels.push({
                    id: 'user-' + targetUserId,
                    supabaseChannelId: chan.id,
                    userId: targetUserId,
                    name: targetName,
                    subtitle: targetSubtitle,
                    avatar: otherUser?.avatar_url,
                    type: chan.type === 'direct' ? 'personal' : 'group',
                    icon: 'fa-user',
                    color: 'bg-blue-500',
                    status: 'online',
                    unreadCount: 0
                });
            }

            return channels;
        } catch (e) {
            console.error('fetchUserDirectChannels error:', e);
            return [];
        }
    }

    async getOrCreatePersonalNoteChannel() {
        if (!this.isAvailable()) return null;
        const user = await this.getCurrentUser();
        if (!user) return null;

        try {
            const { data: myMemberships } = await this.client
                .from('chat_channel_members')
                .select('channel_id, chat_channels!inner(type, name)')
                .eq('user_id', user.id)
                .eq('chat_channels.name', 'พื้นที่ส่วนตัว (Note)');

            if (myMemberships && myMemberships.length > 0) {
                return myMemberships[0].channel_id;
            }

            const { data: newChan, error: chanErr } = await this.client
                .from('chat_channels')
                .insert([{
                    name: 'พื้นที่ส่วนตัว (Note)',
                    type: 'direct'
                }])
                .select()
                .single();

            if (chanErr || !newChan) {
                console.error('Error creating personal note channel:', chanErr);
                return null;
            }

            await this.client.from('chat_channel_members').insert([{
                channel_id: newChan.id,
                user_id: user.id
            }]);

            return newChan.id;
        } catch (e) {
            console.error('getOrCreatePersonalNoteChannel error:', e);
            return null;
        }
    }

    async fetchMessages(channelId) {
        if (!this.isAvailable() || !channelId) return [];

        const { data, error } = await this.client
            .from('chat_messages')
            .select(`
                *,
                profiles ( id, full_name, avatar_url )
            `)
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data;
    }

    async sendMessage(channelId, content) {
        if (!this.isAvailable()) return null;

        const user = await this.getCurrentUser();
        const payload = {
            channel_id: channelId,
            sender_id: user ? user.id : 'anonymous',
            content: content,
            created_at: new Date().toISOString()
        };

        if (this.activeChannels && this.activeChannels[channelId]) {
            try {
                this.activeChannels[channelId].send({
                    type: 'broadcast',
                    event: 'new_message',
                    payload: payload
                });
            } catch (e) {
                console.warn('Broadcast send warning:', e);
            }
        }

        const { data, error } = await this.client
            .from('chat_messages')
            .insert([{
                channel_id: channelId,
                sender_id: user ? user.id : null,
                content: content
            }])
            .select()
            .single();

        if (error) {
            console.warn('Supabase DB insert notice:', error.message);
        }
        return data || payload;
    }

    subscribeGlobalUserMessages(onNewMessageCallback) {
        if (!this.isAvailable()) return null;

        if (this.globalMsgChannel) {
            try { this.client.removeChannel(this.globalMsgChannel); } catch (e) {}
        }

        const channel = this.client.channel('global_user_chat_messages');
        channel.on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages'
        }, payload => {
            if (payload && payload.new) {
                onNewMessageCallback(payload.new);
            }
        });

        channel.subscribe();
        this.globalMsgChannel = channel;
        return channel;
    }

    subscribeToChannelMessages(channelId, onNewMessageCallback, onPresenceCallback = null) {
        if (!this.isAvailable()) return null;

        if (!this.activeChannels) this.activeChannels = {};

        if (this.activeChannels[channelId]) {
            try {
                this.client.removeChannel(this.activeChannels[channelId]);
            } catch (e) {}
        }

        const channel = this.client.channel(`room:${channelId}`, {
            config: {
                presence: { key: channelId }
            }
        });

        // 1. Listen to Postgres DB changes
        channel.on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `channel_id=eq.${channelId}`
        }, payload => {
            if (payload && payload.new) {
                onNewMessageCallback(payload.new);
            }
        });

        // 2. Listen to Realtime Broadcast messages (Instant cross-server/cross-device)
        channel.on('broadcast', { event: 'new_message' }, payload => {
            if (payload && payload.payload) {
                onNewMessageCallback(payload.payload);
            }
        });

        // 3. Listen to Realtime Presence State (Online/Offline status)
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const isOnline = Object.keys(state).length > 0;
            if (onPresenceCallback) {
                onPresenceCallback(isOnline, state);
            }
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                const currentUser = await this.getCurrentUser();
                await channel.track({
                    user_id: currentUser ? currentUser.id : 'anon',
                    online_at: new Date().toISOString()
                });
            }
        });

        this.activeChannels[channelId] = channel;
        return channel;
    }

    // ==========================================
    // 5. CALENDAR EVENTS
    // ==========================================

    async fetchCalendarEvents(companyIds) {
        if (!this.isAvailable()) return [];

        let query = this.client.from('events').select('*').order('start_time', { ascending: true });
        
        if (Array.isArray(companyIds) && companyIds.length > 0) {
            query = query.in('company_id', companyIds);
        } else if (companyIds) {
            query = query.eq('company_id', companyIds);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
    }

    async createCalendarEvent(eventData) {
        if (!this.isAvailable()) return null;
        
        const { data, error } = await this.client
            .from('events')
            .insert([eventData])
            .select()
            .single();
            
        if (error) throw error;
        
        // Also insert attendees if any
        if (eventData.attendee_ids && eventData.attendee_ids.length > 0 && data.id) {
            const attendees = eventData.attendee_ids.map(uid => ({
                event_id: data.id,
                user_id: uid,
                status: 'pending'
            }));
            await this.client.from('event_attendees').insert(attendees);
        }
        
        return data;
    }

    async updateCalendarEvent(eventId, updateData) {
        if (!this.isAvailable()) return null;
        
        // Separate attendee_ids from main update data
        const { attendee_ids, ...mainData } = updateData;
        
        if (Object.keys(mainData).length > 0) {
            const { data, error } = await this.client
                .from('events')
                .update(mainData)
                .eq('id', eventId)
                .select()
                .single();
                
            if (error) throw error;
        }
        
        // Handle attendees update if provided
        if (attendee_ids !== undefined) {
            // Very simple approach: delete old and insert new (for a real app we might want to diff)
            await this.client.from('event_attendees').delete().eq('event_id', eventId);
            if (attendee_ids.length > 0) {
                const attendees = attendee_ids.map(uid => ({
                    event_id: eventId,
                    user_id: uid,
                    status: 'pending'
                }));
                await this.client.from('event_attendees').insert(attendees);
            }
        }
        
        return { id: eventId, ...updateData };
    }

    async deleteCalendarEvent(eventId) {
        if (!this.isAvailable()) return null;
        
        // Due to cascading deletes (or manually), delete attendees first
        await this.client.from('event_attendees').delete().eq('event_id', eventId);
        
        const { error } = await this.client
            .from('events')
            .delete()
            .eq('id', eventId);
            
        if (error) throw error;
        return true;
    }
}

// Global Singleton Instance
window.conworkSupabase = new ConWorkSupabaseService();
