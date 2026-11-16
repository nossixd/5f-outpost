const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { evaluateDelay } = require('../src/delays');
const { createOrderStore } = require('../src/orders');
function setup() {
  function element() {
    return { children: [], listeners: {}, textContent: '', value: '',
      append(...nodes) { this.children.push(...nodes); },
      replaceChildren(...nodes) { this.children = nodes; },
      addEventListener(event, handler) { this.listeners[event] = handler; },
      checkValidity() { return !!this.value; },
      showModal() { this.open = true; }, close() { this.open = false; },
    };
  }
  const ids = ['error','success','alerts','orders','details','detail-content','detail-actions','detail-error','notifications','notification-list','notification-count','open-notifications','refresh','eta-dialog','eta-order','eta-input','eta-error','eta-form','eta-cancel','complete-dialog','complete-confirmation','complete-error','complete-confirm','complete-cancel'];
  const elements = Object.fromEntries(ids.map(id => [id, element()]));
  const requests = []; const store = createOrderStore('demo');
  vm.runInNewContext(readFileSync('public/app.js', 'utf8'), {
    document: { getElementById: id => elements[id], createElement: element, querySelectorAll: () => [] },
    fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })),
  });
  async function complete(index, failure = false) {
    const request = requests[index];
    if (request.options && !failure) {
      const command = JSON.parse(request.options.body);
      const parts = request.url.split('/');
      const isCompletion = parts.at(-1) === 'complete';
      const id = parts.at(isCompletion ? -2 : -1);
      if (isCompletion) await store.complete(id);
      else await store.update(id, command.action, command.eta);
    }
    const orders = (await store.list()).map(order => evaluateDelay(order, 5));
    const id = request.url.split('/').at(request.url.endsWith('/complete') ? -2 : -1);
    request.resolve({ ok: !failure, json: async () => failure ? { error: 'Błąd zapisu' } : { orders, order: orders.find(order => order.id === id) } });
    await new Promise(resolve => setImmediate(resolve));
  }
  return { elements, requests, complete, store };
}
const click = element => element.listeners.click();
const cardActions = card => card.children[2].children;
test('interfejs: trzy alerty, zatwierdzenie i odrzucenie', async () => {
  const { elements, complete } = setup(); await complete(0);
  assert.equal(elements['notification-count'].textContent, '3');
  click(cardActions(elements.alerts.children[0])[0]); await complete(1);
  assert.equal(elements['notification-count'].textContent, '2');
  assert.equal(elements.orders.children[0].children[3].children[0].textContent, 'Opóźnienie potwierdzone · 25 min');
  click(cardActions(elements.alerts.children[0])[1]); await complete(2);
  assert.equal(elements['notification-count'].textContent, '2');
  assert.equal(elements.orders.children[1].children[3].children[0].textContent, 'Wymaga aktualizacji ETA');
  assert.equal(elements.orders.children[1].children[2].textContent, 'Prognoza odrzucona');
  const controls = cardActions(elements.alerts.children[0]);
  assert.deepEqual(controls.map(control => control.textContent), ['Zmień czas', 'Szczegóły']);
  click(controls[0]);
  elements['eta-input'].value = '2026-11-02T12:00';
  elements['eta-form'].listeners.submit({ preventDefault() {} }); await complete(3);
  assert.equal(elements['notification-count'].textContent, '1');
  assert.equal(elements.orders.children[1].children[3].children[0].textContent, 'W terminie');
});
test('interfejs: górne Powiadomienia, szczegóły i edycja ETA', async () => {
  const { elements, complete } = setup(); await complete(0);
  click(elements['open-notifications']); assert.equal(elements.notifications.open, true);
  click(cardActions(elements['notification-list'].children[0])[3]);
  assert.equal(elements.notifications.open, false); assert.equal(elements.details.open, true);
  click(elements['detail-actions'].children[0].children[2]);
  assert.equal(elements.details.open, false); assert.equal(elements['eta-dialog'].open, true);
  elements['eta-input'].value = '2026-11-02T12:00';
  elements['eta-form'].listeners.submit({ preventDefault() {} }); await complete(1);
  assert.equal(elements['eta-dialog'].open, false);
  assert.equal(elements['notification-count'].textContent, '2');
});
test('interfejs: błąd zapisu nie usuwa alertu i pozwala ponowić akcję', async () => {
  const { elements, complete } = setup(); await complete(0);
  click(cardActions(elements.alerts.children[0])[0]); await complete(1, true);
  assert.equal(elements['notification-count'].textContent, '3'); assert.equal(elements.error.textContent, 'Błąd zapisu');
  click(cardActions(elements.alerts.children[0])[0]); await complete(2);
  assert.equal(elements['notification-count'].textContent, '2');
});

test('interfejs: potwierdzenie zakończenia, anulowanie i oznaczenie udanego zapisu', async () => {
  const { elements, requests, complete, store } = setup(); await complete(0);
  const actions = elements.orders.children[0].children[5].children;
  assert.equal(actions[0].textContent, 'Zakończ transport');
  click(actions[0]);
  assert.equal(elements['complete-dialog'].open, true);
  assert.match(elements['complete-confirmation'].textContent, /TR-001/);
  assert.equal((await store.list())[0].transportStatus, 'in_progress');
  assert.equal(requests.length, 1);
  click(elements['complete-cancel']);
  assert.equal(elements['complete-dialog'].open, false);

  click(elements.orders.children[0].children[5].children[0]);
  click(elements['complete-confirm']);
  assert.equal(requests.length, 2);
  await complete(1);
  assert.equal(elements['complete-dialog'].open, false);
  assert.match(elements.success.textContent, /Transport TR-001 zakończono/);
  assert.equal(elements.orders.children[0].children[4].children[0].textContent, 'Zakończono');
  assert.equal(elements.orders.children[0].children[5].children.length, 1);
});
