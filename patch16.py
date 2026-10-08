import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Revert all broken isGameOver replacements
content = content.replace('if (isGameOver) return;\\n    if (isGrounded) car.airFrames = 0; else car.airFrames = (car.airFrames || 0) + 1;', 'if (isGameOver) return;')

# Only apply to update()
content = content.replace('function update() {\n    if (isGameOver) return;', 'function update() {\n    if (isGameOver) return;\n    if (isGrounded) car.airFrames = 0; else car.airFrames = (car.airFrames || 0) + 1;')

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
