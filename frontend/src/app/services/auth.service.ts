import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type UserRole = 'admin' | 'kitchen' | 'pos' | 'customer' | 'waiter';

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

    public currentUser = signal<UserSession | null>(this.loadSession());

    private loadSession(): UserSession | null {
        try {
            const saved = localStorage.getItem('disher_session');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    }

    public async login(username: string, password: string): Promise<boolean> {
        try {
            const session = await firstValueFrom(
                this.http.post<UserSession>(`${environment.apiUrl}/api/auth/login`,
                    { username, password },
                    { withCredentials: true })
            );

            if (session) {
                this.currentUser.set(session);
                // Store only non-sensitive session info (username + role) — token is in httpOnly cookie
                localStorage.setItem('disher_session', JSON.stringify(session));
                this.logActivity('LOGIN_SUCCESS', { username });

                const redirect = session.role === 'admin' ? '/admin/dashboard' :
                    session.role === 'kitchen' ? '/admin/kds' :
                        session.role === 'pos' ? '/admin/pos' :
                            session.role === 'waiter' ? '/admin/waiter' : '/';

                this.router.navigate([redirect]);
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('Login error', error);
            return false;
        }
    }

    public async logout() {
        try {
            await firstValueFrom(
                this.http.post(`${environment.apiUrl}/api/auth/logout`, {}, { withCredentials: true })
            );
        } catch (e) {
            console.warn('Logout request failed', e);
        }

        this.logActivity('LOGOUT', { username: this.currentUser()?.username });
        this.currentUser.set(null);
        localStorage.removeItem('disher_session');
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

    public getHeaders() {
        return { 'Content-Type': 'application/json' };
    }

    public getRestaurantSlug(): string {
        return '';
    }
}
