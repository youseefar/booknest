const express = require('express');
const { LAST_UPDATED, PAGES, PAGES_BY_SLUG } = require('../services/legal-pages');

const router = express.Router();

router.get('/terms', (req, res) => {
    res.render('terms', { user: req.user || null });
});

router.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy', { user: req.user || null });
});

const SUPPORT_EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

function getSupportEmail() {
    const value = String(process.env.SUPPORT_EMAIL || '').trim();
    return SUPPORT_EMAIL_PATTERN.test(value) ? value : '';
}

PAGES.forEach(page => {
    router.get(`/${page.slug}`, (req, res) => {
        res.render('legal-page', {
            user: req.user || null,
            page: PAGES_BY_SLUG.get(page.slug),
            lastUpdated: LAST_UPDATED,
            supportEmail: getSupportEmail()
        });
    });
});

module.exports = router;
