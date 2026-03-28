// Local types (previously from @disherio/shared)

export interface LocalizedString {
  es: string;
  en: string;
  fr?: string;
  ar?: string;
}

export interface Variant {
  _id: string;
  variant_name: LocalizedString;
  variant_price: number;
  variant_description?: LocalizedString;
  variant_url_image?: string;
}

export interface Extra {
  _id: string;
  extra_name: LocalizedString;
  extra_price: number;
  extra_description?: LocalizedString;
  extra_url_image?: string;
}

export interface Dish {
  _id: string;
  restaurant_id: string;
  category_id: string;
  disher_name: LocalizedString;
  disher_description?: LocalizedString;
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
  disher_status: 'ACTIVATED' | 'DESACTIVATED';
  disher_url_image?: string;
  variants: Variant[];
  extras: Extra[];
}

export interface Category {
  _id: string;
  restaurant_id: string;
  category_name: LocalizedString;
  category_description?: LocalizedString;
  category_order: number;
  category_image_url?: string;
}

export interface CreateDishData {
  restaurant_id: string;
  category_id: string;
  disher_name: LocalizedString;
  disher_description?: LocalizedString;
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
  disher_url_image?: string;
  variants?: Omit<Variant, '_id'>[];
  extras?: Omit<Extra, '_id'>[];
}

export interface UpdateDishData {
  restaurant_id?: string;
  category_id?: string;
  disher_name?: LocalizedString;
  disher_description?: LocalizedString;
  disher_price?: number;
  disher_type?: 'KITCHEN' | 'SERVICE';
  disher_url_image?: string;
  variants?: Omit<Variant, '_id'>[];
  extras?: Omit<Extra, '_id'>[];
}

export interface CreateCategoryData {
  restaurant_id: string;
  category_name: LocalizedString;
  category_description?: LocalizedString;
  category_order?: number;
  category_image_url?: string;
}

export interface UpdateCategoryData {
  restaurant_id?: string;
  category_name?: LocalizedString;
  category_description?: LocalizedString;
  category_order?: number;
  category_image_url?: string;
}

// Frontend-specific extensions can go here
