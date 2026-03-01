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
    <div class="user-management-container">
      <div class="glass-card user-section">
        <div class="section-header">
            <div>
                <h3>Gestión de Personal</h3>
                <p class="section-desc">Crea y gestiona cuentas con roles específicos (KDS, POS, Admin).</p>
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
        </div>
        
        @if (vm.loading()) {
            <p style="opacity:0.5; margin-top:20px;">Cargando usuarios...</p>
        }

        @if (vm.error()) {
            <p style="color:red; margin-top:20px;">{{ vm.error() }}</p>
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
                        <button class="btn-del" (click)="vm.deleteUser(user._id)">Eliminar</button>
                    } @else {
                        <span class="admin-lock"><lucide-icon name="lock" [size]="12" class="inline-icon"></lucide-icon> Sistema</span>
                    }
                </div>
             }
        </div>
      </div>
    </div>
  `,
    styles: [`
    .user-management-container {
        padding: 32px;
        animation: fadeIn 0.5s ease-out;
    }

    .user-section { padding: 40px; }
    
    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 32px;
    }

    .section-desc { opacity: 0.6; font-size: 0.9rem; margin-top: 4px; }

    .user-add-controls { display: flex; gap: 12px; }
    
    /* glass-input and btn-primary now defined globally */

    .users-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 24px;
      margin-top: 24px;
    }

    @media (max-width: 768px) {
      .section-header { flex-direction: column; gap: 16px; align-items: stretch; }
      .user-add-controls { flex-direction: column; }
      .users-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 480px) {
      .users-grid { grid-template-columns: 1fr; }
    }

    .user-card {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
    }

    .user-info { display: flex; justify-content: space-between; align-items: center; }
    .u-name { font-weight: bold; font-size: 1.1rem; color: white; }
    
    .role-badge { 
        font-size: 0.7rem; 
        text-transform: uppercase; 
        padding: 4px 8px; 
        border-radius: 6px; 
        font-weight: bold;
    }
    .role-badge.admin { background: rgba(192, 132, 252, 0.2); color: var(--accent-secondary); }
    .role-badge.kitchen { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
    .role-badge.pos { background: rgba(56, 189, 248, 0.2); color: var(--accent-primary); }
    .role-badge.waiter { background: rgba(16, 185, 129, 0.2); color: var(--highlight); }

    .u-created { font-size: 0.75rem; opacity: 0.4; font-style: italic; }

    .btn-del {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; cursor: pointer;
      margin-top: auto;
      transition: all 0.2s;
    }
    .btn-del:hover { background: #ef4444; color: white; }

    .admin-lock { font-size: 0.8rem; opacity: 0.5; margin-top: auto; display: block; text-align: right; }
    .inline-icon { display: inline-block; vertical-align: text-bottom; margin-right: 4px; }

    /* fadeIn now in global styles.css */
  `]
})
export class UserManagementComponent {
    public vm = inject(UserManagementViewModel);
}
