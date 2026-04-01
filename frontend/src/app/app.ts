import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ErrorNotificationComponent } from './components/error-notification';

/**
 * Componente raíz de la aplicación
 * Incluye sistema de notificaciones (toast) y manejo de errores
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastComponent, ErrorNotificationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
