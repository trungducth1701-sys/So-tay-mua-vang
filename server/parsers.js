// Bộ đọc thư ngân hàng. Mỗi ngân hàng là một "plugin" trong BANKS.
// Thêm ngân hàng mới: thêm một mục vào BANKS và một ca thử trong test/parsers.test.js.
// Đầu ra: {kind:'tx'|'stmt'|'alert', bank, ...} hoặc null nếu không nhận ra.

export function htmlToText(h) {
  return String(h || '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t ]+/g, ' ').replace(/ *\n+ */g, '\n');
}
const money = (s) => { let t = String(s); if (/,/.test(t)) t = t.replace(/\.\d{1,2}\s*$/, ''); return Number(t.replace(/[^\d]/g, '')) || 0; };
const pad = (n) => String(n).padStart(2, '0');
function dmy(s) {
  const m = String(s || '').match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  return m ? { date: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, hm: m[4] ? `${pad(m[4])}:${m[5]}` : '' } : null;
}

export const BANKS = [
  {
    id: 'vietcombank', name: 'Vietcombank', senders: /vietcombank\.com\.vn/i,
    parse({ subject, text, date }) {
      if (/nhắc nợ/i.test(subject)) {
        const last4 = (text.match(/số\s*\*?(\d{3,4})/i) || [])[1] || '';
        const a = (text.match(/dư nợ[\s\S]{0,120}?là\s*([\d.,]+)\s*VND/i) || [])[1];
        return a ? { kind: 'alert', last4, amount: money(a), date, text: `Nhắc nợ: đã quá hạn, tối thiểu ${money(a).toLocaleString('vi-VN')} đ (bỏ qua nếu đã thanh toán)` } : null;
      }
      if (/giao dịch thẻ|card transaction/i.test(subject)) {
        if (!/Thành công|Success/i.test(text)) return null;
        const last4 = (text.match(/Card\s+\w+\s+[\d.*]*?\.{2,}\s*(\d{4})/i) || [])[1] || '';
        const merchant = ((text.match(/\bAt\s+([^\n\r]+)/i) || [])[1] || '').trim();
        const am = text.match(/Transaction Amount\s+([\d.,]+)\s*([A-Z]{3})/i);
        const dt = dmy((text.match(/Trans\.?\s*Date,?\s*Time\s+([^\n\r]+)/i) || [])[1]);
        const av = (text.match(/Credit Balance\s+([\d.,]+)\s*VND/i) || [])[1];
        if (!am || !dt) return null;
        const vnd = am[2].toUpperCase() === 'VND';
        return { kind: 'tx', last4, merchant, amount: vnd ? money(am[1]) : null,
          foreign: vnd ? null : { amount: Number(am[1].replace(/,/g, '')), cur: am[2] }, date: dt.date, type: 'spend', available: av ? money(av) : null };
      }
      return null; // sao kê Vietcombank chỉ có PDF khóa mật khẩu
    },
  },
  {
    id: 'vpbank', name: 'VPBank', senders: /vpb\.com\.vn|vpbank/i,
    parse({ subject, text, date }) {
      if (/biến động số dư|bien dong so du/i.test(subject)) {
        const am = text.match(/([+-])\s*([\d.,]+)\s*VND/);
        if (!am) return null;
        const last4 = (text.match(/\*(\d{4})/) || [])[1] || '';
        const dt = dmy((text.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/) || [])[1]) || { date };
        const av = text.match(/([\d.,]+)\s*VND\s*\n?\s*(?:Hạn mức còn lại|Available Limit)/i);
        const content = (text.match(/([A-Z0-9][A-Z0-9 ._\-]{5,60})\s*\n?\s*(?:Nội dung|Transaction Content)/) || [])[1] || '';
        return { kind: 'tx', last4, merchant: content.trim(), amount: money(am[2]), date: dt.date, type: am[1] === '-' ? 'spend' : 'pay', available: av ? money(av[1]) : null };
      }
      if (/sao kê thẻ|sao ke the/i.test(subject)) {
        const per = text.match(/Từ\s*(\d{2}\/\d{2}\/\d{4})\s*đến\s*(\d{2}\/\d{2}\/\d{4})/i);
        const due = text.match(/(\d{1,2})H\s*(\d{2}\/\d{2}\/\d{4})/i);
        if (!due) return null;
        const min = text.match(/(?:Minimum Amount Due|tối thiểu)[\s\S]{0,40}?VND\s*(-?[\d.,]+)/i);
        const bal = text.match(/VND\s*(-?[\d.,]+)\s*\n?\s*Số dư cuối kỳ\s*\/\s*Outstanding Balance:/i);
        return { kind: 'stmt', last4: '', from: per ? dmy(per[1]).date : null, to: per ? dmy(per[2]).date : null,
          due: dmy(due[2]).date, dueHour: +due[1], min: min ? money(min[1]) : null, balance: bal ? money(bal[1]) : null };
      }
      return null;
    },
  },
];

export function parseEmail({ from, subject, html, text, date }) {
  const body = text && text.trim() ? text : htmlToText(html);
  const bank = BANKS.find((b) => b.senders.test(from || ''));
  if (!bank) return null;
  const r = bank.parse({ subject: subject || '', text: body.replace(/ /g, ' '), date });
  return r ? { bank: bank.name, ...r } : null;
}
