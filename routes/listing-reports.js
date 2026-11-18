const express = require('express');
const mongoose = require('mongoose');
const Property = require('../models/Property');
const ListingReport = require('../models/ListingReport');
const { requireAuth, requireRole } = require('../middleware/auth');
const { recordAudit } = require('../services/audit-log');
const { MAX_REPORTS_PER_DAY, REPORT_REASONS, normalizeReport } = require('../services/listing-reports');
const { notifyAdmins } = require('../services/notifications');

const router = express.Router();

router.post('/property/:id/report', requireAuth, async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Property not found.');
    const back = result => `/property/${req.params.id}?report=${result}#report-listing`;
    try {
        const report = normalizeReport(req.body);
        if (!report.ok) return res.redirect(back('invalid'));

        const property = await Property.findOne({ _id: req.params.id, archivedAt: null }).select('title landlordId');
        if (!property) return res.status(404).send('Property not found.');
        if (String(property.landlordId) === String(req.user._id)) {
            return res.status(403).send('You cannot report your own listing.');
        }

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await ListingReport.countDocuments({ reporterId: req.user._id, createdAt: { $gte: since } });
        if (recent >= MAX_REPORTS_PER_DAY) return res.redirect(back('limit'));

        await ListingReport.create({
            propertyId: property._id,
            reporterId: req.user._id,
            reason: report.reason,
            details: report.details
        });
        await notifyAdmins({
            category: 'report',
            title: 'New listing report',
            body: `${REPORT_REASONS[report.reason]}: "${property.title}"`,
            link: '/admin/reports'
        });
        return res.redirect(back('submitted'));
    } catch (error) {
        if (error.code === 11000) return res.redirect(back('exists'));
        return next(error);
    }
});

const REPORT_FILTERS = ['open', 'reviewed', 'dismissed', 'all'];

router.get('/admin/reports', requireRole('admin'), async (req, res, next) => {
    try {
        const filter = REPORT_FILTERS.includes(req.query.status) ? req.query.status : 'open';
        const query = filter === 'all' ? {} : { status: filter };
        const [reports, openCount] = await Promise.all([
            ListingReport.find(query)
                .populate('propertyId', 'title location status verificationStatus archivedAt')
                .populate('reporterId', 'name email')
                .sort({ createdAt: -1 })
                .limit(100),
            ListingReport.countDocuments({ status: 'open' })
        ]);
        return res.render('admin-reports', { reports, filter, openCount, reasons: REPORT_REASONS, user: req.user });
    } catch (error) {
        return next(error);
    }
});

router.post('/admin/reports/:id/status', requireRole('admin'), async (req, res, next) => {
    try {
        if (!['open', 'reviewed', 'dismissed'].includes(req.body.status)) return res.status(400).send('Invalid report status.');
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).send('Report not found.');
        const reopening = req.body.status === 'open';
        const report = await ListingReport.findByIdAndUpdate(
            req.params.id,
            { $set: { status: req.body.status, handledBy: reopening ? null : req.user._id, handledAt: reopening ? null : new Date() } },
            { new: true }
        );
        if (!report) return res.status(404).send('Report not found.');
        await recordAudit(req, 'report.status', { targetType: 'report', targetId: report._id, details: `status=${req.body.status}; property=${report.propertyId}` });
        return res.redirect(`/admin/reports?status=${REPORT_FILTERS.includes(req.query.back) ? req.query.back : 'open'}`);
    } catch (error) {
        if (error.code === 11000) return res.status(409).send('This person already has another open report on this listing.');
        return next(error);
    }
});

module.exports = router;
