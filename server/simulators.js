// Mochi Pal — Deterministic Server-Side Replay Verifiers (mulberry32 + fixed timestep 1/120)
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function verifyDeterministicRun(gameId, seed, claimedScore, inputs = []) {
  if (!Array.isArray(inputs)) return { verified: false, reason: 'Invalid inputs array' };
  const cleanScore = Math.max(0, Math.floor(Number(claimedScore) || 0));
  if (cleanScore === 0) return { verified: true, score: 0 };

  // Basic anti-cheat sanity checks on input log vs claimed score
  if (gameId === 'skyStack' || gameId === 'bladeSpin' || gameId === 'timberDash') {
    if (inputs.length < cleanScore) {
      return { verified: false, reason: 'Fewer input events than score' };
    }
  }

  // Replay Sky Stack deterministically when gameId === 'skyStack'
  if (gameId === 'skyStack') {
    let stack = [{ x: 0, width: 170 }];
    let combo = 0;
    let moving = { x: -180, width: 170, vx: 185 + 8.5 };
    let tick = 0;
    let score = 0;

    for (let i = 0; i < inputs.length; i++) {
      const targetTick = inputs[i];
      if (targetTick < tick || targetTick - tick > 120 * 30) {
        return { verified: false, reason: 'Invalid tick sequence' };
      }
      while (tick < targetTick) {
        tick++;
        moving.x += moving.vx * (1 / 120);
        if (moving.x > 190) { moving.x = 190; moving.vx = -Math.abs(moving.vx); }
        else if (moving.x < -190) { moving.x = -190; moving.vx = Math.abs(moving.vx); }
      }
      const prev = stack[stack.length - 1];
      const delta = moving.x - prev.x;
      const absDelta = Math.abs(delta);
      if (absDelta >= moving.width) break;

      let newW = moving.width - absDelta;
      let newX = prev.x + delta * 0.5;
      if (absDelta <= 6) {
        newW = prev.width;
        newX = prev.x;
        combo++;
        if (combo >= 4 && newW < 170) newW = Math.min(170, newW + 10);
      } else {
        combo = 0;
      }
      stack.push({ x: newX, width: newW });
      score++;
      const lvl = stack.length;
      const spd = Math.min(440, 185 + lvl * 8.5);
      const dir = lvl % 2 === 1 ? 1 : -1;
      moving = { x: dir * -180, width: newW, vx: dir * spd };
    }

    if (Math.abs(score - cleanScore) > 1) {
      return { verified: false, reason: 'Replay score mismatch' };
    }
  }

  return { verified: true, score: cleanScore };
}
