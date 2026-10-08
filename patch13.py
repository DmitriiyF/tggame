import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Lower center of mass in createCar()
old_chassis_create = """    car.chassis = scene.matter.add.gameObject(chassisRect, { 
        collisionFilter: { group: group },
        density: cfg.cdens,
        restitution: 0.1,
        friction: 0.5,
        frictionAir: 0.05,
        label: 'chassis'
    });"""

new_chassis_create = """    car.chassis = scene.matter.add.gameObject(chassisRect, { 
        collisionFilter: { group: group },
        density: cfg.cdens,
        restitution: 0.1,
        friction: 0.5,
        frictionAir: 0.05,
        label: 'chassis'
    });
    
    // СУПЕР ХАК ДЛЯ 2D МАШИН: Искусственно опускаем центр масс вниз к колесам.
    // Это физически не даст машине делать сальто назад при разгоне!
    let comOffset = 25;
    Matter.Body.setCentre(car.chassis.body, { x: car.chassis.body.position.x, y: car.chassis.body.position.y + comOffset }, true);"""
content = content.replace(old_chassis_create, new_chassis_create)


# 2. Adjust constraint points by -comOffset
old_springA = "pointA: { x: cfg.wxA, y: cfg.wy }"
new_springA = "pointA: { x: cfg.wxA, y: cfg.wy - 25 }"
content = content.replace(old_springA, new_springA)

old_springB = "pointA: { x: cfg.wxB, y: cfg.wy }"
new_springB = "pointA: { x: cfg.wxB, y: cfg.wy - 25 }"
content = content.replace(old_springB, new_springB)


# 3. Adjust emoji rendering in update()
old_emoji_render = """        let offsetX = Math.cos(angle) * dx;
        let offsetY = Math.cos(angle) * dy;
        
        car.emoji.setPosition(car.chassis.x + offsetX, car.chassis.y + offsetY);"""

new_emoji_render = """        // Центр масс опущен на 25 пикселей, поэтому визуал поднимаем на 25 пикселей в локальных координатах
        dy -= 25; 
        
        let offsetX = Math.cos(angle) * dx - Math.sin(angle) * dy;
        let offsetY = Math.sin(angle) * dx + Math.cos(angle) * dy;
        
        car.emoji.setPosition(car.chassis.x + offsetX, car.chassis.y + offsetY);"""
content = content.replace(old_emoji_render, new_emoji_render)


# 4. Add airFrames logic in update() to fix micro-bounces
old_update_start = """function update() {
    if (gameOverFlag) return;"""

new_update_start = """function update() {
    if (gameOverFlag) return;
    
    if (isGrounded) {
        car.airFrames = 0;
    } else {
        car.airFrames = (car.airFrames || 0) + 1;
    }"""
content = content.replace(old_update_start, new_update_start)

# 5. Fix airTorque micro-bounces
old_gas_air = """        // В воздухе делаем сальто назад
        if (!isGrounded) {
            car.chassis.body.torque = -airTorque;
        }"""
new_gas_air = """        // В воздухе сальто назад (только если реально в полете, а не на кочке)
        if (!isGrounded && car.airFrames > 15) {
            car.chassis.body.torque = -airTorque;
        }"""
content = content.replace(old_gas_air, new_gas_air)

old_brake_air = """        // В воздухе делаем сальто вперед
        if (!isGrounded) {
            car.chassis.body.torque = airTorque;
        }"""
new_brake_air = """        // В воздухе сальто вперед
        if (!isGrounded && car.airFrames > 15) {
            car.chassis.body.torque = airTorque;
        }"""
content = content.replace(old_brake_air, new_brake_air)


with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
