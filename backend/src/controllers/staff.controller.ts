import { Request, Response } from 'express';
import { asyncHandler, createError } from '../utils/async-handler';
import { getPaginationParams, createPaginatedResponse } from '../utils/pagination';
import { Types } from 'mongoose';
import { Staff, Role } from '../models/staff.model';
import bcrypt from 'bcryptjs';
import { ErrorCode } from '@disherio/shared';

// Get all staff for the restaurant
export const listStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user!.restaurantId;
  const { page, limit, skip } = getPaginationParams(req);
  
  const [staff, total] = await Promise.all([
    Staff.find({ restaurant_id: new Types.ObjectId(restaurantId) })
      .populate('role_id', 'role_name permissions')
      .select('-password_hash -pin_code_hash')
      .skip(skip)
      .limit(limit)
      .lean(),
    Staff.countDocuments({ restaurant_id: new Types.ObjectId(restaurantId) })
  ]);

  res.json(createPaginatedResponse(staff, total, page, limit));
});

// Get single staff member
export const getStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const restaurantId = req.user!.restaurantId;

  const staff = await Staff.findOne({
    _id: new Types.ObjectId(id as string),
    restaurant_id: new Types.ObjectId(restaurantId)
  })
    .populate('role_id', 'role_name permissions')
    .select('-password_hash -pin_code_hash')
    .lean();

  if (!staff) {
    throw createError.notFound('STAFF_NOT_FOUND');
  }

  res.json(staff);
});

// Create new staff member
export const createStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user!.restaurantId;
  const { staff_name, username, password, pin_code, role_id } = req.body;

  // Normalize username
  const normalizedUsername = username.toLowerCase().trim();

  // Validate that the role exists and belongs to this restaurant
  const role = await Role.findOne({
    _id: new Types.ObjectId(role_id as string),
    restaurant_id: new Types.ObjectId(restaurantId)
  });
  if (!role) {
    throw createError.notFound(ErrorCode.ROLE_NOT_FOUND);
  }

  // Check if username already exists in this restaurant
  const existingStaff = await Staff.findOne({
    username: normalizedUsername,
    restaurant_id: new Types.ObjectId(restaurantId)
  });
  if (existingStaff) {
    throw createError.conflict('USER_ALREADY_EXISTS');
  }

  // Hash password and PIN
  const password_hash = await bcrypt.hash(password, 10);
  const pin_code_hash = await bcrypt.hash(pin_code, 10);

  const staff = await Staff.create({
    restaurant_id: new Types.ObjectId(restaurantId),
    role_id: new Types.ObjectId(role_id as string),
    staff_name,
    username: normalizedUsername,
    password_hash,
    pin_code_hash
  });

  const staffResponse = await Staff.findById(staff._id)
    .populate('role_id', 'role_name permissions')
    .select('-password_hash -pin_code_hash')
    .lean();

  res.status(201).json(staffResponse);
});

// Update staff member
export const updateStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const restaurantId = req.user!.restaurantId;
  const { staff_name, username, role_id, password, pin_code } = req.body;

  const staff = await Staff.findOne({
    _id: new Types.ObjectId(id as string),
    restaurant_id: new Types.ObjectId(restaurantId)
  });

  if (!staff) {
    throw createError.notFound('STAFF_NOT_FOUND');
  }

  // Check username uniqueness if changing
  if (username && username.toLowerCase().trim() !== staff.username) {
    const normalizedUsername = username.toLowerCase().trim();
    const existing = await Staff.findOne({ 
      username: normalizedUsername,
      restaurant_id: new Types.ObjectId(restaurantId)
    });
    if (existing) {
      throw createError.conflict('USER_ALREADY_EXISTS');
    }
    staff.username = normalizedUsername;
  }

  // Update fields
  if (staff_name) staff.staff_name = staff_name;
  if (role_id) {
    const role = await Role.findOne({
      _id: new Types.ObjectId(role_id as string),
      restaurant_id: new Types.ObjectId(restaurantId)
    });
    if (!role) {
      throw createError.notFound(ErrorCode.ROLE_NOT_FOUND);
    }
    staff.role_id = new Types.ObjectId(role_id as string);
  }
  
  // Update passwords if provided
  if (password) {
    staff.password_hash = await bcrypt.hash(password, 10);
  }
  if (pin_code) {
    staff.pin_code_hash = await bcrypt.hash(pin_code, 10);
  }

  await staff.save();

  const staffResponse = await Staff.findById(staff._id)
    .populate('role_id', 'role_name permissions')
    .select('-password_hash -pin_code_hash')
    .lean();

  res.json(staffResponse);
});

// Delete staff member
export const deleteStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const restaurantId = req.user!.restaurantId;

  const staff = await Staff.findOneAndDelete({
    _id: new Types.ObjectId(id as string),
    restaurant_id: new Types.ObjectId(restaurantId)
  });

  if (!staff) {
    throw createError.notFound('STAFF_NOT_FOUND');
  }

  res.status(204).end();
});

// Get available roles
export const listRoles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user!.restaurantId;

  const roles = await Role.find({
    $or: [
      { restaurant_id: new Types.ObjectId(restaurantId) },
      { restaurant_id: { $exists: false } } // System default roles
    ]
  }).lean();

  res.json(roles);
});

// Create role
export const createRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const restaurantId = req.user!.restaurantId;
  const { role_name, permissions } = req.body;

  const role = await Role.create({
    restaurant_id: new Types.ObjectId(restaurantId),
    role_name,
    permissions: permissions || []
  });

  res.status(201).json(role);
});

// Update own preferences (language/theme) - any authenticated user
export const updateMyPreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const staffId = req.user!.staffId;
  const { language, theme } = req.body;

  const staff = await Staff.findById(staffId);
  
  if (!staff) {
    throw createError.notFound('USER_NOT_FOUND');
  }

  // Update only allowed preference fields
  if (language && ['es', 'en'].includes(language)) {
    staff.language = language;
  }
  if (theme && ['light', 'dark', 'system'].includes(theme)) {
    staff.theme = theme;
  }

  await staff.save();

  res.json({
    message: 'PREFERENCES_UPDATED',
    preferences: {
      language: staff.language,
      theme: staff.theme
    }
  });
});

// Get own profile with preferences
export const getMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const staffId = req.user!.staffId;

  const staff = await Staff.findById(staffId)
    .populate('role_id', 'role_name permissions')
    .select('-password_hash -pin_code_hash')
    .lean();

  if (!staff) {
    throw createError.notFound('USER_NOT_FOUND');
  }

  res.json(staff);
});
