const assert = require('node:assert/strict');
const test = require('node:test');
const Property = require('../models/Property');
const { parseOptionalRoomCount } = require('../services/property-details');

test('optional room counts preserve unspecified values and accept zero', () => {
    assert.equal(parseOptionalRoomCount(''), null);
    assert.equal(parseOptionalRoomCount(undefined), null);
    assert.equal(parseOptionalRoomCount('0'), 0);
    assert.equal(parseOptionalRoomCount('4'), 4);
});

test('room counts must be whole numbers from zero through fifty', () => {
    for (const invalid of ['1.5', '-1', '51', 'abc', {}, ['2']]) {
        assert.equal(parseOptionalRoomCount(invalid), undefined);
    }
});

test('property room-count validators allow unspecified legacy listing values', async () => {
    const property = new Property({
        title: 'Family home',
        description: 'A property',
        price: 500000,
        location: 'Lekki',
        address: 'Example Road',
        landlordId: '507f1f77bcf86cd799439011'
    });

    await property.validate();
});
