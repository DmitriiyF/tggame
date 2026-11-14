// Mochi Pal — Pure Client Storage Engine (localStorage + Telegram CloudStorage + Google Sheets Sync)
import { CONFIG } from './config.js';

const STORAGE_KEY = 'mochipal_state_v1';
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function xpNeededForLevel(lvl) {
  return Math.floor(CONFIG.xp.base * Math.pow(lvl, CONFIG.xp.exp));
}

export function computeMoodMultiplier(needs) {
  const energy = (needs && typeof needs.energy === 'number') ? needs.energy : 100;
  if (energy >= 80) return 1.5;
  if (energy >= 40) return 1.25;
  return 1.0;
}

class MochiStateEngine {
  constructor() {
    this.activeRuns = new Map();
    this.state = this._loadLocalState();
    this._syncStandaloneGamesProgress();
    this._loadFromTelegramCloud();
  }

  _createDefaultState() {
    const tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
    const today = getTodayStr();
    let existingGems = 12;
    try {
      const g = parseInt(localStorage.getItem('arcade_global_gems'), 10);
      if (!isNaN(g) && g > 0) existingGems = g;
    } catch (e) {}

    return {
      user: {
        tgId: tgUser && tgUser.id ? String(tgUser.id) : (localStorage.getItem('arcade_anon_id') || (() => {
          const id = 'p_' + Math.floor(Math.random() * 900000 + 100000);
          try { localStorage.setItem('arcade_anon_id', id); } catch (e) {}
          return id;
        })()),
        name: tgUser && tgUser.first_name ? tgUser.first_name : 'Друг Мочи',
        tutorialDone: false,
        streak: {
          day: 1,
          lastClaimDate: '',
          claimedToday: false
        },
        settings: {
          sound: true,
          haptics: true,
          notifications: true
        }
      },
      pet: {
        name: 'Мочи',
        level: 1,
        xp: 0,
        needs: {
          hunger: 78,
          energy: 88,
          hygiene: 82,
          fun: 75
        },
        sleeping: false,
        lastUpdate: Date.now(),
        equipped: {
          color: 'sakura',
          skin: 'none',
          eyes: 'normal',
          hat: 'sprout',
          outfit: 'none'
        },
        house: {
          wallpaper: 'wall_default',
          rug: 'rug_pink',
          rooms: {
            kitchen: { tier: 1 },
            bathroom: { tier: 1 },
            bedroom: { tier: 1 },
            playroom: { tier: 1 }
          }
        }
      },
      wallet: {
        coins: 180,
        crystals: existingGems,
        dailyEarned: {
          date: today,
          coins: 0,
          crystals: 0
        }
      },
      inventory: {
        food: {
          apple: 3,
          onigiri: 2,
          dango: 1
        },
        ownedCosmetics: {
          sakura: true,
          none: true,
          normal: true,
          sprout: true,
          wall_default: true,
          rug_pink: true
        }
      },
      bestScores: {
        skyStack: 0,
        puffHop: 0,
        timberDash: 0,
        bladeSpin: 0,
        ridgeRush: 0
      },
      tasks: this._generateDailyTasks(today),
      achievements: {
        totalFeeds: 0,
        totalWashes: 0,
        totalGames: 0,
        claimed: {}
      }
    };
  }

  _generateDailyTasks(dateStr) {
    return {
      date: dateStr,
      list: [
        { id: 'feed_2', title: '🍎 Покорми Мочи 2 раза', progress: 0, target: 2, reward: { coins: 60, crystals: 1 }, claimed: false },
        { id: 'wash_1', title: '🛁 Помой Мочи мылом и душем', progress: 0, target: 1, reward: { coins: 50, crystals: 1 }, claimed: false },
        { id: 'play_2', title: '🕹️ Сыграй 2 раза в мини-игры', progress: 0, target: 2, reward: { coins: 80, crystals: 2 }, claimed: false },
        { id: 'score_25', title: '🏆 Набери 25 очков в любой мини-игре', progress: 0, target: 25, reward: { coins: 100, crystals: 2 }, claimed: false }
      ]
    };
  }

