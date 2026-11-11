const MAX_LVL = 10;

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a2a6c',
    powerPreference: 'high-performance',
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1.05 },
            debug: false,
            positionIterations: 8,
            velocityIterations: 6
        }
    },
    scene: {
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let car = {};
let cursors;
let isGasPressed = false;
let isBrakePressed = false;
let Matter;

// Состояние контакта колёс с землей
let wheelAGrounded = false;
let wheelBGrounded = false;
let isGrounded = false;

// Интерфейс и прогресс
let totalCoins = 0;
let runCoins = 0;
let scoreText;
let distanceText;
let recordText;
let speedText;
let lowFuelText;
let gasButton, brakeButton, gasLabel, brakeLabel;
let fuelBarBg, fuelBarFill, hudBg;
let isGameOver = false;

let engineLvl = 1;
let suspensionLvl = 1;
let tiresLvl = 1;
let selectedCarId = 'jeep';

// Бензин
let maxFuel = 100;
let currentFuel = 100;

// Расстояние и трюки
let maxDistance = 0;
let lastAngle = 0;
let totalRotation = 0;

// Генерация мира и декора
let terrainChunks = [];
let lastGenX = -300;
let lastGenY = 440;
let currentSlope = 0;
let targetSlope = 0;
let segmentIndex = 0;
let lastCloudSaveTime = 0;

// Графические слои и пулы частиц
let skyGraphics;
let parallaxFar;
let parallaxNear;
let cloudsGroup = [];
let suspensionGraphics;
let particles = [];

const CAR_CONFIGS = {
    jeep: {
        name: 'Джип',
        w: 96, h: 30, rA: 24, rB: 24, wxA: -42, wxB: 42, wy: 18,
        cdens: 0.016, wdens: 0.004, fuel: 100, drive: 'awd',
        baseSpeed: 0.85, baseTorque: 0.010,
        bodyColor: 0xE53935, accentColor: 0xFFCDD2,
        exhaustX: -48, exhaustY: 8
    },
    bike: {
        name: 'Мотокросс',
        w: 74, h: 20, rA: 21, rB: 21, wxA: -34, wxB: 34, wy: 16,
        cdens: 0.010, wdens: 0.0025, fuel: 80, drive: 'awd',
        baseSpeed: 1.0, baseTorque: 0.009,
        bodyColor: 0xFB8C00, accentColor: 0xFFE0B2,
        exhaustX: -36, exhaustY: 4
    },
    tractor: {
        name: 'Трактор',
        w: 104, h: 38, rA: 34, rB: 23, wxA: -46, wxB: 46, wy: 20,
        cdens: 0.022, wdens: 0.006, fuel: 130, drive: 'awd',
        baseSpeed: 0.65, baseTorque: 0.018,
        bodyColor: 0x43A047, accentColor: 0xFBC02D,
        exhaustX: 15, exhaustY: -36
    },
    racecar: {
        name: 'Болид',
        w: 112, h: 22, rA: 22, rB: 22, wxA: -50, wxB: 50, wy: 14,
        cdens: 0.014, wdens: 0.0035, fuel: 95, drive: 'awd',
        baseSpeed: 1.25, baseTorque: 0.012,
        bodyColor: 0x1E88E5, accentColor: 0xFFFFFF,
        exhaustX: -56, exhaustY: 5
    },
    tank: {
        name: 'Монстр-Трак',
        w: 118, h: 42, rA: 33, rB: 33, wxA: -52, wxB: 52, wy: 24,
        cdens: 0.028, wdens: 0.008, fuel: 150, drive: 'awd',
        baseSpeed: 0.78, baseTorque: 0.022,
        bodyColor: 0x5E35B1, accentColor: 0x00E676,
        exhaustX: -54, exhaustY: 10
    }
};

function clampLvl(val) {
    let n = parseInt(val, 10);
    if (isNaN(n) || n < 1) return 1;
    return Math.min(MAX_LVL, n);
}

function seededRandom(seed) {
    let x = Math.sin(seed * 9999.123) * 10000;
    return x - Math.floor(x);
}

// Генерация процедурных текстур (выполняется 1 раз для максимального FPS)
function ensureTextures(scene) {
    if (scene.textures.exists('coin_tex')) return;

    let g = scene.make.graphics({ x: 0, y: 0, add: false });

    // 1. Текстура монетки
    g.clear();
    g.fillStyle(0xFFB300, 1);
    g.fillCircle(18, 18, 16);
    g.lineStyle(3, 0xFFF8E1, 1);
    g.strokeCircle(18, 18, 15);
    g.fillStyle(0xFFD54F, 1);
    g.fillCircle(18, 18, 11);
    g.fillStyle(0xF57F17, 1);
    g.fillRect(16, 11, 4, 14);
    g.generateTexture('coin_tex', 36, 36);

    // 2. Текстура канистры топлива
    g.clear();
    g.fillStyle(0xD32F2F, 1);
    g.fillRoundedRect(2, 6, 28, 34, 6);
    g.lineStyle(2, 0xFFCDD2, 1);
    g.strokeRoundedRect(2, 6, 28, 34, 6);
    g.fillStyle(0xB71C1C, 1);
    g.fillRoundedRect(8, 1, 12, 6, 2);
    g.fillStyle(0xFFEB3B, 1);
    g.fillRect(6, 18, 20, 8);
    g.generateTexture('fuel_tex', 32, 42);

    // 3. Текстура колеса (с протектором и диском)
    g.clear();
    const R = 36;
    g.fillStyle(0x1C1C1C, 1);
    g.fillCircle(R, R, R - 2);
    // Грунтозацепы протектора
    g.fillStyle(0x333333, 1);
    for (let i = 0; i < 12; i++) {
        let a = (i / 12) * Math.PI * 2;
        let tx = R + Math.cos(a) * (R - 3);
        let ty = R + Math.sin(a) * (R - 3);
        g.fillCircle(tx, ty, 4);
    }
    g.lineStyle(4, 0x424242, 1);
    g.strokeCircle(R, R, R - 7);
    // Металлический диск
    g.fillStyle(0xCFD8DC, 1);
    g.fillCircle(R, R, R * 0.52);
    g.fillStyle(0x455A64, 1);
    g.fillCircle(R, R, R * 0.42);
    // Спицы диска (чтобы было отлично видно вращение)
    g.lineStyle(4, 0xECEFF1, 1);
    for (let i = 0; i < 5; i++) {
        let a = (i / 5) * Math.PI * 2;
        g.beginPath();
        g.moveTo(R, R);
        g.lineTo(R + Math.cos(a) * (R * 0.48), R + Math.sin(a) * (R * 0.48));
        g.strokePath();
    }
    g.fillStyle(0xFF5252, 1);
    g.fillCircle(R, R, 5);
    g.generateTexture('wheel_tex', R * 2, R * 2);

    // 4. Текстура частицы (круглая)
    g.clear();
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(8, 8, 8);
    g.generateTexture('particle_tex', 16, 16);

    // 5. Текстура облака
    g.clear();
    g.fillStyle(0xFFFFFF, 0.85);
    g.fillCircle(35, 35, 22);
    g.fillCircle(60, 28, 28);
    g.fillCircle(90, 34, 24);
    g.fillCircle(112, 40, 18);
    g.fillRoundedRect(25, 32, 95, 26, 12);
    g.generateTexture('cloud_tex', 140, 65);

    // 6. Текстуры кузовов машин
    generateCarTextures(g);

    g.destroy();
}

function generateCarTextures(g) {
    // 1. JEEP
    g.clear();
    // Дуга безопасности и салон
    g.lineStyle(5, 0x263238, 1);
    g.strokeRoundedRect(28, 14, 54, 34, 6);
    // Водитель
    g.fillStyle(0xFFCCBC, 1);
    g.fillCircle(58, 26, 9);
    g.fillStyle(0x1976D2, 1);
    g.fillRoundedRect(48, 16, 20, 8, 4); // Кепка/шлем
    // Кузов джипа
    g.fillStyle(0xD32F2F, 1);
    g.fillRoundedRect(10, 38, 108, 30, 8);
    g.fillStyle(0xB71C1C, 1);
    g.fillRect(14, 54, 100, 12);
    // Капот и лобовое стекло
    g.lineStyle(4, 0x90CAF9, 0.9);
    g.beginPath();
    g.moveTo(76, 38);
    g.lineTo(68, 16);
    g.strokePath();
    // Полоса и фара
    g.fillStyle(0xFFEB3B, 1);
    g.fillRect(16, 44, 92, 5);
    g.fillStyle(0xFFF59D, 1);
    g.fillCircle(115, 46, 5);
    // Бамперы
    g.fillStyle(0x37474F, 1);
    g.fillRoundedRect(4, 56, 12, 10, 3);
    g.fillRoundedRect(112, 56, 12, 10, 3);
    g.generateTexture('car_jeep', 128, 80);

    // 2. BIKE (Мотокросс)
    g.clear();
    // Райдер
    g.fillStyle(0x263238, 1);
    g.fillRoundedRect(38, 24, 16, 24, 5);
    g.fillStyle(0xFFEB3B, 1);
    g.fillCircle(48, 16, 10); // Шлем
    g.fillStyle(0x212121, 1);
    g.fillRect(52, 13, 7, 5); // Визор
    // Рама и пластик мотоцикла
    g.lineStyle(5, 0xB0BEC5, 1);
    g.beginPath();
    g.moveTo(22, 54);
    g.lineTo(48, 38);
    g.lineTo(76, 42);
    g.lineTo(86, 58);
    g.strokePath();
    g.fillStyle(0xFB8C00, 1);
    g.fillTriangle(20, 44, 55, 36, 45, 52);
    g.fillTriangle(50, 36, 88, 34, 68, 50);
    // Руль
    g.lineStyle(4, 0x212121, 1);
    g.beginPath();
    g.moveTo(74, 40);
    g.lineTo(68, 24);
    g.strokePath();
    g.generateTexture('car_bike', 110, 75);

    // 3. TRACTOR (Трактор)
    g.clear();
    // Кабина
    g.fillStyle(0x2E7D32, 1);
    g.fillRoundedRect(16, 12, 48, 42, 6);
    g.fillStyle(0xB3E5FC, 0.75);
    g.fillRoundedRect(22, 18, 36, 26, 4);
    // Водитель в кабине
    g.fillStyle(0xFFCC80, 1);
    g.fillCircle(40, 32, 8);
    // Выхлопная труба вверх
    g.fillStyle(0x263238, 1);
    g.fillRect(82, 14, 7, 32);
    g.fillRect(80, 10, 11, 6);
    // Моторный отсек
    g.fillStyle(0x43A047, 1);
    g.fillRoundedRect(14, 42, 96, 30, 6);
    g.fillStyle(0xFBC02D, 1);
    g.fillRect(18, 52, 88, 6);
    // Решетка радиатора и фара
    g.fillStyle(0x1B5E20, 1);
    g.fillRect(102, 46, 6, 20);
    g.fillStyle(0xFFF59D, 1);
    g.fillCircle(110, 48, 5);
    g.generateTexture('car_tractor', 124, 84);

    // 4. RACECAR (Гоночный болид)
    g.clear();
    // Антикрыло сзади
    g.fillStyle(0x0D47A1, 1);
    g.fillRect(8, 22, 16, 6);
    g.fillRect(12, 28, 6, 18);
    // Пилот
    g.fillStyle(0xFF1744, 1);
    g.fillCircle(64, 30, 9);
    g.fillStyle(0x212121, 1);
    g.fillRect(67, 27, 6, 4);
    // Аэродинамический корпус
    g.fillStyle(0x1E88E5, 1);
    g.fillRoundedRect(10, 40, 112, 20, 8);
    g.fillTriangle(72, 30, 126, 48, 72, 48);
    // Белая гоночная полоса
    g.fillStyle(0xFFFFFF, 1);
    g.fillRect(16, 47, 104, 5);
    // Передний сплиттер
    g.fillStyle(0x0D47A1, 1);
    g.fillRoundedRect(114, 54, 18, 6, 2);
    g.generateTexture('car_racecar', 136, 72);

    // 5. TANK / MONSTER TRUCK (Монстр-трак)
    g.clear();
    // Кузов пикапа-монстра
    g.fillStyle(0x4527A0, 1);
    g.fillRoundedRect(12, 32, 116, 32, 8);
    g.fillStyle(0x5E35B1, 1);
    g.fillRoundedRect(38, 12, 54, 28, 8);
    // Окно
    g.fillStyle(0x80D8FF, 0.85);
    g.fillRoundedRect(46, 16, 38, 18, 4);
    // Ядовито-зеленая полоса и пружины рамы
    g.fillStyle(0x00E676, 1);
    g.fillRect(16, 44, 108, 7);
    // Кенгурятник и прожекторы на крыше
    g.fillStyle(0xFFEA00, 1);
    g.fillCircle(56, 8, 5);
    g.fillCircle(72, 8, 5);
    g.fillCircle(126, 42, 6);
    g.fillStyle(0x263238, 1);
    g.fillRect(24, 60, 92, 10);
    g.generateTexture('car_tank', 140, 82);
}

function createBackground(scene) {
    const w = scene.scale.width;
    const h = scene.scale.height;

    if (skyGraphics) skyGraphics.destroy();
    skyGraphics = scene.add.graphics().setScrollFactor(0).setDepth(-100);
    drawSky(skyGraphics, w, h);

    // Параллакс далёких гор
    if (parallaxFar) parallaxFar.destroy();
    parallaxFar = scene.add.graphics().setScrollFactor(0.08, 0).setDepth(-90);
    parallaxFar.fillStyle(0x5C6BC0, 0.55);
    parallaxFar.beginPath();
    parallaxFar.moveTo(-2000, h + 500);
    for (let x = -2000; x <= 25000; x += 260) {
        let peak = h * 0.45 - Math.abs(Math.sin(x * 0.0025)) * 180 - Math.cos(x * 0.006) * 70;
        parallaxFar.lineTo(x, peak);
    }
    parallaxFar.lineTo(25000, h + 500);
    parallaxFar.closePath();
    parallaxFar.fillPath();

    // Параллакс ближних холмов
    if (parallaxNear) parallaxNear.destroy();
    parallaxNear = scene.add.graphics().setScrollFactor(0.2, 0).setDepth(-80);
    parallaxNear.fillStyle(0x2E7D32, 0.45);
    parallaxNear.beginPath();
    parallaxNear.moveTo(-2000, h + 500);
    for (let x = -2000; x <= 25000; x += 180) {
        let hill = h * 0.58 - Math.sin(x * 0.004 + 1) * 90 - Math.cos(x * 0.01) * 40;
        parallaxNear.lineTo(x, hill);
    }
    parallaxNear.lineTo(25000, h + 500);
    parallaxNear.closePath();
    parallaxNear.fillPath();

    // Облака
    cloudsGroup.forEach(c => c.destroy());
    cloudsGroup = [];
    for (let i = 0; i < 12; i++) {
        let cx = i * 450 - 400;
        let cy = 60 + (i % 4) * 55;
        let cloud = scene.add.image(cx, cy, 'cloud_tex')
            .setScrollFactor(0.15, 0.05)
            .setDepth(-85)
            .setAlpha(0.75)
            .setScale(0.8 + (i % 3) * 0.25);
        cloudsGroup.push(cloud);
    }
}

function drawSky(g, w, h) {
    g.clear();
    // Градиент неба (через плавные полосы с запасом под зум 0.75)
    const pad = 600;
    const topColor = Phaser.Display.Color.ValueToColor(0x1E88E5);
    const midColor = Phaser.Display.Color.ValueToColor(0x64B5F6);
    const botColor = Phaser.Display.Color.ValueToColor(0xE1F5FE);
    const steps = 24;
    const totalH = h + pad * 2;
    for (let i = 0; i < steps; i++) {
        let t = i / (steps - 1);
        let c = t < 0.5
            ? Phaser.Display.Color.Interpolate.ColorWithColor(topColor, midColor, 1, t * 2)
            : Phaser.Display.Color.Interpolate.ColorWithColor(midColor, botColor, 1, (t - 0.5) * 2);
        let hex = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        g.fillStyle(hex, 1);
        g.fillRect(-pad, -pad + (totalH / steps) * i, w + pad * 2, (totalH / steps) + 2);
    }
    // Солнце с мягким свечением
    const sunX = w * 0.82;
    const sunY = h * 0.18;
    g.fillStyle(0xFFF9C4, 0.22);
    g.fillCircle(sunX, sunY, 95);
    g.fillStyle(0xFFEE58, 0.4);
    g.fillCircle(sunX, sunY, 62);
    g.fillStyle(0xFFFDE7, 0.95);
    g.fillCircle(sunX, sunY, 38);
}

function create() {
    // Сброс всех глобальных состояний при старте / рестарте сцены
    isGameOver = false;
    isGasPressed = false;
    isBrakePressed = false;
    wheelAGrounded = false;
    wheelBGrounded = false;
    isGrounded = false;
    runCoins = 0;
    lastAngle = 0;
    totalRotation = 0;
    terrainChunks = [];
    particles = [];
    lastGenX = -300;
    lastGenY = 440;
    currentSlope = 0;
    targetSlope = 0;
    segmentIndex = 0;
    car = {};

    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        try { window.Telegram.WebApp.expand(); } catch (e) {}
    }

    ensureTextures(this);
    createBackground(this);

    selectedCarId = localStorage.getItem('selectedCar') || 'jeep';
    if (!CAR_CONFIGS[selectedCarId]) selectedCarId = 'jeep';

    totalCoins = parseInt(localStorage.getItem('hillClimbCoins'), 10) || 0;
    engineLvl = clampLvl(localStorage.getItem('engineLevel_' + selectedCarId) || (selectedCarId === 'jeep' ? localStorage.getItem('engineLevel') : 1));
    suspensionLvl = clampLvl(localStorage.getItem('suspensionLevel_' + selectedCarId) || (selectedCarId === 'jeep' ? localStorage.getItem('suspensionLevel') : 1));
    tiresLvl = clampLvl(localStorage.getItem('tiresLevel_' + selectedCarId) || (selectedCarId === 'jeep' ? localStorage.getItem('tiresLevel') : 1));
    maxDistance = parseInt(localStorage.getItem('maxDistance_' + selectedCarId), 10) || (selectedCarId === 'jeep' ? parseInt(localStorage.getItem('maxDistance'), 10) : 0) || 0;

    Matter = Phaser.Physics.Matter.Matter;

    // Графика пружин подвески
    suspensionGraphics = this.add.graphics().setDepth(11);

    // 1. Генерация стартового участка трассы
    generateTerrain(this, 3000);

    // 2. Создание машины
    createCar(this);

    // 3. Точное отслеживание контакта колёс с землёй на каждом шаге физики
    this.matter.world.on('beforeupdate', () => {
        wheelAGrounded = false;
        wheelBGrounded = false;
    });

    const updateGroundContacts = (event) => {
        if (isGameOver) return;
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const labelA = pairs[i].bodyA.label;
            const labelB = pairs[i].bodyB.label;
            if (labelA === 'ground') {
                if (labelB === 'wheelA') wheelAGrounded = true;
                else if (labelB === 'wheelB') wheelBGrounded = true;
            } else if (labelB === 'ground') {
                if (labelA === 'wheelA') wheelAGrounded = true;
                else if (labelA === 'wheelB') wheelBGrounded = true;
            }
        }
        isGrounded = wheelAGrounded || wheelBGrounded;
    };

    this.matter.world.on('collisionactive', updateGroundContacts);

    this.matter.world.on('collisionstart', (event) => {
        updateGroundContacts(event);
        if (isGameOver) return;

        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const bodyA = pairs[i].bodyA;
            const bodyB = pairs[i].bodyB;
            const isCarA = bodyA.label === 'wheelA' || bodyA.label === 'wheelB' || bodyA.label === 'chassis';
            const isCarB = bodyB.label === 'wheelA' || bodyB.label === 'wheelB' || bodyB.label === 'chassis';

            // Сбор монет
            if (bodyA.label === 'coin' && isCarB) {
                collectCoin(bodyA.gameObject, this);
            } else if (bodyB.label === 'coin' && isCarA) {
                collectCoin(bodyB.gameObject, this);
            }

            // Сбор канистры бензина
            if (bodyA.label === 'fuel' && isCarB) {
                collectFuel(bodyA.gameObject, this);
            } else if (bodyB.label === 'fuel' && isCarA) {
                collectFuel(bodyB.gameObject, this);
            }

            // Переворот на крышу
            if ((bodyA.label === 'ground' && bodyB.label === 'chassis') ||
                (bodyB.label === 'ground' && bodyA.label === 'chassis')) {
                if (Math.abs(car.chassis.rotation) > 1.55) {
                    gameOver(this, 'АВАРИЯ!\nМашина перевернулась');
                }
            }
        }
    });

    cursors = this.input.keyboard.createCursorKeys();

    // 4. Отрисовка интерфейса и синхронизация с Telegram CloudStorage
    createUI(this);
    syncCloudData(this);

    // 5. Настройка камеры
    this.cameras.main.startFollow(car.chassis, false, 0.12, 0.12);
    this.cameras.main.setZoom(0.76);
    this.cameras.main.setFollowOffset(90, 35);
}

