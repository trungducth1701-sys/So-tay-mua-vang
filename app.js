/* Sổ vàng: dữ liệu lưu trên chính điện thoại (localStorage). Giá SJC đọc từ prices.json do tác vụ GitHub cập nhật. */
(function () {
  'use strict';
  var C = window.Calc;
  var META_KEY = 'so-vang-books';
  function loadMeta() {
    try {
      var m = JSON.parse(localStorage.getItem(META_KEY));
      if (m && Array.isArray(m.list) && m.list.length) {
        if (!m.list.some(function (b) { return b.id === m.active; })) m.active = m.list[0].id;
        return m;
      }
    } catch (e) {}
    return { active: 'b1', list: [{ id: 'b1', name: 'Sổ của tôi' }] };
  }
  var meta = loadMeta();
  function keyOf(id) { return id === 'b1' ? 'so-vang-app-v1' : 'so-vang-app-v1-' + id; }
  var KEY = keyOf(meta.active);
  function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {} }
  function bookName() { return (meta.list.filter(function (b) { return b.id === meta.active; })[0] || {}).name || ''; }
  var GRPS = ['main', 'kmh'];
  var GNAME = { main: 'Vàng 99,99', kmh: 'Vàng 99,999 (KMH)' };
  var SJC_LABEL = { nhan: 'Nhẫn SJC 99,99% (1, 2, 5 chỉ)', mieng: 'Vàng miếng SJC (1 lượng)' };

  /* ---------- tiện ích ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf = function (n, max) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: max == null ? 0 : max, minimumFractionDigits: 0 }).format(n);
  };
  var fmtVnd = function (n) { return nf(Math.round(n)) + ' ₫'; };
  var sgn = function (n) { return n > 0.5 ? '+' : (n < -0.5 ? '−' : ''); };
  var fmtSigned = function (n) { return sgn(n) + nf(Math.abs(Math.round(n))) + ' ₫'; };
  var fmtPct = function (p) { return (p > 0.005 ? '+' : p < -0.005 ? '−' : '') + nf(Math.abs(p), 2) + '%'; };
  var cls = function (n) { return n > 0.5 ? 'good' : (n < -0.5 ? 'bad' : ''); };
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function uid() { return 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function inputNum(n) { return n.toLocaleString('vi-VN', { maximumFractionDigits: 3, useGrouping: false }); }
  function emptyBox(t) { return '<div class="empty"><span>' + esc(t) + '</span></div>'; }

  /* ---------- trạng thái ---------- */
  function defaults() {
    return {
      v: 1, lots: [], unit: 'chi', method: 'avg', step: 2,
      main: { mode: 'auto', sjcKey: 'nhan', buyInChi: null, sellOutChi: null, date: '' },
      kmh: { buyInChi: null, sellOutChi: null, date: '' },
      feed: null, feedChecked: 0
    };
  }
  function numOrNull(x) { x = +x; return isFinite(x) && x > 0 ? x : null; }
  function cleanLots(arr) {
    return (Array.isArray(arr) ? arr : []).filter(function (l) {
      return l && isFinite(+l.qtyChi) && isFinite(+l.priceChi) && +l.qtyChi > 0 && +l.priceChi > 0;
    }).map(function (l) {
      return { id: String(l.id || uid()), date: String(l.date || ''), qtyChi: +l.qtyChi, priceChi: +l.priceChi, grp: l.grp === 'kmh' ? 'kmh' : 'main', note: String(l.note || '') };
    });
  }
  function normalize(d) {
    var s = defaults();
    if (!d || typeof d !== 'object') return s;
    s.lots = cleanLots(d.lots);
    if (d.unit === 'luong' || d.unit === 'chi') s.unit = d.unit;
    if (d.method === 'fifo') s.method = 'fifo';
    if ([1, 2, 5].indexOf(+d.step) >= 0) s.step = +d.step;
    var m = d.main || {};
    s.main.mode = m.mode === 'manual' ? 'manual' : 'auto';
    s.main.sjcKey = m.sjcKey === 'mieng' ? 'mieng' : 'nhan';
    s.main.buyInChi = numOrNull(m.buyInChi); s.main.sellOutChi = numOrNull(m.sellOutChi); s.main.date = String(m.date || '');
    var k = d.kmh || {};
    s.kmh.buyInChi = numOrNull(k.buyInChi); s.kmh.sellOutChi = numOrNull(k.sellOutChi); s.kmh.date = String(k.date || '');
    if (d.feed && Array.isArray(d.feed.items)) s.feed = d.feed;
    s.feedChecked = +d.feedChecked || 0;
    return s;
  }
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) return normalize(JSON.parse(r)); } catch (e) {}
    return defaults();
  }
  var state = load();
  var feedError = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Không lưu được vào máy. Hãy sao lưu dữ liệu trong Cài đặt.'); }
  }

  function F() { return state.unit === 'luong' ? 10 : 1; }
  function unitName() { return state.unit === 'luong' ? 'lượng' : 'chỉ'; }
  function qtyTxt(chi) { return nf(chi / F(), state.unit === 'luong' ? 3 : 2) + ' ' + unitName(); }
  function priceTr(chiPrice) { return nf(chiPrice * F() / 1e6, 3); }

  /* ---------- giá hiện tại ---------- */
  function priceOf(g) {
    if (g === 'main') {
      var m = state.main;
      if (m.mode === 'auto' && state.feed) {
        var it = (state.feed.items || []).filter(function (x) { return x.key === m.sjcKey; })[0];
        if (it && it.buy > 0 && it.sell > 0) {
          return { buy: it.buy / 10, sell: it.sell / 10, asOf: state.feed.asOf || '', auto: true, label: it.label };
        }
      }
      if (m.buyInChi && m.sellOutChi) return { buy: m.buyInChi, sell: m.sellOutChi, asOf: '', auto: false, date: m.date };
      return null;
    }
    var k = state.kmh;
    if (k.buyInChi) return { buy: k.buyInChi, sell: k.sellOutChi || null, asOf: '', auto: false, date: k.date };
    return null;
  }
  // Giá dùng để tính. KMH chưa có giá riêng thì tạm dùng giá 99,99 và đánh dấu.
  function valPrice(g) {
    var p = priceOf(g);
    if (p) return p;
    if (g === 'kmh') { var q = priceOf('main'); if (q) return Object.assign({}, q, { assumed: true }); }
    return null;
  }
  function lotsOf(g) { return state.lots.filter(function (l) { return l.grp === g; }); }
  function groupStats(g) {
    var ls = lotsOf(g), t = C.totals(ls), p = valPrice(g);
    var value = (p && t.qty > 0) ? t.qty * p.buy : null;
    return { g: g, lots: ls, t: t, p: p, value: value, pl: value == null ? null : value - t.cost, pct: (value != null && t.cost > 0) ? (value - t.cost) / t.cost * 100 : 0 };
  }
  function priceSourceText(g) {
    var p = priceOf(g);
    if (!p) return 'Chưa có giá';
    if (g === 'main' && p.auto) return 'SJC ' + (state.main.sjcKey === 'mieng' ? 'vàng miếng' : 'nhẫn 99,99') + ' · tự động' + (p.asOf ? ' · ' + p.asOf : '');
    return 'Nhập tay' + (p.date ? ' · ' + fmtDate(p.date) : '');
  }

  /* ---------- tổng quan ---------- */
  function priceCardHtml() {
    var rows = '';
    GRPS.forEach(function (g) {
      if (g === 'kmh' && !lotsOf('kmh').length && !priceOf('kmh')) return;
      var p = priceOf(g), vp = valPrice(g);
      var note = priceSourceText(g);
      if (g === 'kmh' && !p && vp) note = 'Chưa có giá riêng, tạm tính theo giá 99,99';
      rows += '<div class="pricerow"><div><b>' + GNAME[g] + '</b><span class="note">' + esc(note) + '</span></div>' +
        '<div style="text-align:right">' + (p ? '<span>mua vào <b>' + priceTr(p.buy) + '</b></span>' + (p.sell ? '<span>bán ra <b>' + priceTr(p.sell) + '</b></span>' : '') + '<span class="note">triệu/' + unitName() + '</span>' : '') + '</div>' +
        '<button type="button" class="btn ghost small" data-act="editprice" data-g="' + g + '">' + (p ? 'Sửa' : 'Nhập giá') + '</button></div>';
    });
    return '<div class="card"><div class="card-head"><h2>Giá hiện tại</h2></div>' + rows + '</div>';
  }
  function groupCardHtml(s) {
    var p = s.p, gap = p ? (s.t.avg - p.buy) * F() / 1e6 : null;
    var be = '';
    if (gap != null) {
      be = gap > 0.0005 ? 'Giá tiệm mua vào cần tăng thêm ' + nf(gap, 3) + ' triệu/' + unitName() + ' mới hòa vốn'
        : (gap < -0.0005 ? 'Đã vượt hòa vốn ' + nf(-gap, 3) + ' triệu/' + unitName() : 'Đang đúng giá hòa vốn');
    }
    return '<div class="card"><div class="card-head"><h2>' + GNAME[s.g] + '</h2>' + (p && p.assumed ? '<span class="tag">tạm tính theo giá 99,99</span>' : '') + '</div>' +
      '<dl class="kv">' +
      '<dt>Đang giữ</dt><dd>' + qtyTxt(s.t.qty) + '</dd>' +
      '<dt>Tổng vốn</dt><dd>' + fmtVnd(s.t.cost) + '</dd>' +
      '<dt>Giá vốn bình quân</dt><dd>' + priceTr(s.t.avg) + ' tr/' + unitName() + '</dd>' +
      '<dt>Bán được bây giờ</dt><dd>' + (s.value == null ? '—' : fmtVnd(s.value)) + '</dd>' +
      '<dt>Lời/lỗ nếu bán</dt><dd class="' + cls(s.pl || 0) + '">' + (s.pl == null ? '—' : fmtSigned(s.pl) + ' (' + fmtPct(s.pct) + ')') + '</dd>' +
      '<dt>Giá hòa vốn (tiệm mua vào)</dt><dd>' + priceTr(s.t.avg) + ' tr/' + unitName() + '</dd></dl>' +
      (be ? '<p class="note ' + (gap > 0.0005 ? 'bad' : 'good') + '">' + be + '</p>' : '') + '</div>';
  }
  function renderHome() {
    var box = $('#homeBody');
    if (!state.lots.length) {
      box.innerHTML = '<div class="empty"><strong>Chưa có lô vàng nào</strong><span>Thêm lô đầu tiên, hoặc khôi phục từ bản sao lưu trong Cài đặt.</span>' +
        '<button type="button" class="btn" data-act="add">Thêm lô đầu tiên</button><button type="button" class="btn ghost" data-act="goset">Khôi phục sao lưu</button></div>' + priceCardHtml();
      return;
    }
    var stats = GRPS.map(groupStats).filter(function (s) { return s.lots.length; });
    var qty = 0, cost = 0, value = 0, known = 0;
    stats.forEach(function (s) { qty += s.t.qty; cost += s.t.cost; if (s.value != null) { value += s.value; known++; } });
    var all = known === stats.length;
    var pl = all ? value - cost : null, pct = all && cost > 0 ? pl / cost * 100 : 0;
    var hero;
    if (all) {
      hero = '<div class="hero ' + (pl > 0.5 ? 'hero-good' : pl < -0.5 ? 'hero-bad' : '') + '"><div class="hero-label">Nếu bán hết ngay bây giờ</div>' +
        '<div class="hero-val ' + cls(pl) + '">' + fmtSigned(pl) + '</div><div class="hero-sub">' + fmtPct(pct) + ' trên vốn ' + fmtVnd(cost) + '</div></div>';
    } else {
      hero = '<div class="hero"><div class="hero-label">Nếu bán hết ngay bây giờ</div><div class="hero-val">—</div><div class="hero-sub">Chưa có giá hiện tại để tính. Nhập giá hoặc lấy giá SJC.</div></div>';
    }
    var avg = qty > 0 ? cost / qty : 0;
    var tiles = '<div class="tiles">' +
      tile('Đang giữ', qtyTxt(qty), state.lots.length + ' lô') +
      tile('Tổng vốn', fmtVnd(cost), '') +
      tile('Bán được bây giờ', all ? fmtVnd(value) : '—', '') +
      tile('Giá vốn bình quân', priceTr(avg) + ' tr/' + unitName(), '') + '</div>';
    box.innerHTML = hero + tiles + priceCardHtml() + stats.map(groupCardHtml).join('');
  }
  function tile(k, v, s) { return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + esc(v) + '</div>' + (s ? '<div class="s">' + esc(s) + '</div>' : '') + '</div>'; }

  /* ---------- các lô ---------- */
  function renderLots() {
    var box = $('#lotsBody');
    if (!state.lots.length) {
      box.innerHTML = '<div class="empty"><span>Chưa có lô nào. Bấm Thêm lô để nhập lần mua đầu tiên.</span></div>';
      return;
    }
    var ls = C.chrono(state.lots).slice().reverse();
    box.innerHTML = '<div class="lots">' + ls.map(function (l) {
      var p = valPrice(l.grp), cost = l.qtyChi * l.priceChi, pl = p ? l.qtyChi * p.buy - cost : null;
      return '<button type="button" class="lot" data-lot="' + esc(l.id) + '">' +
        '<span class="d">' + (l.date ? esc(fmtDate(l.date)) : '<span class="muted">chưa rõ ngày</span>') + (l.grp === 'kmh' ? ' <span class="tag kmh">KMH</span>' : '') + '</span>' +
        '<span class="r">' + esc(qtyTxt(l.qtyChi)) + '</span>' +
        '<span class="m">' + priceTr(l.priceChi) + ' tr/' + unitName() + ' · vốn ' + fmtVnd(cost) + (l.note ? ' · ' + esc(l.note) : '') + '</span>' +
        '<span class="r ' + cls(pl || 0) + '" style="font-weight:600">' + (pl == null ? '' : fmtSigned(pl)) + '</span></button>';
    }).join('') + '</div>';
  }

  /* ---------- mô phỏng ---------- */
  var simGrp = 'main', simMode = 'sell';
  function groupsWithLots() { return GRPS.filter(function (g) { return lotsOf(g).length; }); }
  function renderSim() {
    var gs = groupsWithLots();
    $('#simEmpty').hidden = gs.length > 0;
    $('#simBody').hidden = gs.length === 0;
    if (!gs.length) return;
    if (gs.indexOf(simGrp) < 0) simGrp = gs[0];
    var seg = $('#simGrp');
    seg.hidden = gs.length < 2;
    seg.innerHTML = gs.map(function (g) { return '<button type="button" data-g="' + g + '" aria-pressed="' + (g === simGrp) + '">' + GNAME[g] + '</button>'; }).join('');
    $$('#simMode button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === simMode); });
    $('#panSell').hidden = simMode !== 'sell';
    $('#panBuy').hidden = simMode !== 'buy';
    $('#sMethod').value = state.method;
    $('#stepSel').value = String(state.step);
    $$('.u-qty').forEach(function (e) { e.textContent = unitName(); });
    $$('.u-price').forEach(function (e) { e.textContent = 'triệu/' + unitName(); });
    renderSell(); renderBuy(); renderScen();
  }
  function setHint(el, text, err) { el.textContent = text || ''; el.className = 'hint' + (err ? ' err' : ''); }
  function noPrice(out, hint) { out.innerHTML = ''; setHint(hint, 'Chưa có giá hiện tại. Nhập giá trong Tổng quan hoặc Cài đặt.', true); }
  function renderSell() {
    var g = simGrp, ls = lotsOf(g), t = C.totals(ls), p = valPrice(g), out = $('#sOut'), hint = $('#sHint');
    setHint(hint, '');
    if (t.qty <= 0) { out.innerHTML = emptyBox('Loại vàng này chưa có lô nào.'); return; }
    var qRaw = $('#sQty').value.trim(), q = C.parseNum(qRaw), qChi = qRaw ? q * F() : t.qty;
    if (qRaw && !(q > 0)) { out.innerHTML = ''; setHint(hint, 'Số lượng bán phải lớn hơn 0.', true); return; }
    if (qChi > t.qty + 1e-9) { out.innerHTML = ''; setHint(hint, 'Bạn chỉ đang giữ ' + qtyTxt(t.qty) + '.', true); return; }
    var pRaw = $('#sPrice').value.trim(), pv = C.parseTrieu(pRaw), pChi;
    if (pRaw) { if (!(pv > 0)) { out.innerHTML = ''; setHint(hint, 'Giá bán phải lớn hơn 0.', true); return; } pChi = pv * 1e6 / F(); }
    else if (p) pChi = p.buy;
    else { noPrice(out, hint); return; }
    var r = C.sellResult(ls, qChi, pChi, state.method), u = unitName();
    var word = r.pl > 0.5 ? 'Bán thì lãi' : (r.pl < -0.5 ? 'Bán thì lỗ' : 'Bán thì hòa vốn');
    out.innerHTML =
      '<div class="verdict ' + cls(r.pl) + '">' + word + '<span class="big ' + cls(r.pl) + '">' + fmtSigned(r.pl) + ' (' + fmtPct(r.pct) + ')</span><span class="s">Bán ' + esc(qtyTxt(qChi)) + ' ở giá ' + priceTr(pChi) + ' triệu/' + u + (!pRaw && p && p.assumed ? ' (tạm theo giá 99,99)' : '') + '</span></div>' +
      '<dl class="kv" style="margin-top:12px">' +
      '<dt>Tiền nhận được</dt><dd>' + fmtVnd(r.proceeds) + '</dd>' +
      '<dt>Giá vốn phần bán</dt><dd>' + fmtVnd(r.basis) + '</dd>' +
      '<dt>Còn lại</dt><dd>' + esc(qtyTxt(Math.max(0, r.remQty))) + '</dd>' +
      (r.remQty > 1e-9 ? '<dt>Vốn còn lại</dt><dd>' + fmtVnd(r.remCost) + '</dd><dt>Giá vốn bình quân còn lại</dt><dd>' + priceTr(r.remAvg) + ' tr/' + u + '</dd>' : '') + '</dl>';
  }
  function renderBuy() {
    var g = simGrp, ls = lotsOf(g), t = C.totals(ls), p = valPrice(g), out = $('#bOut'), hint = $('#bHint');
    setHint(hint, '');
    var qRaw = $('#bQty').value.trim(), q = C.parseNum(qRaw);
    if (!qRaw) { out.innerHTML = emptyBox('Nhập số lượng muốn mua thêm để xem giá vốn bình quân thay đổi ra sao.'); return; }
    if (!(q > 0)) { out.innerHTML = ''; setHint(hint, 'Số lượng mua phải lớn hơn 0.', true); return; }
    if (!p) { noPrice(out, hint); return; }
    var pRaw = $('#bPrice').value.trim(), pv = C.parseTrieu(pRaw), pChi;
    if (pRaw) { if (!(pv > 0)) { out.innerHTML = ''; setHint(hint, 'Giá mua phải lớn hơn 0.', true); return; } pChi = pv * 1e6 / F(); }
    else if (p.sell) pChi = p.sell;
    else { out.innerHTML = ''; setHint(hint, 'Chưa có giá bán ra. Nhập giá mua ở ô trên.', true); return; }
    var qChi = q * F(), r = C.buyResult(ls, qChi, pChi, p.buy), u = unitName();
    var gap = (r.newAvg - p.buy) * F() / 1e6;
    var word = r.pl > 0.5 ? 'Sau khi mua, bán hết ngay vẫn lãi' : (r.pl < -0.5 ? 'Sau khi mua, bán hết ngay sẽ lỗ' : 'Sau khi mua, bán hết ngay hòa vốn');
    out.innerHTML =
      '<div class="verdict ' + cls(r.pl) + '">' + word + '<span class="big ' + cls(r.pl) + '">' + fmtSigned(r.pl) + ' (' + fmtPct(r.pct) + ')</span><span class="s">Tính ở giá tiệm mua vào hiện tại: ' + priceTr(p.buy) + ' triệu/' + u + '</span></div>' +
      '<dl class="kv" style="margin-top:12px">' +
      '<dt>Tiền phải trả</dt><dd>' + fmtVnd(r.spend) + '</dd>' +
      '<dt>Tổng đang giữ sau khi mua</dt><dd>' + esc(qtyTxt(r.newQty)) + '</dd>' +
      '<dt>Tổng vốn sau khi mua</dt><dd>' + fmtVnd(r.newCost) + '</dd>' +
      '<dt>Giá vốn bình quân mới</dt><dd>' + priceTr(r.newAvg) + ' tr/' + u + '</dd>' +
      '<dt>Trước khi mua</dt><dd>' + (t.qty > 0 ? priceTr(r.oldAvg) + ' tr/' + u : 'chưa có') + '</dd>' +
      '<dt>Giá hòa vốn mới</dt><dd>' + priceTr(r.newAvg) + ' tr/' + u + '</dd>' +
      '<dt>Cần tăng thêm để hòa vốn</dt><dd>' + (gap > 0.0005 ? nf(gap, 3) + ' tr/' + u : 'đã vượt hòa vốn') + '</dd>' +
      '<dt>Lỗ ngay do chênh lệch mua – bán</dt><dd class="' + (r.spreadLoss > 0.5 ? 'bad' : '') + '">' + (r.spreadLoss > 0.5 ? '−' + fmtVnd(r.spreadLoss) : '0 ₫') + '</dd></dl>';
  }
  function renderScen() {
    var g = simGrp, ls = lotsOf(g), t = C.totals(ls), p = valPrice(g), box = $('#scen');
    if (t.qty <= 0) { box.innerHTML = emptyBox('Loại vàng này chưa có lô nào.'); return; }
    if (!p) { box.innerHTML = emptyBox('Chưa có giá hiện tại để so sánh.'); return; }
    var stepChi = state.step * 1e6 / 10, rows = [], k;
    for (k = -3; k <= 3; k++) { var pc = p.buy + k * stepChi; if (pc > 0) rows.push({ p: pc, tag: k === 0 ? 'now' : '' }); }
    rows.push({ p: t.avg, tag: 'be' });
    rows.sort(function (a, b) { return b.p - a.p; });
    rows.forEach(function (r) { r.pl = t.qty * r.p - t.cost; r.pct = t.cost > 0 ? r.pl / t.cost * 100 : 0; });
    var maxAbs = Math.max.apply(null, rows.map(function (r) { return Math.abs(r.pl); }).concat([1]));
    var u = unitName();
    box.innerHTML = '<table><thead><tr><th>Giá mua vào (tr/' + u + ')</th><th>So với hiện tại</th><th>Lời/lỗ</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var d = (r.p - p.buy) * F() / 1e6, w = Math.max(2, Math.abs(r.pl) / maxAbs * 100);
        var label = r.tag === 'now' ? '<span class="rowlabel">Hiện tại</span>' : (r.tag === 'be' ? '<span class="rowlabel">Hòa vốn</span>' : '');
        return '<tr class="' + (r.tag === 'now' ? 'is-now' : r.tag === 'be' ? 'is-be' : '') + '"><td>' + label + priceTr(r.p) + '</td>' +
          '<td class="' + cls(d * 1000) + '">' + (Math.abs(d) < 0.0005 ? '0' : (d > 0 ? '+' : '−') + nf(Math.abs(d), 3)) + '</td>' +
          '<td class="' + cls(r.pl) + '" style="min-width:130px">' + fmtSigned(r.pl) + '<span class="rownote ' + cls(r.pl) + '">' + fmtPct(r.pct) + '</span><span class="bar ' + (r.pl < 0 ? 'neg' : '') + '" style="width:' + w.toFixed(1) + '%"></span></td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ---------- cài đặt ---------- */
  var confirmKey = null, confirmTimer = null;
  function confirmBtn(key, label, sure, act) {
    return '<button type="button" class="btn ' + (confirmKey === key ? 'danger' : 'ghost') + ' block" data-act="' + act + '">' + (confirmKey === key ? sure : label) + '</button>';
  }
  function askConfirm(key) {
    if (confirmKey === key) { confirmKey = null; clearTimeout(confirmTimer); return true; }
    confirmKey = key; clearTimeout(confirmTimer);
    confirmTimer = setTimeout(function () { confirmKey = null; renderSettings(); }, 4000);
    renderSettings();
    return false;
  }
  function renderSettings() {
    var f = state.feed, pm = priceOf('main');
    var feedLine = f ? ('Giá SJC đọc lúc ' + (f.asOf || '—')) : 'Chưa có giá SJC nào';
    var kLine = priceOf('kmh') ? ('mua vào ' + priceTr(priceOf('kmh').buy) + ' tr/' + unitName()) : 'chưa nhập';
    var books = meta.list.map(function (b) {
      return '<button type="button" class="btn' + (b.id === meta.active ? '' : ' ghost') + ' block" data-act="switchbook" data-id="' + esc(b.id) + '">' + esc(b.name) + (b.id === meta.active ? ' (đang xem)' : '') + '</button>';
    }).join('');
    var booksCard = '<div class="card"><h3>Sổ vàng</h3>' + books +
      '<div class="field"><label for="renBook">Đổi tên sổ đang xem</label><input id="renBook" maxlength="30" value="' + esc(bookName()) + '"></div>' +
      '<button type="button" class="btn ghost block" data-act="renbook">Lưu tên</button>' +
      '<div class="field"><label for="newBook">Thêm sổ mới (cho người hoặc tài khoản khác)</label><input id="newBook" maxlength="30" placeholder="Tên sổ, ví dụ: Sổ của mẹ"></div>' +
      '<button type="button" class="btn ghost block" data-act="addbook">Thêm sổ</button>' +
      (meta.list.length > 1 ? confirmBtn('delbook', 'Xóa sổ đang xem', 'Bấm lần nữa để xóa sổ này', 'delbook') : '') + '</div>';
    $('#setBody').innerHTML = booksCard +
      '<div class="card"><h3>Hiển thị</h3>' +
      '<div class="field"><span class="lbl">Đơn vị hiển thị</span><div class="seg" id="unitSeg"><button type="button" data-unit="chi" aria-pressed="' + (state.unit === 'chi') + '">Chỉ</button><button type="button" data-unit="luong" aria-pressed="' + (state.unit === 'luong') + '">Lượng</button></div></div>' +
      '<div class="field"><label for="setMethod">Cách tính giá vốn khi bán</label><select id="setMethod"><option value="avg">Bình quân các lô</option><option value="fifo">Lô mua trước bán trước</option></select></div></div>' +
      '<div class="card"><h3>Giá vàng</h3>' +
      '<dl class="kv"><dt>Vàng 99,99</dt><dd>' + esc(pm ? priceSourceText('main') : 'chưa có giá') + '</dd><dt>KMH 99,999</dt><dd>' + esc(kLine) + '</dd><dt>Giá SJC</dt><dd>' + esc(feedLine) + '</dd></dl>' +
      (feedError ? '<p class="note bad">Lần lấy giá gần nhất không thành công. App đang dùng giá đã lưu.</p>' : '') +
      '<button type="button" class="btn block" data-act="refresh">Lấy giá SJC ngay</button>' +
      '<div class="grid2"><button type="button" class="btn ghost" data-act="editprice" data-g="main">Giá 99,99</button><button type="button" class="btn ghost" data-act="editprice" data-g="kmh">Giá KMH</button></div></div>' +
      '<div class="card"><h3>Sao lưu và khôi phục</h3>' +
      '<p class="note">Dữ liệu chỉ nằm trên điện thoại này. Hãy sao lưu thường xuyên, và trước khi đổi máy hoặc xóa app.</p>' +
      '<button type="button" class="btn block" data-act="share">Lưu bản sao lưu</button>' +
      '<button type="button" class="btn ghost block" data-act="copy">Sao chép nội dung sao lưu</button>' +
      '<hr style="border:0;border-top:1px solid var(--line);width:100%;margin:2px 0">' +
      '<button type="button" class="btn ghost block" data-act="pickfile">Khôi phục từ tệp</button>' +
      '<input type="file" id="impFile" accept=".json,application/json,text/plain" hidden>' +
      '<div class="field"><label for="impText">Hoặc dán nội dung sao lưu vào đây</label><textarea id="impText" placeholder="{ ... }" spellcheck="false"></textarea></div>' +
      '<button type="button" class="btn ghost block" data-act="importtext">Khôi phục từ nội dung đã dán</button>' +
      '<div class="hint" id="impHint" role="status"></div></div>' +
      '<div class="card"><h3>Dữ liệu</h3>' + confirmBtn('reset', 'Xóa toàn bộ dữ liệu', 'Bấm lần nữa để xóa hết', 'reset') + '</div>' +
      '<p class="note" style="text-align:center">Sổ vàng · dữ liệu lưu trên máy này</p>';
    $('#setMethod').value = state.method;
  }

  /* ---------- sao lưu ---------- */
  function backupObj() {
    return { app: 'so-vang', v: 1, exportedAt: new Date().toISOString(), unit: state.unit, method: state.method, step: state.step, lots: state.lots, main: state.main, kmh: state.kmh };
  }
  function backupText() { return JSON.stringify(backupObj(), null, 1); }
  function downloadText(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  async function shareBackup() {
    var text = backupText(), name = 'so-vang-sao-luu-' + todayStr() + '.json';
    try {
      var file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Sổ vàng sao lưu' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    downloadText(name, text);
    toast('Đã tạo tệp sao lưu.');
  }
  async function copyBackup() {
    var text = backupText();
    try { await navigator.clipboard.writeText(text); toast('Đã sao chép nội dung sao lưu.'); }
    catch (e) { var ta = $('#impText'); if (ta) { ta.value = text; ta.select(); } toast('Không sao chép tự động được. Nội dung đã hiện trong ô bên dưới, hãy chọn và sao chép.'); }
  }
  var pendingImport = null;
  function tryImport(text) {
    var hint = $('#impHint');
    var d;
    try { d = JSON.parse(text); } catch (e) { setHint(hint, 'Nội dung không đọc được. Hãy chọn đúng tệp sao lưu của Sổ vàng.', true); return; }
    var lots = cleanLots(d && d.lots);
    if (!d || !Array.isArray(d.lots) || !lots.length) { setHint(hint, 'Không thấy lô vàng hợp lệ trong tệp này.', true); return; }
    if (state.lots.length && pendingImport !== text) {
      pendingImport = text;
      setHint(hint, 'Sổ đang có ' + state.lots.length + ' lô. Bấm khôi phục lần nữa để thay bằng ' + lots.length + ' lô trong bản sao lưu.', true);
      return;
    }
    var keepFeed = state.feed, keepChecked = state.feedChecked;
    state = normalize(d); state.feed = keepFeed; state.feedChecked = keepChecked;
    pendingImport = null; save(); renderAll();
    toast('Đã khôi phục ' + lots.length + ' lô vàng.');
  }

  /* ---------- hộp thoại: lô vàng ---------- */
  function unitOptsHtml() { return '<option value="chi">chỉ</option><option value="phan">phân</option><option value="luong">lượng</option>'; }
  var UNIT_LABEL = { chi: 'chỉ', phan: 'phân', luong: 'lượng' };
  function openLot(id) {
    var l = id ? state.lots.filter(function (x) { return x.id === id; })[0] : null;
    var d = $('#lotDlg');
    d.innerHTML = '<form class="sheet" id="lotForm" novalidate>' +
      '<div class="sheet-head"><h2>' + (l ? 'Sửa lô vàng' : 'Thêm lô vàng') + '</h2><button type="button" class="btn ghost small" data-close>Đóng</button></div>' +
      '<div class="grid2"><div class="field"><label for="lGrp">Loại vàng</label><select id="lGrp"><option value="main">99,99</option><option value="kmh">99,999 (KMH)</option></select></div>' +
      '<div class="field"><label for="lDate">Ngày mua</label><input id="lDate" type="date"></div></div>' +
      '<div class="field"><label for="lQty">Số lượng</label><div class="grid2" style="grid-template-columns:1fr 110px"><input id="lQty" inputmode="decimal" autocomplete="off" placeholder="0,5"><select id="lUnit" aria-label="Đơn vị">' + unitOptsHtml() + '</select></div></div>' +
      '<div class="field"><label for="lPMode">Cách nhập giá</label><select id="lPMode"></select></div>' +
      '<div class="field"><label for="lPrice">Giá (triệu đồng)</label><input id="lPrice" inputmode="decimal" autocomplete="off" placeholder="14,1 hoặc 14tr1"></div>' +
      '<div class="field"><label for="lNote">Ghi chú</label><input id="lNote" maxlength="60" placeholder="Tiệm, loại vàng"></div>' +
      '<div class="hint" id="lPrev"></div><div class="hint err" id="lErr" role="alert"></div>' +
      '<div class="row"><button type="submit" class="btn" style="flex:1">Lưu</button>' + (l ? '<button type="button" class="btn ghost" id="lDel">Xóa lô</button>' : '') + '</div></form>';
    var q = function (s) { return $(s, d); };
    function fillModes() {
      var u = UNIT_LABEL[q('#lUnit').value], cur = q('#lPMode').value || 'per';
      q('#lPMode').innerHTML = '<option value="per">Giá mỗi ' + u + '</option><option value="total">Tổng tiền cả lô</option>';
      q('#lPMode').value = cur;
    }
    function read() {
      var qty = C.parseNum(q('#lQty').value), pv = C.parseTrieu(q('#lPrice').value), unit = q('#lUnit').value, mode = q('#lPMode').value;
      if (!(qty > 0)) return { err: 'Nhập số lượng lớn hơn 0, ví dụ 0,5.' };
      if (!(pv > 0)) return { err: 'Nhập giá lớn hơn 0, tính bằng triệu đồng, ví dụ 14,1.' };
      var qtyChi = C.toChi(qty, unit);
      var priceChi = mode === 'total' ? pv * 1e6 / qtyChi : pv * 1e6 / C.UNIT_CHI[unit];
      return { qtyChi: qtyChi, priceChi: priceChi };
    }
    function preview() {
      var r = read();
      q('#lPrev').textContent = r.err ? '' : '= ' + nf(r.qtyChi, 3) + ' chỉ × ' + nf(r.priceChi / 1e6, 3) + ' triệu/chỉ = ' + fmtVnd(r.qtyChi * r.priceChi);
      q('#lErr').textContent = '';
    }
    fillModes();
    if (l) {
      q('#lGrp').value = l.grp; q('#lDate').value = l.date; q('#lUnit').value = 'chi';
      q('#lQty').value = inputNum(l.qtyChi); q('#lPrice').value = inputNum(l.priceChi / 1e6); q('#lNote').value = l.note || '';
    } else { q('#lDate').value = todayStr(); }
    q('#lUnit').addEventListener('change', function () { fillModes(); preview(); });
    ['#lQty', '#lPrice'].forEach(function (s) { q(s).addEventListener('input', preview); });
    q('#lPMode').addEventListener('change', preview);
    preview();
    var delArmed = false;
    if (l) q('#lDel').addEventListener('click', function (e) {
      if (!delArmed) { delArmed = true; e.target.textContent = 'Bấm lần nữa để xóa'; e.target.className = 'btn danger'; return; }
      state.lots = state.lots.filter(function (x) { return x.id !== l.id; });
      save(); renderAll(); d.close(); toast('Đã xóa lô.');
    });
    q('#lotForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var r = read();
      if (r.err) { q('#lErr').textContent = r.err; return; }
      var rec = { id: l ? l.id : uid(), date: q('#lDate').value || '', qtyChi: r.qtyChi, priceChi: r.priceChi, grp: q('#lGrp').value, note: q('#lNote').value.trim() };
      if (l) state.lots = state.lots.map(function (x) { return x.id === l.id ? rec : x; });
      else state.lots.push(rec);
      save(); renderAll(); d.close(); toast(l ? 'Đã lưu thay đổi.' : 'Đã thêm lô vàng.');
    });
    openDialog(d);
  }

  /* ---------- hộp thoại: giá hiện tại ---------- */
  function openPrice(g) {
    var d = $('#priceDlg'), u = unitName(), isMain = g === 'main';
    var cur = isMain ? state.main : state.kmh;
    var auto = isMain && state.main.mode === 'auto';
    var cp = priceOf(g);
    d.innerHTML = '<form class="sheet" id="priceForm" novalidate>' +
      '<div class="sheet-head"><h2>Giá ' + GNAME[g] + '</h2><button type="button" class="btn ghost small" data-close>Đóng</button></div>' +
      (isMain ?
        '<label class="radio' + (auto ? ' on' : '') + '" id="rAuto"><input type="radio" name="pm" value="auto"' + (auto ? ' checked' : '') + '><span><b>Tự động theo SJC</b><span class="note">Lấy từ bảng giá SJC (TP.HCM) mỗi khi bạn mở app.</span></span></label>' +
        '<div class="field" id="autoBox"><label for="pKey">Loại vàng SJC để lấy giá</label><select id="pKey"><option value="nhan">' + SJC_LABEL.nhan + '</option><option value="mieng">' + SJC_LABEL.mieng + '</option></select><div class="hint" id="pFeed"></div></div>' +
        '<label class="radio' + (auto ? '' : ' on') + '" id="rMan"><input type="radio" name="pm" value="manual"' + (auto ? '' : ' checked') + '><span><b>Nhập tay</b><span class="note">Dùng khi bạn mua bán ở tiệm khác SJC.</span></span></label>'
        : '<p class="note">Vàng 99,99999 KMH có giá riêng. Nhập giá tiệm mua vào để tính lời/lỗ. Giá bán ra có thể để trống.</p>') +
      '<div id="manBox" style="display:grid;gap:12px">' +
      '<div class="grid2"><div class="field"><label for="pBuy">Tiệm mua vào</label><div class="inwrap"><input id="pBuy" inputmode="decimal" autocomplete="off" placeholder="13,48"><span class="suffix">tr/' + u + '</span></div></div>' +
      '<div class="field"><label for="pSell">Tiệm bán ra' + (isMain ? '' : ' (không bắt buộc)') + '</label><div class="inwrap"><input id="pSell" inputmode="decimal" autocomplete="off" placeholder="13,88"><span class="suffix">tr/' + u + '</span></div></div></div>' +
      '<div class="field"><label for="pDate">Ngày của giá</label><input id="pDate" type="date"></div></div>' +
      '<div class="hint err" id="pErr" role="alert"></div>' +
      '<div class="row"><button type="submit" class="btn" style="flex:1">Lưu giá</button>' + (!isMain && cur.buyInChi ? '<button type="button" class="btn ghost" id="pClear">Xóa giá KMH</button>' : '') + '</div></form>';
    var q = function (s) { return $(s, d); };
    var seed = cur.buyInChi ? cur : (cp ? { buyInChi: cp.buy, sellOutChi: cp.sell } : {});
    if (seed.buyInChi) q('#pBuy').value = inputNum(seed.buyInChi * F() / 1e6);
    if (seed.sellOutChi) q('#pSell').value = inputNum(seed.sellOutChi * F() / 1e6);
    q('#pDate').value = cur.date || todayStr();
    if (isMain) {
      q('#pKey').value = state.main.sjcKey;
      var sync = function () {
        var mode = q('input[name=pm]:checked').value;
        q('#rAuto').className = 'radio' + (mode === 'auto' ? ' on' : '');
        q('#rMan').className = 'radio' + (mode === 'manual' ? ' on' : '');
        q('#autoBox').style.display = mode === 'auto' ? '' : 'none';
        q('#manBox').style.display = mode === 'manual' ? 'grid' : 'none';
        var it = state.feed && (state.feed.items || []).filter(function (x) { return x.key === q('#pKey').value; })[0];
        q('#pFeed').textContent = it ? 'Hiện tại: mua vào ' + nf(it.buy / 10 * F() / 1e6, 3) + ' · bán ra ' + nf(it.sell / 10 * F() / 1e6, 3) + ' triệu/' + u + (state.feed.asOf ? ' · ' + state.feed.asOf : '') : 'Chưa có giá SJC. Vào Cài đặt, bấm Lấy giá SJC ngay.';
      };
      $$('input[name=pm]', d).forEach(function (r) { r.addEventListener('change', sync); });
      q('#pKey').addEventListener('change', sync);
      sync();
    }
    if (!isMain && cur.buyInChi) q('#pClear').addEventListener('click', function () {
      state.kmh = { buyInChi: null, sellOutChi: null, date: '' }; save(); renderAll(); d.close(); toast('Đã xóa giá KMH.');
    });
    q('#priceForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var mode = isMain ? q('input[name=pm]:checked').value : 'manual';
      if (isMain && mode === 'auto') {
        state.main.mode = 'auto'; state.main.sjcKey = q('#pKey').value;
        save(); renderAll(); d.close(); toast('Đã chọn giá tự động theo SJC.'); refreshFeed(true); return;
      }
      var b = C.parseTrieu(q('#pBuy').value), sRaw = q('#pSell').value.trim(), s = C.parseTrieu(sRaw);
      if (!(b > 0)) { q('#pErr').textContent = 'Nhập giá tiệm mua vào lớn hơn 0, tính bằng triệu đồng.'; return; }
      if (sRaw && !(s > 0)) { q('#pErr').textContent = 'Giá bán ra chưa đúng.'; return; }
      if (isMain && !(s > 0)) { q('#pErr').textContent = 'Nhập cả giá bán ra.'; return; }
      var rec = { buyInChi: b * 1e6 / F(), sellOutChi: sRaw ? s * 1e6 / F() : null, date: q('#pDate').value || todayStr() };
      if (isMain) { state.main.mode = 'manual'; state.main.buyInChi = rec.buyInChi; state.main.sellOutChi = rec.sellOutChi; state.main.date = rec.date; }
      else state.kmh = rec;
      save(); renderAll(); d.close(); toast('Đã lưu giá.');
    });
    openDialog(d);
  }

  function openDialog(d) {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  ['#lotDlg', '#priceDlg'].forEach(function (s) {
    var d = $(s);
    d.addEventListener('click', function (e) { if (e.target === d || (e.target.closest && e.target.closest('[data-close]'))) d.close(); });
  });

  /* ---------- thông báo ngắn ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200);
  }

  /* ---------- giá SJC ---------- */
  function renderFeedStat() {
    var el = $('#feedStat'), f = state.feed, txt = '', warn = false;
    if (state.main.mode === 'manual') txt = 'Giá nhập tay';
    else if (!f) { txt = 'Chưa có giá SJC'; warn = true; }
    else {
      txt = 'SJC ' + (f.asOf || '');
      var age = f.updatedAt ? Date.now() - Date.parse(f.updatedAt) : 0;
      if (age > 36 * 3600e3) { txt += ' · giá đã cũ'; warn = true; }
    }
    if (feedError && state.main.mode === 'auto') { txt += ' · chưa cập nhật được'; warn = true; }
    el.textContent = txt; el.className = 'feedstat' + (warn ? ' warn' : '');
  }
  async function refreshFeed(force) {
    if (!force && Date.now() - state.feedChecked < 5 * 60e3) return;
    try {
      var r = await fetch('prices.json?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('http ' + r.status);
      var j = await r.json();
      if (!j || !Array.isArray(j.items) || !j.items.length) throw new Error('bad feed');
      state.feed = j; state.feedChecked = Date.now(); feedError = false; save(); renderAll();
      if (force) toast('Đã lấy giá SJC: ' + (j.asOf || ''));
    } catch (e) {
      feedError = true; renderFeedStat();
      if (force) { renderSettings(); toast('Chưa lấy được giá SJC. App dùng giá đã lưu.'); }
    }
  }

  /* ---------- điều khiển ---------- */
  var TITLES = { home: 'Tổng quan', lots: 'Các lô vàng', sim: 'Mô phỏng', set: 'Cài đặt' };
  var curTab = 'home';
  function updateTitle() {
    $('#screenTitle').textContent = TITLES[curTab] + (meta.list.length > 1 ? ' · ' + bookName() : '');
  }
  function showTab(name) {
    curTab = name;
    Object.keys(TITLES).forEach(function (k) { $('#tab-' + k).hidden = k !== name; });
    $$('.tabbar button').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === name); });
    updateTitle();
    window.scrollTo(0, 0);
  }
  $$('.tabbar button').forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });
  $('#addLotBtn').addEventListener('click', function () { openLot(null); });
  $('#lotsBody').addEventListener('click', function (e) { var b = e.target.closest('[data-lot]'); if (b) openLot(b.getAttribute('data-lot')); });

  function setUnit(u) {
    if (u === state.unit) return;
    var oldF = F(); state.unit = u; var newF = F();
    [['#sQty', oldF / newF], ['#bQty', oldF / newF], ['#sPrice', newF / oldF], ['#bPrice', newF / oldF]].forEach(function (p) {
      var el = $(p[0]), v = C.parseTrieu(el.value);
      if (isFinite(v) && v > 0) el.value = inputNum(Math.round(v * p[1] * 1e6) / 1e6);
    });
    save(); renderAll();
  }
  function onAct(e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act');
    if (act === 'add') openLot(null);
    else if (act === 'goset') showTab('set');
    else if (act === 'editprice') openPrice(b.getAttribute('data-g'));
    else if (act === 'refresh') refreshFeed(true);
    else if (act === 'share') shareBackup();
    else if (act === 'copy') copyBackup();
    else if (act === 'pickfile') $('#impFile').click();
    else if (act === 'importtext') tryImport($('#impText').value);
    else if (act === 'switchbook') { var id = b.getAttribute('data-id'); if (id !== meta.active) { meta.active = id; saveMeta(); location.reload(); } }
    else if (act === 'addbook') {
      var nm = ($('#newBook').value || '').trim();
      if (!nm) { toast('Hãy nhập tên cho sổ mới.'); return; }
      var nid = 'b' + Date.now().toString(36);
      meta.list.push({ id: nid, name: nm }); meta.active = nid; saveMeta(); location.reload();
    }
    else if (act === 'renbook') {
      var rn = ($('#renBook').value || '').trim();
      if (!rn) { toast('Tên sổ không được để trống.'); return; }
      meta.list.forEach(function (x) { if (x.id === meta.active) x.name = rn; });
      saveMeta(); renderSettings(); updateTitle(); toast('Đã đổi tên sổ.');
    }
    else if (act === 'delbook') {
      if (askConfirm('delbook')) {
        var del = meta.active;
        try { localStorage.removeItem(keyOf(del)); } catch (e) {}
        meta.list = meta.list.filter(function (x) { return x.id !== del; });
        meta.active = meta.list[0].id; saveMeta(); location.reload();
      }
    }
    else if (act === 'reset') {
      if (askConfirm('reset')) { var f = state.feed; state = defaults(); state.feed = f; save(); renderAll(); toast('Đã xóa toàn bộ dữ liệu.'); }
    }
  }
  $('#homeBody').addEventListener('click', onAct);
  $('#setBody').addEventListener('click', function (e) {
    var u = e.target.closest('[data-unit]'); if (u) { setUnit(u.getAttribute('data-unit')); return; }
    onAct(e);
  });
  $('#setBody').addEventListener('change', function (e) {
    if (e.target.id === 'setMethod') { state.method = e.target.value; save(); renderSim(); }
    else if (e.target.id === 'impFile' && e.target.files && e.target.files[0]) {
      var rd = new FileReader();
      rd.onload = function () { tryImport(String(rd.result || '')); };
      rd.readAsText(e.target.files[0]);
    }
  });

  $('#simGrp').addEventListener('click', function (e) { var b = e.target.closest('[data-g]'); if (b) { simGrp = b.getAttribute('data-g'); renderSim(); } });
  $('#simMode').addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (b) { simMode = b.getAttribute('data-mode'); renderSim(); } });
  ['#sQty', '#sPrice'].forEach(function (s) { $(s).addEventListener('input', renderSell); });
  ['#bQty', '#bPrice'].forEach(function (s) { $(s).addEventListener('input', renderBuy); });
  $('#sMethod').addEventListener('change', function () { state.method = $('#sMethod').value; save(); renderSell(); });
  $('#stepSel').addEventListener('change', function () { state.step = +$('#stepSel').value; save(); renderScen(); });

  function renderAll() { renderHome(); renderLots(); renderSim(); renderSettings(); renderFeedStat(); }
  renderAll();
  updateTitle();
  refreshFeed(false);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refreshFeed(false); });
  window.addEventListener('online', function () { refreshFeed(true); });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
