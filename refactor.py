import re

# 1. Update game.js
with open('game.js', 'r', encoding='utf-8') as f:
    game_js = f.read()

# Replace the data loading section in game.js
game_js = re.sub(
    r"engineLvl = parseInt\(localStorage\.getItem\('engineLevel'\)\) \|\| 1;.*?window\.Telegram\.WebApp\.CloudStorage\.getItem\('selectedCar', \(err, val\) => \{ if\(val\) selectedCarId = val; \}\);\s*\}\s*catch\(e\)\s*\{\}",
    """selectedCarId = localStorage.getItem('selectedCar') || 'jeep';
    
    function loadLvl(key, fallbackKey, callback) {
        let val = localStorage.getItem(key);
        if (!val && fallbackKey) val = localStorage.getItem(fallbackKey);
        callback(parseInt(val) || 1);
        
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.getItem) {
            window.Telegram.WebApp.CloudStorage.getItem(key, (err, cloudVal) => {
                if (cloudVal) callback(parseInt(cloudVal));
                else if (fallbackKey) {
                    window.Telegram.WebApp.CloudStorage.getItem(fallbackKey, (err, fVal) => {
                        if (fVal) callback(parseInt(fVal));
                    });
                }
            });
        }
    }
    
    maxDistance = parseInt(localStorage.getItem('maxDistance')) || 0;
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.getItem) {
        window.Telegram.WebApp.CloudStorage.getItem('maxDistance', (err, val) => { if(val) { maxDistance = parseInt(val); if(recordText) recordText.setText('РЕКОРД: ' + maxDistance + 'm'); } });
        window.Telegram.WebApp.CloudStorage.getItem('selectedCar', (err, val) => { if(val) selectedCarId = val; });
    }
    
    loadLvl('engineLevel_' + selectedCarId, selectedCarId === 'jeep' ? 'engineLevel' : null, v => engineLvl = v);
    loadLvl('suspensionLevel_' + selectedCarId, selectedCarId === 'jeep' ? 'suspensionLevel' : null, v => { suspensionLvl = v; updateSuspensionPhysics(); });
    loadLvl('tiresLevel_' + selectedCarId, selectedCarId === 'jeep' ? 'tiresLevel' : null, v => { tiresLvl = v; updateTiresPhysics(); });""",
    game_js, flags=re.DOTALL
)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(game_js)

# 2. Update hillclimb_menu.html
with open('hillclimb_menu.html', 'r', encoding='utf-8') as f:
    menu = f.read()

menu = re.sub(
    r"window\.Telegram\.WebApp\.CloudStorage\.getItem\('engineLevel', \(err, value\) => \{.*?document\.getElementById\('engine-lvl'\)\.innerText = eng;.*?\}\);",
    """window.Telegram.WebApp.CloudStorage.getItem('selectedCar', (err, carVal) => {
                        selectedCar = carVal || localStorage.getItem('selectedCar') || 'jeep';
                        updateCarIcon(selectedCar);
                        
                        window.Telegram.WebApp.CloudStorage.getItem('engineLevel_' + selectedCar, (err, value) => {
                            let eng = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('engineLevel_' + selectedCar);
                            if (!eng && selectedCar === 'jeep') eng = localStorage.getItem('engineLevel'); // fallback
                            document.getElementById('engine-lvl').innerText = eng || '1';
                        });
                    });""",
    menu, flags=re.DOTALL
)
menu = menu.replace(
    "document.getElementById('engine-lvl').innerText = localStorage.getItem('engineLevel') || '1';",
    "let eng = localStorage.getItem('engineLevel_' + selectedCar); if (!eng && selectedCar === 'jeep') eng = localStorage.getItem('engineLevel'); document.getElementById('engine-lvl').innerText = eng || '1';"
)
menu = re.sub(r"window\.Telegram\.WebApp\.CloudStorage\.getItem\('selectedCar', \(err, value\) => \{.*?updateCarIcon\(selectedCar\);.*?\}\);", "", menu, flags=re.DOTALL)

with open('hillclimb_menu.html', 'w', encoding='utf-8') as f:
    f.write(menu)

