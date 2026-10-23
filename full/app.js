/* app.js — หน้าจอ วงล้อ เสียง และการบันทึกสถานะ */
(function () {
  'use strict';
  var GG = window.GiftGame;
  var KEY = 'giftWheelGame.v1', SKEY = 'giftWheelGame.setup.v1';
  var $ = function (id) { return document.getElementById(id); };
  var state = null, hist = [], muted = false, spinning = false, swapSel = [];
  var COLORS = ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff5fa2', '#00b4a6'];
  var LABELS = ['1 หยิบ 1 ชิ้น', '2 หยิบ 2 ชิ้น', '3 ภารกิจ', '4 ยัดเยียด', '5 สลับมั่ว', '6 โรบินฮู้ด', '7 หมุนอีกรอบ', '8 หยิบ+แกะ'];
  var ICONS = ['🎁', '🎁🎁', '🎯', '😈', '🔀', '🏹', '🔄', '✨'];

  /* ---------------- เสียง (Web Audio ไม่ต้องใช้ไฟล์) ---------------- */
  var AC = null;
  function ac() { if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, t0, dur, type, vol, f2) {
    var c = ac(); if (!c || muted) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (t0 || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t0, dur, vol, hp) {
    var c = ac(); if (!c || muted) return;
    var len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + (t0 || 0);
    s.buffer = b; f.type = 'highpass'; f.frequency.value = hp || 1500; g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  }
  var SFX = {
    tick: function () { tone(1400, 0, 0.03, 'square', 0.08); },
    spin: function () { noise(0, 0.5, 0.15, 600); tone(200, 0, 0.5, 'sawtooth', 0.08, 800); },
    land: function () { tone(880, 0, 0.15, 'triangle', 0.25); tone(1320, 0.08, 0.25, 'triangle', 0.2); },
    gift: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.07, 0.18, 'triangle', 0.22); }); },
    unwrap: function () { noise(0, 0.35, 0.35, 2500); [1568, 2093, 2637, 3136].forEach(function (f, i) { tone(f, 0.25 + i * 0.06, 0.3, 'sine', 0.15); }); },
    prank: function () { tone(500, 0, 0.25, 'sawtooth', 0.15, 350); tone(420, 0.28, 0.25, 'sawtooth', 0.15, 290); tone(350, 0.56, 0.5, 'sawtooth', 0.15, 180); },
    out: function () { tone(784, 0, 0.2, 'sine', 0.25); tone(587, 0.2, 0.2, 'sine', 0.25); tone(392, 0.4, 0.5, 'sine', 0.25); tone(1568, 0.4, 0.6, 'triangle', 0.08); },
    end: function () {
      var n = [[523, 0, .15], [523, .16, .15], [523, .32, .15], [659, .48, .45], [587, .95, .15], [659, 1.1, .15], [784, 1.25, .8], [1047, 1.25, .8]];
      n.forEach(function (x) { tone(x[0], x[1], x[2], 'square', 0.12); tone(x[0] / 2, x[1], x[2], 'triangle', 0.15); });
    },
    count: function (low) { tone(low ? 1000 : 700, 0, 0.08, 'square', 0.15); },
    buzzer: function () { tone(140, 0, 0.9, 'sawtooth', 0.3); tone(147, 0, 0.9, 'square', 0.15); }
  };
  function playEvents(evs) {
    var order = ['gift', 'prank', 'unwrap', 'out', 'end'], delay = 0, seen = {};
    order.forEach(function (e) { if (evs.indexOf(e) >= 0 && !seen[e]) { seen[e] = 1; setTimeout(SFX[e], delay); delay += e === 'unwrap' ? 600 : 450; } });
  }

  /* ---------------- วงล้อ ---------------- */
  var wheel = $('wheel'), wctx = wheel.getContext('2d'), angle = 0; // angle เป็นเรเดียน หมุนตามเข็ม
  function drawWheel() {
    var W = wheel.width, R = W / 2 - 8, cx = W / 2, cy = W / 2, seg = Math.PI * 2 / 8;
    wctx.clearRect(0, 0, W, W);
    wctx.save(); wctx.translate(cx, cy); wctx.rotate(angle);
    for (var k = 0; k < 8; k++) {
      var a0 = -Math.PI / 2 + k * seg;
      wctx.beginPath(); wctx.moveTo(0, 0); wctx.arc(0, 0, R, a0, a0 + seg); wctx.closePath();
      wctx.fillStyle = COLORS[k]; wctx.fill(); wctx.lineWidth = 6; wctx.strokeStyle = '#fff'; wctx.stroke();
      wctx.save(); wctx.rotate(a0 + seg / 2);
      wctx.textAlign = 'right'; wctx.textBaseline = 'middle'; wctx.fillStyle = '#fff';
      wctx.shadowColor = 'rgba(0,0,0,.6)'; wctx.shadowBlur = 6;
      var parts = LABELS[k].split(' '), num = parts.shift(), lab = parts.join(' '), fs = 40;
      wctx.font = 'bold ' + fs + 'px "Sukhumvit Set","Thonburi","Leelawadee UI","Noto Sans Thai",sans-serif';
      while (wctx.measureText(lab).width > R - 180 && fs > 20) { fs -= 2; wctx.font = 'bold ' + fs + 'px "Sukhumvit Set","Thonburi","Leelawadee UI","Noto Sans Thai",sans-serif'; }
      wctx.fillText(lab, R - 28, 0);
      wctx.font = 'bold 54px sans-serif'; wctx.fillStyle = 'rgba(255,255,255,.95)';
      wctx.textAlign = 'center'; wctx.fillText(num, 122, 0);
      wctx.restore();
    }
    wctx.beginPath(); wctx.arc(0, 0, R, 0, Math.PI * 2); wctx.lineWidth = 14; wctx.strokeStyle = '#ffd23f'; wctx.stroke();
    for (var d = 0; d < 32; d++) { var aa = d * Math.PI / 16; wctx.beginPath(); wctx.arc(Math.cos(aa) * (R - 1), Math.sin(aa) * (R - 1), 6, 0, 7); wctx.fillStyle = d % 2 ? '#fff' : '#ff5fa2'; wctx.fill(); }
    wctx.restore();
  }
  function segAt(a) { var s = Math.PI * 2 / 8, x = ((-a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return Math.floor(x / s); }
  function spinTo(seg, done) {
    var s = Math.PI * 2 / 8, center = (seg - 1) * s + s / 2 + (Math.random() - 0.5) * s * 0.7;
    var cur = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var target = -center; while (target < cur) target += Math.PI * 2;
    target += Math.PI * 2 * (5 + Math.floor(Math.random() * 3));
    var start = angle, delta = target - cur, t0 = performance.now(), dur = 4200 + Math.random() * 1000, last = segAt(angle);
    angle = cur; start = cur;
    function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      angle = start + delta * e; drawWheel();
      var sa = segAt(angle); if (sa !== last) { last = sa; SFX.tick(); }
      if (p < 1) requestAnimationFrame(step); else done();
    }
    requestAnimationFrame(step);
  }

  /* ---------------- สถานะ / บันทึก ---------------- */
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ state: state, hist: hist, muted: muted })); } catch (e) { }
  }
  function load() {
    try { var d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.state) { state = d.state; hist = d.hist || []; muted = !!d.muted; return true; } } catch (e) { }
    return false;
  }
  function snapshot(s) { var c = JSON.parse(JSON.stringify(s)); var n = c.log.length; c.log = null; return { s: c, logLen: n }; }
  function dispatch(a) {
    var before = snapshot(state), next;
    try { next = GG.act(state, a); } catch (e) { toast('⚠️ ' + e.message); return; }
    hist.push(before); if (hist.length > 400) hist.shift();
    state = next; swapSel = [];
    playEvents(state.events || []);
    var outs = state.log.slice(before.logLen).filter(function (l) { return l.indexOf('🚪') === 0; });
    if (outs.length) toast(outs.join('<br>'), 2600);
    stopTimer();
    if (state.phase === 'mission') startTimer();
    save(); render();
    if (state.phase === 'end') setTimeout(showEnd, 900);
  }
  function undo() {
    if (spinning) return;
    if (!hist.length) { toast('ย้อนกลับไม่ได้แล้ว'); return; }
    var h = hist.pop(), log = state.log.slice(0, h.logLen);
    state = h.s; state.log = log; state.events = []; swapSel = [];
    stopTimer(); $('endModal').classList.add('hidden');
    save(); render(); toast('↶ ย้อนกลับ 1 ขั้น', 1200);
  }

  /* ---------------- ตัวจับเวลาภารกิจ ---------------- */
  var timerId = null, timeLeft = 10;
  function startTimer() {
    stopTimer(); timeLeft = 10; SFX.count(false);
    timerId = setInterval(function () {
      timeLeft--;
      if (timeLeft <= 0) { stopTimer(); timeLeft = 0; SFX.buzzer(); toast('⏰ หมดเวลา!', 1500); }
      else SFX.count(timeLeft <= 3);
      renderPanel();
    }, 1000);
  }
  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

  /* ---------------- render ---------------- */
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function name(i) { return esc(state.names[i]); }
  function render() {
    $('setup').classList.add('hidden'); $('game').classList.remove('hidden');
    $('sTurn').textContent = state.turn; $('sPile').textContent = state.pile;
    $('sActive').textContent = GG.active(state).length + '/' + state.n;
    $('btnMute').textContent = muted ? '🔇 ปิดเสียง' : '🔊 เสียง';
    $('btnUndo').disabled = !hist.length;
    renderBoard(); renderPanel(); renderLog();
    $('btnSpin').disabled = spinning || state.phase !== 'spin';
  }
  function targetSet() {
    var p = state.pending; return (p && p.targets) ? p.targets : [];
  }
  function renderBoard() {
    var b = $('board'), html = '', t = targetSet(), ord = state.phase === 'mission' ? state.pending.orderer : -1;
    for (var i = 0; i < state.n; i++) {
      var cls = 'pcard';
      if (state.done[i]) cls += ' out';
      else if (i === state.cur && state.phase !== 'end') cls += ' turn';
      if (t.indexOf(i) >= 0) cls += ' target' + (swapSel.indexOf(i) >= 0 ? ' sel' : '');
      if (i === ord) cls += ' orderer';
      html += '<div class="' + cls + '" data-p="' + i + '"><span class="seat">#' + (i + 1) + '</span>' +
        '<div class="name">' + (i === state.cur && state.phase !== 'end' ? '👉 ' : '') + name(i) + '</div>' +
        (state.done[i] ? '<div class="items"><span>✔ ได้ครบ 2 ชิ้นแล้ว</span></div></div>' : '<div class="items"><span title="ยังห่อ">🎁 <b>' + state.wr[i] + '</b></span><span title="แกะแล้ว">✨ <b>' + state.op[i] + '</b>/2</span></div></div>');
    }
    b.innerHTML = html;
    var el = b.querySelector('.turn'); if (el && el.scrollIntoViewIfNeeded) el.scrollIntoViewIfNeeded(); 
  }
  function renderLog() {
    var l = $('log'), lines = state.log.slice(-200);
    l.innerHTML = lines.map(function (x) { return '<li' + (x.indexOf('— ตาที่') === 0 ? ' class="turnline"' : '') + '>' + esc(x) + '</li>'; }).join('');
    l.scrollTop = l.scrollHeight;
  }
  function tbtn(i, extra) {
    return '<button class="btn pink' + (swapSel.indexOf(i) >= 0 ? ' sel' : '') + '" data-t="' + i + '">' + name(i) + ' <small>(🎁' + state.wr[i] + ' ✨' + state.op[i] + ')</small>' + (extra || '') + '</button>';
  }
  function badge() {
    if (!state.seg) return '';
    var k = state.seg - 1; return '<div class="seg-badge" style="background:' + COLORS[k] + '">' + ICONS[k] + ' ช่อง ' + state.seg + ': ' + GG.SEGMENTS[state.seg].label + '</div>';
  }
  function renderPanel() {
    var p = $('panel'), s = state, who = '<span class="who">' + name(s.cur) + '</span>', h = '';
    switch (s.phase) {
      case 'spin':
        h = '<h2>ตาของ ' + who + '</h2>' + (s.spunAgain ? '<p>🔄 ได้หมุนอีกรอบ! (ถ้าได้ 7 อีกจะนับเป็นช่อง 1)</p>' : '<p>ในมือ: 🎁 ยังห่อ ' + s.wr[s.cur] + ' · ✨ แกะแล้ว ' + s.op[s.cur] + '/2</p>') +
          '<button class="btn big gold" data-a="spin"' + (spinning ? ' disabled' : '') + '>🎡 ' + (spinning ? 'กำลังหมุน...' : 'หมุนวงล้อ') + '</button>';
        break;
      case 'mission':
        var o = s.pending.orderer;
        h = badge() + '<h2>🎯 ภารกิจของ ' + who + '</h2><p><b class="who">' + name(o) + '</b> (ฝั่งตรงข้าม) คิดภารกิจภายใน 10 วินาที</p>' +
          '<div class="timer' + (timeLeft <= 3 ? ' low' : '') + '">' + (timerId || timeLeft === 0 ? timeLeft : '10') + '</div>' +
          '<div class="targets"><button class="btn green" data-a="done">✅ ทำได้ → หยิบ 1 ชิ้น</button>' +
          '<button class="btn grey" data-a="refuse">🙅 ไม่ทำ → ข้ามไปคนถัดไป</button>' +
          '<button class="btn blue" data-a="timeout">⏰ คนสั่งคิดไม่ทัน / วงไม่โอเค → หยิบเลย</button></div>' +
          '<button class="btn small" data-a="timer">⏱ จับเวลาใหม่</button>';
        break;
      case 'give':
        h = badge() + '<h2>😈 ' + who + ' จะยัดของให้ใคร?</h2><p>เลือกผู้เล่น 1 คน</p><div class="targets">' + s.pending.targets.map(function (i) { return tbtn(i); }).join('') + '</div>';
        break;
      case 'steal':
        h = badge() + '<h2>🏹 ' + who + ' จะปล้นใคร?</h2><p>ปล้นได้เฉพาะของที่ยังห่อ</p><div class="targets">' + s.pending.targets.map(function (i) { return tbtn(i); }).join('') + '</div>';
        break;
      case 'swap':
        h = badge() + '<h2>🔀 ' + who + ' สั่งใคร 2 คนสลับของห่อกัน?</h2><p>เลือก 2 คน (เลือกแล้ว ' + swapSel.length + '/2) แล้วกดยืนยัน</p><div class="targets">' +
          s.pending.targets.map(function (i) { return tbtn(i); }).join('') + '</div>' +
          '<button class="btn big gold" data-a="swap"' + (swapSel.length === 2 ? '' : ' disabled') + '>✔ ยืนยันสลับ แล้วหยิบ 1 ชิ้น</button>';
        break;
      case 'unwrap':
        h = badge() + '<h2>✨ ' + who + ' จะแกะของไหม?</h2><p>ในมือ: 🎁 ยังห่อ ' + s.wr[s.cur] + ' · ✨ แกะแล้ว ' + s.op[s.cur] + '/2' + (s.op[s.cur] === 1 ? ' — <b>ถ้าแกะจะครบ 2 และออกจากเกม</b>' : '') + '</p>' +
          '<div class="targets"><button class="btn big green" data-a="unwrap">🎁 แกะ 1 ชิ้น</button><button class="btn big grey" data-a="skip">ไม่แกะ</button></div>';
        break;
      case 'end':
        h = '<h2>🏆 จบเกม!</h2><p>ทุกคนได้ของครบ 2 ชิ้น ใน ' + s.turn + ' ตา</p><button class="btn big gold" data-a="showend">🎉 ดูสรุป</button>';
        break;
    }
    p.innerHTML = h;
  }

  /* ---------------- interactions ---------------- */
  function doSpin() {
    if (spinning || state.phase !== 'spin') return;
    spinning = true; render(); SFX.spin();
    var seg = 1 + Math.floor(Math.random() * 8);
    spinTo(seg, function () {
      spinning = false; SFX.land();
      var was7again = state.spunAgain && seg === 7;
      dispatch({ type: 'spin', seg: seg });
      if (seg === 7 && !was7again) toast('🔄 หมุนอีกรอบ!', 1400);
      else if (was7again) toast('ได้ 7 ซ้ำ → นับเป็นช่อง 1', 1600);
    });
  }
  function pickTarget(i) {
    if (spinning) return;
    if (state.phase === 'give' || state.phase === 'steal') { if (targetSet().indexOf(i) >= 0) dispatch({ type: 'target', j: i }); }
    else if (state.phase === 'swap' && targetSet().indexOf(i) >= 0) {
      var k = swapSel.indexOf(i);
      if (k >= 0) swapSel.splice(k, 1); else { if (swapSel.length >= 2) swapSel.shift(); swapSel.push(i); }
      SFX.tick(); renderBoard(); renderPanel();
    }
  }
  $('panel').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.t !== undefined) return pickTarget(+b.dataset.t);
    var a = b.dataset.a;
    if (a === 'spin') doSpin();
    else if (a === 'done' || a === 'refuse' || a === 'timeout' || a === 'unwrap' || a === 'skip') dispatch({ type: a });
    else if (a === 'swap') dispatch({ type: 'swap', a: swapSel[0], b: swapSel[1] });
    else if (a === 'timer') { startTimer(); renderPanel(); }
    else if (a === 'showend') showEnd();
  });
  $('board').addEventListener('click', function (e) { var c = e.target.closest('.pcard'); if (c) pickTarget(+c.dataset.p); });
  $('btnSpin').addEventListener('click', doSpin);
  $('btnUndo').addEventListener('click', undo);
  $('btnMute').addEventListener('click', function () { muted = !muted; save(); render(); });
  document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { b.closest('.modal').classList.add('hidden'); }); });
  $('btnRules').addEventListener('click', function () { $('rulesModal').classList.remove('hidden'); });
  $('btnRules2').addEventListener('click', function () { $('rulesModal').classList.remove('hidden'); });
  $('btnSetup').addEventListener('click', function () { stopTimer(); showSetup(); });
  $('btnReset').addEventListener('click', function () {
    if (!confirm('ล้างเกมนี้แล้วเริ่มใหม่? (ข้อมูลเกมปัจจุบันจะหาย)')) return;
    localStorage.removeItem(KEY); state = null; hist = []; stopTimer(); showSetup();
  });
  $('btnNewGame').addEventListener('click', function () {
    if (!confirm('เริ่มเกมใหม่?')) return;
    localStorage.removeItem(KEY); state = null; hist = []; $('endModal').classList.add('hidden'); showSetup();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space' && state && state.phase === 'spin') { e.preventDefault(); doSpin(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && state) { e.preventDefault(); undo(); }
  });

  /* ---------------- setup ---------------- */
  function defaultNames(n, old) { var a = []; for (var i = 0; i < n; i++) a.push(old && old[i] ? old[i] : 'ผู้เล่น ' + (i + 1)); return a; }
  function readNames() { return $('inNames').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function syncNames() {
    var n = Math.max(2, Math.min(60, +$('inPlayers').value || 20));
    var cur = readNames(); $('inNames').value = defaultNames(n, cur).slice(0, n).join('\n'); validate();
  }
  function validate() {
    var names = readNames(), g = +$('inGifts').value || 0, w = '';
    if (names.length < 2) w = 'ต้องมีผู้เล่นอย่างน้อย 2 คน';
    else if (g < names.length * 2) w = 'ของขวัญต้องมีอย่างน้อย 2 เท่าของจำนวนคน (' + names.length * 2 + ' ชิ้น) ไม่งั้นบางคนจะได้ไม่ครบ 2 ชิ้น';
    else if (g > names.length * 2) w = 'ℹ️ ของมากกว่า 2 เท่าของคน — จบเกมแล้วอาจมีของเหลือ';
    $('setupWarn').textContent = w;
    $('btnStart').disabled = names.length < 2 || g < names.length * 2;
  }
  function showSetup() {
    $('game').classList.add('hidden'); $('setup').classList.remove('hidden');
    var saved = null; try { saved = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { }
    if (saved && saved.names) { $('inPlayers').value = saved.names.length; $('inGifts').value = saved.gifts; $('inNames').value = saved.names.join('\n'); }
    else { $('inPlayers').value = 20; $('inGifts').value = 40; $('inNames').value = defaultNames(20).join('\n'); }
    $('btnResume').classList.toggle('hidden', !state);
    validate();
  }
  $('inPlayers').addEventListener('change', function () { syncNames(); $('inGifts').value = readNames().length * 2; validate(); });
  $('inGifts').addEventListener('input', validate);
  $('inNames').addEventListener('input', function () { $('inPlayers').value = readNames().length; validate(); });
  $('btnAutoGifts').addEventListener('click', function () { $('inGifts').value = readNames().length * 2; validate(); });
  $('btnResume').addEventListener('click', function () { render(); });
  $('btnStart').addEventListener('click', function () {
    var names = readNames(), g = +$('inGifts').value;
    if (state && state.phase !== 'end' && !confirm('มีเกมที่เล่นค้างอยู่ จะเริ่มเกมใหม่แทนใช่ไหม?')) return;
    localStorage.setItem(SKEY, JSON.stringify({ names: names, gifts: g }));
    ac(); state = GG.newGame(names, g); hist = []; save(); render(); SFX.gift();
  });

  /* ---------------- toast / end / confetti ---------------- */
  var toastT = null;
  function toast(html, ms) { var t = $('toast'); t.innerHTML = html; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, ms || 1800); }
  function showEnd() {
    var s = state;
    $('endSummary').innerHTML = 'ผู้เล่น ' + s.n + ' คน · ของขวัญ ' + s.gifts + ' ชิ้น · เล่นทั้งหมด <b>' + s.turn + '</b> ตา' + (s.leftover ? ' · ของเหลือ ' + s.leftover + ' ชิ้น' : '') + '<br>ลำดับคนที่ได้ของครบก่อน:';
    $('endList').innerHTML = s.outOrder.map(function (i, k) { return '<div>' + (k === 0 ? '🥇' : k === 1 ? '🥈' : k === 2 ? '🥉' : (k + 1) + '.') + ' ' + name(i) + '</div>'; }).join('');
    $('endModal').classList.remove('hidden'); confetti();
  }
  function confetti() {
    var c = $('confetti'), x = c.getContext('2d'), W = c.width = innerWidth, H = c.height = innerHeight, P = [], t0 = performance.now();
    for (var i = 0; i < 350; i++) P.push({ x: Math.random() * W, y: -Math.random() * H, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 6.28, vr: (Math.random() - .5) * .3, s: 6 + Math.random() * 10, c: COLORS[i % 8] });
    (function f(now) {
      x.clearRect(0, 0, W, H);
      P.forEach(function (p) { p.x += p.vx; p.y += p.vy; p.r += p.vr; if (p.y > H && now - t0 < 5000) { p.y = -20; p.x = Math.random() * W; } x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); x.restore(); });
      if (now - t0 < 9000) requestAnimationFrame(f); else x.clearRect(0, 0, W, H);
    })(t0);
  }

  /* ---------------- start ---------------- */
  drawWheel();
  if (load()) render(); else showSetup();
  window.addEventListener('resize', function () { });
  window.__gift = { get state() { return state; }, dispatch: dispatch, undo: undo, showEnd: showEnd };
})();
