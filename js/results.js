import { AWARDS } from './awards.js';
import { getCommittee, publishWinners } from './api.js';
import { rankScored, rankVotes, normName } from './scoring.js';
import { el, $, initShell, toast, setBusy, displayName, reveal, session } from './ui.js';
import { avatar, setPhotoMap } from './photos.js';

let pin = null;
let username = null;
let data = null;

function ranking(award) {
  if (award.type === 'votes') {
    return rankVotes(award, data.nominations).map((r) => ({ ...r, value: r.votes }));
  }
  const seen = new Map();
  data.nominations.filter((n) => n.awardId === award.id).forEach((n) => {
    const key = normName(n.nominee);
    if (!seen.has(key)) seen.set(key, n.nominee);
  });
  const names = [...seen.values()];
  return rankScored(award, names, data.scores).map((r) => ({ ...r, value: r.average }));
}

// The snapshot that the public award pages show: every nominee at rank 1.
function winnersSnapshot() {
  const winners = {};
  for (const award of AWARDS) {
    const top = ranking(award).filter((r) => r.rank === 1);
    if (top.length) winners[award.id] = top.map((r) => ({ nominee: r.nominee, value: r.value }));
  }
  return winners;
}

function awardResult(award, i) {
  const rows = ranking(award);
  const isVote = award.type === 'votes';
  const unscored = rows.filter((r) => r.rank === null).length;
  return el('section', { class: 'result-card glass', 'data-reveal': true, style: `--i:${i}` },
    el('header', { class: 'result-card__head' },
      el('h2', {}, el('a', { href: `award.html?id=${award.id}`, text: award.title })),
      el('p', { class: 'chip', text: isVote ? 'By votes' : 'Scored' }),
    ),
    rows.length
      ? el('table', { class: 'result-table' },
        el('caption', { class: 'sr-only', text: `Ranking for ${award.title}` }),
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col', text: 'Rank' }),
          el('th', { scope: 'col', text: 'Nominee' }),
          el('th', { scope: 'col', class: 'num', text: isVote ? 'Votes' : 'Score' }),
          isVote ? null : el('th', { scope: 'col', class: 'num', text: 'Evaluators' }),
        )),
        el('tbody', {}, rows.map((r) => el('tr', { class: r.rank === 1 ? 'is-top' : null },
          el('td', { text: r.rank ?? 'n/a' }),
          el('th', { scope: 'row' }, el('span', { class: 'result-name' }, avatar(r.nominee, 'staff-avatar staff-avatar--sm'), displayName(r.nominee))),
          el('td', { class: 'num', text: r.value === null ? 'Not scored' : isVote ? r.value : r.value.toFixed(2) }),
          isVote ? null : el('td', { class: 'num', text: r.evaluators }),
        ))))
      : el('p', { class: 'empty', text: isVote ? 'No vote yet.' : 'No nominee yet.' }),
    unscored ? el('p', { class: 'result-card__warn', text: `${unscored} ${unscored === 1 ? 'nominee has' : 'nominees have'} no score yet.` }) : null,
    rows.filter((r) => r.rank === 1).length > 1
      ? el('p', { class: 'result-card__warn', text: 'Tie at rank 1. The committee decides, or both names are published.' })
      : null,
  );
}

function render() {
  const evaluators = new Set(data.scores.map((s) => normName(s.evaluator))).size;
  $('#results-summary').textContent = `${data.nominations.length} nominations and votes, ${data.scores.length} score sheets from ${evaluators} ${evaluators === 1 ? 'evaluator' : 'evaluators'}.`;
  const grid = $('#results-grid');
  grid.replaceChildren(...AWARDS.map(awardResult));
  reveal(grid);

  const log = data.closeLog;
  $('#close-info').textContent = 'Patient Choice voting closes 20 October 2026, 12:00 noon Manila time. Voting for all other awards closes 19 October 2026, 12:00 noon Manila time. Winners are posted on 23 October 2026, 12:00 noon Manila time. '
    + (log
      ? `Last timer run: ${log.status} at ${new Date(log.at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}. ${log.message}`
      : 'The timer has not run yet.');
  const live = !!data.winners;
  $('#publish-state').textContent = live
    ? 'Awardees are published. Each award page shows its awardee.'
    : 'Awardees are not published. Award pages show nominees only.';
  $('#publish-btn').textContent = live ? 'Unpublish awardees' : 'Publish awardees';
}

async function load() {
  data = await getCommittee(pin, username);
  setPhotoMap(data.photos);
  render();
}

$('#gate-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const msg = $('#gate-msg');
  const button = $('#gate-submit');
  msg.textContent = '';
  if (!form.username.value.trim()) { msg.textContent = 'Enter your username.'; form.username.focus(); return; }
  if (!form.pin.value) { msg.textContent = 'Enter the committee PIN.'; form.pin.focus(); return; }
  setBusy(button, true, 'Opening');
  try {
    username = form.username.value.trim();
    pin = form.pin.value;
    await load();
    session.set({ ...(session.get() || {}), username, pin });
    $('#gate').hidden = true;
    $('#results').hidden = false;
    $('#results-title').focus();
  } catch (error) {
    pin = null;
    msg.textContent = error.message === 'Failed to fetch' ? 'No connection to the server.' : error.message;
    form.dispatchEvent(new CustomEvent('form:error', { bubbles: true }));
  } finally {
    setBusy(button, false, 'Open the tally');
  }
});

$('#publish-btn').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  const idle = button.textContent;
  setBusy(button, true, 'Working');
  try {
    // Read fresh data first, so the snapshot matches the newest scores.
    data = await getCommittee(pin, username);
    const next = data.winners ? null : winnersSnapshot();
    if (next && !Object.keys(next).length) throw new Error('No award has a ranked nominee yet.');
    await publishWinners(pin, next, username);
    data.winners = next;
    render();
    toast(next ? 'Awardees published.' : 'Awardees unpublished.', 'success');
  } catch (error) {
    button.textContent = idle;
    toast(error.message, 'error');
  } finally {
    button.disabled = false;
    button.classList.remove('is-busy');
  }
});

$('#refresh-btn').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  setBusy(button, true);
  try { await load(); toast('Tally refreshed.', 'success'); } catch (error) { toast(error.message, 'error'); }
  setBusy(button, false);
});

initShell();
const saved = session.get();
if (saved?.username && saved?.pin) {
  username = saved.username;
  pin = saved.pin;
  load().then(() => { $('#gate').hidden = true; $('#results').hidden = false; }).catch(() => { pin = null; });
}
