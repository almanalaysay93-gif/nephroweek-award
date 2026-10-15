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

// Voting closes at 12:00 noon Manila time on 19 October 2026. The server clock decides.
var CLOSE_AT = new Date('2026-10-19T12:00:00+08:00');
var CLOSE_LABEL = '19 October 2026, 12:00 noon Manila time';
// Winners are posted on the landing page at 12:00 noon Manila time on 23 October 2026.
var ANNOUNCE_AT = new Date('2026-10-23T12:00:00+08:00');
var ANNOUNCE_LABEL = '23 October 2026, 12:00 noon Manila time';

// Criterion weights per scored award, in the order of js/awards.js.
var WEIGHTS = {
  'hd-nurse': [30, 25, 20, 15, 10], 'pd-nurse': [30, 25, 20, 15, 10], 'nephro-nurse': [30, 25, 20, 15, 10],
  'team-leader': [25, 25, 20, 15, 15], 'team-player': [30, 25, 20, 15, 10], 'kidney-advocacy': [30, 25, 20, 15, 10],
  'rising-star': [25, 25, 20, 15, 15], 'na-outstanding': [30, 25, 20, 15, 10], 'na-lifetime': [30, 25, 20, 15, 10],
  'na-patient-care': [30, 25, 20, 15, 10], 'na-technical': [30, 25, 20, 15, 10], 'na-extra-miler': [30, 25, 20, 15, 10]
};

var TABS = {
  Nominations: ['Timestamp', 'Award', 'Nominee', 'Nominator', 'Reason'],
  Scores: ['Timestamp', 'Award', 'Nominee', 'Evaluator', 'Ratings'],
  Settings: ['Key', 'Value'],
  Photos: ['Staff name', 'Drive file ID', 'Override name']
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
    if (isClosed_(Date.now())) return closed_();
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
      winners: winners_(),
      photos: publicPhotos_(),
      closeLog: settingValue_('closeLog')
    };
  },

  score: function (req) {
    if (!pinOk_(req.pin)) return fail_('Wrong PIN.');
    if (isClosed_(Date.now())) return closed_();
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
      if (norm_(list[i].nominee) === norm_(r[2])) { list[i].count++; return; }
    }
    list.push({ nominee: String(r[2]), count: 1 });
  });
  // Vote counts stay private until the committee publishes.
  Object.keys(AWARDS).forEach(function (id) {
    if (AWARDS[id][0] === 'votes') nominees[id].forEach(function (r) { r.count = null; });
  });
  return { ok: true, nominees: nominees, winners: winners_(), photos: publicPhotos_(), closeAt: CLOSE_AT.toISOString(), closed: isClosed_(Date.now()), announceAt: ANNOUNCE_AT.toISOString(), announced: isAnnounced_(Date.now()) };
}

// Photo links by normalized name. The override name, when set, is the key.
// Only the Drive file ID is returned, never a name pair or any other staff data.
function publicPhotos_() {
  var map = {};
  rows_('Photos').forEach(function (r) {
    var id = String(r[1] || '').trim();
    var key = norm_(r[2] || r[0]);
    if (id && key && !map[key]) map[key] = id;
  });
  return map;
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

// ---- Automatic close (see docs/plans/2026-10-14-voting-close-design.md) ----

function isClosed_(nowMs) { return nowMs >= CLOSE_AT.getTime(); }
function isAnnounced_(nowMs) { return nowMs >= ANNOUNCE_AT.getTime(); }
function closed_() { return fail_('Voting is closed. Winners are announced on ' + ANNOUNCE_LABEL + '.'); }

function settingValue_(key) {
  var rows = rows_('Settings');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) return parse_(rows[i][1], null);
  }
  return null;
}

function logClose_(status, message) {
  setSetting_('closeLog', JSON.stringify({ at: new Date().toISOString(), status: status, message: message }));
}

// Same rules as js/scoring.js. tests/close.test.mjs runs both on shared cases.
function round2_(n) { return Math.round(n * 100) / 100; }

