import { AWARDS, RATING_SCALE } from './awards.js';
import { getCommittee, saveScore } from './api.js';
import { normName, weightedTotal, validRatings, rankVotes } from './scoring.js';
import { el, $, initShell, toast, setBusy, displayName, reveal, session } from './ui.js';
import { avatar, setPhotoMap } from './photos.js';

let me = null;      // { evaluator, pin }
let data = null;    // { nominations, scores }
let current = AWARDS[0].id;

// One card per person per award. Spacing and capitals do not make a second person.
const nomineesOf = (award) => {
  const seen = new Map();
  data.nominations.filter((n) => n.awardId === award.id).forEach((n) => {
    const key = normName(n.nominee);
    if (!seen.has(key)) seen.set(key, n.nominee);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
};

const myScore = (award, nominee) => data.scores.find((s) => s.awardId === award.id
  && normName(s.nominee) === normName(nominee)
  && normName(s.evaluator) === normName(me.evaluator));

function progress() {
  let all = 0;
  let done = 0;
  const per = {};
  for (const award of AWARDS) {
    if (award.type !== 'scored') continue;
    const names = nomineesOf(award);
    const scored = names.filter((n) => validRatings(myScore(award, n)?.ratings, award.criteria)).length;
    per[award.id] = { all: names.length, done: scored };
    all += names.length;
    done += scored;
  }
  return { all, done, per };
}

function renderProgress() {
  const p = progress();
  $('#progress-done').textContent = p.done;
  $('#progress-all').textContent = p.all;
  $('#progress-ring').style.setProperty('--p', p.all ? p.done / p.all : 0);
  $('#award-tabs').replaceChildren(...AWARDS.map((award) => {
    const row = p.per[award.id];
    const label = award.type === 'votes'
      ? 'Votes'
      : row.all === 0 ? 'No nominee' : `${row.done}/${row.all}`;
    const complete = row && row.all > 0 && row.done === row.all;
    return el('li', {},
      el('button', {
        class: `award-tab${complete ? ' is-complete' : ''}`,
        type: 'button',
        'aria-current': award.id === current ? 'true' : null,
        onclick: () => { current = award.id; renderProgress(); renderPanel(false); },
      },
        el('span', { class: 'award-tab__title', text: award.title }),
        el('span', { class: 'award-tab__count', text: label }),
      ));
  }));
}

function ratingGroup(award, nominee, index, criterion, value, onChange) {
  const name = `r-${award.id}-${normName(nominee).replace(/[^a-z0-9]+/g, '-')}-${index}`;
  return el('fieldset', { class: 'rating' },
    el('legend', {},
      el('span', { class: 'rating__label', text: criterion.label }),
      el('span', { class: 'rating__weight', text: `${criterion.weight}%` }),
    ),
    el('div', { class: 'rating__options' }, [1, 2, 3, 4, 5].map((n) => {
      const scale = RATING_SCALE.find((r) => r.value === n).label;
      return el('label', { class: 'rating__option' },
        el('input', { type: 'radio', name, value: n, checked: value === n, onchange: () => onChange(n) }),
        el('span', { class: 'rating__dot', text: n }),
        el('span', { class: 'sr-only', text: `, ${scale}` }),
      );
    })),
  );
}

function nomineeCard(award, nominee, i) {
  // A damaged ratings cell in the sheet counts as no score.
  const stored = myScore(award, nominee);
  const saved = stored && validRatings(stored.ratings, award.criteria) ? stored : null;
  const ratings = saved ? [...saved.ratings] : award.criteria.map(() => null);
  const reasons = data.nominations.filter((n) => n.awardId === award.id && n.nominee === nominee);

  const total = el('output', { class: 'score-total__value' });
  const status = el('span', { class: 'score-status', 'aria-live': 'polite', text: saved ? 'Saved' : '' });
  const button = el('button', { class: 'btn btn--primary', type: 'submit', text: saved ? 'Update score' : 'Save score' });
  const card = el('form', { class: `nominee-score glass${saved ? ' is-saved' : ''}`, 'data-reveal': true, style: `--i:${i}`, novalidate: true });

  const refresh = () => {
    const filled = validRatings(ratings, award.criteria);
    const partial = award.criteria.reduce((sum, cr, k) => sum + ((ratings[k] || 0) / 5) * cr.weight, 0);
    total.textContent = (filled ? weightedTotal(ratings, award.criteria) : partial).toFixed(2);
    card.style.setProperty('--score', partial / 100);
    button.disabled = !filled;
  };

  card.append(
    el('header', { class: 'nominee-score__head' },
      avatar(nominee, 'staff-avatar staff-avatar--md'),
      el('h3', { text: displayName(nominee) }),
      el('span', { class: 'nominee__count', text: `${reasons.length} ${reasons.length === 1 ? 'nomination' : 'nominations'}` }),
    ),
    el('details', { class: 'reasons', open: true },
      el('summary', { text: 'Why this person' }),
      el('ul', {}, reasons.map((r) => el('li', {},
        el('p', { class: 'reasons__text', text: r.reason || 'No reason given.' }),
        el('p', { class: 'reasons__by', text: `From ${r.nominator}` }),
      ))),
    ),
    el('div', { class: 'rating-list' }, award.criteria.map((cr, k) => ratingGroup(award, nominee, k, cr, ratings[k], (n) => {
      ratings[k] = n;
      status.textContent = saved ? 'Changed, not saved' : '';
      card.classList.remove('is-saved');
      refresh();
    }))),
    el('footer', { class: 'nominee-score__foot' },
      el('p', { class: 'score-total' },
        el('span', { class: 'score-total__bar', 'aria-hidden': 'true' }, el('i')),
        total, el('span', { class: 'score-total__max', text: ' / 100' }),
      ),
      status,
      button,
    ),
  );

  card.addEventListener('submit', async (event) => {
    event.preventDefault();
    const idle = button.textContent;
    setBusy(button, true, 'Saving');
    try {
      const score = { awardId: award.id, nominee, evaluator: me.evaluator, ratings: [...ratings] };
      await saveScore(me.pin, score);
      data.scores = data.scores.filter((s) => s !== myScore(award, nominee));
      data.scores.push(score);
      status.textContent = 'Saved';
      card.classList.add('is-saved');
      card.dispatchEvent(new CustomEvent('score:saved', { bubbles: true }));
      setBusy(button, false, 'Update score');
      renderProgress();
    } catch (error) {
      status.textContent = '';
      toast(error.message === 'Failed to fetch' ? 'No connection. The score is not saved.' : error.message, 'error');
      setBusy(button, false, idle);
    }
  });

  refresh();
  return card;
}

function renderPanel(focus) {
  const award = AWARDS.find((a) => a.id === current);
  const panel = $('#score-panel');
  const head = el('header', { class: 'score-panel__head' },
    el('h2', { text: award.title }),
    el('p', { class: 'chip', text: `Coverage: ${award.coverage}` }),
  );

  if (award.type === 'votes') {
    const rows = rankVotes(award, data.nominations);
    panel.replaceChildren(head,
      el('p', { class: 'notice glass', text: 'This award is decided by valid votes. No scoring is needed.' }),
      rows.length
        ? el('ol', { class: 'tally glass' }, rows.map((r) => el('li', {},
          el('span', { class: 'tally__name', text: displayName(r.nominee) }),
          el('span', { class: 'tally__votes', text: `${r.votes} ${r.votes === 1 ? 'vote' : 'votes'}` }),
        )))
        : el('p', { class: 'empty glass', text: 'No vote yet.' }));
  } else {
    const names = nomineesOf(award);
    panel.replaceChildren(head, ...(names.length
      ? names.map((n, i) => nomineeCard(award, n, i))
      : [el('p', { class: 'empty glass', text: 'No nominee yet for this award.' })]));
  }
  reveal(panel);
  if (focus) panel.focus({ preventScroll: false });
}

async function enter(credentials) {
  data = await getCommittee(credentials.pin);
  setPhotoMap(data.photos);
  me = credentials;
  session.set(me);
  $('#gate').hidden = true;
  $('#workspace').hidden = false;
  $('#who').textContent = me.evaluator;
  const first = AWARDS.find((a) => a.type === 'scored' && nomineesOf(a).length);
  if (first) current = first.id;
  renderProgress();
  renderPanel(false);
  $('#workspace-title').focus();
}

$('#gate-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const msg = $('#gate-msg');
  const button = $('#gate-submit');
  msg.textContent = '';
  const evaluator = form.evaluator.value.trim().replace(/\s+/g, ' ');
  if (!evaluator) { msg.textContent = 'Enter your name.'; form.evaluator.focus(); return; }
  if (!form.pin.value) { msg.textContent = 'Enter the committee PIN.'; form.pin.focus(); return; }
  setBusy(button, true, 'Signing in');
  try {
    await enter({ evaluator, pin: form.pin.value });
  } catch (error) {
    msg.textContent = error.message === 'Failed to fetch' ? 'No connection to the server.' : error.message;
    form.dispatchEvent(new CustomEvent('form:error', { bubbles: true }));
  } finally {
    setBusy(button, false, 'Sign in');
  }
});

$('#sign-out').addEventListener('click', () => { session.clear(); location.reload(); });

initShell();
const saved = session.get();
if (saved?.evaluator && saved?.pin) {
  enter(saved).catch((error) => {
    // A network drop keeps the session. Only a refused PIN clears it.
    if (error.message === 'Wrong PIN.') session.clear();
    else $('#gate-msg').textContent = 'No connection to the server. Sign in again when the connection is back.';
  });
}
