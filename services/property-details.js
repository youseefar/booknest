function parseOptionalRoomCount(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;

    const count = Number(value);
    if (!Number.isInteger(count) || count < 0 || count > 50) return undefined;
    return count;
}

module.exports = { parseOptionalRoomCount };
