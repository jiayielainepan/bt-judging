/**
 * B+T Judging: receives scores from the judging app and saves them in this Google Sheet.
 *
 * Setup: paste this whole file into Extensions > Apps Script, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * Copy the Web app URL (ends in /exec) into API_URL in index.html.
 *
 * One row per judge per team. If a judge edits a team's score, that row is updated (not duplicated).
 */

// Must match PANEL_PASSWORD in index.html. Needed to reset (clear) all scores.
const PANEL_PASSWORD = 'jam2026';

const SHEET_NAME = 'Scores';
const HEADERS = [
  'Last updated', 'Judge', 'Team', 'Gut check',
  'Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Total',
  'Keep doing', 'Work on', 'What worked', 'What to improve', 'Device ID'
];

// The app sends a score here when a judge taps Save.
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // one save at a time, so two judges saving together can't clash
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'reset') return resetAll(d.key);
    const sheet = getSheet();
    const row = [
      new Date(), d.judge, d.team, d.gut,
      ...d.scores, d.total,
      d.keep, d.work, d.best, d.improve, d.device
    ];

    // Update this judge's existing row for this team, if there is one
    const data = sheet.getDataRange().getValues();
    const teamCol = HEADERS.indexOf('Team');
    const deviceCol = HEADERS.indexOf('Device ID');
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][deviceCol]) === String(d.device) && String(data[i][teamCol]) === String(d.team)) {
        sheet.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return reply({ ok: true, updated: true });
      }
    }
    sheet.appendRow(row);
    return reply({ ok: true, added: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Returns every score (used by the panel and to restore a judge's progress).
// resetAt tells the app when the data was last reset, so phones can clear old scores.
function doGet() {
  const data = getSheet().getDataRange().getValues();
  const rows = data.slice(1).map(r => Object.fromEntries(HEADERS.map((h, i) => [h, r[i]])));
  return reply({ ok: true, rows: rows, resetAt: Number(PropertiesService.getScriptProperties().getProperty('resetAt') || 0) });
}

// Clears every score. First copies them to a backup tab, just in case.
function resetAll(key) {
  if (String(key || '') !== PANEL_PASSWORD) return reply({ ok: false, error: 'wrong-password' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet();
  const last = sheet.getLastRow();
  if (last > 1) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    sheet.copyTo(ss).setName('Backup ' + stamp);
    if (last === sheet.getMaxRows()) sheet.insertRowAfter(last);  // Sheets won't delete every unfrozen row
    sheet.deleteRows(2, last - 1);
  }
  const resetAt = Date.now();
  PropertiesService.getScriptProperties().setProperty('resetAt', String(resetAt));
  return reply({ ok: true, resetAt: resetAt });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
