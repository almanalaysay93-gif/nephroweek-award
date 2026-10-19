import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { AWARDS as JS_AWARDS, awardById } from '../js/awards.js';
import { rankAward } from '../js/scoring.js';

const CODE = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const VECTORS = JSON.parse(fs.readFileSync(new URL('./rank-vectors.json', import.meta.url), 'utf8'));
const PIN = 'long-pin-123';
const HEADERS = {
  Nominations: ['Timestamp', 'Award', 'Nominee', 'Nominator', 'Reason'],
  Scores: ['Timestamp', 'Award', 'Nominee', 'Evaluator', 'Ratings'],
  Settings: ['Key', 'Value'],
};

// A small stand-in for the Apps Script services the backend uses.
function makeBackend(initial = {}, options = {}) {
  const data = {};
  for (const name of Object.keys(HEADERS)) data[name] = [HEADERS[name].slice()];
  for (const [name, rows] of Object.entries(initial)) data[name] = rows.map((r) => r.slice());
  const triggers = [];
  const ctx = {};
  const sheet = (name) => {
    const rows = data[name];
    return {
      appendRow(r) { rows.push(r.slice()); },
      setFrozenRows() {},
      getLastRow() { return rows.length; },
      getRange(r, c, n = 1, w = 1) {
        return {
          getValues() {
            const out = [];
            for (let i = 0; i < n; i++) {
              const row = rows[r - 1 + i] || [];
              const o = [];
              for (let j = 0; j < w; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
              out.push(o);
            }
            return out;
          },
          setValues(vals) { vals.forEach((v, i) => { rows[r - 1 + i] = v.slice(); }); },
          setValue(v) { rows[r - 1] = rows[r - 1] || []; rows[r - 1][c - 1] = v; },
        };
      },
    };
  };
  const ss = {
    getSheetByName(name) { return data[name] ? sheet(name) : null; },
    insertSheet(name) { data[name] = []; return sheet(name); },
  };
  const files = new Map();
  const mails = [];
  let nextFile = 0;
  let mailAttempts = 0;
  let exports = 0;
  const pptxMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  function blob(type, name, size = 100) {
    return {
      type, name, size,
      setName(value) { this.name = value; return this; },
      setContentType(value) { this.type = value; return this; },
      getBytes() { return { length: this.size }; },
    };
  }
  function file(id) {
    const record = files.get(id);
    return {
      getId: () => id,
      getUrl: () => 'https://docs.google.com/presentation/d/' + id + '/edit',
      getMimeType: () => record ? record.type : options.templateMime || 'application/vnd.google-apps.presentation',
      makeCopy: (name) => {
        const key = 'slide-' + (++nextFile);
        files.set(key, { type: 'application/vnd.google-apps.presentation', name });
        return file(key);
      },
      getAs: (type) => blob(type, id + '.pdf'),
      getBlob: () => blob(record.type, record.name, record.size),
    };
  }
  Object.assign(ctx, {
    SpreadsheetApp: {
      openById: (id) => {
        assert.equal(id, '1zqhskKqPxgUXqWNMnGgQa_q1AnInZ7_Eyy0Tdlb4l50');
        return ss;
      },
      getActiveSpreadsheet: () => { throw new Error('Do not use the attached workbook for live data.'); },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === 'COMMITTEE_PIN' ? PIN : null) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType() { return t; } }) },
    Logger: { log() {} },
    DriveApp: {
      getFileById: file,
      createFile: (b) => {
        const id = 'file-' + (++nextFile);
        files.set(id, { type: b.type, name: b.name, size: b.size });
        return file(id);
      },
    },
    SlidesApp: { openById: () => ({ replaceAllText() {}, saveAndClose() {} }) },
    MailApp: { sendEmail: (message) => {
      mailAttempts++;
      if (mailAttempts === options.failMailAt) throw new Error('Temporary email failure');
      assert.ok(message.attachments.reduce((sum, b) => sum + b.size, 0) <= 18 * 1024 * 1024);
      mails.push(message);
    } },
    UrlFetchApp: { fetch: (url, opts) => {
      assert.match(url, /googleapis\.com\/drive\/v3\/files\/.+\/export\?mimeType=/);
      assert.equal(opts.headers.Authorization, 'Bearer test-token');
      exports++;
      return {
        getResponseCode: () => exports === options.failExportAt ? 503 : 200,
        getBlob: () => blob(pptxMime, 'export.pptx', options.pptxBytes || 100),
      };
    } },
    MimeType: { PDF: 'application/pdf' },
    ScriptApp: {
      getOAuthToken: () => 'test-token',
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: (fn) => {
        const b = {
          timeBased() { return b; },
          at(d) { b.when = d; return b; },
          create() { triggers.push({ getHandlerFunction: () => fn, when: b.when }); return b; },
        };
        return b;
      },
    },
  });
  const clock = { now: 0 };
  ctx.__clock = clock;
  vm.createContext(ctx);
  vm.runInContext('Date.now = function () { return __clock.now; };', ctx);
  vm.runInContext(CODE, ctx);
  return { ctx, data, triggers, clock, files, mails, close: ctx.CLOSE_AT.getTime() };
}

