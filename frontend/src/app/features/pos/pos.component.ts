import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { cartStore } from '../../store/cart.store';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { CaslCanDirective } from '../../shared/directives/casl.directive';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, CurrencyFormatPipe, CaslCanDirective],
  template: `
    <div class="h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <!-- Sessions panel -->
      <aside class="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 gap-2">
        <h2 class="font-bold text-lg flex items-center gap-1 text-gray-900 dark:text-white">
          <span class="material-symbols-outlined">table_restaurant</span> Mesas
        </h2>
        <div class="flex-1 overflow-auto flex flex-col gap-2">
          <!-- Totem sessions would be listed here -->
          <p class="text-sm text-gray-500 dark:text-gray-400">Sin sesiones activas</p>
        </div>
        <button
          *caslCan="'create'; subject:'TotemSession'"
          class="bg-primary text-white rounded-lg py-2 px-4 font-semibold flex items-center gap-1 justify-center active:scale-95 transition-transform"
        >
          <span class="material-symbols-outlined">add_circle</span> Nueva Mesa
        </button>
      </aside>

      <!-- Orders panel -->
      <main class="flex-1 flex flex-col p-4 gap-4 overflow-auto">
        <header class="flex items-center justify-between">
          <h1 class="text-xl font-bold flex items-center gap-1">
            <span class="material-symbols-outlined">point_of_sale</span> POS
          </h1>
          <!-- Theme Toggle -->
          <button 
            (click)="themeService.toggleTheme()"
            class="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Cambiar tema"
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
        </header>

        <div class="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <p class="text-gray-500 dark:text-gray-400 text-center mt-8">Selecciona una mesa para ver los pedidos</p>
        </div>
      </main>

      <!-- Cart / Ticket panel -->
      <aside class="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col p-4">
        <h2 class="font-bold text-lg flex items-center gap-1 mb-3 text-gray-900 dark:text-white">
          <span class="material-symbols-outlined">receipt_long</span> Ticket
        </h2>
        <div class="flex-1 overflow-auto flex flex-col gap-2">
          @for (item of items(); track item.dishId) {
            <div class="flex justify-between items-center text-sm">
              <span class="text-gray-900 dark:text-white">{{ item.name }} x{{ item.quantity }}</span>
              <span class="text-gray-900 dark:text-white">{{ (item.price * item.quantity) | currencyFormat }}</span>
            </div>
          }
          @if (!items().length) {
            <p class="text-gray-500 dark:text-gray-400 text-sm text-center mt-4">Carrito vacío</p>
          }
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 flex flex-col gap-1 text-sm">
          <div class="flex justify-between text-gray-600 dark:text-gray-400">
            <span>Subtotal (sin IVA)</span>
            <span>{{ subtotal() | currencyFormat }}</span>
          </div>
          <div class="flex justify-between text-gray-600 dark:text-gray-400">
            <span>IVA ({{ config().taxRate }}%)</span>
            <span>{{ tax() | currencyFormat }}</span>
          </div>
          @if (tips() > 0) {
            <div class="flex justify-between text-green-600 dark:text-green-400 font-medium">
              <span>Propina</span>
              <span>{{ tips() | currencyFormat }}</span>
            </div>
          }
          <div class="flex justify-between font-bold text-base mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white">
            <span>Total</span>
            <span>{{ total() | currencyFormat }}</span>
          </div>
          <button
            *caslCan="'create'; subject:'Payment'"
            class="mt-3 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2 font-bold active:scale-95 transition-transform flex items-center justify-center gap-1"
          >
            <span class="material-symbols-outlined">payments</span> Cobrar
          </button>
        </div>
      </aside>
    </div>
  `,
})
export class PosComponent {
  themeService = inject(ThemeService);
  
  items = cartStore.items;
  config = cartStore.config;
  subtotal = cartStore.subtotal;
  tax = cartStore.taxAmount;
  tips = cartStore.tipsAmount;
  total = cartStore.total;
}
