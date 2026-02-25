import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { CustomerViewComponent } from './components/customer-view/customer-view';
import { CheckoutComponent } from './components/checkout/checkout';
import { KDSComponent } from './components/kds/kds';
import { POSComponent } from './components/pos/pos';
import { LoginComponent } from './components/login/login';
import { MenuEditorComponent } from './components/menu-editor/menu-editor';
import { UserManagementComponent } from './components/user-management/user-management';
import { StoreConfigComponent } from './components/store-config/store-config';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: 'login', component: LoginComponent },

    // Protected Admin Routes
    {
        path: 'admin/dashboard',
        component: DashboardComponent,
        canActivate: [authGuard],
        data: { role: 'admin' }
    },
    {
        path: 'admin/kds',
        component: KDSComponent,
        canActivate: [authGuard],
        data: { role: 'kitchen' }
    },
    {
        path: 'admin/pos',
        component: POSComponent,
        canActivate: [authGuard],
        data: { role: 'pos' }
    },
    {
        path: 'admin/menu',
        component: MenuEditorComponent,
        canActivate: [authGuard],
        data: { role: 'admin' }
    },
    {
        path: 'admin/users',
        component: UserManagementComponent,
        canActivate: [authGuard],
        data: { role: 'admin' }
    },
    {
        path: 'admin/config',
        component: StoreConfigComponent,
        canActivate: [authGuard],
        data: { role: 'admin' }
    },

    // Public Customer Routes
    { path: ':tableNumber', component: CustomerViewComponent },
    { path: ':tableNumber/checkout', component: CheckoutComponent },

    { path: '', redirectTo: 'admin/dashboard', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' }
];
