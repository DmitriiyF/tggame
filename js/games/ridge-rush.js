// Mini-Game Module 5: Ridge Rush (#rr-game-root) — Mochi Hill Buggy (Unlocks at Level 5)
import { sfx } from '../audio.js';
import { drawMiniMochi } from '../mochi-renderer.js';

function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export default {
  id: 'ridgeRush',
  title: 'Ridge Rush',
  icon: '🚙',

  mount(rootEl, { seed = 13579, skin = {}, onEnd }) {
    this.rootEl = rootEl;
    this.seed = seed;
    this.skin = skin || {};
    this.onEnd = onEnd;
    this.rafId = null;
    this.destroyed = false;

    this.rootEl.innerHTML = `
      <div id="rr-game-root" style="position:relative;width:100%;height:100%;overflow:hidden;background:linear-gradient(180deg,#38bdf8,#e0f2fe);font-family:'Fredoka', sans-serif;user-select:none;touch-action:none;">
        <canvas id="rr-canvas" style="width:100%;height:100%;display:block;"></canvas>
        <div style="position:absolute;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;pointer-events:none;">
          <div style="background:rgba(15,23,42,0.75);border:1px solid rgba(255,255,255,0.18);padding:6px 14px;border-radius:99px;color:#f8fafc;font-size:14px;font-weight:700;font-family:'Fredoka', sans-serif;">
            🚙 Ridge Rush • Зажимай ГАЗ / ТОРМОЗ
          </div>
          <div id="rr-score-val" style="font-size:32px;font-weight:700;color:#fde047;text-shadow:0 3px 10px rgba(0,0,0,0.5);font-family:'Fredoka', sans-serif;">0 м</div>
        </div>
        <div style="position:absolute;bottom:22px;left:18px;right:18px;display:flex;justify-content:space-between;align-items:center;">
          <button id="rr-brake-btn" style="width:110px;height:64px;border-radius:18px;border:2px solid #f87171;background:rgba(239,68,68,0.85);color:#fff;font-size:16px;font-weight:700;font-family:'Fredoka', sans-serif;">🛑 ТОРМОЗ</button>
          <button id="rr-quit-btn" style="background:rgba(15,23,42,0.85);color:#cbd5e1;border:1px solid rgba(255,255,255,0.2);border-radius:99px;padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Fredoka', sans-serif;">✕ Финиш</button>
          <button id="rr-gas-btn" style="width:110px;height:64px;border-radius:18px;border:2px solid #4ade80;background:rgba(34,197,94,0.85);color:#fff;font-size:16px;font-weight:700;font-family:'Fredoka', sans-serif;">⚡ ГАЗ</button>
        </div>
      </div>
    `;

    this.canvas = this.rootEl.querySelector('#rr-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = this.rootEl.querySelector('#rr-score-val');

    this._onResize = () => {
      if (this.destroyed) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(300, rect.width || window.innerWidth);
      this.h = Math.max(400, rect.height || window.innerHeight);
      this.canvas.width = Math.floor(this.w * dpr);
      this.canvas.height = Math.floor(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', this._onResize);
    this._onResize();

    this.gas = false;
    this.brake = false;
    const gasBtn = this.rootEl.querySelector('#rr-gas-btn');
    const brakeBtn = this.rootEl.querySelector('#rr-brake-btn');
    gasBtn.addEventListener('pointerdown', () => { this.gas = true; });
    gasBtn.addEventListener('pointerup', () => { this.gas = false; });
    gasBtn.addEventListener('pointerleave', () => { this.gas = false; });
    brakeBtn.addEventListener('pointerdown', () => { this.brake = true; });
    brakeBtn.addEventListener('pointerup', () => { this.brake = false; });
    brakeBtn.addEventListener('pointerleave', () => { this.brake = false; });

    this._onKeyDown = (e) => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.gas = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.brake = true;
    };
    this._onKeyUp = (e) => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.gas = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.brake = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.rootEl.querySelector('#rr-quit-btn').addEventListener('click', () => {
      this._finishRun();
    });
  },

  start() {
    this.rng = mulberry32(this.seed);
    this.simTick = 0;
    this.inputs = [];
    this.car = { x: 0, y: 0, vx: 0, vy: 0, angle: 0, vAngle: 0, fuel: 1.0 };
    this.score = 0;

    this.running = true;
    this.lastTime = performance.now();
    this.acc = 0;

    const loop = (now) => {
      if (this.destroyed || !this.running) return;
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.acc += dt;
      const FIXED_DT = 1 / 120;
      while (this.acc >= FIXED_DT) {
        this._stepFixed(FIXED_DT);
        this.acc -= FIXED_DT;
      }
      this._render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  },

  _terrainY(x) {
    const amp = Math.min(75, 18 + x * 0.012);
    return Math.sin(x * 0.008) * amp + Math.cos(x * 0.019) * (amp * 0.45);
  },

  _stepFixed(dt) {
    this.simTick++;
    const c = this.car;
    c.fuel -= 0.032 * dt;
    if (c.fuel <= 0) {
      this._finishRun();
      return;
    }

    // Fuel canister every 450px
    if (Math.floor(c.x / 450) > Math.floor((c.x - c.vx * dt) / 450)) {
      c.fuel = Math.min(1.0, c.fuel + 0.45);
      sfx.playCoin();
    }

    const groundY = this._terrainY(c.x);
    const slope = (this._terrainY(c.x + 10) - groundY) / 10;
    const targetAngle = Math.atan(slope);

    if (c.y >= groundY - 4) {
      c.y = groundY;
      c.vy = 0;
      if (this.gas) c.vx = Math.min(420, c.vx + 360 * dt);
      else if (this.brake) c.vx = Math.max(0, c.vx - 420 * dt);
      else c.vx = Math.max(0, c.vx - 90 * dt);

      c.vx -= slope * 180 * dt;
      c.angle += (targetAngle - c.angle) * 10 * dt;
      c.vAngle = 0;
    } else {
      c.vy += 580 * dt;
      if (this.gas) c.vAngle -= 4.5 * dt;
      if (this.brake) c.vAngle += 4.5 * dt;
      c.angle += c.vAngle * dt;
    }

    c.x += c.vx * dt;
    c.y += c.vy * dt;

    if (c.y > groundY) {
      if (Math.cos(c.angle) < -0.35) {
        sfx.playFullBelly();
        this._finishRun();
        return;
      }
      c.y = groundY;
      c.vy = 0;
    }

    this.score = Math.max(this.score, Math.floor(c.x / 10));
    this.scoreEl.textContent = `${this.score} м`;
  },

  _render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    const camX = this.car.x - w * 0.3;
    const baseY = h * 0.62;

    // Terrain polygon
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let sx = 0; sx <= w + 20; sx += 16) {
      const wx = camX + sx;
      ctx.lineTo(sx, baseY + this._terrainY(wx));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fuel gauge
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.beginPath();
    ctx.roundRect(w * 0.5 - 70, 64, 140, 14, 7);
    ctx.fill();
    ctx.fillStyle = this.car.fuel < 0.25 ? '#ef4444' : '#facc15';
    ctx.beginPath();
    ctx.roundRect(w * 0.5 - 68, 66, Math.max(0, 136 * this.car.fuel), 10, 5);
    ctx.fill();

    // Draw Buggy + Mochi Driver!
    ctx.save();
    ctx.translate(w * 0.3, baseY + this.car.y - 18);
    ctx.rotate(this.car.angle);

    // Mochi in driver seat
    drawMiniMochi(ctx, -4, -22, 18, this.skin, this.simTick / 120);

    // Car body
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-34, -12, 68, 22, 8);
    ctx.fill();
    ctx.stroke();

    // Wheels
    [-22, 22].forEach(wx => {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(wx, 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(wx, 12, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  },

  _finishRun() {
    if (!this.running) return;
    this.running = false;
    if (this.onEnd) {
      this.onEnd({
        score: this.score,
        stats: { distance: this.score },
        inputs: this.inputs
      });
    }
  },

  destroy() {
    this.destroyed = true;
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    if (this.rootEl) this.rootEl.innerHTML = '';
  }
};
