import { Component, input, output, inject, signal, effect, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { I18nService } from '../../../core/services/i18n.service';
import { UploadService, type UploadFolder } from '../../../services/upload.service';

@Component({
  selector: 'app-image-uploader',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2">
      <label class="disher-dropzone">
        @if (previewUrl()) {
          <img [src]="previewUrl()" [alt]="'image_uploader.preview' | translate" class="w-full h-32 object-cover rounded-lg mb-2" />
        } @else {
          <span class="material-symbols-outlined disher-dropzone-icon" aria-hidden="true">add_a_photo</span>
          <p class="disher-dropzone-hint">{{ 'image_uploader.hint' | translate }}</p>
        }
        <input
          type="file"
          class="sr-only"
          accept="image/*"
          (change)="onFileSelected($event)"
          [attr.aria-label]="'image_uploader.hint' | translate"
        />
      </label>
      @if (uploading()) {
        <div class="disher-progress-track">
          <div class="h-full bg-primary animate-pulse w-full"></div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .disher-dropzone {
      border: 2px dashed var(--mat-sys-outline-variant);
      border-radius: var(--disher-shape-lg);
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: border-color var(--disher-transition-fast);
    }
    .disher-dropzone:hover { border-color: var(--mat-sys-primary); }
    .disher-dropzone:focus-within {
      border-color: var(--mat-sys-primary);
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .disher-dropzone-icon {
      font-size: 36px;
      color: var(--mat-sys-on-surface-variant);
    }
    .disher-dropzone-hint {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant);
      margin-top: 8px;
      text-align: center;
    }
    .disher-progress-track {
      height: 4px;
      background: var(--mat-sys-surface-container-high);
      border-radius: var(--disher-shape-full);
      overflow: hidden;
    }
  `],
})
export class ImageUploaderComponent {
  private uploadService = inject(UploadService);
  private notify = inject(NotificationService);
  private i18n = inject(I18nService);

  folder = input.required<UploadFolder>();
  currentImage = input<string | null>(null);
  /** Resource ID for ownership-scoped uploads (dish/category). Omit for restaurant logo. */
  resourceId = input<string | null>(null);
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
    const folder = this.folder();
    const resourceId = this.resourceId();

    this.uploadService.uploadImage(folder, resourceId, file)
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
