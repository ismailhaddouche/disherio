import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { I18nService } from '../../core/services/i18n.service';
import { NotificationService } from '../../core/services/notification.service';
import { QrCodeComponent } from '../../shared/components/qr-code.component';
import type { TotemSession } from '../../types';

@Component({
  selector: 'app-tas-qr-modal',
  standalone: true,
  imports: [CommonModule, A11yModule, TranslatePipe, QrCodeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tas-qr-modal.component.html',
  styles: [':host { display: contents; }'],
})
export class TasQrModalComponent {
  protected readonly i18n = inject(I18nService);
  private readonly notify = inject(NotificationService);

  readonly session = input.required<TotemSession>();

  readonly closed = output<void>();

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text);
    this.notify.info(this.i18n.translate('common.copied'));
  }

  getQrUrl(qr: string): string {
    return `${window.location.origin}/menu/${qr}`;
  }
}