function syncCloudData(scene) {
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            const cs = window.Telegram.WebApp.CloudStorage;
            cs.getItem('hillClimbCoins', (err, value) => {
                if (value !== undefined && value !== null && value !== '') {
                    totalCoins = Math.max(totalCoins, parseInt(value, 10) || 0);
                    localStorage.setItem('hillClimbCoins', totalCoins.toString());
                    if (scoreText && scoreText.active) scoreText.setText(totalCoins.toString());
                }
            });
            cs.getItem('engineLevel_' + selectedCarId, (err, value) => {
                if (value) engineLvl = clampLvl(value);
            });
            cs.getItem('suspensionLevel_' + selectedCarId, (err, value) => {
                if (value) {
                    suspensionLvl = clampLvl(value);
                    updateSuspensionPhysics();
                }
            });
            cs.getItem('tiresLevel_' + selectedCarId, (err, value) => {
                if (value) {
                    tiresLvl = clampLvl(value);
                    updateTiresPhysics();
                }
            });
            cs.getItem('maxDistance_' + selectedCarId, (err, value) => {
                if (value) {
                    maxDistance = Math.max(maxDistance, parseInt(value, 10) || 0);
                    if (recordText && recordText.active) recordText.setText('РЕКОРД: ' + maxDistance + ' м');
                }
            });
        }
    } catch (e) {}
}

