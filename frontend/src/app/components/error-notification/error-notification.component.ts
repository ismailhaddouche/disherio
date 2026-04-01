import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorHandlerService } from '../../services/error-handler.service';
import { AppError } from '../../types/error.types';

interface ErrorNotification {
  id: number;
  message: string;
  details?: string;
  showDetails: boolean;
  timestamp: Date;
}

/**
 * Componente para mostrar notificaciones de error
 * Muestra toast/snackbar con mensajes amigables y opción de ver detalles técnicos
 */
@Component({
  selector: 'app-error-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-[9998] flex flex-col gap-3 max-w-md w-full pointer-events-none">
      @for (error of errors(); track error.id) {
        <div 
          class="pointer-events-auto bg-white dark:bg-gray-800 border-l-4 border-red-500 rounded-lg shadow-xl overflow-hidden animate-slide-up"
          role="alert"
          aria-live="assertive"
        >
          <!-- Header del error -->
          <div class="flex items-start gap-3 p-4">
            <div class="flex-shrink-0">
              <span class="material-symbols-outlined text-red-500 text-2xl">error</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ error.message }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {{ error.timestamp | date:'shortTime' }}
              </p>
            </div>
            <div class="flex items-center gap-1">
              @if (error.details) {
                <button
                  (click)="toggleDetails(error.id)"
                  class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  [attr.aria-expanded]="error.showDetails"
                  [attr.aria-label]="error.showDetails ? 'Ocultar detalles' : 'Ver detalles'"
                >
                  <span class="material-symbols-outlined text-lg">
                    {{ error.showDetails ? 'expand_less' : 'expand_more' }}
                  </span>
                </button>
              }
              <button
                (click)="dismiss(error.id)"
                class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Cerrar notificación"
              >
                <span class="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          <!-- Detalles técnicos (expandible) -->
          @if (error.showDetails && error.details) {
            <div 
              class="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-3"
            >
              <p class="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {{ error.details }}
              </p>
            </div>
          }

          <!-- Barra de progreso de auto-cierre -->
          <div class="h-1 bg-red-100 dark:bg-red-900/30">
            <div 
              class="h-full bg-red-500 animate-progress"
              [style.animation-duration.ms]="AUTO_CLOSE_DURATION"
            ></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slideUp {
      from { 
        transform: translateY(100%); 
        opacity: 0; 
      }
      to { 
        transform: translateY(0); 
        opacity: 1; 
      }
    }

    @keyframes progress {
      from { width: 100%; }
      to { width: 0%; }
    }

    .animate-slide-up {
      animation: slideUp 0.3s ease-out;
    }

    .animate-progress {
      animation: progress linear forwards;
    }
  `],
})
export class ErrorNotificationComponent {
  private readonly errorHandler = inject(ErrorHandlerService);
  
  /** Duración del auto-cierre en ms (5 segundos) */
  readonly AUTO_CLOSE_DURATION = 5000;
  
  private _nextId = 0;
  private _errorMap = signal<Map<number, ErrorNotification>>(new Map());
  
  /** Lista de errores para mostrar */
  readonly errors = computed(() => Array.from(this._errorMap().values()));

  /**
   * Muestra una notificación de error
   */
  showError(message: string, details?: string): void {
    const id = this._nextId++;
    const notification: ErrorNotification = {
      id,
      message,
      details,
      showDetails: false,
      timestamp: new Date(),
    };

    this._errorMap.update(map => {
      const newMap = new Map(map);
      newMap.set(id, notification);
      return newMap;
    });

    // Auto-cerrar después del tiempo configurado
    setTimeout(() => this.dismiss(id), this.AUTO_CLOSE_DURATION);
  }

  /**
   * Muestra un error completo con AppError
   */
  showAppError(error: AppError): void {
    this.showError(error.message, error.details);
  }

  /**
   * Cierra una notificación específica
   */
  dismiss(id: number): void {
    this._errorMap.update(map => {
      const newMap = new Map(map);
      newMap.delete(id);
      return newMap;
    });
  }

  /**
   * Alterna la visibilidad de los detalles técnicos
   */
  toggleDetails(id: number): void {
    this._errorMap.update(map => {
      const newMap = new Map(map);
      const error = newMap.get(id);
      if (error) {
        newMap.set(id, { ...error, showDetails: !error.showDetails });
      }
      return newMap;
    });
  }

  /**
   * Cierra todas las notificaciones
   */
  dismissAll(): void {
    this._errorMap.set(new Map());
  }
}
