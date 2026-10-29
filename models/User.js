const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    phone: {
        type: String,
        default: ''
    },
    role: {
        type: String,
        enum: ['student', 'landlord', 'admin'],
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    payoutSubaccountCode: {
        type: String,
        default: null
    },
    payoutSubaccountMode: {
        type: String,
        enum: ['test', 'live'],
        default: null
    },
    payoutBankCode: {
        type: String,
        default: ''
    },
    payoutBankName: {
        type: String,
        default: ''
    },
    payoutAccountName: {
        type: String,
        default: ''
    },
    payoutAccountLast4: {
        type: String,
        default: ''
    },
    payoutRecipientCode: {
        type: String,
        default: null
    },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
});

module.exports = mongoose.model('User', userSchema);