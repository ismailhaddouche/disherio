import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    customId: { type: String, required: true }, // The ID format ORDERID/1-X
    method: { type: String, enum: ['cash', 'card'], default: 'cash' },
    amount: { type: Number, required: true, min: 0 }, // Final amount (Total paid)
    baseAmount: { type: Number, default: 0 }, // amount - vat - tip
    vatAmount: { type: Number, default: 0 },
    vatPercentage: { type: Number, default: 0 },
    tipAmount: { type: Number, default: 0 },
    itemsSummary: [String], // Simple list of what was paid
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Ticket', TicketSchema);
