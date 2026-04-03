import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ImageUploaderComponent } from '../../../shared/components/image-uploader/image-uploader.component';
import { LocalizedInputComponent } from '../../../shared/components/localized-input.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { MenuLanguageService } from '../../../services/menu-language.service';
import { NotificationService } from '../../../core/services/notification.service';
import type { Category, LocalizedField } from '../../../types';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUploaderComponent, LocalizedInputComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-container max-w-4xl">
      <header class="admin-header">
        <div>
          <h1 class="admin-title">{{ isEdit ? ('category.edit' | translate) : ('category.new' | translate) }}</h1>
          <p class="admin-subtitle">{{ isEdit ? ('category.edit_subtitle' | translate) : ('category.new_subtitle' | translate) }}</p>
        </div>
        <div class="flex gap-3">
          <button (click)="cancel()" class="btn-admin btn-secondary">
            {{ 'common.cancel' | translate }}
          </button>
          <button (click)="save()" class="btn-admin btn-primary">
            <span class="material-symbols-outlined text-sm">save</span>
            {{ 'common.save' | translate }}
          </button>
        </div>
      </header>

      <div class="admin-card p-6 flex flex-col gap-6">
        <!-- Image Section -->
        <section class="flex flex-col gap-2">
          <label class="admin-label text-base font-bold">{{ 'category.image' | translate }}</label>
          <app-image-uploader
            folder="categories"
            [currentImage]="category().category_image_url"
            (imageUploaded)="onImageUploaded($event)"
          />
        </section>

        <!-- Basic Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <app-localized-input
            [label]="('category.name' | translate) + ' *'"
            [(value)]="category().category_name"
            [required]="true"
          />
          <div>
            <label class="admin-label">{{ 'category.display_order' | translate }}</label>
            <input type="number" [(ngModel)]="category().category_order" class="admin-input" min="0" />
          </div>
        </div>

        <app-localized-input
          [label]="'category.description' | translate"
          [(value)]="category().category_description"
          [multiline]="true"
        />
      </div>
    </div>
  `
})
export class CategoryFormComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private i18n = inject(I18nService);
  private menuLangService = inject(MenuLanguageService);
  private notify = inject(NotificationService);

  isEdit = false;
  category = signal<Omit<Partial<Category>, 'category_name' | 'category_description' | 'category_image_url'> & {
    category_name: LocalizedField;
    category_description: LocalizedField;
    category_image_url: string | null;
  }>({
    category_name: [],
    category_order: 0,
    category_description: [],
    category_image_url: null,
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loadCategory(id);
    }
  }

  loadCategory(id: string) {
    this.http.get(`${environment.apiUrl}/dishes/categories/${id}`).subscribe(res => this.category.set(res as any));
  }

  onImageUploaded(url: string) {
    this.category.update(c => ({ ...c, category_image_url: url }));
  }

  save() {
    const defaultLang = this.menuLangService.defaultLanguage();
    const nameInDefault = this.category().category_name?.find(e => e.lang === defaultLang?._id)?.value;

    if (!nameInDefault?.trim()) {
      this.notify.error(this.i18n.translate('validation.default_lang_required'));
      return;
    }

    const obs = this.isEdit 
      ? this.http.patch(`${environment.apiUrl}/dishes/categories/${this.category()._id}`, this.category())
      : this.http.post(`${environment.apiUrl}/dishes/categories`, this.category());
    
    obs.subscribe({
      next: () => {
        this.notify.success(this.i18n.translate(this.isEdit ? 'category.updated' : 'category.created'));
        this.router.navigate(['/admin/categories']);
      },
      error: (err) => {
        this.notify.error(err.error?.message || this.i18n.translate('errors.SERVER_ERROR'));
      }
    });
  }

  cancel() {
    this.router.navigate(['/admin/categories']);
  }
}