const plain = (x) => JSON.parse(JSON.stringify(x));
const rowsOf = (data, name) => data[name].slice(1);
const settingOf = (data, key) => {
  const row = data.Settings.find((r) => r[0] === key);
  return row ? row[1] : undefined;
};

test('committee login requires admin and the configured PIN', () => {
  const b = makeBackend();
  assert.equal(b.ctx.HANDLERS.committee({ username: 'admin', pin: PIN }).ok, true);
  for (const credentials of [
    { pin: PIN },
    { username: 'someone-else', pin: PIN },
    { username: 'admin', pin: 'incorrect' },
    { username: 'admin' },
    {},
  ]) {
    const out = plain(b.ctx.HANDLERS.committee(credentials));
    assert.equal(out.ok, false);
    assert.equal(out.error, 'Wrong username or PIN.');
    assert.equal(out.nominations, undefined);
  }
});

test('score and publish reject a missing or incorrect username', () => {
  const b = makeBackend();
  for (const action of ['score', 'publish']) {
    for (const username of [undefined, 'someone-else']) {
      const out = plain(b.ctx.HANDLERS[action]({ username, pin: PIN, winners: { test: [] } }));
      assert.equal(out.ok, false);
      assert.equal(out.error, 'Wrong username or PIN.');
    }
  }
  assert.equal(rowsOf(b.data, 'Scores').length, 0);
  assert.equal(settingOf(b.data, 'winners'), undefined);
});

test('authenticated scores preserve evaluator identity and publishing still works', () => {
  const b = makeBackend();
  b.clock.now = b.close - 1;
  const score = { awardId: 'hd-nurse', nominee: 'CRUZ, Ana', evaluator: 'Nurse Evaluator', ratings: [5, 5, 5, 5, 5] };
  assert.equal(b.ctx.HANDLERS.score({ username: 'admin', pin: PIN, score }).ok, true);
  assert.equal(rowsOf(b.data, 'Scores')[0][3], 'Nurse Evaluator');
  const winners = { 'hd-nurse': [{ nominee: 'CRUZ, Ana', value: 100 }] };
  assert.equal(b.ctx.HANDLERS.publish({ username: 'admin', pin: PIN, winners }).ok, true);
  assert.deepEqual(JSON.parse(settingOf(b.data, 'winners')), winners);
});

test('weights in Code.gs match js/awards.js', () => {
  const { ctx } = makeBackend();
  for (const [id, weights] of Object.entries(ctx.WEIGHTS)) {
    const award = awardById(id);
    assert.ok(award, `unknown award ${id}`);
    assert.deepEqual(award.criteria.map((c) => c.weight), plain(weights), id);
  }
  // Every scored award has a weights entry.
  for (const a of JS_AWARDS) {
    if (a.type === 'scored') assert.ok(ctx.WEIGHTS[a.id], a.id);
  }
});

test('restoration keeps original rows and copies each missing submission only once', () => {
  const { ctx } = makeBackend();
  const old = ['2026-10-13', 'hd-nurse', 'Nurse A', 'Voter A', 'Original reason'];
  const recent = ['2026-10-19', 'patient-choice', 'Nurse B', 'Voter B', ''];
  const original = [old];
  const missing = plain(ctx.missingNominationRows_([old, recent], original));
  assert.deepEqual(missing, [recent]);
  assert.deepEqual(original, [old]);
  assert.deepEqual(plain(ctx.missingNominationRows_([old, recent], [...original, ...missing])), []);
  assert.deepEqual(plain(ctx.missingNominationRows_([recent, recent], [recent])), [recent]);
});

