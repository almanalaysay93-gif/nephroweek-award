import { AWARDS, GROUPS } from './awards.js';
import { getState } from './api.js';
import { el, $, initShell, reveal } from './ui.js';

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

async function loadCounts() {
  try {
    const { nominees, winners } = await getState();
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
