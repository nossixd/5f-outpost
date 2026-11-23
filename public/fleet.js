const fleetById = id => document.getElementById(id);
const executionLabels = { in_progress: 'W realizacji', completed: 'Zakończono' };
const delayLabels = { at_risk: 'Ryzyko opóźnienia', on_time: 'W terminie', missing_data: 'Brak danych ETA', eta_update_required: 'Wymaga aktualizacji ETA' };
let fleetMap = null;
let markersLayer = null;
let routesLayer = null;
let selectedVehicleId = null;
let fleetVehicles = [];
let loading = false;

function node(tag, value, className) {
  const element = document.createElement(tag);
  if (value !== undefined) element.textContent = value;
  if (className) element.className = className;
  return element;
}
function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString('pl-PL') : 'Brak danych';
}
function formatNumber(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value).toFixed(5) : 'Brak danych';
}
function getVehicle(id) { return fleetVehicles.find(vehicle => vehicle.id === id); }
function setMapStatus(message) {
  const status = fleetById('fleet-map-status');
  if (status) status.textContent = message;
}

function popupContent(vehicle) {
  const content = document.createElement('div');
  const title = node('strong', `${vehicle.registration} · ${vehicle.model}`);
  const details = [
    `Zlecenie ${vehicle.order.id}: ${executionLabels[vehicle.order.status] || vehicle.order.status}`,
    `Prędkość: ${vehicle.speedKmh === null ? 'brak danych' : `${vehicle.speedKmh} km/h`}`,
    `GPS: ${vehicle.location.stale ? 'nieaktualny' : 'aktualny'}`,
    `Trasa planowana: ${vehicle.route.name}`,
  ];
  content.append(title, ...details.map(text => node('p', text)));
  return content;
}

function showAllVehicles() {
  selectedVehicleId = null;
  renderVehicleList();
  if (routesLayer) routesLayer.clearLayers();
  fleetById('fleet-details').hidden = true;
  if (fleetMap && markersLayer) {
    const bounds = markersLayer.getBounds();
    if (bounds.isValid()) fleetMap.fitBounds(bounds, { padding: [24, 24] });
  }
}
function appendDetail(list, label, value) { list.append(node('dt', label), node('dd', value)); }

function showVehicleDetails(vehicle) {
  const content = node('dl', undefined, 'fleet-details-grid');
  appendDetail(content, 'Model', vehicle.model);
  appendDetail(content, 'Rejestracja', vehicle.registration);
  appendDetail(content, 'Transport', `${vehicle.order.id} · ${vehicle.order.route}`);
  appendDetail(content, 'Prędkość', vehicle.speedKmh === null ? 'Brak danych' : `${vehicle.speedKmh} km/h`);
  appendDetail(content, 'Położenie', `${vehicle.location.street || 'Brak ulicy'}, ${vehicle.location.city || 'Brak miasta'}, ${vehicle.location.country || 'Brak kraju'}`);
  appendDetail(content, 'Współrzędne GPS', `${formatNumber(vehicle.location.latitude)}, ${formatNumber(vehicle.location.longitude)}`);
  appendDetail(content, 'Status transportu', executionLabels[vehicle.order.status] || vehicle.order.status);
  appendDetail(content, 'Ocena ETA', delayLabels[vehicle.order.delayStatus] || vehicle.order.delayStatus);
  appendDetail(content, 'Ostatnia aktualizacja GPS', formatDate(vehicle.location.updatedAt));
  appendDetail(content, 'Aktualność GPS', vehicle.location.stale ? `Nieaktualne${vehicle.location.ageSeconds === null ? '' : ` · ${vehicle.location.ageSeconds} s temu`}` : `Aktualne · ${vehicle.location.ageSeconds} s temu`);
  appendDetail(content, 'Trasa', `${vehicle.route.name} · zapisana geometria planowana`);
  fleetById('fleet-details-content').replaceChildren(content);
  fleetById('fleet-details').hidden = false;
}

function renderVehicleList() {
  const cards = fleetVehicles.map(vehicle => {
    const card = node('button', undefined, `fleet-vehicle-card${vehicle.location.stale ? ' gps-stale-row' : ''}${selectedVehicleId === vehicle.id ? ' selected' : ''}`);
    card.type = 'button';
    card.setAttribute('aria-pressed', String(selectedVehicleId === vehicle.id));
    const identity = node('span');
    identity.append(node('strong', `${vehicle.registration} · ${vehicle.model}`), node('small', `${vehicle.order.id} · ${executionLabels[vehicle.order.status] || vehicle.order.status}`));
    const gps = node('span', vehicle.location.stale ? 'GPS nieaktualny' : 'GPS aktualny', `gps-badge ${vehicle.location.stale ? 'gps-stale' : 'gps-fresh'} fleet-card-status`);
    const route = node('span', `${vehicle.route.name} · ${vehicle.speedKmh === null ? 'brak prędkości' : `${vehicle.speedKmh} km/h`}`, 'fleet-card-route');
    card.append(identity, gps, route, node('span', 'Pokaż trasę', 'fleet-card-action'));
    card.addEventListener('click', () => selectVehicle(vehicle.id));
    return card;
  });
  if (!cards.length) cards.push(node('p', 'Brak aktywnych pojazdów w bazie.'));
  fleetById('fleet-vehicles').replaceChildren(...cards);
}

