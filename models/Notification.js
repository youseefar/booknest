const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: String, enum: ['booking', 'listing', 'inquiry', 'report'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, trim: true, maxlength: 500, default: '' },
    link: { type: String, maxlength: 200, default: '' },
    readAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: false } });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
