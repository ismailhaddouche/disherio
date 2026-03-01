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
        },
        printers: []
    });

    public loading = signal<boolean>(true);
    public saving = signal<boolean>(false);
    public message = signal<string>('');

    public readonly predefinedThemes = [
        { id: 'midnight', name: 'Midnight Indigo', colors: { primaryColor: '#6366f1', secondaryColor: '#a855f7', backgroundColor: '#09090b', textColor: '#f8fafc' } },
        { id: 'crimson', name: 'Crimson Ember', colors: { primaryColor: '#ef4444', secondaryColor: '#f97316', backgroundColor: '#110505', textColor: '#fef2f2' } },
        { id: 'emerald', name: 'Emerald Forest', colors: { primaryColor: '#10b981', secondaryColor: '#14b8a6', backgroundColor: '#022c22', textColor: '#f0fdf4' } },
        { id: 'ocean', name: 'Ocean Breeze', colors: { primaryColor: '#0ea5e9', secondaryColor: '#3b82f6', backgroundColor: '#082f49', textColor: '#f0f9ff' } },
        { id: 'sunset', name: 'Sunset Gold', colors: { primaryColor: '#f59e0b', secondaryColor: '#eab308', backgroundColor: '#2e1005', textColor: '#fffbeb' } },
        { id: 'slate', name: 'Monochrome Slate', colors: { primaryColor: '#94a3b8', secondaryColor: '#64748b', backgroundColor: '#0f172a', textColor: '#f8fafc' } },
        { id: 'light', name: 'Clean Light', colors: { primaryColor: '#2563eb', secondaryColor: '#60a5fa', backgroundColor: '#f8fafc', textColor: '#0f172a' } }
    ];

    public selectPredefinedTheme(themeId: string) {
        const theme = this.predefinedThemes.find(t => t.id === themeId);
        if (theme) {
            const current = this.config();
            this.config.set({
                ...current,
                theme: { ...current.theme, ...theme.colors }
            });
        }
    }

    public isThemeActive(themeId: string): boolean {
        const theme = this.predefinedThemes.find(t => t.id === themeId);
        return theme?.colors.primaryColor === this.config().theme?.primaryColor;
    }

    constructor() {
        this.loadConfig();
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

    addPrinter() {
        const current = this.config();
        const newPrinter = {
            id: 'printer_' + Date.now(),
            name: 'Nueva Impresora',
            type: 'network',
            address: '192.168.1.100',
            connection: '9100'
        };
        this.config.set({
            ...current,
            printers: [...(current.printers || []), newPrinter]
        });
    }

    removePrinter(index: number) {
        const current = this.config();
        const updatedPrinters = [...(current.printers || [])];
        updatedPrinters.splice(index, 1);
        this.config.set({
            ...current,
            printers: updatedPrinters
        });
    }
}
