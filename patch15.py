import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. setCentre
content = re.sub(
    r'(label: \'chassis\'\s*}\);)', 
    r'\1\n    Matter.Body.setCentre(car.chassis.body, { x: car.chassis.body.position.x, y: car.chassis.body.position.y + 25 }, true);', 
    content
)

# 2. Springs offset
content = content.replace("pointA: { x: cfg.wxA, y: cfg.wy }", "pointA: { x: cfg.wxA, y: cfg.wy - 25 }")
content = content.replace("pointA: { x: cfg.wxB, y: cfg.wy }", "pointA: { x: cfg.wxB, y: cfg.wy - 25 }")

# 3. Emoji offset (find let dy = car.emoji.deltaY || 0;)
content = content.replace(
    "let dy = car.emoji.deltaY || 0;",
    "let dy = (car.emoji.deltaY || 0) - 25;"
)

# 4. airFrames tracker
content = content.replace(
    "if (gameOverFlag) return;",
    "if (gameOverFlag) return;\n    if (isGrounded) car.airFrames = 0;\n    else car.airFrames = (car.airFrames || 0) + 1;"
)

# 5. airTorque logic (replace the exact blocks)
block_gas = """        if (isGrounded) {
            // На земле прижимаем нос, чтобы машина лучше карабкалась в гору
            car.chassis.body.torque = antiFlipTorque;
        } else {
            // В воздухе делаем сальто назад
            car.chassis.body.torque = -airTorque;
        }"""
new_block_gas = """        if (isGrounded) {
            car.chassis.body.torque = antiFlipTorque;
        } else if (car.airFrames > 15) {
            car.chassis.body.torque = -airTorque;
        }"""
content = content.replace(block_gas, new_block_gas)

block_brake = """        // В воздухе делаем сальто вперед
        if (!isGrounded) {
            car.chassis.body.torque = airTorque;
        }"""
new_block_brake = """        if (!isGrounded && car.airFrames > 15) {
            car.chassis.body.torque = airTorque;
        }"""
content = content.replace(block_brake, new_block_brake)


with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
