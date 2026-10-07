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

// Бензин
let maxFuel = 100;
let currentFuel = 100;
let fuelBarBg;
let fuelBarFill;

function create() {
    isGameOver = false;
    currentFuel = maxFuel; // Полный бак при старте
    
    // Поддержка Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        try { window.Telegram.WebApp.expand(); } catch (e) {}
    }

    Matter = Phaser.Physics.Matter.Matter;

    // 1. Создаем трассу и монетки
    createTerrain(this);
    createCoins(this);
    createFuelCans(this); // Добавили генерацию канистр

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
    
    // Кнопка возврата в меню
    let restartBtn = scene.add.rectangle(width/2, height/2 + 60, 200, 60, 0x3390ec, 1)
        .setScrollFactor(0).setDepth(200).setInteractive({ useHandCursor: true });
    restartBtn.setStrokeStyle(3, 0xFFFFFF);
    
    scene.add.text(width/2, height/2 + 60, 'В МЕНЮ', { fontSize: '24px', fill: '#FFF', fontStyle: 'bold' })
        .setOrigin(0.5).setScrollFactor(0).setDepth(200);
        
    restartBtn.on('pointerdown', () => {
        window.location.href = 'index.html';
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

    // Асинхронно загружаем монеты и движок из облака Telegram
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.getItem) {
            window.Telegram.WebApp.CloudStorage.getItem('hillClimbCoins', (err, value) => {
                if (!err && value) totalCoins = parseInt(value) || 0;
                else totalCoins = parseInt(localStorage.getItem('hillClimbCoins')) || 0;
                scoreText.setText(totalCoins.toString());
            });
            window.Telegram.WebApp.CloudStorage.getItem('engineLevel', (err, value) => {
                if (!err && value) engineLvl = parseInt(value) || 1;
                else engineLvl = parseInt(localStorage.getItem('engineLevel')) || 1;
            });
        } else {
            throw new Error("No CloudStorage");
        }
    } catch (e) {
        totalCoins = parseInt(localStorage.getItem('hillClimbCoins')) || 0;
        engineLvl = parseInt(localStorage.getItem('engineLevel')) || 1;
        scoreText.setText(totalCoins.toString());
    }

    // Иконка монетки рядом со счетом
    coinIcon = scene.add.circle(35, 42, 15, 0xFFD700)
        .setScrollFactor(0).setDepth(100).setStrokeStyle(3, 0xB8860B);

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

let terrainPoints = [];

function createTerrain(scene) {
    let lastX = -200;
    let lastY = 400;
    terrainPoints = [];
    
    for (let i = 0; i < 400; i++) {
        let x = lastX + 120;
        let y = lastY + Math.sin(i * 0.35) * 70 + (Math.random() * 20 - 10);
        
        let dx = x - lastX;
        let dy = y - lastY;
        let angle = Math.atan2(dy, dx);
        let length = Math.sqrt(dx*dx + dy*dy);
        
        // Рисуем кусок земли
        let ground = scene.add.rectangle(lastX + dx/2, lastY + dy/2, length + 5, 100, 0x4CAF50); 
        ground.setStrokeStyle(4, 0x2E7D32); // Темно-зеленая обводка сверху
        
        scene.matter.add.gameObject(ground, {
            isStatic: true,
            angle: angle,
            friction: 0.9,
            restitution: 0.1, // Немного упругости
            label: 'ground'
        });
        
        // Сохраняем точки, чтобы потом раскидать там монетки
        terrainPoints.push({x: lastX + dx/2, y: lastY + dy/2});

        lastX = x;
        lastY = y;
    }
}

function createCoins(scene) {
    // Раскидываем золотые монетки
    for (let i = 15; i < terrainPoints.length; i += 6) { // Каждые 6 блоков земли
        let point = terrainPoints[i];
        
        // Монетка немного над землей (иногда выше, иногда ниже)
        let heightOffset = 60 + Math.random() * 60; 
        
        let coin = scene.add.circle(point.x, point.y - heightOffset, 15, 0xFFD700);
        coin.setStrokeStyle(3, 0xB8860B); // Обводка монетки
        
        scene.matter.add.gameObject(coin, {
            isStatic: true,
            isSensor: true, // Сенсор значит, что сквозь нее можно проехать (она не бетонная)
            label: 'coin'
        });
    }
}

function collectCoin(coinGO) {
    if (!coinGO || !coinGO.active) return; // Защита от двойного сбора
    coinGO.destroy(); // Удаляем монетку
    totalCoins += 5;       // Даем 5 очков
    scoreText.setText(totalCoins.toString());

    // Сохраняем в облако Telegram
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.setItem) {
            window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', totalCoins.toString());
        } else {
            throw new Error("No CloudStorage");
        }
    } catch (e) {
        localStorage.setItem('hillClimbCoins', totalCoins);
    }
}

