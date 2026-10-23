/* game.js — กติกาเกมจับสลากของขวัญ (pure logic, ไม่มี DOM) ใช้ได้ทั้งในเบราว์เซอร์และ Node */
(function (root) {
  'use strict';
  var SEGMENTS = [
    null,
    { n: 1, label: 'หยิบ 1 ชิ้น', desc: 'หยิบจากกอง 1 ชิ้น' },
    { n: 2, label: 'หยิบ 2 ชิ้น', desc: 'หยิบจากกอง 2 ชิ้นเก็บเอง' },
    { n: 3, label: 'ภารกิจ', desc: 'คนฝั่งตรงข้ามสั่งภารกิจ (คิด 10 วินาที)' },
    { n: 4, label: 'ยัดเยียด', desc: 'หยิบ 2 ชิ้น เก็บ 1 ยัดให้เพื่อน 1' },
    { n: 5, label: 'สลับมั่ว', desc: 'สั่งเพื่อน 2 คนสลับของห่อกัน แล้วหยิบ 1 ชิ้น' },
    { n: 6, label: 'โรบินฮู้ด', desc: 'ปล้นของที่ยังห่อจากใครก็ได้ 1 ชิ้น' },
    { n: 7, label: 'หมุนอีกรอบ', desc: 'หมุนอีกรอบ (ครั้งเดียวต่อตา)' },
    { n: 8, label: 'หยิบ+แกะ', desc: 'หยิบจากกอง 1 ชิ้น แล้วต้องแกะ 1 ชิ้น' }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function newGame(names, gifts) {
    var n = names.length;
    var s = {
      n: n, names: names.slice(), gifts: gifts, pile: gifts,
      wr: [], op: [], done: [], cur: 0, turn: 1, spunAgain: false,
      phase: 'spin', seg: null, pending: null, outOrder: [], log: [], events: []
    };
    for (var i = 0; i < n; i++) { s.wr.push(0); s.op.push(0); s.done.push(false); }
    log(s, '🎲 เริ่มเกม! ผู้เล่น ' + n + ' คน ของขวัญ ' + gifts + ' ชิ้น');
    log(s, '— ตาที่ 1: ' + names[0] + ' —');
    return s;
  }

  function hand(s, i) { return s.wr[i] + s.op[i]; }
  function active(s) { var a = []; for (var i = 0; i < s.n; i++) if (!s.done[i]) a.push(i); return a; }
  function log(s, t) { s.log.push(t); }
  function ev(s, e) { s.events.push(e); }
  function nm(s, i) { return s.names[i]; }

  // คนฝั่งตรงข้าม: นับเฉพาะคนที่ยังเล่นอยู่ เลื่อนไปครึ่งวง
  function opposite(s, i) {
    var a = active(s), k = a.length;
    if (k < 2) return i;
    var p = a.indexOf(i);
    return a[(p + Math.floor(k / 2)) % k];
  }

  // ออกจากเกมเมื่อแกะครบ 2: ของห่อที่เหลือแจกทีละชิ้นให้คนที่มีของในมือน้อยที่สุด
  function finish(s, i) {
    if (s.op[i] >= 2 && !s.done[i]) {
      s.done[i] = true; s.outOrder.push(i);
      var e = s.wr[i]; s.wr[i] = 0;
      log(s, '🚪 ' + nm(s, i) + ' แกะครบ 2 ชิ้น ออกจากเกม!' + (e ? ' (มีของห่อเหลือ ' + e + ' ชิ้น แจกต่อ)' : ''));
      ev(s, 'out');
      for (var x = 0; x < e; x++) {
        var a = active(s);
        if (!a.length) { s.leftover = (s.leftover || 0) + 1; log(s, '🎁 ของเหลือ 1 ชิ้น (ไม่มีผู้เล่นเหลือ)'); continue; }
        var c = a.filter(function (j) { return hand(s, j) < 2; });
        if (!c.length) c = a;
        var best = c[0];
        c.forEach(function (j) { if (hand(s, j) < hand(s, best)) best = j; });
        s.wr[best]++;
        log(s, '   ↪ แจกให้ ' + nm(s, best));
      }
    }
  }

  // หยิบจากกอง k ชิ้น; ถ้ากองหมด ขอของห่อจากคนที่มีของห่อมากที่สุด (เฉพาะเมื่อตัวเองมีของในมือ < 2)
  function take(s, i, k) {
    for (var x = 0; x < k; x++) {
      if (s.pile > 0) { s.pile--; s.wr[i]++; log(s, '🎁 ' + nm(s, i) + ' หยิบจากกอง 1 ชิ้น (กองเหลือ ' + s.pile + ')'); ev(s, 'gift'); }
      else if (hand(s, i) < 2) {
        var d = active(s).filter(function (j) { return j !== i && hand(s, j) > 2 && s.wr[j] > 0; });
        if (d.length) {
          var j = d[0]; d.forEach(function (q) { if (s.wr[q] > s.wr[j]) j = q; });
          s.wr[j]--; s.wr[i]++;
          log(s, '🤲 กองหมดแล้ว — ' + nm(s, i) + ' ขอของห่อจาก ' + nm(s, j) + ' (คนที่มีของห่อมากสุด) 1 ชิ้น'); ev(s, 'gift');
        } else log(s, '😅 กองหมดแล้ว และไม่มีใครมีของเกินให้ขอ — ข้าม');
      } else log(s, 'ℹ️ กองหมดแล้ว ' + nm(s, i) + ' มีของในมือ ' + hand(s, i) + ' ชิ้นอยู่แล้ว ไม่ต้องขอเพิ่ม');
    }
  }

  function canUnwrap(s, i) { return hand(s, i) > 1 && s.wr[i] > 0; }

  function unwrap(s, i) {
    s.wr[i]--; s.op[i]++;
    log(s, '✨ ' + nm(s, i) + ' แกะของ! (แกะแล้ว ' + s.op[i] + '/2)'); ev(s, 'unwrap');
    finish(s, i);
  }

  // หลังทำตามช่องเสร็จ: เสนอให้แกะ 1 ชิ้น (forced = ช่อง 8 บังคับแกะ)
  function post(s, forced) {
    var i = s.cur;
    if (canUnwrap(s, i)) {
      if (forced) { log(s, '📌 ช่อง 8 บังคับแกะ'); unwrap(s, i); return endTurn(s); }
      s.phase = 'unwrap'; s.pending = null; return;
    }
    log(s, 'ℹ️ ' + nm(s, i) + ' มีของในมือ ' + hand(s, i) + ' ชิ้น — ยังแกะไม่ได้');
    endTurn(s);
  }

  function endTurn(s) {
    s.pending = null; s.seg = null; s.spunAgain = false;
    var a = active(s);
    if (!a.length) { s.phase = 'end'; log(s, '🏆 จบเกม! ทุกคนได้ของครบ 2 ชิ้น (เล่นไป ' + s.turn + ' ตา)'); ev(s, 'end'); return; }
    var j = s.cur;
    for (var x = 0; x < s.n; x++) { j = (j + 1) % s.n; if (!s.done[j]) break; }
    s.cur = j; s.turn++; s.phase = 'spin';
    log(s, '— ตาที่ ' + s.turn + ': ' + nm(s, j) + ' —');
  }

  function others(s, i, needWrapped) {
    return active(s).filter(function (j) { return j !== i && (!needWrapped || s.wr[j] > 0); });
  }

  function resolve(s, seg) {
    var i = s.cur;
    s.seg = seg;
    log(s, '🎡 ' + nm(s, i) + ' หมุนได้ช่อง ' + seg + ': ' + SEGMENTS[seg].desc);
    switch (seg) {
      case 1: take(s, i, 1); return post(s, false);
      case 8: take(s, i, 1); return post(s, true);
      case 2: take(s, i, s.pile > 0 ? 2 : 1); return post(s, false);
      case 3:
        s.phase = 'mission'; s.pending = { orderer: opposite(s, i) };
        log(s, '🎯 ' + nm(s, s.pending.orderer) + ' (ฝั่งตรงข้าม) มีเวลาคิดภารกิจ 10 วินาที'); return;
      case 4:
        if (s.pile >= 2) {
          s.pile -= 2; s.wr[i]++; ev(s, 'gift');
          log(s, '🎁 ' + nm(s, i) + ' หยิบจากกอง 2 ชิ้น เก็บไว้ 1 (กองเหลือ ' + s.pile + ')');
          var t = others(s, i, false);
          if (!t.length) { s.wr[i]++; log(s, 'ไม่มีคนให้ยัด เก็บเองทั้ง 2 ชิ้น'); return post(s, false); }
          s.carry = 1; s.phase = 'give'; s.pending = { targets: t }; return;
        }
        log(s, 'ℹ️ กองเหลือไม่ถึง 2 ชิ้น — เปลี่ยนเป็นหยิบ 1 ชิ้น');
        take(s, i, 1); return post(s, false);
      case 5:
        var sw = others(s, i, true);
        if (sw.length >= 2) { s.phase = 'swap'; s.pending = { targets: sw }; return; }
        log(s, 'ℹ️ มีคนที่มีของห่อไม่ถึง 2 คน — ข้ามการสลับ');
        take(s, i, 1); return post(s, false);
      case 6:
        var st = others(s, i, true);
        if (st.length) { s.phase = 'steal'; s.pending = { targets: st }; return; }
        log(s, 'ℹ️ ไม่มีใครมีของห่อให้ปล้น — เปลี่ยนเป็นหยิบ 1 ชิ้น');
        take(s, i, 1); return post(s, false);
      case 7:
        if (!s.spunAgain) { s.spunAgain = true; s.phase = 'spin'; s.seg = null; log(s, '🔄 ได้หมุนอีกรอบ!'); return; }
        log(s, '🔄 ได้ช่อง 7 ซ้ำ — นับเป็นช่อง 1');
        return resolve(s, 1);
    }
  }

  // validActions: บอก UI ว่าตอนนี้ทำอะไรได้บ้าง
  function act(state, a) {
    var s = clone(state); s.events = [];
    var i = s.cur;
    switch (s.phase) {
      case 'spin':
        if (a.type !== 'spin') throw new Error('expected spin');
        var seg = a.seg;
        if (seg === 7 && s.spunAgain) { log(s, '🎡 ' + nm(s, i) + ' หมุนได้ช่อง 7 ซ้ำ — นับเป็นช่อง 1'); seg = 1; s.seg = 1; take(s, i, 1); post(s, false); break; }
        resolve(s, seg); break;
      case 'mission':
        if (a.type === 'done') { log(s, '✅ ' + nm(s, i) + ' ทำภารกิจสำเร็จ!'); take(s, i, 1); post(s, false); }
        else if (a.type === 'timeout') { log(s, '⏰ คนสั่งคิดไม่ทัน / วงไม่โอเค — ' + nm(s, i) + ' หยิบเลย'); take(s, i, 1); post(s, false); }
        else if (a.type === 'refuse') { log(s, '🙅 ' + nm(s, i) + ' ไม่ทำภารกิจ — ข้ามไปคนถัดไป'); endTurn(s); }
        else throw new Error('bad mission action');
        break;
      case 'give':
        if (a.type !== 'target' || s.pending.targets.indexOf(a.j) < 0) throw new Error('bad target');
        s.wr[a.j]++; s.carry = 0; log(s, '😈 ' + nm(s, i) + ' ยัดเยียดของ 1 ชิ้นให้ ' + nm(s, a.j)); ev(s, 'prank');
        post(s, false); break;
      case 'steal':
        if (a.type !== 'target' || s.pending.targets.indexOf(a.j) < 0) throw new Error('bad target');
        s.wr[a.j]--; s.wr[i]++; log(s, '🏹 ' + nm(s, i) + ' ปล้นของห่อจาก ' + nm(s, a.j) + ' 1 ชิ้น!'); ev(s, 'prank');
        post(s, false); break;
      case 'swap':
        if (a.type !== 'swap' || a.a === a.b || s.pending.targets.indexOf(a.a) < 0 || s.pending.targets.indexOf(a.b) < 0) throw new Error('bad swap');
        log(s, '🔀 ' + nm(s, a.a) + ' กับ ' + nm(s, a.b) + ' สลับของห่อกันคนละ 1 ชิ้น'); ev(s, 'prank');
        take(s, i, 1); post(s, false); break;
      case 'unwrap':
        if (a.type === 'unwrap') unwrap(s, i);
        else if (a.type === 'skip') log(s, '🤐 ' + nm(s, i) + ' เลือกไม่แกะ');
        else throw new Error('bad unwrap action');
        endTurn(s); break;
      default: throw new Error('game over');
    }
    return s;
  }

  var api = { SEGMENTS: SEGMENTS, newGame: newGame, act: act, hand: hand, active: active, opposite: opposite, canUnwrap: canUnwrap };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GiftGame = api;
})(this);
