/**
 * B+T Judging: receives scores from the judging app and saves them in this Google Sheet.
 * Also stores the Admin settings (rubric categories, Impact Prize categories, teams, tracks).
 *
 * Setup: paste this whole file into Extensions > Apps Script, then
 * Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * After changing this file: Deploy > Manage deployments > pencil icon > Version: New version > Deploy.
 *
 * One row per judge per team. If a judge edits a team's score, that row is updated (not duplicated).
 * The score columns are titled with your category names from the Admin tab (up to 10 categories).
 */

// Must match the passwords in index.html.
const PANEL_PASSWORD = 'jam2026';   // needed to reset (clear) all scores
const ADMIN_PASSWORD = 'adminjam';  // needed to change the rubric and teams

const SHEET_NAME = 'Scores';
const MAX_CATEGORIES = 10;

// Column layout. The app reads columns by these names; the score columns' titles
// in row 1 show your category names instead of "Score 1", "Score 2", ...
const HEADERS = [
  'Last updated', 'Judge', 'Team', 'Track', 'Gut check',
  'Total', 'Max total', 'Impact Prize total', 'Impact Prize max',
  ...Array.from({ length: MAX_CATEGORIES }, (_, i) => 'Score ' + (i + 1)),
  'Keep doing', 'Work on', 'What worked', 'What to improve',
  'Team ID', 'Device ID', 'Scores JSON'
];
const col = name => HEADERS.indexOf(name);

// The previous layout (before category names, Track and Impact Prize columns)
const OLD_HEADERS = [
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
    const slots = Array.isArray(d.slots) ? d.slots : (d.scores || []);   // older app versions send 5 scores
    const scoreCells = Array.from({ length: MAX_CATEGORIES }, (_, i) => slots[i] === undefined ? '' : slots[i]);
    // Track and Impact Prize come from the Admin setup, so they're right even if a judge's app is out of date
    const extra = teamExtras(getConfig(), teamId, d.scoresJson);
    const row = [
      new Date(), d.judge, d.team, extra.track || d.track || '', d.gut,
      d.total, d.maxTotal || '', extra.prizeTotal, extra.prizeMax,
      ...scoreCells,
      d.keep, d.work, d.best, d.improve,
      teamId, d.device, d.scoresJson || ''
    ];
    if (Array.isArray(d.slotNames)) setScoreTitles(sheet, d.slotNames);

    // Update this judge's existing row for this team, if there is one
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][col('Device ID')]) === String(d.device) && String(data[i][col('Team ID')]) === teamId) {
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
  return reply({ ok: true, rows: rows, config: getConfig(), resetAt: Number(PropertiesService.getScriptProperties().getProperty('resetAt') || 0) });
}

function getConfig() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('config') || 'null'); } catch (e) { return null; }
}

// Admin tab: save the rubric categories and teams, and retitle the score columns.
function saveConfig(key, config) {
  if (String(key || '') !== ADMIN_PASSWORD) return reply({ ok: false, error: 'wrong-password' });
  if (!config || !Array.isArray(config.categories) || !Array.isArray(config.teams)) return reply({ ok: false, error: 'bad-config' });
  PropertiesService.getScriptProperties().setProperty('config', JSON.stringify(config));
  const sheet = getSheet();
  setScoreTitles(sheet, sheetCategories(config).map(categoryLabel));
  refreshTeamColumns(sheet, config);
  return reply({ ok: true });
}

// A team's track and Impact Prize total/max, from the Admin setup and the judge's scores
function teamExtras(config, teamId, scoresJson) {
  const out = { track: '', prizeTotal: '', prizeMax: '' };
  if (!config) return out;
  const team = config.teams.find(t => String(t.id) === String(teamId));
  if (!team) return out;
  out.track = team.track || '';
  const prizeCats = config.categories.filter(c => c.prize);
  if (team.prize && prizeCats.length) {
    let scores = {};
    try { scores = JSON.parse(scoresJson || '') || {}; } catch (e) {}
    out.prizeTotal = prizeCats.reduce((a, c) => a + (Number(scores[c.id]) || 0), 0);
    out.prizeMax = prizeCats.reduce((a, c) => a + Number(c.max), 0);
  }
  return out;
}

