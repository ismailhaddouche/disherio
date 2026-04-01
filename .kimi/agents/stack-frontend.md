---
memory_type: stack_guidelines
scope: angular, typescript, material-ui
tags: [frontend, spa, angular-material, signals]
priority: 110
---

# 🎨 DisherIo Frontend Stack Guidelines

> **Stack:** Angular 21 + Angular Material + TypeScript + Signals  
> **Purpose:** Frontend guidelines specific to DisherIo

---

## 📁 Project Structure

```
frontend/src/
├── app/
│   ├── core/                    # Singleton services, guards, interceptors
│   │   ├── services/
│   │   │   ├── auth.service.ts
│   │   │   ├── api.service.ts       # HTTP client wrapper
│   │   │   └── websocket.service.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── role.guard.ts
│   │   ├── interceptors/
│   │   │   ├── auth.interceptor.ts  # JWT token injection
│   │   │   ├── error.interceptor.ts # Global error handling
│   │   │   └── cache.interceptor.ts
│   │   └── models/              # Domain models
│   │       ├── user.model.ts
│   │       ├── order.model.ts
│   │       └── api-response.model.ts
│   ├── shared/                  # Shared components, pipes, directives
│   │   ├── components/
│   │   │   ├── loading-spinner/
│   │   │   ├── confirm-dialog/
│   │   │   └── error-display/
│   │   ├── pipes/
│   │   │   ├── currency.pipe.ts
│   │   │   └── date-format.pipe.ts
│   │   └── directives/
│   │       └── permission.directive.ts  # CASL permission checks
│   ├── features/                # Feature modules (lazy loaded)
│   │   ├── auth/
│   │   │   ├── components/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── auth.routes.ts
│   │   │   └── auth.service.ts
│   │   ├── dashboard/
│   │   ├── orders/
│   │   ├── menu/
│   │   └── tables/
│   ├── layouts/                 # Layout components
│   │   ├── main-layout/
│   │   │   ├── main-layout.component.ts
│   │   │   ├── header/
│   │   │   ├── sidebar/
│   │   │   └── footer/
│   │   └── auth-layout/
│   └── app.component.ts
├── environments/
│   ├── environment.ts          # Development
│   └── environment.prod.ts     # Production
└── styles/
    ├── _variables.scss         # SCSS variables
    ├── _mixins.scss
    └── themes.scss             # Material theming
```

---

## ⚡ Angular 21 Best Practices

### Standalone Components
```typescript
// ✅ Use standalone components (no NgModules)
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    RouterLink,
    // Component imports instead of module imports
    LoadingSpinnerComponent
  ],
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush  // ✅ Always use OnPush
})
export class OrderListComponent {
  // Component logic
}
```

### Signals for State Management
```typescript
// ✅ Prefer signals over BehaviorSubject for simple state
@Component({...})
export class OrderListComponent {
  // State signals
  orders = signal<Order[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  
  // Computed values
  orderCount = computed(() => this.orders().length);
  hasOrders = computed(() => this.orderCount() > 0);
  
  // Resource signal (Angular 19.1+)
  orderResource = resource({
    loader: () => this.apiService.getOrders()
  });
  
  // Effect for side effects
  constructor() {
    effect(() => {
      // Runs when any signal in this function changes
      console.log('Orders updated:', this.orders());
    });
  }
  
  async loadOrders() {
    this.loading.set(true);
    this.error.set(null);
    
    try {
      const orders = await this.apiService.getOrders();
      this.orders.set(orders);  // Update signal
    } catch (err) {
      this.error.set('Failed to load orders');
    } finally {
      this.loading.set(false);
    }
  }
}
```

### Component Input/Output
```typescript
// ✅ Use input() and output() signals (Angular 16.1+)
@Component({...})
export class OrderCardComponent {
  // Input as signal
  order = input.required<Order>();
  showActions = input<boolean>(true);
  
  // Output as output()
  onEdit = output<Order>();
  onDelete = output<string>();
  
  edit() {
    this.onEdit.emit(this.order());  // Read signal value
  }
}
```

---

## 🎨 Angular Material Patterns

### Theming
```scss
// styles/themes.scss
@use '@angular/material' as mat;

// Define palettes
$primary-palette: mat.define-palette(mat.$indigo-palette);
$accent-palette: mat.define-palette(mat.$pink-palette, A200, A100, A400);
$warn-palette: mat.define-palette(mat.$red-palette);

// Create theme
$theme: mat.define-light-theme((
  color: (
    primary: $primary-palette,
    accent: $accent-palette,
    warn: $warn-palette,
  ),
  typography: mat.define-typography-config(),
  density: 0,
));

// Include core styles
@include mat.core();
@include mat.all-component-themes($theme);
```

