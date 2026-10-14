import test from 'node:test';
import assert from 'node:assert/strict';
import { AWARDS } from '../js/awards.js';

test('award pager: patient-choice is hidden and excluded from peer navigation cycle', () => {
  const pagerAwards = AWARDS.filter((a) => a.id !== 'patient-choice');

  // Verify patient-choice is filtered out
  assert.equal(pagerAwards.some((a) => a.id === 'patient-choice'), false);
  assert.equal(pagerAwards.length, AWARDS.length - 1);

  // Check rising-star (previous award in sequence)
  const risingStarIndex = pagerAwards.findIndex((a) => a.id === 'rising-star');
  assert.notEqual(risingStarIndex, -1);
  const nextAfterRisingStar = pagerAwards[(risingStarIndex + 1) % pagerAwards.length];
  assert.equal(nextAfterRisingStar.id, 'peer-choice');

  // Check peer-choice (next award in sequence)
  const peerChoiceIndex = pagerAwards.findIndex((a) => a.id === 'peer-choice');
  assert.notEqual(peerChoiceIndex, -1);
  const prevBeforePeerChoice = pagerAwards[(peerChoiceIndex - 1 + pagerAwards.length) % pagerAwards.length];
  assert.equal(prevBeforePeerChoice.id, 'rising-star');
});
