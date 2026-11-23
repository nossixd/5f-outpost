const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/server');
const { createOrderStore } = require('../src/orders');

async function listeningServer(t, options = {}) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

function completionRequest(base, id, body = {}, headers = { 'Content-Type': 'application/json' }) {
  return fetch(`${base}/api/orders/${encodeURIComponent(id)}/complete`, {
    method: 'PATCH',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('FR-01: zakończenie zapisuje status i czas, odczyt zachowuje je, ponowienie konfliktuje', async t => {
  const base = await listeningServer(t);
  const before = await (await fetch(`${base}/api/delays`)).json();
  const selectedOrder = before.orders.find(order => order.id === 'TR-001');
  assert.equal(selectedOrder.transportStatus, 'in_progress');

  const response = await completionRequest(base, selectedOrder.id, {}, {
    'Content-Type': 'application/json',
    'X-User-Id': 'forged-browser-user',
  });
  assert.equal(response.status, 200);
  const { order } = await response.json();
  assert.equal(order.transportStatus, 'completed');
  assert.equal(order.status, 'completed');
  assert.equal(order.delayStatus, 'at_risk');
  assert.equal(order.completedBy, null);
  assert.ok(Number.isFinite(Date.parse(order.completedAt)));

  const refreshed = await (await fetch(`${base}/api/delays`)).json();
  assert.equal(refreshed.orders[0].transportStatus, 'completed');
  assert.equal(refreshed.orders[0].completedAt, order.completedAt);
  assert.equal((await completionRequest(base, selectedOrder.id)).status, 409);
});

test('FR-01: dwa równoczesne żądania dają jedno powodzenie i jeden konflikt', async t => {
  const base = await listeningServer(t);
  const responses = await Promise.all([
    completionRequest(base, 'TR-002'),
    completionRequest(base, 'TR-002'),
  ]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const result = await (await fetch(`${base}/api/delays`)).json();
  assert.equal(result.orders[1].transportStatus, 'completed');
  assert.ok(result.orders[1].completedAt);
});

test('FR-01: nieznane zlecenie, nieprawidłowe żądanie i brak uprawnienia', async t => {
  const base = await listeningServer(t);
  assert.equal((await completionRequest(base, 'missing')).status, 404);
  assert.equal((await completionRequest(base, 'TR-001', '{')).status, 400);
  assert.equal((await completionRequest(base, 'TR-001', { userId: 'pretend-user' })).status, 400);
  assert.equal((await fetch(`${base}/api/orders/%00/complete`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })).status, 400);
  assert.equal((await completionRequest(base, 'TR-001', {}, { 'Content-Type': 'text/plain' })).status, 415);

  const denied = await listeningServer(t, { authorizeCompletion: () => null });
  assert.equal((await completionRequest(denied, 'TR-001')).status, 403);
  const unchanged = await (await fetch(`${denied}/api/delays`)).json();
  assert.equal(unchanged.orders[0].transportStatus, 'in_progress');

  const postgresDenied = await listeningServer(t, { mode: 'postgres' });
  assert.equal((await completionRequest(postgresDenied, 'TR-001')).status, 403);
});

function mockPostgresPool() {
  const row = {
    id: 'PG-1', route: 'Test → Trasa', planned_at: new Date('2026-11-02T12:00:00Z'),
    eta: new Date('2026-11-02T12:05:00Z'), eta_reliable: true, decision: null, decision_at: null,
    status: 'in_progress', completed_at: null, completed_by: null,
  };
  const queries = [];
  return {
    row, queries,
    async query(sql, values = []) {
      queries.push({ sql, values });
      if (sql.includes("SET status = 'completed'")) {
        if (row.id !== values[0] || row.status !== 'in_progress') return { rows: [], rowCount: 0 };
        row.status = 'completed';
        row.completed_at = new Date();
        row.completed_by = values[1];
        return { rows: [{ ...row, order_id: 1 }], rowCount: 1 };
      }
      if (sql.includes('SELECT status FROM "order"')) {
        return row.id === values[0] ? { rows: [{ status: row.status }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (sql.includes('FROM "order" ORDER BY order_id')) return { rows: [{ ...row }], rowCount: 1 };
      throw new Error('Nieoczekiwane zapytanie testowe.');
    },
  };
}

test('FR-01: adapter PostgreSQL używa warunkowego parametryzowanego zapisu i odtwarza stan', async t => {
  const pool = mockPostgresPool();
  const options = {
    mode: 'postgres',
    store: createOrderStore('postgres', { pool }),
    authorizeCompletion: () => ({ userId: 'trusted-user' }),
  };
  const base = await listeningServer(t, options);
  const response = await completionRequest(base, 'PG-1');
  assert.equal(response.status, 200);
  const { order } = await response.json();
  assert.equal(order.transportStatus, 'completed');
  assert.equal(order.status, 'completed');
  assert.equal(order.completedBy, 'trusted-user');
  assert.ok(order.completedAt);
  const write = pool.queries.find(query => query.sql.includes("SET status = 'completed'"));
  assert.match(write.sql, /WHERE \(legacy_order_id = \$1 OR \(legacy_order_id IS NULL AND order_id::text = \$1\)\) AND status = 'in_progress'/);
  assert.deepEqual(write.values, ['PG-1', 'trusted-user']);

  const restartedStore = createOrderStore('postgres', { pool });
  const restored = await restartedStore.list();
  assert.equal(restored[0].transportStatus, 'completed');
  assert.equal(restored[0].completedAt, order.completedAt);
});

test('FR-01: błąd PostgreSQL zwraca 503 bez szczegółów połączenia', async t => {
  const pool = { query: async () => { throw new Error('tajny szczegół połączenia'); } };
  const base = await listeningServer(t, {
    mode: 'postgres',
    store: createOrderStore('postgres', { pool }),
    authorizeCompletion: () => ({ userId: 'trusted-user' }),
  });
  const response = await completionRequest(base, 'PG-1');
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('tajny szczegół połączenia'), false);
});
