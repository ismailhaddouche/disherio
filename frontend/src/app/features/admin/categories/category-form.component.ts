import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ImageUploaderComponent } from '../../../shared/components/image-uploader/image-uploader.component';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ImageUploaderComponent, TranslatePipe],
  template: `
    <div class="max-w-3xl mx-auto flex flex-col gap-6">
      <header class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ isEdit ? ('category.edit' | translate) : ('category.new' | translate) }}</h1>
        <div class="flex gap-2">
          <button (click)="cancel()" class="px-4 py-2 text-gray-500 dark:text-gray-400 font-medium hover:text-gray-700 dark:hover:text-gray-200">{{ 'common.cancel' | translate }}</button>
          <button (click)="save()" class="bg-primary text-white rounded-lg px-6 py-2 font-bold active:scale-95 transition-transform">
            {{ 'common.save' | translate }}
          </button>
        </div>
      </header>

      <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <!-- Image Section -->
        <section class="flex flex-col gap-2">
          <label class="font-bold">{{ 'category.image' | translate }}</label>
          <app-image-uploader
            folder="categories"
            [currentImage]="category().category_image_url"
            (imageUploaded)="onImageUploaded($event)"
          />
        </section>

        <!-- Basic Info -->
        <div class="grid grid-cols-1 gap-4">
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500 dark:text-gray-400">{{ 'category.name_es' | translate }}</label>
            <input [(ngModel)]="category().category_name.es" class="input-style" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500 dark:text-gray-400">{{ 'category.display_order' | translate }}</label>
            <input type="number" [(ngModel)]="category().category_order" class="input-style" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm text-gray-500 dark:text-gray-400">{{ 'category.description_es' | translate }}</label>
            <textarea [(ngModel)]="category().category_description.es" class="input-style" rows="3"></textarea>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .input-style { @apply bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 outline-none focus:border-primary; }
  `]
})
export class CategoryFormComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isEdit = false;
  category = signal<any>({
    category_name: { es: '' },
    category_order: 0,
    category_description: { es: '' },
    category_image_url: ''
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.loadCategory(id);
    }
  }

  loadCategory(id: string) {
    this.http.get(`${environment.apiUrl}/dishes/categories/${id}`).subscribe(res => this.category.set(res));
  }

  onImageUploaded(url: string) {
    this.category.update(c => ({ ...c, category_image_url: url }));
  }

  save() {
    // Note: Assuming these endpoints exist or will be created in the dishes controller
    const obs = this.isEdit 
      ? this.http.patch(`${environment.apiUrl}/dishes/categories/${this.category()._id}`, this.category())
      : this.http.post(`${environment.apiUrl}/dishes/categories`, this.category());
    
    obs.subscribe(() => this.router.navigate(['/admin/categories']));
  }

  cancel() {
    this.router.navigate(['/admin/categories']);
  }
}
