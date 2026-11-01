function normalizePropertySearch(value) {
    return String(value || '')
        .normalize('NFKC')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = { normalizePropertySearch };
