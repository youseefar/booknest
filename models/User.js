const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 254
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    phone: {
        type: String,
        default: '',
        maxlength: 24
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
    passwordResetToken: {
        type: String,
        select: false,
        default: undefined
    },
    passwordResetExpires: {
        type: Date,
        select: false,
        default: undefined
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

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ passwordResetToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);