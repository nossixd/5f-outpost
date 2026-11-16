const fleetById = id => document.getElementById(id);
const executionLabels = { in_progress: 'W realizacji', completed: 'Zakończono' };
const delayLabels = {
  at_risk: 'Ryzyko opóźnienia',
  on_time: 'W terminie',
  missing_data: 'Brak danych ETA',
  eta_update_required: 'Wymaga aktualizacji ETA',
};
let fleetMap;
let mapsApi;
let mapsPromise;
let infoWindow;
let mapsAuthFailed = false;
let activeRouteLine;
let selectedVehicleId = null;
let hoveredVehicleId = null;
let fleetVehicles = [];
let roadRoutesEnabled = false;
let mapId = 'DEMO_MAP_ID';
const markersByVehicle = new Map();
const savedRouteLines = new Map();
const roadRoutesByVehicle = new Map();
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

function formatNumber(value, digits = 5) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
    ? Number(value).toFixed(digits) : 'Brak danych';
}

function showMapMessage(message) {
  fleetById('fleet-map-status').textContent = message;
  if (!fleetMap) fleetById('fleet-map').textContent = message;
}

async function importMapsLibraries() {
  const [maps, marker, core] = await Promise.all([
    window.google.maps.importLibrary('maps'),
    window.google.maps.importLibrary('marker'),
    window.google.maps.importLibrary('core'),
  ]);
  return { ...maps, ...marker, ...core };
}

