// Builds the branded HTML (and matching plain-text) version of Jacob Estate emails.
// Email clients ignore most CSS and block icon fonts, so this uses table layout, inline styles,
// a system font stack and emoji for icons. Everything inserted is HTML-escaped.
const COLORS = { ink: '#183a35', body: '#46584f', muted: '#7a8a84', primary: '#236d60', page: '#f2f6f4', border: '#dce6e2', tint: '#e7f1ed' };
const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const DEFAULT_SUPPORT_EMAIL = 'Jacobintegratedservices@gmail.com';

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Only https (or http for local testing) links may become the button target.
function safeUrl(url) {
    try {
        const parsed = new URL(String(url));
        return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch (error) {
        return '';
    }
}

function renderEmail({ preheader = '', icon = '🏠', heading, greeting = '', paragraphs = [], button = null, note = '', supportEmail = DEFAULT_SUPPORT_EMAIL }) {
    const href = button ? safeUrl(button.url) : '';
    const paragraphHtml = paragraphs.map(text =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${COLORS.body};">${escapeHtml(text)}</p>`).join('');
    const buttonHtml = href ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px;"><tr>
          <td align="center" bgcolor="${COLORS.primary}" style="border-radius:10px;">
            <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(button.label)} &rarr;</a>
          </td></tr></table>` : '';
    const noteHtml = note
        ? `<p style="margin:20px 0 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(note)}</p>` : '';

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader || heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${COLORS.border};border-radius:16px;overflow:hidden;">
    <tr><td bgcolor="${COLORS.primary}" style="padding:20px 32px;font-family:${FONT};font-size:20px;font-weight:700;color:#ffffff;">&#127968; Jacob Estate</td></tr>
    <tr><td style="padding:32px 32px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" width="56" height="56" bgcolor="${COLORS.tint}" style="width:56px;height:56px;border-radius:28px;font-size:28px;line-height:56px;">${escapeHtml(icon)}</td></tr></table>
      <h1 style="margin:20px 0 12px;font-family:${FONT};font-size:24px;line-height:1.3;color:${COLORS.ink};">${escapeHtml(heading)}</h1>
      ${greeting ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${COLORS.body};">${escapeHtml(greeting)}</p>` : ''}
      ${paragraphHtml}${buttonHtml}${noteHtml}
    </td></tr>
    <tr><td style="padding:24px 32px 28px;border-top:1px solid ${COLORS.border};font-family:${FONT};font-size:13px;line-height:1.5;color:${COLORS.muted};">
      Jacob Estate &middot; Verified homes, secure payments.<br>
      Need help? Write to <a href="mailto:${escapeHtml(supportEmail)}" style="color:${COLORS.primary};">${escapeHtml(supportEmail)}</a>.
    </td></tr>
  </table>
</td></tr></table></body></html>`;

    const text = [
        greeting, ...paragraphs,
        href ? `${button.label}: ${href}` : '',
        note,
        '', 'Jacob Estate'
    ].filter((line, index) => line !== '' || index > 0).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    return { html, text };
}

module.exports = { escapeHtml, renderEmail, safeUrl };
