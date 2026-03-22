import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';
import { NotifyService } from '../services/notify.service';
import { SILENT_REQUEST } from './http-context';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const notify = inject(NotifyService);
    const translate = inject(TranslateService);

    const silentUrls = ['/api/logs', '/api/menu/upload-image'];
    const isSilent = silentUrls.some(url => req.url.includes(url)) || req.context.get(SILENT_REQUEST);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            if (!isSilent) {
                let errorMessage = translate.instant('COMMON.UNEXPECTED_ERROR');

                if (error.error instanceof ErrorEvent) {
                    // Client-side error
                    errorMessage = error.error.message;
                } else {
                    // Server-side error
                    // Our backend now uses { message, status } in standardized error responses
                    errorMessage = error.error?.message || error.message || errorMessage;
                }

                notify.error(errorMessage);
            }
            return throwError(() => error);
        })
    );
};
