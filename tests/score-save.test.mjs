import test from 'node:test';
import assert from 'node:assert/strict';
import { saveScore } from '../js/api.js';
import { readScoreDraft, writeScoreDraft, clearScoreDraft } from '../js/score-drafts.js';

const score = { awardId: 'pd-nurse', nominee: 'NURSE, Example', evaluator: 'Evaluator One', ratings: [4, 3, 4, 3, 4] };
const response = (data) => ({ ok: true, json: async () => data });
const fast = { timeoutMs: 5, confirmationTimeoutMs: 5, retryDelayMs: 0 };

test('a lost save response is confirmed from the sheet without resubmitting the score', async (t) => {
  const actions = [];
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const req = JSON.parse(options.body);
    actions.push(req.action);
    if (req.action === 'score') throw new TypeError('Failed to fetch');
    return response({ ok: true, scores: [{ ...score, nominee: 'nurse,  example ', evaluator: 'evaluator one' }] });
  });
  assert.deepEqual(await saveScore('test-pin', score, 'admin', fast), { ok: true, verified: true });
  assert.deepEqual(actions, ['score', 'committee']);
});

test('a missing score is retried once with the same evaluator, award, nominee and ratings', async (t) => {
  const requests = [];
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const req = JSON.parse(options.body);
    requests.push(req);
    if (req.action === 'score' && ++writes === 1) throw new TypeError('Failed to fetch');
    return response(req.action === 'committee' ? { ok: true, scores: [] } : { ok: true });
  });
  const stages = [];
  await saveScore('test-pin', score, 'admin', { ...fast, onStatus: (stage) => stages.push(stage) });
  assert.deepEqual(requests.map((r) => r.action), ['score', 'committee', 'score']);
  assert.deepEqual(requests[0], requests[2]);
  assert.deepEqual(stages, ['saving', 'checking', 'retrying']);
});

test('closed voting and other server refusals are not retried', async (t) => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return response({ ok: false, error: 'Voting is closed.' });
  });
  await assert.rejects(saveScore('test-pin', score, 'admin', fast), /Voting is closed/);
  assert.equal(requests, 1);
});

test('hanging requests are aborted and a failed confirmation remains explicitly uncertain', async (t) => {
  let aborted = 0;
  t.mock.method(globalThis, 'fetch', (_, options) => {
    const req = JSON.parse(options.body);
    if (req.action === 'committee') return Promise.resolve(response({ ok: true, scores: [] }));
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        aborted++;
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  });
  await assert.rejects(saveScore('test-pin', score, 'admin', fast), (error) => error.scoreUnconfirmed === true);
  assert.equal(aborted, 2);
});

test('readback does not confuse another evaluator or different ratings with this score', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const req = JSON.parse(options.body);
    if (req.action === 'score') throw new TypeError('Failed to fetch');
    return response({ ok: true, scores: [
      { ...score, evaluator: 'Another Evaluator' },
      { ...score, ratings: [5, 5, 5, 5, 5] },
    ] });
  });
  await assert.rejects(saveScore('test-pin', score, 'admin', fast), (error) => error.scoreUnconfirmed === true);
});

test('temporary HTTP failures can be confirmed or retried', async (t) => {
  let writes = 0;
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const req = JSON.parse(options.body);
    if (req.action === 'score' && ++writes === 1) return { ok: false, status: 503 };
    return response(req.action === 'committee' ? { ok: true, scores: [] } : { ok: true });
  });
  assert.deepEqual(await saveScore('test-pin', score, 'admin', fast), { ok: true });
  assert.equal(writes, 2);
});

function storageFixture(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
  return { data, storage };
}

test('partial ratings survive reload and stay separate for each evaluator, category and nominee', (t) => {
  const { data } = storageFixture(t);
  const args = ['admin', 'Evaluator One', 'pd-nurse', 'NURSE, Example'];
  const partial = [4, null, 3, 4, null];
  assert.equal(writeScoreDraft(...args, partial), true);
  assert.deepEqual(readScoreDraft('ADMIN', 'evaluator one', 'pd-nurse', 'nurse, example'), partial);
  assert.equal(readScoreDraft('admin', 'Another Evaluator', 'pd-nurse', 'NURSE, Example'), null);
  assert.equal(readScoreDraft('admin', 'Evaluator One', 'hd-nurse', 'NURSE, Example'), null);
  assert.equal(readScoreDraft('admin', 'Evaluator One', 'pd-nurse', 'ANOTHER, Nurse'), null);
  assert.deepEqual(Object.keys(JSON.parse([...data.values()][0])), ['ratings'], 'drafts never store login credentials');
  clearScoreDraft(...args);
  assert.equal(readScoreDraft(...args), null);
});

test('unavailable or corrupt draft storage does not break scoring', (t) => {
  const { storage } = storageFixture(t);
  const args = ['admin', 'Evaluator One', 'pd-nurse', 'NURSE, Example'];
  storage.getItem = () => 'invalid JSON';
  assert.equal(readScoreDraft(...args), null);
  storage.setItem = () => { throw new Error('Storage full'); };
  storage.removeItem = () => { throw new Error('Storage unavailable'); };
  assert.equal(writeScoreDraft(...args, score.ratings), false);
  assert.doesNotThrow(() => clearScoreDraft(...args));
});
