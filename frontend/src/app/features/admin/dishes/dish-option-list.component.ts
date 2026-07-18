import { Component, input, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { LocalizedInputComponent } from '../../../shared/components/localized-input.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import type { LocalizedField } from '../../../types';

export interface OptionItem {
  variant_name?: LocalizedField;
  variant_description?: LocalizedField;
  variant_price?: number;
  extra_name?: LocalizedField;
  extra_description?: LocalizedField;
  extra_price?: number;
}

@Component({
  selector: 'app-dish-option-list',
  standalone: true,
  imports: [CommonModule, FormsModule, LocalizedInputComponent, TranslatePipe, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="disher-option-section">
      <div class="flex items-center justify-between mb-3">
        <h2 class="disher-option-title">{{ title() }}</h2>
        <button matButton (click)="add.emit()" class="disher-add-option-btn">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'dish.add' | translate }}
        </button>
      </div>

      @if (subtitle()) {
        <p class="disher-option-subtitle">{{ subtitle() }}</p>
      }

      <div class="flex flex-col gap-3">
        @for (item of items(); track $index; let i = $index) {
          <div [class]="itemClasses()">
            <div class="flex-1 flex flex-col gap-3">
              <app-localized-input
                [label]="'common.name' | translate"
                [value]="getName(item)"
                (valueChange)="setName(item, $event)"
                [required]="true"
              />
              <app-localized-input
                [label]="'dish.description' | translate"
                [value]="getDescription(item)"
                (valueChange)="setDescription(item, $event)"
                [multiline]="true"
              />
            </div>
            <div class="disher-price-field">
              <label class="disher-price-label">{{ 'dish.price' | translate }}</label>
              <input
                type="number"
                [(ngModel)]="item[priceKey()]"
                min="0"
                step="0.01"
                class="disher-price-input"
                placeholder="0.00"
                [title]="i18n.translate('dish.free_extras_hint')"
              />
            </div>
            <button matIconButton (click)="remove.emit(i)" class="disher-remove-btn" [attr.aria-label]="'common.delete' | translate">
              <mat-icon aria-hidden="true">delete</mat-icon>
            </button>
          </div>
        }
      </div>

      @if (items().length === 0) {
        <p class="disher-option-empty">{{ emptyMessage() }}</p>
      }
    </section>
  `,
  styles: [`
    :host { display: block; }
    .disher-option-section {
      border-top: 1px solid var(--mat-sys-outline-variant);
      padding-top: 16px;
    }
    .disher-option-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--mat-sys-on-surface);
    }
    .disher-add-option-btn { min-height: 36px; }
    .disher-option-subtitle {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
      margin-bottom: 12px;
    }
    .disher-price-field {
      width: 96px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-self: flex-start;
      padding-top: 4px;
    }
    .disher-price-label {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-price-input {
      background: var(--mat-sys-surface);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--disher-shape-sm);
      padding: 8px;
      font-size: 14px;
      color: var(--mat-sys-on-surface);
      outline: none;
      transition: border-color var(--disher-transition-fast);
    }
    .disher-price-input:focus { border-color: var(--mat-sys-primary); }
    .disher-remove-btn {
      color: var(--mat-sys-error);
      align-self: flex-start;
      margin-top: 4px;
    }
    .disher-option-empty {
      font-size: 14px;
      color: var(--mat-sys-on-surface-variant);
      font-style: italic;
    }
    .variant-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
      border-radius: var(--disher-shape-md);
      background: var(--mat-sys-surface-container-low);
    }
    .variant-item-amber {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
      border-radius: var(--disher-shape-md);
      background: var(--mat-sys-tertiary-container);
      border: 1px solid var(--mat-sys-outline-variant);
    }
  `],
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

  priceKey(): 'extra_price' | 'variant_price' {
    return this.variant() === 'amber' ? 'extra_price' : 'variant_price';
  }

  getName(item: OptionItem): LocalizedField {
    return this.variant() === 'amber' ? item.extra_name ?? [] : item.variant_name ?? [];
  }

  setName(item: OptionItem, value: LocalizedField): void {
    if (this.variant() === 'amber') item.extra_name = value;
    else item.variant_name = value;
  }

  getDescription(item: OptionItem): LocalizedField {
    return this.variant() === 'amber'
      ? item.extra_description ?? []
      : item.variant_description ?? [];
  }

  setDescription(item: OptionItem, value: LocalizedField): void {
    if (this.variant() === 'amber') item.extra_description = value;
    else item.variant_description = value;
  }

  itemClasses(): string {
    return this.variant() === 'amber' ? 'variant-item-amber' : 'variant-item';
  }
}
