import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Modify createCar to reduce chassis inertia
old_chassis = """    car.chassis = scene.matter.add.gameObject(chassisRect, { 
        collisionFilter: { group: group },
        density: cfg.cdens,
        friction: 0.5,
        label: 'chassis'
    });"""

new_chassis = """    car.chassis = scene.matter.add.gameObject(chassisRect, { 
        collisionFilter: { group: group },
        density: cfg.cdens,
        friction: 0.5,
        label: 'chassis'
    });
    
    // Искусственно занижаем инерцию кузова, чтобы он легко крутился в воздухе от слабого крутящего момента,
    // но при этом слабый момент не мог перевернуть тяжелую машину на земле!
    Matter.Body.setInertia(car.chassis.body, 2000);"""

content = content.replace(old_chassis, new_chassis)

# 2. Modify update() to use the new small torque
old_update = """    // Управление работает только если есть бензин
    let airTorque = car.chassis.body.mass * 0.12; // Мягкий крутящий момент для сальто и вилли
    let isAnyPressed = false;"""

new_update = """    // Управление работает только если есть бензин
    // Очень слабый крутящий момент! Его не хватит, чтобы перевернуть машину на земле (гравитация сильнее),
    // но благодаря заниженной инерции (2000) его с головой хватит для быстрых сальто в воздухе!
    let airTorque = car.chassis.body.mass * 0.03; 
    let isAnyPressed = false;"""

content = content.replace(old_update, new_update)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
