import { Component, signal, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { RouterOutlet, RouterLink, RouterLinkActive, ChildrenOutletContexts } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CommunicationService } from './services/communication.service';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { SidebarComponent } from './components/sidebar/sidebar';
import { trigger, transition, style, query, animate, group } from '@angular/animations';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, SidebarComponent, LucideAngularModule, TranslateModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            opacity: 0,
            transform: 'translateY(10px)'
          })
        ], { optional: true }),
        query(':enter', [
          animate('0.4s cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
        ], { optional: true }),
      ])
    ])
  ]
})
export class App {
  public comms = inject(CommunicationService);
  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  public translate = inject(TranslateService);
  private contexts = inject(ChildrenOutletContexts);

  public sidebarCollapsed = signal(false);

  constructor() {
    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');

    // Attempt to get language from localStorage
    const savedLang = localStorage.getItem('appLang') || 'es';
    this.translate.use(savedLang);
  }

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.['animation'];
  }
}
