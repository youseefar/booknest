// Pure helpers for notification wording and links (no database access).
const CATEGORIES = ['booking', 'listing', 'inquiry', 'report'];

function cleanText(value, maxLength) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

// Only site-relative paths are allowed as notification links.
function safeInternalLink(link) {
    return typeof link === 'string' && /^\/(?!\/)[A-Za-z0-9\-_/.?=&#%]*$/.test(link) ? link.slice(0, 200) : '';
}

function buildEmailText({ name, body, link, baseUrl }) {
    const lines = [`Hello ${cleanText(name, 100) || 'there'},`, '', cleanText(body, 500)];
    const path = safeInternalLink(link);
    if (path && baseUrl) {
        try {
            lines.push('', `Open it on Jacob Estate: ${new URL(path, baseUrl).toString()}`);
        } catch (error) {
            // Skip the link if the base URL is not valid.
        }
    }
    lines.push('', 'You are receiving this because of activity on your Jacob Estate account.');
    return lines.join('\n');
}

module.exports = { CATEGORIES, buildEmailText, cleanText, safeInternalLink };
