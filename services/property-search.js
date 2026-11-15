function normalizePropertySearch(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const MAX_SEARCH_WORDS = 6;

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches the START of any word in the title, location or address, so searching while typing
// ("lek") already finds "Lekki". Every typed word must match somewhere. Pass normalized text.
function buildPropertySearchFilter(normalizedSearch) {
    const words = String(normalizedSearch || '').split(' ').filter(Boolean).slice(0, MAX_SEARCH_WORDS);
    if (!words.length) return null;
    return {
        $and: words.map(word => {
            const wordStart = new RegExp(`(^|[\\s,.;:/()'"-])${escapeRegex(word)}`, 'i');
            return { $or: [{ title: wordStart }, { location: wordStart }, { address: wordStart }] };
        })
    };
}

module.exports = { MAX_SEARCH_WORDS, buildPropertySearchFilter, normalizePropertySearch };
