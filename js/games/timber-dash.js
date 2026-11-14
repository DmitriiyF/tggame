// Mini-Game Module 3: Timber Dash (#td-game-root) — Mochi Lumberjack
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
  id: 'timberDash',
  title: 'Timber Dash',
  icon: '🦫',

  mount(rootEl, { seed = 98765, skin = {}, onEnd }) {
    this.rootEl = rootEl;
    this.seed = seed;
    this.skin = skin || {};
    this.onEnd = onEnd;
    this.rafId = null;
    this.destroyed = false;

    this.rootEl.innerHTML = `
      <div id="td-game-root" style="position:relative;width:100%;height:100%;overflow:hidden;background:linear-gradient(180deg,#38bdf8,#bae6fd,#4ade80);font-family:'Fredoka', sans-serif;user-select:none;touch-action:none;">
        <canvas id="td-canvas" style="width:100%;height:100%;display:block;"></canvas>
        <div style="position:absolute;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;pointer-events:none;">
          <div style="background:rgba(15,23,42,0.75);border:1px solid rgba(255,255,255,0.18);padding:6px 14px;border-radius:99px;color:#f8fafc;font-size:14px;font-weight:700;font-family:'Fredoka', sans-serif;">
            🦫 Timber Dash • Тапай влево / вправо!
          </div>
          <div id="td-score-val" style="font-size:36px;font-weight:700;color:#fde047;text-shadow:0 3px 10px rgba(0,0,0,0.5);font-family:'Fredoka', sans-serif;">0</div>
        </div>
        <button id="td-quit-btn" style="position:absolute;bottom:18px;left:18px;background:rgba(15,23,42,0.8);color:#cbd5e1;border:1px solid rgba(255,255,255,0.2);border-radius:99px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Fredoka', sans-serif;">✕ Выйти</button>
      </div>
    `;

    this.canvas = this.rootEl.querySelector('#td-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = this.rootEl.querySelector('#td-score-val');

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
      if (e.target && e.target.id === 'td-quit-btn') return;
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const side = (e.clientX - rect.left) < this.w * 0.5 ? 'left' : 'right';
      this._chop(side);
    };
    this._onKeyDown = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this._chop('left');
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') this._chop('right');
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);
    this.rootEl.querySelector('#td-quit-btn').addEventListener('click', () => {
      this._finishRun();
    });
  },

  start() {
    this.rng = mulberry32(this.seed);
    this.simTick = 0;
    this.inputs = [];
    this.score = 0;
    this.side = 'left';
    this.timeBar = 0.55;
    this.started = false;
    this.prevHadBranch = false;
    this.genCount = 0;

    this.tree = [];
    for (let i = 0; i < 8; i++) {
      this.tree.push(this._nextSeg());
    }

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

  _nextSeg() {
    this.genCount++;
    if (this.genCount <= 3 || this.prevHadBranch) {
      this.prevHadBranch = false;
      return { branch: 'none' };
    }
    if (this.rng() < 0.58) {
      this.prevHadBranch = true;
      return { branch: this.rng() < 0.5 ? 'left' : 'right' };
    }
    this.prevHadBranch = false;
    return { branch: 'none' };
  },

  _chop(side) {
    if (!this.running) return;
    this.started = true;
    this.side = side;
    this.inputs.push(side === 'left' ? 0 : 1);

    if (this.tree[0].branch === side) {
      sfx.playFullBelly();
      this._finishRun();
      return;
    }

    this.tree.shift();
    this.tree.push(this._nextSeg());

    if (this.tree[0].branch === side) {
      sfx.playFullBelly();
      this._finishRun();
      return;
    }

    this.score++;
    this.scoreEl.textContent = String(this.score);
    this.timeBar = Math.min(1, this.timeBar + 0.048);
    sfx.playChew();
  },

  _stepFixed(dt) {
    this.simTick++;
    if (!this.started) return;
    const drain = (0.14 + Math.min(0.28, this.score * 0.0018)) * dt;
    this.timeBar -= drain;
    if (this.timeBar <= 0) {
      sfx.playFullBelly();
      this._finishRun();
    }
  },

  _render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    const baseY = h * 0.78;
    const cx = w * 0.5;

    // Ground
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, baseY, w, h - baseY);

    // Tree segments
    this.tree.forEach((seg, idx) => {
      const sy = baseY - (idx + 1) * 72;
      ctx.fillStyle = idx % 2 === 0 ? '#78350f' : '#92400e';
      ctx.fillRect(cx - 46, sy, 92, 72);

      if (seg.branch !== 'none') {
        const dir = seg.branch === 'left' ? -1 : 1;
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.roundRect(dir < 0 ? cx - 46 - 108 : cx + 46, sy + 20, 108, 24, 10);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(cx + dir * 138, sy + 28, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Time bar
    ctx.fillStyle = 'rgba(15,23,42,0.75)';
    ctx.beginPath();
    ctx.roundRect(cx - 90, 68, 180, 16, 8);
    ctx.fill();
    ctx.fillStyle = this.timeBar < 0.25 ? '#ef4444' : '#4ade80';
    ctx.beginPath();
    ctx.roundRect(cx - 88, 70, Math.max(0, 176 * this.timeBar), 12, 6);
    ctx.fill();

    // Draw Mochi Lumberjack on chosen side!
    const mx = this.side === 'left' ? cx - 102 : cx + 102;
    drawMiniMochi(ctx, mx, baseY - 28, 28, this.skin, this.simTick / 120);
  },

  _finishRun() {
    if (!this.running) return;
    this.running = false;
    if (this.onEnd) {
      this.onEnd({
        score: this.score,
        stats: { chops: this.score },
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
