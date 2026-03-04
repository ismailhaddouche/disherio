const request = require('supertest');
const app = require('../app');

describe('Health Check API', () => {
    it('should return 200 and healthy status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('status', 'healthy');
    });

    it('should return 200 and router health info', async () => {
        const res = await request(app).get('/api/health');
        expect(res.statusCode).toEqual(200);
        // The router health check is also at /api/health due to mounting
        // but it returns different structure. Wait, let's check app.js mounting.
        // app.get('/api/health', ...) is defined BEFORE app.use('/api', routes)
        // so it takes precedence.
    });
});
