import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TranslateModule } from '@ngx-translate/core';
import { WaiterViewModel } from './waiter.viewmodel';
import { WaiterTableCardComponent } from './waiter-table-card.component';

@Component({
  selector: 'app-waiter-view',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    TranslateModule,
    WaiterTableCardComponent
  ],
  providers: [WaiterViewModel],
  template: `
    <div class="md-page-shell waiter-container animate-fade-in">
      <header class="section-header-md3">
        <div class="header-content">
          <div class="title-with-icon">
            <div class="icon-box-md3 primary">
              <lucide-icon name="hand-platter" [size]="24"></lucide-icon>
            </div>
            <div>
              <h1 class="text-headline-medium">{{ 'WAITER.PANEL' | translate }}</h1>
              <p class="text-body-small opacity-60">{{ 'WAITER.DESC' | translate }}</p>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <div class="stat-chip-md3">
            <span class="text-title-large">{{ vm.occupiedCount() }}</span>
            <span class="text-label-small opacity-60">{{ 'WAITER.ACTIVE_BADGE' | translate }}</span>
          </div>
          <button class="btn-primary" (click)="vm.showAddModal.set(true)">
            <lucide-icon name="plus" [size]="18"></lucide-icon>
            {{ 'WAITER.ADD_VIRTUAL' | translate }}
          </button>
        </div>
      </header>

      <div class="tables-grid">
        @if (vm.loading()) {
          @for (i of [1,2,3,4,5,6,7,8]; track i) {
            <div class="md-card table-card-skeleton">
              <div class="skeleton-icon-circle"></div>
              <div class="skeleton-content">
                <div class="skeleton-bar w40"></div>
                <div class="skeleton-bar w70"></div>
              </div>
            </div>
          }
        } @else {
          @for (totem of vm.enrichedTotems(); track totem.id) {
            <app-waiter-table-card
              [totem]="totem"
              (delete)="vm.deleteTotem($event.event, $event.id)"
              (openQR)="vm.openQR($event.event, $event.id)"
              (onClick)="vm.goToTable($event)">
            </app-waiter-table-card>
          } @empty {
            <div class="empty-state-md3">
              <lucide-icon name="layout-grid" [size]="48" class="opacity-10"></lucide-icon>
              <p class="text-body-large opacity-40">{{ 'WAITER.NO_TABLES' | translate }}</p>
            </div>
          }
        }
      </div>

      <!-- Add Virtual Table Modal -->
      @if (vm.showAddModal()) {
        <div class="md-modal-overlay" (click)="vm.showAddModal.set(false)">
          <div class="md-modal-dialog md-form-panel" (click)="$event.stopPropagation()">
              <header class="md-form-panel-header">
                <div>
                  <h2 class="text-headline-small">{{ 'WAITER.ADD_VIRTUAL' | translate }}</h2>
                  <p class="text-body-small opacity-60">{{ 'WAITER.NEW_VIRTUAL_NAME' | translate }}</p>
                </div>
                <button class="icon-btn-md3" (click)="vm.showAddModal.set(false)">
                  <lucide-icon name="x" [size]="20"></lucide-icon>
                </button>
              </header>

              <div class="md-form-panel-body">
                <div class="form-field-md3">
                    <label class="text-label-large">{{ 'WAITER.NEW_VIRTUAL_NAME' | translate }}</label>
                    <input type="text" #totemName class="md-input" (keyup.enter)="vm.addVirtualTotem(totemName.value)" autofocus>
                </div>
              </div>

              <footer class="md-form-panel-footer">
                  <button class="btn-outline" (click)="vm.showAddModal.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
                  <button class="btn-primary" (click)="vm.addVirtualTotem(totemName.value)">{{ 'COMMON.SAVE' | translate }}</button>
              </footer>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .waiter-container {
      max-width: 1400px;
    }

    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .md-card {
        padding: 20px;
        background: var(--md-sys-color-surface-1);
    }

    /* Skeleton */
    .table-card-skeleton { display: flex; gap: 16px; align-items: center; padding: 24px; opacity: 0.6; }
    .skeleton-icon-circle { width: 48px; height: 48px; border-radius: 50%; background: var(--md-sys-color-surface-variant); }
    .skeleton-content { flex: 1; display: flex; flex-direction: column; gap: 8px; }
    .skeleton-bar { height: 12px; background: var(--md-sys-color-surface-variant); border-radius: 4px; }
    .skeleton-bar.w40 { width: 40%; }
    .skeleton-bar.w70 { width: 70%; }

    .form-field-md3 { display: flex; flex-direction: column; gap: 8px; }

    @media (max-width: 600px) {
        .waiter-container { padding-inline: 16px; }
        .section-header-md3 { align-items: stretch; }
        .stat-chip-md3 { display: none; }
        .tables-grid { grid-template-columns: 1fr; }
    }

    .opacity-60 { opacity: 0.6; }
    .opacity-40 { opacity: 0.4; }
    .opacity-10 { opacity: 0.1; }
  `]
})
export class WaiterViewComponent {
  public vm = inject(WaiterViewModel);
}
