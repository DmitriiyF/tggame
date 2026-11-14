// Mini-Game Module 2: Puff Hop (#ph-game-root) — Mochi Underwater Coral Swim
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
  id: 'puffHop',
  title: 'Puff Hop',
  icon: '🐡',

  mount(rootEl, { seed = 54321, skin = {}, onEnd }) {
    this.rootEl = rootEl;
    this.seed = seed;
    this.skin = skin || {};
    this.onEnd = onEnd;
    this.rafId = null;
    this.destroyed = false;

    this.rootEl.innerHTML = `
      <div id="ph-game-root" style="position:relative;width:100%;height:100%;overflow:hidden;background:linear-gradient(180deg,#0284c7,#0369a1,#0c4a6e);font-family:'Fredoka', sans-serif;user-select:none;touch-action:none;">
        <canvas id="ph-canvas" style="width:100%;height:100%;display:block;"></canvas>
        <div style="position:absolute;top:14px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;pointer-events:none;">
          <div style="background:rgba(15,23,42,0.75);border:1px solid rgba(255,255,255,0.18);padding:6px 14px;border-radius:99px;color:#f8fafc;font-size:14px;font-weight:700;font-family:'Fredoka', sans-serif;">
            🐡 Puff Hop • Тапай, чтобы плыть!
          </div>
          <div id="ph-score-val" style="font-size:36px;font-weight:700;color:#fde047;text-shadow:0 3px 10px rgba(0,0,0,0.5);font-family:'Fredoka', sans-serif;">0</div>
        </div>
        <button id="ph-quit-btn" style="position:absolute;bottom:18px;left:18px;background:rgba(15,23,42,0.8);color:#cbd5e1;border:1px solid rgba(255,255,255,0.2);border-radius:99px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Fredoka', sans-serif;">✕ Выйти</button>
      </div>
    `;

    this.canvas = this.rootEl.querySelector('#ph-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.scoreEl = this.rootEl.querySelector('#ph-score-val');

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
      if (e.target && e.target.id === 'ph-quit-btn') return;
      e.preventDefault();
      this._flap();
    };
    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this._flap();
      }
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);
    this.rootEl.querySelector('#ph-quit-btn').addEventListener('click', () => {
      this._finishRun();
    });
  },

  start() {
    this.rng = mulberry32(this.seed);
    this.simTick = 0;
    this.inputs = [];
    this.score = 0;
    this.pearls = 0;
    this.startedSwimming = false;

    this.player = {
      y: this.h * 0.46,
      vy: 0,
      r: 22
    };
    this.prevGapY = this.h * 0.46;
    this.pillars = [];

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

  _spawnPillar(spawnX) {
    const gapSize = Math.max(132, 174 - Math.floor(this.score / 10) * 5);
    const minY = 90 + gapSize * 0.5;
    const maxY = this.h - 90 - gapSize * 0.5;
    const low = Math.max(minY, this.prevGapY - 135);
    const high = Math.min(maxY, this.prevGapY + 135);
    const gapY = low + this.rng() * Math.max(1, high - low);
    this.prevGapY = gapY;

    this.pillars.push({
      x: spawnX,
      gapY,
      gapSize,
      width: 64,
      passed: false,
      hasPearl: this.rng() < 0.35,
      pearlCollected: false
    });
  },

  _flap() {
    if (!this.running) return;
    if (!this.startedSwimming) {
      this.startedSwimming = true;
      const startX = Math.min(this.w + 40, this.w * 0.28 + 380);
      this._spawnPillar(startX);
      while (this.pillars[this.pillars.length - 1].x < this.w + 80) {
        this._spawnPillar(this.pillars[this.pillars.length - 1].x + 260);
      }
    }
    this.inputs.push(this.simTick);
    this.player.vy = -380;
    sfx.playBubble();
  },

  _stepFixed(dt) {
    this.simTick++;
    if (!this.startedSwimming) {
      this.player.y = this.h * 0.46 + Math.sin(this.simTick * 0.04) * 8;
      return;
    }

    this.player.vy = Math.min(520, this.player.vy + 1080 * dt);
    this.player.y += this.player.vy * dt;

    if (this.player.y > this.h - 52 - this.player.r || this.player.y < -25) {
      sfx.playFullBelly();
      this._finishRun();
      return;
    }

    const speed = Math.min(280, 185 + this.score * 1.8);
    const px = this.w * 0.28;
    const hitR = this.player.r * 0.8;

    while (this.pillars.length > 0 && this.pillars[this.pillars.length - 1].x < this.w + 80) {
      this._spawnPillar(this.pillars[this.pillars.length - 1].x + 260);
    }

    for (let i = this.pillars.length - 1; i >= 0; i--) {
      const p = this.pillars[i];
      p.x -= speed * dt;

      if (!p.passed && p.x + p.width * 0.5 < px) {
        p.passed = true;
        this.score++;
        this.scoreEl.textContent = String(this.score);
        sfx.playCoin();
      }

      if (p.hasPearl && !p.pearlCollected) {
        const dPearl = Math.hypot(px - (p.x + p.width * 0.5), this.player.y - p.gapY);
        if (dPearl < hitR + 14) {
          p.pearlCollected = true;
          this.pearls++;
          this.score++;
          this.scoreEl.textContent = String(this.score);
          sfx.playCrystal();
        }
      }

      const topH = p.gapY - p.gapSize * 0.5;
      const botY = p.gapY + p.gapSize * 0.5;
      if (this._circleRect(px, this.player.y, hitR, p.x, -40, p.width, topH + 40) ||
          this._circleRect(px, this.player.y, hitR, p.x, botY, p.width, this.h - botY)) {
        sfx.playFullBelly();
        this._finishRun();
        return;
      }

      if (p.x + p.width < -30) {
        this.pillars.splice(i, 1);
      }
    }
  },

  _circleRect(cx, cy, r, rx, ry, rw, rh) {
    const tx = Math.max(rx, Math.min(rx + rw, cx));
    const ty = Math.max(ry, Math.min(ry + rh, cy));
    const dx = cx - tx;
    const dy = cy - ty;
    return (dx * dx + dy * dy) < (r * r);
  },

  _render() {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.clearRect(0, 0, w, h);

    // Coral Pillars
    this.pillars.forEach((p) => {
      const topH = p.gapY - p.gapSize * 0.5;
      const botY = p.gapY + p.gapSize * 0.5;
      ctx.fillStyle = '#fb7185';
      ctx.strokeStyle = '#be123c';
      ctx.lineWidth = 3;
      if (topH > 0) {
        ctx.beginPath();
        ctx.roundRect(p.x, -10, p.width, topH + 10, 12);
        ctx.fill();
        ctx.stroke();
      }
      if (botY < h) {
        ctx.beginPath();
        ctx.roundRect(p.x, botY, p.width, h - botY + 10, 12);
        ctx.fill();
        ctx.stroke();
      }
      if (p.hasPearl && !p.pearlCollected) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.5, p.gapY, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Sandy Seabed
    ctx.fillStyle = '#fde047';
    ctx.fillRect(0, h - 52, w, 52);

    // Draw Mochi inside an underwater air bubble!
    const px = w * 0.28;
    const py = this.player.y;
    drawMiniMochi(ctx, px, py, 20, this.skin, this.simTick / 120);
    ctx.save();
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.85)';
    ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  _finishRun() {
    if (!this.running) return;
    this.running = false;
    if (this.onEnd) {
      this.onEnd({
        score: this.score,
        stats: { pearls: this.pearls },
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
