import re

with open('game.js', 'r', encoding='utf-8') as f:
    lines = f.read().splitlines()

# The block is from line 241 ("// Асинхронно загружаем данные из облака") to line 277 (end of catch)
new_block = """    // Асинхронно загружаем данные из облака
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            window.Telegram.WebApp.CloudStorage.getItem('hillClimbCoins', (err, value) => {
                let coinStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('hillClimbCoins') || '0';
                totalCoins = parseInt(coinStr) || 0;
                scoreText.setText(totalCoins.toString());
            });
            window.Telegram.WebApp.CloudStorage.getItem('engineLevel_' + selectedCarId, (err, value) => {
                let fallback = localStorage.getItem('engineLevel_' + selectedCarId) || (selectedCarId === 'jeep' ? localStorage.getItem('engineLevel') : null) || '1';
                let engineStr = (value !== undefined && value !== null && value !== '') ? value : fallback;
                engineLvl = parseInt(engineStr) || 1;
            });
            window.Telegram.WebApp.CloudStorage.getItem('suspensionLevel_' + selectedCarId, (err, value) => {
                let fallback = localStorage.getItem('suspensionLevel_' + selectedCarId) || (selectedCarId === 'jeep' ? localStorage.getItem('suspensionLevel') : null) || '1';
                let suspStr = (value !== undefined && value !== null && value !== '') ? value : fallback;
                suspensionLvl = parseInt(suspStr) || 1;
                updateSuspensionPhysics();
            });
            window.Telegram.WebApp.CloudStorage.getItem('tiresLevel_' + selectedCarId, (err, value) => {
                let fallback = localStorage.getItem('tiresLevel_' + selectedCarId) || (selectedCarId === 'jeep' ? localStorage.getItem('tiresLevel') : null) || '1';
                let tiresStr = (value !== undefined && value !== null && value !== '') ? value : fallback;
                tiresLvl = parseInt(tiresStr) || 1;
                updateTiresPhysics();
            });
            window.Telegram.WebApp.CloudStorage.getItem('maxDistance_' + selectedCarId, (err, value) => {
                let fallback = localStorage.getItem('maxDistance_' + selectedCarId) || (selectedCarId === 'jeep' ? localStorage.getItem('maxDistance') : null) || '0';
                let distStr = (value !== undefined && value !== null && value !== '') ? value : fallback;
                maxDistance = parseInt(distStr) || 0;
                if (recordText) recordText.setText('РЕКОРД: ' + maxDistance + 'm');
            });
        } else {
            throw new Error("No CloudStorage");
        }
    } catch (e) {
        totalCoins = parseInt(localStorage.getItem('hillClimbCoins')) || 0;
        engineLvl = parseInt(localStorage.getItem('engineLevel_' + selectedCarId)) || (selectedCarId === 'jeep' ? parseInt(localStorage.getItem('engineLevel')) : 1) || 1;
        suspensionLvl = parseInt(localStorage.getItem('suspensionLevel_' + selectedCarId)) || (selectedCarId === 'jeep' ? parseInt(localStorage.getItem('suspensionLevel')) : 1) || 1;
        tiresLvl = parseInt(localStorage.getItem('tiresLevel_' + selectedCarId)) || (selectedCarId === 'jeep' ? parseInt(localStorage.getItem('tiresLevel')) : 1) || 1;
        maxDistance = parseInt(localStorage.getItem('maxDistance_' + selectedCarId)) || (selectedCarId === 'jeep' ? parseInt(localStorage.getItem('maxDistance')) : 0) || 0;
        scoreText.setText(totalCoins.toString());
        if (recordText) recordText.setText('РЕКОРД: ' + maxDistance + 'm');
        updateSuspensionPhysics();
        updateTiresPhysics();
    }"""

# Replace lines 240 to 277
lines = lines[:241] + new_block.splitlines() + lines[277:]

with open('game.js', 'w', encoding='utf-8') as f:
    f.write('\\n'.join(lines))

print("Done")
