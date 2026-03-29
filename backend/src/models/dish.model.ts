import { Schema, model, Document, Types } from 'mongoose';

const LocalizedStringSchema = {
  es: { type: String, default: '' },
  en: { type: String, default: '' },
  fr: { type: String, default: '' },
  ar: { type: String, default: '' },
};

export interface ICategory extends Document {
  restaurant_id: Types.ObjectId;
  category_name: { es: string; en: string; fr: string; ar: string };
  category_order: number;
  category_description?: { es: string; en: string; fr: string; ar: string };
  category_image_url?: string;
}

const CategorySchema = new Schema<ICategory>(
  {
    restaurant_id: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    category_name: LocalizedStringSchema,
    category_order: { type: Number, default: 0 },
    category_description: LocalizedStringSchema,
    category_image_url: String,
  },
  { timestamps: true }
);

export const Category = model<ICategory>('Category', CategorySchema);

const VariantSubSchema = new Schema(
  {
    variant_name: LocalizedStringSchema,
    variant_description: LocalizedStringSchema,
    variant_url_image: String,
    variant_price: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const ExtraSubSchema = new Schema(
  {
    extra_name: LocalizedStringSchema,
    extra_description: LocalizedStringSchema,
    extra_price: { type: Number, required: true, min: 0 },
    extra_url_image: String,
  },
  { _id: true }
);

export interface IVariant {
  _id: Types.ObjectId;
  variant_name: { es: string; en: string; fr: string; ar: string };
  variant_description?: { es: string; en: string; fr: string; ar: string };
  variant_url_image?: string;
  variant_price: number;
}

export interface IExtra {
  _id: Types.ObjectId;
  extra_name: { es: string; en: string; fr: string; ar: string };
  extra_description?: { es: string; en: string; fr: string; ar: string };
  extra_price: number;
  extra_url_image?: string;
}

export interface IDish extends Document {
  restaurant_id: Types.ObjectId;
  category_id: Types.ObjectId;
  disher_name: { es: string; en: string; fr: string; ar: string };
  disher_description?: { es: string; en: string; fr: string; ar: string };
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
    disher_name: LocalizedStringSchema,
    disher_description: LocalizedStringSchema,
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

export const Dish = model<IDish>('Dish', DishSchema);
