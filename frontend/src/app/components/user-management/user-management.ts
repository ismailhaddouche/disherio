import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserManagementViewModel } from './user-management.viewmodel';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, FormsModule, LucideAngularModule],
    providers: [UserManagementViewModel],
    template: `
    <div class="user-management-container animate-fade-in">
      @if (vm.editingUser(); as editUser) {
        <!-- Edit View -->
        <header class="view-header">
          <div>
              <h1 class="view-title">
                  <lucide-icon name="pen-line" [size]="28" class="text-muted"></lucide-icon> 
                  Editando a {{ editUser.username }}
              </h1>
              <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                  <span class="text-muted" style="font-size: 0.9rem;">Rol del sistema:</span>
                  <div class="role-badge" [class]="editUser.role">{{ editUser.role }}</div>
              </div>
          </div>
          <button class="btn-secondary" (click)="vm.closeEditModal()" style="padding: 10px 16px; border-radius: 8px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); color: var(--text-base); border: 1px solid var(--glass-border); cursor: pointer;">
            <lucide-icon name="chevron-left" [size]="18"></lucide-icon> Volver
          </button>
        </header>

        <main class="card-section glass-card" style="max-width: 600px; margin: 0 auto;">
          <h2 class="card-title">Datos de Acceso</h2>
          <div class="form-group">
              <label>Nombre de Usuario</label>
              <input type="text" [(ngModel)]="editUser.username" class="glass-input">
          </div>

          <div class="form-group">
              <label>Nueva Contraseña <small>(Dejar en blanco para no cambiar)</small></label>
              <input type="password" [(ngModel)]="editUser.password" class="glass-input" placeholder="********">
          </div>

          <h2 class="card-title" style="margin-top: 24px;">Configuración de Impresión</h2>

          <div class="form-group">
              <label>Impresora Predeterminada</label>
              <select [(ngModel)]="editUser.printerId" class="glass-input">
                  <option [ngValue]="null">Ninguna (Usar sistema)</option>
                  @for (printer of vm.printers(); track printer.id) {
                      <option [value]="printer.id">{{ printer.name }} ({{ printer.type }})</option>
                  }
              </select>
          </div>

          <div class="form-group">
              <label>Mensaje de Cabecera del Ticket</label>
              <input type="text" [(ngModel)]="editUser.printTemplate.header" class="glass-input" placeholder="Ej: Mesa asignada a Carlos">
          </div>

          <div class="form-group">
              <label>Mensaje de Pie de Ticket</label>
              <input type="text" [(ngModel)]="editUser.printTemplate.footer" class="glass-input" placeholder="Ej: ¡Gracias por su visita!">
          </div>

          <div class="form-actions" style="margin-top: 32px; display: flex; justify-content: flex-end;">
            <button class="btn-primary" (click)="vm.saveUser()">Guardar Cambios</button>
          </div>
        </main>
      } @else {
        <!-- List View -->
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
                    <div class="u-created">
                      @if (user.printerId) {
                          <span>🖨️ Impresora Asignada</span>
                      } @else {
                          <span>Sin impresora asignada</span>
                      }
                    </div>
                    
                    <div class="user-actions">
                      <button class="btn-edit" (click)="vm.openEditModal(user)">
                        <lucide-icon name="pen-line" [size]="14" class="inline-icon"></lucide-icon> Editar
                      </button>
                      @if (user.username !== 'admin') {
                          <button class="btn-del" (click)="vm.deleteUser(user._id)">
                            <lucide-icon name="trash-2" [size]="14" class="inline-icon"></lucide-icon>
                          </button>
                      } @else {
                          <span class="admin-lock"><lucide-icon name="lock" [size]="12" class="inline-icon"></lucide-icon> Sistema</span>
                      }
                    </div>
                </div>
              }
        </div>
      }
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

    .user-actions { display: flex; gap: 8px; margin-top: auto; align-items: center; }

    .btn-edit {
      flex: 1;
      background: rgba(255,255,255,0.05);
      color: var(--text-base);
      border: 1px solid rgba(255,255,255,0.2);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-edit:hover { background: rgba(255,255,255,0.1); }

    .btn-del {
      background: rgba(239, 68, 68, 0.05);
      color: var(--danger); 
      border: 1px solid rgba(239, 68, 68, 0.2);
      padding: 8px 12px; 
      border-radius: 8px; 
      cursor: pointer;
      transition: all 0.2s;
      display: flex; align-items: center; justify-content: center;
    }
    .btn-del:hover { background: var(--danger); color: white; }

    .admin-lock { font-size: 0.8rem; opacity: 0.5; flex: 1; text-align: right; }
    .inline-icon { display: inline-block; vertical-align: text-bottom; }
    .text-muted { color: var(--text-muted); opacity: 0.8; }
  `]
})
export class UserManagementComponent {
    public vm = inject(UserManagementViewModel);
}
