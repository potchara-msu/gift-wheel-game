// node tests/simulate.js  — จำลองเกมสุ่มหลายพันเกม ตรวจว่าจบทุกเกม ของไม่หาย และทุกคนแกะครบ 2
const G = require('../game.js');
function rng(seed) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function play(seed, n, gifts, skipUnwrapP) {
  const R = rng(seed * 2654435761 + 7), pick = a => a[Math.floor(R() * a.length)];
  let s = G.newGame(Array.from({ length: n }, (_, i) => 'P' + (i + 1)), gifts), steps = 0;
  while (s.phase !== 'end') {
    if (++steps > 20000) throw new Error('stuck seed ' + seed);
    let a;
    switch (s.phase) {
      case 'spin': a = { type: 'spin', seg: 1 + Math.floor(R() * 8) }; break;
      case 'mission': { const r = R(); a = { type: r < 0.15 ? 'refuse' : r < 0.6 ? 'done' : 'timeout' }; break; }
      case 'give': case 'steal': a = { type: 'target', j: pick(s.pending.targets) }; break;
      case 'swap': { const t = s.pending.targets.slice(); const x = t.splice(Math.floor(R() * t.length), 1)[0]; a = { type: 'swap', a: x, b: pick(t) }; break; }
      case 'unwrap': a = { type: R() < skipUnwrapP ? 'skip' : 'unwrap' }; break;
    }
    s = G.act(s, a);
    const tot = s.pile + s.wr.reduce((p, c) => p + c, 0) + s.op.reduce((p, c) => p + c, 0) + (s.leftover || 0) + (s.carry || 0);
    if (tot !== gifts) throw new Error('items not conserved seed ' + seed);
    if (s.op.some(o => o > 2) || s.wr.some(w => w < 0) || s.pile < 0) throw new Error('bad counts seed ' + seed);
    s.done.forEach((d, i) => { if (d && s.wr[i] !== 0) throw new Error('out player holds wrapped'); });
  }
  if (!s.op.every(o => o === 2)) throw new Error('not all 2 unwrapped seed ' + seed);
  return s.turn;
}
const cases = [[20, 40, 0, 10000], [20, 40, 0.3, 5000], [10, 20, 0, 3000], [7, 14, 0.2, 3000], [3, 6, 0, 2000], [2, 4, 0, 2000], [20, 45, 0, 2000], [31, 62, 0.1, 2000]];
let ok = true;
for (const [n, g, p, games] of cases) {
  const t = [];
  for (let i = 0; i < games; i++) t.push(play(i + 1, n, g, p));
  const avg = t.reduce((a, b) => a + b, 0) / t.length;
  console.log(`players=${n} gifts=${g} skipUnwrap=${p}: ${games} games OK, turns avg ${avg.toFixed(1)} min ${Math.min(...t)} max ${Math.max(...t)}`);
}
console.log('ALL PASSED');
