// Mini-Game Module 4: Blade Spin (#bs-game-root) — Mochi Target Throw
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

function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export default {
  id: 'bladeSpin',
  title: 'Blade Spin',
  icon: '🗡',

  mount(rootEl, { seed = 24680, skin = {}, onEnd }) {
    this.rootEl = rootEl;
    this.seed = seed;
    this.skin = skin || {};
    this.onEnd = onEnd;
    this.rafId = null;
    this.destroyed = false;

    this.rootEl.innerHTML = `
      <div id="bs-game-root" style="position:relative;width:100%;height:100%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#1e293b,#090d16);font-family:'Fredoka', sans-serif;user-select:none;touch-action:none;">
        <canvas id="bs-canvas" style="width:100%;height:100%;display:block;"></canvas>
        <div style="position:absolute;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;pointer-events:none;">
          <div style="background:rgba(15,23,42,0.75);border:1px solid rgba(255,255,255,0.18);padding:6px 14px;border-radius:99px;color:#f8fafc;font-size:14px;font-weight:700;font-family:'Fredoka', sans-serif;">
            🗡 Blade Spin • <span id="bs-stage-lbl" style="color:#fde047;">Этап 1</span>
          </div>
          <div id="bs-score-val" style="font-size:36px;font-weight:700;color:#fde047;text-shadow:0 3px 10px rgba(0,0,0,0.5);font-family:'Fredoka', sans-serif;">0</div>
        </div>
        <button id="bs-quit-btn" style="position:absolute;bottom:18px;left:18px;background:rgba(15,23,42,0.8);color:#cbd5e1;border:1px solid rgba(255,255,255,0.2);border-radius:99px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Fredoka', sans-serif;">✕ Выйти</button>
      </div>
    `;

    this.canvas = this.rootEl.querySelector('#bs-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = this.rootEl.querySelector('#bs-score-val');
    this.stageEl = this.rootEl.querySelector('#bs-stage-lbl');

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

    this._onPointerDown = (e) => {
      if (e.target && e.target.id === 'bs-quit-btn') return;
      e.preventDefault();
      this._throwDagger();
    };
    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this._throwDagger();
      }
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);
    this.rootEl.querySelector('#bs-quit-btn').addEventListener('click', () => {
      this._finishRun();
    });
  },

  start() {
    this.rng = mulberry32(this.seed);
    this.simTick = 0;
    this.inputs = [];
    this.score = 0;
    this.stage = 1;
    this.theta = 0;
    this.flyingY = null;
    this._setupStage(1);

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

  _setupStage(st) {
    this.stage = st;
    this.stageEl.textContent = `Этап ${st}`;
    this.daggersLeft = Math.min(10, 5 + Math.floor(st / 2));
    this.stuck = [];
    const pre = st === 1 ? 0 : Math.min(3, Math.floor(this.rng() * 3));
    for (let i = 0; i < pre; i++) {
      const cand = this.rng() * Math.PI * 2;
      if (this.stuck.every(a => angularDistance(cand, a) > 0.35)) {
        this.stuck.push(cand);
      }
    }
  },

  _throwDagger() {
    if (!this.running || this.flyingY !== null) return;
    this.inputs.push(this.simTick);
    this.flyingY = this.h * 0.78;
    sfx.playClick();
  },

  _stepFixed(dt) {
    this.simTick++;
    const wSpeed = (1.8 + Math.min(2.2, this.stage * 0.18)) * (this.stage % 2 === 0 ? -1 : 1);
    const mod = this.stage >= 3 ? (1 + 0.65 * Math.sin(this.simTick * 0.02)) : 1;
    this.theta += wSpeed * mod * dt;

    if (this.flyingY !== null) {
      this.flyingY -= 2100 * dt;
      const targetCy = this.h * 0.34;
      const R = 92;
      if (this.flyingY <= targetCy + R) {
        this.flyingY = null;
        const local = Math.atan2(Math.sin(Math.PI / 2 - this.theta), Math.cos(Math.PI / 2 - this.theta));
        for (const a of this.stuck) {
          if (angularDistance(local, a) < 0.21) {
            sfx.playFullBelly();
            this._finishRun();
            return;
          }
        }
        this.stuck.push(local);
        this.daggersLeft--;
        this.score++;
        this.scoreEl.textContent = String(this.score);
        sfx.playBounce();
        if (this.daggersLeft <= 0) {
          sfx.playCoin();
          this._setupStage(this.stage + 1);
        }
      }
    }
  },

  _render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.34;
    const R = 92;

    // Stuck daggers
    this.stuck.forEach((a) => {
      const worldA = this.theta + a;
      ctx.save();
      ctx.translate(cx + Math.cos(worldA) * (R - 12), cy + Math.sin(worldA) * (R - 12));
      ctx.rotate(worldA - Math.PI / 2);
      this._drawDagger(ctx);
      ctx.restore();
    });

    // Wooden Target with Mochi emblem in center!
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.theta);
    ctx.fillStyle = '#fde68a';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawMiniMochi(ctx, 0, 0, 28, this.skin, 0);
    ctx.restore();

    // Flying or Ready Dagger at bottom
    const dy = this.flyingY !== null ? this.flyingY : h * 0.78;
    ctx.save();
    ctx.translate(cx, dy);
    this._drawDagger(ctx);
    ctx.restore();

    // Remaining daggers counter
    ctx.fillStyle = '#94a3b8';
    ctx.font = "700 14px 'Fredoka', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(`Осталось клинков: ${this.daggersLeft}`, cx, h * 0.89);
  },

  _drawDagger(ctx) {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-8, 42);
    ctx.lineTo(8, 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-12, 42, 24, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-5, 48, 10, 22);
  },

  _finishRun() {
    if (!this.running) return;
    this.running = false;
    if (this.onEnd) {
      this.onEnd({
        score: this.score,
        stats: { stage: this.stage },
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
    if (this.canvas && this._onPointerDown) {
      this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    }
    if (this.rootEl) this.rootEl.innerHTML = '';
  }
};
