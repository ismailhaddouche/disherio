import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardViewModel } from './dashboard.viewmodel';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  providers: [DashboardViewModel],
  template: `
    <div class="dashboard-container">
      <!-- Error Display -->
      @if (vm.error()) {
        <div class="error-banner glass-card">
          <div class="error-icon">
            <lucide-icon name="bell" [size]="32" color="#ef4444"></lucide-icon>
          </div>
          <div class="error-content">
            <h4>Ups! Algo salió mal</h4>
            <p>{{ vm.error() }}</p>
          </div>
          <button class="btn-retry" (click)="loadAgain()">
            <lucide-icon name="refresh-cw" [size]="16" class="mr-2"></lucide-icon>
            Reintentar
          </button>
        </div>
      }

      <!-- Stats Header -->
      <div class="stats-grid">
        <div class="glass-card stat-card">
          <lucide-icon name="clock" class="stat-icon primary"></lucide-icon>
          <span class="stat-label">Pedidos Activos</span>
          <h2 class="stat-value gradient-text">{{ vm.activeOrdersCount() }}</h2>
          <div class="stat-glow primary"></div>
        </div>
        
        <div class="glass-card stat-card">
          <lucide-icon name="wallet" class="stat-icon secondary"></lucide-icon>
          <span class="stat-label">Ingresos Hoy</span>
          <h2 class="stat-value gradient-text">{{ vm.dailyRevenue() | currency:'EUR' }}</h2>
          <div class="stat-glow secondary"></div>
        </div>

        <div class="glass-card stat-card">
          <lucide-icon name="layout-dashboard" class="stat-icon success"></lucide-icon>
          <span class="stat-label">Estado del Sistema</span>
          <h2 class="stat-value" [class.text-online]="!vm.error()">
            {{ vm.error() ? 'Error Conexión' : 'Operativo' }}
          </h2>
          <div class="stat-glow success"></div>
        </div>
      </div>

      <!-- Totem Management -->
      <div class="glass-card qr-section">
        <div class="section-header">
            <div>
                <h3>Gestión de Tótems Dinámicos</h3>
                <p class="section-desc">Identificadores incrementales para tus mesas.</p>
            </div>
            <div class="totem-add-controls">
                <input type="text" #totemName placeholder="Nombre (Ej: Terraza 4)" class="glass-input">
                <button class="btn-primary" (click)="vm.addTotem(totemName.value); totemName.value=''">
                    <lucide-icon name="plus" [size]="18" class="mr-2"></lucide-icon>
                    Añadir Nuevo Tótem
                </button>
            </div>
        </div>

        <div class="totem-grid">
            @for (totem of vm.totems(); track totem.id) {
                <div class="totem-card glass-card">
                    <div class="totem-id">#{{ totem.id }}</div>
                    <div class="totem-name">{{ totem.name }}</div>
                    <button class="btn-qr-action" (click)="openQR(totem.id)">
                        Ver QR
                    </button>
                </div>
            } @empty {
                <div class="empty-state">No hay tótems configurados.</div>
            }
        </div>
      </div>

      <!-- Main Content -->
      <div class="dashboard-content">
        <div class="glass-card orders-section">
          <div class="section-header">
            <h3>Pedidos en Tiempo Real</h3>
            <span class="live-indicator">LIVE</span>
          </div>

          @if (vm.loading()) {
            <div class="loader-container">
                <div class="loader-ripple"><div></div><div></div></div>
                <p>Sincronizando órdenes...</p>
            </div>
          } @else {
            <div class="orders-list">
              @for (order of vm.orders(); track order._id) {
                <div class="order-item glass-card" [class.active-border]="order.status === 'active'">
                  <div class="order-info">
                    <span class="table-tag">Tótem #{{ order.totemId }}</span>
                    <span class="order-time">
                        <lucide-icon name="clock" [size]="12" class="inline-icon"></lucide-icon>
                        {{ order.createdAt | date:'HH:mm' }}
                    </span>
                  </div>
                  
                  <div class="order-items">
                    @for (item of order.items; track $index) {
                      <div class="item-row">
                        <span>{{ item.quantity }}x {{ item.name }}</span>
                        <span class="item-status" [class]="item.status">{{ item.status }}</span>
                      </div>
                    }
                  </div>

                  <div class="order-footer">
                    <span class="total">{{ order.totalAmount | currency:'EUR' }}</span>
                    @if (order.status === 'active') {
                      <button class="btn-primary btn-sm" (click)="vm.completeOrder(order._id)">
                        Completar
                      </button>
                    }
                  </div>
                </div>
              } @empty {
                <div class="empty-state">
                  <lucide-icon name="utensils" [size]="48" class="mb-4 opacity-20"></lucide-icon>
                  <p>No hay pedidos registrados hoy.</p>
                </div>
              }
            </div>
          }
        </div>

        <div class="glass-card activity-section">
          <div class="section-header">
            <h3>Registro de Actividad</h3>
            <lucide-icon name="bell" [size]="20" class="text-muted"></lucide-icon>
          </div>

          <div class="log-list">
            @for (log of vm.logs(); track log._id) {
              <div class="log-entry">
                <div class="log-meta">
                  <span class="log-user">{{ log.username }} ({{ log.role }})</span>
                  <span class="log-time">{{ log.timestamp | date:'HH:mm:ss' }}</span>
                </div>
                <div class="log-action">
                  <span class="action-badge" [class]="log.action">{{ log.action }}</span>
                </div>
              </div>
            } @empty {
              <div class="empty-state">No hay actividad registrada.</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 32px;
      animation: fadeIn 0.5s ease-out;
    }

    .mr-2 { margin-right: 8px; }
    .mb-4 { margin-bottom: 16px; }
    .inline-icon { display: inline-block; vertical-align: middle; margin-right: 4px; }

    .totem-add-controls { display: flex; gap: 12px; }

    .totem-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        margin-top: 24px;
    }

    .totem-card {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        position: relative;
    }

    .totem-id {
        font-size: 1.5rem;
        font-weight: 900;
        color: var(--accent-primary);
        margin-bottom: 4px;
    }

    .totem-name {
        font-size: 0.9rem;
        color: var(--text-muted);
        margin-bottom: 16px;
    }

    .btn-qr-action {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        padding: 6px 16px;
        border-radius: 8px;
        font-size: 0.75rem;
        cursor: pointer;
        width: 100%;
        transition: all 0.3s;
    }

    .btn-qr-action:hover {
        background: var(--accent-primary);
        color: var(--bg-dark);
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px;
      border: 1px solid rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.05);
    }

    .error-content h4 { color: #ef4444; margin: 0 0 4px 0; }
    .error-content p { font-size: 0.9rem; opacity: 0.8; margin: 0; }
    .btn-retry {
      margin-left: auto;
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid #ef4444;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 24px;
    }

    .stat-card {
      position: relative;
      padding: 24px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    .stat-icon {
        width: 24px;
        height: 24px;
        margin-bottom: 12px;
        opacity: 0.8;
    }
    .stat-icon.primary { color: var(--accent-primary); }
    .stat-icon.secondary { color: var(--accent-secondary); }
    .stat-icon.success { color: var(--highlight); }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .stat-value {
      font-size: 2.5rem;
      margin: 8px 0 0 0;
    }

    .stat-glow {
      position: absolute;
      bottom: -20px;
      width: 100px;
      height: 40px;
      filter: blur(30px);
      opacity: 0.3;
    }

    .stat-glow.primary { background: var(--accent-primary); }
    .stat-glow.secondary { background: var(--accent-secondary); }
    .stat-glow.success { background: var(--highlight); }

    .text-online { color: var(--highlight); }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .live-indicator {
      background: rgba(34, 197, 94, 0.1);
      color: var(--highlight);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.7rem;
      font-weight: bold;
      border: 1px solid var(--highlight);
      animation: pulse 2s infinite;
    }

    .dashboard-content {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
    }

    @media (max-width: 1024px) {
      .dashboard-content { grid-template-columns: 1fr; }
      .stats-grid { grid-template-columns: 1fr 1fr; }
    }

    .orders-section { padding: 32px; }

    .loader-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        padding: 40px;
        opacity: 0.6;
    }

    .activity-section {
      padding: 32px;
      height: fit-content;
    }

    .log-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
    }

    .log-entry {
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .log-meta {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      margin-bottom: 4px;
    }

    .log-user { font-weight: bold; color: var(--accent-primary); }
    .log-time { color: var(--text-muted); }

    .log-action { display: flex; align-items: center; gap: 8px; }
    .action-badge {
      font-size: 0.65rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
      font-weight: bold;
    }

    .action-badge.LOGIN_SUCCESS { color: var(--highlight); border: 1px solid var(--highlight); }

    .qr-section {
      padding: 32px;
      background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(56, 189, 248, 0.05) 100%);
    }

    .section-desc { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 20px; }

    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .order-item {
      padding: 20px;
      background: rgba(255, 255, 255, 0.03);
    }

    .active-border { border-left: 4px solid var(--accent-primary); }

    .order-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .table-tag { font-weight: bold; color: var(--accent-primary); }
    .order-time { opacity: 0.5; font-size: 0.8rem; display: flex; align-items: center; gap: 4px; }

    .item-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      margin-bottom: 8px;
    }

    .item-status {
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .item-status.pending { background: rgba(255,255,255,0.1); }

    .order-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.05);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .total { font-weight: bold; font-size: 1.1rem; }

    .empty-state {
        text-align: center;
        padding: 40px;
        opacity: 0.5;
    }
  `]
})
export class DashboardComponent {
  public vm = inject(DashboardViewModel);
  private auth = inject(AuthService);

  public openQR(totemId: number) {
    const base = window.location.origin;
    window.open(`${base}/api/qr/${totemId}`, '_blank');
  }

  public loadAgain() {
    location.reload();
  }
}
