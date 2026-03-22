import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { NotifyService } from '../../services/notify.service';
import { IMenuItem, ICategory } from '../../core/interfaces/menu.interface';

@Injectable()
export class MenuEditorViewModel {
    private http = inject(HttpClient);
    private auth = inject(AuthService);
    private translate = inject(TranslateService);
    private notify = inject(NotifyService);

    // State
    public items = signal<IMenuItem[]>([]);
    public loading = signal<boolean>(true);
    public error = signal<string | null>(null);
    public selectedItem = signal<IMenuItem | null>(null);
    public isEditing = signal<boolean>(false);

    // Computed: Group items by category
    public categories = computed<ICategory[]>(() => {
        const groups = new Map<string, IMenuItem[]>();
        this.items().forEach(item => {
            if (!groups.has(item.category)) {
                groups.set(item.category, []);
            }
            groups.get(item.category)?.push(item);
        });
        return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
    });

    constructor() {
    }

    public resolveImageUrl(image?: string): string {
        if (!image) return '';
        if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:')) {
            return image;
        }
        if (image.startsWith('/')) {
            return `${environment.apiUrl}${image}`;
        }
        return image;
    }

    public async loadMenu() {
        this.loading.set(true);
        this.error.set(null);

        try {
            const data = await firstValueFrom(this.http.get<IMenuItem[]>(`${environment.apiUrl}/api/menu`));
            if (data) this.items.set(data);
        } catch (e: unknown) {
            console.error('Error loading menu', e);
            this.error.set(this.translate.instant('MENU_EDITOR.LOAD_ERROR'));
        } finally {
            this.loading.set(false);
        }
    }

    public selectItem(item: IMenuItem | null) {
        this.selectedItem.set(item ? { ...item } : this.getEmptyItem());
        this.isEditing.set(true);
    }

    private getEmptyItem(): IMenuItem {
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
            await firstValueFrom(this.http.post(`${environment.apiUrl}/api/menu`, payload));

            this.auth.logActivity('MENU_ITEM_UPDATED', { itemName: item.name });
            this.loadMenu();
            this.isEditing.set(false);
            this.notify.successKey('MENU_EDITOR.SAVE_SUCCESS');
        } catch (e) {
            console.error('Error saving item', e);
            this.notify.errorKey('MENU_EDITOR.SAVE_ERROR');
        }
    }

    public async deleteItem(id: string) {
        if (!confirm(this.translate.instant('MENU_EDITOR.DELETE_CONFIRM'))) return;
        try {
            await firstValueFrom(this.http.delete(`${environment.apiUrl}/api/menu/${id}`));
            this.auth.logActivity('MENU_ITEM_DELETED', { itemId: id });
            this.loadMenu();
            this.isEditing.set(false);
            this.selectedItem.set(null);
            this.notify.successKey('MENU_EDITOR.DELETE_SUCCESS');
        } catch (e) {
            console.error('Error deleting item', e);
            this.notify.errorKey('MENU_EDITOR.DELETE_ERROR');
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

    public async uploadImage(file: File): Promise<string | null> {
        try {
            const formData = new FormData();
            formData.append('image', file);
            const res = await firstValueFrom(this.http.post<{url: string}>(`${environment.apiUrl}/api/menu/upload-image`, formData));
            return res.url;
        } catch (e) {
            console.error('Error uploading image', e);
            this.notify.errorKey('MENU_EDITOR.UPLOAD_ERROR');
            return null;
        }
    }
}
