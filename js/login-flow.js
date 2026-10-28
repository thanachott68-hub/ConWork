// State Management
let currentUser = null;
let tempOnboardingData = {};

// Initialize Database in LocalStorage if empty
function initDB() {
    let usersStr = localStorage.getItem('users');
    let users = usersStr ? JSON.parse(usersStr) : [];
    
    let workspacesStr = localStorage.getItem('workspaces');
    let workspaces = workspacesStr ? JSON.parse(workspacesStr) : [];
    
    let membersStr = localStorage.getItem('workspace_members');
    let members = membersStr ? JSON.parse(membersStr) : [];

    // No demo data: drop the sample company (Acme Corp, W-1) and its sample admin (admin@acme.com, U-1)
    // that older versions saved into this browser. Real accounts and teams are left as they are.
    const isDemoWs = w => w && w.workspace_id === 'W-1' && w.name === 'Acme Corp' && w.code === 'COMP-1234';
    const isDemoUser = u => u && u.user_id === 'U-1' && u.email === 'admin@acme.com';
    const isDemoMember = m => m && m.user_id === 'U-1' && m.workspace_id === 'W-1';
    if (workspaces.some(isDemoWs)) localStorage.setItem('workspaces', JSON.stringify(workspaces.filter(w => !isDemoWs(w))));
    if (users.some(isDemoUser)) localStorage.setItem('users', JSON.stringify(users.filter(u => !isDemoUser(u))));
    if (members.some(isDemoMember)) localStorage.setItem('workspace_members', JSON.stringify(members.filter(m => !isDemoMember(m))));
}

initDB();

// DB Helpers
function getUsers() { return JSON.parse(localStorage.getItem('users')) || []; }
function getWorkspaces() { return JSON.parse(localStorage.getItem('workspaces')) || []; }
function getMembers() { return JSON.parse(localStorage.getItem('workspace_members')) || []; }

/* The browser may still hold an account from an older Supabase project with the same email:
   make the saved copy use the id of the account that is signed in now, or every lookup (teams, personal info) misses. */
function syncUserId(user, supaUser) {
    if (!user || !supaUser || !supaUser.id || String(user.user_id) === String(supaUser.id)) return user;
    const users = getUsers();
    users.forEach(u => { if (u.email === user.email) { u.user_id = supaUser.id; delete u.id; } });
    localStorage.setItem('users', JSON.stringify(users));
    user.user_id = supaUser.id;
    delete user.id;
    try {
        ['conwork_user'].forEach(k => {
            [sessionStorage, localStorage].forEach(st => {
                const raw = st.getItem(k); if (!raw) return;
                const o = JSON.parse(raw);
                if (o && o.email === user.email) { o.user_id = supaUser.id; o.id = supaUser.id; st.setItem(k, JSON.stringify(o)); }
            });
        });
    } catch (e) { }
    return user;
}

async function saveUser(user) {
    // 1. Local Storage Fallback
    const users = getUsers();
    users.push(user);
    localStorage.setItem('users', JSON.stringify(users));

    // 2. Supabase DB Sync
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            await window.conworkSupabase.client.from('profiles').upsert({
                id: user.user_id,
                email: user.email,
                full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                avatar_url: user.avatar,
                account_type: 'personal' // default
            });
        } catch (err) {
            console.error("Error saving user to Supabase:", err);
        }
    }
}

async function saveWorkspace(workspace) {
    let finalId = workspace.workspace_id;

    // 2. Supabase DB Sync
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            const payload = {
                name: workspace.name,
                // every team gets a real invite code (COMP-XXXX); the local id "W-<time>" is not one people can join with
                code: workspace.code || (workspace.code = generateInviteCode()),
                is_personal: workspace.type === 'personal', // User's DB uses is_personal
                created_by: workspace.created_by
            };
            if (workspace.domain) payload.domain = workspace.domain;
            
            const { data, error } = await window.conworkSupabase.client.from('companies').insert(payload).select().single();
            
            if (data) {
                finalId = data.id;
                workspace.workspace_id = finalId; // Update object for local storage
            } else if (error) {
                console.error("Error saving company to Supabase:", error);
                alert("Database Error (companies): " + error.message);
                return null; // Stop and return null on error
            }
        } catch (err) {
            console.error("Error saving company to Supabase:", err);
            alert("Network Error (companies): " + err.message);
            return null;
        }
    }

    // 1. Local Storage Fallback
    const ws = getWorkspaces();
    ws.push(workspace);
    localStorage.setItem('workspaces', JSON.stringify(ws));

    return finalId;
}

