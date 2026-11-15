const test = require('node:test');
const assert = require('node:assert/strict');
const { renderRichText } = require('../services/rich-text');
const { PAGES } = require('../services/legal-pages');

test('internal links stay on the site and open in the same tab', () => {
    assert.equal(
        renderRichText('See the [safety page](/safety).'),
        'See the <a href="/safety">safety page</a>.'
    );
});

test('external https links open in a new tab with rel protection', () => {
    const html = renderRichText('Powered by [Paystack](https://paystack.com).');
    assert.match(html, /<a class="external-link" href="https:\/\/paystack\.com" target="_blank" rel="noopener noreferrer">Paystack/);
    assert.match(html, /opens in a new tab/);
});

test('markup in copy is escaped and unsafe targets are not linked', () => {
    assert.equal(renderRichText('<b>x</b> & "y"'), '&lt;b&gt;x&lt;/b&gt; &amp; &quot;y&quot;');
    assert.equal(renderRichText('[click](javascript:alert(1))'), 'click)');
    assert.equal(renderRichText('[click](//evil.example)'), 'click');
    assert.equal(renderRichText('[click](http://insecure.example)'), 'click');
    assert.equal(renderRichText('[<img src=x onerror=1>](/safety)'), '<a href="/safety">&lt;img src=x onerror=1&gt;</a>');
});

test('every link written in the page copy is a known page or a well-formed https URL', () => {
    const slugs = new Set([
        ...PAGES.map(page => page.slug), 'terms', 'privacy-policy', 'properties', 'register', 'register/landlord',
        'login', 'forgot-password', 'profile', 'payout-setup', 'saved-properties', 'my-bookings', 'my-inquiries'
    ]);
    const strings = [];
    for (const page of PAGES) {
        for (const section of page.sections || []) {
            strings.push(...(section.paragraphs || []), ...(section.items || []));
        }
        for (const [question, answer] of page.faqs || []) strings.push(question, answer);
    }
    let count = 0;
    for (const text of strings) {
        for (const [, , target] of text.matchAll(/\[([^\]\n]+)\]\(([^)\s]+)\)/g)) {
            count += 1;
            if (target.startsWith('/')) {
                const path = target.slice(1).split(/[?#]/)[0];
                assert.ok(slugs.has(path), `unknown internal link ${target}`);
            } else {
                assert.match(target, /^https:\/\/[a-z0-9.-]+\//i, `bad external link ${target}`);
            }
        }
    }
    assert.ok(count >= 60, `expected many inline links, found ${count}`);
});