// After an Admin save: fill in Track and Impact Prize for rows already in the Sheet
function refreshTeamColumns(sheet, config) {
  const last = sheet.getLastRow();
  if (last < 2) return;
  const data = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  let changed = false;
  data.forEach(r => {
    const x = teamExtras(config, r[col('Team ID')], r[col('Scores JSON')]);
    const vals = [[col('Track'), x.track], [col('Impact Prize total'), x.prizeTotal], [col('Impact Prize max'), x.prizeMax]];
    vals.forEach(([i, v]) => { if (String(r[i]) !== String(v)) { r[i] = v; changed = true; } });
  });
  if (changed) {
    sheet.getRange(2, col('Track') + 1, data.length, 1).setValues(data.map(r => [r[col('Track')]]));
    sheet.getRange(2, col('Impact Prize total') + 1, data.length, 2).setValues(data.map(r => [r[col('Impact Prize total')], r[col('Impact Prize max')]]));
  }
}

// Score column order: rubric categories first, then Impact Prize categories (same as the app)
function sheetCategories(config) {
  const list = (config && config.categories) || [];
  return list.filter(c => !c.prize).concat(list.filter(c => c.prize)).slice(0, MAX_CATEGORIES);
}

function categoryLabel(c) {
  const name = String(c.name || '').trim();
  return c.prize ? (name ? 'Impact Prize: ' + name : 'Impact Prize') : (name || 'Category');
}

// Row 1 titles for the score columns: your category names, in Admin order
function setScoreTitles(sheet, names) {
  const first = col('Score 1') + 1;
  const titles = Array.from({ length: MAX_CATEGORIES }, (_, i) => names[i] ? String(names[i]) : '(unused)');
  const current = sheet.getRange(1, first, 1, MAX_CATEGORIES).getValues()[0].map(String);
  if (current.join('|') !== titles.join('|')) sheet.getRange(1, first, 1, MAX_CATEGORIES).setValues([titles]);
}

// Clears every score (keeps the Admin settings). First copies the scores to a backup tab.
function resetAll(key) {
  if (String(key || '') !== PANEL_PASSWORD) return reply({ ok: false, error: 'wrong-password' });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getSheet();
  const last = sheet.getLastRow();
  if (last > 1) {
    sheet.copyTo(ss).setName('Backup ' + stamp());
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
  if (sheet && sheet.getLastRow() > 0 && String(sheet.getRange(1, 4).getValue()) === 'Gut check') {
    sheet = moveToNewLayout(ss, sheet);   // older layout: copy it over once
  }
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    const config = getConfig();
    if (config) setScoreTitles(sheet, sheetCategories(config).map(categoryLabel));
  }
  return sheet;
}

// One-time move from the older layout: the old tab is kept as a backup, and its rows are copied over.
function moveToNewLayout(ss, oldSheet) {
  const data = oldSheet.getDataRange().getValues();
  oldSheet.setName('Scores (old layout) ' + stamp());
  const sheet = ss.insertSheet(SHEET_NAME, 0);
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  const config = getConfig();
  const order = config ? sheetCategories(config).map(c => String(c.id)) : ['1', '2', '3', '4', '5'];
  if (config) setScoreTitles(sheet, sheetCategories(config).map(categoryLabel));
  const old = name => OLD_HEADERS.indexOf(name);
  const rows = data.slice(1).filter(r => r[old('Judge')] !== '').map(r => {
    let scores = {};
    try { scores = JSON.parse(r[old('Scores JSON')] || '') || {}; } catch (e) {}
    if (!Object.keys(scores).length) for (let c = 1; c <= 5; c++) if (r[old('Category ' + c)] !== '') scores[c] = r[old('Category ' + c)];
    const teamId = String(r[old('Team ID')] || String(r[old('Team')]).replace(/\D/g, ''));
    const extra = teamExtras(config, teamId, JSON.stringify(scores));
    return [
      r[old('Last updated')], r[old('Judge')], r[old('Team')], extra.track, r[old('Gut check')],
      r[old('Total')], r[old('Max total')], extra.prizeTotal, extra.prizeMax,
      ...Array.from({ length: MAX_CATEGORIES }, (_, i) => order[i] !== undefined && scores[order[i]] !== undefined ? scores[order[i]] : ''),
      r[old('Keep doing')], r[old('Work on')], r[old('What worked')], r[old('What to improve')],
      teamId, r[old('Device ID')], JSON.stringify(scores)
    ];
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
  return sheet;
}

function stamp() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