async function addMember(userId, workspaceId, role) {
    // 1. Local Storage Fallback
    const members = getMembers();
    if (!members.some(m => m.user_id === userId && m.workspace_id === workspaceId)) {
        members.push({ user_id: userId, workspace_id: workspaceId, role: role });
        localStorage.setItem('workspace_members', JSON.stringify(members));
    }

    // 2. Supabase DB Sync
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            // Map our local roles ('admin', 'worker', 'member') to DB roles
            let dbRole = 'employee';
            if (role === 'admin' || role === 'super_admin') dbRole = 'company_admin';
            
            const { error } = await window.conworkSupabase.client.from('company_members').upsert({
                company_id: workspaceId,
                user_id: userId,
                company_role: dbRole
            }, { onConflict: 'company_id,user_id' });

            if (error) {
                if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('company_members_company_id_user_id_key')) {
                    console.log("User is already a member of company_members:", workspaceId);
                } else {
                    console.error("Error adding member to Supabase:", error);
                    /* the team's package is full: the database says so in Thai, show it as it is */
                    alert(/แพ็กเกจ/.test(error.message || '') ? error.message : "Database Notice (company_members): " + error.message);
                }
            }
        } catch (err) {
            if (err.message?.includes('duplicate key') || err.message?.includes('company_members_company_id_user_id_key')) {
                console.log("Duplicate member ignored:", err);
            } else {
                console.error("Error adding member to Supabase:", err);
                alert("Network Error (company_members): " + err.message);
            }
        }
    }
}

// Look a team up by invite code. Non-members cannot read the companies table (RLS),
// so ask the database function find_team_by_code first (conwork-setup.sql), then fall back to a plain read.
async function findTeamByCode(code) {
    const client = window.conworkSupabase.client;
    const c = String(code || '').trim().toUpperCase();
    try {
        const { data, error } = await client.rpc('find_team_by_code', { p_code: c });
        if (!error) return data || null;
    } catch (e) { }
    const { data } = await client.from('companies').select('*').eq('code', c).maybeSingle();
    return data || null;
}

function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'COMP-';
    for(let i=0; i<4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Navigation & Screen Management
function showScreen(screenId) {
    const landing = document.getElementById('landing-screen');
    if (landing) landing.style.display = 'none';
    const app = document.getElementById('app-screen');
    if (app) app.classList.add('hidden');
    const login = document.getElementById('login-screen');
    if (login) login.style.display = 'flex';

    document.querySelectorAll('.auth-flow-wrapper .screen').forEach(el => el.classList.remove('active'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.add('active');
    
    // Reset specific forms/errors when navigating (optional)
    document.querySelectorAll('.auth-flow-wrapper .error-text').forEach(e => e.style.display = 'none');
}

function switchTeamTab(tab) {
    const btnJoin = document.getElementById('tab-join-team');
    const btnCreate = document.getElementById('tab-create-team');
    const pnlJoin = document.getElementById('panel-join-team');
    const pnlCreate = document.getElementById('panel-create-team');

    if (tab === 'join') {
        btnJoin.className = "flex-1 py-2 text-sm font-medium rounded-md bg-white shadow-sm text-gray-800";
        btnCreate.className = "flex-1 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700";
        pnlJoin.classList.remove('hidden');
        pnlCreate.classList.add('hidden');
    } else {
        btnCreate.className = "flex-1 py-2 text-sm font-medium rounded-md bg-white shadow-sm text-gray-800";
        btnJoin.className = "flex-1 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700";
        pnlCreate.classList.remove('hidden');
        pnlJoin.classList.add('hidden');
    }
}

// Sign-up password rules: at least 8 characters, a letter and a number; each rule turns green when met
const PW_RULES = {
    len: v => v.length >= 8,
    letter: v => /[A-Za-z\u0E00-\u0E7F]/.test(v),
    number: v => /\d/.test(v)
};
function checkSignupPassword(showErrors) {
    const pw = document.getElementById('signup-password');
    const pw2 = document.getElementById('signup-password-confirm');
    if (!pw) return { rules: true, match: true, all: true };
    const v = pw.value, v2 = pw2 ? pw2.value : v;
    let rules = true;
    document.querySelectorAll('#pw-rules [data-rule]').forEach(li => {
        const ok = PW_RULES[li.dataset.rule](v);
        rules = rules && ok;
        li.classList.toggle('ok', ok);
        li.classList.toggle('bad', !ok && (showErrors || v.length > 0) && showErrors);
    });
    const match = v.length > 0 && v === v2;
    const m = document.querySelector('#pw-match [data-rule]');
    if (m) {
        m.classList.toggle('ok', match);
        m.classList.toggle('bad', !match && (showErrors || v2.length > 0));
        /* two fixed labels (js/i18n.js restores changed text, so swap visibility instead of text) */
        const no = !match && v2.length > 0;
        m.querySelector('[data-yes]').style.display = no ? 'none' : '';
        m.querySelector('[data-no]').style.display = no ? '' : 'none';
    }
    pw.classList.toggle('pw-ok', rules); pw.classList.toggle('pw-bad', !rules && (showErrors || false));
    if (pw2) { pw2.classList.toggle('pw-ok', match && rules); pw2.classList.toggle('pw-bad', !match && v2.length > 0); }
    return { rules, match, all: rules && match };
}
['signup-password', 'signup-password-confirm'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
        checkSignupPassword(false);
        const e = document.getElementById('auth-error'); if (e) e.style.display = 'none';
    });
});

