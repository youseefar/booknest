// Groundwork for paid placement. Featuring is set by an administrator for a fixed number
// of days and is never connected to a payment here; a billing flow can call the same
// helper once one exists.
const FEATURE_DAY_OPTIONS = new Set([7, 30, 90]);
const DAY_MS = 24 * 60 * 60 * 1000;

function isFeatured(property, now = new Date()) {
    return Boolean(property?.featuredUntil)
        && property.verificationStatus === 'verified'
        && new Date(property.featuredUntil) > now;
}

// Returns a Date for 7/30/90 days, null to clear, or undefined for an invalid/empty choice.
function featuredUntilFromDays(value, now = new Date()) {
    const raw = String(value ?? '').trim();
    if (raw === '0') return null;
    if (!/^\d+$/.test(raw)) return undefined;
    const days = Number(raw);
    if (!FEATURE_DAY_OPTIONS.has(days)) return undefined;
    return new Date(now.getTime() + days * DAY_MS);
}

module.exports = { FEATURE_DAY_OPTIONS, featuredUntilFromDays, isFeatured };