function spawnParticle(scene, x, y, vx, vy, color, scale, duration) {
    if (particles.length > 45) return; // Лимит частиц для стабильных 60 FPS
    let p = scene.add.image(x, y, 'particle_tex')
        .setTint(color)
        .setScale(scale)
        .setDepth(9);
    p.vx = vx;
    p.vy = vy;
    p.life = duration;
    p.maxLife = duration;
    p.initScale = scale;
    particles.push(p);
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
            p.destroy();
            particles.splice(i, 1);
            continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // гравитация для частиц
        let ratio = p.life / p.maxLife;
        p.setAlpha(ratio);
        p.setScale(p.initScale * (0.4 + 0.6 * ratio));
    }
}

function generateTerrain(scene, upToX) {
    while (lastGenX < upToX) {
        // Стартовые 5 сегментов делаем ровными для комфортного разгона
        if (segmentIndex < 5) {
            targetSlope = 0;
            currentSlope = 0;
        } else if (seededRandom(segmentIndex) < 0.14) {
            let maxSlope = Math.min(145, 36 + (segmentIndex / 5.5));
            targetSlope = (seededRandom(segmentIndex + 1000) * (maxSlope * 2)) - maxSlope;
        }

        currentSlope += (targetSlope - currentSlope) * 0.09;

        let x = lastGenX + 120;
        let y = lastGenY + currentSlope;

        if (segmentIndex >= 5) {
            let noise = (seededRandom(segmentIndex * 50) * 10) - 5;
            y += noise;
        }

        let dx = x - lastGenX;
        let dy = y - lastGenY;
        let angle = Math.atan2(dy, dx);
        let length = Math.sqrt(dx * dx + dy * dy);
        let midX = lastGenX + dx / 2;
        let midY = lastGenY + dy / 2;

        // Отрисовка красивого слоёного полигона земли (без вертикальных швов!)
        let groundVis = scene.add.graphics().setDepth(5);
        const depth = 950;
        const crustDepth = 26;

        // 1. Нижний грунтовый слой
        groundVis.fillStyle(0x4E342E, 1);
        groundVis.beginPath();
        groundVis.moveTo(lastGenX - 2, lastGenY + crustDepth);
        groundVis.lineTo(x + 2, y + crustDepth);
        groundVis.lineTo(x + 2, y + depth);
        groundVis.lineTo(lastGenX - 2, lastGenY + depth);
        groundVis.closePath();
        groundVis.fillPath();

        // 2. Подпочвенный слой (более светлая земля)
        groundVis.fillStyle(0x6D4C41, 1);
        groundVis.beginPath();
        groundVis.moveTo(lastGenX - 1, lastGenY);
        groundVis.lineTo(x + 1, y);
        groundVis.lineTo(x + 1, y + crustDepth + 12);
        groundVis.lineTo(lastGenX - 1, lastGenY + crustDepth + 12);
        groundVis.closePath();
        groundVis.fillPath();

        // Декоративные камни в толще земли
        if (segmentIndex % 2 === 0) {
            let rx = midX + (seededRandom(segmentIndex * 13) - 0.5) * 50;
            let ry = midY + 55 + seededRandom(segmentIndex * 29) * 110;
            groundVis.fillStyle(0x3E2723, 0.65);
            groundVis.fillCircle(rx, ry, 8 + seededRandom(segmentIndex * 7) * 12);
        }

        // 3. Сочная зелёная трава только по верхнему краю!
        groundVis.fillStyle(0x43A047, 1);
        groundVis.beginPath();
        groundVis.moveTo(lastGenX - 1, lastGenY - 3);
        groundVis.lineTo(x + 1, y - 3);
        groundVis.lineTo(x + 1, y + 16);
        groundVis.lineTo(lastGenX - 1, lastGenY + 16);
        groundVis.closePath();
        groundVis.fillPath();

        // Светлый блик травы сверху
        groundVis.lineStyle(5, 0x76FF03, 0.75);
        groundVis.beginPath();
        groundVis.moveTo(lastGenX - 1, lastGenY - 2);
        groundVis.lineTo(x + 1, y - 2);
        groundVis.strokePath();

        // Физический сегмент
        let physicsGround = scene.add.rectangle(midX, midY + 8, length, 20, 0x000000, 0);
        scene.matter.add.gameObject(physicsGround, {
            isStatic: true,
            angle: angle,
            friction: 1.2,
            restitution: 0.05,
            label: 'ground'
        });

        // Сглаживающий узел на стыке сегментов
        let joint = scene.add.circle(lastGenX, lastGenY + 8, 10, 0x000000, 0);
        scene.matter.add.gameObject(joint, {
            isStatic: true,
            friction: 1.2,
            restitution: 0.05,
            label: 'ground'
        });

        let chunk = {
            ground: groundVis,
            phys: physicsGround,
            joint: joint,
            x: midX,
            coin: null,
            fuel: null,
            decor: null
        };

        // Таблички дистанции каждые 100м (100m = 10000px от старта x=300)
        let distMeters = Math.floor((midX - 300) / 100);
        let prevDistMeters = Math.floor((lastGenX - 300) / 100);
        if (distMeters >= 50 && distMeters % 50 === 0 && prevDistMeters % 50 !== 0) {
            let signText = scene.add.text(midX, midY - 38, distMeters + 'm', {
                fontSize: '18px',
                fontFamily: 'Arial',
                fontStyle: 'bold',
                fill: '#FFFFFF',
                backgroundColor: '#2E7D32',
                padding: { x: 8, y: 4 }
            }).setOrigin(0.5).setDepth(4);
            chunk.decor = signText;
        }

        // Спавн монеток (пачками по 3 штуки вдоль дуги холма)
        if (segmentIndex > 4 && (segmentIndex % 6 === 0 || segmentIndex % 6 === 1)) {
            let coin = scene.add.image(midX, midY - 48, 'coin_tex').setDepth(8);
            scene.matter.add.gameObject(coin, {
                shape: { type: 'circle', radius: 18 },
                isStatic: true,
                isSensor: true,
                label: 'coin'
            });
            chunk.coin = coin;
        }

        // Спавн канистры с бензином каждые 18 блоков
        if (segmentIndex > 8 && segmentIndex % 18 === 0) {
            let fuelCan = scene.add.image(midX, midY - 54, 'fuel_tex').setDepth(8);
            scene.matter.add.gameObject(fuelCan, {
                shape: { type: 'rectangle', width: 32, height: 42 },
                isStatic: true,
                isSensor: true,
                label: 'fuel'
            });
            chunk.fuel = fuelCan;
        }

        terrainChunks.push(chunk);

        lastGenX = x;
        lastGenY = y;
        segmentIndex++;
    }
}

