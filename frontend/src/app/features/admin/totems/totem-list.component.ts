import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-totem-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Tótems</h1>
        <a routerLink="new" class="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark">
          + Nuevo Tótem
        </a>
      </div>
      <p class="text-gray-600">Gestión de tótems y códigos QR.</p>
    </div>
  `
})
export class TotemListComponent {}

@Component({
  selector: 'app-totem-form',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">{{ isEdit ? 'Editar' : 'Nuevo' }} Tótem</h1>
      <p class="text-gray-600">Formulario de tótem en construcción.</p>
      <a routerLink="/admin/totems" class="text-primary hover:underline mt-4 inline-block">← Volver</a>
    </div>
  `
})
export class TotemFormComponent {
  get isEdit() {
    return false; // Simplificado
  }
}