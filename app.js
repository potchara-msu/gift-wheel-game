/* วงล้อจับสลากของขวัญ — แบบง่าย: หมุน แล้วโชว์การ์ด (offline ล้วน) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var FONT = '"Sukhumvit Set","Thonburi","Leelawadee UI","Noto Sans Thai",sans-serif';
  var SEGS = [
    { n: 1, short: 'หยิบ 1', title: 'หยิบ 1 ชิ้น', icon: '🍬', color: '#ff7518', snd: 'gift',
      text: 'หยิบของขวัญจากกอง<br><b>1 ชิ้น</b>' },
    { n: 2, short: 'หยิบ 2', title: 'หยิบ 2 ชิ้น', icon: '🍬🍬', color: '#ff9f1c', snd: 'double',
      text: 'หยิบจากกอง <b>2 ชิ้น</b><br>เก็บเองทั้งหมด!' },
    { n: 3, short: 'ภารกิจ', title: 'ภารกิจ!', icon: '🧙', color: '#9b5de5', snd: 'mission',
      text: 'คนนั่งตรงข้ามคิดภารกิจ 10 วิ<ul><li>ทำได้ → หยิบ 1 ชิ้น</li><li>ไม่ทำ → ข้ามไปคนถัดไป</li><li>คิดไม่ทัน/วงไม่โอเค → หยิบเลย</li></ul>' },
    { n: 4, short: 'ยัดเยียด', title: 'ยัดเยียด', icon: '👻', color: '#70e000', snd: 'give',
      text: 'หยิบจากกอง <b>2 ชิ้น</b> เก็บ 1<br>อีกชิ้น<b>ยัดให้ใครก็ได้!</b>' },
    { n: 5, short: 'สลับมั่ว', title: 'สลับมั่ว', icon: '🦇', color: '#5a189a', snd: 'swap',
      text: 'สั่งเพื่อน <b>2 คน</b> สลับของที่ยังห่อ<br>แล้วเราหยิบจากกอง 1 ชิ้น' },
    { n: 6, short: 'ปล้น!', title: 'โรบินฮู้ดจอมแสบ', icon: '💀', color: '#3c096c', snd: 'steal',
      text: '<b>ปล้น</b>ของที่ยังห่อ<br>จากใครก็ได้ <b>1 ชิ้น!</b>' },
    { n: 7, short: 'หมุนอีก', title: 'หมุนอีกรอบ!', icon: '🌕', color: '#d00000', snd: 'again',
      text: 'หมุนได้อีก <b>1 ครั้ง!</b><br><small>ได้ 7 ซ้ำ = นับเป็นช่อง 1</small>' },
    { n: 8, short: 'หยิบ+แกะ', title: 'หยิบ + แกะ', icon: '🎃', color: '#2d6a4f', snd: 'unwrap',
      text: 'หยิบจากกอง 1 ชิ้น<br>แล้ว<b>ต้องแกะ 1 ชิ้น!</b><br><small>(ถ้าในมือมีเกิน 1 ชิ้น)</small>' }
  ];
  var muted = false, spinning = false, extraSpin = false, history = [], cardOpen = null;
  try { var sv = JSON.parse(localStorage.getItem('giftWheelSimple.v1') || '{}'); muted = !!sv.muted; history = sv.history || []; } catch (e) { }
  function save() { try { localStorage.setItem('giftWheelSimple.v1', JSON.stringify({ muted: muted, history: history })); } catch (e) { } }

  /* ---------- เสียง Web Audio ---------- */
  var AC = null;
  function ac() { if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, t0, dur, type, vol, f2) {
    var c = ac(); if (!c || muted) return;
    var o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (t0 || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t0, dur, vol, freq, type) {
    var c = ac(); if (!c || muted) return;
    var len = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + (t0 || 0);
    s.buffer = b; f.type = type || 'highpass'; f.frequency.value = freq || 1500; g.gain.value = vol || 0.3;
    s.connect(f); f.connect(g); g.connect(c.destination); s.start(t);
  }
  function arp(notes, t0, step, type, vol) { notes.forEach(function (f, i) { tone(f, t0 + i * step, step * 2.2, type || 'triangle', vol || 0.2); }); }
  var SFX = {
    tick: function () { tone(1500, 0, 0.025, 'square', 0.07); noise(0, 0.02, 0.08, 3000); },
    whoosh: function () { noise(0, 0.7, 0.18, 500, 'bandpass'); tone(180, 0, 0.6, 'sawtooth', 0.06, 700); },
    land: function () { tone(1046, 0, 0.12, 'triangle', 0.2); tone(1568, 0.07, 0.3, 'triangle', 0.18); },
    gift: function () { arp([523, 659, 784, 1047], 0, 0.08); tone(2093, 0.35, 0.5, 'sine', 0.1); },
    double: function () { arp([523, 659, 784, 1047], 0, 0.07); arp([659, 784, 1047, 1319], 0.35, 0.07); tone(2637, 0.7, 0.6, 'sine', 0.1); },
    mission: function () { // กลองระทึก + คอร์ดลึกลับ
      for (var i = 0; i < 10; i++) noise(i * 0.06, 0.06, 0.12 + i * 0.02, 200, 'lowpass');
      tone(110, 0.6, 0.12, 'sine', 0.5, 50); [233, 277, 349].forEach(function (f) { tone(f, 0.65, 1.0, 'sawtooth', 0.06); });
    },
    give: function () { tone(220, 0, 0.35, 'sine', 0.3, 880); tone(880, 0.3, 0.3, 'sine', 0.25, 330); tone(523, 0.62, 0.15, 'square', 0.08); tone(392, 0.78, 0.25, 'square', 0.08); },
    swap: function () { for (var i = 0; i < 6; i++) tone(i % 2 ? 660 : 440, i * 0.1, 0.12, 'triangle', 0.18, i % 2 ? 440 : 660); tone(880, 0.65, 0.3, 'sine', 0.15); },
    steal: function () { // ย่องๆ แล้ว วาห์วาห์
      [392, 0, 330, 0, 294, 0, 262].forEach(function (f, i) { if (f) tone(f, i * 0.09, 0.08, 'triangle', 0.22); });
      tone(466, 0.7, 0.3, 'sawtooth', 0.12, 440); tone(440, 1.0, 0.3, 'sawtooth', 0.12, 415); tone(415, 1.3, 0.6, 'sawtooth', 0.12, 330);
    },
    again: function () { noise(0, 0.5, 0.15, 800, 'bandpass'); tone(300, 0, 0.5, 'sine', 0.2, 1500); arp([784, 988, 1175, 1568], 0.45, 0.06, 'square', 0.08); },
    unwrap: function () { noise(0, 0.15, 0.4, 2500); noise(0.15, 0.25, 0.35, 3000); arp([523, 659, 784], 0.1, 0.07); [1568, 2093, 2637, 3136, 4186].forEach(function (f, i) { tone(f, 0.45 + i * 0.07, 0.4, 'sine', 0.1); }); },
    count: function (low) { tone(low ? 1100 : 800, 0, 0.09, 'square', 0.14); },
    buzzer: function () { tone(130, 0, 1.0, 'sawtooth', 0.28); tone(137, 0, 1.0, 'square', 0.14); }
  };

  /* ---------- วงล้อ ---------- */
  var wheel = $('wheel'), ctx = wheel.getContext('2d'), angle = 0, SEGA = Math.PI * 2 / 8;
  function shade(hex, amt) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + amt))); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  function drawWheel() {
    var W = wheel.width, R = W / 2 - 14, c = W / 2;
    ctx.clearRect(0, 0, W, W); ctx.save(); ctx.translate(c, c); ctx.rotate(angle);
    for (var k = 0; k < 8; k++) {
      var a0 = -Math.PI / 2 + k * SEGA, s = SEGS[k];
      var gr = ctx.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
      gr.addColorStop(0, shade(s.color, 50)); gr.addColorStop(1, shade(s.color, -25));
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a0 + SEGA); ctx.closePath();
      ctx.fillStyle = gr; ctx.fill(); ctx.lineWidth = 8; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.save(); ctx.rotate(a0 + SEGA / 2);
      var mid = a0 + SEGA / 2 + angle, flip = Math.cos(mid) < 0, sx = 1; // ครึ่งซ้าย: หมุนตัวอักษร 180° ให้อ่านได้ตั้งตรง
      if (flip) { ctx.rotate(Math.PI); sx = -1; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8;
      ctx.font = '96px ' + FONT; ctx.fillText(s.icon.length > 2 ? '🍬' : s.icon, sx * R * 0.83, 0);
      ctx.shadowBlur = 0;
      var fs = 84; ctx.font = '900 ' + fs + 'px ' + FONT;
      while (ctx.measureText(s.short).width > R * 0.44 && fs > 30) { fs -= 2; ctx.font = '900 ' + fs + 'px ' + FONT; }
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.round(fs / 5); ctx.strokeStyle = 'rgba(30,10,40,.85)';
      ctx.strokeText(s.short, sx * R * 0.48, 4); ctx.fillStyle = '#fff'; ctx.fillText(s.short, sx * R * 0.48, 4);
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.lineWidth = 20; ctx.strokeStyle = '#ff7518'; ctx.stroke();
    for (var d = 0; d < 40; d++) { var aa = d * Math.PI / 20; ctx.beginPath(); ctx.arc(Math.cos(aa) * R, Math.sin(aa) * R, 7, 0, 7); ctx.fillStyle = d % 2 ? '#f5f0e1' : '#9b5de5'; ctx.shadowColor = '#fff'; ctx.shadowBlur = d % 2 ? 12 : 0; ctx.fill(); }
    ctx.restore();
  }
  function segAt(a) { var x = ((-a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); return Math.floor(x / SEGA); }
  function spin() {
    if (spinning) return;
    ac(); closeCard(true);
    spinning = true; $('btnSpin').disabled = true; SFX.whoosh();
    var seg = 1 + Math.floor(Math.random() * 8);
    var center = (seg - 1) * SEGA + SEGA / 2 + (Math.random() - 0.5) * SEGA * 0.75;
    var cur = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); angle = cur;
    var target = -center; while (target < cur) target += Math.PI * 2;
    target += Math.PI * 2 * (5 + Math.floor(Math.random() * 3));
    var start = cur, delta = target - cur, t0 = performance.now(), dur = 4500 + Math.random() * 1200, last = segAt(angle), ptr = document.querySelector('.pointer');
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      angle = start + delta * e; drawWheel();
      var sa = segAt(angle); if (sa !== last) { last = sa; SFX.tick(); ptr.classList.remove('bump'); void ptr.offsetWidth; ptr.classList.add('bump'); }
      if (p < 1) requestAnimationFrame(step); else { spinning = false; $('btnSpin').disabled = false; SFX.land(); setTimeout(function () { result(seg); }, 350); }
    })(t0);
  }
  function result(seg) {
    var note = '';
    if (extraSpin && seg === 7) { seg = 1; note = '🔄 ได้ช่อง 7 ซ้ำ → นับเป็นช่อง 1'; }
    var wasExtra = extraSpin; extraSpin = false;
    history.unshift(seg); history = history.slice(0, 12); save(); renderHist();
    showCard(seg, note, wasExtra);
  }

  // กดปุ่มด้วยเมาส์/นิ้ว: ทำงานทันทีตอน pointerdown (ไม่หายแม้ปุ่มกำลังขยับระหว่างแอนิเมชัน)
  function onTap(el, fn) {
    el.addEventListener('pointerdown', function (e) { if (e.button !== 0) return; e.preventDefault(); fn(e); });
    el.addEventListener('click', function (e) { if (e.detail === 0) fn(e); }); // คลิกจากคีย์บอร์ด
  }
  /* ---------- การ์ด ---------- */
  var timerId = null, left = 10, mission = 'none', cardView = false; // mission: none | idle | running | done
  var CLOSE_HINT = 'แตะจอ หรือกด Spacebar เพื่อหมุนต่อ';
  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
  function setHint() {
    var h = CLOSE_HINT;
    if (mission === 'idle') h = '⏱ กด Spacebar เพื่อเริ่มนับ 10 วิ · ปิดการ์ดได้เมื่อหมดเวลา';
    else if (mission === 'running') h = '⏳ กำลังนับ... ปิดการ์ดได้เมื่อหมดเวลา';
    else if (mission === 'done') h = '⏰ หมดเวลา! แตะจอ หรือกด Spacebar เพื่อปิด';
    else if (cardOpen === 7 && !cardView) h = '🔄 กดปุ่ม "หมุนเลย!" หรือ Spacebar เพื่อหมุนอีกรอบ';
    else if (cardView) h = 'ดูย้อนหลัง · แตะจอ หรือกด Spacebar เพื่อปิด';
    $('cClose').textContent = h;
    var bt = document.querySelector('[data-act=timer]'); if (bt) bt.disabled = mission === 'running';
  }
  function canClose() { return (mission === 'none' || mission === 'done') && !(cardOpen === 7 && !cardView); }
  function showCard(seg, note, wasExtra, view) {
    var s = SEGS[seg - 1]; cardOpen = seg; cardView = !!view; stopTimer();
    mission = seg === 3 ? 'idle' : 'none';
    var card = $('card'); card.style.setProperty('--c', s.color);
    $('cNum').textContent = 'ช่อง ' + s.n + (view ? ' · ดูย้อนหลัง' : wasExtra ? ' · หมุนรอบพิเศษ' : '');
    $('cIcon').textContent = s.icon; $('cIcon').classList.toggle('two', s.icon.length > 2); $('cTitle').textContent = s.title; $('cNote').textContent = note || ''; $('cText').innerHTML = s.text;
    var ex = $('cExtra'); ex.innerHTML = '';
    if (seg === 3) { ex.innerHTML = '<div class="timer" id="cTimer">10</div><button class="bigbtn" data-act="timer">⏱ เริ่ม 10 วิ</button>'; }
    if (seg === 7 && !view) { ex.innerHTML = '<button class="bigbtn" data-act="again">🔄 หมุนเลย!</button>'; }
    document.querySelector('.cl').classList.toggle('has-extra', !!ex.innerHTML);
    setHint();
    var inner = card.querySelector('.card-inner'); inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = '';
    $('overlay').classList.remove('hidden'); fit();
    SFX[s.snd](); burst(s.color);
  }
  // ย่อตัวอักษรอัตโนมัติถ้าล้นการ์ด (กันตัวหนังสือโดนตัด)
  function overflows(el) { return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }
  function fit() {
    var inner = $('cardInner'), sc = 1, parts = inner.querySelectorAll('.cl,.cr,.card-remind');
    inner.style.setProperty('--s', 1);
    var bad = function () { for (var i = 0; i < parts.length; i++) if (overflows(parts[i])) return true; return false; };
    while (bad() && sc > 0.4) { sc -= 0.04; inner.style.setProperty('--s', sc.toFixed(2)); }
    inner.dataset.scale = sc.toFixed(2);
  }
  window.addEventListener('resize', function () { if (cardOpen) fit(); });
  function closeCard() { stopTimer(); mission = 'none'; cardView = false; $('overlay').classList.add('hidden'); cardOpen = null; }
  function startTimer() {
    if (mission === 'running') return;
    stopTimer(); mission = 'running'; left = 10; var el = $('cTimer'); el.textContent = left; el.classList.remove('low'); SFX.count(false); setHint();
    timerId = setInterval(function () {
      left--; el.textContent = left > 0 ? left : '⏰ หมด!'; el.classList.toggle('low', left <= 3);
      if (left <= 0) { stopTimer(); mission = 'done'; SFX.buzzer(); setHint(); } else SFX.count(left <= 3);
    }, 1000);
  }
  function spinAgain() { extraSpin = true; closeCard(); spin(); }
  onTap($('overlay'), function (e) {
    var b = e.target.closest('[data-act]');
    if (b) { if (b.disabled) return; if (b.dataset.act === 'timer') startTimer(); else if (b.dataset.act === 'again') spinAgain(); return; }
    if (mission === 'idle' && e.target.closest('.card-inner')) { startTimer(); return; } // แตะการ์ดภารกิจ = เริ่มนับ
    if (!canClose()) { nudge(); return; }
    if (cardOpen === 7) extraSpin = false;
    closeCard();
  });
  function nudge() { var el = $('cClose'); el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge'); }

  /* ---------- ประวัติ (กดเพื่อเปิดการ์ดดูอีกครั้ง) ---------- */
  function renderHist() {
    $('hist').innerHTML = history.map(function (n) { var s = SEGS[n - 1]; return '<button class="chip" data-n="' + n + '" style="background:' + s.color + '">' + (s.icon.length > 2 ? '🍬🍬' : s.icon) + ' ' + n + ' ' + s.short + '</button>'; }).join('');
  }
  onTap($('hist'), function (e) {
    var c = e.target.closest('[data-n]'); if (!c || spinning || cardOpen) return;
    ac(); showCard(+c.dataset.n, '', false, true);
  });
  $('btnClear').addEventListener('click', function () { history = []; save(); renderHist(); });

  /* ---------- ปุ่ม/คีย์ ---------- */
  function setMute() { $('btnMute').textContent = muted ? '🔇' : '🔊'; }
  $('btnMute').addEventListener('click', function () { muted = !muted; setMute(); save(); });
  $('btnFull').addEventListener('click', function () {
    var d = document, el = d.documentElement;
    if (!(d.fullscreenElement || d.webkitFullscreenElement)) (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    else (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  });
  onTap($('btnSpin'), function () { if (!cardOpen) spin(); });
  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault(); if (e.repeat || spinning) return;
      if (cardOpen && mission === 'idle') startTimer();          // ภารกิจ: Space = เริ่มนับ
      else if (cardOpen === 7 && !cardView) spinAgain();          // หมุนอีกรอบ: Space = หมุนเลย
      else if (cardOpen && !canClose()) nudge();                  // กำลังนับ: ปิดไม่ได้
      else if (cardOpen) closeCard();
      else spin();
    } else if (e.code === 'Escape' && cardOpen) {
      if (!canClose()) { nudge(); return; }
      extraSpin = false; closeCard();
    }
  });

  /* ---------- พลุกระดาษ ---------- */
  var fx = $('fx'), fctx = fx.getContext('2d'), parts = [], running = false;
  function burst(color) {
    fx.width = innerWidth; fx.height = innerHeight;
    var cols = [color, '#ff7518', '#f5f0e1', '#9b5de5', '#70e000'];
    for (var i = 0; i < 160; i++) { var a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 12; parts.push({ x: innerWidth / 2, y: innerHeight / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: 7 + Math.random() * 9, c: cols[i % cols.length], life: 120 + Math.random() * 60 }); }
    if (!running) { running = true; requestAnimationFrame(tickFx); }
  }
  function tickFx() {
    fctx.clearRect(0, 0, fx.width, fx.height);
    parts = parts.filter(function (p) { return --p.life > 0; });
    parts.forEach(function (p) { p.vy += 0.25; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; fctx.save(); fctx.globalAlpha = Math.min(1, p.life / 40); fctx.translate(p.x, p.y); fctx.rotate(p.r); fctx.fillStyle = p.c; fctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); fctx.restore(); });
    if (parts.length) requestAnimationFrame(tickFx); else { running = false; fctx.clearRect(0, 0, fx.width, fx.height); }
  }

  setMute(); renderHist(); drawWheel();
  window.__wheel = { showCard: showCard, spin: spin, _result: function (s, x) { extraSpin = !!x; result(s); }, _close: function () { closeCard(); }, _forceDone: function () { if (mission === 'running') { stopTimer(); mission = 'done'; setHint(); } }, get open() { return cardOpen; }, get mission() { return mission; } };
})();
