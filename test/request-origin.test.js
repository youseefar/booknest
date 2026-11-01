const assert = require('node:assert/strict');
const test = require('node:test');
const { isOpaqueSameOriginNavigation } = require('../services/request-origin');

function request(headers, method = 'POST') {
  return {
    method,
    get: name => headers[name.toLowerCase()]
  };
}

test('allows an opaque-origin same-origin document navigation', () => {
  assert.equal(isOpaqueSameOriginNavigation(request({
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document'
  })), true);
});

test('does not allow opaque-origin requests without same-origin navigation metadata', () => {
  assert.equal(isOpaqueSameOriginNavigation(request({
    'sec-fetch-site': 'cross-site',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document'
  })), false);
  assert.equal(isOpaqueSameOriginNavigation(request({
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'cors',
    'sec-fetch-dest': 'empty'
  })), false);
  assert.equal(isOpaqueSameOriginNavigation(request({
    'sec-fetch-site': 'same-origin',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-dest': 'document'
  }, 'OPTIONS')), false);
});
