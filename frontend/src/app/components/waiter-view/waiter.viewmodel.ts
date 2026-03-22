import { inject, Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription, firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { CommunicationService } from '../../services/communication.service';
import { NotifyService } from '../../services/notify.service';
import { ITotem } from '../../core/interfaces/restaurant.interface';

export interface TotemWithStatus extends ITotem {
  order?: any; // Active order for this table if any
}

@Injectable()
export class WaiterViewModel implements OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private comms = inject(CommunicationService);
  private translate = inject(TranslateService);
  private notify = inject(NotifyService);
  private router = inject(Router);

  public totems = signal<ITotem[]>([]);
  public orders = signal<any[]>([]);
  public loading = signal(false);
  public showAddModal = signal(false);

  private routerSub?: Subscription;

  private ordersCallback = (updatedOrder: any) => {
    this.orders.update(prev => {
      const idx = prev.findIndex(o => o._id === updatedOrder._id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = updatedOrder;
        return next;
      }
      return [updatedOrder, ...prev];
    });
  };

  private sessionEndCallback = (data: any) => {
    this.orders.update(prev =>
      prev.filter(o => o.sessionId !== data.sessionId && o._id !== data.orderId)
    );
  };

  // Combine totems + live orders into enriched table data
  public enrichedTotems = computed<TotemWithStatus[]>(() => {
    const activeOrders = this.orders().filter(o => o.status === 'active');
    const user = this.auth.currentUser();
    const currentUsername = user?.username;
    const isAdmin = user?.role === 'admin';

    return this.totems()
      .filter(t => {
        // Physical tables are shown to everyone
        if (!t.isVirtual) return true;
        // Admins see all virtual tables
        if (isAdmin) return true;
        // Waiters only see virtual tables they created
        // Note: ITotem doesn't have createdBy, but it was used in original code
        // We'll keep it as any cast or assume ITotem might have it at runtime
        return (t as any).createdBy === currentUsername;
      })
      .map(t => ({
        ...t,
        order: activeOrders.find(o =>
          o.totemId === t.id || String(o.tableNumber) === String(t.id)
        ) || null
      }));
  });

  public occupiedCount = computed(() =>
    this.enrichedTotems().filter(t => !!t.order).length
  );

  constructor() {
    this.init();
  }

  private init() {
    // Load immediately
    this.loadData();

    // Re-load every time we navigate to this route
    this.routerSub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      if (e.url?.includes('/waiter')) {
        this.loadData();
      }
    });

    // Subscribe to real-time order updates
    this.comms.subscribeToOrders(this.ordersCallback);

    // Subscribe to session-ended to remove closed orders from the list
    this.comms.subscribeToSessionEnd(this.sessionEndCallback);
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
    this.comms.unsubscribeFromOrders(this.ordersCallback);
    this.comms.unsubscribeFromSessionEnd(this.sessionEndCallback);
  }

  async loadData() {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      const [totemsRes, ordersRes] = await Promise.all([
        firstValueFrom(this.http.get<ITotem[]>(`${environment.apiUrl}/api/totems`)),
        firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/api/orders`))
      ]);

      this.totems.set(totemsRes || []);
      this.orders.set((ordersRes || []).filter((o: any) => o.status === 'active'));
    } catch (e) {
      console.error('Error loading waiter data', e);
      this.notify.errorKey('WAITER.LOAD_ERROR');
    } finally {
      this.loading.set(false);
    }
  }

  async addVirtualTotem(name: string) {
    const trimmed = name?.trim();
    if (!trimmed) {
      this.notify.warningKey('WAITER.VIRTUAL_NAME_REQUIRED');
      return;
    }
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/api/totems`, {
        name: trimmed,
        isVirtual: true
      }, { withCredentials: true }));

      this.showAddModal.set(false);
      await this.loadData();
      this.notify.successKey('WAITER.ADD_VIRTUAL_SUCCESS', { name: trimmed });
    } catch (e) {
      console.error('Error adding virtual totem', e);
      this.notify.errorKey('WAITER.ADD_VIRTUAL_ERROR');
    }
  }

  async deleteTotem(event: Event, id: number) {
    event.stopPropagation();
    if (!confirm(this.translate.instant('WAITER.DELETE_CONFIRM'))) return;
    try {
      await firstValueFrom(this.http.delete(`${environment.apiUrl}/api/totems/${id}`, {
        withCredentials: true
      }));
      await this.loadData();
      this.notify.successKey('WAITER.DELETE_VIRTUAL_SUCCESS', { id });
    } catch (e) {
      console.error('Error deleting totem', e);
      this.notify.errorKey('WAITER.DELETE_VIRTUAL_ERROR');
    }
  }

  goToTable(id: number) {
    this.router.navigate(['/admin/waiter/table', id]);
  }

  openQR(event: Event, totemId: number) {
    event.stopPropagation();
    const base = window.location.origin;
    window.open(`${base}/api/qr/${totemId}`, '_blank');
  }

  getTimeElapsed(createdAt: string): string {
    if (!createdAt) return '';
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (diff < 60) return `${diff}m`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  }

  isUrgent(createdAt?: string): boolean {
    if (!createdAt) return false;
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000) > 45;
  }
}
