const { isIP } = require('node:net');

function normalizeEmail(value) {
    return String(value ?? '').trim().toLowerCase();
}

function isStrongPassword(value) {
    const password = String(value ?? '');
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function getRegistrationRole(value) {
    return String(value ?? '').trim() === 'landlord' ? 'landlord' : 'student';
}

function getSafePropertyReturnPath(value) {
    const normalized = String(value ?? '');
    const match = /^\/property\/([a-f\d]{24})$/i.exec(normalized);
    return match ? `/property/${match[1]}` : '';
}

function isLocalDevelopmentResetAllowed(environment, remoteAddress) {
    if (environment?.NODE_ENV !== 'development') return false;

    const address = String(remoteAddress ?? '').toLowerCase();
    if (address === '::1') return true;

    const ipv4Address = address.startsWith('::ffff:') ? address.slice(7) : address;
    return isIP(ipv4Address) === 4 && ipv4Address.startsWith('127.');
}

module.exports = {
    getRegistrationRole,
    normalizeEmail,
    isStrongPassword,
    getSafePropertyReturnPath,
    isLocalDevelopmentResetAllowed
};
