import User from '../models/User.js';
import { generateToken } from '../middleware/auth.middleware.js';
import { ROLES } from '../constants.js';
import { randomUUID } from 'crypto';

class AuthService {
    async login(username, password) {
        const user = await User.findOne({ username: username.toLowerCase().trim(), active: true })
            .select('+password');
            
        if (!user || !(await user.comparePassword(password))) {
            return null;
        }

        const token = generateToken({ userId: user._id, username: user.username, role: user.role });
        
        return {
            token,
            user: {
                username: user.username,
                role: user.role,
                printerId: user.printerId,
                printTemplate: user.printTemplate
            }
        };
    }

    async createCustomerSession(restaurantSlug, totemId, name) {
        const token = generateToken({
            userId: `guest-${randomUUID()}`,
            username: name,
            role: ROLES.CUSTOMER,
            restaurantSlug,
            totemId
        });

        return {
            token,
            session: { username: name, role: ROLES.CUSTOMER, restaurantSlug, totemId }
        };
    }
}

export default new AuthService();
