/* Thẻ tín dụng: dữ liệu lưu trên điện thoại (localStorage). */
(function () {
  'use strict';
  var C = window.Cards;
  var KEY = 'the-tin-dung-v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var nf = function (n) { return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(n)); };
  var vnd = function (n) { return nf(n) + ' ₫'; };
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtDate(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function fmtDM(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }

  // "1.250.000", "50tr", "3tr5", "500k" -> số đồng
  function parseMoney(s) {
    if (s == null) return NaN;
    var t = String(s).trim().toLowerCase().replace(/\s/g, '').replace(/đ$|vnd$|vnđ$/, '');
    if (!t) return NaN;
    var m = t.match(/^(\d+)(?:tr|triệu|trieu)(\d*)$/);
    if (m) return Math.round(Number(m[1] + (m[2] ? '.' + m[2] : '')) * 1e6);
    m = t.match(/^([\d.,]+)(?:k|nghìn|ngan)$/);
    if (m) return Math.round(Number(m[1].replace(/[.,]/g, '')) * 1000);
    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ''));
    var n = Number(t.replace(',', '.'));
    return isFinite(n) ? Math.round(n) : NaN;
  }
  function numOrNaN(s) { var n = Number(String(s).trim().replace(',', '.')); return String(s).trim() === '' ? NaN : n; }
  function inMoney(n) { return n ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n) : ''; }

  var state = load();
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.cards) && Array.isArray(d.tx)) return { v: 1, cards: d.cards, tx: d.tx };
    } catch (e) {}
    return { v: 1, cards: [], tx: [] };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Không lưu được vào máy. Hãy sao lưu dữ liệu trong Cài đặt.'); } }
  function cardById(id) { return state.cards.filter(function (c) { return c.id === id; })[0]; }
  function txOf(id) { return state.tx.filter(function (t) { return t.cardId === id; }); }
  function infoOf(c) { return C.cardInfo(c, txOf(c.id), today()); }
  function cardLabel(c) { return c.name + (c.last4 ? ' ••' + c.last4 : ''); }

  var toastTimer;
  function toast(m) { var t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 3200); }
  var dlg = $('#dlg');
  dlg.addEventListener('click', function (e) { if (e.target === dlg || (e.target.closest && e.target.closest('[data-close]'))) dlg.close(); });
  function openDlg(html) { dlg.innerHTML = html; if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', ''); }

  /* ---------- hiển thị ---------- */
  function chip(i) {
    if (i.status === 'paid') return '<span class="chip paid">Đã trả đủ</span>';
    if (i.status === 'overdue') return '<span class="chip overdue">Quá hạn ' + i.overdueDays + ' ngày</span>';
    if (i.daysLeft === 0) return '<span class="chip soon">Hạn trả hôm nay</span>';
    return '<span class="chip ' + (i.daysLeft <= 5 ? 'soon' : 'due') + '">Còn ' + i.daysLeft + ' ngày</span>';
  }
  function cardBtn(c) {
    var i = infoOf(c);
    var meter = i.usage != null ? '<div class="meter"><i class="' + (i.usage > 80 ? 'hi' : '') + '" style="width:' + Math.min(100, i.usage).toFixed(0) + '%"></i></div><span class="note">Đã dùng ' + vnd(i.outstanding) + ' / hạn mức ' + vnd(c.limit) + '</span>' : '';
    var line = i.status === 'paid' ? 'Không còn nợ kỳ sao kê ' + fmtDM(i.stmtDate) : 'Phải trả ' + vnd(i.remaining) + ' trước ' + fmtDate(i.due);
    return '<button type="button" class="cardbtn" data-card="' + esc(c.id) + '"><div class="top2"><b>' + esc(cardLabel(c)) + '</b>' + chip(i) + '</div><div>' + line + '</div>' +
      (i.status === 'overdue' ? '<div class="bad">Phí chậm trả ước tính ' + vnd(i.lateFee) + ' + lãi ước tính ' + vnd(i.interest) + '</div>' : '') + meter + '</button>';
  }
  function renderHome() {
    var box = $('#homeBody');
    if (!state.cards.length) {
      box.innerHTML = '<div class="empty"><strong>Chưa có thẻ nào</strong><span>Thêm thẻ đầu tiên, nhập ngày sao kê và ngày đến hạn in trên sao kê của ngân hàng.</span><button type="button" class="btn" data-act="addcard">Thêm thẻ đầu tiên</button><button type="button" class="btn ghost" data-act="goset">Khôi phục sao lưu</button></div>';
      return;
    }
    var infos = state.cards.map(function (c) { return { c: c, i: infoOf(c) }; });
    var owing = infos.filter(function (x) { return x.i.status !== 'paid'; }).sort(function (a, b) { return a.i.due < b.i.due ? -1 : 1; });
    var hero;
    if (!owing.length) hero = '<div class="hero hero-good"><div class="hero-label">Cần trả sắp tới</div><div class="hero-val good">Không có</div><div class="hero-sub">Tất cả thẻ đã trả đủ kỳ sao kê gần nhất.</div></div>';
    else {
      var f = owing[0], bad = f.i.status === 'overdue' || f.i.daysLeft <= 5;
      hero = '<div class="hero ' + (bad ? 'hero-bad' : '') + '"><div class="hero-label">Hạn trả gần nhất: ' + esc(cardLabel(f.c)) + '</div><div class="hero-val ' + (bad ? 'bad' : '') + '">' + vnd(f.i.remaining) + '</div>' +
        '<div class="hero-sub">' + (f.i.status === 'overdue' ? 'Đã quá hạn ' + f.i.overdueDays + ' ngày (hạn ' + fmtDate(f.i.due) + ')' : 'Trước ngày ' + fmtDate(f.i.due) + ', còn ' + f.i.daysLeft + ' ngày') + ' · tối thiểu ' + vnd(f.i.minRemaining) + '</div></div>';
    }
    var tot = function (k) { return infos.reduce(function (s, x) { return s + x.i[k]; }, 0); };
    var fees = infos.reduce(function (s, x) { return s + x.i.lateFee + x.i.interest; }, 0);
    var tiles = '<div class="tiles">' +
      tile('Cần trả các kỳ đã chốt', vnd(tot('remaining'))) + tile('Chi tiêu kỳ mới (chưa chốt)', vnd(tot('newSpend'))) +
      tile('Tổng dư nợ', vnd(tot('outstanding'))) + tile('Phí + lãi đang phát sinh (ước tính)', fees ? vnd(fees) : '0 ₫') + '</div>';
    var alr = (sync.alerts || []).map(function (a) { return '<div class="hint err">⚠ ' + esc(a.bank) + ' ••' + esc(a.last4) + ' (' + fmtDate(a.date) + '): ' + esc(a.text) + '</div>'; }).join('');
    box.innerHTML = alr + hero + tiles + '<div class="lots">' + infos.map(function (x) { return cardBtn(x.c); }).join('') + '</div>';
  }
  function tile(k, v) { return '<div class="tile"><div class="k">' + k + '</div><div class="v">' + esc(v) + '</div></div>'; }

  function renderCards() {
    var b = $('#cardsBody');
    b.innerHTML = state.cards.length ? '<div class="lots">' + state.cards.map(cardBtn).join('') + '</div>' : '<div class="empty"><span>Chưa có thẻ. Bấm Thêm thẻ.</span></div>';
  }

  function renderTx() {
    var sel = $('#txCard'), cur = sel.value || 'all';
    sel.innerHTML = '<option value="all">Tất cả thẻ</option>' + state.cards.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(cardLabel(c)) + '</option>'; }).join('');
    sel.value = state.cards.some(function (c) { return c.id === cur; }) ? cur : 'all';
    var list = state.tx.filter(function (t) { return sel.value === 'all' || t.cardId === sel.value; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 80);
    $('#txBody').innerHTML = list.length ? '<div class="lots">' + list.map(function (t) {
      var c = cardById(t.cardId), pay = t.type === 'pay';
      return '<button type="button" class="txrow" data-tx="' + esc(t.id) + '"><b>' + esc(t.note || (pay ? 'Trả tiền thẻ' : 'Chi tiêu')) + '</b><b class="' + (pay ? 'good' : '') + '">' + (pay ? '−' : '') + vnd(t.amount) + '</b><span class="m">' + fmtDate(t.date) + ' · ' + esc(c ? cardLabel(c) : 'thẻ đã xóa') + '</span><span class="m" style="text-align:right">' + (pay ? 'đã trả' : 'chi tiêu') + '</span></button>';
    }).join('') + '</div>' : '<div class="empty"><span>Chưa có giao dịch.</span></div>';
  }

  /* ---------- nhắc nhở qua Lịch ---------- */
  function upcomingDues(c) {
    var t = today(), i = infoOf(c), out = [];
    var first = i.status !== 'paid' ? i.due : null;
    var s = C.lastStatement(c.stmtDay, t), d = C.dueAfter(s, c.dueDay);
    for (var k = 0; k < 4 && out.length < 3; k++) {
      if (d >= t) out.push({ date: d, amount: first && d === first ? i.remaining : null });
      s = C.nextStatement(c.stmtDay, s); d = C.dueAfter(s, c.dueDay);
    }
    if (first && first >= t && !out.some(function (e) { return e.date === first; })) out.unshift({ date: first, amount: i.remaining });
    return out;
  }
  function renderRem() {
    var rows = '';
    state.cards.forEach(function (c) {
      upcomingDues(c).forEach(function (e) { rows += '<dt>' + esc(cardLabel(c)) + '</dt><dd>' + fmtDate(e.date) + (e.amount ? ' · ' + vnd(e.amount) : '') + '</dd>'; });
    });
    $('#remBody').innerHTML = '<div class="card"><h3>Nhắc đóng tiền</h3>' +
      '<p class="note">App tạo sự kiện hạn trả vào <b>Lịch iPhone</b>, có chuông nhắc <b>trước 5 ngày, trước 2 ngày và đúng ngày (9 giờ sáng)</b>. Chuông do iPhone kêu nên vẫn nhắc đúng giờ dù bạn không mở app.</p>' +
      (state.cards.length ? '<button type="button" class="btn block" data-act="ics">Thêm hạn trả vào Lịch iPhone</button>' : '<p class="note">Hãy thêm thẻ trước.</p>') +
      '<p class="note">Sau khi bấm: chọn <b>Lưu vào Tệp</b> hoặc mở tệp, rồi bấm <b>Thêm tất cả</b> vào Lịch. Mỗi tháng, bấm lại một lần để thêm các hạn tiếp theo (sự kiện đã có sẽ không bị trùng).</p></div>' +
      (rows ? '<div class="card"><h3>Các hạn sắp tới</h3><dl class="kv">' + rows + '</dl></div>' : '');
  }
  async function exportIcs() {
    var ev = [];
    state.cards.forEach(function (c) {
      upcomingDues(c).forEach(function (e) {
        ev.push({ key: c.id, date: e.date, title: 'Trả thẻ ' + cardLabel(c) + (e.amount ? ': ' + nf(e.amount) + ' đ' : ''),
          desc: e.amount ? 'Số tiền cần trả: ' + nf(e.amount) + ' đ. Tối thiểu: ' + nf(infoOf(c).minRemaining) + ' đ.' : 'Hạn thanh toán thẻ ' + cardLabel(c) + '. Mở app để xem số tiền.' });
      });
    });
    if (!ev.length) { toast('Chưa có hạn trả nào.'); return; }
    var text = C.buildIcs(ev), name = 'han-tra-the.ics';
    try {
      var file = new File([text], name, { type: 'text/calendar' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Hạn trả thẻ tín dụng' }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar' })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast('Đã tạo tệp lịch.');
  }

  /* ---------- cài đặt, sao lưu ---------- */
  var confirmKey = null, confirmTimer;
  function askConfirm(k) {
    if (confirmKey === k) { confirmKey = null; clearTimeout(confirmTimer); return true; }
    confirmKey = k; clearTimeout(confirmTimer); confirmTimer = setTimeout(function () { confirmKey = null; renderSet(); }, 4000); renderSet(); return false;
  }

  /* ---------- tự lấy từ Gmail qua Apps Script ---------- */
  var CLOUD_URL = ''; // địa chỉ Worker sau khi triển khai, ví dụ https://the-tin-dung-mail.xxx.workers.dev
  var SKEY = 'the-tin-dung-sync-v1';
  var sync = (function () { try { return JSON.parse(localStorage.getItem(SKEY)) || {}; } catch (e) { return {}; } })();
  function saveSync() { try { localStorage.setItem(SKEY, JSON.stringify(sync)); } catch (e) {} }
  function bankCard(bank, last4) {
    var l4 = String(last4 || '');
    if (l4.length >= 3) {
      var byNum = state.cards.filter(function (c) { var n = String(c.last4 || ''); return n && (n.slice(-l4.length) === l4 || l4.slice(-n.length) === n); })[0];
      if (byNum) return byNum;
    }
    var b = String(bank).toLowerCase().replace(/\s+/g, '');
    var key = b === 'vietcombank' ? /vietcombank|vcb/ : b === 'vpbank' ? /vpbank|vpb/ : new RegExp(b);
    var list = state.cards.filter(function (c) { return key.test(String(c.name).toLowerCase().replace(/\s+/g, '')); });
    return list.filter(function (c) { return !c.last4; })[0] || (list.length === 1 ? list[0] : null);
  }
  var syncing = false;
  async function doSync(manual) {
    if (!sync.url || !sync.token || syncing) { if (manual) toast('Chưa nhập link và mã bí mật.'); return; }
    syncing = true; sync.msg = 'Đang cập nhật…'; if (manual) renderSet();
    try {
      var r = await fetch(sync.url + (sync.url.indexOf('?') < 0 ? '?' : '&') + 't=' + encodeURIComponent(sync.token), { cache: 'no-store' });
      var d = await r.json();
      if (d.error) throw new Error(d.error === 'unauthorized' ? 'Mã bí mật chưa đúng' : d.error);
      var added = 0, foreign = 0, nomatch = 0, stm = 0;
      (d.tx || []).forEach(function (t) {
        if (state.tx.some(function (x) { return x.srcId === t.id; })) return;
        if (t.amount == null) { foreign++; return; }
        var c = bankCard(t.bank, t.last4); if (!c) { nomatch++; return; }
        state.tx.push({ id: uid(), srcId: t.id, cardId: c.id, date: t.date, amount: t.amount, type: t.type === 'pay' ? 'pay' : 'spend', note: t.merchant || (t.bank + ' (Gmail)') });
        added++;
      });
      (d.stmts || []).forEach(function (st) {
        var c = bankCard(st.bank, st.last4); if (!c || !st.to || st.balance == null) return;
        if (!c.stmt || c.stmt.date < st.to) { c.stmt = { date: st.to, balance: st.balance, min: st.min, due: st.due }; stm++; }
      });
      sync.alerts = d.alerts || []; if (d.confirm) sync.confirm = d.confirm;
      sync.last = new Date().toISOString();
      sync.msg = 'Cập nhật xong: +' + added + ' giao dịch, ' + stm + ' sao kê' + (foreign ? ', ' + foreign + ' giao dịch ngoại tệ chưa có số VND (nhập tay)' : '') + (nomatch ? ', ' + nomatch + ' giao dịch chưa khớp thẻ nào (kiểm tra tên thẻ có chữ Vietcombank/VPBank và 4 số cuối)' : '') + '.';
      saveSync(); save(); renderAll();
    } catch (e) {
      sync.msg = 'Không lấy được dữ liệu: ' + (e.message || e) + '.'; saveSync(); renderSet();
    }
    syncing = false;
  }
  async function registerCloud() {
    try {
      var r = await fetch(CLOUD_URL + '/register', { method: 'POST' }); var d = await r.json();
      if (d.error) throw new Error(d.error);
      sync = { url: d.api, token: d.token, email: d.email, mode: 'cloud', msg: 'Đã tạo hộp thư. Làm tiếp bước chuyển tiếp bên dưới.' };
      saveSync(); renderSet();
    } catch (e) { toast('Không tạo được: ' + (e.message || e)); }
  }
  function cloudStatus() {
    var al = (sync.alerts || []).map(function (a) { return '<div class="hint err">⚠ ' + esc(a.bank) + ' ••' + esc(a.last4) + ' (' + fmtDate(a.date) + '): ' + esc(a.text) + '</div>'; }).join('');
    return '<div class="card"><h3>Cập nhật</h3>' + al + '<button type="button" class="btn block" data-act="syncnow">Cập nhật ngay</button><div class="hint" role="status">' + esc(sync.msg || '') + (sync.last ? ' Lần cuối: ' + new Date(sync.last).toLocaleString('vi-VN') : '') + '</div></div>';
  }
  function cloudCard() {
    if (!CLOUD_URL) return '';
    if (sync.mode !== 'cloud') return '<div class="card"><h3>Tự động đọc thư ngân hàng</h3><p class="note">App tạo cho bạn một địa chỉ thư riêng. Bạn bật chuyển tiếp thư ngân hàng từ Gmail tới đó một lần, sau đó app tự cập nhật giao dịch, sao kê và hạn trả. App không đọc Gmail của bạn, chỉ nhận thư bạn chuyển.</p><button type="button" class="btn block" data-act="cloudreg">Tạo địa chỉ thư của tôi</button></div>';
    var cf = sync.confirm && sync.confirm.code ? '<div class="hint">Mã xác nhận của Gmail: <b>' + esc(sync.confirm.code) + '</b>. Nhập mã này vào Gmail.</div>' : '';
    return '<div class="card"><h3>Bật chuyển tiếp trong Gmail</h3><p class="note">Địa chỉ của bạn: <b>' + esc(sync.email) + '</b></p>' + cf +
      '<ol class="note"><li>Trên máy tính, mở Gmail → Cài đặt (bánh răng) → Xem tất cả cài đặt → <b>Chuyển tiếp và POP/IMAP</b> → Thêm địa chỉ chuyển tiếp, dán địa chỉ trên.</li><li>Quay lại app, bấm Cập nhật để xem mã xác nhận, nhập mã vào Gmail.</li><li>Gmail → Bộ lọc và địa chỉ bị chặn → Tạo bộ lọc mới → ô <b>Từ</b> nhập tên miền ngân hàng (vietcombank.com.vn, vpb.com.vn) → Tạo bộ lọc → tích <b>Chuyển tiếp nó tới</b> địa chỉ của bạn.</li></ol></div>';
  }
  function syncCard() {
    if (sync.mode === 'cloud') return cloudCard() + cloudStatus();
    var al = (sync.alerts || []).map(function (a) { return '<div class="hint err">⚠ ' + esc(a.bank) + ' ••' + esc(a.last4) + ' (' + fmtDate(a.date) + '): ' + esc(a.text) + '</div>'; }).join('');
    return '<div class="card"><h3>Tự lấy từ Gmail</h3><p class="note">Dán link Apps Script (kết thúc bằng /exec) và mã bí mật. App tự cập nhật mỗi khi mở. Sacombank chưa hỗ trợ.</p>' + al +
      '<div class="field"><label for="syUrl">Link</label><input id="syUrl" type="url" autocomplete="off" spellcheck="false" value="' + esc(sync.url || '') + '"></div>' +
      '<div class="field"><label for="syTok">Mã bí mật</label><input id="syTok" type="password" autocomplete="off" spellcheck="false" value="' + esc(sync.token || '') + '"></div>' +
      '<button type="button" class="btn block" data-act="syncsave">Lưu và cập nhật ngay</button>' +
      '<div class="hint" role="status">' + esc(sync.msg || '') + (sync.last ? ' Lần cuối: ' + new Date(sync.last).toLocaleString('vi-VN') : '') + '</div></div>';
  }
  function renderSet() {
    $('#setBody').innerHTML = (sync.mode === 'cloud' ? '' : cloudCard()) + syncCard() + '<div class="card"><h3>Sao lưu và khôi phục</h3>' +
      '<p class="note">Dữ liệu chỉ nằm trên điện thoại này. Hãy sao lưu thường xuyên, và trước khi đổi máy hoặc xóa app.</p>' +
      '<button type="button" class="btn block" data-act="share">Lưu bản sao lưu</button>' +
      '<button type="button" class="btn ghost block" data-act="copy">Sao chép nội dung sao lưu</button>' +
      '<button type="button" class="btn ghost block" data-act="pickfile">Khôi phục từ tệp</button><input type="file" id="impFile" accept=".json,application/json,text/plain" hidden>' +
      '<div class="field"><label for="impText">Hoặc dán nội dung sao lưu</label><textarea id="impText" spellcheck="false"></textarea></div>' +
      '<button type="button" class="btn ghost block" data-act="importtext">Khôi phục từ nội dung đã dán</button><div class="hint" id="impHint" role="status"></div></div>' +
      '<div class="card"><h3>Dữ liệu</h3><button type="button" class="btn ' + (confirmKey === 'reset' ? 'danger' : 'ghost') + ' block" data-act="reset">' + (confirmKey === 'reset' ? 'Bấm lần nữa để xóa hết' : 'Xóa toàn bộ dữ liệu') + '</button></div>' +
      '<p class="note" style="text-align:center">Số tiền lãi và phí là ước tính. Số chính thức luôn theo sao kê của ngân hàng.</p>';
  }
  function backupText() { return JSON.stringify({ app: 'the-tin-dung', v: 1, exportedAt: new Date().toISOString(), cards: state.cards, tx: state.tx }, null, 1); }
  async function shareBackup() {
    var text = backupText(), name = 'the-tin-dung-sao-luu-' + today() + '.json';
    try { var f = new File([text], name, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('Đã tạo tệp sao lưu.');
  }
  async function copyBackup() {
    try { await navigator.clipboard.writeText(backupText()); toast('Đã sao chép nội dung sao lưu.'); }
    catch (e) { $('#impText').value = backupText(); $('#impText').select(); toast('Nội dung đã hiện trong ô bên dưới, hãy chọn và sao chép.'); }
  }
  var pendingImport = null;
  function tryImport(text) {
    var hint = $('#impHint'), d;
    try { d = JSON.parse(text); } catch (e) { hint.className = 'hint err'; hint.textContent = 'Nội dung không đọc được.'; return; }
    if (!d || !Array.isArray(d.cards) || !Array.isArray(d.tx)) { hint.className = 'hint err'; hint.textContent = 'Không phải tệp sao lưu của app Thẻ tín dụng.'; return; }
    if (state.cards.length && pendingImport !== text) { pendingImport = text; hint.className = 'hint err'; hint.textContent = 'Đang có ' + state.cards.length + ' thẻ. Bấm khôi phục lần nữa để thay bằng ' + d.cards.length + ' thẻ trong bản sao lưu.'; return; }
    state = { v: 1, cards: d.cards, tx: d.tx }; pendingImport = null; save(); renderAll(); toast('Đã khôi phục ' + d.cards.length + ' thẻ.');
  }

  /* ---------- hộp thoại ---------- */
  function head(t) { return '<div class="sheet-head"><h2>' + t + '</h2><button type="button" class="btn ghost small" data-close>Đóng</button></div>'; }
  function openCard(id) {
    var c = id ? cardById(id) : null;
    var v = c || { name: '', last4: '', limit: '', stmtDay: '', dueDay: '', apr: 30, minPct: 5, minFloor: 50000, lateFeePct: 4, lateFeeMin: 50000 };
    openDlg('<form class="sheet" id="cardForm" novalidate>' + head(c ? 'Sửa thẻ' : 'Thêm thẻ') +
      '<div class="grid2"><div class="field"><label for="fName">Tên thẻ</label><input id="fName" maxlength="30" placeholder="VD: Vietcombank Visa" value="' + esc(v.name) + '"></div>' +
      '<div class="field"><label for="fLast">4 số cuối</label><input id="fLast" inputmode="numeric" maxlength="4" placeholder="1234" value="' + esc(v.last4) + '"></div></div>' +
      '<div class="field"><label for="fLimit">Hạn mức</label><input id="fLimit" inputmode="decimal" placeholder="VD: 50tr hoặc 50.000.000" value="' + esc(inMoney(v.limit)) + '"></div>' +
      '<div class="grid2"><div class="field"><label for="fStmt">Ngày sao kê (1 đến 31)</label><input id="fStmt" inputmode="numeric" placeholder="5" value="' + esc(v.stmtDay) + '"></div>' +
      '<div class="field"><label for="fDue">Ngày đến hạn (1 đến 31)</label><input id="fDue" inputmode="numeric" placeholder="25" value="' + esc(v.dueDay) + '"></div></div>' +
      '<p class="note">Hai ngày này in trên sao kê của ngân hàng, mục "Ngày chốt sao kê" và "Ngày đến hạn thanh toán".</p>' +
      '<details><summary>Lãi và phí (nâng cao)</summary><p class="note">Tôi điền sẵn mức thường gặp. Hãy sửa theo biểu phí ngân hàng của bạn.</p>' +
      '<div class="field"><label for="fApr">Lãi suất (% mỗi năm)</label><input id="fApr" inputmode="decimal" value="' + esc(v.apr) + '"></div>' +
      '<div class="grid2"><div class="field"><label for="fMinP">Thanh toán tối thiểu (% dư nợ)</label><input id="fMinP" inputmode="decimal" value="' + esc(v.minPct) + '"></div>' +
      '<div class="field"><label for="fMinF">Tối thiểu thấp nhất (đ)</label><input id="fMinF" inputmode="decimal" value="' + esc(inMoney(v.minFloor)) + '"></div></div>' +
      '<div class="grid2"><div class="field"><label for="fLateP">Phí chậm trả (% phần thiếu)</label><input id="fLateP" inputmode="decimal" value="' + esc(v.lateFeePct) + '"></div>' +
      '<div class="field"><label for="fLateM">Phí chậm trả thấp nhất (đ)</label><input id="fLateM" inputmode="decimal" value="' + esc(inMoney(v.lateFeeMin)) + '"></div></div></details>' +
      '<div class="hint err" id="fErr" role="alert"></div><div class="row"><button type="submit" class="btn" style="flex:1">Lưu</button>' + (c ? '<button type="button" class="btn ghost" id="fDel">Xóa thẻ</button>' : '') + '</div></form>');
    var q = function (s) { return $(s, dlg); }, armed = false;
    if (c) q('#fDel').addEventListener('click', function (e) {
      if (!armed) { armed = true; e.target.textContent = 'Bấm lần nữa để xóa'; e.target.className = 'btn danger'; return; }
      state.cards = state.cards.filter(function (x) { return x.id !== c.id; }); state.tx = state.tx.filter(function (t) { return t.cardId !== c.id; });
      save(); renderAll(); dlg.close(); toast('Đã xóa thẻ và các giao dịch của thẻ.');
    });
    q('#cardForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = q('#fName').value.trim(), sd = parseInt(q('#fStmt').value, 10), dd = parseInt(q('#fDue').value, 10), err = q('#fErr');
      if (!name) { err.textContent = 'Nhập tên thẻ.'; return; }
      if (!(sd >= 1 && sd <= 31) || !(dd >= 1 && dd <= 31)) { err.textContent = 'Ngày sao kê và ngày đến hạn phải từ 1 đến 31.'; return; }
      var lim = q('#fLimit').value.trim() ? parseMoney(q('#fLimit').value) : 0;
      if (isNaN(lim) || lim < 0) { err.textContent = 'Hạn mức chưa đúng, ví dụ 50tr.'; return; }
      var apr = numOrNaN(q('#fApr').value), mp = numOrNaN(q('#fMinP').value), lp = numOrNaN(q('#fLateP').value);
      var mf = parseMoney(q('#fMinF').value || '0'), lm = parseMoney(q('#fLateM').value || '0');
      if ([apr, mp, lp, mf, lm].some(function (x) { return isNaN(x) || x < 0; })) { err.textContent = 'Kiểm tra lại mục Lãi và phí, chỉ nhập số.'; return; }
      var rec = { id: c ? c.id : uid(), name: name, last4: q('#fLast').value.replace(/\D/g, '').slice(0, 4), limit: lim, stmtDay: sd, dueDay: dd, apr: apr, minPct: mp, minFloor: mf, lateFeePct: lp, lateFeeMin: lm, stmt: c ? c.stmt || null : null };
      if (c) state.cards = state.cards.map(function (x) { return x.id === c.id ? rec : x; }); else state.cards.push(rec);
      save(); renderAll(); dlg.close(); toast(c ? 'Đã lưu thẻ.' : 'Đã thêm thẻ.');
    });
  }
  function openDetail(id) {
    var c = cardById(id); if (!c) return; var i = infoOf(c);
    var kv = function (k, v, cl) { return '<dt>' + k + '</dt><dd class="' + (cl || '') + '">' + v + '</dd>'; };
    openDlg('<div class="sheet">' + head(esc(cardLabel(c))) + '<div>' + chip(i) + ' <span class="note">số liệu ' + i.source + '</span></div>' +
      '<dl class="kv">' + kv('Ngày sao kê gần nhất', fmtDate(i.stmtDate)) + kv('Tổng dư nợ kỳ sao kê', vnd(i.balance)) +
      kv('Thanh toán tối thiểu', vnd(i.min)) + kv('Hạn thanh toán', fmtDate(i.due)) + kv('Đã trả từ sau sao kê', vnd(i.paidAfter)) +
      kv('Còn phải trả', vnd(i.remaining), i.remaining ? 'bad' : 'good') + kv('Tối thiểu còn thiếu', vnd(i.minRemaining)) +
      kv('Chi tiêu kỳ mới (chưa chốt)', vnd(i.newSpend)) + kv('Ngày sao kê tiếp theo', fmtDate(i.nextStmt)) +
      (i.available != null ? kv('Hạn mức còn lại', vnd(i.available)) : '') + '</dl>' +
      (i.status === 'overdue' ? '<div class="verdict bad">Đã quá hạn ' + i.overdueDays + ' ngày<span class="s">Phí chậm trả ước tính ' + vnd(i.lateFee) + ', lãi ước tính tới hôm nay ' + vnd(i.interest) + '. Trả sớm để lãi không tăng thêm.</span></div>' : '') +
      (i.status === 'due' && i.remaining > 0 ? '<div class="verdict">Nếu chỉ trả mức tối thiểu<span class="s">Phần còn lại sẽ bị tính lãi, ước tính khoảng ' + vnd(i.interestIfMin) + ' đến hạn kỳ sau (' + c.apr + '%/năm). Trả đủ ' + vnd(i.remaining) + ' trước hạn để không mất lãi.</span></div>' : '') +
      '<button type="button" class="btn block" data-act="paynow" data-id="' + esc(c.id) + '">Ghi một khoản đã trả</button>' +
      '<button type="button" class="btn ghost block" data-act="stmt" data-id="' + esc(c.id) + '">Nhập số liệu từ sao kê</button>' +
      '<div class="grid2"><button type="button" class="btn ghost" data-act="addtx" data-id="' + esc(c.id) + '">Thêm chi tiêu</button><button type="button" class="btn ghost" data-act="editcard" data-id="' + esc(c.id) + '">Sửa thẻ</button></div></div>');
  }
  function openStmt(id) {
    var c = cardById(id), i = infoOf(c), s = c.stmt || {};
    openDlg('<form class="sheet" id="stForm" novalidate>' + head('Số liệu từ sao kê') +
      '<p class="note">Nhập đúng số in trên sao kê mới nhất. Số này chính xác hơn số app tự tính.</p>' +
      '<div class="field"><label for="sDate">Ngày chốt sao kê</label><input id="sDate" type="date" value="' + esc(s.date || i.stmtDate) + '"></div>' +
      '<div class="field"><label for="sBal">Tổng dư nợ cần thanh toán</label><input id="sBal" inputmode="decimal" placeholder="VD: 12.500.000" value="' + esc(inMoney(s.balance || i.balance)) + '"></div>' +
      '<div class="field"><label for="sMin">Số tiền thanh toán tối thiểu</label><input id="sMin" inputmode="decimal" placeholder="VD: 625.000" value="' + esc(inMoney(s.min)) + '"></div>' +
      '<div class="field"><label for="sDue">Hạn thanh toán</label><input id="sDue" type="date" value="' + esc(s.due || i.due) + '"></div>' +
      '<div class="hint err" id="sErr" role="alert"></div><div class="row"><button type="submit" class="btn" style="flex:1">Lưu</button>' + (c.stmt ? '<button type="button" class="btn ghost" id="sClr">Bỏ số liệu sao kê</button>' : '') + '</div></form>');
    var q = function (x) { return $(x, dlg); };
    if (c.stmt) q('#sClr').addEventListener('click', function () { c.stmt = null; save(); renderAll(); dlg.close(); toast('Đã bỏ, app tính lại từ giao dịch.'); });
    q('#stForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var bal = parseMoney(q('#sBal').value), minRaw = q('#sMin').value.trim(), min = minRaw ? parseMoney(minRaw) : null;
      if (!q('#sDate').value || !q('#sDue').value) { q('#sErr').textContent = 'Chọn ngày sao kê và hạn thanh toán.'; return; }
      if (isNaN(bal) || bal < 0) { q('#sErr').textContent = 'Nhập tổng dư nợ, ví dụ 12.500.000.'; return; }
      if (minRaw && (isNaN(min) || min < 0)) { q('#sErr').textContent = 'Số tiền tối thiểu chưa đúng.'; return; }
      c.stmt = { date: q('#sDate').value, balance: bal, min: min, due: q('#sDue').value };
      save(); renderAll(); dlg.close(); toast('Đã lưu số liệu sao kê.');
    });
  }
  function openTx(tid, pre) {
    if (!state.cards.length) { toast('Hãy thêm thẻ trước.'); return; }
    var t = tid ? state.tx.filter(function (x) { return x.id === tid; })[0] : null;
    var v = t || Object.assign({ cardId: state.cards[0].id, date: today(), amount: '', type: 'spend', note: '' }, pre || {});
    openDlg('<form class="sheet" id="txForm" novalidate>' + head(t ? 'Sửa giao dịch' : 'Thêm giao dịch') +
      '<div class="field"><label for="tCard">Thẻ</label><select id="tCard">' + state.cards.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(cardLabel(c)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="seg" id="tType"><button type="button" data-type="spend" aria-pressed="' + (v.type !== 'pay') + '">Chi tiêu</button><button type="button" data-type="pay" aria-pressed="' + (v.type === 'pay') + '">Đã trả tiền thẻ</button></div>' +
      '<div class="grid2"><div class="field"><label for="tDate">Ngày</label><input id="tDate" type="date" value="' + esc(v.date) + '"></div>' +
      '<div class="field"><label for="tAmt">Số tiền</label><input id="tAmt" inputmode="decimal" placeholder="1.250.000" value="' + esc(inMoney(v.amount)) + '"></div></div>' +
      '<div class="field"><label for="tNote">Nội dung</label><input id="tNote" maxlength="60" placeholder="VD: Siêu thị" value="' + esc(v.note) + '"></div>' +
      '<div class="hint err" id="tErr" role="alert"></div><div class="row"><button type="submit" class="btn" style="flex:1">Lưu</button>' + (t ? '<button type="button" class="btn ghost" id="tDel">Xóa</button>' : '') + '</div></form>');
    var q = function (x) { return $(x, dlg); }, type = v.type === 'pay' ? 'pay' : 'spend', armed = false;
    q('#tCard').value = v.cardId;
    $$('#tType button', dlg).forEach(function (b) { b.addEventListener('click', function () { type = b.getAttribute('data-type'); $$('#tType button', dlg).forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); }); });
    if (t) q('#tDel').addEventListener('click', function (e) {
      if (!armed) { armed = true; e.target.textContent = 'Bấm lần nữa để xóa'; e.target.className = 'btn danger'; return; }
      state.tx = state.tx.filter(function (x) { return x.id !== t.id; }); save(); renderAll(); dlg.close(); toast('Đã xóa giao dịch.');
    });
    q('#txForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var amt = parseMoney(q('#tAmt').value);
      if (!q('#tDate').value) { q('#tErr').textContent = 'Chọn ngày.'; return; }
      if (!(amt > 0)) { q('#tErr').textContent = 'Nhập số tiền lớn hơn 0, ví dụ 1.250.000.'; return; }
      var rec = { id: t ? t.id : uid(), cardId: q('#tCard').value, date: q('#tDate').value, amount: amt, type: type, note: q('#tNote').value.trim() };
      if (t) state.tx = state.tx.map(function (x) { return x.id === t.id ? rec : x; }); else state.tx.push(rec);
      save(); renderAll(); dlg.close(); toast('Đã lưu giao dịch.');
    });
  }
  function parseSmsFlow() {
    var text = $('#smsText').value;
    if (!text.trim()) { toast('Hãy dán tin nhắn vào ô trên.'); return; }
    var p = C.parseSms(text);
    if (!state.cards.length) { toast('Hãy thêm thẻ trước.'); return; }
    var card = p.last4 ? state.cards.filter(function (c) { return c.last4 === p.last4; })[0] : null;
    openTx(null, { cardId: card ? card.id : state.cards[0].id, date: p.date || today(), amount: p.amount || '', type: p.type, note: p.note });
    if (!p.amount) toast('Chưa tách được số tiền, bạn nhập giúp nhé.');
    $('#smsText').value = '';
  }

  /* ---------- điều khiển ---------- */
  var TITLES = { home: 'Tổng quan', cards: 'Các thẻ', tx: 'Chi tiêu', rem: 'Nhắc nhở', set: 'Cài đặt' };
  function showTab(n) {
    Object.keys(TITLES).forEach(function (k) { $('#tab-' + k).hidden = k !== n; });
    $$('.tabbar button').forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tab') === n); });
    $('#screenTitle').textContent = TITLES[n]; window.scrollTo(0, 0);
  }
  $$('.tabbar button').forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });
  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-card]'); if (card) { openDetail(card.getAttribute('data-card')); return; }
    var tx = e.target.closest('[data-tx]'); if (tx) { openTx(tx.getAttribute('data-tx')); return; }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'addcard') openCard(null);
    else if (act === 'editcard') openCard(id);
    else if (act === 'goset') showTab('set');
    else if (act === 'addtx') openTx(null, id ? { cardId: id } : null);
    else if (act === 'paynow') openTx(null, { cardId: id, type: 'pay', amount: infoOf(cardById(id)).remaining || '' });
    else if (act === 'stmt') openStmt(id);
    else if (act === 'parsesms') parseSmsFlow();
    else if (act === 'ics') exportIcs();
    else if (act === 'cloudreg') registerCloud();
    else if (act === 'syncnow') doSync(true);
    else if (act === 'syncsave') { sync.url = $('#syUrl').value.trim(); sync.token = $('#syTok').value.trim(); saveSync(); doSync(true); }
    else if (act === 'share') shareBackup();
    else if (act === 'copy') copyBackup();
    else if (act === 'pickfile') $('#impFile').click();
    else if (act === 'importtext') tryImport($('#impText').value);
    else if (act === 'reset') { if (askConfirm('reset')) { state = { v: 1, cards: [], tx: [] }; save(); renderAll(); toast('Đã xóa toàn bộ dữ liệu.'); } }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'txCard') renderTx();
    else if (e.target.id === 'impFile' && e.target.files && e.target.files[0]) { var r = new FileReader(); r.onload = function () { tryImport(String(r.result || '')); }; r.readAsText(e.target.files[0]); }
  });
  function renderAll() { renderHome(); renderCards(); renderTx(); renderRem(); renderSet(); $('#todayStat').textContent = 'Hôm nay ' + fmtDate(today()); }
  renderAll();
  function autoSync() { if (sync.url && (!sync.last || Date.now() - Date.parse(sync.last) > 600000)) doSync(false); }
  autoSync();
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { renderAll(); autoSync(); } });
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
})();
