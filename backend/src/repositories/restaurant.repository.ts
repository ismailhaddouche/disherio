import { Types } from 'mongoose';
import {
  Restaurant,
  IRestaurant,
  Printer,
  IPrinter,
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

export class PrinterRepository extends BaseRepository<IPrinter> {
  constructor() {
    super(Printer);
  }

  async findByRestaurantId(restaurantId: string): Promise<IPrinter[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .lean()
      .exec();
  }

  async createPrinter(
    data: Partial<IPrinter> & {
      restaurant_id: string;
      printer_name: string;
      printer_ip: string;
      printer_connection: 'TCP' | 'BLUETOOTH' | 'USB';
    }
  ): Promise<IPrinter> {
    validateObjectId(data.restaurant_id, 'restaurant_id');
    return this.create({
      ...data,
      restaurant_id: new Types.ObjectId(data.restaurant_id),
    });
  }

  async updatePrinter(
    id: string,
    data: Partial<IPrinter>
  ): Promise<IPrinter | null> {
    validateObjectId(id, 'printer_id');
    return this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  async deletePrinter(id: string): Promise<IPrinter | null> {
    validateObjectId(id, 'printer_id');
    return this.model.findByIdAndDelete(id).exec();
  }

  async findByConnectionType(
    restaurantId: string,
    connectionType: 'TCP' | 'BLUETOOTH' | 'USB'
  ): Promise<IPrinter[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({
        restaurant_id: new Types.ObjectId(restaurantId),
        printer_connection: connectionType,
      })
      .lean()
      .exec();
  }
}
