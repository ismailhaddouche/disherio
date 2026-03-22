export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderStatus = 'active' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'split' | 'processing';

export interface IOrderedBy {
  id?: string;
  name?: string;
}

export interface ISelectedVariant {
  name: string;
  priceAddon: number;
}

export interface ISelectedAddon {
  name: string;
  price: number;
}

export interface IStatusHistory {
  status: string;
  timestamp: string | Date;
}

export interface IOrderItem {
  _id?: string;
  name: string;
  price: number;
  quantity: number;
  status: OrderItemStatus;
  station: string;
  orderedBy?: IOrderedBy;
  selectedVariant?: ISelectedVariant;
  selectedAddons?: ISelectedAddon[];
  notes?: string;
  emoji?: string;
  image?: string;
  isCustom: boolean;
  isPaid: boolean;
  statusHistory?: IStatusHistory[];
  createdAt?: string | Date;
}

export interface IOrder {
  _id?: string;
  tableNumber: string;
  totemId: number;
  items: IOrderItem[];
  totalAmount: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory?: IStatusHistory[];
  sessionId?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  __v?: number; // optimistic concurrency
}