// Test shortcut: typing the keyword from js/config.js (TEST_LOGIN_KEYWORD) as the email signs in a local test account.
// Runs on the button click, before the browser checks the email format and the required password.
(function () {
    const keyword = String((window.CONWORK_CONFIG && window.CONWORK_CONFIG.TEST_LOGIN_KEYWORD) || '').trim().toLowerCase();
    const btn = document.getElementById('btn-auth-continue');
    if (!keyword || !btn) return;
    btn.addEventListener('click', function (e) {
        const email = document.getElementById('auth-email');
        if (!email || email.value.trim().toLowerCase() !== keyword) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const testUser = {
            id: 'test-user', user_id: 'test-user',
            name: 'Test User', username: 'test', first_name: 'Test', last_name: 'User',
            email: 'test@conwork.local', role: 'admin', department: 'ผู้บริหาร', status: 'online',
            avatar: 'https://ui-avatars.com/api/?name=Test&background=3B82F6&color=fff',
            workspaceId: 'W-1', workspaceName: 'ConWork (Test)'
        };
        try {
            sessionStorage.setItem('conwork_user', JSON.stringify(testUser));
            sessionStorage.setItem('conwork_personal_info_later', '1');
        } catch (err) { }
        location.href = 'app.html';
    }, true);
})();

// Enter in any box of a form on this page sends that form (Sign in / Sign up / new password / join or create a team),
// the same as pressing its button
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing || e.shiftKey) return;
    if (document.body.getAttribute('data-page') !== 'login') return;   // app.html loads this file too
    const el = e.target;
    if (!el || el.tagName !== 'INPUT' || !el.form || el.type === 'file') return;
    const btn = el.form.querySelector('button[type="submit"], button:not([type])');
    if (btn && btn.disabled) return;
    e.preventDefault();
    if (el.form.requestSubmit) el.form.requestSubmit(btn || undefined);
    else if (btn) btn.click();
});

// STEP 1: Authentication Base
document.getElementById('form-auth')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pwGroup = document.getElementById('auth-password-group');
    const pwInput = document.getElementById('auth-password');
    const errEl = document.getElementById('auth-error');

    errEl.style.display = 'none';

    const users = getUsers();
    let existingUser = users.find(u => u.email === email);
    const mode = window.authMode || 'signup';

    if (mode === 'signup') {
        const pw = document.getElementById('signup-password');
        const pw2 = document.getElementById('signup-password-confirm');
        const check = checkSignupPassword(true);
        if (pw && !check.all) {
            errEl.innerText = !check.rules ? 'Your password needs at least 8 characters, a letter and a number.' : 'The two passwords do not match.';
            errEl.style.display = 'block';
            (check.rules ? pw2 : pw).focus();
            return;
        }
        if (existingUser) {
            errEl.innerText = 'This email is already registered. Please sign in instead.';
            errEl.style.display = 'block';
        } else {
            // New user: create the account now and go to the Team page (personal info is asked there)
            tempOnboardingData.email = email;
            if (pw) tempOnboardingData.password = pw.value;
            await finishSignup(errEl);
        }
    } else {
        // login mode
        // Ask for password if not shown
        if (pwGroup.style.display === 'none') {
            pwGroup.style.display = 'block';
            document.getElementById('btn-auth-continue').innerText = 'Sign in';
            return;
        }

        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            const { data, error } = await window.conworkSupabase.client.auth.signInWithPassword({
                email: email,
                password: pwInput.value
            });
            
            if (error) {
                if (/not confirmed/i.test(error.message)) {
                    // the email was never confirmed: send the link again
                    window.conworkSupabase.client.auth.resend({ type: 'signup', email: email,
                        options: { emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + 'login.html?mode=login' } }).catch(() => { });
                    errEl.innerText = 'Please confirm your email first. We sent the confirmation link to ' + email + ' again.';
                } else {
                    errEl.innerText = "Error: " + error.message;
                }
                errEl.style.display = "block";
                return;
            }

            if (data.user) {
                if (!existingUser) {
                    existingUser = {
                        user_id: data.user.id,
                        email: data.user.email,
                        first_name: data.user.user_metadata?.full_name || email.split('@')[0],
                        last_name: '',
                        avatar: null /* initials until a photo is uploaded in ConWork */,
                        created_at: new Date().toISOString(),
                        password: pwInput.value
                    };
                    saveUser(existingUser);
                }
                currentUser = syncUserId(existingUser, data.user);
                checkAndRouteUser();
                return;
            }
        }

        // Local Fallback
        if (!existingUser) {
            errEl.innerText = 'Account not found. Please sign up first.';
            errEl.style.display = 'block';
            return;
        }

        // Validate password
        if (existingUser.password === pwInput.value) {
            // Success
            currentUser = existingUser;
            checkAndRouteUser();
        } else {
            errEl.innerText = "Incorrect password.";
            errEl.style.display = "block";
        }
    }
});

/* Until the personal information is filled in, people are shown by the first two letters of their email */
function shortName(email) { return String(email || '').trim().slice(0, 2) || 'U'; }

