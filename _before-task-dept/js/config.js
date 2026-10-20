// js/config.js
const CONFIG = {
    // กำหนด URL ของ API หลัก (Backend URL)
    // เปลี่ยนเป็น URL ของ Server จริง เมื่อนำขึ้น Production
    API_BASE_URL: 'http://localhost:3000/api',

    // ตั้งค่า Environment: 'development', 'staging', 'production'
    ENV: 'development',

    // ตั้งค่าเวลา Timeout ของการเรียก API (หน่วยเป็นมิลลิวินาที)
    TIMEOUT: 10000,

    // ตั้งค่า Prefix สำหรับคีย์ต่างๆ ใน LocalStorage เพื่อป้องกันการชนกัน
    STORAGE_PREFIX: 'conwork_',

    // ตั้งค่า Supabase Backend Integration
    USE_SUPABASE: true, // เปิดใช้งาน Supabase
    SUPABASE_URL: 'https://knzwvloigbtoupebqzrw.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_w0GX-5qoUsd6-NYCnNCcWg_QkJpQ52H',

    // ทางลัดสำหรับทดสอบ (ปิดก่อนขึ้น Production: ตั้ง TEST_LOGIN_KEYWORD เป็น '' และ SKIP_TEAM_PAGE เป็น false)
    // พิมพ์คำนี้ในช่อง Email หน้า Sign in แล้วกด Sign in = เข้าแอปทันทีด้วยบัญชีทดสอบ ไม่ต้องใช้รหัสผ่าน
    TEST_LOGIN_KEYWORD: '',
    // ข้ามหน้าทีม/สร้างทีม (team.html) ทุกกรณี: หลังล็อกอินเข้า app.html เลย
    SKIP_TEAM_PAGE: false,

    // ภาษาเริ่มต้นของทั้งระบบ: 'en' = อังกฤษ, 'th' = ไทย (ผู้ใช้ยังเปลี่ยนเองได้ในหน้าตั้งค่า)
    DEFAULT_LANGUAGE: 'en'
};

window.CONWORK_CONFIG = CONFIG;

// With the test shortcut off, sign out a test account left over in this browser
// (the app copies the signed-in user into localStorage, so it would otherwise stay signed in)
(function () {
    if (CONFIG.TEST_LOGIN_KEYWORD) return;
    [sessionStorage, localStorage].forEach(function (store) {
        try {
            var u = JSON.parse(store.getItem('conwork_user') || 'null');
            if (u && (u.id === 'test-user' || u.user_id === 'test-user')) store.removeItem('conwork_user');
        } catch (e) { }
    });
})();

// Switch every page to DEFAULT_LANGUAGE once per browser (also for people who saved Thai before);
// after that, a language picked in Settings is kept.
(function () {
    var lang = CONFIG.DEFAULT_LANGUAGE || 'en';
    var mark = 'defaultLanguage';
    try {
        var raw = localStorage.getItem('conwork_user_settings');
        var s = raw ? JSON.parse(raw) : { darkMode: false, appNotifications: true, emailNotifications: false, fontSize: 'medium' };
        if (s[mark] !== lang) {
            s.language = lang;
            s[mark] = lang;
            localStorage.setItem('conwork_user_settings', JSON.stringify(s));
        }
    } catch (e) { }
})();


// Password-reset link from the email: remember it before Supabase reads the link,
// and make sure it opens on the sign-in page (which shows the "Reset Password" screen)
(function () {
    try {
        if (!/type=recovery/.test(location.hash + location.search)) return;
        sessionStorage.setItem('conwork_recovery', '1');
        if (!/\/login(\.html)?$/.test(location.pathname)) {
            location.replace(location.pathname.replace(/[^/]*$/, '') + 'login.html' + location.search + location.hash);
        }
    } catch (e) { }
})();
