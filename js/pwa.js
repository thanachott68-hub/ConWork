/* ConWork as an installed app (PWA), on phones, tablets and computers
   - registers sw.js (install, open offline, notifications)
   - "ติดตั้ง ConWork" bar: the browser's own install on Android / Chrome / Edge, steps for iPhone / iPad / Safari
   - asks once for permission to show notifications (also when "การแจ้งเตือนในแอป" is switched on)
   - app.html: a new item in the bell → a system notification when ConWork is in the background; tapping it opens the item
   - team.html: new Mailbox items → a system notification
   - the number on the app icon (app badge) = unread notifications + unread chat (app) / Mailbox (team)
   - app.html?view=projects opens that page (app shortcuts); ?notif=<id> opens that notification
   - Web Push: once notifications are allowed, this browser is registered (save_push_subscription on Neon), so the
     Neon Function "push" can reach it even when ConWork is closed (sql: supabase/conwork-push.sql)
   Texts are translated by js/i18n.js. */
(function () {
    'use strict';
    var page = document.body && document.body.getAttribute('data-page');   /* 'app' or 'team' */
    var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
    var ua = navigator.userAgent || '';
    var isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var standalone = function () { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || (window.matchMedia && matchMedia('(display-mode: window-controls-overlay)').matches) || navigator.standalone === true; };
    var canNotify = 'Notification' in window;
    var reg = null, deferred = null;
    /* App is a top-level const in js/app.js, so it is not on window */
    var A = function () { try { return typeof App !== 'undefined' ? App : null; } catch (e) { return null; } };

    if (typeof th2en !== 'undefined') Object.assign(th2en, {
        'ติดตั้ง ConWork': 'Install ConWork',
        'เปิดได้จากหน้าจอหลัก ใช้งานเต็มจอ และรับการแจ้งเตือน': 'Open it from your home screen, full screen, with notifications',
        'ติดตั้ง': 'Install', 'ไว้ทีหลัง': 'Later', 'เปิด': 'Turn on',
        'เปิดการแจ้งเตือน': 'Turn on notifications',
        'ให้ ConWork แจ้งเตือนงาน ข้อความ และคำเชิญ แม้ไม่ได้เปิดหน้านี้อยู่': 'Let ConWork tell you about tasks, messages and invitations even when this page is in the background',
        'แตะ': 'Tap', 'แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"': 'then choose "Add to Home Screen"',
        'เลือกเมนู ไฟล์ → เพิ่มไปยัง Dock': 'Choose File → Add to Dock',
        'การแจ้งเตือนถูกปิดในเบราว์เซอร์ เปิดได้ที่การตั้งค่าของเว็บไซต์': 'Notifications are blocked in the browser. Turn them on in the site settings',
        'เปิดการแจ้งเตือนแล้ว': 'Notifications are on',
        'มีรายการใหม่ใน Mailbox': 'New in your Mailbox', 'คำเชิญหรือข้อความใหม่ถึงคุณ': 'A new invitation or message for you',
        'การแจ้งเตือนใหม่': 'New notifications', 'รายการ': 'items'
    });
    var en = function () { try { return JSON.parse(LS.get('conwork_user_settings') || '{}').language === 'en'; } catch (e) { return false; } };
    var T = function (th) { return en() && typeof th2en !== 'undefined' && th2en[th] ? th2en[th] : th; };
    var toast = function (msg, kind) { if (A() && typeof A()._showToast === 'function') App._showToast(msg, kind || 'success'); };
    var notifOn = function () { return !(A() && A().settings && App.settings.appNotifications === false) && canNotify && Notification.permission === 'granted'; };

    document.documentElement.classList.toggle('cw-standalone', standalone());

    /* the window / status bar colour follows the app's light or dark theme */
    var meta = document.querySelector('meta[name="theme-color"]');
    var tint = function () { if (meta) meta.setAttribute('content', document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff'); };
    tint(); new MutationObserver(tint).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    /* ---------- service worker ---------- */
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (r) { reg = r; }).catch(function (e) { console.warn('ConWork service worker:', e); });
        navigator.serviceWorker.addEventListener('message', function (e) { if (e.data && e.data.type === 'cw-open') openFrom(e.data.notif, e.data.url); });
    }

    /* ---------- Web Push (works when ConWork is closed) ---------- */
    var CFG = window.CONWORK_CONFIG || {};
    var PUSH_KEY = CFG.PUSH_PUBLIC_KEY || 'BBVQXQG9yhXRhcH8oxHzfugIUPk_BRNc3-7CBFeGAwrFJ5URbYIVZjsEksvAZmTZKsrH3MNxqFeEBQom-a3XQ4U';
    var PUSH_URL = CFG.PUSH_URL || 'https://br-steep-hat-a1s5a7ht-push.compute.c-1.ap-southeast-1.aws.neon.tech/';
    var sb = function () { var c = window.conworkSupabase; return c && typeof c.isAvailable === 'function' && c.isAvailable() ? c.client : null; };
    var myId = function () {
        var a = A(); if (a && a.state && a.state.currentUser) return String(a.state.currentUser.id);
        try { var u = JSON.parse(sessionStorage.getItem('conwork_user') || localStorage.getItem('conwork_user') || 'null'); return u && (u.id || u.user_id) ? String(u.id || u.user_id) : null; } catch (e) { return null; }
    };
    var keyBytes = function (b64) {
        var pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    };
    var pushReady = function () { return 'PushManager' in window && navigator.serviceWorker && PUSH_KEY && notifOn(); };
    function pushOn() {
        if (!pushReady() || !sb() || !myId()) return Promise.resolve(false);
        return navigator.serviceWorker.ready.then(function (r) {
            return r.pushManager.getSubscription().then(function (s) {
                return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUSH_KEY) });
            });
        }).then(function (s) {
            var j = s.toJSON(), mark = myId() + '|' + j.endpoint, last = (LS.get('conwork_push_saved') || '').split('#');
            if (last[0] === mark && Date.now() - (+last[1] || 0) < 3 * 864e5) return true;   /* saved for this person in the last 3 days */
            return sb().rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_user_agent: ua.slice(0, 300) })
                .then(function (r) { if (r && r.error) throw r.error; LS.set('conwork_push_saved', mark + '#' + Date.now()); return true; });
        }).catch(function (e) { console.warn('ConWork push:', e && (e.message || e)); return false; });
    }
    function pushOff() {
        LS.set('conwork_push_saved', '');
        if (!('PushManager' in window) || !navigator.serviceWorker) return Promise.resolve();
        return navigator.serviceWorker.ready.then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
            if (!s) return;
            var c = sb(), done = c ? c.rpc('delete_push_subscription', { p_endpoint: s.endpoint }).then(function () { }, function () { }) : Promise.resolve();
            return done;
        }).catch(function () { });
    }
    /* a notification was just added: ask the server to send pushes now (the minute timer does it anyway) */
    var poke = function () { if (!PUSH_URL) return; setTimeout(function () { try { fetch(PUSH_URL, { method: 'POST', mode: 'no-cors', keepalive: true }).catch(function () { }); } catch (e) { } }, 1200); };
    /* sign out: this browser stops getting the person's notifications */
    (function wrapLogout(n) {
        if (typeof window.logout !== 'function') { if (n < 40) setTimeout(function () { wrapLogout(n + 1); }, 250); return; }
        if (window.logout.__cwPush) return;
        var out = window.logout;
        window.logout = function () {
            var self = this, args = arguments;
            Promise.race([pushOff(), new Promise(function (r) { setTimeout(r, 1500); })]).then(function () { out.apply(self, args); });
        };
        window.logout.__cwPush = true;
    })(0);

    /* ---------- system notifications ---------- */
    function notify(p) {
        if (!notifOn()) return;
        var payload = { title: p.title || 'ConWork', body: p.body || '', tag: p.tag, url: p.url || (page === 'team' ? 'team.html' : 'app.html'), notif: p.notif || null, timestamp: Date.now() };
        var viaSW = function (r) {
            if (r && r.showNotification) return r.showNotification(payload.title, {
                body: payload.body, icon: 'img/icons/icon-192.png', badge: 'img/icons/badge-96.png', tag: payload.tag, renotify: !!payload.tag,
                vibrate: [80, 40, 80], data: { url: payload.url, notif: payload.notif }
            });
            var n = new Notification(payload.title, { body: payload.body, icon: 'img/icons/icon-192.png', tag: payload.tag });
            n.onclick = function () { window.focus(); openFrom(payload.notif, payload.url); n.close(); };
        };
        try {
            if (reg) viaSW(reg);
            else if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(viaSW, function () { viaSW(null); });
            else viaSW(null);
        } catch (e) { console.warn('ConWork notification:', e); }
    }
    var away = function () { return document.visibilityState !== 'visible' || !document.hasFocus(); };

    function askPermission(fromUser) {
        if (!canNotify) { if (fromUser && isIOS && !standalone()) showBar('install'); return Promise.resolve('unsupported'); }
        if (Notification.permission === 'denied') { if (fromUser) toast(T('การแจ้งเตือนถูกปิดในเบราว์เซอร์ เปิดได้ที่การตั้งค่าของเว็บไซต์'), 'error'); return Promise.resolve('denied'); }
        if (Notification.permission === 'granted') return Promise.resolve('granted');
        var p = Notification.requestPermission();
        return (p && p.then ? p : Promise.resolve(Notification.permission)).then(function (r) {
            if (r === 'granted') { toast(T('เปิดการแจ้งเตือนแล้ว')); hideBar(); updateBadge(); pushOn(); }
            return r;
        });
    }

    /* ---------- number on the app icon ---------- */
    var badgeNum = function (el) { if (!el || el.classList.contains('hidden')) return 0; var t = (el.textContent || '').trim(); return /9\+/.test(t) ? 10 : (parseInt(t, 10) || 0); };
    function unreadNotifs() {
        if (typeof mockNotifications === 'undefined' || !A() || !App.state) return badgeNum(document.getElementById('notification-badge'));
        var me = App.state.currentUser ? String(App.state.currentUser.id) : null;
        return mockNotifications.filter(function (n) { return !n.read && (!(n.linkData && n.linkData.targetUserId) || String(n.linkData.targetUserId) === me); }).length;
    }
    function updateBadge() {
        if (!('setAppBadge' in navigator)) return;
        var n = page === 'team' ? badgeNum(document.getElementById('tm-mail-badge')) + badgeNum(document.getElementById('tm-bell-badge'))
                                : unreadNotifs() + badgeNum(document.getElementById('sidebar-msg-badge'));
        try { (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(function () { }); } catch (e) { }
    }

    /* ---------- app.html: new bell items → system notifications ---------- */
    var started = Date.now(), seen = null;
    function hookApp() {
        if (!A() || typeof App.renderNotifications !== 'function' || App.__cwPwa) return !!(A() && A().__cwPwa);
        App.__cwPwa = true;
        var draw = App.renderNotifications;
        App.renderNotifications = function () {
            var r = draw.apply(this, arguments);
            try { checkNew(); updateBadge(); } catch (e) { }
            return r;
        };
        var toggle = App.toggleAppNotifications;
        if (typeof toggle === 'function') App.toggleAppNotifications = function (on) {
            var r = toggle.apply(this, arguments);
            if (on) askPermission(true).then(function (p) { if (p === 'granted') pushOn(); }); else pushOff();
            return r;
        };
        var add = App.addNotification;
        if (typeof add === 'function') App.addNotification = function () {
            var r = add.apply(this, arguments);
            Promise.resolve(r).then(poke, function () { });
            return r;
        };
        checkNew(); updateBadge();
        return true;
    }
    function checkNew() {
        if (typeof mockNotifications === 'undefined') return;
        var me = App.state && App.state.currentUser ? String(App.state.currentUser.id) : null;
        var mine = mockNotifications.filter(function (n) { return !(n.linkData && n.linkData.targetUserId) || String(n.linkData.targetUserId) === me; });
        if (!seen) { seen = {}; mine.forEach(function (n) { seen[n.id] = 1; }); return; }
        var fresh = mine.filter(function (n) {
            if (seen[n.id]) return false;
            seen[n.id] = 1;
            var t = new Date(n.timestamp).getTime();
            return !n.read && (isNaN(t) || t > started - 60000);   /* old items loaded from the server are not news */
        });
        if (!fresh.length || !away()) return;
        if (fresh.length > 3) {
            notify({ title: 'ConWork', body: T('การแจ้งเตือนใหม่') + ' ' + fresh.length + ' ' + T('รายการ'), tag: 'cw-many' });
            return;
        }
        fresh.forEach(function (n) {
            var look = typeof App._notifLook === 'function' ? App._notifLook(n) : { title: n.title };
            notify({ title: look.title || n.title || 'ConWork', body: n.message || '', tag: 'cw-' + n.id, notif: String(n.id), url: 'app.html' });
        });
    }

    /* ---------- team.html: Mailbox count goes up → system notification ---------- */
    function hookTeam() {
        var mb = document.getElementById('tm-mail-badge'), bell = document.getElementById('tm-bell-badge'), last = null;
        var check = function () {
            var n = badgeNum(mb);
            if (last !== null && n > last && away()) notify({ title: T('มีรายการใหม่ใน Mailbox'), body: T('คำเชิญหรือข้อความใหม่ถึงคุณ'), tag: 'cw-mailbox', url: 'team.html#mailbox' });
            last = n; updateBadge();
        };
        [mb, bell].forEach(function (el) { if (el) new MutationObserver(check).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] }); });
        check();
    }

    /* ---------- open what a notification / shortcut points to ---------- */
    function openFrom(notifId, url) {
        if (url) {
            try {
                var u = new URL(url, location.href);
                if (u.pathname !== location.pathname) { location.href = u.href; return; }
                if (page === 'team' && u.hash) { var a = document.querySelector('#app-sidebar .tm-nav[data-tab="' + u.hash.slice(1) + '"]'); if (a) a.click(); else location.hash = u.hash; }
            } catch (e) { }
        }
        if (notifId && A() && typeof A().handleNotificationClick === 'function') App.handleNotificationClick(notifId);
    }
    function fromQuery() {
        var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
        var view = q.get('view'), notif = q.get('notif');
        if (!view && !notif) return;
        var tries = 0;
        (function wait() {
            if (A() && A().state && App.state.currentUser && typeof App.switchView === 'function') {
                if (view) App.switchView(view);
                if (notif) setTimeout(function () { openFrom(notif); }, 400);
                try { q.delete('view'); q.delete('notif'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) { }
            } else if (tries++ < 40) setTimeout(wait, 250);
        })();
    }

    /* ---------- the bar: install / turn on notifications ---------- */
    var bar = null, SNOOZE = 'conwork_pwa_snooze';
    var snoozed = function () { var t = parseInt(LS.get(SNOOZE) || '0', 10); return t && Date.now() - t < 7 * 864e5; };
    function hideBar() { if (bar) bar.classList.remove('on'); }
    function showBar(kind) {
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'cw-pwa'; bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-live', 'polite');
            document.body.appendChild(bar);
            bar.addEventListener('click', function (e) {
                var b = e.target.closest('[data-pwa]'); if (!b) return;
                var act = b.getAttribute('data-pwa');
                if (act === 'later') { LS.set(SNOOZE, String(Date.now())); hideBar(); }
                else if (act === 'install' && deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; hideBar(); }); }
                else if (act === 'notif') askPermission(true).then(function (r) { if (r !== 'default') hideBar(); });
            });
        }
        var html;
        if (kind === 'notif') {
            html = '<img src="img/icons/icon-192.png" alt=""><div class="tx"><b>' + T('เปิดการแจ้งเตือน') + '</b><small>' + T('ให้ ConWork แจ้งเตือนงาน ข้อความ และคำเชิญ แม้ไม่ได้เปิดหน้านี้อยู่') + '</small></div>'
                + '<div class="bt"><button type="button" data-pwa="later" class="ghost">' + T('ไว้ทีหลัง') + '</button><button type="button" data-pwa="notif">' + T('เปิด') + '</button></div>';
        } else if (deferred) {
            html = '<img src="img/icons/icon-192.png" alt=""><div class="tx"><b>' + T('ติดตั้ง ConWork') + '</b><small>' + T('เปิดได้จากหน้าจอหลัก ใช้งานเต็มจอ และรับการแจ้งเตือน') + '</small></div>'
                + '<div class="bt"><button type="button" data-pwa="later" class="ghost">' + T('ไว้ทีหลัง') + '</button><button type="button" data-pwa="install">' + T('ติดตั้ง') + '</button></div>';
        } else {
            var how = isIOS ? T('แตะ') + ' <i class="fa-solid fa-arrow-up-from-bracket"></i> ' + T('แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"') : T('เลือกเมนู ไฟล์ → เพิ่มไปยัง Dock');
            html = '<img src="img/icons/icon-192.png" alt=""><div class="tx"><b>' + T('ติดตั้ง ConWork') + '</b><small>' + how + '</small></div>'
                + '<div class="bt"><button type="button" data-pwa="later" class="ghost">' + T('ไว้ทีหลัง') + '</button></div>';
        }
        bar.innerHTML = html;
        bar.setAttribute('data-no-i18n', '');
        requestAnimationFrame(function () { bar.classList.add('on'); });
    }
    var isSafariMac = !isIOS && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua) && /Macintosh/.test(ua);
    function offer() {
        if (snoozed() || !signedIn()) return;
        if (canNotify && Notification.permission === 'default' && !(A() && A().settings && App.settings.appNotifications === false)) showBar('notif');
        else if (!standalone() && (deferred || isIOS || isSafariMac)) showBar('install');
    }
    function signedIn() { return page === 'team' ? true : !!(A() && A().state && App.state.currentUser); }

    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; setTimeout(offer, 1500); });
    window.addEventListener('appinstalled', function () { deferred = null; hideBar(); document.documentElement.classList.add('cw-standalone'); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) updateBadge(); });

    /* ---------- start ---------- */
    var css = document.createElement('style');
    css.textContent =
        '#cw-pwa{position:fixed;z-index:9990;left:50%;bottom:calc(16px + env(safe-area-inset-bottom));transform:translate(-50%,140%);width:min(440px,calc(100vw - 32px));'
        + 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:18px;background:#fff;color:#111827;border:1px solid #e5e7eb;'
        + 'box-shadow:0 12px 32px rgba(15,23,42,.18);transition:transform .35s cubic-bezier(.2,.9,.3,1.2),opacity .25s;opacity:0;pointer-events:none;font-size:14px}'
        + '#cw-pwa.on{transform:translate(-50%,0);opacity:1;pointer-events:auto}'
        + '#cw-pwa img{width:40px;height:40px;border-radius:10px;flex:none}'
        + '#cw-pwa .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}#cw-pwa .tx b{font-weight:700}#cw-pwa .tx small{font-size:12px;color:#6b7280;line-height:1.4}'
        + '#cw-pwa .bt{display:flex;gap:6px;flex:none}#cw-pwa button{border:0;border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:600;background:#3B82F6;color:#fff;cursor:pointer}'
        + '#cw-pwa button.ghost{background:transparent;color:#6b7280}'
        + 'html.dark #cw-pwa{background:#131c2e;color:#f3f4f6;border-color:#243047}html.dark #cw-pwa .tx small,html.dark #cw-pwa button.ghost{color:#9ca3af}'
        /* phones: above the bottom navbar */
        + '@media (max-width:640px){#cw-pwa{bottom:calc(var(--cwm-nav-h,64px) + 12px + env(safe-area-inset-bottom))}#cw-pwa .bt{flex-direction:column-reverse}}'
        /* computers: bottom-right corner */
        + '@media (min-width:1024px){#cw-pwa{left:auto;right:24px;bottom:24px;transform:translateY(140%)}#cw-pwa.on{transform:none}}';
    document.head.appendChild(css);

    var tries = 0;
    (function boot() {
        if (page === 'team') hookTeam();
        else if (!hookApp() && tries++ < 60) return setTimeout(boot, 250);
        fromQuery();
        setTimeout(offer, 4000);
        setTimeout(pushOn, 3000);
    })();

    window.ConWorkPWA = {
        notify: notify,
        askPermission: function () { return askPermission(true); },
        install: function () { if (deferred) { deferred.prompt(); return true; } showBar('install'); return false; },
        test: function () { askPermission(true).then(function () { notify({ title: 'ConWork', body: T('เปิดการแจ้งเตือนแล้ว'), tag: 'cw-test' }); }); },
        updateBadge: updateBadge,
        pushOn: pushOn, pushOff: pushOff
    };
})();
