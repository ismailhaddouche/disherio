import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineIndicatorComponent } from './components/offline-indicator';
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
export class App implements OnInit {
  private updateService = inject(UpdateService);

  ngOnInit(): void {
    if (this.updateService.isEnabled) {
    }
  }
}
