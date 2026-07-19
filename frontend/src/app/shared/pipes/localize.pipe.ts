import { Pipe, PipeTransform, inject } from '@angular/core';
import { LocalizationService } from '../../core/services/localization.service';
import type { LocalizedField } from '../../types';

@Pipe({ name: 'localize', standalone: true, pure: false })
export class LocalizePipe implements PipeTransform {
  private localizationService = inject(LocalizationService);

  transform(value: LocalizedField | null | undefined): string {
    return this.localizationService.localize(value);
  }
}