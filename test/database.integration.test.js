const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('dotenv').config();
const { createServer } = require('../src/server');
const { createOrderStore } = require('../src/orders');
const { createFleetStore } = require('../src/fleet');

const connectionString = process.env.TEST_DATABASE_URL;

test('PostgreSQL: zakończenie pozostaje zapisane po odtworzeniu magazynu', {
  skip: connectionString ? false : 'Ustaw TEST_DATABASE_URL, aby wykonać test integracyjny na PostgreSQL.',
}, async t => {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString });
  const id = `IT-${randomUUID()}`;
  let server;
  let inserted = false;
  async function start() {
    server = createServer({
      mode: 'postgres',
      store: createOrderStore('postgres', { pool }),
      authorizeCompletion: () => ({ userId: 'integration-test' }),
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
  }

  t.after(async () => {
    await stop();
    if (inserted) await pool.query('DELETE FROM transport_orders WHERE id = $1', [id]);
    await pool.end();
  });
  await pool.query(
    'INSERT INTO transport_orders (id, route, status, eta_reliable) VALUES ($1, $2, $3, $4)',
    [id, 'Test integracyjny', 'in_progress', false]);
  inserted = true;

  let base = await start();
  const response = await fetch(`${base}/api/orders/${id}/complete`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 200);
  const { order } = await response.json();
  assert.equal(order.transportStatus, 'completed');
  assert.ok(order.completedAt);

  await stop();
  base = await start();
  const restored = await (await fetch(`${base}/api/delays`)).json();
  const saved = restored.orders.find(item => item.id === id);
  assert.equal(saved.transportStatus, 'completed');
  assert.equal(saved.completedAt, order.completedAt);
});

test('PostgreSQL: migracja floty udostępnia minimum pięć pojazdów przez API', {
  skip: connectionString ? false : 'Ustaw TEST_DATABASE_URL i wykonaj migracje 003 oraz 004.',
}, async t => {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString });
  const server = createServer({ mode: 'postgres', fleetStore: createFleetStore({ pool }) });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/vehicles`);
  assert.equal(response.status, 200);
  const { vehicles } = await response.json();
  assert.ok(vehicles.length >= 5);
  assert.ok(vehicles.every(vehicle => vehicle.order.id && vehicle.route.coordinates.length >= 2));
});
