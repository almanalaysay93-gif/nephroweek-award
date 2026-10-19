import { AWARDS, GROUPS, RATING_SCALE, awardById } from './awards.js';
import { NURSES, ATTENDANTS } from './staff.js';
import { getState, nominate, eligibleFor } from './api.js';
import { el, $, initShell, toast, setBusy, displayName } from './ui.js';
import { avatar, setPhotoMap } from './photos.js';

const award = awardById(new URLSearchParams(location.search).get('id'));
if (!award) location.replace('index.html#awards');

const isVote = award?.type === 'votes';

function renderHero() {
  const index = AWARDS.indexOf(award);
  document.title = `${award.title} | Nephrology Nurses Week 2026`;
  $('#award-group').textContent = GROUPS[award.group].label;
  $('#award-title').textContent = award.title;
  $('#award-coverage').textContent = `Coverage: ${award.coverage}`;
  $('#award-type').textContent = isVote ? 'Decided by votes' : 'Scored by the committee';
  $('#award-blurb').textContent = award.blurb;
  $('#award-index').textContent = String(index + 1).padStart(2, '0');

  const pager = $('.award-pager');
  // The Patient Choice page is for patients, so it hides the links to the other pages.
  const mainNav = $('.site-nav nav');
  if (mainNav) mainNav.hidden = award.id === 'patient-choice';
  if (pager) {
    if (award.id === 'patient-choice') {
      pager.hidden = true;
    } else {
      pager.hidden = false;
      const pagerAwards = AWARDS.filter((a) => a.id !== 'patient-choice');
      const pagerIndex = pagerAwards.indexOf(award);
      if (pagerIndex !== -1) {
        const prev = pagerAwards[(pagerIndex - 1 + pagerAwards.length) % pagerAwards.length];
        const next = pagerAwards[(pagerIndex + 1) % pagerAwards.length];
        for (const [sel, a] of [['#pager-prev', prev], ['#pager-next', next]]) {
          $(sel).href = `award.html?id=${a.id}`;
          $(`${sel} b`).textContent = a.title;
        }
      }
    }
  }
}

function renderCriteria() {
  $('#criteria-list').replaceChildren(...award.criteria.map((cr, i) => el('li', { class: 'criterion', style: `--i:${i}` },
    el('span', { class: 'criterion__label', text: cr.label }),
    el('span', { class: 'criterion__weight', text: `${cr.weight}%` }),
    el('span', { class: 'criterion__bar', 'aria-hidden': 'true' }, el('i', { style: `--w:${cr.weight}` })),
  )));
  $('#criteria-note').textContent = isVote
    ? 'One name gives one vote for this award. The nominee with the most valid votes receives the award.'
    : `Each evaluator rates every criterion from 1 (${RATING_SCALE[4].label}) to 5 (${RATING_SCALE[0].label}). A rating of 5 earns the full weight, so the highest total is 100. The final score is the average of all evaluators.`;
}

function renderForm() {
  const eligible = eligibleFor(award);
  $('#nominee').append(...eligible.map((name) => el('option', { value: name, text: name })));
  $('#nominee-label').textContent = isVote ? 'Your vote' : `Nominee (${GROUPS[award.group].noun})`;
  $('#nominate-title').textContent = isVote ? 'Vote' : 'Nominate';
  $('#nominate-submit').textContent = isVote ? 'Send vote' : 'Send nomination';
  $('#reason-field').hidden = isVote;
  $('#nominee').addEventListener('change', showNomineePreview);

  if (award.voter === 'patient') {
    $('#nominator-label').textContent = 'Your name (patient)';
    $('#nominator-hint').textContent = 'Only the committee sees your name. It is used to count one vote for each patient.';
    $('#nominator').removeAttribute('list');
  } else {
    $('#nominator-hint').textContent = 'Only the committee sees who nominated.';
    $('#staff-names').append(...[...NURSES, ...ATTENDANTS].map((name) => el('option', { value: name })));
  }

  $('#nominate-form').addEventListener('submit', onSubmit);
}

