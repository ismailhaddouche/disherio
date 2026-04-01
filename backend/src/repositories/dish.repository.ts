import { Types, PipelineStage } from 'mongoose';
import { Dish, IDish, Category, ICategory } from '../models/dish.model';
import { BaseRepository, validateObjectId } from './base.repository';
import { CreateDishData, UpdateDishData, CreateCategoryData, UpdateCategoryData } from '@disherio/shared';
import { QueryProfiler } from '../utils/query-profiler';

export { validateObjectId };

export interface DishWithCategory extends IDish {
  category?: ICategory;
}

export interface DishStats {
  dishId: Types.ObjectId;
  dishName: string;
  totalOrdered: number;
  totalRevenue: number;
  categoryId?: Types.ObjectId;
  categoryName?: string;
}

export interface CategoryStats {
  categoryId: Types.ObjectId;
  categoryName: string;
  dishCount: number;
  totalRevenue: number;
  averagePrice: number;
}

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
      disher_alergens: data.disher_alergens ?? [],
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
          disher_alergens: disher_alergens,
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

  /**
   * Get dishes with their categories using aggregation.
   * More efficient than populate for large datasets.
   */
  async getDishesWithCategories(
    restaurantId: string,
    options?: { 
      onlyActive?: boolean; 
      limit?: number; 
      skip?: number;
      sortBy?: 'name' | 'price' | 'createdAt';
    }
  ): Promise<DishWithCategory[]> {
    validateObjectId(restaurantId, 'restaurant_id');

    const { 
      onlyActive = true, 
      limit = 100, 
      skip = 0,
      sortBy = 'name' 
    } = options ?? {};

    const matchStage: Record<string, unknown> = {
      restaurant_id: new Types.ObjectId(restaurantId),
    };
    if (onlyActive) {
      matchStage.disher_status = 'ACTIVATED';
    }

    const sortField = sortBy === 'price' ? 'disher_price' : 
                      sortBy === 'createdAt' ? 'createdAt' : 'disher_name.value';

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $sort: { [sortField]: 1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'DishRepository.getDishesWithCategories',
      { explain: false }
    );
  }

  /**
   * Search dishes by name using text index.
   */
  async searchDishes(
    restaurantId: string,
    searchTerm: string,
    options?: { limit?: number; onlyActive?: boolean }
  ): Promise<IDish[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    
    const { limit = 20, onlyActive = true } = options ?? {};

    const matchStage: Record<string, unknown> = {
      restaurant_id: new Types.ObjectId(restaurantId),
      $text: { $search: searchTerm },
    };
    
    if (onlyActive) {
      matchStage.disher_status = 'ACTIVATED';
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      { $addFields: { score: { $meta: 'textScore' } } },
      { $sort: { score: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'DishRepository.searchDishes',
      { explain: false }
    );
  }

  /**
   * Get dish statistics with aggregation pipeline.
   * Combines dish data with order statistics.
   */
  async getDishStats(
    restaurantId: string,
    options?: { dateRange?: { from?: Date; to?: Date }; limit?: number }
  ): Promise<DishStats[]> {
    validateObjectId(restaurantId, 'restaurant_id');

    const { dateRange, limit = 10 } = options ?? {};

    // First, get all dishes for this restaurant
    const dishes = await this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .select('_id disher_name category_id')
      .lean()
      .exec();

    if (dishes.length === 0) return [];

    const dishIds = dishes.map(d => d._id.toString());

    const pipeline: PipelineStage[] = [
      {
        $match: {
          item_dish_id: { $in: dishIds.map(id => new Types.ObjectId(id)) },
          item_state: { $ne: 'CANCELED' },
          ...(dateRange?.from && { createdAt: { $gte: dateRange.from } }),
          ...(dateRange?.to && { createdAt: { $lte: dateRange.to } }),
        },
      },
      {
        $group: {
          _id: '$item_dish_id',
          totalOrdered: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $add: [
                '$item_base_price',
                { $ifNull: ['$item_disher_variant.price', 0] },
                { $sum: '$item_disher_extras.price' },
              ],
            },
          },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit },
    ];

    const stats = await QueryProfiler.profileAggregation(
      this.model.db.model('ItemOrder'),
      pipeline,
      'DishRepository.getDishStats',
      { explain: false }
    );

    // Map back to dish details
    return stats.map(stat => {
      const dish = dishes.find(d => d._id.equals(stat._id));
      return {
        dishId: stat._id,
        dishName: dish?.disher_name?.[0]?.value ?? 'Unknown',
        totalOrdered: stat.totalOrdered,
        totalRevenue: Math.round(stat.totalRevenue * 100) / 100,
        categoryId: dish?.category_id,
      };
    });
  }

  /**
   * Get aggregated stats by category.
   */
  async getCategoryStats(restaurantId: string): Promise<CategoryStats[]> {
    validateObjectId(restaurantId, 'restaurant_id');

    const pipeline: PipelineStage[] = [
      {
        $match: {
          restaurant_id: new Types.ObjectId(restaurantId),
          disher_status: 'ACTIVATED',
        },
      },
      {
        $group: {
          _id: '$category_id',
          dishCount: { $sum: 1 },
          averagePrice: { $avg: '$disher_price' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryId: '$_id',
          categoryName: { $arrayElemAt: ['$category.category_name.value', 0] },
          dishCount: 1,
          averagePrice: { $round: ['$averagePrice', 2] },
          totalRevenue: 0, // Will be populated from orders
        },
      },
      { $sort: { dishCount: -1 } },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'DishRepository.getCategoryStats',
      { explain: false }
    );
  }

  /**
   * Get popular dishes with revenue calculation.
   * Optimized for dashboard display.
   */
  async getPopularDishes(
    restaurantId: string,
    options?: { 
      limit?: number; 
      dateRange?: { from?: Date; to?: Date };
      type?: 'KITCHEN' | 'SERVICE';
    }
  ): Promise<Array<DishStats & { trend?: 'up' | 'down' | 'stable' }>> {
    validateObjectId(restaurantId, 'restaurant_id');

    const { limit = 5, dateRange, type } = options ?? {};

    // Get dishes with optional type filter
    const dishFilter: Record<string, unknown> = {
      restaurant_id: new Types.ObjectId(restaurantId),
      disher_status: 'ACTIVATED',
    };
    if (type) {
      dishFilter.disher_type = type;
    }

    const dishes = await this.model
      .find(dishFilter)
      .select('_id disher_name category_id disher_type')
      .lean()
      .exec();

    if (dishes.length === 0) return [];

    const dishIds = dishes.map(d => d._id.toString());

    // Build date filter
    const dateFilter: Record<string, unknown> = {
      item_dish_id: { $in: dishIds.map(id => new Types.ObjectId(id)) },
      item_state: { $ne: 'CANCELED' },
    };

    if (dateRange?.from || dateRange?.to) {
      dateFilter.createdAt = {};
      if (dateRange.from) (dateFilter.createdAt as Record<string, Date>).$gte = dateRange.from;
      if (dateRange.to) (dateFilter.createdAt as Record<string, Date>).$lte = dateRange.to;
    }

    const pipeline: PipelineStage[] = [
      { $match: dateFilter },
      {
        $group: {
          _id: '$item_dish_id',
          totalOrdered: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $add: [
                '$item_base_price',
                { $ifNull: ['$item_disher_variant.price', 0] },
                { $sum: '$item_disher_extras.price' },
              ],
            },
          },
        },
      },
      { $sort: { totalOrdered: -1 } },
      { $limit: limit },
    ];

    const stats = await QueryProfiler.profileAggregation(
      this.model.db.model('ItemOrder'),
      pipeline,
      'DishRepository.getPopularDishes',
      { explain: false }
    );

    return stats.map(stat => {
      const dish = dishes.find(d => d._id.equals(stat._id));
      return {
        dishId: stat._id,
        dishName: dish?.disher_name?.[0]?.value ?? 'Unknown',
        totalOrdered: stat.totalOrdered,
        totalRevenue: Math.round(stat.totalRevenue * 100) / 100,
        categoryId: dish?.category_id,
        trend: 'stable', // Could calculate based on historical data
      };
    });
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

  /**
   * Get categories with dish counts using aggregation.
   */
  async getCategoriesWithCounts(restaurantId: string): Promise<
    Array<ICategory & { dishCount: number; activeDishCount: number }>
  > {
    validateObjectId(restaurantId, 'restaurant_id');

    const pipeline: PipelineStage[] = [
      {
        $match: {
          restaurant_id: new Types.ObjectId(restaurantId),
        },
      },
      {
        $lookup: {
          from: 'dishes',
          localField: '_id',
          foreignField: 'category_id',
          as: 'dishes',
        },
      },
      {
        $addFields: {
          dishCount: { $size: '$dishes' },
          activeDishCount: {
            $size: {
              $filter: {
                input: '$dishes',
                as: 'dish',
                cond: { $eq: ['$$dish.disher_status', 'ACTIVATED'] },
              },
            },
          },
        },
      },
      {
        $project: {
          dishes: 0,
        },
      },
      { $sort: { category_order: 1 } },
    ];

    return QueryProfiler.profileAggregation(
      this.model,
      pipeline,
      'CategoryRepository.getCategoriesWithCounts',
      { explain: false }
    );
  }
}
