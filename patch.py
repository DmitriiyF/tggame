import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the control section
old_controls = """    // Управление работает только если есть бензин
    let airTorque = 0.05; // Угловое ускорение для сальто

    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        if (car.wheelB.body.angularVelocity < maxSpeed) {
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity + torque); // Заднее колесо тянет всегда
            if (car.driveType === 'awd') {
                car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity + torque); // Переднее тянет только на полном приводе (танк)
            }
        }
        // Наклон назад в воздухе (вместо линейной силы, которая заставляла прыгать)
        Matter.Body.setAngularVelocity(car.chassis.body, car.chassis.body.angularVelocity - airTorque);
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        // Тормозить можно всегда (даже без бензина), тормозят оба колеса для эффективности
        if (car.wheelB.body.angularVelocity > -maxSpeed) {
            car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity - torque);
            car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity - torque);
        }
        // Наклон вперед в воздухе
        Matter.Body.setAngularVelocity(car.chassis.body, car.chassis.body.angularVelocity + airTorque);
    }"""

new_controls = """    // Управление работает только если есть бензин
    let airTorque = car.chassis.body.mass * 0.12; // Мягкий крутящий момент для сальто и вилли
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
    }

    // Если кнопки отпущены - плавно останавливаем вращение колес (чтобы при приземлении не было резкого рывка)
    if (!isAnyPressed) {
        car.wheelA.setAngularVelocity(car.wheelA.body.angularVelocity * 0.95);
        car.wheelB.setAngularVelocity(car.wheelB.body.angularVelocity * 0.95);
    }"""

content = content.replace(old_controls, new_controls)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