async function finishSignup(errEl) {
    const btn = document.getElementById('btn-auth-continue');
    if (btn) { btn.disabled = true; btn.innerText = 'Creating account…'; }
    const done = () => { if (btn) { btn.disabled = false; btn.innerText = 'Sign up'; } };
    const email = tempOnboardingData.email, name = shortName(email);
    let userId = 'U-' + Date.now();
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        const { data, error } = await window.conworkSupabase.client.auth.signUp({
            email: email,
            password: tempOnboardingData.password,
            options: { data: { full_name: name }, emailRedirectTo: location.origin + location.pathname.replace(/[^/]*$/, '') + 'login.html?mode=login' }
        });
        if (error) { done(); errEl.innerText = 'Error signing up: ' + error.message; errEl.style.display = 'block'; return; }
        if (data.user) userId = data.user.id;
        if (!data.session) {
            // "Confirm email" is on in Supabase: they must click the link in the email first
            done();
            alert('We sent a confirmation link to ' + email + '. Please open it, then sign in.');
            showLoginScreen('login');
            return;
        }
    }
    const newUser = { user_id: userId, email: email, password: tempOnboardingData.password, first_name: name, last_name: '', avatar: null, created_at: new Date().toISOString() };
    saveUser(newUser);
    currentUser = newUser;
    goToDashboard();   // → team.html (an invite code in the link is carried along)
}

// STEP 2: Profile Setup (older page only; the screen was removed)
document.getElementById('form-profile-setup')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    tempOnboardingData.firstName = document.getElementById('profile-first-name').value;
    tempOnboardingData.lastName = document.getElementById('profile-last-name').value;
    const profilePw = document.getElementById('profile-password');   // older page: password asked here
    if (profilePw) tempOnboardingData.password = profilePw.value;
    if (!tempOnboardingData.password) { showScreen('screen-auth'); return; }
    
    // Check if an avatar was uploaded
    const avatarPreview = document.getElementById('profile-avatar-preview');
    let avatarUrl = null;
    if (avatarPreview && !avatarPreview.classList.contains('hidden')) {
        avatarUrl = avatarPreview.src;
    }
    
    let userId = 'U-' + Date.now();

    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        const { data, error } = await window.conworkSupabase.client.auth.signUp({
            email: tempOnboardingData.email,
            password: tempOnboardingData.password,
            options: {
                data: {
                    full_name: `${tempOnboardingData.firstName} ${tempOnboardingData.lastName}`.trim(),
                    avatar_url: avatarUrl
                }
            }
        });
        if (error) {
            alert("Error signing up: " + error.message);
            return;
        }
        if (data.user) {
            userId = data.user.id;
        }
    }
    
    // Create User Entity immediately
    const newUser = {
        user_id: userId,
        email: tempOnboardingData.email,
        password: tempOnboardingData.password,
        first_name: tempOnboardingData.firstName,
        last_name: tempOnboardingData.lastName,
        avatar: avatarUrl,
        created_at: new Date().toISOString()
    };
    
    saveUser(newUser);
    currentUser = newUser;
    
    // Smart Routing Check: Did they join via invite code in URL or corporate domain?
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCodeParam = urlParams.get('code');
    const emailDomain = tempOnboardingData.email.split('@')[1];
    
    const workspaces = getWorkspaces();
    let autoJoinWs = null;

    if (inviteCodeParam) {
        autoJoinWs = workspaces.find(w => w.code === inviteCodeParam.toUpperCase());
    }
    
    if (!autoJoinWs && emailDomain) {
        autoJoinWs = workspaces.find(w => w.domain === emailDomain && w.type === 'corporate');
    }

    if (!autoJoinWs && window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            if (inviteCodeParam) {
                const data = await findTeamByCode(inviteCodeParam);
                if (data) {
                    autoJoinWs = {
                        workspace_id: data.id,
                        name: data.name,
                        code: data.code,
                        type: data.is_personal ? 'personal' : 'corporate'
                    };
                }
            }
            if (!autoJoinWs && emailDomain) {
                const { data } = await window.conworkSupabase.client
                    .from('companies')
                    .select('*')
                    .eq('domain', emailDomain)
                    .eq('is_personal', false)
                    .maybeSingle();
                if (data) {
                    autoJoinWs = {
                        workspace_id: data.id,
                        name: data.name,
                        code: data.code,
                        type: data.is_personal ? 'personal' : 'corporate'
                    };
                }
            }
        } catch(e) {
            console.error("Error auto-finding workspace:", e);
        }
    }

    if (autoJoinWs) {
        // Auto-bind
        await addMember(currentUser.user_id, autoJoinWs.workspace_id, 'member');
        showSuccessScreen("Welcome to " + autoJoinWs.name, "You have been successfully added to the team.", null);
    } else {
        // Ask for Intent
        showScreen('screen-action-select');
    }
});

