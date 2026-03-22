import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

export const responseInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req).pipe(
        map(event => {
            if (event instanceof HttpResponse) {
                const body = event.body;
                if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
                    return event.clone({ body: body.data });
                }
            }
            return event;
        })
    );
};