function destroyMatterObject(scene, go) {
    if (!go) return;
    if (go.body) {
        scene.matter.world.remove(go.body);
    }
    if (go.active) {
        go.destroy();
    }
}

function collectCoin(coinGO, scene) {
    if (!coinGO || !coinGO.active) return;
    let cx = coinGO.x;
    let cy = coinGO.y;
    destroyMatterObject(scene, coinGO);

    totalCoins += 5;
    runCoins += 5;
    if (scoreText) scoreText.setText(totalCoins.toString());

    // Вспышка частиц при сборе монеты
    for (let i = 0; i < 6; i++) {
        let a = (i / 6) * Math.PI * 2;
        spawnParticle(scene, cx, cy, Math.cos(a) * 3, Math.sin(a) * 3 - 1, 0xFFD700, 0.6, 18);
    }

    localStorage.setItem('hillClimbCoins', totalCoins.toString());

    let now = Date.now();
    if (now - lastCloudSaveTime > 2000) {
        lastCloudSaveTime = now;
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
                window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', totalCoins.toString(), () => {});
            }
        } catch (e) {}
    }
}

function awardBonus(amount, textMessage, scene) {
    totalCoins += amount;
    runCoins += amount;
    if (scoreText) scoreText.setText(totalCoins.toString());
    localStorage.setItem('hillClimbCoins', totalCoins.toString());

    let txt = scene.add.text(car.chassis.x, car.chassis.y - 110, textMessage, {
        fontSize: '30px',
        fontFamily: 'Arial',
        fill: '#FFD700',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5
    }).setOrigin(0.5).setDepth(50);

    scene.tweens.add({
        targets: txt,
        y: txt.y - 65,
        alpha: 0,
        duration: 1300,
        onComplete: () => txt.destroy()
    });
}

