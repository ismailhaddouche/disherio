export type UserRole = 'admin' | 'waiter' | 'kitchen' | 'pos' | 'totem';

export interface IUser {
  _id?: string;
  username: string;
  role: UserRole;
  password?: string;
  restaurantSlug?: string;
  printerId?: string;
  printTemplate?: any;
  fontSize?: 'small' | 'medium' | 'large';
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