// STEP 3: Action Selection
async function selectAction(type) {
    if (type === 'personal') {
        // Create Personal Workspace
        const wsId = 'W-' + Date.now();
        const personalWs = {
            workspace_id: wsId,
            type: 'personal',
            name: 'Personal Space',
            created_by: currentUser.user_id,
            created_at: new Date().toISOString()
        };
        const realId = await saveWorkspace(personalWs);
        await addMember(currentUser.user_id, realId, 'admin'); // user is admin of their personal space
        
        showSuccessScreen("Welcome!", "Your personal workspace is ready.", null);
    } else if (type === 'team') {
        showScreen('screen-team-setup');
    }
}

// STEP 4A: Join Team via Code
const codeInput = document.getElementById('join-invite-code');
const feedbackEl = document.getElementById('join-code-feedback');
const btnJoin = document.getElementById('btn-join-team');
let validWorkspaceId = null;
let checkTimeout = null;

if (codeInput) {
    codeInput.addEventListener('input', function(e) {
        this.value = this.value.toUpperCase();
        const val = this.value.trim();
        
        if (checkTimeout) clearTimeout(checkTimeout);

        if(val.length >= 9) {
            feedbackEl.className = 'feedback-text text-gray-500 mt-2 text-sm text-center';
            feedbackEl.innerHTML = `Searching team...`;
            
            checkTimeout = setTimeout(async () => {
                let workspace = getWorkspaces().find(w => w.code === val && w.type === 'corporate');
                
                // If not found in localStorage, search in Supabase DB
                if (!workspace && window.conworkSupabase && window.conworkSupabase.isAvailable()) {
                    try {
                        const data = await findTeamByCode(val);
                            
                        if (data) {
                            workspace = {
                                workspace_id: data.id,
                                name: data.name,
                                code: data.code,
                                type: data.is_personal ? 'personal' : 'corporate',
                                domain: data.domain,
                                created_by: data.created_by
                            };
                            // Save to local storage cache
                            const localWs = getWorkspaces();
                            if (!localWs.some(w => w.workspace_id === workspace.workspace_id)) {
                                localWs.push(workspace);
                                localStorage.setItem('workspaces', JSON.stringify(localWs));
                            }
                        }
                    } catch(err) {
                        console.error("Error finding company in Supabase:", err);
                    }
                }

                if(workspace) {
                    feedbackEl.className = 'feedback-text success text-green-600 mt-2 text-sm text-center';
                    feedbackEl.innerHTML = `✔️ Found: <strong>${workspace.name}</strong>`;
                    btnJoin.disabled = false;
                    validWorkspaceId = workspace.workspace_id;
                } else {
                    feedbackEl.className = 'feedback-text error text-red-500 mt-2 text-sm text-center';
                    feedbackEl.innerHTML = `❌ Team not found.`;
                    btnJoin.disabled = true;
                    validWorkspaceId = null;
                }
            }, 300);
        } else {
            feedbackEl.innerHTML = '';
            btnJoin.disabled = true;
            validWorkspaceId = null;
        }
    });
}

document.getElementById('form-join-team')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    if(!validWorkspaceId) return;
    
    // Check if already member
    const isMember = getMembers().find(m => m.user_id === currentUser.user_id && m.workspace_id === validWorkspaceId);
    if(isMember) {
        document.getElementById('join-error').innerText = "You are already a member of this team.";
        document.getElementById('join-error').style.display = 'block';
        return;
    }

    try {
        await addMember(currentUser.user_id, validWorkspaceId, 'member');
        showSuccessScreen("Joined Successfully!", "You are now part of the team.", null);
    } catch(err) {
        console.error("Error joining team:", err);
        const errEl = document.getElementById('join-error');
        if (errEl) {
            errEl.innerText = "Error joining team: " + (err.message || err);
            errEl.style.display = 'block';
        }
    }
});

// STEP 4B: Create Team
document.getElementById('form-create-team')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    const name = document.getElementById('create-team-name').value;
    const domain = document.getElementById('create-team-domain').value;
    
    const wsId = 'W-' + Date.now();
    const code = generateInviteCode();
    
    const corporateWs = {
        workspace_id: wsId,
        type: 'corporate',
        name: name,
        created_by: currentUser.user_id,
        domain: domain || null,
        code: code,
        created_at: new Date().toISOString()
    };
    
    // Disable button to prevent double submit
    const btn = document.getElementById('btn-create-team');
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Creating...";
    }
    
    try {
        const realId = await saveWorkspace(corporateWs);
        if (!realId) {
            throw new Error("Failed to create workspace");
        }
        await addMember(currentUser.user_id, realId, 'admin'); // Creator is admin
        
        showSuccessScreen("Team Created!", "Your team workspace is ready.", code);
    } catch (err) {
        console.error(err);
        // Do not show success screen if it failed
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Create Team";
        }
    }
});


// Utility & Routing
function showSuccessScreen(title, message, inviteCode) {
    document.getElementById('success-title').innerText = title;
    document.getElementById('success-message').innerText = message;
    
    if (inviteCode) {
        document.getElementById('success-team-info').classList.remove('hidden');
        document.getElementById('success-invite-code').innerText = inviteCode;
    } else {
        document.getElementById('success-team-info').classList.add('hidden');
    }
    
    showScreen('screen-success');
}

