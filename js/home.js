import { AWARDS, GROUPS } from './awards.js?v=20261019-patient-tech';
import { getState } from './api.js';
import { el, $, initShell, reveal, displayName } from './ui.js';
import { mountRing } from './ring.js';
import { avatar, setPhotoMap } from './photos.js';

const CLOSE_LABEL = '20 October 2026, 12:00 noon Manila time';
const ANNOUNCE_LABEL = '23 October 2026, 12:00 noon Manila time';

function awardCard(award, index) {
  return el('a', { class: 'award-card glass', href: `award.html?id=${award.id}`, 'data-reveal': true, 'data-tilt': true },
    el('span', { class: 'award-card__index', 'aria-hidden': 'true', text: String(index).padStart(2, '0') }),
    el('h3', { class: 'award-card__title', text: award.title }),
    el('p', { class: 'award-card__coverage', text: award.coverage }),
    el('p', { class: 'award-card__blurb', text: award.blurb }),
    el('p', { class: 'award-card__meta' },
      el('span', { class: `chip chip--${award.type}`, text: award.type === 'votes' ? 'By votes' : 'Open for nominations' }),
      el('span', { class: 'award-card__count', 'data-count': award.id, text: '' }),
    ),
    el('span', { class: 'award-card__go', 'aria-hidden': 'true', text: 'Open' }),
  );
}

function render() {
  const host = $('#awards');
  host.querySelector('noscript')?.remove();
  let index = 0;
  for (const [key, group] of Object.entries(GROUPS)) {
    const awards = AWARDS.filter((a) => a.group === key);
    host.append(el('section', { class: 'award-group', 'aria-labelledby': `group-${key}` },
      el('h2', { class: 'section-title', id: `group-${key}`, 'data-reveal': true, text: group.label }),
      el('p', { class: 'section-note', 'data-reveal': true, text: `${awards.length} awards` }),
      el('div', { class: 'award-grid' }, awards.map((a) => awardCard(a, ++index))),
    ));
  }
  reveal(host);
}

function awardeeCard(award, rows) {
  return el('a', { class: 'awardee-card glass', href: `award.html?id=${award.id}`, 'data-reveal': true },
    el('p', { class: 'awardee-card__award', text: award.title }),
    el('ul', { class: 'awardee-card__names' }, rows.map((r) => el('li', {}, avatar(r.nominee, 'staff-avatar staff-avatar--lg'), el('span', { text: displayName(r.nominee) })))),
  );
}

// Winners come from the public state. Ties show every name on one card.
function renderAwardees({ winners, closed, announced }) {
  const grid = $('#awardees-grid');
  const none = $('#awardees-none');
  const won = AWARDS.filter((a) => winners && winners[a.id] && winners[a.id].length);
  const cards = won.map((a) => awardeeCard(a, winners[a.id]));
  // 3D ring when motion is allowed. Reduced-motion visitors keep the flat grid.
  const ring = mountRing(grid, cards, { label: 'Awardees' });
  grid.classList.toggle('awardees__grid--ring', ring);
  if (!ring) grid.replaceChildren(...cards);
  $('#awardees-note').textContent = announced
    ? 'Winners of the Nephrology Nurses Week 2026 awards.'
    : closed
      ? `Voting closed on ${CLOSE_LABEL}. Winners are announced on ${ANNOUNCE_LABEL}.`
      : `Voting for all awards closes on ${CLOSE_LABEL}. Winners are announced on ${ANNOUNCE_LABEL}.`;
  const missing = announced ? AWARDS.filter((a) => !won.includes(a)) : [];
  none.hidden = missing.length === 0;
  none.textContent = missing.length ? 'No awardee: ' + missing.map((a) => a.title).join(', ') + '.' : '';
  reveal(grid);
}

async function loadCounts() {
  try {
    const state = await getState();
    setPhotoMap(state.photos);
    const { nominees, winners } = state;
    renderAwardees(state);
    for (const node of document.querySelectorAll('[data-count]')) {
      const id = node.dataset.count;
      const n = (nominees[id] || []).length;
      node.textContent = winners && winners[id]?.length
        ? 'Awardee announced'
        : n === 0 ? 'No nominee yet' : `${n} ${n === 1 ? 'nominee' : 'nominees'}`;
    }
  } catch {
    // The counts are a convenience. The cards still work without them.
  }
}

initShell();
render();
loadCounts();

// How-to video: start when it scrolls into view, since some browsers block autoplay for off-screen media.
const howTo = document.querySelector('.video-how video');
if (howTo) {
  howTo.muted = true;
  const start = () => howTo.play().catch(() => {});
  start();
  if ('IntersectionObserver' in window) {
    const watch = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) start();
    }, { threshold: 0.35 });
    watch.observe(howTo);
  }
}
