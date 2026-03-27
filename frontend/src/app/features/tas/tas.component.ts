import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TasService } from '../../services/tas.service';
import { SocketService } from '../../services/socket/socket.service';
import { tasStore, TotemSession, ItemOrder, Customer } from '../../store/tas.store';
import { LocalizePipe } from '../../shared/pipes/localize.pipe';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { authStore } from '../../store/auth.store';

@Component({
  selector: 'app-tas',
  standalone: true,
  imports: [CommonModule, FormsModule, LocalizePipe, CurrencyFormatPipe],
  template: `
    <div class="h-screen flex bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
      <!-- LEFT PANEL: Sessions & Totems -->
      <aside class="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <!-- Header -->
        <header class="p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-2xl text-primary">room_service</span>
            <h1 class="text-lg font-bold">Servicio de Mesa</h1>
          </div>
          
          <!-- New Temporary Totem -->
          <div class="flex gap-2">
            <input
              [(ngModel)]="newTotemName"
              placeholder="Nueva mesa temporal..."
              class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              (keyup.enter)="createTemporaryTotem()"
            />
            <button
              (click)="createTemporaryTotem()"
              [disabled]="!newTotemName().trim() || isCreatingTotem()"
              class="px-3 py-2 bg-primary text-white rounded-lg disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-sm">add</span>
            </button>
          </div>
        </header>

        <!-- Active Sessions -->
        <div class="flex-1 overflow-auto p-3">
          <h2 class="text-xs font-semibold text-gray-500 uppercase mb-2">Sesiones Activas</h2>
          
          @if (activeSessions().length === 0) {
            <p class="text-sm text-gray-400 text-center py-4">No hay sesiones activas</p>
          }
          
          @for (session of activeSessions(); track session._id) {
            <div
              (click)="selectSession(session)"
              class="p-3 rounded-lg border cursor-pointer transition-colors mb-2"
              [class.bg-primary-50]="selectedSession()?._id === session._id"
              [class.border-primary]="selectedSession()?._id === session._id"
              [class.bg-white]="selectedSession()?._id !== session._id"
              [class.dark:bg-gray-700]="selectedSession()?._id !== session._id"
              [class.border-gray-200]="selectedSession()?._id !== session._id"
              [class.dark:border-gray-600]="selectedSession()?._id !== session._id"
            >
              <div class="flex items-center justify-between">
                <span class="font-medium">{{ session.totem?.totem_name || 'Mesa' }}</span>
                <span 
                  class="text-xs px-2 py-1 rounded-full"
                  [class.bg-yellow-100]="session.totem?.totem_type === 'TEMPORARY'"
                  [class.text-yellow-800]="session.totem?.totem_type === 'TEMPORARY'"
                  [class.bg-gray-100]="session.totem?.totem_type === 'STANDARD'"
                  [class.text-gray-800]="session.totem?.totem_type === 'STANDARD'"
                >
                  {{ session.totem?.totem_type === 'TEMPORARY' ? 'Temp' : 'Std' }}
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-1">
                {{ getSessionItemCount(session._id) }} items • {{ getSessionTotal(session._id) | currencyFormat }}
              </p>
            </div>
          }
        </div>

        <!-- Available Totems (no active session) -->
        <div class="p-3 border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-auto">
          <h2 class="text-xs font-semibold text-gray-500 uppercase mb-2">Mesas Disponibles</h2>
          
          @for (totem of availableTotems(); track totem._id) {
            <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700 mb-1">
              <span class="text-sm">{{ totem.totem_name }}</span>
              <button
                (click)="startSession(totem._id)"
                class="text-xs px-2 py-1 bg-green-500 text-white rounded"
              >
                Abrir
              </button>
            </div>
          }
          
          @if (availableTotems().length === 0) {
            <p class="text-xs text-gray-400 text-center">Todas las mesas están ocupadas</p>
          }
        </div>
      </aside>

      <!-- CENTER PANEL: Session Details -->
      <main class="flex-1 flex flex-col min-w-0">
        @if (selectedSession(); as session) {
          <!-- Session Header -->
          <header class="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-xl font-bold">{{ session.totem?.totem_name }}</h2>
                <p class="text-sm text-gray-500">
                  Inicio: {{ session.session_date_start | date:'shortTime' }}
                </p>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <p class="text-2xl font-bold text-primary">{{ sessionTotal() | currencyFormat }}</p>
                  <p class="text-xs text-gray-500">{{ sessionItems().length }} items</p>
                </div>
                @if (session.totem?.totem_type === 'TEMPORARY') {
                  <button
                    (click)="closeTemporaryTotem(session.totem_id)"
                    class="p-2 bg-red-500 text-white rounded-lg"
                    title="Cerrar mesa temporal"
                  >
                    <span class="material-symbols-outlined">delete</span>
                  </button>
                }
              </div>
            </div>

            <!-- Customers Tabs -->
            <div class="flex items-center gap-2 mt-3 overflow-x-auto">
              <button
                (click)="selectedCustomerId.set(null)"
                class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors"
                [class.bg-primary]="selectedCustomerId() === null"
                [class.text-white]="selectedCustomerId() === null"
                [class.bg-gray-200]="selectedCustomerId() !== null"
                [class.dark:bg-gray-700]="selectedCustomerId() !== null"
              >
                Todos
              </button>
              
              @for (customer of customers(); track customer._id) {
                <button
                  (click)="selectedCustomerId.set(customer._id)"
                  class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-1"
                  [class.bg-primary]="selectedCustomerId() === customer._id"
                  [class.text-white]="selectedCustomerId() === customer._id"
                  [class.bg-gray-200]="selectedCustomerId() !== customer._id"
                  [class.dark:bg-gray-700]="selectedCustomerId() !== customer._id"
                >
                  {{ customer.customer_name }}
                  <span 
                    class="text-xs px-1.5 rounded-full"
                    [class.bg-white]="selectedCustomerId() === customer._id"
                    [class.bg-gray-300]="selectedCustomerId() !== customer._id"
                    [class.text-primary]="selectedCustomerId() === customer._id"
                  >
                    {{ getCustomerItemCount(customer._id) }}
                  </span>
                </button>
              }
              
              <button
                (click)="showAddCustomer.set(true)"
                class="px-3 py-1.5 rounded-full text-sm bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              >
                + Cliente
              </button>
            </div>

            <!-- Add Customer Input -->
            @if (showAddCustomer()) {
              <div class="flex gap-2 mt-2">
                <input
                  [(ngModel)]="newCustomerName"
                  placeholder="Nombre del cliente..."
                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg"
                  (keyup.enter)="addCustomer()"
                />
                <button
                  (click)="addCustomer()"
                  class="px-3 py-2 bg-green-500 text-white rounded-lg"
                >
                  Añadir
                </button>
                <button
                  (click)="showAddCustomer.set(false)"
                  class="px-3 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            }
          </header>

          <!-- Items List -->
          <div class="flex-1 overflow-auto p-4">
            <!-- Kitchen Items Section -->
            @if (kitchenItems().length > 0) {
              <div class="mb-6">
                <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <span class="material-symbols-outlined text-base">restaurant</span>
                  Cocina
                </h3>
                
                @for (item of filteredItems(); track item._id) {
                  @if (item.item_disher_type === 'KITCHEN') {
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 border-l-4"
                         [class.border-yellow-400]="item.item_state === 'ORDERED'"
                         [class.border-blue-400]="item.item_state === 'ON_PREPARE'"
                         [class.border-green-400]="item.item_state === 'SERVED'"
                    >
                      <div class="flex items-start justify-between">
                        <div class="flex-1">
                          <p class="font-medium">{{ item.item_name_snapshot | localize }}</p>
                          @if (item.item_disher_variant) {
                            <p class="text-sm text-gray-500">
                              {{ item.item_disher_variant.name | localize }} 
                              (+{{ item.item_disher_variant.price | currencyFormat }})
                            </p>
                          }
                          @if (item.item_disher_extras.length > 0) {
                            <p class="text-xs text-gray-400">
                              @for (extra of item.item_disher_extras; track extra.extra_id) {
                                <span>{{ extra.name | localize }}</span>
                                @if (!$last) { + }
                              }
                            </p>
                          }
                          <div class="flex items-center gap-2 mt-2">
                            <span 
                              class="text-xs px-2 py-1 rounded-full"
                              [class.bg-yellow-100]="item.item_state === 'ORDERED'"
                              [class.text-yellow-800]="item.item_state === 'ORDERED'"
                              [class.bg-blue-100]="item.item_state === 'ON_PREPARE'"
                              [class.text-blue-800]="item.item_state === 'ON_PREPARE'"
                              [class.bg-green-100]="item.item_state === 'SERVED'"
                              [class.text-green-800]="item.item_state === 'SERVED'"
                            >
                              {{ getStateLabel(item.item_state) }}
                            </span>
                            
                            <!-- Customer Assignment -->
                            <select
                              [(ngModel)]="item.customer_id"
                              (change)="assignItemToCustomer(item._id, $any($event.target).value || null)"
                              class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            >
                              <option value="">Sin asignar</option>
                              @for (customer of customers(); track customer._id) {
                                <option [value]="customer._id">{{ customer.customer_name }}</option>
                              }
                            </select>
                          </div>
                        </div>
                        
                        <div class="flex flex-col items-end gap-2">
                          <span class="font-bold">{{ getItemTotal(item) | currencyFormat }}</span>
                          
                          @if (item.item_state === 'ORDERED') {
                            <button
                              (click)="deleteItem(item._id)"
                              class="text-red-500 hover:text-red-700"
                              title="Eliminar item"
                            >
                              <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  }
                }
              </div>
            }

            <!-- Service Items Section (No Kitchen) -->
            @if (serviceItemsSession().length > 0) {
              <div class="mb-6">
                <h3 class="text-sm font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <span class="material-symbols-outlined text-base">local_bar</span>
                  Barra / Servicio
                </h3>
                
                @for (item of serviceItemsSession(); track item._id) {
                  <div class="bg-white dark:bg-gray-800 rounded-lg p-3 mb-2 border-l-4"
                       [class.border-yellow-400]="item.item_state === 'ORDERED'"
                       [class.border-green-400]="item.item_state === 'SERVED'"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1">
                        <p class="font-medium">{{ item.item_name_snapshot | localize }}</p>
                        @if (item.item_disher_variant) {
                          <p class="text-sm text-gray-500">
                            {{ item.item_disher_variant.name | localize }}
                          </p>
                        }
                        <div class="flex items-center gap-2 mt-2">
                          <span 
                            class="text-xs px-2 py-1 rounded-full"
                            [class.bg-yellow-100]="item.item_state === 'ORDERED'"
                            [class.text-yellow-800]="item.item_state === 'ORDERED'"
                            [class.bg-green-100]="item.item_state === 'SERVED'"
                            [class.text-green-800]="item.item_state === 'SERVED'"
                          >
                            {{ getStateLabel(item.item_state) }}
                          </span>
                          
                          <select
                            [(ngModel)]="item.customer_id"
                            (change)="assignItemToCustomer(item._id, $any($event.target).value || null)"
                            class="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                          >
                            <option value="">Sin asignar</option>
                            @for (customer of customers(); track customer._id) {
                              <option [value]="customer._id">{{ customer.customer_name }}</option>
                            }
                          </select>
                        </div>
                      </div>
                      
                      <div class="flex flex-col items-end gap-2">
                        <span class="font-bold">{{ getItemTotal(item) | currencyFormat }}</span>
                        
                        <div class="flex gap-1">
                          @if (item.item_state === 'ORDERED') {
                            <button
                              (click)="markServiceItemServed(item._id)"
                              class="text-xs px-2 py-1 bg-green-500 text-white rounded"
                            >
                              Servido
                            </button>
                            <button
                              (click)="deleteItem(item._id)"
                              class="text-red-500 hover:text-red-700"
                              title="Eliminar item"
                            >
                              <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }

            @if (filteredItems().length === 0) {
              <div class="text-center py-8 text-gray-400">
                <span class="material-symbols-outlined text-4xl mb-2">restaurant_menu</span>
                <p>No hay items en esta sesión</p>
              </div>
            }
          </div>

          <!-- Add Item Button -->
          <div class="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <button
              (click)="showMenu.set(true)"
              class="w-full py-3 bg-primary text-white rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <span class="material-symbols-outlined">add_circle</span>
              Añadir Pedido
            </button>
          </div>
        } @else {
          <!-- No Session Selected -->
          <div class="flex-1 flex flex-col items-center justify-center text-gray-400">
            <span class="material-symbols-outlined text-6xl mb-4">table_restaurant</span>
            <p class="text-lg">Selecciona una mesa para ver los pedidos</p>
          </div>
        }
      </main>

      <!-- RIGHT PANEL: Menu (when adding items) -->
      @if (showMenu()) {
        <aside class="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col">
          <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 class="text-lg font-bold">Añadir Pedido</h2>
            <button (click)="showMenu.set(false)" class="text-gray-500 hover:text-gray-700">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Categories -->
          <div class="flex gap-2 overflow-x-auto p-3 border-b border-gray-200 dark:border-gray-700">
            <button
              (click)="selectedCategory.set(null)"
              class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap"
              [class.bg-primary]="selectedCategory() === null"
              [class.text-white]="selectedCategory() === null"
              [class.bg-gray-200]="selectedCategory() !== null"
              [class.dark:bg-gray-700]="selectedCategory() !== null"
            >
              Todos
            </button>
            @for (cat of categories(); track cat._id) {
              <button
                (click)="selectedCategory.set(cat._id)"
                class="px-3 py-1.5 rounded-full text-sm whitespace-nowrap"
                [class.bg-primary]="selectedCategory() === cat._id"
                [class.text-white]="selectedCategory() === cat._id"
                [class.bg-gray-200]="selectedCategory() !== cat._id"
                [class.dark:bg-gray-700]="selectedCategory() !== cat._id"
              >
                {{ cat.category_name | localize }}
              </button>
            }
          </div>

          <!-- Dishes Grid -->
          <div class="flex-1 overflow-auto p-3 grid grid-cols-2 gap-3">
            @for (dish of filteredDishes(); track dish._id) {
              <div
                (click)="selectDish(dish)"
                class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                @if (dish.disher_url_image) {
                  <img [src]="dish.disher_url_image" class="w-full h-24 object-cover rounded-lg mb-2" />
                } @else {
                  <div class="w-full h-24 bg-gray-200 dark:bg-gray-600 rounded-lg mb-2 flex items-center justify-center">
                    <span class="material-symbols-outlined text-3xl text-gray-400">restaurant</span>
                  </div>
                }
                <p class="font-medium text-sm line-clamp-2">{{ dish.disher_name | localize }}</p>
                <p class="text-primary font-bold text-sm mt-1">{{ dish.disher_price | currencyFormat }}</p>
                <span 
                  class="text-xs px-1.5 py-0.5 rounded mt-1 inline-block"
                  [class.bg-orange-100]="dish.disher_type === 'KITCHEN'"
                  [class.text-orange-800]="dish.disher_type === 'KITCHEN'"
                  [class.bg-blue-100]="dish.disher_type === 'SERVICE'"
                  [class.text-blue-800]="dish.disher_type === 'SERVICE'"
                >
                  {{ dish.disher_type === 'KITCHEN' ? 'Cocina' : 'Barra' }}
                </span>
              </div>
            }
          </div>
        </aside>
      }

      <!-- Dish Detail Modal (for variants/extras) -->
      @if (selectedDish(); as dish) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 class="text-lg font-bold">{{ dish.disher_name | localize }}</h3>
              <button (click)="selectedDish.set(null)" class="text-gray-500">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div class="p-4">
              <!-- Variants -->
              @if (dish.variants.length > 0) {
                <div class="mb-4">
                  <h4 class="text-sm font-semibold mb-2">Variante</h4>
                  @for (variant of dish.variants; track variant._id) {
                    <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-1 cursor-pointer">
                      <input
                        type="radio"
                        name="variant"
                        [value]="variant._id"
                        [(ngModel)]="selectedVariantId"
                        class="w-4 h-4"
                      />
                      <span class="flex-1">{{ variant.variant_name | localize }}</span>
                      <span class="text-sm text-gray-500">+{{ variant.variant_price | currencyFormat }}</span>
                    </label>
                  }
                </div>
              }

              <!-- Extras -->
              @if (dish.extras.length > 0) {
                <div class="mb-4">
                  <h4 class="text-sm font-semibold mb-2">Extras</h4>
                  @for (extra of dish.extras; track extra._id) {
                    <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-700 mb-1 cursor-pointer">
                      <input
                        type="checkbox"
                        [value]="extra._id"
                        (change)="toggleExtra(extra._id)"
                        class="w-4 h-4"
                      />
                      <span class="flex-1">{{ extra.extra_name | localize }}</span>
                      <span class="text-sm text-gray-500">+{{ extra.extra_price | currencyFormat }}</span>
                    </label>
                  }
                </div>
              }

              <!-- Assign to Customer -->
              @if (customers().length > 0) {
                <div class="mb-4">
                  <h4 class="text-sm font-semibold mb-2">Asignar a</h4>
                  <select
                    [(ngModel)]="assignToCustomerId"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  >
                    <option [value]="null">Sin asignar</option>
                    @for (customer of customers(); track customer._id) {
                      <option [value]="customer._id">{{ customer.customer_name }}</option>
                    }
                  </select>
                </div>
              }

              <!-- Total -->
              <div class="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
                <span class="font-semibold">Total:</span>
                <span class="text-xl font-bold text-primary">{{ calculateDishTotal(dish) | currencyFormat }}</span>
              </div>

              <!-- Add Button -->
              <button
                (click)="addItemToOrder(dish)"
                [disabled]="isAddingItem()"
                class="w-full py-3 bg-green-500 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {{ isAddingItem() ? 'Añadiendo...' : 'Añadir al Pedido' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Loading Overlay -->
      @if (isLoading()) {
        <div class="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-center gap-3">
            <span class="material-symbols-outlined animate-spin">refresh</span>
            <span>Cargando...</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class TasComponent implements OnInit, OnDestroy {
  private tasService = inject(TasService);
  private socketService = inject(SocketService);

  // Local state signals
  newTotemName = signal('');
  isCreatingTotem = signal(false);
  showAddCustomer = signal(false);
  newCustomerName = signal('');
  showMenu = signal(false);
  selectedCategory = signal<string | null>(null);
  selectedDish = signal<any>(null);
  selectedVariantId = signal<string | null>(null);
  selectedExtras = signal<string[]>([]);
  assignToCustomerId = signal<string | null>(null);
  selectedCustomerId = signal<string | null>(null);
  isAddingItem = signal(false);
  allTotems = signal<Array<{ _id: string; totem_name: string; totem_type: string }>>([]);

  // Store signals
  sessions = tasStore.sessions;
  selectedSession = tasStore.selectedSession;
  sessionItems = tasStore.sessionItems;
  customers = tasStore.customers;
  dishes = tasStore.dishes;
  categories = tasStore.categories;
  isLoading = tasStore.isLoading;

  // Computed
  activeSessions = computed(() => 
    this.sessions().filter(s => s.totem_state === 'STARTED')
  );

  availableTotems = computed(() => {
    const activeTotemIds = new Set(this.sessions().map(s => s.totem_id));
    return this.allTotems().filter(t => !activeTotemIds.has(t._id));
  });

  kitchenItems = computed(() => 
    this.sessionItems().filter(i => i.item_disher_type === 'KITCHEN')
  );

  serviceItemsSession = computed(() => 
    this.sessionItems().filter(i => i.item_disher_type === 'SERVICE')
  );

  sessionTotal = computed(() => 
    this.sessionItems()
      .filter(i => i.item_state !== 'CANCELED')
      .reduce((total, item) => total + this.getItemTotal(item), 0)
  );

  filteredDishes = computed(() => {
    const cat = this.selectedCategory();
    const all = this.dishes();
    if (!cat) return all;
    return all.filter(d => (d as any).category_id === cat);
  });

  filteredItems = computed(() => {
    const customerId = this.selectedCustomerId();
    const items = this.sessionItems().filter(i => i.item_state !== 'CANCELED');
    if (customerId === null) return items;
    return items.filter(i => i.customer_id === customerId);
  });

  ngOnInit() {
    this.loadData();
    this.setupSocketListeners();
  }

  ngOnDestroy() {
    this.socketService.disconnect();
  }

  private loadData() {
    tasStore.setLoading(true);
    
    // Load active sessions
    this.tasService.getActiveSessions().subscribe({
      next: (sessions) => {
        tasStore.setSessions(sessions);
        tasStore.setLoading(false);
      },
      error: () => tasStore.setLoading(false),
    });

    // Load all totems
    this.tasService.getTotems().subscribe({
      next: (totems) => this.allTotems.set(totems),
    });

    // Load dishes
    this.tasService.getDishes().subscribe({
      next: ({ dishes, categories }) => {
        tasStore.setDishes(dishes, categories);
      },
    });

    // Connect socket
    this.socketService.connect();
  }

  private setupSocketListeners() {
    // Listen for new items
    this.socketService.on('kds:new_item', (item: ItemOrder) => {
      if (item.session_id === this.selectedSession()?._id) {
        tasStore.addItem(item);
      }
    });

    // Listen for state changes
    this.socketService.on('item:state_changed', ({ itemId, newState }: { itemId: string; newState: ItemOrder['item_state'] }) => {
      tasStore.updateItemState(itemId, newState);
    });

    // Listen for deleted items
    this.socketService.on('item:deleted', ({ itemId }: { itemId: string }) => {
      tasStore.removeItem(itemId);
    });

    // Listen for customer assignments
    this.socketService.on('item:customer_assigned', ({ itemId, customerId }: { itemId: string; customerId: string | null }) => {
      tasStore.assignItemToCustomer(itemId, customerId);
    });
  }

  selectSession(session: TotemSession) {
    tasStore.selectSession(session);
    
    // Load session items
    this.tasService.getSessionItems(session._id).subscribe({
      next: (items) => tasStore.setSessionItems(items),
    });

    // Load customers for this session
    this.tasService.getCustomers(session._id).subscribe({
      next: (customers) => tasStore.setCustomers(customers),
    });

    // Join socket room
    this.socketService.joinSession(session._id);
  }

  createTemporaryTotem() {
    const name = this.newTotemName().trim();
    if (!name) return;

    this.isCreatingTotem.set(true);
    this.tasService.createTotem({
      totem_name: name,
      totem_type: 'TEMPORARY',
    }).subscribe({
      next: (totem) => {
        this.allTotems.update(current => [...current, { ...totem, totem_type: 'TEMPORARY' }]);
        this.newTotemName.set('');
        this.isCreatingTotem.set(false);
        
        // Auto-start session
        this.startSession(totem._id);
      },
      error: () => this.isCreatingTotem.set(false),
    });
  }

  startSession(totemId: string) {
    this.tasService.startSession(totemId).subscribe({
      next: (session) => {
        tasStore.setSessions([...this.sessions(), session]);
        this.selectSession(session);
      },
    });
  }

  closeTemporaryTotem(totemId: string) {
    if (!confirm('¿Cerrar esta mesa temporal? Se marcará la sesión como completada.')) return;

    this.tasService.deleteTotem(totemId).subscribe({
      next: () => {
        // Remove from sessions if active
        tasStore.setSessions(this.sessions().filter(s => s.totem_id !== totemId));
        this.allTotems.update(current => current.filter(t => t._id !== totemId));
        
        if (this.selectedSession()?.totem_id === totemId) {
          tasStore.selectSession(null);
        }
      },
    });
  }

  addCustomer() {
    const name = this.newCustomerName().trim();
    if (!name || !this.selectedSession()) return;

    this.tasService.createCustomer(this.selectedSession()!._id, name).subscribe({
      next: (customer) => {
        tasStore.addCustomer(customer);
        this.newCustomerName.set('');
        this.showAddCustomer.set(false);
      },
    });
  }

  selectDish(dish: any) {
    this.selectedDish.set(dish);
    this.selectedVariantId.set(null);
    this.selectedExtras.set([]);
    this.assignToCustomerId.set(null);
  }

  toggleExtra(extraId: string) {
    this.selectedExtras.update(current => {
      if (current.includes(extraId)) {
        return current.filter(id => id !== extraId);
      }
      return [...current, extraId];
    });
  }

  calculateDishTotal(dish: any): number {
    let total = dish.disher_price;
    
    const variant = dish.variants.find((v: any) => v._id === this.selectedVariantId());
    if (variant) {
      total += variant.variant_price;
    }

    this.selectedExtras().forEach(extraId => {
      const extra = dish.extras.find((e: any) => e._id === extraId);
      if (extra) {
        total += extra.extra_price;
      }
    });

    return total;
  }

  addItemToOrder(dish: any) {
    const session = this.selectedSession();
    if (!session) return;

    this.isAddingItem.set(true);

    // Find or create order for this session
    const existingOrder = this.sessionItems()[0];
    let orderId = existingOrder?.order_id;

    const createItem = () => {
      this.tasService.addItem({
        order_id: orderId,
        session_id: session._id,
        dish_id: dish._id,
        customer_id: this.assignToCustomerId() || undefined,
        variant_id: this.selectedVariantId() || undefined,
        extras: this.selectedExtras(),
      }).subscribe({
        next: (item) => {
          tasStore.addItem(item);
          this.isAddingItem.set(false);
          this.selectedDish.set(null);
          this.showMenu.set(false);
        },
        error: () => this.isAddingItem.set(false),
      });
    };

    if (orderId) {
      createItem();
    } else {
      // Create order first
      this.tasService.createOrder({ session_id: session._id }).subscribe({
        next: (order) => {
          orderId = order._id;
          createItem();
        },
        error: () => this.isAddingItem.set(false),
      });
    }
  }

  deleteItem(itemId: string) {
    if (!confirm('¿Eliminar este item?')) return;

    this.tasService.deleteItem(itemId).subscribe({
      next: () => tasStore.removeItem(itemId),
    });
  }

  markServiceItemServed(itemId: string) {
    this.tasService.updateItemState(itemId, 'SERVED').subscribe({
      next: () => tasStore.updateItemState(itemId, 'SERVED'),
    });
  }

  assignItemToCustomer(itemId: string, customerId: string | null) {
    this.tasService.assignItemToCustomer(itemId, customerId).subscribe({
      next: () => tasStore.assignItemToCustomer(itemId, customerId),
    });
  }

  getItemTotal(item: ItemOrder): number {
    const variantPrice = item.item_disher_variant?.price || 0;
    const extrasPrice = item.item_disher_extras.reduce((sum, e) => sum + e.price, 0);
    return item.item_base_price + variantPrice + extrasPrice;
  }

  getStateLabel(state: ItemOrder['item_state']): string {
    const labels: Record<string, string> = {
      ORDERED: 'Pedido',
      ON_PREPARE: 'En preparación',
      SERVED: 'Servido',
      CANCELED: 'Cancelado',
    };
    return labels[state] || state;
  }

  getSessionItemCount(sessionId: string): number {
    // This would need to be fetched from backend or calculated from store
    return 0;
  }

  getSessionTotal(sessionId: string): number {
    // This would need to be fetched from backend or calculated from store
    return 0;
  }

  getCustomerItemCount(customerId: string): number {
    return this.sessionItems().filter(i => i.customer_id === customerId && i.item_state !== 'CANCELED').length;
  }
}
