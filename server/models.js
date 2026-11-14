// Mochi Pal — MongoDB Mongoose Models (users, pets, wallets, inventory, runs, tasks)
import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: 'Mochi Friend' },
  createdAt: { type: Date, default: Date.now },
  refBy: { type: String, default: null },
  streak: {
    day: { type: Number, default: 1 },
    lastClaim: { type: String, default: '' }
  },
  settings: {
    sound: { type: Boolean, default: true },
    haptics: { type: Boolean, default: true },
    notifications: { type: Boolean, default: true }
  }
});

const PetSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: 'Мочи' },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  needs: {
    hunger: { type: Number, default: 80 },
    energy: { type: Number, default: 85 },
    hygiene: { type: Number, default: 85 },
    fun: { type: Number, default: 80 }
  },
  sleeping: { type: Boolean, default: false },
  lastUpdate: { type: Date, default: Date.now },
  equipped: {
    color: { type: String, default: 'sakura' },
    skin: { type: String, default: 'none' },
    eyes: { type: String, default: 'normal' },
    hat: { type: String, default: 'sprout' },
    outfit: { type: String, default: 'none' }
  },
  house: {
    rooms: {
      kitchen: { tier: { type: Number, default: 1 } },
      bathroom: { tier: { type: Number, default: 1 } },
      bedroom: { tier: { type: Number, default: 1 } },
      playroom: { tier: { type: Number, default: 1 } }
    }
  }
});

const WalletSchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true, index: true },
  coins: { type: Number, default: 150, min: 0 },
  crystals: { type: Number, default: 12, min: 0 },
  dailyEarned: {
    date: { type: String, default: '' },
    coins: { type: Number, default: 0 },
    crystals: { type: Number, default: 0 }
  }
});

const InventorySchema = new mongoose.Schema({
  tgId: { type: String, required: true, unique: true, index: true },
  items: [{
    id: { type: String, required: true },
    qty: { type: Number, default: 1 }
  }]
});

const RunSchema = new mongoose.Schema({
  runId: { type: String, required: true, unique: true, index: true },
  tgId: { type: String, required: true, index: true },
  gameId: { type: String, required: true },
  seed: { type: Number, required: true },
  score: { type: Number, default: 0 },
  inputs: { type: [Number], default: [] },
  verified: { type: Boolean, default: false },
  reward: {
    coins: { type: Number, default: 0 },
    crystals: { type: Number, default: 0 },
    xp: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 } // 30-day TTL
});

const TaskSchema = new mongoose.Schema({
  tgId: { type: String, required: true, index: true },
  date: { type: String, required: true },
  list: [{
    id: String,
    title: String,
    progress: Number,
    target: Number,
    claimed: Boolean
  }]
});

export const User = mongoose.model('User', UserSchema);
export const Pet = mongoose.model('Pet', PetSchema);
export const Wallet = mongoose.model('Wallet', WalletSchema);
export const Inventory = mongoose.model('Inventory', InventorySchema);
export const Run = mongoose.model('Run', RunSchema);
export const Task = mongoose.model('Task', TaskSchema);
