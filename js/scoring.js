// Pure scoring rules. No DOM, no network, so Node can test this file.

export const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

const round2 = (n) => Math.round(n * 100) / 100;

export function validRatings(ratings, criteria) {
  return Array.isArray(ratings)
    && ratings.length === criteria.length
    && ratings.every((r) => Number.isInteger(r) && r >= 1 && r <= 5);
}

// A rating of 5 earns the full weight of a criterion, so the maximum total is 100.
export function weightedTotal(ratings, criteria) {
  if (!validRatings(ratings, criteria)) return null;
  return round2(criteria.reduce((sum, cr, i) => sum + (ratings[i] / 5) * cr.weight, 0));
}

// Rank the nominees of a scored award by the mean total across evaluators.
// A tie shares one rank. Nominees with no score come last with a null average.
export function rankScored(award, nominees, scores) {
  const rows = nominees.map((nominee) => {
    const totals = scores
      .filter((s) => s.awardId === award.id && normName(s.nominee) === normName(nominee))
      .map((s) => weightedTotal(s.ratings, award.criteria))
      .filter((t) => t !== null);
    const average = totals.length ? round2(totals.reduce((a, b) => a + b, 0) / totals.length) : null;
    return { nominee, average, evaluators: totals.length };
  });
  rows.sort((a, b) => (b.average ?? -1) - (a.average ?? -1) || a.nominee.localeCompare(b.nominee));
  return withRanks(rows, (r) => r.average);
}

// Rank the nominees of a vote award. One voter counts once per award.
export function rankVotes(award, nominations) {
  const seen = new Set();
  const counts = new Map();
  for (const n of nominations) {
    if (n.awardId !== award.id) continue;
    const voter = normName(n.nominator);
    if (seen.has(voter)) continue;
    seen.add(voter);
    counts.set(n.nominee, (counts.get(n.nominee) || 0) + 1);
  }
  const rows = [...counts].map(([nominee, votes]) => ({ nominee, votes }));
  rows.sort((a, b) => b.votes - a.votes || a.nominee.localeCompare(b.nominee));
  return withRanks(rows, (r) => r.votes);
}

function withRanks(rows, key) {
  let rank = 0;
  let prev;
  rows.forEach((row, i) => {
    const v = key(row);
    if (v === null || v === undefined) { row.rank = null; return; }
    if (v !== prev) { rank = i + 1; prev = v; }
    row.rank = rank;
  });
  return rows;
}

// Returns an error message, or null when the nomination is valid.
export function nominationError(n, award, eligible, existing) {
  if (!award) return 'Choose an award.';
  if (!normName(n.nominator)) return 'Enter your name.';
  if (!eligible.some((e) => normName(e) === normName(n.nominee))) return 'Choose a nominee from the list.';
  if (normName(n.nominator) === normName(n.nominee)) return 'You cannot nominate yourself.';
  const dup = existing.some((e) => e.awardId === award.id && normName(e.nominator) === normName(n.nominator));
  if (dup) return award.type === 'votes'
    ? 'This name has already voted for this award.'
    : 'This name has already nominated for this award.';
  if (award.type === 'scored' && String(n.reason || '').trim().replace(/\s+/g, ' ').length < 10) return 'Give a short reason (10 characters or more).';
  return null;
}
