/**
 * БАЗА ДАННЫХ РЕЙТИНГА ДРУЗЕЙ В GOOGLE SHEETS ДЛЯ ARCADE HUB
 *
 * Как подключить за 1 минуту:
 * 1. Создай новую Google Таблицу (https://sheets.new).
 * 2. В верхнем меню выбери: Расширения -> Apps Script.
 * 3. Удали весь код в редакторе и вставь этот файл целиком. Нажми Ctrl+S (Сохранить).
 * 4. Нажми синюю кнопку "Начать развертывание" -> "Новое развертывание":
 *    - Тип: "Веб-приложение" (Web App)
 *    - Запуск от имени: "Меня" (Me)
 *    - У кого есть доступ: "Все" (Anyone)
 * 5. Скопируй полученный URL веб-приложения (заканчивается на /exec)
 *    и вставь его в константу GOOGLE_SHEET_WEBAPP_URL в index.html (или через кнопку 🔗 в вкладке "Рейтинг").
 */

const SHEET_NAME = 'Leaderboard';

function ensureSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'userId',
      'name',
      'totalPts',
      'rrBest',
      'ssBest',
      'tdBest',
      'bsBest',
      'phBest',
      'gems',
      'updatedAt'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }
  return sheet;
}

function doGet(e) {
  const sheet = ensureSheet();
  // Можно также передать запись рекордов через GET-параметр ?action=save&payload=... (обходит любые CORS)
  if (e && e.parameter && e.parameter.action === 'save' && e.parameter.payload) {
    try {
      const data = JSON.parse(e.parameter.payload);
      upsertPlayerRow(sheet, data);
    } catch (err) {}
  }

  const rows = sheet.getDataRange().getValues();
  const players = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0] && !r[1]) continue;
    players.push({
      userId: String(r[0]),
      name: String(r[1] || 'Игрок'),
      totalPts: Number(r[2]) || 0,
      rrBest: Number(r[3]) || 0,
      ssBest: Number(r[4]) || 0,
      tdBest: Number(r[5]) || 0,
      bsBest: Number(r[6]) || 0,
      phBest: Number(r[7]) || 0,
      gems: Number(r[8]) || 0,
      updatedAt: String(r[9] || '')
    });
  }

  players.sort((a, b) => b.totalPts - a.totalPts);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, players }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = ensureSheet();
  try {
    const data = JSON.parse(e.postData.contents);
    upsertPlayerRow(sheet, data);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function upsertPlayerRow(sheet, d) {
  const userId = String(d.userId || d.name || 'anon');
  const name = String(d.name || 'Игрок');
  const rrBest = Number(d.rrBest) || 0;
  const ssBest = Number(d.ssBest) || 0;
  const tdBest = Number(d.tdBest) || 0;
  const bsBest = Number(d.bsBest) || 0;
  const phBest = Number(d.phBest) || 0;
  const gems = Number(d.gems) || 0;
  const totalPts = rrBest + ssBest * 10 + tdBest * 5 + bsBest * 8 + phBest * 10;
  const nowStr = new Date().toISOString();

  const rows = sheet.getDataRange().getValues();
  let foundRowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === userId) {
      foundRowIndex = i + 1;
      break;
    }
  }

  if (foundRowIndex > 0) {
    const prev = rows[foundRowIndex - 1];
    const bestRR = Math.max(Number(prev[3]) || 0, rrBest);
    const bestSS = Math.max(Number(prev[4]) || 0, ssBest);
    const bestTD = Math.max(Number(prev[5]) || 0, tdBest);
    const bestBS = Math.max(Number(prev[6]) || 0, bsBest);
    const bestPH = Math.max(Number(prev[7]) || 0, phBest);
    const bestTotal = bestRR + bestSS * 10 + bestTD * 5 + bestBS * 8 + bestPH * 10;

    sheet.getRange(foundRowIndex, 1, 1, 10).setValues([[
      userId,
      name,
      bestTotal,
      bestRR,
      bestSS,
      bestTD,
      bestBS,
      bestPH,
      gems,
      nowStr
    ]]);
  } else {
    sheet.appendRow([
      userId,
      name,
      totalPts,
      rrBest,
      ssBest,
      tdBest,
      bsBest,
      phBest,
      gems,
      nowStr
    ]);
  }
}
