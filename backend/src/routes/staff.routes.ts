import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import * as StaffController from '../controllers/staff.controller';
import { validate } from '../middlewares/validate';
import { CreateStaffSchema, UpdateStaffSchema, UpdatePreferencesSchema, RoleSchema } from '@disherio/shared';

const router = Router();

router.use(authMiddleware);

// Current user endpoints (no special permissions required)
router.get('/me/profile', StaffController.getMyProfile);
router.patch('/me/preferences', strictLimiter, validate(UpdatePreferencesSchema), StaffController.updateMyPreferences);

// Roles (must be before /:id to avoid Express matching 'roles' as an id)
router.get('/roles/all', requirePermission('read', 'Role'), StaffController.listRoles);
router.post('/roles', strictLimiter, requirePermission('create', 'Role'), validate(RoleSchema.omit({ restaurant_id: true })), StaffController.createRole);

// Staff members
router.get('/', requirePermission('read', 'Staff'), StaffController.listStaff);
router.get('/:id', requirePermission('read', 'Staff'), StaffController.getStaff);
router.post('/', strictLimiter, requirePermission('create', 'Staff'), validate(CreateStaffSchema.omit({ restaurant_id: true })), StaffController.createStaff);
router.patch('/:id', strictLimiter, requirePermission('update', 'Staff'), validate(UpdateStaffSchema), StaffController.updateStaff);
router.delete('/:id', strictLimiter, requirePermission('delete', 'Staff'), StaffController.deleteStaff);

export default router;
