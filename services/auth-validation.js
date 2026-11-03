function normalizeEmail(value) {
    return String(value ?? '').trim().toLowerCase();
}

function isStrongPassword(value) {
    const password = String(value ?? '');
    return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function getSafePropertyReturnPath(value) {
    const normalized = String(value ?? '');
    const match = /^\/property\/([a-f\d]{24})$/i.exec(normalized);
    return match ? `/property/${match[1]}` : '';
}

module.exports = {
    normalizeEmail,
    isStrongPassword,
    getSafePropertyReturnPath
};
