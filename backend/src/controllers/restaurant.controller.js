import RestaurantService from '../services/restaurant.service.js';
import AuditService from '../services/audit.service.js';
import ActivityLog from '../models/ActivityLog.js';
import QRCode from 'qrcode';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SOCKET_EVENTS, ROLES } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class RestaurantController {
    async getRestaurant(req, res) {
        const restaurant = await RestaurantService.getRestaurant();
        const config = restaurant.toObject();
        config.domain = process.env.DOMAIN || `http://${req.get('host')}`;
        res.success(config);
    }

    async updateRestaurant(req, res) {
        const { restaurant, oldState } = await RestaurantService.updateRestaurant(req.body);

        await AuditService.logChange(req, 'RESTAURANT_CONFIG_UPDATED', oldState, restaurant.toObject());

        const io = req.app.get('io');
        if (io) io.emit(SOCKET_EVENTS.CONFIG_UPDATED, restaurant);

        res.success(restaurant);
    }

    async uploadLogo(req, res) {
        if (!req.file) return res.error(req.t('ERRORS.NO_IMAGE_PROVIDED'), 400);

        const uploadDir = path.join(__dirname, '../../public/uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const filename = `logo-${Date.now()}.webp`;
        const filepath = path.join(uploadDir, filename);

        await sharp(req.file.buffer)
            .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filepath);

        const fileUrl = `/uploads/${filename}`;
        res.success({ url: fileUrl });
    }

    async getTotemSession(req, res) {
        const totemIdNum = parseInt(req.params.id);
        const result = await RestaurantService.getTotemSession(totemIdNum);
        
        if (result.error) return res.error(req.t(`ERRORS.${result.error}`), result.error === 'TOTEM_INACTIVE' ? 403 : 404);
        res.success(result);
    }

    async startTotemSession(req, res) {
        const totemIdNum = parseInt(req.params.id);
        const result = await RestaurantService.startTotemSession(totemIdNum);
        
        if (result.error) return res.error(req.t(`ERRORS.${result.error}`), result.error === 'TOTEM_INACTIVE' ? 403 : 404);
        
        if (result.isNew) {
            const io = req.app.get('io');
            if (io) io.emit(SOCKET_EVENTS.ORDER_UPDATED, result.newOrder);
        }

        res.success(result.session);
    }

    async getTotems(req, res) {
        const totems = await RestaurantService.getTotems();
        res.success(totems);
    }

    async addTotem(req, res, next) {
        // Validation handled in route middleware for roles, but double checking
        if (req.user.role === ROLES.WAITER && req.body.isVirtual !== true) {
            return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
        }
        if (req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.WAITER) {
            return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
        }
        
        const result = await RestaurantService.addTotem(req.body, req.user.username);
        if (result.error) return res.error(req.t(`ERRORS.${result.error}`), 400);

        await AuditService.log(req, 'TOTEM_CREATED', {
            totemId: result.newTotem.id,
            name: result.newTotem.name,
            isVirtual: result.newTotem.isVirtual
        });

        res.success(result.newTotem, 201);
    }

    async updateTotem(req, res) {
        const result = await RestaurantService.updateTotem(req.params.id, req.body);
        
        if (result.error === 'DUPLICATE_TOTEM_NAME') return res.error(req.t('ERRORS.DUPLICATE_TOTEM_NAME'), 400);
        if (result.error) return res.error(req.t(`ERRORS.${result.error}`), 404);

        await AuditService.logChange(req, 'TOTEM_UPDATED', result.oldTotem, result.totem.toObject(), {
            totemId: result.totem.id
        });

        res.success(result.totem);
    }

    async deleteTotem(req, res) {
        const result = await RestaurantService.deleteTotem(req.params.id, req.user.role);
        if (result.error === 'ACCESS_DENIED_ADMIN') return res.error(req.t('ERRORS.ACCESS_DENIED_ADMIN'), 403);
        if (result.error) return res.error(req.t(`ERRORS.${result.error}`), 404);

        await AuditService.log(req, 'TOTEM_DELETED', {
            totemId: result.totem.id,
            name: result.totem.name,
            isVirtual: result.totem.isVirtual
        });

        res.success({ message: req.t('ERRORS.TOTEM_DELETED_SUCCESSFULLY') });
    }

    async getQr(req, res) {
        const { totemId } = req.params;

        let baseUrl;
        if (process.env.DOMAIN) {
            baseUrl = process.env.DOMAIN;
            if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
                const protocol = process.env.INSTALL_MODE === 'local' ? 'http' : 'https';
                baseUrl = `${protocol}://${baseUrl}`;
            }
        } else {
            const protocol = process.env.INSTALL_MODE === 'local' ? 'http' : 'https';
            baseUrl = `${protocol}://${req.get('host')}`;
        }

        baseUrl = baseUrl.replace(/\/+$/, '');
        const customerUrl = `${baseUrl}/${totemId}`;

        const qrBuffer = await QRCode.toBuffer(customerUrl, {
            type: 'png',
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' }
        });

        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `inline; filename="qr-${totemId}.png"`);
        res.send(qrBuffer);
    }

    async closeShift(req, res) {
        const result = await RestaurantService.closeShift();
        if (result.error) return res.error('Restaurant not found', 404);

        await AuditService.log(req, 'SHIFT_CLOSED', {
            affectedTablesCount: result.affectedTables.length,
            affectedTables: result.affectedTables
        });

        const io = req.app.get('io');
        if (io) {
            io.to('customer').emit(SOCKET_EVENTS.ALL_SESSIONS_ENDED, { reason: 'SHIFT_CLOSED' });
        }

        res.success({ message: req.t('ERRORS.SHIFT_CLOSED') });
    }

    async createLog(req, res) {
        const auditLog = {
            ...req.body,
            userId: req.user.userId,
            username: req.user.username,
            role: req.user.role
        };
        const log = new ActivityLog(auditLog);
        await log.save();
        res.success(log, 201);
    }

    async getLogs(req, res) {
        const logs = await RestaurantService.getLogs();
        res.success(logs);
    }

    async getHistory(req, res) {
        const tickets = await RestaurantService.getHistory();
        res.success(tickets);
    }

    async deleteTicket(req, res) {
        const ticket = await RestaurantService.deleteTicket(req.params.ticketId);
        if (!ticket) return res.error(req.t('ERRORS.TICKET_NOT_FOUND'), 404);

        await AuditService.log(req, 'TICKET_DELETED', {
            ticketId: ticket._id,
            customId: ticket.customId,
            amount: ticket.amount
        });

        res.success({ message: req.t('ERRORS.TICKET_DELETED_SUCCESSFULLY') });
    }
}

export default new RestaurantController();