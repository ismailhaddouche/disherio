// ─── Local Storage Keys ───────────────────────────────────────────────────────
export const STORAGE_KEYS = {
    SESSION:         'disher_session',
    USER_ID:         'disher_user_id',
    USER_NAME:       'disher_user_name',
    CURRENT_SESSION: 'disher_current_session',
    LOCAL_PRINTER:   'disher_local_printer',
    LOCAL_AUTOPRINT: 'disher_local_autoprint',
    APP_LANG:        'appLang',
} as const;

// ─── Route Parameters ─────────────────────────────────────────────────────────
export const ROUTE_PARAMS = {
    TABLE_NUMBER: 'tableNumber',
    SESSION_CODE: 'sessionCode',
    TOTEM_ID:     'totemId',
} as const;

// ─── User Roles ───────────────────────────────────────────────────────────────
export const USER_ROLES = {
    ADMIN:    'admin',
    KITCHEN:  'kitchen',
    POS:      'pos',
    CUSTOMER: 'customer',
    WAITER:   'waiter',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// ─── Role redirect map ────────────────────────────────────────────────────────
export const ROLE_REDIRECTS: Record<string, string> = {
    [USER_ROLES.ADMIN]:   '/admin/dashboard',
    [USER_ROLES.KITCHEN]: '/admin/kds',
    [USER_ROLES.POS]:     '/admin/pos',
    [USER_ROLES.WAITER]:  '/admin/waiter',
};
export const DEFAULT_REDIRECT = '/';

// ─── Order Status ─────────────────────────────────────────────────────────────
export const ORDER_STATUS = {
    ACTIVE:    'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

// ─── Payment Status ───────────────────────────────────────────────────────────
export const PAYMENT_STATUS = {
    UNPAID:     'unpaid',
    PAID:       'paid',
    SPLIT:      'split',
    PROCESSING: 'processing',
} as const;

// ─── Payment Method ───────────────────────────────────────────────────────────
export const PAYMENT_METHOD = {
    CASH: 'cash',
    CARD: 'card',
} as const;

export type PaymentMethod = typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD];

// ─── Split Types ──────────────────────────────────────────────────────────────
export const SPLIT_TYPE = {
    SINGLE:   'single',
    EQUAL:    'equal',
    BY_ITEM:  'by-item',
    BY_USER:  'by-user',
} as const;

export type SplitType = typeof SPLIT_TYPE[keyof typeof SPLIT_TYPE];

// ─── Item Status ──────────────────────────────────────────────────────────────
export const ITEM_STATUS = {
    PENDING:   'pending',
    READY:     'ready',
    SERVED:    'served',
    CANCELLED: 'cancelled',
} as const;

// ─── Socket Events ────────────────────────────────────────────────────────────
export const SOCKET_EVENTS = {
    ORDER_UPDATE:      'order-update',
    ORDER_UPDATED:     'order-updated',
    MENU_UPDATE:       'menu-update',
    CONFIG_UPDATED:    'config-updated',
    SESSION_ENDED:     'session-ended',
    ALL_SESSIONS_ENDED:'all-sessions-ended',
} as const;

// ─── System User IDs (POS-assigned items) ────────────────────────────────────
export const SYSTEM_USER_IDS = {
    POS:    'pos',
    STAFF:  'staff',
    ORPHAN: 'orphan',
} as const;

// ─── Tip Presets ──────────────────────────────────────────────────────────────
export const TIP_PRESETS = [0, 5, 10, 15] as const;

// ─── Auth retry config ────────────────────────────────────────────────────────
export const AUTH_RETRY = {
    MAX_RETRIES: 3,
    DELAY_MS:    150,
} as const;
