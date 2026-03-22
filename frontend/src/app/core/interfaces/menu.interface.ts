export interface IVariant {
  name: string;
  price: number;
  image?: string;
}

export interface IAddon {
  name: string;
  price: number;
}

export interface IMenuSection {
  name: string;
  options: string[];
  minChoices: number;
  maxChoices: number;
}

export interface IMenuItem {
  _id?: string;
  category: string;
  name: string;
  description?: string;
  basePrice: number;
  image?: string;
  allergens: string[];
  tags: string[];
  variants: IVariant[];
  addons: IAddon[];
  available: boolean;
  order: number;
  isMenu: boolean;
  menuSections: IMenuSection[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ICategory {
  name: string;
  items: IMenuItem[];
}
