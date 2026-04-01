import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalizedInputComponent } from '../../../shared/components/localized-input.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import type { LocalizedField } from '../../../types';

export interface OptionItem {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: unknown;
}

@Component({
  selector: 'app-dish-option-list',
  standalone: true,
  imports: [CommonModule, FormsModule, LocalizedInputComponent, TranslatePipe],
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
            <div class="flex-1 flex flex-col gap-3">
              <app-localized-input
                [label]="'common.name' | translate"
                [(value)]="item[nameKey()]"
                [required]="true"
              />
              <app-localized-input
                [label]="'dish.description' | translate"
                [(value)]="item[descriptionKey()]"
                [multiline]="true"
              />
            </div>
            <div class="w-24 flex flex-col gap-1 self-start pt-1">
              <label class="text-xs text-gray-400 dark:text-gray-500">{{ 'dish.price' | translate }}</label>
              <input 
                type="number" 
                [(ngModel)]="item[priceKey()]" 
                min="0"
                step="0.01"
                class="input-style-sm" 
                placeholder="0.00" 
                [title]="i18n.translate('dish.free_extras_hint')"
              />
            </div>
            <button (click)="remove.emit(i)" class="text-red-500 mb-2 self-start pt-7">
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
      @apply flex items-center gap-2 p-3 rounded-xl;
      @apply bg-gray-50 dark:bg-gray-700;
    }
    .variant-item-amber {
      @apply flex items-center gap-2 p-3 rounded-xl;
      @apply bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800;
    }
  `]
})
export class DishOptionListComponent {
  i18n = inject(I18nService);
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

  descriptionKey(): string {
    return this.variant() === 'amber' ? 'extra_description' : 'variant_description';
  }

  itemClasses(): string {
    return this.variant() === 'amber' ? 'variant-item-amber' : 'variant-item';
  }
}