test('restoration preserves text values and ignores empty source rows', () => {
  const { ctx } = makeBackend();
  const row = ['2026-10-19', 'hd-nurse', 'Nurse B', 'Voter B', '=1+1'];
  const missing = plain(ctx.missingNominationRows_([[], row], []));
  assert.equal(missing[0][4], "'=1+1");
  assert.deepEqual(plain(ctx.missingNominationRows_([row], missing)), []);
});

test('gate: open one millisecond before 12:00 noon Manila, closed at 12:00 noon', () => {
  const b = makeBackend();
  assert.equal(b.ctx.isClosed_(b.close - 1), false);
  assert.equal(b.ctx.isClosed_(b.close), true);
  assert.equal(b.ctx.CLOSE_AT.toISOString(), '2026-10-20T04:00:00.000Z');
});

test('gate: writes succeed before close and are refused after', () => {
  const b = makeBackend();
  const nom = { awardId: 'hd-nurse', nominee: 'CRUZ, Ana', nominator: 'Ben Reyes', reason: 'Long enough reason.' };
  b.clock.now = b.close - 1000;
  assert.equal(b.ctx.HANDLERS.nominate({ nomination: nom }).ok, true);
  b.clock.now = b.close;
  const after = plain(b.ctx.HANDLERS.nominate({ nomination: { ...nom, nominator: 'Cora Lim' } }));
  assert.equal(after.ok, false);
  assert.match(after.error, /Voting is closed/);
  const score = plain(b.ctx.HANDLERS.score({ username: 'admin', pin: PIN, score: { awardId: 'hd-nurse', nominee: 'CRUZ, Ana', evaluator: 'E1', ratings: [5, 5, 5, 5, 5] } }));
  assert.equal(score.ok, false);
  assert.match(score.error, /Voting is closed/);
  assert.equal(rowsOf(b.data, 'Nominations').length, 1);
  assert.equal(rowsOf(b.data, 'Scores').length, 0);
});

test('public state reports closeAt and closed', () => {
  const b = makeBackend();
  b.clock.now = b.close - 1;
  const pre = plain(b.ctx.publicView_());
  assert.equal(pre.closed, false);
  assert.equal(plain(b.ctx.HANDLERS.committee({ username: 'admin', pin: PIN })).closed, false);
  assert.equal(pre.closeAt, '2026-10-20T04:00:00.000Z');
  b.clock.now = b.close;
  assert.equal(plain(b.ctx.publicView_()).closed, true);
  assert.equal(plain(b.ctx.HANDLERS.committee({ username: 'admin', pin: PIN })).closed, true);
});

test('all awards stay open after the former deadline and close together on October 20', () => {
  const b = makeBackend();
  const formerClose = Date.parse('2026-10-19T12:00:00+08:00');
  const close = Date.parse('2026-10-20T12:00:00+08:00');
  assert.equal(b.close, close);
  for (const id of Object.keys(b.ctx.AWARDS)) {
    assert.equal(b.ctx.isClosed_(formerClose, id), false, id);
    assert.equal(b.ctx.isClosed_(close - 1, id), false, id);
    assert.equal(b.ctx.isClosed_(close, id), true, id);
  }
  b.clock.now = formerClose;
  const state = plain(b.ctx.publicView_());
  assert.equal(state.closed, false);
  for (const id of Object.keys(b.ctx.AWARDS)) {
    assert.equal(state.closedByAward[id], false, id);
    assert.equal(state.closeAtByAward[id], '2026-10-20T04:00:00.000Z', id);
  }
  b.clock.now = close;
  const after = plain(b.ctx.publicView_());
  assert.equal(after.closed, true);
  assert.ok(Object.values(after.closedByAward).every(Boolean));
});

