/**
 * ConWork Supabase Integration Client Service
 * Encapsulates Supabase Auth, Multi-tenant Workspaces, Projects, Tasks, Realtime Chat, and Calendar Events.
 */

/* ===================================================================================================
 * Where things live:
 *   Supabase  → sign-in only (auth.*)
 *   Neon      → all data (.from / .rpc through Neon's Data API, which checks the Supabase sign-in token),
 *               files (Neon file service) and "live" updates (polling the Data API instead of Supabase Realtime)
 * The rest of the app keeps calling window.conworkSupabase.client.* exactly as before; this object sends each call
 * to the right place.
 * =================================================================================================== */

/* files: the same calls the app used on Supabase Storage (upload / createSignedUrl / remove), sent to the Neon file service */
function cwFileStorage(baseUrl, getToken) {
    const call = async (method, path, query, body, contentType) => {
        const token = await getToken();
        if (!token) return { data: null, error: { message: 'Not signed in' } };
        const qs = new URLSearchParams(Object.assign({ path }, query || {})).toString();
        try {
            const res = await fetch(`${baseUrl}/${method === 'POST' ? 'upload' : method === 'DELETE' ? 'file' : 'url'}?${qs}`, {
                method,
                headers: Object.assign({ Authorization: `Bearer ${token}` }, contentType ? { 'Content-Type': contentType } : {}),
                body
            });
            const text = await res.text();
            let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { }
            if (!res.ok) return { data: null, error: { message: (json && (json.error || json.message)) || text || `HTTP ${res.status}`, status: res.status } };
            return { data: json, error: null };
        } catch (e) { return { data: null, error: { message: e.message || String(e) } }; }
    };
    return {
        from() {
            return {
                async upload(path, file, opts = {}) {
                    const type = opts.contentType || (file && file.type) || 'application/octet-stream';
                    const r = await call('POST', path, null, file, type);
                    return r.error ? r : { data: { path: (r.data && r.data.path) || path }, error: null };
                },
                async createSignedUrl(path, expiresIn = 3600, opts = {}) {
                    const q = { expires: String(expiresIn || 3600) };
                    if (opts && opts.download) q.download = typeof opts.download === 'string' ? opts.download : String(path).split('/').pop();
                    const r = await call('GET', path, q);
                    return r.error ? r : { data: { signedUrl: r.data && r.data.signedUrl }, error: null };
                },
                async remove(paths) {
                    const list = Array.isArray(paths) ? paths : [paths];
                    for (const p of list) { const r = await call('DELETE', p); if (r.error) return r; }
                    return { data: list.map(p => ({ name: p })), error: null };
                }
            };
        }
    };
}

/* live updates without Supabase Realtime: each listener asks the Neon Data API for what changed.
   Open chat room every 3 s, chat list / members 15 s, notifications 20 s, other tables 30 s; nothing while the tab is hidden.
   The callbacks get the same { new: row } payloads as Supabase's postgres_changes. */
