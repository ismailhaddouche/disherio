import { Component, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CommunicationService } from './services/communication.service';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { SidebarComponent } from './components/sidebar/sidebar';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent, LucideAngularModule, TranslateModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  public comms = inject(CommunicationService);
  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  public translate = inject(TranslateService);
  public http = inject(HttpClient);

  public sidebarCollapsed = signal(false);

  constructor() {
    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');

    // Attempt to get language from localStorage or backend config
    const savedLang = localStorage.getItem('appLang');
    if (savedLang) {
      this.translate.use(savedLang);
    } else {
      // Fetch default from backend
      this.http.get<any>(`${environment.apiUrl}/api/restaurant`).subscribe({
        next: (config) => {
          const defaultLang = config.defaultLanguage || 'es';
          this.translate.use(defaultLang);
        },
        error: () => this.translate.use('es')
      });
    }
  }
}
