import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Personal</h1>
        <a routerLink="new" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">
          + Nuevo Personal
        </a>
      </div>
      <p class="text-gray-600">Gestión de personal y permisos.</p>
    </div>
  `
})
export class StaffListComponent {}

@Component({
  selector: 'app-staff-form',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">{{ isEdit ? 'Editar' : 'Nuevo' }} Personal</h1>
      <p class="text-gray-600">Formulario de personal en construcción.</p>
      <a routerLink="/admin/staff" class="text-primary hover:underline mt-4 inline-block">← Volver</a>
    </div>
  `
})
export class StaffFormComponent {
  get isEdit() {
    return false; // Simplificado
  }
}