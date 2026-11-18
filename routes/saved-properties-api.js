const express = require('express');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const User = require('../models/User');
const { MAX_SAVED_PROPERTIES } = require('../services/saved-property-ids');
const { mergeSavedIds, normalizeIdList } = require('../services/saved-properties');

const router = express.Router();
const PUBLIC_LISTING = { verificationStatus: 'verified', status: { $in: ['available', 'rented', 'sold'] } };

function requireSignedIn(req, res, next) {
    if (req.isAuthenticated && req.isAuthenticated()) return next();
    return res.status(401).json({ error: 'Sign in to keep saved homes on your account.' });
}

const storedIds = user => (user.savedProperties || []).map(String);

// Keeps only homes that still exist and are publicly visible, in the order given.
async function stillListed(ids) {
    if (!ids.length) return [];
    const found = await Property.find({ _id: { $in: ids }, ...PUBLIC_LISTING }).select('_id');
    const listed = new Set(found.map(property => String(property._id)));
    return ids.filter(id => listed.has(id));
}

const replaceSaved = (userId, ids) => User.updateOne({ _id: userId }, { $set: { savedProperties: ids } });

router.use('/api/saved-properties', requireSignedIn);

router.get('/api/saved-properties', async (req, res, next) => {
    try {
        const stored = storedIds(req.user);
        const listed = await stillListed(stored);
        if (listed.length !== stored.length) await replaceSaved(req.user._id, listed);
        res.set('Cache-Control', 'no-store');
        return res.json({ ids: listed });
    } catch (error) {
        return next(error);
    }
});

// First sign-in on a device: merge the homes saved there into the account list.
router.put('/api/saved-properties', async (req, res, next) => {
    try {
        const merged = await stillListed(mergeSavedIds(storedIds(req.user), normalizeIdList(req.body.ids)));
        await replaceSaved(req.user._id, merged);
        res.set('Cache-Control', 'no-store');
        return res.json({ ids: merged });
    } catch (error) {
        return next(error);
    }
});

router.post('/api/saved-properties/:id', async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Property not found.' });
        const stored = storedIds(req.user);
        const id = String(req.params.id).toLowerCase();
        if (!stored.includes(id)) {
            if (stored.length >= MAX_SAVED_PROPERTIES) return res.status(409).json({ error: 'You can save up to 100 homes.' });
            if (!(await stillListed([id])).length) return res.status(404).json({ error: 'Property not found.' });
            await User.updateOne({ _id: req.user._id }, { $addToSet: { savedProperties: id } });
        }
        return res.json({ ids: [...new Set([...stored, id])] });
    } catch (error) {
        return next(error);
    }
});

router.delete('/api/saved-properties/:id', async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Property not found.' });
        await User.updateOne({ _id: req.user._id }, { $pull: { savedProperties: req.params.id } });
        return res.json({ ids: storedIds(req.user).filter(id => id !== String(req.params.id).toLowerCase()) });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
