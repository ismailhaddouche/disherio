import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { POSViewModel } from './pos.viewmodel';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { PosSidebarComponent } from './pos-sidebar.component';
import { PosTicketComponent } from './pos-ticket.component';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule, PosSidebarComponent, PosTicketComponent],
  providers: [POSViewModel],
  template: `
    <div class="md-page-shell pos-container">
      <header class="section-header-md3" style="grid-column: 1 / -1; margin-bottom: 0;">
        <div class="header-content">
          <div class="title-with-icon">
            <div class="icon-box-md3 primary">
              <lucide-icon name="wallet" [size]="24"></lucide-icon>
            </div>
            <div>
              <h1 class="text-headline-medium">{{ 'POS.TITLE' | translate }}</h1>
              <p class="text-body-small opacity-60">{{ 'POS.SUBTITLE' | translate }}</p>
            </div>
          </div>
        </div>
      </header>

      <app-pos-sidebar></app-pos-sidebar>
      <app-pos-ticket></app-pos-ticket>
    </div>
  `,
  styles: [`
    .pos-container {
      width: 100%;
      display: grid;
      grid-template-columns: 360px 1fr;
      grid-template-rows: auto 1fr;
      height: 100vh;
      background: var(--md-sys-color-surface-container-low);
      gap: 1px;
      overflow: hidden;
    }

    .opacity-60 { opacity: 0.6; }

    @media (max-width: 1024px) {
      .pos-container { grid-template-columns: 1fr; }
    }
  `]
})
export class POSComponent {
  public vm = inject(POSViewModel);
}
