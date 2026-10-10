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
    SUPABASE_ANON_KEY: 'sb_publishable_w0GX-5qoUsd6-NYCnNCcWg_QkJpQ52H'
};

window.CONWORK_CONFIG = CONFIG;


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
