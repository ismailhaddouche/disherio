// ─── User Roles ───────────────────────────────────────────────────────────────
export const ROLES = {
    ADMIN:    'admin',
    KITCHEN:  'kitchen',
    POS:      'pos',
    CUSTOMER: 'customer',
    WAITER:   'waiter',
};

// ─── Order Status ─────────────────────────────────────────────────────────────
export const ORDER_STATUS = {
    ACTIVE:    'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
};

// ─── Payment Status ───────────────────────────────────────────────────────────
export const PAYMENT_STATUS = {
    UNPAID:     'unpaid',
    PAID:       'paid',
    SPLIT:      'split',
    PROCESSING: 'processing',
};

// ─── Payment Method ───────────────────────────────────────────────────────────
export const PAYMENT_METHOD = {
    CASH: 'cash',
    CARD: 'card',
};

// ─── Split Types ─────────────────────────────────────────────────────────────
export const SPLIT_TYPE = {
    SINGLE:  'single',
    EQUAL:   'equal',
    BY_ITEM: 'by-item',
    BY_USER: 'by-user',
};

// ─── Item Status ──────────────────────────────────────────────────────────────
export const ITEM_STATUS = {
    PENDING:   'pending',
    PREPARING: 'preparing',
    READY:     'ready',
    SERVED:    'served',
    CANCELLED: 'cancelled',
};

// ─── Socket Events ────────────────────────────────────────────────────────────
export const SOCKET_EVENTS = {
    ORDER_UPDATE:       'order-update',   // legacy event name (some clients listen to this)
    ORDER_UPDATED:      'order-updated',
    MENU_UPDATE:        'menu-update',
    CONFIG_UPDATED:     'config-updated',
    SESSION_ENDED:      'session-ended',
    ALL_SESSIONS_ENDED: 'all-sessions-ended',
};

// ─── HTTP Status Codes ────────────────────────────────────────────────────────
export const HTTP_STATUS = {
    OK:             200,
    CREATED:        201,
    BAD_REQUEST:    400,
    UNAUTHORIZED:   401,
    FORBIDDEN:      403,
    NOT_FOUND:      404,
    CONFLICT:       409,
    INTERNAL_ERROR: 500,
};
