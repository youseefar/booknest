const test = require('node:test');
const assert = require('node:assert/strict');
const { featuredUntilFromDays, isFeatured } = require('../services/listing-promotion');

const now = new Date('2026-11-06T00:00:00Z');

test('maps allowed day counts to an expiry date', () => {
    assert.equal(featuredUntilFromDays('7', now).toISOString(), '2026-11-13T00:00:00.000Z');
    assert.equal(featuredUntilFromDays('30', now).toISOString(), '2026-12-06T00:00:00.000Z');
});

test('zero clears featuring and bad input is ignored', () => {
    assert.equal(featuredUntilFromDays('0', now), null);
    for (const bad of ['', undefined, '5', '-7', '7.5', 'abc', '9999']) {
        assert.equal(featuredUntilFromDays(bad, now), undefined);
    }
});

test('only verified, unexpired properties count as featured', () => {
    const base = { verificationStatus: 'verified', featuredUntil: new Date('2026-11-10T00:00:00Z') };
    assert.equal(isFeatured(base, now), true);
    assert.equal(isFeatured({ ...base, verificationStatus: 'pending' }, now), false);
    assert.equal(isFeatured({ ...base, featuredUntil: new Date('2026-11-01T00:00:00Z') }, now), false);
    assert.equal(isFeatured({ verificationStatus: 'verified' }, now), false);
});
