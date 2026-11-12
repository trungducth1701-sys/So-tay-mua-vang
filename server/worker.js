// Cloudflare Worker: nhận thư chuyển tiếp từ Gmail của người dùng, đọc bằng parsers.js,
// chỉ lưu kết quả đã đọc (KHÔNG lưu nội dung thư), và trả JSON cho app.
import PostalMime from 'postal-mime';
import { parseEmail } from './parsers.js';

const MAX_EVENTS = 600;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...CORS } });
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const rand = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const isoDay = (d) => (d ? new Date(d) : new Date()).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });

export default {
  async email(message, env) {
    const alias = String(message.to || '').split('@')[0].toLowerCase();
    const u = await env.USERS.get('u:' + alias, 'json');
    if (!u) { message.setReject('Unknown recipient'); return; }
    const mail = await PostalMime.parse(await new Response(message.raw).arrayBuffer());
    const from = (mail.from && mail.from.address) || message.from || '';
    const subject = mail.subject || '';
    const date = isoDay(mail.date);
    if (/forwarding-noreply@google\.com$/i.test(from) || /gmail forwarding confirmation|xác nhận chuyển tiếp/i.test(subject)) {
      const body = (mail.text || '') + ' ' + (mail.html || '');
      u.confirm = { code: (body.match(/\b(\d{6,9})\b/) || [])[1] || null, at: new Date().toISOString() };
    } else {
      const p = parseEmail({ from, subject, html: mail.html, text: mail.text, date });
      if (p) {
        const id = (mail.messageId || subject + date + JSON.stringify(p)).slice(0, 200);
        if (!u.events.some((e) => e.id === id)) u.events.push({ id, ...p });
        u.events = u.events.slice(-MAX_EVENTS);
      }
    }
    await env.USERS.put('u:' + alias, JSON.stringify(u), { expirationTtl: 60 * 60 * 24 * 400 });
  },

  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);

    if (url.pathname === '/register' && req.method === 'POST') {
      const ip = req.headers.get('cf-connecting-ip') || 'x';
      const k = 'rl:' + ip + ':' + isoDay();
      const n = Number(await env.USERS.get(k)) || 0;
      if (n >= 5) return json({ error: 'Đăng ký quá nhiều lần, thử lại ngày mai.' }, 429);
      await env.USERS.put(k, String(n + 1), { expirationTtl: 90000 });
      const alias = 'u' + rand(6), token = rand(24);
      await env.USERS.put('u:' + alias, JSON.stringify({ th: await sha(token), events: [], created: new Date().toISOString() }), { expirationTtl: 60 * 60 * 24 * 400 });
      return json({ alias, token, email: alias + '@' + env.MAIL_DOMAIN, api: url.origin + '/api/' + alias });
    }

    const m = url.pathname.match(/^\/api\/(u[0-9a-f]{12})$/);
    if (m) {
      const u = await env.USERS.get('u:' + m[1], 'json');
      const t = url.searchParams.get('t') || '';
      if (!u || (await sha(t)) !== u.th) return json({ error: 'unauthorized' }, 401);
      if (req.method === 'DELETE') { await env.USERS.delete('u:' + m[1]); return json({ ok: true }); }
      const by = (k) => u.events.filter((e) => e.kind === k).map(({ kind, ...r }) => r);
      return json({ updated: new Date().toISOString(), tx: by('tx'), stmts: by('stmt'), alerts: by('alert'), confirm: u.confirm || null });
    }
    return json({ error: 'not_found' }, 404);
  },
};
