const mongoose = require('mongoose');

const cloudinaryVideoCleanupSchema = new mongoose.Schema({
    publicId: {
        type: String,
        required: true,
        unique: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    availableAt: {
        type: Date,
        default: Date.now
    },
    lastError: {
        type: String,
        default: ''
    }
}, { timestamps: true });

cloudinaryVideoCleanupSchema.index({ availableAt: 1 });

module.exports = mongoose.model('CloudinaryVideoCleanup', cloudinaryVideoCleanupSchema);
