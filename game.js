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

function create() {
    // Поддержка Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        try { window.Telegram.WebApp.expand(); } catch (e) {}
    }

    Matter = Phaser.Physics.Matter.Matter;

    // 1. Создаем трассу и монетки
    createTerrain(this);
    createCoins(this);

    // 2. Создаем более детализированную машину
    createCar(this);

    // 3. Обработка столкновений (сбор монеток)
    this.matter.world.on('collisionstart', (event) => {
        event.pairs.forEach((pair) => {
            const bodyA = pair.bodyA;
            const bodyB = pair.bodyB;
            
            // Если столкнулись монетка и машина (кузов или колеса)
            if (bodyA.label === 'coin' && bodyB.label === 'car') {
                collectCoin(bodyA.gameObject);
            } else if (bodyB.label === 'coin' && bodyA.label === 'car') {
                collectCoin(bodyB.gameObject);
            }
        });
    });

    cursors = this.input.keyboard.createCursorKeys();

    // 4. Отрисовка интерфейса (кнопки и счетчик)
    createUI(this);

    // 5. Настройка камеры
    this.cameras.main.startFollow(car.chassis, false, 0.1, 0.1);
    this.cameras.main.setZoom(0.7);
    this.cameras.main.setFollowOffset(0, 50); // Камера чуть выше машины
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

    // Асинхронно загружаем монеты из облака Telegram
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
        window.Telegram.WebApp.CloudStorage.getItem('hillClimbCoins', (err, value) => {
            if (!err && value) {
                totalCoins = parseInt(value) || 0;
            } else {
                totalCoins = 0;
            }
            scoreText.setText(totalCoins.toString());
        });
    } else {
        // Запасной вариант для обычного браузера
        totalCoins = parseInt(localStorage.getItem('hillClimbCoins')) || 0;
        scoreText.setText(totalCoins.toString());
    }

    // Иконка монетки рядом со счетом
    coinIcon = scene.add.circle(35, 42, 15, 0xFFD700)
        .setScrollFactor(0).setDepth(100).setStrokeStyle(3, 0xB8860B);

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
            restitution: 0.1 // Немного упругости
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
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
        window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', totalCoins.toString());
    } else {
        localStorage.setItem('hillClimbCoins', totalCoins);
    }
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
        label: 'car'
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
    const maxSpeed = 0.8;
    const torque = 0.04;

    // Привязываем визуальную кабину к физическому кузову (чтобы она вращалась вместе с ним)
    if (car.chassis && car.cabin) {
        let angle = car.chassis.rotation;
        // Немного тригонометрии, чтобы кабина всегда была над левой частью кузова
        let offsetX = Math.cos(angle - Math.PI/2) * 30 - Math.cos(angle) * 15;
        let offsetY = Math.sin(angle - Math.PI/2) * 30 - Math.sin(angle) * 15;
        
        car.cabin.setPosition(car.chassis.x + offsetX, car.chassis.y + offsetY);
        car.cabin.setRotation(angle);
    }

    // Управление
    if (cursors.right.isDown || isGasPressed) {
        if (car.wheelB.body.angularVelocity < maxSpeed) {
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity + torque);
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity + torque);
        }
        // Наклон назад в полете
        car.chassis.setAngularVelocity(car.chassis.body.angularVelocity - 0.008); 
    } 
    else if (cursors.left.isDown || isBrakePressed) {
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
