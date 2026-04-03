import { Schema, model, Document, Types } from 'mongoose';

// Localized field: array of { lang (ref MenuLanguage), value }
// Uses string for lang (stores the MenuLanguage _id as string)
const LocalizedFieldSchema = [
  {
    lang: { type: String, required: true },
    value: { type: String, default: '' },
    _id: false,
  },
];

export interface ILocalizedEntry {
  lang: string;
  value: string;
}

export interface ICategory extends Document {
  restaurant_id: Types.ObjectId;
  category_name: ILocalizedEntry[];
  category_order: number;
  category_description?: ILocalizedEntry[];
  category_image_url?: string;
}

const CategorySchema = new Schema<ICategory>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    category_name: LocalizedFieldSchema,
    category_order: { type: Number, default: 0 },
    category_description: LocalizedFieldSchema,
    category_image_url: String,
  },
  { timestamps: true }
);

// Index for restaurant category listings with ordering
CategorySchema.index({ restaurant_id: 1, category_order: 1 });

export const Category = model<ICategory>('Category', CategorySchema);

const VariantSubSchema = new Schema(
  {
    variant_name: LocalizedFieldSchema,
    variant_description: LocalizedFieldSchema,
    variant_url_image: String,
    variant_price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const ExtraSubSchema = new Schema(
  {
    extra_name: LocalizedFieldSchema,
    extra_description: LocalizedFieldSchema,
    extra_price: { type: Number, required: true, min: 0 },
    extra_url_image: String,
  },
  { _id: true }
);

export interface IVariant {
  _id: Types.ObjectId;
  variant_name: ILocalizedEntry[];
  variant_description?: ILocalizedEntry[];
  variant_url_image?: string;
  variant_price: number;
}

export interface IExtra {
  _id: Types.ObjectId;
  extra_name: ILocalizedEntry[];
  extra_description?: ILocalizedEntry[];
  extra_price: number;
  extra_url_image?: string;
}

export interface IDish extends Document {
  restaurant_id: Types.ObjectId;
  category_id: Types.ObjectId;
  disher_name: ILocalizedEntry[];
  disher_description?: ILocalizedEntry[];
  disher_url_image?: string;
  disher_status: 'ACTIVATED' | 'DESACTIVATED';
  disher_price: number;
  disher_type: 'KITCHEN' | 'SERVICE';
  disher_alergens: string[];
  disher_variant: boolean;
  variants: IVariant[];
  extras: IExtra[];
}

const DishSchema = new Schema<IDish>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    category_id: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    disher_name: LocalizedFieldSchema,
    disher_description: LocalizedFieldSchema,
    disher_url_image: String,
    disher_status: { type: String, enum: ['ACTIVATED', 'DESACTIVATED'], default: 'ACTIVATED' },
    disher_price: { type: Number, required: true, min: 0 },
    disher_type: { type: String, enum: ['KITCHEN', 'SERVICE'], required: true },
    disher_alergens: [{ type: String }],
    disher_variant: { type: Boolean, default: false },
    variants: [VariantSubSchema],
    extras: [ExtraSubSchema],
  },
  { timestamps: true }
);

// Index for category-based searches with status filter
DishSchema.index({ category_id: 1, disher_status: 1 });

// Index for restaurant dish listings
DishSchema.index({ restaurant_id: 1, disher_status: 1 });

// Text index for dish name search
DishSchema.index({ 'disher_name.value': 'text' });

// Index for dish type filtering (KITCHEN/SERVICE)
DishSchema.index({ disher_type: 1, disher_status: 1 });

export const Dish = model<IDish>('Dish', DishSchema);
