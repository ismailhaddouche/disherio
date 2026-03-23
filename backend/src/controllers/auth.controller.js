import AuthService from '../services/auth.service.js';
import { getCookieOptions, COOKIE_NAME } from '../middleware/auth.middleware.js';

class AuthController {
    async login(req, res) {
        const { username, password } = req.body;
        
        const result = await AuthService.login(username, password);
        
        if (!result) {
            return res.error(req.t('ERRORS.INVALID_CREDENTIALS'), 401);
        }

        res.cookie(COOKIE_NAME, result.token, getCookieOptions());
        res.success(result.user);
    }

    async customerSession(req, res) {
        const { restaurantSlug, totemId, name } = req.body;

        const result = await AuthService.createCustomerSession(restaurantSlug, totemId, name);

        res.cookie(COOKIE_NAME, result.token, getCookieOptions());
        res.success(result.session);
    }

    async me(req, res) {
        if (!req.user) return res.success(null);
        res.success(req.user);
    }

    logout(req, res) {
        const options = { ...getCookieOptions() };
        delete options.maxAge;
        res.clearCookie(COOKIE_NAME, options);
        res.success({ message: req.t('ERRORS.LOGGED_OUT') });
    }
}

export default new AuthController();
