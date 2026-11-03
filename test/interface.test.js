const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { evaluateDelay } = require('../src/delays');

// Minimalny DOM pozwala sprawdzić zdarzenia formularza bez zależności przeglądarkowych.
function setup() {
  function element() {
    return { children: [], listeners: {}, textContent: '', value: '5',
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      addEventListener(event, handler) { this.listeners[event] = handler; },
      checkValidity() { return this.value !== '' && Number.isFinite(Number(this.value)) && Number(this.value) >= 0 && Number(this.value) <= 1440; },
      showModal() { this.open = true; },
    };
  }
  const elements = Object.fromEntries(['threshold', 'error', 'alerts', 'orders', 'filters', 'source', 'evaluation-status', 'details', 'detail-content'].map(id => [id, element()]));
  const button = element(); elements.filters.querySelector = () => button;
  const requests = [];
  vm.runInNewContext(readFileSync('public/app.js', 'utf8'), {
    document: { getElementById: id => elements[id], createElement: element },
    fetch: url => new Promise(resolve => requests.push({ url, resolve })),
  });
  async function complete(index) {
    const threshold = Number(new URL(requests[index].url, 'http://localhost').searchParams.get('threshold'));
    const order = evaluateDelay({ id: 'TR-001', route: 'Warszawa → Kraków', plannedAt: '2026-11-02T13:00:00Z', eta: '2026-11-02T13:25:00Z', etaReliable: true }, threshold);
    requests[index].resolve({ ok: true, json: async () => ({ mode: 'demo', thresholdMinutes: threshold, orders: [order] }) });
    await new Promise(resolve => setImmediate(resolve));
  }
  return { elements, requests, complete };
}

test('interfejs: próg 5 → 25 → 5 automatycznie zmienia alert i otwiera szczegóły', async () => {
  const { elements, complete } = setup();
  await complete(0);
  assert.equal(elements.alerts.children[0].className, 'alert');
  elements.alerts.children[0].listeners.click({ preventDefault() {} });
  assert.equal(elements.details.open, true);
  elements.threshold.value = '25'; elements.threshold.listeners.input();
  await complete(1);
  assert.match(elements['evaluation-status'].textContent, /25 min.*alertów: 0/);
  elements.threshold.value = '5'; elements.threshold.listeners.input();
  await complete(2);
  assert.match(elements['evaluation-status'].textContent, /5 min.*alertów: 1/);
  assert.equal(elements.alerts.children[0].className, 'alert');
});

test('interfejs: spóźniona odpowiedź nie nadpisuje nowszej oceny', async () => {
  const { elements, complete } = setup();
  elements.threshold.value = '25'; elements.threshold.listeners.input();
  await complete(1); await complete(0);
  assert.match(elements['evaluation-status'].textContent, /25 min.*alertów: 0/);
});

test('interfejs: ponowna ocena nie usuwa widocznych wyników podczas odczytu', async () => {
  const { elements, complete } = setup();
  await complete(0);
  const alert = elements.alerts.children[0];
  const row = elements.orders.children[0];
  elements.filters.listeners.submit({ preventDefault() {} });
  assert.equal(elements.alerts.children[0], alert);
  assert.equal(elements.orders.children[0], row);
  await complete(1);
  assert.match(elements['evaluation-status'].textContent, /5 min.*alertów: 1/);
});
