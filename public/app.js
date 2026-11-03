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
let latestRequest = 0;
async function refresh(event) {
  event?.preventDefault();
  const requestId = ++latestRequest;
  byId('error').textContent = '';
  const button = byId('filters').querySelector('button');
  if (!byId('threshold').checkValidity()) {
    button.disabled = false;
    byId('evaluation-status').textContent = 'Wpisz próg od 0 do 1440 minut. Wyświetlane wyniki dotyczą poprzedniej oceny.';
    return;
  }
  button.disabled = true;
  byId('evaluation-status').textContent = 'Przeliczanie ryzyka…';
  try {
    const response = await fetch(`/api/delays?threshold=${encodeURIComponent(byId('threshold').value)}`);
    const data = await response.json();
    if (requestId !== latestRequest) return;
    if (!response.ok) throw new Error(data.error);
    byId('source').textContent = data.mode === 'demo' ? 'Tryb demonstracyjny — przykładowe, stałe dane z 02.11.2026. Bez połączenia z systemem ETA.' : 'Źródło: PostgreSQL. Ocena na podstawie zapisanych danych ETA.';
    const rows = [];
    const alerts = [];
    for (const order of data.orders) {
      const row = document.createElement('tr');
      row.append(element('td', `${order.id} · ${order.route}`), element('td', date(order.plannedAt)), element('td', order.etaReliable ? date(order.eta) : 'Brak wiarygodnego ETA'));
      const status = element('td', labels[order.status]); status.className = order.status; row.append(status); rows.push(row);
      if (order.notification) {
        const alert = element('button', `${order.notification.message} — szczegóły`);
        alert.type = 'button';
        alert.className = 'alert'; alert.addEventListener('click', event => { event.preventDefault(); openDetails(order); }); alerts.push(alert);
      }
    }
    const count = data.orders.filter(order => order.notification).length;
    byId('evaluation-status').textContent = `Oceniono dla progu ${data.thresholdMinutes} min. Liczba alertów: ${count}.`;
    if (!alerts.length) alerts.push(element('p', 'Brak powiadomień o przekroczeniu progu. Sprawdź również zlecenia bez danych.'));
    if (!rows.length) {
      const row = document.createElement('tr');
      const cell = element('td', 'Brak zleceń.'); cell.colSpan = 4; row.append(cell); rows.push(row);
    }
    byId('alerts').replaceChildren(...alerts);
    byId('orders').replaceChildren(...rows);
  } catch (error) {
    if (requestId !== latestRequest) return;
    byId('evaluation-status').textContent = 'Ocena nie powiodła się. Poprzednie wyniki są nieaktualne.';
    byId('error').textContent = error.message || 'Błąd pobierania danych.';
    byId('source').textContent = 'Dane niedostępne — ocena nie została wykonana.';
  } finally { if (requestId === latestRequest) button.disabled = false; }
}
byId('filters').addEventListener('submit', refresh);
byId('threshold').addEventListener('input', refresh);
refresh();
