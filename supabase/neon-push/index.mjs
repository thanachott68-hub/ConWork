/* ConWork push sender (Neon Function, slug "push")
   Every minute (Function Trigger) and whenever the app pokes it after adding a notification:
   takes the notifications not pushed yet, marks them, and sends each one to every device of its person.
   Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), DATABASE_URL (from Neon). */
import crypto from 'node:crypto';

/* Postgres over Neon's HTTPS SQL endpoint (no driver needed: one statement per call) */
const DB = process.env.DATABASE_URL || '';
const SQL_URL = DB ? 'https://' + new URL(DB).hostname + '/sql' : '';
const arr = (list) => '{' + list.join(',') + '}';
async function q(query, params = []) {
  const res = await fetch(SQL_URL, { method: 'POST', body: JSON.stringify({ query, params }), headers: {
    'content-type': 'application/json', 'Neon-Connection-String': DB, 'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'false' } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('sql ' + res.status + ' ' + (j.message || ''));
  return j.rows || [];
}

/* ---------- Web Push without extra libraries: VAPID (RFC 8292) + aes128gcm (RFC 8291) ---------- */
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url');
const VAPID_PUB = unb64u(process.env.VAPID_PUBLIC_KEY || '');
const VAPID_KEY = process.env.VAPID_PRIVATE_KEY ? crypto.createPrivateKey({ format: 'jwk', key: {
  kty: 'EC', crv: 'P-256', d: process.env.VAPID_PRIVATE_KEY, x: b64u(VAPID_PUB.subarray(1, 33)), y: b64u(VAPID_PUB.subarray(33, 65)) } }) : null;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:noreply@conwork.app';
const jwtCache = new Map();
function vapidJwt(aud) {
  const hit = jwtCache.get(aud);
  if (hit && hit.exp - 600 > Date.now() / 1000) return hit.jwt;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const data = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64u(JSON.stringify({ aud, exp, sub: SUBJECT }));
  const sig = crypto.sign('sha256', Buffer.from(data), { key: VAPID_KEY, dsaEncoding: 'ieee-p1363' });
  const jwt = data + '.' + b64u(sig);
  jwtCache.set(aud, { jwt, exp });
  return jwt;
}
const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));
function encrypt(sub, text) {
  const uaPub = unb64u(sub.p256dh), authSecret = unb64u(sub.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), shared = ecdh.computeSecret(uaPub);
  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const salt = crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(text), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head.writeUInt8(65, 20);
  return Buffer.concat([head, asPub, body]);
}
async function sendPush(sub, text) {
  const aud = new URL(sub.endpoint).origin;
  const res = await fetch(sub.endpoint, { method: 'POST', body: encrypt(sub, text), headers: {
    'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '3600', urgency: 'high',
    authorization: 'vapid t=' + vapidJwt(aud) + ', k=' + b64u(VAPID_PUB) } });
  if (!res.ok) { const e = new Error('push ' + res.status); e.statusCode = res.status; e.body = await res.text().catch(() => ''); throw e; }
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const TITLES = {
  chat: 'ข้อความใหม่', task_assigned: 'คุณได้รับมอบหมายงานใหม่', event_invite: 'คุณได้รับเชิญเข้าร่วมกิจกรรม',
  deadline: 'งานใกล้ถึงกำหนดส่ง', event_reminder: 'กิจกรรมใกล้ถึงเวลา', budget: 'งบประมาณ', finance: 'รายการการเงิน'
};
let running = null;

async function sweep() {
  /* claim at most 200 waiting notifications; older than 15 minutes are only marked (too late to be useful) */
  await q(`update notifications set pushed_at = now() where pushed_at is null and created_at < now() - interval '15 minutes'`);
  const claimed = (await q(
    `update notifications n set pushed_at = now()
       where n.id in (select id from notifications where pushed_at is null order by created_at limit 200 for update skip locked)
     returning n.id, n.user_id, n.type, n.title, n.body, n.link`)).map((n) => ({ ...n, link: typeof n.link === 'string' ? JSON.parse(n.link || '{}') : n.link }));
  if (!claimed.length) return { sent: 0, notifications: 0 };

  const users = [...new Set(claimed.map((n) => n.user_id))];
  const subs = await q(`select id, user_id, endpoint, p256dh, auth from push_subscriptions where user_id = any($1::uuid[])`, [arr(users)]);
  const unread = Object.fromEntries((await q(
    `select user_id, count(*)::int n from notifications where user_id = any($1::uuid[]) and read_at is null group by user_id`, [arr(users)])).map((r) => [r.user_id, +r.n]));

  let sent = 0; const gone = [], ok = [];
  await Promise.all(claimed.flatMap((n) => subs.filter((s) => s.user_id === n.user_id).map(async (s) => {
    const link = n.link || {};
    const payload = JSON.stringify({
      title: n.title || TITLES[n.type] || 'ConWork',
      body: (n.body || '').slice(0, 300),
      tag: 'cw-' + n.id,
      notif: n.id,
      url: link.view === 'mailbox' ? 'team.html#mailbox' : 'app.html',
      badge: unread[n.user_id] || 0
    });
    try {
      await sendPush(s, payload);
      sent++; ok.push(s.id);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) gone.push(s.id);      /* the browser dropped it */
      else console.warn('push failed', e.statusCode, e.body || e.message);
    }
  })));
  if (gone.length) await q(`delete from push_subscriptions where id = any($1::uuid[])`, [arr([...new Set(gone)])]);
  if (ok.length) await q(`update push_subscriptions set last_ok_at = now() where id = any($1::uuid[])`, [arr([...new Set(ok)])]);
  return { sent, notifications: claimed.length, removed: gone.length };
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return new Response('ConWork push', { headers: CORS });
    /* one sweep at a time per instance; a poke during a sweep shares it */
    running = running || sweep().finally(() => { running = null; });
    try {
      const r = await running;
      return new Response(JSON.stringify(r), { headers: { ...CORS, 'content-type': 'application/json' } });
    } catch (e) {
      console.error('push sweep', e);
      return new Response('error', { status: 500, headers: CORS });
    }
  }
};
