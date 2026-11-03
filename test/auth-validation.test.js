const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getRegistrationRole,
  normalizeEmail,
  isStrongPassword,
  getSafePropertyReturnPath,
  isLocalDevelopmentResetAllowed
} = require('../services/auth-validation');

test('normalizeEmail trims and lowercases a submitted email', () => {
  assert.equal(normalizeEmail('  User@Example.com  '), 'user@example.com');
});

test('registration role input cannot grant the admin role', () => {
  assert.equal(getRegistrationRole('student'), 'student');
  assert.equal(getRegistrationRole('landlord'), 'landlord');
  assert.equal(getRegistrationRole('admin'), 'student');
  assert.equal(getRegistrationRole({ role: 'admin' }), 'student');
});

test('isStrongPassword requires a minimum length and a number', () => {
  assert.equal(isStrongPassword('short'), false);
  assert.equal(isStrongPassword('longpassword'), false);
  assert.equal(isStrongPassword('12345678'), false);
  assert.equal(isStrongPassword('longpassword1'), true);
});

test('safe property redirects only allow a vetted property URL', () => {
  assert.equal(getSafePropertyReturnPath('/property/507f1f77bcf86cd799439011'), '/property/507f1f77bcf86cd799439011');
  assert.equal(getSafePropertyReturnPath('https://evil.example/steal'), '');
  assert.equal(getSafePropertyReturnPath('/dashboard'), '');
});

test('development reset links are limited to loopback requests', () => {
  const development = { NODE_ENV: 'development' };
  assert.equal(isLocalDevelopmentResetAllowed(development, '127.0.0.1'), true);
  assert.equal(isLocalDevelopmentResetAllowed(development, '::1'), true);
  assert.equal(isLocalDevelopmentResetAllowed(development, '::ffff:127.0.0.1'), true);
  assert.equal(isLocalDevelopmentResetAllowed(development, '203.0.113.10'), false);
  assert.equal(isLocalDevelopmentResetAllowed({}, '127.0.0.1'), false);
  assert.equal(isLocalDevelopmentResetAllowed({ NODE_ENV: 'production' }, '127.0.0.1'), false);
});
