import { Component, input, output, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';

@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="flex flex-col gap-2">
      <div 
        class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
        (click)="fileInput.click()"
      >
        @if (previewUrl()) {
          <img [src]="previewUrl()" class="w-full h-32 object-cover rounded-lg mb-2" />
        } @else {
          <span class="material-symbols-outlined text-4xl text-gray-400">add_a_photo</span>
          <p class="text-xs text-gray-500 mt-2 text-center">{{ 'image_uploader.hint' | translate }}</p>
        }
        <input 
          #fileInput 
          type="file" 
          class="hidden" 
          accept="image/*" 
          (change)="onFileSelected($event)"
        />
      </div>
      @if (uploading()) {
        <div class="h-1 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full bg-primary animate-pulse w-full"></div>
        </div>
      }
    </div>
  `,
})
export class ImageUploaderComponent {
  private http = inject(HttpClient);
  private notify = inject(NotificationService);
  private i18n = inject(I18nService);

  folder = input.required<'dishes' | 'restaurant' | 'categories'>();
  currentImage = input<string | null>(null);
  imageUploaded = output<string>();

  previewUrl = signal<string | null>(null);
  uploading = signal(false);

  constructor() {
    // Keep previewUrl in sync with currentImage (handles async load in edit mode)
    effect(() => {
      const img = this.currentImage();
      if (img && !this.uploading()) {
        this.previewUrl.set(img);
      }
    });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => this.previewUrl.set(e.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to backend
    this.uploading.set(true);
    const formData = new FormData();
    formData.append('image', file);

    const endpoint = this.folder() === 'dishes' ? '/uploads/dishes' : 
                     this.folder() === 'categories' ? '/uploads/categories' :
                     '/uploads/restaurant';
    
    this.http.post<{ url: string }>(`${environment.apiUrl}${endpoint}`, formData)
      .subscribe({
        next: (res) => {
          this.imageUploaded.emit(res.url);
          this.uploading.set(false);
        },
        error: () => {
          this.notify.error(this.i18n.translate('image_uploader.error'));
          this.uploading.set(false);
        }
      });
  }
}
