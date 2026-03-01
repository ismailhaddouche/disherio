import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-waiter-view',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="waiter-container animate-fade-in">
      <header class="view-header">
        <div>
          <h1 class="view-title">
            <lucide-icon name="hand-platter" [size]="28" class="text-muted"></lucide-icon>
            Panel de Camarero
          </h1>
          <p class="view-desc">Selecciona una mesa para tomar comandas.</p>
        </div>
      </header>

      <div class="tables-grid">
        @if (loading()) {
          <div class="loader">Cargando mesas...</div>
        } @else {
          @for (totem of totems(); track totem.id) {
            <div class="table-card glass-card clickable" (click)="goToTable(totem.id)">
              <div class="table-icon">🪑</div>
              <div class="table-id">#{{ totem.id }}</div>
              <div class="table-name">{{ totem.name }}</div>
              <div class="tap-hint">TOCAR PARA PEDIR</div>
            </div>
          } @empty {
            <div class="empty-state">
              <lucide-icon name="alert-triangle" [size]="48" class="opacity-20 mb-4"></lucide-icon>
              <p>No hay mesas configuradas aún.</p>
            </div>
          }
        }
      </div>
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

  goToTable(id: number) {
    this.router.navigate(['/', id]);
  }
}
