import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

parts = content.split('function update() {')
if len(parts) > 1:
    before = parts[0]
    after = parts[1].split('    if (!isAnyPressed && !isGrounded) {')[1]
    
    new_update = """function update() {
    if (gameOverFlag) return;

    if (isGrounded) {
        car.airFrames = 0;
    } else {
        car.airFrames = (car.airFrames || 0) + 1;
    }

    if (car && car.chassis && car.emoji) {
        let dx = 0; 
        let dy = -25; // Центр масс опущен на 25 пикселей, поднимаем визуал
        
        let angle = car.chassis.rotation;
        let offsetX = Math.cos(angle) * dx - Math.sin(angle) * dy;
        let offsetY = Math.sin(angle) * dx + Math.cos(angle) * dy;
        
        car.emoji.setPosition(car.chassis.x + offsetX, car.chassis.y + offsetY);
        car.emoji.setRotation(angle);
    }

    let motorTorque = car.chassis.body.mass * (0.005 + engineLvl * 0.002);
    let airTorque = car.chassis.body.mass * 0.08;
    let antiFlipTorque = car.chassis.body.mass * 0.02; // Легкий прижим

    let isAnyPressed = false;

    if ((cursors.right.isDown || isGasPressed) && currentFuel > 0) {
        isAnyPressed = true;
        
        if (car.wheelA.body.angularVelocity < maxSpeed) {
            car.wheelA.body.torque = motorTorque;
            if (car.driveType === 'awd') car.wheelB.body.torque = motorTorque;
        } else {
            Matter.Body.setAngularVelocity(car.wheelA.body, maxSpeed);
            if (car.driveType === 'awd') Matter.Body.setAngularVelocity(car.wheelB.body, maxSpeed);
        }
        
        if (isGrounded) {
            car.chassis.body.torque = antiFlipTorque;
        } else if (car.airFrames > 15) {
            car.chassis.body.torque = -airTorque;
        }
    } 
    else if ((cursors.left.isDown || isBrakePressed)) {
        isAnyPressed = true;
        
        if (car.wheelA.body.angularVelocity > -maxSpeed) {
            car.wheelA.body.torque = -motorTorque;
            car.wheelB.body.torque = -motorTorque;
        } else {
            Matter.Body.setAngularVelocity(car.wheelA.body, -maxSpeed);
            Matter.Body.setAngularVelocity(car.wheelB.body, -maxSpeed);
        }
        
        if (isGrounded) {
            car.chassis.body.torque = -antiFlipTorque;
        } else if (car.airFrames > 15) {
            car.chassis.body.torque = airTorque;
        }
    }

    if (!isAnyPressed && !isGrounded) {"""

    with open('game.js', 'w', encoding='utf-8') as f:
        f.write(before + new_update + after)
    print("Done")
else:
    print("Failed")
