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
        /* pictures set automatically (not uploaded in ConWork) also become the initials */
        var isUi = /ui-avatars\.com|pravatar\.cc|googleusercontent\.com|gravatar\.com/.test(src || '');
        if (!isUi && !((src === '' || src === null) && looksLikeAvatar(img))) return;
        var n = nameFor(img);
        if (!n && !/ui-avatars\.com/.test(src || '')) return;   // nothing to draw yet (the page fills the name in a moment)
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

    /* "ปรับรูป": after choosing a photo, drag it to move and use the slider (or pinch / mouse wheel) to zoom,
       then the circle is cut out as a square JPEG of `size` px. Resolves with a data URL; rejects with
       Error('cancel') when the person closes the window. */
    function cwCropImage(file, size) {
        size = size || 256;
        return new Promise(function (resolve, reject) {
            if (!file || !/^image\//.test(file.type)) return reject(new Error('กรุณาเลือกไฟล์รูปภาพ'));
            var url = URL.createObjectURL(file), img = new Image();
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('อ่านรูปไม่ได้')); };
            img.onload = function () {
                var V = 280;                                     // the crop circle on screen
                var base = Math.max(V / img.width, V / img.height), zoom = 1, x = 0, y = 0;
                var box = document.createElement('div');
                box.className = 'fixed inset-0 z-[900] bg-gray-900/70 flex items-center justify-center p-4';
                box.innerHTML = '<div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" role="dialog" aria-modal="true">'
                    + '<h3 class="font-bold text-gray-800 mb-1">ปรับรูปโปรไฟล์</h3><p class="text-xs text-gray-500 mb-3">ลากเพื่อเลื่อน · เลื่อนแถบเพื่อย่อ/ขยาย</p>'
                    + '<div data-crop style="position:relative;width:' + V + 'px;height:' + V + 'px;max-width:100%;margin:0 auto;overflow:hidden;border-radius:16px;background:#0f172a;touch-action:none;cursor:grab">'
                    + '<img data-img alt="" draggable="false" style="position:absolute;left:50%;top:50%;max-width:none;user-select:none;-webkit-user-select:none;pointer-events:none">'
                    + '<div style="position:absolute;inset:0;border-radius:50%;box-shadow:0 0 0 999px rgba(15,23,42,.55);pointer-events:none"></div></div>'
                    + '<div class="flex items-center gap-3 mt-4"><span class="text-gray-400 text-sm">−</span><input data-zoom type="range" min="1" max="4" step="0.01" value="1" class="flex-1" aria-label="ย่อ/ขยาย"><span class="text-gray-400 text-sm">+</span></div>'
                    + '<div class="flex gap-2 mt-4"><button type="button" data-cancel class="ml-auto px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold">ยกเลิก</button>'
                    + '<button type="button" data-ok class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">ใช้รูปนี้</button></div></div>';
                document.body.appendChild(box);
                var stage = box.querySelector('[data-crop]'), pic = box.querySelector('[data-img]'), range = box.querySelector('[data-zoom]');
                pic.src = url;
                function clamp() {
                    var s = base * zoom, mx = Math.max(0, (img.width * s - V) / 2), my = Math.max(0, (img.height * s - V) / 2);
                    x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
                }
                function draw() {
                    clamp(); var s = base * zoom;
                    pic.style.width = img.width * s + 'px'; pic.style.height = img.height * s + 'px';
                    pic.style.transform = 'translate(calc(-50% + ' + x + 'px), calc(-50% + ' + y + 'px))';
                }
                draw();
                range.addEventListener('input', function () { zoom = Number(range.value); draw(); });
                stage.addEventListener('wheel', function (e) { e.preventDefault(); zoom = Math.min(4, Math.max(1, zoom - e.deltaY * 0.002)); range.value = zoom; draw(); }, { passive: false });
                /* drag with mouse / finger; two fingers pinch to zoom */
                var pts = {}, last = null, pinch = null;
                stage.addEventListener('pointerdown', function (e) { stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY }; last = { x: e.clientX, y: e.clientY }; stage.style.cursor = 'grabbing'; });
                stage.addEventListener('pointermove', function (e) {
                    if (!pts[e.pointerId]) return;
                    pts[e.pointerId] = { x: e.clientX, y: e.clientY };
                    var ids = Object.keys(pts);
                    if (ids.length >= 2) {
                        var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
                        if (pinch) { zoom = Math.min(4, Math.max(1, zoom * d / pinch)); range.value = zoom; draw(); }
                        pinch = d; return;
                    }
                    if (last) { x += e.clientX - last.x; y += e.clientY - last.y; draw(); }
                    last = { x: e.clientX, y: e.clientY };
                });
                var up = function (e) { delete pts[e.pointerId]; pinch = null; last = null; stage.style.cursor = 'grab'; };
                stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
                function close() { box.remove(); URL.revokeObjectURL(url); }
                box.querySelector('[data-cancel]').addEventListener('click', function () { close(); reject(new Error('cancel')); });
                box.addEventListener('click', function (e) { if (e.target === box) { close(); reject(new Error('cancel')); } });
                box.querySelector('[data-ok]').addEventListener('click', function () {
                    var s = base * zoom, c = document.createElement('canvas'); c.width = c.height = size;
                    /* the part of the photo inside the circle, in photo pixels */
                    var sw = V / s, sx = img.width / 2 - x / s - sw / 2, sy = img.height / 2 - y / s - sw / 2;
                    var g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
                    g.drawImage(img, sx, sy, sw, sw, 0, 0, size, size);
                    close(); resolve(c.toDataURL('image/jpeg', 0.85));
                });
            };
            img.src = url;
        });
    }

    window.cwAvatar = cwAvatar;
    window.cwInitials = initials;
    window.cwCropImage = cwCropImage;
})();
