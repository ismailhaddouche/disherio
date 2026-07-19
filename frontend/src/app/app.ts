import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineIndicatorComponent } from './shared/components/offline-indicator';
import { UpdateService } from './core/services/update.service';

/**
 * Root application component with offline support.
 * Toast notifications are handled by MatSnackBar (Material Design 3).
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    OfflineIndicatorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // UpdateService activates on construction (subscribes to versionUpdates and
  // schedules periodic update checks); injecting it here is what wires SW
  // update detection up. Do not remove the injection.
  private updateService = inject(UpdateService);
}
