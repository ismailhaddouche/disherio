const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: ['admin', 'kitchen', 'pos', 'customer'],
        default: 'admin'
    },
    restaurantSlug: { type: String, required: true },
    active: { type: Boolean, default: true }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
