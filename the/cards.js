/* Tính toán cho app thẻ tín dụng. Ngày dùng chuỗi "YYYY-MM-DD", số tiền là đồng. */
(function (root) {
  'use strict';
  var DAY = 86400000;

  function pad(n) { return String(n).padStart(2, '0'); }
  function toMs(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fromMs(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { return fromMs(toMs(s) + n * DAY); }
  function diffDays(a, b) { return Math.round((toMs(a) - toMs(b)) / DAY); } // a - b
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m: 1..12
  function ym(s) { var p = s.split('-'); return { y: +p[0], m: +p[1] }; }
  function addMonths(y, m, n) { var t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12 + 12) % 12 + 1 }; }
  function mk(y, m, day) { return y + '-' + pad(m) + '-' + pad(Math.min(day, dim(y, m))); }

  // Ngày sao kê gần nhất không sau "today"
  function lastStatement(day, today) {
    var t = ym(today), c = mk(t.y, t.m, day);
    if (c <= today) return c;
    var p = addMonths(t.y, t.m, -1); return mk(p.y, p.m, day);
  }
  function nextStatement(day, today) {
    var t = ym(today), c = mk(t.y, t.m, day);
    if (c > today) return c;
    var n = addMonths(t.y, t.m, 1); return mk(n.y, n.m, day);
  }
  // Ngày đến hạn đầu tiên sau ngày sao kê
  function dueAfter(stmtDate, dueDay) {
    var s = ym(stmtDate), c = mk(s.y, s.m, dueDay);
    if (c > stmtDate) return c;
    var n = addMonths(s.y, s.m, 1); return mk(n.y, n.m, dueDay);
  }

  function sum(arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f(arr[i]); return t; }
  function round(n) { return Math.round(n); }

  /* Tình trạng một thẻ tại ngày today.
     card: {stmtDay,dueDay,limit,apr,minPct,minFloor,lateFeePct,lateFeeMin,stmt:{date,balance,min,due}|null}
     txs: giao dịch của thẻ [{date,amount,type:'spend'|'pay'}] */
  function cardInfo(card, txs, today) {
    var spend = txs.filter(function (t) { return t.type !== 'pay'; });
    var pays = txs.filter(function (t) { return t.type === 'pay'; });
    var s0 = lastStatement(card.stmtDay, today);
    var real = card.stmt && card.stmt.date && card.stmt.date >= s0 ? card.stmt : null;
    var stmtDate = real ? real.date : s0, balance, min, due, source;
    if (real) {
      balance = +real.balance || 0; due = real.due || dueAfter(stmtDate, card.dueDay);
      min = real.min != null && real.min !== '' ? +real.min : null; source = 'sao kê';
    } else {
      balance = Math.max(0, sum(spend.filter(function (t) { return t.date <= stmtDate; }), function (t) { return t.amount; }) -
        sum(pays.filter(function (t) { return t.date <= stmtDate; }), function (t) { return t.amount; }));
      due = dueAfter(stmtDate, card.dueDay); min = null; source = 'tính từ giao dịch';
    }
    if (min == null) min = Math.min(balance, Math.max(card.minFloor || 0, round(balance * (card.minPct || 0) / 100)));
    if (balance <= 0) min = 0;
    var paidAfter = sum(pays.filter(function (t) { return t.date > stmtDate && t.date <= today; }), function (t) { return t.amount; });
    var remaining = Math.max(0, balance - paidAfter);
    var minRemaining = Math.max(0, min - paidAfter);
    var newSpend = sum(spend.filter(function (t) { return t.date > stmtDate && t.date <= today; }), function (t) { return t.amount; });
    var daysLeft = diffDays(due, today);
    var status = remaining <= 0 ? 'paid' : (daysLeft >= 0 ? 'due' : 'overdue');
    var lateFee = 0, interest = 0, overdueDays = 0;
    if (status === 'overdue') {
      overdueDays = -daysLeft;
      if (minRemaining > 0) lateFee = Math.max(card.lateFeeMin || 0, round(minRemaining * (card.lateFeePct || 0) / 100));
      interest = estInterest(remaining, card.apr, diffDays(today, addDays(stmtDate, -15)));
    }
    // Lãi nếu chỉ trả mức tối thiểu rồi trả phần còn lại đến hạn kỳ sau (ước tính)
    var afterMin = Math.max(0, remaining - minRemaining);
    var interestIfMin = status === 'paid' ? 0 : estInterest(afterMin, card.apr, diffDays(dueAfter(due, card.dueDay), addDays(stmtDate, -15)));
    var outstanding = Math.max(0, sum(spend.filter(function (t) { return t.date <= today; }), function (t) { return t.amount; }) -
      sum(pays.filter(function (t) { return t.date <= today; }), function (t) { return t.amount; }));
    return {
      stmtDate: stmtDate, nextStmt: nextStatement(card.stmtDay, today), due: due, balance: balance, min: min, source: source,
      paidAfter: paidAfter, remaining: remaining, minRemaining: minRemaining, newSpend: newSpend,
      daysLeft: daysLeft, status: status, lateFee: lateFee, interest: interest, overdueDays: overdueDays,
      interestIfMin: interestIfMin, outstanding: outstanding,
      available: card.limit ? Math.max(0, card.limit - outstanding) : null,
      usage: card.limit ? outstanding / card.limit * 100 : null
    };
  }
  function estInterest(amount, apr, days) { return days > 0 && amount > 0 && apr ? round(amount * apr / 100 / 365 * days) : 0; }

  // Dán tin nhắn ngân hàng: tách số tiền, ngày, nơi chi, 4 số cuối
  function parseSms(text) {
    var out = { amount: null, date: null, note: '', last4: '', type: 'spend' };
    if (!text) return out;
    var t = String(text);
    var m = t.match(/(?:\+|-)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]+)\s*(?:VND|VNĐ|vnd|đ\b|d\b)/);
    if (m) out.amount = Number(m[1].replace(/[.,]/g, ''));
    var d = t.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/);
    if (d) {
      var now = new Date(), y = d[3] ? +d[3] : now.getFullYear(); if (y < 100) y += 2000;
      var mo = +d[2], dd = +d[1];
      if (mo >= 1 && mo <= 12 && dd >= 1 && dd <= 31) out.date = mk(y, mo, dd);
    }
    var l = t.match(/(?:\*{2,}|x{2,}|the\s*(?:tin\s*dung\s*)?(?:so\s*)?)\s*(\d{4})\b/i);
    if (l) out.last4 = l[1];
    var n = t.match(/\b(?:tai|at|merchant|noi dung|nd)\b\s*[:\-]?\s*([^.\n]{2,40}?)(?=\s+(?:luc|vao|ngay|so du|sd)\b|[.\n]|$)/i);
    if (n) out.note = n[1].trim();
    if (/thanh toan the|nop tien|payment|hoan tien|refund|tra no/i.test(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd'))) out.type = 'pay';
    return out;
  }

  // Tệp lịch .ics: nhắc 5 ngày, 2 ngày trước và đúng ngày (9 giờ sáng)
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function buildIcs(events) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//So Vang//The tin dung//VI', 'CALSCALE:GREGORIAN'];
    events.forEach(function (e, i) {
      var d = e.date.replace(/-/g, '');
      L.push('BEGIN:VEVENT', 'UID:thetd-' + e.key + '-' + d + '@sovang', 'DTSTAMP:20260101T000000Z',
        'DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + addDays(e.date, 1).replace(/-/g, ''),
        'SUMMARY:' + icsEscape(e.title), 'DESCRIPTION:' + icsEscape(e.desc || ''));
      [['PT9H', 'Hôm nay đến hạn'], ['-P1DT15H', 'Còn 2 ngày'], ['-P4DT15H', 'Còn 5 ngày']].forEach(function (a) {
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(a[1] + ': ' + e.title), 'TRIGGER:' + a[0], 'END:VALARM');
      });
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n');
  }

  var api = { toMs: toMs, fromMs: fromMs, addDays: addDays, diffDays: diffDays, lastStatement: lastStatement, nextStatement: nextStatement,
    dueAfter: dueAfter, cardInfo: cardInfo, parseSms: parseSms, buildIcs: buildIcs, addMonths: addMonths, mk: mk, ym: ym };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Cards = api;
})(typeof window !== 'undefined' ? window : globalThis);
