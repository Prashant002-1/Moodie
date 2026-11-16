import request from 'supertest';
import app from '../src/app';

it('does not allow visitors to open the shared demo identity', async () => {
  const response = await request(app).post('/api/auth/demo').set('X-Moodie-Request', '1');
  expect(response.status).toBe(404);
});
