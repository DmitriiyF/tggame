// Mochi Pal — Layered Canvas 2D Pet Renderer & Spring Physics
import { CONFIG } from './config.js';
import { sfx } from './audio.js';

export class MochiStage {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.callbacks = callbacks;

    this.width = 360;
    this.height = 420;
    this.time = 0;

    // Spring physics for squash & stretch (k=180, damping=12)
    this.scaleX = 1.0;
    this.scaleY = 1.0;
    this.velScaleX = 0;
    this.velScaleY = 0;
    this.jumpY = 0;
    this.velJumpY = 0;

    // Blinking & ear wiggle timers
    this.blinkTimer = 3.2;
    this.blinkDuration = 0;
    this.earWiggleTimer = 4.5;
    this.earWigglePhase = 0;

    // Eye tracking target
    this.lookTargetX = 0;
    this.lookTargetY = 0;
    this.curLookX = 0;
    this.curLookY = 0;

    // Interactive states
    this.chewTimer = 0;
    this.fullBellyTimer = 0;
    this.petStrokeTimer = 0;
    this.lastPetRewardAt = 0;
    this.strokeDistance = 0;
    this.isPointerDownOnPet = false;

    // Bathroom soap & shower state
    this.soapMode = false;
    this.showerTimer = 0;
    this.foamBubbles = []; // { ox, oy, r, alpha }

    // Playroom bouncing ball
    this.ball = {
      active: false,
      x: 85,
      y: 260,
      vx: 140,
      vy: -220,
      r: 24,
      rot: 0,
      lastFunAt: 0
    };

    // Particles (hearts, crumbs, zzz, confetti, water, floating text)
    this.particles = [];
    this.roomParallaxX = 0;

    // Dragging food item
    this.draggedFood = null; // { item, x, y }

