const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorEmail: { type: String, maxlength: 254, default: '' },
    action: { type: String, required: true, maxlength: 80 },
    targetType: { type: String, maxlength: 40, default: '' },
    targetId: { type: String, maxlength: 80, default: '' },
    details: { type: String, maxlength: 500, default: '' },
    ip: { type: String, maxlength: 64, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
