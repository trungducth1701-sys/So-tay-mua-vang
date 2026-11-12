/* Các hàm tính toán thuần của Sổ vàng. Đơn vị nội bộ: số lượng tính bằng chỉ, giá tính bằng đồng/chỉ. */
(function (root) {
  'use strict';

  // 1 lượng = 10 chỉ, 1 chỉ = 10 phân
  var UNIT_CHI = { luong: 10, chi: 1, phan: 0.1 };

  function round6(x) { return Math.round(x * 1e6) / 1e6; }
  function toChi(q, unit) { return round6(q * (UNIT_CHI[unit] || 1)); }

  function totals(lots) {
    var q = 0, c = 0;
    for (var i = 0; i < lots.length; i++) {
      q += lots[i].qtyChi;
      c += lots[i].qtyChi * lots[i].priceChi;
    }
    return { qty: round6(q), cost: c, avg: q > 0 ? c / q : 0 };
  }

  // Thứ tự mua. Có đủ ngày thì xếp theo ngày, thiếu ngày thì giữ thứ tự đã ghi.
  function chrono(lots) {
    var s = lots.slice();
    var all = s.every(function (l) { return l.date; });
    if (all) {
      s.sort(function (a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.id < b.id ? -1 : 1);
      });
    }
    return s;
  }

  function fifoBasis(lots, qtyChi) {
    var s = chrono(lots), left = qtyChi, cost = 0;
    for (var i = 0; i < s.length && left > 1e-9; i++) {
      var take = Math.min(left, s[i].qtyChi);
      cost += take * s[i].priceChi;
      left -= take;
    }
    return cost;
  }

  function sellBasis(lots, qtyChi, method) {
    return method === 'fifo' ? fifoBasis(lots, qtyChi) : qtyChi * totals(lots).avg;
  }

  function sellResult(lots, qtyChi, priceChi, method) {
    var t = totals(lots);
    var basis = sellBasis(lots, qtyChi, method);
    var proceeds = qtyChi * priceChi;
    var pl = proceeds - basis;
    var rq = round6(t.qty - qtyChi);
    return {
      proceeds: proceeds, basis: basis, pl: pl,
      pct: basis > 0 ? pl / basis * 100 : 0,
      remQty: rq, remCost: t.cost - basis,
      remAvg: rq > 1e-9 ? (t.cost - basis) / rq : 0
    };
  }

  function buyResult(lots, qtyChi, priceChi, sellNowChi) {
    var t = totals(lots);
    var spend = qtyChi * priceChi;
    var nq = t.qty + qtyChi, nc = t.cost + spend;
    var value = nq * sellNowChi;
    return {
      spend: spend, newQty: round6(nq), newCost: nc,
      newAvg: nq > 0 ? nc / nq : 0, oldAvg: t.avg,
      pl: value - nc, pct: nc > 0 ? (value - nc) / nc * 100 : 0,
      spreadLoss: qtyChi * Math.max(0, priceChi - sellNowChi)
    };
  }

  // Nhận "148,5", "148.5", "1.234,5". Dấu phẩy hoặc chấm đều là phần thập phân nếu chỉ có một loại.
  function parseNum(s) {
    if (s == null) return NaN;
    var t = String(s).trim().replace(/\s/g, '');
    if (!t) return NaN;
    var dot = t.indexOf('.') >= 0, comma = t.indexOf(',') >= 0;
    if (dot && comma) t = t.replace(/\./g, '').replace(',', '.');
    else if (comma) t = t.replace(',', '.');
    var n = Number(t);
    return isFinite(n) ? n : NaN;
  }

  // Số tiền tính bằng triệu đồng. Nhận cả cách viết tay "7tr560" (7,56 triệu), "8tr6" (8,6 triệu).
  function parseTrieu(s) {
    if (s == null) return NaN;
    var t = String(s).trim().toLowerCase().replace(/\s/g, '');
    var m = t.match(/^(\d+)(?:tr|triệu|trieu)(\d*)$/);
    if (m) return Number(m[1] + (m[2] ? '.' + m[2] : ''));
    return parseNum(t);
  }

  var api = {
    UNIT_CHI: UNIT_CHI, toChi: toChi, totals: totals, chrono: chrono, fifoBasis: fifoBasis,
    sellBasis: sellBasis, sellResult: sellResult, buyResult: buyResult,
    parseNum: parseNum, parseTrieu: parseTrieu
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : globalThis);
