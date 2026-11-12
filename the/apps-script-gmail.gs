/**
 * THẺ TÍN DỤNG – ĐỌC THƯ NGÂN HÀNG TỪ GMAIL
 * Chạy trong chính tài khoản Gmail nhận thư ngân hàng (trungduc2205@gmail.com).
 * - Chỉ ĐỌC thư từ Vietcombank / VPBank / Sacombank, không gửi, xóa hay gắn nhãn.
 * - Tạo lịch nhắc hạn thanh toán trong Google Calendar.
 * - Trả về dữ liệu JSON cho app (có mã bí mật).
 */

// >>> ĐỔI dòng này thành một chuỗi dài ngẫu nhiên của riêng bạn (ít nhất 25 ký tự) <<<
var TOKEN = 'DOI-CHUOI-NAY-THANH-MA-BI-MAT-CUA-BAN';

var SENDERS = 'from:(info.vietcombank.com.vn OR vcbcard@info.vietcombank.com.vn OR care.vpb.com.vn OR sacombank.com OR sacombank.com.vn)';
var NGAY_QUET = 75; // quét thư trong 75 ngày gần nhất

// ---------- Web endpoint cho app ----------
function doGet(e) {
  var t = (e && e.parameter && e.parameter.t) || '';
  if (t !== TOKEN || TOKEN.indexOf('DOI-CHUOI') === 0) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var data = quet_();
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Chạy hằng ngày (đặt trigger) ----------
function hangNgay() {
  var d = quet_();
  d.stmts.forEach(taoLich_);
}

function quet_() {
  var threads = GmailApp.search(SENDERS + ' newer_than:' + NGAY_QUET + 'd', 0, 150);
  var tx = [], stmts = [], alerts = [];
  threads.forEach(function (th) {
    th.getMessages().forEach(function (m) {
      var subj = m.getSubject() || '';
      var from = m.getFrom() || '';
      var body = (m.getPlainBody() || '').replace(/ /g, ' ');
      var when = m.getDate().getTime();
      var id = m.getId();
      try {
        if (/vietcombank/i.test(from)) {
          if (/nhắc nợ/i.test(subj)) {
            var a = nhacNoVCB_(body, when, id);
            if (a) alerts.push(a);
          } else if (/giao dịch thẻ|card transaction/i.test(subj)) {
            var x = giaoDichVCB_(body, id);
            if (x) tx.push(x);
          }
        } else if (/vpb/i.test(from)) {
          if (/biến động số dư|bien dong so du/i.test(subj)) {
            var y = giaoDichVPB_(body, id, when);
            if (y) tx.push(y);
          } else if (/sao kê thẻ|sao ke the/i.test(subj)) {
            var s = saoKeVPB_(body, id, when);
            if (s) stmts.push(s);
          }
        }
        // Sacombank: chưa thấy thư giao dịch/sao kê thẻ mẫu → chưa phân tích (xem README)
      } catch (err) { /* bỏ qua thư lạ */ }
    });
  });
  tx.sort(function (a, b) { return a.ts - b.ts; });
  return { updated: new Date().toISOString(), tx: tx, stmts: stmts, alerts: alerts };
}

// ---------- Công cụ ----------
function num_(s) { return parseFloat(String(s).replace(/[^\d.]/g, '')) || 0; }
function viNum_(s) { var t = String(s); if (/,/.test(t)) t = t.replace(/\.\d{1,2}\s*$/, ''); return Number(t.replace(/[^\d]/g, '')) || 0; }
function dmy_(s) { // dd-mm-yyyy hh:mm:ss hoặc dd/mm/yyyy ...
  var m = s.match(/(\d{2})[-\/](\d{2})[-\/](\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
}
function iso_(d) { return Utilities.formatDate(d, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'); }

// ---------- Vietcombank ----------
function giaoDichVCB_(b, id) {
  var card = (b.match(/Card\s+\w+\s+[\d.*]*?\.{2,}\s*(\d{4})/i) || b.match(/(\d{4})\s*\n?\s*At\b/i) || [])[1] || '';
  var merchant = ((b.match(/\bAt\s+([^\n\r]+)/i) || [])[1] || '').trim();
  var am = b.match(/Transaction Amount\s+([\d.,]+)\s*([A-Z]{3})/i);
  var dt = dmy_((b.match(/Trans\.?\s*Date,?\s*Time\s+([^\n\r]+)/i) || [])[1] || '');
  var avail = (b.match(/Credit Balance\s+([\d.,]+)\s*VND/i) || [])[1];
  var ok = /Thành công|Success/i.test(b);
  if (!am || !dt || !ok) return null;
  return {
    id: 'vcb-' + id, bank: 'Vietcombank', last4: card, merchant: merchant,
    amount: am[2] === 'VND' ? viNum_(am[1]) : null,        // ngoại tệ: thư không có số VND
    foreign: am[2] === 'VND' ? null : { amount: num_(am[1].replace(/,/g, '')), cur: am[2] },
    date: iso_(dt), ts: dt.getTime(), type: 'spend',
    available: avail ? viNum_(avail) : null
  };
}
function nhacNoVCB_(b, when, id) {
  var last = (b.match(/số\s*\*?(\d{3,4})/i) || [])[1] || '';
  var amt = (b.match(/dư nợ[\s\S]{0,120}?là\s*([\d.,]+)\s*VND/i) || [])[1];
  if (!amt) return null;
  return { id: 'vcb-nn-' + id, bank: 'Vietcombank', last4: last, amount: viNum_(amt),
           date: iso_(new Date(when)), text: 'Nhắc nợ: đã quá hạn, tối thiểu ' + viNum_(amt) + ' đ (bỏ qua nếu đã thanh toán)' };
}

// ---------- VPBank ----------
function giaoDichVPB_(b, id, when) {
  var am = b.match(/([+-])\s*([\d.,]+)\s*VND/);
  var last4 = (b.match(/\*(\d{4})/) || [])[1] || '';
  var t = (b.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/) || [])[1];
  var dt = t ? dmy_(t) : new Date(when);
  var avail = b.match(/([\d.,]+)\s*VND\s*[\r\n ]*(?:Hạn mức còn lại|Available Limit)/i);
  var content = (b.match(/([A-Z0-9 ._\-]{6,60})\s*[\r\n ]*(?:Nội dung|Transaction Content)/i) || [])[1] || '';
  if (!am) return null;
  var v = viNum_(am[2]);
  return {
    id: 'vpb-' + id, bank: 'VPBank', last4: last4, merchant: content.trim(),
    amount: v, date: iso_(dt), ts: dt.getTime(),
    type: am[1] === '-' ? 'spend' : 'pay',   // dấu "-" = trừ hạn mức (chi tiêu), "+" = nạp/trả
    available: avail ? viNum_(avail[1]) : null
  };
}
function saoKeVPB_(b, id, when) {
  var per = b.match(/Từ\s*(\d{2}\/\d{2}\/\d{4})\s*đến\s*(\d{2}\/\d{2}\/\d{4})/i);
  var due = b.match(/(\d{1,2})H\s*(\d{2}\/\d{2}\/\d{4})/i);
  var min = b.match(/VND\s*(-?[\d.,]+)[\s\S]{0,40}?(?:Số tiền thanh toán tối thiểu|Minimum)/i)
         || b.match(/(?:tối thiểu|Minimum Amount Due)[\s\S]{0,40}?VND\s*(-?[\d.,]+)/i);
  var bal = b.match(/VND\s*(-?[\d.,]+)\s*[\r\n ]*Số dư cuối kỳ\s*\/\s*Outstanding Balance:/i)
         || b.match(/Outstanding Balance:?[\s\S]{0,30}?VND\s*(-?[\d.,]+)/i);
  if (!due) return null;
  return {
    id: 'vpb-sk-' + id, bank: 'VPBank',
    from: per ? iso_(dmy_(per[1])) : null, to: per ? iso_(dmy_(per[2])) : null,
    due: iso_(dmy_(due[2])), dueHour: +due[1],
    min: min ? Math.abs(viNum_(min[1])) : null,       // VPBank in số âm = số tiền phải trả
    balance: bal ? Math.abs(viNum_(bal[1])) : null,
    sent: iso_(new Date(when))
  };
}

// ---------- Google Calendar ----------
function taoLich_(s) {
  if (!s.due) return;
  var cal = CalendarApp.getDefaultCalendar();
  var title = '💳 Trả thẻ ' + s.bank + (s.min ? ' – tối thiểu ' + s.min.toLocaleString('en-US') + 'đ' : '');
  var day = new Date(s.due + 'T00:00:00+07:00');
  var exist = cal.getEventsForDay(day).some(function (e) { return e.getTitle().indexOf('💳 Trả thẻ ' + s.bank) === 0; });
  if (exist) return;
  var ev = cal.createAllDayEvent(title, day, {
    description: 'Hạn thanh toán trước ' + (s.dueHour || 17) + 'h. Số dư cuối kỳ: ' +
      (s.balance ? s.balance.toLocaleString('en-US') + 'đ' : 'xem sao kê') + '. Tạo bởi app Thẻ tín dụng.'
  });
  ev.removeAllReminders();
  // Sự kiện cả ngày bắt đầu 00:00 → "phút trước 00:00" của ngày hạn
  ev.addPopupReminder(15 * 60);            // 9h sáng ngày trước hạn
  ev.addPopupReminder(2 * 24 * 60 - 9 * 60); // 9h sáng 2 ngày trước hạn
  ev.addPopupReminder(5 * 24 * 60 - 9 * 60); // 9h sáng 5 ngày trước hạn
}
