const assert = require('node:assert/strict');
const test = require('node:test');
const {
    PAGE_SIZE,
    SORT_OPTIONS,
    getPagination,
    parsePage,
    parseSort
} = require('../services/listing-pagination');

test('parses only positive whole-number page parameters', () => {
    assert.equal(parsePage('3'), 3);
    assert.equal(parsePage('0'), 1);
    assert.equal(parsePage('-2'), 1);
    assert.equal(parsePage('2.5'), 1);
    assert.equal(parsePage('4x'), 1);
});

test('accepts known sorts and safely falls back to newest first', () => {
    assert.equal(parseSort('price_asc'), 'price_asc');
    assert.equal(parseSort('unsupported'), 'latest');
    assert.deepEqual(SORT_OPTIONS[parseSort('price_desc')], { price: -1, createdAt: -1, _id: -1 });
});

test('bounds page size and moves out-of-range requests to the last available page', () => {
    assert.equal(PAGE_SIZE, 12);
    assert.deepEqual(getPagination(1, 25), {
        page: 1,
        pageSize: 12,
        totalCount: 25,
        totalPages: 3,
        skip: 0
    });
    assert.deepEqual(getPagination(99, 25), {
        page: 3,
        pageSize: 12,
        totalCount: 25,
        totalPages: 3,
        skip: 24
    });
    assert.equal(getPagination(1, 0).page, 1);
});
