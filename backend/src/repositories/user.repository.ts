import { Types } from 'mongoose';
import { Staff, IStaff, Role, IRole } from '../models/staff.model';
import { BaseRepository, validateObjectId } from './base.repository';

export { validateObjectId };

export class UserRepository extends BaseRepository<IStaff> {
  constructor() {
    super(Staff);
  }

  async findByUsername(username: string): Promise<IStaff | null> {
    return this.model
      .findOne({ username: username.toLowerCase() })
      .select('+password_hash +pin_code_hash +auth_version')
      .exec();
  }

  async countByUsername(username: string): Promise<number> {
    return this.model.countDocuments({ username: username.toLowerCase() }).exec();
  }

  async findByUsernameAndRestaurant(username: string, restaurantId: string): Promise<IStaff | null> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .findOne({
        username: username.toLowerCase(),
        restaurant_id: new Types.ObjectId(restaurantId)
      })
      .select('+password_hash +pin_code_hash +auth_version')
      .exec();
  }

  async findByRestaurantIdWithPassword(restaurantId: string): Promise<IStaff[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .select('+password_hash +pin_code_hash +auth_version')
      .exec();
  }

  /** O(1) PIN login lookup for the restaurant's unique PIN identity. */
  async findByPinLookup(restaurantId: string, pinLookup: string): Promise<IStaff | null> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .findOne({ restaurant_id: new Types.ObjectId(restaurantId), pin_lookup: pinLookup })
      .populate('role_id')
      .select('+pin_code_hash +auth_version')
      .lean()
      .exec();
  }

  /**
   * Staff documents not yet migrated to pin_lookup. After full migration
   * this query returns empty using the {restaurant_id, pin_lookup} index.
   */
  async findLegacyPinCandidates(restaurantId: string): Promise<IStaff[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId), pin_lookup: { $exists: false } })
      .populate('role_id')
      .select('+pin_code_hash +auth_version')
      .lean()
      .exec();
  }

  /**
   * Persist the deterministic PIN lookup key for a migrated staff member.
   */
  async setPinLookup(staffId: string, pinLookup: string): Promise<void> {
    validateObjectId(staffId, 'staff_id');
    await this.model
      .updateOne({ _id: new Types.ObjectId(staffId) }, { $set: { pin_lookup: pinLookup } })
      .exec();
  }

  async existsByPinLookup(
    restaurantId: string,
    pinLookup: string,
    excludeStaffId?: string
  ): Promise<boolean> {
    validateObjectId(restaurantId, 'restaurant_id');
    const query: {
      restaurant_id: Types.ObjectId;
      pin_lookup: string;
      _id?: { $ne: Types.ObjectId };
    } = {
      restaurant_id: new Types.ObjectId(restaurantId),
      pin_lookup: pinLookup,
    };
    if (excludeStaffId) {
      validateObjectId(excludeStaffId, 'staff_id');
      query._id = { $ne: new Types.ObjectId(excludeStaffId) };
    }
    return (await this.model.exists(query)) !== null;
  }

  async findByIdWithRole(id: string): Promise<IStaff | null> {
    validateObjectId(id, 'staff_id');
    return this.model.findById(id).populate('role_id').select('+auth_version').exec();
  }

  async createUser(
    data: Omit<Partial<IStaff>, 'restaurant_id' | 'role_id' | 'username'> & {
      restaurant_id: string;
      role_id: string;
      username: string;
      password_hash: string;
      pin_code_hash: string;
      pin_lookup?: string;
    }
  ): Promise<IStaff> {
    validateObjectId(data.restaurant_id, 'restaurant_id');
    validateObjectId(data.role_id, 'role_id');

    return this.create({
      ...data,
      restaurant_id: new Types.ObjectId(data.restaurant_id),
      role_id: new Types.ObjectId(data.role_id),
      username: data.username.toLowerCase(),
    });
  }

  async updateUser(id: string, data: Partial<IStaff>): Promise<IStaff | null> {
    validateObjectId(id, 'staff_id');
    if (data.username) {
      data.username = data.username.toLowerCase();
    }
    return this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  async deleteUser(id: string): Promise<IStaff | null> {
    validateObjectId(id, 'staff_id');
    return this.model.findByIdAndDelete(id).exec();
  }

  async existsByUsername(username: string, restaurantId?: string): Promise<boolean> {
    const query: { username: string; restaurant_id?: Types.ObjectId } = { username: username.toLowerCase() };
    if (restaurantId) {
      validateObjectId(restaurantId, 'restaurant_id');
      query.restaurant_id = new Types.ObjectId(restaurantId);
    }
    const count = await this.model.countDocuments(query).exec();
    return count > 0;
  }

  async countByRestaurant(restaurantId: string): Promise<number> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model.countDocuments({ restaurant_id: new Types.ObjectId(restaurantId) }).exec();
  }

  /**
   * Paginated list of staff for a restaurant, with role populated and hashes excluded.
   */
  async findByRestaurantPaginated(
    restaurantId: string,
    skip: number,
    limit: number
  ): Promise<unknown[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .populate('role_id', 'role_name permissions')
      .select('-password_hash -pin_code_hash')
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  /**
   * Find a staff member by id scoped to a restaurant, with role populated and hashes excluded.
   */
  async findByIdAndRestaurantLean(id: string, restaurantId: string): Promise<unknown | null> {
    validateObjectId(id, 'staff_id');
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .findOne({
        _id: new Types.ObjectId(id),
        restaurant_id: new Types.ObjectId(restaurantId),
      })
      .populate('role_id', 'role_name permissions')
      .select('-password_hash -pin_code_hash')
      .lean()
      .exec();
  }

  /**
   * Find a staff member document by id scoped to a restaurant (for updates that need a mutable doc).
   */
  async findByIdAndRestaurant(id: string, restaurantId: string): Promise<IStaff | null> {
    validateObjectId(id, 'staff_id');
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .findOne({
        _id: new Types.ObjectId(id),
        restaurant_id: new Types.ObjectId(restaurantId),
      })
      .select('+auth_version')
      .exec();
  }

  /**
   * Delete a staff member scoped to a restaurant.
   */
  async findByIdAndRestaurantAndDelete(id: string, restaurantId: string): Promise<IStaff | null> {
    validateObjectId(id, 'staff_id');
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model.findOneAndDelete({
      _id: new Types.ObjectId(id),
      restaurant_id: new Types.ObjectId(restaurantId),
    }).exec();
  }

  /**
   * Get the authenticated user's own profile, with role populated and hashes excluded.
   */
  async findProfileById(id: string): Promise<unknown | null> {
    validateObjectId(id, 'staff_id');
    return this.model
      .findById(id)
      .populate('role_id', 'role_name permissions')
      .select('-password_hash -pin_code_hash')
      .lean()
      .exec();
  }
}

