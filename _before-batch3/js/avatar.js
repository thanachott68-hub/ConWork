/* ConWork — picture for people who have not added a photo: the first letter of the first name and of the last name
 * (e.g. "ธนโชติ เทนแก้ว" → "ธท"), drawn here instead of loading ui-avatars.com.
 *  • cwAvatar(name) → an image URL (SVG) to use as src.
 *  • Every <img> on the page whose src is a ui-avatars.com link (also links saved in profiles earlier), is empty,
 *    or fails to load, is switched to these letters automatically. */
(function () {
    var LEAD = /^[เแโใไ]/;                       // Thai vowels written before the consonant: skip them
    var MARK = /[ัิ-ฺ็-๎]/; // Thai marks above/below a letter
    var PAL = ['#2563EB', '#16A34A', '#7C3AED', '#DB2777', '#EA580C', '#0891B2', '#4F46E5', '#B45309', '#0D9488', '#DC2626'];

    function firstLetter(word) {
        var w = String(word || '').replace(LEAD, '');
        for (var i = 0; i < w.length; i++) { var c = w.charAt(i); if (!MARK.test(c)) return c.toUpperCase(); }
        return '';
    }
    function initials(name) {
        var s = String(name || '').trim();
        if (!s) return '?';
        if (s.indexOf('@') > 0 && s.indexOf(' ') < 0) s = s.split('@')[0].replace(/[._-]+/g, ' ');
        var parts = s.split(/\s+/).filter(Boolean);
        var a = firstLetter(parts[0]), b = parts.length > 1 ? firstLetter(parts[parts.length - 1]) : '';
        return (a + b) || '?';
    }
    function color(name) {
        var h = 0, s = String(name || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return PAL[Math.abs(h) % PAL.length];
    }
    function cwAvatar(name) {
        var t = initials(name);
        var fs = t.length > 1 ? 38 : 46;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="' + color(name) + '"/>'
            + '<text x="50" y="50" dy=".36em" text-anchor="middle" fill="#fff" font-family="Kanit,IBM Plex Sans Thai,Nunito,system-ui,sans-serif" font-weight="600" font-size="' + fs + '">'
            + t.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }) + '</text></svg>';
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /* the name a picture belongs to */
    function nameFor(img) {
        var src = img.getAttribute('src') || '';
        var m = /ui-avatars\.com\/api\/?\?(.*)$/.exec(src);
        if (m) { try { var n = new URLSearchParams(m[1]).get('name'); if (n) return n; } catch (e) { } }
        if (img.dataset && img.dataset.name) return img.dataset.name;
        if (img.id === 'current-user-avatar' || img.id === 'tm-head-avatar') {
            try {
                var A = typeof App !== 'undefined' ? App : window.App;
                var u = (A && A.state && A.state.currentUser) || JSON.parse(sessionStorage.getItem('conwork_user') || 'null') || {};
                return u.name || u.email || '';
            } catch (e) { return ''; }
        }
        var alt = img.getAttribute('alt') || '';
        return /^(user|avatar|profile|logo)?$/i.test(alt.trim()) ? '' : alt;
    }
    function looksLikeAvatar(img) {
        var c = String(img.className || '');
        return /rounded-full/.test(c) || /avatar/i.test(img.id || '') || /ui-avatars\.com/.test(img.getAttribute('src') || '');
    }
    function fix(img) {
        if (!img || img.tagName !== 'IMG' || img._cwFixing) return;
        var src = img.getAttribute('src');
        var isUi = /ui-avatars\.com/.test(src || '');
        if (!isUi && !((src === '' || src === null) && looksLikeAvatar(img))) return;
        var n = nameFor(img);
        if (!n && !isUi) return;   // nothing to draw yet (the page fills the name in a moment)
        img._cwFixing = true; img.setAttribute('src', cwAvatar(n)); img._cwFixing = false;
    }

    function scan(root) {
        if (!root || !root.querySelectorAll) return;
        if (root.tagName === 'IMG') fix(root);
        Array.prototype.forEach.call(root.querySelectorAll('img'), fix);
    }
    /* a photo link that is broken or gone: show the letters instead of a broken image */
    document.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG' || img._cwFailed || !looksLikeAvatar(img)) return;
        img._cwFailed = true;
        img.setAttribute('src', cwAvatar(nameFor(img)));
    }, true);

    function start() {
        scan(document.body);
        try {
            new MutationObserver(function (list) {
                list.forEach(function (r) {
                    if (r.type === 'attributes') fix(r.target);
                    else Array.prototype.forEach.call(r.addedNodes, function (n) { if (n.nodeType === 1) scan(n); });
                });
            }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        } catch (e) { }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.cwAvatar = cwAvatar;
    window.cwInitials = initials;
})();