test('all awards accept nominations or votes during extension and reject them at the deadline', () => {
  const b = makeBackend();
  for (const id of Object.keys(b.ctx.AWARDS)) {
    const nomination = { awardId: id, nominee: 'CRUZ, Ana', nominator: 'Ben Reyes', reason: 'Excellent patient care.' };
    b.clock.now = Date.parse('2026-10-19T12:00:00+08:00');
    assert.equal(b.ctx.HANDLERS.nominate({ nomination }).ok, true, id);
    b.clock.now = b.close - 1;
    assert.equal(b.ctx.HANDLERS.nominate({ nomination: { ...nomination, nominator: 'Cora Lim' } }).ok, true, id);
    b.clock.now = b.close;
    const after = b.ctx.HANDLERS.nominate({ nomination: { ...nomination, nominator: 'Dina Cruz' } });
    assert.equal(after.ok, false, id);
    assert.match(after.error, /Voting is closed/);
  }
  assert.equal(rowsOf(b.data, 'Nominations').length, Object.keys(b.ctx.AWARDS).length * 2);
  b.clock.now = b.close - 1;
  const score = { awardId: 'hd-nurse', nominee: 'CRUZ, Ana', evaluator: 'Evaluator', ratings: [5, 5, 5, 5, 5] };
  assert.equal(b.ctx.HANDLERS.score({ username: 'admin', pin: PIN, score }).ok, true);
  b.clock.now = b.close;
  assert.equal(b.ctx.HANDLERS.score({ username: 'admin', pin: PIN, score }).ok, false);
});

for (const c of VECTORS.cases) {
  test(`ranking parity: ${c.name}`, () => {
    const b = makeBackend();
    b.clock.now = c.afterClose ? b.close : b.close - 1;
    const nominations = c.nominations.map((n) => ({ awardId: n.awardId, nominee: n.nominee, nominator: n.nominator }));
    const scores = c.scores.map((s) => ({ awardId: s.awardId, nominee: s.nominee, evaluator: s.evaluator, ratings: s.ratings }));

    // Apps Script port
    const gs = plain(b.ctx.rankAward_(c.awardId, nominations, scores));
    const gsWinners = gs.filter((r) => r.rank === 1).map((r) => [r.nominee, r.value]);
    const gsRanks = gs.map((r) => [r.nominee, r.value, r.rank]);
    assert.deepEqual(gsWinners, c.expectWinners, 'Apps Script winners');
    assert.deepEqual(gsRanks, c.expectRanks, 'Apps Script ranks');

    // JavaScript ranking in js/scoring.js
    const award = awardById(c.awardId);
    const jsRows = rankAward(award, nominations, scores, !!c.afterClose);
    assert.deepEqual(jsRows.map((r) => [r.nominee, r.value, r.rank]), c.expectRanks, 'JavaScript ranks');
  });
}

test('closeAndPublish: refused before 23 Oct announcement, even after voting closes, nothing written', () => {
  const b = makeBackend({ Nominations: [HEADERS.Nominations, ['x', 'hd-nurse', 'CRUZ, Ana', 'Ben', 'r']] });
  b.clock.now = b.close;
  const out = plain(b.ctx.closeAndPublish());
  assert.equal(out.ok, false);
  assert.equal(settingOf(b.data, 'winners'), undefined);
  assert.match(settingOf(b.data, 'closeLog'), /skipped/);
});

test('closeAndPublish: posts new winners, keeps published awards, is idempotent', () => {
  const b = makeBackend({
    Nominations: [
      HEADERS.Nominations,
      ['t', 'hd-nurse', 'CRUZ, Ana', 'A', 'r'],
      ['t', 'hd-nurse', 'LIM, Bo', 'B', 'r'],
      ['t', 'peer-choice', 'REYES, Ben', 'C', ''],
      ['t', 'peer-choice', 'REYES, Ben', 'D', ''],
    ],
    Scores: [
      HEADERS.Scores,
      ['t', 'hd-nurse', 'CRUZ, Ana', 'E1', '[5,5,5,5,5]'],
      ['t', 'hd-nurse', 'LIM, Bo', 'E1', '[3,3,3,3,3]'],
    ],
    Settings: [HEADERS.Settings, ['winners', JSON.stringify({ 'hd-nurse': [{ nominee: 'EARLY, Pick', value: 77 }] })]],
  });
  b.clock.now = b.ctx.ANNOUNCE_AT.getTime() + 60000;
  const first = plain(b.ctx.closeAndPublish());
  assert.equal(first.ok, true);
  const winners = JSON.parse(settingOf(b.data, 'winners'));
  assert.deepEqual(winners['hd-nurse'], [{ nominee: 'EARLY, Pick', value: 77 }], 'committee publish kept');
  assert.deepEqual(winners['peer-choice'], [{ nominee: 'REYES, Ben', value: 2 }], 'vote winner posted');
  assert.deepEqual(first.added, ['peer-choice']);
  const second = plain(b.ctx.closeAndPublish());
  assert.deepEqual(second.added, [], 'second run adds nothing');
  assert.match(settingOf(b.data, 'closeLog'), /ok/);
});

