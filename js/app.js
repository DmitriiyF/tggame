// Mochi Pal — Main Virtual Pet Application Controller
import { CONFIG } from './config.js';
import { sfx } from './audio.js';
import { api, xpNeededForLevel, computeMoodMultiplier } from './api.js';
import { MochiStage } from './mochi-renderer.js';

const ROOM_ORDER = ['kitchen', 'bathroom', 'bedroom', 'playroom'];

class MochiPalApp {
  constructor() {
    this.state = null;
    this.activeRoom = 'kitchen';
    this.activeShopTab = 'food';
    this.currentGameInstance = null;
    this.activeGameIframe = null;
    this.liveHudInterval = null;
    this.lastPlayedGameId = 'skyStack';
    this.toastTimeout = null;
    window.__mochiCloseEmbeddedGame = () => this.closeEmbeddedGame();
    window.__mochiOnRunFinished = (info) => this.handleEmbeddedRunFinished(info);
  }

  async init() {
    // If loaded inside an embedded game iframe when the user clicked "🏠 В меню" inside skystack/puffhop/etc., close the iframe in parent!
    if (window.parent && window.parent !== window && typeof window.parent.__mochiCloseEmbeddedGame === 'function') {
      window.parent.__mochiCloseEmbeddedGame();
      return;
    }

    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (tg) {
      try {
        tg.ready();
        tg.expand();
        if (typeof tg.disableVerticalSwipes === 'function') tg.disableVerticalSwipes();
        if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#0f172a');
      } catch (e) {}
    }

    this.state = await api.getState();
    sfx.soundEnabled = this.state.user.settings.sound !== false;
    sfx.hapticsEnabled = this.state.user.settings.haptics !== false;

    const canvas = document.getElementById('mp-pet-canvas');
    this.stage = new MochiStage(canvas, {
      onPetTap: () => this._handlePetTap(),
      onPetStroke: () => this._handlePetStroke(),
      onBallPlay: () => this._handleBallPlay(),
      onWashComplete: (cov) => this._handleWashComplete(cov),
      onDropFoodOnMouth: (item) => this.feedPet(item.id),
      onLampClick: () => this._handleLampClick(),
      onArcadeClick: () => {
        sfx.playClick();
        this.renderGamesHubModal();
        this.openModal('mp-modal-games');
      }
    });

    const resizeStage = () => {
      const wrap = document.getElementById('mp-stage-wrap');
      if (wrap) {
        this.stage.resize(wrap.clientWidth, wrap.clientHeight);
      }
    };
    window.addEventListener('resize', resizeStage);
    resizeStage();

    this._bindRoomSwipe();
    this._bindUIEvents();
    this.switchRoom('kitchen');
    this.renderAllUI();

    // First-session tutorial or welcome check
    if (!this.state.user.tutorialDone) {
      this.openModal('mp-modal-tutorial');
    }

    // Start 60 FPS pet render loop
    let lastNow = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      if (!this.currentGameInstance) {
        this.stage.update(dt, this.state);
        this.stage.render(this.state, this.activeRoom);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    // Periodic need refresh every 15s
    setInterval(async () => {
      this.state = await api.getState();
      this.renderTopBar();
    }, 15000);
  }

  _bindRoomSwipe() {
    const wrap = document.getElementById('mp-stage-wrap');
    let startX = 0;
    let startY = 0;
    let isSwiping = false;

    wrap.addEventListener('pointerdown', (e) => {
      if (this.stage.isInteracting()) {
        isSwiping = false;
        this.stage.roomParallaxX = 0;
        return;
      }
      startX = e.clientX;
      startY = e.clientY;
      isSwiping = true;
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!isSwiping) return;
      if (this.stage.isInteracting()) {
        isSwiping = false;
        this.stage.roomParallaxX = 0;
        return;
      }
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 15) {
        this.stage.roomParallaxX = Math.max(-1, Math.min(1, dx / 120));
      }
    });

