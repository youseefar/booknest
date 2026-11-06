const test = require('node:test');
const assert = require('node:assert/strict');
const { PAGES } = require('../services/legal-pages');

test('defines every required trust and legal page', () => {
    const slugs = PAGES.map(page => page.slug).sort();
    assert.deepEqual(slugs, [
        'about', 'advertising-disclosure', 'contact', 'cookie-policy', 'data-protection',
        'faq', 'listing-guidelines', 'payment-policy', 'refund-policy', 'safety'
    ]);
});

test('every page has a title and content, and slugs are unique', () => {
    assert.equal(new Set(PAGES.map(page => page.slug)).size, PAGES.length);
    for (const page of PAGES) {
        assert.ok(page.title && page.summary);
        assert.ok(page.sections?.length || page.faqs?.length, page.slug);
    }
});

test('payment policy keeps the 99% / 1% split', () => {
    const text = JSON.stringify(PAGES.find(page => page.slug === 'payment-policy'));
    assert.match(text, /99%/);
    assert.match(text, /1%/);
});
