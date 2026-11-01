function isDatabaseError(error) {
    return error?.name?.startsWith('Mongo')
        || error?.name?.startsWith('Mongoose')
        || ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error?.code);
}

function isStorageLimitError(error) {
    const message = String(error?.message || '');
    return /(?:space|storage)\s+(?:quota|limit)|(?:quota|limit)\s+(?:for\s+)?(?:space|storage)|exceeded.{0,30}(?:space|storage|quota)|(?:space|storage|quota).{0,30}exceeded/i.test(message);
}

module.exports = { isDatabaseError, isStorageLimitError };
