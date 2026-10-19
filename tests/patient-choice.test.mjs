import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS, awardById } from '../js/awards.js';
import { NURSES, ATTENDANTS } from '../js/staff.js';
import { eligibleFor, nominate } from '../js/api.js';

test('Patient Choice includes every nurse and dialysis technician', () => {
  const eligible = eligibleFor(awardById('patient-choice'));
  assert.deepEqual(eligible, [...NURSES, ...ATTENDANTS]);
  assert.equal(eligible.length, 167);
  assert.equal(new Set(eligible).size, 167);
});

test('other awards retain their existing staff eligibility', () => {
  for (const award of AWARDS.filter((a) => a.id !== 'patient-choice')) {
    assert.deepEqual(eligibleFor(award), award.group === 'na' ? ATTENDANTS : NURSES, award.id);
  }
});

test('Patient Choice sends nurse and technician votes to the same existing award', async (t) => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ ok: true, nominees: {}, winners: null }) };
  });
  for (const nominee of [NURSES[0], ATTENDANTS[0]]) {
    await nominate({ awardId: 'patient-choice', nominee: ` ${nominee.toLowerCase()} `, nominator: 'Patient example', reason: '' });
    const request = requests.at(-1);
    assert.equal(request.action, 'nominate');
    assert.equal(request.nomination.awardId, 'patient-choice');
    assert.equal(request.nomination.nominee, nominee);
  }
  const count = requests.length;
  await assert.rejects(nominate({ awardId: 'peer-choice', nominee: ATTENDANTS[0], nominator: 'Patient example', reason: '' }), /from the list/);
  assert.equal(requests.length, count, 'technicians are still excluded from nurse-only Peer Choice');
});