async function checkAndRouteUser() {
    if(!currentUser) return;
    
    // Check real memberships from Supabase first
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            // 1. Search company_members by user_id
            let { data } = await window.conworkSupabase.client
                .from('company_members')
                .select('*')
                .eq('user_id', currentUser.user_id);
                
            // 2. Search profile by email if user_id mapping differs
            if (!data || data.length === 0) {
                const { data: prof } = await window.conworkSupabase.client
                    .from('profiles')
                    .select('id')
                    .eq('email', currentUser.email)
                    .maybeSingle();

                if (prof && prof.id) {
                    const { data: memByProf } = await window.conworkSupabase.client
                        .from('company_members')
                        .select('*')
                        .eq('user_id', prof.id);

                    if (memByProf && memByProf.length > 0) {
                        data = memByProf;
                        currentUser.user_id = prof.id;
                        saveUser(currentUser);
                    }
                }
            }

            // 3. Fallback: Check if user created any company in Supabase
            if (!data || data.length === 0) {
                const { data: createdComp } = await window.conworkSupabase.client
                    .from('companies')
                    .select('*')
                    .eq('created_by', currentUser.user_id);

                if (createdComp && createdComp.length > 0) {
                    try { await addMember(currentUser.user_id, createdComp[0].id, 'admin'); } catch(e){}
                    data = [{ company_id: createdComp[0].id, company_role: 'company_admin' }];
                }
            }

            // (removed) joining the newest company automatically: people now join with an invite code and the leader approves
            if (!data || data.length === 0) { goToDashboard(); return; }

            if (data && data.length > 0) {
                /* keep the team picked on the Teams page (team.html → Enter): this also runs when app.html opens,
                   and data[0] is often the Personal Space, which made the app show that space's invite code and data */
                const chosen = data.find(m => String(m.company_id) === String(chosenTeamId())) || data[0];
                const companyId = chosen.company_id;
                
                // Fetch company details
                const { data: compData } = await window.conworkSupabase.client
                    .from('companies')
                    .select('*')
                    .eq('id', companyId)
                    .maybeSingle();

                const localWs = getWorkspaces();
                if (compData && !localWs.some(w => w.workspace_id === compData.id)) {
                    localWs.push({
                        workspace_id: compData.id,
                        name: compData.name,
                        code: compData.code,
                        type: compData.is_personal ? 'personal' : 'corporate'
                    });
                    localStorage.setItem('workspaces', JSON.stringify(localWs));
                }

                goToDashboard(companyId, chosen.company_role);
                return;
            }
        } catch(e) {
            console.error('Error checking memberships:', e);
        }
    }

    // Check local memberships fallback (only if Supabase is offline)
    const memberships = getMembers().filter(m => m.user_id === currentUser.user_id);
    if (memberships.length === 0) {
        // No team yet: the Team page lets them create or join one
        goToDashboard();
        return;
    }

    const chosenLocal = memberships.find(m => String(m.workspace_id) === String(chosenTeamId())) || memberships[0];
    goToDashboard(chosenLocal.workspace_id, chosenLocal.role);
}

/* the team opened from the Teams page, saved in this tab's session */
function chosenTeamId() {
    try { return (JSON.parse(sessionStorage.getItem('conwork_user') || 'null') || {}).workspaceId || null; } catch (e) { return null; }
}

