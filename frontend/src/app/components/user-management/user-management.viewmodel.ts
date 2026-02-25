import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class UserManagementViewModel {
    private auth = inject(AuthService);
    private http = inject(HttpClient);

    public users = signal<any[]>([]);
    public loading = signal<boolean>(false);
    public error = signal<string | null>(null);

    constructor() {
        this.loadUsers();
    }

    private async loadUsers() {
        this.loading.set(true);
        this.error.set(null);
        try {
            const users: any = await lastValueFrom(this.http.get(`${environment.apiUrl}/api/users`));
            if (users) this.users.set(users);
        } catch (error: any) {
            console.error('Error loading users', error);
            this.error.set(error.message || 'Error al conectar con el servidor');
        } finally {
            this.loading.set(false);
        }
    }

    public async addUser(username: string, role: string) {
        if (!username || !role) return;

        try {
            const password = '1';

            const payload = { username, role, password };
            const newUser: any = await lastValueFrom(this.http.post(`${environment.apiUrl}/api/users`, payload));

            this.users.update(curr => [...curr, newUser]);
            this.auth.logActivity('USER_ADDED', { username, role });
        } catch (e: any) {
            console.error(e);
            this.error.set('No se pudo crear el usuario.');
        }
    }

    public async deleteUser(userId: string) {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;

        try {
            await lastValueFrom(this.http.delete(`${environment.apiUrl}/api/users/${userId}`));
            this.users.update(curr => curr.filter(u => u._id !== userId));
            this.auth.logActivity('USER_DELETED', { userId });
        } catch (e: any) {
            this.error.set('No se pudo eliminar el usuario.');
        }
    }
}
