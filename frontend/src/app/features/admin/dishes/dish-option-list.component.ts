import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface LocalizedName {
  es: string;
  en: string;
}

export interface OptionItem {
  [key: string]: string | number | LocalizedName | undefined;
}

@Component({
  selector: 'app-dish-option-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <section class="border-t border-gray-100 dark:border-gray-700 pt-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-lg text-gray-900 dark:text-white">{{ title() }}</h2>
        <button (click)="add.emit()" class="text-primary text-sm font-bold">+ {{ 'dish.add' | translate }}</button>
      </div>
      
      @if (subtitle()) {
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{{ subtitle() }}</p>
      }

      <div class="flex flex-col gap-3">
        @for (item of items(); track $index; let i = $index) {
          <div [class]="itemClasses()">
            <div class="flex-1 flex flex-col gap-1">
              <label class="text-xs text-gray-400 dark:text-gray-500">{{ 'common.name' | translate }}</label>
              <input 
                [ngModel]="getName(item)" 
                (ngModelChange)="setName(item, $event)"
                class="input-style-sm" 
                placeholder="Ej: {{ title() }}" 
              />
            </div>
            <div class="w-24 flex flex-col gap-1">
              <label class="text-xs text-gray-400 dark:text-gray-500">{{ 'dish.price' | translate }}</label>
              <input 
                type="number" 
                [(ngModel)]="item[priceKey()]" 
                min="0"
                step="0.01"
                class="input-style-sm" 
                placeholder="0.00" 
                title="Puede ser 0 para extras gratuitos"
              />
            </div>
            <button (click)="remove.emit(i)" class="text-red-500 mb-2">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        }
      </div>

      @if (items().length === 0) {
        <p class="text-sm text-gray-400 dark:text-gray-500 italic">{{ emptyMessage() }}</p>
      }
    </section>
  `,
  styles: [`
    .input-style-sm { 
      @apply bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 text-sm outline-none; 
    }
    .variant-item {
      @apply flex items-end gap-2 p-3 rounded-xl;
      @apply bg-gray-50 dark:bg-gray-700;
    }
    .variant-item-amber {
      @apply flex items-end gap-2 p-3 rounded-xl;
      @apply bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800;
    }
  `]
})
export class DishOptionListComponent {
  title = input.required<string>();
  subtitle = input<string>('');
  emptyMessage = input.required<string>();
  variant = input<'default' | 'amber'>('default');
  items = input.required<OptionItem[]>();

  add = output<void>();
  remove = output<number>();

  nameKey(): string {
    return this.variant() === 'amber' ? 'extra_name' : 'variant_name';
  }

  priceKey(): string {
    return this.variant() === 'amber' ? 'extra_price' : 'variant_price';
  }

  itemClasses(): string {
    return this.variant() === 'amber' ? 'variant-item-amber' : 'variant-item';
  }

  getName(item: OptionItem): string {
    const name = item[this.nameKey()] as LocalizedName;
    return name?.es ?? '';
  }

  setName(item: OptionItem, value: string): void {
    const nameKey = this.nameKey();
    (item[nameKey] as LocalizedName).es = value;
  }
}
