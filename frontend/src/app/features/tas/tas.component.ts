import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TasService } from '../../services/tas.service';
import { SocketService } from '../../services/socket/socket.service';
import { tasStore } from '../../store/tas.store';
import { authStore } from '../../store/auth.store';
import type { TotemSession, ItemOrder, Customer, Dish } from '../../types';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-tas',
  standalone: true,
  imports: [CommonModule, FormsModule, LocalizePipe, CurrencyFormatPipe, TranslatePipe],
  template: `
    <div class="h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
      <!-- LEFT PANEL: Sessions & Totems -->
      <aside class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <!-- Header -->
        <header class="p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-2xl text-primary">room_service</span>
              <h1 class="text-lg font-bold text-gray-900 dark:text-white">{{ 'tas.title' | translate }}</h1>
            </div>
            <span class="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
                  [class.bg-green-100]="isConnected()"
                  [class.text-green-700]="isConnected()"
                  [class.bg-red-100]="!isConnected()"
                  [class.text-red-700]="!isConnected()">
              <span class="w-1.5 h-1.5 rounded-full" [class.bg-green-500]="isConnected()" [class.bg-red-500]="!isConnected()"></span>
              {{ isConnected() ? ('kds.connected' | translate) : ('kds.disconnected' | translate) }}
            </span>
          </div>
          
          <!-- New Temporary Totem -->
          <div class="flex gap-2">
            <input
              [(ngModel)]="newTotemName"
              [placeholder]="'tas.new_temp_table' | translate"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              (keyup.enter)="createTemporaryTotem()"
            />
            <button
              (click)="createTemporaryTotem()"
              [disabled]="!newTotemName().trim() || isCreatingTotem()"
              class="px-3 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-sm">add</span>
            </button>
          </div>
        </header>

        <!-- Active Sessions -->
        <div class="flex-1 overflow-auto p-3">
          <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{{ 'tas.active_sessions' | translate }}</h2>

          @if (activeSessions().length === 0) {
            <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{{ 'tas.no_active_sessions' | translate }}</p>
          }
          
          @for (session of activeSessions(); track session._id!) {
            <div
              (click)="selectSession(session)"
              class="p-3 rounded-lg border cursor-pointer transition-colors mb-2"
              [class.bg-primary-50]="selectedSession()?._id === session._id!"
              [class.border-primary]="selectedSession()?._id === session._id!"
              [class.bg-white]="selectedSession()?._id !== session._id!"
              [class.dark:bg-gray-700]="selectedSession()?._id !== session._id!"
              [class.border-gray-200]="selectedSession()?._id !== session._id!"
              [class.dark:border-gray-600]="selectedSession()?._id !== session._id!"
            >
              <div class="flex items-center justify-between">
                <span class="font-medium text-gray-900 dark:text-white">{{ session.totem?.totem_name || ('tas.table' | translate) }}</span>
                <span 
                  class="text-xs px-2 py-1 rounded-full"
                  [class.bg-yellow-100]="session.totem?.totem_type === 'TEMPORARY'"
                  [class.text-yellow-800]="session.totem?.totem_type === 'TEMPORARY'"
                  [class.bg-gray-100]="session.totem?.totem_type === 'STANDARD'"
                  [class.text-gray-800]="session.totem?.totem_type === 'STANDARD'"
                >
                  {{ session.totem?.totem_type === 'TEMPORARY' ? ('tas.temporary' | translate) : ('tas.standard' | translate) }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-1">
                {{ getSessionItemCount(session._id!) }} items • {{ getSessionTotal(session._id!) | currencyFormat }}
              </p>
            </div>
          }
        </div>

        <!-- Available Totems (no active session) -->
        <div class="p-3 border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-auto">
          <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{{ 'tas.available_tables' | translate }}</h2>

          @for (totem of availableTotems(); track totem._id) {
            <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700 mb-1">
              <span class="text-sm text-gray-900 dark:text-white">{{ totem.totem_name }}</span>
              <button
                (click)="startSession(totem._id!)"
                class="text-xs px-2 py-1 bg-green-500 text-white rounded"
              >
                {{ 'tas.session.open' | translate }}
              </button>
            </div>
          }

          @if (availableTotems().length === 0) {
            <p class="text-xs text-gray-500 dark:text-gray-400 text-center">{{ 'tas.all_tables_occupied' | translate }}</p>
          }
        </div>
      </aside>

      <!-- CENTER PANEL: Session Details -->
      <main class="flex-1 flex flex-col min-w-0">
        @if (selectedSession(); as session) {
          <!-- Session Header -->
          <header class="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold">{{ session.totem?.totem_name }}</h2>
                <p class="text-sm text-gray-500">
                  {{ 'tas.start_time' | translate }} {{ session.session_date_start | date:'shortTime' }}
                </p>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <p class="text-2xl font-bold text-primary">{{ sessionTotal() | currencyFormat }}</p>
                  <p class="text-xs text-gray-500">{{ sessionItems().length }} items</p>
                </div>
                @if (session.totem?.totem_type === 'TEMPORARY') {
                  <button
                    (click)="closeTemporaryTotem(session.totem_id)"
                    class="p-2 bg-red-500 text-white rounded-lg"
                    [title]="i18n.translate('tas.close_temporary_table')"
                  >
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                }
              </div>
            </div>

            <!-- Customers Tabs -->
            <div class="flex items-center gap-2 mt-3 overflow-x-auto">
              <button
                (click)="selectedCustomerId.set(null)"
                class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors"
                [class.bg-primary]="selectedCustomerId() === null"
                [class.text-white]="selectedCustomerId() === null"
                [class.bg-gray-200]="selectedCustomerId() !== null"
                [class.dark:bg-gray-700]="selectedCustomerId() !== null"
              >
                {{ 'tas.all' | translate }}
              </button>
              
              @for (customer of customers(); track customer._id!) {
                <button
                  (click)="selectedCustomerId.set(customer._id!)"
                  class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-1"
                  [class.bg-primary]="selectedCustomerId() === customer._id!"
                  [class.text-white]="selectedCustomerId() === customer._id!"
                  [class.bg-gray-200]="selectedCustomerId() !== customer._id!"
                  [class.dark:bg-gray-700]="selectedCustomerId() !== customer._id!"
                >
                  {{ customer.customer_name }}
                  <span 
                    class="text-xs px-1.5 rounded-full"
                    [class.bg-white]="selectedCustomerId() === customer._id!"
                    [class.bg-gray-300]="selectedCustomerId() !== customer._id!"
                    [class.text-primary]="selectedCustomerId() === customer._id!"
                  >
                    {{ getCustomerItemCount(customer._id!) }}
                  </span>
                </button>
              }
              
              <button
                (click)="showAddCustomer.set(true)"
                class="px-3 py-1.5 rounded-full text-sm bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                {{ 'tas.add_customer' | translate }}
              </button>
            </div>

            <!-- Add Customer Input -->
            @if (showAddCustomer()) {
              <div class="flex gap-2 mt-2">
                <input
                  [(ngModel)]="newCustomerName"
                  [placeholder]="'tas.session.customers' | translate"
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
                  (keyup.enter)="addCustomer()"
                />
                <button
                  (click)="addCustomer()"
                  class="px-3 py-2 bg-green-500 text-white rounded-lg"
                >
                  {{ 'common.add' | translate }}
                </button>
                <button
                  (click)="showAddCustomer.set(false)"
                  class="px-3 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg"
                >
                  {{ 'common.cancel' | translate }}
                </button>
              </div>
            }
          </header>

          <!-- Items List -->
          <div class="flex-1 overflow-auto p-4">
            <!-- Kitchen Items Section -->
            @if (kitchenItems().length > 0) {
              <div class="mb-6">
                <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <span class="material-symbols-outlined text-base">restaurant</span>
                  {{ 'tas.kitchen' | translate }}
                </h3>
                
                @for (item of filteredItems(); track item._id!) {
                  @if (item.item_disher_type === 'KITCHEN') {
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 border-l-4"
                         [class.border-yellow-400]="item.item_state === 'ORDERED'"
                         [class.border-blue-400]="item.item_state === 'ON_PREPARE'"
                         [class.border-green-400]="item.item_state === 'SERVED'"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <p class="font-medium">{{ item.item_name_snapshot | localize }}</p>
                          @if (item.item_disher_variant) {
                            <p class="text-sm text-gray-500">
                              {{ item.item_disher_variant.name | localize }} 
                              (+{{ item.item_disher_variant.price | currencyFormat }})
                            </p>
                          }
                          @if (item.item_disher_extras.length > 0) {
                            <p class="text-xs text-gray-400">
                              @for (extra of item.item_disher_extras; track extra.extra_id) {
                                <span>{{ extra.name | localize }}</span>
                                @if (!$last) { + }
                              }
                            </p>
                          }
                          <div class="flex items-center gap-2 mt-2">
                            <span 
                              class="text-xs px-2 py-1 rounded-full"
                              [class.bg-yellow-100]="item.item_state === 'ORDERED'"
                              [class.text-yellow-800]="item.item_state === 'ORDERED'"
                              [class.bg-blue-100]="item.item_state === 'ON_PREPARE'"
                              [class.text-blue-800]="item.item_state === 'ON_PREPARE'"
                              [class.bg-green-100]="item.item_state === 'SERVED'"
                              [class.text-green-800]="item.item_state === 'SERVED'"
                            >
                              {{ getStateLabel(item.item_state) }}
                            </span>
                            
                            <!-- Customer Assignment -->
                            <select
                              [(ngModel)]="item.customer_id"
                              (change)="assignItemToCustomer(item._id!, $any($event.target).value || null)"
                              class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            >
                              <option value="">{{ 'tas.unassigned' | translate }}</option>
                              @for (customer of customers(); track customer._id!) {
                                <option [value]="customer._id!">{{ customer.customer_name }}</option>
                              }
                            </select>
                          </div>
                        </div>
                        
                        <div class="flex flex-col items-end gap-2">
                          <span class="font-bold">{{ getItemTotal(item) | currencyFormat }}</span>
                          
                          @if (item.item_state === 'ORDERED') {
                            <button
                              (click)="deleteItem(item._id!)"
                              class="text-red-500 hover:text-red-700"
                              [title]="i18n.translate('common.delete_item')"
                            >
                              <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  }
                }
              </div>
            }

            <!-- Service Items Section (No Kitchen) -->
            @if (serviceItemsSession().length > 0) {
              <div class="mb-6">
                <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <span class="material-symbols-outlined text-base">local_bar</span>
                  {{ 'tas.bar_service' | translate }}
                </h3>
                
                @for (item of serviceItemsSession(); track item._id!) {
                  <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 border-l-4"
                       [class.border-yellow-400]="item.item_state === 'ORDERED'"
                       [class.border-green-400]="item.item_state === 'SERVED'"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <p class="font-medium">{{ item.item_name_snapshot | localize }}</p>
                        @if (item.item_disher_variant) {
                          <p class="text-sm text-gray-500">
                            {{ item.item_disher_variant.name | localize }}
                          </p>
                        }
                        <div class="flex items-center gap-2 mt-2">
                          <span 
                            class="text-xs px-2 py-1 rounded-full"
                            [class.bg-yellow-100]="item.item_state === 'ORDERED'"
                            [class.text-yellow-800]="item.item_state === 'ORDERED'"
                            [class.bg-green-100]="item.item_state === 'SERVED'"
                            [class.text-green-800]="item.item_state === 'SERVED'"
                          >
                            {{ getStateLabel(item.item_state) }}
                          </span>
                          
                          <select
                            [(ngModel)]="item.customer_id"
                            (change)="assignItemToCustomer(item._id!, $any($event.target).value || null)"
                            class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          >
                            <option value="">{{ 'tas.unassigned' | translate }}</option>
                            @for (customer of customers(); track customer._id!) {
                              <option [value]="customer._id!">{{ customer.customer_name }}</option>
                            }
                          </select>
                        </div>
                      </div>
                      
                      <div class="flex flex-col items-end gap-2">
                        <span class="font-bold">{{ getItemTotal(item) | currencyFormat }}</span>
                        
                        <div class="flex gap-1">
                          @if (item.item_state === 'ORDERED') {
                            <button
                              (click)="markServiceItemServed(item._id!)"
                              class="text-xs px-2 py-1 bg-green-500 text-white rounded"
                            >
                              {{ 'tas.state.served' | translate }}
                            </button>
                            <button
                              (click)="deleteItem(item._id!)"
                              class="text-red-500 hover:text-red-700"
                              [title]="i18n.translate('common.delete_item')"
                            >
                              <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }

            @if (filteredItems().length === 0) {
              <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                <span class="material-symbols-outlined text-4xl mb-2">restaurant_menu</span>
                <p>{{ 'tas.no_items' | translate }}</p>
              </div>
            }
          </div>

          <!-- Add Item Button -->
          <div class="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <button
              (click)="showMenu.set(true)"
              class="w-full py-3 bg-primary text-white rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <span class="material-symbols-outlined">add_circle</span>
              {{ 'tas.add_order' | translate }}
            </button>
          </div>
        } @else {
          <!-- No Session Selected -->
          <div class="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <span class="material-symbols-outlined text-6xl mb-4">table_restaurant</span>
            <p class="text-lg">{{ 'tas.select_table' | translate }}</p>
          </div>
        }
      </main>

      <!-- RIGHT PANEL: Menu (when adding items) -->
      @if (showMenu()) {
        <aside class="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-bold">{{ 'tas.add_order' | translate }}</h2>
            <button (click)="showMenu.set(false)" class="text-gray-500 hover:text-gray-700">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Categories -->
          <div class="flex gap-2 overflow-x-auto p-3 border-b border-gray-200 dark:border-gray-700">
            <button
              (click)="selectedCategory.set(null)"
              class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap"
              [class.bg-primary]="selectedCategory() === null"
              [class.text-white]="selectedCategory() === null"
              [class.bg-gray-200]="selectedCategory() !== null"
              [class.dark:bg-gray-700]="selectedCategory() !== null"
            >
              {{ 'tas.all' | translate }}
            </button>
            @for (cat of categories(); track cat._id) {
              <button
                (click)="selectedCategory.set(cat._id!)"
                class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap"
                [class.bg-primary]="selectedCategory() === cat._id"
                [class.text-white]="selectedCategory() === cat._id"
                [class.bg-gray-200]="selectedCategory() !== cat._id"
                [class.dark:bg-gray-700]="selectedCategory() !== cat._id"
              >
                {{ cat.category_name | localize }}
              </button>
            }
          </div>

          <!-- Dishes Grid -->
          <div class="flex-1 overflow-auto p-3 grid grid-cols-2 gap-3">
            @for (dish of filteredDishes(); track dish._id) {
              <div
                (click)="selectDish(dish)"
                class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                @if (dish.disher_url_image) {
                  <img [src]="dish.disher_url_image" class="w-full h-24 object-cover rounded-lg mb-2" />
                } @else {
                  <div class="w-full h-24 bg-gray-200 dark:bg-gray-600 rounded-lg mb-2 flex items-center justify-center">
                    <span class="material-symbols-outlined text-3xl text-gray-400">restaurant</span>
                  </div>
                }
                <p class="font-medium text-sm line-clamp-2">{{ dish.disher_name | localize }}</p>
                <p class="text-primary font-bold text-sm mt-1">{{ dish.disher_price | currencyFormat }}</p>
                <span 
                  class="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                  [class.bg-orange-100]="dish.disher_type === 'KITCHEN'"
                  [class.text-orange-800]="dish.disher_type === 'KITCHEN'"
                  [class.bg-blue-100]="dish.disher_type === 'SERVICE'"
                  [class.text-blue-800]="dish.disher_type === 'SERVICE'"
                >
                  {{ dish.disher_type === 'KITCHEN' ? ('tas.kitchen' | translate) : ('tas.bar' | translate) }}
                </span>
              </div>
            }
          </div>
        </aside>
      }

      <!-- Dish Detail Modal (for variants/extras) -->
      @if (selectedDish(); as dish) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-lg font-bold">{{ dish.disher_name | localize }}</h3>
              <button (click)="selectedDish.set(null)" class="text-gray-500">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div class="p-4">
              <!-- Variants -->
              @if (dish.variants.length > 0) {
                <div class="mb-4">
                  <h4 class="text-sm font-semibold mb-2">{{ 'tas.variant' | translate }}</h4>
                  @for (variant of dish.variants; track variant._id) {
                    <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-1 cursor-pointer">
                      <input
                        type="radio"
                        name="variant"
                        [value]="variant._id"
                        [(ngModel)]="selectedVariantId"
                        class="w-4 h-4"
                      />
                      <span class="flex-1">{{ variant.variant_name | localize }}</span>
                      <span class="text-sm text-gray-500">+{{ variant.variant_price | currencyFormat }}</span>
                    </label>
                  }
                </div>
              }

              <!-- Extras -->
              @if (dish.extras.length > 0) {
                <div class="mb-4">
                  <h4 class="text-sm font-semibold mb-2">{{ 'dish.extras' | translate }}</h4>
                  @for (extra of dish.extras; track extra._id) {
                    <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        [value]="extra._id"
                        (change)="toggleExtra(extra._id!)"
                        class="w-4 h-4"
                      />
                      <span class="flex-1">{{ extra.extra_name | localize }}</span>
                      <span class="text-sm text-gray-500">+{{ extra.extra_price | currencyFormat }}</span>
                    </label>
                  }
                </div>
              }

              <!-- Assign to Customer -->
              @if (customers().length > 0) {
                <div class="mb-4">
                  <h4 class="text-sm font-semibold mb-2">{{ 'tas.assign_to' | translate }}</h4>
                  <select
                    [(ngModel)]="assignToCustomerId"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option [value]="null">{{ 'tas.unassigned' | translate }}</option>
                    @for (customer of customers(); track customer._id!) {
                      <option [value]="customer._id!">{{ customer.customer_name }}</option>
                    }
                  </select>
                </div>
              }

              <!-- Total -->
              <div class="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
                <span class="font-semibold">{{ 'common.total' | translate }}:</span>
                <span class="text-xl font-bold text-primary">{{ calculateDishTotal(dish) | currencyFormat }}</span>
              </div>

              <!-- Add Button -->
              <button
                (click)="addItemToOrder(dish)"
                [disabled]="isAddingItem()"
                class="w-full py-3 bg-green-500 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {{ isAddingItem() ? ('tas.adding' | translate) : ('tas.add_order' | translate) }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Loading Overlay -->
      @if (isLoading()) {
        <div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center gap-3">
            <span class="material-symbols-outlined animate-spin">refresh</span>
            <span>{{ 'common.loading' | translate }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class TasComponent implements OnInit, OnDestroy {
  private tasService = inject(TasService);
  private socketService = inject(SocketService);
  protected i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();
  
  // Current staff ID from auth store (for comparison in notifications)
  currentStaffId = authStore.user()?.staffId;

  // Local state signals
  newTotemName = signal('');
  isCreatingTotem = signal(false);
  showAddCustomer = signal(false);
  newCustomerName = signal('');
  showMenu = signal(false);
  selectedCategory = signal<string | null>(null);
  selectedDish = signal<Dish | null>(null);
  selectedVariantId = signal<string | null>(null);
  selectedExtras = signal<string[]>([]);
  assignToCustomerId = signal<string | null>(null);
  selectedCustomerId = signal<string | null>(null);
  isAddingItem = signal(false);
  allTotems = signal<Array<{ _id: string; totem_name: string; totem_type: string }>>([]);
  isConnected = signal(false);

  // Store signals
  sessions = tasStore.sessions;
  selectedSession = tasStore.selectedSession;
  sessionItems = tasStore.sessionItems;
  customers = tasStore.customers;
  dishes = tasStore.dishes;
  categories = tasStore.categories;
  isLoading = tasStore.isLoading;

  // Computed
  activeSessions = computed(() => 
    this.sessions().filter(s => s.totem_state === 'STARTED')
  );

  availableTotems = computed(() => {
    const activeTotemIds = new Set(this.sessions().map(s => s.totem_id));
    return this.allTotems().filter(t => t.totem_type === 'STANDARD' && !activeTotemIds.has(t._id));
  });

  kitchenItems = computed(() => 
    this.sessionItems().filter(i => i.item_disher_type === 'KITCHEN')
  );

  serviceItemsSession = computed(() => 
    this.sessionItems().filter(i => i.item_disher_type === 'SERVICE')
  );

  sessionTotal = computed(() => 
    this.sessionItems()
      .filter(i => i.item_state !== 'CANCELED')
      .reduce((total, item) => total + this.getItemTotal(item), 0)
  );

  filteredDishes = computed(() => {
    const cat = this.selectedCategory();
    const all = this.dishes();
    if (!cat) return all;
    return all.filter(d => d.category_id === cat);
  });

  filteredItems = computed(() => {
    const customerId = this.selectedCustomerId();
    const items = this.sessionItems().filter(i => i.item_state !== 'CANCELED');
    if (customerId === null) return items;
    return items.filter(i => i.customer_id === customerId);
  });

  ngOnInit() {
    // Acquire store reference (auto-clears on destroy for memory optimization)
    tasStore.acquireReference();
    
    this.loadData();
    this.setupSocketListeners();
    this.checkConnection();
    const connInterval = setInterval(() => this.checkConnection(), 2000);
    this.destroy$.subscribe(() => clearInterval(connInterval));
  }

  private checkConnection() {
    this.isConnected.set(this.socketService.isConnected());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Unregister TAS-specific listeners
    this.socketService.unregisterTasListeners();
    
    // Unregister KDS listeners
    this.socketService.off('kds:new_item');
    this.socketService.off('item:state_changed');
    this.socketService.off('kds:item_canceled');
    this.socketService.off('tas:kitchen_item_update');
    
    // Unregister POS listeners
    this.socketService.off('pos:item_added');
    this.socketService.off('pos:item_canceled');
    this.socketService.off('pos:bill_requested');
    this.socketService.off('pos:bill_paid');
    this.socketService.off('pos:session_closed');
    this.socketService.off('pos:session_paid');
    this.socketService.off('pos:session_fully_paid');
    this.socketService.off('pos:ticket_paid');
    
    // Unregister TAS session events
    this.socketService.off('tas:session_closed');
    this.socketService.off('tas:session_paid');
    this.socketService.off('tas:session_fully_paid');
    this.socketService.off('tas:ticket_paid');
    
    // Unregister generic listeners
    this.socketService.off('item:deleted');
    this.socketService.off('item:customer_assigned');
    this.socketService.off('item:added');
    this.socketService.off('item:canceled');
    
    // Leave TAS session if active
    if (this.selectedSession()?._id) {
      this.socketService.leaveTasSession(this.selectedSession()!._id!);
    }
    
    // Release references (store auto-clears when count reaches 0)
    tasStore.releaseReference();
    this.socketService.releaseConnection();
  }

  private loadData() {
    tasStore.setLoading(true);
    
    // Load active sessions
    this.tasService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          tasStore.setSessions(sessions);
          tasStore.setLoading(false);
        },
        error: () => tasStore.setLoading(false),
      });

    // Load all totems
    this.tasService.getTotems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (totems) => this.allTotems.set(totems),
        error: (err) => console.error('[TAS] Error loading totems:', err),
      });

    // Load dishes
    this.tasService.getDishes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ dishes, categories }) => {
          tasStore.setDishes(dishes, categories);
        },
        error: (err) => console.error('[TAS] Error loading dishes:', err),
      });

    // Acquire socket connection reference
    this.socketService.acquireConnection();
  }

  private setupSocketListeners() {
    // Register TAS-specific listeners
    this.socketService.registerTasListeners();

    // ========================================
    // LISTEN TO KDS (Kitchen) EVENTS
    // ========================================

    // Listen for new items from KDS (when kitchen receives new orders)
    this.socketService.on('kds:new_item', (item: ItemOrder) => {
      if (item.session_id === this.selectedSession()?._id) {
        tasStore.addItem(item);
        // If it's a kitchen item added by someone else, notify
        if (item.item_disher_type === 'KITCHEN') {
          this.notify.info(this.i18n.translate('tas.new_kitchen_item'));
        }
      }
    });

    // Listen for state changes from KDS (kitchen updates item state)
    this.socketService.on('item:state_changed', ({ itemId, newState, updatedBy }: { itemId: string; newState: ItemOrder['item_state']; updatedBy?: string }) => {
      tasStore.updateItemState(itemId, newState);
      
      // Notify waiter when kitchen updates item
      if (newState === 'ON_PREPARE') {
        this.notify.info(this.i18n.translate('tas.item_in_preparation'));
      } else if (newState === 'SERVED' && updatedBy !== 'TAS') {
        this.notify.success(this.i18n.translate('tas.item_served_by_kitchen'));
      }
    });

    // Listen for items canceled by KDS/kitchen
    this.socketService.on('kds:item_canceled', (data: { itemId: string; itemName?: any; reason?: string }) => {
      tasStore.updateItemState(data.itemId, 'CANCELED');
      this.notify.warning(
        this.i18n.translate('tas.item_canceled_by_kitchen')
      );
    });

    // Listen for specific TAS kitchen item updates (detailed notifications from KDS)
    this.socketService.on('tas:kitchen_item_update', (data: { 
      itemId: string; 
      itemName?: any;
      newState: 'ORDERED' | 'ON_PREPARE' | 'SERVED' | 'CANCELED';
      updatedBy?: string;
      updatedByName?: string;
      timestamp: string;
    }) => {
      if (this.selectedSession()) {
        tasStore.updateItemState(data.itemId, data.newState);
        
        const itemName = data.itemName?.es || data.itemName?.en || 'Item';
        
        switch (data.newState) {
          case 'ON_PREPARE':
            this.notify.info(
              this.i18n.translate('tas.item_started_preparation')
            );
            break;
          case 'SERVED':
            this.notify.success(
              this.i18n.translate('tas.item_ready_to_serve')
            );
            break;
          case 'CANCELED':
            this.notify.warning(
              this.i18n.translate('tas.item_canceled_by_kitchen')
            );
            break;
        }
      }
    });

    // ========================================
    // LISTEN TO POS (Cashier) EVENTS
    // ========================================

    // Listen for items added by POS
    this.socketService.on('pos:item_added', (data: { item: ItemOrder; addedBy?: string; waiterName?: string }) => {
      if (data.item.session_id === this.selectedSession()?._id) {
        tasStore.addItem(data.item);
        this.notify.info(
          this.i18n.translate('tas.item_added_by_pos')
        );
      }
    });

    // Listen for items canceled by POS
    this.socketService.on('pos:item_canceled', (data: { itemId: string; itemName?: any; canceledByName?: string; reason?: string }) => {
      tasStore.updateItemState(data.itemId, 'CANCELED');
      this.notify.warning(
        this.i18n.translate('tas.item_canceled_by_pos')
      );
    });

    // Listen for bill requests from POS
    this.socketService.on('pos:bill_requested', (data: { sessionId: string; requestedBy?: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.info(this.i18n.translate('tas.bill_requested_by_pos'));
      }
    });

    // Listen for bill paid from POS
    this.socketService.on('pos:bill_paid', (data: { sessionId: string; paidBy?: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.success(this.i18n.translate('tas.bill_paid_by_pos'));
      }
    });

    // Listen for session closed by POS
    this.socketService.on('pos:session_closed', (data: { sessionId: string; closedBy?: string; timestamp: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.warning(this.i18n.translate('tas.session_closed_by_pos'));
        // Clear selected session as it's been closed
        tasStore.selectSession(null);
        tasStore.setSessionItems([]);
        this.socketService.leaveTasSession(data.sessionId);
      }
    });

    // Listen for session paid notification from POS
    this.socketService.on('pos:session_paid', (data: { 
      sessionId: string; 
      paymentTotal: number;
      paymentType: 'ALL' | 'BY_USER' | 'SHARED';
      paidBy?: string;
      paidByName?: string;
      timestamp: string;
    }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.success(
          this.i18n.translate('tas.session_payment_received')
        );
      }
    });

    // Listen for session fully paid (all tickets paid) from POS
    this.socketService.on('pos:session_fully_paid', (data: { 
      sessionId: string; 
      paymentTotal: number;
      paymentType: 'ALL' | 'BY_USER' | 'SHARED';
      closedBy?: string;
      closedByName?: string;
      timestamp: string;
    }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.success(
          this.i18n.translate('tas.session_fully_paid')
        );
        // Session is fully paid and closed
        tasStore.selectSession(null);
        tasStore.setSessionItems([]);
        this.socketService.leaveTasSession(data.sessionId);
      }
    });

    // Listen for ticket paid (partial payment) from POS
    this.socketService.on('pos:ticket_paid', (data: { 
      sessionId: string; 
      ticketPart: number;
      ticketAmount: number;
      paidBy?: string;
      remainingAmount?: number;
      timestamp: string;
    }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.info(
          this.i18n.translate('tas.ticket_paid')
        );
      }
    });

    // ========================================
    // GENERIC EVENTS
    // ========================================

    // Listen for deleted items
    this.socketService.on('item:deleted', ({ itemId }: { itemId: string }) => {
      tasStore.removeItem(itemId);
    });

    // Listen for customer assignments
    this.socketService.on('item:customer_assigned', ({ itemId, customerId }: { itemId: string; customerId: string | null }) => {
      tasStore.assignItemToCustomer(itemId, customerId);
    });

    // Generic item added
    this.socketService.on('item:added', (data: { item: ItemOrder; sessionId: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        tasStore.addItem(data.item);
      }
    });

    // Generic item canceled
    this.socketService.on('item:canceled', (data: { itemId: string; sessionId: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        tasStore.updateItemState(data.itemId, 'CANCELED');
      }
    });

    // ========================================
    // TAS SPECIFIC EVENTS
    // ========================================

    // TAS: Listen for items added by this or other waiters
    this.socketService.on('tas:item_added', (data: { item: ItemOrder; sessionId: string; addedBy?: string; addedByName?: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        // Only add if not already added (avoid duplicates from HTTP response)
        const existingItem = this.sessionItems().find(i => i._id === data.item._id);
        if (!existingItem) {
          tasStore.addItem(data.item);
        }
        
        // Notify if added by another waiter
        if (data.addedBy && data.addedBy !== this.currentStaffId) {
          this.notify.info(
            this.i18n.translate('tas.item_added_by_waiter')
          );
        }
      }
    });

    // TAS: Listen for service items served
    this.socketService.on('tas:service_item_served', (data: { itemId: string; sessionId: string; servedBy?: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        tasStore.updateItemState(data.itemId, 'SERVED');
      }
    });

    // TAS: Listen for items canceled
    this.socketService.on('tas:item_canceled', (data: { itemId: string; sessionId: string; canceledBy?: string; canceledByName?: string; reason?: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        tasStore.updateItemState(data.itemId, 'CANCELED');
        
        // Only notify if canceled by another waiter
        if (data.canceledBy && data.canceledBy !== this.currentStaffId) {
          this.notify.info(
            this.i18n.translate('tas.item_canceled_by_waiter')
          );
        }
      }
    });

    // TAS: Listen for bill requests
    this.socketService.on('tas:bill_requested', (data: { sessionId: string; requestedBy: string; requestedByStaff?: string }) => {
      if (data.sessionId === this.selectedSession()?._id && data.requestedByStaff !== this.currentStaffId) {
        this.notify.info(this.i18n.translate('tas.bill_requested_by_waiter'));
      }
    });

    // TAS: Listen for help requests from customers
    this.socketService.on('tas:help_requested', (data: { sessionId: string; customerName?: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.warning(
          this.i18n.translate('tas.help_requested')
        );
      }
    });

    // TAS: Listen for new customer orders (from totem/app)
    this.socketService.on('tas:new_customer_order', (data: { item: ItemOrder; sessionId: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        tasStore.addItem(data.item);
        this.notify.info(this.i18n.translate('tas.new_customer_order'));
      }
    });

    // TAS: Listen for customer bill requests
    this.socketService.on('tas:customer_bill_request', (data: { sessionId: string; customerName?: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.notify.info(
          this.i18n.translate('tas.customer_requests_bill')
        );
      }
    });

    // TAS: Confirmations
    this.socketService.on('tas:item_served_confirm', (data: { success: boolean; itemId: string }) => {
      if (data.success) {
        this.notify.success(this.i18n.translate('tas.item_served'));
      }
    });

    this.socketService.on('tas:item_canceled_confirm', (data: { success: boolean; itemId: string }) => {
      if (data.success) {
        this.notify.success(this.i18n.translate('tas.item_canceled_success'));
      }
    });

    this.socketService.on('tas:bill_request_confirm', (data: { success: boolean }) => {
      if (data.success) {
        this.notify.success(this.i18n.translate('tas.bill_requested'));
      }
    });
  }

  selectSession(session: TotemSession) {
    tasStore.selectSession(session);
    
    // Load session items
    this.tasService.getSessionItems(session._id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => tasStore.setSessionItems(items),
        error: (err) => console.error('[TAS] Error loading session items:', err),
      });

    // Load customers for this session
    this.tasService.getCustomers(session._id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customers) => tasStore.setCustomers(customers),
        error: (err) => console.error('[TAS] Error loading customers:', err),
      });

    // Join socket rooms
    this.socketService.joinSession(session._id!);
    this.socketService.joinTasSession(session._id!);
  }

  createTemporaryTotem() {
    const name = this.newTotemName().trim();
    if (!name) return;

    this.isCreatingTotem.set(true);
    this.tasService.createTotem({
      totem_name: name,
      totem_type: 'TEMPORARY',
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (totem) => {
        this.allTotems.update(current => [...current, { ...totem, totem_type: 'TEMPORARY' }]);
        this.newTotemName.set('');
        this.isCreatingTotem.set(false);
        this.notify.success(this.i18n.translate('tas.totem_created'));

        // Auto-start session
        this.startSession(totem._id!);
      },
      error: (err) => {
        console.error('[TAS] Error creating totem:', err);
        this.isCreatingTotem.set(false);
        this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
      },
    });
  }

  startSession(totemId: string) {
    this.tasService.startSession(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          tasStore.setSessions([...this.sessions(), session]);
          this.selectSession(session);
          this.notify.success(this.i18n.translate('tas.session_started'));
        },
        error: (err) => {
          console.error('[TAS] Error starting session:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  closeTemporaryTotem(totemId: string) {
    if (!confirm(this.i18n.translate('tas.close_temp_table') + '?')) return;

    this.tasService.deleteTotem(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from sessions if active
          tasStore.setSessions(this.sessions().filter(s => s.totem_id !== totemId));
          this.allTotems.update(current => current.filter(t => t._id !== totemId));

          if (this.selectedSession()?.totem_id === totemId) {
            tasStore.selectSession(null);
          }
          this.notify.success(this.i18n.translate('tas.totem_closed'));
        },
        error: (err) => {
          console.error('[TAS] Error closing totem:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  addCustomer() {
    const name = this.newCustomerName().trim();
    if (!name || !this.selectedSession()) return;

    this.tasService.createCustomer(this.selectedSession()!._id!, name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          tasStore.addCustomer(customer);
          this.newCustomerName.set('');
          this.showAddCustomer.set(false);
          this.notify.success(this.i18n.translate('tas.customer_added'));
        },
        error: (err) => {
          console.error('[TAS] Error creating customer:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  selectDish(dish: Dish) {
    this.selectedDish.set(dish);
    this.selectedVariantId.set(null);
    this.selectedExtras.set([]);
    this.assignToCustomerId.set(null);
  }

  toggleExtra(extraId: string) {
    this.selectedExtras.update(current => {
      if (current.includes(extraId)) {
        return current.filter(id => id !== extraId);
      }
      return [...current, extraId];
    });
  }

  calculateDishTotal(dish: Dish): number {
    let total = dish.disher_price;
    
    const variant = dish.variants.find(v => v._id === this.selectedVariantId());
    if (variant) {
      total += variant.variant_price;
    }

    this.selectedExtras().forEach(extraId => {
      const extra = dish.extras.find(e => e._id === extraId);
      if (extra) {
        total += extra.extra_price;
      }
    });

    return total;
  }

  addItemToOrder(dish: Dish) {
    const session = this.selectedSession();
    if (!session) return;

    this.isAddingItem.set(true);

    // Find or create order for this session
    const existingOrder = this.sessionItems()[0];
    let orderId = existingOrder?.order_id;

    const createItem = () => {
      const itemData = {
        item_dish_id: dish._id!,
        item_disher_type: dish.disher_type,
        item_name_snapshot: dish.disher_name,
        item_base_price: dish.disher_price,
        item_disher_variant: this.selectedVariantId() ? {
          variant_id: this.selectedVariantId()!,
          name: dish.variants.find(v => v._id === this.selectedVariantId())?.variant_name || {},
          price: dish.variants.find(v => v._id === this.selectedVariantId())?.variant_price || 0,
        } : null,
        item_disher_extras: this.selectedExtras().map(extraId => {
          const extra = dish.extras.find(e => e._id === extraId);
          return {
            extra_id: extraId,
            name: extra?.extra_name || {},
            price: extra?.extra_price || 0,
          };
        }),
        customer_id: this.assignToCustomerId(),
      };

      // Use HTTP to persist, then WebSocket to notify
      this.tasService.addItem({
        order_id: orderId,
        session_id: session._id!,
        dish_id: dish._id!,
        customer_id: this.assignToCustomerId() || undefined,
        variant_id: this.selectedVariantId() || undefined,
        extras: this.selectedExtras(),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (item) => {
          tasStore.addItem(item);
          
          // Emit via WebSocket to notify other waiters and kitchen
          this.socketService.tasAddItem({
            sessionId: session._id!,
            orderId: orderId!,
            dishId: dish._id!,
            customerId: this.assignToCustomerId() || undefined,
            variantId: this.selectedVariantId() || undefined,
            extras: this.selectedExtras(),
            itemData: item,
          });
          
          this.isAddingItem.set(false);
          this.selectedDish.set(null);
          this.showMenu.set(false);
          this.notify.info(this.i18n.translate('tas.item_added'));
        },
        error: (err) => {
          console.error('[TAS] Error adding item:', err);
          this.isAddingItem.set(false);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
    };

    if (orderId) {
      createItem();
    } else {
      // Create order first
      this.tasService.createOrder({ session_id: session._id! })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (order) => {
            orderId = order._id;
            createItem();
          },
          error: (err) => {
            console.error('[TAS] Error creating order:', err);
            this.isAddingItem.set(false);
            this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
          },
        });
    }
  }

  deleteItem(itemId: string) {
    if (!confirm(this.i18n.translate('common.delete') + '?')) return;

    // Use WebSocket to cancel item (emits to all connected clients)
    this.socketService.tasCancelItem(itemId, 'Canceled by waiter');
    
    // Optimistically update UI
    tasStore.updateItemState(itemId, 'CANCELED');
    
    // Also persist via HTTP
    this.tasService.deleteItem(itemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notify.info(this.i18n.translate('tas.item_deleted'));
        },
        error: (err) => {
          console.error('[TAS] Error deleting item:', err);
          // Revert on error - reload session items from server
          this.tasService.getSessionItems(this.selectedSession()!._id!)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (items) => tasStore.loadSessionItems(items),
              error: () => this.notify.error(this.i18n.translate('errors.SERVER_ERROR')),
            });
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  markServiceItemServed(itemId: string) {
    // Use WebSocket for real-time update
    this.socketService.tasServeServiceItem(itemId);
    
    // Optimistically update UI
    tasStore.updateItemState(itemId, 'SERVED');
    
    // The confirmation will come via WebSocket (tas:item_served_confirm)
  }

  assignItemToCustomer(itemId: string, customerId: string | null) {
    this.tasService.assignItemToCustomer(itemId, customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          tasStore.assignItemToCustomer(itemId, customerId);
          this.notify.info(this.i18n.translate('tas.item_assigned'));
        },
        error: (err) => {
          console.error('[TAS] Error assigning item:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  getItemTotal(item: ItemOrder): number {
    const variantPrice = item.item_disher_variant?.price || 0;
    const extrasPrice = item.item_disher_extras.reduce((sum, e) => sum + e.price, 0);
    return item.item_base_price + variantPrice + extrasPrice;
  }

  getStateLabel(state: ItemOrder['item_state']): string {
    const keyMap: Record<string, string> = {
      ORDERED: 'tas.state.ordered',
      ON_PREPARE: 'tas.state.on_prepare',
      SERVED: 'tas.state.served',
      CANCELED: 'tas.state.canceled',
    };
    return keyMap[state] ? this.i18n.translate(keyMap[state]) : state;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  getSessionItemCount(sessionId: string): number {
    // This would need to be fetched from backend or calculated from store
    return 0;
  }

  getSessionTotal(sessionId: string): number {
    // This would need to be fetched from backend or calculated from store
    return 0;
  }

  getCustomerItemCount(customerId: string): number {
    return this.sessionItems().filter(i => i.customer_id === customerId && i.item_state !== 'CANCELED').length;
  }
}
