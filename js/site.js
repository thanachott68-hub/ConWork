/* ConWork — public pages (Products, Solutions, Contact us, Donate)
 * Builds the top bar and footer, switches the language (ไทย / English) and the light/dark theme.
 * Language and theme are saved in conwork_user_settings, the same place the landing page and the app use.
 * Text: write the English in the element and the Thai in data-th="..." (data-th-html="..." when it holds markup).
 */
(function () {
    var KEY = 'conwork_user_settings';
    var read = function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    var save = function (patch) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(read(), patch))); } catch (e) { } };
    /* like the landing page: English until Thai is chosen */
    var lang = function () { return read().language === 'th' ? 'th' : 'en'; };
    if (read().darkMode) document.documentElement.classList.add('dark');

    var FLAG_TH = '<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#A51931"/><rect y="3.33" width="30" height="13.34" fill="#F8FAFC"/><rect y="6.67" width="30" height="6.66" fill="#2D2A4A"/></svg>';
    var FLAG_US = '<svg viewBox="0 0 38 20" preserveAspectRatio="xMinYMid slice" aria-hidden="true"><rect width="38" height="20" fill="#B22234"/><g fill="#FFFFFF"><rect y="1.54" width="38" height="1.54"/><rect y="4.62" width="38" height="1.54"/><rect y="7.69" width="38" height="1.54"/><rect y="10.77" width="38" height="1.54"/><rect y="13.85" width="38" height="1.54"/><rect y="16.92" width="38" height="1.54"/></g><rect width="15.2" height="10.77" fill="#3C3B6E"/><g fill="#FFFFFF"><circle cx="2" cy="1.8" r=".55"/><circle cx="5" cy="1.8" r=".55"/><circle cx="8" cy="1.8" r=".55"/><circle cx="11" cy="1.8" r=".55"/><circle cx="14" cy="1.8" r=".55"/><circle cx="3.5" cy="3.6" r=".55"/><circle cx="6.5" cy="3.6" r=".55"/><circle cx="9.5" cy="3.6" r=".55"/><circle cx="12.5" cy="3.6" r=".55"/><circle cx="2" cy="5.4" r=".55"/><circle cx="5" cy="5.4" r=".55"/><circle cx="8" cy="5.4" r=".55"/><circle cx="11" cy="5.4" r=".55"/><circle cx="14" cy="5.4" r=".55"/><circle cx="3.5" cy="7.2" r=".55"/><circle cx="6.5" cy="7.2" r=".55"/><circle cx="9.5" cy="7.2" r=".55"/><circle cx="12.5" cy="7.2" r=".55"/><circle cx="2" cy="9" r=".55"/><circle cx="5" cy="9" r=".55"/><circle cx="8" cy="9" r=".55"/><circle cx="11" cy="9" r=".55"/><circle cx="14" cy="9" r=".55"/></g></svg>';

    var PAGES = [
        ['products.html', 'Products', 'ผลิตภัณฑ์'],
        ['solutions.html', 'Solutions', 'โซลูชัน'],
        ['contact.html', 'Contact us', 'ติดต่อเรา'],
        ['donate.html', 'Donate', 'สนับสนุนเรา']
    ];

    function navHtml() {
        var here = location.pathname.split('/').pop() || 'index.html';
        var links = PAGES.map(function (p) {
            return '<a href="' + p[0] + '"' + (p[0] === here ? ' aria-current="page"' : '') + ' data-th="' + p[2] + '">' + p[1] + '</a>';
        }).join('');
        var sw = window.ConworkTheme ? ConworkTheme.switchHtml() : '';
        return '<div class="wrap">'
            + '<a class="brand" href="index.html"><span class="cw-logo" style="height:36px"><img src="img/logo.png" alt="ConWork"></span><span class="brand-word">ConWork</span></a>'
            + '<nav class="navlinks" id="site-links" aria-label="Main">' + links + '</nav>'
            + '<div class="nav-tools">'
            + '<button type="button" class="lang-btn" data-site-lang></button>'
            + '<button type="button" class="cw-theme-btn" role="switch" data-site-theme>' + sw + '</button>'
            + '<a class="btn btn-dark btn-signin" href="login.html?mode=login" data-th="เข้าสู่ระบบ">Sign in</a>'
            + '<button type="button" class="menu-btn" data-site-menu aria-controls="site-links" aria-expanded="false" aria-label="Menu">'
            + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>'
            + '</div></div>';
    }
    function footHtml() {
        return '<div class="wrap">'
            + '<span>© 2026 ConWork</span>'
            + '<div class="links">'
            + PAGES.map(function (p) { return '<a href="' + p[0] + '" data-th="' + p[2] + '">' + p[1] + '</a>'; }).join('')
            + '<a href="privacy.html" data-th="นโยบายความเป็นส่วนตัว">Privacy Policy</a>'
            + '<a href="terms.html" data-th="ข้อกำหนดการใช้งาน">Terms of Service</a>'
            + '</div></div>';
    }

    /* put the page's text in the chosen language (the English stays in data-en after the first switch) */
    function applyLang() {
        var th = lang() === 'th';
        document.documentElement.lang = th ? 'th' : 'en';
        document.querySelectorAll('[data-th],[data-th-html]').forEach(function (el) {
            var html = el.hasAttribute('data-th-html');
            if (!el.hasAttribute('data-en')) el.setAttribute('data-en', html ? el.innerHTML : el.textContent);
            var v = th ? el.getAttribute(html ? 'data-th-html' : 'data-th') : el.getAttribute('data-en');
            if (html) el.innerHTML = v; else el.textContent = v;
        });
        document.querySelectorAll('[data-th-placeholder]').forEach(function (el) {
            if (!el.hasAttribute('data-en-placeholder')) el.setAttribute('data-en-placeholder', el.placeholder);
            el.placeholder = th ? el.getAttribute('data-th-placeholder') : el.getAttribute('data-en-placeholder');
        });
        var t = document.querySelector('title');
        if (t && t.hasAttribute('data-th')) { /* handled above */ }
        document.querySelectorAll('[data-site-lang]').forEach(function (b) {
            b.innerHTML = th ? FLAG_TH : FLAG_US;
            b.title = th ? 'ภาษา: ไทย (กดเพื่อเปลี่ยนเป็น English)' : 'Language: English (click for ไทย)';
            b.setAttribute('aria-label', b.title);
        });
        syncTheme();
        document.dispatchEvent(new CustomEvent('site:lang', { detail: { lang: th ? 'th' : 'en' } }));
    }
    function syncTheme() {
        var dark = document.documentElement.classList.contains('dark'), th = lang() === 'th';
        document.querySelectorAll('[data-site-theme]').forEach(function (b) {
            b.setAttribute('aria-checked', dark ? 'true' : 'false');
            b.title = th ? (dark ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด') : (dark ? 'Switch to light theme' : 'Switch to dark theme');
            b.setAttribute('aria-label', b.title);
        });
    }

    function mount() {
        var nav = document.getElementById('site-nav'), foot = document.getElementById('site-foot');
        if (nav) nav.innerHTML = navHtml();
        if (foot) foot.innerHTML = footHtml();
        document.addEventListener('click', function (e) {
            var t = e.target.closest ? e.target : null; if (!t) return;
            if (t.closest('[data-site-lang]')) { save({ language: lang() === 'th' ? 'en' : 'th', languageChosen: true }); applyLang(); return; }
            var tb = t.closest('[data-site-theme]');
            if (tb) {
                var go = function () { var d = !document.documentElement.classList.contains('dark'); document.documentElement.classList.toggle('dark', d); save({ darkMode: d }); syncTheme(); };
                if (window.ConworkTheme) ConworkTheme.swap(go, tb); else go();
                return;
            }
            var mb = t.closest('[data-site-menu]');
            if (mb) { var l = document.getElementById('site-links'); var open = l.classList.toggle('open'); mb.setAttribute('aria-expanded', open ? 'true' : 'false'); }
        });
        /* cards slide in as they come into view */
        var items = document.querySelectorAll('.reveal');
        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }); }, { threshold: 0.12 });
            items.forEach(function (el) { io.observe(el); });
        } else items.forEach(function (el) { el.classList.add('in'); });
        applyLang();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
    window.ConworkSite = { lang: lang, applyLang: applyLang };
})();
