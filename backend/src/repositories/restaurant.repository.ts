import {
  Restaurant,
  IRestaurant,
} from '../models/restaurant.model';
import { BaseRepository, validateObjectId } from './base.repository';

export { validateObjectId };

export class RestaurantRepository extends BaseRepository<IRestaurant> {
  constructor() {
    super(Restaurant);
  }

  async findByIdLean(id: string): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model.findById(id).lean().exec();
  }

  async findByUrl(url: string): Promise<IRestaurant | null> {
    return this.model.findOne({ restaurant_url: url }).lean().exec();
  }

  async updateRestaurant(
    id: string,
    data: Partial<IRestaurant>
  ): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  async updateTaxRate(id: string, taxRate: number): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model
      .findByIdAndUpdate(id, { tax_rate: taxRate }, { returnDocument: 'after' })
      .exec();
  }

  async updateTipsSettings(
    id: string,
    settings: {
      tips_state?: boolean;
      tips_type?: 'MANDATORY' | 'VOLUNTARY';
      tips_rate?: number;
    }
  ): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model.findByIdAndUpdate(id, settings, { returnDocument: 'after' }).exec();
  }

  async updateTheme(id: string, theme: string): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model.findByIdAndUpdate(id, { theme }, { returnDocument: 'after' }).exec();
  }

  async updateLanguage(id: string, language: string): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model.findByIdAndUpdate(id, { language }, { returnDocument: 'after' }).exec();
  }

  async updateCurrency(id: string, currency: string): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model.findByIdAndUpdate(id, { currency }, { returnDocument: 'after' }).exec();
  }

  async updateLogo(id: string, logoUrl: string): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model
      .findByIdAndUpdate(id, { logo_image_url: logoUrl }, { returnDocument: 'after' })
      .exec();
  }

  async updateSocialLinks(
    id: string,
    links: { facebook_url?: string; instagram_url?: string }
  ): Promise<IRestaurant | null> {
    validateObjectId(id, 'restaurant_id');
    return this.model
      .findByIdAndUpdate(
        id,
        { social_links: links },
        { returnDocument: 'after' }
      )
      .exec();
  }
}
