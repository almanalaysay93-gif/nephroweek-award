import { el } from './ui.js';
import { photoFor } from './photo-map.js';

// Staff photos with initials as the fallback. The map comes from the backend's `photos` field.
let photoMap = {};
export const setPhotoMap = (map) => { photoMap = map || {}; };

// A photo when one exists. A broken link falls back to initials, so the layout never breaks.
export function avatar(name, cls = 'staff-avatar') {
  const initials = el('span', { class: cls, 'aria-hidden': 'true', text: String(name || '?').trim().charAt(0) });
  const src = photoFor(photoMap, name);
  if (!src) return initials;
  const img = el('img', { class: cls, src, alt: '', loading: 'lazy', width: 256, height: 256 });
  img.addEventListener('error', () => img.replaceWith(initials), { once: true });
  return img;
}