# 3. Update garage.html completely
garage_html = """<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Гараж</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
    <style>
        body { margin: 0; font-family: Arial, sans-serif; background: #222; color: white; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .header { background: #333; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        .back-btn { background: #555; border: none; border-radius: 10px; padding: 10px 15px; color: white; font-weight: bold; cursor: pointer; }
        .balance-box { font-size: 20px; font-weight: bold; color: #FFD700; background: rgba(255,255,255,0.1); padding: 8px 15px; border-radius: 20px; }
        .garage-container { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
        .upgrade-card { background: #333; border-radius: 15px; padding: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 8px rgba(0,0,0,0.3); }
        .upgrade-info h3 { margin: 0 0 5px 0; font-size: 18px; color: #4CAF50; }
        .upgrade-info p { margin: 0; font-size: 14px; color: #aaa; }
        .upgrade-btn { background: #4CAF50; border: none; border-radius: 10px; padding: 10px 15px; color: white; font-weight: bold; font-size: 16px; cursor: pointer; }
        .upgrade-btn:disabled { background: #555; color: #888; }
        h2 { text-align: center; color: white; margin-top: 20px; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <button class="back-btn" onclick="window.location.href='hillclimb_menu.html'">◀ Назад</button>
        <div class="balance-box">💰 <span id="balance">...</span></div>
    </div>
    
    <h2>Прокачка: <span id="car-name">🚙 Джип</span></h2>

    <div class="garage-container">
        <div class="upgrade-card">
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
        </div>
    </div>

    <script>
        let balance = 0;
        let engineLvl = 1; let suspensionLvl = 1; let tiresLvl = 1;
        let selectedCarId = 'jeep';
        const carNames = { 'jeep': '🚙 Джип', 'bike': '🏍️ Мотокросс', 'tractor': '🚜 Трактор', 'racecar': '🏎️ Гоночная', 'tank': '🚛 Грузовик' };

        function getCloudItem(key) {
            return new Promise((resolve) => {
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.getItem) {
                    window.Telegram.WebApp.CloudStorage.getItem(key, (err, val) => {
                        if (val !== undefined && val !== null && val !== '') resolve(val);
                        else resolve(localStorage.getItem(key));
                    });
                } else {
                    resolve(localStorage.getItem(key));
                }
            });
        }

        async function loadData() {
            selectedCarId = await getCloudItem('selectedCar') || 'jeep';
            document.getElementById('car-name').innerText = carNames[selectedCarId] || carNames['jeep'];

            let bal = await getCloudItem('hillClimbCoins');
            balance = parseInt(bal) || 0;
            document.getElementById('balance').innerText = balance;

            let eng = await getCloudItem('engineLevel_' + selectedCarId);
            if (!eng && selectedCarId === 'jeep') eng = await getCloudItem('engineLevel');
            engineLvl = parseInt(eng) || 1;

            let susp = await getCloudItem('suspensionLevel_' + selectedCarId);
            if (!susp && selectedCarId === 'jeep') susp = await getCloudItem('suspensionLevel');
            suspensionLvl = parseInt(susp) || 1;

            let tires = await getCloudItem('tiresLevel_' + selectedCarId);
            if (!tires && selectedCarId === 'jeep') tires = await getCloudItem('tiresLevel');
            tiresLvl = parseInt(tires) || 1;

            document.getElementById('engine-lvl').innerText = engineLvl;
            document.getElementById('suspension-lvl').innerText = suspensionLvl;
            document.getElementById('tires-lvl').innerText = tiresLvl;
            updateUI();
        }

        function updateUI() {
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
        }

        function buyEngine() {
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
        }

        function saveData() {
            localStorage.setItem('hillClimbCoins', balance.toString());
            localStorage.setItem('engineLevel_' + selectedCarId, engineLvl.toString());
            localStorage.setItem('suspensionLevel_' + selectedCarId, suspensionLvl.toString());
            localStorage.setItem('tiresLevel_' + selectedCarId, tiresLvl.toString());

            try {
                if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.setItem) {
                    window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', balance.toString());
                    window.Telegram.WebApp.CloudStorage.setItem('engineLevel_' + selectedCarId, engineLvl.toString());
                    window.Telegram.WebApp.CloudStorage.setItem('suspensionLevel_' + selectedCarId, suspensionLvl.toString());
                    window.Telegram.WebApp.CloudStorage.setItem('tiresLevel_' + selectedCarId, tiresLvl.toString());
                }
            } catch (e) {}
        }

        function triggerHaptic() {
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
            }
        }

        loadData();
    </script>
</body>
</html>"""

with open('garage.html', 'w', encoding='utf-8') as f:
    f.write(garage_html)
