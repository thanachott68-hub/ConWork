/**
 * ConWork — page navigation (index.html / login.html / app.html)
 * หลังล็อกอินจะไปหน้าทีม (team.html) ก่อน แล้วค่อยเลือกทีมเข้า app.html
 * แทนที่การสลับหน้าจอแบบเดิม (ซ่อน/แสดง div) ด้วยการเปลี่ยนไฟล์ HTML
 * ต้องโหลดเป็นสคริปต์ตัวสุดท้ายของทุกหน้า
 */
(function () {
    const PAGES = { landing: 'index.html', login: 'login.html', app: 'app.html', team: 'team.html' };
    const page = document.body.getAttribute('data-page');   // 'landing' | 'login' | 'app'
    const STAY_KEY = 'conwork_stay_on_landing';

    function inviteQuery() {
        const code = new URLSearchParams(location.search).get('code');
        return code ? 'code=' + encodeURIComponent(code) : '';
    }
    function go(target, query) {
        if (target === 'team' && window.CONWORK_CONFIG && window.CONWORK_CONFIG.SKIP_TEAM_PAGE) target = 'app';
        const q = [query, inviteQuery()].filter(Boolean).join('&');
        location.href = PAGES[target] + (q ? '?' + q : '') + (target === 'app' ? location.hash : '');
    }
    function supa() {
        const s = window.conworkSupabase;
        return s && s.isAvailable && s.isAvailable() ? s : null;
    }

    /* A saved user only counts as signed in when it is a real sign-in:
       drop the local "Test User" once the test shortcut is off, and with Supabase on, drop a saved user that has no Supabase session. */
    (function dropStaleSignIn() {
        const cfg = window.CONWORK_CONFIG || {};
        let saved = null;
        try { saved = JSON.parse(sessionStorage.getItem('conwork_user') || localStorage.getItem('conwork_user') || 'null'); } catch (e) { }
        if (!saved) return;
        const isTest = saved.id === 'test-user' || saved.user_id === 'test-user';
        const testOff = !String(cfg.TEST_LOGIN_KEYWORD || '').trim();
        let hasSession = true;
        if (cfg.USE_SUPABASE && supa()) {
            try { hasSession = Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)); } catch (e) { }
        }
        if ((isTest && testOff) || (!isTest && !hasSession)) {
            try {
                sessionStorage.removeItem('conwork_user');
                localStorage.removeItem('conwork_user');
                localStorage.removeItem('currentUser');
            } catch (e) { }
        }
    })();

    // ---------- หน้า Landing / Login ไม่ได้โหลด app.js: เตรียม App ตัวย่อให้ i18n และ login-flow ใช้ ----------
    if (page !== 'app' && typeof App === 'undefined') {
        let settings = { language: 'th', darkMode: false, fontSize: 'medium' };
        try {
            const saved = localStorage.getItem('conwork_user_settings');
            if (saved) settings = Object.assign(settings, JSON.parse(saved));
        } catch (e) { }
        document.documentElement.classList.toggle('dark', !!settings.darkMode);
        const zoom = { small: '0.9', medium: '1', large: '1.1' }[settings.fontSize] || '1';
        document.body.style.zoom = zoom;
        document.body.style.height = (100 / parseFloat(zoom)) + 'vh';

        window.App = {
            settings: settings,
            state: { currentUser: null },
            showApp() { go('team'); },     // login-flow.js เรียกหลังล็อกอินสำเร็จ → หน้าทีม
            _loadData() { },
            renderProjects() { }
        };
    }

    // ---------- ผู้ใช้ที่ล็อกอินอยู่ ----------
    function getLoggedInUser() {
        try {
            if (page === 'app' && typeof App !== 'undefined' && App.state && App.state.currentUser) {
                return App.state.currentUser;
            }
            if (typeof currentUser !== 'undefined' && currentUser) {
                return currentUser;
            }
            const userStr = sessionStorage.getItem('conwork_user') || localStorage.getItem('conwork_user') || localStorage.getItem('currentUser');
            if (userStr) return JSON.parse(userStr);
        } catch (e) { }
        return null;
    }

    function updateLandingAuthState() {
        const user = getLoggedInUser();
        const loginBtn = document.getElementById('landing-login-btn');
        const signupBtn = document.getElementById('landing-signup-btn');
        const userContainer = document.getElementById('landing-auth-user-container');
        const heroSignupBtn = document.getElementById('landing-hero-signup-btn');
        const heroAppBtn = document.getElementById('landing-hero-app-btn');
        const userNameSpan = document.getElementById('landing-user-name');

        if (user) {
            if (loginBtn) loginBtn.style.setProperty('display', 'none', 'important');
            if (signupBtn) signupBtn.style.setProperty('display', 'none', 'important');
            if (userContainer) userContainer.style.setProperty('display', 'inline-flex', 'important');
            if (userNameSpan) {
                userNameSpan.textContent = user.name || user.first_name || (user.email ? user.email.split('@')[0] : 'ผู้ใช้งาน');
            }
            if (heroSignupBtn) heroSignupBtn.style.setProperty('display', 'none', 'important');
            if (heroAppBtn) heroAppBtn.style.setProperty('display', 'inline-flex', 'important');
        } else {
            if (loginBtn) loginBtn.style.removeProperty('display');
            if (signupBtn) signupBtn.style.removeProperty('display');
            if (userContainer) userContainer.style.setProperty('display', 'none', 'important');
            if (heroSignupBtn) heroSignupBtn.style.removeProperty('display');
            if (heroAppBtn) heroAppBtn.style.setProperty('display', 'none', 'important');
        }
    }

    // ---------- ลิงก์ระหว่างหน้า ----------
    function applyAuthMode(mode) {
        window.authMode = mode;
        const title = document.getElementById('auth-title');
        const subtitle = document.getElementById('auth-subtitle');
        const toggleLink = document.getElementById('auth-toggle-link');
        if (!title || !subtitle || !toggleLink) return;
        /* sign up asks for a password (with rules) and its confirmation; log in shows its own password box after the email */
        const su = document.getElementById('signup-password-group');
        if (su) su.style.display = mode === 'login' ? 'none' : 'block';
        const pg = document.getElementById('auth-password-group');
        if (pg) pg.style.display = mode === 'login' ? 'block' : 'none';   /* Sign in: email + password together */
        const btn = document.getElementById('btn-auth-continue');
        if (btn) btn.innerText = mode === 'login' ? 'Sign in' : 'Sign up';
        if (mode === 'login') {
            title.innerHTML = 'Welcome back';
            subtitle.innerHTML = 'Please sign in to your account.';
            toggleLink.innerHTML = 'Don\'t have an account? <a href="login.html?mode=signup" onclick="showLoginScreen(\'signup\'); return false;" class="text-black font-semibold hover:underline">Sign up</a>';
        } else {
            title.innerHTML = 'You\'re one click away<br>from less busywork';
            subtitle.innerHTML = 'Try ConWork for free. No credit card required.';
            toggleLink.innerHTML = 'Already have an account? <a href="login.html?mode=login" onclick="showLoginScreen(\'login\'); return false;" class="text-black font-semibold hover:underline">Sign in</a>';
        }
    }

    function showLoginScreen(mode) {
        mode = mode === 'signup' ? 'signup' : 'login';
        if (page !== 'login') { go('login', 'mode=' + mode); return; }
        applyAuthMode(mode);
        try {
            const p = new URLSearchParams(location.search);
            p.set('mode', mode);
            history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
        } catch (e) { }
    }

    function goToLandingPage() {
        if (page === 'landing') {
            const landing = document.getElementById('landing-screen');
            if (landing) landing.scrollTop = 0;
            updateLandingAuthState();
            return;
        }
        // ผู้ใช้กดกลับหน้าแรกเอง: ไม่ต้องเด้งกลับเข้าแอปอัตโนมัติ
        try { sessionStorage.setItem(STAY_KEY, '1'); } catch (e) { }
        location.href = PAGES.landing;
    }

    function goToAppScreen() {
        if (page === 'app') {
            if (typeof App !== 'undefined' && App.showApp) App.showApp();
            return;
        }
        go('team');
    }

    let loggingOut = false;
    function logout() {
        if (loggingOut) return;
        loggingOut = true;
        try {
            sessionStorage.removeItem('conwork_user');
            localStorage.removeItem('conwork_user');
            localStorage.removeItem('currentUser');
        } catch (e) { }
        try { if (typeof currentUser !== 'undefined') currentUser = null; } catch (e) { }
        if (typeof App !== 'undefined' && App.state) App.state.currentUser = null;

        const finish = () => {
            if (page === 'landing') { loggingOut = false; updateLandingAuthState(); }
            else location.href = PAGES.landing;
        };
        // ต้องออกจาก Supabase ด้วย ไม่เช่นนั้นหน้าถัดไปจะล็อกอินกลับเองจาก session ที่ค้างอยู่
        const s = supa();
        if (!s) { finish(); return; }
        Promise.race([
            s.client.auth.signOut().catch(() => { }),
            new Promise(r => setTimeout(r, 2000))
        ]).then(finish);
    }

    window.getLoggedInUser = getLoggedInUser;
    window.updateLandingAuthState = updateLandingAuthState;
    window.showLoginScreen = showLoginScreen;
    window.goToLandingPage = goToLandingPage;
    window.goToAppScreen = goToAppScreen;
    window.logout = logout;

    // ---------- เริ่มต้นแต่ละหน้า ----------
    if (page === 'landing') {
        let stay = false;
        try { stay = sessionStorage.getItem(STAY_KEY) === '1'; sessionStorage.removeItem(STAY_KEY); } catch (e) { }
        // พฤติกรรมเดิม: เปิดเว็บตอนล็อกอินค้างอยู่ จะเข้าแอปทันที
        let recovering = false;
        try { recovering = sessionStorage.getItem('conwork_recovery') === '1'; } catch (e) { }
        if (recovering) { location.replace('login.html' + location.search + location.hash); return; }
        if (!stay) {
            if (getLoggedInUser()) {
                go('team');
            } else if (supa()) {
                supa().client.auth.getSession().then(({ data }) => {
                    if (data && data.session && !loggingOut) go('team');
                }).catch(() => { });
            }
        }
        updateLandingAuthState();
        window.addEventListener('storage', updateLandingAuthState);
    }

    if (page === 'login') {
        const mode = new URLSearchParams(location.search).get('mode');
        /* Sign in comes first; Sign up only when asked for (?mode=signup, or an invite link) */
        applyAuthMode(mode === 'signup' ? 'signup' : 'login');
    }

    if (page === 'app') {
        const leave = () => {
            // ลิงก์เชิญ (?code=...) ต้องไปหน้าสมัคร ส่วนกรณีอื่นกลับหน้าแรก
            if (inviteQuery()) go('login', 'mode=signup');
            else location.replace(PAGES.landing);
        };
        // เดิม App.showLogin() จะแสดง Landing ในหน้าเดียวกัน ตอนนี้ต้องย้ายไฟล์
        App.showLogin = function () {
            const s = supa();
            if (!s) { leave(); return; }
            // ถ้ามี session ของ Supabase อยู่ login-flow.js จะพาเข้าแอปเอง
            s.client.auth.getSession()
                .then(({ data }) => { if (!(data && data.session)) leave(); })
                .catch(leave);
        };
        // ขั้นตอนสมัคร/ตั้งค่าทีมอยู่ใน login.html
        window.showScreen = function () { go('login', 'mode=login'); };
    }
})();
