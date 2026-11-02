/* ConWork: phone layout from the "ConWork · Mobile Web App" frames (css/mobile-nav.css has the look).
   Phones only (≤640px) on app.html:
   - a bottom navbar with 5 tabs: แดชบอร์ด · งานทั้งหมด · บัญชี · ข้อความ · เพิ่มเติม (it replaces the ☰ side menu)
   - top bar: logo on the dashboard, the page name on the other pages (with a back arrow on pages opened from เพิ่มเติม),
     calendar + bell buttons and the profile picture on the right
   - a "เพิ่มเติม" page with the rest of the side menu: profile, report, calendar, team, settings, dark mode, language,
     notifications, help, switch team and sign out
   Texts are Thai; js/i18n.js translates them (entries added to th2en below).
   Nothing new is stored or sent: every button calls the app's own action (App.switchView, App.toggleTheme, ...). */
(function () {
    if (document.body.getAttribute('data-page') !== 'app' || typeof App === 'undefined') return;
    var phone = window.matchMedia('(max-width: 640px)');
    var $ = function (id) { return document.getElementById(id); };

    if (typeof th2en !== 'undefined') Object.assign(th2en, {
        'เพิ่มเติม': 'More', 'บัญชี': 'Accounting', 'สร้างรายงาน': 'Reports', 'รายงานการทำงาน': 'Work reports',
        'ปฏิทิน': 'Calendar', 'งานและกำหนดส่งของคุณ': 'Your tasks and due dates', 'ทีมงาน': 'Team', 'สมาชิกในทีม': 'Team members',
        'ตั้งค่า': 'Settings', 'บัญชีและการใช้งาน': 'Account and preferences', 'โหมดมืด': 'Dark mode', 'ภาษา': 'Language',
        'การแจ้งเตือน': 'Notifications', 'ช่วยเหลือและคู่มือ': 'Help and guides', 'สลับทีม': 'Switch team',
        'จัดการทีม': 'Manage team', 'ข้อมูลทีมงาน': 'Team info', 'เพิ่มพนักงาน': 'Add employee', 'ตั้งค่าพนักงาน': 'Employee settings',
        'ข้อมูลส่วนตัว': 'Personal info', 'รายรับ–รายจ่าย และงบประมาณ': 'Income, expenses and budget',
        'โปรเจกต์และงานทั้งหมด': 'All projects and tasks', 'แชทกับเพื่อนร่วมงาน': 'Chat with your team', 'เมนูอื่น ๆ และการตั้งค่า': 'Other menus and settings',
        'กลับ': 'Back', 'ออกจากระบบ': 'Sign out'
    });

    var header = document.querySelector('main > header');
    var sidebar = $('app-sidebar'), views = $('view-dashboard') && $('view-dashboard').parentNode;
    var pm = $('profile-menu-dropdown');
    if (!header || !views) return;

    var ICON = {
        dashboard: 'fa-solid fa-chart-line', projects: 'fa-solid fa-briefcase', accounting: 'fa-solid fa-wallet',
        messages: 'fa-regular fa-comment-dots', more: 'fa-solid fa-table-cells-large'
    };
    var TABS = [['dashboard', 'แดชบอร์ด'], ['projects', 'งานทั้งหมด'], ['accounting', 'บัญชี'], ['messages', 'ข้อความ'], ['more', 'เพิ่มเติม']];
    /* pages that are tabs; every other page is opened from เพิ่มเติม, so that tab stays lit and the top bar gets a back arrow */
    var isTab = function (v) { return TABS.some(function (t) { return t[0] === v; }); };
    var SUB = {
        projects: 'โปรเจกต์และงานทั้งหมด', accounting: 'รายรับ–รายจ่าย และงบประมาณ', messages: 'แชทกับเพื่อนร่วมงาน',
        more: 'เมนูอื่น ๆ และการตั้งค่า', calendar: 'งานและกำหนดส่งของคุณ', team: 'สมาชิกในทีม', 'work-report': 'รายงานการทำงาน'
    };
    var TITLE = { more: 'เพิ่มเติม', accounting: 'บัญชี' };
    /* a menu the side menu hides from this person (permissions) is hidden here too */
    var allowed = function (view) {
        var a = sidebar && sidebar.querySelector('.nav-item[data-view="' + view + '"]');
        if (!a) return true;
        return a.style.display !== 'none' && !a.classList.contains('hidden') && !(a.parentNode && a.parentNode.style && a.parentNode.style.display === 'none');
    };
    var isAdmin = function () {
        var role = String(((App.state && App.state.currentUser) || {}).role || 'worker'), low = role.toLowerCase();
        return role === 'admin' || role === 'reviewer2' || low.indexOf('admin') >= 0 || low.indexOf('ceo') >= 0;
    };

    /* ---------- bottom navbar ---------- */
    var bnav = document.createElement('nav');
    bnav.id = 'cwm-bnav'; bnav.setAttribute('aria-label', 'เมนูหลัก');
    bnav.innerHTML = TABS.map(function (t) {
        return '<button type="button" data-v="' + t[0] + '"><span class="ic"><i class="' + ICON[t[0]] + '"></i>'
            + (t[0] === 'messages' ? '<b class="badge" data-no-i18n></b>' : '') + '</span><span class="lb">' + t[1] + '</span></button>';
    }).join('');
    document.body.appendChild(bnav);
    bnav.addEventListener('click', function (e) {
        var b = e.target.closest('[data-v]'); if (!b) return;
        App.switchView(b.getAttribute('data-v'));
    });
    /* unread chats: copy the side menu's red badge */
    var srcBadge = $('sidebar-msg-badge'), badge = bnav.querySelector('.badge');
    var syncBadge = function () {
        var n = srcBadge ? srcBadge.textContent.trim() : '';
        var show = srcBadge && !srcBadge.classList.contains('hidden') && n && n !== '0';
        badge.textContent = show ? n : ''; badge.style.display = show ? '' : 'none';
    };
    syncBadge();
    if (srcBadge) new MutationObserver(syncBadge).observe(srcBadge, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    /* ---------- top bar ---------- */
    var head = document.createElement('div');
    head.id = 'cwm-head';
    head.innerHTML = '<button type="button" class="back" aria-label="กลับ"><i class="fa-solid fa-chevron-left"></i></button>'
        + '<div class="tt"><b></b><small></small></div>';
    header.firstElementChild.appendChild(head);
    head.querySelector('.back').addEventListener('click', function () { App.switchView('more'); });

    var calBtn = document.createElement('button');
    calBtn.type = 'button'; calBtn.id = 'cwm-calbtn'; calBtn.title = 'ปฏิทิน'; calBtn.setAttribute('aria-label', 'ปฏิทิน');
    calBtn.innerHTML = '<i class="fa-regular fa-calendar"></i>';
    var notif = $('notification-container');
    if (notif) notif.parentNode.insertBefore(calBtn, notif);
    calBtn.addEventListener('click', function () { App.switchView('calendar'); });

    /* ---------- เพิ่มเติม page ---------- */
    var more = document.createElement('div');
    more.id = 'view-more';
    more.className = 'view-section hidden h-full flex flex-col overflow-y-auto custom-scrollbar p-6';
    views.appendChild(more);

    var drawMore = function () {
        var u = (App.state && App.state.currentUser) || {};
        var av = $('current-user-avatar'), dept = $('current-user-dept'), team = $('header-team-name');
        var lang = $('profile-lang-text'), dark = !!(App.settings && App.settings.darkMode), notifOn = !(App.settings && App.settings.appNotifications === false);
        var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
        var tile = function (color, icon) { return '<span class="tile t-' + color + '"><i class="' + icon + '"></i></span>'; };
        var grid = [
            ['work-report', 'indigo', 'fa-solid fa-file-lines', 'สร้างรายงาน', 'รายงานการทำงาน', 'data-view="work-report"'],
            ['calendar', 'green', 'fa-regular fa-calendar-days', 'ปฏิทิน', 'งานและกำหนดส่งของคุณ', 'data-view="calendar"'],
            ['team', 'orange', 'fa-solid fa-users', 'ทีมงาน', 'สมาชิกในทีม', 'data-view="team"'],
            ['', 'blue', 'fa-solid fa-gear', 'ตั้งค่า', 'บัญชีและการใช้งาน', 'data-act="settings"']
        ].filter(function (g) { return !g[0] || allowed(g[0]); });
        var sw = function (on) { return '<span class="tg' + (on ? ' on' : '') + '" aria-hidden="true"></span>'; };
        var chev = '<i class="fa-solid fa-chevron-right"></i>';
        var admin = isAdmin() ? '<div class="cwm-lbl">จัดการทีม</div><div class="cwm-list">'
            + '<button type="button" class="li" data-act="member-info">' + tile('indigo', 'fa-solid fa-address-card') + '<span>ข้อมูลทีมงาน</span><span class="r">' + chev + '</span></button>'
            + '<button type="button" class="li" data-act="add-member">' + tile('green', 'fa-solid fa-user-plus') + '<span>เพิ่มพนักงาน</span><span class="r">' + chev + '</span></button>'
            + '<button type="button" class="li" data-act="role">' + tile('orange', 'fa-solid fa-user-shield') + '<span>ตั้งค่าพนักงาน</span><span class="r">' + chev + '</span></button>'
            + '</div>' : '';
        more.innerHTML = '<div class="cwm-more">'
            + '<button type="button" class="cwm-prof" data-act="profile"><img alt="" src="' + esc(av ? av.src : '') + '">'
            + '<span class="who"><b data-no-i18n>' + esc(u.name || '') + '</b><small data-no-i18n>' + esc((dept ? dept.textContent.trim() : '') + (u.email ? ' · ' + u.email : '')) + '</small></span>' + chev + '</button>'
            + '<div class="cwm-grid">' + grid.map(function (g) {
                return '<button type="button" class="mi" ' + g[5] + '>' + tile(g[1], g[2]) + '<b>' + g[3] + '</b><small>' + g[4] + '</small></button>';
            }).join('') + '</div>'
            + '<div class="cwm-list">'
            + '<button type="button" class="li" data-act="theme" role="switch" aria-checked="' + dark + '">' + tile('indigo', 'fa-solid fa-moon') + '<span>โหมดมืด</span><span class="r">' + sw(dark) + '</span></button>'
            + '<button type="button" class="li" data-act="lang">' + tile('blue', 'fa-solid fa-globe') + '<span>ภาษา</span><span class="r"><em data-no-i18n>' + esc(lang ? lang.textContent.trim() : '') + '</em>' + chev + '</span></button>'
            + '<button type="button" class="li" data-act="notif" role="switch" aria-checked="' + notifOn + '">' + tile('sun', 'fa-solid fa-bell') + '<span>การแจ้งเตือน</span><span class="r">' + sw(notifOn) + '</span></button>'
            + '<button type="button" class="li" data-act="help">' + tile('green', 'fa-regular fa-circle-question') + '<span>ช่วยเหลือและคู่มือ</span><span class="r">' + chev + '</span></button>'
            + '<a class="li" href="team.html">' + tile('orange', 'fa-solid fa-people-arrows') + '<span>สลับทีม</span><span class="r"><em data-no-i18n>' + esc(team ? team.textContent.trim() : '') + '</em>' + chev + '</span></a>'
            + '</div>' + admin
            + '<button type="button" class="cwm-out" data-act="out"><i class="fa-solid fa-arrow-right-from-bracket"></i><span></span></button>'
            + '</div>';
        /* sign out: the same button the profile menu shows (owners: ออกจากระบบ; members: ออกจากทีม, see js/memberActions.js) */
        var t = outTarget(), out = more.querySelector('.cwm-out');
        out.style.display = t ? '' : 'none';
        if (t) {
            out.querySelector('span').textContent = t.textContent.trim();
            out.querySelector('i').className = /logout\(\)/.test(t.getAttribute('onclick') || '') ? 'fa-solid fa-arrow-right-from-bracket' : 'fa-solid fa-door-open';
        }
    };
    var outTarget = function () {
        if (!pm) return null;
        var list = pm.querySelectorAll('.p-2 > button.text-red-600');
        return Array.prototype.find.call(list, function (b) { return b.style.display !== 'none' && !b.classList.contains('hidden'); }) || null;
    };
    var hideSheet = function () { if (pm) pm.classList.add('hidden'); };
    more.addEventListener('click', function (e) {
        var v = e.target.closest('[data-view]');
        if (v) { App.switchView(v.getAttribute('data-view')); return; }
        var b = e.target.closest('[data-act]'); if (!b) return;
        e.stopPropagation();
        var act = b.getAttribute('data-act');
        if (act === 'profile') { if (pm) pm.classList.remove('hidden'); }
        else if (act === 'settings') App.openSettingsModal();
        else if (act === 'theme') App.toggleTheme(e);
        else if (act === 'lang') App.toggleLanguage();
        else if (act === 'notif') { App.toggleAppNotifications(!(App.settings && App.settings.appNotifications !== false)); redraw(); }
        else if (act === 'help') { App.openHelp(); hideSheet(); }
        else if (act === 'member-info' && typeof MemberInfo !== 'undefined') MemberInfo.open();
        else if (act === 'add-member' && typeof InvitePage !== 'undefined') InvitePage.open();
        else if (act === 'role') App.openRoleModal();
        else if (act === 'out') { var t = outTarget(); if (t) t.click(); }
    });

    /* ---------- follow the page that is open ---------- */
    var titleEl = $('main-header-title');
    var current = function () { return (App.state && App.state.currentView) || 'dashboard'; };
    var sync = function () {
        if (!phone.matches) return;
        var v = current();
        var tab = isTab(v) ? v : 'more';
        bnav.querySelectorAll('[data-v]').forEach(function (b) {
            var on = b.getAttribute('data-v') === tab;
            b.classList.toggle('on', on);
            if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
            b.style.display = allowed(b.getAttribute('data-v')) ? '' : 'none';
        });
        /* attributes, not classes: other scripts rewrite <body class> */
        document.body.setAttribute('data-cwm-view', v === 'dashboard' ? 'home' : (isTab(v) ? 'tab' : 'sub'));
        head.querySelector('b').textContent = TITLE[v] || (titleEl ? titleEl.textContent.trim() : '');
        head.querySelector('small').textContent = SUB[v] || '';
        calBtn.classList.toggle('on', v === 'calendar');
        if (v === 'more') { drawn = ''; redraw(); }
    };
    var go = App.switchView;
    App.switchView = function (view) {
        var r = go.apply(this, arguments);
        if (view === 'more' && titleEl) titleEl.textContent = 'เพิ่มเติม';
        try { sync(); } catch (e) { }
        if (phone.matches) { var sec = $('view-' + view); if (sec) sec.scrollTop = 0; }
        return r;
    };
    /* the ☰ menu is gone on phones: anything that would open it (e.g. closeTeamSubmenuOnMobile) leaves it closed */
    var toggle = App.toggleSidebar;
    App.toggleSidebar = function () {
        if (phone.matches && sidebar && sidebar.classList.contains('w-20')) return;
        return toggle.apply(this, arguments);
    };
    var settle = function () {
        if (phone.matches && sidebar && sidebar.classList.contains('w-64')) toggle.call(App);
        sync();
    };
    /* redraw เพิ่มเติม when the theme, language, name, picture or team changes */
    var drawn = '';
    var redraw = function () {
        if (!phone.matches || current() !== 'more') return;
        /* only when something shown here changed (other scripts touch these often; redrawing every time would loop with js/i18n.js) */
        var key = [document.documentElement.classList.contains('dark'), App.settings && App.settings.language, App.settings && App.settings.appNotifications,
            ($('current-user-name') || {}).textContent, ($('current-user-avatar') || {}).src, ($('header-team-name') || {}).textContent].join('|');
        if (key === drawn) return;
        drawn = key; drawMore();
    };
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    ['current-user-name', 'current-user-avatar', 'header-team-name', 'profile-lang-text'].forEach(function (id) {
        var el = $(id); if (el) new MutationObserver(redraw).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    });
    if (phone.addEventListener) phone.addEventListener('change', settle); else if (phone.addListener) phone.addListener(settle);
    settle();
    document.addEventListener('DOMContentLoaded', settle);
    window.addEventListener('load', settle);
})();
