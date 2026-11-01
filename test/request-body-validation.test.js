const assert = require('node:assert/strict');
const test = require('node:test');
const validateRequestBody = require('../middleware/validate-request-body');

function runValidation({ method = 'POST', path = '/example', body = {} }) {
  const req = { method, path, body };
  let error;
  let continued = false;

  validateRequestBody(req, {}, nextError => {
    error = nextError;
    continued = !nextError;
  });

  return { error, continued };
}

test('accepts simple form values', () => {
  const result = runValidation({
    body: { title: 'House', bedrooms: 2, furnished: false, optional: null }
  });

  assert.equal(result.error, undefined);
  assert.equal(result.continued, true);
});

test('rejects nested values, arrays, and oversized strings', () => {
  for (const body of [
    { filter: { $ne: null } },
    { tags: ['house'] },
    { description: 'a'.repeat(10001) }
  ]) {
    const result = runValidation({ body });
    assert.equal(result.error.status, 400);
    assert.equal(result.continued, false);
  }
});

test('leaves the signed Paystack webhook body to its dedicated handler', () => {
  const result = runValidation({
    path: '/payments/paystack/webhook',
    body: { data: { nested: true } }
  });

  assert.equal(result.error, undefined);
  assert.equal(result.continued, true);
});
