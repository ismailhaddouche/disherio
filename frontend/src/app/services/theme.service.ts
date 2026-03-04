import { Injectable, inject } from '@angular/core';
import { CommunicationService } from './communication.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ThemeService {
    private comms = inject(CommunicationService);
    private auth = inject(AuthService);
    private currentSlug: string | null = null;
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
        this.comms.subscribeToConfig((config: any) => {
            console.log('Applying real-time theme update', config);
            this.applyTheme(config.theme);
            if (config.name) this.restaurantName = config.name;
        });
    }

    private async loadAndApplyConfig() {
        try {
            const res = await fetch(`${environment.apiUrl}/api/restaurant`);
            const config = await res.json();
            if (config) {
                if (config.theme) this.applyTheme(config.theme);
                if (config.name) this.restaurantName = config.name;
            }
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
            const isLightTheme = theme.textColor === '#0f172a' || theme.textColor === '#000000' || theme.textColor.startsWith('#1');
            
            if (isLightTheme) {
                // Light mode glass cards (White transparent)
                root.style.setProperty('--glass-bg', 'rgba(255, 255, 255, 0.7)');
                root.style.setProperty('--glass-border', 'rgba(0, 0, 0, 0.1)');
            } else {
                // Dark mode glass cards (Dark transparent)
                root.style.setProperty('--glass-bg', 'rgba(24, 24, 27, 0.65)');
                root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
            }
        }
    }
}
