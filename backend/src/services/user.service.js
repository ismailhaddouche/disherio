import User from '../models/User.js';

class UserService {
    async getAllUsers() {
        return await User.find().select('-password');
    }

    async getUsersByRestaurant(slug) {
        return await User.find({ restaurantSlug: slug }).select('-password');
    }

    async getUserById(id) {
        return await User.findById(id);
    }

    async updateProfile(id, data) {
        const user = await User.findById(id);
        if (!user) return null;

        if (data.username) user.username = data.username;
        if (data.password) user.password = data.password;
        
        await user.save();
        return user;
    }

    async createOrUpdateUser(id, data) {
        let user;
        let isNew = false;
        
        if (id) {
            user = await User.findById(id);
            if (!user) return null;
            Object.assign(user, data);
        } else {
            user = new User(data);
            isNew = true;
        }
        
        await user.save();
        return { user, isNew };
    }

    async deleteUser(id) {
        return await User.findByIdAndDelete(id);
    }

    async updatePrintSettings(id, data) {
        const user = await User.findById(id);
        if (!user) return null;

        if (data.printerId) user.printerId = data.printerId;
        if (data.printTemplate) {
            user.printTemplate = { ...user.printTemplate.toObject(), ...data.printTemplate };
        }

        await user.save();
        return user;
    }

    async copyPrintSettings(targetId, sourceId) {
        const sourceUser = await User.findById(sourceId);
        if (!sourceUser) return { error: 'SOURCE_USER_NOT_FOUND' };

        const targetUser = await User.findById(targetId);
        if (!targetUser) return { error: 'TARGET_USER_NOT_FOUND' };

        targetUser.printerId = sourceUser.printerId;
        targetUser.printTemplate = sourceUser.printTemplate;

        await targetUser.save();
        return { targetUser };
    }
}

export default new UserService();