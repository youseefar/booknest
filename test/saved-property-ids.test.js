const assert = require('node:assert/strict');
const test = require('node:test');
const { MAX_SAVED_PROPERTIES, parseSavedPropertyIds } = require('../services/saved-property-ids');

test('accepts valid unique Mongo IDs while preserving their order', () => {
    assert.deepEqual(parseSavedPropertyIds('507f1f77bcf86cd799439011,507f1f77bcf86cd799439012,507f1f77bcf86cd799439011'), [
        '507f1f77bcf86cd799439011',
        '507f1f77bcf86cd799439012'
    ]);
});

test('ignores malformed IDs and limits saved-property queries', () => {
    assert.deepEqual(parseSavedPropertyIds('invalid,507f1f77bcf86cd799439011'), [
        '507f1f77bcf86cd799439011'
    ]);
    assert.equal(parseSavedPropertyIds('x'.repeat(8001)).length, 0);
    const ids = Array.from({ length: MAX_SAVED_PROPERTIES + 1 }, (_, index) =>
        index.toString(16).padStart(24, '0')
    ).join(',');
    assert.equal(parseSavedPropertyIds(ids).length, MAX_SAVED_PROPERTIES);
    assert.deepEqual(parseSavedPropertyIds(['507f1f77bcf86cd799439011']), []);
});
