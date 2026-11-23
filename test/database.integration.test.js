const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
require('dotenv').config();
const { createServer } = require('../src/server');
const { createOrderStore } = require('../src/orders');
const { createFleetStore } = require('../src/fleet');

const connectionString = process.env.TEST_DATABASE_URL;
const migration005 = readFileSync(path.join(__dirname, '../src/database/migrations/005-erd-schema.sql'), 'utf8');

async function openIsolatedTestPool() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString });
  try {
    const { rows } = await pool.query('SELECT current_database() AS database_name');
    if (!/^outpost_test(?:_|$)/.test(rows[0].database_name)) {
      throw new Error('TEST_DATABASE_URL musi wskazywać wyłącznie dedykowaną bazę outpost_test.');
    }
  } catch (error) {
    await pool.end();
    throw error;
  }
  return pool;
}

function listen(t, server) {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      t.after(() => new Promise(done => server.close(done)));
      resolve(`http://127.0.0.1:${server.address().port}`);
    });
  });
}

test('PostgreSQL: migracja ERD kopiuje stare dane, jest idempotentna i flota widzi pięć pojazdów', {
  skip: connectionString ? false : 'Ustaw TEST_DATABASE_URL na osobnej bazie outpost_test.',
}, async t => {
  const pool = await openIsolatedTestPool();
  t.after(() => pool.end());

  const prerequisites = await pool.query(`
    SELECT to_regclass('public.transport_orders') AS orders,
           to_regclass('public.vehicles') AS vehicles,
           to_regclass('public.vehicle_routes') AS routes,
           to_regclass('public.vehicle_locations') AS locations`);
  assert.ok(Object.values(prerequisites.rows[0]).every(Boolean),
    'Najpierw utwórz testowy schemat bazowy i uruchom migracje 003 oraz 004.');

  await pool.query(migration005);
  const sourceVehicles = await pool.query(`
    SELECT v.id, v.registration, v.model, v.active,
           erd.vehicle_id, erd.registration_number, erd.brand,
           erd.model AS erd_model, erd.active AS erd_active
    FROM vehicles v LEFT JOIN vehicle erd ON erd.legacy_vehicle_id = v.id
    ORDER BY v.id`);
  assert.equal(sourceVehicles.rows.length, 5);
  assert.ok(sourceVehicles.rows.every(row => row.vehicle_id !== null));
  assert.ok(sourceVehicles.rows.every(row => row.registration === row.registration_number
    && row.model === row.erd_model && row.active === row.erd_active));

  const missingOrders = await pool.query(`
    SELECT count(*)::int AS missing
    FROM transport_orders old
    LEFT JOIN "order" erd ON erd.legacy_order_id = old.id
    WHERE erd.order_id IS NULL OR erd.status IS DISTINCT FROM old.status
       OR erd.eta IS DISTINCT FROM old.eta
       OR erd.eta_reliable IS DISTINCT FROM old.eta_reliable
       OR erd.decision IS DISTINCT FROM old.decision
       OR erd.decision_at IS DISTINCT FROM old.decision_at
       OR erd.completed_at IS DISTINCT FROM old.completed_at
       OR erd.completed_by IS DISTINCT FROM old.completed_by`);
  assert.equal(missingOrders.rows[0].missing, 0);

  const missingGps = await pool.query(`
    SELECT count(*)::int AS missing
    FROM vehicle_locations old
    LEFT JOIN gps_location erd ON erd.legacy_location_id = old.id
    WHERE erd.location_id IS NULL OR erd.recorded_at IS DISTINCT FROM old.updated_at
       OR erd.latitude IS DISTINCT FROM old.latitude
       OR erd.longitude IS DISTINCT FROM old.longitude`);
  assert.equal(missingGps.rows[0].missing, 0);

  const missingRoutes = await pool.query(`
    SELECT count(*)::int AS missing
    FROM vehicle_routes old
    LEFT JOIN route erd ON erd.legacy_route_id = old.id
    WHERE erd.route_id IS NULL OR erd.route_data IS DISTINCT FROM old.coordinates`);
  assert.equal(missingRoutes.rows[0].missing, 0);

  const erdTypes = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name, column_name) IN (
        ('vehicle', 'vehicle_id'), ('order', 'order_id'),
        ('route', 'route_id'), ('gps_location', 'location_id'))`);
  const types = Object.fromEntries(erdTypes.rows.map(row => [`${row.table_name}.${row.column_name}`, row.data_type]));
  assert.equal(types['vehicle.vehicle_id'], 'integer');
  assert.equal(types['order.order_id'], 'integer');
  assert.equal(types['route.route_id'], 'integer');
  assert.equal(types['gps_location.location_id'], 'bigint');

  const migratedOrder = await pool.query(`
    SELECT order_id, eta FROM "order"
    WHERE legacy_order_id = (SELECT id FROM transport_orders ORDER BY id LIMIT 1)`);
  const savedEta = migratedOrder.rows[0].eta;
  const newerEta = new Date('2098-01-02T03:04:05.000Z');
  await pool.query('UPDATE "order" SET eta = $2 WHERE order_id = $1', [migratedOrder.rows[0].order_id, newerEta]);
  try {
    await pool.query(migration005);
    const afterRerun = await pool.query('SELECT eta FROM "order" WHERE order_id = $1', [migratedOrder.rows[0].order_id]);
    assert.equal(afterRerun.rows[0].eta.toISOString(), newerEta.toISOString());
  } finally {
    await pool.query('UPDATE "order" SET eta = $2 WHERE order_id = $1', [migratedOrder.rows[0].order_id, savedEta]);
  }

  const fleet = await createFleetStore({ pool }).list();
  assert.equal(fleet.length, 5);
  assert.ok(fleet.every(vehicle => vehicle.location.updatedAt
    && vehicle.route.coordinates.length >= 2 && vehicle.order.id));
  for (const vehicle of fleet) {
    const newest = await pool.query(`
      SELECT max(updated_at) AS recorded_at FROM vehicle_locations
      WHERE vehicle_id = $1`, [vehicle.id]);
    assert.equal(Date.parse(vehicle.location.updatedAt), newest.rows[0].recorded_at.getTime());
  }
});

test('PostgreSQL: zlecenia i flota korzystają ze wspólnego ERD po aktualizacji ETA i zakończeniu', {
  skip: connectionString ? false : 'Ustaw TEST_DATABASE_URL na osobnej bazie outpost_test.',
}, async t => {
  const pool = await openIsolatedTestPool();
  const id = `IT-${randomUUID()}`;
  let inserted = false;
  const store = createOrderStore('postgres', { pool });
  const fleetStore = createFleetStore({ pool });
  const server = createServer({
    mode: 'postgres',
    store,
    fleetStore,
    authorizeCompletion: () => ({ userId: 'integration-test' }),
  });
  const base = await listen(t, server);
  t.after(async () => {
    if (inserted) await pool.query('DELETE FROM "order" WHERE legacy_order_id = $1', [id]);
    await pool.end();
  });

  const vehicle = await pool.query('SELECT vehicle_id FROM vehicle WHERE legacy_vehicle_id = $1', ['VH-001']);
  assert.ok(vehicle.rowCount);
  await pool.query(`
    INSERT INTO "order" (legacy_order_id, vehicle_id, route, planned_at, eta, eta_reliable, status)
    VALUES ($1, $2, $3, $4, $5, true, 'in_progress')`,
  [id, vehicle.rows[0].vehicle_id, 'Testowa trasa', '2099-01-01T10:00:00Z', '2099-01-01T10:15:00Z']);
  inserted = true;
  const orderId = await pool.query('SELECT order_id FROM "order" WHERE legacy_order_id = $1', [id]);
  await pool.query(`
    INSERT INTO route (order_id, route_data, legacy_route_id, active, created_at)
    VALUES ($1, $2::jsonb, $3, true, '2999-01-01T00:00:00Z')`,
  [orderId.rows[0].order_id, JSON.stringify([{ lat: 52.2, lng: 21.0 }, { lat: 50.0, lng: 20.0 }]), `${id}-ROUTE`]);

  const eta = '2099-01-01T11:00:00.000Z';
  const etaResponse = await fetch(`${base}/api/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reschedule', eta }),
  });
  assert.equal(etaResponse.status, 200);
  const delays = await (await fetch(`${base}/api/delays`)).json();
  assert.equal(delays.orders.find(order => order.id === id).eta, eta);

  const completion = await fetch(`${base}/api/orders/${id}/complete`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(completion.status, 200);
  const completed = await (await fetch(`${base}/api/delays`)).json();
  assert.equal(completed.orders.find(order => order.id === id).transportStatus, 'completed');
  const history = await pool.query(`
    SELECT old_status, new_status FROM order_status_history
    WHERE order_id = $1`, [orderId.rows[0].order_id]);
  assert.deepEqual(history.rows, [{ old_status: 'in_progress', new_status: 'completed' }]);

  const fleet = await fleetStore.list();
  const associatedVehicle = fleet.find(vehicleRow => vehicleRow.id === 'VH-001');
  assert.equal(associatedVehicle.order.id, id);
  assert.equal(associatedVehicle.order.status, 'completed');
  assert.equal(associatedVehicle.route.coordinates.length, 2);
});