function weightedTotal_(ratings, weights) {
  if (!Array.isArray(ratings) || ratings.length !== weights.length) return null;
  var sum = 0;
  for (var i = 0; i < ratings.length; i++) {
    var r = ratings[i];
    if (!(r === Math.floor(r) && r >= 1 && r <= 5)) return null;
    sum += (r / 5) * weights[i];
  }
  return round2_(sum);
}

function withRanks_(rows, key) {
  var rank = 0;
  var prev;
  rows.forEach(function (row, i) {
    var v = key(row);
    if (v === null || v === undefined) { row.rank = null; return; }
    if (v !== prev) { rank = i + 1; prev = v; }
    row.rank = rank;
  });
  return rows;
}

// nominations: [{awardId, nominee, nominator}], scores: [{awardId, nominee, evaluator, ratings}]
function rankAward_(id, nominations, scores) {
  var award = AWARDS[id];
  var rows;
  if (award[0] === 'votes') {
    var seen = new Map();
    var counts = new Map();
    nominations.forEach(function (n) {
      if (n.awardId !== id) return;
      var voter = norm_(n.nominator);
      if (seen.has(voter)) return;
      seen.set(voter, true);
      counts.set(n.nominee, (counts.get(n.nominee) || 0) + 1);
    });
    rows = [];
    counts.forEach(function (votes, nominee) { rows.push({ nominee: nominee, value: votes }); });
    rows.sort(function (a, b) { return b.value - a.value || a.nominee.localeCompare(b.nominee); });
    return withRanks_(rows, function (r) { return r.value; });
  }
  var names = [];
  var keys = {};
  nominations.forEach(function (n) {
    var key = norm_(n.nominee);
    if (n.awardId === id && !keys[key]) { keys[key] = true; names.push(n.nominee); }
  });
  rows = names.map(function (nominee) {
    var totals = [];
    scores.forEach(function (s) {
      if (s.awardId === id && norm_(s.nominee) === norm_(nominee)) {
        var t = weightedTotal_(s.ratings, WEIGHTS[id]);
        if (t !== null) totals.push(t);
      }
    });
    var avg = totals.length
      ? round2_(totals.reduce(function (a, b) { return a + b; }, 0) / totals.length)
      : null;
    return { nominee: nominee, value: avg };
  });
  rows.sort(function (a, b) {
    var av = a.value === null ? -1 : a.value;
    var bv = b.value === null ? -1 : b.value;
    return bv - av || a.nominee.localeCompare(b.nominee);
  });
  return withRanks_(rows, function (r) { return r.value; });
}

// Winners for every award that has one: [{nominee, value}] for each rank-1 row.
function computeWinners_() {
  var nominations = rows_('Nominations').map(function (r) {
    return { awardId: String(r[1]), nominee: String(r[2]), nominator: String(r[3]) };
  });
  var scores = rows_('Scores').map(function (r) {
    return { awardId: String(r[1]), nominee: String(r[2]), evaluator: String(r[3]), ratings: parse_(r[4], []) };
  });
  var out = {};
  Object.keys(AWARDS).forEach(function (id) {
    var top = rankAward_(id, nominations, scores).filter(function (r) { return r.rank === 1; });
    if (top.length) out[id] = top.map(function (r) { return { nominee: r.nominee, value: r.value }; });
  });
  return out;
}

// Time trigger handler. Posts winners for awards not yet published; keeps existing ones.
function closeAndPublish() {
  try {
    return locked_(function () {
      if (!isAnnounced_(Date.now())) {
        logClose_('skipped', 'Ran before the announcement time. Nothing posted.');
        return fail_('Too early.');
      }
      var existing = winners_() || {};
      var computed = computeWinners_();
      var added = [];
      Object.keys(computed).forEach(function (id) {
        if (existing[id]) return;
        existing[id] = computed[id];
        added.push(id);
      });
      setSetting_('winners', JSON.stringify(existing));
      logClose_('ok', 'Posted ' + added.length + ' award(s): ' + (added.join(', ') || 'none') + '.');
      // A certificate failure must not undo the posted winners.
      try { makeAndSendCertificates_(); } catch (err) { logClose_('certificates', String(err)); }
      return { ok: true, added: added };
    });
  } catch (err) {
    logClose_('error', String(err));
    throw err;
  }
}

