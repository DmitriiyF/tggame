import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Increase chassis density from 0.005 to 0.015
content = re.sub(r'density:\s*0\.005', 'density: 0.015', content)

# 2. Increase suspension stiffness since car is 3x heavier
old_suspension = """    let k = 0.01 + (suspensionLvl * 0.006);
    let d = 0.1 + (suspensionLvl * 0.05);"""
new_suspension = """    let k = 0.03 + (suspensionLvl * 0.02); // Усиленная подвеска для тяжелой машины
    let d = 0.2 + (suspensionLvl * 0.1); // Усиленные амортизаторы"""
content = content.replace(old_suspension, new_suspension)

# 3. Adjust torques to prevent over-rotation and light front
old_torques = """    let motorTorque = car.chassis.body.mass * (0.005 + engineLvl * 0.002); // Разгон от 0.3g до 1.0g
    let airTorque = car.chassis.body.mass * 0.15; // Момент для сальто в воздухе (плавно)
    let antiFlipTorque = car.chassis.body.mass * 0.03; // Прижимная сила, чтобы передок не был легким на горках"""

new_torques = """    let motorTorque = car.chassis.body.mass * (0.005 + engineLvl * 0.002);
    let airTorque = car.chassis.body.mass * 0.08; // Меньше сальто, чтобы не перекручивало в воздухе
    let antiFlipTorque = car.chassis.body.mass * 0.10; // Мощная прижимная сила, чтобы нос был тяжелым на подъемах"""
content = content.replace(old_torques, new_torques)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
