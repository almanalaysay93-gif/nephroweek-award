/**
 * Nephrology Nurses Week 2026 Awards: data service.
 *
 * Setup:
 * 1. Create a Google Sheet. Open Extensions > Apps Script and paste this file.
 * 2. Project Settings > Script Properties: add COMMITTEE_PIN with a PIN of 8 characters or more.
 * 3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 * 4. Paste the /exec address into js/config.js.
 *
 * The sheet tabs are created on the first request.
 */

var AWARDS = {
  // id: [type, number of criteria]
  'hd-nurse': ['scored', 5], 'pd-nurse': ['scored', 5], 'nephro-nurse': ['scored', 5],
  'team-leader': ['scored', 5], 'team-player': ['scored', 5], 'kidney-advocacy': ['scored', 5],
  'rising-star': ['scored', 5], 'patient-choice': ['votes', 1], 'peer-choice': ['votes', 1],
  'na-outstanding': ['scored', 5], 'na-lifetime': ['scored', 5], 'na-patient-care': ['scored', 5],
  'na-technical': ['scored', 5], 'na-extra-miler': ['scored', 5]
};

var TABS = {
  Nominations: ['Timestamp', 'Award', 'Nominee', 'Nominator', 'Reason'],
  Scores: ['Timestamp', 'Award', 'Nominee', 'Evaluator', 'Ratings'],
  Settings: ['Key', 'Value']
};

function award_(id) {
  return Object.prototype.hasOwnProperty.call(AWARDS, id) ? AWARDS[id] : null;
}

function doPost(e) {
  var out;
  try {
    var req = JSON.parse(e.postData.contents);
    var handler = HANDLERS[req.action];
    out = handler ? handler(req) : { ok: false, error: 'Unknown action.' };
  } catch (err) {
    out = { ok: false, error: 'The request is not valid.' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify(publicView_())).setMimeType(ContentService.MimeType.JSON);
}

var HANDLERS = {
  state: function () { return publicView_(); },

  nominate: function (req) {
    var n = req.nomination || {};
    var award = award_(n.awardId);
    var nominee = clean_(n.nominee, 80);
    var nominator = clean_(n.nominator, 80);
    var reason = clean_(n.reason, 600);
    if (!award) return fail_('Choose an award.');
    if (!nominee) return fail_('Choose a nominee from the list.');
    if (!nominator) return fail_('Enter your name.');
    if (norm_(nominee) === norm_(nominator)) return fail_('You cannot nominate yourself.');
    if (award[0] === 'scored' && reason.length < 10) return fail_('Give a short reason (10 characters or more).');
    return locked_(function () {
      var published = winners_();
      if (published && published[n.awardId]) return fail_('This award is closed. The awardee is announced.');
      var rows = rows_('Nominations');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][1] === n.awardId && norm_(rows[i][3]) === norm_(nominator)) {
          return fail_(award[0] === 'votes'
            ? 'This name has already voted for this award.'
            : 'This name has already nominated for this award.');
        }
      }
      tab_('Nominations').appendRow([new Date(), n.awardId, safe_(nominee), safe_(nominator), safe_(reason)]);
      return publicView_();
    });
  },

  committee: function (req) {
    if (!pinOk_(req.pin)) return fail_('Wrong PIN.');
    return {
      ok: true,
      nominations: rows_('Nominations').map(function (r) {
        return { ts: iso_(r[0]), awardId: String(r[1]), nominee: String(r[2]), nominator: String(r[3]), reason: String(r[4]) };
      }),
      scores: rows_('Scores').map(function (r) {
        return { ts: iso_(r[0]), awardId: String(r[1]), nominee: String(r[2]), evaluator: String(r[3]), ratings: parse_(r[4], []) };
      }),
      winners: winners_()
    };
  },

  score: function (req) {
    if (!pinOk_(req.pin)) return fail_('Wrong PIN.');
    var s = req.score || {};
    var award = award_(s.awardId);
    var evaluator = clean_(s.evaluator, 80);
    var nominee = clean_(s.nominee, 80);
    if (!award || award[0] !== 'scored') return fail_('This award is not scored.');
    if (!evaluator) return fail_('Enter your name.');
    if (!nominee) return fail_('Choose a nominee.');
    var r = s.ratings;
    var valid = Array.isArray(r) && r.length === award[1] && r.every(function (x) {
      return x === Math.floor(x) && x >= 1 && x <= 5;
    });
    if (!valid) return fail_('Rate every criterion from 1 to 5.');
    return locked_(function () {
      var sheet = tab_('Scores');
      var rows = rows_('Scores');
      var record = [new Date(), s.awardId, safe_(nominee), safe_(evaluator), JSON.stringify(r)];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i][1] === s.awardId && norm_(rows[i][2]) === norm_(nominee) && norm_(rows[i][3]) === norm_(evaluator)) {
          sheet.getRange(i + 2, 1, 1, record.length).setValues([record]);
          return { ok: true };
        }
      }
      sheet.appendRow(record);
      return { ok: true };
    });
  },

  publish: function (req) {
    if (!pinOk_(req.pin)) return fail_('Wrong PIN.');
    return locked_(function () {
      setSetting_('winners', req.winners ? JSON.stringify(req.winners) : '');
      return { ok: true };
    });
  }
};

// ---- Helpers ---------------------------------------------------------------

function publicView_() {
  var nominees = {};
  Object.keys(AWARDS).forEach(function (id) { nominees[id] = []; });
  rows_('Nominations').forEach(function (r) {
    var list = award_(r[1]) ? nominees[r[1]] : null;
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      if (list[i].nominee === String(r[2])) { list[i].count++; return; }
    }
    list.push({ nominee: String(r[2]), count: 1 });
  });
  // Vote counts stay private until the committee publishes.
  Object.keys(AWARDS).forEach(function (id) {
    if (AWARDS[id][0] === 'votes') nominees[id].forEach(function (r) { r.count = null; });
  });
  return { ok: true, nominees: nominees, winners: winners_() };
}

function pinOk_(pin) {
  var real = PropertiesService.getScriptProperties().getProperty('COMMITTEE_PIN');
  return !!real && String(pin || '') === real;
}

function tab_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(TABS[name]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rows_(name) {
  var sheet = tab_(name);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, TABS[name].length).getValues();
}

function winners_() {
  var rows = rows_('Settings');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'winners') return parse_(rows[i][1], null);
  }
  return null;
}

function setSetting_(key, value) {
  var sheet = tab_('Settings');
  var rows = rows_('Settings');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) { sheet.getRange(i + 2, 2).setValue(value); return; }
  }
  sheet.appendRow([key, value]);
}

function locked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function fail_(error) { return { ok: false, error: error }; }
function norm_(s) { return String(s === 0 ? '0' : s || '').replace(/^'/, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
function clean_(s, max) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, max); }
// A leading =, +, - or @ makes Sheets run the cell as a formula. The quote stops that.
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }
function iso_(d) { return d instanceof Date ? d.toISOString() : String(d); }
function parse_(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch (e) { return fallback; } }
