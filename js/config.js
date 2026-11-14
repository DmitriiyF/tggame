// Mochi Pal — Master Configuration Module
export const CONFIG = {
  needs: {
    decayPerHour: {
      hunger: 6,
      energy: 4,
      hygiene: 3,
      fun: 5
    },
    sleepRegenPerHour: 12,
    offlineMaxDrain: 0.7,
    lowThreshold: 25
  },
  games: {
    skyStack: {
      id: 'skyStack',
      title: 'Sky Stack',
      subtitle: 'Строй башню с Мочи',
      icon: '🧱',
      energy: 10,
      funGain: 15,
      coinRate: 2.0,
      milestones: [25, 50, 100],
      unlockLevel: 1
    },
    puffHop: {
      id: 'puffHop',
      title: 'Puff Hop',
      subtitle: 'Подводный заплыв Мочи',
      icon: '🐡',
      energy: 10,
      funGain: 15,
      coinRate: 3.0,
      milestones: [20, 50, 100],
      unlockLevel: 1
    },
    timberDash: {
      id: 'timberDash',
      title: 'Timber Dash',
      subtitle: 'Мочи-дровосек рубит лес',
      icon: '🦫',
      energy: 10,
      funGain: 15,
      coinRate: 1.5,
      milestones: [50, 120, 250],
      unlockLevel: 1
    },
    bladeSpin: {
      id: 'bladeSpin',
      title: 'Blade Spin',
      subtitle: 'Метание лезвий по мишеням',
      icon: '🗡',
      energy: 10,
      funGain: 15,
      coinRate: 1.8,
      milestones: [30, 80, 150],
      unlockLevel: 1
    },
    ridgeRush: {
      id: 'ridgeRush',
      title: 'Ridge Rush',
      subtitle: 'Гонки Мочи по холмам',
      icon: '🚙',
      energy: 15,
      funGain: 20,
      coinRate: 0.18,
      milestones: [300, 800, 1500],
      unlockLevel: 5
    }
  },
  economy: {
    crystalDailyCap: 10,
    coinSoftCapDaily: 3000,
    softCapRate: 0.3,
    googleSheetSyncUrl: 'https://script.google.com/macros/s/AKfycbzHXu32iW7OpZvBT_lGtOJEYnueaIIMFTa-F4rhaJmNv2T0y4BvtVUFKi8DD5x66PPf/exec'
  },
  xp: {
    base: 50,
    exp: 1.4,
    actions: {
      feed: 4,
      clean: 5,
      sleepCycle: 6,
      pet: 2,
      ballPlay: 3
    }
  },
  ui: {
    font: "'Fredoka', sans-serif"
  },
  rooms: {
    kitchen: {
      id: 'kitchen',
      name: 'Кухня',
      icon: '🍎',
      tierBonuses: [0, 0.10, 0.20, 0.35],
      upgradeCosts: [
        null,
        { coins: 0, crystals: 0 },
        { coins: 350, crystals: 3, desc: '+10% сытости от всей еды, шеф-интерьер' },
        { coins: 900, crystals: 8, desc: '+20% сытости от всей еды, золотая кухня' }
      ]
    },
    bathroom: {
      id: 'bathroom',
      name: 'Ванная',
      icon: '🛁',
      tierBonuses: [0, 0.10, 0.20, 0.35],
      upgradeCosts: [
        null,
        { coins: 0, crystals: 0 },
        { coins: 350, crystals: 3, desc: '+10% скорости мытья и джакузи-декор' },
        { coins: 900, crystals: 8, desc: '+20% чистоты и королевское СПА' }
      ]
    },
    bedroom: {
      id: 'bedroom',
      name: 'Спальня',
      icon: '🌙',
      tierBonuses: [0, 0.15, 0.30, 0.50],
      upgradeCosts: [
        null,
        { coins: 0, crystals: 0 },
        { coins: 400, crystals: 4, desc: '+15% восстановления энергии во сне' },
        { coins: 1000, crystals: 10, desc: '+30% восстановления энергии и звёздный купол' }
      ]
    },
    playroom: {
      id: 'playroom',
      name: 'Игровая',
      icon: '🕹️',
      tierBonuses: [0, 0.10, 0.20, 0.35],
      upgradeCosts: [
        null,
        { coins: 0, crystals: 0 },
        { coins: 450, crystals: 4, desc: '+10% монет во всех мини-играх' },
        { coins: 1100, crystals: 10, desc: '+20% монет во всех мини-играх и неоновый зал' }
      ]
    }
  },
  shop: {
    food: [
      { id: 'apple', category: 'food', name: 'Сочное яблоко', icon: '🍎', hunger: 18, fun: 4, xp: 3, price: { coins: 20 }, rarity: 'common', levelReq: 1 },
      { id: 'onigiri', category: 'food', name: 'Рисовый онигири', icon: '🍙', hunger: 28, fun: 6, xp: 5, price: { coins: 35 }, rarity: 'common', levelReq: 1 },
      { id: 'sandwich', category: 'food', name: 'Сэндвич с сыром', icon: '🥪', hunger: 36, fun: 8, xp: 6, price: { coins: 45 }, rarity: 'common', levelReq: 1 },
      { id: 'dango', category: 'food', name: 'Сладкий данго', icon: '🍡', hunger: 30, fun: 18, xp: 7, price: { coins: 60 }, rarity: 'rare', levelReq: 1 },
      { id: 'ramen', category: 'food', name: 'Горячий рамен', icon: '🍜', hunger: 52, fun: 12, xp: 10, price: { coins: 90 }, rarity: 'rare', levelReq: 2 },
      { id: 'cake', category: 'food', name: 'Клубничный торт', icon: '🍰', hunger: 65, fun: 25, xp: 14, price: { coins: 120 }, rarity: 'epic', levelReq: 2 },
      { id: 'boba', category: 'food', name: 'Бабл-ти ( +Бодрость )', icon: '🧋', hunger: 25, energy: 25, fun: 16, xp: 12, price: { coins: 110 }, rarity: 'epic', levelReq: 3 },
      { id: 'megafeast', category: 'food', name: 'Королевский пир (100%)', icon: '🍱', hunger: 100, energy: 40, fun: 40, xp: 30, price: { crystals: 8 }, rarity: 'legendary', levelReq: 1 }
    ],
    colors: [
      { id: 'sakura', category: 'color', name: 'Розовая сакура', hex: '#f9a8d4', shade: '#f472b6', price: { coins: 0 }, rarity: 'common', levelReq: 1 },
      { id: 'mint', category: 'color', name: 'Мятный мусс', hex: '#6ee7b7', shade: '#34d399', price: { coins: 60 }, rarity: 'common', levelReq: 1 },
      { id: 'sky', category: 'color', name: 'Небесное облако', hex: '#7dd3fc', shade: '#38bdf8', price: { coins: 60 }, rarity: 'common', levelReq: 1 },
      { id: 'lemon', category: 'color', name: 'Лимонный крем', hex: '#fde047', shade: '#facc15', price: { coins: 80 }, rarity: 'common', levelReq: 1 },
      { id: 'lavender', category: 'color', name: 'Лавандовый сон', hex: '#c4b5fd', shade: '#a78bfa', price: { coins: 90 }, rarity: 'common', levelReq: 1 },
      { id: 'peach', category: 'color', name: 'Персиковый нектар', hex: '#fdba74', shade: '#fb923c', price: { coins: 90 }, rarity: 'common', levelReq: 1 },
      { id: 'matcha', category: 'color', name: 'Зелёный матча', hex: '#bef264', shade: '#84cc16', price: { coins: 110 }, rarity: 'rare', levelReq: 2 },
      { id: 'coral', category: 'color', name: 'Коралловый риф', hex: '#fca5a5', shade: '#f87171', price: { coins: 120 }, rarity: 'rare', levelReq: 2 },
      { id: 'snow', category: 'color', name: 'Белый пломбир', hex: '#f8fafc', shade: '#cbd5e1', price: { coins: 140 }, rarity: 'rare', levelReq: 2 },
      { id: 'choco', category: 'color', name: 'Молочный шоколад', hex: '#d6a27a', shade: '#a16207', price: { coins: 150 }, rarity: 'rare', levelReq: 3 },
      { id: 'aqua', category: 'color', name: 'Бирюзовая лагуна', hex: '#5eead4', shade: '#14b8a6', price: { coins: 170 }, rarity: 'rare', levelReq: 3 },
      { id: 'berry', category: 'color', name: 'Ежевичный джем', hex: '#e879f9', shade: '#c026d3', price: { coins: 200 }, rarity: 'epic', levelReq: 4 },
      { id: 'sunset_grad', category: 'color', name: 'Градиент Заката', hex: '#fb7185', shade: '#f59e0b', gradient: ['#fb7185', '#fde047'], price: { crystals: 6 }, rarity: 'epic', levelReq: 2 },
      { id: 'aurora_grad', category: 'color', name: 'Северное Сияние', hex: '#34d399', shade: '#6366f1', gradient: ['#34d399', '#38bdf8', '#818cf8'], price: { crystals: 8 }, rarity: 'epic', levelReq: 3 },
      { id: 'cosmic_grad', category: 'color', name: 'Звёздная Туманность', hex: '#c084fc', shade: '#3b82f6', gradient: ['#f472b6', '#a855f7', '#3b82f6'], price: { crystals: 12 }, rarity: 'legendary', levelReq: 4 },
      { id: 'gold_grad', category: 'color', name: 'Чистое Золото', hex: '#fde047', shade: '#d97706', gradient: ['#fef08a', '#f59e0b', '#b45309'], price: { crystals: 15 }, rarity: 'legendary', levelReq: 5 }
    ],
    skins: [
      { id: 'none', category: 'skin', name: 'Гладкий Мочи', icon: '⚪', price: { coins: 0 }, rarity: 'common', levelReq: 1 },
      { id: 'spots', category: 'skin', name: 'Пятнышки панды', icon: '🐾', price: { coins: 160 }, rarity: 'rare', levelReq: 1 },
      { id: 'stripes', category: 'skin', name: 'Тигровые полоски', icon: '🐯', price: { coins: 220 }, rarity: 'rare', levelReq: 2 },
      { id: 'hearts', category: 'skin', name: 'Сердечки', icon: '💖', price: { coins: 280 }, rarity: 'epic', levelReq: 2 },
      { id: 'candy', category: 'skin', name: 'Конфетная посыпка', icon: '🍬', price: { crystals: 6 }, rarity: 'epic', levelReq: 3 },
      { id: 'galaxy', category: 'skin', name: 'Галактика (аним.)', icon: '🌌', price: { crystals: 10 }, rarity: 'legendary', levelReq: 4 },
      { id: 'rainbow', category: 'skin', name: 'Радужное сияние', icon: '🌈', price: { crystals: 14 }, rarity: 'legendary', levelReq: 5 }
    ],
    eyes: [
      { id: 'normal', category: 'eyes', name: 'Классические блестящие', icon: '👀', price: { coins: 0 }, rarity: 'common', levelReq: 1 },
      { id: 'sparkle', category: 'eyes', name: 'Звёздные аниме-глазки', icon: '✨', price: { coins: 120 }, rarity: 'rare', levelReq: 1 },
      { id: 'cute', category: 'eyes', name: 'Милые реснички', icon: '🥺', price: { coins: 140 }, rarity: 'rare', levelReq: 1 },
      { id: 'wink', category: 'eyes', name: 'Озорное подмигивание', icon: '😉', price: { coins: 160 }, rarity: 'rare', levelReq: 2 },
      { id: 'happy_arc', category: 'eyes', name: 'Улыбающиеся дуги', icon: '😊', price: { coins: 180 }, rarity: 'rare', levelReq: 2 },
      { id: 'heart_eyes', category: 'eyes', name: 'Влюблённые сердечки', icon: '😍', price: { crystals: 5 }, rarity: 'epic', levelReq: 2 },
      { id: 'cyber', category: 'eyes', name: 'Неоновый визор', icon: '🤖', price: { crystals: 7 }, rarity: 'epic', levelReq: 3 },
      { id: 'fire', category: 'eyes', name: 'Огненный взгляд', icon: '🔥', price: { crystals: 9 }, rarity: 'legendary', levelReq: 4 }
    ],
    hats: [
      { id: 'none', category: 'hat', name: 'Без шапки', icon: '🚫', price: { coins: 0 }, rarity: 'common', levelReq: 1 },
      { id: 'sprout', category: 'hat', name: 'Росточек клевера', icon: '🌱', price: { coins: 50 }, rarity: 'common', levelReq: 1 },
      { id: 'flower', category: 'hat', name: 'Цветок ромашки', icon: '🌼', price: { coins: 75 }, rarity: 'common', levelReq: 1 },
      { id: 'cap', category: 'hat', name: 'Скейтерская кепка', icon: '🧢', price: { coins: 110 }, rarity: 'common', levelReq: 1 },
      { id: 'beanie', category: 'hat', name: 'Тёплая шапочка с помпоном', icon: '🧶', price: { coins: 140 }, rarity: 'rare', levelReq: 1 },
      { id: 'chef', category: 'hat', name: 'Колпак Шеф-повара', icon: '👨‍🍳', price: { coins: 180 }, rarity: 'rare', levelReq: 2 },
      { id: 'bunny', category: 'hat', name: 'Ушки зайчика', icon: '🐰', price: { coins: 220 }, rarity: 'rare', levelReq: 2 },
      { id: 'frog', category: 'hat', name: 'Шапочка-лягушка', icon: '🐸', price: { coins: 260 }, rarity: 'epic', levelReq: 2 },
      { id: 'headphones', category: 'hat', name: 'DJ-наушники', icon: '🎧', price: { coins: 320 }, rarity: 'epic', levelReq: 3 },
      { id: 'pirate', category: 'hat', name: 'Треуголка капитана', icon: '🏴‍☠️', price: { coins: 380 }, rarity: 'epic', levelReq: 3 },
      { id: 'wizard', category: 'hat', name: 'Шляпа Звёздного Мага', icon: '🧙‍♂️', price: { crystals: 6 }, rarity: 'epic', levelReq: 3 },
      { id: 'crown', category: 'hat', name: 'Золотая Корона', icon: '👑', price: { crystals: 10 }, rarity: 'legendary', levelReq: 4 },
      { id: 'halo', category: 'hat', name: 'Ангельский Нимб', icon: '😇', price: { crystals: 14 }, rarity: 'legendary', levelReq: 5 }
    ],
    outfits: [
      { id: 'none', category: 'outfit', name: 'Без аксессуара', icon: '🚫', price: { coins: 0 }, rarity: 'common', levelReq: 1 },
      { id: 'bowtie', category: 'outfit', name: 'Красный галстук-бабочка', icon: '🎀', price: { coins: 90 }, rarity: 'common', levelReq: 1 },
      { id: 'scarf', category: 'outfit', name: 'Уютный шарфик', icon: '🧣', price: { coins: 150 }, rarity: 'rare', levelReq: 1 },
      { id: 'glasses', category: 'outfit', name: 'Крутые очки', icon: '🕶️', price: { coins: 210 }, rarity: 'rare', levelReq: 2 },
      { id: 'medal', category: 'outfit', name: 'Золотая медаль чемпиона', icon: '🏅', price: { coins: 300 }, rarity: 'epic', levelReq: 3 },
      { id: 'wings', category: 'outfit', name: 'Крылышки феи (аним.)', icon: '🦋', price: { crystals: 9 }, rarity: 'legendary', levelReq: 3 }
    ]
  }
};
