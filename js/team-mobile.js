/* ConWork team.html: phone layout from the "team.html · Mobile" frames (css/team-mobile.css has the look).
   Phones only (≤640px):
   - bottom navbar with 3 tabs: ทีม · Mailbox · โปรไฟล์ (it replaces the ☰ side menu); "‹ แดชบอร์ด" top-left goes back to the app
   - ทีม: invite-code card first, then Build / Leave, then the teams as compact cards (tap = team details)
   - team details: full screen, invite code on a blue card
   - Mailbox: filter chips (all / invitations / others), each message on its own card
   - โปรไฟล์: profile card, 3 segments (personal info · teams and roles · account), display settings, sign out top-right
   Only moves and styles the page's own parts: every button still runs team.html's own code. Texts are translated by js/i18n.js. */
(function () {
    if (document.body.getAttribute('data-page') !== 'team') return;
    var phone = window.matchMedia('(max-width: 640px)');
    var $ = function (id) { return document.getElementById(id); };
    var Q = function (s, r) { return (r || document).querySelector(s); };

    if (typeof th2en !== 'undefined') Object.assign(th2en, {
        'แดชบอร์ด': 'Dashboard', 'ทีม': 'Team', 'โปรไฟล์': 'Profile', 'ทีมของคุณ': 'Your teams', 'ทีมและบทบาท': 'Teams and roles',
        'บัญชีผู้ใช้': 'Account', 'ข้อมูลส่วนตัว': 'Personal info', 'การแสดงผล': 'Display', 'การแจ้งเตือน': 'Notifications',
        'ทั้งหมด': 'All', 'คำเชิญ': 'Invitations', 'อื่น ๆ': 'Others', 'คลิกที่การ์ดเพื่อดูรายละเอียดทีม รหัสเชิญ และสมาชิก': 'Tap a card to see the team, its invite code and members',
        'ออกจากระบบ': 'Sign out', 'ไม่มีรายการ': 'Nothing here'
    });

    var topbar = Q('.tm-topbar'), title = $('tm-title'), sub = $('tm-subtitle');
    if (!topbar || !title) return;
    var current = function () { var h = location.hash.slice(1); return h === 'profile' || h === 'mailbox' ? h : 'team'; };
    var go = function (tab) { var a = Q('#app-sidebar .tm-nav[data-tab="' + tab + '"]'); if (a) a.click(); sync(); };

    /* ---------- top bar: ‹ แดชบอร์ด · page name + line · bell (team, mailbox) / sign out (profile) ---------- */
    var back = document.createElement('a');
    back.id = 'tmm-back'; back.href = 'app.html';
    back.innerHTML = '<i class="fa-solid fa-chevron-left"></i><span>แดชบอร์ด</span>';
    var head = document.createElement('div');
    head.id = 'tmm-head'; head.innerHTML = '<b></b><small></small>';
    topbar.insertBefore(head, topbar.firstChild);
    topbar.insertBefore(back, head);
    var out = document.createElement('button');
    out.type = 'button'; out.id = 'tmm-out'; out.title = 'ออกจากระบบ'; out.setAttribute('aria-label', 'ออกจากระบบ');
    out.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i>';
    topbar.appendChild(out);
    out.addEventListener('click', function () { if (typeof logout === 'function') logout(); });

    /* ---------- bottom navbar ---------- */
    var nav = document.createElement('nav');
    nav.id = 'tmm-bnav'; nav.setAttribute('aria-label', 'เมนู');
    nav.innerHTML = [['team', 'fa-solid fa-users', 'ทีม'], ['mailbox', 'fa-regular fa-envelope', 'Mailbox'], ['profile', 'fa-regular fa-user', 'โปรไฟล์']].map(function (t) {
        return '<button type="button" data-v="' + t[0] + '"><span class="ic"><i class="' + t[1] + '"></i>' + (t[0] === 'mailbox' ? '<b class="badge" data-no-i18n></b>' : '') + '</span><span class="lb">' + t[2] + '</span></button>';
    }).join('');
    document.body.appendChild(nav);
    nav.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) go(b.getAttribute('data-v')); });
    var mailBadge = $('tm-mail-badge'), badge = Q('.badge', nav);
    var syncBadge = function () {
        var n = mailBadge ? mailBadge.textContent.trim() : '', show = mailBadge && !mailBadge.classList.contains('hidden') && n && n !== '0';
        badge.textContent = show ? n : ''; badge.style.display = show ? '' : 'none';
    };
    syncBadge();
    if (mailBadge) new MutationObserver(syncBadge).observe(mailBadge, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    /* ---------- ทีม tab: code card · Build/Leave · "ทีมของคุณ" · cards · hint ---------- */
    var tabTeam = $('tab-team'), code = $('tm-code-bar'), grid = $('tm-grid');
    var teamHead = document.createElement('div');
    teamHead.id = 'tmm-teams-head'; teamHead.innerHTML = '<h3>ทีมของคุณ</h3><span data-no-i18n></span>';
    var hint = document.createElement('p');
    hint.id = 'tmm-hint'; hint.textContent = 'คลิกที่การ์ดเพื่อดูรายละเอียดทีม รหัสเชิญ และสมาชิก';
    if (tabTeam && grid) {
        grid.parentNode.insertBefore(teamHead, grid);
        grid.parentNode.insertBefore(hint, grid.nextSibling);
        var count = function () {
            var n = grid.querySelectorAll('[data-team]').length;
            Q('span', teamHead).textContent = n ? n + (App2en() ? (n === 1 ? ' team' : ' teams') : ' ทีม') : '';
            teamHead.style.display = hint.style.display = n ? '' : 'none';
        };
        count(); new MutationObserver(count).observe(grid, { childList: true });
    }
    function App2en() { try { return JSON.parse(localStorage.getItem('conwork_user_settings') || '{}').language === 'en'; } catch (e) { return false; } }
    /* the code card goes first on phones, back where it was on wider screens */
    var codeHome = code && code.nextSibling, actions = tabTeam && tabTeam.firstElementChild;
    var placeCode = function () {
        if (!code || !tabTeam) return;
        if (phone.matches) { if (tabTeam.firstElementChild !== code) tabTeam.insertBefore(code, tabTeam.firstElementChild); }
        else if (code.nextSibling !== codeHome && codeHome && codeHome.parentNode === tabTeam) tabTeam.insertBefore(code, codeHome);
    };

    /* ---------- team details: invite code on a blue card ---------- */
    var dCode = $('tm-d-code');
    if (dCode) {
        var row = dCode.parentNode, label = row.previousElementSibling;
        var card = document.createElement('div'); card.id = 'tmm-code-card';
        row.parentNode.insertBefore(card, label); card.appendChild(label); card.appendChild(row);
    }

    /* ---------- Mailbox: filter chips + the note on top ---------- */
    var mbTab = $('tab-mailbox'), mb = $('tm-mailbox'), filter = 'all';
    if (mbTab && mb) {
        var chips = document.createElement('div');
        chips.id = 'tmm-mb-chips';
        chips.innerHTML = '<button type="button" data-f="all" class="on">ทั้งหมด</button><button type="button" data-f="inv">คำเชิญ<b data-no-i18n></b></button><button type="button" data-f="other">อื่น ๆ</button>';
        mbTab.insertBefore(chips, mbTab.firstChild);
        var note = mbTab.querySelector('p.text-xs');
        if (note) { note.id = 'tmm-mb-note'; mbTab.insertBefore(note, mb); }
        var empty = document.createElement('p'); empty.id = 'tmm-mb-empty'; empty.textContent = 'ไม่มีรายการ'; mb.parentNode.insertBefore(empty, mb.nextSibling);
        var isInv = function (row) { return !!row.querySelector('span.bg-blue-100'); };
        var applyFilter = function () {
            var rows = mb.querySelectorAll('[data-mb-row]'), inv = 0, shown = 0;
            rows.forEach(function (r) {
                var i = isInv(r); if (i) inv++;
                var show = filter === 'all' || (filter === 'inv' ? i : !i);
                r.style.display = show ? '' : 'none'; if (show) shown++;
            });
            Q('[data-f="inv"] b', chips).textContent = inv ? String(inv) : '';
            chips.querySelectorAll('[data-f]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-f') === filter); });
            empty.style.display = rows.length && !shown ? 'block' : 'none';
        };
        chips.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; filter = b.getAttribute('data-f'); applyFilter(); });
        new MutationObserver(applyFilter).observe(mb, { childList: true, subtree: true });
    }

    /* ---------- โปรไฟล์: segments ---------- */
    var prof = $('tab-profile');
    var SEG = [['personal', 'ข้อมูลส่วนตัว'], ['teams', 'ทีมและบทบาท'], ['account', 'บัญชีผู้ใช้']], seg = 'personal';
    if (prof) {
        /* tag the parts: each heading with the card(s) under it */
        var hs = prof.querySelectorAll(':scope > h2'), piHead = $('tm-pi-edit') && $('tm-pi-edit').parentNode;
        if (piHead) { piHead.setAttribute('data-seg', 'personal'); $('tm-pi-card').setAttribute('data-seg', 'personal'); var lock = $('tm-pi-card').nextElementSibling; if (lock) lock.setAttribute('data-seg', 'personal'); }
        hs.forEach(function (h) {
            var t = h.textContent.trim(), card = h.nextElementSibling;
            var key = /ทีมและบทบาท|Teams/i.test(t) ? 'teams' : /บัญชีผู้ใช้|Account/i.test(t) ? 'account' : /แจ้งเตือน|Notif/i.test(t) ? 'account' : /แสดงผล|Display/i.test(t) ? 'display' : '';
            if (!key) return;
            h.setAttribute('data-seg', key); if (card) card.setAttribute('data-seg', key);
        });
        /* font size sits with language and theme under การแสดงผล (as in the design) */
        var font = Q('[data-setting="fontSize"]', prof), display = Q('div[data-seg="display"]', prof);
        if (font && display) display.appendChild(font.closest('.tm-row'));
        var segBar = document.createElement('div');
        segBar.id = 'tmm-seg';
        segBar.innerHTML = SEG.map(function (s) { return '<button type="button" data-s="' + s[0] + '">' + s[1] + '</button>'; }).join('');
        prof.insertBefore(segBar, prof.firstElementChild.nextSibling);
        segBar.addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; seg = b.getAttribute('data-s'); syncSeg(); });
    }
    var syncSeg = function () {
        if (!prof) return;
        prof.setAttribute('data-tmm-seg', seg);
        segBar.querySelectorAll('[data-s]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === seg); });
    };

    /* ---------- follow the open tab ---------- */
    var TITLE = { team: ['ทีมของฉัน', 'ทีมที่คุณอยู่และคำขอที่รออนุมัติ'], mailbox: ['Mailbox', 'คำเชิญเข้าทีมและข้อความถึงคุณ'], profile: ['โปรไฟล์', ''] };
    function sync() {
        var v = current();
        document.body.setAttribute('data-tmm-tab', v);
        Q('b', head).textContent = TITLE[v][0];
        Q('small', head).textContent = TITLE[v][1];
        nav.querySelectorAll('[data-v]').forEach(function (b) {
            var on = b.getAttribute('data-v') === v; b.classList.toggle('on', on);
            if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        });
        placeCode(); syncSeg();
    }
    window.addEventListener('hashchange', sync);
    document.querySelectorAll('#app-sidebar .tm-nav').forEach(function (a) { a.addEventListener('click', function () { setTimeout(sync, 0); }); });
    if (phone.addEventListener) phone.addEventListener('change', sync); else if (phone.addListener) phone.addListener(sync);
    sync();
})();
