const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#87CEEB', // Голубое небо
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            debug: false
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

// Интерфейс
let totalCoins = 0; // Будем загружать из облака Telegram
let scoreText;
let gasButton;
let brakeButton;
let gasText;
let brakeText;
let coinIcon;
let isGameOver = false;
let engineLvl = 1;
let suspensionLvl = 1;
let tiresLvl = 1;

// Бензин
let maxFuel = 100;
let currentFuel = 100;
let fuelBarBg;
let fuelBarFill;

// Расстояние и трюки
let maxDistance = 0;
let distanceText;
let recordText;
let lastAngle = 0;
let totalRotation = 0;
let selectedCarId = 'jeep';

function create() {
    isGameOver = false;
    currentFuel = maxFuel; // Полный бак при старте
    lastAngle = 0;
    totalRotation = 0;
    
    // Поддержка Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        try { window.Telegram.WebApp.expand(); } catch (e) {}
    }
    
    // Загружаем данные перед созданием машины
    engineLvl = parseInt(localStorage.getItem('engineLevel')) || 1;
    suspensionLvl = parseInt(localStorage.getItem('suspensionLevel')) || 1;
    tiresLvl = parseInt(localStorage.getItem('tiresLevel')) || 1;
    maxDistance = parseInt(localStorage.getItem('maxDistance')) || 0;
    selectedCarId = localStorage.getItem('selectedCar') || 'jeep';
    
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.getItem) {
            window.Telegram.WebApp.CloudStorage.getItem('engineLevel', (err, val) => { if(val) engineLvl = parseInt(val); });
            window.Telegram.WebApp.CloudStorage.getItem('suspensionLevel', (err, val) => { if(val) { suspensionLvl = parseInt(val); updateSuspensionPhysics(); } });
            window.Telegram.WebApp.CloudStorage.getItem('tiresLevel', (err, val) => { if(val) { tiresLvl = parseInt(val); updateTiresPhysics(); } });
            window.Telegram.WebApp.CloudStorage.getItem('maxDistance', (err, val) => { if(val) { maxDistance = parseInt(val); if(recordText) recordText.setText('РЕКОРД: ' + maxDistance + 'm'); } });
            window.Telegram.WebApp.CloudStorage.getItem('selectedCar', (err, val) => { if(val) selectedCarId = val; });
        }
    } catch(e) {}

    Matter = Phaser.Physics.Matter.Matter;

    // 1. Динамическая генерация трассы (создаем первый кусок)
    generateTerrain(this, 3000);

    // 2. Создаем более детализированную машину
    createCar(this);

    // 3. Обработка столкновений (сбор монеток, бензина и смерть)
    this.matter.world.on('collisionstart', (event) => {
        if (isGameOver) return;
        event.pairs.forEach((pair) => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            let isCarA = bodyA.label === 'car' || bodyA.label === 'chassis';
            let isCarB = bodyB.label === 'car' || bodyB.label === 'chassis';
            
            // Если столкнулись монетка и машина
            if (bodyA.label === 'coin' && isCarB) {
                collectCoin(bodyA.gameObject);
            } else if (bodyB.label === 'coin' && isCarA) {
                collectCoin(bodyB.gameObject);
            }

            // Если подобрали канистру с бензином
            if (bodyA.label === 'fuel' && isCarB) {
                collectFuel(bodyA.gameObject, this);
            } else if (bodyB.label === 'fuel' && isCarA) {
                collectFuel(bodyB.gameObject, this);
            }

            // Смерть при перевороте (касание земли крышей)
            if ((bodyA.label === 'ground' && bodyB.label === 'chassis') || 
                (bodyB.label === 'ground' && bodyA.label === 'chassis')) {
                
                // Если угол наклона машины больше 1.5 радиан (~90 градусов)
                if (Math.abs(car.chassis.rotation) > 1.5) {
                    gameOver(this, 'CRASHED!\nШея сломана');
                }
            }
        });
    });

    cursors = this.input.keyboard.createCursorKeys();

    // 4. Отрисовка интерфейса
    createUI(this);

    // 5. Настройка камеры
    this.cameras.main.startFollow(car.chassis, false, 0.1, 0.1);
    this.cameras.main.setZoom(0.7);
    this.cameras.main.setFollowOffset(0, 50); 
}

