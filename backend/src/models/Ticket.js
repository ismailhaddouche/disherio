import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
    orderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    customId:      { type: String, required: true, index: true }, // Format: ORDERID/1-X
    method:        { 
        type: String, 
        enum: {
            values: ['cash', 'card'],
            message: '{VALUE} no es un método de pago válido'
        }, 
        required: true 
    },
    amount:        { type: Number, required: true, min: 0 },  // Grand total paid
    baseAmount:    { type: Number, default: 0, min: 0 },       // Net amount (excl. VAT+tip)
    vatAmount:     { type: Number, default: 0, min: 0 },
    vatPercentage: { type: Number, default: 0, min: 0, max: 100 },
    tipAmount:     { type: Number, default: 0, min: 0 },
    itemsSummary:  { type: [String], default: [] },            // Readable summary
    timestamp:     { type: Date, default: Date.now, index: true }
}, { timestamps: false }); // 'timestamp' field covers creation date

export default mongoose.model('Ticket', TicketSchema);
