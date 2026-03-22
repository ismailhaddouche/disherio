import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { NotifyService } from '../../services/notify.service';

@Injectable()
export class UserManagementViewModel {
    private auth = inject(AuthService);
    private http = inject(HttpClient);
    private translate = inject(TranslateService);
    private notify = inject(NotifyService);

    public users = signal<any[]>([]);
    public printers = signal<any[]>([]);
    public loading = signal<boolean>(false);
    public error = signal<string | null>(null);

    // Editing State
    public editingUser = signal<any | null>(null);

    constructor() {
    }

    public async loadData() {
        if (this.loading()) return;
        this.loading.set(true);
        this.error.set(null);
        try {
            const [users, config]: any = await Promise.all([
                lastValueFrom(this.http.get(`${environment.apiUrl}/api/users`)),
                lastValueFrom(this.http.get(`${environment.apiUrl}/api/restaurant`))
            ]);

            if (users) this.users.set(users);
            if (config && config.printers) this.printers.set(config.printers);

        } catch (error: any) {
            console.error('Error loading data', error);
            this.error.set(this.translate.instant('USER_MGMT.LOAD_ERROR'));
            this.notify.errorKey('USER_MGMT.LOAD_ERROR');
        } finally {
            this.loading.set(false);
        }
    }

    private generatePassword(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    public async addUser(username: string, role: string) {
        if (!username || !role) return;

        try {
            const password = this.generatePassword();

            const payload = { username, role, password };
            const newUser: any = await lastValueFrom(this.http.post(`${environment.apiUrl}/api/users`, payload));

            this.users.update(curr => [...curr, newUser]);
            this.auth.logActivity('USER_ADDED', { username, role });
            this.notify.successKey('USER_MGMT.ADD_SUCCESS_PASSWORD', { username, password });
        } catch (e: any) {
            console.error(e);
            this.error.set(this.translate.instant('USER_MGMT.ADD_ERROR'));
            this.notify.errorKey('USER_MGMT.ADD_ERROR');
        }
    }

    public async deleteUser(userId: string) {
        if (!confirm(this.translate.instant('USER_MGMT.DELETE_CONFIRM'))) return;

        try {
            await lastValueFrom(this.http.delete(`${environment.apiUrl}/api/users/${userId}`));
            this.users.update(curr => curr.filter(u => u._id !== userId));
            this.auth.logActivity('USER_DELETED', { userId });
            this.notify.successKey('USER_MGMT.DELETE_SUCCESS');
        } catch (e: any) {
            console.error('Error deleting user', e);
            this.error.set(this.translate.instant('USER_MGMT.DELETE_ERROR'));
            this.notify.errorKey('USER_MGMT.DELETE_ERROR');
        }
    }

    public openEditModal(user: any) {
        this.editingUser.set({
            ...user,
            password: '', // Empty password field means it won't be updated
            printTemplate: user.printTemplate || {
                header: '',
                footer: this.translate.instant('USER_MGMT.DEFAULT_FOOTER')
            }
        });
    }

    public closeEditModal() {
        this.editingUser.set(null);
    }

    public async saveUser() {
        const user = this.editingUser();
        if (!user) return;

        try {
            const payload = { ...user };
            if (!payload.password) {
                delete payload.password;
            }

            const updatedUser: any = await lastValueFrom(this.http.post(`${environment.apiUrl}/api/users`, payload));

            this.users.update(curr => curr.map(u => u._id === updatedUser._id ? updatedUser : u));
            this.auth.logActivity('USER_UPDATED', { username: updatedUser.username });
            this.closeEditModal();
            this.notify.successKey('USER_MGMT.UPDATE_SUCCESS', { username: updatedUser.username });
        } catch (e: any) {
            console.error('Error updating user', e);
            this.notify.errorKey('USER_MGMT.UPDATE_ERROR');
        }
    }
}
