import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS, awardById } from '../js/awards.js';
import { NURSES, ATTENDANTS } from '../js/staff.js';
import { weightedTotal, validRatings, rankScored, rankVotes, nominationError } from '../js/scoring.js';

const hd = awardById('hd-nurse');      // weights 30, 25, 20, 15, 10
const peer = awardById('peer-choice');

test('catalog: 14 awards, 9 nurse and 5 dialysis technician, every weight set sums to 100', () => {
  assert.equal(AWARDS.length, 14);
  assert.equal(AWARDS.filter((a) => a.group === 'nurse').length, 9);
  assert.equal(AWARDS.filter((a) => a.group === 'na').length, 5);
  for (const a of AWARDS) assert.equal(a.criteria.reduce((s, c) => s + c.weight, 0), 100, a.id);
  assert.equal(new Set(AWARDS.map((a) => a.id)).size, 14);
});

test('staff lists: 124 nurses and 43 dialysis technicians, no email text', () => {
  assert.equal(NURSES.length, 124);
  assert.equal(ATTENDANTS.length, 43);
  assert.ok(![...NURSES, ...ATTENDANTS].some((n) => n.includes('@')));
});

test('weightedTotal: all 5 gives 100, all 1 gives 20', () => {
  assert.equal(weightedTotal([5, 5, 5, 5, 5], hd.criteria), 100);
  assert.equal(weightedTotal([1, 1, 1, 1, 1], hd.criteria), 20);
});

test('weightedTotal: weights apply per criterion', () => {
  // 5/5*30 + 4/5*25 + 3/5*20 + 2/5*15 + 1/5*10 = 30 + 20 + 12 + 6 + 2
  assert.equal(weightedTotal([5, 4, 3, 2, 1], hd.criteria), 70);
  // The same ratings in reverse order must give a different total: 6 + 10 + 12 + 12 + 10
  assert.equal(weightedTotal([1, 2, 3, 4, 5], hd.criteria), 50);
});

test('weightedTotal: rejects missing, out of range, and fractional ratings', () => {
  assert.equal(weightedTotal([5, 5, 5, 5], hd.criteria), null);
  assert.equal(weightedTotal([5, 5, 5, 5, 6], hd.criteria), null);
  assert.equal(weightedTotal([5, 5, 5, 5, 0], hd.criteria), null);
  assert.equal(weightedTotal([5, 5, 5, 5, 4.5], hd.criteria), null);
  assert.equal(validRatings([5, 5, 5, 5, null], hd.criteria), false);
});

test('rankScored: averages evaluators, orders by average, puts unscored last', () => {
  const scores = [
    { awardId: 'hd-nurse', nominee: 'A', evaluator: 'E1', ratings: [5, 5, 5, 5, 5] }, // 100
    { awardId: 'hd-nurse', nominee: 'A', evaluator: 'E2', ratings: [3, 3, 3, 3, 3] }, // 60
    { awardId: 'hd-nurse', nominee: 'B', evaluator: 'E1', ratings: [4, 4, 4, 4, 4] }, // 80
    { awardId: 'hd-nurse', nominee: 'B', evaluator: 'E2', ratings: [5, 5, 4, 4, 4] }, // 91
    { awardId: 'pd-nurse', nominee: 'C', evaluator: 'E1', ratings: [5, 5, 5, 5, 5] }, // other award
  ];
  const rows = rankScored(hd, ['A', 'B', 'C'], scores);
  assert.deepEqual(rows.map((r) => [r.nominee, r.average, r.evaluators, r.rank]), [
    ['B', 85.5, 2, 1],
    ['A', 80, 2, 2],
    ['C', null, 0, null],
  ]);
});

test('rankScored: a tie shares rank 1 and the next nominee gets rank 3', () => {
  const s = (nominee, ratings) => ({ awardId: 'hd-nurse', nominee, evaluator: 'E1', ratings });
  const rows = rankScored(hd, ['A', 'B', 'C'], [s('A', [4, 4, 4, 4, 4]), s('B', [4, 4, 4, 4, 4]), s('C', [3, 3, 3, 3, 3])]);
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 3]);
});

test('rankVotes: one voter counts once per award, case and spaces ignored', () => {
  const v = (nominee, nominator, awardId = 'peer-choice') => ({ awardId, nominee, nominator });
  const rows = rankVotes(peer, [
    v('A', 'Juan Cruz'), v('A', 'juan  cruz '), v('B', 'JUAN CRUZ'),
    v('B', 'Ana'), v('B', 'Ben'), v('A', 'Cora', 'patient-choice'),
  ]);
  assert.deepEqual(rows.map((r) => [r.nominee, r.votes, r.rank]), [['B', 2, 1], ['A', 1, 2]]);
});

test('nominationError: rules', () => {
  const eligible = ['CRUZ, Ana B.', 'REYES, Ben C.'];
  const ok = { nominator: 'Someone Else', nominee: 'CRUZ, Ana B.', reason: 'She trained three new nurses this year.' };
  assert.equal(nominationError(ok, hd, eligible, []), null);
  assert.match(nominationError({ ...ok, nominator: ' ' }, hd, eligible, []), /your name/);
  assert.match(nominationError({ ...ok, nominee: 'Not On List' }, hd, eligible, []), /from the list/);
  assert.match(nominationError({ ...ok, nominator: 'cruz, ana b.' }, hd, eligible, []), /yourself/);
  assert.match(nominationError({ ...ok, reason: 'good' }, hd, eligible, []), /reason/);
  const prior = [{ awardId: 'hd-nurse', nominator: 'SOMEONE  else', nominee: 'REYES, Ben C.' }];
  assert.match(nominationError(ok, hd, eligible, prior), /already nominated/);
  // The same person may nominate for a different award.
  assert.equal(nominationError(ok, awardById('pd-nurse'), eligible, prior), null);
  // A vote needs no reason.
  assert.equal(nominationError({ ...ok, reason: '' }, peer, eligible, []), null);
});
