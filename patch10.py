import re

with open('garage.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Clamp in loadData
content = re.sub(r'engineLvl = parseInt\(eng\) \|\| 1;', 'engineLvl = Math.min(MAX_LVL, parseInt(eng) || 1);', content)
content = re.sub(r'suspensionLvl = parseInt\(susp\) \|\| 1;', 'suspensionLvl = Math.min(MAX_LVL, parseInt(susp) || 1);', content)
content = re.sub(r'tiresLvl = parseInt\(tires\) \|\| 1;', 'tiresLvl = Math.min(MAX_LVL, parseInt(tires) || 1);', content)

# 2. Add downgrade buttons to HTML
content = content.replace('<button class="upgrade-btn" id="buy-engine-btn" onclick="buyEngine()"><span id="engine-cost">...</span> 💰</button>',
"""<div style="display:flex; gap: 5px;">
                <button class="upgrade-btn downgrade-btn" onclick="downgradeEngine()" style="flex:0 0 40px; background:#d9534f;">-</button>
                <button class="upgrade-btn" id="buy-engine-btn" onclick="buyEngine()" style="flex:1;"><span id="engine-cost">...</span> 💰</button>
            </div>""")

content = content.replace('<button class="upgrade-btn" id="buy-suspension-btn" onclick="buySuspension()"><span id="suspension-cost">...</span> 💰</button>',
"""<div style="display:flex; gap: 5px;">
                <button class="upgrade-btn downgrade-btn" onclick="downgradeSuspension()" style="flex:0 0 40px; background:#d9534f;">-</button>
                <button class="upgrade-btn" id="buy-suspension-btn" onclick="buySuspension()" style="flex:1;"><span id="suspension-cost">...</span> 💰</button>
            </div>""")

content = content.replace('<button class="upgrade-btn" id="buy-tires-btn" onclick="buyTires()"><span id="tires-cost">...</span> 💰</button>',
"""<div style="display:flex; gap: 5px;">
                <button class="upgrade-btn downgrade-btn" onclick="downgradeTires()" style="flex:0 0 40px; background:#d9534f;">-</button>
                <button class="upgrade-btn" id="buy-tires-btn" onclick="buyTires()" style="flex:1;"><span id="tires-cost">...</span> 💰</button>
            </div>""")

# 3. Add Downgrade functions to JS
downgrade_js = """
        function downgradeEngine() {
            if (engineLvl > 1) {
                engineLvl--;
                balance += engineLvl * 50; // Refund the cost of the level we just lost
                document.getElementById('balance').innerText = balance;
                document.getElementById('engine-lvl').innerText = engineLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }
        function downgradeSuspension() {
            if (suspensionLvl > 1) {
                suspensionLvl--;
                balance += suspensionLvl * 50;
                document.getElementById('balance').innerText = balance;
                document.getElementById('suspension-lvl').innerText = suspensionLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }
        function downgradeTires() {
            if (tiresLvl > 1) {
                tiresLvl--;
                balance += tiresLvl * 50;
                document.getElementById('balance').innerText = balance;
                document.getElementById('tires-lvl').innerText = tiresLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }
"""
content = content.replace('function buyEngine() {', downgrade_js + '\\n        function buyEngine() {')

with open('garage.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