test('closeAndPublish: an unscored award uses nominations and records the basis', () => {
  const b = makeBackend({ Nominations: [HEADERS.Nominations, ['t', 'hd-nurse', 'CRUZ, Ana', 'A', 'r']] });
  b.clock.now = b.ctx.ANNOUNCE_AT.getTime();
  b.ctx.closeAndPublish();
  const winners = JSON.parse(settingOf(b.data, 'winners'));
  assert.deepEqual(winners['hd-nurse'], [{ nominee: 'CRUZ, Ana', value: 1, basis: 'nominations' }]);
  assert.equal(winners['pd-nurse'], undefined, 'a category without nominees still has no winner');
});

test('previewClose returns winners and writes nothing', () => {
  const b = makeBackend({
    Nominations: [HEADERS.Nominations, ['t', 'peer-choice', 'REYES, Ben', 'C', '']],
  });
  b.clock.now = b.close - 1;
  const preview = plain(b.ctx.previewClose());
  assert.deepEqual(preview['peer-choice'], [{ nominee: 'REYES, Ben', value: 1 }]);
  assert.equal(settingOf(b.data, 'winners'), undefined);
  assert.equal(settingOf(b.data, 'closeLog'), undefined);
});

test('setup installs one email trigger on October 20 and one announcement trigger on October 23', () => {
  const b = makeBackend();
  b.ctx.installCloseTrigger();
  b.ctx.installCloseTrigger();
  const mine = b.triggers.filter((t) => t.getHandlerFunction() === 'closeAndPublish');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].when.getTime(), b.ctx.ANNOUNCE_AT.getTime());
  const email = b.triggers.filter((t) => t.getHandlerFunction() === 'sendAwardCertificates');
  assert.equal(email.length, 1);
  assert.equal(email[0].when.toISOString(), '2026-10-20T04:00:00.000Z');
  assert.equal(b.triggers.length, 2);
});

test('public state: announced flips at 23 Oct 12:00 noon Manila, not at voting close', () => {
  const b = makeBackend();
  const announce = b.ctx.ANNOUNCE_AT.getTime();
  b.clock.now = b.close;
  let st = plain(b.ctx.publicView_());
  assert.equal(st.closed, true);
  assert.equal(st.announced, false);
  b.clock.now = announce - 1;
  assert.equal(plain(b.ctx.publicView_()).announced, false);
  b.clock.now = announce;
  st = plain(b.ctx.publicView_());
  assert.equal(st.announced, true);
  assert.equal(st.announceAt, '2026-10-23T04:00:00.000Z');
});

test('one person per award: spacing and capitals do not duplicate a nominee', () => {
  const b = makeBackend({
    Nominations: [
      HEADERS.Nominations,
      ['t', 'hd-nurse', 'CRUZ, Ana', 'A', 'r'],
      ['t', 'hd-nurse', 'cruz,  ana ', 'B', 'r'],
      ['t', 'hd-nurse', 'LIM, Bo', 'C', 'r'],
    ],
  });
  const rows = plain(b.ctx.rankAward_('hd-nurse', [
    { awardId: 'hd-nurse', nominee: 'CRUZ, Ana', nominator: 'A' },
    { awardId: 'hd-nurse', nominee: 'cruz,  ana ', nominator: 'B' },
    { awardId: 'hd-nurse', nominee: 'LIM, Bo', nominator: 'C' },
  ], []));
  assert.equal(rows.length, 2, 'two people, not three rows');
  const pub = plain(b.ctx.publicView_());
  assert.equal(pub.nominees['hd-nurse'].length, 2);
  const cruz = pub.nominees['hd-nurse'].find((r) => /cruz/i.test(r.nominee));
  assert.equal(cruz.count, 2, 'both nominations count for one person');
});


