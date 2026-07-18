import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { JwtPayload } from '../middlewares/auth';

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'updateAvailability' | 'delete';
export type Subjects =
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
    can('read', 'Payment');
    can('create', 'Payment');
    can('update', 'Payment');
    can('create', 'Totem');
    can('update', 'Totem');
    can('delete', 'Totem');
    can('read', 'Customer');
    can('create', 'Customer');
  }

  // TAS
  if (perms.has('TAS')) {
    can('read', 'Totem');
    // Grant manage on all Totem types here so the RBAC middleware gate lets
    // TAS through; the restriction to TEMPORARY totems only is enforced in
    // the service/controller layer (TotemService.assertCanMutateTotem), which
    // has access to the loaded document. requirePermission cannot pass a
    // resource instance, so a conditional CASL rule would be silently
    // discarded and TAS would be blocked from every totem, including the
    // temporary tables it must manage.
    can('manage', 'Totem');
    can('read', 'TotemSession');
    can('create', 'TotemSession');
    can('update', 'TotemSession');
    can('read', 'Order');
    can('create', 'Order');
    can('update', 'Order');
    can('read', 'ItemOrder');
    can('create', 'ItemOrder');
    can('update', 'ItemOrder');
    can('delete', 'ItemOrder');
    can('read', 'Payment');
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
    can('read', 'Dish');
    can('updateAvailability', 'Dish');
    can('read', 'KDS');
    can('read', 'Totem');
    can('read', 'TotemSession');
  }

  return build();
}
