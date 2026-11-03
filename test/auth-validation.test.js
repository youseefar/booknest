const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeEmail,
  isStrongPassword,
  getSafePropertyReturnPath
} = require('../services/auth-validation');

test('normalizeEmail trims and lowercases a submitted email', () => {
  assert.equal(normalizeEmail('  User@Example.com  '), 'user@example.com');
});

test('isStrongPassword requires a minimum length and a number', () => {
  assert.equal(isStrongPassword('short'), false);
  assert.equal(isStrongPassword('longpassword'), false);
  assert.equal(isStrongPassword('longpassword1'), true);
});

test('safe property redirects only allow a vetted property URL', () => {
  assert.equal(getSafePropertyReturnPath('/property/507f1f77bcf86cd799439011'), '/property/507f1f77bcf86cd799439011');
  assert.equal(getSafePropertyReturnPath('https://evil.example/steal'), '');
  assert.equal(getSafePropertyReturnPath('/dashboard'), '');
});
