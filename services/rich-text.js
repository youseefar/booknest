// Turns "[words](/page)" and "[words](https://example.org)" in page copy into links.
// Everything else is HTML-escaped, so copy can never inject markup or scripts.
// Only site-relative paths and https URLs become links; anything else shows as plain text.
const LINK_PATTERN = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const INTERNAL_PATTERN = /^\/(?!\/)[A-Za-z0-9\-_/.?=&#%]*$/;
const EXTERNAL_PATTERN = /^https:\/\/[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/[A-Za-z0-9\-_.~!*'();:@&=+$,/?#%[\]]*)?$/;

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderRichText(text) {
    const source = String(text == null ? '' : text);
    let output = '';
    let last = 0;
    for (const match of source.matchAll(LINK_PATTERN)) {
        const [whole, label, target] = match;
        output += escapeHtml(source.slice(last, match.index));
        last = match.index + whole.length;
        if (INTERNAL_PATTERN.test(target)) {
            output += `<a href="${escapeHtml(target)}">${escapeHtml(label)}</a>`;
        } else if (EXTERNAL_PATTERN.test(target)) {
            output += `<a class="external-link" href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}<span class="external-mark" aria-hidden="true">&nearr;</span><span class="visually-hidden"> (opens in a new tab)</span></a>`;
        } else {
            output += escapeHtml(label);
        }
    }
    return output + escapeHtml(source.slice(last));
}

module.exports = { renderRichText };
