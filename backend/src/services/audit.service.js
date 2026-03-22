import ActivityLog from '../models/ActivityLog.js';

/**
 * Service to handle secure server-side auditing
 */
class AuditService {
    /**
     * Records a critical action in the database
     * @param {Object} req - Express request object (to extract user)
     * @param {string} action - Action slug (e.g., 'PRODUCT_PRICE_CHANGED')
     * @param {Object} details - Data related to the action
     */
    async log(req, action, details = {}) {
        if (!req.user) {
            console.warn('[AUDIT] Attempted to log without authenticated user:', action);
            return;
        }

        try {
            const logEntry = new ActivityLog({
                userId: req.user.userId,
                username: req.user.username,
                role: req.user.role,
                action,
                details: {
                    ...details,
                    ip: req.ip,
                    userAgent: req.get('User-Agent')
                },
                timestamp: new Date()
            });

            await logEntry.save();
        } catch (error) {
            console.error('[AUDIT] Failed to save activity log:', error);
        }
    }

    /**
     * Specialized log for data changes (before/after)
     */
    async logChange(req, action, previousState, newState, extraDetails = {}) {
        const diff = {};
        
        // Simple top-level diff for objects
        if (previousState && newState) {
            Object.keys(newState).forEach(key => {
                if (JSON.stringify(previousState[key]) !== JSON.stringify(newState[key])) {
                    diff[key] = {
                        from: previousState[key],
                        to: newState[key]
                    };
                }
            });
        }

        return this.log(req, action, {
            ...extraDetails,
            changes: diff
        });
    }
}

export default new AuditService();
