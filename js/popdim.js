/**
 * ConWork — darken the page behind an open pop-up menu (profile menu, bell, card menus …)
 * The menus open and close as before (their own code); this only watches whether one is showing.
 * The shade lets taps through, so tapping the page still closes the menu the way it always did.
 * Load at the end of app.html / team.html.
 */
(function () {
    var IDS = ['profile-menu-dropdown', 'notification-dropdown', 'team-view-dropdown', 'project-context-menu',
        'task-section-context-menu', 'up-context-menu', 'tm-bell-menu'];
    var shade = document.createElement('div');
    shade.id = 'cw-pop-dim';
    shade.setAttribute('aria-hidden', 'true');
    /* under the side menu (z 40+) and the menus themselves (z 50+), over the page */
    shade.style.cssText = 'position:fixed;inset:0;z-index:38;background:rgba(15,23,42,.35);opacity:0;pointer-events:none;transition:opacity .15s ease;';
    document.body.appendChild(shade);

    function shown(el) {
        if (!el || el.classList.contains('hidden')) return false;
        var cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getClientRects().length > 0;
    }
    /* a menu inside the top bar (the bell) would sit under the shade with its bar: lift the bar while it is open */
    var lifted = null;
    function lift(bar) {
        if (lifted === bar) return;
        if (lifted) { lifted.style.zIndex = ''; lifted.style.position = lifted.__cwPos || ''; }
        lifted = bar || null;
        if (lifted) { lifted.__cwPos = lifted.style.position; if (getComputedStyle(lifted).position === 'static') lifted.style.position = 'relative'; lifted.style.zIndex = '39'; }
    }
    function update() {
        var open = null;
        IDS.some(function (id) { var el = document.getElementById(id); if (shown(el)) { open = el; return true; } return false; });
        shade.style.opacity = open ? '1' : '0';
        lift(open ? open.closest('header, .tm-topbar') : null);
        /* the side menu is darkened too, unless the open menu is its own (the profile menu) */
        var side = document.getElementById('app-sidebar');
        if (side) side.style.zIndex = open && !side.contains(open) ? '30' : '';
    }
    var queued = false;
    function soon() { if (queued) return; queued = true; setTimeout(function () { queued = false; update(); }, 0); }

    var mo = new MutationObserver(soon);
    function watch() {
        IDS.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && !el.__cwDim) { el.__cwDim = true; mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] }); }
        });
    }
    watch();
    /* some menus are built later: look again on every tap */
    document.addEventListener('click', function () { watch(); soon(); }, true);
    document.addEventListener('keydown', soon, true);
    update();
})();
