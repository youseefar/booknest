const MAX_SAVED_PROPERTIES = 100;
const MAX_SAVED_QUERY_LENGTH = 8000;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function parseSavedPropertyIds(value) {
    if (typeof value !== 'string' || value.length > MAX_SAVED_QUERY_LENGTH) return [];

    return [...new Set(value.split(',').filter(id => OBJECT_ID_PATTERN.test(id)))]
        .slice(0, MAX_SAVED_PROPERTIES);
}

module.exports = { MAX_SAVED_PROPERTIES, parseSavedPropertyIds };
