import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'El nombre de usuario es obligatorio'],
        unique: true,
        trim: true,
        lowercase: true,
        minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres'],
        maxlength: [50, 'El nombre de usuario no puede exceder los 50 caracteres']
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true,
        unique: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Por favor ingresa un correo electrónico válido'],
        index: true
    },
    password: { 
        type: String, 
        required: [true, 'La contraseña es obligatoria'], 
        select: false, 
        minlength: [8, 'La contraseña debe tener al menos 8 caracteres'] 
    },
    role: {
        type: String,
        enum: {
            values: ['admin', 'kitchen', 'pos', 'customer', 'waiter'],
            message: '{VALUE} no es un rol válido'
        },
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
        fontSize: { 
            type: String, 
            enum: {
                values: ['small', 'medium', 'large'],
                message: '{VALUE} no es un tamaño de fuente válido'
            }, 
            default: 'medium' 
        }
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
