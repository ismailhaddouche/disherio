import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { cartStore } from '../../store/cart.store';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { environment } from '../../../environments/environment';

interface LocalizedString {
  es: string;
  en: string;
  fr?: string;
  ar?: string;
}

interface Category {
  _id: string;
  category_name: LocalizedString;
}

interface Dish {
  _id: string;
  disher_name: LocalizedString;
  disher_price: number;
  disher_url_image?: string;
  category_id: string | { _id: string };
}

@Component({
  selector: 'app-totem',
  standalone: true,
  imports: [CommonModule, LocalizePipe, CurrencyFormatPipe],
  template: `
    <div class="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <!-- Header -->
      <header class="sticky top-0 z-10 bg-white dark:bg-gray-900 shadow px-4 py-3 flex items-center justify-between">
        <h1 class="text-xl font-bold">{{ restaurantName() }}</h1>
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
      </header>

      <!-- Categories -->
      <nav class="flex gap-2 overflow-x-auto px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        @for (cat of categories(); track cat._id) {
          <button
            (click)="selectCategory(cat._id)"
            class="whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border border-gray-300 dark:border-gray-600 active:scale-95 transition-transform"
            [class.bg-primary]="selectedCategory() === cat._id"
            [class.text-white]="selectedCategory() === cat._id"
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
            class="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden active:scale-95 transition-transform cursor-pointer"
          >
            @if (dish.disher_url_image) {
              <img [src]="dish.disher_url_image" [alt]="dish.disher_name | localize" class="w-full h-32 object-cover" />
            } @else {
              <div class="w-full h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span class="material-symbols-outlined text-4xl text-gray-400">restaurant_menu</span>
              </div>
            }
            <div class="p-3">
              <p class="font-semibold text-sm">{{ dish.disher_name | localize }}</p>
              <p class="text-primary font-bold mt-1">{{ dish.disher_price | currencyFormat }}</p>
            </div>
          </div>
        }
      </main>

      <!-- Cart drawer -->
      @if (showCart()) {
        <div class="fixed inset-0 z-20 flex">
          <div class="flex-1 bg-black/50" (click)="toggleCart()"></div>
          <aside class="w-80 bg-white dark:bg-gray-900 flex flex-col h-full shadow-xl">
            <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="font-bold text-lg">Mi pedido</h2>
              <button (click)="toggleCart()"><span class="material-symbols-outlined">close</span></button>
            </div>
            <div class="flex-1 overflow-auto p-4 flex flex-col gap-3">
              @for (item of cartItems(); track item.dishId) {
                <div class="flex justify-between items-center">
                  <div>
                    <p class="font-medium text-sm">{{ item.name }}</p>
                    <p class="text-xs text-gray-400">x{{ item.quantity }}</p>
                  </div>
                  <p class="font-semibold">{{ (item.price * item.quantity) | currencyFormat }}</p>
                </div>
              }
            </div>
            <div class="p-4 border-t border-gray-200 dark:border-gray-700">
              <div class="flex justify-between font-bold text-base mb-3">
                <span>Total</span>
                <span>{{ cartTotal() | currencyFormat }}</span>
              </div>
              <button class="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-lg active:scale-95 transition-transform">
                Pedir
              </button>
            </div>
          </aside>
        </div>
      }
    </div>
  `,
})
export class TotemComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  restaurantName = signal('Cargando...');
  categories = signal<Category[]>([]);
  dishes = signal<Dish[]>([]);
  selectedCategory = signal<string | null>(null);
  showCart = signal(false);

  cartItems = cartStore.items;
  cartTotal = cartStore.total;
  cartCount = cartStore.itemCount;

  // BUG-11: was a manually-synced signal — now a computed that stays in sync automatically
  filteredDishes = computed(() => {
    const cat = this.selectedCategory();
    const all = this.dishes();
    return cat ? all.filter((d) => {
      const catId = typeof d.category_id === 'string' ? d.category_id : d.category_id?._id;
      return catId === cat;
    }) : all;
  });

  ngOnInit() {
    const qr = this.route.snapshot.paramMap.get('qr');
    if (qr) {
      // BUG-10: was calling GET /api/dishes which requires auth — totem is a public QR page.
      // Now calls the dedicated public endpoint GET /api/totems/menu/:qr/dishes
      this.http.get<{ categories: Category[]; dishes: Dish[] }>(`${environment.apiUrl}/totems/menu/${qr}/dishes`)
        .subscribe(({ categories, dishes }) => {
          if (categories.length) this.restaurantName.set('Menú');
          this.categories.set(categories);
          this.dishes.set(dishes);
        });
    }
  }

  selectCategory(catId: string) {
    this.selectedCategory.set(catId);
  }

  addToCart(dish: Dish) {
    // Obtener nombre localizado según preferencia del navegador
    const lang = navigator.language?.split('-')[0] ?? 'es';
    const name = dish.disher_name?.[lang as keyof LocalizedString] 
              || dish.disher_name?.es 
              || dish.disher_name?.en 
              || '';
    cartStore.addItem({
      dishId: dish._id,
      name,
      price: dish.disher_price,
      extras: [],
    });
  }

  toggleCart() {
    this.showCart.update((v) => !v);
  }
}
