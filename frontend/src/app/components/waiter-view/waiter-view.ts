import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-waiter-view',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule, TranslateModule],
  template: `
    <div class="waiter-container animate-fade-in">
      <header class="view-header">
        <div>
          <h1 class="view-title">
            <lucide-icon name="hand-platter" [size]="28" class="text-muted"></lucide-icon>
            {{ 'WAITER.PANEL' | translate }}
          </h1>
          <p class="view-desc">{{ 'WAITER.DESC' | translate }}</p>
        </div>
        <button class="btn-primary" (click)="showAddModal.set(true)">
          <lucide-icon name="plus-circle" [size]="18" class="mr-2"></lucide-icon>
          {{ 'WAITER.ADD_VIRTUAL' | translate }}
        </button>
      </header>

      <div class="tables-grid">
        @if (loading()) {
          <div class="loader">{{ 'WAITER.LOADING' | translate }}</div>
        } @else {
          @for (totem of totems(); track totem.id) {
            <div class="table-card glass-card clickable" (click)="goToTable(totem.id)">
              <div class="card-header">
                @if (totem.isVirtual) {
                  <span class="type-tag">{{ 'WAITER.VIRTUAL_TAG' | translate }}</span>
                  <button class="btn-delete" (click)="deleteTotem($event, totem.id)">
                    <lucide-icon name="x" [size]="14"></lucide-icon>
                  </button>
                }
              </div>
              <div class="table-icon">🪑</div>
              <div class="table-id">#{{ totem.id }}</div>
              <div class="table-name">{{ totem.name }}</div>
              <div class="tap-hint">{{ 'WAITER.TOUCH_ORDER' | translate }}</div>
            </div>
          } @empty {
            <div class="empty-state">
              <lucide-icon name="alert-triangle" [size]="48" class="opacity-20 mb-4"></lucide-icon>
              <p>{{ 'WAITER.NO_TABLES' | translate }}</p>
            </div>
          }
        }
      </div>

      <!-- Add Modal -->
      @if (showAddModal()) {
        <div class="modal-overlay" (click)="showAddModal.set(false)">
          <div class="modal-content glass-card" (click)="$event.stopPropagation()">
              <h2 class="card-title">{{ 'WAITER.ADD_VIRTUAL' | translate }}</h2>
              <div class="form-group">
                  <label>{{ 'WAITER.NEW_VIRTUAL_NAME' | translate }}</label>
                  <input type="text" #totemName class="glass-input" (keyup.enter)="addVirtualTotem(totemName.value)" autofocus>
              </div>
              <div class="modal-actions">
                  <button class="btn-secondary" (click)="showAddModal.set(false)">{{ 'COMMON.CANCEL' | translate }}</button>
                  <button class="btn-primary" (click)="addVirtualTotem(totemName.value)">{{ 'COMMON.SAVE' | translate }}</button>
              </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .waiter-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .tables-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 20px;
      padding-bottom: 40px;
    }

    .table-card {
      padding: 32px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      cursor: pointer;
      border: 1px solid var(--glass-border);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .table-card:hover {
      background: rgba(255, 255, 255, 0.05);
      transform: translateY(-4px);
      border-color: var(--accent-primary);
      box-shadow: 0 12px 24px -8px rgba(99, 102, 241, 0.4);
    }

    .table-icon {
      font-size: 2rem;
      margin-bottom: 12px;
      opacity: 0.8;
    }

    .table-id {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--accent-primary);
      margin-bottom: 4px;
    }

    .table-name {
      font-weight: 600;
      font-size: 0.9rem;
      opacity: 0.8;
      margin-bottom: 16px;
    }

    .tap-hint {
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      padding: 4px 8px;
      background: rgba(99, 102, 241, 0.1);
      color: var(--accent-primary);
      border-radius: 4px;
    }

    .loader, .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px;
      opacity: 0.5;
    }

    .view-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    /*
     - Los cambios ya están pusheados al repositorio.

    ## Tótems Virtuales para Camareros
    - Se ha implementado la funcionalidad de **Tótems Virtuales**:
      - Los camareros ahora pueden crear "Mesas Temporales" desde su panel.
      - Estos tótems tienen una etiqueta **TEMP** para distinguirlos de los fijos.
      - **Auto-Eliminación**: Cuando se completa el pago total de una comanda asociada a un tótem virtual, este se elimina automáticamente del sistema para mantener el panel limpio.
      - Los camareros pueden eliminar manualmente tótems virtuales, pero no los fijos.
    */
    .card-header {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      display: flex;
      justify-content: space-between;
    }

    .type-tag {
        font-size: 0.6rem;
        background: var(--accent-secondary);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 800;
        letter-spacing: 0.05em;
    }

    .btn-delete {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-delete:hover {
        background: #ef4444;
        color: white;
    }

    .modal-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center;
      z-index: 1000; backdrop-filter: blur(4px);
    }
    
    .modal-content {
      max-width: 400px; width: 90%;
      padding: 32px; display: flex; flex-direction: column; gap: 16px;
    }

    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px; }
    
    .mr-2 { margin-right: 8px; }


    @media (max-width: 480px) {
      .tables-grid {
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
    }
  `]
})
export class WaiterViewComponent {
  private router = inject(Router);
  public totems = signal<any[]>([]);
  public loading = signal(true);
  public showAddModal = signal(false);

  constructor() {
    this.loadTotems();
  }

  async loadTotems() {
    try {
      const res = await fetch(`${environment.apiUrl}/api/totems`);
      const data = await res.json();
      this.totems.set(data || []);
    } catch (e) {
      console.error('Error loading totems', e);
    } finally {
      this.loading.set(false);
    }
  }

  async addVirtualTotem(name: string) {
    if (!name) return;
    try {
      const res = await fetch(`${environment.apiUrl}/api/totems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name, isVirtual: true })
      });
      if (res.ok) {
        this.showAddModal.set(false);
        this.loadTotems();
      }
    } catch (e) {
      console.error('Error adding virtual totem', e);
    }
  }

  async deleteTotem(event: Event, id: number) {
    event.stopPropagation();
    if (!confirm('¿Eliminar esta mesa temporal?')) return;
    try {
      const res = await fetch(`${environment.apiUrl}/api/totems/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        this.loadTotems();
      }
    } catch (e) {
      console.error('Error deleting totem', e);
    }
  }

  goToTable(id: number) {
    this.router.navigate(['/', id]);
  }
}
