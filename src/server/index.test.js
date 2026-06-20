const request = require('supertest');
const app = require('./index');

describe('Health Check', () => {
  it('should return 200 on /health', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('API', () => {
  it('should return 200 on /api', async () => {
    const res = await request(app).get('/api');
    expect(res.statusCode).toBe(200);
  });
});
