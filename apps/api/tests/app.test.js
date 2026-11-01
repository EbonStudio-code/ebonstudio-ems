import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, createApp } from '../src/app.js';

test('GET /api/v1/health/live returns healthy status', async () => {
  await request(app)
    .get('/api/v1/health/live')
    .expect(200)
    .expect('Content-Type', /json/)
    .expect({ data: { status: 'ok' } });
});

test('Unknown route returns a JSON 404', async () => {
  await request(app)
    .get('/not-a-route')
    .expect(404)
    .expect('Content-Type', /json/)
    .expect(res => {
      assert.deepEqual(res.body.error, { code: 'NOT_FOUND', message: 'Route not found' });
      assert.match(res.body.requestId, /^[a-f0-9-]{36}$/);
      assert.equal(res.body.requestId, res.headers['x-request-id']);
    });
});

test('Liveness uses secure headers without requiring a database', async () => {
  const result = await request(app).get('/api/v1/health/live').expect(200);
  assert.equal(result.headers['x-content-type-options'], 'nosniff');
  assert.equal(result.headers['referrer-policy'], 'no-referrer');
  assert.equal(result.headers['cache-control'], 'private, no-store');
  assert.equal(result.headers['x-powered-by'], undefined);
});
test('Readiness returns a redacted 503 when the database is unavailable', async () => {
  const instance = createApp({ pool: { query: async () => { throw new Error('sensitive connection detail'); } } });
  const result = await request(instance).get('/api/v1/health/ready').expect(503);
  assert.equal(result.body.error.code, 'NOT_READY');
  assert.ok(!result.text.includes('sensitive'));
});