    this._bindEvents();
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(280, w);
    this.height = Math.max(280, h);
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.ball.x > this.width - 30) this.ball.x = this.width - 40;
    if (this.ball.y > this.height - 40) this.ball.y = this.height - 60;
  }

  getPetCenter() {
    return {
      cx: this.width * 0.5,
      cy: this.height * 0.60 + this.jumpY,
      radius: Math.min(this.width, this.height) * 0.23
    };
  }

  triggerSquash(impulseY = -1.65, jumpVy = 0) {
    this.velScaleY += impulseY;
    this.velScaleX -= impulseY * 0.78;
    if (jumpVy !== 0) {
      this.velJumpY = jumpVy;
    }
  }

  triggerChew(isOverfed = false) {
    if (isOverfed) {
      this.fullBellyTimer = 1.6;
      this.triggerSquash(-2.1, -90);
      sfx.playFullBelly();
      this.spawnFloatingText('Ой, пузико полное! 🤭', '#fde047');
    } else {
      this.chewTimer = 1.3;
      this.triggerSquash(1.35, -140);
      sfx.playChew();
      const { cx, cy } = this.getPetCenter();
      for (let i = 0; i < 10; i++) {
        this.particles.push({
          type: 'crumb',
          x: cx + (Math.random() - 0.5) * 32,
          y: cy + 12,
          vx: (Math.random() - 0.5) * 140,
          vy: -40 - Math.random() * 90,
          r: 2.5 + Math.random() * 3,
          color: i % 2 === 0 ? '#fde047' : '#fb923c',
          life: 0.65,
          maxLife: 0.65
        });
      }
      this.spawnHearts(cx, cy - 45, 3);
    }
  }

  triggerLevelUp(newLevel) {
    this.triggerSquash(2.2, -320);
    sfx.playLevelUp();
    const { cx, cy } = this.getPetCenter();
    this.spawnFloatingText(`🎉 УРОВЕНЬ ${newLevel}!`, '#fde047');
    const colors = ['#f472b6', '#38bdf8', '#fde047', '#4ade80', '#c084fc', '#fb923c'];
    for (let i = 0; i < 36; i++) {
      const ang = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.2;
      const spd = 120 + Math.random() * 220;
      this.particles.push({
        type: 'confetti',
        x: cx,
        y: cy - 20,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 120,
        color: colors[i % colors.length],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        life: 1.4,
        maxLife: 1.4
      });
    }
  }

  triggerShowerRinse() {
    if (this.foamBubbles.length === 0 && this.showerTimer <= 0) {
      // Even without soap, allow a quick splash and +small hygiene or hint
      for (let i = 0; i < 6; i++) {
        this.foamBubbles.push({
          ox: (Math.random() - 0.5) * 70,
          oy: (Math.random() - 0.5) * 60,
          r: 12 + Math.random() * 8
        });
      }
    }
    const coverage = Math.min(1, this.foamBubbles.length / 14);
    this.showerTimer = 1.25;
    sfx.playShower();
    if (this.callbacks.onWashComplete) {
      this.callbacks.onWashComplete(Math.max(0.35, coverage));
    }
  }

  spawnHearts(x, y, count = 2) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        type: 'heart',
        x: x + (Math.random() - 0.5) * 50,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 45,
        vy: -55 - Math.random() * 45,
        size: 15 + Math.random() * 8,
        life: 0.95,
        maxLife: 0.95
      });
    }
  }

  spawnFloatingText(text, color = '#fde047') {
    const { cx, cy, radius } = this.getPetCenter();
    this.particles.push({
      type: 'text',
      text,
      x: cx,
      y: cy - radius - 22,
      vx: 0,
      vy: -42,
      color,
      life: 1.15,
      maxLife: 1.15
    });
  }

  _bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      sfx.init();
      const pos = getPos(e);
      const { cx, cy, radius } = this.getPetCenter();
      this.lookTargetX = (pos.x - cx) / Math.max(1, this.width * 0.5);
      this.lookTargetY = (pos.y - cy) / Math.max(1, this.height * 0.5);

      // Check Playroom ball hit first
      if (this.ball.active) {
        const dxB = pos.x - this.ball.x;
        const dyB = pos.y - this.ball.y;
        if (Math.hypot(dxB, dyB) <= this.ball.r + 22) {
          this.ball.vx = (dxB < 0 ? 1 : -1) * (180 + Math.random() * 140);
          this.ball.vy = -340 - Math.random() * 120;
          sfx.playBounce();
          const now = performance.now();
          if (now - this.ball.lastFunAt > 2200) {
            this.ball.lastFunAt = now;
            this.spawnHearts(cx, cy - radius, 2);
            if (this.callbacks.onBallPlay) this.callbacks.onBallPlay();
          }
          return;
        }
      }

      const distToPet = Math.hypot(pos.x - cx, pos.y - cy);
      if (distToPet <= radius * 1.28) {
        this.isPointerDownOnPet = true;
        this.strokeDistance = 0;
        this.lastPointerPos = pos;

        if (this.soapMode) {
          this._addSoapBubble(pos.x - cx, pos.y - cy, radius);
          return;
        }

        // Squash & stretch jelly reaction on tap!
        this.triggerSquash(-1.75, -110);
        sfx.playGiggle();
        this.spawnHearts(pos.x, pos.y - 16, 2);
        if (this.callbacks.onPetTap) this.callbacks.onPetTap();
      }
    });

    window.addEventListener('pointermove', (e) => {
      const pos = getPos(e);
      const { cx, cy, radius } = this.getPetCenter();
      this.lookTargetX = Math.max(-1, Math.min(1, (pos.x - cx) / (this.width * 0.45)));
      this.lookTargetY = Math.max(-1, Math.min(1, (pos.y - cy) / (this.height * 0.45)));

      if (this.draggedFood) {
        this.draggedFood.x = pos.x;
        this.draggedFood.y = pos.y;
        return;
      }

      if (!this.isPointerDownOnPet) return;
      const distToPet = Math.hypot(pos.x - cx, pos.y - cy);
      if (distToPet <= radius * 1.35) {
        if (this.soapMode) {
          this._addSoapBubble(pos.x - cx, pos.y - cy, radius);
        } else if (this.lastPointerPos) {
          const step = Math.hypot(pos.x - this.lastPointerPos.x, pos.y - this.lastPointerPos.y);
          this.strokeDistance += step;
          this.lastPointerPos = pos;
          if (this.strokeDistance > 42) {
            this.strokeDistance = 0;
            this.petStrokeTimer = 0.65;
            this.triggerSquash(0.65, 0);
            this.spawnHearts(pos.x, pos.y - 18, 1);
            const now = performance.now();
            if (now - this.lastPetRewardAt > 3000) {
              this.lastPetRewardAt = now;
              sfx.playPurr();
              if (this.callbacks.onPetStroke) this.callbacks.onPetStroke();
            }
          }
        }
      }
    });

    window.addEventListener('pointerup', () => {
      this.isPointerDownOnPet = false;
      if (this.draggedFood) {
        const { cx, cy, radius } = this.getPetCenter();
        const d = Math.hypot(this.draggedFood.x - cx, this.draggedFood.y - cy);
        const foodItem = this.draggedFood.item;
        this.draggedFood = null;
        if (d <= radius * 1.35 && this.callbacks.onDropFoodOnMouth) {
          this.callbacks.onDropFoodOnMouth(foodItem);
        }
      }
    });
  }

  _addSoapBubble(ox, oy, radius) {
    if (this.foamBubbles.length < 28) {
      const clampedDist = Math.hypot(ox, oy);
      if (clampedDist <= radius * 0.98) {
        this.foamBubbles.push({
          ox: ox + (Math.random() - 0.5) * 14,
          oy: oy + (Math.random() - 0.5) * 14,
          r: 11 + Math.random() * 11
        });
        sfx.playBubble();
      }
    }
  }

  update(dt, state) {
    this.time += dt;

    // 1. Spring physics for Squash & Stretch (k=180, damping=12)
    const k = 180;
    const damp = 12;
    const breathTargetY = 1.0 + Math.sin((this.time * Math.PI * 2) / 2.5) * 0.025;
    const breathTargetX = 1.0 - Math.sin((this.time * Math.PI * 2) / 2.5) * 0.015;

    const ay = -k * (this.scaleY - breathTargetY) - damp * this.velScaleY;
    const ax = -k * (this.scaleX - breathTargetX) - damp * this.velScaleX;
    this.velScaleY += ay * dt;
    this.velScaleX += ax * dt;
    this.scaleY = Math.max(0.68, Math.min(1.36, this.scaleY + this.velScaleY * dt));
    this.scaleX = Math.max(0.68, Math.min(1.36, this.scaleX + this.velScaleX * dt));

    // Jump physics
    if (this.jumpY < 0 || this.velJumpY !== 0) {
      this.velJumpY += 980 * dt;
      this.jumpY += this.velJumpY * dt;
      if (this.jumpY >= 0) {
        this.jumpY = 0;
        if (Math.abs(this.velJumpY) > 60) {
          this.triggerSquash(-0.9, 0);
        }
        this.velJumpY = 0;
      }
    }

    // 2. Blink & Ear Wiggle
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkDuration = 0.14;
      this.blinkTimer = 2.2 + Math.random() * 3.8;
    }
    if (this.blinkDuration > 0) this.blinkDuration -= dt;

    this.earWiggleTimer -= dt;
    if (this.earWiggleTimer <= 0) {
      this.earWigglePhase = 0.45;
      this.earWiggleTimer = 3.5 + Math.random() * 4.5;
    }
    if (this.earWigglePhase > 0) this.earWigglePhase = Math.max(0, this.earWigglePhase - dt);

    if (this.chewTimer > 0) this.chewTimer = Math.max(0, this.chewTimer - dt);
    if (this.fullBellyTimer > 0) this.fullBellyTimer = Math.max(0, this.fullBellyTimer - dt);
    if (this.petStrokeTimer > 0) this.petStrokeTimer = Math.max(0, this.petStrokeTimer - dt);

    // Shower rinse animation
    if (this.showerTimer > 0) {
      this.showerTimer = Math.max(0, this.showerTimer - dt);
      const { cx, cy, radius } = this.getPetCenter();
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          type: 'water',
          x: cx + (Math.random() - 0.5) * radius * 1.9,
          y: cy - radius * 1.55,
          vx: (Math.random() - 0.5) * 20,
          vy: 240 + Math.random() * 120,
          life: 0.55,
          maxLife: 0.55
        });
      }
      if (this.foamBubbles.length > 0 && Math.random() < 0.45) {
        this.foamBubbles.pop();
      }
      if (this.showerTimer === 0) {
        this.foamBubbles = [];
      }
    }

    // Sleeping Zzz particles
    if (state && state.pet && state.pet.sleeping && Math.random() < dt * 1.4) {
      const { cx, cy, radius } = this.getPetCenter();
      this.particles.push({
        type: 'zzz',
        x: cx + radius * 0.55,
        y: cy - radius * 0.65,
        vx: 18 + Math.random() * 14,
        vy: -38 - Math.random() * 15,
        size: 16 + Math.random() * 8,
        life: 1.6,
        maxLife: 1.6
      });
    }

    // Smooth eye tracking
    this.curLookX += (this.lookTargetX - this.curLookX) * Math.min(1, dt * 10);
    this.curLookY += (this.lookTargetY - this.curLookY) * Math.min(1, dt * 10);

    // 3. Playroom Ball physics
    if (this.ball.active) {
      const floorY = this.height * 0.78;
      this.ball.vy += 680 * dt;
      this.ball.x += this.ball.vx * dt;
      this.ball.y += this.ball.vy * dt;
      this.ball.rot += (this.ball.vx * dt) / this.ball.r;

      if (this.ball.x < this.ball.r + 14) {
        this.ball.x = this.ball.r + 14;
        this.ball.vx = Math.abs(this.ball.vx) * 0.82;
      } else if (this.ball.x > this.width - this.ball.r - 14) {
        this.ball.x = this.width - this.ball.r - 14;
        this.ball.vx = -Math.abs(this.ball.vx) * 0.82;
      }

      if (this.ball.y > floorY - this.ball.r) {
        this.ball.y = floorY - this.ball.r;
        if (Math.abs(this.ball.vy) > 95) sfx.playBounce();
        this.ball.vy = -Math.abs(this.ball.vy) * 0.72;
        this.ball.vx *= 0.94;
        if (Math.abs(this.ball.vy) < 45) this.ball.vy = 0;
      }

      // Bounce off Mochi!
      const { cx, cy, radius } = this.getPetCenter();
      const dx = this.ball.x - cx;
      const dy = this.ball.y - cy;
      const dist = Math.hypot(dx, dy);
      const minDist = radius * 0.92 + this.ball.r;
      if (dist < minDist && dist > 1) {
        const nx = dx / dist;
        const ny = dy / dist;
        this.ball.x = cx + nx * minDist;
        this.ball.y = cy + ny * minDist;
        this.ball.vx = nx * 240;
        this.ball.vy = Math.min(-180, ny * 260);
        this.triggerSquash(-1.1, -60);
        sfx.playBounce();
      }

      // Look at ball in playroom
      this.lookTargetX = Math.max(-1, Math.min(1, (this.ball.x - cx) / (this.width * 0.45)));
      this.lookTargetY = Math.max(-1, Math.min(1, (this.ball.y - cy) / (this.height * 0.45)));
    }

    // 4. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      if (p.type === 'crumb' || p.type === 'confetti') {
        p.vy += 320 * dt;
      }
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      if (p.vrot) p.rot += p.vrot * dt;
    }
  }

  render(state, activeRoom) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.clearRect(0, 0, w, h);

    const pet = (state && state.pet) ? state.pet : {
      name: 'Мочи',
      level: 1,
      needs: { hunger: 80, energy: 85, hygiene: 90, fun: 80 },
      sleeping: false,
      equipped: { color: 'sakura', skin: 'none', eyes: 'normal', hat: 'sprout', outfit: 'none' },
      house: { rooms: { kitchen: { tier: 1 }, bathroom: { tier: 1 }, bedroom: { tier: 1 }, playroom: { tier: 1 } } }
    };

    const roomTier = (pet.house && pet.house.rooms && pet.house.rooms[activeRoom])
      ? (pet.house.rooms[activeRoom].tier || 1)
      : 1;

    // 1. Draw Room Background + Furniture based on room & tier
    this._drawRoomBackground(ctx, w, h, activeRoom, roomTier, pet.sleeping);

    // 2. Draw Mochi Pet (Layered back-to-front)
    const { cx, cy, radius } = this.getPetCenter();
    this._drawMochiCharacter(ctx, cx, cy, radius, pet);

    // 3. Draw Bathroom Shower Head & Soap Foam
    if (activeRoom === 'bathroom') {
      this._drawBathroomExtras(ctx, cx, cy, radius);
    }

    // 4. Draw Playroom Bouncing Toy Ball
    if (this.ball.active) {
      this._drawToyBall(ctx, this.ball);
    }

    // 5. Draw Bedroom Dark Sleep Overlay
    if (pet.sleeping) {
      ctx.save();
      ctx.fillStyle = 'rgba(8, 12, 28, 0.56)';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // 6. Draw Particles (hearts, crumbs, zzz, water, confetti, floating text)
    this._drawParticles(ctx);

    // 7. Draw Dragged Food Item (if dragging to mouth)
    if (this.draggedFood && this.draggedFood.item) {
      ctx.save();
      ctx.font = "42px 'Fredoka', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 10;
      ctx.fillText(this.draggedFood.item.icon, this.draggedFood.x, this.draggedFood.y);
      ctx.restore();
    }
  }

  _drawRoomBackground(ctx, w, h, room, tier, isSleeping) {
    const floorY = h * 0.76;
    const px = this.roomParallaxX * 14;

    // Wall colors per room & tier
    const palettes = {
      kitchen: {
        wall1: tier >= 3 ? '#fef3c7' : tier === 2 ? '#ffedd5' : '#fff1f2',
        wall2: tier >= 3 ? '#fde68a' : tier === 2 ? '#fed7aa' : '#ffe4e6',
        floor1: '#fdba74',
        floor2: '#ea580c',
        stripe: 'rgba(251, 146, 60, 0.14)'
      },
      bathroom: {
        wall1: tier >= 3 ? '#ccfbf1' : '#e0f2fe',
        wall2: tier >= 3 ? '#5eead4' : '#bae6fd',
        floor1: '#38bdf8',
        floor2: '#0284c7',
        stripe: 'rgba(56, 189, 248, 0.16)'
      },
      bedroom: {
        wall1: '#312e81',
        wall2: '#1e1b4b',
        floor1: '#4c1d95',
        floor2: '#2e1065',
        stripe: 'rgba(167, 139, 250, 0.10)'
      },
      playroom: {
        wall1: tier >= 3 ? '#3b0764' : '#1e293b',
        wall2: tier >= 3 ? '#1e1b4b' : '#0f172a',
        floor1: '#334155',
        floor2: '#1e293b',
        stripe: 'rgba(56, 189, 248, 0.10)'
      }
    };
    const pal = palettes[room] || palettes.kitchen;

    // Wall gradient
    const wallGrad = ctx.createLinearGradient(0, 0, 0, floorY);
    wallGrad.addColorStop(0, pal.wall1);
    wallGrad.addColorStop(1, pal.wall2);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, w, floorY);

    // Wallpaper stripes
    ctx.fillStyle = pal.stripe;
    for (let x = -20 + (px % 36); x < w + 20; x += 36) {
      ctx.fillRect(x, 0, 14, floorY);
    }

    // Floor gradient
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, h);
    floorGrad.addColorStop(0, pal.floor1);
    floorGrad.addColorStop(1, pal.floor2);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, w, h - floorY);

    // Baseboard trim
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, floorY - 6, w, 8);

    // Cozy rug under Mochi
    ctx.save();
    ctx.translate(w * 0.5 + px * 0.4, floorY + 28);
    ctx.fillStyle = tier >= 3 ? '#fde047' : tier === 2 ? '#38bdf8' : '#f472b6';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.34, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    // Room-specific furniture & window props
    ctx.save();
    ctx.translate(px, 0);

    if (room === 'kitchen') {
      // Cozy Window on left
      this._drawWindow(ctx, w * 0.2, h * 0.24, 72, 82, false);
      // Fridge on right
      ctx.fillStyle = tier >= 3 ? '#fde047' : '#f8fafc';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      this._roundRect(ctx, w * 0.72, floorY - 145, 76, 145, 14, true, true);
      ctx.beginPath();
      ctx.moveTo(w * 0.72, floorY - 82);
      ctx.lineTo(w * 0.72 + 76, floorY - 82);
      ctx.stroke();
      // Handles
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(w * 0.72 + 10, floorY - 115, 6, 22);
      ctx.fillRect(w * 0.72 + 10, floorY - 68, 6, 28);
    } else if (room === 'bathroom') {
      // Tile grid on wall
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.18)';
      ctx.lineWidth = 1.5;
      for (let y = 40; y < floorY; y += 32) {
        ctx.beginPath();
        ctx.moveTo(-20, y);
        ctx.lineTo(w + 20, y);
        ctx.stroke();
      }
      // Mirror behind Mochi
      ctx.fillStyle = '#e0f2fe';
      ctx.strokeStyle = tier >= 2 ? '#fde047' : '#38bdf8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(w * 0.22, h * 0.28, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Bathtub rim on right
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 3;
      this._roundRect(ctx, w * 0.70, floorY - 65, 86, 65, 18, true, true);
    } else if (room === 'bedroom') {
      // Night starry window
      this._drawWindow(ctx, w * 0.22, h * 0.24, 78, 88, true);
      // Nightstand + Lamp on right
      ctx.fillStyle = '#78350f';
      this._roundRect(ctx, w * 0.74, floorY - 58, 64, 58, 8, true, false);
      // Lamp stand
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(w * 0.74 + 28, floorY - 86, 8, 28);
      // Lamp shade
      ctx.fillStyle = isSleeping ? '#475569' : '#fde047';
      ctx.beginPath();
      ctx.moveTo(w * 0.74 + 12, floorY - 84);
      ctx.lineTo(w * 0.74 + 52, floorY - 84);
      ctx.lineTo(w * 0.74 + 44, floorY - 114);
      ctx.lineTo(w * 0.74 + 20, floorY - 114);
      ctx.closePath();
      ctx.fill();
    } else if (room === 'playroom') {
      // Neon Arcade Cabinet on right
      ctx.fillStyle = '#4f46e5';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      this._roundRect(ctx, w * 0.71, floorY - 142, 78, 142, 12, true, true);
      // Arcade Screen
      ctx.fillStyle = '#0ea5e9';
      this._roundRect(ctx, w * 0.71 + 10, floorY - 122, 58, 46, 6, true, false);
      ctx.fillStyle = '#fde047';
      ctx.font = "700 11px 'Fredoka', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('ARCADE', w * 0.71 + 39, floorY - 128);
      ctx.font = "22px 'Fredoka', sans-serif";
      ctx.fillText('🕹️', w * 0.71 + 39, floorY - 92);
      // Trophy shelf on left
      ctx.fillStyle = '#334155';
      this._roundRect(ctx, w * 0.10, h * 0.25, 76, 12, 4, true, false);
      ctx.font = "22px 'Fredoka', sans-serif";
      ctx.fillText(tier >= 2 ? '🏆 ⭐ 👑' : '🏆 🎮', w * 0.10 + 38, h * 0.25 - 6);
    }

    ctx.restore();
  }

  _drawWindow(ctx, x, y, w, h, isNight) {
    ctx.save();
    ctx.fillStyle = isNight ? '#0f172a' : '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    this._roundRect(ctx, x - w / 2, y - h / 2, w, h, 12, true, true);
    if (isNight) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(x - 12, y - 14, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(x - 6, y - 17, 9, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(x + 14, y - 16, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    // Window crossbars
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x, y + h / 2);
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x + w / 2, y);
    ctx.stroke();
    ctx.restore();
  }

  _drawMochiCharacter(ctx, cx, cy, r, pet) {
    const eq = pet.equipped || {};
    const needs = pet.needs || { hunger: 80, energy: 80, hygiene: 80, fun: 80 };
    const colorObj = CONFIG.shop.colors.find(c => c.id === eq.color) || CONFIG.shop.colors[0];

    // 1. Floor Shadow
    const shadowScale = Math.max(0.55, 1 + this.jumpY / 350) * this.scaleX;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, this.height * 0.60 + r * 0.96, r * 0.88 * shadowScale, r * 0.22 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy + r * 0.9);
    ctx.scale(this.scaleX, this.scaleY);
    ctx.translate(0, -r * 0.9);

    // 2. Tail (back layer)
    const tailWag = Math.sin(this.time * 4.5) * 0.22;
    ctx.save();
    ctx.translate(r * 0.82, r * 0.38);
    ctx.rotate(tailWag);
    ctx.fillStyle = colorObj.shade || colorObj.hex;
    ctx.beginPath();
    ctx.ellipse(10, 0, r * 0.22, r * 0.15, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Fairy Wings (if equipped outfit === 'wings')
    if (eq.outfit === 'wings') {
      const flap = Math.sin(this.time * 8) * 0.18;
      [-1, 1].forEach(dir => {
        ctx.save();
        ctx.translate(dir * r * 0.72, -r * 0.1);
        ctx.scale(dir, 1);
        ctx.rotate(flap);
        ctx.fillStyle = 'rgba(186, 230, 253, 0.78)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(26, -14, 32, 18, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(20, 12, 22, 13, 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }

    // 4. Rounded Ears (with occasional ear wiggle)
    const earWig = this.earWigglePhase > 0 ? Math.sin(this.time * 32) * 0.22 : Math.sin(this.time * 2.2) * 0.04;
    [-1, 1].forEach(dir => {
      ctx.save();
      ctx.translate(dir * r * 0.56, -r * 0.76);
      ctx.rotate(dir * (0.32 + earWig));
      ctx.fillStyle = colorObj.hex;
      ctx.strokeStyle = colorObj.shade || '#db2777';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.26, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Inner ear pink
      ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 2, r * 0.13, r * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 5. Squishy Mochi Body Silhouette
    ctx.save();
    this._traceMochiBodyPath(ctx, r);

    if (eq.skin === 'rainbow') {
      const hue = (this.time * 50) % 360;
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, `hsl(${hue}, 90%, 75%)`);
      g.addColorStop(0.5, `hsl(${(hue + 120) % 360}, 90%, 75%)`);
      g.addColorStop(1, `hsl(${(hue + 240) % 360}, 90%, 75%)`);
      ctx.fillStyle = g;
    } else if (colorObj.gradient) {
      const g = ctx.createLinearGradient(0, -r, 0, r);
      colorObj.gradient.forEach((col, idx) => {
        g.addColorStop(idx / (colorObj.gradient.length - 1), col);
      });
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
      g.addColorStop(0, colorObj.hex);
      g.addColorStop(1, colorObj.shade || colorObj.hex);
      ctx.fillStyle = g;
    }
    ctx.fill();

    // 6. Clipped Skin Pattern + Belly Patch
    ctx.clip();
    this._drawSkinPattern(ctx, r, eq.skin);

    // Belly Patch
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.34, r * 0.56, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Top-left glossy jelly shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.42, -r * 0.48, r * 0.22, r * 0.11, -0.55, 0, Math.PI * 2);
    ctx.fill();

    // Dirty smudges when hygiene < 35
    if (needs.hygiene < 35) {
      ctx.fillStyle = 'rgba(120, 53, 15, 0.38)';
      ctx.beginPath();
      ctx.arc(-r * 0.45, r * 0.25, r * 0.18, 0, Math.PI * 2);
      ctx.arc(r * 0.48, -r * 0.12, r * 0.14, 0, Math.PI * 2);
      ctx.arc(r * 0.18, r * 0.52, r * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Body outline
    ctx.save();
    this._traceMochiBodyPath(ctx, r);
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // 7. Rosy Cheeks
    ctx.fillStyle = 'rgba(244, 63, 94, 0.38)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.46, r * 0.04, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(r * 0.46, r * 0.04, r * 0.15, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // 8. Expressive Eyes (tracking cursor/finger)
    this._drawEyes(ctx, r, pet);

    // 9. Expressive Mouth (mood / chewing / sleeping / overfed)
    this._drawMouth(ctx, r, pet);

    // 10. Neck / Face Outfits (bowtie, scarf, medal, glasses)
    this._drawOutfit(ctx, r, eq.outfit);

    // 11. Hat on top of head
    this._drawHat(ctx, r, eq.hat);

    // 12. Stink lines if dirty
    if (needs.hygiene < 35) {
      ctx.save();
      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      [-r * 0.5, 0, r * 0.5].forEach((ox, i) => {
        const wave = Math.sin(this.time * 5 + i) * 6;
        ctx.beginPath();
        ctx.moveTo(ox, -r * 1.05);
        ctx.quadraticCurveTo(ox + wave, -r * 1.25, ox - wave, -r * 1.45);
        ctx.stroke();
      });
      ctx.restore();
    }

    ctx.restore();
  }

  _traceMochiBodyPath(ctx, r) {
    // Soft pear/mochi bun silhouette (wider & flatter at bottom, round on top)
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.88);
    ctx.bezierCurveTo(r * 0.72, -r * 0.88, r * 1.06, -r * 0.32, r * 1.04, r * 0.25);
    ctx.bezierCurveTo(r * 1.02, r * 0.78, r * 0.68, r * 0.92, 0, r * 0.92);
    ctx.bezierCurveTo(-r * 0.68, r * 0.92, -r * 1.02, r * 0.78, -r * 1.04, r * 0.25);
    ctx.bezierCurveTo(-r * 1.06, -r * 0.32, -r * 0.72, -r * 0.88, 0, -r * 0.88);
    ctx.closePath();
  }

  _drawSkinPattern(ctx, r, skinId) {
    if (!skinId || skinId === 'none') return;
    ctx.save();
    if (skinId === 'spots') {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.22)';
      [
        [-0.55, -0.35, 0.18],
        [0.58, -0.28, 0.15],
        [-0.68, 0.18, 0.14],
        [0.62, 0.24, 0.17]
      ].forEach(([x, y, sr]) => {
        ctx.beginPath();
        ctx.arc(x * r, y * r, sr * r, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (skinId === 'stripes') {
      ctx.fillStyle = 'rgba(120, 53, 15, 0.26)';
      [-0.45, -0.15, 0.15].forEach(y => {
        ctx.beginPath();
        ctx.ellipse(-r * 0.85, y * r, r * 0.28, r * 0.07, 0.2, 0, Math.PI * 2);
        ctx.ellipse(r * 0.85, y * r, r * 0.28, r * 0.07, -0.2, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (skinId === 'hearts') {
      ctx.font = `${Math.round(r * 0.24)}px 'Fredoka', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('💖', -r * 0.58, -r * 0.25);
      ctx.fillText('💖', r * 0.58, -r * 0.25);
      ctx.fillText('💖', -r * 0.62, r * 0.32);
      ctx.fillText('💖', r * 0.62, r * 0.32);
    } else if (skinId === 'candy') {
      const cols = ['#f43f5e', '#38bdf8', '#fde047', '#4ade80', '#a855f7'];
      for (let i = 0; i < 18; i++) {
        const ang = i * 1.7;
        const dist = (0.35 + (i % 4) * 0.16) * r;
        ctx.save();
        ctx.translate(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.8);
        ctx.rotate(i);
        ctx.fillStyle = cols[i % cols.length];
        this._roundRect(ctx, -6, -3, 12, 6, 3, true, false);
        ctx.restore();
      }
    } else if (skinId === 'galaxy') {
      ctx.fillStyle = 'rgba(30, 27, 75, 0.45)';
      ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < 12; i++) {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + i);
        const sx = Math.cos(i * 2.3) * r * 0.62;
        const sy = Math.sin(i * 1.7) * r * 0.55;
        ctx.beginPath();
        ctx.arc(sx, sy, (2 + (i % 3)) * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawEyes(ctx, r, pet) {
    const eq = pet.equipped || {};
    const style = eq.eyes || 'normal';
    const needs = pet.needs || { hunger: 80, energy: 80, hygiene: 80, fun: 80 };
    const eyeY = -r * 0.14;
    const eyeSep = r * 0.34;
    const lookOx = this.curLookX * r * 0.08;
    const lookOy = this.curLookY * r * 0.07;

    // Closed eyes if sleeping or blinking or being stroked happily
    if (pet.sleeping || this.blinkDuration > 0 || this.petStrokeTimer > 0 || style === 'happy_arc') {
      ctx.save();
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      [-1, 1].forEach(dir => {
        const ex = dir * eyeSep + lookOx * 0.4;
        ctx.beginPath();
        if (this.petStrokeTimer > 0 || style === 'happy_arc') {
          ctx.arc(ex, eyeY + 4, r * 0.13, Math.PI * 1.1, Math.PI * 1.9);
        } else {
          ctx.arc(ex, eyeY - 2, r * 0.13, Math.PI * 0.15, Math.PI * 0.85);
        }
        ctx.stroke();
      });
      ctx.restore();
      return;
    }

    if (style === 'cyber') {
      ctx.save();
      ctx.fillStyle = '#0ea5e9';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, -eyeSep * 1.45 + lookOx, eyeY - r * 0.13 + lookOy, eyeSep * 2.9, r * 0.26, 10, true, true);
      ctx.restore();
      return;
    }

    [-1, 1].forEach((dir, idx) => {
      const ex = dir * eyeSep + lookOx;
      const ey = eyeY + lookOy;

      if (style === 'wink' && idx === 1) {
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.12, ey - r * 0.06);
        ctx.lineTo(ex + r * 0.1, ey);
        ctx.lineTo(ex - r * 0.12, ey + r * 0.07);
        ctx.stroke();
        return;
      }

      if (style === 'heart_eyes') {
        ctx.font = `${Math.round(r * 0.34)}px 'Fredoka', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❤️', ex, ey);
        return;
      }

      // Base dark pupil oval
      ctx.fillStyle = style === 'fire' ? '#7c2d12' : '#0f172a';
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.145, r * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eye shine highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - r * 0.045, ey - r * 0.055, r * 0.055, 0, Math.PI * 2);
      ctx.arc(ex + r * 0.045, ey + r * 0.045, r * 0.026, 0, Math.PI * 2);
      ctx.fill();

      if (style === 'sparkle') {
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(ex, ey + r * 0.02, r * 0.035, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'cute') {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ex + dir * r * 0.11, ey - r * 0.11);
        ctx.lineTo(ex + dir * r * 0.19, ey - r * 0.17);
        ctx.stroke();
      } else if (style === 'fire') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(ex, ey + r * 0.03, r * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tired / Sleepy half-lids when energy < 30
      if (needs.energy < 30) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.beginPath();
        ctx.arc(ex, ey, r * 0.16, Math.PI, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  _drawMouth(ctx, r, pet) {
    const needs = pet.needs || { hunger: 80, energy: 80, hygiene: 80, fun: 80 };
    const avgMood = (needs.hunger + needs.energy + needs.hygiene + needs.fun) / 4;
    const my = r * 0.04 + this.curLookY * r * 0.04;
    const mx = this.curLookX * r * 0.05;

    ctx.save();
    ctx.translate(mx, my);
    ctx.strokeStyle = '#1e293b';
    ctx.fillStyle = '#f43f5e';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    if (this.chewTimer > 0) {
      // Chewing open/close mouth animation
      const openAmt = Math.abs(Math.sin(this.time * 18)) * r * 0.14 + r * 0.04;
      ctx.beginPath();
      ctx.ellipse(0, 4, r * 0.14, openAmt, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.fullBellyTimer > 0) {
      // Funny wavy full-belly mouth
      ctx.beginPath();
      ctx.moveTo(-r * 0.16, 4);
      ctx.quadraticCurveTo(-r * 0.08, -4, 0, 4);
      ctx.quadraticCurveTo(r * 0.08, 12, r * 0.16, 4);
      ctx.stroke();
    } else if (pet.sleeping) {
      // Cute tiny sleeping 'o' mouth
      ctx.beginPath();
      ctx.arc(0, 5, r * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (avgMood < 32 || needs.hunger < 25) {
      // Sad frown
      ctx.beginPath();
      ctx.arc(0, r * 0.14, r * 0.13, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    } else if (avgMood >= 70 || this.petStrokeTimer > 0) {
      // Big happy cat/mochi smile :3
      ctx.beginPath();
      ctx.arc(-r * 0.075, 0, r * 0.075, 0.15, Math.PI - 0.15);
      ctx.arc(r * 0.075, 0, r * 0.075, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else {
      // Gentle smile
      ctx.beginPath();
      ctx.arc(0, -2, r * 0.12, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawOutfit(ctx, r, outfitId) {
    if (!outfitId || outfitId === 'none') return;
    ctx.save();
    if (outfitId === 'bowtie') {
      ctx.translate(0, r * 0.32);
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-22, -13);
      ctx.lineTo(-22, 13);
      ctx.closePath();
      ctx.moveTo(0, 0);
      ctx.lineTo(22, -13);
      ctx.lineTo(22, 13);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (outfitId === 'scarf') {
      ctx.translate(0, r * 0.28);
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 2.5;
      this._roundRect(ctx, -r * 0.62, -10, r * 1.24, 22, 10, true, true);
      this._roundRect(ctx, r * 0.18, 6, 22, 36, 8, true, true);
    } else if (outfitId === 'glasses') {
      const ey = -r * 0.14 + this.curLookY * r * 0.06;
      const sep = r * 0.34;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      this._roundRect(ctx, -sep - 20, ey - 14, 38, 26, 6, true, true);
      this._roundRect(ctx, sep - 18, ey - 14, 38, 26, 6, true, true);
      ctx.beginPath();
      ctx.moveTo(-sep + 18, ey - 2);
      ctx.lineTo(sep - 18, ey - 2);
      ctx.stroke();
    } else if (outfitId === 'medal') {
      ctx.translate(0, r * 0.36);
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-24, -18);
      ctx.lineTo(0, 6);
      ctx.lineTo(24, -18);
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 12, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawHat(ctx, r, hatId) {
    if (!hatId || hatId === 'none') return;
    ctx.save();
    ctx.translate(0, -r * 0.85);

    if (hatId === 'sprout') {
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.quadraticCurveTo(2, -18, 0, -24);
      ctx.stroke();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(-12, -24, 13, 7, -0.35, 0, Math.PI * 2);
      ctx.ellipse(12, -24, 13, 7, 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (hatId === 'flower') {
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 14, -10 + Math.sin(a) * 14, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, -10, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (hatId === 'cap') {
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(0, 4, r * 0.45, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d4ed8';
      this._roundRect(ctx, -r * 0.1, -4, r * 0.65, 10, 5, true, false);
    } else if (hatId === 'beanie') {
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(0, 6, r * 0.48, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fda4af';
      this._roundRect(ctx, -r * 0.50, -4, r * 1.0, 14, 7, true, false);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -r * 0.46, 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (hatId === 'chef') {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-16, -24, 16, 0, Math.PI * 2);
      ctx.arc(16, -24, 16, 0, Math.PI * 2);
      ctx.arc(0, -32, 18, 0, Math.PI * 2);
      ctx.fill();
      this._roundRect(ctx, -26, -16, 52, 20, 4, true, true);
    } else if (hatId === 'bunny') {
      [-1, 1].forEach(dir => {
        ctx.save();
        ctx.translate(dir * 20, -4);
        ctx.rotate(dir * 0.12);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, -24, 11, 28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        ctx.ellipse(0, -24, 5.5, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    } else if (hatId === 'frog') {
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(0, 6, r * 0.46, Math.PI, Math.PI * 2);
      ctx.fill();
      [-18, 18].forEach(ox => {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(ox, -r * 0.38, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox, -r * 0.38, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(ox, -r * 0.38, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (hatId === 'headphones') {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, r * 0.45, r * 0.86, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      ctx.fillStyle = '#0284c7';
      this._roundRect(ctx, -r * 0.94, r * 0.18, 18, 36, 8, true, false);
      this._roundRect(ctx, r * 0.94 - 18, r * 0.18, 18, 36, 8, true, false);
    } else if (hatId === 'pirate') {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-44, 4);
      ctx.quadraticCurveTo(0, -38, 44, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = "16px 'Fredoka', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('☠️', 0, -4);
    } else if (hatId === 'wizard') {
      ctx.fillStyle = '#4f46e5';
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 2, 46, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.lineTo(4, -52);
      ctx.lineTo(28, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.font = "14px 'Fredoka', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('★', 0, -16);
    } else if (hatId === 'crown') {
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-28, 4);
      ctx.lineTo(-32, -26);
      ctx.lineTo(-14, -10);
      ctx.lineTo(0, -32);
      ctx.lineTo(14, -10);
      ctx.lineTo(32, -26);
      ctx.lineTo(28, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -10, 4.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (hatId === 'halo') {
      const hover = Math.sin(this.time * 4) * 4;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.ellipse(0, -24 + hover, 32, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawBathroomExtras(ctx, cx, cy, r) {
    // Draw accumulated soap foam bubbles on Mochi
    if (this.foamBubbles.length > 0) {
      ctx.save();
      this.foamBubbles.forEach(b => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.strokeStyle = '#bae6fd';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx + b.ox, cy + b.oy, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx + b.ox - b.r * 0.3, cy + b.oy - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    // Draw Overhead Shower Nozzle when rinsing
    if (this.showerTimer > 0) {
      ctx.save();
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      this._roundRect(ctx, cx - 34, cy - r * 1.85, 68, 16, 8, true, true);
      ctx.restore();
    }
  }

  _drawToyBall(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.fillStyle = '#ef4444';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawParticles(ctx) {
    this.particles.forEach(p => {
      const alpha = Math.max(0, Math.min(1, p.life / (p.maxLife || 1)));
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.type === 'heart') {
        ctx.font = `${Math.round(p.size)}px 'Fredoka', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('💖', p.x, p.y);
      } else if (p.type === 'zzz') {
        ctx.font = `700 ${Math.round(p.size)}px 'Fredoka', sans-serif`;
        ctx.fillStyle = '#93c5fd';
        ctx.textAlign = 'center';
        ctx.fillText('Zzz', p.x, p.y);
      } else if (p.type === 'crumb') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'water') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 3, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'confetti') {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-5, -3, 10, 6);
      } else if (p.type === 'text') {
        ctx.font = "700 16px 'Fredoka', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillStyle = p.color || '#fde047';
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 6;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.restore();
    });
  }

  _roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}

// Standalone helper so mini-games and wardrobe preview can draw Mochi's head/body with equipped cosmetics!
export function drawMiniMochi(ctx, x, y, radius, equipped = {}, time = 0) {
  const colorObj = CONFIG.shop.colors.find(c => c.id === equipped.color) || CONFIG.shop.colors[0];
  ctx.save();
  ctx.translate(x, y);

  // Ears
  [-1, 1].forEach(dir => {
    ctx.save();
    ctx.translate(dir * radius * 0.56, -radius * 0.72);
    ctx.rotate(dir * 0.3);
    ctx.fillStyle = colorObj.hex;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.25, radius * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Body
  ctx.fillStyle = colorObj.hex;
  ctx.strokeStyle = colorObj.shade || '#db2777';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belly
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.3, radius * 0.52, radius * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-radius * 0.32, -radius * 0.1, radius * 0.13, 0, Math.PI * 2);
  ctx.arc(radius * 0.32, -radius * 0.1, radius * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-radius * 0.36, -radius * 0.14, radius * 0.045, 0, Math.PI * 2);
  ctx.arc(radius * 0.28, -radius * 0.14, radius * 0.045, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 2, radius * 0.14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Hat indicator
  if (equipped.hat === 'crown') {
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.45, -radius * 0.82);
    ctx.lineTo(-radius * 0.5, -radius * 1.25);
    ctx.lineTo(0, -radius * 0.98);
    ctx.lineTo(radius * 0.5, -radius * 1.25);
    ctx.lineTo(radius * 0.45, -radius * 0.82);
    ctx.closePath();
    ctx.fill();
  } else if (equipped.hat === 'sprout') {
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(-6, -radius * 1.08, 7, 4, -0.3, 0, Math.PI * 2);
    ctx.ellipse(6, -radius * 1.08, 7, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (equipped.hat === 'cap') {
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(0, -radius * 0.78, radius * 0.46, Math.PI, Math.PI * 2);
    ctx.fill();
  } else if (equipped.hat && equipped.hat !== 'none') {
    const hatItem = CONFIG.shop.hats.find(h => h.id === equipped.hat);
    if (hatItem && hatItem.icon) {
      ctx.font = `${Math.round(radius * 0.7)}px 'Fredoka', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(hatItem.icon, 0, -radius * 0.9);
    }
  }

  ctx.restore();
}