function selectVehicle(id) {
  const vehicle = getVehicle(id);
  if (!vehicle) return;
  selectedVehicleId = id;
  showVehicleDetails(vehicle);
  renderVehicleList();
  if (routesLayer) {
    routesLayer.clearLayers();
    const points = vehicle.route.coordinates.map(point => [point.lat, point.lng]);
    if (points.length >= 2) window.L.polyline(points, { color: '#3b82f6', weight: 6, opacity: 0.95 }).addTo(routesLayer);
  }
  if (fleetMap && Number.isFinite(vehicle.location.latitude) && Number.isFinite(vehicle.location.longitude)) {
    const points = vehicle.route.coordinates.map(point => [point.lat, point.lng]);
    points.push([vehicle.location.latitude, vehicle.location.longitude]);
    fleetMap.fitBounds(window.L.latLngBounds(points), { padding: [24, 24] });
  }
  for (const marker of markersLayer?.getLayers() || []) marker.setOpacity(marker.vehicleId === id ? 1 : 0.45);
  const marker = (markersLayer?.getLayers() || []).find(item => item.vehicleId === id);
  if (marker) marker.openPopup();
}

function updateMap() {
  if (!fleetMap) return;
  if (markersLayer) markersLayer.clearLayers();
  if (routesLayer) routesLayer.clearLayers();
  if (!markersLayer) markersLayer = window.L.featureGroup().addTo(fleetMap);
  if (!routesLayer) routesLayer = window.L.featureGroup().addTo(fleetMap);
  for (const vehicle of fleetVehicles) {
    if (!Number.isFinite(vehicle.location.latitude) || !Number.isFinite(vehicle.location.longitude)) continue;
    const icon = window.L.divIcon({ className: vehicle.location.stale ? 'outpost-marker outpost-marker-stale' : 'outpost-marker', html: '●', iconSize: [28, 28], iconAnchor: [14, 14] });
    const marker = window.L.marker([vehicle.location.latitude, vehicle.location.longitude], { icon, keyboard: true }).addTo(markersLayer);
    marker.vehicleId = vehicle.id;
    marker.bindPopup(popupContent(vehicle));
    marker.on('click', () => selectVehicle(vehicle.id));
  }
  const bounds = markersLayer.getBounds();
  if (!selectedVehicleId && bounds.isValid()) fleetMap.fitBounds(bounds, { padding: [24, 24] });
}

function renderVehicles(vehicles) {
  fleetVehicles = vehicles;
  renderVehicleList();
  fleetById('fleet-count').textContent = `Pojazdy: ${vehicles.length}`;
  if (fleetById('active-transports')) fleetById('active-transports').textContent = `Aktywne transporty: ${vehicles.filter(vehicle => vehicle.order.status !== 'completed').length}`;
  updateMap();
  if (selectedVehicleId) {
    const selected = getVehicle(selectedVehicleId);
    if (selected) showVehicleDetails(selected);
  }
}

async function loadFleet() {
  if (loading) return;
  loading = true;
  const refresh = fleetById('fleet-refresh');
  refresh.disabled = true;
  fleetById('fleet-error').textContent = '';
  try {
    const response = await fetch('/api/vehicles');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Nie udało się pobrać floty.');
    if (!Array.isArray(data.vehicles)) throw new Error('API zwróciło nieprawidłowy format danych floty.');
    renderVehicles(data.vehicles);
  } catch (error) {
    fleetById('fleet-error').textContent = error.message || 'Nie udało się pobrać floty.';
  } finally {
    loading = false;
    refresh.disabled = false;
  }
}

function initializeMap() {
  if (fleetMap || !fleetById('fleet-map')) return;
  if (!window.L) return;
  fleetMap = window.L.map('fleet-map').setView([52.1, 19.2], 6);
  const tiles = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  });
  tiles.on('tileerror', () => setMapStatus('Nie można pobrać kafelków mapy. Sprawdź połączenie z internetem.'));
  tiles.on('tileload', () => setMapStatus(''));
  tiles.addTo(fleetMap);
  markersLayer = window.L.featureGroup().addTo(fleetMap);
  routesLayer = window.L.featureGroup().addTo(fleetMap);
}

if (fleetById('fleet-view')) {
  fleetById('fleet-refresh').addEventListener('click', loadFleet);
  fleetById('fleet-show-all').addEventListener('click', showAllVehicles);
  if (typeof document.addEventListener === 'function') document.addEventListener('outpost-refresh-fleet', loadFleet);
  initializeMap();
  loadFleet();
}
