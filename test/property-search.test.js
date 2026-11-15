const assert = require('node:assert/strict');
const test = require('node:test');
const Property = require('../models/Property');
const { buildPropertySearchFilter, normalizePropertySearch } = require('../services/property-search');

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

test('search while typing matches the start of any word in title, location or address', () => {
    const filter = buildPropertySearchFilter(normalizePropertySearch('lek ph-1'));
    assert.equal(filter.$and.length, 3);
    const titleMatcher = filter.$and[0].$or[0].title;
    assert.ok(titleMatcher.test('Lekki Phase 1'));
    assert.ok(titleMatcher.test('3 bed flat, Lekki'));
    assert.ok(titleMatcher.test('LEKKI'));
    assert.ok(!titleMatcher.test('Bellekin'));
    assert.deepEqual(filter.$and[0].$or.map(clause => Object.keys(clause)[0]), ['title', 'location', 'address']);
});

test('search filter ignores empty input and limits the number of words', () => {
    assert.equal(buildPropertySearchFilter(''), null);
    assert.equal(buildPropertySearchFilter('   '), null);
    assert.equal(buildPropertySearchFilter('a b c d e f g h i j').$and.length, 6);
});

test('regex characters in a search can never change the pattern', () => {
    const [clause] = buildPropertySearchFilter('a.b').$and;
    // normalizePropertySearch would strip the dot; even if it reached the filter it is escaped.
    assert.ok(!clause.$or[0].title.test('a-b'));
    assert.ok(clause.$or[0].title.test('a.b street'));
});
