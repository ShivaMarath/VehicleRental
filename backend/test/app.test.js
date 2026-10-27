const { test, before, after } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const path = require('path');
const { createApp } = require('../app');

let server, db, base;

before(async () => {
  const dbPath = path.join(os.tmpdir(), `rental-test-${Date.now()}.db`);
  const created = createApp(dbPath);
  db = created.db;
  await new Promise((resolve) => { server = created.app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server.close(); db.close(); });

const post = (url, body) => fetch(base + url, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});

test('health', async () => {
  const r = await fetch(`${base}/health`);
  assert.deepStrictEqual(await r.json(), { status: 'ok' });
});

test('booking flow', async () => {
  const vehicles = await (await fetch(`${base}/api/vehicles`)).json();
  const v = vehicles[0];
  const r = await post('/api/bookings', { vehicle_id: v.id, customer: 'Test', days: 2 });
  assert.strictEqual(r.status, 201);
  const b = await r.json();
  assert.strictEqual(b.total_price, v.price_per_day * 2);

  const dup = await post('/api/bookings', { vehicle_id: v.id, customer: 'X', days: 1 });
  assert.strictEqual(dup.status, 409);

  const ret = await post(`/api/bookings/${b.id}/return`);
  assert.strictEqual(ret.status, 200);
});

test('validation', async () => {
  const r = await post('/api/bookings', { vehicle_id: 1, customer: '', days: 0 });
  assert.strictEqual(r.status, 400);
});

test('metrics exposed', async () => {
  const text = await (await fetch(`${base}/metrics`)).text();
  assert.ok(text.includes('rental_bookings_total'));
  assert.ok(text.includes('rental_vehicles_available'));
});