// Run from the Apps Script editor. Returns what closeAndPublish would post. Writes nothing.
function previewClose() {
  var preview = computeWinners_();
  Logger.log(JSON.stringify(preview));
  return preview;
}

// Run once from the Apps Script editor. Replaces any earlier close trigger.
function installCloseTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'closeAndPublish') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('closeAndPublish').timeBased().at(ANNOUNCE_AT).create();
}

// ---- Certificates of award (editable Google Slides, one per winner) ----

var CERT_EVENT = 'Nephrology Nurses Week 2026';
var CERT_DATE = '23rd day of October, 2026';
var CERT_RECIPIENT = 'nncluster@spmcdvo.net';
var CERT_SIGNERS = [
  { name: 'Janie Bib J. Martel, RN', title: 'Clinical Coordinator/Nurse IV' },
  { name: 'Darwin E. Peñas, RN, MAN', title: 'Department Head' }
];
// Award titles as shown on the site (js/awards.js).
var AWARD_TITLES = {
  'hd-nurse': 'Outstanding Hemodialysis Nurse', 'pd-nurse': 'Outstanding Peritoneal Dialysis Nurse',
  'nephro-nurse': 'Outstanding Nephrology Nurse', 'team-leader': 'Best Team Leader',
  'team-player': 'Best Team Player', 'kidney-advocacy': 'Kidney Health Advocacy Recognition',
  'rising-star': 'Rising Star', 'patient-choice': 'Patient Choice', 'peer-choice': 'Peer Choice',
  'na-outstanding': 'Outstanding Dialysis Technician', 'na-lifetime': 'Lifetime Dedication to Service',
  'na-patient-care': 'Excellence in Patient Care', 'na-technical': 'Technical Excellence',
  'na-extra-miler': 'Extra Miler'
};
// The site colours from css/tokens.css.
var CERT_COLORS = { navy: '#123d70', ink: '#0c2a4e', gold: '#cd9b2b', goldDeep: '#94691a', goldLight: '#eccb72', soft: '#3a5270', tint: '#f2f7fd' };

// Run once from the editor. Builds the one-slide template and stores its ID in Settings.
function createCertificateTemplate() {
  var pres = SlidesApp.create('Certificate of Award (template)');
  var slide = pres.getSlides()[0];
  slide.getPageElements().forEach(function (e) { e.remove(); });
  var c = CERT_COLORS;
  certBox_(slide, 0, 0, 720, 405, c.tint, null, 0);
  certBox_(slide, 18, 18, 684, 369, null, c.gold, 3);
  certBox_(slide, 26, 26, 668, 353, null, c.goldLight, 1);
  certText_(slide, 'CERTIFICATE OF AWARD', 60, 52, 600, 44, 30, c.navy, true, 'Fraunces');
  certText_(slide, '{{EVENT}}', 60, 98, 600, 22, 14, c.soft, false, 'Instrument Sans');
  certText_(slide, 'This certificate is presented to', 60, 128, 600, 22, 13, c.soft, false, 'Instrument Sans');
  certText_(slide, '{{NAME}}', 60, 150, 600, 52, 34, c.ink, true, 'Fraunces');
  certBox_(slide, 260, 210, 200, 2, c.gold, null, 0);
  certText_(slide, 'for {{AWARD}}', 60, 222, 600, 32, 20, c.goldDeep, true, 'Fraunces');
  certText_(slide, 'in recognition of outstanding service during {{EVENT}}.', 60, 256, 600, 24, 13, c.soft, false, 'Instrument Sans');
  certText_(slide, 'Given this {{DATE}}.', 60, 282, 600, 22, 12, c.soft, false, 'Instrument Sans');
  [[110], [410]].forEach(function (pos, i) {
    certBox_(slide, pos[0], 322, 200, 1, c.navy, null, 0);
    certText_(slide, CERT_SIGNERS[i].name, pos[0] - 20, 328, 240, 20, 12, c.ink, true, 'Instrument Sans');
    certText_(slide, CERT_SIGNERS[i].title, pos[0] - 20, 348, 240, 18, 10, c.soft, false, 'Instrument Sans');
  });
  pres.saveAndClose();
  setSetting_('certTemplateId', pres.getId());
  return pres.getUrl();
}

