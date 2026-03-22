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
import { NotificationComponent } from './components/notification/notification.component';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, SidebarComponent, NotificationComponent, LucideAngularModule, TranslateModule],
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

  constructor() {}
}
