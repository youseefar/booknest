const AuditLog = require('../models/AuditLog');

// Records a sensitive administrative action. Never throws: a failed log write must not
// block or hide the action itself, but it is reported on the server log.
async function recordAudit(req, action, { targetType = '', targetId = '', details = '' } = {}) {
    try {
        await AuditLog.create({
            actorId: req.user?._id || null,
            actorEmail: req.user?.email || '',
            action,
            targetType,
            targetId: String(targetId || ''),
            details: String(details || '').slice(0, 500),
            ip: String(req.ip || '').slice(0, 64)
        });
    } catch (error) {
        console.error('Audit log write failed:', { action, name: error.name });
    }
}

module.exports = { recordAudit };
