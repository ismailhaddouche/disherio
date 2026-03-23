import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SILENT_REQUEST } from '../interceptors/http-context';
import { environment } from '../../environments/environment';
import { NotifyService } from './notify.service';
import {
    STORAGE_KEYS, AUTH_RETRY, ROLE_REDIRECTS, DEFAULT_REDIRECT
} from '../core/constants';
import type { UserRole } from '../core/constants';

export type { UserRole };

export interface UserSession {
    username: string;
    role: UserRole;
    printerId?: string;
    printTemplate?: {
        header?: string;
        footer?: string;
        showLogo?: boolean;
        showPrices?: boolean;
        fontSize?: string;
    };
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private router = inject(Router);
    private http = inject(HttpClient);
    private notify = inject(NotifyService);

    public currentUser = signal<UserSession | null>(this.loadSession());

    private loadSession(): UserSession | null {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.SESSION);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    }

    private async waitForAuthenticatedBackend(
        maxRetries = AUTH_RETRY.MAX_RETRIES,
        delayMs = AUTH_RETRY.DELAY_MS
    ): Promise<void> {
        const ctx = new HttpContext().set(SILENT_REQUEST, true);
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                await firstValueFrom(this.http.get(`${environment.apiUrl}/api/orders`, { withCredentials: true, context: ctx }));
                return;
            } catch (e) {
                if (attempt === maxRetries - 1) return;
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    public async login(username: string, password: string): Promise<boolean> {
        try {
            const ctx = new HttpContext().set(SILENT_REQUEST, true);
            const session = await firstValueFrom(
                this.http.post<UserSession>(`${environment.apiUrl}/api/auth/login`,
                    { username, password },
                    { withCredentials: true, context: ctx })
            );

            if (session) {
                this.currentUser.set(session);
                // Store only non-sensitive session info (username + role) — token is in httpOnly cookie
                localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
                this.logActivity('LOGIN_SUCCESS', { username });

                // Ensure protected endpoints are reachable before first route render.
                // This avoids intermittent first-load blank states right after login.
                await this.waitForAuthenticatedBackend();

                const redirect = ROLE_REDIRECTS[session.role] ?? DEFAULT_REDIRECT;
                await this.router.navigate([redirect]);
                this.notify.successKey('AUTH.LOGIN_SUCCESS');
                return true;
            }
            this.notify.errorKey('AUTH.LOGIN_INVALID');
            return false;
        } catch (error: any) {
            console.error('Login error', error);
            const msg = error.error?.message || 'AUTH.LOGIN_ERROR';
            this.notify.error(msg);
            return false;
        }
    }

    public async logout() {
        try {
            await firstValueFrom(
                this.http.post(`${environment.apiUrl}/api/auth/logout`, {}, { withCredentials: true })
            );
            this.notify.successKey('AUTH.LOGOUT_SUCCESS');
        } catch (e) {
            console.warn('Logout request failed', e);
            // Even if the server fails, we clear local state
        }

        this.logActivity('LOGOUT', { username: this.currentUser()?.username });
        this.currentUser.set(null);
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        this.router.navigate(['/login']);
    }

    public async logActivity(action: string, details: any = {}) {
        const user = this.currentUser();
        const logData = {
            userId: user?.username || 'anonymous',
            username: user?.username || 'Guest',
            role: user?.role || 'customer',
            action,
            details
        };

        try {
            await firstValueFrom(
                this.http.post(`${environment.apiUrl}/api/logs`, logData, { withCredentials: true })
            );
        } catch (e) {
            // Silently fail logging if backend is unreachable
        }
    }

    public hasRole(role: UserRole): boolean {
        const user = this.currentUser();
        if (!user) return false;
        return user.role === role || user.role === 'admin';
    }

    public isAuthenticated(): boolean {
        return this.currentUser() !== null;
    }

    /**
     * Verifies the session with the backend to ensure the httpOnly cookie is still valid.
     * This is called during app initialization.
     */
    public async verifySession(): Promise<void> {
        try {
            // If we have a local session, verify it. If not, try to fetch current user (SSO/Refresh style)
            const ctx = new HttpContext().set(SILENT_REQUEST, true);
            const session = await firstValueFrom(
                this.http.get<UserSession>(`${environment.apiUrl}/api/auth/me`, { withCredentials: true, context: ctx })
            );
            if (session) {
                this.currentUser.set(session);
                localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
            } else {
                this.clearLocalSession();
            }
        } catch (e) {
            this.clearLocalSession();
        }
    }

    private clearLocalSession() {
        this.currentUser.set(null);
        localStorage.removeItem(STORAGE_KEYS.SESSION);
    }

    public getHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    public getRestaurantSlug(): string {
        return '';
    }
}
