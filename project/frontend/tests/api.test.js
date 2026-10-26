import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { request, ApiError, redact } from '../src/api.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('attaches bearer authentication and JSON while redacting request and response secrets', async () => {
  let log;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/login');
    assert.equal(options.headers.Authorization, 'Bearer current-session');
    assert.equal(JSON.parse(options.body).password, 'secret-password');
    return Response.json({ access_token: 'new-session', expires_in: 100 });
  };
  const result = await request('/auth/login', { method: 'POST', token: 'current-session', body: { password: 'secret-password' }, onComplete: (value) => { log = value; } });
  assert.equal(result.access_token, 'new-session');
  assert.equal(log.body.password, '[redacted]');
  assert.equal(log.data.access_token, '[redacted]');
  assert.equal(log.status, 200);
  assert.equal(log.authenticated, true);
});

test('handles logout with an empty 204 response', async () => {
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await request('/auth/logout', { method: 'POST' }), null);
});

test('preserves backend validation errors and status in the inspector', async () => {
  let log;
  globalThis.fetch = async () => Response.json({ detail: [{ loc: ['body', 'credits'], msg: 'Input should be greater than 0' }] }, { status: 422 });
  await assert.rejects(request('/credits/spend', { onComplete: (value) => { log = value; } }), (error) => error instanceof ApiError && error.status === 422 && /body.credits/.test(error.message));
  assert.equal(log.status, 422);
  assert.equal(log.data.detail.length, 1);
});

test('reports network failures as an inspectable error', async () => {
  let log;
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(request('/credits/plans', { onComplete: (value) => { log = value; } }), /Cannot reach the backend/);
  assert.equal(log.status, 0);
  assert.match(log.data.error, /Cannot reach/);
});

test('rejects external URLs and traversal before sending credentials', async () => {
  globalThis.fetch = async () => { assert.fail('fetch should not be called'); };
  await assert.rejects(request('https://example.com/auth/login', { token: 'secret' }));
  await assert.rejects(request('/auth/../../external', { token: 'secret' }));
});

test('redacts secrets recursively without mutating input', () => {
  const input = { users: [{ name: 'Owner', password: 'secret' }], authorization: 'Bearer secret' };
  assert.deepEqual(redact(input), { users: [{ name: 'Owner', password: '[redacted]' }], authorization: '[redacted]' });
  assert.equal(input.users[0].password, 'secret');
});
