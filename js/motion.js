// Motion layer. Runs on every page and never throws when an element is missing.
// Owns reveal completion, pointer tilt, aurora parallax, winner confetti and controls, and feedback flashes.

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const REVEAL_FALLBACK_MS = 1600;
const CONFETTI_COUNT = 40;
const CONFETTI_SHAPES = ['confetti--chip', 'confetti--streamer', 'confetti--spark'];
const CONFETTI_GOLD = ['var(--gold-300)', 'var(--gold-400)', 'var(--gold-500)', 'var(--gold-600)'];
const STAGGER = '.nominee, .award-tab';
const TILT_DEG = 5;

const rand = (min, max) => min + Math.random() * (max - min);
const isEl = (node) => node instanceof Element;
const clamp01 = (value) => Math.min(1, Math.max(0, value));

// ---- Reveals ---------------------------------------------------------

const timed = new WeakSet();

function markDone(node) {
  node.classList.add('is-done');
}

// Mark a reveal done after its transition, or after a fallback delay.
function watchReveal(node) {
  if (!node.matches('[data-reveal].is-in') || node.classList.contains('is-done') || timed.has(node)) return;
  timed.add(node);
  setTimeout(() => markDone(node), REVEAL_FALLBACK_MS);
}

// Give award rows and tabs a stagger index, unless the page already set one.
function setStagger(node) {
  if (node.style.getPropertyValue('--i')) return;
  const row = node.closest('li') || node;
  const parent = row.parentElement;
  if (!parent) return;
  node.style.setProperty('--i', String([...parent.children].indexOf(row)));
}

function scan(root) {
  const reveals = root.matches('[data-reveal]') ? [root] : [];
  for (const node of [...reveals, ...root.querySelectorAll('[data-reveal]')]) {
    if (reduce) markDone(node);
    else watchReveal(node);
  }
  const rows = root.matches(STAGGER) ? [root] : [];
  for (const node of [...rows, ...root.querySelectorAll(STAGGER)]) setStagger(node);
}

function initReveals() {
  scan(document.body);
  document.addEventListener('transitionend', (event) => {
    const node = event.target;
    if (event.propertyName === 'transform' && isEl(node) && node.matches('[data-reveal].is-in')) {
      markDone(node);
    }
  });
}

// Watch class changes and new nodes, so later reveals and rows are handled too.
function observeDom() {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (isEl(record.target)) watchReveal(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (isEl(node)) scan(node);
      }
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
}

// ---- Pointer tilt ----------------------------------------------------

function initTilt() {
  if (reduce || !fine) return;

  let frame = 0;
  let pending = null;

  const apply = () => {
    frame = 0;
    if (!pending) return;
    const { card, x, y } = pending;
    card.style.setProperty('--rx', `${((0.5 - y) * TILT_DEG * 2).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((x - 0.5) * TILT_DEG * 2).toFixed(2)}deg`);
  };

  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const card = isEl(event.target) ? event.target.closest('[data-tilt]') : null;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pending = {
      card,
      x: clamp01((event.clientX - rect.left) / rect.width),
      y: clamp01((event.clientY - rect.top) / rect.height),
    };
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });

  document.addEventListener('pointerout', (event) => {
    const card = isEl(event.target) ? event.target.closest('[data-tilt]') : null;
    if (!card || card.contains(event.relatedTarget)) return;
    if (pending && pending.card === card) pending = null;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}

// ---- Aurora parallax -------------------------------------------------

function initAurora() {
  const aurora = document.querySelector('.aurora');
  if (!aurora || reduce) return;

  let frame = 0;
  const write = () => {
    frame = 0;
    // Unitless on purpose: motion.css multiplies it by -0.04px.
    aurora.style.setProperty('--scroll', String(window.scrollY));
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(write);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  write();
}

// ---- Winner reveal ---------------------------------------------------

// Replay restarts the entrance. It also clears a pause, so a paused entrance cannot leave the card hidden.
function revealWinner(box) {
  box.classList.remove('is-paused');
  const pause = box.querySelector('#winner-pause');
  if (pause) setPauseLabel(pause, false);
  box.classList.remove('is-revealing');
  void box.offsetWidth;
  box.classList.add('is-revealing');
}

function setPauseLabel(button, paused) {
  button.setAttribute('aria-pressed', String(paused));
  button.textContent = paused ? 'Play animation' : 'Pause animation';
}

// The confetti pool is created once. CSS keeps it falling, so replay never adds or removes spans.
let confettiReady = false;

function initConfetti() {
  const burst = document.querySelector('#winner .winner__burst');
  if (!burst || reduce || confettiReady) return;
  confettiReady = true;

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < CONFETTI_COUNT; i += 1) {
    const piece = document.createElement('span');
    piece.className = `confetti ${CONFETTI_SHAPES[i % CONFETTI_SHAPES.length]}`;
    // One piece in eight is brand blue, so the site colour still shows.
    piece.style.setProperty('--c', i % 8 === 7 ? 'var(--brand-300)' : CONFETTI_GOLD[i % CONFETTI_GOLD.length]);
    piece.style.left = `${rand(3, 97).toFixed(1)}%`;
    const duration = rand(4, 8);
    piece.style.setProperty('--d', `${duration.toFixed(2)}s`);
    // A negative delay starts each piece part way down, so the stream is already falling.
    piece.style.setProperty('--delay', `${(-rand(0, duration)).toFixed(2)}s`);
    piece.style.setProperty('--drift', `${Math.round(rand(-40, 40))}px`);
    piece.style.setProperty('--spin', `${Math.round(rand(180, 540))}deg`);
    fragment.append(piece);
  }
  burst.append(fragment);
}

// Pause button (event delegation, so it works after any re-render) and the off-screen stop.
function initWinnerControls() {
  document.addEventListener('click', (event) => {
    const button = isEl(event.target) ? event.target.closest('#winner-pause') : null;
    const box = button ? button.closest('.winner') : null;
    if (!box) return;
    setPauseLabel(button, box.classList.toggle('is-paused'));
  });

  const winner = document.querySelector('#winner');
  if (!winner || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) winner.classList.toggle('is-offscreen', !entry.isIntersecting);
  });
  observer.observe(winner);
}

// ---- Feedback flashes ------------------------------------------------

// Add a class to the nearest .glass ancestor, or the target itself, and remove it when the animation ends.
function flash(event, cls) {
  if (reduce) return;
  const target = isEl(event.target) ? event.target : null;
  const node = target && (target.closest('.glass') || target);
  if (!node) return;

  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);

  node.addEventListener('animationend', function onEnd(end) {
    if (end.target !== node) return;
    node.removeEventListener('animationend', onEnd);
    node.classList.remove(cls);
  });
}

// ---- Start -----------------------------------------------------------

function init() {
  observeDom();
  initReveals();
  initTilt();
  initAurora();
  initConfetti();
  initWinnerControls();

  document.addEventListener('winner:reveal', (event) => {
    const box = isEl(event.target) ? event.target.closest('.winner') : null;
    if (box) revealWinner(box);
  });

  document.addEventListener('form:error', (event) => flash(event, 'is-shaking'));
  document.addEventListener('form:success', (event) => flash(event, 'is-pulsing'));
  document.addEventListener('score:saved', (event) => flash(event, 'is-pulsing'));
}

init();
