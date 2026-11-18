// Pure helpers for the saved-homes list kept on a signed-in user's account.
const { MAX_SAVED_PROPERTIES } = require('./saved-property-ids');

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

// Accepts "id,id,id" (the form the browser sends) or an array; keeps valid unique ids.
function normalizeIdList(value) {
    const items = typeof value === 'string' && value.length <= 8000
        ? value.split(',')
        : Array.isArray(value) ? value : [];
    return [...new Set(items.map(item => String(item).trim().toLowerCase()).filter(id => OBJECT_ID_PATTERN.test(id)))]
        .slice(0, MAX_SAVED_PROPERTIES);
}

// Account homes first, then new ones, never more than the limit.
function mergeSavedIds(accountIds, incomingIds) {
    return [...new Set([...normalizeIdList(accountIds), ...normalizeIdList(incomingIds)])].slice(0, MAX_SAVED_PROPERTIES);
}

module.exports = { mergeSavedIds, normalizeIdList };