function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.importLibrary) return importMapsLibraries();
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const callbackName = 'outpostGoogleMapsLoaded';
    const script = document.createElement('script');
    mapsAuthFailed = false;
    window[callbackName] = () => {
      delete window[callbackName];
      importMapsLibraries().then(resolve, reject);
    };
    window.gm_authFailure = () => {
      showMapMessage('Google Maps odrzuciło klucz API. Sprawdź ograniczenia klucza i włączone API.');
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&loading=async&v=weekly`;
    script.async = true;
    script.onerror = () => reject(new Error('Nie udało się załadować Google Maps. Sprawdź połączenie, klucz i jego ograniczenia.'));
    document.head.appendChild(script);
  }).catch(error => {
    mapsPromise = null;
    throw error;
  });
  return mapsPromise;
}

function mapInfoContent(vehicle) {
  const content = document.createElement('div');
  const title = node('strong', `${vehicle.registration} · ${vehicle.model}`);
  const address = node('p', `${vehicle.location.street || 'Brak ulicy'}, ${vehicle.location.city || 'Brak miasta'}, ${vehicle.location.country || 'Brak kraju'}`);
  const speed = node('p', `Prędkość: ${vehicle.speedKmh === null ? 'Brak danych' : `${vehicle.speedKmh} km/h`}`);
  const order = node('p', `Zlecenie ${vehicle.order.id}: ${executionLabels[vehicle.order.status] || vehicle.order.status}`);
  const route = node('p', `Trasa: ${vehicle.route.name}`);
  content.append(title, address, speed, order, route);
  return content;
}

function getVehicle(id) {
  return fleetVehicles.find(vehicle => vehicle.id === id);
}

function getDisplayedRoute(vehicle) {
  const roadRoute = roadRoutesByVehicle.get(vehicle.id);
  return roadRoute?.routeId === vehicle.route.id ? roadRoute.route : null;
}

function routeCoordinates(vehicle) {
  return getDisplayedRoute(vehicle)?.coordinates || vehicle.route.coordinates;
}

function createRouteLine(vehicle, { highlight = false, map = fleetMap } = {}) {
  return new mapsApi.Polyline({
    map,
    path: routeCoordinates(vehicle),
    strokeColor: highlight ? '#3b82f6' : '#7b879a',
    strokeOpacity: highlight ? 0.96 : 0.38,
    strokeWeight: highlight ? 6 : 3,
    zIndex: highlight ? 10 : 1,
  });
}

function updateSavedRoutes() {
  const currentRoutes = new Set(fleetVehicles.map(vehicle => vehicle.route.id));
  for (const [routeId, routeLine] of savedRouteLines) {
    if (!currentRoutes.has(routeId)) {
      routeLine.setMap(null);
      savedRouteLines.delete(routeId);
    }
  }
  for (const vehicle of fleetVehicles) {
    let routeLine = savedRouteLines.get(vehicle.route.id);
    if (!routeLine) {
      routeLine = createRouteLine(vehicle);
      savedRouteLines.set(vehicle.route.id, routeLine);
    } else {
      routeLine.setPath(vehicle.route.coordinates);
    }
  }
}

function fitBounds(points) {
  if (!points.length) return;
  const bounds = new mapsApi.LatLngBounds();
  points.forEach(point => bounds.extend(point));
  fleetMap.fitBounds(bounds, 48);
}

function showAllVehicles({ fit = true } = {}) {
  selectedVehicleId = null;
  hoveredVehicleId = null;
  if (activeRouteLine) activeRouteLine.setMap(null);
  activeRouteLine = null;
  if (infoWindow) infoWindow.close();
  fleetById('fleet-details').hidden = true;
  fleetById('fleet-map-status').textContent = '';
  if (fleetMap && mapsApi) updateSavedRoutes();
  if (fit && fleetMap && mapsApi) {
    fitBounds(fleetVehicles
      .filter(vehicle => Number.isFinite(vehicle.location.latitude) && Number.isFinite(vehicle.location.longitude))
      .map(vehicle => ({ lat: vehicle.location.latitude, lng: vehicle.location.longitude })));
  }
  renderVehicleList();
}

function displayRoute(vehicle, { fit = false, preview = false } = {}) {
  if (!fleetMap || !mapsApi) return;
  if (activeRouteLine) activeRouteLine.setMap(null);
  activeRouteLine = createRouteLine(vehicle, { highlight: true });
  if (fit) {
    const points = [...routeCoordinates(vehicle)];
    if (Number.isFinite(vehicle.location.latitude) && Number.isFinite(vehicle.location.longitude)) {
      points.push({ lat: vehicle.location.latitude, lng: vehicle.location.longitude });
    }
    fitBounds(points);
  }
  if (!preview) {
    fleetById('fleet-map-status').textContent = `${vehicle.route.name} · zlecenie ${vehicle.order.id}`;
  }
}

function showMarkerInfo(vehicle, brief = false) {
  if (!infoWindow || !fleetMap) return;
  infoWindow.setContent(brief
    ? node('span', `${vehicle.registration} · ${vehicle.model} · ${vehicle.order.id}`)
    : mapInfoContent(vehicle));
  const marker = markersByVehicle.get(vehicle.id)?.marker;
  if (marker) infoWindow.open({ map: fleetMap, anchor: marker });
}

function makeMarker(vehicle) {
  const vehicleId = vehicle.id;
  const pin = new mapsApi.PinElement({
    glyphText: '🚚',
    background: vehicle.location.stale ? '#c0644e' : '#3b82f6',
    glyphColor: '#ffffff',
    scale: 1.2,
  });
  const marker = new mapsApi.AdvancedMarkerElement({
    map: fleetMap,
    position: { lat: vehicle.location.latitude, lng: vehicle.location.longitude },
    title: `${vehicle.registration} · ${vehicle.model} · zlecenie ${vehicle.order.id}`,
    gmpClickable: true,
  });
  marker.append(pin);
  marker.addEventListener('gmp-click', () => selectVehicle(vehicleId));
  marker.addEventListener('pointerenter', () => {
    const current = getVehicle(vehicleId);
    if (current) showMarkerInfo(current, true);
  });
  marker.addEventListener('pointerleave', () => {
    const current = getVehicle(vehicleId);
    if (selectedVehicleId === vehicleId && current) showMarkerInfo(current);
    else infoWindow?.close();
  });
  return { marker, pin };
}

function updateMarkers() {
  const currentIds = new Set(fleetVehicles.map(vehicle => vehicle.id));
  for (const [id, entry] of markersByVehicle) {
    if (!currentIds.has(id)) {
      entry.marker.map = null;
      markersByVehicle.delete(id);
    }
  }
  for (const vehicle of fleetVehicles) {
    const hasPosition = Number.isFinite(vehicle.location.latitude) && Number.isFinite(vehicle.location.longitude);
    let entry = markersByVehicle.get(vehicle.id);
    if (!hasPosition) {
      if (entry) entry.marker.map = null;
      continue;
    }
    if (!entry) {
      entry = makeMarker(vehicle);
      markersByVehicle.set(vehicle.id, entry);
    } else {
      entry.marker.map = fleetMap;
      entry.marker.position = { lat: vehicle.location.latitude, lng: vehicle.location.longitude };
      entry.marker.title = `${vehicle.registration} · ${vehicle.model} · zlecenie ${vehicle.order.id}`;
      entry.pin.background = vehicle.location.stale ? '#c0644e' : '#3b82f6';
      entry.marker.replaceChildren(entry.pin);
    }
    entry.vehicle = vehicle;
  }
}

function appendDetail(list, label, value) {
  list.append(node('dt', label), node('dd', value));
}

function showVehicleDetails(vehicle) {
  const panel = fleetById('fleet-details');
  const content = document.createElement('dl');
  content.className = 'fleet-details-grid';
  const roadRoute = getDisplayedRoute(vehicle);
  const path = routeCoordinates(vehicle);
  const routeDescription = roadRoute
    ? `Google Routes API · ${(roadRoute.distanceMeters / 1000).toFixed(1)} km · ${Math.round(roadRoute.durationSeconds / 60)} min`
    : `Uproszczona geometria podglądowa`;
  appendDetail(content, 'Model', vehicle.model);
  appendDetail(content, 'Rejestracja', vehicle.registration);
  appendDetail(content, 'Transport', `${vehicle.order.id} · ${vehicle.order.route}`);
  appendDetail(content, 'Prędkość', vehicle.speedKmh === null ? 'Brak danych' : `${vehicle.speedKmh} km/h`);
  appendDetail(content, 'Położenie', `${vehicle.location.street || 'Brak ulicy'}, ${vehicle.location.city || 'Brak miasta'}, ${vehicle.location.country || 'Brak kraju'}`);
  appendDetail(content, 'Współrzędne GPS', `${formatNumber(vehicle.location.latitude)}, ${formatNumber(vehicle.location.longitude)}`);
  appendDetail(content, 'Status transportu', executionLabels[vehicle.order.status] || vehicle.order.status);
  appendDetail(content, 'Ocena ETA (FR-02)', delayLabels[vehicle.order.delayStatus] || vehicle.order.delayStatus);
  appendDetail(content, 'Ostatnia aktualizacja GPS', formatDate(vehicle.location.updatedAt));
  appendDetail(content, 'Aktualność GPS', vehicle.location.stale
    ? `Nieaktualne${vehicle.location.ageSeconds === null ? '' : ` · ${vehicle.location.ageSeconds} s temu`}`
    : `Aktualne · ${vehicle.location.ageSeconds} s temu`);
  appendDetail(content, 'Trasa', vehicle.route.name);
  appendDetail(content, 'Początek / koniec', `${formatNumber(path[0]?.lat)}, ${formatNumber(path[0]?.lng)} → ${formatNumber(path[path.length - 1]?.lat)}, ${formatNumber(path[path.length - 1]?.lng)}`);
  appendDetail(content, 'Przebieg', routeDescription);
  fleetById('fleet-details-content').replaceChildren(content);
  const roadButton = fleetById('fleet-road-route');
  roadButton.hidden = !roadRoutesEnabled;
  roadButton.disabled = false;
  roadButton.textContent = roadRoute ? 'Wyznacz ponownie trasę drogową' : 'Wyznacz trasę po drogach';
  fleetById('fleet-road-status').textContent = '';
  panel.hidden = false;
}

function renderVehicleList() {
  const cards = fleetVehicles.map(vehicle => {
    const card = node('button', undefined, `fleet-vehicle-card${vehicle.location.stale ? ' gps-stale-row' : ''}${selectedVehicleId === vehicle.id ? ' selected' : ''}`);
    card.type = 'button';
    card.setAttribute('aria-pressed', String(selectedVehicleId === vehicle.id));
    const identity = document.createElement('span');
    identity.append(node('strong', `${vehicle.registration} · ${vehicle.model}`));
    identity.append(node('small', `${vehicle.order.id} · ${executionLabels[vehicle.order.status] || vehicle.order.status}`));
    const gps = node('span', vehicle.location.stale ? 'GPS nieaktualny' : 'GPS aktualny', `gps-badge ${vehicle.location.stale ? 'gps-stale' : 'gps-fresh'} fleet-card-status`);
    const route = node('span', `${vehicle.route.name} · ${vehicle.speedKmh === null ? 'brak prędkości' : `${vehicle.speedKmh} km/h`}`, 'fleet-card-route');
    const action = node('span', 'Pokaż trasę', 'fleet-card-action');
    card.append(identity, gps, route, action);
    card.addEventListener('click', () => selectVehicle(vehicle.id));
    card.addEventListener('pointerenter', () => {
      hoveredVehicleId = vehicle.id;
      displayRoute(vehicle, { preview: true });
    });
    card.addEventListener('pointerleave', () => {
      if (hoveredVehicleId === vehicle.id) hoveredVehicleId = null;
      const selected = getVehicle(selectedVehicleId);
      if (selected) displayRoute(selected);
      else {
        if (activeRouteLine) activeRouteLine.setMap(null);
        activeRouteLine = null;
      }
    });
    return card;
  });
  if (!cards.length) cards.push(node('p', 'Brak aktywnych pojazdów w bazie.'));
  fleetById('fleet-vehicles').replaceChildren(...cards);
}

function selectVehicle(id) {
  const vehicle = getVehicle(id);
  if (!vehicle) return;
  selectedVehicleId = id;
  hoveredVehicleId = null;
  showVehicleDetails(vehicle);
  displayRoute(vehicle, { fit: true });
  showMarkerInfo(vehicle);
  renderVehicleList();
}

function renderVehicles(vehicles, { fitAll = false } = {}) {
  fleetVehicles = vehicles;
  for (const [vehicleId, saved] of roadRoutesByVehicle) {
    const vehicle = getVehicle(vehicleId);
    if (!vehicle || vehicle.route.id !== saved.routeId) roadRoutesByVehicle.delete(vehicleId);
  }
  renderVehicleList();
  fleetById('fleet-count').textContent = `Pojazdy: ${vehicles.length}`;
  if (!fleetMap || !mapsApi) return;
  updateMarkers();
  updateSavedRoutes();
  const selected = getVehicle(selectedVehicleId);
  if (selected) {
    showVehicleDetails(selected);
    displayRoute(selected);
  } else if (hoveredVehicleId && getVehicle(hoveredVehicleId)) {
    displayRoute(getVehicle(hoveredVehicleId), { preview: true });
  } else {
    showAllVehicles({ fit: fitAll });
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

    let config;
    try {
      const configResponse = await fetch('/api/config');
      config = await configResponse.json();
      if (!configResponse.ok) throw new Error(config.error || 'Nie udało się pobrać konfiguracji mapy.');
    } catch (error) {
      roadRoutesEnabled = false;
      showMapMessage(error.message || 'Nie udało się pobrać konfiguracji mapy.');
      return;
    }
    roadRoutesEnabled = Boolean(config.roadRoutesEnabled);
    mapId = config.googleMapsMapId || 'DEMO_MAP_ID';
    if (!config.googleMapsApiKey) {
      showMapMessage('Brak GOOGLE_MAPS_API_KEY. Skonfiguruj ograniczony klucz Google Maps, aby wyświetlić mapę.');
      return;
    }

    try {
      mapsApi = await loadGoogleMaps(config.googleMapsApiKey);
      if (mapsAuthFailed) throw new Error('Google Maps odrzuciło klucz API. Sprawdź ograniczenia klucza i włączone API.');
      if (!fleetMap) {
        fleetById('fleet-map').replaceChildren();
        fleetById('fleet-map').classList.add('google-map-ready');
        fleetMap = new mapsApi.Map(fleetById('fleet-map'), {
          center: { lat: 52.1, lng: 18.8 },
          zoom: 5,
          mapId,
          mapTypeControl: false,
        });
        infoWindow = new mapsApi.InfoWindow();
      }
      if (mapsAuthFailed) throw new Error('Google Maps odrzuciło klucz API. Sprawdź ograniczenia klucza i włączone API.');
      fleetById('fleet-map-status').textContent = '';
      renderVehicles(data.vehicles, { fitAll: !selectedVehicleId });
    } catch (error) {
      showMapMessage(error.message || 'Nie udało się uruchomić Google Maps.');
    }
  } catch (error) {
    fleetById('fleet-error').textContent = error.message || 'Nie udało się pobrać floty.';
  } finally {
    loading = false;
    refresh.disabled = false;
  }
}

async function requestRoadRoute() {
  const vehicle = getVehicle(selectedVehicleId);
  if (!vehicle || !roadRoutesEnabled) return;
  const accepted = window.confirm('Wyznaczenie trasy wysyła żądanie do Google Routes API i może naliczyć opłatę. Kontynuować?');
  if (!accepted) return;

  const button = fleetById('fleet-road-route');
  const status = fleetById('fleet-road-status');
  button.disabled = true;
  status.textContent = 'Wyznaczanie trasy drogowej…';
  try {
    const response = await fetch(`/api/vehicles/${encodeURIComponent(vehicle.id)}/road-route`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Google Routes API nie zwróciło trasy.');
    if (!Array.isArray(data.route?.coordinates) || data.route.coordinates.length < 2) {
      throw new Error('API zwróciło nieprawidłową geometrię trasy.');
    }
    roadRoutesByVehicle.set(vehicle.id, { routeId: vehicle.route.id, route: data.route });
    showVehicleDetails(vehicle);
    displayRoute(vehicle, { fit: true });
    status.textContent = 'Trasa drogowa otrzymana. To trasa dla samochodu; może nie uwzględniać ograniczeń dla ciężarówek.';
  } catch (error) {
    status.textContent = error.message || 'Nie udało się wyznaczyć trasy drogowej.';
  } finally {
    button.disabled = false;
  }
}

// Osobny widok HTML: nawigacja odbywa się przez zwykłe linki między stronami.
// Dane i mapa są inicjowane po otwarciu strony monitoringu floty.
if (fleetById('fleet-view')) {
  fleetById('fleet-refresh').addEventListener('click', loadFleet);
  fleetById('fleet-show-all').addEventListener('click', () => showAllVehicles());
  fleetById('fleet-road-route').addEventListener('click', requestRoadRoute);
  loadFleet();
}
