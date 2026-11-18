// Pure helpers for "Report this listing".
const REPORT_REASONS = {
    scam: 'Looks like a scam or fraud',
    wrong_info: 'Wrong price, location or details',
    unavailable: 'No longer available',
    not_real: 'Video does not match the property',
    inappropriate: 'Offensive or unlawful content',
    other: 'Something else'
};
const MAX_REPORTS_PER_DAY = 10;
const MAX_DETAILS_LENGTH = 500;

function normalizeReport(body = {}) {
    const reason = String(body.reason || '');
    const details = String(body.details || '').replace(/\s+/g, ' ').trim();
    if (!Object.hasOwn(REPORT_REASONS, reason)) return { ok: false };
    if (details.length > MAX_DETAILS_LENGTH) return { ok: false };
    if (reason === 'other' && details.length < 5) return { ok: false };
    return { ok: true, reason, details };
}

module.exports = { MAX_DETAILS_LENGTH, MAX_REPORTS_PER_DAY, REPORT_REASONS, normalizeReport };
