const assert = require('node:assert/strict');
const test = require('node:test');
const Property = require('../models/Property');
const { normalizePropertySearch } = require('../services/property-search');

test('normalizes search punctuation and whitespace for indexed text search', () => {
    assert.equal(normalizePropertySearch('  Lekki, Phase-1!  '), 'Lekki Phase 1');
    assert.equal(normalizePropertySearch('café homes'), 'café homes');
    assert.equal(normalizePropertySearch('...'), '');
});

test('property schema defines a weighted text index for the indexed search route', () => {
    const textIndex = Property.schema.indexes().find(([fields]) =>
        Object.values(fields).includes('text')
    );
    assert.ok(textIndex);
    assert.deepEqual(textIndex[0], { title: 'text', location: 'text', address: 'text' });
});
