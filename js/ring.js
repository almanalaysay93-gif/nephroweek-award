import { el } from './ui.js';

// A 3D ring of cards. The ring turns one card at a time, and the front card holds in the middle.
// The pointer tilts the whole ring, so the text layers on each card shift with depth.
// Drag, swipe, or the arrow keys turn it by hand.
// Returns false with nothing mounted for reduced-motion visitors, so the caller keeps its flat grid.
export function mountRing(host, items, { label = 'Cards', hold = 3600 } = {}) {
  const n = items.length;
  if (!n || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;

  const step = 360 / n;
  const wraps = items.map((node, i) => {
    node.removeAttribute('data-reveal'); // the ring owns the entrance; a hidden back card must not stay at opacity 0
    return el('div', { class: 'ring__item' }, el('div', { class: 'ring__float', style: `--i:${i}` }, node));
  });
  const spin = el('div', { class: 'ring__spin' }, wraps);
  const tilt = el('div', { class: 'ring__tilt' }, spin);
  const scene = el('div', { class: 'ring__scene' }, el('div', { class: 'ring__floor', 'aria-hidden': 'true' }), tilt);
  const root = el('section', { class: 'ring', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': label, tabindex: '0' }, scene);
  host.replaceChildren(root);

  let radius = 0;
  let index = 0; // unbounded, so the ring always turns the short way
  let angle = 0;
  let target = 0;
  let tiltX = 0;
  let tiltY = 0;
  let tiltToX = 0;
  let tiltToY = 0;
  let drag = null;
  let justDragged = false;
  let hover = false;
  let focus = false;
  let timer = 0;
  let raf = 0;
  let inView = false; // idle motion runs only while the ring is on screen

  const mod = (x) => ((x % n) + n) % n;
  // One pixel of drag moves the front card by one pixel along its arc.
  const degPerPx = () => 57.3 / Math.max(radius, 220);

  function paint() {
    // Idle sway: the whole ring rocks a little, and each card rises and sinks in depth as it passes the middle.
    const t = performance.now();
    const sway = inView && !drag ? Math.sin(t * 0.00055) * 1.4 : 0;
    spin.style.transform = `translateZ(${(-radius).toFixed(1)}px) rotateY(${(angle + sway).toFixed(3)}deg)`;
    tilt.style.transform = `rotateX(${tiltY.toFixed(3)}deg) rotateY(${tiltX.toFixed(3)}deg)`;
    const front = mod(Math.round(-angle / step));
    wraps.forEach((item, i) => {
      let rel = (i * step + angle) % 360;
      if (rel > 180) rel -= 360;
      if (rel < -180) rel += 360;
      const f = Math.max(0, 1 - Math.abs(rel) / step);
      item.style.setProperty('--f', f.toFixed(3));
      item.style.setProperty('--z', (inView ? Math.sin(t * 0.0009 + i * 1.1) * 12 * (0.35 + f) : 0).toFixed(2) + 'px');
      item.classList.toggle('is-front', i === front);
      item.inert = i !== front;
    });
  }

  function measure() {
    const w = wraps[0].offsetWidth;
    if (!w) return;
    radius = n === 1 ? 0 : n === 2 ? w * 0.62 : Math.max((w / 2) / Math.tan(Math.PI / n) + 70, w * 0.95);
    wraps.forEach((item, i) => {
      item.style.transform = `translate(-50%, -50%) rotateY(${i * step}deg) translateZ(${radius.toFixed(1)}px)`;
    });
    const tallest = Math.max(...wraps.map((item) => item.offsetHeight));
    scene.style.height = `${Math.ceil(tallest * 1.25 + 110)}px`;
    paint();
  }

  function frame() {
    raf = 0;
    let busy = false;
    if (!drag) {
      const d = target - angle;
      if (Math.abs(d) > 0.01) { angle += d * 0.09; busy = true; } else angle = target;
    }
    const dx = tiltToX - tiltX;
    const dy = tiltToY - tiltY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) { tiltX += dx * 0.1; tiltY += dy * 0.1; busy = true; }
    paint();
    if (busy || drag || inView) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function go(to) {
    index = to;
    target = -index * step;
    kick();
  }

  function sync() {
    clearInterval(timer);
    timer = 0;
    if (n < 2 || hover || focus || drag) return;
    timer = setInterval(() => go(index + 1), hold);
  }

  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); sync(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); sync(); }
  });
  root.addEventListener('pointerenter', () => { hover = true; sync(); });
  root.addEventListener('pointerleave', () => { hover = false; tiltToX = 0; tiltToY = 0; kick(); sync(); });
  root.addEventListener('focusin', () => { focus = true; sync(); });
  root.addEventListener('focusout', () => { focus = false; sync(); });

  // Pointer parallax: a fine pointer tilts the ring a few degrees.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    root.addEventListener('pointermove', (e) => {
      if (drag) return;
      const r = scene.getBoundingClientRect();
      const px = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
      const py = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)));
      tiltToX = px * 7;
      tiltToY = -py * 5;
      kick();
    });
  }

  // Drag or swipe. On release the ring settles on the nearest card, with a little throw.
  scene.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || n < 2) return;
    drag = { x: e.clientX, from: angle, moved: false, lastX: e.clientX, lastT: performance.now(), v: 0 };
    root.classList.add('is-dragging');
    sync();
    const move = (ev) => {
      const dx = ev.clientX - drag.x;
      if (Math.abs(dx) > 5) drag.moved = true;
      const now = performance.now();
      drag.v = (ev.clientX - drag.lastX) / Math.max(1, now - drag.lastT);
      drag.lastX = ev.clientX;
      drag.lastT = now;
      angle = drag.from + dx * degPerPx();
      kick();
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const thrown = angle + drag.v * 180 * degPerPx();
      justDragged = drag.moved;
      if (justDragged) setTimeout(() => { justDragged = false; }, 0);
      drag = null;
      root.classList.remove('is-dragging');
      go(Math.round(-thrown / step));
      sync();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
  // A drag must not open the card link under the pointer.
  scene.addEventListener('click', (e) => {
    if (justDragged) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; kick(); }).observe(root);
  new ResizeObserver(measure).observe(root);
  wraps.forEach((item) => new ResizeObserver(measure).observe(item));

  measure();
  sync();
  return true;
}
