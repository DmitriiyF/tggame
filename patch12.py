import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Add airFrames logic
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

# Replace airTorque usage
old_gas_air = """        } else {
            // В воздухе сальто назад
            car.chassis.body.torque = -airTorque;
        }"""
new_gas_air = """        } else {
            // В воздухе сальто назад (только если мы реально летим, а не подпрыгнули на кочке)
            if (car.airFrames > 15) {
                car.chassis.body.torque = -airTorque;
            }
        }"""
content = content.replace(old_gas_air, new_gas_air)

old_brake_air = """        } else {
            // В воздухе сальто вперед
            car.chassis.body.torque = airTorque;
        }"""
new_brake_air = """        } else {
            // В воздухе сальто вперед (с задержкой от микро-прыжков)
            if (car.airFrames > 15) {
                car.chassis.body.torque = airTorque;
            }
        }"""
content = content.replace(old_brake_air, new_brake_air)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