function certBox_(slide, x, y, w, h, fill, border, weight) {
  var shape = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, w, h);
  if (fill) shape.getFill().setSolidFill(fill); else shape.getFill().setTransparent();
  if (border) { shape.getBorder().getLineFill().setSolidFill(border); shape.getBorder().setWeight(weight); } else shape.getBorder().setTransparent();
  return shape;
}

function certText_(slide, text, x, y, w, h, size, color, bold, font) {
  var box = slide.insertTextBox(text, x, y, w, h);
  var range = box.getText();
  range.getTextStyle().setFontFamily(font).setFontSize(size).setBold(bold).setForegroundColor(color);
  range.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  return box;
}

// Same rule as displayName() in js/ui.js: "CATOTO, Genevieve U." becomes "Genevieve U. Catoto".
function certName_(listName) {
  var parts = String(listName).split(/,\s*/);
  if (parts.length < 2) return String(listName);
  var last = parts[0].toLowerCase().replace(/(^|[\s-])\p{L}/gu, function (m) { return m.toUpperCase(); });
  return parts[1] + ' ' + last;
}

// One recipient per winner. The key keeps a winner from getting a second certificate.
function certificateRecipients_(winners) {
  var out = [];
  Object.keys(AWARD_TITLES).forEach(function (id) {
    (winners[id] || []).forEach(function (w) {
      out.push({ key: id + '|' + norm_(w.nominee), award: AWARD_TITLES[id], name: certName_(w.nominee) });
    });
  });
  return out;
}

// Makes a certificate for each new winner, then emails the ones not yet sent.
// Safe to run again: made certificates and sent emails are recorded in Settings.
function makeAndSendCertificates_() {
  var templateId = settingValue_('certTemplateId');
  if (!templateId) return fail_('The certificate template is not set. Run createCertificateTemplate first.');
  var made = settingValue_('certificates') || {};
  var sent = settingValue_('certificatesSent') || [];
  var fresh = certificateRecipients_(winners_() || {}).filter(function (r) { return !made[r.key]; });
  fresh.forEach(function (r) {
    var copy = DriveApp.getFileById(templateId).makeCopy('Certificate - ' + r.name + ' - ' + r.award);
    var pres = SlidesApp.openById(copy.getId());
    pres.replaceAllText('{{EVENT}}', CERT_EVENT);
    pres.replaceAllText('{{NAME}}', r.name);
    pres.replaceAllText('{{AWARD}}', r.award);
    pres.replaceAllText('{{DATE}}', CERT_DATE);
    pres.saveAndClose();
    var pdf = DriveApp.createFile(copy.getAs(MimeType.PDF));
    made[r.key] = { award: r.award, name: r.name, slideUrl: copy.getUrl(), pdfId: pdf.getId() };
  });
  // Save before sending, so a failed email does not make duplicate certificates on the next run.
  if (fresh.length) setSetting_('certificates', JSON.stringify(made));
  var pending = Object.keys(made).filter(function (k) { return sent.indexOf(k) < 0; });
  if (!pending.length) return { ok: true, sent: 0 };
  MailApp.sendEmail({
    to: CERT_RECIPIENT,
    subject: 'Certificates of award: ' + CERT_EVENT,
    body: 'Editable certificates (Google Slides) with PDF copies attached.\n\n' + pending.map(function (k) {
      return made[k].award + ' - ' + made[k].name + '\n' + made[k].slideUrl;
    }).join('\n\n'),
    attachments: pending.map(function (k) { return DriveApp.getFileById(made[k].pdfId).getBlob(); })
  });
  setSetting_('certificatesSent', JSON.stringify(sent.concat(pending)));
  return { ok: true, sent: pending.length };
}

// Button in the sheet: Awards > Send certificates now.
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Awards').addItem('Send certificates now', 'sendCertificatesNow').addToUi();
}

function sendCertificatesNow() {
  var result = locked_(makeAndSendCertificates_);
  SpreadsheetApp.getUi().alert(result.ok ? 'Certificates sent: ' + result.sent + '.' : result.error);
}
