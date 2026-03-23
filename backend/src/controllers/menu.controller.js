import MenuService from '../services/menu.service.js';
import AuditService from '../services/audit.service.js';
import { SOCKET_EVENTS, ROLES } from '../constants.js';

class MenuController {
    async getAll(req, res) {
        const items = await MenuService.getAllItems();
        res.success(items);
    }

    async uploadImage(req, res) {
        if (!req.file) return res.error(req.t('ERRORS.NO_IMAGE_PROVIDED'), 400);

        try {
            const fileUrl = await MenuService.processImage(req.file);
            
            await AuditService.log(req, 'MENU_ITEM_IMAGE_UPLOADED', {
                url: fileUrl,
                originalName: req.file.originalname
            });

            res.success({ url: fileUrl });
        } catch (error) {
            console.error('Error processing image:', error);
            res.error(req.t('ERRORS.IMAGE_PROCESS_ERROR'), 500);
        }
    }

    async createOrUpdate(req, res) {
        const { _id, ...data } = req.body;

        if (_id) {
            if (req.user.role === ROLES.KITCHEN && data.category !== 'Fuera de Carta') {
                return res.error(req.t('ERRORS.KITCHEN_CATEGORY_RESTRICTED'), 403);
            }
        }

        const result = await MenuService.createOrUpdateItem(_id, data, req.user.role);
        
        if (!result) {
            return res.error(req.t('ERRORS.MENU_ITEM_NOT_FOUND'), 404);
        }

        const { item, oldItem, isNew } = result;

        if (isNew) {
            await AuditService.log(req, 'MENU_ITEM_CREATED', {
                itemId: item._id,
                itemName: item.name,
                category: item.category
            });
        } else {
            await AuditService.logChange(req, 'MENU_ITEM_UPDATED', oldItem?.toObject(), item.toObject(), {
                itemId: item._id,
                itemName: item.name
            });
        }

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.MENU_UPDATE, item);

        res.success(item);
    }

    async delete(req, res) {
        const item = await MenuService.deleteItem(req.params.id);
        if (!item) {
            return res.error(req.t('ERRORS.MENU_ITEM_NOT_FOUND'), 404);
        }

        await AuditService.log(req, 'MENU_ITEM_DELETED', {
            itemId: item._id,
            itemName: item.name
        });

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.MENU_UPDATE, { deleted: item._id });

        res.success({ message: req.t('ERRORS.MENU_ITEM_DELETED') });
    }

    async toggleAvailability(req, res) {
        const result = await MenuService.toggleAvailability(req.params.productId);
        if (!result) {
            return res.error(req.t('ERRORS.MENU_ITEM_NOT_FOUND'), 404);
        }

        const { item, previousStatus } = result;

        await AuditService.log(req, 'MENU_ITEM_AVAILABILITY_TOGGLED', {
            itemId: item._id,
            itemName: item.name,
            from: previousStatus,
            to: item.available
        });

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.MENU_UPDATE, item);

        res.success(item);
    }
}

export default new MenuController();