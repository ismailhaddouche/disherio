# ADR-003: Frontend State Management

**Status:** Implemented

## Context

The frontend needed a way to share authentication state, kitchen item lists, and cart contents across components without prop-drilling or a heavyweight library.

## Decision

Use Angular Signals for all global and local state. No external state management library (NgRx, Akita, etc.) is used.

### Global stores

Stores are plain objects exported as module-level singletons. They expose read-only signals and mutation methods.

```typescript
// store/auth.store.ts
const _user = signal<AuthUser | null>(loadAuthenticatedUser());

export const authStore = {
  user: _user.asReadonly(),
  isAuthenticated: computed(() => _user() !== null),
  hasPermission: (perm: string) => computed(() =>
    _user()?.permissions.includes(perm) ?? false
  ),

  setAuth(user: AuthUser, _expiresAt: number) {
    _user.set(user);
    sessionStorage.setItem('disherio-auth-state', JSON.stringify(user));
  },

  clearAuth() {
    _user.set(null);
    sessionStorage.removeItem('disherio-auth-state');
  },
};
```

The persisted value contains non-secret UI and authorization context only.
Access and refresh tokens remain exclusively in HttpOnly cookies. Language is a
display preference and may be retained separately in browser storage.

```typescript
// store/kds.store.ts
const _items = signal<KdsItem[]>([]);

export const kdsStore = {
  items: _items.asReadonly(),
  addItem: (item: KdsItem) => _items.update(list => [item, ...list]),
  updateItemState: (id: string, state: ItemState) =>
    _items.update(list =>
      list.map(i => i._id === id ? { ...i, item_state: state } : i)
    ),
  setItems: (items: ItemOrder[]) => _items.set(items),
};
```

### Why not NgRx

- Signals require significantly less boilerplate
- Change detection is fine-grained by default with signals
- Signals are synchronous and easy to debug
- The application state surface is small enough that a full Redux pattern would add complexity without benefit

### CASL directive reactivity

The `*caslCan` structural directive uses `effect()` to re-evaluate permissions whenever `authStore.user()` changes. This means DOM updates are automatic on login and logout without requiring a page reload.

```typescript
@Directive({ selector: '[caslCan]', standalone: true })
export class CaslCanDirective {
  action = input.required<string>({ alias: 'caslCan' });
  subject = input.required<string>({ alias: 'caslCanSubject' });

  constructor() {
    effect(() => {
      const user = authStore.user();
      const action = this.action();
      const subject = this.subject();
      this.vcr.clear();
      if (!user) return;
      const ability = defineAbilityFor(user);
      if (ability.can(action as any, subject as any)) {
        this.vcr.createEmbeddedView(this.tpl);
      }
    });
  }
}
```

## Consequences

- Components subscribe to only the signals they need; unrelated signal changes do not trigger re-renders
- Synchronous store state does not need an `async` pipe or manual subscription;
  HTTP and event streams continue to use RxJS
- Debugging is straightforward: signals are synchronous values
- No Redux DevTools integration; state is inspected through component inputs,
  signal reads, and browser development tools