function collectFuel(fuelGO, scene) {
    if (!fuelGO || !fuelGO.active) return;
    let fx = fuelGO.x;
    let fy = fuelGO.y;
    destroyMatterObject(scene, fuelGO);

    currentFuel = maxFuel;

    for (let i = 0; i < 8; i++) {
        let a = (i / 8) * Math.PI * 2;
        spawnParticle(scene, fx, fy, Math.cos(a) * 3.5, Math.sin(a) * 3.5 - 1, 0x00E676, 0.7, 22);
    }

    let txt = scene.add.text(car.chassis.x, car.chassis.y - 95, '⛽ ПОЛНЫЙ БАК!', {
        fontSize: '26px',
        fontFamily: 'Arial',
        fill: '#00E676',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 5
    }).setOrigin(0.5).setDepth(50);

    scene.tweens.add({
        targets: txt,
        y: txt.y - 55,
        alpha: 0,
        duration: 1000,
        onComplete: () => txt.destroy()
    });
}

function createCar(scene) {
    let x = 300;
    let y = 340;
    let cfg = CAR_CONFIGS[selectedCarId] || CAR_CONFIGS.jeep;

    maxFuel = cfg.fuel;
    currentFuel = maxFuel;
    if (fuelBarFill) fuelBarFill.width = 188;

    let group = scene.matter.world.nextGroup(true);
    let chassisRect = scene.add.rectangle(x, y, cfg.w, cfg.h, 0x000000, 0);

    car.chassis = scene.matter.add.gameObject(chassisRect, {
        collisionFilter: { group: group },
        density: cfg.cdens,
        restitution: 0.05,
        friction: 0.25,
        frictionAir: 0.015,
        chamfer: { radius: 8 },
        label: 'chassis'
    });

    // Создаём видимые вращающиеся колёса с текстурой протектора
    let wA = scene.add.image(x + cfg.wxA, y + cfg.wy, 'wheel_tex').setDepth(12);
    wA.setDisplaySize(cfg.rA * 2, cfg.rA * 2);
    let wB = scene.add.image(x + cfg.wxB, y + cfg.wy, 'wheel_tex').setDepth(12);
    wB.setDisplaySize(cfg.rB * 2, cfg.rB * 2);

    car.wheelA = scene.matter.add.gameObject(wA, {
        shape: { type: 'circle', radius: cfg.rA },
        collisionFilter: { group: group },
        friction: 0.85,
        density: cfg.wdens,
        restitution: 0.05,
        label: 'wheelA'
    });

    car.wheelB = scene.matter.add.gameObject(wB, {
        shape: { type: 'circle', radius: cfg.rB },
        collisionFilter: { group: group },
        friction: 0.85,
        density: cfg.wdens,
        restitution: 0.05,
        label: 'wheelB'
    });

    // Пружины подвески
    car.springA = scene.matter.add.spring(car.chassis.body, car.wheelA.body, 14, 0.1, {
        pointA: { x: cfg.wxA, y: cfg.wy - 8 },
        damping: 0.08
    });
    car.springB = scene.matter.add.spring(car.chassis.body, car.wheelB.body, 14, 0.1, {
        pointA: { x: cfg.wxB, y: cfg.wy - 8 },
        damping: 0.08
    });

    // Спрайт кузова машины
    let texKey = 'car_' + selectedCarId;
    if (!scene.textures.exists(texKey)) texKey = 'car_jeep';
    car.sprite = scene.add.image(x, y, texKey).setOrigin(0.5, 0.58).setDepth(10);

    car.cfg = cfg;
    car.driveType = cfg.drive;
    car.airFrames = 0;

    updateSuspensionPhysics();
    updateTiresPhysics();
}