function createFuelCans(scene) {
    for (let i = 25; i < terrainPoints.length; i += 20) { // Примерно каждые 20 блоков земли
        let point = terrainPoints[i];
        
        // Канистра (красный вертикальный прямоугольник)
        let fuelCan = scene.add.rectangle(point.x, point.y - 70, 25, 35, 0xE53935);
        fuelCan.setStrokeStyle(3, 0xFFFFFF); // Белая обводка
        
        // Белая полоска посередине канистры
        scene.add.rectangle(point.x, point.y - 70, 25, 10, 0xFFFFFF);
        
        scene.matter.add.gameObject(fuelCan, {
            isStatic: true,
            isSensor: true,
            label: 'fuel'
        });
    }
}

function collectFuel(fuelGO, scene) {
    if (!fuelGO || !fuelGO.active) return;
    fuelGO.destroy(); // Удаляем прямоугольник канистры
    
    currentFuel = maxFuel; // Заполняем бак
    
    // Всплывающая надпись +FUEL
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

    // Кузов машины (красный джип)
    const chassisRect = scene.add.rectangle(x, y - 20, 130, 30, 0xE53935);
    chassisRect.setStrokeStyle(2, 0xB71C1C);
    
    // Кабина водителя
    const cabinRect = scene.add.rectangle(x - 20, y - 50, 70, 35, 0xD32F2F);
    cabinRect.setStrokeStyle(2, 0xB71C1C);
    
    car.chassis = scene.matter.add.gameObject(chassisRect, { 
        collisionFilter: { group: group },
        density: 0.002, // Облегчили кузов
        friction: 0.5,
        label: 'chassis'
    });

    car.cabin = cabinRect;

    const wheelOptions = { 
        shape: 'circle',
        radius: 25, // Вернули адекватный размер
        collisionFilter: { group: group },
        friction: 0.9,    
        density: 0.008,   // Тяжелые колеса (смещают центр тяжести вниз, машина не переворачивается)
        restitution: 0.1, 
        label: 'car'
    };
    
    // Колеса
    const wheelACircle = scene.add.circle(x - 45, y, 25, 0x212121);
    wheelACircle.setStrokeStyle(5, 0x9E9E9E); 
    car.wheelA = scene.matter.add.gameObject(wheelACircle, wheelOptions);

    const wheelBCircle = scene.add.circle(x + 45, y, 25, 0x212121);
    wheelBCircle.setStrokeStyle(5, 0x9E9E9E);
    car.wheelB = scene.matter.add.gameObject(wheelBCircle, wheelOptions);

    // Подвеска (Жесткие амортизаторы)
    // Длина пружины: 15 пикселей. Жесткость: 0.6 (держит кузов)
    scene.matter.add.spring(car.chassis.body, car.wheelA.body, 15, 0.6, {
        pointA: { x: -45, y: 15 },
        damping: 0.1 // Гасит лишние колебания (чтобы не болталась как желе)
    });
    scene.matter.add.spring(car.chassis.body, car.wheelB.body, 15, 0.6, {
        pointA: { x: 45, y: 15 },
        damping: 0.1
    });
}

function update() {
    if (isGameOver) return; // После смерти ничего не делаем

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
    const maxSpeed = 0.8 + (engineLvl * 0.1);
    const torque = 0.04 + (engineLvl * 0.005);

    // Привязываем визуальную кабину к физическому кузову (чтобы она вращалась вместе с ним)
    if (car.chassis && car.cabin) {
        let angle = car.chassis.rotation;
        let offsetX = Math.cos(angle - Math.PI/2) * 30 - Math.cos(angle) * 15;
        let offsetY = Math.sin(angle - Math.PI/2) * 30 - Math.sin(angle) * 15;
        
        car.cabin.setPosition(car.chassis.x + offsetX, car.chassis.y + offsetY);
        car.cabin.setRotation(angle);
    }

    // Управление работает только если есть бензин
    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        if (car.wheelB.body.angularVelocity < maxSpeed) {
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity + torque);
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity + torque);
        }
        // Наклон назад в полете
        car.chassis.setAngularVelocity(car.chassis.body.angularVelocity - 0.008); 
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        // Тормозить можно всегда (даже без бензина)
        if (car.wheelB.body.angularVelocity > -maxSpeed) {
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity - torque);
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity - torque);
        }
        // Наклон вперед в полете
        car.chassis.setAngularVelocity(car.chassis.body.angularVelocity + 0.008); 
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
