import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth';
import { requirePermission } from '../middlewares/rbac';
import { strictLimiter } from '../middlewares/rateLimit';
import * as MenuLanguageController from '../controllers/menu-language.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', MenuLanguageController.list);
router.post('/', strictLimiter, requirePermission('manage', 'Restaurant'), MenuLanguageController.create);
router.patch('/:id', strictLimiter, requirePermission('manage', 'Restaurant'), MenuLanguageController.update);
router.post('/:id/set-default', strictLimiter, requirePermission('manage', 'Restaurant'), MenuLanguageController.setDefault);
router.delete('/:id', strictLimiter, requirePermission('manage', 'Restaurant'), MenuLanguageController.remove);

export default router;
