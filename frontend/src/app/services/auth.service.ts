import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';

import { environment } from '../../environments/environment';

export type UserRole = 'admin' | 'kitchen' | 'pos' | 'customer';

export interface UserSession {
    username: string;
    role: UserRole;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private router = inject(Router);

    public currentUser = signal<UserSession | null>(this.loadSession());

    private loadSession(): UserSession | null {
        const saved = localStorage.getItem('disher_session');
        return saved ? JSON.parse(saved) : null;
    }

    public async login(username: string, password: string): Promise<boolean> {
        try {
            const res = await fetch(`${environment.apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Send and receive httpOnly cookies
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Invalid credentials');
            }

            const session: UserSession = await res.json();

            this.currentUser.set(session);
            // Store only non-sensitive session info (username + role) — token is in httpOnly cookie
            localStorage.setItem('disher_session', JSON.stringify(session));
            this.logActivity('LOGIN_SUCCESS', { username });

            const redirect = session.role === 'admin' ? '/admin/dashboard' :
                session.role === 'kitchen' ? '/admin/kds' :
                    session.role === 'pos' ? '/admin/pos' : '/';

            this.router.navigate([redirect]);
            return true;
        } catch (error: any) {
            console.error('Login error', error);
            return false;
        }
    }

    public async logout() {
        try {
            await fetch(`${environment.apiUrl}/api/auth/logout`, {
                method: 'POST',
                credentials: 'include' // Clears the httpOnly cookie on the server
            });
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
            await fetch(`${environment.apiUrl}/api/logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(logData)
            });
        } catch (e) {
            console.warn('Logging failed', e);
        }
    }

    public hasRole(role: UserRole): boolean {
        return this.currentUser()?.role === role || this.currentUser()?.role === 'admin';
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
