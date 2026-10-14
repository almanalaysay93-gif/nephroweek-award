import test from 'node:test';
import assert from 'node:assert/strict';
import { photoKey, buildPhotoMap, photoFor, thumbUrl } from '../js/photo-map.js';

test('name key ignores case, accents, and spacing', () => {
  assert.equal(photoKey('CABAÑOG,  Charish '), photoKey('cabanog, charish'));
  assert.equal(photoKey('Pacaña, Nel'), 'pacana, nel');
});

test('photo is found for the same person in any spelling', () => {
  const map = buildPhotoMap([{ name: 'VALERIO, Marilou M.', fileId: 'abc' }]);
  assert.equal(photoFor(map, 'valerio, marilou m.'), thumbUrl('abc'));
  assert.equal(photoFor(map, 'Valerio,  Marilou M.'), thumbUrl('abc'));
});

test('override name wins as the lookup key', () => {
  const map = buildPhotoMap([{ name: 'MACPAO, Raymundo M.', fileId: 'x1', override: 'MACPAO, Reymundo' }]);
  assert.equal(photoFor(map, 'MACPAO, Reymundo'), thumbUrl('x1'));
  assert.equal(photoFor(map, 'MACPAO, Raymundo M.'), null);
});

test('no row, empty file id, or unknown name gives no photo (initials)', () => {
  const map = buildPhotoMap([{ name: 'LIM, Bo', fileId: '' }, { name: 'CRUZ, Ana', fileId: 'c1' }]);
  assert.equal(photoFor(map, 'LIM, Bo'), null);
  assert.equal(photoFor(map, 'Unknown, Person'), null);
  assert.equal(photoFor(undefined, 'CRUZ, Ana'), null);
});

test('first row for a name wins; duplicate rows do not overwrite it', () => {
  const map = buildPhotoMap([{ name: 'CRUZ, Ana', fileId: 'first' }, { name: 'cruz,  ana', fileId: 'second' }]);
  assert.equal(map[photoKey('CRUZ, Ana')], 'first');
});
