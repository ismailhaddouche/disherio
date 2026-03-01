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
    public printers = signal<any[]>([]);
    public loading = signal<boolean>(false);
    public error = signal<string | null>(null);

    // Editing State
    public editingUser = signal<any | null>(null);

    constructor() {
        this.loadData();
    }

    private async loadData() {
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

    public openEditModal(user: any) {
        this.editingUser.set({
            ...user,
            password: '', // Empty password field means it won't be updated
            printTemplate: user.printTemplate || {
                header: '',
                footer: 'Gracias por su visita'
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
        } catch (e: any) {
            console.error(e);
            alert('No se pudo actualizar el usuario.');
        }
    }
}
