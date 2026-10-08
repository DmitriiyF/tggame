import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the control block in update()
old_controls = """    // Управление работает только если есть бензин
    let airTorque = car.chassis.body.mass * 0.35; // Момент для сальто в воздухе
    let antiFlipTorque = car.chassis.body.mass * 0.1; // Легкий прижим носа к земле при разгоне
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

new_controls = """    // НАСТОЯЩАЯ ФИЗИКА:
    // Крутящий момент мотора теперь физический, а не просто прибавление скорости!
    // Значения выверены под лунную гравитацию Matter.js (16 px/s^2), чтобы машина разгонялась реалистично и не делала 5 сальто!
    let motorTorque = car.chassis.body.mass * (0.005 + engineLvl * 0.002); // Разгон от 0.3g до 1.0g
    let airTorque = car.chassis.body.mass * 0.15; // Момент для сальто в воздухе (плавно)
    
    let isAnyPressed = false;

    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        isAnyPressed = true;
        
        if (car.wheelA.body.angularVelocity < maxSpeed) {
            car.wheelA.body.torque = motorTorque;
            if (car.driveType === 'awd') car.wheelB.body.torque = motorTorque;
        } else {
            // Ограничитель скорости (колеса не крутятся бесконечно быстро в воздухе)
            Matter.Body.setAngularVelocity(car.wheelA.body, maxSpeed);
            if (car.driveType === 'awd') Matter.Body.setAngularVelocity(car.wheelB.body, maxSpeed);
        }
        
        // В воздухе делаем сальто назад
        if (!isGrounded) {
            car.chassis.body.torque = -airTorque;
        }
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        isAnyPressed = true;
        
        if (car.wheelA.body.angularVelocity > -maxSpeed) {
            car.wheelA.body.torque = -motorTorque;
            car.wheelB.body.torque = -motorTorque; // Тормозят всегда оба колеса!
        } else {
            Matter.Body.setAngularVelocity(car.wheelA.body, -maxSpeed);
            Matter.Body.setAngularVelocity(car.wheelB.body, -maxSpeed);
        }
        
        // В воздухе делаем сальто вперед
        if (!isGrounded) {
            car.chassis.body.torque = airTorque;
        }
    }"""

content = content.replace(old_controls, new_controls)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
