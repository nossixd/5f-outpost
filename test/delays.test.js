const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateDelay } = require('../src/delays');
const { createServer } = require('../src/server');
const order = { id: 'T1', plannedAt: '2026-11-02T12:00:00Z', eta: '2026-11-02T12:20:00Z', etaReliable: true };
test('FR-02: przekroczenie progu generuje oznaczenie i alert ze szczegółami', () => {
  const result = evaluateDelay(order, 5);
  assert.equal(result.status, 'at_risk'); assert.equal(result.notification.orderId, 'T1');
  assert.equal(result.plannedAt, order.plannedAt); assert.equal(result.eta, order.eta); assert.equal(result.delayMinutes, 20);
  assert.deepEqual(evaluateDelay(order, 5), result);
});
test('granica progu, wcześniejszy przyjazd i różne strefy czasowe', () => {
  assert.equal(evaluateDelay(order, 20).notification, null);
  assert.equal(evaluateDelay({ ...order, eta: '2026-11-02T11:00:00Z' }, 0).delayMinutes, 0);
  assert.equal(evaluateDelay({ ...order, eta: '2026-11-02T13:00:00+01:00' }, 0).status, 'on_time');
});
test('brak lub niewiarygodne dane nie powodują zgadywania opóźnienia', () => {
  for (const change of [{ eta: null }, { plannedAt: null }, { etaReliable: false }, { eta: 'bad' }, { eta: '2026-11-02T12:20:00' }]) {
    const result = evaluateDelay({ ...order, ...change }, 5);
    assert.equal(result.status, 'missing_data'); assert.equal(result.delayMinutes, null); assert.equal(result.notification, null);
  }
});
test('nieprawidłowy próg jest odrzucany', () => {
  for (const threshold of [-1, NaN, Infinity, 1441]) assert.throws(() => evaluateDelay(order, threshold), RangeError);
});
test('HTTP: demo, walidacja, statyczny widok, szczegóły i błędy', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const data = await (await fetch(`${base}/api/delays?threshold=5`)).json();
  assert.equal(data.orders[0].notification.orderId, 'TR-001');
  assert.equal(data.orders.filter(o => o.notification).length, 3); assert.equal(data.orders[3].status, 'missing_data');
  for (const asset of ['/', '/app.js', '/style.css']) assert.equal((await fetch(base + asset)).status, 200);
  assert.equal((await fetch(base + '/no-such-file')).status, 404);
  assert.equal((await fetch(base + '/api/delays', { method: 'POST' })).status, 405);
});
test('HTTP: awaria źródła jest jawna i nie ujawnia sekretów', async t => {
  const server = createServer({ getOrders: async () => { throw new Error('secret'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/delays`);
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('secret'), false);
});


test('HTTP: zatwierdzenie, odrzucenie i zmiana ETA są zapisywane i ponownie oceniane', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function patch(id, body) {
    return fetch(`${base}/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
  let response = await patch('TR-001', { action: 'approve' });
  assert.equal(response.status, 200);
  let data = await response.json();
  assert.equal(data.orders[0].decision, 'approved');
  assert.ok(data.orders[0].decisionAt); assert.equal(data.orders[0].notification, null);
  data = await (await patch('TR-002', { action: 'reject' })).json();
  assert.equal(data.orders[1].decision, 'rejected'); assert.equal(data.orders[1].notification, null);
  data = await (await fetch(base + '/api/delays')).json();
  assert.equal(data.orders.filter(o => o.notification).length, 1);
  data = await (await patch('TR-003', { action: 'reschedule', eta: '2026-11-02T14:55:00Z' })).json();
  assert.equal(data.orders[2].status, 'on_time'); assert.equal(data.orders[2].notification, null);
  data = await (await patch('TR-001', { action: 'reschedule', eta: '2026-11-02T14:00:00Z' })).json();
  assert.equal(data.orders[0].decision, null); assert.ok(data.orders[0].notification);
  assert.equal((await patch('TR-001', { action: 'reschedule', eta: 'bad' })).status, 400);
  assert.equal((await patch('TR-001', { action: 'delete' })).status, 400);
  assert.equal((await patch('missing', { action: 'approve' })).status, 404);
});
