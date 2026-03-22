import mongoose from 'mongoose';

const VALID_ROLES = ['admin', 'kitchen', 'pos', 'customer', 'waiter', 'system'];
const LOG_TTL_DAYS = 90;

const ActivityLogSchema = new mongoose.Schema({
    userId:    { type: String, required: true, index: true },
    username:  { type: String, required: true },
    role:      { 
        type: String, 
        required: true, 
        enum: {
            values: VALID_ROLES,
            message: '{VALUE} no es un rol válido'
        }
    },
    action:    { type: String, required: true, uppercase: true, trim: true, index: true },
    details:   { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: false }); // custom 'timestamp' field is the creation date

// TTL index: documents are automatically removed after LOG_TTL_DAYS days
ActivityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: LOG_TTL_DAYS * 24 * 60 * 60 });

export default mongoose.model('ActivityLog', ActivityLogSchema);
