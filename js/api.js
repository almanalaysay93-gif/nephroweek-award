import { ENDPOINT } from './config.js?v=20261019-login2';
import { AWARDS, awardById } from './awards.js';
import { NURSES, ATTENDANTS } from './staff.js';
import { normName, nominationError, validRatings } from './scoring.js';

export const DEMO = !ENDPOINT;
// Demo mode only (empty ENDPOINT). Live credentials are script properties in Apps Script, never in this repository.
const DEMO_PIN = 'demo';
const KEY = 'nnw26-demo';

export const eligibleFor = (award) => (award.group === 'na' ? ATTENDANTS : NURSES);

// ---- Remote: Google Apps Script web app -----------------------------------
// text/plain keeps the request "simple", so the browser sends no preflight.
async function remote(action, payload = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`The server answered ${res.status}.`);
  return res.json();
}

// ---- Local demo store ------------------------------------------------------
function load() {
  try {
    return { nominations: [], scores: [], winners: null, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { nominations: [], scores: [], winners: null };
  }
}
const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));

function publicView(db) {
  const nominees = {};
  for (const a of AWARDS) nominees[a.id] = [];
  for (const n of db.nominations) {
    const list = nominees[n.awardId];
    if (!list) continue;
    const row = list.find((r) => r.nominee === n.nominee);
    if (row) row.count += 1; else list.push({ nominee: n.nominee, count: 1 });
  }
  // Vote counts stay private until the committee publishes.
  for (const a of AWARDS) if (a.type === 'votes') nominees[a.id].forEach((r) => { r.count = null; });
  return { ok: true, nominees, winners: db.winners };
}

const local = {
  state: () => publicView(load()),
  nominate: ({ nomination }) => {
    const db = load();
    if (db.winners && db.winners[nomination.awardId]) return { ok: false, error: 'This award is closed. The awardee is announced.' };
    db.nominations.push({ ...nomination, ts: new Date().toISOString() });
    save(db);
    return publicView(db);
  },
  committee: ({ username, pin }) => {
    if (username !== 'admin' || pin !== DEMO_PIN) return { ok: false, error: 'Wrong username or PIN.' };
    const db = load();
    return { ok: true, nominations: db.nominations, scores: db.scores, winners: db.winners };
  },
  score: ({ username, pin, score }) => {
    if (username !== 'admin' || pin !== DEMO_PIN) return { ok: false, error: 'Wrong username or PIN.' };
    const db = load();
    const same = (s) => s.awardId === score.awardId
      && normName(s.nominee) === normName(score.nominee)
      && normName(s.evaluator) === normName(score.evaluator);
    db.scores = db.scores.filter((s) => !same(s));
    db.scores.push({ ...score, ts: new Date().toISOString() });
    save(db);
    return { ok: true };
  },
  publish: ({ username, pin, winners }) => {
    if (username !== 'admin' || pin !== DEMO_PIN) return { ok: false, error: 'Wrong username or PIN.' };
    const db = load();
    db.winners = winners;
    save(db);
    return { ok: true };
  },
};

async function call(action, payload) {
  const out = DEMO ? local[action](payload || {}) : await remote(action, payload);
  if (!out || out.ok !== true) throw new Error((out && out.error) || 'The request failed.');
  return out;
}

// ---- Public API ------------------------------------------------------------
export const getState = () => call('state');

export async function nominate(nomination) {
  const award = awardById(nomination.awardId);
  // The public state has no nominator names, so the server makes the duplicate check.
  // In demo mode the full list is local, so the check runs here.
  const existing = DEMO ? load().nominations : [];
  const error = nominationError(nomination, award, award ? eligibleFor(award) : [], existing);
  if (error) throw new Error(error);
  const clean = {
    awardId: award.id,
    nominee: eligibleFor(award).find((e) => normName(e) === normName(nomination.nominee)),
    nominator: nomination.nominator.trim().replace(/\s+/g, ' ').slice(0, 80),
    reason: String(nomination.reason || '').trim().replace(/\s+/g, ' ').slice(0, 600),
  };
  return call('nominate', { nomination: clean });
}

export const getCommittee = (pin, username) => call('committee', { pin, username });

export async function saveScore(pin, score, username) {
  const award = awardById(score.awardId);
  if (!award || award.type !== 'scored') throw new Error('This award is not scored.');
  if (!normName(score.evaluator)) throw new Error('Enter your name.');
  if (!validRatings(score.ratings, award.criteria)) throw new Error('Rate every criterion from 1 to 5.');
  return call('score', { pin, score, username });
}

export const publishWinners = (pin, winners, username) => call('publish', { pin, winners, username });
