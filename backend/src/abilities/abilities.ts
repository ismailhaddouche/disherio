import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { JwtPayload } from '../middlewares/auth';

type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
type Subjects =
  | 'Restaurant'
  | 'Printer'
  | 'Staff'
  | 'Role'
  | 'Category'
  | 'Dish'
  | 'Totem'
  | 'TotemSession'
  | 'Order'
  | 'ItemOrder'
  | 'Payment'
  | 'KDS'
  | 'Customer'
  | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilityFor(user: JwtPayload): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const perms = new Set(user.permissions);

  // ADMIN
  if (perms.has('ADMIN')) {
    can('manage', 'all');
    return build();
  }

  // POS
  if (perms.has('POS')) {
    can('read', 'Totem');
    can('read', 'TotemSession');
    can('create', 'TotemSession');
    can('update', 'TotemSession');
    can('read', 'Order');
    can('create', 'Order');
    can('update', 'Order');
    can('create', 'ItemOrder');
    can('update', 'ItemOrder');
    can('delete', 'ItemOrder');
    can('create', 'Payment');
    can('update', 'Payment');
    can('create', 'Totem');
    can('update', 'Totem');
    can('delete', 'Totem');
  }

  // TAS
  if (perms.has('TAS')) {
    can('read', 'Totem');
    can('manage', 'Totem', { totem_type: 'TEMPORARY' } as any);
    can('read', 'TotemSession');
    can('create', 'TotemSession');
    can('update', 'TotemSession');
    can('read', 'Order');
    can('create', 'Order');
    can('update', 'Order');
    can('create', 'ItemOrder');
    can('update', 'ItemOrder');
    can('delete', 'ItemOrder');
    can('create', 'Payment');
    can('read', 'Customer');
    can('create', 'Customer');
    can('delete', 'Customer');
  }

  // KTS
  if (perms.has('KTS')) {
    can('read', 'Order');
    can('read', 'ItemOrder');
    can('update', 'ItemOrder');
    can('update', 'Dish');
    can('read', 'KDS'); // BUG-03: was missing, blocked /orders/kitchen endpoint
  }

  return build();
}
