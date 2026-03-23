import { ErrorHandler, Injectable, Injector, NgZone } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { NotifyService } from '../../services/notify.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    constructor(private injector: Injector, private zone: NgZone) {}

    handleError(error: any): void {
        // HttpErrorResponse errors are already handled by errorInterceptor — skip to avoid double toast
        if (error instanceof HttpErrorResponse || error?.rejection instanceof HttpErrorResponse) return;

        // Log to console for developers
        console.error('Global Error Captured:', error);

        // Don't show system error for expected 401s (auth validation)
        const status = error?.status || error?.rejection?.status;
        if (status === 401) return;

        // Notify user within Angular's zone to ensure UI updates
        this.zone.run(() => {
            const translate = this.injector.get(TranslateService);
            const notify = this.injector.get(NotifyService);
            const message = translate.instant('COMMON.UNEXPECTED_ERROR');
            notify.error(message);
        });
    }
}
