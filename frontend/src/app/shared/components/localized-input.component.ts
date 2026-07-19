import { Component, Input, Output, EventEmitter, inject, signal, effect, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocalizationService, type LanguageDescriptor } from '../../core/services/localization.service';
import type { LocalizedEntry } from '../../types';

let nextLocalizedInputId = 0;

@Component({
  selector: 'app-localized-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (label) {
        <label class="admin-label" [attr.for]="inputId + '-' + activeTab()">{{ label }}</label>
      }

      <!-- Language tabs -->
      @if (languages().length > 1) {
        <div class="flex gap-1 mb-2 border-b border-outline-variant">
          @for (lang of languages(); track lang.code) {
            <button
              type="button"
              (click)="activeTab.set(lang.code)"
              class="px-3 py-1.5 text-sm font-medium border-b-2 transition-colors relative"
              [class.border-primary]="activeTab() === lang.code"
              [class.text-primary]="activeTab() === lang.code"
              [class.border-transparent]="activeTab() !== lang.code"
              [class.text-on-surface-variant]="activeTab() !== lang.code"
              [class.hover:text-on-surface]="activeTab() !== lang.code"
            >
              {{ lang.name }}
              @if (lang.is_default && required) {
                <span class="text-error">*</span>
              }
              @if (hasValue(lang.code)) {
                <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full"></span>
              }
            </button>
          }
        </div>
      }

      <!-- Input field for active tab -->
      @for (lang of languages(); track lang.code) {
        @if (activeTab() === lang.code || languages().length === 1) {
          @if (multiline) {
            <textarea
              [id]="inputId + '-' + lang.code"
              [ngModel]="getValueForLang(lang.code)"
              (ngModelChange)="setValueForLang(lang.code, $event)"
              class="admin-input min-h-[80px]"
              [placeholder]="placeholder || ''"
              [attr.aria-label]="getAriaLabel(lang)"
              rows="3"
            ></textarea>
          } @else {
            <input
              type="text"
              [id]="inputId + '-' + lang.code"
              [ngModel]="getValueForLang(lang.code)"
              (ngModelChange)="setValueForLang(lang.code, $event)"
              class="admin-input"
              [placeholder]="placeholder || ''"
              [attr.aria-label]="getAriaLabel(lang)"
            />
          }
        }
      }
    </div>
  `,
})
export class LocalizedInputComponent {
  private localizationService = inject(LocalizationService);

  @Input() value: LocalizedEntry[] = [];
  @Output() valueChange = new EventEmitter<LocalizedEntry[]>();
  @Input() label = '';
  @Input() placeholder = '';
  @Input() required = false;
  @Input() multiline = false;

  readonly inputId = `localized-input-${nextLocalizedInputId++}`;
  activeTab = signal<string>('');

  readonly languages = computed<LanguageDescriptor[]>(() => this.localizationService.languages());

  constructor() {
    // Sync activeTab when languages are loaded — default to the restaurant
    // default language, or the first available language.
    effect(() => {
      const langs = this.languages();
      if (langs.length > 0 && !this.activeTab()) {
        const def = langs.find((l) => l.is_default);
        this.activeTab.set(def ? def.code : langs[0].code);
      }
    });
  }

  getValueForLang(code: string): string {
    return this.value?.find((e) => e.lang === code)?.value ?? '';
  }

  setValueForLang(code: string, val: string) {
    const arr = [...(this.value || [])];
    const idx = arr.findIndex((e) => e.lang === code);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], value: val };
    } else {
      arr.push({ lang: code, value: val });
    }
    this.value = arr;
    this.valueChange.emit(arr);
  }

  hasValue(code: string): boolean {
    const entry = this.value?.find((e) => e.lang === code);
    return !!entry?.value;
  }

  getAriaLabel(lang: LanguageDescriptor): string {
    const base = (this.label || this.placeholder).replace(/\*+$/, '').trim();
    return base ? `${base} (${lang.name})` : lang.name;
  }
}