import assert from 'node:assert/strict';
import { parseEmail } from '../parsers.js';

let r = parseEmail({ from: 'info@info.vietcombank.com.vn', subject: 'Thông báo giao dịch thẻ/ Vietcombank card transaction notification', date: '2026-10-26',
  text: 'Card JCB 356771...7962\nAt SOME SHOP\nTransaction Amount 22.22 USD\nTrans. Date, Time 26-10-2026 16:39:06\nCredit Balance 19,246,298VND\nStatus of Transaction Thành công' });
assert.equal(r.last4, '7962'); assert.equal(r.amount, null); assert.equal(r.foreign.cur, 'USD'); assert.equal(r.date, '2026-10-26'); assert.equal(r.available, 19246298);

r = parseEmail({ from: 'x@info.vietcombank.com.vn', subject: 'Thông báo nhắc nợ lần 1', date: '2026-10-27', text: 'dư nợ thẻ tín dụng số *962 … là 179,275 VND … thanh toán tối thiểu' });
assert.equal(r.kind, 'alert'); assert.equal(r.amount, 179275);

r = parseEmail({ from: 'customercare@care.vpb.com.vn', subject: 'VPBank xin thong bao bien dong so du The tin dung', date: '2026-11-07',
  html: '<td>- 17,010 VND</td><td>38,173,780 VND</td><br>BHBA11 20263107123155822<br>MasterCard *7561<br>07/11/2026 00:31:57' });
assert.equal(r.amount, 17010); assert.equal(r.type, 'spend'); assert.equal(r.last4, '7561'); assert.equal(r.date, '2026-11-07');

r = parseEmail({ from: 'customercare@care.vpb.com.vn', subject: 'Sao kê thẻ tín dụng - MC StepUp Credit', date: '2026-10-22',
  text: 'Từ 21/09/2026 đến 20/10/2026\nMinimum Amount Due VND -1,081,077.00\n17H 04/11/2026\nVND -3,809,210.00\nSố dư cuối kỳ / Outstanding Balance:' });
assert.equal(r.to, '2026-10-20'); assert.equal(r.due, '2026-11-04'); assert.equal(r.min, 1081077); assert.equal(r.balance, 3809210);

assert.equal(parseEmail({ from: 'a@random.com', subject: 'x', text: 'y' }), null);
console.log('Đạt');
