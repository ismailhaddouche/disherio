import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserManagementViewModel } from './user-management.viewmodel';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, LucideAngularModule],
    providers: [UserManagementViewModel],
    template: `
    <div class="user-management-container animate-fade-in">
      <header class="view-header">
        <div>
            <h1 class="view-title"><lucide-icon name="users" [size]="28" class="text-muted"></lucide-icon> Gestión de Personal</h1>
            <p class="view-desc">Crea y gestiona cuentas con roles específicos (KDS, POS, Admin).</p>
        </div>
        
        <div class="user-add-controls">
            <input type="text" #usernameInput placeholder="Nuevo Usuario (ej: camarero1)" class="glass-input">
            <select #roleInput class="glass-input">
                <option value="waiter">Camarero (Tótems)</option>
                <option value="kitchen">Pantalla Cocina (KDS)</option>
                <option value="pos">Pantalla Caja (POS)</option>
                <option value="admin">Administrador</option>
            </select>
            <button class="btn-primary" (click)="vm.addUser(usernameInput.value, roleInput.value); usernameInput.value=''">
                Crear Usuario
            </button>
        </div>
      </header>
        
      @if (vm.loading()) {
          <p style="opacity:0.5; margin-top:20px; text-align: center;">Cargando usuarios...</p>
      }

      @if (vm.error()) {
          <div class="alert-error glass-card">{{ vm.error() }}</div>
      }
      
      <div class="users-grid">
            @for (user of vm.users(); track user._id) {
              <div class="user-card glass-card">
                  <div class="user-info">
                      <span class="u-name">{{ user.username }}</span>
                      <div class="role-badge" [class]="user.role">{{ user.role }}</div>
                  </div>
                  <div class="u-created">Creado con pin por defecto</div>
                  
                  @if (user.username !== 'admin') {
                      <button class="btn-del" (click)="vm.deleteUser(user._id)">
                        <lucide-icon name="trash-2" [size]="14" class="inline-icon"></lucide-icon> Eliminar
                      </button>
                  } @else {
                      <span class="admin-lock"><lucide-icon name="lock" [size]="12" class="inline-icon"></lucide-icon> Sistema</span>
                  }
              </div>
            }
      </div>
    </div>
  `,
    styles: [`
    .user-management-container {
        padding: 0;
    }

    .user-add-controls { display: flex; gap: 12px; }
    
    .alert-error {
      color: var(--danger);
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid rgba(244, 63, 94, 0.3);
      background: rgba(244, 63, 94, 0.05);
    }

    .users-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    @media (max-width: 768px) {
      .user-add-controls { flex-direction: column; width: 100%; }
      .users-grid { grid-template-columns: 1fr; }
    }

    .user-card {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .user-info { display: flex; justify-content: space-between; align-items: center; }
    .u-name { font-weight: bold; font-size: 1.2rem; color: white; }
    
    .role-badge { 
        font-size: 0.7rem; 
        text-transform: uppercase; 
        padding: 4px 8px; 
        border-radius: 6px; 
        font-weight: bold;
    }
    .role-badge.admin { background: rgba(168, 85, 247, 0.2); color: var(--accent-secondary); }
    .role-badge.kitchen { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .role-badge.pos { background: rgba(99, 102, 241, 0.2); color: var(--accent-primary); }
    .role-badge.waiter { background: rgba(16, 185, 129, 0.2); color: var(--highlight); }

    .u-created { font-size: 0.8rem; opacity: 0.5; font-style: italic; }

    .btn-del {
      background: rgba(239, 68, 68, 0.05);
      color: var(--danger); 
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 8px 12px; 
      border-radius: 8px; 
      font-size: 0.85rem; 
      font-weight: bold;
      cursor: pointer;
      margin-top: auto;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-del:hover { background: var(--danger); color: white; }

    .admin-lock { font-size: 0.8rem; opacity: 0.5; margin-top: auto; display: block; text-align: right; }
    .inline-icon { display: inline-block; vertical-align: text-bottom; }
    .text-muted { color: var(--text-muted); opacity: 0.8; }
  `]
})
export class UserManagementComponent {
    public vm = inject(UserManagementViewModel);
}