export class RoleRepository extends BaseRepository<IRole> {
  constructor() {
    super(Role);
  }

  async findByRestaurantId(restaurantId: string): Promise<IRole[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .lean()
      .exec();
  }

  async findByName(restaurantId: string, roleName: string): Promise<IRole | null> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model.findOne({
      restaurant_id: new Types.ObjectId(restaurantId),
      role_name: roleName,
    });
  }

  async createRole(
    data: Omit<Partial<IRole>, 'restaurant_id'> & { restaurant_id: string; role_name: string }
  ): Promise<IRole> {
    validateObjectId(data.restaurant_id, 'restaurant_id');
    return this.create({
      ...data,
      restaurant_id: new Types.ObjectId(data.restaurant_id),
      permissions: data.permissions || [],
    });
  }

  async updateRole(id: string, data: Partial<IRole>): Promise<IRole | null> {
    validateObjectId(id, 'role_id');
    return this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  async deleteRole(id: string): Promise<IRole | null> {
    validateObjectId(id, 'role_id');
    return this.model.findByIdAndDelete(id).exec();
  }

  async existsByName(restaurantId: string, roleName: string): Promise<boolean> {
    validateObjectId(restaurantId, 'restaurant_id');
    const count = await this.model.countDocuments({
      restaurant_id: new Types.ObjectId(restaurantId),
      role_name: roleName,
    });
    return count > 0;
  }

  /**
   * List roles available to a restaurant. The Role schema requires
   * restaurant_id, so only the restaurant's own roles exist.
   */
  async findAvailableForRestaurant(restaurantId: string): Promise<IRole[]> {
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .lean()
      .exec();
  }

  /**
   * Find a role by id scoped to a restaurant.
   */
  async findByIdAndRestaurant(roleId: string, restaurantId: string): Promise<IRole | null> {
    validateObjectId(roleId, 'role_id');
    validateObjectId(restaurantId, 'restaurant_id');
    return this.model
      .findOne({
        _id: new Types.ObjectId(roleId),
        restaurant_id: new Types.ObjectId(restaurantId),
      })
      .lean()
      .exec();
  }
}
