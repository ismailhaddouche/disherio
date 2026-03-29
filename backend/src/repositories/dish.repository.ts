import { Types } from 'mongoose';
import { Dish, IDish, Category, ICategory, Allergen, IAllergen } from '../models/dish.model';
import { BaseRepository, validateObjectId } from './base.repository';
import { CreateDishData, UpdateDishData, CreateCategoryData, UpdateCategoryData } from '@disherio/shared';

export { validateObjectId };

export class DishRepository extends BaseRepository<IDish> {
  constructor() {
    super(Dish);
  }

  async findByRestaurantId(
    restaurantId: string,
    options: { onlyActive?: boolean } = {}
  ): Promise<IDish[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    const filter: Record<string, unknown> = {
      restaurant_id: new Types.ObjectId(restaurantId),
    };
    if (options.onlyActive) {
      filter.disher_status = 'ACTIVATED';
    }
    return this.model
      .find(filter)
      .populate('category_id')
      .populate('disher_alergens')
      .lean()
      .exec();
  }

  async findActiveByRestaurantId(restaurantId: string): Promise<IDish[]> {
    return this.findByRestaurantId(restaurantId, { onlyActive: true });
  }

  async findActiveByRestaurantIdPaginated(
    restaurantId: string,
    skip: number,
    limit: number
  ): Promise<IDish[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({
        restaurant_id: new Types.ObjectId(restaurantId),
        disher_status: 'ACTIVATED',
      })
      .populate('category_id')
      .populate('disher_alergens')
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  async countActiveByRestaurantId(restaurantId: string): Promise<number> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .countDocuments({
        restaurant_id: new Types.ObjectId(restaurantId),
        disher_status: 'ACTIVATED',
      })
      .exec();
  }

  async findByIdWithDetails(id: string): Promise<IDish | null> {
    validateObjectId(id, 'dish_id');
    return this.model
      .findById(id)
      .populate('disher_alergens')
      .lean()
      .exec();
  }

  async findByCategoryId(categoryId: string): Promise<IDish[]> {
    validateObjectId(categoryId, 'category_id');
    return this.model
      .find({
        category_id: new Types.ObjectId(categoryId),
        disher_status: 'ACTIVATED',
      })
      .lean()
      .exec();
  }

  async createDish(data: CreateDishData): Promise<IDish> {
    validateObjectId(data.restaurant_id, 'restaurant_id');
    validateObjectId(data.category_id, 'category_id');
    return this.create({
      ...data,
      restaurant_id: new Types.ObjectId(data.restaurant_id),
      category_id: new Types.ObjectId(data.category_id),
      disher_alergens: (data.disher_alergens ?? []).map(id => new Types.ObjectId(id)),
    } as unknown as Partial<IDish>);
  }

  async updateDish(id: string, data: UpdateDishData): Promise<IDish | null> {
    validateObjectId(id, 'dish_id');
    const { restaurant_id, category_id, disher_alergens, ...rest } = data;
    return this.model.findByIdAndUpdate(
      id,
      {
        ...rest,
        ...(restaurant_id !== undefined && { restaurant_id: new Types.ObjectId(restaurant_id) }),
        ...(category_id !== undefined && { category_id: new Types.ObjectId(category_id) }),
        ...(disher_alergens !== undefined && {
          disher_alergens: disher_alergens.map(id => new Types.ObjectId(id)),
        }),
      } as Partial<IDish>,
      { new: true }
    ).exec();
  }

  async toggleStatus(id: string): Promise<IDish | null> {
    validateObjectId(id, 'dish_id');
    const dish = await this.model.findById(id).exec();
    if (!dish) return null;

    dish.disher_status = dish.disher_status === 'ACTIVATED' ? 'DESACTIVATED' : 'ACTIVATED';
    return dish.save();
  }

  async findByType(
    restaurantId: string,
    type: 'KITCHEN' | 'SERVICE'
  ): Promise<IDish[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({
        restaurant_id: new Types.ObjectId(restaurantId),
        disher_type: type,
        disher_status: 'ACTIVATED',
      })
      .lean()
      .exec();
  }

  async countByCategory(categoryId: string): Promise<number> {
    validateObjectId(categoryId, 'category_id');
    return this.model
      .countDocuments({
        category_id: new Types.ObjectId(categoryId),
      })
      .exec();
  }
}

export class CategoryRepository extends BaseRepository<ICategory> {
  constructor() {
    super(Category);
  }

  async findByRestaurantId(restaurantId: string): Promise<ICategory[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .sort({ category_order: 1 })
      .lean()
      .exec();
  }

  async createCategory(data: CreateCategoryData): Promise<ICategory> {
    validateObjectId(data.restaurant_id, 'restaurant_id');
    return this.create({
      ...data,
      restaurant_id: new Types.ObjectId(data.restaurant_id),
    });
  }

  async updateCategory(id: string, data: UpdateCategoryData): Promise<ICategory | null> {
    validateObjectId(id, 'category_id');
    const { restaurant_id, ...rest } = data;
    return this.model.findByIdAndUpdate(
      id,
      {
        ...rest,
        ...(restaurant_id !== undefined && { restaurant_id: new Types.ObjectId(restaurant_id) }),
      },
      { new: true }
    ).exec();
  }

  async deleteCategory(id: string): Promise<ICategory | null> {
    validateObjectId(id, 'category_id');
    return this.model.findByIdAndDelete(id).exec();
  }

  async getMaxOrder(restaurantId: string): Promise<number> {
    validateObjectId(restaurantId, 'restaurant_id');
    const result = await this.model
      .findOne({ restaurant_id: new Types.ObjectId(restaurantId) })
      .sort({ category_order: -1 })
      .select('category_order')
      .lean()
      .exec();
    return result?.category_order ?? 0;
  }
}

export class AllergenRepository extends BaseRepository<IAllergen> {
  constructor() {
    super(Allergen);
  }

  async findByIds(ids: string[]): Promise<IAllergen[]> {
    const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) return [];
    return this.model
      .find({ _id: { $in: validIds.map((id) => new Types.ObjectId(id)) } })
      .lean()
      .exec();
  }
}
