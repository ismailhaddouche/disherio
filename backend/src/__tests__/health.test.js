import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { setupDB, teardownDB } from './setup.js';
import app from '../app.js';

beforeAll(async () => {
    await setupDB();
});

afterAll(async () => {
    await teardownDB();
});

describe('Health Check API', () => {
    it('should return 200 and status ok', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('should include installMode', async () => {
        const res = await request(app).get('/api/health');
        expect(res.body.installMode).toBeDefined();
    });

    it('should include baseUrl', async () => {
        const res = await request(app).get('/api/health');
        expect(res.body.baseUrl).toBeDefined();
    });
});

describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
        const res = await request(app).get('/api/nonexistent-route');
        expect(res.status).toBe(404);
    });
});
