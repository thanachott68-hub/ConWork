/* Keyboard shortcuts in the workspace (the same list the landing page footer shows):
 *   Ctrl+K (⌘K)  search: the search box of the open page, or the project search
 *   N            new task in the open project
 *   G then H     go to the dashboard
 *   Shift+N      open / close notifications
 * Keys are matched by their physical position, so they also work while the keyboard is set to Thai.
 */
(function () {
    var lastG = 0;
    var typing = function (el) {
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };
    var visible = function (el) { return !!(el && el.offsetParent !== null && !el.disabled); };
    var letter = function (e) { return e.code && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : (e.key || '').toLowerCase(); };
    /* a modal on top (create task, settings...) keeps its own keys */
    var modalOpen = function () {
        return [].some.call(document.querySelectorAll('[role="dialog"], .modal, [id$="-modal"]'), function (m) { return m.offsetParent !== null && !m.classList.contains('hidden'); });
    };

    function focusSearch() {
        var view = [].filter.call(document.querySelectorAll('.view-section'), function (v) { return !v.classList.contains('hidden'); })[0];
        var pick = function (root) {
            return [].filter.call((root || document).querySelectorAll('input[type="text"], input[type="search"], input:not([type])'), function (i) {
                return visible(i) && /search|ค้นหา/i.test((i.id || '') + ' ' + (i.placeholder || ''));
            })[0];
        };
        var box = view && pick(view);
        if (!box && window.App && App.switchView) {
            App.switchView('projects');
            box = document.getElementById('project-search-input');
        }
        if (box) { box.focus(); if (box.select) box.select(); }
    }

    document.addEventListener('keydown', function (e) {
        if (!window.App || e.altKey || e.isComposing) return;
        var k = letter(e);
        if ((e.ctrlKey || e.metaKey) && k === 'k') { e.preventDefault(); focusSearch(); return; }
        if (e.ctrlKey || e.metaKey || typing(e.target) || modalOpen()) return;
        if (k === 'n' && e.shiftKey) { e.preventDefault(); if (App.toggleNotificationDropdown) App.toggleNotificationDropdown(); return; }
        if (e.shiftKey) return;
        if (k === 'n') { e.preventDefault(); if (App.createTask) App.createTask(); return; }
        if (k === 'g') { lastG = Date.now(); return; }
        if (k === 'h' && Date.now() - lastG < 1200) {
            e.preventDefault(); lastG = 0;
            var link = document.querySelector('.nav-item[data-view="dashboard"]');
            if (link) link.click(); else if (App.switchView) App.switchView('dashboard');
        }
    });
})();
