import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 50
    },
    password: { type: String, required: true, select: false, minlength: 8 },
    role: {
        type: String,
        enum: ['admin', 'kitchen', 'pos', 'customer', 'waiter'],
        default: 'waiter'  // Least-privilege default; admin must be set explicitly
    },
    restaurantSlug: { type: String, required: true, default: 'default' },
    active: { type: Boolean, default: true },

    // Printing Configuration
    printerId: String, // Ref to restaurant.printers.id
    printTemplate: {
        header: { type: String, default: '' },
        footer: { type: String, default: 'Gracias por su visita' },
        showLogo: { type: Boolean, default: true },
        showPrices: { type: Boolean, default: true },
        fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' }
    }
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

export default mongoose.model('User', UserSchema);
