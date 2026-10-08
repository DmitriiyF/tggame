import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove the broken setInertia
old_chassis = """    // Искусственно занижаем инерцию кузова, чтобы он легко крутился в воздухе от слабого крутящего момента,
    // но при этом слабый момент не мог перевернуть тяжелую машину на земле!
    Matter.Body.setInertia(car.chassis.body, 2000);"""

content = content.replace(old_chassis, "")

# 2. Add isGrounded logic to create()
old_create_top = """function create() {"""
new_create_top = """let isGrounded = false;
function create() {"""
content = content.replace(old_create_top, new_create_top)

old_collision = """    this.matter.world.on('collisionstart', function (event) {
        for (let i = 0; i < event.pairs.length; i++) {"""
new_collision = """    this.matter.world.on('collisionactive', function (event) {
        for (let i = 0; i < event.pairs.length; i++) {
            let bodyA = event.pairs[i].bodyA;
            let bodyB = event.pairs[i].bodyB;
            let isCarA = bodyA.label === 'car' || bodyA.label === 'chassis';
            let isCarB = bodyB.label === 'car' || bodyB.label === 'chassis';
            if ((isCarA && bodyB.label === 'ground') || (isCarB && bodyA.label === 'ground')) {
                isGrounded = true;
            }
        }
    });
    
    this.matter.world.on('collisionstart', function (event) {
        for (let i = 0; i < event.pairs.length; i++) {"""
content = content.replace(old_collision, new_collision)

# 3. Update the controls to use isGrounded
old_controls = """    // Управление работает только если есть бензин
    // Очень слабый крутящий момент! Его не хватит, чтобы перевернуть машину на земле (гравитация сильнее),
    // но благодаря заниженной инерции (2000) его с головой хватит для быстрых сальто в воздухе!
    let airTorque = car.chassis.body.mass * 0.03; 
    let isAnyPressed = false;

    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        isAnyPressed = true;
        if (car.wheelA.body.angularVelocity < maxSpeed) {
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity + torque);
            if (car.driveType === 'awd') {
                car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity + torque);
            }
        }
        // Плавно поднимаем нос (torque работает с физикой, а не ломает её как setAngularVelocity)
        car.chassis.body.torque = -airTorque;
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        isAnyPressed = true;
        if (car.wheelA.body.angularVelocity > -maxSpeed) {
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity - torque);
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity - torque);
        }
        // Плавно опускаем нос
        car.chassis.body.torque = airTorque;
    }"""

new_controls = """    // Управление работает только если есть бензин
    let airTorque = car.chassis.body.mass * 0.5; // Сильный момент для воздуха
    let antiFlipTorque = car.chassis.body.mass * 0.2; // Момент прижимания к земле
    let isAnyPressed = false;

    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        isAnyPressed = true;
        if (car.wheelA.body.angularVelocity < maxSpeed) {
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity + torque);
            if (car.driveType === 'awd') {
                car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity + torque);
            }
        }
        
        if (isGrounded) {
            // Если на земле, прижимаем нос вниз, чтобы не перевернулась от мощного мотора (положительный момент)
            car.chassis.body.torque = antiFlipTorque;
        } else {
            // Если в воздухе, поднимаем нос для сальто назад (отрицательный момент)
            car.chassis.body.torque = -airTorque;
        }
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        isAnyPressed = true;
        if (car.wheelA.body.angularVelocity > -maxSpeed) {
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity - torque);
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity - torque);
        }
        
        if (isGrounded) {
            // При торможении зад приподнимается, прижмем его
            car.chassis.body.torque = -antiFlipTorque;
        } else {
            // В воздухе наклоняем нос вперед
            car.chassis.body.torque = airTorque;
        }
    }"""
content = content.replace(old_controls, new_controls)

old_end_update = """        gameOver(this, "АВАРИЯ");
    }
}"""
new_end_update = """        gameOver(this, "АВАРИЯ");
    }
    
    // Сбрасываем флаг земли, он обновится физическим движком до следующего кадра
    isGrounded = false;
}"""
content = content.replace(old_end_update, new_end_update)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
