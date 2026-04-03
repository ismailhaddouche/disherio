// backend/src/schemas/dish.schema.ts
// Re-exportar desde shared para mantener compatibilidad
export {
  CreateDishSchema,
  UpdateDishSchema,
  DishSchema,
  VariantSchema,
  ExtraSchema,
  CategorySchema,
  PriceValidationSchema,
  CreateDishInput,
  UpdateDishInput,
  VariantInput,
  ExtraInput,
} from '@disherio/shared';
