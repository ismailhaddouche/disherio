import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TasService } from '../../services/tas.service';
import { SocketService } from '../../services/socket/socket.service';
import { cartStore } from '../../store/cart.store';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { CaslCanDirective } from '../../shared/directives/casl.directive';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import type { TotemSession, ItemOrder, Customer, Dish, LocalizedField, PaymentTicket } from '../../types';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyFormatPipe, CaslCanDirective, TranslatePipe, LocalizePipe],
  template: `
    <div class="h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">

      <!-- LEFT PANEL: Sessions & Totems -->
      <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <header class="p-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="font-bold flex items-center gap-1">
              <span class="material-symbols-outlined">table_restaurant</span>
              {{ 'pos.tables' | translate }}
            </h2>
            <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  [class.bg-green-100]="isConnected()"
                  [class.text-green-700]="isConnected()"
                  [class.bg-red-100]="!isConnected()"
                  [class.text-red-700]="!isConnected()">
              <span class="w-1.5 h-1.5 rounded-full" [class.bg-green-500]="isConnected()" [class.bg-red-500]="!isConnected()"></span>
              {{ isConnected() ? ('kds.connected' | translate) : ('kds.disconnected' | translate) }}
            </span>
          </div>
        </header>

        <div class="flex-1 overflow-auto flex flex-col">
          <!-- Active sessions -->
          <div class="p-3 flex-1">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{{ 'tas.active_sessions' | translate }}</p>
            @if (isLoading()) {
              <div class="text-sm text-gray-400 text-center py-4">...</div>
            } @else if (activeSessions().length === 0) {
              <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{{ 'pos.no_active_sessions' | translate }}</p>
            }
            @for (session of activeSessions(); track session._id) {
              <div
                (click)="selectSession(session)"
                class="p-2.5 rounded-lg border cursor-pointer transition-colors mb-1.5 text-sm"
                [class.border-primary]="selectedSession()?._id === session._id"
                [class.bg-primary-50]="selectedSession()?._id === session._id"
                [class.border-gray-200]="selectedSession()?._id !== session._id"
                [class.dark:border-gray-600]="selectedSession()?._id !== session._id"
                [class.bg-white]="selectedSession()?._id !== session._id"
                [class.dark:bg-gray-700]="selectedSession()?._id !== session._id"
              >
                <div class="flex items-center justify-between">
                  <span class="font-medium truncate">{{ session.totem?.totem_name || ('tas.table' | translate) }}</span>
                  <span class="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    {{ 'tas.active_sessions' | translate }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  {{ getSessionItemCount(session._id!) }} {{ 'pos.items' | translate }}
                </p>
              </div>
            }
          </div>

          <!-- Available STANDARD totems (no active session) -->
          @if (availableTotems().length > 0) {
            <div class="p-3 border-t border-gray-200 dark:border-gray-700">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{{ 'tas.available_tables' | translate }}</p>
              @for (totem of availableTotems(); track totem._id) {
                <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700 mb-1 text-sm">
                  <span class="truncate text-gray-900 dark:text-white">{{ totem.totem_name }}</span>
                  <button
                    (click)="startSession(totem._id)"
                    class="text-xs px-2 py-1 bg-green-500 text-white rounded ml-2 whitespace-nowrap"
                  >
                    {{ 'tas.session.open' | translate }}
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </aside>

      <!-- CENTER PANEL: Session items -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
        @if (selectedSession(); as session) {
          <!-- Session Header with Customers -->
          <header class="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3 mb-3">
              <span class="material-symbols-outlined text-2xl">point_of_sale</span>
              <div class="flex-1">
                <h1 class="text-xl font-bold">{{ session.totem?.totem_name || ('tas.table' | translate) }}</h1>
                <p class="text-sm text-gray-500">{{ filteredItems().length }} {{ 'pos.items' | translate }}</p>
              </div>
            </div>

            <!-- Customers Tabs -->
            <div class="flex items-center gap-2 overflow-x-auto">
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
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
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
            @if (filteredItems().length === 0) {
              <div class="flex flex-col items-center justify-center py-16 text-gray-400">
                <span class="material-symbols-outlined text-5xl mb-3">receipt_long</span>
                <p>{{ 'pos.empty_cart' | translate }}</p>
              </div>
            }
            @for (item of filteredItems(); track item._id) {
              @if (item.item_state !== 'CANCELED') {
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 border border-gray-100 dark:border-gray-700">
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-sm truncate">{{ item.item_name_snapshot | localize }}</p>
                      @if (item.item_disher_variant) {
                        <p class="text-xs text-gray-500">
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
                    </div>
                    <span class="font-bold text-sm ml-4">{{ getItemTotal(item) | currencyFormat }}</span>
                  </div>
                  <div class="flex items-center gap-2 mt-2">
                    <span class="text-xs px-2 py-0.5 rounded-full"
                      [class.bg-yellow-100]="item.item_state === 'ORDERED'"
                      [class.text-yellow-700]="item.item_state === 'ORDERED'"
                      [class.bg-blue-100]="item.item_state === 'ON_PREPARE'"
                      [class.text-blue-700]="item.item_state === 'ON_PREPARE'"
                      [class.bg-green-100]="item.item_state === 'SERVED'"
                      [class.text-green-700]="item.item_state === 'SERVED'"
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
              }
            }
          </div>

          <!-- Add Order Button -->
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
          <div class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <span class="material-symbols-outlined text-6xl mb-4">table_restaurant</span>
            <p class="text-lg">{{ 'pos.select_table' | translate }}</p>
          </div>
        }
      </main>

      <!-- RIGHT PANEL: Menu (when adding items) or Ticket -->
      @if (showMenu()) {
        <aside class="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-bold">{{ 'tas.add_order' | translate }}</h2>
            <button (click)="showMenu.set(false)" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
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
      } @else {
        <!-- RIGHT PANEL: Ticket / Billing -->
        <aside class="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col p-4">
          <h2 class="font-bold text-lg flex items-center gap-1 mb-3">
            <span class="material-symbols-outlined">receipt_long</span> {{ 'pos.ticket' | translate }}
          </h2>
          <div class="flex-1 overflow-auto flex flex-col gap-2">
            @if (selectedCustomerId()) {
              <!-- Show items for selected customer -->
              @for (item of sessionItems(); track item._id) {
                @if (item.customer_id === selectedCustomerId() && item.item_state !== 'CANCELED') {
                  <div class="flex justify-between items-center text-sm">
                    <span class="truncate">{{ item.item_name_snapshot | localize }}</span>
                    <span>{{ getItemTotal(item) | currencyFormat }}</span>
                  </div>
                }
              }
            } @else {
              <!-- Show all items -->
              @for (item of sessionItems(); track item._id) {
                @if (item.item_state !== 'CANCELED') {
                  <div class="flex justify-between items-center text-sm">
                    <span class="truncate">{{ item.item_name_snapshot | localize }}</span>
                    <span>{{ getItemTotal(item) | currencyFormat }}</span>
                  </div>
                }
              }
            }
            @if (sessionItems().length === 0) {
              <p class="text-sm text-gray-500 text-center mt-4">{{ 'pos.empty_cart' | translate }}</p>
            }
          </div>
          <div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 flex flex-col gap-1 text-sm">
            <div class="flex justify-between text-gray-600 dark:text-gray-400">
              <span>{{ 'pos.subtotal' | translate }}</span>
              @if (selectedCustomerId()) {
                <span>{{ getSelectedCustomerTotal() | currencyFormat }}</span>
              } @else {
                <span>{{ sessionTotal() | currencyFormat }}</span>
              }
            </div>
            <div class="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span>{{ 'pos.total' | translate }}</span>
              @if (selectedCustomerId()) {
                <span>{{ getSelectedCustomerTotal() | currencyFormat }}</span>
              } @else {
                <span>{{ sessionTotal() | currencyFormat }}</span>
              }
            </div>
            <button
              *caslCan="'create'; subject:'Payment'"
              (click)="openPaymentModal()"
              [disabled]="!selectedSession() || sessionItems().length === 0"
              class="mt-3 w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg py-2 font-bold active:scale-95 transition-transform flex items-center justify-center gap-1"
            >
              <span class="material-symbols-outlined">payments</span> {{ 'pos.charge' | translate }}
            </button>
          </div>
        </aside>
      }

      <!-- Dish Detail Modal (for variants/extras) -->
      @if (selectedDish(); as dish) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-lg font-bold">{{ dish.disher_name | localize }}</h3>
              <button (click)="selectedDish.set(null)" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
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

      <!-- Payment Modal -->
      @if (showPaymentModal()) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-auto">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-lg font-bold flex items-center gap-2">
                <span class="material-symbols-outlined">payments</span>
                {{ 'pos.payment.title' | translate }}
              </h3>
              <button (click)="closePaymentModal()" class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div class="p-4">
              <!-- Total to Pay -->
              <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 mb-4 text-center">
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ 'pos.payment.total_to_pay' | translate }}</p>
                <p class="text-3xl font-bold text-primary">{{ sessionTotal() | currencyFormat }}</p>
                @if (selectedCustomerId()) {
                  <p class="text-xs text-gray-500 mt-1">
                    {{ 'pos.payment.paying_for' | translate }} {{ getCustomerById(selectedCustomerId()!)?.customer_name }}
                  </p>
                }
              </div>

              <!-- Payment Type Selection -->
              @if (!showPaymentSummary()) {
                <div class="space-y-3 mb-4">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ 'pos.payment.select_method' | translate }}</p>
                  
                  <!-- Option 1: Full Payment -->
                  <button
                    (click)="selectPaymentType('ALL')"
                    class="w-full p-4 rounded-lg border-2 text-left transition-colors"
                    [class.border-primary]="paymentType() === 'ALL'"
                    [class.bg-primary-50]="paymentType() === 'ALL'"
                    [class.border-gray-200]="paymentType() !== 'ALL'"
                    [class.dark:border-gray-700]="paymentType() !== 'ALL'"
                  >
                    <div class="flex items-center gap-3">
                      <span class="material-symbols-outlined text-2xl" [class.text-primary]="paymentType() === 'ALL'">receipt</span>
                      <div class="flex-1">
                        <p class="font-semibold">{{ 'pos.payment.full_payment' | translate }}</p>
                        <p class="text-xs text-gray-500">{{ 'pos.payment.full_payment_desc' | translate }}</p>
                      </div>
                      <span class="font-bold">{{ sessionTotal() | currencyFormat }}</span>
                    </div>
                  </button>

                  <!-- Option 2: Split Equally -->
                  <button
                    (click)="selectPaymentType('SHARED')"
                    class="w-full p-4 rounded-lg border-2 text-left transition-colors"
                    [class.border-primary]="paymentType() === 'SHARED'"
                    [class.bg-primary-50]="paymentType() === 'SHARED'"
                    [class.border-gray-200]="paymentType() !== 'SHARED'"
                    [class.dark:border-gray-700]="paymentType() !== 'SHARED'"
                  >
                    <div class="flex items-center gap-3">
                      <span class="material-symbols-outlined text-2xl" [class.text-primary]="paymentType() === 'SHARED'">splitscreen</span>
                      <div class="flex-1">
                        <p class="font-semibold">{{ 'pos.payment.split_equal' | translate }}</p>
                        <p class="text-xs text-gray-500">{{ 'pos.payment.split_equal_desc' | translate }}</p>
                      </div>
                    </div>
                  </button>

                  <!-- Split Count Input (only for SHARED) -->
                  @if (paymentType() === 'SHARED') {
                    <div class="pl-12 pr-4 py-2">
                      <label class="text-sm text-gray-600 dark:text-gray-400">{{ 'pos.payment.number_of_people' | translate }}</label>
                      <div class="flex items-center gap-2 mt-1">
                        <button 
                          (click)="splitCount.set(Math.max(2, splitCount() - 1))"
                          class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"
                        >
                          <span class="material-symbols-outlined">remove</span>
                        </button>
                        <input 
                          type="number" 
                          [(ngModel)]="splitCount" 
                          min="2" 
                          max="20"
                          class="w-20 text-center p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                        />
                        <button 
                          (click)="splitCount.set(Math.min(20, splitCount() + 1))"
                          class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200"
                        >
                          <span class="material-symbols-outlined">add</span>
                        </button>
                      </div>
                      <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        {{ 'pos.payment.each_pays' | translate }} <span class="font-bold text-primary">{{ calculateSplitAmount() | currencyFormat }}</span>
                      </p>
                    </div>
                  }

                  <!-- Option 3: By Consumption -->
                  @if (canPayByConsumption()) {
                    <button
                      (click)="selectPaymentType('BY_USER')"
                      class="w-full p-4 rounded-lg border-2 text-left transition-colors"
                      [class.border-primary]="paymentType() === 'BY_USER'"
                      [class.bg-primary-50]="paymentType() === 'BY_USER'"
                      [class.border-gray-200]="paymentType() !== 'BY_USER'"
                      [class.dark:border-gray-700]="paymentType() !== 'BY_USER'"
                    >
                      <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-2xl" [class.text-primary]="paymentType() === 'BY_USER'">group</span>
                        <div class="flex-1">
                          <p class="font-semibold">{{ 'pos.payment.by_consumption' | translate }}</p>
                          <p class="text-xs text-gray-500">{{ 'pos.payment.by_consumption_desc' | translate }}</p>
                        </div>
                      </div>
                    </button>
                  } @else {
                    <div class="p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed">
                      <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-2xl">group</span>
                        <div class="flex-1">
                          <p class="font-semibold">{{ 'pos.payment.by_consumption' | translate }}</p>
                          <p class="text-xs text-red-500">{{ 'pos.payment.by_consumption_unavailable' | translate }}</p>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Payment Summary -->
              @if (showPaymentSummary()) {
                <div class="mb-4">
                  <h4 class="font-semibold mb-3 flex items-center gap-2">
                    <span class="material-symbols-outlined">receipt_long</span>
                    {{ 'pos.payment.summary' | translate }}
                  </h4>
                  
                  <div class="space-y-2 max-h-60 overflow-auto">
                    @for (ticket of paymentTickets(); track ticket.ticket_id || $index) {
                      <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                        <div class="flex items-center justify-between">
                          <div>
                            <p class="font-medium">
                              @if (ticket.ticket_customer_name) {
                                {{ ticket.ticket_customer_name }}
                              } @else {
                                {{ 'pos.payment.ticket' | translate }} {{ ticket.ticket_part }} / {{ ticket.ticket_total_parts }}
                              }
                            </p>
                            @if (ticket.ticket_customer_name) {
                              <p class="text-xs text-gray-500">
                                {{ getItemsForCustomer(ticket.ticket_customer_name).length }} {{ 'pos.items' | translate }}
                              </p>
                            }
                          </div>
                          <span class="text-lg font-bold text-primary">{{ ticket.ticket_amount | currencyFormat }}</span>
                        </div>
                      </div>
                    }
                  </div>

                  <div class="mt-4 p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                    <div class="flex items-center justify-between">
                      <span class="font-semibold">{{ 'pos.payment.total' | translate }}</span>
                      <span class="text-xl font-bold text-primary">{{ sessionTotal() | currencyFormat }}</span>
                    </div>
                  </div>
                </div>

                <!-- Back Button -->
                <button
                  (click)="showPaymentSummary.set(false)"
                  class="w-full py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  {{ 'common.back' | translate }}
                </button>
              }

              <!-- Action Buttons -->
              @if (!showPaymentSummary()) {
                <div class="flex gap-2">
                  <button
                    (click)="closePaymentModal()"
                    class="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {{ 'common.cancel' | translate }}
                  </button>
                  <button
                    (click)="calculateTickets()"
                    [disabled]="!paymentType() || isProcessingPayment()"
                    class="flex-1 py-3 bg-primary text-white rounded-lg font-semibold disabled:opacity-50"
                  >
                    {{ 'pos.payment.calculate' | translate }}
                  </button>
                </div>
              } @else {
                <button
                  (click)="processPayment()"
                  [disabled]="isProcessingPayment()"
                  class="w-full py-3 bg-green-500 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  @if (isProcessingPayment()) {
                    <span class="material-symbols-outlined animate-spin">refresh</span>
                    {{ 'pos.payment.processing' | translate }}
                  } @else {
                    <span class="material-symbols-outlined">check_circle</span>
                    {{ 'pos.payment.confirm' | translate }}
                  }
                </button>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PosComponent implements OnInit, OnDestroy {
  private tasService = inject(TasService);
  private socketService = inject(SocketService);
  private i18n = inject(I18nService);
  private notify = inject(NotificationService);
  private destroy$ = new Subject<void>();

  // State
  isLoading = signal(false);
  isConnected = signal(false);
  sessions = signal<TotemSession[]>([]);
  selectedSession = signal<TotemSession | null>(null);
  sessionItems = signal<ItemOrder[]>([]);
  allTotems = signal<Array<{ _id: string; totem_name: string; totem_type: string }>>([]);
  customers = signal<Customer[]>([]);
  showAddCustomer = signal(false);
  newCustomerName = signal('');
  selectedCustomerId = signal<string | null>(null);
  
  // Menu state
  showMenu = signal(false);
  dishes = signal<Dish[]>([]);
  categories = signal<Array<{ _id: string; category_name: LocalizedField }>>([]);
  selectedCategory = signal<string | null>(null);
  selectedDish = signal<Dish | null>(null);
  selectedVariantId = signal<string | null>(null);
  selectedExtras = signal<string[]>([]);
  assignToCustomerId = signal<string | null>(null);
  isAddingItem = signal(false);

  // Payment state
  showPaymentModal = signal(false);
  paymentType = signal<'ALL' | 'SHARED' | 'BY_USER' | null>(null);
  splitCount = signal<number>(2);
  isProcessingPayment = signal(false);
  paymentTickets = signal<PaymentTicket[]>([]);
  showPaymentSummary = signal(false);

  // Cart (from store, for manual POS items)
  cartItems = cartStore.items;
  subtotal = cartStore.subtotal;
  total = cartStore.total;

  activeSessions = computed(() =>
    this.sessions().filter(s => s.totem_state === 'STARTED')
  );

  availableTotems = computed(() => {
    const activeTotemIds = new Set(this.sessions().map(s => s.totem_id?.toString()));
    return this.allTotems().filter(t => t.totem_type === 'STANDARD' && !activeTotemIds.has(t._id?.toString()));
  });

  sessionTotal = computed(() =>
    this.sessionItems()
      .filter(i => i.item_state !== 'CANCELED')
      .reduce((sum, item) => sum + this.getItemTotal(item), 0)
  );

  filteredItems = computed(() => {
    const customerId = this.selectedCustomerId();
    const items = this.sessionItems().filter(i => i.item_state !== 'CANCELED');
    if (customerId === null) return items;
    return items.filter(i => i.customer_id === customerId);
  });

  filteredDishes = computed(() => {
    const cat = this.selectedCategory();
    const all = this.dishes();
    if (!cat) return all;
    return all.filter(d => d.category_id === cat);
  });

  ngOnInit() {
    this.loadData();
    this.setupSocketListeners();
    this.checkConnection();
    const connInterval = setInterval(() => this.checkConnection(), 2000);
    this.destroy$.subscribe(() => clearInterval(connInterval));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.socketService.releaseConnection();
  }

  private checkConnection() {
    this.isConnected.set(this.socketService.isConnected());
  }

  private loadData() {
    this.isLoading.set(true);

    this.tasService.getActiveSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });

    this.tasService.getTotems()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (totems) => this.allTotems.set(totems),
        error: (err) => console.error('[POS] Error loading totems:', err),
      });

    // Load dishes and categories
    this.tasService.getDishes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ dishes, categories }) => {
          this.dishes.set(dishes);
          this.categories.set(categories);
        },
        error: (err) => console.error('[POS] Error loading dishes:', err),
      });

    this.socketService.acquireConnection();
  }

  private setupSocketListeners() {
    this.socketService.on('item:state_changed', (data: { itemId: string; newState: string }) => {
      this.sessionItems.update(items =>
        items.map(i => i._id === data.itemId ? { ...i, item_state: data.newState as ItemOrder['item_state'] } : i)
      );
    });

    this.socketService.on('kds:new_item', (item: any) => {
      if (item.session_id === this.selectedSession()?._id) {
        this.sessionItems.update(items => [...items, item]);
      }
    });

    this.socketService.on('pos:session_closed', (data: { sessionId: string }) => {
      if (data.sessionId === this.selectedSession()?._id) {
        this.selectedSession.set(null);
        this.sessionItems.set([]);
        this.customers.set([]);
        this.notify.warning(this.i18n.translate('tas.session_closed_by_pos'));
      }
      this.sessions.update(s => s.filter(x => x._id !== data.sessionId));
    });

    // Listen for customer assignments
    this.socketService.on('item:customer_assigned', ({ itemId, customerId }: { itemId: string; customerId: string | null }) => {
      this.sessionItems.update(items =>
        items.map(i => (i._id === itemId ? { ...i, customer_id: customerId || undefined } : i))
      );
    });
  }

  selectSession(session: TotemSession) {
    this.selectedSession.set(session);
    this.sessionItems.set([]);
    this.customers.set([]);
    this.selectedCustomerId.set(null);

    this.tasService.getSessionItems(session._id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => this.sessionItems.set(items),
        error: (err) => console.error('[POS] Error loading session items:', err),
      });

    // Load customers for this session
    this.tasService.getCustomers(session._id!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customers) => this.customers.set(customers),
        error: (err) => console.error('[POS] Error loading customers:', err),
      });

    this.socketService.joinSession(session._id!);
  }

  startSession(totemId: string) {
    this.tasService.startSession(totemId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.sessions.update(s => [...s, session]);
          this.selectSession(session);
          this.notify.success(this.i18n.translate('tas.session_started'));
        },
        error: (err) => {
          console.error('[POS] Error starting session:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  getSessionItemCount(sessionId: string): number {
    if (this.selectedSession()?._id === sessionId) {
      return this.sessionItems().filter(i => i.item_state !== 'CANCELED').length;
    }
    return 0;
  }

  getItemTotal(item: ItemOrder): number {
    const variantPrice = item.item_disher_variant?.price || 0;
    const extrasPrice = item.item_disher_extras.reduce((sum, e) => sum + e.price, 0);
    return item.item_base_price + variantPrice + extrasPrice;
  }

  getStateLabel(state: string): string {
    switch (state) {
      case 'ORDERED': return this.i18n.translate('order_state.ordered');
      case 'ON_PREPARE': return this.i18n.translate('order_state.preparing');
      case 'SERVED': return this.i18n.translate('order_state.served');
      case 'CANCELED': return this.i18n.translate('order_state.canceled');
      default: return state;
    }
  }

  addCustomer() {
    const name = this.newCustomerName().trim();
    if (!name || !this.selectedSession()) return;

    this.tasService.createCustomer(this.selectedSession()!._id!, name)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (customer) => {
          this.customers.update(current => [...current, customer]);
          this.newCustomerName.set('');
          this.showAddCustomer.set(false);
          this.notify.success(this.i18n.translate('tas.customer_added'));
        },
        error: (err) => {
          console.error('[POS] Error creating customer:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  assignItemToCustomer(itemId: string, customerId: string | null) {
    this.tasService.assignItemToCustomer(itemId, customerId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.sessionItems.update(items =>
            items.map(i => (i._id === itemId ? { ...i, customer_id: customerId || undefined } : i))
          );
          this.notify.info(this.i18n.translate('tas.item_assigned'));
        },
        error: (err) => {
          console.error('[POS] Error assigning item:', err);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
  }

  getCustomerItemCount(customerId: string): number {
    return this.sessionItems().filter(i => i.customer_id === customerId && i.item_state !== 'CANCELED').length;
  }

  getSelectedCustomerTotal(): number {
    const customerId = this.selectedCustomerId();
    if (!customerId) return this.sessionTotal();
    return this.sessionItems()
      .filter(i => i.customer_id === customerId && i.item_state !== 'CANCELED')
      .reduce((sum, item) => sum + this.getItemTotal(item), 0);
  }

  getCustomerById(customerId: string): Customer | undefined {
    return this.customers().find(c => c._id === customerId);
  }

  // Menu methods
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

    const existingOrder = this.sessionItems()[0];
    let orderId = existingOrder?.order_id;

    const createItem = () => {
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
          this.sessionItems.update(items => [...items, item]);
          
          this.socketService.emit('pos:add_item', {
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
          this.notify.success(this.i18n.translate('tas.item_added'));
        },
        error: (err) => {
          console.error('[POS] Error adding item:', err);
          this.isAddingItem.set(false);
          this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
        },
      });
    };

    if (orderId) {
      createItem();
    } else {
      this.tasService.createOrder({ session_id: session._id! })
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (order) => {
            orderId = order._id;
            createItem();
          },
          error: (err) => {
            console.error('[POS] Error creating order:', err);
            this.isAddingItem.set(false);
            this.notify.error(this.i18n.translate('errors.SERVER_ERROR'));
          },
        });
    }
  }

  // ==================== PAYMENT METHODS ====================

  openPaymentModal() {
    this.showPaymentModal.set(true);
    this.paymentType.set(null);
    this.showPaymentSummary.set(false);
    this.paymentTickets.set([]);
    this.splitCount.set(2);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
    this.paymentType.set(null);
    this.showPaymentSummary.set(false);
    this.paymentTickets.set([]);
  }

  selectPaymentType(type: 'ALL' | 'SHARED' | 'BY_USER') {
    this.paymentType.set(type);
  }

  canPayByConsumption(): boolean {
    const items = this.sessionItems().filter(i => i.item_state !== 'CANCELED');
    if (items.length === 0) return false;
    return items.every(item => !!item.customer_id);
  }

  calculateSplitAmount(): number {
    const total = this.sessionTotal();
    const count = this.splitCount();
    return Math.round((total / count) * 100) / 100;
  }

  getItemsForCustomer(customerName: string): ItemOrder[] {
    const customer = this.customers().find(c => c.customer_name === customerName);
    if (!customer) return [];
    return this.sessionItems().filter(i => i.customer_id === customer._id && i.item_state !== 'CANCELED');
  }

  calculateTickets() {
    const type = this.paymentType();
    if (!type) return;

    const tickets: PaymentTicket[] = [];

    switch (type) {
      case 'ALL':
        tickets.push({
          ticket_id: `ticket-${Date.now()}-1`,
          ticket_part: 1,
          ticket_total_parts: 1,
          ticket_amount: this.sessionTotal(),
          ticket_customer_name: undefined,
          paid: false,
        });
        break;

      case 'SHARED':
        const total = this.sessionTotal();
        const count = this.splitCount();
        const baseAmount = Math.floor((total / count) * 100) / 100;
        const remainder = Math.round((total - (baseAmount * count)) * 100) / 100;

        for (let i = 0; i < count; i++) {
          tickets.push({
            ticket_id: `ticket-${Date.now()}-${i + 1}`,
            ticket_part: i + 1,
            ticket_total_parts: count,
            ticket_amount: i === 0 ? baseAmount + remainder : baseAmount,
            ticket_customer_name: undefined,
            paid: false,
          });
        }
        break;

      case 'BY_USER':
        const customerTotals = new Map<string, number>();
        
        this.sessionItems()
          .filter(i => i.item_state !== 'CANCELED')
          .forEach(item => {
            const customerId = item.customer_id!;
            const current = customerTotals.get(customerId) || 0;
            customerTotals.set(customerId, current + this.getItemTotal(item));
          });

        let part = 1;
        customerTotals.forEach((amount, customerId) => {
          const customer = this.getCustomerById(customerId);
          tickets.push({
            ticket_id: `ticket-${Date.now()}-${part}`,
            ticket_part: part,
            ticket_total_parts: customerTotals.size,
            ticket_amount: Math.round(amount * 100) / 100,
            ticket_customer_name: customer?.customer_name || `Customer ${part}`,
            paid: false,
          });
          part++;
        });
        break;
    }

    this.paymentTickets.set(tickets);
    this.showPaymentSummary.set(true);
  }

  processPayment() {
    const session = this.selectedSession();
    if (!session || !this.paymentType()) return;

    this.isProcessingPayment.set(true);

    const paymentData = {
      paymentTotal: this.sessionTotal(),
      paymentType: this.paymentType()!,
      tickets: this.paymentTickets(),
    };

    this.socketService.emit('pos:process_payment', {
      sessionId: session._id!,
      ...paymentData,
    });

    setTimeout(() => {
      this.isProcessingPayment.set(false);
      this.notify.success(this.i18n.translate('pos.payment.success'));
      this.closePaymentModal();
      
      this.sessionItems.set([]);
      this.customers.set([]);
      this.selectedSession.set(null);
      this.sessions.update(sessions => sessions.filter(s => s._id !== session._id));
    }, 1500);
  }

  protected readonly Math = Math;
}
