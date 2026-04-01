import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ErrorNotificationComponent } from './components/error-notification';
import { OfflineIndicatorComponent } from './components/offline-indicator';
import { UpdateService } from './core/services/update.service';

/**
 * Componente raíz de la aplicación
 * Incluye sistema de notificaciones (toast), manejo de errores y soporte offline
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ToastComponent,
    ErrorNotificationComponent,
    OfflineIndicatorComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private updateService = inject(UpdateService);

  ngOnInit(): void {
    // Inicializar servicio de actualizaciones para detectar nuevas versiones
    if (this.updateService.isEnabled) {
      console.log('Service Worker: Update service initialized');
    }
  }
}
