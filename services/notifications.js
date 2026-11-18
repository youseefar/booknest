const Notification = require('../models/Notification');
const User = require('../models/User');
const { isEmailConfigured, sendEmail } = require('./email');
const { CATEGORIES, buildEmailText, cleanText, safeInternalLink } = require('./notification-text');
const { renderEmail } = require('./email-template');

const CATEGORY_ICONS = { booking: '\u{1F4C5}', listing: '\u{1F3E0}', inquiry: '\u{1F4AC}', report: '\u{1F6A9}' };

function buildNotificationEmail(user, details, baseUrl) {
    let url = '';
    try { url = details.link && baseUrl ? new URL(details.link, baseUrl).toString() : ''; } catch (error) { url = ''; }
    return renderEmail({
        preheader: details.body || details.title,
        icon: CATEGORY_ICONS[details.category],
        heading: details.title,
        greeting: `Hello ${cleanText(user.name, 100) || 'there'},`,
        paragraphs: [details.body || details.title],
        button: url ? { label: 'Open on Jacob Estate', url } : null,
        note: 'You are receiving this because of activity on your Jacob Estate account.'
    });
}

function baseUrlFor(req) {
    if (process.env.APP_URL) return process.env.APP_URL;
    return req ? `${req.protocol}://${req.get('host')}` : '';
}

// Creates an in-app notification and, when asked, emails the same message. This never throws
// and never makes the caller wait for email, so a notification problem cannot break a payment,
// a review decision or any other action that triggered it.
async function notifyUser(userId, { category, title, body = '', link = '' }, { email = false, baseUrl = '' } = {}) {
    try {
        if (!userId || !CATEGORIES.includes(category)) return;
        const details = {
            userId,
            category,
            title: cleanText(title, 120),
            body: cleanText(body, 500),
            link: safeInternalLink(link)
        };
        if (!details.title) return;
        await Notification.create(details);

        if (email && isEmailConfigured()) {
            const user = await User.findById(userId).select('name email');
            if (user?.email) {
                const email = buildNotificationEmail(user, details, baseUrl);
                sendEmail({
                    to: user.email,
                    subject: `${details.title} - Jacob Estate`,
                    text: email.text,
                    html: email.html
                }).catch(error => console.error('Notification email failed:', { name: error.name, code: error.code, reason: error.reason }));
            }
        }
    } catch (error) {
        console.error('Notification failed:', { category, name: error.name });
    }
}

async function notifyAdmins(details) {
    try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        await Promise.all(admins.map(admin => notifyUser(admin._id, details)));
    } catch (error) {
        console.error('Admin notification failed:', { name: error.name });
    }
}

module.exports = { baseUrlFor, notifyAdmins, notifyUser };
