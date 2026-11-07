/**
 * B+T Judging: receives scores from the judging app and saves them in this Google Sheet.
 * Also stores the Admin settings (rubric categories and teams) so every judge's phone uses them.
 *
 * Setup: paste this whole file into Extensions > Apps Script, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * After changing this file: Deploy > Manage deployments > pencil icon > Version: New version > Deploy.
 *
 * One row per judge per team. If a judge edits a team's score, that row is updated (not duplicated).
 */

// Must match the passwords in index.html.
const PANEL_PASSWORD = 'jam2026';   // needed to reset (clear) all scores
const ADMIN_PASSWORD = 'adminjam';  // needed to change the rubric and teams

const SHEET_NAME = 'Scores';
const HEADERS = [
  'Last updated', 'Judge', 'Team', 'Gut check',
  'Category 1', 'Category 2', 'Category 3', 'Category 4', 'Category 5', 'Total',
  'Keep doing', 'Work on', 'What worked', 'What to improve', 'Device ID',
  'Team ID', 'Scores JSON', 'Max total'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // one save at a time, so two judges saving together can't clash
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'reset') return resetAll(d.key);
    if (d.action === 'config') return saveConfig(d.key, d.config);

    // A judge's score
    const sheet = getSheet();
    const teamId = String(d.teamId || String(d.team || '').replace(/\D/g, ''));
    const row = [
      new Date(), d.judge, d.team, d.gut,
      ...d.scores, d.total,
      d.keep, d.work, d.best, d.improve, d.device,
      teamId, d.scoresJson || '', d.maxTotal || ''
    ];

    // Update this judge's existing row for this team, if there is one
    const data = sheet.getDataRange().getValues();
    const col = name => HEADERS.indexOf(name);
    for (let i = 1; i < data.length; i++) {
      const sameJudge = String(data[i][col('Device ID')]) === String(d.device);
      const rowTeamId = String(data[i][col('Team ID')] || '');
      const sameTeam = rowTeamId ? rowTeamId === teamId : String(data[i][col('Team')]) === 'Team ' + teamId;
      if (sameJudge && sameTeam) {
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

// Returns every score, the Admin settings, and when data was last reset.
function doGet() {
  const data = getSheet().getDataRange().getValues();
  const rows = data.slice(1).map(r => Object.fromEntries(HEADERS.map((h, i) => [h, r[i]])));
  const props = PropertiesService.getScriptProperties();
  let config = null;
  try { config = JSON.parse(props.getProperty('config') || 'null'); } catch (e) {}
  return reply({ ok: true, rows: rows, config: config, resetAt: Number(props.getProperty('resetAt') || 0) });
}

// Admin tab: save the rubric categories and teams.
function saveConfig(key, config) {
  if (String(key || '') !== ADMIN_PASSWORD) return reply({ ok: false, error: 'wrong-password' });
  if (!config || !Array.isArray(config.categories) || !Array.isArray(config.teams)) return reply({ ok: false, error: 'bad-config' });
  PropertiesService.getScriptProperties().setProperty('config', JSON.stringify(config));
  return reply({ ok: true });
}

// Clears every score (keeps the Admin settings). First copies the scores to a backup tab.
function resetAll(key) {
  if (String(key || '') !== PANEL_PASSWORD) return reply({ ok: false, error: 'wrong-password' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet();
  const last = sheet.getLastRow();
  if (last > 1) {
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
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
  } else if (sheet.getLastColumn() < HEADERS.length) {
    // Older sheet: add the new column headers without touching the data
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  }
  return sheet;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