    const finishSwipe = (e) => {
      if (!isSwiping) return;
      isSwiping = false;
      this.stage.roomParallaxX = 0;
      if (this.stage.isInteracting()) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const idx = ROOM_ORDER.indexOf(this.activeRoom);
        if (dx < 0 && idx < ROOM_ORDER.length - 1) {
          this.switchRoom(ROOM_ORDER[idx + 1]);
        } else if (dx > 0 && idx > 0) {
          this.switchRoom(ROOM_ORDER[idx - 1]);
        }
      }
    };
    wrap.addEventListener('pointerup', finishSwipe);
    wrap.addEventListener('pointercancel', () => {
      isSwiping = false;
      this.stage.roomParallaxX = 0;
    });
  }

  _bindUIEvents() {
    // Bottom nav rooms
    document.querySelectorAll('[data-room-btn]').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playClick();
        const r = btn.getAttribute('data-room-btn');
        if (r === 'shop') {
          this.openShop('food');
        } else {
          this.switchRoom(r);
        }
      });
    });

    // Top bar pills -> shop / modals
    document.getElementById('mp-coins-pill').addEventListener('click', () => this.openShop('food'));
    document.getElementById('mp-crystals-pill').addEventListener('click', () => this.openShop('colors'));
    document.getElementById('mp-room-badge').addEventListener('click', () => this.openShop('house'));
    const houseBtn = document.getElementById('mp-btn-house');
    if (houseBtn) houseBtn.addEventListener('click', () => this.openShop('house'));
    document.getElementById('mp-btn-wardrobe').addEventListener('click', () => this.openShop('hats'));
    document.getElementById('mp-btn-tasks').addEventListener('click', () => {
      sfx.playClick();
      this.renderTasksModal();
      this.openModal('mp-modal-tasks');
    });
    document.getElementById('mp-btn-leaderboard').addEventListener('click', () => {
      sfx.playClick();
      this.openModal('mp-modal-leaderboard');
      this.refreshLeaderboard();
    });
    document.getElementById('mp-pet-name-btn').addEventListener('click', () => {
      sfx.playClick();
      this.openModal('mp-modal-tutorial');
    });

    // Close modal buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        sfx.playClick();
        this.closeModal(btn.getAttribute('data-close-modal'));
      });
    });

    // Clicking on the top transparent area of the Shop bottom-sheet closes it
    const shopOverlay = document.getElementById('mp-modal-shop');
    if (shopOverlay) {
      shopOverlay.addEventListener('click', (e) => {
        if (e.target === shopOverlay) {
          sfx.playClick();
          this.closeModal('mp-modal-shop');
        }
      });
    }

    // Tutorial save pet name
    document.getElementById('mp-save-name-btn').addEventListener('click', async () => {
      const inp = document.getElementById('mp-pet-name-input');
      const val = (inp && inp.value.trim()) ? inp.value.trim() : 'Мочи';
      const res = await api.petAction('rename', { name: val });
      this.state = res.state;
      sfx.playCoin();
      this.renderTopBar();
      this.closeModal('mp-modal-tutorial');
      this.showToast(`Привет, ${this.state.pet.name}! Покорми или погладь своего питомца 💖`);
    });

    // Reward modal buttons (shown right over the active mini-game when a run ends!)
    document.getElementById('mp-reward-again-btn').addEventListener('click', () => {
      sfx.playClick();
      this.closeModal('mp-modal-reward');
      this.restartEmbeddedGameRun();
    });
    const skinsBtn = document.getElementById('mp-reward-skins-btn');
    if (skinsBtn) {
      skinsBtn.addEventListener('click', () => {
        sfx.playClick();
        this.closeModal('mp-modal-reward');
        this.openEmbeddedGameSkinsOrGarage();
      });
    }
    document.getElementById('mp-reward-back-btn').addEventListener('click', () => {
      sfx.playClick();
      this.closeModal('mp-modal-reward');
      this.closeEmbeddedGame(true);
    });

    // Leaderboard refresh
    document.getElementById('mp-lb-refresh-btn').addEventListener('click', () => {
      sfx.playClick();
      this.refreshLeaderboard();
    });

    // Enable mouse wheel horizontal scrolling on the bottom tray carousel
    const trayEl = document.getElementById('mp-room-tray');
    if (trayEl) {
      trayEl.addEventListener('wheel', (e) => {
        const carousel = trayEl.querySelector('.mp-food-carousel');
        if (carousel && e.deltaY !== 0) {
          e.preventDefault();
          carousel.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }
  }

  switchRoom(roomId) {
    if (!ROOM_ORDER.includes(roomId)) return;
    this.activeRoom = roomId;
    this.stage.soapMode = false;
    this.stage.ball.active = (roomId === 'playroom');

    document.querySelectorAll('[data-room-btn]').forEach(b => {
      b.classList.toggle('mp-active', b.getAttribute('data-room-btn') === roomId);
    });

    const roomCfg = CONFIG.rooms[roomId];
    const tier = this.state.pet.house.rooms[roomId]?.tier || 1;
    document.getElementById('mp-room-badge').textContent = `${roomCfg.icon} ${roomCfg.name} • Ур. ${tier} ⬆️`;

    this.renderRoomTray();
  }

  renderAllUI() {
    this.renderTopBar();
    this.renderRoomTray();
  }

  renderTopBar() {
    const pet = this.state.pet;
    const wallet = this.state.wallet;
    const needs = pet.needs;

    document.getElementById('mp-pet-name-txt').textContent = pet.name;
    document.getElementById('mp-lvl-num').textContent = String(pet.level);
    const xpMax = xpNeededForLevel(pet.level);
    const xpPct = Math.min(100, Math.round((pet.xp / xpMax) * 100));
    document.getElementById('mp-xp-fill').style.width = `${xpPct}%`;

    document.getElementById('mp-coins-val').textContent = Math.floor(wallet.coins).toLocaleString();
    document.getElementById('mp-crystals-val').textContent = Math.floor(wallet.crystals).toLocaleString();

    // Update 4 Circular Need Rings
    const ringMap = [
      { key: 'hunger', val: needs.hunger, color: '#fb923c' },
      { key: 'energy', val: needs.energy, color: '#facc15' },
      { key: 'hygiene', val: needs.hygiene, color: '#38bdf8' },
      { key: 'fun', val: needs.fun, color: '#f472b6' }
    ];
    const circumference = 2 * Math.PI * 16; // r=16 -> ~100.53
    ringMap.forEach(({ key, val, color }) => {
      const pct = Math.max(0, Math.min(100, val));
      const circleEl = document.getElementById(`mp-ring-${key}`);
      const wrapEl = document.getElementById(`mp-need-wrap-${key}`);
      const valEl = document.getElementById(`mp-need-val-${key}`);
      if (circleEl) {
        const offset = circumference - (pct / 100) * circumference;
        circleEl.style.strokeDasharray = `${circumference}`;
        circleEl.style.strokeDashoffset = `${offset}`;
        circleEl.style.stroke = pct < CONFIG.needs.lowThreshold ? '#ef4444' : color;
      }
      if (wrapEl) {
        wrapEl.classList.toggle('mp-pulse-low', pct < CONFIG.needs.lowThreshold);
      }
      if (valEl) {
        valEl.textContent = `${Math.round(pct)}%`;
      }
    });

    // Notification badge on Tasks button if unclaimed tasks or streak
    const hasUnclaimedTask = this.state.tasks.list.some(t => t.progress >= t.target && !t.claimed);
    const hasStreak = !this.state.user.streak.claimedToday;
    const badge = document.getElementById('mp-tasks-dot');
    if (badge) badge.style.display = (hasUnclaimedTask || hasStreak) ? 'block' : 'none';
  }

  renderRoomTray() {
    const tray = document.getElementById('mp-room-tray');
    tray.innerHTML = '';

    if (this.activeRoom === 'kitchen') {
      const foodWrap = document.createElement('div');
      foodWrap.className = 'mp-food-carousel';

      CONFIG.shop.food.forEach(item => {
        const count = (this.state.inventory.food && this.state.inventory.food[item.id]) || 0;
        const card = document.createElement('button');
        card.className = 'mp-food-card' + (count <= 0 ? ' mp-empty' : '');
        card.innerHTML = `
          <span class="mp-food-ico">${item.icon}</span>
          <span class="mp-food-name">${item.name.split(' ')[0]}</span>
          <span class="mp-food-qty">${count > 0 ? `×${count}` : `${item.price.coins ? item.price.coins + '🪙' : item.price.crystals + '💎'}`}</span>
        `;

        // Support both Drag-to-Mouth AND simple Tap-to-Feed!
        card.addEventListener('pointerdown', (e) => {
          if (count > 0) {
            const rect = document.getElementById('mp-stage-wrap').getBoundingClientRect();
            this.stage.draggedFood = {
              item,
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            };
          }
        });

        card.addEventListener('click', async () => {
          this.stage.draggedFood = null;
          if (count > 0) {
            await this.feedPet(item.id);
          } else {
            const res = await api.buyItem(item.id);
            if (res.error) {
              this.showToast(res.error);
            } else {
              this.state = res.state;
              sfx.playCoin();
              this.renderAllUI();
              this.showToast(`Куплено: ${item.icon} ${item.name}! Нажми ещё раз, чтобы покормить.`);
            }
          }
        });

        foodWrap.appendChild(card);
      });

      tray.appendChild(foodWrap);
    } else if (this.activeRoom === 'bathroom') {
      const hyg = Math.round(this.state.pet.needs.hygiene);
      const infoRow = document.createElement('div');
      infoRow.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(30,41,59,0.85);border:1px solid rgba(56,189,248,0.3);padding:10px 14px;border-radius:16px;';
      infoRow.innerHTML = `
        <div style="font-size:12px;color:#e2e8f0;line-height:1.35;">
          🧽 <b>Возьми мыло</b> слева и потри Мочи,<br>затем <b>возьми душ</b> справа и смой пену! 🚿
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:11px;color:#7dd3fc;font-weight:700;">Чистота</div>
          <div style="font-size:18px;font-weight:700;color:#38bdf8;" id="mp-bath-hyg-txt">${hyg}%</div>
        </div>
      `;
      tray.appendChild(infoRow);
    } else if (this.activeRoom === 'bedroom') {
      const isSleeping = this.state.pet.sleeping;
      const infoRow = document.createElement('div');
      infoRow.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(30,27,75,0.85);border:1px solid rgba(167,139,250,0.35);padding:10px 14px;border-radius:16px;';
      infoRow.innerHTML = `
        <div style="font-size:12px;color:#e2e8f0;line-height:1.35;">
          ${isSleeping
            ? '💤 <b>Мочи сладко спит!</b><br>Нажми на лампу на тумбочке справа, чтобы включить свет ☀️'
            : '💡 <b>Нажми прямо на лампу</b> на тумбочке справа, чтобы выключить свет и уложить Мочи спать!'}
        </div>
        <button id="mp-bedroom-decor-btn" class="mp-small-btn mp-btn-purple" style="flex-shrink:0;">🏠 Ремонт</button>
      `;
      infoRow.querySelector('#mp-bedroom-decor-btn').addEventListener('click', () => {
        this.openShop('decor');
      });
      tray.appendChild(infoRow);
    } else if (this.activeRoom === 'playroom') {
      // Interactive Game Cartridge Carousel right in the Playroom tray + Energy Multiplier badge!
      const energyMult = computeMoodMultiplier(this.state.pet.needs);
      const gameStrip = document.createElement('div');
      gameStrip.className = 'mp-food-carousel';

      Object.values(CONFIG.games).forEach(g => {
        const best = this.state.bestScores[g.id] || 0;
        const card = document.createElement('button');
        card.className = 'mp-food-card';
        card.style.minWidth = '84px';
        card.style.borderColor = g.color || 'rgba(56,189,248,0.45)';
        card.innerHTML = `
          <span class="mp-food-ico">${g.icon}</span>
          <span class="mp-food-name" style="color:#f8fafc;">${g.title}</span>
          <span class="mp-food-qty" style="color:#fde047;">🪙×${energyMult} • 🏆${best}</span>
        `;
        card.addEventListener('click', () => {
          sfx.playClick();
          this.launchMiniGame(g.id);
        });
        gameStrip.appendChild(card);
      });

      tray.appendChild(gameStrip);
    }
  }

  async _handleLampClick() {
    const res = await api.petAction('sleepToggle');
    this.state = res.state;
    sfx.playSleepToggle(this.state.pet.sleeping);
    if (res.leveledUp) this.stage.triggerLevelUp(res.newLevel);
    this.renderAllUI();
    this.showToast(this.state.pet.sleeping ? 'Мочи сладко уснул... Энергия восстанавливается! 💤' : 'Доброе утро, Мочи! ☀️');
  }

  async feedPet(itemId) {
    const res = await api.petAction('feed', { itemId });
    if (res.error) {
      this.showToast(res.error);
      return;
    }
    this.state = res.state;
    if (res.overfed) {
      this.stage.triggerChew(true);
    } else {
      this.stage.triggerChew(false);
      if (res.leveledUp) {
        setTimeout(() => this.stage.triggerLevelUp(res.newLevel), 500);
      }
    }
    this.renderAllUI();
  }

  async _handlePetTap() {
    const res = await api.petAction('pet');
    if (res && res.state) {
      this.state = res.state;
      if (res.leveledUp) this.stage.triggerLevelUp(res.newLevel);
      this.renderTopBar();
    }
  }

  async _handlePetStroke() {
    const res = await api.petAction('pet');
    if (res && res.state) {
      this.state = res.state;
      this.stage.spawnFloatingText('+Веселье 💖', '#f472b6');
      if (res.leveledUp) this.stage.triggerLevelUp(res.newLevel);
      this.renderTopBar();
    }
  }

  async _handleBallPlay() {
    const res = await api.petAction('ballPlay');
    if (res && res.state) {
      this.state = res.state;
      this.stage.spawnFloatingText('+Веселье ⚽', '#4ade80');
      if (res.leveledUp) this.stage.triggerLevelUp(res.newLevel);
      this.renderTopBar();
    }
  }

  async _handleWashComplete(coverage) {
    const res = await api.petAction('clean', { coverage });
    if (res.error) {
      this.showToast(res.error);
      return;
    }
    this.state = res.state;
    this.stage.spawnFloatingText('✨ Чистый и блестящий!', '#38bdf8');
    if (res.leveledUp) this.stage.triggerLevelUp(res.newLevel);
    this.renderAllUI();
  }

  // ==========================================
  // MINI-GAME HUB & EMBEDDED RUNNER
  // ==========================================
  renderGamesHubModal() {
    const listEl = document.getElementById('mp-games-list');
    listEl.innerHTML = '';
    const moodMult = computeMoodMultiplier(this.state.pet.needs);

    Object.values(CONFIG.games).forEach(g => {
      const locked = this.state.pet.level < (g.unlockLevel || 1);
      const best = this.state.bestScores[g.id] || 0;
      const card = document.createElement('div');
      card.className = 'mp-item-row';
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:48px;height:48px;border-radius:14px;background:rgba(56,189,248,0.15);display:flex;align-items:center;justify-content:center;font-size:26px;">${g.icon}</div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#f8fafc;">${g.title}</div>
            <div style="font-size:12px;color:#94a3b8;">${g.subtitle} • 🏆 Рекорд: ${best}</div>
            <div style="font-size:11px;color:#fde047;margin-top:2px;">🪙 Бонус энергии: ×${moodMult} (100%⚡=×1.5 • 50%⚡=×1.25 • 0%⚡=×1.0)</div>
          </div>
        </div>
      `;

      const btn = document.createElement('button');
      if (locked) {
        btn.className = 'mp-small-btn mp-disabled';
        btn.disabled = true;
        btn.textContent = `🔒 Ур. ${g.unlockLevel}`;
      } else {
        btn.className = 'mp-small-btn mp-btn-green';
        btn.textContent = '▶ Играть';
        btn.addEventListener('click', () => {
          this.closeModal('mp-modal-games');
          this.launchMiniGame(g.id);
        });
      }
      card.appendChild(btn);
      listEl.appendChild(card);
    });
  }

  async launchMiniGame(gameId) {
    const gCfg = CONFIG.games[gameId];
    if (!gCfg) return;

    const startRes = await api.startGame(gameId);
    if (startRes.error) {
      this.showToast(startRes.error);
      return;
    }
    this.state = startRes.state;
    this.lastPlayedGameId = gameId;
    this.renderTopBar();

    const host = document.getElementById('mp-minigame-host');
    host.innerHTML = '';
    host.classList.remove('mp-hidden');
    this.currentGameInstance = { id: gameId };

    // Mount the ORIGINAL standalone HTML game (skystack.html, puffhop.html, timberdash.html, bladespin.html, hillclimb.html)
    const iframe = document.createElement('iframe');
    iframe.src = gCfg.url;
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#0f172a;';
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    this.activeGameIframe = iframe;

    // Live Mochi Coin & Crystal Earning Progress Bar at bottom of screen
    const liveBar = document.createElement('div');
    liveBar.id = 'mp-live-game-hud';
    liveBar.style.cssText = "position:fixed;bottom:12px;left:12px;right:12px;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(15,23,42,0.92);border:1.5px solid rgba(253,224,71,0.45);border-radius:16px;padding:6px 10px;font-family:'Fredoka', sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.55);backdrop-filter:blur(8px);pointer-events:auto;";

    const backBtn = document.createElement('button');
    backBtn.innerHTML = '🐾 К Мочи';
    backBtn.style.cssText = "background:linear-gradient(180deg,#ec4899,#be185d);color:#fff;border:none;border-radius:11px;padding:6px 11px;font-family:'Fredoka', sans-serif;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;";
    backBtn.addEventListener('click', () => {
      this.closeEmbeddedGame();
    });

    const statsBox = document.createElement('div');
    statsBox.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:3px;min-width:0;';
    statsBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:700;">
        <span style="color:#fde047;" id="mp-live-coins-txt">🪙 ${Math.floor(this.state.wallet.coins)} (+0 🪙 • ⚡×${computeMoodMultiplier(this.state.pet.needs)})</span>
        <span style="color:#38bdf8;" id="mp-live-gems-txt">💎 ${Math.floor(this.state.wallet.crystals)}</span>
      </div>
      <div style="width:100%;height:6px;background:rgba(51,65,85,0.9);border-radius:99px;overflow:hidden;">
        <div id="mp-live-gem-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#fde047,#38bdf8);transition:width 0.15s ease;"></div>
      </div>
    `;

    liveBar.appendChild(backBtn);
    liveBar.appendChild(statsBox);

    host.appendChild(iframe);
    host.appendChild(liveBar);

    if (this.liveHudInterval) clearInterval(this.liveHudInterval);
    this.liveHudInterval = setInterval(() => this._updateLiveGameHud(gameId), 180);
  }

  _updateLiveGameHud(gameId) {
    if (!this.activeGameIframe || !this.activeGameIframe.contentDocument) return;
    const doc = this.activeGameIframe.contentDocument;
    const gCfg = CONFIG.games[gameId] || CONFIG.games.skyStack;

    const scoreIds = {
      skyStack: 'ss-score-txt',
      puffHop: 'ph-score-txt',
      timberDash: 'td-score-txt',
      bladeSpin: 'bs-score-txt',
      ridgeRush: 'rr-dist-txt'
    };
    const scoreEl = doc.getElementById(scoreIds[gameId]);
    const rawScore = scoreEl ? (parseInt(scoreEl.textContent, 10) || 0) : 0;

    const mult = this.state.lastLaunchEnergyMult || computeMoodMultiplier(this.state.pet.needs);
    const playroomTier = (this.state.pet.house && this.state.pet.house.rooms && this.state.pet.house.rooms.playroom)
      ? (this.state.pet.house.rooms.playroom.tier || 1)
      : 1;
    const roomBonus = 1 + (CONFIG.rooms.playroom.tierBonuses[playroomTier] || 0);
    const estCoins = rawScore > 0 ? Math.max(5, Math.floor(rawScore * gCfg.coinRate * mult * roomBonus)) : 0;

    // Sync wallet display if modified inside Ridge Rush garage
    let baseCoins = Math.floor(this.state.wallet.coins);
    let baseGems = Math.floor(this.state.wallet.crystals);
    try {
      const mRaw = localStorage.getItem('mochipal_state_v1');
      if (mRaw) {
        const ms = JSON.parse(mRaw);
        if (ms && ms.wallet) {
          baseCoins = Math.floor(ms.wallet.coins || 0);
          baseGems = Math.floor(ms.wallet.crystals || 0);
        }
      }
    } catch (e) {}

    const coinsTxt = document.getElementById('mp-live-coins-txt');
    const gemsTxt = document.getElementById('mp-live-gems-txt');
    const gemBar = document.getElementById('mp-live-gem-bar');

    if (coinsTxt) {
      coinsTxt.textContent = `🪙 ${baseCoins} (+${estCoins} 🪙 за забег • ⚡×${mult})`;
    }

    const milestones = gCfg.milestones || [25, 50, 100];
    const nextMs = milestones.find(m => rawScore < m) || milestones[milestones.length - 1];
    const pct = Math.min(100, Math.round((rawScore / Math.max(1, nextMs)) * 100));

    if (gemsTxt) {
      gemsTxt.textContent = `💎 ${baseGems} (до +💎: ${rawScore}/${nextMs})`;
    }
    if (gemBar) {
      gemBar.style.width = `${pct}%`;
    }
  }

  handleEmbeddedRunFinished(info = {}) {
    const syncRes = api.syncAfterStandaloneGame();
    this.state = syncRes.state;
    this.renderAllUI();

    const gId = info.gameId || syncRes.lastGameId || this.lastPlayedGameId || 'skyStack';
    const score = typeof info.score === 'number' ? info.score : syncRes.lastScore;
    const totalCoinsEarned = (syncRes.coinsEarned || 0) + (info.directCoins || 0);

    this.showRewardModal(gId, {
      reward: {
        score,
        isNewBest: score >= (this.state.bestScores[gId] || 0) && score > 0,
        bestScore: this.state.bestScores[gId] || score,
        coins: totalCoinsEarned,
        crystals: syncRes.crystalsEarned || 0,
        xp: syncRes.xpEarned || (6 + Math.floor(score / 5))
      },
      leveledUp: syncRes.leveledUp,
      newLevel: syncRes.newLevel
    });
  }

  restartEmbeddedGameRun() {
    if (!this.activeGameIframe || !this.activeGameIframe.contentDocument) {
      this.launchMiniGame(this.lastPlayedGameId);
      return;
    }
    const doc = this.activeGameIframe.contentDocument;
    const retryIds = ['ss-retry-btn', 'ph-retry-btn', 'td-retry-btn', 'bs-retry-btn', 'rr-go-retry-btn', 'rr-drive-btn'];
    for (const id of retryIds) {
      const btn = doc.getElementById(id);
      if (btn) {
        btn.click();
        return;
      }
    }
    this.activeGameIframe.contentWindow.location.reload();
  }

  openEmbeddedGameSkinsOrGarage() {
    if (!this.activeGameIframe || !this.activeGameIframe.contentDocument) return;
    const doc = this.activeGameIframe.contentDocument;
    if (this.lastPlayedGameId === 'ridgeRush') {
      // Return to Ridge Rush Garage/Upgrades screen
      this.activeGameIframe.contentWindow.location.reload();
      return;
    }
    const skinBtnIds = ['ss-themes-btn', 'ph-skins-btn', 'td-skins-btn', 'bs-skins-btn'];
    for (const id of skinBtnIds) {
      const btn = doc.getElementById(id);
      if (btn) {
        btn.click();
        return;
      }
    }
  }

  closeEmbeddedGame(skipModal = false) {
    if (this.liveHudInterval) {
      clearInterval(this.liveHudInterval);
      this.liveHudInterval = null;
    }
    this.activeGameIframe = null;

    const host = document.getElementById('mp-minigame-host');
    if (!host || host.classList.contains('mp-hidden')) return;
    host.innerHTML = '';
    host.classList.add('mp-hidden');
    this.currentGameInstance = null;

    // Sync all runs, coins, crystals, and XP earned in the standalone game!
    const syncRes = api.syncAfterStandaloneGame();
    this.state = syncRes.state;
    this.renderAllUI();

    if (!skipModal && syncRes.runsPlayed > 0) {
      const gId = syncRes.lastGameId || this.lastPlayedGameId || 'skyStack';
      this.showRewardModal(gId, {
        reward: {
          score: syncRes.lastScore,
          isNewBest: false,
          bestScore: this.state.bestScores[gId] || syncRes.lastScore,
          coins: syncRes.coinsEarned,
          crystals: syncRes.crystalsEarned,
          xp: syncRes.xpEarned
        },
        leveledUp: syncRes.leveledUp,
        newLevel: syncRes.newLevel
      });
    } else if (!skipModal) {
      this.showToast('С возвращением к Мочи! 💖');
    }
  }

  showRewardModal(gameId, endRes) {
    const gCfg = CONFIG.games[gameId];
    const rew = endRes.reward;
    sfx.playCoin();

    document.getElementById('mp-rew-game-title').textContent = `${gCfg.icon} ${gCfg.title}`;
    document.getElementById('mp-rew-score').textContent = String(rew.score);
    document.getElementById('mp-rew-best').textContent = rew.isNewBest
      ? `★ НОВЫЙ РЕКОРД: ${rew.bestScore}! ★`
      : `Лучший результат: ${rew.bestScore}`;
    document.getElementById('mp-rew-coins').textContent = `+${rew.coins} 🪙`;
    document.getElementById('mp-rew-crystals').textContent = `+${rew.crystals} 💎`;
    document.getElementById('mp-rew-xp').textContent = `+${rew.xp} XP`;

    this.openModal('mp-modal-reward');
    if (endRes.leveledUp) {
      setTimeout(() => this.stage.triggerLevelUp(endRes.newLevel), 350);
    }
  }

  // ==========================================
  // SHOP & WARDROBE MODAL (BOTTOM SHEET + 3-COL GRID + LIVE TRY-ON)
  // ==========================================
  openShop(tab = 'food') {
    sfx.playClick();
    this.activeShopTab = tab;
    this.stage.previewEquipped = null;
    this.stage.previewHouse = null;
    this.renderShopModal();
    this.openModal('mp-modal-shop');
  }

  renderShopModal() {
    const tabsWrap = document.getElementById('mp-shop-tabs');
    const tabs = [
      { id: 'food', label: '🍎 Еда' },
      { id: 'house', label: '🏠 Дом' },
      { id: 'decor', label: '🖼️ Обои' },
      { id: 'hats', label: '👒 Шапки' },
      { id: 'colors', label: '🎨 Цвета' },
      { id: 'skins', label: '✨ Узоры' },
      { id: 'eyes', label: '👀 Глаза' },
      { id: 'outfits', label: '🎀 Одежда' }
    ];
    tabsWrap.innerHTML = '';
    tabs.forEach(t => {
      const b = document.createElement('button');
      b.className = 'mp-tab-pill' + (this.activeShopTab === t.id ? ' mp-active' : '');
      b.textContent = t.label;
      b.addEventListener('click', () => {
        sfx.playClick();
        this.activeShopTab = t.id;
        this.renderShopModal();
      });
      tabsWrap.appendChild(b);
    });

    const listEl = document.getElementById('mp-shop-list');
    listEl.innerHTML = '';

    if (this.activeShopTab === 'house') {
      listEl.style.gridTemplateColumns = '1fr';

      // Quick banner to switch to Wallpapers & Rugs
      const decorBanner = document.createElement('div');
      decorBanner.className = 'mp-item-row';
      decorBanner.style.background = 'linear-gradient(90deg, rgba(99,102,241,0.28), rgba(236,72,153,0.28))';
      decorBanner.style.borderColor = 'rgba(244,114,182,0.45)';
      decorBanner.innerHTML = `
        <div>
          <div style="font-size:14px;font-weight:700;color:#fde047;">🖼️ Сменить обои и коврик в комнате</div>
          <div style="font-size:11px;color:#e2e8f0;">7 видов обоев и 5 ковриков с живой примеркой!</div>
        </div>
        <button class="mp-small-btn mp-btn-purple">Открыть 🎨</button>
      `;
      decorBanner.querySelector('button').addEventListener('click', () => {
        sfx.playClick();
        this.activeShopTab = 'decor';
        this.renderShopModal();
      });
      listEl.appendChild(decorBanner);

      Object.values(CONFIG.rooms).forEach(rCfg => {
        const curTier = this.state.pet.house.rooms[rCfg.id]?.tier || 1;
        const nextCost = rCfg.upgradeCosts[curTier + 1];
        const row = document.createElement('div');
        row.className = 'mp-item-row';
        row.innerHTML = `
          <div>
            <div style="font-size:15px;font-weight:700;color:#f8fafc;">${rCfg.icon} ${rCfg.name} (Тир ${curTier}/3)</div>
            <div style="font-size:12px;color:#94a3b8;">${nextCost ? nextCost.desc : 'Максимальный уровень комфорта открыт!'}</div>
          </div>
        `;
        const btn = document.createElement('button');
        if (!nextCost) {
          btn.className = 'mp-small-btn mp-disabled';
          btn.disabled = true;
          btn.textContent = '✓ МАКС';
        } else {
          btn.className = 'mp-small-btn mp-btn-amber';
          btn.textContent = `${nextCost.coins}🪙 + ${nextCost.crystals}💎`;
          btn.addEventListener('click', async () => {
            const res = await api.upgradeRoom(rCfg.id);
            if (res.error) {
              this.showToast(res.error);
            } else {
              this.state = res.state;
              sfx.playCrystal();
              this.switchRoom(rCfg.id);
              this.renderAllUI();
              this.renderShopModal();
              this.showToast(`Улучшена комната: ${rCfg.name}! 🎉`);
            }
          });
        }
        row.appendChild(btn);
        listEl.appendChild(row);
      });
      return;
    }

    listEl.style.gridTemplateColumns = 'repeat(3, 1fr)';
    const items = CONFIG.shop[this.activeShopTab] || [];

    items.forEach(item => {
      const isDecor = item.category === 'wallpaper' || item.category === 'rug';
      const ownedQty = item.category === 'food'
        ? ((this.state.inventory.food && this.state.inventory.food[item.id]) || 0)
        : 0;
      const isOwned = item.category !== 'food' && !!(this.state.inventory.ownedCosmetics && this.state.inventory.ownedCosmetics[item.id]);
      const isEquipped = isDecor
        ? (this.state.pet.house && this.state.pet.house[item.category] === item.id)
        : (item.category !== 'food' && this.state.pet.equipped[item.category] === item.id);
      const isPreviewing = isDecor
        ? (this.stage.previewHouse && this.stage.previewHouse[item.category] === item.id)
        : (this.stage.previewEquipped && this.stage.previewEquipped[item.category] === item.id);
      const locked = this.state.pet.level < (item.levelReq || 1);

      const card = document.createElement('div');
      card.className = 'mp-shop-card' +
        (isEquipped ? ' mp-card-equipped' : '') +
        (!isEquipped && isPreviewing ? ' mp-card-preview' : '');

      // Top-right badge (owned count or equipped check)
      let badgeHtml = '';
      if (item.category === 'food' && ownedQty > 0) {
        badgeHtml = `<span class="mp-card-badge">×${ownedQty}</span>`;
      } else if (isEquipped) {
        badgeHtml = `<span class="mp-card-badge" style="background:#22c55e;color:#052e16;">✓</span>`;
      } else if (locked) {
        badgeHtml = `<span class="mp-card-badge">🔒Ур.${item.levelReq}</span>`;
      }

      const visualHtml = item.hex
        ? `<div style="width:40px;height:40px;border-radius:50%;background:${item.gradient ? `linear-gradient(135deg,${item.gradient.join(',')})` : item.hex};border:2.5px solid #fff;margin-top:4px;box-shadow:0 3px 8px rgba(0,0,0,0.3);"></div>`
        : item.wall1
          ? `<div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(180deg,${item.wall1},${item.wall2});border:2.5px solid #fff;margin-top:4px;display:flex;align-items:center;justify-content:center;font-size:20px;">${item.icon || '🖼️'}</div>`
          : `<div style="font-size:32px;line-height:1.1;margin-top:2px;">${item.icon || '✨'}</div>`;

      const subInfo = item.category === 'food'
        ? `<div style="font-size:10px;color:#94a3b8;">+${item.hunger}% 🍎</div>`
        : `<div style="font-size:10px;color:#94a3b8;">${isOwned ? 'Куплено' : 'Примерить 👆'}</div>`;

      card.innerHTML = `
        ${badgeHtml}
        ${visualHtml}
        <div style="font-size:11px;font-weight:700;color:#f8fafc;line-height:1.15;">${item.name}</div>
        ${subInfo}
      `;

      const actionBtn = document.createElement('button');
      actionBtn.style.width = '100%';
      actionBtn.style.padding = '5px 4px';
      actionBtn.style.fontSize = '11px';
      actionBtn.style.borderRadius = '10px';

      if (locked) {
        actionBtn.className = 'mp-small-btn mp-disabled';
        actionBtn.disabled = true;
        actionBtn.textContent = `Ур. ${item.levelReq}`;
      } else if (item.category !== 'food' && isOwned) {
        actionBtn.className = 'mp-small-btn ' + (isEquipped ? 'mp-btn-green' : '');
        actionBtn.textContent = isEquipped ? '✓ Выбрано' : 'Выбрать';
      } else {
        const priceStr = item.price.crystals ? `${item.price.crystals} 💎` : `${item.price.coins} 🪙`;
        actionBtn.className = 'mp-small-btn mp-btn-amber';
        actionBtn.textContent = priceStr;
      }

      // Clicking the card previews cosmetics or room decor live!
      card.addEventListener('click', async (e) => {
        if (item.category !== 'food' && !isOwned && e.target !== actionBtn) {
          sfx.playClick();
          if (isDecor) {
            this.stage.previewHouse = {
              ...(this.stage.previewHouse || {}),
              [item.category]: item.id
            };
          } else {
            this.stage.previewEquipped = {
              ...(this.stage.previewEquipped || {}),
              [item.category]: item.id
            };
            this.stage.triggerSquash(-1.2, -70);
          }
          this.renderShopModal();
          return;
        }

        if (locked) {
          this.showToast(`Откроется на ${item.levelReq} уровне Мочи!`);
          return;
        }

        if (item.category !== 'food' && isOwned) {
          const nextId = (!isDecor && isEquipped && item.id !== 'sakura' && item.id !== 'normal') ? 'none' : item.id;
          const res = await api.equipItem(item.category, nextId);
          if (res.state) {
            this.state = res.state;
            this.stage.previewEquipped = null;
            this.stage.previewHouse = null;
            this.stage.triggerSquash(-1.1, -60);
            sfx.playClick();
            this.renderShopModal();
          }
          return;
        }

        // Buy item (Food, Cosmetic, or House Decor)
        const res = await api.buyItem(item.id);
        if (res.error) {
          this.showToast(res.error);
        } else {
          this.state = res.state;
          this.stage.previewEquipped = null;
          this.stage.previewHouse = null;
          this.stage.triggerSquash(1.3, -90);
          sfx.playCoin();
          this.renderAllUI();
          this.renderShopModal();
          this.showToast(item.category === 'food'
            ? `+1 ${item.icon} ${item.name} в холодильник!`
            : `Куплено и установлено: ${item.name}!`);
        }
      });

      card.appendChild(actionBtn);
      listEl.appendChild(card);
    });
  }

  // ==========================================
  // DAILY STREAK & TASKS MODAL
  // ==========================================
  renderTasksModal() {
    const streakBox = document.getElementById('mp-streak-box');
    const s = this.state.user.streak;
    streakBox.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <div style="font-size:15px;font-weight:700;color:#fde047;">🔥 Календарь входа: День ${s.day} из 7</div>
          <div style="font-size:12px;color:#cbd5e1;">Заходи каждый день за монетами и сундуком кристаллов!</div>
        </div>
        <button id="mp-claim-streak-btn" class="mp-small-btn ${s.claimedToday ? 'mp-disabled' : 'mp-btn-green'}" ${s.claimedToday ? 'disabled' : ''}>
          ${s.claimedToday ? '✓ Получено' : '🎁 Забрать'}
        </button>
      </div>
    `;
    const claimStreakBtn = streakBox.querySelector('#mp-claim-streak-btn');
    if (claimStreakBtn && !s.claimedToday) {
      claimStreakBtn.addEventListener('click', async () => {
        const res = await api.claimDailyStreak();
        if (res.ok) {
          this.state = res.state;
          sfx.playCrystal();
          this.renderAllUI();
          this.renderTasksModal();
          this.showToast(`День ${res.day}: +${res.coinsReward} 🪙 и +${res.crystalsReward} 💎!`);
        }
      });
    }

    const tasksList = document.getElementById('mp-tasks-list');
    tasksList.innerHTML = '';
    this.state.tasks.list.forEach(t => {
      const done = t.progress >= t.target;
      const row = document.createElement('div');
      row.className = 'mp-item-row';
      row.innerHTML = `
        <div>
          <div style="font-size:14px;font-weight:700;color:#f8fafc;">${t.title}</div>
          <div style="font-size:12px;color:#94a3b8;">Прогресс: ${t.progress} / ${t.target} • Награда: +${t.reward.coins}🪙 +${t.reward.crystals}💎</div>
        </div>
      `;
      const btn = document.createElement('button');
      if (t.claimed) {
        btn.className = 'mp-small-btn mp-disabled';
        btn.disabled = true;
        btn.textContent = '✓ Выполнено';
      } else if (done) {
        btn.className = 'mp-small-btn mp-btn-green';
        btn.textContent = 'Забрать!';
        btn.addEventListener('click', async () => {
          const res = await api.claimTask(t.id);
          if (res.ok) {
            this.state = res.state;
            sfx.playCoin();
            if (res.leveledUp) this.stage.triggerLevelUp(res.newLevel);
            this.renderAllUI();
            this.renderTasksModal();
          }
        });
      } else {
        btn.className = 'mp-small-btn mp-disabled';
        btn.disabled = true;
        btn.textContent = `${t.progress}/${t.target}`;
      }
      row.appendChild(btn);
      tasksList.appendChild(row);
    });
  }

  // ==========================================
  // GOOGLE SHEETS FRIENDS LEADERBOARD
  // ==========================================
  async refreshLeaderboard() {
    const listEl = document.getElementById('mp-lb-list');
    const statusEl = document.getElementById('mp-lb-status');
    statusEl.textContent = '⏳ Обновляем таблицу друзей...';
    listEl.innerHTML = '';

    try {
      const players = await api.syncToGoogleSheets();
      statusEl.textContent = `✅ Синхронизировано (${players.length} игроков)`;
      players.slice(0, 15).forEach((p, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        const row = document.createElement('div');
        row.className = 'mp-item-row';
        row.innerHTML = `
          <div>
            <div style="font-size:14px;font-weight:700;color:#f8fafc;">${medal} ${p.name}</div>
            <div style="font-size:11px;color:#94a3b8;">🧱${p.ssBest || 0} • 🐡${p.phBest || 0} • 🦫${p.tdBest || 0} • 🗡${p.bsBest || 0} • 🚙${p.rrBest || 0}м</div>
          </div>
          <div style="font-size:15px;font-weight:700;color:#fde047;">${(p.totalPts || 0).toLocaleString()} pts</div>
        `;
        listEl.appendChild(row);
      });
    } catch (e) {
      statusEl.textContent = 'Локальный рекорд сохранён';
    }
  }

  openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('mp-hidden');
  }

  closeModal(id) {
    if (id === 'mp-modal-shop' && this.stage) {
      this.stage.previewEquipped = null;
      this.stage.previewHouse = null;
    }
    const el = document.getElementById(id);
    if (el) el.classList.add('mp-hidden');
  }

  showToast(msg) {
    const t = document.getElementById('mp-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('mp-show');
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      t.classList.remove('mp-show');
    }, 3000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new MochiPalApp();
  app.init();
});
