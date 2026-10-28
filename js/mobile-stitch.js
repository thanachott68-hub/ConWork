/* ConWork — phone layout pieces from the Google Stitch design (css/mobile-stitch.css has the look).
   Phones only (≤640px) on app.html:
   - ☰ menu: label over the main menu, the current team under the profile, settings (language, theme) and sign out at the bottom
   - the picture in the top bar opens the profile menu as a sheet with the person's name, position and team
   Nothing new is stored or sent: every button calls the app's own action (App.toggleLanguage, App.toggleTheme, the menu's sign out). */
(function () {
    if (document.body.getAttribute('data-page') !== 'app' || typeof App === 'undefined') return;
    var phone = window.matchMedia('(max-width: 640px)');
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

    if (typeof th2en !== 'undefined') Object.assign(th2en, {
        'เมนูการใช้งานหลัก': 'Main menu', 'การตั้งค่าการใช้งาน': 'Preferences', 'ทีมปัจจุบัน': 'Current team', 'สลับ': 'Switch'
    });

    var sidebar = $('app-sidebar'), nav = sidebar && sidebar.querySelector(':scope > nav');
    var pSec = $('sidebar-profile-section'), pm = $('profile-menu-dropdown');
    var avatar = $('current-user-avatar'), nameEl = $('current-user-name'), deptEl = $('current-user-dept'), teamEl = $('header-team-name');
    if (!sidebar || !nav || !pSec || !pm) return;

    var teamName = function () { return (teamEl && teamEl.textContent.trim()) || ''; };
    var watch = function (el, fn) { if (el) new MutationObserver(fn).observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['src'] }); };

    /* ---------- ☰ menu ---------- */
    var label = document.createElement('div');
    label.id = 'st-nav-label'; label.textContent = 'เมนูการใช้งานหลัก';
    sidebar.insertBefore(label, nav);

    var pill = document.createElement('a');
    pill.id = 'st-team-pill'; pill.href = 'team.html';
    pill.innerHTML = '<i class="fa-solid fa-building"></i><span class="nm" data-no-i18n></span><span class="sw">สลับ <i class="fa-solid fa-chevron-right" style="font-size:10px"></i></span>';
    pill.addEventListener('click', function (e) { e.stopPropagation(); });   /* go to team.html, do not open the profile menu */
    pSec.appendChild(pill);
    var syncPill = function () { pill.querySelector('.nm').textContent = teamName(); pill.style.display = teamName() ? '' : 'none'; };
    syncPill(); watch(teamEl, syncPill);

    var foot = document.createElement('div');
    foot.id = 'st-drawer-foot';
    foot.innerHTML = '<div class="lbl">การตั้งค่าการใช้งาน</div>'
        + '<div class="row"><button type="button" data-st="lang"><i class="fa-solid fa-language"></i><span>ภาษา</span><span class="v" data-st-mirror="profile-lang-text"></span></button>'
        + '<button type="button" data-st="theme"><i class="fa-solid fa-circle-half-stroke"></i><span>ธีม</span><span class="v" data-st-mirror="profile-theme-text"></span></button></div>'
        + '<button type="button" class="out" data-st="out"><i class="fa-solid fa-arrow-right-from-bracket"></i><span data-st-out></span></button>'
        + '<div class="ver"><span data-no-i18n>ConWork</span><b data-st-net></b></div>';
    sidebar.appendChild(foot);
    foot.querySelectorAll('[data-st-mirror]').forEach(function (span) {
        var src = $(span.getAttribute('data-st-mirror'));
        var copy = function () { span.textContent = src ? src.textContent.trim() : ''; };
        copy(); watch(src, copy);
    });
    /* sign out: the same button the profile menu shows (owners: ออกจากระบบ; members: ออกจากทีม, see js/memberActions.js) */
    var outTarget = function () {
        var list = pm.querySelectorAll('.p-2 > button.text-red-600');
        return Array.prototype.find.call(list, function (b) { return b.style.display !== 'none' && !b.classList.contains('hidden'); }) || null;
    };
    var syncOut = function () {
        var t = outTarget(), out = foot.querySelector('.out');
        out.style.display = t ? '' : 'none';
        if (t) {
            out.querySelector('[data-st-out]').textContent = t.textContent.trim();
            out.querySelector('i').className = /logout\(\)/.test(t.getAttribute('onclick') || '') ? 'fa-solid fa-arrow-right-from-bracket' : 'fa-solid fa-door-open';
        }
    };
    var net = function () { var b = foot.querySelector('[data-st-net]'); b.textContent = navigator.onLine ? 'ออนไลน์' : 'ออฟไลน์'; b.style.color = navigator.onLine ? '' : '#94A3B8'; };
    net(); window.addEventListener('online', net); window.addEventListener('offline', net);
    foot.addEventListener('click', function (e) {
        var b = e.target.closest('[data-st]'); if (!b) return;
        e.stopPropagation();
        var what = b.getAttribute('data-st');
        if (what === 'lang') App.toggleLanguage();
        else if (what === 'theme') App.toggleTheme(e);
        else if (what === 'out') { var t = outTarget(); if (t) t.click(); }
    });
    /* refresh the sign-out label each time the menu opens */
    new MutationObserver(function () { if (sidebar.classList.contains('w-64')) syncOut(); }).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    syncOut();

    /* ---------- profile menu as a sheet ---------- */
    var head = document.createElement('div');
    head.id = 'st-pm-head';
    head.innerHTML = '<button type="button" class="x" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button>'
        + '<div class="who"><img alt=""><div style="min-width:0"><div class="nm" data-no-i18n></div><div class="rl"></div><div class="em" data-no-i18n style="font-size:12px;color:var(--st-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div></div></div>'
        + '<a class="team" href="team.html"><span class="ic"><i class="fa-solid fa-people-group"></i></span><span><small>ทีมปัจจุบัน</small><b data-no-i18n></b></span><span class="go"><i class="fa-solid fa-chevron-right"></i></span></a>';
    pm.insertBefore(head, pm.firstChild);
    var syncHead = function () {
        head.querySelector('img').src = (avatar && avatar.src) || '';
        head.querySelector('.nm').textContent = nameEl ? nameEl.textContent.trim() : '';
        head.querySelector('.rl').textContent = deptEl ? deptEl.textContent.trim() : '';
        var u = (App.state && App.state.currentUser) || {};
        head.querySelector('.em').textContent = u.email || '';
        head.querySelector('.team b').textContent = teamName();
        head.querySelector('.team').style.display = teamName() ? '' : 'none';
    };
    syncHead(); [avatar, nameEl, deptEl, teamEl].forEach(function (el) { watch(el, syncHead); });
    head.querySelector('.x').addEventListener('click', function (e) { e.stopPropagation(); pm.classList.add('hidden'); });

    /* on phones the menu lives at the end of <body> (the ☰ menu is closed most of the time, which would hide it); back in the side menu on wider screens */
    var home = pm.parentNode, homeNext = pm.nextSibling;
    var place = function () {
        if (phone.matches) {
            if (pm.parentNode !== document.body) document.body.appendChild(pm);
            pm.classList.add('st-sheet');
        } else {
            pm.classList.remove('st-sheet');
            if (pm.parentNode !== home) home.insertBefore(pm, homeNext && homeNext.parentNode === home ? homeNext : null);
        }
    };
    place();
    if (phone.addEventListener) phone.addEventListener('change', place); else if (phone.addListener) phone.addListener(place);

    var openSheet = function () { pm.classList.remove('hidden'); };
    /* the picture in the top bar (made at the end of app.html) opens the sheet instead of the ☰ menu */
    var hookChip = function () {
        var chip = $('cw-mprofile'); if (!chip || chip._st) return; chip._st = true;
        chip.setAttribute('aria-label', 'โปรไฟล์');
        chip.addEventListener('click', function (e) {
            if (!phone.matches) return;
            e.stopImmediatePropagation(); e.preventDefault();
            if (pm.classList.contains('hidden')) openSheet(); else pm.classList.add('hidden');
        }, true);
    };
    hookChip();
    if (!$('cw-mprofile')) document.addEventListener('DOMContentLoaded', hookChip);

    /* a tap outside the open sheet only closes it (runs before the app's own outside-tap handlers) */
    window.addEventListener('click', function (e) {
        if (!phone.matches || pm.classList.contains('hidden') || pm.contains(e.target)) return;
        if (e.target.closest('#cw-mprofile')) return;
        if (pSec.contains(e.target)) return;   /* the profile card in the ☰ menu toggles it itself */
        e.preventDefault(); e.stopPropagation();
        pm.classList.add('hidden');
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && phone.matches) pm.classList.add('hidden'); });
    /* the sheet opened from the profile card in the ☰ menu: the menu closes, so taps on the sheet are not taken as "outside the menu" */
    new MutationObserver(function () {
        if (!phone.matches || pm.classList.contains('hidden')) return;
        syncHead();
        if (sidebar.classList.contains('w-64')) App.toggleSidebar();
    }).observe(pm, { attributes: true, attributeFilter: ['class'] });
})();
