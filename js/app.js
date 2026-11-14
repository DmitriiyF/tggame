// Mochi Pal — Main Virtual Pet Application Controller
import { CONFIG } from './config.js';
import { sfx } from './audio.js';
import { api, xpNeededForLevel, computeMoodMultiplier } from './api.js';
import { MochiStage } from './mochi-renderer.js';

import SkyStackGame from './games/sky-stack.js';
import PuffHopGame from './games/puff-hop.js';
import TimberDashGame from './games/timber-dash.js';
import BladeSpinGame from './games/blade-spin.js';
import RidgeRushGame from './games/ridge-rush.js';

const MINI_GAMES = {
  skyStack: SkyStackGame,
  puffHop: PuffHopGame,
  timberDash: TimberDashGame,
  bladeSpin: BladeSpinGame,
  ridgeRush: RidgeRushGame
};

const ROOM_ORDER = ['kitchen', 'bathroom', 'bedroom', 'playroom'];

class MochiPalApp {
  constructor() {
    this.state = null;
    this.activeRoom = 'kitchen';
    this.activeShopTab = 'food';
    this.currentGameInstance = null;
    this.lastPlayedGameId = 'skyStack';
    this.toastTimeout = null;
  }

  async init() {
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
      onDropFoodOnMouth: (item) => this.feedPet(item.id)
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
      if (this.stage.draggedFood || this.stage.soapMode) return;
      startX = e.clientX;
      startY = e.clientY;
      isSwiping = true;
    });

    wrap.addEventListener('pointermove', (e) => {
      if (!isSwiping || this.stage.draggedFood || this.stage.soapMode) return;
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
      if (this.stage.draggedFood || this.stage.soapMode) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 68 && Math.abs(dx) > Math.abs(dy) * 1.4) {
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

    // Reward modal buttons
    document.getElementById('mp-reward-again-btn').addEventListener('click', () => {
      this.closeModal('mp-modal-reward');
      this.launchMiniGame(this.lastPlayedGameId);
    });
    document.getElementById('mp-reward-back-btn').addEventListener('click', () => {
      this.closeModal('mp-modal-reward');
    });

    // Leaderboard refresh
    document.getElementById('mp-lb-refresh-btn').addEventListener('click', () => {
      sfx.playClick();
      this.refreshLeaderboard();
    });
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
    document.getElementById('mp-room-badge').textContent = `${roomCfg.icon} ${roomCfg.name} • Ур. ${tier}`;

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
      const row = document.createElement('div');
      row.className = 'mp-action-row';

      const soapBtn = document.createElement('button');
      soapBtn.className = 'mp-room-action-btn' + (this.stage.soapMode ? ' mp-btn-active' : '');
      soapBtn.innerHTML = `🧽 ${this.stage.soapMode ? 'Води по Мочи пальцем!' : 'Взять мыло (Намылить)'}`;
      soapBtn.addEventListener('click', () => {
        sfx.playBubble();
        this.stage.soapMode = !this.stage.soapMode;
        if (this.stage.soapMode) {
          // Spawn initial bubbles so even a quick click feels responsive
          const { radius } = this.stage.getPetCenter();
          for (let i = 0; i < 6; i++) {
            this.stage._addSoapBubble((Math.random() - 0.5) * radius, (Math.random() - 0.5) * radius, radius);
          }
          this.showToast('Потри Мочи пальцем/мышкой, а потом нажми «Смыть душем»! 🫧');
        }
        this.renderRoomTray();
      });

      const showerBtn = document.createElement('button');
      showerBtn.className = 'mp-room-action-btn mp-btn-blue';
      showerBtn.innerHTML = '🚿 Смыть пену душем (+Чистота)';
      showerBtn.addEventListener('click', () => {
        this.stage.soapMode = false;
        this.stage.triggerShowerRinse();
        this.renderRoomTray();
      });

      row.appendChild(soapBtn);
      row.appendChild(showerBtn);
      tray.appendChild(row);
    } else if (this.activeRoom === 'bedroom') {
      const row = document.createElement('div');
      row.className = 'mp-action-row';
      const isSleeping = this.state.pet.sleeping;

      const lampBtn = document.createElement('button');
      lampBtn.className = 'mp-room-action-btn ' + (isSleeping ? 'mp-btn-amber' : 'mp-btn-purple');
      lampBtn.innerHTML = isSleeping
        ? '☀️ Включить лампу (Разбудить Мочи)'
        : '🌙 Выключить лампу (Уложить спать +⚡)';
      lampBtn.addEventListener('click', async () => {
        const res = await api.petAction('sleepToggle');
        this.state = res.state;
        sfx.playSleepToggle(this.state.pet.sleeping);
        if (res.leveledUp) this.stage.triggerLevelUp(res.newLevel);
        this.renderAllUI();
        this.showToast(this.state.pet.sleeping ? 'Мочи сладко уснул... Энергия восстанавливается! 💤' : 'Доброе утро, Мочи! ☀️');
      });

      row.appendChild(lampBtn);
      tray.appendChild(row);
    } else if (this.activeRoom === 'playroom') {
      const row = document.createElement('div');
      row.className = 'mp-action-row';

      const arcadeBtn = document.createElement('button');
      arcadeBtn.className = 'mp-room-action-btn mp-btn-green';
      arcadeBtn.innerHTML = '🕹️ Игровой Автомат (5 Мини-Игр • Заработать 🪙)';
      arcadeBtn.addEventListener('click', () => {
        sfx.playClick();
        this.renderGamesHubModal();
        this.openModal('mp-modal-games');
      });

      const ballBtn = document.createElement('button');
      ballBtn.className = 'mp-room-action-btn';
      ballBtn.style.flex = '0 0 auto';
      ballBtn.innerHTML = '⚽ Кинуть мяч';
      ballBtn.addEventListener('click', () => {
        this.stage.ball.vy = -420;
        this.stage.ball.vx = (Math.random() < 0.5 ? -1 : 1) * 260;
        sfx.playBounce();
        this._handleBallPlay();
      });

      row.appendChild(arcadeBtn);
      row.appendChild(ballBtn);
      tray.appendChild(row);
    }
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
            <div style="font-size:11px;color:#fde047;margin-top:2px;">⚡ -${g.energy} энергии • 🎾 +${g.funGain} веселья • Множитель настроения ×${moodMult}</div>
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
    const startRes = await api.startGame(gameId);
    if (startRes.error) {
      this.showToast(startRes.error);
      return;
    }
    this.state = startRes.state;
    this.lastPlayedGameId = gameId;
    this.renderTopBar();

    const GameModule = MINI_GAMES[gameId];
    if (!GameModule) return;

    const host = document.getElementById('mp-minigame-host');
    host.classList.remove('mp-hidden');

    if (this.currentGameInstance) {
      this.currentGameInstance.destroy();
    }
    this.currentGameInstance = GameModule;

    GameModule.mount(host, {
      seed: startRes.seed,
      skin: this.state.pet.equipped,
      onEnd: async ({ score, stats, inputs }) => {
        if (this.currentGameInstance) {
          this.currentGameInstance.destroy();
          this.currentGameInstance = null;
        }
        host.classList.add('mp-hidden');

        const endRes = await api.endGame({
          runId: startRes.runId,
          gameId,
          score,
          inputs
        });
        this.state = endRes.state;
        this.renderAllUI();
        this.showRewardModal(gameId, endRes);
      }
    });

    GameModule.start();
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
  // SHOP & WARDROBE MODAL
  // ==========================================
  openShop(tab = 'food') {
    sfx.playClick();
    this.activeShopTab = tab;
    this.renderShopModal();
    this.openModal('mp-modal-shop');
  }

  renderShopModal() {
    const tabsWrap = document.getElementById('mp-shop-tabs');
    const tabs = [
      { id: 'food', label: '🍎 Еда' },
      { id: 'hats', label: '👒 Шапки' },
      { id: 'colors', label: '🎨 Цвета' },
      { id: 'skins', label: '✨ Узоры' },
      { id: 'eyes', label: '👀 Глаза' },
      { id: 'outfits', label: '🎀 Одежда' },
      { id: 'house', label: '🏠 Дом' }
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

    const items = CONFIG.shop[this.activeShopTab] || [];
    items.forEach(item => {
      const owned = item.category === 'food'
        ? ((this.state.inventory.food && this.state.inventory.food[item.id]) || 0)
        : !!(this.state.inventory.ownedCosmetics && this.state.inventory.ownedCosmetics[item.id]);
      const isEquipped = item.category !== 'food' && this.state.pet.equipped[item.category] === item.id;
      const locked = this.state.pet.level < (item.levelReq || 1);

      const rarityColors = {
        common: '#94a3b8',
        rare: '#38bdf8',
        epic: '#c084fc',
        legendary: '#fde047'
      };

      const row = document.createElement('div');
      row.className = 'mp-item-row';
      row.style.borderColor = isEquipped ? '#4ade80' : 'rgba(255,255,255,0.1)';

      const swatchHtml = item.hex
        ? `<div style="width:36px;height:36px;border-radius:50%;background:${item.hex};border:2px solid #fff;flex-shrink:0;"></div>`
        : `<div style="font-size:26px;width:36px;text-align:center;">${item.icon || '✨'}</div>`;

      const subDesc = item.category === 'food'
        ? `+${item.hunger}% сытости • +${item.fun || 5}% веселья ${owned ? `(В холодильнике: ×${owned})` : ''}`
        : `<span style="color:${rarityColors[item.rarity] || '#94a3b8'};text-transform:uppercase;font-weight:700;font-size:10px;">${item.rarity}</span>`;

      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          ${swatchHtml}
          <div>
            <div style="font-size:14px;font-weight:700;color:#f8fafc;">${item.name}</div>
            <div style="font-size:11px;color:#94a3b8;">${subDesc}</div>
          </div>
        </div>
      `;

      const btn = document.createElement('button');
      if (locked) {
        btn.className = 'mp-small-btn mp-disabled';
        btn.disabled = true;
        btn.textContent = `🔒 Ур. ${item.levelReq}`;
      } else if (item.category !== 'food' && owned) {
        btn.className = 'mp-small-btn ' + (isEquipped ? 'mp-btn-green' : '');
        btn.textContent = isEquipped ? '✓ Надето' : 'Надеть';
        btn.addEventListener('click', async () => {
          const nextId = (isEquipped && item.id !== 'sakura' && item.id !== 'normal') ? 'none' : item.id;
          const res = await api.equipItem(item.category, nextId);
          if (res.state) {
            this.state = res.state;
            sfx.playClick();
            this.renderShopModal();
          }
        });
      } else {
        const priceStr = item.price.crystals ? `${item.price.crystals} 💎` : `${item.price.coins} 🪙`;
        btn.className = 'mp-small-btn mp-btn-amber';
        btn.textContent = `Купить (${priceStr})`;
        btn.addEventListener('click', async () => {
          const res = await api.buyItem(item.id);
          if (res.error) {
            this.showToast(res.error);
          } else {
            this.state = res.state;
            sfx.playCoin();
            this.renderAllUI();
            this.renderShopModal();
            this.showToast(`Куплено: ${item.name}!`);
          }
        });
      }

      row.appendChild(btn);
      listEl.appendChild(row);
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
