import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { kdsStore } from '../../store/kds.store';
import { SocketService } from '../../services/socket/socket.service';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-kds',
  standalone: true,
  imports: [CommonModule, LocalizePipe],
  template: `
    <div class="h-screen bg-gray-900 text-white p-4 overflow-hidden">
      <header class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-3xl">restaurant</span>
          <h1 class="text-2xl font-bold">Cocina</h1>
        </div>
        <span class="text-sm text-gray-400">{{ ordered().length + onPrepare().length }} pendientes</span>
      </header>

      <div class="grid grid-cols-2 gap-4 h-[calc(100%-80px)] overflow-auto">
        <!-- ORDERED -->
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-yellow-400 flex items-center gap-1">
            <span class="material-symbols-outlined">pending</span> Nuevos ({{ ordered().length }})
          </h2>
          @for (item of ordered(); track item._id) {
            <div class="bg-gray-800 rounded-lg p-3 border-l-4 border-yellow-400">
              <p class="font-semibold text-base">{{ item.item_name_snapshot | localize }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ item.createdAt | date:'HH:mm:ss' }}</p>
              <button
                (click)="prepareItem(item._id)"
                class="mt-2 w-full bg-yellow-500 text-black rounded py-2 font-bold active:scale-95 transition-transform flex items-center justify-center gap-1"
              >
                <span class="material-symbols-outlined text-sm">check_circle</span> Preparar
              </button>
            </div>
          }
        </div>

        <!-- ON_PREPARE -->
        <div class="flex flex-col gap-2">
          <h2 class="text-lg font-semibold text-green-400 flex items-center gap-1">
            <span class="material-symbols-outlined">cooking</span> En preparación ({{ onPrepare().length }})
          </h2>
          @for (item of onPrepare(); track item._id) {
            <div class="bg-gray-800 rounded-lg p-3 border-l-4 border-green-400">
              <p class="font-semibold text-base">{{ item.item_name_snapshot | localize }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ item.createdAt | date:'HH:mm:ss' }}</p>
              <button
                (click)="serveItem(item._id)"
                class="mt-2 w-full bg-green-500 text-black rounded py-2 font-bold active:scale-95 transition-transform flex items-center justify-center gap-1"
              >
                <span class="material-symbols-outlined text-sm">done_all</span> Servido
              </button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class KdsComponent implements OnInit, OnDestroy {
  private socketService = inject(SocketService);
  private http = inject(HttpClient);

  ordered = kdsStore.ordered;
  onPrepare = kdsStore.onPrepare;

  ngOnInit() {
    this.socketService.connect();
    // BUG-12: was only listening to WS — existing items were invisible on page load
    this.http.get<any[]>(`${environment.apiUrl}/orders/kitchen`).subscribe({
      next: (items) => kdsStore.setItems(items),
      error: () => { /* already connected, silently skip if token expired */ },
    });
  }

  ngOnDestroy() {
    this.socketService.disconnect();
  }

  prepareItem(itemId: string) {
    this.socketService.emit('kds:item_prepare', { itemId });
  }

  serveItem(itemId: string) {
    this.socketService.emit('kds:item_serve', { itemId });
  }
}
