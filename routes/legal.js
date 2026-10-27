const express = require('express');

const router = express.Router();

router.get('/terms', (req, res) => {
    res.render('terms', { user: req.user || null });
});

router.get('/privacy-policy', (req, res) => {
    res.render('privacy-policy', { user: req.user || null });
});

module.exports = router;