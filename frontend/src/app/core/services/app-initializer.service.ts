import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpContext } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { SILENT_REQUEST } from '../../interceptors/http-context';

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

    // Step 1: Auth — isolated so a 401 never blocks translations
    try {
      await this.auth.verifySession();
      console.log('[INIT] Auth session synchronized.');
    } catch (error) {
      console.warn('[INIT] Auth verification failed (proceeding as guest):', error);
    }

    // Step 2: Restaurant config — isolated so a network blip never blocks translations
    let langToUse = localStorage.getItem('appLang') || 'es';
    try {
      const ctx = new HttpContext().set(SILENT_REQUEST, true);
      const config = await firstValueFrom(
        this.http.get<any>(`${environment.apiUrl}/api/restaurant`, { context: ctx })
      );
      const defaultLang = config?.defaultLanguage || 'es';
      langToUse = localStorage.getItem('appLang') || defaultLang;
      console.log('[INIT] Restaurant config loaded. Language:', langToUse);
    } catch (error) {
      console.warn('[INIT] Restaurant config unavailable (falling back to default lang):', error);
    }

    // Step 3: Translations — always attempted, fallback to es
    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');
    try {
      await firstValueFrom(this.translate.use(langToUse));
      console.log('[INIT] Translations ready:', langToUse);
    } catch (error) {
      console.warn('[INIT] Failed to load language', langToUse, '— retrying with es');
      try {
        await firstValueFrom(this.translate.use('es'));
      } catch (e) {
        console.error('[INIT] Critical: Could not load fallback translations');
      }
    }

    console.log('[INIT] App Core Initialization Complete.');
  }
}