### Component Usage
```typescript
// ✅ Use Material components consistently
import { MatTableDataSource } from '@angular/material/table';

@Component({...})
export class OrderListComponent {
  displayedColumns = ['id', 'customer', 'total', 'status', 'actions'];
  dataSource = new MatTableDataSource<Order>();
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }
}
```

```html
<!-- order-list.component.html -->
<div class="order-list">
  <mat-form-field appearance="outline" class="search-field">
    <mat-label>Search orders</mat-label>
    <input matInput (keyup)="applyFilter($event)" placeholder="Customer name...">
    <mat-icon matSuffix>search</mat-icon>
  </mat-form-field>

  <table mat-table [dataSource]="dataSource" matSort>
    <!-- ID Column -->
    <ng-container matColumnDef="id">
      <th mat-header-cell *matHeaderCellDef mat-sort-header> Order # </th>
      <td mat-cell *matCellDef="let order"> {{order.id}} </td>
    </ng-container>

    <!-- Actions Column -->
    <ng-container matColumnDef="actions">
      <th mat-header-cell *matHeaderCellDef> Actions </th>
      <td mat-cell *matCellDef="let order">
        <button mat-icon-button color="primary" (click)="edit(order)">
          <mat-icon>edit</mat-icon>
        </button>
        <button mat-icon-button color="warn" (click)="delete(order)">
          <mat-icon>delete</mat-icon>
        </button>
      </td>
    </ng-container>

    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
    <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
  </table>

  <mat-paginator [pageSizeOptions]="[10, 25, 50]"
                 showFirstLastButtons
                 aria-label="Select page of orders">
  </mat-paginator>
</div>
```

---

## 🛡️ Authorization Integration

### CASL Ability Service
```typescript
// core/services/ability.service.ts
@Injectable({ providedIn: 'root' })
export class AbilityService {
  private ability = signal<AppAbility | null>(null);
  
  setAbility(rules: RawRuleOf<AppAbility>[]) {
    this.ability.set(createMongoAbility(rules));
  }
  
  can(action: Actions, subject: Subjects) {
    return this.ability()?.can(action, subject) ?? false;
  }
  
  cannot(action: Actions, subject: Subjects) {
    return this.ability()?.cannot(action, subject) ?? true;
  }
}
```

### Permission Directive
```typescript
// shared/directives/permission.directive.ts
@Directive({
  selector: '[appPermission]',
  standalone: true
})
export class PermissionDirective {
  action = input.required<Actions>({ alias: 'appPermission' });
  subject = input.required<Subjects>();
  
  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private abilityService: AbilityService
  ) {
    effect(() => {
      if (this.abilityService.can(this.action(), this.subject())) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    });
  }
}
```

### Usage in Templates
```html
<!-- Show button only if user can create orders -->
<button mat-raised-button color="primary" 
        *appPermission="'create'; subject: 'Order'"
        (click)="createOrder()">
  New Order
</button>

<!-- Disable button if user cannot edit -->
<button mat-icon-button 
        [disabled]="!canEdit(order)"
        (click)="edit(order)">
  <mat-icon>edit</mat-icon>
</button>
```

---

## 🧪 Testing Patterns

### Component Test
```typescript
// orders/order-list.component.spec.ts
describe('OrderListComponent', () => {
  let component: OrderListComponent;
  let fixture: ComponentFixture<OrderListComponent>;
  let apiService: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('ApiService', ['getOrders']);
    
    await TestBed.configureTestingModule({
      imports: [OrderListComponent],
      providers: [
        { provide: ApiService, useValue: spy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(OrderListComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(ApiService) as jasmine.SpyObj<ApiService>;
  });

  it('should display orders', async () => {
    // Arrange
    const mockOrders = [{ id: '1', customer: 'John', total: 50 }];
    apiService.getOrders.and.resolveTo(mockOrders);
    
    // Act
    await component.loadOrders();
    fixture.detectChanges();
    
    // Assert
    expect(component.orders()).toEqual(mockOrders);
  });
});
```

---

## 📱 Responsive Design

### Breakpoints
```scss
// styles/_variables.scss
$breakpoints: (
  xs: 0,
  sm: 576px,
  md: 768px,
  lg: 992px,
  xl: 1200px
);

// Usage
.order-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (min-width: 992px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

*Frontend stack guidelines for DisherIo*
