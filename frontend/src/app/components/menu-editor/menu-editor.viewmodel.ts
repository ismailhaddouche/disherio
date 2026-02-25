import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { lastValueFrom } from 'rxjs';

export interface MenuItem {
    _id?: string;
    name: string;
    description: string;
    basePrice: number;
    category: string;
    image?: string;
    allergens: string[];
    tags: string[];
    variants: { name: string; price: number }[];
    addons: { name: string; price: number }[];
    available: boolean;
    order: number;
    isMenu: boolean;
    menuSections: { name: string; options: string[]; minChoices: number; maxChoices: number }[];
}

@Injectable()
export class MenuEditorViewModel {
    private http = inject(HttpClient);
    private auth = inject(AuthService);

    // State
    public items = signal<MenuItem[]>([]);
    public loading = signal<boolean>(true);
    public error = signal<string | null>(null); // PM FIX: Added error state
    public selectedItem = signal<MenuItem | null>(null);
    public isEditing = signal<boolean>(false);

    // Computed: Group items by category
    public categories = computed(() => {
        const groups = new Map<string, MenuItem[]>();
        this.items().forEach(item => {
            if (!groups.has(item.category)) {
                groups.set(item.category, []);
            }
            groups.get(item.category)?.push(item);
        });
        return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
    });

    constructor() {
        this.loadMenu();
    }

    public async loadMenu() {
        this.loading.set(true);
        this.error.set(null);

        try {
            const data = await lastValueFrom(this.http.get<MenuItem[]>(`${environment.apiUrl}/api/menu`));
            if (data) this.items.set(data);
        } catch (e: any) {
            console.error('Error loading menu', e);
            this.error.set(e.message || 'Error al cargar los datos del menú.');
        } finally {
            this.loading.set(false);
        }
    }

    public selectItem(item: MenuItem | null) {
        this.selectedItem.set(item ? { ...item } : this.getEmptyItem());
        this.isEditing.set(true);
    }

    private getEmptyItem(): MenuItem {
        return {
            name: '',
            description: '',
            basePrice: 0,
            category: '',
            image: '',
            allergens: [],
            tags: [],
            variants: [],
            addons: [],
            available: true,
            order: 0,
            isMenu: false,
            menuSections: []
        };
    }

    public async saveItem() {
        const item = this.selectedItem();
        if (!item) return;

        try {
            const payload = { ...item };
            await lastValueFrom(this.http.post(`${environment.apiUrl}/api/menu`, payload));

            this.auth.logActivity('MENU_ITEM_UPDATED', { itemName: item.name });
            this.loadMenu();
            this.isEditing.set(false);
        } catch (e) {
            console.error('Error saving item', e);
            alert('No se pudo guardar el plato. Revisa tu conexión.');
        }
    }

    public async deleteItem(id: string) {
        if (!confirm('¿Estás seguro de eliminar este elemento?')) return;
        try {
            await lastValueFrom(this.http.delete(`${environment.apiUrl}/api/menu/${id}`));
            this.auth.logActivity('MENU_ITEM_DELETED', { itemId: id });
            this.loadMenu();
        } catch (e) {
            console.error('Error deleting item', e);
            alert('Error al intentar eliminar el elemento.');
        }
    }

    // Helper methods for list management
    public addVariant() {
        const item = this.selectedItem();
        if (item) {
            item.variants.push({ name: '', price: 0 });
            this.selectedItem.set({ ...item });
        }
    }

    public removeVariant(index: number) {
        const item = this.selectedItem();
        if (item) {
            item.variants.splice(index, 1);
            this.selectedItem.set({ ...item });
        }
    }

    public addAddon() {
        const item = this.selectedItem();
        if (item) {
            item.addons.push({ name: '', price: 0 });
            this.selectedItem.set({ ...item });
        }
    }

    public removeAddon(index: number) {
        const item = this.selectedItem();
        if (item) {
            item.addons.splice(index, 1);
            this.selectedItem.set({ ...item });
        }
    }

    public toggleAllergen(allergen: string) {
        const item = this.selectedItem();
        if (item) {
            const index = item.allergens.indexOf(allergen);
            if (index > -1) item.allergens.splice(index, 1);
            else item.allergens.push(allergen);
            this.selectedItem.set({ ...item });
        }
    }

    public addMenuSection() {
        const item = this.selectedItem();
        if (item) {
            item.menuSections.push({ name: '', options: [''], minChoices: 1, maxChoices: 1 });
            this.selectedItem.set({ ...item });
        }
    }

    public removeMenuSection(index: number) {
        const item = this.selectedItem();
        if (item) {
            item.menuSections.splice(index, 1);
            this.selectedItem.set({ ...item });
        }
    }

    public addMenuOption(sectionIndex: number) {
        const item = this.selectedItem();
        if (item) {
            item.menuSections[sectionIndex].options.push('');
            this.selectedItem.set({ ...item });
        }
    }

    public removeMenuOption(sectionIndex: number, optionIndex: number) {
        const item = this.selectedItem();
        if (item) {
            item.menuSections[sectionIndex].options.splice(optionIndex, 1);
            this.selectedItem.set({ ...item });
        }
    }
}