function cwPollingChannels(getData) {
    const INTERVAL = { chat_messages: 3000, chat_channel_members: 15000, chat_channels: 15000, notifications: 20000 };
    const TIME_COL = { chat_messages: 'created_at', notifications: 'created_at', chat_channel_members: 'joined_at', company_members: 'joined_at', mail_messages: 'created_at', team_requests: 'created_at' };
    /* column that moves when a row changes, for the "any change" check (tables without one: row count only) */
    const CHANGE_COL = { profiles: 'updated_at', projects: 'updated_at', tasks: 'updated_at', companies: 'updated_at', company_members: 'joined_at', project_members: 'joined_at', notifications: 'created_at', chat_messages: 'created_at', chat_channel_members: 'joined_at', task_sections: null, task_assignees: null };
    const live = new Set();
    const parseFilter = f => {
        const m = /^([\w]+)=eq\.(.+)$/.exec(String(f || ''));
        return m ? { col: m[1], val: m[2] } : null;
    };
    const applyFilter = (q, f) => (f ? q.eq(f.col, f.val) : q);

    function makeWatcher(listener) {
        const { table, filter, event, cb } = listener;
        const f = parseFilter(filter);
        const tsCol = TIME_COL[table];
        const every = INTERVAL[table] || 30000;
        let last = null, fingerprint = null, timer = null, busy = false, ready = false;

        /* new rows (INSERT): everything after the newest row seen so far */
        const pollInserts = async () => {
            const db = getData();
            if (!ready) {
                const { data } = await applyFilter(db.from(table).select(tsCol), f).order(tsCol, { ascending: false }).limit(1);
                last = data && data[0] ? data[0][tsCol] : '1970-01-01T00:00:00Z';
                ready = true;
                return;
            }
            const { data, error } = await applyFilter(db.from(table).select('*'), f).gt(tsCol, last).order(tsCol, { ascending: true }).limit(100);
            if (error || !data || !data.length) return;
            last = data[data.length - 1][tsCol];
            data.forEach(row => { try { cb({ eventType: 'INSERT', table, new: row, old: null }); } catch (e) { console.warn('[live]', e); } });
        };
        /* any change ('*'): a cheap fingerprint (row count + newest timestamp); when it moves, tell the listener */
        const pollChanges = async () => {
            const db = getData();
            const col = table in CHANGE_COL ? CHANGE_COL[table] : null;
            const [cnt, newest] = await Promise.all([
                applyFilter(db.from(table).select('*', { count: 'exact', head: true }), f),
                col ? applyFilter(db.from(table).select(col), f).order(col, { ascending: false, nullsFirst: false }).limit(1) : Promise.resolve({ data: null })
            ]);
            if (cnt.error) return;
            const fp = `${cnt.count ?? '?'}|${col && newest.data && newest.data[0] ? newest.data[0][col] : ''}`;
            if (fingerprint !== null && fp !== fingerprint) { try { cb({ eventType: '*', table, new: null, old: null }); } catch (e) { console.warn('[live]', e); } }
            fingerprint = fp;
        };
        const tick = async () => {
            if (busy || document.hidden) return;
            busy = true;
            try { if (event === 'INSERT' && tsCol) await pollInserts(); else await pollChanges(); }
            catch (e) { /* network hiccup: try again next time */ }
            finally { busy = false; }
        };
        return {
            start() { tick(); timer = setInterval(tick, every); },
            stop() { if (timer) clearInterval(timer); timer = null; },
            tick
        };
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) live.forEach(ch => ch._watchers.forEach(w => w.tick()));
    });

    return {
        channel(name) {
            const listeners = [];
            const ch = {
                _name: name, _watchers: [],
                on(type, opts, cb) {
                    /* broadcast and presence need Realtime: not available on Neon (messages still arrive by polling) */
                    if (type === 'postgres_changes' && opts && opts.table) listeners.push({ table: opts.table, filter: opts.filter, event: opts.event || '*', cb });
                    return ch;
                },
                subscribe(statusCb) {
                    ch._watchers.forEach(w => w.stop());
                    ch._watchers = listeners.map(makeWatcher);
                    ch._watchers.forEach(w => w.start());
                    live.add(ch);
                    if (typeof statusCb === 'function') setTimeout(() => statusCb('SUBSCRIBED'), 0);
                    return ch;
                },
                unsubscribe() { ch._watchers.forEach(w => w.stop()); ch._watchers = []; live.delete(ch); return Promise.resolve('ok'); },
                send() { return Promise.resolve('ok'); },
                track() { return Promise.resolve('ok'); },
                untrack() { return Promise.resolve('ok'); },
                presenceState() { return {}; }
            };
            return ch;
        },
        removeChannel(ch) { if (ch && ch.unsubscribe) ch.unsubscribe(); return Promise.resolve('ok'); },
        removeAllChannels() { [...live].forEach(ch => ch.unsubscribe()); return Promise.resolve([]); },
        getChannels() { return [...live]; }
    };
}

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
            const neonUrl = window.CONWORK_CONFIG.NEON_DATA_URL;
            const filesUrl = window.CONWORK_CONFIG.NEON_FILES_URL;

            if (url && anonKey && url !== 'YOUR_SUPABASE_URL') {
                /* 1) Supabase: sign-in only */
                const authClient = supabase.createClient(url, anonKey);
                this.authClient = authClient;
                const token = async () => {
                    try { const { data } = await authClient.auth.getSession(); return (data && data.session && data.session.access_token) || null; }
                    catch (e) { return null; }
                };
                /* 2) Neon Data API: same tables, functions and access rules; it checks the Supabase token */
                /* signed out, supabase-js would send the publishable key as "Bearer …"; Neon only accepts sign-in tokens there,
                   so drop a value that is not a JWT and let the request go as anonymous */
                const neonFetch = (input, init = {}) => {
                    const h = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
                    const a = h.get('Authorization') || '';
                    if (a && String(a).replace(/^Bearer\s+/i, '').split('.').length !== 3) h.delete('Authorization');
                    return fetch(input, Object.assign({}, init, { headers: h }));
                };
                const dataClient = neonUrl ? supabase.createClient(neonUrl, anonKey, {
                    accessToken: async () => { const t = await token(); if (t) await this._ensureProfile(t); return t; },
                    global: { fetch: neonFetch }
                }) : authClient;
                this.dataClient = dataClient;
                const live = cwPollingChannels(() => dataClient);
                /* 3) one object for the whole app */
                this.client = {
                    auth: authClient.auth,
                    from: (...a) => dataClient.from(...a),
                    rpc: (...a) => dataClient.rpc(...a),
                    schema: (...a) => dataClient.schema(...a),
                    storage: filesUrl ? cwFileStorage(filesUrl, token) : authClient.storage,
                    channel: (...a) => live.channel(...a),
                    removeChannel: ch => live.removeChannel(ch),
                    removeAllChannels: () => live.removeAllChannels(),
                    getChannels: () => live.getChannels()
                };
                this._neonUrl = neonUrl;
                this._anonKey = anonKey;
                this.initialized = true;
                console.log('✅ Sign-in: Supabase · Data: Neon');
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

    /* the Supabase trigger that made a profile on sign-up does not reach Neon: make sure this person's profile row
       exists there (once per person per page load) before anything reads profiles.
       Called from the data client's token step, so every data request waits for it. Uses a plain fetch so it
       does not wait for itself. */
    _ensureProfile(token) {
        let uid = '';
        try { uid = JSON.parse(atob(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''; } catch (e) { }
        if (!uid || !this._neonUrl) return Promise.resolve();
        this._profileReady = this._profileReady || {};
        if (this._profileReady[uid]) return this._profileReady[uid];
        const p = fetch(`${this._neonUrl}/rest/v1/rpc/ensure_my_profile`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, apikey: this._anonKey, 'Content-Type': 'application/json' },
            body: '{}'
        }).then(res => {
            if (!res.ok) throw new Error(`ensure_my_profile ${res.status}`);
        }).catch(e => {
            console.warn('[profile]', e.message || e);
            delete this._profileReady[uid]; // try again on the next request
        });
        this._profileReady[uid] = p;
        return p;
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

    /* The team's invite code, read from the database: every page (team.html, the app's add-member page, invite popup, profile)
       shows it through this one function, so they always agree.
       Older teams were saved with their temporary id "W-<time>" as the code: those get a real COMP-XXXX code once, here.
       The update only applies while the old code is still there, so two pages fixing it at once end up with the same code. */
    async teamInviteCode(companyId, knownCode) {
        if (!this.isAvailable() || !companyId) return knownCode || '';
        const REAL = /^COMP-[A-Z0-9]{4,}$/;
        let code = knownCode;
        if (code === undefined) {
            const { data } = await this.client.from('companies').select('code').eq('id', companyId).maybeSingle();
            code = data ? data.code : '';
        }
        if (code && REAL.test(code)) return code;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        for (let attempt = 0; attempt < 3; attempt++) {
            let fresh = 'COMP-';
            for (let i = 0; i < 4; i++) fresh += chars.charAt(Math.floor(Math.random() * chars.length));
            let q = this.client.from('companies').update({ code: fresh }).eq('id', companyId);
            if (code) q = q.eq('code', code);
            const { data, error } = await q.select('code');
            if (!error && data && data.length) return data[0].code;
            if (error && !/duplicate key|23505/i.test(`${error.code || ''} ${error.message || ''}`)) break;   // not allowed to change it: keep showing what is saved
            if (!error) {   // someone else fixed it first: use theirs
                const { data: now } = await this.client.from('companies').select('code').eq('id', companyId).maybeSingle();
                return (now && now.code) || code || '';
            }
        }
        return code || '';
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

    /* run a chat database function; returns { missing: true } when the function is not installed yet */
    async _chatRpc(name, args) {
        const { data, error } = await this.client.rpc(name, args || {});
        if (error) {
            if (error.code === 'PGRST202' || /Could not find the function/i.test(error.message || '')) return { missing: true };
            console.warn(`[chat] ${name}:`, error.message);
            return { error };
        }
        return { data };
    }

    async getOrCreateDirectChannel(targetUserId) {
        if (!this.isAvailable() || !targetUserId) return null;
        const user = await this.getCurrentUser();
        if (!user) return null;

        if (targetUserId === 'note' || String(targetUserId) === String(user.id)) {
            return this.getOrCreatePersonalNoteChannel();
        }

        /* the database function creates the room with BOTH people in it (the app itself may not add someone else) */
        const viaRpc = await this._chatRpc('get_or_create_dm', { other_user: targetUserId });
        if (viaRpc.data) return viaRpc.data;
        if (!viaRpc.missing) return null;

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

        /* one database call that also returns the other person's name and picture (their rows may be hidden from the app) */
        const viaRpc = await this._chatRpc('list_my_chats');
        if (viaRpc.data && Array.isArray(viaRpc.data)) {
            return viaRpc.data.map(r => {
                if (r.channel_name === 'พื้นที่ส่วนตัว (Note)') {
                    return { id: 'note', supabaseChannelId: r.channel_id, name: 'พื้นที่ส่วนตัว (Note)', subtitle: 'จดบันทึกและฝากงานตัวเอง', type: 'personal', icon: 'fa-bookmark', color: 'bg-blue-600', status: 'online', unreadCount: 0 };
                }
                if (r.channel_type && r.channel_type !== 'direct') {
                    return {
                        companyId: r.company_id || null, scope: r.scope || null,
                        id: 'chan-' + r.channel_id, supabaseChannelId: r.channel_id, name: r.channel_name || 'กลุ่มสนทนา',
                        subtitle: r.channel_type === 'project' ? 'แชทโปรเจกต์' : (r.channel_type === 'announcement' ? 'ประกาศ' : 'กรุ๊ป'),
                        type: 'group', channelType: r.channel_type, projectId: r.project_id || null,
                        icon: r.channel_type === 'project' ? 'fa-folder-open' : (r.channel_type === 'announcement' ? 'fa-bullhorn' : 'fa-users'),
                        color: r.channel_type === 'project' ? 'bg-violet-600' : 'bg-green-600', status: 'online', unreadCount: 0
                    };
                }
                if (!r.other_user_id) return null; // a direct room with nobody else in it
                return {
                    companyId: r.company_id || null,
                    id: 'user-' + r.other_user_id, supabaseChannelId: r.channel_id, userId: r.other_user_id,
                    name: r.other_name || (r.other_email ? r.other_email.split('@')[0] : 'ผู้ใช้'),
                    subtitle: r.other_email || 'ส่วนตัว', avatar: r.other_avatar || null,
                    type: 'personal', icon: 'fa-user', color: 'bg-blue-500', status: 'offline', unreadCount: 0
                };
            }).filter(Boolean);
        }

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

                /* group / project / announcement rooms: shown by the room's own name, not as a chat with one of its members */
                if (chan.type && chan.type !== 'direct') {
                    channels.push({
                        companyId: chan.company_id || null,
                        id: 'chan-' + chan.id,
                        supabaseChannelId: chan.id,
                        name: chan.name || 'กลุ่มสนทนา',
                        subtitle: chan.type === 'project' ? 'แชทโปรเจกต์' : (chan.type === 'announcement' ? 'ประกาศ' : 'กรุ๊ป'),
                        type: 'group',
                        channelType: chan.type,
                        projectId: chan.project_id || null,
                        icon: chan.type === 'project' ? 'fa-folder-open' : (chan.type === 'announcement' ? 'fa-bullhorn' : 'fa-users'),
                        color: chan.type === 'project' ? 'bg-violet-600' : 'bg-green-600',
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
                    companyId: chan.company_id || null,
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

        const viaRpc = await this._chatRpc('get_or_create_note');
        if (viaRpc.data) return viaRpc.data;
        if (!viaRpc.missing) return null;

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

    /* save a message, then tell the open room about it. The broadcast carries the saved row's id
       (and the sender's temporary client id), so every receiver can tell one message from another by id. */
    async sendMessage(channelId, content, options = {}) {
        if (!this.isAvailable()) return null;
        const clientId = (options && options.clientId) || null;
        const file = options && options.file; // { path, name, size, type, messageType } for a file kept in Storage

        const user = await this.getCurrentUser();
        const row = { channel_id: channelId, sender_id: user ? user.id : null, content: content };
        if (file) Object.assign(row, { file_url: file.path, file_name: file.name, file_size: file.size, file_type: file.type, message_type: file.messageType });
        const { data, error } = await this.client
            .from('chat_messages')
            .insert([row])
            .select()
            .single();

        if (error) {
            console.warn('Supabase DB insert notice:', error.message);
            return null;
        }

        const payload = {
            id: data.id,
            client_id: clientId,
            channel_id: channelId,
            sender_id: data.sender_id,
            content: data.content,
            created_at: data.created_at,
            file_url: data.file_url || null,
            file_name: data.file_name || null,
            file_size: data.file_size || null,
            file_type: data.file_type || null,
            message_type: data.message_type || null
        };
        if (this.activeChannels && this.activeChannels[channelId]) {
            try {
                this.activeChannels[channelId].send({ type: 'broadcast', event: 'new_message', payload: payload });
            } catch (e) {
                console.warn('Broadcast send warning:', e);
            }
        }
        return payload;
    }

    /* ===== Chat files in Storage (bucket conwork-files, path <company>/chat/<room>/<time>-<name>) ===== */
    async chatFilesReady() {
        if (!this.isAvailable()) return false;
        if (this._chatFilesReady !== undefined) return this._chatFilesReady;
        const { error } = await this.client.from('chat_messages').select('file_url').limit(0);
        this._chatFilesReady = !error; // the file columns exist (installed by the chat SQL)
        return this._chatFilesReady;
    }

    async uploadChatFile(companyId, channelId, blob, fileName) {
        const safe = String(fileName || 'file').replace(/[^\w.\-]+/g, '_').slice(-80);
        const path = `${companyId || 'shared'}/chat/${channelId}/${Date.now()}-${safe}`;
        const { error } = await this.client.storage.from('conwork-files').upload(path, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
        if (error) { console.warn('[chat] file upload:', error.message); return null; }
        return path;
    }

    /* a short-lived link to open or download a stored file (cached until shortly before it expires) */
    async signedFileUrl(path) {
        if (!path || !this.isAvailable()) return null;
        this._signed = this._signed || {};
        const hit = this._signed[path];
        if (hit && hit.exp > Date.now()) return hit.url;
        const { data, error } = await this.client.storage.from('conwork-files').createSignedUrl(path, 3600);
        if (error || !data) return null;
        this._signed[path] = { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 };
        return data.signedUrl;
    }

    /* someone started a chat with me (I was added to a room): let the app refresh its chat list */
    async subscribeMyNewChats(onAdded) {
        if (!this.isAvailable()) return null;
        const { data: sess } = await this.client.auth.getSession();
        const myId = sess && sess.session ? sess.session.user.id : null;
        if (!myId) return null;
        if (this.myChatsChannel) { try { this.client.removeChannel(this.myChatsChannel); } catch (e) { } }
        const channel = this.client.channel('my_chat_memberships');
        channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_channel_members', filter: `user_id=eq.${myId}` }, () => onAdded());
        channel.subscribe();
        this.myChatsChannel = channel;
        return channel;
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
        /* "online" means someone OTHER than me has this room open right now */
        channel.on('presence', { event: 'sync' }, async () => {
            const state = channel.presenceState();
            const { data: sess } = await this.client.auth.getSession(); // local, no network call
            const myId = sess && sess.session ? String(sess.session.user.id) : '';
            const others = Object.values(state).flat().filter(p => p && p.user_id && String(p.user_id) !== myId);
            if (onPresenceCallback) {
                onPresenceCallback(others.length > 0, state);
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
        
        // attendee_ids go to event_attendees, not the events table; a column this database lacks is left out instead of failing
        const { attendee_ids, ...row } = eventData;
        let res = await this.client.from('events').insert([row]).select().single();
        for (let i = 0; i < 8 && res.error; i++) {
            const m = /Could not find the '([^']+)' column/i.exec(res.error.message || '');
            if (!m || !(m[1] in row)) break;
            console.warn('[events] column missing in the database, saving without it:', m[1]);
            delete row[m[1]];
            res = await this.client.from('events').insert([row]).select().single();
        }
        const { data, error } = res;
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
            let res = await this.client.from('events').update(mainData).eq('id', eventId).select().single();
            for (let i = 0; i < 8 && res.error; i++) {
                const m = /Could not find the '([^']+)' column/i.exec(res.error.message || '');
                if (!m || !(m[1] in mainData)) break;
                console.warn('[events] column missing in the database, saving without it:', m[1]);
                delete mainData[m[1]];
                res = await this.client.from('events').update(mainData).eq('id', eventId).select().single();
            }
            if (res.error) throw res.error;
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
