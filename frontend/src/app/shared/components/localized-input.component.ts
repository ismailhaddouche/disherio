import { Component, Input, Output, EventEmitter, inject, signal, OnInit, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuLanguageService } from '../../services/menu-language.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import type { LocalizedEntry, MenuLanguage } from '../../types';

@Component({
  selector: 'app-localized-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      @if (label) {
        <label class="admin-label">{{ label }}</label>
      }

      <!-- Language tabs -->
      @if (languages().length > 1) {
        <div class="flex gap-1 mb-2 border-b border-gray-200 dark:border-gray-700">
          @for (lang of languages(); track lang._id) {
            <button
              type="button"
              (click)="activeTab.set(lang._id!)"
              class="px-3 py-1.5 text-sm font-medium border-b-2 transition-colors relative"
              [class.border-primary]="activeTab() === lang._id"
              [class.text-primary]="activeTab() === lang._id"
              [class.border-transparent]="activeTab() !== lang._id"
              [class.text-gray-500]="activeTab() !== lang._id"
              [class.hover:text-gray-700]="activeTab() !== lang._id"
              [class.dark:text-gray-400]="activeTab() !== lang._id"
            >
              {{ lang.name }}
              @if (lang.is_default && required) {
                <span class="text-red-500">*</span>
              }
              @if (hasValue(lang._id!)) {
                <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-primary rounded-full"></span>
              }
            </button>
          }
        </div>
      }

      <!-- Input field for active tab -->
      @for (lang of languages(); track lang._id) {
        @if (activeTab() === lang._id || languages().length === 1) {
          @if (multiline) {
            <textarea
              [ngModel]="getValueForLang(lang._id!)"
              (ngModelChange)="setValueForLang(lang._id!, $event)"
              class="admin-input min-h-[80px]"
              [placeholder]="placeholder || ''"
              rows="3"
            ></textarea>
          } @else {
            <input
              type="text"
              [ngModel]="getValueForLang(lang._id!)"
              (ngModelChange)="setValueForLang(lang._id!, $event)"
              class="admin-input"
              [placeholder]="placeholder || ''"
            />
          }
        }
      }
    </div>
  `,
})
export class LocalizedInputComponent implements OnInit {
  private menuLangService = inject(MenuLanguageService);

  @Input() value: LocalizedEntry[] = [];
  @Output() valueChange = new EventEmitter<LocalizedEntry[]>();
  @Input() label = '';
  @Input() placeholder = '';
  @Input() required = false;
  @Input() multiline = false;

  activeTab = signal<string>('');
  languages = this.menuLangService.languages;

  constructor() {
    // Sync activeTab when languages are loaded
    effect(() => {
      const langs = this.languages();
      if (langs.length > 0 && !this.activeTab()) {
        const def = this.menuLangService.defaultLanguage();
        this.activeTab.set(def ? def._id! : langs[0]._id!);
      }
    });
  }

  ngOnInit() {
    const def = this.menuLangService.defaultLanguage();
    if (def) {
      this.activeTab.set(def._id!);
    } else if (this.languages().length) {
      this.activeTab.set(this.languages()[0]._id!);
    }
  }

  getValueForLang(langId: string): string {
    return this.value?.find(e => e.lang === langId)?.value ?? '';
  }

  setValueForLang(langId: string, val: string) {
    const arr = [...(this.value || [])];
    const idx = arr.findIndex(e => e.lang === langId);
    if (idx >= 0) {
      arr[idx] = { ...arr[idx], value: val };
    } else {
      arr.push({ lang: langId, value: val });
    }
    this.value = arr;
    this.valueChange.emit(arr);
  }

  hasValue(langId: string): boolean {
    const entry = this.value?.find(e => e.lang === langId);
    return !!entry?.value;
  }
}
