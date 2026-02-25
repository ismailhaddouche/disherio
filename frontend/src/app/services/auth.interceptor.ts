import { HttpInterceptorFn } from '@angular/common/http';

// Attaches credentials (httpOnly cookies) to every HttpClient request automatically.
// The browser sends the disher_token cookie without exposing it to JavaScript.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authReq = req.clone({ withCredentials: true });
    return next(authReq);
};
