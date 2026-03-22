import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AppInitializerService {
  private auth = inject(AuthService);
  private http = inject(HttpClient);
  private translate = inject(TranslateService);

  /**
   * Core initialization logic that blocks the app from starting
   * until essential data is loaded. This prevents rendering race conditions.
   */
  public async init(): Promise<void> {
    console.log('[INIT] Starting App Core Initialization...');

    try {
      // 1. Sync authentication with backend (Verify httpOnly cookie)
      await this.auth.verifySession();
      console.log('[INIT] Auth session synchronized.');

      // 2. Load basic restaurant configuration
      const config = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/api/restaurant`));
      const defaultLang = config?.defaultLanguage || 'es';
      console.log('[INIT] Restaurant config loaded. Default language:', defaultLang);

      // 3. Set up translations
      this.translate.addLangs(['es', 'en']);
      this.translate.setDefaultLang('es');
      
      const savedLang = localStorage.getItem('appLang');
      const langToUse = savedLang || defaultLang;
      
      // Pre-fetch the translation file before proceeding
      await firstValueFrom(this.translate.use(langToUse));
      console.log('[INIT] Translations ready:', langToUse);

    } catch (error) {
      console.warn('[INIT] Initialization error (falling back to defaults):', error);
      // Fallback defaults
      this.translate.setDefaultLang('es');
      try {
        await firstValueFrom(this.translate.use('es'));
      } catch (e) {
        console.error('[INIT] Critical: Could not load fallback translations');
      }
    }

    console.log('[INIT] App Core Initialization Complete.');
  }
}