function goToDashboard(passedWorkspaceId = null, passedRole = null) {
    if(!currentUser) {
        showScreen('screen-auth');
        return;
    }

    let workspaceId = passedWorkspaceId;
    let role = passedRole || 'worker';

    if (!workspaceId) {
        // Determine primary role/department for UI based on membership
        const memberships = getMembers().filter(m => m.user_id === currentUser.user_id);
        const primaryMembership = memberships.length > 0 ? memberships[0] : { role: 'member', workspace_id: 'W-1' };
        role = primaryMembership.role;
        workspaceId = primaryMembership.workspace_id;
    }
    
    // Find workspace name
    const workspaceInfo = getWorkspaces().find(w => w.workspace_id === workspaceId) || { name: 'ConWork' };

    if (typeof App !== 'undefined' && App.state) {
        App.state.currentUser = {
            id: currentUser.user_id,
            name: `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() || currentUser.email.split('@')[0],
            username: currentUser.email.split('@')[0],
            email: currentUser.email,
            role: role,
            department: '',
            status: 'online',
            avatar: currentUser.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser.first_name || currentUser.email) + "&background=random",
            workspaceId: workspaceId,
            workspaceName: workspaceInfo.name
        };
        try { sessionStorage.setItem('conwork_user', JSON.stringify(App.state.currentUser)); } catch(e){}
        App.showApp();
        App._loadData(); // Ensure we load the new workspace's data right away
        App.renderProjects(); // Refresh UI for new workspace data
    } else {
        setTimeout(goToDashboard, 100);
    }
}

function copyInviteCode() {
    const code = document.getElementById('success-invite-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Invite Code copied!");
    });
}

function logout() {
    currentUser = null;
    tempOnboardingData = {};
    try {
        sessionStorage.removeItem('conwork_user');
        localStorage.removeItem('conwork_user');
        localStorage.removeItem('currentUser');
    } catch(e) {}
    if (window.App && window.App.state) {
        window.App.state.currentUser = null;
    }
    const app = document.getElementById('app-screen');
    if (app) app.classList.add('hidden');
    const login = document.getElementById('login-screen');
    if (login) login.style.display = 'none';
    const landing = document.getElementById('landing-screen');
    if (landing) landing.style.display = 'block';
    
    if (typeof updateLandingAuthState === 'function') {
        updateLandingAuthState();
    }
    showScreen('screen-auth');
}

// Password Visibility Toggle
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const icon = btn ? btn.querySelector('i') : null;
    if (btn) btn.classList.toggle('showing', input.type === 'password');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

// Avatar Previews
function previewAvatar(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-avatar-preview').src = e.target.result;
            document.getElementById('profile-avatar-preview').classList.remove('hidden');
            document.getElementById('profile-avatar-icon').classList.add('hidden');
        }
        reader.readAsDataURL(input.files[0]);
    }
}
function previewTeamLogo(input) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('team-logo-preview').src = e.target.result;
            document.getElementById('team-logo-preview').classList.remove('hidden');
            document.getElementById('team-logo-icon').classList.add('hidden');
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// Forgot Password Flow
async function forgotPassword() {
    const emailInput = document.getElementById('auth-email').value;
    const email = prompt("Please enter your registered email to reset your password:", emailInput || "");
    
    if (!email) return;
    
    if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
        try {
            const { data, error } = await window.conworkSupabase.client.auth.resetPasswordForEmail(email, {
                /* always come back to the sign-in page, which shows the "Reset Password" screen */
                redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'login.html'
            });
            if (error) throw error;
            alert("A password reset link has been sent to your email. Please check your inbox.");
        } catch (error) {
            console.error("Reset password error:", error.message);
            alert("Error sending reset link: " + error.message);
        }
    } else {
        alert("Supabase is not configured. Cannot reset password in mock mode.");
    }
}

function showAuthError(message) {
    const el = document.getElementById('auth-error');
    if (el) { el.innerText = message; el.style.display = 'block'; }
    else alert(message);
}

/* Is "Sign in with Google" switched on for this Supabase project? (Authentication > Providers > Google) */
async function googleSignInEnabled() {
    try {
        const cfg = window.CONWORK_CONFIG || {};
        const res = await fetch(cfg.SUPABASE_URL + '/auth/v1/settings', { headers: { apikey: cfg.SUPABASE_ANON_KEY } });
        if (!res.ok) return true; // could not check: let Supabase answer
        const s = await res.json();
        return !!(s && s.external && s.external.google);
    } catch (e) { return true; }
}

// Google sign-in via Supabase: Google sends the person back to this same page (keeping an invite link's ?code=...),
// where onAuthStateChange below picks up the session and continues like an email sign-in.
async function loginWithGoogle() {
    const errEl = document.getElementById('auth-error');
    if (errEl) errEl.style.display = 'none';
    if (!(window.conworkSupabase && window.conworkSupabase.isAvailable())) {
        showAuthError('Google sign-in is not available right now (the database is not connected).');
        return;
    }
    if (!(await googleSignInEnabled())) {
        showAuthError('Google sign-in is not switched on yet for this app. Please sign in with your email and password, or ask the admin to enable Google in Supabase.');
        return;
    }
    try {
        /* come back to this page with its invite code (if any), but without old sign-in leftovers */
        const params = new URLSearchParams(location.search);
        ['error', 'error_code', 'error_description'].forEach(k => params.delete(k));
        const query = params.toString();
        const { error } = await window.conworkSupabase.client.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname + (query ? '?' + query : ''),
                queryParams: { prompt: 'select_account' }
            }
        });
        if (error) throw error;
    } catch (error) {
        console.error('Google login error:', error.message);
        showAuthError(/provider is not enabled|Unsupported provider/i.test(error.message || '')
            ? 'Google sign-in is not switched on yet for this app. Please sign in with your email and password.'
            : 'Could not sign in with Google: ' + error.message);
    }
}

/* Coming back from Google with an error (e.g. the person cancelled): show it on the sign-in screen */
(function () {
    try {
        const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
        const query = new URLSearchParams(location.search);
        const desc = hash.get('error_description') || query.get('error_description');
        if (!desc) return;
        const msg = /provider is not enabled|Unsupported provider/i.test(desc)
            ? 'Google sign-in is not switched on yet for this app. Please sign in with your email and password.'
            : 'Google sign-in did not finish: ' + desc.replace(/\+/g, ' ');
        const show = () => showAuthError(msg);
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
    } catch (e) { }
})();

/* After Google sign-in: make sure the person's profile row exists, and fill in the name and picture from Google
   only where they are still empty (a name the person set in ConWork is kept). */
async function syncGoogleProfile(supabaseUser) {
    if (!supabaseUser || !(window.conworkSupabase && window.conworkSupabase.isAvailable())) return;
    const meta = supabaseUser.user_metadata || {};
    const fullName = meta.full_name || meta.name || '';
    /* Google's picture is not copied: until the person uploads a photo in ConWork, the initials of the name are shown */
    const avatar = null;
    try {
        const sb = window.conworkSupabase.client;
        const { data: prof } = await sb.from('profiles').select('id, full_name, avatar_url').eq('id', supabaseUser.id).maybeSingle();
        if (!prof) {
            await sb.from('profiles').upsert({ id: supabaseUser.id, email: supabaseUser.email, full_name: fullName || (supabaseUser.email || '').split('@')[0], avatar_url: avatar, account_type: 'personal' });
        } else {
            const patch = {};
            if (!prof.full_name && fullName) patch.full_name = fullName;
            if (!prof.avatar_url && avatar) patch.avatar_url = avatar;
            if (Object.keys(patch).length) await sb.from('profiles').update(patch).eq('id', supabaseUser.id);
        }
    } catch (e) { console.warn('Google profile sync:', e); }
}

/* Opened from the reset-password email: js/config.js spots "type=recovery" in the link before Supabase reads it.
   Stay on the "Reset Password" screen and do not sign the person straight in. */
let isRecoveryFlow = false;
try { isRecoveryFlow = sessionStorage.getItem('conwork_recovery') === '1' || /type=recovery/.test(location.hash + location.search); } catch (e) { }
if (isRecoveryFlow) {
    try { sessionStorage.setItem('conwork_recovery', '1'); } catch (e) { }
    const showReset = () => showScreen('screen-update-password');
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showReset); else showReset();
}

// Listen for Supabase Auth state changes (e.g. returning from Google OAuth)
if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
    window.conworkSupabase.client.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            isRecoveryFlow = true;
            showScreen('screen-update-password');
            return;
        }

        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session) {
            if (isRecoveryFlow) return; // Wait for them to update password
            
            // Map Supabase user to our local DB user format
            const supabaseUser = session.user;
            const isGoogle = (supabaseUser.app_metadata?.provider === 'google') || (supabaseUser.app_metadata?.providers || []).includes('google');
            let users = getUsers();
            let existingUser = users.find(u => u.email === supabaseUser.email);

            if (!existingUser) {
                // First time logging in with Google on this device, auto-create a user record
                existingUser = {
                    user_id: supabaseUser.id,
                    email: supabaseUser.email || '',
                    first_name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || (supabaseUser.email ? supabaseUser.email.split('@')[0] : 'User'),
                    last_name: '',
                    avatar: null /* initials until a photo is uploaded in ConWork */,
                    created_at: new Date().toISOString()
                };
                if (isGoogle) {
                    /* keep a local copy only; the profile row is handled by syncGoogleProfile so a name set in ConWork is not overwritten */
                    const all = getUsers(); all.push(existingUser); localStorage.setItem('users', JSON.stringify(all));
                } else {
                    saveUser(existingUser);
                }
            }
            currentUser = syncUserId(existingUser, supabaseUser);
            const route = () => checkAndRouteUser();
            if (isGoogle) syncGoogleProfile(supabaseUser).then(route, route); else route();
        } else if (event === 'SIGNED_OUT') {
            logout();
        }
    });
}

// Handle Update Password Submission
const updatePasswordForm = document.getElementById('form-update-password');
if (updatePasswordForm) {
    updatePasswordForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const errorEl = document.getElementById('update-password-error');
        errorEl.style.display = 'none';
        if (!(newPassword.length >= 8 && /[A-Za-z\u0E00-\u0E7F]/.test(newPassword) && /\d/.test(newPassword))) {
            errorEl.innerText = 'Your password needs at least 8 characters, a letter and a number.';
            errorEl.style.display = 'block';
            return;
        }
        
        if (window.conworkSupabase && window.conworkSupabase.isAvailable()) {
            const { error } = await window.conworkSupabase.client.auth.updateUser({
                password: newPassword
            });
            
            if (error) {
                errorEl.innerText = error.message;
                errorEl.style.display = 'block';
            } else {
                alert("Password updated successfully!");
                isRecoveryFlow = false;
                try { sessionStorage.removeItem('conwork_recovery'); } catch (e) { }
                
                const { data: { session } } = await window.conworkSupabase.client.auth.getSession();
                if (session) {
                    const supabaseUser = session.user;
                    let users = getUsers();
                    let existingUser = users.find(u => u.email === supabaseUser.email);
                    if (existingUser) {
                        existingUser.password = newPassword; // Update local mock password too
                        localStorage.setItem('users', JSON.stringify(users));
                    } else {
                        existingUser = { user_id: supabaseUser.id, email: supabaseUser.email || '', first_name: supabaseUser.user_metadata?.full_name || (supabaseUser.email || 'User').split('@')[0], last_name: '', created_at: new Date().toISOString() };
                        saveUser(existingUser);
                    }
                    currentUser = syncUserId(existingUser, supabaseUser);
                    checkAndRouteUser();
                }
            }
        }
    });
}
