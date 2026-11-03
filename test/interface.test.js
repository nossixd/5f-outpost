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
  const ids = ['error','alerts','orders','details','detail-content','detail-actions','detail-error','notifications','notification-list','notification-count','open-notifications','refresh','eta-dialog','eta-order','eta-input','eta-error','eta-form','eta-cancel'];
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
      await store.update(request.url.split('/').at(-1), command.action, command.eta);
    }
    const orders = (await store.list()).map(order => evaluateDelay(order, 5));
    request.resolve({ ok: !failure, json: async () => failure ? { error: 'Błąd zapisu' } : { orders } });
    await new Promise(resolve => setImmediate(resolve));
  }
  return { elements, requests, complete };
}
const click = element => element.listeners.click();
const cardActions = card => card.children[2].children;
test('interfejs: trzy alerty, zatwierdzenie i odrzucenie', async () => {
  const { elements, complete } = setup(); await complete(0);
  assert.equal(elements['notification-count'].textContent, '3');
  click(cardActions(elements.alerts.children[0])[0]); await complete(1);
  assert.equal(elements['notification-count'].textContent, '2');
  assert.equal(elements.orders.children[0].children[3].children[0].textContent, 'Zatwierdzono opóźnienie');
  click(cardActions(elements.alerts.children[0])[1]); await complete(2);
  assert.equal(elements['notification-count'].textContent, '1');
  assert.equal(elements.orders.children[1].children[3].children[0].textContent, 'Odrzucono alert');
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
