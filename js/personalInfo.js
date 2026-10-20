/* ConWork — personal information (Thai name, birthday, gender, phone, photo, personal email)
 * Used by profile-setup.html, team.html and app.html.
 * Stored in the Supabase table member_details (conwork-personal-info.sql); when that table is not there yet,
 * or Supabase is off, it is kept in this browser (localStorage "conwork_personal_info"). */
(function () {
    var LKEY = 'conwork_personal_info';
    var NOTABLE = /42P01|PGRST205|PGRST204|Could not find the table|relation .* does not exist|schema cache/i;
    var readLocal = function () { try { return JSON.parse(localStorage.getItem(LKEY)) || {}; } catch (e) { return {}; } };
    var writeLocal = function (v) { try { localStorage.setItem(LKEY, JSON.stringify(v)); } catch (e) { } };
    var client = function () {
        var s = window.conworkSupabase;
        return s && s.isAvailable && s.isAvailable() ? s.client : null;
    };
    var noTable = false;   /* remember once we learn the table is missing */

    /* with Supabase, always use the id of the account that is signed in (the browser's saved copy may be stale) */
    function authId(fallback) {
        var sb = client();
        if (!sb) return Promise.resolve({ id: String(fallback), signedIn: false });
        return sb.auth.getUser().then(function (r) {
            var u = r && r.data && r.data.user;
            return u ? { id: String(u.id), signedIn: true } : { id: String(fallback), signedIn: false };
        }).catch(function () { return { id: String(fallback), signedIn: false }; });
    }

    var FIELDS = ['first_name_th', 'last_name_th', 'birth_date', 'gender', 'phone', 'personal_email'];
    var REQUIRED = ['first_name_th', 'last_name_th', 'birth_date', 'gender', 'phone'];
    var GENDER = { male: 'ชาย', female: 'หญิง', unspecified: 'ไม่ระบุ' };
    var ROLE_TH = { super_admin: 'หัวหน้า', company_admin: 'รองหัวหน้า', admin: 'รองหัวหน้า', manager: 'หัวหน้างาน', employee: 'พนักงาน', member: 'พนักงาน', worker: 'พนักงาน', guest: 'ผู้เยี่ยมชม' };
    var RANK = { super_admin: 0, company_admin: 1, admin: 1, manager: 2, employee: 3, member: 3, worker: 3, guest: 4 };

    function pick(row) {
        var o = {}; if (!row) return null;
        FIELDS.forEach(function (k) { o[k] = row[k] == null ? '' : row[k]; });
        return o;
    }
    function isComplete(info) {
        return !!info && REQUIRED.every(function (k) { return String(info[k] || '').trim() !== ''; });
    }

    /* one person's info (null when nothing saved yet) */
    function load(uid) {
      return authId(uid).then(function (who) {
        uid = who.id;
        var local = function () { return pick(readLocal()[uid]); };
        var sb = client();
        if (!sb || noTable || !who.signedIn) return local();
        return sb.from('member_details').select('*').eq('user_id', uid).maybeSingle().then(function (r) {
            if (r.error) { if (NOTABLE.test((r.error.code || '') + ' ' + r.error.message)) { noTable = true; return local(); } throw r.error; }
            return r.data ? pick(r.data) : local();
        }).catch(function (e) { console.warn('[PersonalInfo] load', e); return local(); });
      });
    }

    /* several people at once → { uid: info } (only rows the database lets you see) */
    function loadMany(uids) {
        uids = (uids || []).map(String);
        var local = function () { var all = readLocal(), o = {}; uids.forEach(function (id) { if (all[id]) o[id] = pick(all[id]); }); return o; };
        var sb = client();
        if (!uids.length) return Promise.resolve({});
        if (!sb || noTable) return Promise.resolve(local());
        return sb.from('member_details').select('*').in('user_id', uids).then(function (r) {
            if (r.error) { if (NOTABLE.test((r.error.code || '') + ' ' + r.error.message)) { noTable = true; return local(); } throw r.error; }
            var o = {}; (r.data || []).forEach(function (x) { o[String(x.user_id)] = pick(x); }); return o;
        });
    }

    function save(uid, info) {
      return authId(uid).then(function (who) {
        uid = who.id;
        var row = pick(info);
        var keepLocal = function () { var all = readLocal(); all[uid] = Object.assign({}, row, { updated_at: new Date().toISOString() }); writeLocal(all); };
        var sb = client();
        if (!sb || noTable) { keepLocal(); return { where: 'local' }; }
        if (!who.signedIn) throw new Error('หมดเวลาการเข้าสู่ระบบ · กรุณาออกจากระบบแล้วเข้าใหม่');
        var data = Object.assign({ user_id: uid, updated_at: new Date().toISOString() }, row);
        ['birth_date', 'personal_email', 'gender'].forEach(function (k) { if (data[k] === '') data[k] = null; });
        var put = function () { return sb.from('member_details').upsert(data, { onConflict: 'user_id' }); };
        return put().then(function (r) {
            /* no profile row yet for this account (signed up before the setup SQL ran): create it, then try again */
            if (r.error && (r.error.code === '23503' || /foreign key/i.test(r.error.message)))
                return sb.rpc('ensure_my_profile').then(put);
            return r;
        }).then(function (r) {
            if (r.error) {
                if (NOTABLE.test((r.error.code || '') + ' ' + r.error.message)) { noTable = true; keepLocal(); return { where: 'local' }; }
                throw r.error;
            }
            keepLocal();   /* also remember here so the next page shows it instantly */
            return { where: 'db' };
        });
      });
    }

    function age(birth) {
        if (!birth) return '';
        var b = new Date(birth + 'T00:00:00'), n = new Date();
        if (isNaN(b)) return '';
        var a = n.getFullYear() - b.getFullYear();
        if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
        return a;
    }
    /* 1990-05-05 → 5 พ.ค. 2533 */
    function thaiDate(d) {
        if (!d) return '';
        var x = new Date(d + 'T00:00:00'); if (isNaN(x)) return d;
        var m = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        return x.getDate() + ' ' + m[x.getMonth()] + ' ' + (x.getFullYear() + 543);
    }
    function phone(p) {
        var d = String(p || '').replace(/\D/g, '');
        if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
        if (d.length === 9) return d.slice(0, 2) + '-' + d.slice(2, 5) + '-' + d.slice(5);
        return p || '';
    }

    /* resize a picked photo to a small square JPEG (data URL) so it can be stored with the profile */
    function shrinkPhoto(file, size) {
        size = size || 256;
        return new Promise(function (ok, bad) {
            var rd = new FileReader();
            rd.onerror = bad;
            rd.onload = function () {
                var img = new Image();
                img.onerror = function () { bad(new Error('ไฟล์รูปไม่ถูกต้อง')); };
                img.onload = function () {
                    var s = Math.min(img.width, img.height), c = document.createElement('canvas');
                    c.width = c.height = size;
                    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
                    ok(c.toDataURL('image/jpeg', 0.85));
                };
                img.src = rd.result;
            };
            rd.readAsDataURL(file);
        });
    }

    window.PersonalInfo = {
        load: load, loadMany: loadMany, save: save, isComplete: isComplete, shrinkPhoto: shrinkPhoto,
        age: age, thaiDate: thaiDate, phone: phone, GENDER: GENDER, ROLE_TH: ROLE_TH, RANK: RANK, REQUIRED: REQUIRED,
        LATER_KEY: 'conwork_personal_info_later'
    };
})();
