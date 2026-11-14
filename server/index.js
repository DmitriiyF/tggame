// Mochi Pal — Authoritative Node.js + Express + MongoDB Server
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { CONFIG, xpNeededForLevel, computeMoodMultiplier } from '../js/config.js';
import { User, Pet, Wallet, Inventory, Run, Task } from './models.js';
import { verifyDeterministicRun } from './simulators.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mochi_pal';

// Validate Telegram WebApp initData HMAC-SHA256 & auth_date < 24h
function verifyTelegramInitData(initDataRaw) {
  if (!initDataRaw) {
    if (!BOT_TOKEN) return { id: 'dev_local_user', first_name: 'Dev Player' };
    return null;
  }
  const params = new URLSearchParams(initDataRaw);
  const hash = params.get('hash');
  const authDate = parseInt(params.get('auth_date') || '0', 10);
  if (BOT_TOKEN) {
    if (!hash || (Date.now() / 1000 - authDate) > 86400) return null;
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (calculatedHash !== hash) return null;
  }
  try {
    return JSON.parse(params.get('user') || '{"id":"anon","first_name":"Player"}');
  } catch (e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const initData = req.headers['x-telegram-init-data'] || '';
  const tgUser = verifyTelegramInitData(initData);
  if (!tgUser || !tgUser.id) {
    return res.status(401).json({ error: 'Unauthorized Telegram initData' });
  }
  req.tgUser = { tgId: String(tgUser.id), name: tgUser.first_name || 'Player' };
  next();
}

// Apply server-side need decay with 70% offline drain cap
function applyServerNeedDecay(pet) {
  const now = Date.now();
  const last = pet.lastUpdate ? new Date(pet.lastUpdate).getTime() : now;
  const elapsedHours = Math.max(0, (now - last) / 3600000);
  pet.lastUpdate = new Date(now);

  if (elapsedHours > 0.001) {
    const maxDrain = CONFIG.needs.offlineMaxDrain * 100;
    const d = CONFIG.needs.decayPerHour;
    const minFloor = elapsedHours > 0.5 ? 15 : 5;

    pet.needs.hunger = Math.max(minFloor, pet.needs.hunger - Math.min(maxDrain, elapsedHours * d.hunger));
    pet.needs.hygiene = Math.max(minFloor, pet.needs.hygiene - Math.min(maxDrain, elapsedHours * d.hygiene));
    pet.needs.fun = Math.max(minFloor, pet.needs.fun - Math.min(maxDrain, elapsedHours * d.fun));

    if (pet.sleeping) {
      const bedTier = pet.house?.rooms?.bedroom?.tier || 1;
      const regenMult = 1 + (CONFIG.rooms.bedroom.tierBonuses[bedTier] || 0);
      pet.needs.energy = Math.min(100, pet.needs.energy + elapsedHours * CONFIG.needs.sleepRegenPerHour * regenMult);
      if (pet.needs.energy >= 100) pet.sleeping = false;
    } else {
      pet.needs.energy = Math.max(minFloor, pet.needs.energy - Math.min(maxDrain, elapsedHours * d.energy));
    }
  }
}

const gameEndLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many game submissions, please wait' }
});

app.get('/api/state', authMiddleware, async (req, res) => {
  const { tgId, name } = req.tgUser;
  const today = new Date().toISOString().slice(0, 10);

  let [user, pet, wallet, inventory, tasks] = await Promise.all([
    User.findOne({ tgId }),
    Pet.findOne({ tgId }),
    Wallet.findOne({ tgId }),
    Inventory.findOne({ tgId }),
    Task.findOne({ tgId, date: today })
  ]);

  if (!user) user = await User.create({ tgId, name });
  if (!pet) pet = await Pet.create({ tgId });
  if (!wallet) wallet = await Wallet.create({ tgId, dailyEarned: { date: today, coins: 0, crystals: 0 } });
  if (!inventory) {
    inventory = await Inventory.create({
      tgId,
      items: [{ id: 'apple', qty: 3 }, { id: 'onigiri', qty: 2 }, { id: 'sakura', qty: 1 }, { id: 'sprout', qty: 1 }]
    });
  }

  applyServerNeedDecay(pet);
  await pet.save();

  res.json({ user, pet, wallet, inventory, tasks });
});

