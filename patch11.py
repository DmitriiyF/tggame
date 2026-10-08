import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the driving logic in update()
old_controls = """    let motorTorque = car.chassis.body.mass * (0.005 + engineLvl * 0.002); // Разгон от 0.3g до 1.0g
    let airTorque = car.chassis.body.mass * 0.08; // Момент для сальто в воздухе (плавно)
    let antiFlipTorque = car.chassis.body.mass * 0.15; // Мощная прижимная сила, чтобы нос был тяжелым на подъемах
    
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
        
        if (isGrounded) {
            // На земле прижимаем нос, чтобы машина лучше карабкалась в гору
            car.chassis.body.torque = antiFlipTorque;
        } else {
            // В воздухе делаем сальто назад
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

new_controls = """    // УПРАВЛЕНИЕ: АРКАДНЫЙ ПРИВОД (HYBRID)
    // Чтобы машина вообще никогда не переворачивалась от разгона, мы применяем силу к самому кузову, а колеса просто крутим визуально.
    let enginePower = 0.005 + (engineLvl * 0.002);
    let forwardForce = car.chassis.body.mass * enginePower; 
    let airTorque = car.chassis.body.mass * 0.08; 
    let antiFlipTorque = car.chassis.body.mass * 0.15; // Прижимная сила для горок
    
    let isAnyPressed = false;

    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        isAnyPressed = true;
        
        if (isGrounded) {
            // Толкаем саму машину вперед! (Вектор силы направлен по углу наклона машины)
            let angle = car.chassis.rotation;
            let fx = Math.cos(angle) * forwardForce;
            let fy = Math.sin(angle) * forwardForce;
            car.chassis.applyForce({ x: fx, y: fy });
            
            // Крутим колеса для вида и физики сцепления
            if (car.wheelA.body.angularVelocity < maxSpeed) {
                car.wheelA.body.torque = forwardForce * 5;
                car.wheelB.body.torque = forwardForce * 5;
            }
            // Прижимаем нос к горе
            car.chassis.body.torque = antiFlipTorque;
        } else {
            // В воздухе сальто назад
            car.chassis.body.torque = -airTorque;
        }
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        isAnyPressed = true;
        
        if (isGrounded) {
            let angle = car.chassis.rotation;
            let fx = Math.cos(angle) * -forwardForce;
            let fy = Math.sin(angle) * -forwardForce;
            car.chassis.applyForce({ x: fx, y: fy });
            
            if (car.wheelA.body.angularVelocity > -maxSpeed) {
                car.wheelA.body.torque = -forwardForce * 5;
                car.wheelB.body.torque = -forwardForce * 5;
            }
            car.chassis.body.torque = -antiFlipTorque;
        } else {
            // В воздухе сальто вперед
            car.chassis.body.torque = airTorque;
        }
    }"""

content = content.replace(old_controls, new_controls)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
