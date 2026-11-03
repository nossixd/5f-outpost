const byId = id => document.getElementById(id);
const labels = { at_risk: 'Ryzyko opóźnienia', on_time: 'W terminie', missing_data: 'Brak wiarygodnych danych', eta_update_required: 'Wymaga aktualizacji ETA' };
function statusLabel(order) {
  if (order.status === 'eta_update_required') return labels.eta_update_required;
  if (order.decision === 'approved') return `Opóźnienie potwierdzone · ${minutes(order.delayMinutes)} min`;
  return labels[order.status];
}
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pl-PL') : 'Brak danych';
const minutes = value => new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value);
let latestRequest = 0;
let saving = false;
let editingOrder = null;
function element(tag, value, className) {
  const el = document.createElement(tag);
  if (value !== undefined) el.textContent = value;
  if (className) el.className = className;
  return el;
}
function button(text, className, handler) {
  const el = element('button', text, className); el.type = 'button';
  el.addEventListener('click', handler); return el;
}
function closeDialogs() {
  for (const id of ['notifications', 'details', 'eta-dialog']) if (byId(id).open) byId(id).close();
}
function actions(order) {
  const group = element('div', undefined, 'card-actions');
  if (order.status === 'at_risk' && !order.decision) {
    group.append(button('Zatwierdź opóźnienie', 'approve order-action', () => save(order.id, { action: 'approve' })),
      button('Odrzuć prognozę', 'reject order-action', () => save(order.id, { action: 'reject' })));
  }
  group.append(button('Zmień czas', 'secondary order-action', () => editTime(order)));
  return group;
}
function openDetails(order) {
  closeDialogs();
  const content = byId('detail-content'); content.replaceChildren();
  for (const [label, value] of [['Zlecenie', order.id], ['Trasa', order.route], ['Planowana dostawa', date(order.plannedAt)], [order.status === 'eta_update_required' ? 'Odrzucona prognoza ETA' : 'Przewidywany przyjazd (ETA)', date(order.eta)], ['Stan', statusLabel(order)], ['Przewidywane opóźnienie', order.delayMinutes === null ? 'Brak danych' : `${minutes(order.delayMinutes)} min`]]) {
    content.append(element('dt', label), element('dd', value));
  }
  byId('detail-actions').replaceChildren(actions(order));
  byId('details').showModal();
}
function editTime(order) {
  if (saving) return;
  closeDialogs(); editingOrder = order;
  byId('eta-order').textContent = `${order.id} · ${order.route}`;
  const value = new Date(order.eta || order.plannedAt);
  byId('eta-input').value = Number.isFinite(value.getTime())
    ? new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
  byId('eta-error').textContent = '';
  byId('eta-dialog').showModal();
}
function alertCard(order) {
  const needsUpdate = order.status === 'eta_update_required';
  const card = element('article', undefined, needsUpdate ? 'alert-card needs-update' : 'alert-card');
  const heading = element('div', undefined, 'card-heading');
  const text = element('div', undefined, 'alert-description');
  text.append(element('strong', order.id), element('p', order.route));
  heading.append(text, element('span', needsUpdate ? 'Wymaga aktualizacji ETA' : `+${minutes(order.delayMinutes)} min`, needsUpdate ? 'update-badge' : 'delay-badge'));
  const times = element('p', needsUpdate
    ? `Prognoza została odrzucona. Podaj poprawny czas przyjazdu. Plan dostawy: ${date(order.plannedAt)}.`
    : `Plan: ${date(order.plannedAt)} · ETA: ${date(order.eta)}`, 'card-times');
  const controls = actions(order);
  controls.append(button('Szczegóły', 'secondary alert', () => openDetails(order)));
  card.append(heading, times, controls);
  return card;
}
function render(data) {
  const rows = [];
  for (const order of data.orders) {
    const row = document.createElement('tr');
    const name = element('td'); name.append(element('strong', order.id), element('small', order.route));
    row.append(name, element('td', date(order.plannedAt)), element('td', order.status === 'eta_update_required' ? 'Prognoza odrzucona' : order.etaReliable ? date(order.eta) : 'Brak wiarygodnego ETA'));
    const status = element('td'); status.append(element('span', statusLabel(order), `status-badge ${order.status === 'eta_update_required' ? order.status : order.decision || order.status}`));
    if (order.decisionAt) status.append(element('small', date(order.decisionAt)));
    const control = element('td'); control.append(button('Zmień czas', 'secondary order-action', () => editTime(order)));
    row.append(status, control); rows.push(row);
  }
  const risky = data.orders.filter(order => order.notification);
  byId('notification-count').textContent = String(risky.length);
  for (const id of ['alerts', 'notification-list']) {
    const cards = risky.map(alertCard);
    if (!cards.length) cards.push(element('p', 'Brak dostaw wymagających uwagi.', 'empty-state'));
    byId(id).replaceChildren(...cards);
  }
  if (!rows.length) {
    const row = document.createElement('tr'); const cell = element('td', 'Brak zleceń.'); cell.colSpan = 5; row.append(cell); rows.push(row);
  }
  byId('orders').replaceChildren(...rows);
}
async function refresh() {
  if (saving) return;
  const requestId = ++latestRequest;
  byId('error').textContent = ''; byId('refresh').disabled = true;
  try {
    const response = await fetch('/api/delays'); const data = await response.json();
    if (requestId !== latestRequest) return;
    if (!response.ok) throw new Error(data.error);
    render(data);
  } catch (error) {
    if (requestId === latestRequest) byId('error').textContent = error.message || 'Nie udało się pobrać danych.';
  } finally { if (requestId === latestRequest) byId('refresh').disabled = false; }
}
async function save(id, command) {
  if (saving) return;
  saving = true; ++latestRequest;
  byId('error').textContent = ''; byId('eta-error').textContent = ''; byId('detail-error').textContent = '';
  const controls = document.querySelectorAll('button'); controls.forEach(control => { control.disabled = true; });
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    closeDialogs(); render(data);
  } catch (error) {
    const message = error.message || 'Nie udało się zapisać zmiany. Spróbuj ponownie.';
    byId('error').textContent = message; byId('eta-error').textContent = message; byId('detail-error').textContent = message;
  } finally { saving = false; controls.forEach(control => { control.disabled = false; }); byId('refresh').disabled = false; }
}
byId('open-notifications').addEventListener('click', () => byId('notifications').showModal());
byId('refresh').addEventListener('click', refresh);
byId('eta-cancel').addEventListener('click', closeDialogs);
byId('eta-form').addEventListener('submit', event => {
  event.preventDefault();
  const value = new Date(byId('eta-input').value);
  if (!byId('eta-input').checkValidity() || !Number.isFinite(value.getTime())) {
    byId('eta-error').textContent = 'Podaj prawidłowy czas przyjazdu.'; return;
  }
  save(editingOrder.id, { action: 'reschedule', eta: value.toISOString() });
});
refresh();
