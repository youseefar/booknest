const test = require('node:test');
const assert = require('node:assert/strict');
const { escapeHtml, renderEmail, safeUrl } = require('../services/email-template');

test('the reset email has a button, no visible raw link, and escapes everything', () => {
    const { html, text } = renderEmail({
        heading: 'Reset your password',
        greeting: 'Hello <b>Ada</b>,',
        paragraphs: ['Use the button & be quick.'],
        button: { label: 'Reset my password', url: 'https://example.com/reset-password/abc123' },
        note: 'Ignore if not you.'
    });
    assert.match(html, /<a href="https:\/\/example\.com\/reset-password\/abc123"[^>]*>Reset my password/);
    assert.doesNotMatch(html, />https:\/\/example\.com\/reset-password/);
    assert.match(html, /Hello &lt;b&gt;Ada&lt;\/b&gt;,/);
    assert.match(html, /be quick/);
    assert.doesNotMatch(html, /<b>Ada/);
    assert.match(text, /Reset my password: https:\/\/example\.com\/reset-password\/abc123/);
});

test('unsafe or invalid button links are dropped', () => {
    assert.equal(safeUrl('javascript:alert(1)'), '');
    assert.equal(safeUrl('not a url'), '');
    assert.equal(safeUrl('https://example.com/x'), 'https://example.com/x');
    const { html } = renderEmail({ heading: 'Hi', button: { label: 'Go', url: 'javascript:alert(1)' } });
    assert.doesNotMatch(html, /javascript:/);
    assert.doesNotMatch(html, />Go/);
    assert.equal(escapeHtml(`"<&'>`), '&quot;&lt;&amp;&#39;&gt;');
});
