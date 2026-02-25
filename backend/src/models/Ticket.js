const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    customId: { type: String, required: true }, // The ID format ORDERID/1-X
    method: { type: String, default: 'cash' },
    amount: Number,
    itemsSummary: [String], // Simple list of what was paid
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);
