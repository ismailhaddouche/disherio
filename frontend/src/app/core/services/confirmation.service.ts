import { Component, Injectable, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { map, Observable, take } from 'rxjs';
import { I18nService } from './i18n.service';

export interface ConfirmationOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmationDialogData extends Required<ConfirmationOptions> {
  message: string;
  title: string;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18nService);

  confirm(message: string, options: ConfirmationOptions = {}): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      autoFocus: 'dialog',
      restoreFocus: true,
      width: 'min(420px, calc(100vw - 32px))',
      data: {
        message,
        title: this.i18n.translate('common.confirm'),
        confirmLabel: options.confirmLabel ?? this.i18n.translate('common.confirm'),
        cancelLabel: options.cancelLabel ?? this.i18n.translate('common.cancel'),
        destructive: options.destructive ?? false,
      } satisfies ConfirmationDialogData,
    });

    return dialogRef.afterClosed().pipe(map(result => result === true), take(1));
  }
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="m-0 text-on-surface">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" (click)="close(false)">{{ data.cancelLabel }}</button>
      <button
        matButton
        type="button"
        [class.text-error]="data.destructive"
        (click)="close(true)"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ConfirmationDialogComponent {
  protected readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmationDialogComponent>);

  protected close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}
