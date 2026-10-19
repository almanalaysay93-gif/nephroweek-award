import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { AWARDS } from '../js/awards.js';

// Loads the Apps Script file into a sandbox. The certificate helpers need no Google services.
const CODE = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const ctx = vm.createContext({});
// Values from the sandbox use another realm's Array, so compare them as plain JSON.
const plain = (v) => JSON.parse(JSON.stringify(v));
vm.runInContext(CODE, ctx);

test('certificate award titles match the site', () => {
  for (const award of AWARDS) assert.equal(ctx.AWARD_TITLES[award.id], award.title, award.id);
  assert.equal(Object.keys(ctx.AWARD_TITLES).length, AWARDS.length);
});

test('certificate names read as the site shows them', () => {
  assert.equal(ctx.certName_('CATOTO, Genevieve U.'), 'Genevieve U. Catoto');
  assert.equal(ctx.certName_('CABAÑOG, Hermelyn Charish C.'), 'Hermelyn Charish C. Cabañog');
  assert.equal(ctx.certName_('DE LA CRUZ, Ana B.'), 'Ana B. De La Cruz');
  assert.equal(ctx.certName_('Single'), 'Single');
});

test('one certificate per winner, ties included, and a name with two awards gets two', () => {
  const winners = {
    'hd-nurse': [{ nominee: 'CATOTO, Genevieve U.', value: 90 }, { nominee: 'VALERIO, Marilou M.', value: 90 }],
    'na-extra-miler': [{ nominee: 'CATOTO, Genevieve U.', value: 80 }],
    'unknown-award': [{ nominee: 'IGNORED, Name', value: 1 }],
  };
  const recipients = ctx.certificateRecipients_(winners);
  assert.equal(recipients.length, 3);
  assert.deepEqual(plain(recipients.map((r) => r.key)), [
    'hd-nurse|catoto, genevieve u.',
    'hd-nurse|valerio, marilou m.',
    'na-extra-miler|catoto, genevieve u.',
  ]);
  assert.equal(recipients[0].award, 'Outstanding Hemodialysis Nurse');
  assert.equal(recipients[0].name, 'Genevieve U. Catoto');
});

test('every certificate gets a citation and the template ID is set', () => {
  const recipients = plain(ctx.certificateRecipients_({ 'hd-nurse': [{ nominee: 'CATOTO, Genevieve U.', value: 1 }] }));
  assert.equal(recipients[0].citation, 'For clinical skill and patient care that set the standard on the hemodialysis floor');
  for (const award of AWARDS) {
    const text = ctx.CERT_CITATIONS[award.id];
    assert.ok(text && text.startsWith('For ') && !text.endsWith('.'), award.id);
  }
  assert.equal(ctx.CERT_TEMPLATE_ID, '1Frx4kie2fDbHSvbScAcJZSXdDNQa4xIO2a17t8GrUQ0');
});

test('no winners means no certificates', () => {
  assert.deepEqual(plain(ctx.certificateRecipients_({})), []);
});
