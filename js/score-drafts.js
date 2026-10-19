import { normName } from './scoring.js';

const key = (username, evaluator, awardId, nominee) => 'nnw26-score-draft:'
  + JSON.stringify([username, evaluator, awardId, nominee].map(normName));
const valid = (ratings) => Array.isArray(ratings) && ratings.length > 0
  && ratings.every((r) => r === null || (Number.isInteger(r) && r >= 1 && r <= 5));

export function readScoreDraft(username, evaluator, awardId, nominee) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(username, evaluator, awardId, nominee)) || 'null');
    return valid(saved?.ratings) ? saved.ratings : null;
  } catch { return null; }
}

export function writeScoreDraft(username, evaluator, awardId, nominee, ratings) {
  if (!valid(ratings)) return false;
  try {
    localStorage.setItem(key(username, evaluator, awardId, nominee), JSON.stringify({ ratings }));
    return true;
  } catch { return false; }
}

export function clearScoreDraft(username, evaluator, awardId, nominee) {
  try { localStorage.removeItem(key(username, evaluator, awardId, nominee)); } catch {}
}