// The public award page no longer lists nominees. The committee sees them on evaluate.html.
function renderNominees(list) {
  if (!$('#nominee-list')) return;
  const rows = [...list].sort((a, b) => a.nominee.localeCompare(b.nominee));
  $('#nominees-title').textContent = isVote ? 'Names with votes' : 'Nominees so far';
  $('#nominee-list').replaceChildren(...(rows.length
    ? rows.map((r, i) => el('li', { class: 'nominee', style: `--i:${i}` },
      el('span', { class: 'nominee__avatar', 'aria-hidden': 'true', text: r.nominee.charAt(0) }),
      el('span', { class: 'nominee__name', text: displayName(r.nominee) }),
      // Vote counts stay hidden until the committee publishes, so the vote stays fair.
      isVote ? null : el('span', { class: 'nominee__count', text: `${r.count} ${r.count === 1 ? 'nomination' : 'nominations'}` }),
    ))
    : [el('li', { class: 'nominee nominee--empty', text: isVote ? 'No vote yet. Yours can be the first.' : 'No nominee yet. Yours can be the first.' })]));
}

function renderWinner(winners) {
  const rows = winners && winners[award.id];
  const box = $('#winner');
  if (!rows || !rows.length) { box.hidden = true; return; }
  $('#winner-title').textContent = rows.length > 1 ? 'Awardees (tie)' : 'Awardee';
  $('#winner-names').replaceChildren(...rows.map((r) => el('div', { class: 'winner__person' }, avatar(r.nominee, 'staff-avatar staff-avatar--xl'), el('h2', { class: 'winner__name', text: displayName(r.nominee) }))));
  $('#winner-score').textContent = rows[0].basis === 'nominations'
    ? `${rows[0].value} ${rows[0].value === 1 ? 'nomination' : 'nominations'} · No committee scores submitted by the deadline`
    : isVote
    ? `${rows[0].value} valid ${rows[0].value === 1 ? 'vote' : 'votes'}`
    : `Final score ${rows[0].value.toFixed(2)} of 100`;
  box.hidden = false;
  const play = () => box.dispatchEvent(new CustomEvent('winner:reveal', { bubbles: true }));
  $('#winner-replay').onclick = play;
  requestAnimationFrame(play);
  // The award is decided, so the form closes.
  $('.nominate').hidden = true;
  $('.award-layout').classList.add('is-closed');
}

// The photo and name of the chosen nominee, shown under the dropdown.
function showNomineePreview() {
  const name = $('#nominee').value;
  $('#nominee-preview').hidden = !name;
  $('#nominee-preview').replaceChildren(...(name
    ? [avatar(name, 'staff-avatar staff-avatar--xl'), el('span', { class: 'nominee-preview__name', text: displayName(name) })]
    : []));
}

async function onSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('#nominate-submit');
  const msg = $('#form-msg');
  msg.textContent = '';
  const idle = button.textContent;
  setBusy(button, true, 'Sending');
  try {
    const state = await nominate({
      awardId: award.id,
      nominator: form.nominator.value,
      nominee: form.nominee.value,
      reason: form.reason.value,
    });
    renderNominees(state.nominees[award.id] || []);
    // Keep the name, so a second nomination for another award needs no retyping.
    form.nominee.value = '';
    showNomineePreview();
    form.reason.value = '';
    toast(isVote ? 'Vote received. Thank you.' : 'Nomination received. Thank you.', 'success');
    form.dispatchEvent(new CustomEvent('form:success', { bubbles: true }));
  } catch (error) {
    msg.textContent = error.message === 'Failed to fetch'
      ? 'No connection to the server. Check the internet and send again.'
      : error.message;
    form.dispatchEvent(new CustomEvent('form:error', { bubbles: true }));
  } finally {
    setBusy(button, false, idle);
  }
}

// After the close: no nominations or votes. A posted winner already hides the form (renderWinner).
function renderClosed() {
  const form = $('#nominate-form');
  if (!form || $('.nominate').hidden) return;
  form.hidden = true;
  $('#nominate-title').textContent = 'Voting closed';
  form.after(el('p', { class: 'glass notice', text: `Voting closed on 20 October 2026, 12:00 noon Manila time. Winners are announced on 23 October 2026, 12:00 noon Manila time, on this page and on the home page.` }));
}

async function load() {
  const list = $('#nominee-list');
  if (list) list.replaceChildren(el('li', { class: 'nominee nominee--loading', text: 'Loading nominees' }));
  try {
    const state = await getState();
    setPhotoMap(state.photos);
    renderNominees(state.nominees[award.id] || []);
    renderWinner(state.winners);
    if (state.closedByAward?.[award.id] ?? state.closed) renderClosed();
  } catch {
    if (!list) return;
    list.replaceChildren(el('li', { class: 'nominee nominee--error' },
      'The list did not load. ',
      el('button', { class: 'link-btn', type: 'button', onclick: load, text: 'Try again' }),
    ));
  }
}

if (award) {
  renderHero();
  renderCriteria();
  renderForm();
  initShell();
  load();
}
