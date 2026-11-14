// Mini-Game Module 1: Sky Stack (#ss-game-root) — Mochi Tower Builder
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
  id: 'skyStack',
  title: 'Sky Stack',
  icon: '🧱',

  mount(rootEl, { seed = 12345, skin = {}, onEnd }) {
    this.rootEl = rootEl;
    this.seed = seed;
    this.skin = skin || {};
    this.onEnd = onEnd;
    this.rafId = null;
    this.destroyed = false;

    this.rootEl.innerHTML = `
      <div id="ss-game-root" style="position:relative;width:100%;height:100%;overflow:hidden;background:linear-gradient(180deg,#0f172a,#1e1b4b);font-family:'Fredoka', sans-serif;user-select:none;touch-action:none;">
        <canvas id="ss-canvas" style="width:100%;height:100%;display:block;"></canvas>
        <div style="position:absolute;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;pointer-events:none;">
          <div style="background:rgba(15,23,42,0.75);border:1px solid rgba(255,255,255,0.18);padding:6px 14px;border-radius:99px;color:#f8fafc;font-size:14px;font-weight:700;font-family:'Fredoka', sans-serif;">
            🧱 Sky Stack • <span id="ss-combo-txt" style="color:#fde047;">Тапай, чтобы ставить блок!</span>
          </div>
          <div id="ss-score-val" style="font-size:36px;font-weight:700;color:#fde047;text-shadow:0 3px 10px rgba(0,0,0,0.5);font-family:'Fredoka', sans-serif;">0</div>
        </div>
        <button id="ss-quit-btn" style="position:absolute;bottom:18px;left:18px;background:rgba(15,23,42,0.8);color:#cbd5e1;border:1px solid rgba(255,255,255,0.2);border-radius:99px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Fredoka', sans-serif;">✕ Выйти</button>
      </div>
    `;

    this.canvas = this.rootEl.querySelector('#ss-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = this.rootEl.querySelector('#ss-score-val');
    this.comboEl = this.rootEl.querySelector('#ss-combo-txt');

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
      if (e.target && e.target.id === 'ss-quit-btn') return;
      e.preventDefault();
      this._placeBlock();
    };
    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this._placeBlock();
      }
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);
    this.rootEl.querySelector('#ss-quit-btn').addEventListener('click', () => {
      this._finishRun();
    });
  },

  start() {
    this.rng = mulberry32(this.seed);
    this.simTick = 0;
    this.inputs = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.camY = 0;
    this.debris = [];

    this.stack = [
      { x: 0, width: 170, y: 0, hue: 200 }
    ];
    this._spawnMoving();
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

  _spawnMoving() {
    const top = this.stack[this.stack.length - 1];
    const lvl = this.stack.length;
    const speed = Math.min(440, 185 + lvl * 8.5);
    const dir = lvl % 2 === 1 ? 1 : -1;
    this.moving = {
      x: dir * -180,
      width: top.width,
      y: lvl * 30,
      vx: dir * speed,
      hue: (200 + lvl * 14) % 360
    };
  },

  _stepFixed(dt) {
    this.simTick++;
    if (this.moving) {
      this.moving.x += this.moving.vx * dt;
      if (this.moving.x > 190) {
        this.moving.x = 190;
        this.moving.vx = -Math.abs(this.moving.vx);
      } else if (this.moving.x < -190) {
        this.moving.x = -190;
        this.moving.vx = Math.abs(this.moving.vx);
      }
    }

    const targetCamY = Math.max(0, (this.stack.length - 5) * 30);
    this.camY += (targetCamY - this.camY) * 8 * dt;

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vy += 680 * dt;
      d.x += d.vx * dt;
      d.y -= d.vy * dt;
      d.life -= dt;
      if (d.life <= 0) this.debris.splice(i, 1);
    }
  },

  _placeBlock() {
    if (!this.running || !this.moving) return;
    this.inputs.push(this.simTick);

    const prev = this.stack[this.stack.length - 1];
    const cur = this.moving;
    const delta = cur.x - prev.x;
    const absDelta = Math.abs(delta);

    if (absDelta >= cur.width) {
      // Missed completely -> Game Over
      sfx.playFullBelly();
      this._finishRun();
      return;
    }

    let newWidth = cur.width - absDelta;
    let newX = prev.x + delta * 0.5;

    if (absDelta <= 6) {
      // Perfect snap!
      newWidth = prev.width;
      newX = prev.x;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (this.combo >= 4 && newWidth < 170) {
        newWidth = Math.min(170, newWidth + 10);
      }
      sfx.playCoin();
      this.comboEl.textContent = `✨ ИДЕАЛЬНО ×${this.combo}!`;
    } else {
      this.combo = 0;
      sfx.playBounce();
      this.comboEl.textContent = 'Отлично! Продолжай!';
      // Falling sliced piece
      const cutW = absDelta;
      const cutX = delta > 0 ? (newX + newWidth * 0.5 + cutW * 0.5) : (newX - newWidth * 0.5 - cutW * 0.5);
      this.debris.push({
        x: cutX,
        y: cur.y,
        width: cutW,
        hue: cur.hue,
        vx: delta > 0 ? 75 : -75,
        vy: 0,
        life: 0.8
      });
    }

    this.stack.push({
      x: newX,
      width: newWidth,
      y: cur.y,
      hue: cur.hue
    });

    this.score++;
    this.scoreEl.textContent = String(this.score);
    this._spawnMoving();
  },

  _render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    const baseScreenY = h * 0.76 + this.camY;
    const centerX = w * 0.5;

    // Draw stacked blocks
    this.stack.forEach((b) => {
      const sy = baseScreenY - b.y;
      if (sy < -60 || sy > h + 60) return;
      this._drawBlock(ctx, centerX + b.x, sy, b.width, 28, b.hue);
    });

    // Draw falling debris
    this.debris.forEach((d) => {
      const sy = baseScreenY - d.y;
      this._drawBlock(ctx, centerX + d.x, sy, d.width, 28, d.hue);
    });

    // Draw active moving block
    if (this.moving) {
      const sy = baseScreenY - this.moving.y;
      this._drawBlock(ctx, centerX + this.moving.x, sy, this.moving.width, 28, this.moving.hue);
    }

    // Draw Mochi cheering on top of the highest placed block!
    const top = this.stack[this.stack.length - 1];
    const mochiY = baseScreenY - top.y - 34;
    drawMiniMochi(ctx, centerX + top.x, mochiY, 22, this.skin, this.simTick / 120);
  },

  _drawBlock(ctx, cx, cy, width, height, hue) {
    ctx.save();
    ctx.fillStyle = `hsl(${hue}, 82%, 62%)`;
    ctx.strokeStyle = `hsl(${hue}, 85%, 42%)`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(cx - width * 0.5, cy - height, width, height, 6);
    ctx.fill();
    ctx.stroke();

    // Top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(cx - width * 0.5 + 4, cy - height + 3, Math.max(0, width - 8), 5);
    ctx.restore();
  },

  _finishRun() {
    if (!this.running) return;
    this.running = false;
    if (this.onEnd) {
      this.onEnd({
        score: this.score,
        stats: { maxCombo: this.maxCombo },
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
