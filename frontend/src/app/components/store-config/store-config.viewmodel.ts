import { Injectable, signal, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class StoreConfigViewModel {
    private auth = inject(AuthService);

    public config = signal<any>({
        name: '',
        logo: '',
        domain: '',
        phone: '',
        description: '',
        socials: { instagram: '', facebook: '', twitter: '', website: '' },
        theme: { primaryColor: '#3b82f6', secondaryColor: '#10b981', backgroundColor: '#0f172a', textColor: '#ffffff' },
        billing: {
            vatPercentage: null,
            tipEnabled: false,
            tipPercentage: 0,
            tipDescription: 'La propina es opcional'
        }
    });

    // Local configuration (Device specific, saved in localStorage)
    public localConfig = signal<any>({
        printer: {
            ip: '',
            port: '9100',
            type: 'thermal', // thermal | system
            autoPrint: false,
            paperWidth: '80mm'
        }
    });

    public loading = signal<boolean>(true);
    public saving = signal<boolean>(false);
    public message = signal<string>('');

    constructor() {
        this.loadConfig();
        this.loadLocalConfig();
    }

    private loadLocalConfig() {
        const saved = localStorage.getItem('disher_local_config');
        if (saved) {
            try {
                this.localConfig.set(JSON.parse(saved));
            } catch (e) {
                console.error('Error parsing local config', e);
            }
        }
    }

    private saveLocalConfig() {
        localStorage.setItem('disher_local_config', JSON.stringify(this.localConfig()));
    }

    private async loadConfig() {
        this.loading.set(true);
        try {
            const res = await fetch(`${environment.apiUrl}/api/restaurant`);
            const data = await res.json();

            // Merge with defaults to avoid null checks in template
            this.config.set({
                ...this.config(),
                ...data,
                socials: { ...this.config().socials, ...(data.socials || {}) },
                theme: { ...this.config().theme, ...(data.theme || {}) },
                billing: { ...this.config().billing, ...(data.billing || {}) }
            });

        } catch (e) {
            console.error('Error loading config', e);
        } finally {
            this.loading.set(false);
        }
    }

    public async saveConfig() {
        this.saving.set(true);
        this.message.set('');

        try {
            const res = await fetch(`${environment.apiUrl}/api/restaurant`, {
                method: 'PATCH',
                headers: this.auth.getHeaders(),
                body: JSON.stringify(this.config())
            });

            if (!res.ok) throw new Error('Error saving');

            this.message.set('✅ Configuración guardada correctamente');
            setTimeout(() => this.message.set(''), 3000);

        } catch (e) {
            this.message.set('❌ Error al guardar');
        } finally {
            this.saving.set(false);
        }
    }

    // Helpers for binding nested objects
    updateSocial(platform: string, value: string) {
        const current = this.config();
        this.config.set({
            ...current,
            socials: { ...current.socials, [platform]: value }
        });
    }

    updateTheme(prop: string, value: string) {
        const current = this.config();
        this.config.set({
            ...current,
            theme: { ...current.theme, [prop]: value }
        });
    }

    updateBilling(prop: string, value: any) {
        const current = this.config();
        this.config.set({
            ...current,
            billing: { ...current.billing, [prop]: value }
        });
    }

    updateLocalConfig(section: string, prop: string, value: any) {
        const current = this.localConfig();
        this.localConfig.set({
            ...current,
            [section]: { ...current[section], [prop]: value }
        });
        this.saveLocalConfig();
    }
}
