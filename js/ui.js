import { DEMO } from './api.js';

// Build a DOM node. Text always goes through textContent, so user text cannot inject markup.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function toast(message, kind = 'info') {
  let host = $('.toast-host');
  if (!host) {
    host = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const node = el('div', { class: `toast toast--${kind}`, text: message });
  host.append(node);
  // An error stays longer, so the reader has time to read it.
  const life = kind === 'error' ? 9000 : 3600;
  setTimeout(() => node.classList.add('is-leaving'), life);
  setTimeout(() => node.remove(), life + 600);
}

// Elements with data-reveal get the class is-in when they enter the viewport.
const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' })
  : null;

export function reveal(root = document) {
  const nodes = root.querySelectorAll('[data-reveal]:not(.is-in)');
  nodes.forEach((node, i) => {
    node.style.setProperty('--i', String(i % 12));
    if (observer) observer.observe(node); else node.classList.add('is-in');
  });
}

export function setBusy(button, busy, label) {
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
  if (label) button.textContent = label;
}

// "ADSUARA, Sheera Joyce O." becomes "Sheera Joyce O. Adsuara" for display.
export function displayName(listName) {
  const [last, rest] = String(listName).split(/,\s*/);
  if (!rest) return listName;
  const lastNice = last.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
  return `${rest} ${lastNice}`;
}

export function initShell() {
  document.documentElement.classList.add('js');
  if (DEMO) {
    // After the skip link, so the skip link stays the first focus stop.
    const banner = el('p', {
      class: 'demo-banner',
      text: 'Demo mode: data stays in this browser.',
    });
    const skip = $('.skip-link');
    if (skip) skip.after(banner); else document.body.prepend(banner);
  }
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-nav a[href]').forEach((a) => {
    if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page');
  });
  reveal();
}

// Committee session: kept for this tab only.
const SESSION = 'nnw26-committee';
export const session = {
  get: () => { try { return JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch { return null; } },
  set: (value) => sessionStorage.setItem(SESSION, JSON.stringify(value)),
  clear: () => sessionStorage.removeItem(SESSION),
};
