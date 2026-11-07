const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crossSiteGuard = require('../middleware/cross-site-guard');
const { buildContentSecurityPolicy } = require('../config-security');

function run(method, headers = {}) {
    const request = { method, get: name => headers[name] };
    let status = null;
    let passed = false;
    crossSiteGuard(request, { sendStatus: code => { status = code; } }, () => { passed = true; });
    return { status, passed };
}

test('cross-site guard blocks cross-site state-changing requests only', () => {
    assert.deepEqual(run('POST', { 'Sec-Fetch-Site': 'cross-site' }), { status: 403, passed: false });
    assert.deepEqual(run('POST', { 'Sec-Fetch-Site': 'same-origin' }), { status: null, passed: true });
    assert.deepEqual(run('POST', {}), { status: null, passed: true });
    assert.deepEqual(run('GET', { 'Sec-Fetch-Site': 'cross-site' }), { status: null, passed: true });
});

test('CSP is report-only until enforced and never allows inline script', () => {
    assert.equal(buildContentSecurityPolicy().reportOnly, true);
    assert.equal(buildContentSecurityPolicy({ enforce: true }).reportOnly, false);
    const { directives } = buildContentSecurityPolicy({ production: true, enforce: true });
    assert.ok(!directives.scriptSrc.includes("'unsafe-inline'"));
    assert.deepEqual(directives.objectSrc, ["'none'"]);
    assert.ok(directives.upgradeInsecureRequests);
    assert.equal(directives.formAction, undefined);
});

const root = path.join(__dirname, '..');
const viewFiles = fs.readdirSync(path.join(root, 'views'), { recursive: true })
    .filter(file => file.endsWith('.ejs')).map(file => path.join(root, 'views', file));

test('no view uses inline scripts, inline event handlers or style attributes', () => {
    for (const file of viewFiles) {
        const text = fs.readFileSync(file, 'utf8');
        assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(text), `inline script in ${file}`);
        assert.ok(!/\son(click|submit|change|load|error|input)=/i.test(text), `inline handler in ${file}`);
        assert.ok(!/\sstyle="/i.test(text), `style attribute in ${file}`);
    }
});

test('every external host used by pages, styles and scripts is allowed by the CSP', () => {
    const { directives } = buildContentSecurityPolicy();
    const allowed = new Set(Object.values(directives).flat().filter(value => value.startsWith('https://')));
    const sources = [
        ...viewFiles,
        path.join(root, 'public/css/style.css'),
        path.join(root, 'public/css/pwa.css'),
        ...fs.readdirSync(path.join(root, 'public/js')).map(file => path.join(root, 'public/js', file))
    ];
    const hosts = new Set();
    for (const file of sources) {
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/https:\/\/[a-z0-9.-]+/gi)) hosts.add(match[0]);
    }
    for (const host of hosts) {
        if (['https://www.w3.org', 'https://schema.org', 'https://paystack.com', 'https://checkout.paystack.com'].includes(host)) continue;
        assert.ok(allowed.has(host), `${host} is used but not allowed by the CSP`);
    }
});
