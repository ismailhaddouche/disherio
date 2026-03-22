import { Component, inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KDSViewModel } from './kds.viewmodel';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { KDSOrderCardComponent } from './kds-order-card.component';
import { KDSStockManagerComponent } from './kds-stock-manager.component';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule, KDSOrderCardComponent, KDSStockManagerComponent],
  providers: [KDSViewModel],
  template: `
    <div class="md-page-shell kds-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-content">
          <div class="title-with-icon">
            <div class="icon-box-md3 primary">
                <lucide-icon name="chef-hat" [size]="24"></lucide-icon>
            </div>
            <div>
              <h1 class="text-headline-medium">{{ 'KDS.TITLE' | translate }}</h1>
              <p class="text-body-small opacity-60">{{ 'KDS.SUBTITLE' | translate }}</p>
            </div>
          </div>
        </div>
        
        <div class="header-actions">
          @if (vm.error()) {
            <div class="md-badge-error">
              <lucide-icon name="alert-triangle" [size]="14"></lucide-icon>
              <span>{{ vm.error() }}</span>
            </div>
          }
          
          <button class="btn-tonal" (click)="vm.showStockManager.set(!vm.showStockManager())">
            <lucide-icon name="package" [size]="18"></lucide-icon>
            <span>{{ 'KDS.AVAILABILITY' | translate }}</span>
          </button>

          <div class="stat-chip-md3">
            <span class="text-title-medium">{{ vm.filteredOrders().length }}</span>
            <span class="text-label-small">{{ 'KDS.ORDERS' | translate }}</span>
          </div>
        </div>
      </header>

      <main class="kds-layout">
        @if (vm.loading()) {
            <div class="kds-loader">
                <lucide-icon name="loader-2" [size]="48" class="animate-spin opacity-20"></lucide-icon>
                <p class="text-body-medium opacity-60">{{ 'KDS.SYNCING' | translate }}</p>
            </div>
        } @else {
            <section class="kds-grid">
            @for (order of vm.filteredOrders(); track order._id) {
                <app-kds-order-card [order]="order"></app-kds-order-card>
            } @empty {
                <div class="empty-state-md3">
                  <div class="empty-icon-box">
                    <lucide-icon name="chef-hat" [size]="64"></lucide-icon>
                  </div>
                  <h2 class="text-headline-small">{{ 'KDS.EMPTY_TITLE' | translate }}</h2>
                  <p class="text-body-medium opacity-60">{{ 'KDS.EMPTY_DESC' | translate }}</p>
                </div>
            }
            </section>
        }

        <!-- Stock / Product Availability Manager -->
        @if (vm.showStockManager()) {
          <app-kds-stock-manager></app-kds-stock-manager>
        }
      </main>
    </div>
  `,
  styles: [`
    .kds-container {
      width: 100%;
    }

    .kds-layout {
      position: relative;
      min-height: 400px;
    }

    .kds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 24px;
      align-items: start;
    }

    /* Helper Classes */
    .md-badge-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: var(--md-sys-color-error-container);
      color: var(--md-sys-color-on-error-container);
      border-radius: 100px;
      font-size: 0.85rem;
      font-weight: 800;
    }

    .empty-state-md3 {
      grid-column: 1 / -1;
      text-align: center;
      padding: 120px 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    .empty-icon-box {
      width: 120px; height: 120px;
      border-radius: 50%;
      background: var(--md-sys-color-surface-container-high);
      display: flex; align-items: center; justify-content: center;
      color: var(--md-sys-color-on-surface-variant);
      margin-bottom: 12px;
    }

    .kds-loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 150px;
    }

    .animate-spin { animation: spin 1s linear infinite; }
    .animate-fade-in { animation: fadeIn 0.6s ease-out; }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    @media (max-width: 768px) {
      .kds-grid { grid-template-columns: 1fr; }
    }

    .opacity-60 { opacity: 0.6; }
  `]
})
export class KDSComponent implements OnInit {
  public vm = inject(KDSViewModel);
  public auth = inject(AuthService);
  public theme = inject(ThemeService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    this.vm.initKDS();

    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((e: any) => {
      if (e.url?.includes('/kds')) {
        this.vm.initKDS();
      }
    });
  }
}
