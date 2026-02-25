import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CommunicationService } from './services/communication.service';
import { AuthService } from './services/auth.service';

import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  public comms = inject(CommunicationService);
  public auth = inject(AuthService);
  public theme = inject(ThemeService); // Init theme service
  protected readonly title = signal('Disher.io');
}
