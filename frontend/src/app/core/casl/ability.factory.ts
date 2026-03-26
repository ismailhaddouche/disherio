import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { AuthUser } from '../../store/auth.store';

type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
type Subjects = 'Restaurant' | 'Printer' | 'Staff' | 'Role' | 'Category' | 'Dish' | 'Totem' | 'TotemSession' | 'Order' | 'ItemOrder' | 'Payment' | 'KDS' | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilityFor(user: AuthUser): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const perms = new Set(user.permissions);

  if (perms.has('ADMIN')) {
    can('manage', 'all');
    return build();
  }

  if (perms.has('POS')) {
    can('read', 'Totem');
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

  if (perms.has('TAS')) {
    can('read', 'Totem');
    can('create', 'Totem');
    can('update', 'Totem');
    can('delete', 'Totem');
    can('create', 'TotemSession');
    can('update', 'TotemSession');
    can('read', 'Order');
    can('create', 'Order');
    can('update', 'Order');
    can('create', 'ItemOrder');
    can('update', 'ItemOrder');
    can('delete', 'ItemOrder');
    can('create', 'Payment');
  }

  if (perms.has('KTS')) {
    can('read', 'Order');
    can('read', 'ItemOrder');
    can('update', 'ItemOrder');
    can('update', 'Dish');
    can('read', 'KDS');
  }

  return build();
}
