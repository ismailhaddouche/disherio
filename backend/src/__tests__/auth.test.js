import { jest, describe, it, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';

const TEST_SECRET = process.env.JWT_SECRET || 'disher_secret_key_2026';

import { verifyToken, generateToken, getCookieOptions, COOKIE_NAME } from '../middleware/auth.middleware.js';

describe('Auth Middleware', () => {

    describe('generateToken', () => {
        it('should generate a valid JWT', () => {
            const token = generateToken({ userId: 'user1', username: 'admin', role: 'admin' });
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');

            const decoded = jwt.verify(token, TEST_SECRET);
            expect(decoded.userId).toBe('user1');
            expect(decoded.username).toBe('admin');
            expect(decoded.role).toBe('admin');
        });

        it('should set expiration to 24 hours', () => {
            const token = generateToken({ userId: 'user1' });
            const decoded = jwt.decode(token);
            const diff = decoded.exp - decoded.iat;
            expect(diff).toBe(86400); // 24h in seconds
        });
    });

    describe('verifyToken middleware', () => {
        const createMockReqRes = (token, source = 'cookie') => {
            const req = {
                cookies: {},
                headers: {},
                t: (key) => key // mock i18n
            };
            if (source === 'cookie') {
                req.cookies[COOKIE_NAME] = token;
            } else if (source === 'header') {
                req.headers['authorization'] = `Bearer ${token}`;
            }
            const res = {
                statusCode: null,
                body: null,
                status(code) { this.statusCode = code; return this; },
                json(data) { this.body = data; return this; },
                error(message, code = 500) { this.statusCode = code; this.body = { message }; return this; }
            };
            return { req, res };
        };

        it('should call next() with a valid cookie token', (done) => {
            const token = generateToken({ userId: 'u1', username: 'test' });
            const { req, res } = createMockReqRes(token, 'cookie');

            verifyToken(req, res, () => {
                expect(req.user).toBeDefined();
                expect(req.user.userId).toBe('u1');
                done();
            });
        });

        it('should call next() with a valid header token', (done) => {
            const token = generateToken({ userId: 'u2', username: 'admin' });
            const { req, res } = createMockReqRes(token, 'header');

            verifyToken(req, res, () => {
                expect(req.user).toBeDefined();
                expect(req.user.userId).toBe('u2');
                done();
            });
        });

        it('should return 401 when no token is provided', () => {
            const { req, res } = createMockReqRes(null, 'none');

            const next = jest.fn();
            verifyToken(req, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toBe('ERRORS.NO_TOKEN_PROVIDED');
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when token is invalid', (done) => {
            const { req, res } = createMockReqRes('invalid.token.here', 'cookie');

            const next = jest.fn();
            verifyToken(req, res, next);

            // jwt.verify is async with callback, so need to wait a tick
            setTimeout(() => {
                expect(res.statusCode).toBe(401);
                expect(next).not.toHaveBeenCalled();
                done();
            }, 50);
        });

        it('should return 401 when token is expired', (done) => {
            const expiredToken = jwt.sign(
                { userId: 'expired' },
                TEST_SECRET,
                { expiresIn: '0s' }
            );
            const { req, res } = createMockReqRes(expiredToken, 'cookie');

            const next = jest.fn();
            verifyToken(req, res, next);

            setTimeout(() => {
                expect(res.statusCode).toBe(401);
                expect(next).not.toHaveBeenCalled();
                done();
            }, 50);
        });
    });

    describe('getCookieOptions', () => {
        it('should return secure=false when PROTOCOL is not https', () => {
            delete process.env.PROTOCOL;
            const opts = getCookieOptions();
            expect(opts.httpOnly).toBe(true);
            expect(opts.secure).toBeFalsy();
            expect(opts.sameSite).toBe('lax');
            expect(opts.maxAge).toBe(86400000);
        });

        it('should return secure=true when PROTOCOL is https', () => {
            process.env.PROTOCOL = 'https';
            const opts = getCookieOptions();
            expect(opts.secure).toBe(true);
            delete process.env.PROTOCOL;
        });
    });
});
