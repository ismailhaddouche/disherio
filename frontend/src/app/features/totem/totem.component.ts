import { Component, OnInit, OnDestroy, computed, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { cartStore } from '../../store/cart.store';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { MenuLanguageService } from '../../services/menu-language.service';
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import type { Dish, Category, ItemOrder } from '../../types';

interface SessionInfo {
  session_id: string;
  totem_id: string;
  totem_name: string;
  restaurant_id: string;
  totem_state: string;
}

interface CustomerInfo {
  customer_id: string;
  customer_name: string;
}

type ViewTab = 'menu' | 'my-orders' | 'all-orders';

@Component({
  selector: 'app-totem',
  standalone: true,
  imports: [CommonModule, LocalizePipe, CurrencyFormatPipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white pb-20">
      <!-- Header -->
      <header class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow px-4 py-3 flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ restaurantName() }}</h1>
        <div class="flex items-center gap-2">
          <!-- Customer Badge -->
          @if (customerInfo() && currentView() !== 'menu') {
            <div class="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
              <span class="material-symbols-outlined text-base">person</span>
              <span>{{ customerInfo()?.customer_name }}</span>
            </div>
          }
          <!-- Theme Toggle -->
          <button 
            (click)="themeService.toggleTheme()"
            class="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            [title]="i18n.translate('common.toggle_theme')"
          >
            @if (themeService.isDark()) {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
              </svg>
            } @else {
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
              </svg>
            }
          </button>
          <!-- Cart Button (only in menu view) -->
          @if (currentView() === 'menu') {
            <button
              (click)="toggleCart()"
              class="relative flex items-center gap-1 bg-primary text-white rounded-full px-4 py-2"
            >
              <span class="material-symbols-outlined">shopping_cart</span>
              @if (cartCount() > 0) {
                <span class="absolute -top-1 -right-1 bg-red-500 text-xs text-white rounded-full w-5 h-5 flex items-center justify-center">
                  {{ cartCount() }}
                </span>
              }
            </button>
          }
        </div>
      </header>

      <!-- MENU VIEW -->
      @if (currentView() === 'menu') {
        <!-- Categories -->
        <nav class="flex gap-2 overflow-x-auto px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          @for (cat of categories(); track cat._id) {
            <button
              (click)="selectCategory(cat._id!)"
              class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-all active:scale-95"
              [class.bg-primary]="selectedCategory() === cat._id"
              [class.text-white]="selectedCategory() === cat._id"
              [class.border-primary]="selectedCategory() === cat._id"
              [class.bg-white]="selectedCategory() !== cat._id"
              [class.dark:bg-gray-700]="selectedCategory() !== cat._id"
              [class.text-gray-700]="selectedCategory() !== cat._id"
              [class.dark:text-gray-300]="selectedCategory() !== cat._id"
              [class.border-gray-300]="selectedCategory() !== cat._id"
              [class.dark:border-gray-600]="selectedCategory() !== cat._id"
            >
              {{ cat.category_name | localize }}
            </button>
          }
        </nav>

        <!-- Dishes grid -->
        <main class="p-4 grid grid-cols-2 gap-4">
          @for (dish of filteredDishes(); track dish._id) {
            <div
              (click)="addToCart(dish)"
              class="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden active:scale-95 transition-transform cursor-pointer border border-gray-100 dark:border-gray-700"
            >
              @if (dish.disher_url_image) {
                <img [src]="dish.disher_url_image" [alt]="dish.disher_name | localize" class="w-full h-32 object-cover" />
              } @else {
                <div class="w-full h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span class="material-symbols-outlined text-4xl text-gray-400">restaurant_menu</span>
                </div>
              }
              <div class="p-3">
                <p class="font-semibold text-sm text-gray-900 dark:text-white">{{ dish.disher_name | localize }}</p>
                <p class="text-primary font-bold mt-1">{{ dish.disher_price | currencyFormat }}</p>
              </div>
            </div>
          }
          @if (filteredDishes().length === 0) {
            <div class="col-span-2 text-center py-12 text-gray-500 dark:text-gray-400">
              <span class="material-symbols-outlined text-5xl mb-2">restaurant_menu</span>
              <p>{{ 'totem.no_dishes' | translate }}</p>
            </div>
          }
        </main>
      }

      <!-- MY ORDERS VIEW -->
      @if (currentView() === 'my-orders') {
        <div class="p-4">
          <h2 class="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">person</span>
            {{ 'totem.my_orders' | translate }}
            @if (loadingMyOrders()) {
              <svg class="animate-spin h-5 w-5 text-primary ml-auto" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            }
          </h2>
          
          @if (myOrders().length === 0 && !loadingMyOrders()) {
            <div class="text-center py-12 text-gray-500 dark:text-gray-400">
              <span class="material-symbols-outlined text-5xl mb-2">receipt_long</span>
              <p>{{ 'totem.no_my_orders' | translate }}</p>
            </div>
          }

          <div class="space-y-3">
            @for (item of myOrders(); track item._id) {
              <div class="rounded-xl p-4 shadow border"
                   [class.bg-white]="item.item_state !== 'CANCELED'"
                   [class.dark:bg-gray-800]="item.item_state !== 'CANCELED'"
                   [class.bg-red-50]="item.item_state === 'CANCELED'"
                   [class.dark:bg-red-900/20]="item.item_state === 'CANCELED'"
                   [class.border-gray-100]="item.item_state !== 'CANCELED'"
                   [class.dark:border-gray-700]="item.item_state !== 'CANCELED'"
                   [class.border-red-200]="item.item_state === 'CANCELED'"
                   [class.dark:border-red-800]="item.item_state === 'CANCELED'">
                <div class="flex justify-between items-start">
                  <div>
                    <p class="font-semibold text-gray-900 dark:text-white"
                       [class.line-through]="item.item_state === 'CANCELED'"
                       [class.opacity-60]="item.item_state === 'CANCELED'">
                      {{ item.item_name_snapshot | localize }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400"
                       [class.opacity-60]="item.item_state === 'CANCELED'">
                      {{ item.item_base_price | currencyFormat }}
                      @if (item.item_disher_extras && item.item_disher_extras.length > 0) {
                        <span class="text-xs"> + {{ item.item_disher_extras.length }} {{ 'totem.extras' | translate }}</span>
                      }
                    </p>
                  </div>
                  <span class="px-3 py-1 rounded-full text-xs font-medium" [class]="getStateClass(item.item_state)">
                    {{ getStateLabel(item.item_state) }}
                  </span>
                </div>
                @if (item.customer_name) {
                  <p class="text-xs text-gray-400 mt-2" [class.opacity-60]="item.item_state === 'CANCELED'">
                    {{ 'totem.ordered_by' | translate }}: {{ item.customer_name }}
                  </p>
                }
                @if (item.item_state === 'CANCELED') {
                  <p class="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">info</span>
                    {{ 'totem.order_canceled_info' | translate }}
                  </p>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- ALL ORDERS VIEW -->
      @if (currentView() === 'all-orders') {
        <div class="p-4">
          <h2 class="text-lg font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">groups</span>
            {{ 'totem.all_orders' | translate }}
            @if (loadingAllOrders()) {
              <svg class="animate-spin h-5 w-5 text-primary ml-auto" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            }
          </h2>
          
          @if (allOrders().length === 0 && !loadingAllOrders()) {
            <div class="text-center py-12 text-gray-500 dark:text-gray-400">
              <span class="material-symbols-outlined text-5xl mb-2">receipt_long</span>
              <p>{{ 'totem.no_orders_yet' | translate }}</p>
            </div>
          }

          <div class="space-y-3">
            @for (item of allOrders(); track item._id) {
              <div class="bg-white dark:bg-gray-800 rounded-xl p-4 shadow border border-gray-100 dark:border-gray-700"
                   [class.border-primary]="item.customer_id === customerInfo()?.customer_id"
                   [class.border-2]="item.customer_id === customerInfo()?.customer_id">
                <div class="flex justify-between items-start">
                  <div>
                    <p class="font-semibold text-gray-900 dark:text-white">{{ item.item_name_snapshot | localize }}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ item.item_base_price | currencyFormat }}
                      @if (item.item_disher_extras && item.item_disher_extras.length > 0) {
                        <span class="text-xs"> + {{ item.item_disher_extras.length }} {{ 'totem.extras' | translate }}</span>
                      }
                    </p>
                  </div>
                  <span class="px-3 py-1 rounded-full text-xs font-medium" [class]="getStateClass(item.item_state)">
                    {{ getStateLabel(item.item_state) }}
                  </span>
                </div>
                <div class="flex justify-between items-center mt-2">
                  @if (item.customer_name) {
                    <p class="text-xs" [class.text-primary]="item.customer_id === customerInfo()?.customer_id" [class.text-gray-400]="item.customer_id !== customerInfo()?.customer_id">
                      {{ item.customer_id === customerInfo()?.customer_id ? ('totem.you' | translate) : item.customer_name }}
                    </p>
                  } @else {
                    <p class="text-xs text-gray-400">{{ 'totem.staff_order' | translate }}</p>
                  }
                  <span class="text-xs text-gray-400">{{ formatTime(item.createdAt) }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Bottom Navigation -->
      <nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-30">
        <div class="flex justify-around items-center h-16">
          <button 
            (click)="setView('menu')"
            class="flex flex-col items-center justify-center w-full h-full transition-colors"
            [class.text-primary]="currentView() === 'menu'"
            [class.text-gray-500]="currentView() !== 'menu'"
          >
            <span class="material-symbols-outlined text-2xl">restaurant_menu</span>
            <span class="text-xs mt-0.5">{{ 'totem.menu_tab' | translate }}</span>
          </button>
          
          <button 
            (click)="setView('my-orders')"
            class="flex flex-col items-center justify-center w-full h-full transition-colors"
            [class.text-primary]="currentView() === 'my-orders'"
            [class.text-gray-500]="currentView() !== 'my-orders'"
          >
            <span class="material-symbols-outlined text-2xl">person</span>
            <span class="text-xs mt-0.5">{{ 'totem.my_orders_tab' | translate }}</span>
          </button>
          
          <button 
            (click)="setView('all-orders')"
            class="flex flex-col items-center justify-center w-full h-full transition-colors"
            [class.text-primary]="currentView() === 'all-orders'"
            [class.text-gray-500]="currentView() !== 'all-orders'"
          >
            <span class="material-symbols-outlined text-2xl">groups</span>
            <span class="text-xs mt-0.5">{{ 'totem.orders_tab' | translate }}</span>
          </button>
        </div>
      </nav>

      <!-- Cart drawer -->
      @if (showCart()) {
        <div class="fixed inset-0 z-40 flex">
          <div class="flex-1 bg-black/50" (click)="toggleCart()"></div>
          <aside class="w-80 bg-white dark:bg-gray-800 flex flex-col h-full shadow-xl">
            <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="font-bold text-lg text-gray-900 dark:text-white">{{ 'totem.my_order' | translate }}</h2>
              <button (click)="toggleCart()" class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <div class="flex-1 overflow-auto p-4 flex flex-col gap-3">
              @for (item of cartItems(); track item.dishId) {
                <div class="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <div>
                    <p class="font-medium text-sm text-gray-900 dark:text-white">{{ item.name }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400">x{{ item.quantity }}</p>
                  </div>
                  <p class="font-semibold text-gray-900 dark:text-white">{{ (item.price * item.quantity) | currencyFormat }}</p>
                </div>
              }
              @if (cartItems().length === 0) {
                <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                  <span class="material-symbols-outlined text-4xl mb-2">shopping_cart</span>
                  <p>{{ 'totem.cart_empty' | translate }}</p>
                </div>
              }
            </div>
            <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <div class="flex justify-between font-bold text-base mb-3 text-gray-900 dark:text-white">
                <span>{{ 'totem.total' | translate }}</span>
                <span>{{ cartTotal() | currencyFormat }}</span>
              </div>
              <button
                (click)="submitOrder()"
                [disabled]="cartItems().length === 0 || submittingOrder() || !customerInfo()"
                class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white py-3 rounded-xl font-bold text-lg active:scale-95 transition-transform"
              >
                @if (submittingOrder()) {
                  {{ 'totem.sending' | translate }}
                } @else if (!customerInfo()) {
                  {{ 'totem.enter_name_first' | translate }}
                } @else {
                  {{ 'totem.place_order' | translate }}
                }
              </button>
            </div>
          </aside>
        </div>
      }

      <!-- Customer Name Modal -->
      @if (showNameModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div class="text-center mb-6">
              <div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-3xl text-primary">person</span>
              </div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {{ 'totem.welcome' | translate }}
              </h2>
              <p class="text-gray-600 dark:text-gray-400 text-sm">
                {{ 'totem.enter_name_prompt' | translate }}
              </p>
            </div>
            
            <div class="mb-6">
              <input
                #nameInput
                type="text"
                [value]="customerNameInput()"
                (input)="customerNameInput.set(nameInput.value)"
                (keyup.enter)="saveCustomerName()"
                placeholder="{{ 'totem.your_name' | translate }}"
                class="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                maxlength="50"
              />
              @if (nameError()) {
                <p class="text-red-500 text-sm mt-2">{{ nameError() }}</p>
              }
            </div>

            <button
              (click)="saveCustomerName()"
              [disabled]="!customerNameInput().trim() || savingName()"
              class="w-full bg-primary hover:bg-primary-dark disabled:bg-gray-400 text-white py-3 rounded-xl font-bold text-lg active:scale-95 transition-transform"
            >
              @if (savingName()) {
                <span class="flex items-center justify-center gap-2">
                  <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  {{ 'common.saving' | translate }}
                </span>
              } @else {
                {{ 'totem.continue' | translate }}
              }
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class TotemComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  themeService = inject(ThemeService);
  protected i18n = inject(I18nService);
  private menuLangService = inject(MenuLanguageService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  restaurantName = signal(this.i18n.translate('common.loading'));
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

  private qrToken: string | null = null;

  cartItems = cartStore.items;
  cartTotal = cartStore.total;
  cartCount = cartStore.itemCount;

  filteredDishes = computed(() => {
    const cat = this.selectedCategory();
    const all = this.dishes();
    return cat ? all.filter((d) => {
      const catId = d.category_id;
      return catId === cat;
    }) : all;
  });

  ngOnInit() {
    const qr = this.route.snapshot.paramMap.get('qr');
    if (!qr) return;
    this.qrToken = qr;

    // Load menu dishes
    this.http.get<{ categories: Category[]; dishes: Dish[] }>(`${environment.apiUrl}/totems/menu/${qr}/dishes`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ categories, dishes }) => {
          if (categories.length) this.restaurantName.set(this.i18n.translate('totem.menu'));
          this.categories.set(categories);
          this.dishes.set(dishes);
        },
        error: (err) => {
          console.error('[Totem] Error loading menu:', err);
          this.restaurantName.set(this.i18n.translate('totem.menu_error'));
          this.notify.error(this.i18n.translate('totem.menu_error'));
        },
      });

    // Get or create session for this totem
    this.http.post<SessionInfo>(`${environment.apiUrl}/totems/menu/${qr}/session`, {})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.sessionInfo.set(session);
          if (session.totem_name) {
            this.restaurantName.set(session.totem_name);
          }
          // Check if we already have a customer in localStorage
          this.loadCustomerFromStorage(session.session_id);
        },
        error: (err) => {
          console.error('[Totem] Error getting session:', err);
          this.notify.error(this.i18n.translate('totem.session_error'));
        },
      });
  }

  ngOnDestroy(): void {
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
    if (!customer) {
      this.showNameModal.set(true);
      return;
    }
    
    this.loadingMyOrders.set(true);
    this.http.get<ItemOrder[]>(`${environment.apiUrl}/totems/customer/${customer.customer_id}/orders`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.myOrders.set(orders);
          this.loadingMyOrders.set(false);
        },
        error: (err) => {
          console.error('[Totem] Error loading my orders:', err);
          this.loadingMyOrders.set(false);
        },
      });
  }

  private loadAllOrders() {
    const session = this.sessionInfo();
    if (!session) return;
    
    this.loadingAllOrders.set(true);
    this.http.get<ItemOrder[]>(`${environment.apiUrl}/totems/session/${session.session_id}/orders`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.allOrders.set(orders);
          this.loadingAllOrders.set(false);
        },
        error: (err) => {
          console.error('[Totem] Error loading all orders:', err);
          this.loadingAllOrders.set(false);
        },
      });
  }

  private loadCustomerFromStorage(sessionId: string) {
    const stored = localStorage.getItem(`totem_customer_${sessionId}`);
    if (stored) {
      try {
        const customer: CustomerInfo = JSON.parse(stored);
        this.customerInfo.set(customer);
      } catch {
        this.showNameModal.set(true);
      }
    } else {
      this.showNameModal.set(true);
    }
  }

  private saveCustomerToStorage(customer: CustomerInfo, sessionId: string) {
    localStorage.setItem(`totem_customer_${sessionId}`, JSON.stringify(customer));
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
    if (!session) {
      this.nameError.set(this.i18n.translate('totem.session_not_ready'));
      return;
    }

    this.savingName.set(true);
    this.nameError.set(null);

    this.http.post<CustomerInfo>(`${environment.apiUrl}/totems/session/${session.session_id}/customers`, {
      customer_name: name
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          this.customerInfo.set(customer);
          this.saveCustomerToStorage(customer, session.session_id);
          this.savingName.set(false);
          this.showNameModal.set(false);
          this.notify.success(`${this.i18n.translate('totem.welcome_message').replace('{{name}}', customer.customer_name)}`);
        },
        error: (err) => {
          console.error('[Totem] Error creating customer:', err);
          this.savingName.set(false);
          this.nameError.set(err.error?.message || this.i18n.translate('totem.customer_error'));
        },
      });
  }

  selectCategory(catId: string) {
    this.selectedCategory.set(catId);
  }

  addToCart(dish: Dish) {
    const name = this.menuLangService.localize(dish.disher_name);
    cartStore.addItem({
      dishId: dish._id!,
      name,
      price: dish.disher_price,
      extras: [],
    });
    this.notify.info(this.i18n.translate('totem.item_added_to_cart'));
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

    this.submittingOrder.set(true);

    const items = this.cartItems().map((item) => ({
      dishId: item.dishId,
      quantity: item.quantity,
      variantId: item.variantId,
      extras: item.extras.map((e) => e.extraId),
    }));

    this.http.post<{ order_id: string }>(`${environment.apiUrl}/totems/menu/${this.qrToken}/order`, { 
      items,
      customer_id: customer.customer_id
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submittingOrder.set(false);
          this.notify.success(this.i18n.translate('totem.order_sent'));
          cartStore.clear();
          this.showCart.set(false);
          // Refresh orders if we're in orders view
          if (this.currentView() === 'my-orders') {
            this.loadMyOrders();
          } else if (this.currentView() === 'all-orders') {
            this.loadAllOrders();
          }
        },
        error: (err) => {
          this.submittingOrder.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('totem.order_error'));
        },
      });
  }

  getStateClass(state: string): string {
    switch (state) {
      case 'ORDERED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'ON_PREPARE':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'SERVED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'CANCELED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
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
}
