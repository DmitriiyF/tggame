import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix collision logic to handle Matter.js parts and use parent body
old_collision = """    this.matter.world.on('collisionactive', function (event) {
        for (let i = 0; i < event.pairs.length; i++) {
            let bodyA = event.pairs[i].bodyA;
            let bodyB = event.pairs[i].bodyB;
            let isCarA = bodyA.label === 'car' || bodyA.label === 'chassis';
            let isCarB = bodyB.label === 'car' || bodyB.label === 'chassis';
            if ((isCarA && bodyB.label === 'ground') || (isCarB && bodyA.label === 'ground')) {
                isGrounded = true;
            }
        }
    });"""

new_collision = """    this.matter.world.on('collisionactive', function (event) {
        for (let i = 0; i < event.pairs.length; i++) {
            let bodyA = event.pairs[i].bodyA;
            let bodyB = event.pairs[i].bodyB;
            
            let pA = bodyA.parent || bodyA;
            let pB = bodyB.parent || bodyB;
            
            let isCarA = pA.label === 'car' || pA.label === 'chassis';
            let isCarB = pB.label === 'car' || pB.label === 'chassis';
            
            let isGroundA = pA.label === 'ground' || (pA.isStatic && !pA.isSensor);
            let isGroundB = pB.label === 'ground' || (pB.isStatic && !pB.isSensor);
            
            if ((isCarA && isGroundB) || (isCarB && isGroundA)) {
                isGrounded = true;
            }
        }
    });"""

content = content.replace(old_collision, new_collision)

# Tune torques
old_controls = """    // Управление работает только если есть бензин
    let airTorque = car.chassis.body.mass * 0.5; // Сильный момент для воздуха
    let antiFlipTorque = car.chassis.body.mass * 0.2; // Момент прижимания к земле"""

new_controls = """    // Управление работает только если есть бензин
    let airTorque = car.chassis.body.mass * 0.2; // Момент для сальто в воздухе
    let antiFlipTorque = car.chassis.body.mass * 0.1; // Легкий прижим носа к земле при разгоне"""

content = content.replace(old_controls, new_controls)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
