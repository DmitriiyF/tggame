import re

with open('game.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix gameOver saving
old_gameover = """    // Финальное сохранение монет и рекорда дистанции в облако
    localStorage.setItem('maxDistance', maxDistance.toString());
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.CloudStorage.setItem) {
            window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', totalCoins.toString(), (e,s)=>{});
            window.Telegram.WebApp.CloudStorage.setItem('maxDistance', maxDistance.toString(), (e,s)=>{});
        }
    } catch(e) {}"""

new_gameover = """    // Финальное сохранение монет и рекорда дистанции в облако
    localStorage.setItem('maxDistance_' + selectedCarId, maxDistance.toString());
    if (selectedCarId === 'jeep') localStorage.setItem('maxDistance', maxDistance.toString());
    
    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            window.Telegram.WebApp.CloudStorage.setItem('hillClimbCoins', totalCoins.toString(), (e,s)=>{});
            window.Telegram.WebApp.CloudStorage.setItem('maxDistance_' + selectedCarId, maxDistance.toString(), (e,s)=>{});
            if (selectedCarId === 'jeep') window.Telegram.WebApp.CloudStorage.setItem('maxDistance', maxDistance.toString(), (e,s)=>{});
        }
    } catch(e) {}"""

content = content.replace(old_gameover, new_gameover)

# Fix loading inside create()
old_create_load = """    try {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage && window.Telegram.WebApp.isVersionAtLeast('6.9')) {
            window.Telegram.WebApp.CloudStorage.getItem('hillClimbCoins', (err, value) => {
                let coinStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('hillClimbCoins') || '0';
                totalCoins = parseInt(coinStr) || 0;
                scoreText.setText(totalCoins.toString());
            });
            window.Telegram.WebApp.CloudStorage.getItem('engineLevel', (err, value) => {
                let engineStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('engineLevel') || '1';
                engineLvl = parseInt(engineStr) || 1;
            });
            window.Telegram.WebApp.CloudStorage.getItem('suspensionLevel', (err, value) => {
                let suspStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('suspensionLevel') || '1';
                suspensionLvl = parseInt(suspStr) || 1;
                updateSuspensionPhysics();
            });
            window.Telegram.WebApp.CloudStorage.getItem('tiresLevel', (err, value) => {
                let tiresStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('tiresLevel') || '1';
                tiresLvl = parseInt(tiresStr) || 1;
                updateTiresPhysics();
            });
            window.Telegram.WebApp.CloudStorage.getItem('maxDistance', (err, value) => {
                let distStr = (value !== undefined && value !== null && value !== '') ? value : localStorage.getItem('maxDistance') || '0';
                maxDistance = parseInt(distStr) || 0;
                if (recordText) recordText.setText('Рекорд: ' + maxDistance + 'm');
            });
        } else {
            throw new Error("No CloudStorage");
        }
    } catch (e) {
        totalCoins = parseInt(localStorage.getItem('hillClimbCoins')) || 0;
        engineLvl = parseInt(localStorage.getItem('engineLevel')) || 1;
        suspensionLvl = parseInt(localStorage.getItem('suspensionLevel')) || 1;
        tiresLvl = parseInt(localStorage.getItem('tiresLevel')) || 1;
        maxDistance = parseInt(localStorage.getItem('maxDistance')) || 0;
        scoreText.setText(totalCoins.toString());
        if (recordText) recordText.setText('Рекорд: ' + maxDistance + 'm');
        updateSuspensionPhysics();
        updateTiresPhysics();
    }"""

new_create_load = """    try {
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
                if (recordText) recordText.setText('Рекорд: ' + maxDistance + 'm');
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
        if (recordText) recordText.setText('Рекорд: ' + maxDistance + 'm');
        updateSuspensionPhysics();
        updateTiresPhysics();
    }"""

content = content.replace(old_create_load, new_create_load)

with open('game.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