function updateSuspensionPhysics() {
    if (car.springA && car.springB) {
        let newStiffness = 0.045 + (suspensionLvl * 0.008);
        let newDamping = 0.05 + (suspensionLvl * 0.008);
        car.springA.stiffness = newStiffness;
        car.springA.damping = newDamping;
        car.springB.stiffness = newStiffness;
        car.springB.damping = newDamping;
    }
}

function updateTiresPhysics() {
    if (car.wheelA && car.wheelB) {
        let newFriction = Math.min(1.4, 0.7 + (tiresLvl * 0.07));
        car.wheelA.body.friction = newFriction;
        car.wheelB.body.friction = newFriction;
    }
}

function drawSuspensionAndCar() {
    if (!car.chassis || !car.sprite || !suspensionGraphics) return;

    const cx = car.chassis.x;
    const cy = car.chassis.y;
    const rot = car.chassis.rotation;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const cfg = car.cfg;

    // Позиционируем кузов
    car.sprite.setPosition(cx, cy);
    car.sprite.setRotation(rot);

    // Рисуем амортизаторы и рычаги подвески от кузова к центру каждого колеса
    suspensionGraphics.clear();

    const axA = cx + cfg.wxA * cos - (cfg.wy - 10) * sin;
    const ayA = cy + cfg.wxA * sin + (cfg.wy - 10) * cos;
    const axB = cx + cfg.wxB * cos - (cfg.wy - 10) * sin;
    const ayB = cy + cfg.wxB * sin + (cfg.wy - 10) * cos;

    // Задняя стойка
    suspensionGraphics.lineStyle(6, 0x263238, 1);
    suspensionGraphics.beginPath();
    suspensionGraphics.moveTo(axA, ayA);
    suspensionGraphics.lineTo(car.wheelA.x, car.wheelA.y);
    suspensionGraphics.strokePath();

    suspensionGraphics.lineStyle(3, 0xFF5252, 1);
    suspensionGraphics.beginPath();
    suspensionGraphics.moveTo(axA, ayA);
    suspensionGraphics.lineTo(car.wheelA.x, car.wheelA.y);
    suspensionGraphics.strokePath();

    // Передняя стойка
    suspensionGraphics.lineStyle(6, 0x263238, 1);
    suspensionGraphics.beginPath();
    suspensionGraphics.moveTo(axB, ayB);
    suspensionGraphics.lineTo(car.wheelB.x, car.wheelB.y);
    suspensionGraphics.strokePath();

    suspensionGraphics.lineStyle(3, 0xFF5252, 1);
    suspensionGraphics.beginPath();
    suspensionGraphics.moveTo(axB, ayB);
    suspensionGraphics.lineTo(car.wheelB.x, car.wheelB.y);
    suspensionGraphics.strokePath();
}

