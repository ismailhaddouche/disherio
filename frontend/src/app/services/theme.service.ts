import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SILENT_REQUEST } from '../interceptors/http-context';
import { CommunicationService } from './communication.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);
    private http = inject(HttpClient);
    private currentSlug: string | null = null;
    private configListenerAttached = false;
    public restaurantName: string = '';

    constructor() {
        // Load singleton restaurant config and apply theme
        this.loadAndApplyConfig();
    }

    public setSlug(slug: string) {
        if (this.currentSlug === slug) return;
        this.currentSlug = slug;
        // Legacy shim: keep for API compatibility, but main loader uses singleton endpoint
        this.loadAndApplyConfig();
        if (!this.configListenerAttached) {
            this.configListenerAttached = true;
            this.comms.subscribeToConfig((config: any) => {
                console.log('Applying real-time theme update', config);
                this.applyTheme(config.theme);
                if (config.name) this.restaurantName = config.name;
            });
        }
    }

    private async loadAndApplyConfig() {
        try {
            const ctx = new HttpContext().set(SILENT_REQUEST, true);
            const config = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/api/restaurant`, { context: ctx }));
            if (config?.theme) this.applyTheme(config.theme);
            if (config?.name) this.restaurantName = config.name;
        } catch (e) {
            console.error('Failed to load theme', e);
        }
    }

    private applyTheme(theme: any) {
        if (!theme) return;

        const root = document.documentElement;

        if (theme.primaryColor) {
            root.style.setProperty('--accent-primary', theme.primaryColor);
        }
        if (theme.secondaryColor) {
            root.style.setProperty('--accent-secondary', theme.secondaryColor);
        }
        if (theme.backgroundColor) {
            root.style.setProperty('--bg-dark', theme.backgroundColor);
        }
        if (theme.textColor) {
            root.style.setProperty('--text-base', theme.textColor);
            root.style.setProperty('--text-muted', `${theme.textColor}99`); // 60% opacity

            // Determine if it's a light theme by checking if text is dark
            const textHex = theme.textColor.toLowerCase();
            const isLightTheme = textHex === '#0f172a' || textHex === '#000000' || textHex.startsWith('#1') || textHex.startsWith('#2');

            if (isLightTheme) {
                // Light mode glass cards (White transparent)
                root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.7)');
                root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
                root.style.setProperty('--bg-dark', theme.backgroundColor || '#f8fafc');
            } else {
                // Dark mode glass cards (Dark transparent)
                root.style.setProperty('--glass-bg', 'rgba(24, 24, 27, 0.65)');
                root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
                root.style.setProperty('--bg-dark', theme.backgroundColor || '#09090b');
            }
        }
    }
}
