const assert = require('assert'); const C = require('../cards.js');
assert.strictEqual(C.lastStatement(5, '2026-11-12'), '2026-11-05');
assert.strictEqual(C.lastStatement(20, '2026-11-12'), '2026-10-20');
assert.strictEqual(C.lastStatement(31, '2026-03-10'), '2026-02-28');
assert.strictEqual(C.nextStatement(5, '2026-11-12'), '2026-12-05');
assert.strictEqual(C.dueAfter('2026-11-05', 25), '2026-11-25');
assert.strictEqual(C.dueAfter('2026-11-20', 5), '2026-12-05');
const card = { stmtDay: 5, dueDay: 25, limit: 50e6, apr: 30, minPct: 5, minFloor: 50000, lateFeePct: 4, lateFeeMin: 50000, stmt: null };
const tx = [
  { date: '2026-10-10', amount: 10e6, type: 'spend' }, { date: '2026-11-01', amount: 2e6, type: 'spend' },
  { date: '2026-11-08', amount: 3e6, type: 'spend' }];
let i = C.cardInfo(card, tx, '2026-11-12');
assert.strictEqual(i.stmtDate, '2026-11-05'); assert.strictEqual(i.balance, 12e6); assert.strictEqual(i.min, 600000);
assert.strictEqual(i.newSpend, 3e6); assert.strictEqual(i.due, '2026-11-25'); assert.strictEqual(i.daysLeft, 13); assert.strictEqual(i.status, 'due');
// trả một phần
i = C.cardInfo(card, tx.concat([{ date: '2026-11-10', amount: 700000, type: 'pay' }]), '2026-11-12');
assert.strictEqual(i.remaining, 12e6 - 700000); assert.strictEqual(i.minRemaining, 0);
// trả đủ
i = C.cardInfo(card, tx.concat([{ date: '2026-11-10', amount: 12e6, type: 'pay' }]), '2026-11-12'); assert.strictEqual(i.status, 'paid');
// quá hạn, chưa trả
i = C.cardInfo(card, tx, '2026-11-30'); assert.strictEqual(i.status, 'overdue'); assert.strictEqual(i.overdueDays, 5);
assert.strictEqual(i.lateFee, 50000 > 24000 ? 50000 : 24000); assert.ok(i.interest > 0);
// dùng số liệu sao kê thật
const c2 = Object.assign({}, card, { stmt: { date: '2026-11-05', balance: 13e6, min: 650000, due: '2026-11-27' } });
i = C.cardInfo(c2, tx, '2026-11-12'); assert.strictEqual(i.balance, 13e6); assert.strictEqual(i.due, '2026-11-27'); assert.strictEqual(i.min, 650000);
// tách tin nhắn
let p = C.parseSms('VCB: The tin dung **1234 phat sinh giao dich 1.250.000 VND tai SHOPEE luc 11/11/2026.');
assert.strictEqual(p.amount, 1250000); assert.strictEqual(p.date, '2026-11-11'); assert.strictEqual(p.last4, '1234'); assert.strictEqual(p.note, 'SHOPEE');
p = C.parseSms('TCB thong bao: Thanh toan the so 5678 thanh cong 5,000,000 VND ngay 20-11-2026'); assert.strictEqual(p.type, 'pay'); assert.strictEqual(p.amount, 5000000);
const ics = C.buildIcs([{ key: 'a', date: '2026-11-25', title: 'Hạn trả thẻ A', desc: 'x' }]);
assert.ok(ics.includes('DTSTART;VALUE=DATE:20261125') && ics.includes('TRIGGER:-P4DT15H'));
console.log('Đạt');
