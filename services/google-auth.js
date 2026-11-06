const crypto = require('node:crypto');

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const REQUEST_TIMEOUT_MS = 10000;

function getGoogleCallbackUrl(env = process.env) {
    try {
        const explicitUrl = String(env.GOOGLE_CALLBACK_URL || '').trim();
        if (explicitUrl) return new URL(explicitUrl).toString();
        const appUrl = String(env.APP_URL || '').trim();
        if (appUrl) return new URL('/auth/google/callback', appUrl).toString();
    } catch {
        return '';
    }
    return '';
}

function isGoogleConfigured(env = process.env) {
    return Boolean(
        String(env.GOOGLE_CLIENT_ID || '').trim()
        && String(env.GOOGLE_CLIENT_SECRET || '').trim()
        && getGoogleCallbackUrl(env)
    );
}

function createPkcePair() {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

function createState() {
    return crypto.randomBytes(32).toString('hex');
}

function statesMatch(expected, actual) {
    const expectedBuffer = Buffer.from(String(expected ?? ''));
    const actualBuffer = Buffer.from(String(actual ?? ''));
    return expectedBuffer.length > 0
        && expectedBuffer.length === actualBuffer.length
        && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function buildAuthorizationUrl({ clientId, redirectUri, state, codeChallenge }) {
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account'
    }).toString();
    return url.toString();
}

function normalizeGoogleProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const googleId = String(profile.sub || '').trim();
    const email = String(profile.email || '').trim().toLowerCase();
    const emailVerified = profile.email_verified === true || profile.email_verified === 'true';
    if (!googleId || googleId.length > 64 || !email.includes('@') || email.length > 254 || !emailVerified) return null;

    let name = String(profile.name || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (name.length < 2) name = email.split('@')[0].slice(0, 100);
    if (name.length < 2) name = 'Jacob Estate user';
    return { googleId, email, name };
}

async function requestJson(url, options) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    let body = null;
    try {
        body = await response.json();
    } catch {
        body = null;
    }
    if (!response.ok || !body || typeof body !== 'object') {
        const error = new Error('Google request failed.');
        error.code = 'GOOGLE_REQUEST_FAILED';
        error.status = 502;
        throw error;
    }
    return body;
}

// Exchanges the authorization code (PKCE-protected) for an access token, then reads the
// signed-in person's profile from Google's userinfo endpoint over TLS.
async function fetchGoogleProfile({ code, codeVerifier, env = process.env }) {
    const tokens = await requestJson(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: getGoogleCallbackUrl(env),
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
        })
    });
    if (!tokens.access_token || String(tokens.token_type || '').toLowerCase() !== 'bearer') {
        const error = new Error('Google did not return a usable access token.');
        error.code = 'GOOGLE_TOKEN_INVALID';
        error.status = 502;
        throw error;
    }
    return requestJson(USERINFO_ENDPOINT, {
        headers: { authorization: `Bearer ${tokens.access_token}` }
    });
}

module.exports = {
    buildAuthorizationUrl,
    createPkcePair,
    createState,
    fetchGoogleProfile,
    getGoogleCallbackUrl,
    isGoogleConfigured,
    normalizeGoogleProfile,
    statesMatch
};
