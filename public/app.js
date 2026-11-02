const byId = id => document.getElementById(id);
const labels = { at_risk: 'Ryzyko opóźnienia', on_time: 'Bez przekroczenia progu', missing_data: 'Brak wystarczających danych' };
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('pl-PL') : 'Brak danych';
function element(tag, value) { const el = document.createElement(tag); el.textContent = value; return el; }
function openDetails(order) {
  const content = byId('detail-content'); content.replaceChildren();
  for (const [label, value] of [['Zlecenie', order.id], ['Trasa', order.route], ['Planowana dostawa', date(order.plannedAt)], ['ETA', date(order.eta)], ['Opóźnienie', `${Math.round(order.delayMinutes * 100) / 100} min`]]) {
    content.append(element('dt', label), element('dd', value));
  }
  byId('details').showModal();
}
async function refresh(event) {
  event?.preventDefault();
  byId('error').textContent = '';
  byId('alerts').replaceChildren(); byId('orders').replaceChildren();
  const button = byId('filters').querySelector('button'); button.disabled = true;
  try {
    const response = await fetch(`/api/delays?threshold=${encodeURIComponent(byId('threshold').value)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    byId('source').textContent = data.mode === 'demo' ? 'Tryb demonstracyjny — przykładowe, stałe dane z 02.11.2026. Bez połączenia z systemem ETA.' : 'Źródło: PostgreSQL. Ocena na podstawie zapisanych danych ETA.';
    for (const order of data.orders) {
      const row = document.createElement('tr');
      row.append(element('td', `${order.id} · ${order.route}`), element('td', date(order.plannedAt)), element('td', order.etaReliable ? date(order.eta) : 'Brak wiarygodnego ETA'));
      const status = element('td', labels[order.status]); status.className = order.status; row.append(status); byId('orders').append(row);
      if (order.notification) {
        const alert = element('button', `${order.notification.message} — szczegóły`);
        alert.className = 'alert'; alert.addEventListener('click', () => openDetails(order)); byId('alerts').append(alert);
      }
    }
    if (!byId('alerts').children.length) byId('alerts').append(element('p', 'Brak powiadomień o przekroczeniu progu. Sprawdź również zlecenia bez danych.'));
    if (!data.orders.length) byId('orders').append(element('tr', 'Brak zleceń.'));
  } catch (error) {
    byId('error').textContent = error.message || 'Błąd pobierania danych.';
    byId('source').textContent = 'Dane niedostępne — ocena nie została wykonana.';
  } finally { button.disabled = false; }
}
byId('filters').addEventListener('submit', refresh);
refresh();
