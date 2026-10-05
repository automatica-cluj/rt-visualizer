// Fiecare text din index.html marcat cu data-i18n trebuie să aibă traducere în engleză.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

require('../js/i18n.js');
const I = globalThis.RTI18N;
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('toate cheile din index.html au text în engleză', () => {
  const keys = [...html.matchAll(/data-i18n(?:-title|-aria)?="([^"]+)"/g)].map(m => m[1]);
  assert.ok(keys.length > 150);
  const missing = keys.filter(k => I.EN[k] === undefined);
  assert.deepEqual(missing, []);
});

test('dicționarul englez nu are chei care nu mai există în pagină', () => {
  const used = new Set([...html.matchAll(/data-i18n(?:-title|-aria)?="([^"]+)"/g)].map(m => m[1]));
  assert.deepEqual(Object.keys(I.EN).filter(k => !used.has(k)), []);
});

test('textul englez nu conține diacritice românești', () => {
  const ro = Object.entries(I.EN).filter(([k, v]) => /[ăâîșțĂÂÎȘȚ]/.test(v) && k !== 'help.30');
  assert.deepEqual(ro, []);
});

test('perechile L(ro, en) și formatul numerelor urmează limba aleasă', () => {
  I.set('en');
  assert.equal(I.L('da', 'yes'), 'yes');
  assert.equal(I.num(0.5, 2), '0.50');
  assert.equal(I.tr({ ro: 'senzor', en: 'sensor' }), 'sensor');
  I.set('ro');
  assert.equal(I.L('da', 'yes'), 'da');
  assert.equal(I.num(0.5, 2), '0,50');
  assert.equal(I.tr('τ1'), 'τ1');
});