  _loadLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.pet && parsed.wallet) {
          if (!parsed.pet.house) parsed.pet.house = { rooms: { kitchen: { tier: 1 }, bathroom: { tier: 1 }, bedroom: { tier: 1 }, playroom: { tier: 1 } } };
          if (!parsed.pet.house.wallpaper) parsed.pet.house.wallpaper = 'wall_default';
          if (!parsed.pet.house.rug) parsed.pet.house.rug = 'rug_pink';
          if (!parsed.inventory) parsed.inventory = { food: {}, ownedCosmetics: {} };
          if (!parsed.inventory.ownedCosmetics) parsed.inventory.ownedCosmetics = {};
          parsed.inventory.ownedCosmetics.wall_default = true;
          parsed.inventory.ownedCosmetics.rug_pink = true;
          return parsed;
        }
      }
    } catch (e) {}
    return this._createDefaultState();
  }

  _loadFromTelegramCloud() {
    if (!tg || !tg.CloudStorage || !tg.isVersionAtLeast || !tg.isVersionAtLeast('6.9')) return;
    try {
      tg.CloudStorage.getItem(STORAGE_KEY, (err, val) => {
        if (!err && val) {
          try {
            const cloudState = JSON.parse(val);
            if (cloudState && cloudState.pet && (cloudState.pet.level > this.state.pet.level || cloudState.wallet.coins > this.state.wallet.coins)) {
              this.state = cloudState;
              this._saveLocalState();
            }
          } catch (e) {}
        }
      });
    } catch (e) {}
  }

  // Merge records, runs & gems from standalone games (skystack.html, puffhop.html, timberdash.html, bladespin.html, hillclimb.html)
  _syncStandaloneGamesProgress() {
    let summary = { runsPlayed: 0, coinsEarned: 0, crystalsEarned: 0, xpEarned: 0, leveledUp: false, newLevel: this.state.pet.level, lastScore: 0, lastGameId: 'skyStack' };
    try {
      const bs = this.state.bestScores;
      const ssBest = parseInt(localStorage.getItem('skystack_best_v1'), 10) || 0;
      if (ssBest > (bs.skyStack || 0)) bs.skyStack = ssBest;

      const phRaw = localStorage.getItem('puffhop_save_v1');
      if (phRaw) {
        const d = JSON.parse(phRaw);
        if ((d.best || 0) > (bs.puffHop || 0)) bs.puffHop = d.best;
      }

      const tdRaw = localStorage.getItem('timberdash_save_v1');
      if (tdRaw) {
        const d = JSON.parse(tdRaw);
        if ((d.best || 0) > (bs.timberDash || 0)) bs.timberDash = d.best;
      }

      const bsRaw = localStorage.getItem('bladespin_save_v1');
      if (bsRaw) {
        const d = JSON.parse(bsRaw);
        if ((d.bestScore || 0) > (bs.bladeSpin || 0)) bs.bladeSpin = d.bestScore;
      }

      const rrRaw = localStorage.getItem('ridge_rush_save_v1');
      if (rrRaw) {
        const d = JSON.parse(rrRaw);
        const maxRR = d.bestDist ? Math.max(0, ...Object.values(d.bestDist)) : 0;
        if (maxRR > (bs.ridgeRush || 0)) bs.ridgeRush = maxRR;
      }

      // Clear legacy companion pet (fox/drone) in arcade_profile_v1
      try {
        const pRaw = localStorage.getItem('arcade_profile_v1');
        if (pRaw) {
          const prof = JSON.parse(pRaw);
          if (prof && prof.equippedPet) {
            prof.equippedPet = null;
            localStorage.setItem('arcade_profile_v1', JSON.stringify(prof));
          }
        }
      } catch (e) {}

      // Sync any direct wallet changes from hillclimb.html (car/upgrade purchases or track coins)
      try {
        const rawLatest = localStorage.getItem(STORAGE_KEY);
        if (rawLatest) {
          const parsedLatest = JSON.parse(rawLatest);
          if (parsedLatest && parsedLatest.wallet && typeof parsedLatest.wallet.coins === 'number') {
            this.state.wallet.coins = parsedLatest.wallet.coins;
          }
        }
      } catch (e) {}

      // Sync gems earned OR spent on skins/revives inside standalone games
      const extGems = parseInt(localStorage.getItem('arcade_global_gems'), 10);
      if (!isNaN(extGems)) {
        if (extGems > this.state.wallet.crystals) {
          summary.crystalsEarned += (extGems - this.state.wallet.crystals);
        }
        this.state.wallet.crystals = Math.max(0, extGems);
      }

      // Process any new runs recorded in arcade_runs_history_v1 by standalone games
      const runsRaw = localStorage.getItem('arcade_runs_history_v1');
      if (runsRaw) {
        const runs = JSON.parse(runsRaw);
        if (Array.isArray(runs) && runs.length > 0) {
          if (!this.state.lastProcessedRunTs) {
            // Initialize to latest existing run timestamp on first load so old runs aren't re-claimed
            this.state.lastProcessedRunTs = runs[0].ts || Date.now();
          } else {
            const newRuns = runs.filter(r => (r.ts || 0) > this.state.lastProcessedRunTs).reverse();
            if (newRuns.length > 0) {
              const nameMap = {
                'Sky Stack': 'skyStack',
                'Puff Hop': 'puffHop',
                'Timber Dash': 'timberDash',
                'Blade Spin': 'bladeSpin',
                'Ridge Rush': 'ridgeRush'
              };
              const moodMult = this.state.lastLaunchEnergyMult || computeMoodMultiplier(this.state.pet.needs);
              const playroomTier = (this.state.pet.house && this.state.pet.house.rooms && this.state.pet.house.rooms.playroom)
                ? (this.state.pet.house.rooms.playroom.tier || 1)
                : 1;
              const roomBonus = 1 + (CONFIG.rooms.playroom.tierBonuses[playroomTier] || 0);

              newRuns.forEach((r, idx) => {
                const gId = nameMap[r.game] || 'skyStack';
                const gCfg = CONFIG.games[gId] || CONFIG.games.skyStack;
                const numScore = Math.max(0, parseInt(String(r.score), 10) || 0);
                const runMult = idx === 0 ? moodMult : computeMoodMultiplier(this.state.pet.needs);
                const coins = Math.max(5, Math.floor(numScore * gCfg.coinRate * runMult * roomBonus));
                const xpRaw = 6 + Math.floor(numScore / 5);

                this.state.wallet.coins += coins;
                if (idx > 0) {
                  this.state.pet.needs.energy = Math.max(0, this.state.pet.needs.energy - (gCfg.energy || 10));
                }
                this.state.pet.needs.fun = Math.min(100, this.state.pet.needs.fun + 15);
                const lvlInfo = this._addPetXp(xpRaw);
                if (lvlInfo.leveledUp) {
                  summary.leveledUp = true;
                  summary.newLevel = lvlInfo.newLevel;
                }
                this.state.achievements.totalGames = (this.state.achievements.totalGames || 0) + 1;
                this._incrementTask('play_2', 1);
                if (numScore > 0) this._setTaskMax('score_25', numScore);

                summary.runsPlayed++;
                summary.coinsEarned += coins;
                summary.xpEarned += xpRaw;
                summary.lastScore = numScore;
                summary.lastGameId = gId;
              });
              this.state.lastProcessedRunTs = Math.max(...newRuns.map(r => r.ts || 0));
            }
          }
        }
      }

      localStorage.setItem('arcade_global_gems', String(this.state.wallet.crystals));
    } catch (e) {}
    return summary;
  }

  syncAfterStandaloneGame() {
    const summary = this._syncStandaloneGamesProgress();
    this._saveLocalState();
    if (summary.runsPlayed > 0) {
      this.syncToGoogleSheets().catch(() => {});
    }
    return { ...summary, state: this.state };
  }

  _saveLocalState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      localStorage.setItem('arcade_global_gems', String(this.state.wallet.crystals));
      localStorage.setItem('arcade_global_coins', String(Math.floor(this.state.wallet.coins)));
      // Keep ridge_rush_save_v1 coins synced with Mochi Pal coins!
      const rrRaw = localStorage.getItem('ridge_rush_save_v1');
      if (rrRaw) {
        const rr = JSON.parse(rrRaw);
        rr.coins = Math.floor(this.state.wallet.coins);
        localStorage.setItem('ridge_rush_save_v1', JSON.stringify(rr));
      }
      if (tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9')) {
        tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(this.state), () => {});
      }
    } catch (e) {}
  }

  // Offline time decay with 70% cap (Mochi never reaches 0 overnight)
  _applyTimeDecay() {
    const now = Date.now();
    const pet = this.state.pet;
    const elapsedHours = Math.max(0, (now - (pet.lastUpdate || now)) / 3600000);
    pet.lastUpdate = now;

    if (elapsedHours > 0.001) {
      const maxDrain = CONFIG.needs.offlineMaxDrain * 100;
      const d = CONFIG.needs.decayPerHour;

      const drainH = Math.min(maxDrain, elapsedHours * d.hunger);
      const drainHy = Math.min(maxDrain, elapsedHours * d.hygiene);
      const drainF = Math.min(maxDrain, elapsedHours * d.fun);

      const minFloor = elapsedHours > 0.5 ? 15 : 5;
      pet.needs.hunger = Math.max(minFloor, Math.round((pet.needs.hunger - drainH) * 10) / 10);
      pet.needs.hygiene = Math.max(minFloor, Math.round((pet.needs.hygiene - drainHy) * 10) / 10);
      pet.needs.fun = Math.max(minFloor, Math.round((pet.needs.fun - drainF) * 10) / 10);

      if (pet.sleeping) {
        const bedTier = (pet.house && pet.house.rooms && pet.house.rooms.bedroom) ? pet.house.rooms.bedroom.tier : 1;
        const regenMult = 1 + (CONFIG.rooms.bedroom.tierBonuses[bedTier] || 0);
        const gainE = elapsedHours * CONFIG.needs.sleepRegenPerHour * regenMult;
        pet.needs.energy = Math.min(100, Math.round((pet.needs.energy + gainE) * 10) / 10);
        if (pet.needs.energy >= 100) {
          pet.sleeping = false;
        }
      } else {
        const drainE = Math.min(maxDrain, elapsedHours * d.energy);
        pet.needs.energy = Math.max(minFloor, Math.round((pet.needs.energy - drainE) * 10) / 10);
      }
    }

    const today = getTodayStr();
    if (!this.state.wallet.dailyEarned || this.state.wallet.dailyEarned.date !== today) {
      this.state.wallet.dailyEarned = { date: today, coins: 0, crystals: 0 };
    }
    if (!this.state.tasks || this.state.tasks.date !== today) {
      this.state.tasks = this._generateDailyTasks(today);
    }

    const streak = this.state.user.streak;
    if (streak.lastClaimDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      if (streak.lastClaimDate && streak.lastClaimDate !== yesterday) {
        streak.day = 1;
      }
      streak.claimedToday = false;
    } else {
      streak.claimedToday = true;
    }

    this._syncStandaloneGamesProgress();
    this._saveLocalState();
  }

  _addPetXp(rawXp) {
    const pet = this.state.pet;
    const moodMult = computeMoodMultiplier(pet.needs);
    const gained = Math.max(1, Math.round(rawXp * (moodMult < 0.6 ? 0.5 : 1.0)));
    pet.xp += gained;

    let leveledUp = false;
    let levelRewardCoins = 0;
    let levelRewardCrystals = 0;

    while (pet.level < 50 && pet.xp >= xpNeededForLevel(pet.level)) {
      pet.xp -= xpNeededForLevel(pet.level);
      pet.level++;
      leveledUp = true;
      const cGift = 50 + pet.level * 25;
      this.state.wallet.coins += cGift;
      levelRewardCoins += cGift;
      if (pet.level % 5 === 0) {
        this.state.wallet.crystals += 5;
        levelRewardCrystals += 5;
      }
    }
    return { leveledUp, newLevel: pet.level, levelRewardCoins, levelRewardCrystals };
  }

  async getState() {
    this._applyTimeDecay();
    return this.state;
  }

  async petAction(type, payload = {}) {
    this._applyTimeDecay();
    const pet = this.state.pet;
    let levelInfo = { leveledUp: false };

    if (type === 'rename' && payload.name) {
      pet.name = String(payload.name).trim().slice(0, 18) || 'Мочи';
      this.state.user.tutorialDone = true;
    } else if (type === 'tutorialDone') {
      this.state.user.tutorialDone = true;
    } else if (type === 'feed') {
      if (pet.sleeping) return { state: this.state, error: 'Мочи сейчас спит!' };
      const itemId = payload.itemId;
      const foodItem = CONFIG.shop.food.find(f => f.id === itemId);
      const count = (this.state.inventory.food && this.state.inventory.food[itemId]) || 0;
      if (!foodItem || count <= 0) {
        return { state: this.state, error: 'Нет этой еды в холодильнике!' };
      }
      if (pet.needs.hunger >= 99) {
        return { state: this.state, overfed: true };
      }
      this.state.inventory.food[itemId] = count - 1;
      const kitchenTier = pet.house.rooms.kitchen.tier || 1;
      const bonusMult = 1 + (CONFIG.rooms.kitchen.tierBonuses[kitchenTier] || 0);

      pet.needs.hunger = Math.min(100, Math.round(pet.needs.hunger + foodItem.hunger * bonusMult));
      pet.needs.fun = Math.min(100, Math.round(pet.needs.fun + (foodItem.fun || 5)));
      if (foodItem.energy) {
        pet.needs.energy = Math.min(100, Math.round(pet.needs.energy + foodItem.energy));
      }
      this.state.achievements.totalFeeds = (this.state.achievements.totalFeeds || 0) + 1;
      this._incrementTask('feed_2', 1);
      levelInfo = this._addPetXp(foodItem.xp || CONFIG.xp.actions.feed);
    } else if (type === 'clean') {
      if (pet.sleeping) return { state: this.state, error: 'Мочи сейчас спит!' };
      const coverage = Math.max(0.25, Math.min(1, Number(payload.coverage) || 0.8));
      const bathTier = pet.house.rooms.bathroom.tier || 1;
      const bonusMult = 1 + (CONFIG.rooms.bathroom.tierBonuses[bathTier] || 0);
      const gain = Math.round(45 * coverage * bonusMult);
      pet.needs.hygiene = Math.min(100, pet.needs.hygiene + gain);
      pet.needs.fun = Math.min(100, pet.needs.fun + 5);
      this.state.achievements.totalWashes = (this.state.achievements.totalWashes || 0) + 1;
      this._incrementTask('wash_1', 1);
      levelInfo = this._addPetXp(CONFIG.xp.actions.clean);
    } else if (type === 'sleepToggle') {
      pet.sleeping = !pet.sleeping;
      if (pet.sleeping) {
        levelInfo = this._addPetXp(CONFIG.xp.actions.sleepCycle);
      }
    } else if (type === 'pet') {
      if (!pet.sleeping) {
        pet.needs.fun = Math.min(100, pet.needs.fun + 4);
        levelInfo = this._addPetXp(CONFIG.xp.actions.pet);
      }
    } else if (type === 'ballPlay') {
      if (!pet.sleeping) {
        pet.needs.fun = Math.min(100, pet.needs.fun + 6);
        levelInfo = this._addPetXp(CONFIG.xp.actions.ballPlay);
      }
    }

    this._saveLocalState();
    return { state: this.state, ...levelInfo };
  }

  async startGame(gameId) {
    this._applyTimeDecay();
    const gCfg = CONFIG.games[gameId];
    if (!gCfg) throw new Error('Неизвестная игра');

    if (this.state.pet.level < (gCfg.unlockLevel || 1)) {
      return { error: `Эта игра открывается на ${gCfg.unlockLevel} уровне Мочи!` };
    }
    if (this.state.pet.sleeping) {
      this.state.pet.sleeping = false;
    }

    // Snapshot energy multiplier BEFORE spending energy (playing is ALWAYS allowed even at 0% energy!)
    this.state.lastLaunchEnergyMult = computeMoodMultiplier(this.state.pet.needs);
    this.state.pet.needs.energy = Math.max(0, this.state.pet.needs.energy - gCfg.energy);
    this.state.pet.needs.fun = Math.min(100, this.state.pet.needs.fun + (gCfg.funGain || 15));
    if (!this.state.lastProcessedRunTs) {
      this.state.lastProcessedRunTs = Date.now() - 1;
    }

    const runId = 'run_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
    this.activeRuns.set(runId, { gameId, seed, startedAt: Date.now() });
    this._saveLocalState();
    return { runId, seed, state: this.state };
  }

  async endGame({ runId, gameId, score, inputs = [] }) {
    this._applyTimeDecay();
    const gCfg = CONFIG.games[gameId] || CONFIG.games.skyStack;
    const cleanScore = Math.max(0, Math.min(99999, Math.floor(Number(score) || 0)));

    const pet = this.state.pet;
    const moodMult = computeMoodMultiplier(pet.needs);
    const playroomTier = pet.house.rooms.playroom.tier || 1;
    const roomBonus = 1 + (CONFIG.rooms.playroom.tierBonuses[playroomTier] || 0);

    let rawCoins = Math.floor(cleanScore * gCfg.coinRate * moodMult * roomBonus);
    if (cleanScore > 0 && rawCoins < 3) rawCoins = 3;

    if (this.state.wallet.dailyEarned.coins >= CONFIG.economy.coinSoftCapDaily) {
      rawCoins = Math.max(1, Math.floor(rawCoins * CONFIG.economy.softCapRate));
    }

    const prevBest = this.state.bestScores[gameId] || 0;
    const isNewBest = cleanScore > prevBest && cleanScore > 0;
    if (isNewBest) {
      this.state.bestScores[gameId] = cleanScore;
    }

    let rawCrystals = 0;
    if (isNewBest) rawCrystals += 1;
    (gCfg.milestones || []).forEach((ms, idx) => {
      if (cleanScore >= ms) rawCrystals += (idx + 1);
    });

    const remCrystalCap = Math.max(0, CONFIG.economy.crystalDailyCap - this.state.wallet.dailyEarned.crystals);
    const crystalsEarned = Math.min(remCrystalCap, rawCrystals);

    this.state.wallet.coins += rawCoins;
    this.state.wallet.crystals += crystalsEarned;
    this.state.wallet.dailyEarned.coins += rawCoins;
    this.state.wallet.dailyEarned.crystals += crystalsEarned;

    const xpRaw = 5 + Math.floor(cleanScore / 5);
    const levelInfo = this._addPetXp(xpRaw);

    this.state.achievements.totalGames = (this.state.achievements.totalGames || 0) + 1;
    this._incrementTask('play_2', 1);
    if (cleanScore > 0) {
      this._setTaskMax('score_25', cleanScore);
    }

    this._saveLocalState();
    this.syncToGoogleSheets().catch(() => {});

    return {
      reward: {
        score: cleanScore,
        isNewBest,
        bestScore: this.state.bestScores[gameId],
        coins: rawCoins,
        crystals: crystalsEarned,
        xp: xpRaw,
        moodMult: Math.round(moodMult * 100)
      },
      ...levelInfo,
      state: this.state
    };
  }

  async buyItem(itemId) {
    this._applyTimeDecay();
    const allItems = [
      ...CONFIG.shop.food,
      ...CONFIG.shop.colors,
      ...CONFIG.shop.skins,
      ...CONFIG.shop.eyes,
      ...CONFIG.shop.hats,
      ...CONFIG.shop.outfits,
      ...(CONFIG.shop.decor || [])
    ];
    const item = allItems.find(i => i.id === itemId);
    if (!item) return { error: 'Предмет не найден' };

    if (this.state.pet.level < (item.levelReq || 1)) {
      return { error: `Нужен ${item.levelReq} уровень Мочи!` };
    }

    const coinPrice = (item.price && item.price.coins) || 0;
    const crystalPrice = (item.price && item.price.crystals) || 0;

    if (this.state.wallet.coins < coinPrice) {
      return { error: 'Недостаточно монеток 🪙! Сыграй в мини-игры!' };
    }
    if (this.state.wallet.crystals < crystalPrice) {
      return { error: 'Недостаточно кристаллов 💎!' };
    }

    this.state.wallet.coins -= coinPrice;
    this.state.wallet.crystals -= crystalPrice;

    if (item.category === 'food') {
      this.state.inventory.food[item.id] = (this.state.inventory.food[item.id] || 0) + 1;
    } else if (item.category === 'wallpaper' || item.category === 'rug') {
      this.state.inventory.ownedCosmetics[item.id] = true;
      this.state.pet.house[item.category] = item.id;
    } else {
      this.state.inventory.ownedCosmetics[item.id] = true;
      this.state.pet.equipped[item.category] = item.id;
    }

    this._saveLocalState();
    return { ok: true, item, state: this.state };
  }

  async equipItem(category, itemId) {
    if (!this.state.inventory.ownedCosmetics[itemId] && itemId !== 'none') {
      return { error: 'Этот предмет ещё не куплен!' };
    }
    if (category === 'wallpaper' || category === 'rug') {
      this.state.pet.house[category] = itemId;
    } else {
      this.state.pet.equipped[category] = itemId;
    }
    this._saveLocalState();
    return { ok: true, state: this.state };
  }

  async upgradeRoom(roomId) {
    const roomCfg = CONFIG.rooms[roomId];
    if (!roomCfg) return { error: 'Комната не найдена' };
    const curTier = this.state.pet.house.rooms[roomId].tier || 1;
    if (curTier >= 3) return { error: 'Комната уже максимального 3 уровня!' };

    const nextCost = roomCfg.upgradeCosts[curTier + 1];
    if (this.state.wallet.coins < nextCost.coins) {
      return { error: `Не хватает монет (нужно ${nextCost.coins} 🪙)` };
    }
    if (this.state.wallet.crystals < nextCost.crystals) {
      return { error: `Не хватает кристаллов (нужно ${nextCost.crystals} 💎)` };
    }

    this.state.wallet.coins -= nextCost.coins;
    this.state.wallet.crystals -= nextCost.crystals;
    this.state.pet.house.rooms[roomId].tier = curTier + 1;
    const levelInfo = this._addPetXp(25);
    this._saveLocalState();
    return { ok: true, state: this.state, ...levelInfo };
  }

  async claimDailyStreak() {
    this._applyTimeDecay();
    const today = getTodayStr();
    const s = this.state.user.streak;
    if (s.lastClaimDate === today) {
      return { error: 'Награда за сегодня уже получена!' };
    }
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (s.lastClaimDate === yesterday) {
      s.day = (s.day % 7) + 1;
    } else {
      s.day = 1;
    }
    s.lastClaimDate = today;
    s.claimedToday = true;

    const coinsReward = 40 + s.day * 25;
    const crystalsReward = s.day === 7 ? 8 : (s.day % 2 === 0 ? 2 : 1);
    this.state.wallet.coins += coinsReward;
    this.state.wallet.crystals += crystalsReward;
    this._saveLocalState();
    return { ok: true, coinsReward, crystalsReward, day: s.day, state: this.state };
  }

  async claimTask(taskId) {
    const task = this.state.tasks.list.find(t => t.id === taskId);
    if (!task || task.claimed || task.progress < task.target) {
      return { error: 'Задание ещё не выполнено' };
    }
    task.claimed = true;
    this.state.wallet.coins += (task.reward.coins || 0);
    this.state.wallet.crystals += (task.reward.crystals || 0);
    const levelInfo = this._addPetXp(12);
    this._saveLocalState();
    return { ok: true, reward: task.reward, state: this.state, ...levelInfo };
  }

  _incrementTask(id, delta) {
    if (!this.state.tasks || !this.state.tasks.list) return;
    const t = this.state.tasks.list.find(x => x.id === id);
    if (t && !t.claimed) {
      t.progress = Math.min(t.target, t.progress + delta);
    }
  }

  _setTaskMax(id, val) {
    if (!this.state.tasks || !this.state.tasks.list) return;
    const t = this.state.tasks.list.find(x => x.id === id);
    if (t && !t.claimed) {
      t.progress = Math.min(t.target, Math.max(t.progress, val));
    }
  }

  async syncToGoogleSheets() {
    const url = CONFIG.economy.googleSheetSyncUrl;
    if (!url) return [];
    this._syncStandaloneGamesProgress();
    const bs = this.state.bestScores || {};
    const payload = JSON.stringify({
      userId: this.state.user.tgId,
      name: `${this.state.user.name} (${this.state.pet.name} Ур.${this.state.pet.level})`,
      rrBest: bs.ridgeRush || 0,
      ssBest: bs.skyStack || 0,
      tdBest: bs.timberDash || 0,
      bsBest: bs.bladeSpin || 0,
      phBest: bs.puffHop || 0,
      gems: this.state.wallet.crystals || 0
    });
    const res = await fetch(`${url}?action=save&payload=${encodeURIComponent(payload)}`);
    const data = await res.json();
    return (data && Array.isArray(data.players)) ? data.players : [];
  }
}

export const api = new MochiStateEngine();
