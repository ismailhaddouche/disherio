import { Component, OnInit, OnDestroy, computed, signal, inject } from '@angular/core';
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
import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';
import type { Dish, Category, LocalizedString } from '../../types';

interface SessionInfo {
  session_id: string;
  totem_id: string;
  totem_name: string;
  restaurant_id: string;
  totem_state: string;
}

@Component({
  selector: 'app-totem',
  standalone: true,
  imports: [CommonModule, LocalizePipe, CurrencyFormatPipe, TranslatePipe],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <!-- Header -->
      <header class="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow px-4 py-3 flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ restaurantName() }}</h1>
        <div class="flex items-center gap-2">
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
          <!-- Cart Button -->
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
        </div>
      </header>

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

      <!-- Cart drawer -->
      @if (showCart()) {
        <div class="fixed inset-0 z-20 flex">
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
                <span>Total</span>
                <span>{{ cartTotal() | currencyFormat }}</span>
              </div>
              <button
                (click)="submitOrder()"
                [disabled]="cartItems().length === 0 || submittingOrder()"
                class="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white py-3 rounded-xl font-bold text-lg active:scale-95 transition-transform"
              >
                @if (submittingOrder()) {
                  {{ 'totem.sending' | translate }}
                } @else {
                  {{ 'totem.place_order' | translate }}
                }
              </button>
            </div>
          </aside>
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
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  restaurantName = signal(this.i18n.translate('common.loading'));
  categories = signal<Category[]>([]);
  dishes = signal<Dish[]>([]);
  selectedCategory = signal<string | null>(null);
  showCart = signal(false);
  sessionInfo = signal<SessionInfo | null>(null);
  submittingOrder = signal(false);

  private qrToken: string | null = null;

  cartItems = cartStore.items;
  cartTotal = cartStore.total;
  cartCount = cartStore.itemCount;

  // BUG-11: was a manually-synced signal — now a computed that stays in sync automatically
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

  selectCategory(catId: string) {
    this.selectedCategory.set(catId);
  }

  addToCart(dish: Dish) {
    // Get localized name based on browser language preference
    const lang = navigator.language?.split('-')[0] ?? 'es';
    const name = dish.disher_name?.[lang as keyof LocalizedString] 
              || dish.disher_name?.es 
              || dish.disher_name?.en 
              || '';
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

    this.submittingOrder.set(true);

    const items = this.cartItems().map((item) => ({
      dishId: item.dishId,
      quantity: item.quantity,
      variantId: item.variantId,
      extras: item.extras.map((e) => e.extraId),
    }));

    this.http.post<{ order_id: string }>(`${environment.apiUrl}/totems/menu/${this.qrToken}/order`, { items })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.submittingOrder.set(false);
          this.notify.success(this.i18n.translate('totem.order_sent'));
          cartStore.clear();
          this.showCart.set(false);
        },
        error: (err) => {
          this.submittingOrder.set(false);
          this.notify.error(err.error?.message || this.i18n.translate('totem.order_error'));
        },
      });
  }
}
