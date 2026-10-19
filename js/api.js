import { ENDPOINT } from './config.js?v=20261019-score-save';
import { AWARDS, awardById } from './awards.js?v=20261019-patient-tech';
import { NURSES, ATTENDANTS } from './staff.js';
import { normName, nominationError, validRatings } from './scoring.js';

export const DEMO = !ENDPOINT;
// Demo mode only (empty ENDPOINT). Live credentials are script properties in Apps Script, never in this repository.
const DEMO_PIN = 'demo';
const KEY = 'nnw26-demo';

export const eligibleFor = (award) => award.id === 'patient-choice'
  ? [...NURSES, ...ATTENDANTS]
  : award.group === 'na' ? ATTENDANTS : NURSES;

// ---- Remote: Google Apps Script web app -----------------------------------
// text/plain keeps the request "simple", so the browser sends no preflight.
async function remote(action, payload = {}, { timeoutMs = 25000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const error = new Error(`The server answered ${res.status}.`);
      error.retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      throw error;
    }
    return await res.json();
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) {
      const failure = new Error(error.name === 'AbortError' ? 'The connection timed out.' : 'The server response could not be received.');
      failure.retryable = true;
      throw failure;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

async function call(action, payload, options) {
  const out = DEMO ? local[action](payload || {}) : await remote(action, payload, options);
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

export async function saveScore(pin, score, username, { onStatus = () => {}, timeoutMs = 15000, confirmationTimeoutMs = 10000, retryDelayMs = 800 } = {}) {
  const award = awardById(score.awardId);
  if (!award || award.type !== 'scored') throw new Error('This award is not scored.');
  if (!normName(score.evaluator)) throw new Error('Enter your name.');
  if (!validRatings(score.ratings, award.criteria)) throw new Error('Rate every criterion from 1 to 5.');
  // Score writes replace the same evaluator/nominee/award row, so retrying does
  // not create an extra evaluation. Check first: a lost response can follow a save.
  for (let attempt = 0; attempt < 2; attempt++) {
    onStatus(attempt ? 'retrying' : 'saving');
    try {
      return await call('score', { pin, score, username }, { timeoutMs });
    } catch (error) {
      if (!error.retryable) throw error;
      onStatus('checking');
      try {
        const state = await call('committee', { pin, username }, { timeoutMs: confirmationTimeoutMs });
        const stored = (state.scores || []).find((s) => s.awardId === score.awardId
          && normName(s.nominee) === normName(score.nominee)
          && normName(s.evaluator) === normName(score.evaluator));
        if (stored && Array.isArray(stored.ratings) && stored.ratings.length === score.ratings.length
          && stored.ratings.every((rating, i) => rating === score.ratings[i])) {
          return { ok: true, verified: true };
        }
      } catch {
        // Keep the uncertainty explicit if neither the write nor its readback succeeds.
      }
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  const error = new Error('Could not confirm whether the score was saved. Please try again.');
  error.scoreUnconfirmed = true;
  throw error;
}

export const publishWinners = (pin, winners, username) => call('publish', { pin, winners, username });