test('certificates refuse early sending and email PPTX plus PDF privately at the October 20 deadline', () => {
  const b = makeBackend({ Nominations: [HEADERS.Nominations, ['t', 'hd-nurse', 'CRUZ, Ana', 'A', 'reason']] });
  b.clock.now = b.close - 1;
  assert.equal(b.ctx.sendAwardCertificates().ok, false);
  assert.equal(b.mails.length, 0);
  assert.equal(settingOf(b.data, 'certificateWinners'), undefined);
  b.clock.now = b.close;
  assert.deepEqual(plain(b.ctx.sendAwardCertificates()), { ok: true, sent: 1 });
  assert.equal(b.mails.length, 1);
  assert.equal(b.mails[0].to, 'nncluster@spmcdvo.net');
  assert.deepEqual(plain(b.mails[0].attachments.map((a) => a.type)), [b.ctx.CERT_PPTX_MIME, 'application/pdf']);
  assert.match(b.mails[0].body, /PPTX and PDF/);
  assert.equal(settingOf(b.data, 'winners'), undefined, 'public winners are not announced early');
  const snapshot = JSON.parse(settingOf(b.data, 'certificateWinners'));
  assert.deepEqual(snapshot['hd-nurse'], [{ nominee: 'CRUZ, Ana', value: 1, basis: 'nominations' }]);
  assert.equal(b.ctx.publicView_().winners, null);
  assert.equal(JSON.parse(settingOf(b.data, 'certificateEmailLog')).status, 'ok');
  const count = b.files.size;
  assert.deepEqual(plain(b.ctx.sendAwardCertificates()), { ok: true, sent: 0 });
  assert.equal(b.mails.length, 1);
  assert.equal(b.files.size, count, 'retry reuses generated files');
  b.clock.now = b.ctx.ANNOUNCE_AT.getTime();
  b.ctx.closeAndPublish();
  assert.deepEqual(JSON.parse(settingOf(b.data, 'winners')), snapshot);
  assert.equal(b.mails.length, 1, 'October 23 posting does not resend certificates');
});

test('PPTX export failure retains the private snapshot and retries without copying a second certificate', () => {
  const b = makeBackend({ Nominations: [HEADERS.Nominations, ['t', 'hd-nurse', 'CRUZ, Ana', 'A', 'reason']] }, { failExportAt: 1 });
  b.clock.now = b.close;
  assert.throws(() => b.ctx.sendAwardCertificates(), /PPTX export failed/);
  assert.equal(b.mails.length, 0);
  assert.equal(settingOf(b.data, 'winners'), undefined);
  assert.equal(JSON.parse(settingOf(b.data, 'certificateEmailLog')).status, 'error');
  assert.equal([...b.files.values()].filter((f) => f.type === b.ctx.CERT_SLIDES_MIME).length, 1);
  assert.equal(b.ctx.sendAwardCertificates().sent, 1);
  assert.equal([...b.files.values()].filter((f) => f.type === b.ctx.CERT_SLIDES_MIME).length, 1);
});

test('large attachment sets are batched, and a retry skips batches already emailed', () => {
  const b = makeBackend({ Nominations: [HEADERS.Nominations,
    ['t', 'hd-nurse', 'CRUZ, Ana', 'A', 'reason'],
    ['t', 'pd-nurse', 'LIM, Bo', 'B', 'reason'],
    ['t', 'nephro-nurse', 'REYES, Ben', 'C', 'reason'],
  ] }, { pptxBytes: 10 * 1024 * 1024, failMailAt: 2 });
  b.clock.now = b.close;
  assert.throws(() => b.ctx.sendAwardCertificates(), /Temporary email failure/);
  assert.equal(b.mails.length, 1);
  assert.equal(JSON.parse(settingOf(b.data, 'certificatesSent')).length, 1);
  const count = b.files.size;
  assert.equal(b.ctx.sendAwardCertificates().sent, 2);
  assert.equal(b.mails.length, 3);
  assert.equal(b.files.size, count);
  assert.equal(new Set(JSON.parse(settingOf(b.data, 'certificatesSent'))).size, 3);
  assert.ok(b.mails.every((m) => m.attachments.length === 2));
});

test('invalid template does not replace already installed automation triggers', () => {
  const b = makeBackend({}, { templateMime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  b.triggers.push({ getHandlerFunction: () => 'unrelatedHandler' });
  assert.throws(() => b.ctx.installAutomationTriggers(), /native Google Slides/);
  assert.equal(b.triggers.length, 1);
});
