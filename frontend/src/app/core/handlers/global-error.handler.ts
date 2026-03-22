import { ErrorHandler, Injectable, Injector, NgZone } from '@angular/core';
import { NotifyService } from '../../services/notify.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    constructor(private injector: Injector, private zone: NgZone) {}

    handleError(error: any): void {
        const notify = this.injector.get(NotifyService);
        
        // Log to console for developers
        console.error('Global Error Captured:', error);

        // Don't show system error for expected 401s (auth validation)
        const status = error?.status || error?.rejection?.status;
        if (status === 401) return;

        // Notify user within Angular's zone to ensure UI updates
        this.zone.run(() => {
            const message = error?.message || 'Ocurrió un error inesperado en la aplicación.';
            notify.error(`Error de sistema: ${message}`);
        });
    }
}
