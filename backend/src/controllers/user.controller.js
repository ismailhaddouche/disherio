import UserService from '../services/user.service.js';
import AuditService from '../services/audit.service.js';

class UserController {
    async getAll(req, res) {
        const users = await UserService.getAllUsers();
        res.success(users);
    }

    async getByRestaurant(req, res) {
        const users = await UserService.getUsersByRestaurant(req.params.slug);
        res.success(users);
    }

    async updateProfile(req, res) {
        const user = await UserService.getUserById(req.user.userId);
        if (!user) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);

        const oldState = user.toObject();
        
        try {
            const updatedUser = await UserService.updateProfile(req.user.userId, req.body);
            
            await AuditService.logChange(req, 'USER_PROFILE_UPDATED', oldState, updatedUser.toObject(), {
                fields: Object.keys(req.body)
            });
            
            const result = updatedUser.toObject();
            delete result.password;
            res.success(result);
        } catch (error) {
            if (error.code === 11000) return res.error(req.t('ERRORS.USERNAME_IN_USE'), 400);
            throw error;
        }
    }

    async createOrUpdate(req, res) {
        const { _id, ...data } = req.body;
        
        let oldUser = null;
        if (_id) {
            const existingUser = await UserService.getUserById(_id);
            if (!existingUser) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);
            oldUser = existingUser.toObject();
        }

        const result = await UserService.createOrUpdateUser(_id, data);
        if (!result) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);

        const { user, isNew } = result;

        if (isNew) {
            await AuditService.log(req, 'USER_CREATED', {
                targetUserId: user._id,
                targetUsername: user.username,
                role: user.role
            });
        } else {
            await AuditService.logChange(req, 'USER_UPDATED', oldUser, user.toObject(), {
                targetUserId: user._id,
                targetUsername: user.username
            });
        }

        const userObj = user.toObject();
        delete userObj.password;
        res.success(userObj);
    }

    async delete(req, res) {
        const user = await UserService.getUserById(req.params.id);
        if (!user) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);

        await AuditService.log(req, 'USER_DELETED', {
            targetUserId: user._id,
            targetUsername: user.username
        });

        await UserService.deleteUser(req.params.id);
        res.success({ message: 'User deleted' });
    }

    async updatePrintSettings(req, res) {
        const user = await UserService.getUserById(req.params.id);
        if (!user) return res.error(req.t('ERRORS.USER_NOT_FOUND'), 404);

        const oldState = user.toObject();
        const updatedUser = await UserService.updatePrintSettings(req.params.id, req.body);

        await AuditService.logChange(req, 'USER_PRINT_SETTINGS_UPDATED', oldState, updatedUser.toObject(), {
            targetUserId: updatedUser._id,
            targetUsername: updatedUser.username
        });

        res.success(updatedUser);
    }

    async copyPrintSettings(req, res) {
        const result = await UserService.copyPrintSettings(req.params.id, req.params.sourceUserId);
        
        if (result.error === 'SOURCE_USER_NOT_FOUND') return res.error(req.t('ERRORS.SOURCE_USER_NOT_FOUND'), 404);
        if (result.error === 'TARGET_USER_NOT_FOUND') return res.error(req.t('ERRORS.TARGET_USER_NOT_FOUND'), 404);

        res.success({ message: 'Print settings copied successfully', targetUser: result.targetUser });
    }
}

export default new UserController();