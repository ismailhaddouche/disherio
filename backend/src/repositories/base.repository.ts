import { Types, UpdateQuery, Model, Document, ClientSession } from 'mongoose';
import { AppError } from '../utils/async-handler';
import { logger } from '../config/logger';

// Simple filter type for mongoose queries
type SimpleFilter = Record<string, unknown>;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateObjectId(id: string, fieldName: string = 'id'): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new ValidationError(`INVALID_${fieldName.toUpperCase().replace(/\s/g, '_')}`);
  }
}

export function validateObjectIdOptional(
  id: string | undefined | null,
  fieldName: string = 'id'
): void {
  if (id !== undefined && id !== null && !Types.ObjectId.isValid(id)) {
    throw new ValidationError(`INVALID_${fieldName.toUpperCase().replace(/\s/g, '_')}`);
  }
}

export function toObjectId(id: string): Types.ObjectId {
  validateObjectId(id);
  return new Types.ObjectId(id);
}

/**
 * Converts Mongoose errors to appropriate HTTP errors
 */
function handleMongoError(err: any, operation: string): never {
  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message).join(', ');
    throw new AppError(`VALIDATION_ERROR: ${messages}`, 400);
  }

  // Invalid ID error (CastError)
  if (err.name === 'CastError') {
    throw new AppError(`INVALID_ID_FORMAT: ${err.path}`, 400);
  }

  // Duplicate error
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(', ');
    throw new AppError(`DUPLICATE_VALUE: ${field} already exists`, 409);
  }

  // Document not found error
  if (err.name === 'DocumentNotFoundError') {
    throw new AppError('RESOURCE_NOT_FOUND', 404);
  }

  // Log unexpected error and rethrow as 500
  logger.error({ err, operation }, 'Unexpected database error');
  throw new AppError(`DATABASE_ERROR: ${err.message || 'Unknown error'}`, 500);
}

export abstract class BaseRepository<T extends Document> {
  protected model: Model<T>;

  constructor(model: Model<T>) {
    this.model = model;
  }

  /**
   * Get the underlying Mongoose model for advanced operations
   */
  getModel(): Model<T> {
    return this.model;
  }

  protected validateId(id: string, fieldName: string = 'id'): void {
    validateObjectId(id, fieldName);
  }

  async findById(id: string): Promise<T | null> {
    try {
      this.validateId(id);
      return await this.model.findById(id).exec();
    } catch (err: any) {
      handleMongoError(err, 'findById');
    }
  }

  async findByIdLean(id: string): Promise<T | null> {
    try {
      this.validateId(id);
      return await this.model.findById(id).lean().exec();
    } catch (err: any) {
      handleMongoError(err, 'findByIdLean');
    }
  }

  async findOne(filter: SimpleFilter): Promise<T | null> {
    try {
      return await this.model.findOne(filter).exec();
    } catch (err: any) {
      handleMongoError(err, 'findOne');
    }
  }

  async find(filter: SimpleFilter = {}): Promise<T[]> {
    try {
      return await this.model.find(filter).exec();
    } catch (err: any) {
      handleMongoError(err, 'find');
    }
  }

  async findLean(filter: SimpleFilter = {}): Promise<T[]> {
    try {
      return await this.model.find(filter).lean().exec();
    } catch (err: any) {
      handleMongoError(err, 'findLean');
    }
  }

  async create(data: Partial<T>, session?: ClientSession): Promise<T> {
    try {
      if (session) {
        const docs = await this.model.create([data as any], { session });
        return docs[0];
      }
      return await this.model.create(data);
    } catch (err: any) {
      handleMongoError(err, 'create');
    }
  }

  async update(id: string, data: UpdateQuery<T>, session?: ClientSession): Promise<T | null> {
    try {
      this.validateId(id);
      return await this.model.findByIdAndUpdate(id, data, { new: true, session }).exec();
    } catch (err: any) {
      handleMongoError(err, 'update');
    }
  }

  async delete(id: string, session?: ClientSession): Promise<T | null> {
    try {
      this.validateId(id);
      return await this.model.findByIdAndDelete(id, { session }).exec();
    } catch (err: any) {
      handleMongoError(err, 'delete');
    }
  }

  async exists(filter: SimpleFilter): Promise<boolean> {
    try {
      const count = await this.model.countDocuments(filter).exec();
      return count > 0;
    } catch (err: any) {
      handleMongoError(err, 'exists');
    }
  }

  async count(filter: SimpleFilter = {}): Promise<number> {
    try {
      return await this.model.countDocuments(filter).exec();
    } catch (err: any) {
      handleMongoError(err, 'count');
    }
  }
}