function gameOver(scene, reasonText) {
    if (isGameOver) return;
    isGameOver = true;
    scene.matter.world.pause(); // Останавливаем физику

    // Финальное сохранение монет и рекорда дистанции в облако
    localStorage.setItem('maxDistance', maxDistance.toString());
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.setItem) {
            window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', totalCoins.toString(), (e,s)=>{});
            window.Telegram.WebApp.CloudStorage.setItem('maxDistance', maxDistance.toString(), (e,s)=>{});
        }
    } catch(e) {}
        
    const width = scene.sys.game.config.width;
    const height = scene.sys.game.config.height;
    
    // Надпись Game Over
    scene.add.text(width/2, height/2 - 60, reasonText, {
        fontSize: '40px',
        fill: '#FF0000',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#000',
        strokeThickness: 6
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
    
    // Кнопка Рестарт (ЗАНОВО)
    let retryBtn = scene.add.rectangle(width/2, height/2 + 40, 220, 60, 0x4CAF50, 1)
        .setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    retryBtn.setStrokeStyle(3, 0xFFFFFF);
    
    scene.add.text(width/2, height/2 + 40, '🔄 ЗАНОВО', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(200);
        
    retryBtn.on('pointerdown', () => {
        window.location.href = 'hillclimb.html';
    });

    // Кнопка возврата в меню
    let menuBtn = scene.add.rectangle(width/2, height/2 + 120, 220, 60, 0x3390ec, 1)
        .setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    menuBtn.setStrokeStyle(3, 0xFFFFFF);
    
    scene.add.text(width/2, height/2 + 120, 'В МЕНЮ', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(200);
        
    menuBtn.on('pointerdown', () => {
        window.location.href = 'hillclimb_menu.html';
    });
}

function createUI(scene) {
    const width = scene.sys.game.config.width;
    const height = scene.sys.game.config.height;

    // Текст со счетом (пока грузится из облака, пишем '...')
    scoreText = scene.add.text(60, 20, '...', { 
        fontSize: '40px', 
        fill: '#FFF', 
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 6
    }).setScrollFactor(0).setDepth(100);

    // Асинхронно загружаем данные из облака
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.getItem) {
            window.Telegram.WebApp.CloudStorage.getItem('hillClimbCoins', (err, value) => {
                let coinsStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('hillClimbCoins') || '0';
                totalCoins = parseInt(coinsStr) || 0;
                scoreText.setText(totalCoins.toString());
            });
            window.Telegram.WebApp.CloudStorage.getItem('suspensionLevel', (err, value) => {
                let suspStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('suspensionLevel') || '1';
                suspensionLvl = parseInt(suspStr) || 1;
                updateSuspensionPhysics();
            });
            window.Telegram.WebApp.CloudStorage.getItem('tiresLevel', (err, value) => {
                let tiresStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('tiresLevel') || '1';
                tiresLvl = parseInt(tiresStr) || 1;
                updateTiresPhysics();
            });
            window.Telegram.WebApp.CloudStorage.getItem('maxDistance', (err, value) => {
                let distStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('maxDistance') || '0';
                maxDistance = parseInt(distStr) || 0;
                if (recordText) recordText.setText('Рекорд: ' + maxDistance + 'm');
            });
        } else {
            throw new Error("No CloudStorage");
        }
    } catch (e) {
        totalCoins = parseInt(localStorage.getItem('hillClimbCoins')) || 0;
        engineLvl = parseInt(localStorage.getItem('engineLevel')) || 1;
        suspensionLvl = parseInt(localStorage.getItem('suspensionLevel')) || 1;
        tiresLvl = parseInt(localStorage.getItem('tiresLevel')) || 1;
        maxDistance = parseInt(localStorage.getItem('maxDistance')) || 0;
        scoreText.setText(totalCoins.toString());
        if (recordText) recordText.setText('Рекорд: ' + maxDistance + 'm');
        updateSuspensionPhysics();
        updateTiresPhysics();
    }

    // Иконка монетки рядом со счетом
    coinIcon = scene.add.circle(35, 42, 15, 0xFFD700)
        .setScrollFactor(0).setDepth(100).setStrokeStyle(3, 0xB8860B);

    // Текст Дистанции (справа сверху)
    distanceText = scene.add.text(width - 20, 20, '0m', { 
        fontSize: '30px', fill: '#FFF', fontFamily: 'Arial', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Текст Рекорда (под дистанцией)
    recordText = scene.add.text(width - 20, 55, 'Рекорд: ' + maxDistance + 'm', { 
        fontSize: '16px', fill: '#FFD700', fontFamily: 'Arial', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    // Шкала Бензина (по центру)
    scene.add.text(width/2, 20, 'FUEL', { fontSize: '18px', fill: '#FFF', fontStyle: 'bold', stroke: '#000', strokeThickness: 4 })
        .setOrigin(0.5).setScrollFactor(0).setDepth(100);
    
    fuelBarBg = scene.add.rectangle(width/2, 45, 200, 20, 0x000000, 0.5)
        .setScrollFactor(0).setDepth(100);
    fuelBarFill = scene.add.rectangle(width/2 - 96, 45, 192, 12, 0xFF3333, 1)
        .setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

    // Кнопка ТОРМОЗ (слева внизу)
    brakeButton = scene.add.rectangle(100, height - 100, 140, 140, 0xFF3333, 0.7)
        .setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
    brakeButton.setStrokeStyle(4, 0x990000);
    
    brakeText = scene.add.text(100, height - 100, 'BRAKE', { fontSize: '28px', fill: '#FFF', fontStyle: 'bold' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Кнопка ГАЗ (справа внизу)
    gasButton = scene.add.rectangle(width - 100, height - 100, 140, 140, 0x33FF33, 0.7)
        .setScrollFactor(0).setDepth(100).setInteractive({ useHandCursor: true });
    gasButton.setStrokeStyle(4, 0x009900);

    gasText = scene.add.text(width - 100, height - 100, 'GAS', { fontSize: '32px', fill: '#FFF', fontStyle: 'bold' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Логика нажатия на кнопки на экране
    gasButton.on('pointerdown', () => { isGasPressed = true; gasButton.setAlpha(1); });
    gasButton.on('pointerup', () => { isGasPressed = false; gasButton.setAlpha(0.7); });
    gasButton.on('pointerout', () => { isGasPressed = false; gasButton.setAlpha(0.7); });

    brakeButton.on('pointerdown', () => { isBrakePressed = true; brakeButton.setAlpha(1); });
    brakeButton.on('pointerup', () => { isBrakePressed = false; brakeButton.setAlpha(0.7); });
    brakeButton.on('pointerout', () => { isBrakePressed = false; brakeButton.setAlpha(0.7); });
}

let terrainChunks = [];
let lastGenX = -200;
let lastGenY = 400;
let currentSlope = 0;
let targetSlope = 0;
let segmentIndex = 0;

// Функция для детерминированного рандома (карта всегда одинаковая)
function seededRandom(seed) {
    let x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
}

function generateTerrain(scene, upToX) {
    while (lastGenX < upToX) {
        // Каждые ~10 сегментов меняем цель наклона.
        if (seededRandom(segmentIndex) < 0.1) {
            // Прогрессия сложности: чем дальше едешь, тем круче могут быть холмы!
            // Базовый разброс высот: 40. На каждые 10 блоков добавляем 2 к максимальному перепаду.
            let maxSlope = Math.min(160, 40 + (segmentIndex / 5)); 
            
            // Генерируем цель от -maxSlope (вверх) до +maxSlope (вниз)
            targetSlope = (seededRandom(segmentIndex + 1000) * (maxSlope * 2)) - maxSlope;
        }
        // Делаем переходы более долгими и плавными, чтобы получались огромные длинные горы
        currentSlope += (targetSlope - currentSlope) * 0.05;
        
        let x = lastGenX + 120; // ширина сегмента
        let y = lastGenY + currentSlope;
        
        let dx = x - lastGenX;
        let dy = y - lastGenY;
        let angle = Math.atan2(dy, dx);
        let length = Math.sqrt(dx*dx + dy*dy);
        
        let midX = lastGenX + dx/2;
        let midY = lastGenY + dy/2;
        
        // Визуальная часть
        let ground = scene.add.rectangle(midX, midY + 500, length + 10, 1000, 0x4CAF50);
        ground.setStrokeStyle(4, 0x2E7D32);
        
        // Физика
        scene.matter.add.gameObject(ground, {
            isStatic: true,
            angle: angle,
            friction: 1.5,
            restitution: 0.1, 
            label: 'ground'
        });
        
        let chunk = { ground: ground, x: midX, coin: null, fuel: null, fuelStripe: null };
        
        // Спавн монеток
        if (segmentIndex > 5 && segmentIndex % 6 === 0) {
            let heightOffset = 60 + seededRandom(segmentIndex + 2000) * 60; 
            let coin = scene.add.circle(midX, midY - heightOffset, 15, 0xFFD700);
            coin.setStrokeStyle(3, 0xB8860B);
            scene.matter.add.gameObject(coin, { isStatic: true, isSensor: true, label: 'coin' });
            chunk.coin = coin;
        }
        
        // Спавн бензина (строго каждые 20 блоков)
        if (segmentIndex > 10 && segmentIndex % 20 === 0) {
            let fuelCan = scene.add.rectangle(midX, midY - 70, 25, 35, 0xE53935);
            fuelCan.setStrokeStyle(3, 0xFFFFFF);
            let whiteStripe = scene.add.rectangle(midX, midY - 70, 25, 10, 0xFFFFFF);
            scene.matter.add.gameObject(fuelCan, { isStatic: true, isSensor: true, label: 'fuel' });
            chunk.fuel = fuelCan;
            chunk.fuelStripe = whiteStripe;
        }
        
        terrainChunks.push(chunk);
        
        lastGenX = x;
        lastGenY = y;
        segmentIndex++;
    }
}

let lastCloudSaveTime = 0;

function collectCoin(coinGO) {
    if (!coinGO || !coinGO.active) return;
    coinGO.destroy();
    totalCoins += 5;
    scoreText.setText(totalCoins.toString());

    localStorage.setItem('hillClimbCoins', totalCoins.toString());

    let now = Date.now();
    if (now - lastCloudSaveTime > 2000) {
        lastCloudSaveTime = now;
        try {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.setItem) {
                window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', totalCoins.toString(), (err, success) => {});
            }
        } catch (e) {}
    }
}

function awardBonus(amount, textMessage, scene) {
    totalCoins += amount;
    scoreText.setText(totalCoins.toString());
    localStorage.setItem('hillClimbCoins', totalCoins.toString());

    let txt = scene.add.text(car.chassis.x, car.chassis.y - 120, textMessage, { 
        fontSize: '35px', fill: '#FFD700', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 
    }).setOrigin(0.5);
    
    scene.tweens.add({ 
        targets: txt, 
        y: txt.y - 70, 
        alpha: 0, 
        duration: 1500, 
        onComplete: () => txt.destroy() 
    });
}

function collectFuel(fuelGO, scene) {
    if (!fuelGO || !fuelGO.active) return;
    fuelGO.destroy();
    
    currentFuel = maxFuel;
    
    let txt = scene.add.text(car.chassis.x, car.chassis.y - 100, '+ FUEL', { 
        fontSize: '30px', fill: '#00FF00', fontStyle: 'bold', stroke: '#000', strokeThickness: 5 
    }).setOrigin(0.5);
    
    scene.tweens.add({ 
        targets: txt, 
        y: txt.y - 50, 
        alpha: 0, 
        duration: 1000, 
        onComplete: () => txt.destroy() 
    });
}

function createCar(scene) {
    const x = 0;
    const y = 200;
    const group = scene.matter.world.nextGroup(true);

    let cfg = {
        w: 130, h: 30, c: 0xE53935, // chassis
        cw: 70, ch: 35, cx: -20, cy: -70, // cabin
        rA: 25, rB: 25, // wheels radius (A=back, B=front)
        wxA: -45, wxB: 45, wy: 35, // wheels offset
        dens: 0.002, fuel: 100
    };

    if (selectedCarId === 'bike') {
        cfg = { w: 90, h: 15, c: 0x2196F3, cw: 30, ch: 30, cx: 0, cy: -45, rA: 20, rB: 20, wxA: -40, wxB: 40, wy: 25, dens: 0.001, fuel: 70 };
    } else if (selectedCarId === 'tractor') {
        cfg = { w: 150, h: 40, c: 0xFF9800, cw: 60, ch: 60, cx: -30, cy: -80, rA: 40, rB: 25, wxA: -55, wxB: 60, wy: 40, dens: 0.004, fuel: 120 };
    } else if (selectedCarId === 'racecar') {
        cfg = { w: 160, h: 20, c: 0x9C27B0, cw: 50, ch: 20, cx: -10, cy: -40, rA: 22, rB: 22, wxA: -60, wxB: 60, wy: 20, dens: 0.0025, fuel: 90 };
    } else if (selectedCarId === 'tank') {
        cfg = { w: 180, h: 50, c: 0x4CAF50, cw: 80, ch: 30, cx: 0, cy: -80, rA: 35, rB: 35, wxA: -70, wxB: 70, wy: 40, dens: 0.008, fuel: 150 };
    }
    
    maxFuel = cfg.fuel;
    currentFuel = maxFuel;

    // Кузов
    const chassisRect = scene.add.rectangle(x, y - 40, cfg.w, cfg.h, cfg.c);
    chassisRect.setStrokeStyle(2, 0x000000);
    
    // Кабина
    const cabinRect = scene.add.rectangle(x + cfg.cx, y + cfg.cy, cfg.cw, cfg.ch, cfg.c);
    cabinRect.setStrokeStyle(2, 0x000000);
    
    car.chassis = scene.matter.add.gameObject(chassisRect, { 
        collisionFilter: { group: group },
        density: cfg.dens,
        friction: 0.5,
        label: 'chassis'
    });
    car.cabin = cabinRect;
    car.cabin.deltaX = cfg.cx;
    car.cabin.deltaY = cfg.cy + 40;

    const wheelOptsA = { shape: 'circle', radius: cfg.rA, collisionFilter: { group: group }, friction: 0.5, density: 0.008, restitution: 0.1, label: 'car' };
    const wheelOptsB = { shape: 'circle', radius: cfg.rB, collisionFilter: { group: group }, friction: 0.5, density: 0.008, restitution: 0.1, label: 'car' };
    
    const wA = scene.add.circle(x + cfg.wxA, y, cfg.rA, 0x212121);
    wA.setStrokeStyle(5, 0x9E9E9E); 
    car.wheelA = scene.matter.add.gameObject(wA, wheelOptsA);

    const wB = scene.add.circle(x + cfg.wxB, y, cfg.rB, 0x212121);
    wB.setStrokeStyle(5, 0x9E9E9E);
    car.wheelB = scene.matter.add.gameObject(wB, wheelOptsB);

    // Подвеска
    car.springA = scene.matter.add.spring(car.chassis.body, car.wheelA.body, 0, 0.1, { pointA: { x: cfg.wxA, y: cfg.wy }, damping: 0.05 });
    car.springB = scene.matter.add.spring(car.chassis.body, car.wheelB.body, 0, 0.1, { pointA: { x: cfg.wxB, y: cfg.wy }, damping: 0.05 });
    
    // Применяем актуальную прокачку сразу при создании
    updateSuspensionPhysics();
    updateTiresPhysics();
}

function updateSuspensionPhysics() {
    if (car.springA && car.springB) {
        // Жесткость: ур.1 = 0.14 (мягкая, но не желейная), ур.6 = 0.34 (жесткая)
        let newStiffness = 0.1 + (suspensionLvl * 0.04);
        // Гашение: ур.1 = 0.06, ур.6 = 0.11
        let newDamping = 0.05 + (suspensionLvl * 0.01);
        
        car.springA.stiffness = newStiffness;
        car.springA.damping = newDamping;
        car.springB.stiffness = newStiffness;
        car.springB.damping = newDamping;
    }
}

function updateTiresPhysics() {
    if (car.wheelA && car.wheelB) {
        // Базовое сцепление 0.5. За каждый уровень шин добавляется 0.1.
        let newFriction = 0.5 + (tiresLvl * 0.1);
        if (newFriction > 1.5) newFriction = 1.5; // Ограничиваем сверху
        
        car.wheelA.body.friction = newFriction;
        car.wheelB.body.friction = newFriction;
    }
}

function update() {
    if (isGameOver) return; 

    // Динамическая генерация холмов впереди (на 3000 пикселей)
    generateTerrain(this, car.chassis.x + 3000);

    // Оптимизация: удаляем чанки, которые остались далеко позади (2500 пикселей)
    let cleanupX = car.chassis.x - 2500;
    while (terrainChunks.length > 0 && terrainChunks[0].x < cleanupX) {
        let chunk = terrainChunks.shift();
        if (chunk.ground && chunk.ground.active) {
            chunk.ground.destroy();
        }
        if (chunk.coin && chunk.coin.active) {
            chunk.coin.destroy();
        }
        if (chunk.fuel && chunk.fuel.active) {
            chunk.fuel.destroy();
        }
        if (chunk.fuelStripe && chunk.fuelStripe.active) {
            chunk.fuelStripe.destroy();
        }
    }

    // 1. Расчет дистанции (1 блок = ~50 пикселей, считаем 1 блок за 1 метр)
    let currentDist = Math.max(0, Math.floor(car.chassis.x / 50));
    distanceText.setText(currentDist + 'm');
    if (currentDist > maxDistance) {
        maxDistance = currentDist;
        if (recordText) recordText.setText('Рекорд: ' + maxDistance + 'm');
    }

    // 2. Детектор сальто (Трюки)
    let currentAngle = car.chassis.rotation;
    let diff = currentAngle - lastAngle;
    
    // Нормализуем разницу от -PI до PI
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    
    totalRotation += diff;
    lastAngle = currentAngle;

    // Если прокрутились почти на 360 градусов (оставим запас 10%)
    if (Math.abs(totalRotation) >= Math.PI * 1.8) {
        totalRotation = 0; // Сбрасываем счетчик
        awardBonus(50, 'FLIP! +50', this); // Даем 50 монет
    }

    // Трата бензина
    if (currentFuel > 0) {
        currentFuel -= 0.04; // Базовый расход (даже стоя)
        if (cursors.right.isDown || isGasPressed) currentFuel -= 0.06; // Доп. расход при газе
        if (currentFuel < 0) currentFuel = 0;
    }

    // Обновляем визуальную шкалу
    let fillWidth = Math.max(0, (currentFuel / maxFuel) * 192);
    if (fuelBarFill) fuelBarFill.width = fillWidth;

    // Смерть от нехватки топлива
    if (currentFuel <= 0) {
        // Ждем, пока машина полностью остановится
        if (Math.abs(car.wheelA.body.angularVelocity) < 0.05 && Math.abs(car.wheelB.body.angularVelocity) < 0.05) {
            gameOver(this, 'OUT OF GAS!\nБензин кончился');
            return;
        }
    }

    // Чем выше уровень движка, тем быстрее едем и сильнее разгоняемся
    let baseTorque = 0.04;
    let baseSpeed = 0.8;
    
    if (selectedCarId === 'bike') { baseTorque = 0.03; baseSpeed = 0.9; }
    else if (selectedCarId === 'tractor') { baseTorque = 0.08; baseSpeed = 0.5; }
    else if (selectedCarId === 'racecar') { baseTorque = 0.05; baseSpeed = 1.2; }
    else if (selectedCarId === 'tank') { baseTorque = 0.07; baseSpeed = 0.6; }

    const maxSpeed = baseSpeed + (engineLvl * 0.1);
    const torque = baseTorque + (engineLvl * 0.005);

    // Привязываем визуальную кабину к физическому кузову (чтобы она вращалась вместе с ним)
    if (car.chassis && car.cabin) {
        let angle = car.chassis.rotation;
        
        let dx = car.cabin.deltaX || 0;
        let dy = car.cabin.deltaY || 0;
        
        let offsetX = Math.cos(angle) * dx - Math.sin(angle) * dy;
        let offsetY = Math.sin(angle) * dx + Math.cos(angle) * dy;
        
        car.cabin.setPosition(car.chassis.x + offsetX, car.chassis.y + offsetY);
        car.cabin.setRotation(angle);
    }

    // Управление работает только если есть бензин
    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        if (car.wheelB.body.angularVelocity < maxSpeed) {
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity + torque);
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity + torque);
        }
        // Наклон назад в полете (уменьшено до 0.0015, чтобы не переворачивалась на земле из-за мягкой подвески)
        car.chassis.setAngularVelocity(car.chassis.body.angularVelocity - 0.0015); 
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        // Тормозить можно всегда (даже без бензина)
        if (car.wheelB.body.angularVelocity > -maxSpeed) {
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity - torque);
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity - torque);
        }
        // Наклон вперед в полете
        car.chassis.setAngularVelocity(car.chassis.body.angularVelocity + 0.0015); 
    }
}

// Корректировка кнопок при повороте телефона
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    if(gasButton && brakeButton) {
        brakeButton.setPosition(100, height - 100);
        brakeText.setPosition(100, height - 100);
        gasButton.setPosition(width - 100, height - 100);
        gasText.setPosition(width - 100, height - 100);
    }
});
