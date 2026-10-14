// Pure photo lookup. No DOM, so Node can test it. Used by js/photos.js.

// Same name rule as the duplicate fix: case, accents, and spacing do not make a new person.
export const photoKey = (name) =>
  String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

// rows: [{ name, fileId, override }]. The override name, when set, is the key the site uses.
export function buildPhotoMap(rows) {
  const map = {};
  for (const r of rows || []) {
    const id = String(r.fileId || '').trim();
    if (!id) continue;
    const key = photoKey(r.override || r.name);
    if (key && !map[key]) map[key] = id;
  }
  return map;
}

// Drive's thumbnail service returns a resized image. Public files only.
export const thumbUrl = (fileId, size = 256) =>
  `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;

export function photoFor(map, name) {
  const id = map && map[photoKey(name)];
  return id ? thumbUrl(id) : null;
}