app.post('/api/game/start', authMiddleware, async (req, res) => {
  const { tgId } = req.tgUser;
  const { gameId } = req.body;
  const gCfg = CONFIG.games[gameId];
  if (!gCfg) return res.status(400).json({ error: 'Unknown gameId' });

  const pet = await Pet.findOne({ tgId });
  if (!pet) return res.status(404).json({ error: 'Pet not found' });
  applyServerNeedDecay(pet);

  if (pet.level < (gCfg.unlockLevel || 1)) {
    return res.status(403).json({ error: 'Pet level too low' });
  }
  if (pet.needs.energy < gCfg.energy) {
    return res.status(400).json({ error: 'Not enough energy' });
  }

  pet.needs.energy -= gCfg.energy;
  pet.needs.fun = Math.min(100, pet.needs.fun + 15);
  await pet.save();

  const runId = crypto.randomUUID();
  const seed = crypto.randomInt(1, 0x7FFFFFFF);
  await Run.create({ runId, tgId, gameId, seed });

  res.json({ runId, seed });
});

app.post('/api/game/end', authMiddleware, gameEndLimiter, async (req, res) => {
  const { tgId } = req.tgUser;
  const { runId, score, inputs } = req.body;

  const run = await Run.findOne({ runId, tgId, verified: false });
  if (!run) return res.status(400).json({ error: 'Invalid or already claimed runId' });

  const check = verifyDeterministicRun(run.gameId, run.seed, score, inputs);
  if (!check.verified) {
    return res.status(400).json({ error: check.reason || 'Verification failed' });
  }

  const [pet, wallet] = await Promise.all([
    Pet.findOne({ tgId }),
    Wallet.findOne({ tgId })
  ]);
  const gCfg = CONFIG.games[run.gameId];
  const avgNeed = (pet.needs.hunger + pet.needs.energy + pet.needs.hygiene + pet.needs.fun) / 4;
  const moodMult = avgNeed >= 80 ? 1.2 : avgNeed >= 40 ? 1.0 : 0.6;

  let coins = Math.floor(check.score * gCfg.coinRate * moodMult);
  const today = new Date().toISOString().slice(0, 10);
  if (wallet.dailyEarned.date !== today) {
    wallet.dailyEarned = { date: today, coins: 0, crystals: 0 };
  }
  if (wallet.dailyEarned.coins >= CONFIG.economy.coinSoftCapDaily) {
    coins = Math.floor(coins * CONFIG.economy.softCapRate);
  }

  let crystals = 0;
  gCfg.milestones.forEach((m, idx) => {
    if (check.score >= m) crystals += (idx + 1);
  });
  crystals = Math.min(crystals, Math.max(0, CONFIG.economy.crystalDailyCap - wallet.dailyEarned.crystals));

  const xp = 5 + Math.floor(check.score / 5);
  pet.xp += xp;
  while (pet.level < 50 && pet.xp >= Math.floor(CONFIG.xp.base * Math.pow(pet.level, CONFIG.xp.exp))) {
    pet.xp -= Math.floor(CONFIG.xp.base * Math.pow(pet.level, CONFIG.xp.exp));
    pet.level++;
    coins += 50 + pet.level * 25;
  }

  wallet.coins += coins;
  wallet.crystals += crystals;
  wallet.dailyEarned.coins += coins;
  wallet.dailyEarned.crystals += crystals;

  run.score = check.score;
  run.inputs = inputs;
  run.verified = true;
  run.reward = { coins, crystals, xp };

  await Promise.all([pet.save(), wallet.save(), run.save()]);
  res.json({ reward: { coins, crystals, xp, score: check.score }, pet, wallet });
});

// Atomic shop purchase with balance check ($inc with condition coins >= price)
app.post('/api/shop/buy', authMiddleware, async (req, res) => {
  const { tgId } = req.tgUser;
  const { itemId } = req.body;
  const allItems = [
    ...CONFIG.shop.food,
    ...CONFIG.shop.colors,
    ...CONFIG.shop.skins,
    ...CONFIG.shop.eyes,
    ...CONFIG.shop.hats,
    ...CONFIG.shop.outfits
  ];
  const item = allItems.find(i => i.id === itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const coinCost = item.price.coins || 0;
  const crystalCost = item.price.crystals || 0;

  const updatedWallet = await Wallet.findOneAndUpdate(
    { tgId, coins: { $gte: coinCost }, crystals: { $gte: crystalCost } },
    { $inc: { coins: -coinCost, crystals: -crystalCost } },
    { new: true }
  );
  if (!updatedWallet) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  await Inventory.updateOne(
    { tgId },
    { $push: { items: { id: item.id, qty: 1 } } },
    { upsert: true }
  );

  res.json({ ok: true, wallet: updatedWallet });
});

if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(MONGO_URI).then(() => {
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Mochi Pal Server listening on port ${port}`));
  }).catch(err => {
    console.warn('MongoDB connection optional in local preview:', err.message);
  });
}

export default app;
