/* ConWork — light / dark theme switch with a "bubble" transition
 * ConworkTheme.swap(apply, from): runs apply() (which changes the theme) while a circle grows from `from`
 *   (an element, a click event, or {x, y}; default: where the last click/tap happened) until it covers the screen.
 *   Uses the View Transitions API; older browsers get an expanding circle overlay instead.
 *   People who ask for less motion (prefers-reduced-motion) get an instant switch.
 * ConworkTheme.switchHtml(): the round sliding switch (sun / moon). Its position follows html.dark, so it needs no syncing.
 */
(function () {
    if (window.ConworkTheme) return;

    var SUN = '<svg class="cw-ts-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8"/></svg>';
    var MOON = '<svg class="cw-ts-moon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

    var css = [
        /* the switch: a soft pill with a round knob that slides with a little bounce */
        '.cw-theme-switch{position:relative;display:inline-block;flex-shrink:0;width:52px;height:28px;border-radius:999px;vertical-align:middle;',
        /* deeper colours and a thin ring, so the switch stands out on white menus and on dark ones */
        'background:linear-gradient(135deg,#38bdf8 0%,#f59e0b 100%);box-shadow:inset 0 1px 3px rgba(15,23,42,.25),0 0 0 1px rgba(15,23,42,.12);transition:background .5s ease,box-shadow .3s ease}',
        'html.dark .cw-theme-switch{background:linear-gradient(135deg,#312e81 0%,#6366f1 100%);box-shadow:inset 0 1px 3px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.18)}',
        '.cw-theme-switch::before,.cw-theme-switch::after{content:"";position:absolute;border-radius:50%;background:#fff;opacity:0;transition:opacity .4s ease,transform .5s cubic-bezier(.34,1.56,.64,1)}',
        '.cw-theme-switch::before{width:3px;height:3px;left:12px;top:8px;transform:scale(.2)}',
        '.cw-theme-switch::after{width:2px;height:2px;left:19px;top:17px;transform:scale(.2)}',
        'html.dark .cw-theme-switch::before,html.dark .cw-theme-switch::after{opacity:.85;transform:scale(1)}',
        '.cw-ts-knob{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;',
        'box-shadow:0 2px 6px rgba(15,23,42,.28);transition:transform .6s cubic-bezier(.34,1.56,.64,1),background .5s ease}',
        'html.dark .cw-ts-knob{transform:translateX(24px);background:#0f172a}',
        '.cw-ts-knob svg{position:absolute;width:14px;height:14px;transition:opacity .35s ease,transform .6s cubic-bezier(.34,1.56,.64,1)}',
        '.cw-ts-sun{color:#d97706;opacity:1;transform:rotate(0) scale(1)}',
        '.cw-ts-moon{color:#c7d2fe;opacity:0;transform:rotate(-90deg) scale(.4)}',
        'html.dark .cw-ts-sun{opacity:0;transform:rotate(90deg) scale(.4)}',
        'html.dark .cw-ts-moon{opacity:1;transform:rotate(0) scale(1)}',
        /* squish on press, like a bubble */
        ':is(button,[role=switch]):active .cw-ts-knob{width:26px}',
        'html.dark :is(button,[role=switch]):active .cw-ts-knob{transform:translateX(20px)}',
        '.cw-theme-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px;border:0;background:transparent;border-radius:999px;cursor:pointer}',
        '.cw-theme-btn:focus-visible{outline:2px solid #3b82f6;outline-offset:2px}',
        /* the new theme is revealed by a growing circle: stop the default cross-fade */
        '::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}',
        '::view-transition-old(root){z-index:1}::view-transition-new(root){z-index:2147483646}',
        '.cw-theme-bubble{position:fixed;border-radius:50%;pointer-events:none;z-index:2147483647;will-change:transform,opacity}',
        '@media (prefers-reduced-motion: reduce){.cw-theme-switch,.cw-theme-switch::before,.cw-theme-switch::after,.cw-ts-knob,.cw-ts-knob svg{transition:none!important}}'
    ].join('\n');
    function addStyle() {
        if (document.getElementById('cw-theme-style')) return;
        var s = document.createElement('style'); s.id = 'cw-theme-style'; s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
    }
    addStyle();

    /* where the person last clicked or tapped: the bubble starts there when no element is given */
    var last = null;
    document.addEventListener('pointerdown', function (e) { last = { x: e.clientX, y: e.clientY }; }, true);

    function pointFrom(from) {
        if (from && typeof from.clientX === 'number' && (from.clientX || from.clientY)) return { x: from.clientX, y: from.clientY };
        if (from && from.getBoundingClientRect) {
            var r = from.getBoundingClientRect();
            if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
        if (from && typeof from.x === 'number') return { x: from.x, y: from.y };
        return last || { x: window.innerWidth - 40, y: 40 };
    }
    function reducedMotion() {
        try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
    }

    /* switches run one after another: a second click during the animation waits for the first one,
       so the theme always ends where the clicks say (apply functions should read the current theme when they run) */
    var queue = Promise.resolve();
    function swap(apply, from) {
        if (typeof apply !== 'function') return Promise.resolve();
        var point = pointFrom(from); // where the click was, taken now
        var job = function () { return runSwap(apply, point); };
        queue = queue.then(job, job);
        return queue;
    }
    /* never wait longer than this for a step the browser may stall (e.g. a tab in the background) */
    function capped(promise, ms) {
        return Promise.race([promise, new Promise(function (r) { setTimeout(r, ms); })]);
    }
    function runSwap(apply, p) {
        if (reducedMotion() || document.visibilityState === 'hidden') { apply(); return Promise.resolve(); }
        var W = window.innerWidth, H = window.innerHeight;
        var R = Math.hypot(Math.max(p.x, W - p.x), Math.max(p.y, H - p.y));
        var done = function () { };

        if (typeof document.startViewTransition === 'function') {
            try {
                var applied = false;
                /* apply only once: a stalled transition can run this after the time limit below already did */
                var t = document.startViewTransition(function () { if (!applied) { applied = true; apply(); } });
                t.ready.then(function () {
                    document.documentElement.animate(
                        { clipPath: ['circle(0px at ' + p.x + 'px ' + p.y + 'px)', 'circle(' + R + 'px at ' + p.x + 'px ' + p.y + 'px)'] },
                        { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' });
                }).catch(function () { });
                /* if the browser drops or stalls the transition, the theme is still applied */
                return capped(t.finished.catch(function () { }), 1600).then(function () { if (!applied) { applied = true; apply(); } });
            } catch (e) { /* fall through to the overlay */ }
        }

        /* older browsers: a circle in the new theme's colour grows over the page, the theme swaps underneath, the circle fades */
        return new Promise(function (resolve) {
            var goingDark = !document.documentElement.classList.contains('dark');
            var b = document.createElement('div');
            b.className = 'cw-theme-bubble';
            b.style.cssText = 'left:' + (p.x - R) + 'px;top:' + (p.y - R) + 'px;width:' + (2 * R) + 'px;height:' + (2 * R) + 'px;background:' + (goingDark ? '#0f172a' : '#f8fafc') + ';transform:scale(0)';
            document.body.appendChild(b);
            var applied = false, ended = false;
            var applyOnce = function () { if (!applied) { applied = true; apply(); } };
            var finish = function () { if (ended) return; ended = true; applyOnce(); if (b.parentNode) b.remove(); done(); resolve(); };
            /* animations stop while the tab is in the background: never leave the circle covering the page */
            setTimeout(finish, 1500);
            if (!b.animate) { finish(); return; }
            b.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' })
                .finished.then(function () {
                    applyOnce();
                    return b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' }).finished;
                }).then(finish, finish);
        });
    }

    /* switch the page theme; save(dark) stores the choice (each page keeps it in conwork_user_settings) */
    function setDark(dark, from, save) {
        return swap(function () {
            document.documentElement.classList.toggle('dark', !!dark);
            if (typeof save === 'function') save(!!dark);
        }, from);
    }

    function switchHtml() {
        return '<span class="cw-theme-switch" aria-hidden="true"><span class="cw-ts-knob">' + SUN + MOON + '</span></span>';
    }

    window.ConworkTheme = { swap: swap, setDark: setDark, switchHtml: switchHtml, isDark: function () { return document.documentElement.classList.contains('dark'); } };
})();
