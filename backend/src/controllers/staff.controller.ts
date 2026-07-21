import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler';
import * as StaffService from '../services/staff.service';

// Get all staff for the restaurant
export const listStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const result = await StaffService.listStaff(req.user!.restaurantId, req);
  res.json(result);
});

// Get single staff member
export const getStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const staff = await StaffService.getStaff(String(req.params.id), req.user!.restaurantId);
  res.json(staff);
});

// Create new staff member
export const createStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const staff = await StaffService.createStaff(req.user!.restaurantId, req.body, req.user!.permissions);
  res.status(201).json(staff);
});

// Update staff member
export const updateStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const staff = await StaffService.updateStaff(
    String(req.params.id),
    req.user!.restaurantId,
    req.body,
    req.user!.permissions
  );
  res.json(staff);
});

// Delete staff member
export const deleteStaff = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await StaffService.deleteStaff(String(req.params.id), req.user!.restaurantId, req.user!.staffId);
  res.status(204).end();
});

// Get available roles
export const listRoles = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const roles = await StaffService.listRoles(req.user!.restaurantId);
  res.json(roles);
});

// Create role
export const createRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const role = await StaffService.createRole(req.user!.restaurantId, req.body, req.user!.permissions);
  res.status(201).json(role);
});

// Update own preferences (language/theme) - any authenticated user
export const updateMyPreferences = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const preferences = await StaffService.updateMyPreferences(req.user!.staffId, req.body);
  res.json({ message: 'PREFERENCES_UPDATED', preferences });
});

// Get own profile with preferences
export const getMyProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const profile = await StaffService.getMyProfile(req.user!.staffId);
  res.json(profile);
});