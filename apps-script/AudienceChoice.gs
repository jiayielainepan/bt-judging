/**
 * B+T JAM Finale: Audience Choice backend
 * Paste this whole file into Extensions → Apps Script of the Google Sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 *
 * The Sheet tabs (Teams, Ratings, Visits, Settings) are created automatically
 * the first time the web app is used. You can rename teams in the Teams tab
 * or from the organizer page.
 */

const ORGANIZER_PIN = 'CHANGE_ME';   // set your real PIN in the deployed script only; this repo is public
const K = 5;                    // adjusted average: blend each team with K "typical" ratings
const STARTING_TEAMS = 10;      // Team A … Team J

/* ---------------- entry points ---------------- */

function doGet(e) { return handle_(e && e.parameter ? e.parameter : {}); }

function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(p);
}

function handle_(p) {
  try {
    ensureSetup_();
    switch (p.action) {
      // audience
      case 'team':      return out_(getTeam_(p.code));
      case 'scan':      return out_(recordScan_(p));
      case 'rate':      return out_(rate_(p));
      // organizer (PIN required)
      case 'results':   checkPin_(p.pin); return out_(results_());
      case 'setOpen':   checkPin_(p.pin); setSetting_('Voting open', !!p.open); return out_(results_());
      case 'rename':    checkPin_(p.pin); renameTeam_(p.code, p.name); return out_(results_());
      case 'addTeam':   checkPin_(p.pin); addTeam_(); return out_(results_());
      case 'removeTeam':checkPin_(p.pin); removeTeam_(p.code); return out_(results_());
      case 'clear':     checkPin_(p.pin); clearVotes_(); return out_(results_());
      default: throw new Error('Unknown action');
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function out_(obj) {
  if (obj.ok === undefined) obj.ok = true;
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- sheet helpers ---------------- */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function tab_(name, headers) {
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(sh) {
  const v = sh.getDataRange().getValues();
  return v.slice(1);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function newCode_() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

let setupDone_ = false;
function ensureSetup_() {
  if (setupDone_) return;
  if (ss_().getSheetByName('Settings')) { setupDone_ = true; return; }
  withLock_(function () {
    if (ss_().getSheetByName('Settings')) return;
    const teams = tab_('Teams', ['Code (do not edit)', 'Team name']);
    if (teams.getLastRow() < 2) {
      for (let i = 0; i < STARTING_TEAMS; i++) teams.appendRow([newCode_(), 'Team ' + String.fromCharCode(65 + i)]);
    }
    tab_('Ratings', ['Updated', 'Device', 'Team code', 'Team name', 'Would pay (1-3)', 'Demo (1-3)']);
    tab_('Visits', ['Time', 'Device', 'Team code']);
    const st = tab_('Settings', ['Setting', 'Value']);
    st.appendRow(['Voting open', true]);
  });
  setupDone_ = true;
}

function teams_() {
  return rows_(tab_('Teams', [])).filter(function (r) { return r[0]; })
    .map(function (r) { return { code: String(r[0]), name: String(r[1] || '') }; });
}

function getSetting_(key) {
  const r = rows_(tab_('Settings', [])).filter(function (r) { return r[0] === key; })[0];
  return r ? r[1] : null;
}

function setSetting_(key, value) {
  withLock_(function () {
    const sh = tab_('Settings', []);
    const v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) {
      if (v[i][0] === key) { sh.getRange(i + 1, 2).setValue(value); return; }
    }
    sh.appendRow([key, value]);
  });
}

function isOpen_() {
  const v = getSetting_('Voting open');
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function checkPin_(pin) {
  if (String(pin) !== ORGANIZER_PIN) throw new Error('Wrong PIN');
}

function cleanDevice_(d) {
  d = String(d || '');
  if (!/^[a-zA-Z0-9-]{6,64}$/.test(d)) throw new Error('Bad device');
  return d;
}

function findTeam_(code) {
  const t = teams_().filter(function (t) { return t.code === String(code || ''); })[0];
  if (!t) throw new Error('Team not found');
  return t;
}

/* ---------------- audience actions ---------------- */

function getTeam_(code) {
  const t = findTeam_(code);
  return { team: t, open: isOpen_(), round: String(getSetting_('Round') || '1') };
}

function recordScan_(p) {
  const t = findTeam_(p.code);
  const device = cleanDevice_(p.device);
  withLock_(function () { tab_('Visits', []).appendRow([new Date(), device, t.code]); });
  return {};
}

function rate_(p) {
  const t = findTeam_(p.code);
  const device = cleanDevice_(p.device);
  const q1 = Number(p.q1), q2 = Number(p.q2);
  if ([1, 2, 3].indexOf(q1) < 0 || [1, 2, 3].indexOf(q2) < 0) throw new Error('Bad answer');
  if (!isOpen_()) throw new Error('Voting is closed');
  withLock_(function () {
    const sh = tab_('Ratings', []);
    const v = sh.getDataRange().getValues();
    const row = [new Date(), device, t.code, t.name, q1, q2];
    for (let i = 1; i < v.length; i++) {
      if (v[i][1] === device && v[i][2] === t.code) {   // same phone, same team: replace
        sh.getRange(i + 1, 1, 1, row.length).setValues([row]);
        return;
      }
    }
    sh.appendRow(row);
  });
  return { saved: true };
}

/* ---------------- organizer actions ---------------- */

function results_() {
  const teams = teams_();
  const codes = teams.map(function (t) { return t.code; });
  const ratings = rows_(tab_('Ratings', [])).filter(function (r) { return codes.indexOf(r[2]) > -1; });
  const visits = rows_(tab_('Visits', []));
  const score = function (r) { return (Number(r[4]) + Number(r[5])) / 2; };

  const overall = ratings.length
    ? ratings.reduce(function (a, r) { return a + score(r); }, 0) / ratings.length : 2;

  const rows = teams.map(function (t) {
    const rs = ratings.filter(function (r) { return r[2] === t.code; });
    const sum = rs.reduce(function (a, r) { return a + score(r); }, 0);
    const n = rs.length;
    const visitors = {};
    visits.forEach(function (v) { if (v[2] === t.code) visitors[v[1]] = true; });
    return {
      code: t.code, name: t.name, ratings: n, visits: Object.keys(visitors).length,
      pay: n ? rs.reduce(function (a, r) { return a + Number(r[4]); }, 0) / n : null,
      demo: n ? rs.reduce(function (a, r) { return a + Number(r[5]); }, 0) / n : null,
      raw: n ? sum / n : null,
      adjusted: (sum + K * overall) / (n + K)
    };
  });
  rows.sort(function (a, b) { return b.adjusted - a.adjusted || b.ratings - a.ratings; });

  const phones = {};
  ratings.forEach(function (r) { phones[r[1]] = true; });

  return {
    open: isOpen_(), k: K, overall: overall,
    totalRatings: ratings.length, phones: Object.keys(phones).length,
    teams: teams, rows: rows, updated: new Date().toISOString()
  };
}

function renameTeam_(code, name) {
  findTeam_(code);
  name = String(name || '').trim().slice(0, 60);
  if (!name) throw new Error('Name is empty');
  withLock_(function () {
    const sh = tab_('Teams', []);
    const v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (v[i][0] === code) sh.getRange(i + 1, 2).setValue(name);
  });
}

function addTeam_() {
  withLock_(function () {
    const n = teams_().length;
    tab_('Teams', []).appendRow([newCode_(), 'Team ' + (n < 26 ? String.fromCharCode(65 + n) : n + 1)]);
  });
}

function removeTeam_(code) {
  findTeam_(code);
  if (teams_().length <= 2) throw new Error('Keep at least 2 teams');
  withLock_(function () {
    const sh = tab_('Teams', []);
    const v = sh.getDataRange().getValues();
    for (let i = v.length - 1; i >= 1; i--) if (v[i][0] === code) sh.deleteRows(i + 1, 1);
  });
}

function clearVotes_() {
  // New round: phones used for testing forget their old ratings.
  setSetting_('Round', String(Number(getSetting_('Round') || 1) + 1));
  withLock_(function () {
    ['Ratings', 'Visits'].forEach(function (name) {
      const sh = tab_(name, []);
      const last = sh.getLastRow();
      // Sheets won't delete every row under a frozen header, so keep row 2 and blank it.
      if (last > 2) sh.deleteRows(3, last - 2);
      if (last > 1) sh.getRange(2, 1, 1, sh.getLastColumn()).clearContent();
    });
  });
}
