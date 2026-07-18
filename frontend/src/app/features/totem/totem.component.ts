import { Component, OnInit, OnDestroy, computed, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { cartStore, CartItem } from '../../store/cart.store';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { SocketService } from '../../services/socket/socket.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  TotemService,
  type PublicTotemCustomer,
  type PublicTotemSession,
} from '../../services/totem.service';
import type { Dish, Category, ItemOrder, OrderLimitStatus } from '../../types';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { getDishCategoryId } from '../../shared/utils/dish-category.utils';
import { TotemCartService } from './totem-cart.service';

type SessionInfo = PublicTotemSession;
type CustomerInfo = PublicTotemCustomer;

interface OrderLimitErrorDetails {
  status?: OrderLimitStatus;
  blockedLimitedDishIds?: string[];
  allowedUnlimitedDishIds?: string[];
  canSubmitUnlimitedOnly?: boolean;
}

type ViewTab = 'menu' | 'my-orders' | 'all-orders';

@Component({
  selector: 'app-totem',
  standalone: true,
  imports: [CommonModule, A11yModule, LocalizePipe, CurrencyFormatPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './totem.component.html',
  providers: [TotemCartService],
})
export class TotemComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private socket = inject(SocketService);
  themeService = inject(ThemeService);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private totemService = inject(TotemService);
  private confirmation = inject(ConfirmationService);
  private cart = inject(TotemCartService);
  private destroy$ = new Subject<void>();

  restaurantName = signal('');
  categories = signal<Category[]>([]);
  dishes = signal<Dish[]>([]);
  selectedCategory = signal<string | null>(null);
  showCart = signal(false);
  sessionInfo = signal<SessionInfo | null>(null);
  customerInfo = signal<CustomerInfo | null>(null);
  submittingOrder = signal(false);

  // View state
  currentView = signal<ViewTab>('menu');

  // Orders
  myOrders = signal<ItemOrder[]>([]);
  allOrders = signal<ItemOrder[]>([]);
  loadingMyOrders = signal(false);
  loadingAllOrders = signal(false);

  // Name modal signals
  showNameModal = signal(false);
  customerNameInput = signal('');
  nameError = signal<string | null>(null);
  savingName = signal(false);

  // Shown when the waiter closed the session: hides the whole menu and
  // replaces it with a thank-you / closed screen.
  sessionClosedScreen = signal(false);

  // Dish detail modal signals
  selectedDish = this.cart.selectedDish;
  selectedVariantId = this.cart.selectedVariantId;
  selectedVariantPrice = this.cart.selectedVariantPrice;
  selectedExtras = this.cart.selectedExtras;
  detailQuantity = this.cart.detailQuantity;

  private qrToken: string | null = null;

  cartItems = this.cart.items;
  cartTotal = this.cart.total;
  cartCount = this.cart.count;

  filteredDishes = computed(() => {
    const cat = this.selectedCategory();
    const all = this.dishes();
    return cat ? all.filter((d) => this.categoryIdOf(d) === cat) : all;
  });

  private isUnlimitedCategory(dish: Dish): boolean {
    const id = this.categoryIdOf(dish);
    const category = this.categories().find(cat => cat._id === id);
    return Boolean(category?.unlimited_orders);
  }

  /**
   * Extract the category id from a dish. The backend menu endpoint populates
   * `category_id` into a full category object, so it can arrive as either a
   * plain id string or `{ _id: string, ... }`. Normalize to the id string.
   */
  private categoryIdOf(dish: Dish): string {
    return getDishCategoryId(dish);
  }

  ngOnInit() {
    const qr = this.route.snapshot.paramMap.get('qr');
    if (!qr) return;
    this.qrToken = qr;
    this.socket.acquireConnection(qr);

    // Load menu dishes
    this.totemService.getMenuByQR(qr)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ categories, dishes }) => {
          if (categories.length) this.restaurantName.set(this.i18n.translate('totem.menu'));
          this.categories.set(categories);
          this.dishes.set(dishes);
        },
        error: (err) => {
          this.restaurantName.set(this.i18n.translate('totem.menu_error'));
          this.notify.error(this.i18n.translate('totem.menu_error'));
        },
      });

    // Get or create session for this totem
    this.totemService.startSessionByQR(qr)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          if (session.totem_name) {
            this.restaurantName.set(session.totem_name);
          }
          // A session that is not STARTED is closed/paid: show the closed
          // screen and never offer the name modal. No session_token is
          // returned by the backend in this case.
          if (session.totem_state !== 'STARTED' || !session.session_token) {
            this.sessionInfo.set(session);
            this.sessionClosedScreen.set(true);
            return;
          }
          // Keep the session credential in per-tab storage. Never place it in
          // the URL, where it can leak through history, screenshots or referrers.
          this.saveSessionTokenToStorage(session.session_id, session.session_token);
          this.sessionInfo.set(session);
          // Check if we already have a customer in session storage
          this.loadCustomerFromStorage(session.session_id);
        },
        error: (err) => {
          this.notify.error(this.i18n.translate('totem.session_error'));
        },
      });

    // When the waiter closes the session, kick the customer to the closed
    // screen, drop persisted session/customer state, and leave the socket room.
    this.socket.totemSessionClosed$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.handleSessionClosed());
    this.socket.totemForceDisconnect$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.handleSessionClosed());
  }

  private refreshSessionInfo() {
    if (!this.qrToken) return;
    this.totemService.startSessionByQR(this.qrToken)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          if (session.totem_state !== 'STARTED' || !session.session_token) {
            this.sessionInfo.set(session);
            this.sessionClosedScreen.set(true);
            return;
          }
          this.saveSessionTokenToStorage(session.session_id, session.session_token);
          this.sessionInfo.set(session);
        },
        error: () => undefined,
      });
  }

  /**
   * React to the waiter closing the session: hide the menu, clear any stored
   * guest identity for this session so a reload does not silently rejoin, and
   * leave the socket room.
   */
  private handleSessionClosed(): void {
    const session = this.sessionInfo();
    if (session) {
      this.clearSessionStorage(session.session_id);
    }
    this.sessionClosedScreen.set(true);
    this.showNameModal.set(false);
    this.customerInfo.set(null);
    this.socket.leaveTotemSession();
  }

  /** Remove persisted session token and customer for a given session. */
  private clearSessionStorage(sessionId: string): void {
    sessionStorage.removeItem(`totem_session_${sessionId}`);
    sessionStorage.removeItem(`totem_customer_${sessionId}`);
  }

  /** Navigate to the app base URL. Called by the closed screen "exit" button. */
  exitToHome(): void {
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.socket.leaveTotemSession();
    this.socket.releaseConnection();
    this.destroy$.next();
    this.destroy$.complete();
  }

  setView(view: ViewTab) {
    this.currentView.set(view);

    if (view === 'my-orders') {
      this.loadMyOrders();
    } else if (view === 'all-orders') {
      this.loadAllOrders();
    }
  }

  private loadMyOrders() {
    const customer = this.customerInfo();
    const session = this.sessionInfo();
    if (!customer || !session || !this.qrToken) {
      this.showNameModal.set(true);
      return;
    }

    this.loadingMyOrders.set(true);
    this.totemService.getCustomerOrders(
      this.qrToken,
      session.session_id,
      customer.customer_id,
      session.session_token
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.myOrders.set(orders);
          this.loadingMyOrders.set(false);
        },
        error: (err) => {
          this.loadingMyOrders.set(false);
        },
      });
  }

  private loadAllOrders() {
    const session = this.sessionInfo();
    if (!session || !this.qrToken) return;

    this.loadingAllOrders.set(true);
    this.totemService.getSessionOrders(this.qrToken, session.session_id, session.session_token)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.allOrders.set(orders);
          this.loadingAllOrders.set(false);
        },
        error: (err) => {
          this.loadingAllOrders.set(false);
        },
      });
  }

  private loadCustomerFromStorage(sessionId: string) {
    const stored = sessionStorage.getItem(`totem_customer_${sessionId}`);
    if (stored) {
      try {
        const customer: CustomerInfo = JSON.parse(stored);
        this.customerInfo.set(customer);
        this.joinSession(sessionId, customer);
      } catch {
        this.showNameModal.set(true);
      }
    } else {
      this.showNameModal.set(true);
    }
  }

  private saveCustomerToStorage(customer: CustomerInfo, sessionId: string) {
    sessionStorage.setItem(`totem_customer_${sessionId}`, JSON.stringify(customer));
  }

  private joinSession(sessionId: string, customer: CustomerInfo): void {
    const session = this.sessionInfo();
    if (!this.qrToken || !session?.session_token || session.session_id !== sessionId) return;
    this.socket.joinTotemSession(
      sessionId,
      this.qrToken,
      customer.customer_name,
      customer.customer_id,
      session.session_token
    );
  }

  /** Persist the ephemeral session token so it survives page reloads. */
  private saveSessionTokenToStorage(sessionId: string, sessionToken: string): void {
    sessionStorage.setItem(`totem_session_${sessionId}`, JSON.stringify({ session_token: sessionToken }));
  }

  changeCustomerName() {
    this.customerNameInput.set(this.customerInfo()?.customer_name || '');
    this.showNameModal.set(true);
  }

  saveCustomerName() {
    const name = this.customerNameInput().trim();
    if (name.length < 2) {
      this.nameError.set(this.i18n.translate('totem.name_too_short'));
      return;
    }

    const session = this.sessionInfo();
    if (!session || !this.qrToken) {
      this.nameError.set(this.i18n.translate('totem.session_not_ready'));
      return;
    }

    this.savingName.set(true);
    this.nameError.set(null);

    this.totemService.createCustomer(
      this.qrToken,
      session.session_id,
      name,
      session.session_token
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          this.customerInfo.set(customer);
          this.saveCustomerToStorage(customer, session.session_id);
          this.joinSession(session.session_id, customer);
          this.savingName.set(false);
          this.showNameModal.set(false);
          this.notify.success(`${this.i18n.translate('totem.welcome_message').replace('{{name}}', customer.customer_name)}`);
        },
        error: (err) => {
          this.savingName.set(false);
          const errorCode = err.error?.errorCode;
          if (err.status === 409 || errorCode === 'CUSTOMER_NAME_TAKEN') {
            this.nameError.set(this.i18n.translate('totem.name_taken'));
            this.customerNameInput.set('');
          } else if (err.status === 401 || errorCode === 'INVALID_TOKEN') {
            this.nameError.set(this.i18n.translate('totem.session_closed'));
          } else {
            this.nameError.set(err.error?.message || this.i18n.translate('totem.customer_error'));
          }
        },
      });
  }

  selectCategory(catId: string) {
    this.selectedCategory.set(catId);
  }

  addToCart(dish: Dish) {
    this.cart.addDish(dish, this.isUnlimitedCategory(dish));
  }

  openDishModal(dish: Dish) {
    this.cart.openDetails(dish);
  }

  closeDishModal() {
    this.cart.closeDetails();
  }

  selectVariant(variantId: string, price: number) {
    this.cart.selectVariant(variantId, price);
  }

  toggleExtraSelection(extraId: string, price: number) {
    this.cart.toggleExtra(extraId, price);
  }

  isExtraSelected(extraId: string): boolean {
    return this.cart.isExtraSelected(extraId);
  }

  calculateDetailTotal(dish: Dish): number {
    return this.cart.detailTotal(dish);
  }

  addDishWithDetails(dish: Dish) {
    this.cart.addConfiguredDish(dish, this.isUnlimitedCategory(dish));
  }

  incrementCartItem(item: CartItem) {
    this.cart.increment(item);
  }

  decrementCartItem(item: CartItem) {
    this.cart.decrement(item);
  }

  removeCartItem(item: CartItem) {
    this.cart.remove(item);
  }

  toggleCart() {
    this.showCart.update((v) => !v);
  }

  submitOrder() {
    if (!this.qrToken || this.cartItems().length === 0) return;

    const customer = this.customerInfo();
    if (!customer) {
      this.showNameModal.set(true);
      this.showCart.set(false);
      return;
    }

    this.confirmation.confirm(this.i18n.translate('totem.confirm_shared_order'))
      .pipe(takeUntil(this.destroy$))
      .subscribe(confirmed => {
        if (confirmed) this.submitCartItems(this.cartItems(), false);
      });
  }

  private submitCartItems(cartItems: CartItem[], unlimitedOnly: boolean) {
    if (!this.qrToken || cartItems.length === 0) return;
    const customer = this.customerInfo();
    if (!customer) return;

    const session = this.sessionInfo();
    if (!session) return;

    this.submittingOrder.set(true);

    const items = cartItems.map((item) => ({
      dishId: item.dishId,
      quantity: item.quantity,
      variantId: item.variantId,
      extras: item.extras.map((e) => e.extraId),
    }));

    this.totemService.placeOrder(
      this.qrToken,
      session.session_id,
      items,
      customer.customer_id,
      session.session_token
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submittingOrder.set(false);
          this.notify.success(this.i18n.translate('totem.order_sent'));
          if (unlimitedOnly) {
            for (const item of cartItems) {
              cartStore.removeItem(item.dishId, item.variantId, item.extras, item.customerId);
            }
          } else {
            cartStore.clear();
          }
          this.showCart.set(false);
          this.refreshSessionInfo();
          // Refresh orders if we're in orders view
          if (this.currentView() === 'my-orders') {
            this.loadMyOrders();
          } else if (this.currentView() === 'all-orders') {
            this.loadAllOrders();
          }
        },
        error: (err) => {
          this.submittingOrder.set(false);
          const details = err.error?.details as OrderLimitErrorDetails | undefined;
          if (!unlimitedOnly && details?.status) {
            const current = this.sessionInfo();
            if (current) {
              this.sessionInfo.set({ ...current, order_limit_status: details.status });
            }
          }
          if (!unlimitedOnly && details?.canSubmitUnlimitedOnly) {
            const allowedIds = new Set(details.allowedUnlimitedDishIds ?? []);
            const unlimitedItems = this.cartItems().filter(item => item.unlimitedOrder || allowedIds.has(item.dishId));
            if (unlimitedItems.length > 0) {
              this.confirmation.confirm(this.i18n.translate('totem.confirm_unlimited_only'))
                .pipe(takeUntil(this.destroy$))
                .subscribe(confirmed => {
                  if (confirmed) this.submitCartItems(unlimitedItems, true);
                });
              return;
            }
          }
          this.notify.error(err.error?.error || err.error?.message || this.i18n.translate('totem.order_error'));
        },
      });
  }

  getStateClass(state: string): string {
    switch (state) {
      case 'ORDERED':
        return 'bg-tertiary-container text-on-tertiary-container';
      case 'ON_PREPARE':
        return 'bg-primary-container text-on-primary-container';
      case 'SERVED':
        return 'bg-success-container text-on-success-container';
      case 'CANCELED':
        return 'bg-error-container text-on-error-container';
      default:
        return 'bg-surface-container-high text-on-surface-variant';
    }
  }

  getStateLabel(state: string): string {
    switch (state) {
      case 'ORDERED':
        return this.i18n.translate('order_state.ordered');
      case 'ON_PREPARE':
        return this.i18n.translate('order_state.preparing');
      case 'SERVED':
        return this.i18n.translate('order_state.served');
      case 'CANCELED':
        return this.i18n.translate('order_state.canceled');
      default:
        return state;
    }
  }

  formatTime(dateString?: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  protected readonly Math = Math;
}