function createUI(scene) {
    const width = scene.scale.width;
    const height = scene.scale.height;

    // Подложка верхней панели
    hudBg = scene.add.rectangle(width / 2, 42, Math.min(width - 16, 560), 68, 0x0f172a, 0.65)
        .setScrollFactor(0).setDepth(99);
    hudBg.setStrokeStyle(2, 0x334155, 0.8);

    // Иконка и счёт монет (слева)
    scene.add.image(34, 32, 'coin_tex').setDisplaySize(28, 28).setScrollFactor(0).setDepth(100);
    scoreText = scene.add.text(54, 17, totalCoins.toString(), {
        fontSize: '26px',
        fill: '#FFD700',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4
    }).setScrollFactor(0).setDepth(100);

    // Спидометр под монетами
    speedText = scene.add.text(22, 48, '0 км/ч', {
        fontSize: '14px',
        fill: '#94A3B8',
        fontFamily: 'Arial',
        fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(100);

    // Шкала топлива (по центру)
    scene.add.text(width / 2, 19, '⛽ ТОПЛИВО', {
        fontSize: '13px',
        fill: '#F8FAFC',
        fontFamily: 'Arial',
        fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    fuelBarBg = scene.add.rectangle(width / 2, 42, 164, 16, 0x1E293B, 0.95)
        .setScrollFactor(0).setDepth(100);
    fuelBarBg.setStrokeStyle(2, 0x475569);

    fuelBarFill = scene.add.rectangle(width / 2 - 79, 42, 158, 10, 0x22C55E, 1)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

    lowFuelText = scene.add.text(width / 2, 62, '⚠️ МАЛО БЕНЗИНА!', {
        fontSize: '13px',
        fill: '#EF4444',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);

    // Дистанция и Рекорд (справа, с отступом под кнопку МЕНЮ)
    distanceText = scene.add.text(width - 96, 16, '0 м', {
        fontSize: '24px',
        fill: '#FFFFFF',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    recordText = scene.add.text(width - 96, 45, 'РЕКОРД: ' + maxDistance + ' м', {
        fontSize: '13px',
        fill: '#FBBF24',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Педаль ТОРМОЗ (слева внизу)
    brakeButton = scene.add.rectangle(88, height - 88, 132, 110, 0xEF4444, 0.8)
        .setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
    brakeButton.setStrokeStyle(4, 0x991B1B);

    brakeLabel = scene.add.text(88, height - 88, '⏪\nТОРМОЗ', {
        fontSize: '20px',
        fontFamily: 'Arial',
        fill: '#FFFFFF',
        align: 'center',
        fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // Педаль ГАЗ (справа внизу)
    gasButton = scene.add.rectangle(width - 88, height - 88, 132, 110, 0x22C55E, 0.8)
        .setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
    gasButton.setStrokeStyle(4, 0x15803D);

    gasLabel = scene.add.text(width - 88, height - 88, '⏩\nГАЗ', {
        fontSize: '22px',
        fontFamily: 'Arial',
        fill: '#FFFFFF',
        align: 'center',
        fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

    // Обработчики мультитача для педалей
    scene.input.addPointer(2);

    gasButton.on('pointerdown', () => {
        isGasPressed = true;
        gasButton.setScale(0.92).setAlpha(1);
        gasLabel.setScale(0.92);
    });
    const releaseGas = () => {
        isGasPressed = false;
        gasButton.setScale(1).setAlpha(0.8);
        gasLabel.setScale(1);
    };
    gasButton.on('pointerup', releaseGas);
    gasButton.on('pointerout', releaseGas);

    brakeButton.on('pointerdown', () => {
        isBrakePressed = true;
        brakeButton.setScale(0.92).setAlpha(1);
        brakeLabel.setScale(0.92);
    });
    const releaseBrake = () => {
        isBrakePressed = false;
        brakeButton.setScale(1).setAlpha(0.8);
        brakeLabel.setScale(1);
    };
    brakeButton.on('pointerup', releaseBrake);
    brakeButton.on('pointerout', releaseBrake);
}

function gameOver(scene, reasonText) {
    if (isGameOver) return;
    isGameOver = true;
    scene.matter.world.pause();

    // Сохраняем монеты и рекорд конкретной машины
    localStorage.setItem('hillClimbCoins', totalCoins.toString());
    localStorage.setItem('maxDistance_' + selectedCarId, maxDistance.toString());
    if (selectedCarId === 'jeep') localStorage.setItem('maxDistance', maxDistance.toString());

    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
            const cs = window.Telegram.WebApp.CloudStorage;
            cs.setItem('hillClimbCoins', totalCoins.toString(), () => {});
            cs.setItem('maxDistance_' + selectedCarId, maxDistance.toString(), () => {});
            if (selectedCarId === 'jeep') cs.setItem('maxDistance', maxDistance.toString(), () => {});
        }
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
        }
    } catch (e) {}

    const width = scene.scale.width;
    const height = scene.scale.height;

    // Затемнение фона
    scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65)
        .setScrollFactor(0).setDepth(190);

    // Карточка результатов
    let card = scene.add.rectangle(width / 2, height / 2, Math.min(width - 40, 340), 310, 0x1E293B, 0.96)
        .setScrollFactor(0).setDepth(195);
    card.setStrokeStyle(3, 0x475569);

    scene.add.text(width / 2, height / 2 - 105, reasonText, {
        fontSize: '26px',
        fontFamily: 'Arial',
        fill: '#F87171',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#000',
        strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    let currentDist = Math.max(0, Math.floor((car.chassis.x - 300) / 100));
    scene.add.text(width / 2, height / 2 - 35, `Дистанция: ${currentDist} м\nСобрано: +${runCoins} 💰`, {
        fontSize: '19px',
        fontFamily: 'Arial',
        fill: '#E2E8F0',
        fontStyle: 'bold',
        align: 'center',
        lineSpacing: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Кнопка ЗАНОВО (мгновенный рестарт сцены без перезагрузки страницы!)
    let retryBtn = scene.add.rectangle(width / 2, height / 2 + 42, 230, 52, 0x22C55E, 1)
        .setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    retryBtn.setStrokeStyle(2, 0x86EFAC);

    scene.add.text(width / 2, height / 2 + 42, '🔄 ЗАНОВО', {
        fontSize: '21px',
        fontFamily: 'Arial',
        fill: '#FFF',
        fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    retryBtn.on('pointerdown', () => {
        scene.scene.restart();
    });

    // Кнопка В ГАРАЖ / МЕНЮ
    let menuBtn = scene.add.rectangle(width / 2, height / 2 + 108, 230, 52, 0x3B82F6, 1)
        .setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    menuBtn.setStrokeStyle(2, 0x93C5FD);

    scene.add.text(width / 2, height / 2 + 108, '🏠 В МЕНЮ', {
        fontSize: '20px',
        fontFamily: 'Arial',
        fill: '#FFF',
        fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    menuBtn.on('pointerdown', () => {
        window.location.href = 'hillclimb_menu.html';
    });
}

function update() {
    if (isGameOver || !car.chassis) return;

    // 1. Счётчик кадров в воздухе (Coyote Time против микро-кочек)
    if (isGrounded) {
        car.airFrames = 0;
    } else {
        car.airFrames = (car.airFrames || 0) + 1;
    }

    // 2. Генерация и полная очистка пройденных чанков (без утечек памяти!)
    generateTerrain(this, car.chassis.x + 2600);
    let cleanupX = car.chassis.x - 1800;
    while (terrainChunks.length > 0 && terrainChunks[0].x < cleanupX) {
        let chunk = terrainChunks.shift();
        if (chunk.ground && chunk.ground.active) chunk.ground.destroy();
        if (chunk.decor && chunk.decor.active) chunk.decor.destroy();
        destroyMatterObject(this, chunk.phys);
        destroyMatterObject(this, chunk.joint);
        destroyMatterObject(this, chunk.coin);
        destroyMatterObject(this, chunk.fuel);
    }

    if (car.chassis.y > 2000) {
        gameOver(this, 'ПАДЕНИЕ В ПРОПАСТЬ!');
        return;
    }

    // 3. Обновление дистанции, рекорда и спидометра
    let currentDist = Math.max(0, Math.floor((car.chassis.x - 300) / 100));
    if (distanceText) distanceText.setText(currentDist + ' м');

    let speedKmh = Math.round(Math.hypot(car.chassis.body.velocity.x, car.chassis.body.velocity.y) * 6.5);
    if (speedText) speedText.setText(speedKmh + ' км/ч');

    if (currentDist > maxDistance) {
        maxDistance = currentDist;
        if (recordText) recordText.setText('РЕКОРД: ' + maxDistance + ' м');
        localStorage.setItem('maxDistance_' + selectedCarId, maxDistance.toString());
        if (selectedCarId === 'jeep') localStorage.setItem('maxDistance', maxDistance.toString());
    }

    // 4. Подсчёт сальто в воздухе
    let currentAngle = car.chassis.rotation;
    let diff = currentAngle - lastAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    if (!isGrounded && car.airFrames > 8) {
        totalRotation += diff;
        if (Math.abs(totalRotation) >= Math.PI * 1.75) {
            let isBackflip = totalRotation < 0;
            totalRotation = 0;
            awardBonus(50, isBackflip ? '🔥 BACKFLIP! +50' : '⚡ FRONTFLIP! +50', this);
        }
    } else if (isGrounded) {
        totalRotation = 0;
    }
    lastAngle = currentAngle;

    // 5. Расход и индикация топлива
    const gasActive = (cursors.right.isDown || isGasPressed) && currentFuel > 0;
    const brakeActive = cursors.left.isDown || isBrakePressed;

    if (currentFuel > 0) {
        currentFuel -= gasActive ? 0.075 : 0.025;
        if (currentFuel < 0) currentFuel = 0;
    }

    if (fuelBarFill) {
        let ratio = Math.max(0, currentFuel / maxFuel);
        fuelBarFill.width = ratio * 158;
        if (ratio > 0.5) fuelBarFill.setFillStyle(0x22C55E);
        else if (ratio > 0.25) fuelBarFill.setFillStyle(0xF59E0B);
        else fuelBarFill.setFillStyle(0xEF4444);

        if (lowFuelText) {
            lowFuelText.setVisible(ratio > 0 && ratio <= 0.25 && Math.floor(this.time.now / 250) % 2 === 0);
        }
    }

    if (currentFuel <= 0 && Math.abs(car.chassis.body.velocity.x) < 0.3 && Math.abs(car.wheelA.body.angularVelocity) < 0.05) {
        gameOver(this, '⛽ БЕНЗИН ЗАКОНЧИЛСЯ!');
        return;
    }

    // 6. Отрисовка кузова, подвески и частиц
    drawSuspensionAndCar();
    updateParticles(1);

    // 7. СБАЛАНСИРОВАННАЯ ФИЗИКА ЕЗДЫ И СТАБИЛИЗАЦИИ
    const cfg = car.cfg;
    let maxSpeed = cfg.baseSpeed + (engineLvl * 0.085);
    let enginePower = car.chassis.body.mass * (cfg.baseTorque + (engineLvl * 0.0022));
    let airTorque = car.chassis.body.mass * 0.045;

    if (gasActive) {
        // Полный привод (оба колеса тянут машину вверх по склону, переднее не упирается)
        if (car.wheelA.body.angularVelocity < maxSpeed) {
            car.wheelA.body.torque = enginePower;
        }
        if (car.wheelB.body.angularVelocity < maxSpeed) {
            car.wheelB.body.torque = enginePower * 0.9;
        }

        if (isGrounded) {
            // Помощь тяги вдоль уклона при старте и подъёме в крутую горку
            const angle = car.chassis.rotation;
            if (car.chassis.body.velocity.x < maxSpeed * 14) {
                const assist = car.chassis.body.mass * (0.00038 + engineLvl * 0.00006);
                Matter.Body.applyForce(car.chassis.body, car.chassis.body.position, {
                    x: Math.cos(angle) * assist,
                    y: Math.sin(angle) * assist
                });
            }

            // Умный стабилизатор против козления (Anti-Wheelie):
            // Не даёт носу задираться вверх на земле при нажатии газа!
            if (car.chassis.body.angularVelocity < 0) {
                Matter.Body.setAngularVelocity(car.chassis.body, car.chassis.body.angularVelocity * 0.55);
            }
            if (car.chassis.rotation < -0.18) {
                car.chassis.body.torque = Math.abs(car.chassis.rotation) * car.chassis.body.mass * 0.08;
            }

            // Частицы земли из-под колёс и выхлопного дыма
            if (Math.random() < 0.45) {
                if (wheelAGrounded) {
                    spawnParticle(this, car.wheelA.x - 8, car.wheelA.y + cfg.rA - 4, -2 - Math.random() * 2, -1 - Math.random() * 2, 0x5D4037, 0.45, 16);
                }
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const ex = car.chassis.x + cfg.exhaustX * cos - cfg.exhaustY * sin;
                const ey = car.chassis.y + cfg.exhaustX * sin + cfg.exhaustY * cos;
                spawnParticle(this, ex, ey, -1.5 * cos, -1 - 1.5 * sin, 0xB0BEC5, 0.55, 20);
            }
        } else if (car.airFrames > 14) {
            // В настоящем полёте газ плавно крутит Backflip
            if (car.chassis.body.angularVelocity > -0.13) {
                car.chassis.body.torque = -airTorque;
            }
        }
    } else if (brakeActive) {
        if (car.wheelA.body.angularVelocity > -maxSpeed * 0.75) {
            car.wheelA.body.torque = -enginePower * 0.9;
            car.wheelB.body.torque = -enginePower * 0.9;
        }

        if (isGrounded) {
            if (car.chassis.body.angularVelocity > 0) {
                Matter.Body.setAngularVelocity(car.chassis.body, car.chassis.body.angularVelocity * 0.6);
            }
        } else if (car.airFrames > 14) {
            // В настоящем полёте тормоз крутит Frontflip
            if (car.chassis.body.angularVelocity < 0.13) {
                car.chassis.body.torque = airTorque;
            }
        }
    } else if (!isGrounded) {
        car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity * 0.96);
        car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity * 0.96);
    }
}

window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    game.scale.resize(width, height);

    if (skyGraphics) drawSky(skyGraphics, width, height);
    if (hudBg) {
        hudBg.setPosition(width / 2, 42);
        hudBg.width = Math.min(width - 16, 560);
    }
    if (fuelBarBg) fuelBarBg.setPosition(width / 2, 42);
    if (fuelBarFill) fuelBarFill.setPosition(width / 2 - 79, 42);
    if (lowFuelText) lowFuelText.setPosition(width / 2, 62);
    if (distanceText) distanceText.setPosition(width - 96, 16);
    if (recordText) recordText.setPosition(width - 96, 45);

    if (gasButton && brakeButton) {
        brakeButton.setPosition(88, height - 88);
        brakeLabel.setPosition(88, height - 88);
        gasButton.setPosition(width - 88, height - 88);
        gasLabel.setPosition(width - 88, height - 88);
    }
});
