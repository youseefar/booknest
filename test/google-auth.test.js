const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {
    buildAuthorizationUrl,
    createPkcePair,
    getGoogleCallbackUrl,
    isGoogleConfigured,
    normalizeGoogleProfile,
    statesMatch
} = require('../services/google-auth');

test('derives the callback URL from APP_URL or an explicit override', () => {
    assert.equal(getGoogleCallbackUrl({ APP_URL: 'https://example.com' }), 'https://example.com/auth/google/callback');
    assert.equal(
        getGoogleCallbackUrl({ APP_URL: 'https://example.com', GOOGLE_CALLBACK_URL: 'https://other.example/cb' }),
        'https://other.example/cb'
    );
    assert.equal(getGoogleCallbackUrl({ APP_URL: 'not a url' }), '');
    assert.equal(getGoogleCallbackUrl({}), '');
});

test('Google sign-in is only enabled when fully configured', () => {
    const configured = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret', APP_URL: 'https://example.com' };
    assert.equal(isGoogleConfigured(configured), true);
    assert.equal(isGoogleConfigured({ ...configured, GOOGLE_CLIENT_SECRET: '' }), false);
    assert.equal(isGoogleConfigured({ ...configured, GOOGLE_CLIENT_ID: ' ' }), false);
    assert.equal(isGoogleConfigured({ ...configured, APP_URL: '' }), false);
});

test('creates a PKCE verifier and matching S256 challenge', () => {
    const { verifier, challenge } = createPkcePair();
    assert.ok(verifier.length >= 43);
    assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
});

test('builds an authorization URL with state and PKCE', () => {
    const url = new URL(buildAuthorizationUrl({
        clientId: 'client-id',
        redirectUri: 'https://example.com/auth/google/callback',
        state: 'abc123',
        codeChallenge: 'challenge'
    }));
    assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('state'), 'abc123');
    assert.equal(url.searchParams.get('code_challenge'), 'challenge');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('scope'), 'openid email profile');
});

test('compares OAuth state values safely', () => {
    assert.equal(statesMatch('abc', 'abc'), true);
    assert.equal(statesMatch('abc', 'abd'), false);
    assert.equal(statesMatch('abc', 'abcd'), false);
    assert.equal(statesMatch('', ''), false);
    assert.equal(statesMatch(undefined, 'abc'), false);
});

test('accepts only Google profiles with a verified email and an id', () => {
    assert.deepEqual(
        normalizeGoogleProfile({ sub: '123', email: 'Person@Example.com', email_verified: true, name: '  Ada   Obi ' }),
        { googleId: '123', email: 'person@example.com', name: 'Ada Obi' }
    );
    assert.equal(normalizeGoogleProfile({ sub: '123', email: 'a@example.com', email_verified: false, name: 'Ada' }), null);
    assert.equal(normalizeGoogleProfile({ email: 'a@example.com', email_verified: true }), null);
    assert.equal(normalizeGoogleProfile({ sub: '123', email_verified: true }), null);
    assert.equal(normalizeGoogleProfile(null), null);
});

test('falls back to the email name when Google gives no usable name', () => {
    assert.equal(normalizeGoogleProfile({ sub: '1', email: 'chidi@example.com', email_verified: true }).name, 'chidi');
    assert.equal(normalizeGoogleProfile({ sub: '1', email: 'x@example.com', email_verified: true }).name, 'Jacob Estate user');
});
