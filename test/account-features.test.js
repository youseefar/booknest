const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeSavedIds, normalizeIdList } = require('../services/saved-properties');
const { buildEmailText, cleanText, safeInternalLink, CATEGORIES } = require('../services/notification-text');
const { normalizeReport, REPORT_REASONS } = require('../services/listing-reports');

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);

test('saved id lists accept comma strings and arrays, dropping junk and duplicates', () => {
    assert.deepEqual(normalizeIdList(`${A},${A},nope,${B.toUpperCase()}`), [A, B]);
    assert.deepEqual(normalizeIdList([A, 5, { x: 1 }]), [A]);
    assert.deepEqual(normalizeIdList(undefined), []);
    assert.deepEqual(normalizeIdList('x'.repeat(9000)), []);
});

test('merging keeps account homes first and respects the 100 limit', () => {
    assert.deepEqual(mergeSavedIds([A], [B, A]), [A, B]);
    const many = Array.from({ length: 150 }, (_, i) => i.toString(16).padStart(24, '0'));
    assert.equal(mergeSavedIds(many, []).length, 100);
});

test('notification links must be site-relative', () => {
    assert.equal(safeInternalLink('/my-bookings'), '/my-bookings');
    assert.equal(safeInternalLink('//evil.example'), '');
    assert.equal(safeInternalLink('https://evil.example'), '');
    assert.equal(safeInternalLink('javascript:alert(1)'), '');
    assert.equal(cleanText('  a \n b  ', 10), 'a b');
    assert.ok(CATEGORIES.includes('report'));
});

test('email text includes a full link only when a valid base URL is given', () => {
    const withBase = buildEmailText({ name: 'Ada', body: 'Hi', link: '/my-bookings', baseUrl: 'https://example.com' });
    assert.match(withBase, /https:\/\/example\.com\/my-bookings/);
    assert.doesNotMatch(buildEmailText({ name: 'Ada', body: 'Hi', link: '/x', baseUrl: '' }), /https?:\/\//);
});

test('reports need a known reason; Other needs details', () => {
    assert.equal(normalizeReport({ reason: 'bogus' }).ok, false);
    assert.equal(normalizeReport({ reason: 'scam' }).ok, true);
    assert.equal(normalizeReport({ reason: 'other', details: 'hi' }).ok, false);
    assert.equal(normalizeReport({ reason: 'scam', details: 'x'.repeat(501) }).ok, false);
    assert.equal(normalizeReport({ reason: 'scam', details: '  looks   fake ' }).details, 'looks fake');
    assert.ok(Object.hasOwn(REPORT_REASONS, 'scam'));
});
