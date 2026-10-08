import re

with open('garage.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add CSS for progress bar
css_old = """        .upgrade-info p { margin: 5px 0 0; color: #CCC; font-size: 14px; }"""
css_new = """        .upgrade-info p { margin: 5px 0 0; color: #CCC; font-size: 14px; }
        .progress-bar-container { width: 100%; height: 10px; background: #333; border-radius: 5px; margin-top: 10px; overflow: hidden; }
        .progress-bar { height: 100%; background: #00FF00; width: 10%; transition: width 0.3s; }
        .max-lvl { background: #FFD700 !important; color: #000 !important; font-weight: bold; }"""
content = content.replace(css_old, css_new)

# Add progress bars to HTML
html_old = """        <div class="upgrade-card">
            <div class="upgrade-info"><h3>Двигатель (Ур. <span id="engine-lvl">...</span>)</h3><p>Увеличивает скорость</p></div>
            <button class="upgrade-btn" id="buy-engine-btn" onclick="buyEngine()"><span id="engine-cost">...</span> 💰</button>
        </div>
        <div class="upgrade-card">
            <div class="upgrade-info"><h3>Подвеска (Ур. <span id="suspension-lvl">...</span>)</h3><p>Меньше трясет, лучше прыгает</p></div>
            <button class="upgrade-btn" id="buy-suspension-btn" onclick="buySuspension()"><span id="suspension-cost">...</span> 💰</button>
        </div>
        <div class="upgrade-card">
            <div class="upgrade-info"><h3>Шины (Ур. <span id="tires-lvl">...</span>)</h3><p>Улучшают сцепление с землей</p></div>
            <button class="upgrade-btn" id="buy-tires-btn" onclick="buyTires()"><span id="tires-cost">...</span> 💰</button>
        </div>"""

html_new = """        <div class="upgrade-card">
            <div class="upgrade-info">
                <h3>Двигатель (Ур. <span id="engine-lvl">...</span>/10)</h3>
                <p>Увеличивает скорость</p>
                <div class="progress-bar-container"><div class="progress-bar" id="engine-bar"></div></div>
            </div>
            <button class="upgrade-btn" id="buy-engine-btn" onclick="buyEngine()"><span id="engine-cost">...</span> 💰</button>
        </div>
        <div class="upgrade-card">
            <div class="upgrade-info">
                <h3>Подвеска (Ур. <span id="suspension-lvl">...</span>/10)</h3>
                <p>Меньше трясет, лучше прыгает</p>
                <div class="progress-bar-container"><div class="progress-bar" id="suspension-bar"></div></div>
            </div>
            <button class="upgrade-btn" id="buy-suspension-btn" onclick="buySuspension()"><span id="suspension-cost">...</span> 💰</button>
        </div>
        <div class="upgrade-card">
            <div class="upgrade-info">
                <h3>Шины (Ур. <span id="tires-lvl">...</span>/10)</h3>
                <p>Улучшают сцепление с землей</p>
                <div class="progress-bar-container"><div class="progress-bar" id="tires-bar"></div></div>
            </div>
            <button class="upgrade-btn" id="buy-tires-btn" onclick="buyTires()"><span id="tires-cost">...</span> 💰</button>
        </div>"""
content = content.replace(html_old, html_new)

# Update UI logic to handle max level
js_ui_old = """        function updateUI() {
            let engineCost = engineLvl * 50;
            let engineBtn = document.getElementById('buy-engine-btn');
            document.getElementById('engine-cost').innerText = engineCost;
            engineBtn.disabled = balance < engineCost;

            let suspensionCost = suspensionLvl * 50;
            let suspensionBtn = document.getElementById('buy-suspension-btn');
            document.getElementById('suspension-cost').innerText = suspensionCost;
            suspensionBtn.disabled = balance < suspensionCost;

            let tiresCost = tiresLvl * 50;
            let tiresBtn = document.getElementById('buy-tires-btn');
            document.getElementById('tires-cost').innerText = tiresCost;
            tiresBtn.disabled = balance < tiresCost;
        }"""

js_ui_new = """        const MAX_LVL = 10;

        function updateUI() {
            let engineCost = engineLvl * 50;
            let engineBtn = document.getElementById('buy-engine-btn');
            document.getElementById('engine-bar').style.width = (engineLvl / MAX_LVL * 100) + '%';
            if (engineLvl >= MAX_LVL) {
                engineBtn.innerHTML = "МАКСИМУМ";
                engineBtn.disabled = true;
                engineBtn.classList.add('max-lvl');
            } else {
                document.getElementById('engine-cost').innerText = engineCost;
                engineBtn.disabled = balance < engineCost;
                engineBtn.classList.remove('max-lvl');
            }

            let suspensionCost = suspensionLvl * 50;
            let suspensionBtn = document.getElementById('buy-suspension-btn');
            document.getElementById('suspension-bar').style.width = (suspensionLvl / MAX_LVL * 100) + '%';
            if (suspensionLvl >= MAX_LVL) {
                suspensionBtn.innerHTML = "МАКСИМУМ";
                suspensionBtn.disabled = true;
                suspensionBtn.classList.add('max-lvl');
            } else {
                document.getElementById('suspension-cost').innerText = suspensionCost;
                suspensionBtn.disabled = balance < suspensionCost;
                suspensionBtn.classList.remove('max-lvl');
            }

            let tiresCost = tiresLvl * 50;
            let tiresBtn = document.getElementById('buy-tires-btn');
            document.getElementById('tires-bar').style.width = (tiresLvl / MAX_LVL * 100) + '%';
            if (tiresLvl >= MAX_LVL) {
                tiresBtn.innerHTML = "МАКСИМУМ";
                tiresBtn.disabled = true;
                tiresBtn.classList.add('max-lvl');
            } else {
                document.getElementById('tires-cost').innerText = tiresCost;
                tiresBtn.disabled = balance < tiresCost;
                tiresBtn.classList.remove('max-lvl');
            }
        }"""
content = content.replace(js_ui_old, js_ui_new)

# Add level limit to buy functions
js_buy_old = """        function buyEngine() {
            let cost = engineLvl * 50;
            if (balance >= cost) {
                balance -= cost; engineLvl++;
                document.getElementById('balance').innerText = balance;
                document.getElementById('engine-lvl').innerText = engineLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }

        function buySuspension() {
            let cost = suspensionLvl * 50;
            if (balance >= cost) {
                balance -= cost; suspensionLvl++;
                document.getElementById('balance').innerText = balance;
                document.getElementById('suspension-lvl').innerText = suspensionLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }

        function buyTires() {
            let cost = tiresLvl * 50;
            if (balance >= cost) {
                balance -= cost; tiresLvl++;
                document.getElementById('balance').innerText = balance;
                document.getElementById('tires-lvl').innerText = tiresLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }"""

js_buy_new = """        function buyEngine() {
            let cost = engineLvl * 50;
            if (balance >= cost && engineLvl < MAX_LVL) {
                balance -= cost; engineLvl++;
                document.getElementById('balance').innerText = balance;
                document.getElementById('engine-lvl').innerText = engineLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }

        function buySuspension() {
            let cost = suspensionLvl * 50;
            if (balance >= cost && suspensionLvl < MAX_LVL) {
                balance -= cost; suspensionLvl++;
                document.getElementById('balance').innerText = balance;
                document.getElementById('suspension-lvl').innerText = suspensionLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }

        function buyTires() {
            let cost = tiresLvl * 50;
            if (balance >= cost && tiresLvl < MAX_LVL) {
                balance -= cost; tiresLvl++;
                document.getElementById('balance').innerText = balance;
                document.getElementById('tires-lvl').innerText = tiresLvl;
                saveData(); updateUI(); triggerHaptic();
            }
        }"""
content = content.replace(js_buy_old, js_buy_new)

with open('garage.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
