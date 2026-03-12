import Order from '../models/Order.js';

/**
 * Service to handle business logic for Orders
 */
class OrderService {
    /**
     * Calculates the total amount for an array of items
     * Ensures numeric precision to avoid string concatenation bugs
     * @param {Array} items 
     * @returns {number}
     */
    calculateTotal(items) {
        if (!Array.isArray(items)) return 0;
        const total = items.reduce((acc, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            return acc + (price * quantity);
        }, 0);
        return Math.round(total * 100) / 100;
    }

    /**
     * Updates order status and records it in history
     * @param {Object} order - Mongoose order document
     * @param {string} newStatus 
     */
    async updateOrderStatus(order, newStatus) {
        if (order.status === newStatus) return order;
        
        order.status = newStatus;
        order.statusHistory.push({
            status: newStatus,
            timestamp: new Date()
        });
        
        return await order.save();
    }

    /**
     * Updates an individual item status and records it in its history
     * @param {Object} order - Mongoose order document
     * @param {string} itemId 
     * @param {string} newStatus 
     */
    async updateItemStatus(order, itemId, newStatus) {
        const item = order.items.id(itemId) || order.items.find(i => String(i._id) === itemId);
        if (!item || item.status === newStatus) return order;

        item.status = newStatus;
        item.statusHistory.push({
            status: newStatus,
            timestamp: new Date()
        });

        return await order.save();
    }

    /**
     * Handles the complex logic of splitting and processing checkout
     * @param {Object} order - Mongoose order document
     * @param {Object} checkoutData 
     * @returns {Object} - { tickets, totalPaidFlag }
     */
    processCheckout(order, checkoutData) {
        const { splitType, parts, itemIds, userId, billingConfig } = checkoutData;
        let itemsTotal = 0;
        let itemsSummary = [];
        let totalPaidFlag = false;

        const remainingAmount = order.items
            .filter(i => !i.isPaid)
            .reduce((acc, i) => acc + (Number(i.price) * Number(i.quantity)), 0);

        if (splitType === 'by-user' && userId) {
            const userItems = order.items.filter(item => item.orderedBy?.id === userId && !item.isPaid);
            userItems.forEach(item => {
                itemsTotal += (Number(item.price) * Number(item.quantity));
                itemsSummary.push(`${item.quantity}x ${item.name}`);
                item.isPaid = true;
            });
            if (order.items.every(i => i.isPaid)) totalPaidFlag = true;
        } else if (splitType === 'by-item' && Array.isArray(itemIds)) {
            const itemsToPay = order.items.filter(item => itemIds.includes(String(item._id)) && !item.isPaid);
            itemsToPay.forEach(item => {
                itemsTotal += (Number(item.price) * Number(item.quantity));
                itemsSummary.push(`${item.quantity}x ${item.name}`);
                item.isPaid = true;
            });
            if (order.items.every(i => i.isPaid)) totalPaidFlag = true;
        } else {
            const numParts = (splitType === 'equal' && parts > 1) ? Number(parts) : 1;
            // Focus on remaining balance for equal splits
            itemsTotal = remainingAmount / numParts;
            itemsSummary = order.items.filter(i => !i.isPaid).map(item => `${item.quantity}x ${item.name}`);
            
            if (splitType !== 'equal' || numParts === 1) {
                totalPaidFlag = true;
                order.items.forEach(i => i.isPaid = true);
            }
        }

        // --- Fiscal Calculations ---
        const vatPercent = Number(billingConfig?.vatPercentage) || 0;
        const tipPercent = Number(billingConfig?.tipPercentage) || 0;
        
        // Final charged amount per ticket
        let finalAmount = itemsTotal;
        let tipAmount = 0;
        
        if (billingConfig?.tipEnabled) {
            tipAmount = itemsTotal * (tipPercent / 100);
            finalAmount += tipAmount;
        }

        // Precise rounding
        finalAmount = Math.round(finalAmount * 100) / 100;
        tipAmount = Math.round(tipAmount * 100) / 100;

        // Base and VAT are calculated from the itemsTotal (which is VAT inclusive)
        const totalItemsOnly = finalAmount - tipAmount;
        const baseAmount = totalItemsOnly / (1 + (vatPercent / 100));
        const vatAmount = totalItemsOnly - baseAmount;

        return { 
            finalAmount,
            baseAmount: Math.round(baseAmount * 100) / 100,
            vatAmount: Math.round(vatAmount * 100) / 100,
            vatPercentage: vatPercent,
            tipAmount,
            itemsSummary, 
            totalPaidFlag,
            ticketCount: (splitType === 'equal' && parts > 1) ? Number(parts) : 1
        };
    }
}

export default new OrderService();
